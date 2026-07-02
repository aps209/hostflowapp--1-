import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Lock, Unlock, Plus, Hand, ChevronLeft, ChevronRight, LocateFixed, Maximize2, Minimize2, Save, Clock, AlertCircle, Link as LinkIcon, Utensils, Moon, RotateCcw, Star, Eye, EyeOff, Users, LayoutDashboard } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "@/components/ui/calendar";
import TableMap from "../components/mapa/TableMap";
import TableForm from "../components/mapa/TableForm";
import ReservationForm from "../components/reservas/ReservationForm";
import DraggableReservationPanel from "../components/mapa/DraggableReservationPanel";
import MobileBottomSheet from "../components/mapa/MobileBottomSheet";
import MobileFloorplanControls from "../components/mapa/MobileFloorplanControls";
import { format, addDays, subDays, isToday } from "date-fns";
import { es, enUS, fr } from "date-fns/locale";
import { useTranslation } from "../components/TranslationProvider";
import { useRestaurant } from "../components/RestaurantContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const localeMap = {
  'es': es,
  'en': enUS,
  'fr': fr,
};

export default function MapaMesas() {
  const [zoom, setZoom] = useState(0.6);
  const [isLocked, setIsLocked] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [panMode, setPanMode] = useState(false);
  const [tableScale, setTableScale] = useState(1);
  const [badgeScale, setBadgeScale] = useState(1);
  const [viewRestored, setViewRestored] = useState(false);
  const [showJoinGroups, setShowJoinGroups] = useState(false);
  const [editingReservation, setEditingReservation] = useState(null);
  const [showReservationForm, setShowReservationForm] = useState(false);
  const [floorplanViewMode, setFloorplanViewMode] = useState("all");
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showSaveAsDefaultDialog, setShowSaveAsDefaultDialog] = useState(false);
  const [hideEditButtons, setHideEditButtons] = useState(false);
  const [showCustomerNames, setShowCustomerNames] = useState(false);
  const [splitView, setSplitView] = useState(false);
  const [splitViewMinimized, setSplitViewMinimized] = useState(false);
  const [reservationToDelete, setReservationToDelete] = useState(null);
  
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [selectedMobileItem, setSelectedMobileItem] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  const mapContainerRef = useRef(null);
  
  const queryClient = useQueryClient();
  const { restaurantId, loading: loadingRestaurant } = useRestaurant();

  // 🔥 MEJORADO: Detectar móvil y ajustar zoom inicial
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // 🔥 CRÍTICO: En móvil usar zoom 1.0 para que las mesas se vean grandes
      if (mobile && zoom < 1.0) {
        setZoom(1.0);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { data: configs = [] } = useQuery({
    queryKey: ['restaurantConfig', restaurantId],
    queryFn: () => base44.entities.RestaurantConfig.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 0,
    cacheTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const config = configs[0];
  const duracionDefault = config?.duracion_reserva_default || 90;
  const intervaloDefault = config?.intervalo_entre_reservas || 15;
  const duracionTotal = duracionDefault + intervaloDefault;
  const currentLang = config?.idioma || 'es';
  const allowTableJoining = config?.allow_table_joining || false;
  const alertNoShowEnabled = config?.alert_no_show_enabled || false; 
  const { t } = useTranslation(currentLang);
  const locale = localeMap[currentLang] || es;

  useEffect(() => {
    if (config?.floorplan_view && !viewRestored && mapContainerRef.current && !isMobile) {
      const view = config.floorplan_view;
      
      setZoom(0.6);
      if (view.tableScale) setTableScale(view.tableScale);
      if (view.badgeScale) setBadgeScale(view.badgeScale);
      
      if (view.scrollX !== undefined && view.scrollY !== undefined) {
        const restoreScroll = () => {
          if (mapContainerRef.current) {
            mapContainerRef.current.scrollTo({
              left: view.scrollX,
              top: view.scrollY,
              behavior: 'auto'
            });
          }
        };
        
        setTimeout(restoreScroll, 50);
        setTimeout(restoreScroll, 150);
        setTimeout(restoreScroll, 300);
        setTimeout(() => {
          restoreScroll();
          setViewRestored(true);
        }, 500);
      } else {
        setViewRestored(true);
      }
    }
  }, [config, viewRestored, isMobile]);

  const { data: tables = [] } = useQuery({
    queryKey: ['tables', restaurantId],
    queryFn: () => base44.entities.Table.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 2 * 60 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const formattedSelectedDate = format(selectedDate, 'yyyy-MM-dd');
  const { data: dailyLayouts = [] } = useQuery({
    queryKey: ['dailyTableLayouts', restaurantId, formattedSelectedDate],
    queryFn: () => base44.entities.DailyTableLayout.filter({ 
      restaurant_id: restaurantId,
      date: formattedSelectedDate
    }),
    enabled: !!restaurantId,
    staleTime: 30 * 1000,
    cacheTime: 2 * 60 * 1000,
    refetchOnMount: true,
  });
  
  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 15 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchOnMount: true,
    refetchInterval: 20000,
  });

  const { data: tableAvailability = [] } = useQuery({
    queryKey: ['tableAvailability', restaurantId],
    queryFn: () => base44.entities.TableAvailability.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 2 * 60 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', restaurantId],
    queryFn: () => base44.entities.Customer.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules', restaurantId],
    queryFn: () => base44.entities.Schedule.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: specialDays = [] } = useQuery({
    queryKey: ['specialDays', restaurantId],
    queryFn: () => base44.entities.SpecialDay.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: customReservationStatuses = [] } = useQuery({
    queryKey: ['reservationStatuses', restaurantId],
    queryFn: async () => {
      try {
        return await base44.entities.ReservationStatus.filter({ restaurant_id: restaurantId, active: true }, 'order');
      } catch {
        return [];
      }
    },
    enabled: !!restaurantId,
    staleTime: 2 * 60 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const reservationStatusColors = React.useMemo(() => {
    const statusMap = {
      confirmada: "#10b981",
      pendiente: "#f59e0b",
      sentada: "#3b82f6",
      completada: "#64748b",
      cancelada: "#ef4444",
      no_show: "#dc2626",
    };

    customReservationStatuses.forEach(status => {
      statusMap[status.key] = status.color;
    });

    return statusMap;
  }, [customReservationStatuses]);

  const tablesWithDailyPositions = dailyLayouts.length;

  const tablesOutOfBounds = tables.filter(table => {
    const x = table.posicion_x || 0;
    const y = table.posicion_y || 0;
    return x < -1000 || x > 1000 || y < -1000 || y > 1000;
  });

  const repositionTablesMutation = useMutation({
    mutationFn: async () => {
      const updates = [];
      
      const gridSize = 200;
      let currentX = -800;
      let currentY = 800;
      const maxX = 800;
      const minY = -800;
      
      for (const table of tablesOutOfBounds) {
        updates.push(
          base44.entities.Table.update(table.id, {
            posicion_x: currentX,
            posicion_y: currentY
          })
        );
        
        currentX += gridSize;
        if (currentX > maxX) {
          currentX = -800;
          currentY -= gridSize;
          if (currentY < minY) {
              currentY = 800; 
          }
        }
      }
      
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables', restaurantId] });
      toast.success(`${tablesOutOfBounds.length} mesas reposicionadas correctamente`);
    },
    onError: (error) => {
      toast.error(`Error al reposicionar mesas: ${error.message}`);
    }
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      const centeredData = {
        ...data,
        posicion_x: data.posicion_x !== undefined ? data.posicion_x : 0,
        posicion_y: data.posicion_y !== undefined ? data.posicion_y : 0,
        restaurant_id: restaurantId
      };
      return base44.entities.Table.create(centeredData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables', restaurantId] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => {
      return base44.entities.Table.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables', restaurantId] });
    },
  });

  const deleteTableMutation = useMutation({
    mutationFn: (id) => base44.entities.Table.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables', restaurantId] });
    },
  });

  const toggleAvailabilityMutation = useMutation({
    mutationFn: async ({ mesa_id, fecha, makeUnavailable }) => {
      if (makeUnavailable) {
        return base44.entities.TableAvailability.create({
          restaurant_id: restaurantId,
          mesa_id: mesa_id,
          fecha: fecha,
          motivo: "Marcada manualmente como no disponible"
        });
      } else {
        const existing = tableAvailability.find(ta => 
          ta.mesa_id === mesa_id && ta.fecha === fecha
        );
        if (existing) {
          return base44.entities.TableAvailability.delete(existing.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tableAvailability', restaurantId] });
    },
  });

  const saveViewMutation = useMutation({
    mutationFn: async (viewConfig) => {
      if (config) {
        return base44.entities.RestaurantConfig.update(config.id, {
          floorplan_view: viewConfig
        });
      } else {
        return base44.entities.RestaurantConfig.create({
          floorplan_view: viewConfig,
          restaurant_id: restaurantId
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurantConfig', restaurantId] });
      toast.success('Vista guardada correctamente');
    },
  });

  const saveDailyPositionMutation = useMutation({
    mutationFn: async ({ tableId, x, y }) => {
      const existing = dailyLayouts.find(dl => dl.mesa_id === tableId);
      
      if (existing) {
        return base44.entities.DailyTableLayout.update(existing.id, {
          posicion_x: x,
          posicion_y: y
        });
      } else {
        return base44.entities.DailyTableLayout.create({
          restaurant_id: restaurantId,
          mesa_id: tableId,
          date: formattedSelectedDate,
          posicion_x: x,
          posicion_y: y
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyTableLayouts', restaurantId, formattedSelectedDate] });
    },
    onError: (error) => {
      toast.error("Error al guardar la posición de la mesa");
    },
  });

  const resetDailyLayoutMutation = useMutation({
    mutationFn: async () => {
      const deletePromises = dailyLayouts.map(layout => 
        base44.entities.DailyTableLayout.delete(layout.id)
      );
      await Promise.all(deletePromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyTableLayouts', restaurantId, formattedSelectedDate] });
      toast.success('Diseño restablecido a configuración por defecto');
      setShowResetDialog(false);
    },
  });

  const saveAsDefaultMutation = useMutation({
    mutationFn: async () => {
      const updates = [];
      
      for (const table of tablesWithReservations) {
        const updateData = {
          posicion_x: table.posicion_x,
          posicion_y: table.posicion_y
        };
        
        updates.push(
          base44.entities.Table.update(table.id, updateData)
        );
      }
      
      if (dailyLayouts.length > 0) {
        const deletePromises = dailyLayouts.map(layout => 
          base44.entities.DailyTableLayout.delete(layout.id)
        );
        updates.push(...deletePromises);
      }

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['dailyTableLayouts', restaurantId, formattedSelectedDate] });
      toast.success('Diseño guardado como configuración predeterminada');
      setShowSaveAsDefaultDialog(false);
    },
  });

  const reservationMutation = useMutation({
    mutationFn: async (data) => {
      if (data.id) {
        const updatedReservation = await base44.entities.Reservation.update(data.id, data);
        console.log('[MapaMesas] ✅ Reserva actualizada:', updatedReservation.id);
        return updatedReservation;
      } else {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        const confirmation_token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        
        const newReservation = await base44.entities.Reservation.create({ 
          ...data, 
          restaurant_id: restaurantId,
          confirmation_token 
        });
        console.log('[MapaMesas] ✅ Reserva creada:', newReservation.id);
        
        if (newReservation.cliente_email) {
          try {
            console.log('[MapaMesas] 📧 INICIANDO envío de email de confirmación');
            console.log('[MapaMesas] 📧 Email destino:', newReservation.cliente_email);
            console.log('[MapaMesas] 📧 Reservation ID:', newReservation.id);
            console.log('[MapaMesas] 📧 Restaurant ID:', newReservation.restaurant_id);

            const emailResult = await base44.functions.invoke('enviarEmailConfirmacion', {
              reservationId: newReservation.id,
              restaurant_id: newReservation.restaurant_id
            });

            console.log('[MapaMesas] ✅ RESPUESTA de función email:', emailResult);

            if (emailResult?.data?.success) {
              console.log('[MapaMesas] ✅ ✅ Email confirmado como ENVIADO por la función');
              toast.success('Email de confirmación enviado');
            } else {
              console.error('[MapaMesas] ❌ Email NO enviado - respuesta:', emailResult);
              toast.warning('Reserva creada pero email no enviado');
            }
          } catch (emailError) {
            console.error('[MapaMesas] 💥 ERROR CRÍTICO enviando email:', {
              message: emailError.message,
              stack: emailError.stack,
              error: emailError
            });
            toast.warning('Reserva creada pero hubo un error al enviar el email');
          }
        } else {
          console.log('[MapaMesas] ⚠️ No hay email en la reserva, saltando envío');
        }
        
        return newReservation;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations', restaurantId] });
      toast.success('Reserva guardada correctamente');
    },
    onError: (error) => {
      toast.error(`Error al guardar reserva: ${error.message}`);
    },
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
      console.log('[MapaMesas] Actualizando estado de reserva:', { id, estado, restaurantId });
      const result = await base44.entities.Reservation.update(id, { estado });
      
      if (estado === 'cancelada') {
        try {
          console.log('[MapaMesas] Enviando email de cancelación para reserva:', id);
          const emailResult = await base44.functions.invoke('enviarEmailCancelacion', { 
            reservationId: id, 
            restaurant_id: restaurantId 
          });
          console.log('[MapaMesas] Email de cancelación enviado exitosamente:', emailResult);
        } catch (emailError) {
          console.error('[MapaMesas] Error enviando email de cancelación:', emailError);
          console.error('[MapaMesas] Detalles del error:', emailError.message, emailError.stack);
        }
      }
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations', restaurantId] });
      toast.success('Estado actualizado correctamente');
    },
  });

  const handleSubmit = (data) => {
    if (editingTable) {
      updateMutation.mutate({ id: editingTable.id, data });
    } else {
      createMutation.mutate(data);
    }
    setEditingTable(null);
    setShowForm(false);
  };

  const handleTableMove = (tableId, x, y) => {
    saveDailyPositionMutation.mutate({ tableId, x, y });
  };

  const handleToggleAvailability = (mesa_id, makeUnavailable) => {
    toggleAvailabilityMutation.mutate({
      mesa_id,
      fecha: format(selectedDate, 'yyyy-MM-dd'),
      makeUnavailable
    });
  };
  
  const handleCenterView = () => {
    if (mapContainerRef.current) {
      const { scrollWidth, clientWidth, scrollHeight, clientHeight } = mapContainerRef.current;
      mapContainerRef.current.scrollTo({
        left: (scrollWidth - clientWidth) / 2,
        top: (scrollHeight - clientHeight) / 2,
        behavior: 'smooth'
      });
    }
  };

  const handleZoomChange = (newZoom) => {
    if (!mapContainerRef.current) return;
    
    const container = mapContainerRef.current;
    const { scrollLeft, scrollTop, scrollWidth, scrollHeight, clientWidth, clientHeight } = container;
    
    const centerX = scrollWidth / 2;
    const centerY = scrollHeight / 2;
    
    const offsetX = scrollLeft + clientWidth / 2 - centerX;
    const offsetY = scrollTop + clientHeight / 2 - centerY;
    
    setZoom(newZoom);
    
    setTimeout(() => {
      const newScrollWidth = container.scrollWidth;
      const newScrollHeight = container.scrollHeight;
      const newCenterX = newScrollWidth / 2;
      const newCenterY = newScrollHeight / 2;
      
      container.scrollTo({
        left: newCenterX - clientWidth / 2 + offsetX * (newZoom / zoom),
        top: newCenterY - clientHeight / 2 + offsetY * (newZoom / zoom),
        behavior: 'auto'
      });
    }, 0);
  };

  const handleSaveView = () => {
    if (!mapContainerRef.current) return;
    
    setTimeout(() => {
      const { scrollLeft, scrollTop } = mapContainerRef.current;
      
      saveViewMutation.mutate({
        zoom,
        tableScale,
        badgeScale,
        scrollX: scrollLeft,
        scrollY: scrollTop,
      });
    }, 100);
  };

  const handleReservationClick = (reservation) => {
    if (isMobile) {
      setSelectedMobileItem({ type: 'reservation', data: reservation });
      setMobileSheetOpen(true);
    } else {
      setEditingReservation(reservation);
      setShowReservationForm(true);
    }
  };

  const handleReservationSubmit = async (reservationData) => {
    try {
      await reservationMutation.mutateAsync(reservationData);
      setShowReservationForm(false);
      setEditingReservation(null);
    } catch (error) {
      console.error('Error al actualizar reserva:', error);
    }
  };

  const handleReservationStatusChange = (reservationId, newStatus) => {
    updateStatusMutation.mutate({ id: reservationId, estado: newStatus });
  };

  const handleResetLayout = () => {
    setShowResetDialog(true);
  };

  const handleSaveAsDefault = () => {
    setShowSaveAsDefaultDialog(true);
  };

  const handleEdit = (reservation) => {
    setEditingReservation(reservation);
    setShowReservationForm(true);
  };

  const handleDeleteRequest = (id) => {
    setReservationToDelete(id);
  };

  const handleDeleteConfirm = () => {
    if (reservationToDelete) {
      deleteMutation.mutate(reservationToDelete);
    }
  };

  const isTimeInRange = (reservationTime, startTime, endTime) => {
    if (!startTime || !endTime) return true;

    const resTime = new Date(`1970-01-01T${reservationTime}:00`);
    const start = new Date(`1970-01-01T${startTime}:00`);
    const end = new Date(`1970-01-01T${endTime}:00`);

    if (start.getTime() > end.getTime()) { 
      return resTime >= start || resTime <= end;
    } else {
      return resTime >= start && resTime <= end;
    }
  };

  const currentDateTime = new Date().toISOString();

  const tablesWithReservations = tables.map(table => {
    const dailyLayout = dailyLayouts.find(dl => dl.mesa_id === table.id);
    
    const tableWithPosition = dailyLayout ? {
      ...table,
      posicion_x: dailyLayout.posicion_x,
      posicion_y: dailyLayout.posicion_y,
      hasDailyPosition: true
    } : {
      ...table,
      hasDailyPosition: false
    };

    const allReservationsForTable = reservations.filter(r => 
      (r.mesa_id === table.id || (r.mesas_unidas && r.mesas_unidas.includes(table.id))) &&
      r.fecha === formattedSelectedDate &&
      r.estado !== 'cancelada' &&
      r.estado !== 'no_show' &&
      r.estado !== 'completada' 
    ).sort((a, b) => a.hora.localeCompare(b.hora));

    let filteredReservationsForDay = allReservationsForTable;
    if (floorplanViewMode === 'lunch') {
      filteredReservationsForDay = allReservationsForTable.filter(r => 
        isTimeInRange(r.hora, config?.hora_inicio_comida, config?.hora_fin_comida)
      );
    } else if (floorplanViewMode === 'dinner') {
      filteredReservationsForDay = allReservationsForTable.filter(r => 
        isTimeInRange(r.hora, config?.hora_inicio_cena, config?.hora_fin_cena)
      );
    }

    const isUnavailableThisDay = tableAvailability.some(ta => 
      ta.mesa_id === table.id && ta.fecha === formattedSelectedDate
    );

    const isPermanentlyInactive = table.activa === false;

    let estadoVisual = 'libre';
    let customColor = null;

    if (isPermanentlyInactive) {
      estadoVisual = 'inactiva_permanente';
    } 
    else if (isUnavailableThisDay) {
      estadoVisual = 'no_disponible';
    } 
    else if (allReservationsForTable.length > 0) {
      const hasSeatedReservation = allReservationsForTable.some(r => r.estado === 'sentada');

      if (hasSeatedReservation) {
        const seatedReservation = allReservationsForTable.find(r => r.estado === 'sentada');
        estadoVisual = 'sentada';
        if (seatedReservation && reservationStatusColors[seatedReservation.estado]) {
          customColor = reservationStatusColors[seatedReservation.estado];
        }
      } else {
        const priorityOrder = ['sentada', ...Object.keys(reservationStatusColors).filter(k => !['sentada', 'confirmada', 'pendiente', 'completada', 'cancelada', 'no_show'].includes(k)), 'confirmada', 'pendiente'];

        let mostImportantReservation = null;
        for (const status of priorityOrder) {
          const reservation = allReservationsForTable.find(r => r.estado === status);
          if (reservation) {
            mostImportantReservation = reservation;
            break;
          }
        }

        if (!mostImportantReservation) {
          mostImportantReservation = allReservationsForTable[0];
        }

        const reservationStatus = mostImportantReservation.estado;
        const isJoinedReservation = mostImportantReservation.mesas_unidas && mostImportantReservation.mesas_unidas.length > 0;

        if (reservationStatusColors[reservationStatus]) {
          customColor = reservationStatusColors[reservationStatus];
          estadoVisual = isJoinedReservation ? 'reservada_unida' : 'reservada';
        } else {
          estadoVisual = isJoinedReservation ? 'reservada_unida' : 'reservada';
        }
      }
    }

    const allJoinedReservations = allReservationsForTable.filter(r => 
      r.mesas_unidas && r.mesas_unidas.length > 0
    );

    let filteredJoinedReservations = allJoinedReservations;
    if (floorplanViewMode === 'lunch') {
      filteredJoinedReservations = allJoinedReservations.filter(r => 
        isTimeInRange(r.hora, config?.hora_inicio_comida, config?.hora_fin_comida)
      );
    } else if (floorplanViewMode === 'dinner') {
      filteredJoinedReservations = allJoinedReservations.filter(r => 
        isTimeInRange(r.hora, config?.hora_inicio_cena, config?.hora_fin_cena)
      );
    }

    return {
      ...tableWithPosition,
      estado: estadoVisual,
      customColor, 
      reservationsForDay: filteredReservationsForDay,
      isUnavailableThisDay,
      isPermanentlyInactive, 
      joinedReservations: filteredJoinedReservations,
    };
  });

  const reservationsForPanel = reservations.filter(r => r.fecha === formattedSelectedDate);

  const formatDateForDisplay = (date) => {
    if (isToday(date)) {
      return `${t('common.today')}, ${format(date, 'd MMM', { locale })}`;
    }
    return format(date, "EEE, d MMM", { locale });
  };

  if (loadingRestaurant || !restaurantId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-600 dark:text-slate-400">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <MobileFloorplanControls
        isLocked={isLocked}
        onToggleLock={() => setIsLocked(!isLocked)}
        panMode={panMode}
        onTogglePan={() => setPanMode(!panMode)}
        hideEditButtons={hideEditButtons}
        onToggleEditButtons={() => setHideEditButtons(!hideEditButtons)}
        showCustomerNames={showCustomerNames}
        onToggleCustomerNames={() => setShowCustomerNames(!showCustomerNames)}
        tableScale={tableScale}
        onTableScaleChange={setTableScale}
        badgeScale={badgeScale}
        onBadgeScaleChange={setBadgeScale}
        onCenterView={handleCenterView}
        onNewReservation={() => {
          setEditingReservation(null);
          setShowReservationForm(true);
        }}
        onNewTable={() => {
          setEditingTable(null);
          setShowForm(true);
        }}
        floorplanViewMode={floorplanViewMode}
        onFloorplanViewModeChange={setFloorplanViewMode}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        formatDateForDisplay={formatDateForDisplay}
        locale={locale}
      />

      <MobileBottomSheet
        isOpen={mobileSheetOpen}
        onClose={() => {
          setMobileSheetOpen(false);
          setSelectedMobileItem(null);
        }}
        table={selectedMobileItem?.type === 'table' ? selectedMobileItem.data : null}
        reservation={selectedMobileItem?.type === 'reservation' ? selectedMobileItem.data : null}
        onEdit={(item) => {
          if (selectedMobileItem?.type === 'reservation') {
            setEditingReservation(item);
            setShowReservationForm(true);
          } else if (selectedMobileItem?.type === 'table') {
            setEditingTable(item);
            setShowForm(true);
          }
        }}
        onDelete={(id) => {
          if (selectedMobileItem?.type === 'reservation') {
            deleteMutation.mutate(id);
          } else if (selectedMobileItem?.type === 'table') {
            deleteTableMutation.mutate(id);
          }
        }}
        onStatusChange={handleReservationStatusChange}
        availableStatuses={customReservationStatuses}
      />

      {/* Desktop controls */}
      <div className="flex-shrink-0 p-3 border-b border-slate-200 dark:border-slate-800 bg-white/60 backdrop-blur-sm hidden md:block">
        <div className="mb-3">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('tables.title')}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">{t('tables.subtitle')}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => handleZoomChange(Math.min(zoom + 0.1, 2))} className="h-8 w-8 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => handleZoomChange(Math.max(zoom - 0.1, 0.2))} className="h-8 w-8 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">{(zoom * 100).toFixed(0)}%</span>
            </div>

            <div className="h-6 w-px bg-slate-300 dark:bg-slate-700" />

            <Button
              variant={isLocked ? "outline" : "default"}
              size="sm"
              onClick={() => setIsLocked(!isLocked)}
              className={isLocked ? "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" : "bg-amber-600 hover:bg-amber-700 text-white"}
            >
              {isLocked ? <><Lock className="w-4 h-4 mr-2" /> Bloqueado</> : <><Unlock className="w-4 h-4 mr-2" /> Desbloqueado</>}
            </Button>

            <Button
              variant={hideEditButtons ? "default" : "outline"}
              size="sm"
              onClick={() => setHideEditButtons(!hideEditButtons)}
              className={hideEditButtons ? "bg-blue-600 hover:bg-blue-700 text-white" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"}
            >
              {hideEditButtons ? <><EyeOff className="w-4 h-4 mr-2" /> Botones ocultos</> : <><Eye className="w-4 h-4 mr-2" /> Ocultar botones</>}
            </Button>

            <Button
              variant={showCustomerNames ? "default" : "outline"}
              size="sm"
              onClick={() => setShowCustomerNames(!showCustomerNames)}
              className={showCustomerNames ? "bg-green-600 hover:bg-green-700 text-white" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"}
            >
              <Users className="w-4 h-4 mr-2" />
              Mostrar Nombres
            </Button>

            <Button
              variant={splitView ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSplitView(!splitView);
                if (!splitView) setSplitViewMinimized(false);
              }}
              className={splitView ? "bg-purple-600 hover:bg-purple-700 text-white" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"}
            >
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Vista Dividida
            </Button>

            {!isLocked && (
              <Button
                onClick={handleSaveAsDefault}
                variant="outline"
                size="sm"
                className="border-blue-500 text-blue-600 bg-white dark:bg-slate-800 hover:bg-blue-50"
              >
                <Star className="w-4 h-4 mr-2" />
                Guardar como Predeterminado
              </Button>
            )}

            <div className="h-6 w-px bg-slate-300 dark:bg-slate-700" />

            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => setTableScale(Math.min(tableScale + 0.1, 2))} className="h-8 w-8 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" title="Agrandar mesas">
                <Maximize2 className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setTableScale(Math.max(tableScale - 0.1, 0.5))} className="h-8 w-8 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" title="Reducir mesas">
                <Minimize2 className="w-4 h-4" />
              </Button>
            </div>

            <div className="h-6 w-px bg-slate-300 dark:bg-slate-700" />

            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => setBadgeScale(Math.min(badgeScale + 0.1, 2))} className="h-8 w-8 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" title="Agrandar badges">
                <Clock className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setBadgeScale(Math.max(badgeScale - 0.1, 0.5))} className="h-8 w-8 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" title="Reducir badges">
                <Clock className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="h-6 w-px bg-slate-300 dark:bg-slate-700" />

            <Button 
              variant={panMode ? "default" : "outline"} 
              size="sm" 
              onClick={() => setPanMode(!panMode)} 
              className={panMode ? "bg-blue-800 hover:bg-blue-700 text-white" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"}
            >
              <Hand className="w-4 h-4 mr-2" />
              Pan
            </Button>

            <Button variant="outline" size="sm" onClick={handleCenterView} className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
              <LocateFixed className="w-4 h-4 mr-2" />
              Centro
            </Button>

            <Button variant="outline" size="sm" onClick={handleSaveView} className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>

            <div className="h-6 w-px bg-slate-300 dark:bg-slate-700" />

            <Button
              onClick={() => {
                setEditingReservation(null);
                setShowReservationForm(true);
              }}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Reserva
            </Button>

            <Button
              onClick={() => {
                setEditingTable(null);
                setShowForm(!showForm);
              }}
              className="bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 text-white"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Mesa
            </Button>

            {tablesOutOfBounds.length > 0 && (
              <Button
                onClick={() => {
                  if (confirm(`¿Reposicionar ${tablesOutOfBounds.length} mesas?`)) {
                    repositionTablesMutation.mutate();
                  }
                }}
                variant="outline"
                className="border-amber-500 text-amber-600 bg-white dark:bg-slate-800"
                size="sm"
                disabled={repositionTablesMutation.isPending}
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Reposicionar {tablesOutOfBounds.length}
              </Button>
            )}

            {allowTableJoining && (
              <>
                <div className="h-6 w-px bg-slate-300 dark:bg-slate-700" />
                <Button 
                  variant={showJoinGroups ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setShowJoinGroups(!showJoinGroups)} 
                  className={showJoinGroups ? "bg-blue-600 hover:bg-blue-700 text-white" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"}
                >
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Grupos
                </Button>
              </>
            )}

            {tablesWithDailyPositions > 0 && (
              <>
                <div className="h-6 w-px bg-slate-300 dark:bg-slate-700" />
                <Button
                  onClick={handleResetLayout}
                  variant="outline"
                  size="sm"
                  className="border-orange-500 text-orange-600 bg-white dark:bg-slate-800 hover:bg-orange-50"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restablecer ({tablesWithDailyPositions})
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center justify-center gap-2">
            <Button
              variant={floorplanViewMode === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFloorplanViewMode("all")}
              className={floorplanViewMode === "all" ? "bg-blue-800 hover:bg-blue-700 text-white" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"}
            >
              <Clock className="w-4 h-4 mr-2" />
              Día Completo
            </Button>
            <Button
              variant={floorplanViewMode === "lunch" ? "default" : "outline"}
              size="sm"
              onClick={() => setFloorplanViewMode("lunch")}
              className={floorplanViewMode === "lunch" ? "bg-amber-600 hover:bg-amber-700 text-white" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"}
            >
              <Utensils className="w-4 h-4 mr-2" />
              Comida
            </Button>
            <Button
              variant={floorplanViewMode === "dinner" ? "default" : "outline"}
              size="sm"
              onClick={() => setFloorplanViewMode("dinner")}
              className={floorplanViewMode === "dinner" ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"}
            >
              <Moon className="w-4 h-4 mr-2" />
              Cena
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setSelectedDate(subDays(selectedDate, 1))} className="h-8 w-8 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                  {formatDateForDisplay(selectedDate)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarIcon mode="single" selected={selectedDate} onSelect={setSelectedDate} locale={locale} initialFocus />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="h-8 w-8 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">
              {editingTable ? t('tables.editTable') : t('tables.newTable')}
            </DialogTitle>
          </DialogHeader>
          <TableForm
            table={editingTable}
            selectedDate={formattedSelectedDate}
            isUnavailableToday={editingTable?.isUnavailableThisDay || false}
            onSubmit={handleSubmit}
            onToggleAvailability={handleToggleAvailability}
            onCancel={() => {
              setShowForm(false);
              setEditingTable(null);
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
            isTogglingAvailability={toggleAvailabilityMutation.isPending}
            t={t}
            compact={true}
            allowTableJoining={allowTableJoining} 
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showReservationForm} onOpenChange={setShowReservationForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">
              {editingReservation ? t('reservations.editReservation') : t('reservations.newReservation')}
            </DialogTitle>
          </DialogHeader>
          <ReservationForm
            reservation={editingReservation}
            tables={tables}
            customers={customers}
            allReservations={reservations}
            schedules={schedules}
            specialDays={specialDays}
            onSubmit={handleReservationSubmit}
            onCancel={() => {
              setShowReservationForm(false);
              setEditingReservation(null);
            }}
            isLoading={reservationMutation.isPending}
            t={t}
            restaurantId={restaurantId}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent className="bg-white dark:bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 dark:text-white">
              ¿Restablecer diseño del día?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              Esto eliminará las posiciones personalizadas de {tablesWithDailyPositions} mesa(s) para el día {formatDateForDisplay(selectedDate)} y volverán a su configuración por defecto.
              <br /><br />
              <strong>Esta acción no se puede deshacer.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-slate-800 dark:text-white">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => resetDailyLayoutMutation.mutate()} className="bg-orange-600 hover:bg-orange-700" disabled={resetDailyLayoutMutation.isPending}>
              {resetDailyLayoutMutation.isPending ? 'Restableciendo...' : 'Restablecer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showSaveAsDefaultDialog} onOpenChange={setShowSaveAsDefaultDialog}>
        <AlertDialogContent className="bg-white dark:bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 dark:text-white">
              ¿Guardar diseño actual como predeterminado?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              Esta acción guardará las posiciones actuales de TODAS las mesas como la configuración base predeterminada del restaurante.
              <br /><br />
              <strong>Ventajas:</strong>
              <ul className="list-disc ml-5 mt-2">
                <li>Las mesas aparecerán en estas posiciones por defecto todos los días.</li>
                <li>Podrás seguir haciendo ajustes diarios sin afectar esta configuración.</li>
                <li>Ideal para establecer el diseño inicial de tu restaurante.</li>
              </ul>
              <br />
              <strong>Las posiciones personalizadas del día actual se eliminarán.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-slate-800 dark:text-white">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => saveAsDefaultMutation.mutate()} className="bg-blue-600 hover:bg-blue-700" disabled={saveAsDefaultMutation.isPending}>
              {saveAsDefaultMutation.isPending ? 'Guardando...' : 'Guardar como Predeterminado'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            <AlertDialogCancel className="dark:bg-slate-800 dark:text-white">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Contenedor del mapa - ventana fija con navegación interna */}
      <div className="flex-1 min-h-0 overflow-hidden relative p-0 md:pl-4 md:pr-4 md:pb-4">
        <div className="h-full w-full md:bg-white md:dark:bg-slate-900 md:rounded-xl md:shadow-xl border-0 overflow-hidden relative">
          <TableMap
            ref={mapContainerRef}
            tables={tablesWithReservations}
            zoom={zoom}
            tableScale={tableScale}
            badgeScale={badgeScale}
            isLocked={isLocked}
            panMode={panMode}
            showGrid={!isLocked}
            showJoinGroups={showJoinGroups}
            hideEditButtons={hideEditButtons}
            showCustomerNames={showCustomerNames}
            onTableMove={handleTableMove}
            onTableEdit={(table) => {
              setEditingTable(table);
              setShowForm(true);
            }}
            onTableDelete={(id) => deleteTableMutation.mutate(id)}
            onReservationClick={handleReservationClick}
            onReservationStatusChange={handleReservationStatusChange} 
            floorplanColors={config?.floorplan_colors} 
            alertNoShowEnabled={alertNoShowEnabled} 
            currentDateTime={currentDateTime}
            onZoomChange={handleZoomChange}
            isMobile={isMobile}
          />
        </div>

        {splitView && (
          <DraggableReservationPanel
            reservations={reservationsForPanel}
            onEdit={handleEdit}
            onDelete={handleDeleteRequest}
            onStatusChange={handleReservationStatusChange}
            onClose={() => setSplitView(false)}
            t={t}
            isMinimized={splitViewMinimized}
            onToggleMinimize={() => setSplitViewMinimized(!splitViewMinimized)}
          />
        )}
      </div>
    </div>
  );
}