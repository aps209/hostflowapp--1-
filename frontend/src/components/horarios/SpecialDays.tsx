import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Calendar as CalendarIcon, Plus, Trash2, Loader2, Clock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

export default function SpecialDays({ restaurantId }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    date: null,
    name: '',
    is_open: true,
    slots: [{ opening_time: '12:00', closing_time: '23:00' }],
    duracion_reserva_default: null,
  });
  const [duracionInputs, setDuracionInputs] = useState({});

  const queryClient = useQueryClient();

  const { data: specialDays = [], isLoading } = useQuery({
    queryKey: ['specialDays', restaurantId],
    queryFn: () => base44.entities.SpecialDay.filter({ restaurant_id: restaurantId }),
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
    mutationFn: (data) => base44.entities.SpecialDay.create({ ...data, restaurant_id: restaurantId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specialDays', restaurantId] });
      toast.success('Día especial creado');
      setShowForm(false);
      setFormData({
        date: null,
        name: '',
        is_open: true,
        slots: [{ opening_time: '12:00', closing_time: '23:00' }],
        duracion_reserva_default: null,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SpecialDay.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specialDays', restaurantId] });
      toast.success('Día especial actualizado');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SpecialDay.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specialDays', restaurantId] });
      toast.success('Día especial eliminado');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.date || !formData.name) {
      toast.error('Fecha y nombre son obligatorios');
      return;
    }

    const dataToSubmit = {
      ...formData,
      date: format(formData.date, 'yyyy-MM-dd'),
      duracion_reserva_default: formData.duracion_reserva_default || null,
    };

    createMutation.mutate(dataToSubmit);
  };

  const handleSlotChange = (specialDayId, slotIndex, field, value) => {
    const specialDay = specialDays.find((sd) => sd.id === specialDayId);
    if (!specialDay) return;

    const newSlots = [...(specialDay.slots || [])];
    newSlots[slotIndex] = { ...newSlots[slotIndex], [field]: value };

    updateMutation.mutate({
      id: specialDay.id,
      data: { ...specialDay, slots: newSlots },
    });
  };

  const handleAddSlot = (specialDayId) => {
    const specialDay = specialDays.find((sd) => sd.id === specialDayId);
    if (!specialDay) return;

    const newSlots = [...(specialDay.slots || []), { opening_time: '12:00', closing_time: '23:00' }];

    updateMutation.mutate({
      id: specialDay.id,
      data: { ...specialDay, slots: newSlots },
    });
  };

  const handleRemoveSlot = (specialDayId, slotIndex) => {
    const specialDay = specialDays.find((sd) => sd.id === specialDayId);
    if (!specialDay) return;

    const newSlots = specialDay.slots.filter((_, i) => i !== slotIndex);

    updateMutation.mutate({
      id: specialDay.id,
      data: { ...specialDay, slots: newSlots },
    });
  };

  const handleToggle = (specialDayId, isOpen) => {
    const specialDay = specialDays.find((sd) => sd.id === specialDayId);
    if (!specialDay) return;

    updateMutation.mutate({
      id: specialDay.id,
      data: { ...specialDay, is_open: isOpen },
    });
  };

  const handleDuracionInputChange = (specialDayId, value) => {
    setDuracionInputs(prev => ({ ...prev, [specialDayId]: value }));
  };

  const handleDuracionBlur = async (specialDayId) => {
    const specialDay = specialDays.find((sd) => sd.id === specialDayId);
    if (!specialDay) return;

    const value = duracionInputs[specialDayId];
    if (value === undefined) return;

    const duracion = value === '' ? null : parseInt(value);

    if (duracion !== null && (isNaN(duracion) || duracion < 30 || duracion > 300)) {
      toast.error('La duración debe estar entre 30 y 300 minutos');
      setDuracionInputs(prev => ({ ...prev, [specialDayId]: undefined }));
      return;
    }

    updateMutation.mutate({
      id: specialDay.id,
      data: { ...specialDay, duracion_reserva_default: duracion },
    });

    setDuracionInputs(prev => ({ ...prev, [specialDayId]: undefined }));

    // 🔥 NUEVO: Actualizar reservas existentes automáticamente
    if (duracion !== null && duracion !== specialDay.duracion_reserva_default) {
      try {
        const result = await base44.functions.invoke('actualizarDuracionReservas', {
          restaurant_id: restaurantId,
          date: specialDay.date,
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
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <CalendarIcon className="w-5 h-5 text-blue-900 dark:text-blue-400" />
            Días Especiales
          </CardTitle>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 text-white"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Añadir
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
            <div className="grid gap-4">
              <div>
                <Label className="text-slate-900 dark:text-white">Fecha</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.date ? format(formData.date, 'PPP', { locale: es }) : 'Seleccionar fecha'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={formData.date} onSelect={(date) => setFormData({ ...formData, date })} locale={es} />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label className="text-slate-900 dark:text-white">Nombre del Evento</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Navidad, Evento Privado"
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={formData.is_open} onCheckedChange={(checked) => setFormData({ ...formData, is_open: checked })} />
                <Label className="text-slate-900 dark:text-white">Abierto</Label>
              </div>

              {formData.is_open && (
                <>
                  {formData.slots.map((slot, index) => (
                    <div key={index} className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-slate-600 dark:text-slate-400">Apertura</Label>
                        <Input
                          type="time"
                          value={slot.opening_time}
                          onChange={(e) => {
                            const newSlots = [...formData.slots];
                            newSlots[index].opening_time = e.target.value;
                            setFormData({ ...formData, slots: newSlots });
                          }}
                          className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600 dark:text-slate-400">Cierre</Label>
                        <Input
                          type="time"
                          value={slot.closing_time}
                          onChange={(e) => {
                            const newSlots = [...formData.slots];
                            newSlots[index].closing_time = e.target.value;
                            setFormData({ ...formData, slots: newSlots });
                          }}
                          className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  ))}

                  <div>
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
                        value={formData.duracion_reserva_default || ''}
                        onChange={(e) => setFormData({ ...formData, duracion_reserva_default: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="ej: 90"
                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                      />
                      <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">minutos</span>
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white flex-1">
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
                  Cancelar
                </Button>
              </div>
            </div>
          </form>
        )}

        <div className="space-y-4">
          {specialDays
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map((specialDay) => {
              const inputValue = duracionInputs[specialDay.id] !== undefined 
                ? duracionInputs[specialDay.id] 
                : (specialDay.duracion_reserva_default || '');

              return (
                <div key={specialDay.id} className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{specialDay.name}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{format(new Date(specialDay.date + 'T00:00:00'), 'PPP', { locale: es })}</p>
                      </div>
                      <Switch checked={specialDay.is_open} onCheckedChange={(checked) => handleToggle(specialDay.id, checked)} />
                    </div>
                    <div className="flex items-center gap-2">
                      {specialDay.is_open && (
                        <Button variant="outline" size="sm" onClick={() => handleAddSlot(specialDay.id)} className="bg-white dark:bg-slate-700 text-slate-900 dark:text-white border-slate-200 dark:border-slate-600">
                          <Plus className="w-4 h-4 mr-2" />
                          Turno
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('¿Eliminar este día especial?')) {
                            deleteMutation.mutate(specialDay.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {specialDay.is_open && (
                    <div className="space-y-3">
                      {(specialDay.slots || []).map((slot, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs text-slate-600 dark:text-slate-400">Apertura</Label>
                              <Input
                                type="time"
                                value={slot.opening_time || ''}
                                onChange={(e) => handleSlotChange(specialDay.id, index, 'opening_time', e.target.value)}
                                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-slate-600 dark:text-slate-400">Cierre</Label>
                              <Input
                                type="time"
                                value={slot.closing_time || ''}
                                onChange={(e) => handleSlotChange(specialDay.id, index, 'closing_time', e.target.value)}
                                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                              />
                            </div>
                          </div>
                          {(specialDay.slots || []).length > 1 && (
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveSlot(specialDay.id, index)} className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950">
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
                            onChange={(e) => handleDuracionInputChange(specialDay.id, e.target.value)}
                            onBlur={() => handleDuracionBlur(specialDay.id)}
                            placeholder="ej: 90"
                            className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                            />
                            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">minutos</span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {specialDay.duracion_reserva_default ? (
                            <>Usando: <strong>{specialDay.duracion_reserva_default} min</strong></>
                            ) : (
                            <>Vacío = usa duración global del restaurante ({globalDuracion} min)</>
                            )}
                            </p>
                      </div>
                    </div>
                  )}

                  {!specialDay.is_open && <p className="text-sm text-slate-500 dark:text-slate-400 italic">Cerrado</p>}
                </div>
              );
            })}

          {specialDays.length === 0 && (
            <p className="text-center text-slate-500 dark:text-slate-400 py-8">No hay días especiales configurados</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}