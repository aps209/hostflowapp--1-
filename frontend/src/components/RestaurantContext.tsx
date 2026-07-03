import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const RestaurantContext = createContext(null);
const MAIN_MODULES = ['dashboard_principal', 'crm_privado'];

export function RestaurantProvider({ children }) {
  const [user, setUser] = useState(null);
  const [restaurantId, setRestaurantId] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [colorPrimario, setColorPrimario] = useState(() => {
    return localStorage.getItem('hostflow_color_primario') || '#1e3a8a';
  });
  const [colorAccento, setColorAccento] = useState(() => {
    return localStorage.getItem('hostflow_color_acento') || '#f59e0b';
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        setRestaurantId(currentUser.restaurant_id);
      } catch (error) {
        console.error('Error loading user:', error);
        if (error.response?.status === 401 || error.message?.includes('Unauthorized')) {
          if (!window.location.pathname.includes('reservar-publico')) {
            base44.auth.redirectToLogin();
          }
        }
        setUser(null);
        setRestaurantId(null);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  useEffect(() => {
    const loadRestaurantData = async () => {
      if (!restaurantId) return;

      try {
        const restaurants = await base44.entities.Restaurant.filter({ id: restaurantId });
        if (restaurants.length > 0) {
          setRestaurant(restaurants[0]);
        }

        const configs = await base44.entities.RestaurantConfig.filter({
          restaurant_id: restaurantId,
        });

        if (configs.length > 0) {
          const restaurantConfig = configs[0];
          setConfig(restaurantConfig);

          const newColorPrimario = restaurantConfig.color_primario || '#1e3a8a';
          const newColorAccento = restaurantConfig.color_acento || '#f59e0b';

          setColorPrimario(newColorPrimario);
          setColorAccento(newColorAccento);

          localStorage.setItem('hostflow_color_primario', newColorPrimario);
          localStorage.setItem('hostflow_color_acento', newColorAccento);
        }
      } catch (error) {
        console.error('Error loading restaurant data:', error);
      }
    };

    loadRestaurantData();
  }, [restaurantId]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--color-primario', colorPrimario);
    root.style.setProperty('--color-acento', colorAccento);
  }, [colorPrimario, colorAccento]);

  const refreshConfig = async () => {
    if (!restaurantId) return;

    try {
      const configs = await base44.entities.RestaurantConfig.filter({
        restaurant_id: restaurantId,
      });

      if (configs.length > 0) {
        const restaurantConfig = configs[0];
        setConfig(restaurantConfig);

        const newColorPrimario = restaurantConfig.color_primario || '#1e3a8a';
        const newColorAccento = restaurantConfig.color_acento || '#f59e0b';

        setColorPrimario(newColorPrimario);
        setColorAccento(newColorAccento);

        localStorage.setItem('hostflow_color_primario', newColorPrimario);
        localStorage.setItem('hostflow_color_acento', newColorAccento);
      }
    } catch (error) {
      console.error('Error refreshing config:', error);
    }
  };

  const hasModuleAccess = (moduleName) => {
    if (user?.role === 'admin' || user?.is_platform_admin) return true;
    const permissionMap = {
      dashboard_principal: 'dashboard',
      crm_privado: 'crm',
      ai_manager: 'chatbot',
      cost_intelligence: 'cost_intelligence',
      user_management: 'user_management',
    };
    const requiredPermission = permissionMap[moduleName];
    if (requiredPermission && user?.permissions?.includes(requiredPermission)) return true;
    if (!restaurant) return false;

    const restaurantValue = restaurant.modulos_activos?.[moduleName];
    const restaurantHasModule = restaurantValue === true || (restaurantValue === undefined && MAIN_MODULES.includes(moduleName));
    if (!restaurantHasModule) return false;

    const userValue = user?.modulos_permitidos?.[moduleName];
    return userValue === true || (userValue === undefined && MAIN_MODULES.includes(moduleName));
  };

  return (
    <RestaurantContext.Provider value={{
      user,
      restaurantId,
      restaurant,
      loading,
      config,
      colorPrimario,
      colorAccento,
      refreshConfig,
      hasModuleAccess,
    }}>
      {children}
    </RestaurantContext.Provider>
  );
}

export function useRestaurant() {
  const context = useContext(RestaurantContext);
  if (!context) {
    throw new Error('useRestaurant must be used within RestaurantProvider');
  }
  return context;
}
