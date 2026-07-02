
import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Palette, Loader2, CheckCircle, RotateCcw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRestaurant } from "../RestaurantContext";

const colorPresets = {
  primary: [
    { name: "Azul Marino", color: "#1e3a8a" },
    { name: "Verde Esmeralda", color: "#047857" },
    { name: "Púrpura Real", color: "#7c3aed" },
    { name: "Rojo Elegante", color: "#b91c1c" },
    { name: "Índigo Profundo", color: "#4338ca" },
    { name: "Turquesa", color: "#0891b2" },
    { name: "Naranja Cálido", color: "#ea580c" },
    { name: "Rosa Moderno", color: "#db2777" },
  ],
  accent: [
    { name: "Ámbar", color: "#f59e0b" },
    { name: "Verde Lima", color: "#84cc16" },
    { name: "Naranja", color: "#f97316" },
    { name: "Rosa", color: "#ec4899" },
    { name: "Cian", color: "#06b6d4" },
    { name: "Amarillo", color: "#eab308" },
    { name: "Violeta", color: "#a855f7" },
    { name: "Verde Menta", color: "#10b981" },
  ]
};

export default function Customization() {
  const { restaurantId, colorPrimario: currentColorPrimario, colorAccento: currentColorAccento, refreshConfig } = useRestaurant();
  const [formData, setFormData] = useState({
    color_primario: currentColorPrimario,
    color_acento: currentColorAccento,
    tema: "dark",
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  const queryClient = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['restaurantConfig', restaurantId],
    queryFn: () => base44.entities.RestaurantConfig.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: Infinity, // No refetch automático
  });

  const config = configs[0];

  useEffect(() => {
    setFormData({
      color_primario: currentColorPrimario,
      color_acento: currentColorAccento,
      tema: "dark",
    });
  }, [currentColorPrimario, currentColorAccento]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const dataWithDarkTheme = { ...data, tema: "dark", restaurant_id: restaurantId };
      
      if (config) {
        return base44.entities.RestaurantConfig.update(config.id, dataWithDarkTheme);
      } else {
        return base44.entities.RestaurantConfig.create(dataWithDarkTheme);
      }
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['restaurantConfig', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['restaurantConfig'] });
      
      // Guardar colores en localStorage inmediatamente
      localStorage.setItem('hostflow_color_primario', formData.color_primario);
      localStorage.setItem('hostflow_color_acento', formData.color_acento);
      
      // Refrescar el contexto para que se apliquen los colores inmediatamente
      await refreshConfig();
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const handleReset = () => {
    setFormData({
      color_primario: "#1e3a8a",
      color_acento: "#f59e0b",
      tema: "dark",
    });
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-xl shadow-slate-900/5 bg-slate-900 backdrop-blur-sm">
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900 backdrop-blur-sm">
      <CardHeader className="border-b border-slate-200 dark:border-slate-700 p-4 md:p-6">
        <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white text-lg md:text-xl">
          <Palette className="w-4 h-4 md:w-5 md:h-5" style={{ color: formData.color_acento }} />
          Personalización
        </CardTitle>
        <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-2">La aplicación utiliza tema oscuro de forma permanente</p>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">

          {/* Color Primario */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm md:text-base text-slate-900 dark:text-slate-200">Color Primario</Label>
              <div className="flex items-center gap-2">
                <div 
                  className="w-8 h-8 md:w-10 md:h-10 rounded-lg border-2 border-slate-300 dark:border-slate-600 shadow-sm"
                  style={{ backgroundColor: formData.color_primario }}
                />
                <input
                  type="color"
                  value={formData.color_primario}
                  onChange={(e) => setFormData({ ...formData, color_primario: e.target.value })}
                  className="w-10 h-8 md:w-12 md:h-10 cursor-pointer rounded border border-slate-300 dark:border-slate-600"
                />
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">Color principal para botones, encabezados y elementos destacados</p>
            <div className="grid grid-cols-6 md:grid-cols-8 gap-1.5 md:gap-2 mt-3">
              {colorPresets.primary.map((preset) => (
                <button
                  key={preset.color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color_primario: preset.color })}
                  className={`w-full aspect-square rounded-lg border-2 transition-all hover:scale-110 ${
                    formData.color_primario === preset.color 
                      ? 'border-slate-900 dark:border-slate-100 ring-2 ring-offset-1 ring-slate-900 dark:ring-slate-100 ring-offset-white dark:ring-offset-slate-900' 
                      : 'border-slate-300 dark:border-slate-600'
                  }`}
                  style={{ backgroundColor: preset.color }}
                  title={preset.name}
                />
              ))}
            </div>
          </div>

          {/* Color de Acento */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm md:text-base text-slate-900 dark:text-slate-200">Color de Acento</Label>
              <div className="flex items-center gap-2">
                <div 
                  className="w-8 h-8 md:w-10 md:h-10 rounded-lg border-2 border-slate-300 dark:border-slate-600 shadow-sm"
                  style={{ backgroundColor: formData.color_acento }}
                />
                <input
                  type="color"
                  value={formData.color_acento}
                  onChange={(e) => setFormData({ ...formData, color_acento: e.target.value })}
                  className="w-10 h-8 md:w-12 md:h-10 cursor-pointer rounded border border-slate-300 dark:border-slate-600"
                />
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">Color secundario para resaltar elementos importantes y notificaciones</p>
            <div className="grid grid-cols-6 md:grid-cols-8 gap-1.5 md:gap-2 mt-3">
              {colorPresets.accent.map((preset) => (
                <button
                  key={preset.color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color_acento: preset.color })}
                  className={`w-full aspect-square rounded-lg border-2 transition-all hover:scale-110 ${
                    formData.color_acento === preset.color 
                      ? 'border-slate-900 dark:border-slate-100 ring-2 ring-offset-1 ring-slate-900 dark:ring-slate-100 ring-offset-white dark:ring-offset-slate-900' 
                      : 'border-slate-300 dark:border-slate-600'
                  }`}
                  style={{ backgroundColor: preset.color }}
                  title={preset.name}
                />
              ))}
            </div>
          </div>

          {/* Vista Previa */}
          <div className="bg-slate-100 dark:bg-slate-950 rounded-lg p-4 md:p-6 border border-slate-200 dark:border-slate-700">
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 md:mb-4 text-sm md:text-base">Vista Previa</h4>
            <div className="space-y-3">
              <div className="flex gap-2 md:gap-3 flex-wrap">
                <button
                  type="button"
                  className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-white font-medium shadow-lg transition-all hover:opacity-90 text-xs md:text-sm"
                  style={{ backgroundColor: formData.color_primario }}
                >
                  Botón Primario
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-white font-medium shadow-lg transition-all hover:opacity-90 text-xs md:text-sm"
                  style={{ backgroundColor: formData.color_acento }}
                >
                  Botón Acento
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-white font-medium shadow-lg transition-all hover:opacity-90 text-xs md:text-sm"
                  style={{ 
                    background: `linear-gradient(135deg, ${formData.color_primario}, ${formData.color_acento})` 
                  }}
                >
                  Gradiente
                </button>
              </div>
              <div 
                className="p-3 md:p-4 rounded-lg text-white"
                style={{ backgroundColor: formData.color_primario }}
              >
                <h5 className="font-bold mb-1 text-sm md:text-base">Encabezado de ejemplo</h5>
                <p className="text-xs md:text-sm opacity-90">Así se verán los elementos con el color primario</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <span 
                  className="px-2 py-1 md:px-3 md:py-1 rounded-full text-xs md:text-sm font-medium"
                  style={{ backgroundColor: formData.color_acento, color: '#ffffff' }}
                >
                  Etiqueta
                </span>
                <span 
                  className="px-2 py-1 md:px-3 md:py-1 rounded-full text-xs md:text-sm font-medium border-2"
                  style={{ borderColor: formData.color_primario, color: formData.color_primario }}
                >
                  Badge
                </span>
              </div>
            </div>
          </div>

          {saveSuccess && (
            <Alert className="border-emerald-500 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950">
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <AlertDescription className="text-xs md:text-sm text-emerald-900 dark:text-emerald-200">
                Colores guardados correctamente.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col sm:flex-row justify-between gap-2 md:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              className="gap-2 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs md:text-sm w-full sm:w-auto"
            >
              <RotateCcw className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Restaurar valores por defecto</span>
              <span className="sm:hidden">Restaurar</span>
            </Button>
            <Button
              type="submit"
              disabled={saveMutation.isPending}
              className="text-white text-xs md:text-sm w-full sm:w-auto"
              style={{ 
                background: `linear-gradient(135deg, ${formData.color_primario}, ${formData.color_acento})` 
              }}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar Personalización"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
