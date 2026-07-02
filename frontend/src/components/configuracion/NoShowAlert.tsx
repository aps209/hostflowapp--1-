import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertTriangle, Info } from "lucide-react";

export default function NoShowAlert({ config, onUpdate, isSaving }) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (config) {
      setIsEnabled(config.alert_no_show_enabled || false);
    }
  }, [config]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdate({ alert_no_show_enabled: isEnabled });
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <CardHeader>
        <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Alerta de No-Show
        </CardTitle>
        <CardDescription className="text-slate-600 dark:text-slate-400">
          Activa alertas visuales para reservas que no han llegado a su hora
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {showSuccess && (
            <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-300">
                Configuración de alertas guardada correctamente
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between space-x-2 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex-1">
              <Label htmlFor="alert-no-show" className="text-base font-semibold text-slate-900 dark:text-white">
                Activar alertas de No-Show
              </Label>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Las mesas con reservas que no han llegado parpadearán en el floorplan
              </p>
            </div>
            <Switch
              id="alert-no-show"
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
            />
          </div>

          {isEnabled && (
            <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
              <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-900 dark:text-amber-300">
                <p className="font-semibold mb-2">¿Cómo funciona?</p>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  <li>Si la hora actual es igual o mayor que la hora de la reserva</li>
                  <li>Y el estado de la reserva NO es "Sentada"</li>
                  <li>Los colores de la mesa parpadearán para alertarte</li>
                </ul>
                <p className="text-xs mt-2 opacity-80">
                  Útil para identificar rápidamente reservas que no se han presentado o están retrasadas
                </p>
              </AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={isSaving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSaving ? 'Guardando...' : 'Guardar configuración'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}