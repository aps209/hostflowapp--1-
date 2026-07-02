import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Search, Grid, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import CustomerForm from "../components/clientes/CustomerForm";
import CustomerList from "../components/clientes/CustomerList";
import CustomerTable from "../components/clientes/CustomerTable";
import CustomerProfile from "../components/clientes/CustomerProfile";
import { motion, AnimatePresence } from "framer-motion";
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
import { useTranslation } from "../components/TranslationProvider";
import { useRestaurant } from "../components/RestaurantContext";

export default function Clientes() {
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("cards");
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [segmentFilter, setSegmentFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  
  const queryClient = useQueryClient();
  const { restaurantId, loading: loadingRestaurant } = useRestaurant();

  const { data: configs = [], isLoading: isLoadingConfigs } = useQuery({
    queryKey: ['restaurantConfig', restaurantId],
    queryFn: () => base44.entities.RestaurantConfig.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 10 * 60 * 1000, // 10 minutos
    cacheTime: 30 * 60 * 1000, // 30 minutos
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const config = configs[0];
  const currentLang = config?.idioma || 'es';
  const { t } = useTranslation(currentLang);
  const colorPrimario = config?.color_primario || '#1e3a8a';
  const colorAccento = config?.color_acento || '#f59e0b';

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', restaurantId],
    queryFn: () => base44.entities.Customer.filter({ restaurant_id: restaurantId }, '-created_date'),
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000, // 5 minutos
    cacheTime: 15 * 60 * 1000, // 15 minutos
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { data: allTags = [], isLoading: isLoadingTags } = useQuery({
    queryKey: ['tags', restaurantId],
    queryFn: () => base44.entities.Tag.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000, // 5 minutos
    cacheTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Customer.create({ ...data, restaurant_id: restaurantId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', restaurantId] });
      setShowForm(false);
      setEditingCustomer(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Customer.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', restaurantId] });
      setShowForm(false);
      setEditingCustomer(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Customer.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', restaurantId] });
      setCustomerToDelete(null);
    },
  });

  const handleSubmit = (data) => {
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data });
    } else {
      createMutation.mutate(data);
    }
  };
  
  const handleDeleteRequest = (id) => {
    setCustomerToDelete(id);
  };
  
  const handleDeleteConfirm = () => {
    if (customerToDelete) {
      deleteMutation.mutate(customerToDelete);
    }
  };

  // Segmentación y filtrado de clientes
  const filteredCustomers = useMemo(() => {
    let filtered = [...customers];

    // Filtrar por búsqueda
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.nombre?.toLowerCase().includes(searchLower) ||
        c.apellidos?.toLowerCase().includes(searchLower) ||
        c.email?.toLowerCase().includes(searchLower) ||
        c.telefono?.includes(searchTerm)
      );
    }

    // Filtrar por segmento
    if (segmentFilter !== 'all') {
      filtered = filtered.filter(customer => {
        const visits = customer.total_visitas || 0;
        const hasVIPTag = customer.tags?.includes('VIP');
        const hasFrecuenteTag = customer.tags?.includes('Frecuente');

        switch (segmentFilter) {
          case 'vip':
            return hasVIPTag;
          case 'frecuente':
            return hasFrecuenteTag || visits >= 5;
          case 'nuevo':
            return visits <= 1;
          case 'inactivo':
            if (!customer.ultima_visita) return false;
            const lastVisit = new Date(customer.ultima_visita);
            const daysSinceVisit = (new Date() - lastVisit) / (1000 * 60 * 60 * 24);
            return daysSinceVisit > 90;
          default:
            return true;
        }
      });
    }

    // Filtrar por etiqueta
    if (tagFilter !== 'all') {
      filtered = filtered.filter(customer => 
        customer.tags?.includes(tagFilter)
      );
    }

    return filtered;
  }, [customers, searchTerm, segmentFilter, tagFilter]);

  if (loadingRestaurant || !restaurantId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-600 dark:text-slate-400">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t('customers.title')}</h1>
            <div 
              className="px-3 py-1 rounded-full text-sm font-semibold text-white shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${colorPrimario}, ${colorAccento})`
              }}
            >
              {filteredCustomers.length}
            </div>
          </div>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {filteredCustomers.length} {filteredCustomers.length === 1 ? 'cliente' : 'clientes'}
            {segmentFilter !== 'all' || tagFilter !== 'all' ? ' filtrados' : ''}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingCustomer(null);
            setShowForm(!showForm);
          }}
          className="shadow-lg text-white"
          style={{
            background: `linear-gradient(135deg, ${colorPrimario}, ${colorAccento})`
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('customers.newCustomer')}
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={(open) => {
        if (!open) {
          setShowForm(false);
          setEditingCustomer(null);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900">
          <CustomerForm
            customer={editingCustomer}
            allTags={allTags}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingCustomer(null);
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
            t={t}
          />
        </DialogContent>
      </Dialog>

      {/* Filtros de segmentación */}
      <Card className="border-0 shadow-xl bg-white dark:bg-slate-900">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Segmento</label>
              <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                <SelectTrigger className="bg-white dark:bg-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-800">
                  <SelectItem value="all">Todos los clientes</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="frecuente">Frecuentes (5+ visitas)</SelectItem>
                  <SelectItem value="nuevo">Nuevos (1 visita)</SelectItem>
                  <SelectItem value="inactivo">Inactivos (+90 días)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Etiqueta</label>
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="bg-white dark:bg-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-800">
                  <SelectItem value="all">Todas las etiquetas</SelectItem>
                  {allTags.map(tag => (
                    <SelectItem key={tag.id} value={tag.nombre}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.nombre}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Nombre, email, teléfono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white dark:bg-slate-800"
                />
              </div>
            </div>
            <div className="flex items-end gap-2">
              {(segmentFilter !== 'all' || tagFilter !== 'all') && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSegmentFilter('all');
                    setTagFilter('all');
                  }}
                  className="flex-1"
                >
                  Limpiar filtros
                </Button>
              )}
              <div className="flex gap-2">
                <Button
                  variant={viewMode === "cards" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("cards")}
                  className={viewMode === "cards" ? "bg-blue-800 hover:bg-blue-700 text-white" : ""}
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("list")}
                  className={viewMode === "list" ? "bg-blue-800 hover:bg-blue-700 text-white" : ""}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {viewMode === "cards" ? (
        <CustomerList
          customers={filteredCustomers}
          isLoading={isLoading}
          allTags={allTags}
          onEdit={(customer) => setSelectedCustomer(customer)}
          onDelete={handleDeleteRequest}
          t={t}
        />
      ) : (
        <CustomerTable
          customers={filteredCustomers}
          isLoading={isLoading}
          allTags={allTags}
          onEdit={(customer) => setSelectedCustomer(customer)}
          onDelete={handleDeleteRequest}
          t={t}
        />
      )}

      {/* Modal de perfil de cliente */}
      {selectedCustomer && (
        <CustomerProfile
          customer={selectedCustomer}
          reservations={reservations.filter(r => r.cliente_id === selectedCustomer.id)}
          allTags={allTags}
          onClose={() => setSelectedCustomer(null)}
          onEdit={(customer) => {
            setEditingCustomer(customer);
            setShowForm(true);
            setSelectedCustomer(null);
          }}
        />
      )}
      
      <AlertDialog open={!!customerToDelete} onOpenChange={(open) => !open && setCustomerToDelete(null)}>
        <AlertDialogContent className="bg-white dark:bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 dark:text-white">
              {t('common.confirmDelete')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              {t('customers.deleteWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-slate-800 dark:text-white">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}