import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon, Plane, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

export default function VacationClosure({ restaurantId }) {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [eventName, setEventName] = useState('');

  const queryClient = useQueryClient();

  const createVacationMutation = useMutation({
    mutationFn: async ({ startDate, endDate, name }) => {
      const dates = eachDayOfInterval({ start: startDate, end: endDate });
      
      const specialDays = dates.map(date => ({
        restaurant_id: restaurantId,
        date: format(date, 'yyyy-MM-dd'),
        name: name || 'Vacaciones',
        is_open: false,
        slots: [],
      }));

      return await base44.entities.SpecialDay.bulkCreate(specialDays);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['specialDays', restaurantId] });
      const daysCount = data.length;
      toast.success(`${daysCount} día(s) cerrado(s) por vacaciones`);
      setStartDate(null);
      setEndDate(null);
      setEventName('');
    },
    onError: (error) => {
      toast.error('Error al crear cierre por vacaciones');
      console.error(error);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!startDate || !endDate) {
      toast.error('Selecciona fecha de inicio y fin');
      return;
    }

    if (startDate > endDate) {
      toast.error('La fecha de inicio debe ser anterior a la de fin');
      return;
    }

    const daysCount = eachDayOfInterval({ start: startDate, end: endDate }).length;

    if (window.confirm(`¿Cerrar el restaurante durante ${daysCount} día(s) desde ${format(startDate, 'PP', { locale: es })} hasta ${format(endDate, 'PP', { locale: es })}?`)) {
      createVacationMutation.mutate({ startDate, endDate, name: eventName });
    }
  };

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800">
      <CardHeader className="border-b border-blue-200 dark:border-slate-700">
        <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-white">
          <Plane className="w-5 h-5" />
          Cierre por Vacaciones
        </CardTitle>
        <p className="text-sm text-blue-700 dark:text-slate-400 mt-1">
          Cierra el restaurante varios días seguidos de forma rápida
        </p>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-slate-900 dark:text-white mb-2 block">
              Nombre del periodo (opcional)
            </Label>
            <Input
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="Ej: Vacaciones de Verano, Navidad..."
              className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-900 dark:text-white mb-2 block">Fecha de Inicio</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-left bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'PP', { locale: es }) : 'Seleccionar inicio'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar 
                    mode="single" 
                    selected={startDate} 
                    onSelect={setStartDate} 
                    locale={es}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label className="text-slate-900 dark:text-white mb-2 block">Fecha de Fin</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-left bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'PP', { locale: es }) : 'Seleccionar fin'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar 
                    mode="single" 
                    selected={endDate} 
                    onSelect={setEndDate} 
                    locale={es}
                    disabled={(date) => date < (startDate || new Date(new Date().setHours(0, 0, 0, 0)))}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {startDate && endDate && startDate <= endDate && (
            <div className="bg-blue-100 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-900 dark:text-blue-300">
                Se cerrarán <strong>{eachDayOfInterval({ start: startDate, end: endDate }).length} día(s)</strong> desde el{' '}
                <strong>{format(startDate, 'PP', { locale: es })}</strong> hasta el{' '}
                <strong>{format(endDate, 'PP', { locale: es })}</strong>
              </p>
            </div>
          )}

          <Button 
            type="submit" 
            disabled={!startDate || !endDate || startDate > endDate || createVacationMutation.isPending}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
          >
            {createVacationMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cerrando días...
              </>
            ) : (
              <>
                <Plane className="w-4 h-4 mr-2" />
                Cerrar Restaurante
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}