import React, { createContext, useContext, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const checkAppState = async () => {
    setIsLoadingAuth(true);
    setAuthError(null);

    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      if (error?.status && error.status !== 401) {
        setAuthError({
          type: 'unknown',
          message: error.message || 'No se pudo validar la sesion',
        });
      }
    } finally {
      setIsLoadingAuth(false);
    }
  };

  useEffect(() => {
    checkAppState();
  }, []);

  const login = async (email, password) => {
    const currentUser = await base44.auth.login(email, password);
    if (currentUser?.requires_pin) {
      return currentUser;
    }
    setUser(currentUser);
    setIsAuthenticated(true);
    setAuthError(null);
    return currentUser;
  };

  const verifyPin = async (temporaryToken, pin) => {
    const currentUser = await base44.auth.verifyPin(temporaryToken, pin);
    setUser(currentUser);
    setIsAuthenticated(true);
    setAuthError(null);
    return currentUser;
  };

  const register = async (payload) => {
    const currentUser = payload.license_key
      ? await base44.auth.registerCompany(payload)
      : await base44.auth.register(payload);
    setUser(currentUser);
    setIsAuthenticated(true);
    setAuthError(null);
    return currentUser;
  };

  const logout = () => {
    base44.auth.logout();
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/Login';
  };

  const navigateToLogin = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings: false,
        authError,
        appPublicSettings: { auth_required: true },
        login,
        verifyPin,
        register,
        logout,
        navigateToLogin,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
