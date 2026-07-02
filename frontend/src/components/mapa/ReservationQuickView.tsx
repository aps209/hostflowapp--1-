import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, Users, Edit, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useRestaurant } from "../RestaurantContext";

export default function ReservationQuickView({ 
  reservation, 
  onClose, 
  onEdit, 
  onStatusChange 
}) {
  const { restaurantId } = useRestaurant();

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
    staleTime: 30000,
  });

  if (!reservation) return null;

  const systemStatuses = {
    confirmada: { label: "Confirmada", color: "#10b981" },
    pendiente: { label: "Pendiente", color: "#f59e0b" },
    sentada: { label: "Sentada", color: "#3b82f6" },
    completada: { label: "Completada", color: "#64748b" },
    cancelada: { label: "Cancelada", color: "#ef4444" },
    no_show: { label: "No Show", color: "#dc2626" },
  };

  const allStatuses = {
    ...systemStatuses,
    ...customStatuses.reduce((acc, status) => {
      acc[status.key] = {
        label: status.label,
        color: status.color,
      };
      return acc;
    }, {})
  };

  const currentStatus = allStatuses[reservation.estado] || systemStatuses.confirmada;

  return (
    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 p-4 shadow-xl min-w-[280px]">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white text-lg">
            {reservation.cliente_nombre}
          </h3>
          <div className="flex items-center gap-4 mt-2 text-sm text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{reservation.hora}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{reservation.comensales}p</span>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-6 w-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {reservation.reservation_id && (
        <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          ID: {reservation.reservation_id}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
            Cambiar estado:
          </label>
          <Select
            value={reservation.estado}
            onValueChange={(newStatus) => onStatusChange(reservation.id, newStatus)}
          >
            <SelectTrigger className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm h-9">
              <SelectValue>
                <div className="flex items-center gap-2">
                  <span>{currentStatus.label}</span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-slate-800">
              {Object.entries(systemStatuses).map(([key, status]) => (
                <SelectItem key={key} value={key} className="text-sm text-slate-900 dark:text-white">
                  <div className="flex items-center gap-2">
                    <span>{status.label}</span>
                  </div>
                </SelectItem>
              ))}
              
              {customStatuses.length > 0 && (
                <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 mt-1">
                  Estados Personalizados
                </div>
              )}
              
              {customStatuses.map((status) => (
                <SelectItem key={status.key} value={status.key} className="text-sm text-slate-900 dark:text-white">
                  <div className="flex items-center gap-2">
                    <span>{status.label}</span>
                    <div 
                      className="w-3 h-3 rounded-full ml-auto" 
                      style={{ backgroundColor: status.color }}
                    />
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => onEdit(reservation)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm h-9"
        >
          <Edit className="w-4 h-4 mr-2" />
          Ver detalles completos
        </Button>
      </div>
    </Card>
  );
}