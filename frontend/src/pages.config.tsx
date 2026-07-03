/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Admin from './pages/Admin';
import Camareros from './pages/Camareros';
import Campanas from './pages/Campanas';
import Clientes from './pages/Clientes';
import Configuracion from './pages/Configuracion';
import Dashboard from './pages/Dashboard';
import Flows from './pages/Flows';
import FormularioGestionReserva from './pages/FormularioGestionReserva';
import Horarios from './pages/Horarios';
import MapaMesas from './pages/MapaMesas';
import ModulosRestaurante from './pages/ModulosRestaurante';
import Pedidos from './pages/Pedidos';
import Recordatorios from './pages/Recordatorios';
import Reservas from './pages/Reservas';
import Reviews from './pages/Reviews';
import Stock from './pages/Stock';
import Tags from './pages/Tags';
import confirmarReserva from './pages/confirmar-reserva';
import reservarPublico from './pages/reservar-publico';
import Analytics from './pages/Analytics';
import AIManager from './pages/AIManager';
import CostIntelligence from './pages/CostIntelligence';
import Users from './pages/Users';
import Login from './pages/Login';
import Register from './pages/Register';
import Forbidden from './pages/Forbidden';
import __Layout from './Layout';


export const PAGES = {
    "Admin": Admin,
    "Camareros": Camareros,
    "Campanas": Campanas,
    "Clientes": Clientes,
    "Configuracion": Configuracion,
    "Dashboard": Dashboard,
    "Flows": Flows,
    "FormularioGestionReserva": FormularioGestionReserva,
    "Horarios": Horarios,
    "MapaMesas": MapaMesas,
    "ModulosRestaurante": ModulosRestaurante,
    "Pedidos": Pedidos,
    "Recordatorios": Recordatorios,
    "Reservas": Reservas,
    "Reviews": Reviews,
    "Stock": Stock,
    "Tags": Tags,
    "confirmar-reserva": confirmarReserva,
    "reservar-publico": reservarPublico,
    "Analytics": Analytics,
    "ai-manager": AIManager,
    "cost-intelligence": CostIntelligence,
    "Users": Users,
    "Login": Login,
    "Register": Register,
    "Forbidden": Forbidden,
}

export const pagesConfig = {
    mainPage: "Admin",
    Pages: PAGES,
    Layout: __Layout,
};
