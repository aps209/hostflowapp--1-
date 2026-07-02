import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Loader2, Utensils, Moon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ServiceHoursConfig({ config, onUpdate, isLoading }) {
  const [formData, setFormData] = useState({
    hora_inicio_comida: "13:00",
    hora_fin_comida: "16:00",
    hora_inicio_cena: "20:00",
    hora_fin_cena: "23:00",
  });

  useEffect(() => {
    if (config) {
      setFormData({
        hora_inicio_comida: config.hora_inicio_comida || "13:00",
        hora_fin_comida: config.hora_fin_comida || "16:00",
        hora_inicio_cena: config.hora_inicio_cena || "20:00",
        hora_fin_cena: config.hora_fin_cena || "23:00",
      });
    }
  }, [config]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdate(formData);
  };

  return (
    <Card className="border-0 shadow-lg bg-white dark:bg-slate-900">
      <CardHeader className="border-b border-slate-100 dark:border-slate-700">
        <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
          <Clock className="w-5 h-5 text-blue-900 dark:text-blue-400" />
          Horarios de Servicio
        </CardTitle>
        <CardDescription className="text-slate-600 dark:text-slate-400">
          Define los tramos horarios de Comida y Cena para filtrar el floorplan
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-sm text-blue-900 dark:text-blue-300">
              Estos horarios se usarán para filtrar las reservas en el Floorplan por tramos (Comida/Cena)
            </AlertDescription>
          </Alert>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Comida */}
            <div className="space-y-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-lg bg-amber-600 flex items-center justify-center">
                  <Utensils className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Comida</h3>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="hora_inicio_comida" className="text-slate-900 dark:text-white text-sm">
                  Hora de Inicio
                </Label>
                <Input
                  id="hora_inicio_comida"
                  type="time"
                  value={formData.hora_inicio_comida}
                  onChange={(e) => setFormData({ ...formData, hora_inicio_comida: e.target.value })}
                  className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hora_fin_comida" className="text-slate-900 dark:text-white text-sm">
                  Hora de Fin
                </Label>
                <Input
                  id="hora_fin_comida"
                  type="time"
                  value={formData.hora_fin_comida}
                  onChange={(e) => setFormData({ ...formData, hora_fin_comida: e.target.value })}
                  className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>
            </div>

            {/* Cena */}
            <div className="space-y-4 p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <Moon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Cena</h3>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="hora_inicio_cena" className="text-slate-900 dark:text-white text-sm">
                  Hora de Inicio
                </Label>
                <Input
                  id="hora_inicio_cena"
                  type="time"
                  value={formData.hora_inicio_cena}
                  onChange={(e) => setFormData({ ...formData, hora_inicio_cena: e.target.value })}
                  className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hora_fin_cena" className="text-slate-900 dark:text-white text-sm">
                  Hora de Fin
                </Label>
                <Input
                  id="hora_fin_cena"
                  type="time"
                  value={formData.hora_fin_cena}
                  onChange={(e) => setFormData({ ...formData, hora_fin_cena: e.target.value })}
                  className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700"
            >
              {isLoading ? (
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