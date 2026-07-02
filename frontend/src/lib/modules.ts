import {
  BarChart3,
  Building2,
  Calendar,
  Clock,
  Grid3x3,
  LayoutDashboard,
  Megaphone,
  Package,
  ShoppingBag,
  Star,
  Tags,
  UserCog,
  Users,
  Waves,
} from "lucide-react";

export const APP_MODULES = [
  {
    key: "dashboard_principal",
    nombre: "Dashboard principal",
    descripcion: "Operativa diaria: reservas, sala, horarios, reviews, analytics, pedidos y stock.",
    icon: Building2,
    colorClass: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  },
  {
    key: "crm_privado",
    nombre: "CRM privado",
    descripcion: "Clientes, campanas, etiquetas, camareros y recordatorios.",
    icon: Users,
    colorClass: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  },
] as const;

export const PAGE_MODULE_REQUIREMENTS: Record<string, string> = {
  Dashboard: "dashboard_principal",
  Reservas: "dashboard_principal",
  MapaMesas: "dashboard_principal",
  Horarios: "dashboard_principal",
  Reviews: "dashboard_principal",
  Analytics: "dashboard_principal",
  Flows: "dashboard_principal",
  Pedidos: "dashboard_principal",
  Stock: "dashboard_principal",
  Clientes: "crm_privado",
  Campanas: "crm_privado",
  Tags: "crm_privado",
  Camareros: "crm_privado",
  Recordatorios: "crm_privado",
};

export const DASHBOARD_NAV_ITEMS = [
  { title: "Dashboard", page: "Dashboard", icon: LayoutDashboard },
  { title: "Reservas", page: "Reservas", icon: Calendar },
  { title: "Floorplan", page: "MapaMesas", icon: Grid3x3 },
  { title: "Horarios", page: "Horarios", icon: Clock },
  { title: "Reviews", page: "Reviews", icon: Star },
  { title: "Analytics", page: "Analytics", icon: BarChart3 },
  { title: "Flows", page: "Flows", icon: Waves },
  { title: "Pedidos", page: "Pedidos", icon: ShoppingBag },
  { title: "Stock", page: "Stock", icon: Package },
];

export const CRM_NAV_ITEMS = [
  { title: "Clientes", page: "Clientes", icon: Users },
  { title: "Campanas", page: "Campanas", icon: Megaphone },
  { title: "Etiquetas", page: "Tags", icon: Tags },
  { title: "Camareros", page: "Camareros", icon: UserCog },
  { title: "Recordatorios", page: "Recordatorios", icon: Clock },
];
