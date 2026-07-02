import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Eye, MousePointer, ShoppingCart, DollarSign, Users } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function CampaignMetrics({ campaign }) {
  const metrics = [
    {
      label: "Entregados",
      value: campaign.entregados || 0,
      total: campaign.enviados || 0,
      icon: Users,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/30"
    },
    {
      label: "Tasa de Apertura",
      value: `${campaign.tasa_apertura?.toFixed(1) || 0}%`,
      subtitle: `${campaign.abiertos || 0} abiertos`,
      icon: Eye,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-100 dark:bg-green-900/30"
    },
    {
      label: "Tasa de Clicks",
      value: `${campaign.tasa_clicks?.toFixed(1) || 0}%`,
      subtitle: `${campaign.clicks || 0} clicks`,
      icon: MousePointer,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-100 dark:bg-purple-900/30"
    },
    {
      label: "Conversiones",
      value: campaign.conversiones || 0,
      subtitle: `${campaign.tasa_conversion?.toFixed(1) || 0}% tasa`,
      icon: ShoppingCart,
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-100 dark:bg-orange-900/30"
    },
    {
      label: "Ingresos Generados",
      value: `€${campaign.ingresos_generados?.toFixed(2) || 0}`,
      icon: DollarSign,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-100 dark:bg-emerald-900/30"
    }
  ];

  const deliveryRate = campaign.enviados > 0 
    ? ((campaign.entregados || 0) / campaign.enviados) * 100 
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {metrics.map((metric, index) => (
          <Card key={index} className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className={`w-10 h-10 ${metric.bgColor} rounded-lg flex items-center justify-center`}>
                  <metric.icon className={`w-5 h-5 ${metric.color}`} />
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                {metric.label}
              </p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {metric.value}
              </p>
              {metric.subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                  {metric.subtitle}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Tasa de Entrega {campaign.tipo === 'sms' ? '(SMS)' : '(Email)'}
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {deliveryRate.toFixed(1)}%
              </span>
            </div>
            <Progress value={deliveryRate} className="h-2" />
            <p className="text-xs text-slate-500 dark:text-slate-500">
              {campaign.entregados || 0} de {campaign.enviados || 0} mensajes entregados
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}