
import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Building2, RefreshCw, MapPin, Edit, Trash2, X, Settings } from "lucide-react";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

export default function Admin() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRestaurantForm, setShowRestaurantForm] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState(null);
  const [restaurantToDelete, setRestaurantToDelete] = useState(null);
  const [restaurantData, setRestaurantData] = useState({
    nombre: "",
    slug: "",
    direccion: "",
    telefono: "",
    email: "",
    google_place_id: "",
  });

  const queryClient = useQueryClient();

  // Verificar autenticación y rol de admin
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        // Si no es admin, redirigir al dashboard
        if (currentUser.role !== 'admin') {
          window.location.href = createPageUrl('Dashboard');
        }
      } catch (error) {
        // Si no está autenticado, redirigir al login
        base44.auth.redirectToLogin();
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const { data: restaurants = [], isLoading: loadingRestaurants } = useQuery({
    queryKey: ['allRestaurants'],
    queryFn: () => base44.entities.Restaurant.list('-created_date'),
    enabled: user?.role === 'admin',
  });

  const createRestaurantMutation = useMutation({
    mutationFn: (data) => {
      let finalSlug = data.slug;
      if (!finalSlug && data.nombre) {
        finalSlug = data.nombre
          .toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
      }
      
      return base44.entities.Restaurant.create({
        ...data,
        slug: finalSlug,
        fecha_registro: new Date().toISOString().split('T')[0],
        activo: true,
        plan: 'profesional'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allRestaurants'] });
      setShowRestaurantForm(false);
      setEditingRestaurant(null);
      setRestaurantData({ nombre: "", slug: "", direccion: "", telefono: "", email: "", google_place_id: "" });
      toast.success('Restaurante creado correctamente');
    },
  });

  const updateRestaurantMutation = useMutation({
    mutationFn: ({ id, data }) => {
      let finalSlug = data.slug;
      if (!finalSlug && data.nombre) {
        finalSlug = data.nombre
          .toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
      }
      return base44.entities.Restaurant.update(id, { ...data, slug: finalSlug });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allRestaurants'] });
      setShowRestaurantForm(false);
      setEditingRestaurant(null);
      setRestaurantData({ nombre: "", slug: "", direccion: "", telefono: "", email: "", google_place_id: "" });
      toast.success('Restaurante actualizado correctamente');
    },
  });

  const deleteRestaurantMutation = useMutation({
    mutationFn: (id) => base44.entities.Restaurant.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allRestaurants'] });
      setRestaurantToDelete(null);
      toast.success('Restaurante eliminado correctamente');
    },
  });

  const migrateDataMutation = useMutation({
    mutationFn: async (restaurantId) => {
      const entities = [
        'Customer', 'Table', 'Reservation', 'Review', 
        'Campaign', 'Tag', 'Schedule', 'SpecialDay', 'RestaurantConfig'
      ];

      for (const entityName of entities) {
        try {
          const records = await base44.entities[entityName].list();
          const recordsWithoutRestaurant = records.filter(r => !r.restaurant_id);
          
          for (const record of recordsWithoutRestaurant) {
            await base44.entities[entityName].update(record.id, {
              restaurant_id: restaurantId
            });
          }
        } catch (error) {
          console.error(`Error migrando ${entityName}:`, error);
        }
      }
    },
    onSuccess: () => {
      toast.success('Datos migrados correctamente. Recarga la página.');
    },
  });

  const syncGoogleReviewsMutation = useMutation({
    mutationFn: async (restaurantId) => {
      const response = await base44.functions.invoke('syncGoogleReviews', { restaurantId });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      if (data.success) {
        toast.success(data.message || `${data.reviewsImported} reseñas sincronizadas`);
      } else {
        toast.error(data.error || 'Error al sincronizar reseñas');
      }
    },
    onError: (error) => {
      toast.error('Error: ' + (error.response?.data?.error || error.message));
    }
  });

  const handleCreateRestaurant = (e) => {
    e.preventDefault();
    if (editingRestaurant) {
      updateRestaurantMutation.mutate({ id: editingRestaurant.id, data: restaurantData });
    } else {
      createRestaurantMutation.mutate(restaurantData);
    }
  };

  const handleEditRestaurant = (restaurant) => {
    setEditingRestaurant(restaurant);
    setRestaurantData({
      nombre: restaurant.nombre || "",
      slug: restaurant.slug || "",
      direccion: restaurant.direccion || "",
      telefono: restaurant.telefono || "",
      email: restaurant.email || "",
      google_place_id: restaurant.google_place_id || "",
    });
    setShowRestaurantForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelForm = () => {
    setShowRestaurantForm(false);
    setEditingRestaurant(null);
    setRestaurantData({ nombre: "", slug: "", direccion: "", telefono: "", email: "", google_place_id: "" });
  };

  const handleMigrateData = (restaurantId) => {
    if (confirm('¿Estás seguro de que quieres migrar todos los datos sin restaurant_id a este restaurante?')) {
      migrateDataMutation.mutate(restaurantId);
    }
  };

  const handleSyncGoogleReviews = (restaurantId) => {
    if (confirm('¿Sincronizar reseñas de Google Places para este restaurante?')) {
      syncGoogleReviewsMutation.mutate(restaurantId);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Enlace copiado al portapapeles');
  };

  // Mostrar loading mientras verifica permisos
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-black">
        <div className="text-slate-600 dark:text-slate-400">Verificando permisos...</div>
      </div>
    );
  }

  // Si no es admin, mostrar mensaje (aunque ya debería haber redirigido)
  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-black">
        <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900 max-w-md">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Acceso Denegado</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              No tienes permisos para acceder al panel de administración.
            </p>
            <Button onClick={() => window.location.href = createPageUrl('Dashboard')}>
              Volver al Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 bg-slate-50 dark:bg-black min-h-screen">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Panel de Administración</h1>
        <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">Gestiona restaurantes y usuarios</p>
      </div>

      <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900">
        <CardHeader className="border-b border-slate-100 dark:border-slate-700 p-4 md:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2 text-lg md:text-xl">
              <Building2 className="w-4 h-4 md:w-5 md:h-5" />
              Restaurantes
            </CardTitle>
            <Button
              onClick={() => {
                setEditingRestaurant(null);
                setRestaurantData({ nombre: "", slug: "", direccion: "", telefono: "", email: "", google_place_id: "" });
                setShowRestaurantForm(!showRestaurantForm);
              }}
              className="bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 w-full sm:w-auto text-sm"
              size="sm"
            >
              {showRestaurantForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {showRestaurantForm ? 'Cancelar' : 'Nuevo Restaurante'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          {showRestaurantForm && (
            <form onSubmit={handleCreateRestaurant} className="mb-6 p-3 md:p-4 border border-slate-200 dark:border-slate-700 rounded-lg space-y-3 md:space-y-4">
              <div className="grid gap-3 md:gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-slate-900 dark:text-white">Nombre *</Label>
                  <Input
                    required
                    value={restaurantData.nombre}
                    onChange={(e) => {
                      const nombre = e.target.value;
                      const slug = nombre
                        .toLowerCase()
                        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                        .replace(/[^a-z0-9\s-]/g, '')
                        .replace(/\s+/g, '-')
                        .replace(/-+/g, '-')
                        .trim();
                      setRestaurantData({ ...restaurantData, nombre, slug });
                    }}
                    placeholder="Nombre del restaurante"
                    className="dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-900 dark:text-white">Slug (URL) *</Label>
                  <Input
                    required
                    value={restaurantData.slug}
                    onChange={(e) => setRestaurantData({ ...restaurantData, slug: e.target.value })}
                    placeholder="mi-restaurante"
                    className="dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Se genera automáticamente. Único, sin espacios.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-900 dark:text-white">Email</Label>
                  <Input
                    type="email"
                    value={restaurantData.email}
                    onChange={(e) => setRestaurantData({ ...restaurantData, email: e.target.value })}
                    placeholder="email@restaurante.com"
                    className="dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-900 dark:text-white">Teléfono</Label>
                  <Input
                    value={restaurantData.telefono}
                    onChange={(e) => setRestaurantData({ ...restaurantData, telefono: e.target.value })}
                    placeholder="+34 600 000 000"
                    className="dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-900 dark:text-white">Dirección</Label>
                  <Input
                    value={restaurantData.direccion}
                    onChange={(e) => setRestaurantData({ ...restaurantData, direccion: e.target.value })}
                    placeholder="Calle Principal 123"
                    className="dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <MapPin className="w-3 h-3 md:w-4 md:h-4" />
                    Google Place ID
                  </Label>
                  <Input
                    value={restaurantData.google_place_id}
                    onChange={(e) => setRestaurantData({ ...restaurantData, google_place_id: e.target.value })}
                    placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
                    className="dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 break-words">
                    Obtén el Place ID en: <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noopener noreferrer" className="underline break-all">Google Place ID Finder</a>
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
                <Button type="button" variant="outline" onClick={handleCancelForm} className="dark:bg-slate-800 dark:text-white text-sm w-full sm:w-auto" size="sm">
                  Cancelar
                </Button>
                <Button type="submit" className="bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 text-sm w-full sm:w-auto" size="sm">
                  {editingRestaurant ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </form>
          )}

          <div className="space-y-3 md:space-y-4">
            {loadingRestaurants ? (
              <p className="text-slate-500 dark:text-slate-400 text-sm">Cargando restaurantes...</p>
            ) : restaurants.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 text-sm">No hay restaurantes creados aún.</p>
            ) : (
              restaurants.map((restaurant) => {
                const publicUrl = restaurant.slug ? `${window.location.origin}/reservar-publico?restaurant=${restaurant.slug}` : null;
                const modulosActivos = restaurant.modulos_activos || {};
                
                return (
                  <div key={restaurant.id} className="p-3 md:p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <div className="flex flex-col gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 dark:text-white text-sm md:text-base break-words">{restaurant.nombre}</h3>
                        <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 break-words">{restaurant.email} {restaurant.telefono && `• ${restaurant.telefono}`}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 break-all">ID: {restaurant.id}</p>
                        {restaurant.google_place_id && (
                          <p className="text-xs text-slate-500 dark:text-slate-500 flex items-center gap-1 mt-1 break-all">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            Place ID: {restaurant.google_place_id}
                          </p>
                        )}
                        <p className="text-xs text-slate-500 dark:text-slate-500">Plan: {restaurant.plan} • Estado: {restaurant.activo ? 'Activo' : 'Inactivo'}</p>
                        
                        {/* Módulos activos */}
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Módulos:</span>
                          {modulosActivos.productos && <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">Productos</Badge>}
                          {modulosActivos.stock && <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Stock</Badge>}
                          {modulosActivos.pedidos && <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs">Pedidos</Badge>}
                          {modulosActivos.analytics_avanzado && <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">Analytics</Badge>}
                          {!modulosActivos.productos && !modulosActivos.stock && !modulosActivos.pedidos && !modulosActivos.analytics_avanzado && (
                            <Badge variant="outline" className="text-xs">Plan básico</Badge>
                          )}
                        </div>
                        
                        {publicUrl && (
                          <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                            <p className="text-xs font-semibold text-blue-900 dark:text-blue-300 mb-1">🔗 Enlace Reservas Públicas:</p>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                              <code className="text-xs text-blue-700 dark:text-blue-400 flex-1 break-all">{publicUrl}</code>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyToClipboard(publicUrl)}
                                className="shrink-0 dark:bg-slate-800 dark:text-white w-full sm:w-auto text-xs h-7"
                              >
                                Copiar
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        {restaurant.slug && (
                          <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                            <p className="text-xs font-semibold text-green-900 dark:text-green-300 mb-1">📋 Enlace Gestión de Reservas ({restaurant.nombre}):</p>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                              <code className="text-xs text-green-700 dark:text-green-400 flex-1 break-all">
                                https://preview--hostflowapp.base44.app/FormularioGestionReserva?restaurant={restaurant.slug}
                              </code>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyToClipboard(`https://preview--hostflowapp.base44.app/FormularioGestionReserva?restaurant=${restaurant.slug}`)}
                                className="shrink-0 dark:bg-slate-800 dark:text-white w-full sm:w-auto text-xs h-7"
                              >
                                Copiar
                              </Button>
                            </div>
                            <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                              Los clientes de {restaurant.nombre} pueden gestionar sus reservas con código + email
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditRestaurant(restaurant)}
                          className="dark:bg-slate-800 dark:text-white text-xs h-8"
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.location.href = createPageUrl(`ModulosRestaurante?id=${restaurant.id}`)}
                          className="dark:bg-slate-800 dark:text-white border-purple-500 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950 text-xs h-8"
                        >
                          <Settings className="w-3 h-3 mr-1" />
                          Módulos
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMigrateData(restaurant.id)}
                          disabled={migrateDataMutation.isPending}
                          className="dark:bg-slate-800 dark:text-white text-xs h-8"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Migrar
                        </Button>
                        {restaurant.google_place_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSyncGoogleReviews(restaurant.id)}
                            disabled={syncGoogleReviewsMutation.isPending}
                            className="dark:bg-slate-800 dark:text-white border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950 text-xs h-8"
                          >
                            <MapPin className="w-3 h-3 mr-1" />
                            Sync
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRestaurantToDelete(restaurant.id)}
                          className="dark:bg-slate-800 dark:text-white border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 text-xs h-8"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-xl shadow-slate-900/5 bg-blue-50 dark:bg-blue-900/20">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-blue-900 dark:text-blue-300 text-base md:text-lg">📋 Instrucciones</CardTitle>
        </CardHeader>
        <CardContent className="text-xs md:text-sm text-blue-800 dark:text-blue-200 space-y-2 p-4 md:p-6">
          <p><strong>1.</strong> Crea un restaurante añadiendo su Google Place ID y Slug.</p>
          <p><strong>2.</strong> El "Enlace Reservas Públicas" permite crear nuevas reservas.</p>
          <p><strong>3.</strong> Cada restaurante tiene su propio "Enlace Gestión de Reservas" único.</p>
          <p><strong>4.</strong> Los clientes usan el enlace específico de su restaurante con código + email.</p>
          <p><strong>5.</strong> "Migrar Datos" asigna datos existentes a un restaurante.</p>
          <p><strong>6.</strong> "Sync" importa reseñas de Google Maps.</p>
          <p><strong>7.</strong> Configura restaurant_id en tu usuario para acceder.</p>
          <p className="break-words"><strong>⚠️ IMPORTANTE:</strong> Solo usuarios "admin" pueden acceder aquí.</p>
        </CardContent>
      </Card>

      <AlertDialog open={!!restaurantToDelete} onOpenChange={(open) => !open && setRestaurantToDelete(null)}>
        <AlertDialogContent className="bg-white dark:bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 dark:text-white">¿Eliminar restaurante?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              Esta acción no se puede deshacer. Se eliminará el restaurante permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-slate-800 dark:text-white">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteRestaurantMutation.mutate(restaurantToDelete)}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
