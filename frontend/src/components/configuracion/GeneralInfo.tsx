
import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Settings, Upload, Loader2, CheckCircle, Plus, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRestaurant } from "../RestaurantContext";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export default function GeneralInfo() {
  const [formData, setFormData] = useState({
    nombre_restaurante: "",
    logo_url: "",
    capacidad_total: 0,
    max_comensales_reserva: 20,
    politica_cancelacion: "",
    mensaje_confirmacion: "",
    require_table_zone_selection: false,
    available_zones: ["Terraza", "Interior", "Barra", "Ventana"],
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [newZone, setNewZone] = useState("");

  const queryClient = useQueryClient();
  const { restaurantId } = useRestaurant();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['restaurantConfig', restaurantId],
    queryFn: () => base44.entities.RestaurantConfig.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 60000,
  });

  const config = configs[0];

  useEffect(() => {
    if (config) {
      setFormData({
        nombre_restaurante: config.nombre_restaurante || "",
        logo_url: config.logo_url || "",
        capacidad_total: config.capacidad_total || 0,
        max_comensales_reserva: config.max_comensales_reserva || 20,
        politica_cancelacion: config.politica_cancelacion || "",
        mensaje_confirmacion: config.mensaje_confirmacion || "",
        require_table_zone_selection: config.require_table_zone_selection || false,
        available_zones: config.available_zones || ["Terraza", "Interior", "Barra", "Ventana"],
      });
    } else if (!isLoading && restaurantId && configs.length === 0) {
      setFormData({
        nombre_restaurante: "",
        logo_url: "",
        capacidad_total: 0,
        max_comensales_reserva: 20,
        politica_cancelacion: "",
        mensaje_confirmacion: "",
        require_table_zone_selection: false,
        available_zones: ["Terraza", "Interior", "Barra", "Ventana"],
      });
    }
  }, [config, isLoading, restaurantId, configs.length]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const dataWithRestaurant = { ...data, restaurant_id: restaurantId };
      
      if (config) {
        return base44.entities.RestaurantConfig.update(config.id, dataWithRestaurant);
      } else {
        return base44.entities.RestaurantConfig.create(dataWithRestaurant);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurantConfig', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['restaurantConfig'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, logo_url: result.file_url });
    } catch (error) {
      console.error("Error uploading logo:", error);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleAddZone = () => {
    if (newZone.trim() && !formData.available_zones.includes(newZone.trim())) {
      setFormData({
        ...formData,
        available_zones: [...formData.available_zones, newZone.trim()]
      });
      setNewZone("");
    }
  };

  const handleRemoveZone = (zone) => {
    setFormData({
      ...formData,
      available_zones: formData.available_zones.filter(z => z !== zone)
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  if (isLoading || !restaurantId) {
    return (
      <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white/80 backdrop-blur-sm">
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          <p className="text-slate-500 mt-2">{!restaurantId ? "Cargando restaurante..." : "Cargando configuración..."}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900">
      <CardHeader className="border-b border-slate-100 dark:border-slate-700 p-4 md:p-6">
        <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white text-lg md:text-xl">
          <Settings className="w-4 h-4 md:w-5 md:h-5 text-blue-900 dark:text-blue-400" />
          Información General
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-2">
              <Label htmlFor="nombre" className="text-slate-900 dark:text-white text-sm md:text-base">Nombre del Restaurante</Label>
              <Input
                id="nombre"
                value={formData.nombre_restaurante}
                onChange={(e) => setFormData({ ...formData, nombre_restaurante: e.target.value })}
                placeholder="Ej: La Bella Vista"
                className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacidad" className="text-slate-900 dark:text-white text-sm md:text-base">Capacidad Total</Label>
              <Input
                id="capacidad"
                type="number"
                min="0"
                value={formData.capacidad_total}
                onChange={(e) => setFormData({ ...formData, capacidad_total: parseInt(e.target.value) || 0 })}
                placeholder="100"
                className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">Número máximo de comensales simultáneos</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_comensales" className="text-slate-900 dark:text-white text-sm md:text-base">Máximo de Comensales por Reserva</Label>
              <Input
                id="max_comensales"
                type="number"
                min="1"
                max="100"
                value={formData.max_comensales_reserva}
                onChange={(e) => setFormData({ ...formData, max_comensales_reserva: parseInt(e.target.value) || 20 })}
                placeholder="20"
                className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">Límite de personas por reserva individual</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo" className="text-slate-900 dark:text-white">Logo del Restaurante</Label>
            <div className="flex items-center gap-4">
              {formData.logo_url && (
                <img
                  src={formData.logo_url}
                  alt="Logo"
                  className="w-20 h-20 object-contain rounded-lg border border-slate-200 dark:border-slate-700"
                />
              )}
              <div className="flex-1">
                <label htmlFor="logo-upload" className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    {uploadingLogo ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-900 dark:text-white" />
                    ) : (
                      <Upload className="w-4 h-4 text-slate-900 dark:text-white" />
                    )}
                    <span className="text-sm text-slate-900 dark:text-white">
                      {uploadingLogo ? "Subiendo..." : "Subir Logo"}
                    </span>
                  </div>
                </label>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  disabled={uploadingLogo}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="politica" className="text-slate-900 dark:text-white">Política de Cancelación</Label>
            <Textarea
              id="politica"
              value={formData.politica_cancelacion}
              onChange={(e) => setFormData({ ...formData, politica_cancelacion: e.target.value })}
              placeholder="Ej: Las cancelaciones deben realizarse con 24 horas de antelación..."
              rows={3}
              className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mensaje" className="text-slate-900 dark:text-white">Mensaje de Confirmación</Label>
            <Textarea
              id="mensaje"
              value={formData.mensaje_confirmacion}
              onChange={(e) => setFormData({ ...formData, mensaje_confirmacion: e.target.value })}
              placeholder="Ej: Gracias por reservar en nuestro restaurante. Te esperamos el [FECHA] a las [HORA]..."
              rows={4}
              className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Usa [FECHA], [HORA], [NOMBRE] como marcadores que se reemplazarán automáticamente
            </p>
          </div>

          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="require-zone" className="text-base font-medium text-slate-900 dark:text-white cursor-pointer">
                  Solicitar zona/área en formulario público
                </Label>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Los clientes deberán elegir la zona donde prefieren sentarse al hacer su reserva online
                </p>
              </div>
              <Switch
                id="require-zone"
                checked={formData.require_table_zone_selection}
                onCheckedChange={(checked) => setFormData({ ...formData, require_table_zone_selection: checked })}
              />
            </div>

            {formData.require_table_zone_selection && (
              <div className="space-y-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                <div>
                  <Label className="text-sm font-medium text-slate-900 dark:text-white">
                    Zonas disponibles para selección
                  </Label>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Configura las zonas que tus clientes podrán elegir.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {formData.available_zones.map((zone, index) => (
                    <Badge 
                      key={index} 
                      className="bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-700 flex items-center gap-1 pr-1"
                    >
                      {zone}
                      <button
                        type="button"
                        onClick={() => handleRemoveZone(zone)}
                        className="ml-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Nueva zona (ej: Terraza, Barra...)"
                    value={newZone}
                    onChange={(e) => setNewZone(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddZone();
                      }
                    }}
                    className="flex-1 bg-white dark:bg-slate-800"
                  />
                  <Button
                    type="button"
                    onClick={handleAddZone}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <Alert className="border-blue-300 bg-blue-100 dark:bg-blue-950/50 dark:border-blue-700">
                  <AlertDescription className="text-blue-900 dark:text-blue-200 text-xs">
                    <p className="font-semibold mb-2">💡 Cómo funciona:</p>
                    <ol className="space-y-2 ml-4 list-decimal">
                      <li>
                        <strong>Configura aquí las zonas</strong> que los clientes podrán elegir 
                        (ej: "Terraza", "Interior", "Barra", "Ventana")
                      </li>
                      <li>
                        <strong>Ve a "Floorplan"</strong> y edita cada mesa para asignarle su zona 
                        en el campo <strong>"Zona / Sala"</strong>
                      </li>
                      <li>
                        El sistema <strong>priorizará asignar mesas</strong> que tengan el mismo valor 
                        en "Zona / Sala" que la zona seleccionada por el cliente
                      </li>
                      <li>
                        Si no hay disponibilidad en la zona solicitada, se asignará automáticamente 
                        la mejor alternativa disponible
                      </li>
                    </ol>
                    <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/30 rounded border border-amber-200 dark:border-amber-800">
                      <p className="text-amber-900 dark:text-amber-200 text-xs">
                        <strong>⚠️ Importante:</strong> Los nombres de zona configurados aquí deben 
                        coincidir <strong>exactamente</strong> con los valores del campo "Zona / Sala" 
                        de tus mesas. Si una mesa tiene "terraza" (minúscula) y aquí configuras "Terraza" 
                        (mayúscula), el sistema las considerará diferentes.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>

          {saveSuccess && (
            <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 dark:border-emerald-800">
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <AlertDescription className="text-emerald-900 dark:text-emerald-200">
                Configuración guardada correctamente
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={saveMutation.isPending}
              className="bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 w-full sm:w-auto text-xs md:text-sm"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-2 animate-spin" />
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
