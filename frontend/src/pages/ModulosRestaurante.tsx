import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Settings, Users, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";
import { APP_MODULES } from "@/lib/modules";
import { isPlatformAdmin } from "@/lib/authz";

export default function ModulosRestaurante() {
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const urlParams = new URLSearchParams(window.location.search);
  const restaurantId = urlParams.get("id");

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await base44.auth.me();
        setAdminUser(currentUser);

        if (!isPlatformAdmin(currentUser)) {
          window.location.href = createPageUrl("Dashboard");
        }
      } catch {
        base44.auth.redirectToLogin();
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const { data: restaurants = [] } = useQuery({
    queryKey: ["restaurant", restaurantId],
    queryFn: () => base44.entities.Restaurant.filter({ id: restaurantId }),
    enabled: !!restaurantId && isPlatformAdmin(adminUser),
  });

  const restaurant = restaurants[0];

  const { data: allUsers = [] } = useQuery({
    queryKey: ["allUsers", restaurantId],
    queryFn: () => base44.entities.User.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId && isPlatformAdmin(adminUser),
  });

  const updateRestaurantMutation = useMutation({
    mutationFn: ({ modulos_activos }) =>
      base44.entities.Restaurant.update(restaurantId, { modulos_activos }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant", restaurantId] });
      toast.success("Modulos del restaurante actualizados");
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, modulos_permitidos }) =>
      base44.auth.asServiceRole.entities.User.update(userId, { modulos_permitidos }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allUsers", restaurantId] });
      toast.success("Permisos del usuario actualizados");
    },
  });

  const handleToggleRestaurantModule = (moduleKey) => {
    if (!restaurant) return;

    const currentModulos = restaurant.modulos_activos || {};
    updateRestaurantMutation.mutate({
      modulos_activos: {
        ...currentModulos,
        [moduleKey]: !currentModulos[moduleKey],
      },
    });
  };

  const handleToggleUserModule = (userId, moduleKey, currentValue) => {
    const user = allUsers.find((item) => item.id === userId);
    if (!user) return;

    const currentModulos = user.modulos_permitidos || {};
    updateUserMutation.mutate({
      userId,
      modulos_permitidos: {
        ...currentModulos,
        [moduleKey]: !currentValue,
      },
    });
  };

  if (loading || !restaurantId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-black">
        <div className="text-slate-600 dark:text-slate-400">Cargando...</div>
      </div>
    );
  }

  if (!isPlatformAdmin(adminUser)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-black">
        <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900 max-w-md">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Acceso denegado</h2>
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
            <Button onClick={() => window.location.href = createPageUrl("Admin")}>
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
          onClick={() => window.location.href = createPageUrl("Admin")}
          className="dark:bg-slate-800 dark:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
            Modulos - {restaurant.nombre}
          </h1>
          <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">
            Activa las dos areas principales y asigna permisos por usuario.
          </p>
        </div>
      </div>

      <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900">
        <CardHeader className="border-b border-slate-100 dark:border-slate-700 p-4 md:p-6">
          <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2 text-lg md:text-xl">
            <Settings className="w-4 h-4 md:w-5 md:h-5" />
            Modulos del restaurante
          </CardTitle>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Dashboard principal cubre la operativa diaria. CRM privado cubre clientes y marketing.
          </p>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="grid gap-4 md:grid-cols-2">
            {APP_MODULES.map((modulo) => {
              const Icon = modulo.icon;
              const isActive = modulosActivos[modulo.key] === true;

              return (
                <div
                  key={modulo.key}
                  className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${modulo.colorClass}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{modulo.nombre}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{modulo.descripcion}</p>
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

      <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900">
        <CardHeader className="border-b border-slate-100 dark:border-slate-700 p-4 md:p-6">
          <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2 text-lg md:text-xl">
            <Users className="w-4 h-4 md:w-5 md:h-5" />
            Permisos de usuarios
          </CardTitle>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Los admins tienen acceso completo. Para staff, solo se muestran los modulos permitidos.
          </p>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          {allUsers.length === 0 ? (
            <p className="text-center text-slate-500 dark:text-slate-400 py-8">
              No hay usuarios asignados a este restaurante.
            </p>
          ) : (
            <div className="space-y-4">
              {allUsers.map((user) => {
                const userModulos = user.modulos_permitidos || {};
                const isAdmin = user.role === "admin";

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
                        Los administradores tienen acceso completo a ambos modulos.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {APP_MODULES.map((modulo) => {
                          const moduleActive = modulosActivos[modulo.key] === true;
                          const userHasPermission = userModulos[modulo.key] === true;

                          if (!moduleActive) return null;

                          return (
                            <div
                              key={modulo.key}
                              className="flex items-center justify-between p-3 rounded bg-slate-50 dark:bg-slate-800"
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
    </div>
  );
}
