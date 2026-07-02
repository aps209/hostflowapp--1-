import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const RestaurantContext = createContext();

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
        console.log("Usuario cargado:", currentUser);
        setUser(currentUser);
        setRestaurantId(currentUser.restaurant_id);
        console.log("Restaurant ID asignado:", currentUser.restaurant_id);
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
        console.log("Cargando datos del restaurante:", restaurantId);
        
        // Cargar información del restaurante
        const restaurants = await base44.entities.Restaurant.filter({ id: restaurantId });
        if (restaurants.length > 0) {
          setRestaurant(restaurants[0]);
          console.log("Restaurante cargado:", restaurants[0]);
        }

        // Cargar configuración
        const configs = await base44.entities.RestaurantConfig.filter({ 
          restaurant_id: restaurantId 
        });
        
        if (configs.length > 0) {
          const restaurantConfig = configs[0];
          console.log("Configuración cargada:", restaurantConfig);
          setConfig(restaurantConfig);
          
          const newColorPrimario = restaurantConfig.color_primario || '#1e3a8a';
          const newColorAccento = restaurantConfig.color_acento || '#f59e0b';
          
          setColorPrimario(newColorPrimario);
          setColorAccento(newColorAccento);
          
          localStorage.setItem('hostflow_color_primario', newColorPrimario);
          localStorage.setItem('hostflow_color_acento', newColorAccento);
        } else {
          console.warn("No se encontró configuración para el restaurante:", restaurantId);
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
        restaurant_id: restaurantId 
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

  // Función helper para verificar si un usuario tiene acceso a un módulo
  const hasModuleAccess = (moduleName) => {
    // Los admins siempre tienen acceso a todo
    if (user?.role === 'admin') return true;
    
    // Si no hay restaurante cargado, no hay acceso
    if (!restaurant) return false;
    
    // Verificar si el módulo está activo en el restaurante
    const restaurantHasModule = restaurant.modulos_activos?.[moduleName] === true;
    if (!restaurantHasModule) return false;
    
    // Verificar si el usuario tiene permiso para este módulo
    const userHasPermission = user?.modulos_permitidos?.[moduleName] === true;
    
    return userHasPermission;
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
      hasModuleAccess
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