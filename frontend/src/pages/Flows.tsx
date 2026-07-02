import React, { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIconUI } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, Users, Coffee } from "lucide-react";
import { format, addDays, subDays, isToday } from "date-fns";
import { es, enUS, fr } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { useTranslation } from "../components/TranslationProvider";
import { useRestaurant } from "../components/RestaurantContext";

const localeMap = {
  'es': es,
  'en': enUS,
  'fr': fr,
};

function ReservationBlock({ covers }) {
  return (
    <div className="w-20 h-12 bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-center font-bold text-blue-800 dark:text-blue-300 text-sm shadow-sm transition-transform hover:scale-105">
      {covers}
    </div>
  );
}

function FlowColumn({ hour, reservations, t }) {
  const totalCovers = reservations.reduce((sum, res) => sum + res.comensales, 0);

  return (
    <div className="flex flex-col items-center shrink-0">
      <div className="h-12 flex items-end pb-2">
        <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
          {String(hour).padStart(2, '0')}:00
        </div>
      </div>
      <div className="w-full h-4 border-b-2 border-slate-200 dark:border-slate-700" />
      <div className="flex flex-col items-center gap-2 pt-4 min-h-[80px]">
        {reservations.map((res) => (
          <ReservationBlock key={res.id} covers={res.comensales} />
        ))}
      </div>
      {totalCovers > 0 && (
        <>
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 my-2" />
          <div className="flex items-center justify-center w-20 h-12 bg-slate-800 dark:bg-slate-700 text-white rounded-lg font-bold text-sm shadow-lg">
            {totalCovers}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">{t('flows.total')}</div>
        </>
      )}
    </div>
  );
}

export default function Flows() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const scrollContainerRef = useRef(null);
  const { restaurantId, loading: loadingRestaurant } = useRestaurant();

  const { data: configs = [] } = useQuery({
    queryKey: ['restaurantConfig', restaurantId],
    queryFn: () => base44.entities.RestaurantConfig.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 1 * 60 * 1000, // Updated staleTime
    cacheTime: 5 * 60 * 1000, // Updated cacheTime
    refetchOnWindowFocus: true, // Updated refetchOnWindowFocus
    refetchOnMount: true, // Added refetchOnMount
  });

  const config = configs[0];
  const currentLang = config?.idioma || 'es';
  const { t } = useTranslation(currentLang);
  const locale = localeMap[currentLang] || es;

  const formattedSelectedDate = format(selectedDate, 'yyyy-MM-dd');

  const { data: reservations = [], isLoading: isLoadingReservations } = useQuery({
    queryKey: ['reservations', restaurantId, formattedSelectedDate],
    queryFn: () => base44.entities.Reservation.filter({ 
      fecha: formattedSelectedDate,
      restaurant_id: restaurantId 
    }),
    enabled: !!restaurantId,
    staleTime: 15 * 1000, // Auto-refresh cada 30 segundos
    cacheTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: 30000, // Auto-refresh cada 30 segundos
  });

  const { data: schedules = [], isLoading: isLoadingSchedules } = useQuery({
    queryKey: ['schedules', restaurantId],
    queryFn: () => base44.entities.Schedule.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: specialDays = [], isLoading: isLoadingSpecialDays } = useQuery({
    queryKey: ['specialDays', restaurantId],
    queryFn: () => base44.entities.SpecialDay.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const isLoading = isLoadingReservations || isLoadingSchedules || isLoadingSpecialDays;

  const dateForSchedule = new Date(formattedSelectedDate + 'T00:00:00');
  const specialDay = specialDays.find(d => d.date === formattedSelectedDate);
  let daySchedule = null;
  if (specialDay) {
    daySchedule = specialDay;
  } else {
    const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    const dayName = dayNames[dateForSchedule.getDay()];
    daySchedule = schedules.find(s => s.day_of_week === dayName);
  }

  const isClosed = !daySchedule || !daySchedule.is_open || !daySchedule.slots || daySchedule.slots.length === 0;

  const reservationsByHour = reservations
    .filter(r => r.estado !== 'cancelada' && r.estado !== 'no_show')
    .sort((a,b) => a.hora.localeCompare(b.hora))
    .reduce((acc, reservation) => {
      const hour = reservation.hora.split(':')[0];
      if (!acc[hour]) {
        acc[hour] = [];
      }
      acc[hour].push(reservation);
      return acc;
    }, {});

  let timelineHours = [];
  if (!isClosed && daySchedule && daySchedule.slots) {
      const allHours = daySchedule.slots.flatMap(slot => {
          const hours = [];
          const startHour = parseInt(slot.opening_time.split(':')[0]);
          const endHour = parseInt(slot.closing_time.split(':')[0]);
          const adjustedEndHour = parseInt(slot.closing_time.split(':')[1]) > 0 ? endHour : endHour - 1;
          for (let i = startHour; i <= adjustedEndHour; i++) {
              hours.push(i);
          }
          return hours;
      });
      timelineHours = [...new Set(allHours)].sort((a,b) => a-b);
  }

  const formatDateForDisplay = (date) => {
    if (isToday(date)) return `${t('common.today')}, ${format(date, 'd MMM', { locale })}`;
    return format(date, "EEE, d MMM", { locale });
  };

  if (loadingRestaurant || !restaurantId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-600 dark:text-slate-400">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 min-h-screen">
       <style>{`
        .flows-scroll-container {
          position: relative;
        }
        .flows-scroll-container-inner {
          overflow-x: auto;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .flows-scroll-container-inner::-webkit-scrollbar {
          display: none;
        }
        .flows-scroll-container:before,
        .flows-scroll-container:after {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          width: 2rem;
          pointer-events: none;
          z-index: 2;
        }
        .flows-scroll-container:before {
          left: 0;
          background: linear-gradient(to right, rgba(248,250,252,1), rgba(248,250,252,0));
        }
        .flows-scroll-container:after {
          right: 0;
          background: linear-gradient(to left, rgba(248,250,252,1), rgba(248,250,252,0));
        }
        .dark .flows-scroll-container:before {
          background: linear-gradient(to right, rgba(0,0,0,1), rgba(0,0,0,0));
        }
        .dark .flows-scroll-container:after {
          background: linear-gradient(to left, rgba(0,0,0,1), rgba(0,0,0,0));
        }
      `}</style>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t('flows.title')}</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">{t('flows.subtitle')}</p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setSelectedDate(subDays(selectedDate, 1))} className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-48 justify-center border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
              {formatDateForDisplay(selectedDate)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <CalendarIconUI mode="single" selected={selectedDate} onSelect={setSelectedDate} locale={locale} initialFocus />
          </PopoverContent>
        </Popover>
        <Button variant="outline" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-900/5 border-0 p-6">
        {isLoading ? (
          <div className="flex gap-4 overflow-x-auto p-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <Skeleton className="w-24 h-8 rounded-full" />
                <Skeleton className="w-20 h-12 rounded-lg mt-8" />
                <Skeleton className="w-20 h-12 rounded-lg" />
              </div>
            ))}
          </div>
        ) : isClosed ? (
          <div className="text-center py-20 text-slate-500 dark:text-slate-400">
              <Coffee className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <h3 className="text-lg font-semibold">{t('flows.restaurantClosed')}</h3>
              <p>{t('flows.noData')}</p>
          </div>
        ) : (
          <div className="flows-scroll-container">
            <div className="flows-scroll-container-inner py-4" ref={scrollContainerRef}>
              <motion.div
                className="flex gap-4 min-w-max px-8"
                drag="x"
                dragConstraints={scrollContainerRef}
                whileTap={{ cursor: "grabbing" }}
                style={{ cursor: "grab" }}
              >
                {timelineHours.map(hour => (
                  <FlowColumn
                    key={hour}
                    hour={hour}
                    reservations={reservationsByHour[String(hour).padStart(2, '0')] || []}
                    t={t}
                  />
                ))}
              </motion.div>
               {reservations.length === 0 && !isClosed && timelineHours.length > 0 && (
                <div className="text-center py-20 text-slate-500 dark:text-slate-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full z-10">
                  <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                  <h3 className="text-lg font-semibold">{t('flows.noReservations')}</h3>
                  <p>{t('flows.noData')}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}