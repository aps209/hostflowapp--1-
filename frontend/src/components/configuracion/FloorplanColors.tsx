import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Palette } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useRestaurant } from "../RestaurantContext";
import { toast } from "sonner";

const defaultFloorplanColors = {
  libre: {
    color: '#10b981',
    label: 'Mesa Libre',
    description: 'Sin reservas'
  },
  reservada: {
    color: '#f59e0b',
    label: 'Mesa Reservada',
    description: 'Con reserva'
  },
  reservada_unida: {
    color: '#f97316',
    label: 'Reserva de Grupo',
    description: 'Mesas unidas'
  },
  sentada: {
    color: '#3b82f6',
    label: 'Cliente Sentado',
    description: 'Cliente en la mesa'
  },
  no_disponible: {
    color: '#ef4444',
    label: 'No Disponible Hoy',
    description: 'Bloqueada para este día'
  },
  inactiva_permanente: {
    color: '#64748b',
    label: 'Bloqueada',
    description: 'Permanentemente inactiva'
  }
};

export default function FloorplanColors() {
  const { restaurantId } = useRestaurant();
  const queryClient = useQueryClient();

  const { data: configs = [] } = useQuery({
    queryKey: ['restaurantConfig', restaurantId],
    queryFn: () => base44.entities.RestaurantConfig.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    // 🔥 NUEVO: Configuración para auto-actualización
    staleTime: 0,
    cacheTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 5000, // Actualizar cada 5 segundos
  });

  const config = configs[0];

  const [colors, setColors] = useState(() => {
    const result = {};
    Object.keys(defaultFloorplanColors).forEach(key => {
      result[key] = config?.floorplan_colors?.[key] || defaultFloorplanColors[key].color;
    });
    return result;
  });

  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (config?.floorplan_colors) {
      const updated = {};
      Object.keys(defaultFloorplanColors).forEach(key => {
        updated[key] = config.floorplan_colors[key] || defaultFloorplanColors[key].color;
      });
      setColors(updated);
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: async (colorData) => {
      if (config) {
        return base44.entities.RestaurantConfig.update(config.id, {
          floorplan_colors: colorData
        });
      } else {
        return base44.entities.RestaurantConfig.create({
          restaurant_id: restaurantId,
          floorplan_colors: colorData
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurantConfig', restaurantId] });
      setShowSuccess(true);
      toast.success('Colores guardados correctamente');
      setTimeout(() => setShowSuccess(false), 3000);
    },
  });

  const handleSave = (e) => {
    e.preventDefault();
    updateMutation.mutate(colors);
  };

  const handleReset = () => {
    const defaultColors = {};
    Object.keys(defaultFloorplanColors).forEach(key => {
      defaultColors[key] = defaultFloorplanColors[key].color;
    });
    setColors(defaultColors);
    updateMutation.mutate(defaultColors);
  };

  if (!restaurantId) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-slate-500">Cargando configuración...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <CardHeader>
        <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
          <Palette className="w-5 h-5" />
          Colores del Floorplan
        </CardTitle>
        <CardDescription className="text-slate-600 dark:text-slate-400">
          Personaliza los colores de los estados de las mesas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-6">
          {showSuccess && (
            <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-300">
                Colores guardados correctamente. Los cambios se reflejan automáticamente en el floorplan.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(defaultFloorplanColors).map(([key, { label, description }]) => (
              <div key={key} className="space-y-2">
                <Label className="text-slate-900 dark:text-white font-semibold">
                  {label}
                </Label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                  {description}
                </p>
                <div className="flex gap-2 items-center">
                  <Input
                    type="color"
                    value={colors[key]}
                    onChange={(e) => setColors({ ...colors, [key]: e.target.value })}
                    className="w-20 h-10 cursor-pointer"
                  />
                  <div
                    className="flex-1 h-10 rounded-md border-2 transition-all"
                    style={{
                      backgroundColor: colors[key],
                      borderColor: colors[key],
                    }}
                  />
                  <Input
                    type="text"
                    value={colors[key]}
                    onChange={(e) => setColors({ ...colors, [key]: e.target.value })}
                    className="w-24 font-mono text-xs"
                    placeholder="#000000"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
              💡 Vista previa en tiempo real
            </h4>
            <div className="text-xs text-blue-800 dark:text-blue-400 space-y-1">
              <p>Los colores se actualizan automáticamente cada 5 segundos en el Floorplan</p>
              <p>Los cambios que realices aquí se reflejan inmediatamente después de guardar</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {updateMutation.isPending ? 'Guardando...' : 'Guardar colores'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={updateMutation.isPending}
              className="border-slate-300 dark:border-slate-600"
            >
              Restablecer predeterminados
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}