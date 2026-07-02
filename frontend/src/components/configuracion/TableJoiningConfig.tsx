import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Link as LinkIcon } from "lucide-react";

export default function TableJoiningConfig({ config, onUpdate, t }) {
  const handleToggle = (checked) => {
    onUpdate({ allow_table_joining: checked });
  };

  return (
    <Card className="border-0 shadow-lg bg-white dark:bg-slate-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
          <LinkIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          Unión de Mesas
        </CardTitle>
        <CardDescription className="text-slate-600 dark:text-slate-400">
          Configura si tu restaurante une mesas para grupos grandes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
          <div className="space-y-0.5">
            <Label htmlFor="allow-joining" className="text-base font-medium text-slate-900 dark:text-white">
              Permitir unir mesas
            </Label>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              El sistema podrá combinar múltiples mesas para grupos grandes
            </p>
          </div>
          <Switch
            id="allow-joining"
            checked={config?.allow_table_joining || false}
            onCheckedChange={handleToggle}
          />
        </div>

        {config?.allow_table_joining && (
          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-900 dark:text-blue-200">
              <p className="font-semibold mb-2">¿Cómo funciona?</p>
              <ul className="text-sm space-y-1 ml-4 list-disc">
                <li>Ve a la sección "Floorplan" y edita cada mesa</li>
                <li>Define qué mesas se pueden unir entre sí usando "Grupo de Unión"</li>
                <li>Ejemplo: si Mesa 1 y Mesa 2 pueden unirse, asígnales el mismo ID de grupo (ej: "terraza-1")</li>
                <li>El sistema automáticamente las combinará cuando sea necesario</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {!config?.allow_table_joining && (
          <Alert className="border-slate-200 bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700">
            <Info className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            <AlertDescription className="text-slate-700 dark:text-slate-300">
              <p className="text-sm">
                Desactivado: El sistema solo asignará mesas individuales. 
                Ideal si tu restaurante no une mesas físicamente.
              </p>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}