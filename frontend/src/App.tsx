import './App.css'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { PAGE_MODULE_REQUIREMENTS } from '@/lib/modules';
import { isPlatformAdmin, isRestaurantAdmin } from '@/lib/authz';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const publicPages = new Set([
  'Login',
  'Register',
  'reservar-publico',
  'FormularioGestionReserva',
  'confirmar-reserva',
]);

const adminPages = new Set(['Admin', 'ModulosRestaurante']);
const mainModules = new Set(['dashboard_principal', 'crm_privado']);

const userHasModule = (user, moduleName: string) => {
  const value = user?.modulos_permitidos?.[moduleName];
  return value === true || (value === undefined && mainModules.has(moduleName));
};

const AccessDenied = () => (
  <div className="min-h-screen flex items-center justify-center p-6">
    <div className="max-w-md rounded-lg bg-white dark:bg-slate-900 p-6 text-center shadow-xl">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">Acceso no disponible</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Tu usuario no tiene permiso para este modulo.
      </p>
    </div>
  </div>
);

const AuthenticatedApp = () => {
  const { user, isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  const renderPage = (path, Page) => {
    if (!isAuthenticated && !publicPages.has(path)) {
      return <Navigate to="/Login" replace />;
    }

    if (isAuthenticated && adminPages.has(path) && !isPlatformAdmin(user)) {
      return <Navigate to="/Dashboard" replace />;
    }

    const requiredModule = PAGE_MODULE_REQUIREMENTS[path];
    if (
      isAuthenticated &&
      !isRestaurantAdmin(user) &&
      requiredModule &&
      !userHasModule(user, requiredModule)
    ) {
      if (path === 'Dashboard') {
        return (
          <LayoutWrapper currentPageName={path}>
            <AccessDenied />
          </LayoutWrapper>
        );
      }
      return <Navigate to="/Dashboard" replace />;
    }

    return (
      <LayoutWrapper currentPageName={path}>
        <Page />
      </LayoutWrapper>
    );
  };

  return (
    <Routes>
      <Route path="/" element={
        isAuthenticated
          ? adminPages.has(mainPageKey) && !isPlatformAdmin(user)
            ? <Navigate to="/Dashboard" replace />
            : (
            <LayoutWrapper currentPageName={mainPageKey}>
              <MainPage />
            </LayoutWrapper>
            )
          : <Navigate to="/Login" replace />
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={renderPage(path, Page)}
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <VisualEditAgent />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
