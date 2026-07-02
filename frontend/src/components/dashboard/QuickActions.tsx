import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users, Grid3x3, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useRestaurant } from "../RestaurantContext";

export default function QuickActions() {
  const { colorPrimario, colorAccento } = useRestaurant();

  return (
    <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900">
      <CardHeader className="border-b border-slate-100 dark:border-slate-700">
        <CardTitle className="text-slate-900 dark:text-white">Acciones Rápidas</CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <Link to={createPageUrl("Reservas")} className="block">
          <Button 
            className="w-full justify-start gap-3 shadow-lg text-white hover:opacity-90"
            style={{
              background: `linear-gradient(135deg, ${colorPrimario}, ${colorAccento})`
            }}
          >
            <Plus className="w-4 h-4" />
            Nueva Reserva
          </Button>
        </Link>
        <Link to={createPageUrl("Clientes")} className="block">
          <Button variant="outline" className="w-full justify-start gap-3 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-white">
            <Users className="w-4 h-4" />
            Añadir Cliente
          </Button>
        </Link>
        <Link to={createPageUrl("MapaMesas")} className="block">
          <Button variant="outline" className="w-full justify-start gap-3 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-white">
            <Grid3x3 className="w-4 h-4" />
            Ver Mapa de Mesas
          </Button>
        </Link>
        <Link to={createPageUrl("Campanas")} className="block">
          <Button variant="outline" className="w-full justify-start gap-3 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-white">
            <MessageSquare className="w-4 h-4" />
            Nueva Campaña
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}