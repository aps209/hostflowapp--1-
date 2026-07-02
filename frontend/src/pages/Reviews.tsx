import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, RefreshCw, Star } from "lucide-react";
import { format, parseISO, subDays, isAfter } from "date-fns";
import { es, enUS, fr } from "date-fns/locale";
import { useTranslation } from "../components/TranslationProvider";
import { useRestaurant } from "../components/RestaurantContext";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const localeMap = {
  'es': es,
  'en': enUS,
  'fr': fr,
};

export default function Reviews() {
  const { restaurantId, restaurant, loading: loadingRestaurant } = useRestaurant();
  const [timeFilter, setTimeFilter] = useState("all");
  const queryClient = useQueryClient();

  const { data: configs = [] } = useQuery({
    queryKey: ['restaurantConfig', restaurantId],
    queryFn: () => base44.entities.RestaurantConfig.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const config = configs[0];
  const currentLang = config?.idioma || 'es';
  const { t } = useTranslation(currentLang);
  const locale = localeMap[currentLang] || es;
  const googleRating = Number(restaurant?.google_rating || 0);

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', restaurantId],
    queryFn: () => base44.entities.Review.filter({ restaurant_id: restaurantId }, '-created_date'),
    enabled: !!restaurantId,
    staleTime: 3 * 60 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const syncGoogleReviewsMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('syncGoogleReviews', { restaurantId });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['reviews', restaurantId] });
        toast.success(data.message || 'Resenas de Google sincronizadas');
      } else {
        toast.error(data.error || 'No se pudieron sincronizar resenas');
      }
    },
    onError: (error) => {
      toast.error(error?.message || 'No se pudieron sincronizar resenas');
    },
  });

  if (loadingRestaurant || !restaurantId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-600 dark:text-slate-400">Cargando...</div>
      </div>
    );
  }

  // Filtrar reviews por temporalidad
  const now = new Date();
  const filteredReviews = reviews.filter(review => {
    if (timeFilter === "all") return true;
    if (!review.fecha_visita) return false;
    
    const reviewDate = parseISO(review.fecha_visita);
    
    switch (timeFilter) {
      case "7days":
        return isAfter(reviewDate, subDays(now, 7));
      case "30days":
        return isAfter(reviewDate, subDays(now, 30));
      case "90days":
        return isAfter(reviewDate, subDays(now, 90));
      default:
        return true;
    }
  });

  const avgRating = filteredReviews.length > 0 
    ? filteredReviews.reduce((sum, r) => sum + r.calificacion, 0) / filteredReviews.length 
    : 0;

  const ratingDistribution = [5, 4, 3, 2, 1].map(rating => ({
    stars: rating,
    count: filteredReviews.filter(r => r.calificacion === rating).length,
    percentage: filteredReviews.length > 0 ? (filteredReviews.filter(r => r.calificacion === rating).length / filteredReviews.length) * 100 : 0,
  }));

  return (
    <div className="p-6 md:p-8 space-y-6 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t('reviews.title')}</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">{t('reviews.subtitle')}</p>
          {googleRating > 0 && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              Google: {googleRating.toFixed(1)} / 5
              {restaurant.google_user_rating_count ? ` (${restaurant.google_user_rating_count} opiniones)` : ''}
            </p>
          )}
        </div>
        {restaurant?.google_place_id && (
          <Button
            variant="outline"
            onClick={() => syncGoogleReviewsMutation.mutate()}
            disabled={syncGoogleReviewsMutation.isPending}
            className="gap-2 bg-white dark:bg-slate-900"
          >
            <RefreshCw className={`w-4 h-4 ${syncGoogleReviewsMutation.isPending ? 'animate-spin' : ''}`} />
            Sync Google
          </Button>
        )}
      </div>

      {/* Filtro de Temporalidad */}
      <div className="flex justify-center">
        <Tabs value={timeFilter} onValueChange={setTimeFilter} className="w-full md:w-auto">
          <TabsList className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-full md:w-auto grid grid-cols-4 h-10">
            <TabsTrigger 
              value="all" 
              className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm"
            >
              Todas
            </TabsTrigger>
            <TabsTrigger 
              value="7days" 
              className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm"
            >
              7 días
            </TabsTrigger>
            <TabsTrigger 
              value="30days" 
              className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm"
            >
              30 días
            </TabsTrigger>
            <TabsTrigger 
              value="90days" 
              className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm"
            >
              90 días
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900 p-8 text-center">
          <div className="text-5xl font-bold text-slate-900 dark:text-white mb-2">{avgRating.toFixed(1)}</div>
          <div className="flex justify-center mb-2">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-5 h-5 ${
                  i < Math.round(avgRating)
                    ? "text-amber-500 fill-amber-500"
                    : "text-slate-300 dark:text-slate-600"
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t('reviews.basedOn')} {filteredReviews.length} {t('reviews.opinions')}
          </p>
        </Card>

        <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900 p-6 md:col-span-2">
          <div className="space-y-3">
            {ratingDistribution.map(({ stars, count, percentage }) => (
              <div key={stars} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-20">
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{stars}</span>
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                </div>
                <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-amber-500 h-2 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-sm text-slate-600 dark:text-slate-400 w-12 text-right">{count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        {filteredReviews.map((review) => (
          <Card key={review.id} className="border-0 shadow-lg shadow-slate-900/5 bg-white dark:bg-slate-900">
            <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-lg">{review.cliente_nombre}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < review.calificacion
                              ? "text-amber-500 fill-amber-500"
                              : "text-slate-300 dark:text-slate-600"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {review.fecha_visita && format(parseISO(review.fecha_visita), "d 'de' MMMM, yyyy", { locale })}
                    </span>
                    {review.source === 'google' && (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <MapPin className="w-3 h-3" />
                        Google
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              {review.comentario && (
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{review.comentario}</p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
