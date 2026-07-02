import React from 'react'
import WeeklySchedule from '../components/horarios/WeeklySchedule';
import SpecialDays from '../components/horarios/SpecialDays';
import VacationClosure from '../components/horarios/VacationClosure';
import { useRestaurant } from "../components/RestaurantContext";

export default function Horarios() {
  const { restaurantId, loading } = useRestaurant();

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
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Gestión de Horarios</h1>
        <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">
          Define cuándo tu restaurante está abierto al público. Los cambios se guardan automáticamente.
        </p>
      </div>

      <div className="grid lg:grid-cols-1 gap-4 md:gap-6">
        <WeeklySchedule restaurantId={restaurantId} />
        <VacationClosure restaurantId={restaurantId} />
        <SpecialDays restaurantId={restaurantId} />
      </div>
    </div>
  )
}