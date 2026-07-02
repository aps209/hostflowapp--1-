import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Mail, Send, TrendingUp, Users, CheckCircle, Plus, BarChart3, Trash2, AlertTriangle } from "lucide-react";
import { useTranslation } from "../components/TranslationProvider";
import { useRestaurant } from "../components/RestaurantContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import AdvancedSegmentation from "../components/campanas/AdvancedSegmentation";
import CampaignMetrics from "../components/campanas/CampaignMetrics";

function NewCampaignDialog({ open, onOpenChange, customers, tags, onSuccess }) {
  const [formData, setFormData] = useState({
    nombre: "",
    tipo: "email",
    asunto: "",
    mensaje: "",
    segmento: "todos",
  });
  const [advancedFilters, setAdvancedFilters] = useState({});
  const [sending, setSending] = useState(false);

  const segmentOptions = [
    { value: "todos", label: "Todos los clientes" },
    { value: "vip", label: "Clientes VIP" },
    { value: "nuevos", label: "Clientes nuevos (< 30 días)" },
    { value: "inactivos", label: "Clientes inactivos (> 90 días)" },
    { value: "personalizado", label: "Segmentación personalizada" },
  ];

  const getFilteredCustomers = () => {
    const now = new Date();
    let filtered = [...customers];

    // Segmentación básica
    switch (formData.segmento) {
      case "vip":
        filtered = filtered.filter(c => c.tags?.includes("VIP") || c.tags?.includes("Frecuente"));
        break;
      case "nuevos":
        filtered = filtered.filter(c => {
          if (!c.ultima_visita) return false;
          const lastVisit = new Date(c.ultima_visita);
          const daysSinceVisit = (now - lastVisit) / (1000 * 60 * 60 * 24);
          return daysSinceVisit < 30;
        });
        break;
      case "inactivos":
        filtered = filtered.filter(c => {
          if (!c.ultima_visita) return true;
          const lastVisit = new Date(c.ultima_visita);
          const daysSinceVisit = (now - lastVisit) / (1000 * 60 * 60 * 24);
          return daysSinceVisit > 90;
        });
        break;
    }

    // Filtros avanzados (solo si es personalizado)
    if (formData.segmento === "personalizado") {
      if (advancedFilters.total_visitas_min) {
        filtered = filtered.filter(c => (c.total_visitas || 0) >= advancedFilters.total_visitas_min);
      }
      if (advancedFilters.total_visitas_max) {
        filtered = filtered.filter(c => (c.total_visitas || 0) <= advancedFilters.total_visitas_max);
      }
      if (advancedFilters.gasto_total_min) {
        filtered = filtered.filter(c => (c.gasto_total || 0) >= advancedFilters.gasto_total_min);
      }
      if (advancedFilters.gasto_total_max) {
        filtered = filtered.filter(c => (c.gasto_total || 0) <= advancedFilters.gasto_total_max);
      }
      if (advancedFilters.ultima_visita_dias) {
        filtered = filtered.filter(c => {
          if (!c.ultima_visita) return false;
          const lastVisit = new Date(c.ultima_visita);
          const daysSinceVisit = (now - lastVisit) / (1000 * 60 * 60 * 24);
          return daysSinceVisit <= advancedFilters.ultima_visita_dias;
        });
      }
      if (advancedFilters.tags && advancedFilters.tags.length > 0) {
        filtered = filtered.filter(c => 
          advancedFilters.tags.some(tag => c.tags?.includes(tag))
        );
      }
      if (advancedFilters.preferencias) {
        filtered = filtered.filter(c => 
          c.preferencias?.toLowerCase().includes(advancedFilters.preferencias.toLowerCase())
        );
      }
    }

    return filtered;
  };

  const filteredCustomers = getFilteredCustomers();
  const recipientsWithContact = formData.tipo === 'email' 
    ? filteredCustomers.filter(c => c.email)
    : filteredCustomers.filter(c => c.telefono);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (recipientsWithContact.length === 0) {
      toast.error(`No hay destinatarios con ${formData.tipo === 'email' ? 'email' : 'teléfono'} en este segmento`);
      return;
    }

    if (formData.tipo === 'email' && !formData.asunto) {
      toast.error('El asunto es obligatorio para emails');
      return;
    }

    setSending(true);

    try {
      await onSuccess({
        ...formData,
        filtros_avanzados: formData.segmento === 'personalizado' ? advancedFilters : null,
        destinatarios: recipientsWithContact.map(c => ({
          id: c.id,
          nombre: c.nombre,
          telefono: c.telefono,
          email: c.email,
        })),
      });

      toast.success(`Campaña enviada a ${recipientsWithContact.length} clientes`);
      onOpenChange(false);
      setFormData({ nombre: "", tipo: "email", asunto: "", mensaje: "", segmento: "todos" });
      setAdvancedFilters({});
    } catch (error) {
      toast.error("Error al enviar la campaña: " + error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-white flex items-center gap-2">
            <Send className="w-5 h-5" />
            Nueva Campaña
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-sm text-slate-700 dark:text-slate-300">
              Nombre de la Campaña *
            </Label>
            <Input
              required
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder="Ej: Promoción de Verano"
              className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-slate-700 dark:text-slate-300">
              Tipo de Campaña *
            </Label>
            <Select
              value={formData.tipo}
              onValueChange={(value) => setFormData({ ...formData, tipo: value })}
            >
              <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-800">
                <SelectItem value="email">📧 Email</SelectItem>
                <SelectItem value="sms">📱 SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.tipo === 'email' && (
            <div className="space-y-2">
              <Label className="text-sm text-slate-700 dark:text-slate-300">
                Asunto del Email *
              </Label>
              <Input
                required
                value={formData.asunto}
                onChange={(e) => setFormData({ ...formData, asunto: e.target.value })}
                placeholder="Ej: ¡Oferta especial para ti!"
                className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm text-slate-700 dark:text-slate-300">
              Segmento de Clientes *
            </Label>
            <Select
              value={formData.segmento}
              onValueChange={(value) => setFormData({ ...formData, segmento: value })}
            >
              <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-800">
                {segmentOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {recipientsWithContact.length} destinatarios con {formData.tipo === 'email' ? 'email' : 'teléfono'}
            </p>
          </div>

          {formData.segmento === 'personalizado' && (
            <Card className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <CardHeader>
                <CardTitle className="text-base text-slate-900 dark:text-white">
                  Filtros Avanzados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AdvancedSegmentation
                  filters={advancedFilters}
                  onChange={setAdvancedFilters}
                  tags={tags}
                />
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            <Label className="text-sm text-slate-700 dark:text-slate-300">
              Mensaje *
            </Label>
            <Textarea
              required
              value={formData.mensaje}
              onChange={(e) => setFormData({ ...formData, mensaje: e.target.value })}
              placeholder={formData.tipo === 'email' 
                ? "Escribe tu mensaje en HTML o texto plano. Puedes incluir enlaces." 
                : "Escribe tu mensaje (máx. 160 caracteres)"
              }
              rows={8}
              maxLength={formData.tipo === 'sms' ? 160 : 2000}
              className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 resize-none font-mono text-sm"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 text-right">
              {formData.mensaje.length}/{formData.tipo === 'sms' ? 160 : 2000} caracteres
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
              Vista previa:
            </p>
            <div className="text-sm text-blue-800 dark:text-blue-400 whitespace-pre-wrap break-words">
              {formData.mensaje || "Tu mensaje aparecerá aquí..."}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sending}
              className="text-slate-900 dark:bg-slate-800 dark:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={sending || recipientsWithContact.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {sending ? (
                <>
                  <Send className="w-4 h-4 mr-2 animate-pulse" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar a {recipientsWithContact.length} clientes
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CampaignHistory({ campaigns }) {
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  const statusColors = {
    enviada: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400",
    programada: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
    borrador: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-400",
    cancelada: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400",
  };

  const statusLabels = {
    enviada: "Enviada",
    programada: "Programada",
    borrador: "Borrador",
    cancelada: "Cancelada",
  };

  const typeIcons = {
    email: <Mail className="w-4 h-4" />,
    sms: <MessageSquare className="w-4 h-4" />,
    whatsapp: <MessageSquare className="w-4 h-4" />,
  };

  return (
    <>
      <div className="space-y-4">
        {campaigns.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
            <p>No hay campañas registradas aún</p>
          </div>
        ) : (
          campaigns.map(campaign => (
            <Card 
              key={campaign.id} 
              className="border-0 shadow-lg shadow-slate-900/5 bg-white dark:bg-slate-900 hover:shadow-xl transition-shadow cursor-pointer"
              onClick={() => setSelectedCampaign(campaign)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        {typeIcons[campaign.tipo]}
                        <h3 className="font-semibold text-slate-900 dark:text-white text-lg">
                          {campaign.nombre}
                        </h3>
                      </div>
                      <Badge className={`${statusColors[campaign.estado]} border font-medium`}>
                        {statusLabels[campaign.estado]}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Segmento: <strong>{campaign.segmento}</strong> • Tipo: <strong>{campaign.tipo.toUpperCase()}</strong>
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-blue-600 dark:text-blue-400">
                    <BarChart3 className="w-4 h-4 mr-1" />
                    Ver métricas
                  </Button>
                </div>

                <div className={`grid gap-4 pt-4 border-t border-slate-200 dark:border-slate-700 ${campaign.tipo === 'sms' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-5'}`}>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Destinatarios</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {campaign.destinatarios_totales}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Entregados</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                      {campaign.entregados || 0}
                    </p>
                  </div>
                  {campaign.tipo === 'email' && (
                    <>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Apertura</p>
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {campaign.tasa_apertura ? `${campaign.tasa_apertura.toFixed(1)}%` : '0%'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Clicks</p>
                        <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                          {campaign.clicks || 0}
                        </p>
                      </div>
                    </>
                  )}
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Conversiones</p>
                    <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                      {campaign.conversiones || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={!!selectedCampaign} onOpenChange={() => setSelectedCampaign(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Métricas de Campaña: {selectedCampaign?.nombre}
            </DialogTitle>
          </DialogHeader>
          
          {selectedCampaign && (
            <div className="space-y-6">
              <CampaignMetrics campaign={selectedCampaign} />
              
              <Card className="border border-slate-200 dark:border-slate-700">
                <CardHeader>
                  <CardTitle className="text-base text-slate-900 dark:text-white">
                    Mensaje Enviado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedCampaign.asunto && (
                    <div className="mb-3">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Asunto:</p>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {selectedCampaign.asunto}
                      </p>
                    </div>
                  )}
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                      {selectedCampaign.mensaje}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    Enviado: {selectedCampaign.created_date && format(new Date(selectedCampaign.created_date), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Campanas() {
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const { restaurantId } = useRestaurant();
  const queryClient = useQueryClient();

  const { data: configs = [] } = useQuery({
    queryKey: ['restaurantConfig', restaurantId],
    queryFn: () => base44.entities.RestaurantConfig.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 60000,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', restaurantId],
    queryFn: () => base44.entities.Customer.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: tags = [] } = useQuery({
    queryKey: ['tags', restaurantId],
    queryFn: () => base44.entities.Tag.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns', restaurantId],
    queryFn: () => base44.entities.Campaign.filter({ restaurant_id: restaurantId }, '-created_date'),
    enabled: !!restaurantId,
  });

  const config = configs[0];
  const currentLang = config?.idioma || 'es';
  const { t } = useTranslation(currentLang);

  const createCampaignMutation = useMutation({
    mutationFn: async (campaignData) => {
      const campaign = await base44.entities.Campaign.create({
        restaurant_id: restaurantId,
        nombre: campaignData.nombre,
        tipo: campaignData.tipo,
        asunto: campaignData.asunto,
        mensaje: campaignData.mensaje,
        segmento: campaignData.segmento,
        filtros_avanzados: campaignData.filtros_avanzados,
        estado: "enviada",
        destinatarios_totales: campaignData.destinatarios.length,
        enviados: 0,
      });

      let functionName = '';
      if (campaignData.tipo === 'email') {
        functionName = 'enviarCampanaEmail';
      } else if (campaignData.tipo === 'sms') {
        functionName = 'enviarCampanaSMS';
      } else {
        throw new Error('Tipo de campaña no soportado');
      }

      const payload = {
        campaign_id: campaign.id,
        destinatarios: campaignData.destinatarios,
        mensaje: campaignData.mensaje,
      };

      if (campaignData.tipo === 'email') {
        payload.asunto = campaignData.asunto;
      }

      const response = await base44.functions.invoke(functionName, payload);

      await base44.entities.Campaign.update(campaign.id, {
        enviados: response.data.enviados || campaignData.destinatarios.length,
        entregados: response.data.enviados || 0,
      });

      return campaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', restaurantId] });
    },
  });

  const handleCreateCampaign = async (campaignData) => {
    await createCampaignMutation.mutateAsync(campaignData);
  };

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const deletePromises = campaigns.map(campaign => 
        base44.entities.Campaign.delete(campaign.id)
      );
      await Promise.all(deletePromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', restaurantId] });
      toast.success('Historial de campañas eliminado correctamente');
      setShowDeleteAllDialog(false);
    },
  });

  const totalCampaigns = campaigns.length;
  const totalEnviados = campaigns.reduce((sum, c) => sum + (c.enviados || 0), 0);
  const totalConversiones = campaigns.reduce((sum, c) => sum + (c.conversiones || 0), 0);
  const tasaAperturaPromedio = campaigns.length > 0 
    ? campaigns.reduce((sum, c) => sum + (c.tasa_apertura || 0), 0) / campaigns.length 
    : 0;

  return (
    <div className="p-6 md:p-8 space-y-6 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t('campaigns.title')}</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">{t('campaigns.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {campaigns.length > 0 && (
            <Button
              onClick={() => setShowDeleteAllDialog(true)}
              variant="outline"
              className="border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar Historial
            </Button>
          )}
          <Button 
            onClick={() => setShowCampaignDialog(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva Campaña
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Campañas</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalCampaigns}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Mensajes Enviados</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalEnviados}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Tasa Apertura Media</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {tasaAperturaPromedio.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Conversiones Totales</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalConversiones}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900">
        <CardHeader className="border-b border-slate-100 dark:border-slate-700">
          <CardTitle className="text-slate-900 dark:text-white">Historial de Campañas</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <CampaignHistory campaigns={campaigns} />
        </CardContent>
      </Card>

      <NewCampaignDialog
        open={showCampaignDialog}
        onOpenChange={setShowCampaignDialog}
        customers={customers}
        tags={tags}
        onSuccess={handleCreateCampaign}
      />

      <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <AlertDialogContent className="bg-white dark:bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              ¿Eliminar todo el historial de campañas?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              Esta acción eliminará permanentemente todas las {campaigns.length} campañas del historial.
              <br /><br />
              <strong className="text-red-600">Esta acción no se puede deshacer.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-slate-800 dark:text-white">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteAllMutation.mutate()}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteAllMutation.isPending}
            >
              {deleteAllMutation.isPending ? 'Eliminando...' : 'Eliminar Todo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}