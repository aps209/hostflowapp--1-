import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Calendar, Users, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import LoyaltyBadge from "../clientes/LoyaltyBadge";
import { useRestaurant } from "../RestaurantContext";

const statusColors = {
  confirmada: "bg-emerald-100 text-emerald-800 border-emerald-200",
  pendiente: "bg-amber-100 text-amber-800 border-amber-200",
  sentada: "bg-blue-100 text-blue-800 border-blue-200",
  completada: "bg-slate-100 text-slate-800 border-slate-200",
  cancelada: "bg-red-100 text-red-800 border-red-200",
  no_show: "bg-rose-100 text-rose-800 border-rose-200",
};

const statusLabels = {
  confirmada: "Confirmada",
  pendiente: "Pendiente",
  sentada: "Sentada",
  completada: "Completada",
  cancelada: "Cancelada",
  no_show: "No Show",
};

const getTextColor = (hexcolor) => {
  if (!hexcolor) return '#1e293b';
  hexcolor = hexcolor.replace("#", "");
  if (hexcolor.length === 3) {
    hexcolor = hexcolor[0] + hexcolor[0] + hexcolor[1] + hexcolor[1] + hexcolor[2] + hexcolor[2];
  }
  if (hexcolor.length !== 6) return '#1e293b';
  var r = parseInt(hexcolor.substr(0, 2), 16);
  var g = parseInt(hexcolor.substr(2, 2), 16);
  var b = parseInt(hexcolor.substr(4, 2), 16);
  var yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 160) ? '#1e293b' : '#ffffff';
};

export default function ReservationList({ reservations, isLoading, onEdit, onDelete, onStatusChange, t }) {
  const { restaurantId } = useRestaurant();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    staleTime: 3 * 60 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => base44.entities.Tag.list(),
    staleTime: 3 * 60 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: customStatuses = [] } = useQuery({
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
  });

  const getCustomerTags = (clienteId) => {
    const customer = customers.find(c => c.id === clienteId);
    if (!customer || !customer.tags) return [];
    return customer.tags.map(tagName => allTags.find(t => t.nombre === tagName)).filter(Boolean);
  };

  const getCustomerVisits = (clienteId) => {
    const customer = customers.find(c => c.id === clienteId);
    return customer?.total_visitas || 0;
  };

  const formatTableInfo = (reservation) => {
    if (reservation.mesas_numeros && reservation.mesas_numeros.length > 1) {
      return `Mesas ${reservation.mesas_numeros.join(', ')}`;
    } else if (reservation.mesa_numero) {
      return `Mesa ${reservation.mesa_numero}`;
    }
    return null;
  };

  const origenLabels = {
    admin: "Admin",
    web: "Formulario público",
    chatbot: "Asistente de Voz",
    walk_in: "Walk-in"
  };

  const getCreatedByDisplay = (reservation) => {
    const { created_by, origen } = reservation;
    
    if (origen === 'web' || created_by === 'formulario-publico') {
      return {
        text: 'Formulario público',
        color: 'text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30'
      };
    }
    
    if (origen === 'chatbot' || created_by?.includes('Raquel') || created_by === 'vapi-agent') {
      return {
        text: created_by || 'Asistente de Voz',
        color: 'text-purple-700 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30'
      };
    }
    
    if (created_by) {
      return {
        text: created_by,
        color: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800'
      };
    }
    
    return null;
  };

  const getStatusInfo = (statusKey) => {
    const customStatus = customStatuses.find(s => s.key === statusKey);
    if (customStatus) {
      return {
        label: customStatus.label,
        color: customStatus.color,
        isCustom: true
      };
    }

    const systemStatus = {
      confirmada: { label: "Confirmada", color: "#10b981" },
      pendiente: { label: "Pendiente", color: "#f59e0b" },
      sentada: { label: "Sentada", color: "#3b82f6" },
      completada: { label: "Completada", color: "#64748b" },
      cancelada: { label: "Cancelada", color: "#ef4444" },
      no_show: { label: "No Show", color: "#dc2626" },
    }[statusKey];

    return systemStatus || { label: statusKey, color: "#64748b", isCustom: false };
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-20 w-full" />
          </Card>
        ))}
      </div>
    );
  }

  if (reservations.length === 0) {
    return (
      <Card className="p-12 text-center border-0 shadow-xl shadow-slate-900/5 bg-white/80 backdrop-blur-sm">
        <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500 text-lg">No hay reservas que coincidan con los filtros</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reservations.map((reservation) => {
        const customerTags = getCustomerTags(reservation.cliente_id);
        const customerVisits = getCustomerVisits(reservation.cliente_id);
        const hasSpecialOccasion = reservation.ocasion_especial && reservation.ocasion_especial !== 'ninguna';
        const tableInfo = formatTableInfo(reservation);
        const origen = reservation.origen || 'admin';
        const createdByInfo = getCreatedByDisplay(reservation);
        const statusInfo = getStatusInfo(reservation.estado);

        return (
          <Card key={reservation.id} className="border-0 shadow-lg shadow-slate-900/5 bg-white dark:bg-slate-900 hover:shadow-xl transition-shadow">
            <div className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{reservation.cliente_nombre}</h3>
                    <LoyaltyBadge totalVisitas={customerVisits} />
                    {reservation.reservation_id && (
                      <span className="text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                        {reservation.reservation_id}
                      </span>
                    )}
                    {origen === 'walk_in' && (
                      <span className="text-sm text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded font-medium">
                        {origenLabels[origen]}
                      </span>
                    )}
                    
                    <DropdownMenu modal={true}>
                      <DropdownMenuTrigger asChild>
                        <button 
                          className="font-semibold px-3 py-1 rounded-full text-sm cursor-pointer hover:opacity-90 transition-opacity flex items-center gap-1.5 relative z-[150] shadow-sm"
                          style={{
                            backgroundColor: statusInfo.color,
                            color: getTextColor(statusInfo.color),
                            border: 'none'
                          }}
                        >
                          {statusInfo.label}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="z-[200]" sideOffset={5}>
                        <DropdownMenuLabel>Estados del Sistema</DropdownMenuLabel>
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <DropdownMenuItem
                            key={value}
                            onClick={() => onStatusChange(reservation.id, value)}
                            className={reservation.estado === value ? "font-bold" : ""}
                          >
                            {label}
                          </DropdownMenuItem>
                        ))}
                        
                        {customStatuses.length > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>Estados Personalizados</DropdownMenuLabel>
                            {customStatuses.map((status) => (
                              <DropdownMenuItem
                                key={status.key}
                                onClick={() => onStatusChange(reservation.id, status.key)}
                                className={reservation.estado === status.key ? "font-bold" : ""}
                              >
                                <div className="flex items-center gap-2">
                                  <span>{status.label}</span>
                                  <div 
                                    className="w-3 h-3 rounded-full ml-auto" 
                                    style={{ backgroundColor: status.color }}
                                  />
                                </div>
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {customerTags.length > 0 && (
                    <div className="flex gap-1 mb-3 flex-wrap">
                      {customerTags.map((tag) => (
                        <Badge
                          key={tag.id}
                          style={{ backgroundColor: tag.color, color: getTextColor(tag.color) }}
                          className="border-none text-xs h-auto py-1"
                        >
                          {tag.nombre}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {hasSpecialOccasion && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
                        {reservation.ocasion_especial === 'cumpleanos' ? 'Cumpleaños' :
                         reservation.ocasion_especial === 'aniversario' ? 'Aniversario' :
                         reservation.ocasion_especial === 'negocio' ? 'Negocio' :
                         reservation.ocasion_especial === 'cita' ? 'Cita' :
                         reservation.ocasion_especial}
                      </Badge>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>{format(parseISO(reservation.fecha), "d 'de' MMMM, yyyy", { locale: es })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{reservation.hora}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>{reservation.comensales} personas</span>
                      {tableInfo && (
                        <>
                          <span>•</span>
                          <span>{tableInfo}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-xs flex-wrap">
                    {createdByInfo && (
                      <>
                        <span className="text-slate-500 dark:text-slate-400">Creada por:</span>
                        <span className={`font-semibold px-2 py-1 rounded ${createdByInfo.color}`}>
                          {createdByInfo.text}
                        </span>
                      </>
                    )}
                    {reservation.created_date && (
                      <>
                        {createdByInfo && <span className="text-slate-300 dark:text-slate-600">•</span>}
                        <span className="text-slate-500 dark:text-slate-400">
                          Creada el {format(new Date(reservation.created_date), "d MMM yyyy 'a las' HH:mm", { locale: es })}
                        </span>
                      </>
                    )}
                  </div>

                  {reservation.notas && (
                    <div className="mt-3 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg whitespace-pre-wrap">
                      {reservation.notas}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onEdit(reservation)}
                    className="hover:bg-blue-50 hover:border-blue-200 dark:hover:bg-blue-900/20 dark:border-slate-700"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onDelete(reservation.id)}
                    className="hover:bg-red-50 hover:border-red-200 hover:text-red-600 dark:hover:bg-red-900/20 dark:border-slate-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}