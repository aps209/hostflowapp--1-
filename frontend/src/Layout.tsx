import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LogOut, Settings, Shield, Utensils } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { base44 } from "@/api/base44Client";
import { RestaurantProvider, useRestaurant } from "./components/RestaurantContext";
import { ADMIN_NAV_ITEMS, AI_NAV_ITEMS, CRM_NAV_ITEMS, DASHBOARD_NAV_ITEMS } from "@/lib/modules";
import { isPlatformAdmin, isRestaurantAdmin } from "@/lib/authz";

const adminNavItem = {
  title: "Admin",
  url: createPageUrl("Admin"),
  icon: Shield,
};

function PublicPageWrapper({ children }) {
  return <>{children}</>;
}

export default function Layout({ children, currentPageName }) {
  const isPublicPage = currentPageName === "reservar-publico" ||
                       currentPageName === "FormularioGestionReserva" ||
                       currentPageName === "confirmar-reserva" ||
                       currentPageName === "Login" ||
                       currentPageName === "Register";

  if (isPublicPage) {
    return <PublicPageWrapper>{children}</PublicPageWrapper>;
  }

  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}

function AuthenticatedLayout({ children }) {
  const location = useLocation();
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const handleLogout = () => {
    base44.auth.logout("/Login");
  };

  return (
    <RestaurantProvider>
      <LayoutContent
        user={user}
        location={location}
        handleLogout={handleLogout}
      >
        {children}
      </LayoutContent>
    </RestaurantProvider>
  );
}

function LayoutContent({ children, user, location, handleLogout }) {
  const { restaurant, config, colorPrimario, colorAccento, hasModuleAccess } = useRestaurant();
  const isAdmin = isRestaurantAdmin(user);
  const canUsePlatformAdmin = isPlatformAdmin(user);
  const companyName = restaurant?.nombre || config?.nombre_restaurante || "HostFlow";

  const navGroups = [
    {
      label: "Dashboard principal",
      module: "dashboard_principal",
      items: DASHBOARD_NAV_ITEMS,
    },
    {
      label: "CRM privado",
      module: "crm_privado",
      items: CRM_NAV_ITEMS,
    },
    {
      label: "Inteligencia",
      module: null,
      items: AI_NAV_ITEMS.filter((item) => hasModuleAccess(item.page === "cost-intelligence" ? "cost_intelligence" : "ai_manager")),
    },
    {
      label: "Administracion",
      module: "user_management",
      items: ADMIN_NAV_ITEMS,
    },
  ].filter((group) => group.items.length > 0 && (!group.module || hasModuleAccess(group.module)));

  const renderNavItem = (item) => {
    const url = item.url || createPageUrl(item.page);
    const isActive = location.pathname === url;

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          asChild
          className={`
            transition-all duration-200 rounded-xl mb-1 group
            ${isActive
              ? "text-white shadow-lg"
              : "text-slate-200 hover:text-white hover:bg-white/10"
            }
          `}
          style={isActive ? { background: "#3498db" } : {}}
        >
          <Link to={url} className="flex items-center gap-3 px-4 py-3">
            <item.icon className="w-4 h-4 transition-transform group-hover:scale-110" />
            <span className="font-medium text-sm">{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <SidebarProvider>
      <style>{`
        :root {
          --color-primario: ${colorPrimario};
          --color-acento: ${colorAccento};
        }

        .dark .rdp-day_button {
          color: white !important;
        }

        .dark .rdp-day_button:hover {
          background-color: rgb(51 65 85) !important;
        }

        .dark .rdp-day_selected .rdp-day_button {
          background-color: ${colorPrimario} !important;
          color: white !important;
        }

        .dark .rdp-weekday {
          color: rgb(148 163 184) !important;
        }

        .dark .rdp-caption_label {
          color: white !important;
        }

        .dark .rdp-nav_button {
          color: white !important;
        }

        .dark .rdp-day_disabled .rdp-day_button {
          color: rgb(71 85 105) !important;
        }
      `}</style>
      <div className="min-h-screen flex w-full">
        <Sidebar className="border-r border-slate-700 backdrop-blur-xl" style={{ background: "linear-gradient(180deg, #2c3e50 0%, #1a2a3a 100%)" }}>
          <SidebarHeader className="border-b border-slate-700 p-6" style={{ background: "#2c3e50" }}>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all"
                style={{
                  background: `linear-gradient(135deg, ${colorPrimario}, ${colorAccento})`,
                }}
              >
                <Utensils className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-white text-lg tracking-tight truncate max-w-[150px]">
                  {companyName}
                </h2>
                <p className="text-xs text-white font-medium">HostFlow</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="p-3" style={{ background: "transparent" }}>
            {navGroups.map((group) => (
              <SidebarGroup key={group.module}>
                <SidebarGroupLabel className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-2 mb-1">
                  {group.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map(renderNavItem)}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>

          <SidebarFooter className="border-t border-slate-700 p-4" style={{ background: "#1a2a3a" }}>
            <SidebarMenu className="mb-3">
              {renderNavItem({
                title: "Configuracion",
                url: createPageUrl("Configuracion"),
                icon: Settings,
              })}
              {canUsePlatformAdmin && renderNavItem(adminNavItem)}
            </SidebarMenu>

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-slate-700 dark:text-slate-300 font-bold text-sm">
                    {user?.full_name?.[0] || "U"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate">{user?.full_name || "Usuario"}</p>
                  <p className="text-xs text-white truncate">
                    {isAdmin ? "Admin" : "Staff"}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4 text-slate-300" />
              </button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-6 py-4 md:hidden sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-slate-100 dark:hover:bg-slate-900 p-2 rounded-xl transition-colors text-slate-900 dark:text-white -ml-2" />
              <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">{companyName}</h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto" style={{
            background: `
              radial-gradient(circle at 85% 15%, rgba(125, 200, 245, 0.6) 0%, transparent 45%),
              radial-gradient(circle at 15% 85%, rgba(125, 200, 245, 0.5) 0%, transparent 45%),
              radial-gradient(circle at 50% 50%, rgba(173, 225, 252, 0.4) 0%, transparent 65%),
              linear-gradient(135deg, #C8E8FA 0%, #DFF2FC 35%, #EDF8FF 65%, #C8E8FA 100%)
            `,
            backgroundAttachment: "fixed",
          }}>
            <div style={{
              backgroundImage: "radial-gradient(circle, rgba(80, 170, 220, 0.25) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
              minHeight: "100%",
            }}>
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
