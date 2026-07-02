
import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Loader2, CheckCircle, Calendar, Clock, Coins } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { es, enUS, fr } from "date-fns/locale";
import { useRestaurant } from "../RestaurantContext"; // Added import

const idiomas = [
  { value: "es", label: "Español", locale: es },
  { value: "en", label: "English", locale: enUS },
  { value: "fr", label: "Français", locale: fr },
];

const formatosFecha = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (Europeo)", example: "31/12/2024" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (Americano)", example: "12/31/2024" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (ISO)", example: "2024-12-31" },
];

const formatosHora = [
  { value: "24h", label: "24 horas", example: "14:30" },
  { value: "12h", label: "12 horas AM/PM", example: "2:30 PM" },
];

const monedas = [
  { value: "EUR", label: "Euro", simbolo: "€" },
  { value: "USD", label: "Dólar Estadounidense", simbolo: "$" },
  { value: "GBP", label: "Libra Esterlina", simbolo: "£" },
  { value: "MXN", label: "Peso Mexicano", simbolo: "$" },
  { value: "ARS", label: "Peso Argentino", simbolo: "$" },
  { value: "COP", label: "Peso Colombiano", simbolo: "$" },
  { value: "CLP", label: "Peso Chileno", simbolo: "$" },
];

export default function LanguageRegion() {
  const [formData, setFormData] = useState({
    idioma: "es",
    formato_fecha: "DD/MM/YYYY",
    formato_hora: "24h",
    moneda: "EUR",
    simbolo_moneda: "€",
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  const queryClient = useQueryClient();
  const { restaurantId } = useRestaurant(); // Get restaurantId from context

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['restaurantConfig', restaurantId], // Added restaurantId to queryKey
    queryFn: () => base44.entities.RestaurantConfig.filter({ restaurant_id: restaurantId }), // Filter by restaurantId
    enabled: !!restaurantId, // Enable query only if restaurantId is available
    staleTime: 60000,
  });

  const config = configs[0];

  useEffect(() => {
    if (config) {
      setFormData({
        idioma: config.idioma || "es",
        formato_fecha: config.formato_fecha || "DD/MM/YYYY",
        formato_hora: config.formato_hora || "24h",
        moneda: config.moneda || "EUR",
        simbolo_moneda: config.simbolo_moneda || "€",
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const dataWithRestaurant = { ...data, restaurant_id: restaurantId }; // Add restaurant_id to data
      
      if (config) {
        return base44.entities.RestaurantConfig.update(config.id, dataWithRestaurant);
      } else {
        return base44.entities.RestaurantConfig.create(dataWithRestaurant);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurantConfig', restaurantId] }); // Invalidate specific query
      queryClient.invalidateQueries({ queryKey: ['restaurantConfig'] }); // Invalidate generic query (if any listens to it)
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const handleMonedaChange = (monedaValue) => {
    const monedaObj = monedas.find(m => m.value === monedaValue);
    setFormData({
      ...formData,
      moneda: monedaValue,
      simbolo_moneda: monedaObj?.simbolo || "€",
    });
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white/80 backdrop-blur-sm dark:bg-slate-900">
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  // Generar vista previa
  const now = new Date();
  const idiomaLocale = idiomas.find(i => i.value === formData.idioma)?.locale || es;

  let previewFecha = "";
  if (formData.formato_fecha === "DD/MM/YYYY") {
    previewFecha = format(now, "dd/MM/yyyy", { locale: idiomaLocale });
  } else if (formData.formato_fecha === "MM/DD/YYYY") {
    previewFecha = format(now, "MM/dd/yyyy", { locale: idiomaLocale });
  } else {
    previewFecha = format(now, "yyyy-MM-dd", { locale: idiomaLocale });
  }

  let previewHora = "";
  if (formData.formato_hora === "24h") {
    previewHora = format(now, "HH:mm");
  } else {
    previewHora = format(now, "h:mm a");
  }

  const previewPrecio = `${formData.simbolo_moneda}45.50`;

  return (
    <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900">
      <CardHeader className="border-b border-slate-100 dark:border-slate-700">
        <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
          <Globe className="w-5 h-5 text-blue-900 dark:text-blue-400" />
          Idioma y Región
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-2">
              <Label htmlFor="idioma" className="text-slate-900 dark:text-white">Idioma de la Interfaz</Label>
              <Select value={formData.idioma} onValueChange={(value) => setFormData({ ...formData, idioma: value })}>
                <SelectTrigger id="idioma" className="dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {idiomas.map(idioma => (
                    <SelectItem key={idioma.value} value={idioma.value}>
                      {idioma.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Idioma principal de la aplicación
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="formato_fecha" className="text-slate-900 dark:text-white">Formato de Fecha</Label>
              <Select value={formData.formato_fecha} onValueChange={(value) => setFormData({ ...formData, formato_fecha: value })}>
                <SelectTrigger id="formato_fecha" className="dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formatosFecha.map(formato => (
                    <SelectItem key={formato.value} value={formato.value}>
                      {formato.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ejemplo: {formatosFecha.find(f => f.value === formData.formato_fecha)?.example}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="formato_hora" className="text-slate-900 dark:text-white">Formato de Hora</Label>
              <Select value={formData.formato_hora} onValueChange={(value) => setFormData({ ...formData, formato_hora: value })}>
                <SelectTrigger id="formato_hora" className="dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formatosHora.map(formato => (
                    <SelectItem key={formato.value} value={formato.value}>
                      {formato.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ejemplo: {formatosHora.find(f => f.value === formData.formato_hora)?.example}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="moneda" className="text-slate-900 dark:text-white">Moneda</Label>
              <Select value={formData.moneda} onValueChange={handleMonedaChange}>
                <SelectTrigger id="moneda" className="dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monedas.map(moneda => (
                    <SelectItem key={moneda.value} value={moneda.value}>
                      {moneda.label} ({moneda.simbolo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Moneda para mostrar precios
              </p>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <h4 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-blue-900 dark:text-blue-400" />
              Vista Previa
            </h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-blue-900 dark:text-blue-400" />
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Fecha actual:</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{previewFecha}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-blue-900 dark:text-blue-400" />
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Hora actual:</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{previewHora}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Coins className="w-5 h-5 text-blue-900 dark:text-blue-400" />
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Ejemplo de precio:</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{previewPrecio}</p>
                </div>
              </div>
            </div>
          </div>

          {saveSuccess && (
            <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 dark:border-emerald-800">
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <AlertDescription className="text-emerald-900 dark:text-emerald-200">
                Configuración de idioma y región guardada correctamente
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
