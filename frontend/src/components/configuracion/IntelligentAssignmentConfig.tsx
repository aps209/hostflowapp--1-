import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Sparkles, AlertCircle } from "lucide-react";

export default function IntelligentAssignmentConfig({ config, onUpdate }) {
  const handleToggle = (checked) => {
    onUpdate({ intelligent_assignment_enabled: checked });
  };

  return (
    <Card className="border-0 shadow-lg bg-white dark:bg-slate-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
          <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          Asignación Inteligente de Mesas
        </CardTitle>
        <CardDescription className="text-slate-600 dark:text-slate-400">
          Controla el sistema automático de asignación de mesas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
          <div className="space-y-0.5">
            <Label htmlFor="intelligent-assignment" className="text-base font-medium text-slate-900 dark:text-white">
              Activar asignación inteligente
            </Label>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              El sistema asignará automáticamente la mejor mesa disponible al crear reservas desde el panel interno
            </p>
          </div>
          <Switch
            id="intelligent-assignment"
            checked={config?.intelligent_assignment_enabled !== false}
            onCheckedChange={handleToggle}
          />
        </div>

        {config?.intelligent_assignment_enabled !== false ? (
          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
            <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-900 dark:text-blue-200">
              <p className="font-semibold mb-2">Sistema inteligente activado</p>
              <ul className="text-sm space-y-1 ml-4 list-disc">
                <li>Busca la mesa más adecuada según el número de comensales</li>
                <li>Considera las preferencias de área del cliente</li>
                <li>Prioriza clientes VIP con las mejores mesas</li>
                <li>Optimiza la ocupación evitando desperdiciar capacidad</li>
                <li>Une mesas automáticamente si está activado en configuración</li>
                <li>Siempre puedes asignar mesas manualmente si lo prefieres</li>
              </ul>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-slate-200 bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700">
            <Info className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            <AlertDescription className="text-slate-700 dark:text-slate-300">
              <p className="text-sm">
                <strong>Desactivado:</strong> Deberás seleccionar manualmente la mesa para cada reserva creada desde el panel interno.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-900 dark:text-amber-200">
            <p className="font-semibold text-sm mb-1">⚠️ Importante</p>
            <p className="text-xs">
              Las <strong>reservas públicas</strong> (realizadas por clientes a través del enlace de reserva) 
              <strong className="underline"> siempre usarán el sistema inteligente</strong> independientemente de esta configuración. 
              Esta opción solo afecta las reservas creadas internamente por el staff.
            </p>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}