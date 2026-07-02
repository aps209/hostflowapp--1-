import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import ReservationForm from "../components/reservas/ReservationForm";
import ReservationList from "../components/reservas/ReservationList";
import AdvancedSearch from "../components/common/AdvancedSearch";
import SortControls from "../components/common/SortControls";
import { motion, AnimatePresence } from "framer-motion";
import { format, addDays, subDays, isToday, parseISO } from "date-fns";
import { es, enUS, fr } from "date-fns/locale";
import { useTranslation } from "../components/TranslationProvider";
import { useRestaurant } from "../components/RestaurantContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const localeMap = {
  'es': es,
  'en': enUS,
  'fr': fr,
};

const generateConfirmationToken = () => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

export default function Reservas() {
  const [showForm, setShowForm] = useState(false);
  const [editingReservation, setEditingReservation] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [reservationToDelete, setReservationToDelete] = useState(null);
  const [advancedFilters, setAdvancedFilters] = useState({
    dateFrom: null,
    dateTo: null,
    guestsMin: '',
    guestsMax: '',
    table: 'all',
    waiter: 'all',
    source: 'all',
    occasion: 'all',
  });
  const [sortBy, setSortBy] = useState('fecha');
  const [sortOrder, setSortOrder] = useState('desc');
  const [savedFilters, setSavedFilters] = useState([]);
  
  const queryClient = useQueryClient();
  const { restaurantId, loading: loadingRestaurant } = useRestaurant();

  const { data: configs = [] } = useQuery({
    queryKey: ['restaurantConfig', restaurantId],
    queryFn: () => base44.entities.RestaurantConfig.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 0,
    cacheTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const config = configs[0];
  const currentLang = config?.idioma || 'es';
  const { t } = useTranslation(currentLang);
  const locale = localeMap[currentLang] || es;
  const colorPrimario = config?.color_primario || '#1e3a8a';
  const colorAccento = config?.color_acento || '#f59e0b';

  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ['reservations', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ restaurant_id: restaurantId }, '-created_date'),
    enabled: !!restaurantId,
    staleTime: 0,
    cacheTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 10000,
  });

  const { data: tables = [] } = useQuery({
    queryKey: ['tables', restaurantId],
    queryFn: () => base44.entities.Table.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 0,
    cacheTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', restaurantId],
    queryFn: () => base44.entities.Customer.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 2 * 60 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules', restaurantId],
    queryFn: () => base44.entities.Schedule.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 2 * 60 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: specialDays = [] } = useQuery({
    queryKey: ['specialDays', restaurantId],
    queryFn: () => base44.entities.SpecialDay.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 2 * 60 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: waiters = [] } = useQuery({
    queryKey: ['waiters', restaurantId],
    queryFn: () => base44.entities.Waiter.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  // Cargar filtros guardados del localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`reservas_filters_${restaurantId}`);
    if (saved) {
      try {
        setSavedFilters(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading saved filters:', e);
      }
    }
  }, [restaurantId]);
  
  const reservationMutation = useMutation({
    mutationFn: async (data) => {
      console.log('[Reservas] 🚀 Iniciando creación/edición de reserva');
      const dataWithRestaurant = { ...data, restaurant_id: restaurantId };
      
      const currentUser = await base44.auth.me();
      
      let customerId = null;
      let customer = null;

      if (dataWithRestaurant.cliente_email) {
        const existing = await base44.entities.Customer.filter({ 
          email: dataWithRestaurant.cliente_email,
          restaurant_id: restaurantId
        });
        if (existing.length > 0) customer = existing[0];
      }
      
      if (!customer && dataWithRestaurant.cliente_telefono) {
        const existing = await base44.entities.Customer.filter({ 
          telefono: dataWithRestaurant.cliente_telefono,
          restaurant_id: restaurantId
        });
        if (existing.length > 0) customer = existing[0];
      }

      if (!customer && dataWithRestaurant.cliente_nombre) {
        const allCustomers = await base44.entities.Customer.filter({ 
          restaurant_id: restaurantId
        });
        
        const nombreBuscado = dataWithRestaurant.cliente_nombre.toLowerCase().trim();
        customer = allCustomers.find(c => 
          c.nombre && c.nombre.toLowerCase().trim() === nombreBuscado
        );
      }

      if (customer) {
        customerId = customer.id;
        
        const updateData = {
          total_visitas: (customer.total_visitas || 0) + 1,
          ultima_visita: dataWithRestaurant.fecha,
        };
        
        if (dataWithRestaurant.cliente_email && !customer.email) {
          updateData.email = dataWithRestaurant.cliente_email;
        }
        if (dataWithRestaurant.cliente_telefono && !customer.telefono) {
          updateData.telefono = dataWithRestaurant.cliente_telefono;
        }
        
        await base44.entities.Customer.update(customerId, updateData);
      } else {
        const newCustomer = await base44.entities.Customer.create({
          nombre: dataWithRestaurant.cliente_nombre,
          email: dataWithRestaurant.cliente_email,
          telefono: dataWithRestaurant.cliente_telefono,
          total_visitas: 1,
          ultima_visita: dataWithRestaurant.fecha,
          restaurant_id: restaurantId,
        });
        customerId = newCustomer.id;
      }
      
      const reservationData = { ...dataWithRestaurant, cliente_id: customerId };

      if (!dataWithRestaurant.id) {
        const currentYear = new Date().getFullYear();
        const allReservations = await base44.entities.Reservation.filter({ 
          restaurant_id: restaurantId 
        });
        
        const currentYearReservations = allReservations.filter(r => {
          if (!r.reservation_id) return false;
          const match = r.reservation_id.match(/R-(\d{4})-(\d+)/);
          if (match) {
            const year = parseInt(match[1]);
            return year === currentYear;
          }
          return false;
        });

        let maxNumber = 0;
        currentYearReservations.forEach(r => {
          const match = r.reservation_id.match(/R-\d{4}-(\d+)/);
          if (match) {
            const num = parseInt(match[1]);
            if (num > maxNumber) {
              maxNumber = num;
            }
          }
        });

        const nextNumber = maxNumber + 1;
        reservationData.reservation_id = `R-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
        
        // 🔥 CRÍTICO: Establecer siempre created_by y origen para nuevas reservas
        reservationData.created_by = currentUser.email;
        
        // Si no hay origen definido, establecerlo por defecto a 'admin'
        if (!reservationData.origen) {
          reservationData.origen = 'admin';
        }
        
        reservationData.confirmation_token = generateConfirmationToken();
        
        const newReservation = await base44.entities.Reservation.create(reservationData);
        console.log('[Reservas] ✅ Reserva creada:', newReservation.id);
        
        if (newReservation.cliente_email) {
          try {
            console.log('[Reservas] 📧 Enviando email de confirmación...');
            await base44.functions.invoke('enviarEmailConfirmacion', {
              reservationId: newReservation.id
            });
            console.log('[Reservas] ✅ Email de confirmación enviado correctamente');
            toast.success('Reserva creada y email de confirmación enviado');
          } catch (emailError) {
            console.warn('[Reservas] ⚠️ Email no enviado:', emailError.message);
            toast.success('Reserva creada correctamente');
          }
        } else {
          toast.success('Reserva creada correctamente');
        }
        
        return newReservation;
      } else {
        // Al actualizar, NO sobrescribir created_by ni origen
        const updatePayload = { ...reservationData };
        delete updatePayload.created_by; 
        delete updatePayload.origen;     
        
        const updatedReservation = await base44.entities.Reservation.update(dataWithRestaurant.id, updatePayload);
        console.log('[Reservas] ✅ Reserva actualizada:', updatedReservation.id);
        toast.success('Reserva actualizada correctamente');
        return updatedReservation;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['customers', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['tables', restaurantId] });
      setShowForm(false);
      setEditingReservation(null);
    },
    onError: (error) => {
      console.error('[Reservas] 💥 Error en mutation:', error);
      toast.error(`Error al guardar reserva: ${error.message}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Reservation.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations', restaurantId] });
      setReservationToDelete(null);
      toast.success('Reserva eliminada correctamente');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, estado }) => {
      const updatedReservation = await base44.entities.Reservation.update(id, { estado });
      
      // Si el estado cambió a "cancelada", enviar email de cancelación inmediatamente
      if (estado === 'cancelada' && updatedReservation.cliente_email) {
        try {
          console.log('[Reservas] 📧 Enviando email de cancelación...');
          await base44.functions.invoke('enviarEmailCancelacion', {
            reservationId: id
          });
          console.log('[Reservas] ✅ Email de cancelación enviado correctamente');
        } catch (emailError) {
          console.warn('[Reservas] ⚠️ Error enviando email:', emailError.message);
        }
      }
      
      return updatedReservation;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reservations', restaurantId] });
      
      if (variables.estado === 'cancelada') {
        toast.success('Reserva cancelada y email enviado');
      } else {
        toast.success('Estado actualizado correctamente');
      }
    },
  });

  const handleSubmit = (data) => {
    const submitData = editingReservation ? { ...data, id: editingReservation.id } : data;
    reservationMutation.mutate(submitData);
  };

  const handleEdit = (reservation) => {
    queryClient.invalidateQueries({ queryKey: ['tables', restaurantId] });
    setEditingReservation(reservation);
    setShowForm(true);
  };

  const handleStatusChange = (reservationId, newStatus) => {
    updateStatusMutation.mutate({ id: reservationId, estado: newStatus });
  };

  const handleDeleteRequest = (id) => {
    setReservationToDelete(id);
  };

  const handleDeleteConfirm = () => {
    if (reservationToDelete) {
      deleteMutation.mutate(reservationToDelete);
    }
  };

  const handleNewReservation = () => {
    queryClient.invalidateQueries({ queryKey: ['tables', restaurantId] });
    setEditingReservation(null);
    setShowForm(!showForm);
  };

  const formattedSelectedDate = format(selectedDate, 'yyyy-MM-dd');

  const filteredReservations = useMemo(() => {
    let filtered = [...reservations];

    // Búsqueda básica
    if (searchTerm) {
      filtered = filtered.filter(r =>
        r.cliente_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.reservation_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.cliente_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.cliente_telefono?.includes(searchTerm)
      );
    }

    // Filtro de estado básico
    if (statusFilter !== "all") {
      filtered = filtered.filter(r => r.estado === statusFilter);
    }

    // Filtro de fecha seleccionada (si no hay rango avanzado)
    if (!advancedFilters.dateFrom && !advancedFilters.dateTo) {
      filtered = filtered.filter(r => r.fecha === formattedSelectedDate);
    }

    // Filtros avanzados
    if (advancedFilters.dateFrom) {
      const fromDate = format(advancedFilters.dateFrom, 'yyyy-MM-dd');
      filtered = filtered.filter(r => r.fecha >= fromDate);
    }
    if (advancedFilters.dateTo) {
      const toDate = format(advancedFilters.dateTo, 'yyyy-MM-dd');
      filtered = filtered.filter(r => r.fecha <= toDate);
    }
    if (advancedFilters.guestsMin) {
      filtered = filtered.filter(r => r.comensales >= parseInt(advancedFilters.guestsMin));
    }
    if (advancedFilters.guestsMax) {
      filtered = filtered.filter(r => r.comensales <= parseInt(advancedFilters.guestsMax));
    }
    if (advancedFilters.table !== 'all') {
      filtered = filtered.filter(r => r.mesa_id === advancedFilters.table);
    }
    if (advancedFilters.waiter !== 'all') {
      filtered = filtered.filter(r => r.waiter_id === advancedFilters.waiter);
    }
    if (advancedFilters.source !== 'all') {
      filtered = filtered.filter(r => r.origen === advancedFilters.source);
    }
    if (advancedFilters.occasion !== 'all') {
      filtered = filtered.filter(r => r.ocasion_especial === advancedFilters.occasion);
    }

    // Ordenación
    filtered.sort((a, b) => {
      let compareValue = 0;
      
      switch (sortBy) {
        case 'fecha':
          const dateA = parseISO(`${a.fecha}T${a.hora}`);
          const dateB = parseISO(`${b.fecha}T${b.hora}`);
          compareValue = dateA - dateB;
          break;
        case 'cliente':
          compareValue = (a.cliente_nombre || '').localeCompare(b.cliente_nombre || '');
          break;
        case 'comensales':
          compareValue = a.comensales - b.comensales;
          break;
        case 'mesa':
          compareValue = (a.mesa_numero || '').localeCompare(b.mesa_numero || '');
          break;
        case 'gasto':
          compareValue = (a.gasto_total || 0) - (b.gasto_total || 0);
          break;
        default:
          compareValue = 0;
      }
      
      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    return filtered;
  }, [reservations, searchTerm, statusFilter, formattedSelectedDate, advancedFilters, sortBy, sortOrder]);

  const handleSavePreset = (preset) => {
    const updated = [...savedFilters, preset];
    setSavedFilters(updated);
    localStorage.setItem(`reservas_filters_${restaurantId}`, JSON.stringify(updated));
  };

  const handleLoadPreset = (filters) => {
    setAdvancedFilters(filters);
  };

  const handleDeletePreset = (index) => {
    const updated = savedFilters.filter((_, i) => i !== index);
    setSavedFilters(updated);
    localStorage.setItem(`reservas_filters_${restaurantId}`, JSON.stringify(updated));
  };

  const advancedFilterConfig = [
    { key: 'dateFrom', type: 'date', label: 'Fecha desde', placeholder: 'Selecciona fecha' },
    { key: 'dateTo', type: 'date', label: 'Fecha hasta', placeholder: 'Selecciona fecha' },
    { key: 'guestsMin', type: 'number', label: 'Comensales mínimo', placeholder: '1', min: 1 },
    { key: 'guestsMax', type: 'number', label: 'Comensales máximo', placeholder: '20', min: 1 },
    { 
      key: 'table', 
      type: 'select', 
      label: 'Mesa específica',
      defaultValue: 'all',
      options: [
        { value: 'all', label: 'Todas las mesas' },
        ...tables.map(t => ({ value: t.id, label: `Mesa ${t.numero}` }))
      ]
    },
    {
      key: 'waiter',
      type: 'select',
      label: 'Camarero',
      defaultValue: 'all',
      options: [
        { value: 'all', label: 'Todos los camareros' },
        ...waiters.map(w => ({ value: w.id, label: `${w.nombre} ${w.apellidos || ''}` }))
      ]
    },
    {
      key: 'source',
      type: 'select',
      label: 'Origen',
      defaultValue: 'all',
      options: [
        { value: 'all', label: 'Todos los orígenes' },
        { value: 'admin', label: 'Panel Admin' },
        { value: 'web', label: 'Formulario Web' },
        { value: 'chatbot', label: 'Asistente de Voz' },
        { value: 'walk_in', label: 'Walk-in' },
      ]
    },
    {
      key: 'occasion',
      type: 'select',
      label: 'Ocasión especial',
      defaultValue: 'all',
      options: [
        { value: 'all', label: 'Todas' },
        { value: 'ninguna', label: 'Ninguna' },
        { value: 'cumpleanos', label: 'Cumpleaños' },
        { value: 'aniversario', label: 'Aniversario' },
        { value: 'negocio', label: 'Negocio' },
        { value: 'cita', label: 'Cita' },
      ]
    },
  ];

  const sortOptions = [
    { value: 'fecha', label: 'Fecha/Hora' },
    { value: 'cliente', label: 'Nombre Cliente' },
    { value: 'comensales', label: 'Número de Comensales' },
    { value: 'mesa', label: 'Número de Mesa' },
    { value: 'gasto', label: 'Gasto Total' },
  ];

  const formatDateForDisplay = (date) => {
    if (isToday(date)) {
      return `${t('common.today')}, ${format(date, 'd MMM', { locale })}`;
    }
    return format(date, "EEE, d MMM", { locale });
  };

  if (loadingRestaurant || !restaurantId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-600 dark:text-slate-400">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 min-h-screen">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white break-words">{t('reservations.title')}</h1>
          <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">{t('reservations.subtitle')}</p>
        </div>
        <Button
          onClick={handleNewReservation}
          className="shadow-lg text-white w-full sm:w-auto text-sm"
          size="sm"
          style={{
            background: `linear-gradient(135deg, ${colorPrimario}, ${colorAccento})`
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('reservations.newReservation')}
        </Button>
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => setSelectedDate(subDays(selectedDate, 1))}
          className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 h-8 w-8 md:h-10 md:w-10"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              className="w-40 sm:w-48 justify-center border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm h-8 md:h-10"
            >
              {formatDateForDisplay(selectedDate)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-[9999]">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={locale}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => setSelectedDate(addDays(selectedDate, 1))}
          className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 h-8 w-8 md:h-10 md:w-10"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <ReservationForm
              reservation={editingReservation}
              tables={tables}
              customers={customers}
              allReservations={reservations} 
              schedules={schedules}
              specialDays={specialDays}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false);
                setEditingReservation(null);
              }}
              isLoading={reservationMutation.isPending}
              t={t}
              restaurantId={restaurantId}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AdvancedSearch
        filters={advancedFilters}
        onFiltersChange={setAdvancedFilters}
        onSavePreset={handleSavePreset}
        savedPresets={savedFilters}
        onLoadPreset={handleLoadPreset}
        onDeletePreset={handleDeletePreset}
        filterConfig={advancedFilterConfig}
      />

      <div className="flex flex-col gap-3 md:flex-row md:gap-4 md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Buscar por nombre, email, teléfono o ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white text-sm h-9 md:h-10"
          />
        </div>
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full md:w-auto">
          <TabsList className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-full md:w-auto grid grid-cols-5 h-9 md:h-10">
            <TabsTrigger value="all" className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs px-2">Todas</TabsTrigger>
            <TabsTrigger value="confirmada" className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs px-2">Confirmadas</TabsTrigger>
            <TabsTrigger value="pendiente" className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs px-2">Pendientes</TabsTrigger>
            <TabsTrigger value="completada" className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs px-2">Completadas</TabsTrigger>
            <TabsTrigger value="cancelada" className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs px-2">Canceladas</TabsTrigger>
          </TabsList>
        </Tabs>
        <SortControls
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={(newSortBy, newSortOrder) => {
            setSortBy(newSortBy);
            setSortOrder(newSortOrder);
          }}
          sortOptions={sortOptions}
        />
      </div>

      <ReservationList
        reservations={filteredReservations}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDeleteRequest}
        onStatusChange={handleStatusChange}
        t={t}
      />

      <AlertDialog open={!!reservationToDelete} onOpenChange={(open) => !open && setReservationToDelete(null)}>
        <AlertDialogContent className="bg-white dark:bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 dark:text-white">
              {t('common.confirmDelete')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              Esta acción no se puede deshacer. La reserva se eliminará permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-slate-800 dark:text-white">
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm} 
              className="bg-red-600 hover:bg-red-700"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}