import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Bell, Save, MessageSquare, Clock, AlertCircle } from "lucide-react";
import { useRestaurant } from "../components/RestaurantContext";
import { toast } from "sonner";

export default function Recordatorios() {
  const { restaurantId } = useRestaurant();
  const queryClient = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['reminderConfig', restaurantId],
    queryFn: () => base44.entities.ReminderConfig.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const config = configs[0];

  const [formData, setFormData] = useState({
    enabled: config?.enabled ?? true,
    hours_before: config?.hours_before ?? 24,
    sms_message_template: config?.sms_message_template ?? "Hola {nombre}! Te recordamos tu reserva en {restaurante} mañana {fecha} a las {hora}. Mesa: {mesa}. Personas: {comensales}. Para cancelar: {link_cancelar}",
    only_confirmed: config?.only_confirmed ?? true,
    send_time: config?.send_time ?? "10:00",
  });

  React.useEffect(() => {
    if (config) {
      setFormData({
        enabled: config.enabled ?? true,
        hours_before: config.hours_before ?? 24,
        sms_message_template: config.sms_message_template ?? "Hola {nombre}! Te recordamos tu reserva en {restaurante} mañana {fecha} a las {hora}. Mesa: {mesa}. Personas: {comensales}. Para cancelar: {link_cancelar}",
        only_confirmed: config.only_confirmed ?? true,
        send_time: config.send_time ?? "10:00",
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (config) {
        return base44.entities.ReminderConfig.update(config.id, data);
      } else {
        return base44.entities.ReminderConfig.create({
          restaurant_id: restaurantId,
          ...data,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminderConfig', restaurantId] });
      toast.success('Configuración guardada correctamente');
    },
    onError: (error) => {
      toast.error('Error al guardar: ' + error.message);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 space-y-6 bg-slate-50 dark:bg-black min-h-screen">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-1/4"></div>
          <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 bg-slate-50 dark:bg-black min-h-screen">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Bell className="w-8 h-8" />
          Recordatorios Automáticos
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Configura el envío automático de recordatorios por SMS a tus clientes
        </p>
      </div>

      <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900">
        <CardHeader className="border-b border-slate-100 dark:border-slate-700">
          <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Configuración de Recordatorios
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div>
                <Label className="text-base font-semibold text-slate-900 dark:text-white">
                  Activar Recordatorios Automáticos
                </Label>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Los recordatorios se enviarán automáticamente por SMS
                </p>
              </div>
              <Switch
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-slate-900 dark:text-white">
                  Horas antes de la reserva
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="168"
                  value={formData.hours_before}
                  onChange={(e) => setFormData({ ...formData, hours_before: parseInt(e.target.value) })}
                  className="text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tiempo de anticipación para enviar el recordatorio
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Hora de envío
                </Label>
                <Input
                  type="time"
                  value={formData.send_time}
                  onChange={(e) => setFormData({ ...formData, send_time: e.target.value })}
                  className="text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Hora del día para procesar y enviar recordatorios
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <div>
                <Label className="text-base text-slate-900 dark:text-white">
                  Solo reservas confirmadas
                </Label>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Enviar solo a reservas con estado "confirmada"
                </p>
              </div>
              <Switch
                checked={formData.only_confirmed}
                onCheckedChange={(checked) => setFormData({ ...formData, only_confirmed: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-900 dark:text-white">
                Plantilla del mensaje SMS
              </Label>
              <Textarea
                value={formData.sms_message_template}
                onChange={(e) => setFormData({ ...formData, sms_message_template: e.target.value })}
                rows={6}
                className="text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-mono text-sm"
              />
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mt-3">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-2">
                  Variables disponibles:
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs text-amber-800 dark:text-amber-400">
                  <code className="bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded">{"{nombre}"}</code>
                  <code className="bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded">{"{restaurante}"}</code>
                  <code className="bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded">{"{fecha}"}</code>
                  <code className="bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded">{"{hora}"}</code>
                  <code className="bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded">{"{mesa}"}</code>
                  <code className="bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded">{"{comensales}"}</code>
                  <code className="bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded">{"{link_cancelar}"}</code>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900 dark:text-blue-300">
                  <p className="font-semibold mb-1">Nota importante:</p>
                  <p>Los recordatorios se enviarán automáticamente a todas las reservas que cumplan los criterios. Asegúrate de que los clientes tengan número de teléfono registrado.</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={saveMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                {saveMutation.isPending ? 'Guardando...' : 'Guardar Configuración'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900">
        <CardHeader className="border-b border-slate-100 dark:border-slate-700">
          <CardTitle className="text-slate-900 dark:text-white">
            ¿Cómo funcionan los recordatorios?
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4 text-slate-600 dark:text-slate-400">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">1</div>
              <p>El sistema revisa automáticamente las reservas que cumplen el tiempo configurado (ej: 24h antes)</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">2</div>
              <p>Filtra las reservas según tus criterios (solo confirmadas, con teléfono, etc.)</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">3</div>
              <p>Envía un SMS personalizado a cada cliente con los detalles de su reserva</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">4</div>
              <p>Los clientes pueden cancelar fácilmente usando el enlace incluido en el SMS</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}