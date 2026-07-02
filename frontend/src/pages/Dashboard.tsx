import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Calendar, Users, ChevronLeft, ChevronRight, Utensils, Moon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "@/components/ui/calendar";
import { format, isToday, addDays, subDays } from "date-fns";
import { es, enUS, fr } from "date-fns/locale";
import StatsCard from "../components/dashboard/StatsCard";
import TodayReservations from "../components/dashboard/TodayReservations";
import RecentReviews from "../components/dashboard/RecentReviews";
import QuickActions from "../components/dashboard/QuickActions";
import { useTranslation } from "../components/TranslationProvider";
import { useRestaurant } from "../components/RestaurantContext";

const localeMap = {
  'es': es,
  'en': enUS,
  'fr': fr,
};

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [floorplanViewMode, setFloorplanViewMode] = useState("all");
  const { restaurantId, loading: loadingRestaurant } = useRestaurant();

  const { data: configs = [] } = useQuery({
    queryKey: ['restaurantConfig', restaurantId],
    queryFn: () => base44.entities.RestaurantConfig.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 1 * 60 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const config = configs[0];
  const currentLang = config?.idioma || 'es';
  const { t } = useTranslation(currentLang);
  const locale = localeMap[currentLang] || es;

  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ restaurant_id: restaurantId }, '-created_date'),
    enabled: !!restaurantId,
    staleTime: 30 * 1000,
    cacheTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', restaurantId],
    queryFn: () => base44.entities.Customer.filter({ restaurant_id: restaurantId }, '-created_date'),
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags', restaurantId],
    queryFn: () => base44.entities.Tag.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', restaurantId],
    queryFn: () => base44.entities.Review.filter({ restaurant_id: restaurantId }, '-created_date'),
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  if (loadingRestaurant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-600 dark:text-slate-400">Cargando...</div>
      </div>
    );
  }

  if (!restaurantId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">No hay restaurante asignado</h2>
          <p className="text-slate-600 dark:text-slate-400">Por favor contacta con el administrador.</p>
        </div>
      </div>
    );
  }

  const formattedSelectedDate = format(selectedDate, 'yyyy-MM-dd');

  const selectedDayReservations = reservations.filter(r => {
    try {
      return r.fecha === formattedSelectedDate;
    } catch {
      return false;
    }
  });

  // Obtener horarios de comida y cena de la configuración
  const horaInicioCena = config?.hora_inicio_cena || "20:00";
  
  // Filtrar reservas según el modo seleccionado
  const getFilteredReservations = () => {
    const activeReservations = selectedDayReservations.filter(r => r.estado !== 'cancelada' && r.estado !== 'no_show');
    
    if (floorplanViewMode === "all") {
      return activeReservations;
    } else if (floorplanViewMode === "lunch") {
      return activeReservations.filter(r => r.hora < horaInicioCena);
    } else if (floorplanViewMode === "dinner") {
      return activeReservations.filter(r => r.hora >= horaInicioCena);
    }
    return activeReservations;
  };

  const filteredReservations = getFilteredReservations();
  const reservationsCount = filteredReservations.length;
  const totalCovers = filteredReservations.reduce((sum, r) => sum + (r.comensales || 0), 0);

  const formatDateForDisplay = (date) => {
    if (isToday(date)) {
      return `${t('common.today')}, ${format(date, 'd MMM', { locale })}`;
    }
    return format(date, "EEE, d MMM", { locale });
  };

  return (
    <div className="p-6 md:p-8 space-y-8 min-h-screen">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t('dashboard.title')}</h1>
        <p className="text-slate-600 dark:text-slate-400">
          {format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale })}
        </p>
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => setSelectedDate(subDays(selectedDate, 1))} 
          className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              className="w-48 justify-center border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              {formatDateForDisplay(selectedDate)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <CalendarIcon
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={locale}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => setSelectedDate(addDays(selectedDate, 1))} 
          className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button
          variant={floorplanViewMode === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFloorplanViewMode("all")}
          className={floorplanViewMode === "all" ? "bg-blue-800 hover:bg-blue-700 text-white" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"}
        >
          <Clock className="w-4 h-4 mr-2" />
          Día Completo
        </Button>
        <Button
          variant={floorplanViewMode === "lunch" ? "default" : "outline"}
          size="sm"
          onClick={() => setFloorplanViewMode("lunch")}
          className={floorplanViewMode === "lunch" ? "bg-amber-600 hover:bg-amber-700 text-white" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"}
        >
          <Utensils className="w-4 h-4 mr-2" />
          Comida
        </Button>
        <Button
          variant={floorplanViewMode === "dinner" ? "default" : "outline"}
          size="sm"
          onClick={() => setFloorplanViewMode("dinner")}
          className={floorplanViewMode === "dinner" ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"}
        >
          <Moon className="w-4 h-4 mr-2" />
          Cena
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatsCard
          title={isToday(selectedDate) ? t('dashboard.stats.todayReservations') : t('reservations.title')}
          value={reservationsCount}
          icon={Calendar}
          useAccentColor={false}
        />
        <StatsCard
          title={t('flows.total') + " " + t('common.persons')}
          value={totalCovers}
          icon={Users}
          useAccentColor={true}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TodayReservations 
            reservations={selectedDayReservations} 
            selectedDate={selectedDate}
            customers={customers}
            allTags={allTags}
            config={config}
            floorplanViewMode={floorplanViewMode}
          />
        </div>
        <div className="space-y-6">
          <QuickActions />
          <RecentReviews reviews={reviews.slice(0, 3)} />
        </div>
      </div>
    </div>
  );
}