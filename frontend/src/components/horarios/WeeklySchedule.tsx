import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Calendar, Clock, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const daysOfWeek = [
  { key: 'lunes', label: 'Lunes' },
  { key: 'martes', label: 'Martes' },
  { key: 'miércoles', label: 'Miércoles' },
  { key: 'jueves', label: 'Jueves' },
  { key: 'viernes', label: 'Viernes' },
  { key: 'sábado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' },
];

export default function WeeklySchedule({ restaurantId }) {
  const queryClient = useQueryClient();
  const [duracionInputs, setDuracionInputs] = useState({});

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['schedules', restaurantId],
    queryFn: () => base44.entities.Schedule.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['restaurantConfig', restaurantId],
    queryFn: () => base44.entities.RestaurantConfig.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const config = configs[0];
  const globalDuracion = config?.duracion_reserva_default || 90;

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Schedule.create({ ...data, restaurant_id: restaurantId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules', restaurantId] });
      toast.success('Horario creado');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Schedule.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules', restaurantId] });
      toast.success('Horario actualizado');
    },
  });

  const getScheduleForDay = (dayKey) => {
    return schedules.find((s) => s.day_of_week === dayKey);
  };

  const handleToggle = (dayKey, isOpen) => {
    const schedule = getScheduleForDay(dayKey);
    if (schedule) {
      updateMutation.mutate({
        id: schedule.id,
        data: { ...schedule, is_open: isOpen },
      });
    } else {
      createMutation.mutate({
        day_of_week: dayKey,
        is_open: isOpen,
        slots: [{ opening_time: '12:00', closing_time: '23:00' }],
      });
    }
  };

  const handleSlotChange = (dayKey, slotIndex, field, value) => {
    const schedule = getScheduleForDay(dayKey);
    if (!schedule) return;

    const newSlots = [...(schedule.slots || [])];
    newSlots[slotIndex] = { ...newSlots[slotIndex], [field]: value };

    updateMutation.mutate({
      id: schedule.id,
      data: { ...schedule, slots: newSlots },
    });
  };

  const handleAddSlot = (dayKey) => {
    const schedule = getScheduleForDay(dayKey);
    if (!schedule) return;

    const newSlots = [...(schedule.slots || []), { opening_time: '12:00', closing_time: '23:00' }];

    updateMutation.mutate({
      id: schedule.id,
      data: { ...schedule, slots: newSlots },
    });
  };

  const handleRemoveSlot = (dayKey, slotIndex) => {
    const schedule = getScheduleForDay(dayKey);
    if (!schedule) return;

    const newSlots = schedule.slots.filter((_, i) => i !== slotIndex);

    updateMutation.mutate({
      id: schedule.id,
      data: { ...schedule, slots: newSlots },
    });
  };

  const handleDuracionInputChange = (dayKey, value) => {
    setDuracionInputs(prev => ({ ...prev, [dayKey]: value }));
  };

  const handleDuracionBlur = async (dayKey) => {
    const schedule = getScheduleForDay(dayKey);
    if (!schedule) return;

    const value = duracionInputs[dayKey];
    if (value === undefined) return;

    const duracion = value === '' ? null : parseInt(value);

    if (duracion !== null && (isNaN(duracion) || duracion < 30 || duracion > 300)) {
      toast.error('La duración debe estar entre 30 y 300 minutos');
      setDuracionInputs(prev => ({ ...prev, [dayKey]: undefined }));
      return;
    }

    updateMutation.mutate({
      id: schedule.id,
      data: { ...schedule, duracion_reserva_default: duracion },
    });

    setDuracionInputs(prev => ({ ...prev, [dayKey]: undefined }));

    // 🔥 NUEVO: Actualizar reservas existentes automáticamente
    if (duracion !== null && duracion !== schedule.duracion_reserva_default) {
      try {
        const result = await base44.functions.invoke('actualizarDuracionReservas', {
          restaurant_id: restaurantId,
          day_of_week: dayKey,
          new_duration: duracion
        });
        
        if (result.data.updated > 0) {
          toast.success(`Duración actualizada + ${result.data.updated} reserva(s) existente(s) actualizadas`);
          queryClient.invalidateQueries({ queryKey: ['reservations', restaurantId] });
        }
      } catch (error) {
        console.error('Error actualizando reservas:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-900">
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg bg-white dark:bg-slate-900">
      <CardHeader className="border-b border-slate-100 dark:border-slate-700">
        <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
          <Calendar className="w-5 h-5 text-blue-900 dark:text-blue-400" />
          Horario Semanal
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        <div className="space-y-4">
          {daysOfWeek.map((day) => {
            const schedule = getScheduleForDay(day.key);
            const isOpen = schedule?.is_open ?? false;
            const slots = schedule?.slots || [];
            const duracion = schedule?.duracion_reserva_default;
            const inputValue = duracionInputs[day.key] !== undefined ? duracionInputs[day.key] : (duracion || '');

            return (
              <div
                key={day.key}
                className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{day.label}</h3>
                    <Switch checked={isOpen} onCheckedChange={(checked) => handleToggle(day.key, checked)} />
                  </div>
                  {isOpen && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddSlot(day.key)}
                      className="bg-white dark:bg-slate-700 text-slate-900 dark:text-white border-slate-200 dark:border-slate-600"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Añadir Turno
                    </Button>
                  )}
                </div>

                {isOpen && (
                  <div className="space-y-3">
                    {slots.map((slot, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-slate-600 dark:text-slate-400">Apertura</Label>
                            <Input
                              type="time"
                              value={slot.opening_time || ''}
                              onChange={(e) => handleSlotChange(day.key, index, 'opening_time', e.target.value)}
                              className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-600 dark:text-slate-400">Cierre</Label>
                            <Input
                              type="time"
                              value={slot.closing_time || ''}
                              onChange={(e) => handleSlotChange(day.key, index, 'closing_time', e.target.value)}
                              className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>
                        {slots.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveSlot(day.key, index)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}

                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                      <Label className="text-xs text-slate-600 dark:text-slate-400 mb-2 block">
                        <Clock className="w-3 h-3 inline mr-1" />
                        Duración de Reserva para este día (opcional)
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="30"
                          max="300"
                          step="15"
                          value={inputValue}
                          onChange={(e) => handleDuracionInputChange(day.key, e.target.value)}
                          onBlur={() => handleDuracionBlur(day.key)}
                          placeholder="ej: 90"
                          className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                        />
                        <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">minutos</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {duracion ? (
                          <>Usando: <strong>{duracion} min</strong></>
                        ) : (
                          <>Vacío = usa duración global del restaurante ({globalDuracion} min)</>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {!isOpen && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 italic">Cerrado</p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}