import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Loader2, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRestaurant } from "../RestaurantContext";

export default function DefaultTimings() {
  const [formData, setFormData] = useState({
    duracion_reserva_default: 90,
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  const queryClient = useQueryClient();
  const { restaurantId } = useRestaurant();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['restaurantConfig', restaurantId],
    queryFn: () => base44.entities.RestaurantConfig.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 0,
  });

  const config = configs[0];

  useEffect(() => {
    if (config) {
      setFormData({
        duracion_reserva_default: config.duracion_reserva_default || 90,
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const dataWithRestaurant = { ...data, restaurant_id: restaurantId };
      
      if (config) {
        return base44.entities.RestaurantConfig.update(config.id, dataWithRestaurant);
      } else {
        return base44.entities.RestaurantConfig.create(dataWithRestaurant);
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['restaurantConfig', restaurantId] }),
        queryClient.refetchQueries({ queryKey: ['restaurantConfig'] }),
        queryClient.refetchQueries({ queryKey: ['reservations', restaurantId] }),
        queryClient.refetchQueries({ queryKey: ['tables', restaurantId] }),
        queryClient.refetchQueries({ queryKey: ['schedules', restaurantId] }),
        queryClient.refetchQueries({ queryKey: ['specialDays', restaurantId] }),
        queryClient.refetchQueries({ queryKey: ['tableAvailability', restaurantId] }),
      ]);
      
      queryClient.invalidateQueries({ queryKey: ['restaurantConfig', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['restaurantConfig'] });
      queryClient.invalidateQueries({ queryKey: ['reservations', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['tables', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['schedules', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['specialDays', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['tableAvailability', restaurantId] });
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  if (isLoading || !restaurantId) {
    return (
      <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900">
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900">
      <CardHeader className="border-b border-slate-100 dark:border-slate-700">
        <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
          <Clock className="w-5 h-5 text-blue-900 dark:text-blue-400" />
          Duración de Reservas
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="duracion" className="text-slate-900 dark:text-white">Duración Predeterminada de Reserva</Label>
            <div className="flex items-center gap-2">
              <Input
                id="duracion"
                type="number"
                min="30"
                max="300"
                step="15"
                value={formData.duracion_reserva_default}
                onChange={(e) => setFormData({ duracion_reserva_default: parseInt(e.target.value) || 90 })}
                className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
              <span className="text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">minutos</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Tiempo que dura una comida típica (la mesa estará bloqueada durante este tiempo)</p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
            <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Cómo funciona el bloqueo de mesas:</h4>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Con una duración de <strong>{formData.duracion_reserva_default} minutos</strong>,
              una reserva a las 20:00 bloqueará la mesa hasta las{' '}
              <strong>{new Date(2024, 0, 1, 20, formData.duracion_reserva_default).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})}</strong>.
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
              La siguiente reserva en esa mesa podrá hacerse a partir de esa hora.
            </p>
          </div>

          {saveSuccess && (
            <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 dark:border-emerald-800">
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <AlertDescription className="text-emerald-900 dark:text-emerald-200">
                Configuración guardada correctamente. El sistema de reservas ya usa este valor.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={saveMutation.isPending}
              className="bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar Configuración"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}