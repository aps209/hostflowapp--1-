import React, { useState } from "react";
import GeneralInfo from "../components/configuracion/GeneralInfo";
import DefaultTimings from "../components/configuracion/DefaultTimings";
import Customization from "../components/configuracion/Customization";
import LanguageRegion from "../components/configuracion/LanguageRegion";
import { useRestaurant } from "../components/RestaurantContext";
import TableJoiningConfig from "../components/configuracion/TableJoiningConfig";
import IntelligentAssignmentConfig from "../components/configuracion/IntelligentAssignmentConfig";
import FloorplanColors from "../components/configuracion/FloorplanColors";
import EmailCustomization from "../components/configuracion/EmailCustomization";
import NoShowAlert from "../components/configuracion/NoShowAlert";
import ReservationStatusManager from "../components/configuracion/ReservationStatusManager";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import ServiceHoursConfig from "../components/configuracion/ServiceHoursConfig";
import MenuScanner from "../components/configuracion/MenuScanner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Bell, Building2, CalendarClock, Grid3x3, Palette } from "lucide-react";

const TABS = [
  { key: "general", label: "General", icon: Building2 },
  { key: "reservas", label: "Reservas", icon: CalendarClock },
  { key: "sala", label: "Sala y mesas", icon: Grid3x3 },
  { key: "automatizacion", label: "Automatización", icon: Bell },
  { key: "apariencia", label: "Apariencia", icon: Palette },
];

export default function Configuracion() {
  const { restaurantId, loading } = useRestaurant();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("general");

  const { data: configs = [] } = useQuery({
    queryKey: ['restaurantConfig', restaurantId],
    queryFn: () => base44.entities.RestaurantConfig.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 0,
    cacheTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const config = configs[0];

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.RestaurantConfig.update(config.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurantConfig', restaurantId] });
      toast.success('Configuración actualizada');
    },
  });

  const handleUpdateConfig = (updates) => {
    updateMutation.mutate(updates);
  };

  if (loading || !restaurantId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-600 dark:text-slate-400">Cargando...</div>
      </div>
    );
  }

  const isLoading = updateMutation.isPending;

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Configuración</h1>
        <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">Personaliza tu restaurante</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Mini-barra superior fija: solo aparece dentro de Configuración */}
        <div className="sticky top-0 z-20 -mx-4 md:-mx-6 lg:-mx-8 mb-4 border-b border-slate-200 bg-slate-50/90 px-4 md:px-6 lg:px-8 py-2 backdrop-blur dark:border-slate-800 dark:bg-black/80">
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-transparent p-0">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="gap-2 rounded-md px-3 py-2 text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white"
              >
                <tab.icon className="h-4 w-4" />
                <span className="whitespace-nowrap">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="general" className="mt-0 grid gap-4 md:gap-6">
          <GeneralInfo config={config} onUpdate={handleUpdateConfig} isLoading={isLoading} />
          <LanguageRegion config={config} onUpdate={handleUpdateConfig} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="reservas" className="mt-0 grid gap-4 md:gap-6">
          <DefaultTimings config={config} onUpdate={handleUpdateConfig} isLoading={isLoading} />
          <ServiceHoursConfig config={config} onUpdate={handleUpdateConfig} isLoading={isLoading} />
          <ReservationStatusManager />
        </TabsContent>

        <TabsContent value="sala" className="mt-0 grid gap-4 md:gap-6">
          <TableJoiningConfig config={config} onUpdate={handleUpdateConfig} />
          <IntelligentAssignmentConfig config={config} onUpdate={handleUpdateConfig} />
          <FloorplanColors />
        </TabsContent>

        <TabsContent value="automatizacion" className="mt-0 grid gap-4 md:gap-6">
          <MenuScanner />
          <NoShowAlert config={config} onUpdate={handleUpdateConfig} isLoading={isLoading} />
          <EmailCustomization config={config} onUpdate={handleUpdateConfig} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="apariencia" className="mt-0 grid gap-4 md:gap-6">
          <Customization config={config} onUpdate={handleUpdateConfig} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
