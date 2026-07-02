import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Settings, Users, Check, X, Package, Utensils, ShoppingBag, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";

const MODULOS = [
  {
    key: "productos",
    nombre: "Productos y Menú",
    descripcion: "Gestión completa del menú y productos del restaurante",
    icon: Utensils,
    color: "purple"
  },
  {
    key: "stock",
    nombre: "Control de Stock",
    descripcion: "Gestión de inventario, ingredientes y proveedores",
    icon: Package,
    color: "green"
  },
  {
    key: "pedidos",
    nombre: "Pedidos y Facturación",
    descripcion: "Sistema de pedidos, comandas y facturación",
    icon: ShoppingBag,
    color: "orange"
  },
  {
    key: "analytics_avanzado",
    nombre: "Analytics Avanzado",
    descripcion: "Reportes detallados y métricas avanzadas",
    icon: BarChart3,
    color: "blue"
  }
];

export default function ModulosRestaurante() {
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  // Obtener ID del restaurante desde URL
  const urlParams = new URLSearchParams(window.location.search);
  const restaurantId = urlParams.get('id');

  // Verificar autenticación y rol de admin
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await base44.auth.me();
        setAdminUser(currentUser);
        
        if (currentUser.role !== 'admin') {
          window.location.href = createPageUrl('Dashboard');
        }
      } catch (error) {
        base44.auth.redirectToLogin();
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const { data: restaurants = [] } = useQuery({
    queryKey: ['restaurant', restaurantId],
    queryFn: () => base44.entities.Restaurant.filter({ id: restaurantId }),
    enabled: !!restaurantId && adminUser?.role === 'admin',
  });

  const restaurant = restaurants[0];

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers', restaurantId],
    queryFn: () => base44.entities.User.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId && adminUser?.role === 'admin',
  });

  const updateRestaurantMutation = useMutation({
    mutationFn: ({ modulos_activos }) => 
      base44.entities.Restaurant.update(restaurantId, { modulos_activos }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant', restaurantId] });
      toast.success('Módulos del restaurante actualizados');
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, modulos_permitidos }) => 
      base44.auth.asServiceRole.entities.User.update(userId, { modulos_permitidos }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allUsers', restaurantId] });
      toast.success('Permisos del usuario actualizados');
    },
  });

  const handleToggleRestaurantModule = (moduleKey) => {
    if (!restaurant) return;
    
    const currentModulos = restaurant.modulos_activos || {};
    const newModulos = {
      ...currentModulos,
      [moduleKey]: !currentModulos[moduleKey]
    };
    
    updateRestaurantMutation.mutate({ modulos_activos: newModulos });
  };

  const handleToggleUserModule = (userId, moduleKey, currentValue) => {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    const currentModulos = user.modulos_permitidos || {};
    const newModulos = {
      ...currentModulos,
      [moduleKey]: !currentValue
    };
    
    updateUserMutation.mutate({ userId, modulos_permitidos: newModulos });
  };

  if (loading || !restaurantId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-black">
        <div className="text-slate-600 dark:text-slate-400">Cargando...</div>
      </div>
    );
  }

  if (adminUser?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-black">
        <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900 max-w-md">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Acceso Denegado</h2>
            <p className="text-slate-600 dark:text-slate-400">No tienes permisos de administrador.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-black">
        <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900 max-w-md">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Restaurante no encontrado</h2>
            <Button onClick={() => window.location.href = createPageUrl('Admin')}>
              Volver al Admin
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const modulosActivos = restaurant.modulos_activos || {};

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 bg-slate-50 dark:bg-black min-h-screen">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => window.location.href = createPageUrl('Admin')}
          className="dark:bg-slate-800 dark:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
            Módulos Premium - {restaurant.nombre}
          </h1>
          <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">
            Activa módulos para el restaurante y asigna permisos a usuarios
          </p>
        </div>
      </div>

      {/* Módulos del Restaurante */}
      <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900">
        <CardHeader className="border-b border-slate-100 dark:border-slate-700 p-4 md:p-6">
          <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2 text-lg md:text-xl">
            <Settings className="w-4 h-4 md:w-5 md:h-5" />
            Módulos del Restaurante
          </CardTitle>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Activa los módulos que este restaurante podrá usar
          </p>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="grid gap-4">
            {MODULOS.map((modulo) => {
              const Icon = modulo.icon;
              const isActive = modulosActivos[modulo.key] === true;
              
              return (
                <div
                  key={modulo.key}
                  className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${modulo.color}-100 dark:bg-${modulo.color}-900/30`}>
                          <Icon className={`w-5 h-5 text-${modulo.color}-600 dark:text-${modulo.color}-400`} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white">{modulo.nombre}</h3>
                          <p className="text-sm text-slate-600 dark:text-slate-400">{modulo.descripcion}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isActive ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          <Check className="w-3 h-3 mr-1" />
                          Activo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-600">
                          <X className="w-3 h-3 mr-1" />
                          Inactivo
                        </Badge>
                      )}
                      <Switch
                        checked={isActive}
                        onCheckedChange={() => handleToggleRestaurantModule(modulo.key)}
                        disabled={updateRestaurantMutation.isPending}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Permisos de Usuarios */}
      <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900">
        <CardHeader className="border-b border-slate-100 dark:border-slate-700 p-4 md:p-6">
          <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2 text-lg md:text-xl">
            <Users className="w-4 h-4 md:w-5 md:h-5" />
            Permisos de Usuarios
          </CardTitle>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Asigna qué usuarios pueden acceder a cada módulo (solo módulos activos)
          </p>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          {allUsers.length === 0 ? (
            <p className="text-center text-slate-500 dark:text-slate-400 py-8">
              No hay usuarios asignados a este restaurante
            </p>
          ) : (
            <div className="space-y-4">
              {allUsers.map((user) => {
                const userModulos = user.modulos_permitidos || {};
                const isAdmin = user.role === 'admin';
                
                return (
                  <div
                    key={user.id}
                    className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          {user.full_name}
                          {isAdmin && <Badge className="ml-2 bg-amber-100 text-amber-800 border-amber-200 text-xs">Admin</Badge>}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{user.email}</p>
                      </div>
                    </div>
                    
                    {isAdmin ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Los administradores tienen acceso completo a todos los módulos
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {MODULOS.map((modulo) => {
                          const moduleActive = modulosActivos[modulo.key] === true;
                          const userHasPermission = userModulos[modulo.key] === true;
                          
                          if (!moduleActive) return null;
                          
                          return (
                            <div
                              key={modulo.key}
                              className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800"
                            >
                              <Label className="text-sm text-slate-700 dark:text-slate-300">
                                {modulo.nombre}
                              </Label>
                              <Switch
                                checked={userHasPermission}
                                onCheckedChange={() => 
                                  handleToggleUserModule(user.id, modulo.key, userHasPermission)
                                }
                                disabled={updateUserMutation.isPending}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-xl shadow-slate-900/5 bg-blue-50 dark:bg-blue-900/20">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-blue-900 dark:text-blue-300 text-base md:text-lg">💡 Cómo funciona</CardTitle>
        </CardHeader>
        <CardContent className="text-xs md:text-sm text-blue-800 dark:text-blue-200 space-y-2 p-4 md:p-6">
          <p><strong>1.</strong> Activa los módulos premium para el restaurante</p>
          <p><strong>2.</strong> Asigna permisos individuales a cada usuario</p>
          <p><strong>3.</strong> Solo los usuarios con permisos verán los módulos en el menú</p>
          <p><strong>4.</strong> Los administradores siempre tienen acceso completo</p>
          <p className="text-amber-700 dark:text-amber-300"><strong>⚠️</strong> Si desactivas un módulo del restaurante, ningún usuario podrá acceder a él</p>
        </CardContent>
      </Card>
    </div>
  );
}