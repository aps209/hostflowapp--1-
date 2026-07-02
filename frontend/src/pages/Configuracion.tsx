import React from "react";
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

export default function Configuracion() {
  const { restaurantId, loading } = useRestaurant();
  const queryClient = useQueryClient();

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

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 min-h-screen">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Configuración</h1>
        <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">Personaliza tu restaurante</p>
      </div>

      <div className="grid gap-4 md:gap-6">
        <GeneralInfo config={config} onUpdate={handleUpdateConfig} isLoading={updateMutation.isPending} />
        <DefaultTimings config={config} onUpdate={handleUpdateConfig} isLoading={updateMutation.isPending} />
        <ServiceHoursConfig config={config} onUpdate={handleUpdateConfig} isLoading={updateMutation.isPending} />
        <TableJoiningConfig config={config} onUpdate={handleUpdateConfig} />
        <IntelligentAssignmentConfig config={config} onUpdate={handleUpdateConfig} />
        <NoShowAlert config={config} onUpdate={handleUpdateConfig} isLoading={updateMutation.isPending} />
        <EmailCustomization config={config} onUpdate={handleUpdateConfig} isLoading={updateMutation.isPending} />
        <ReservationStatusManager />
        <Customization config={config} onUpdate={handleUpdateConfig} isLoading={updateMutation.isPending} />
        <FloorplanColors />
        <LanguageRegion config={config} onUpdate={handleUpdateConfig} isLoading={updateMutation.isPending} />
      </div>
    </div>
  );
}