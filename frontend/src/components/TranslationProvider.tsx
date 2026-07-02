

// Sistema de traducciones para la aplicación
export const translations = {
  es: {
    // Navegación
    nav: {
      dashboard: "Dashboard",
      reservations: "Reservas",
      floorplan: "Floorplan",
      customers: "Clientes",
      flows: "Flows",
      tags: "Etiquetas",
      campaigns: "Campañas",
      reviews: "Reviews",
      schedules: "Horarios",
      settings: "Configuración",
    },
    // Dashboard
    dashboard: {
      title: "Dashboard",
      subtitle: "Resumen general de tu restaurante",
      todayReservations: "Reservas de Hoy",
      recentReviews: "Últimas Opiniones",
      quickActions: "Acciones Rápidas",
      stats: {
        todayReservations: "Reservas Hoy",
        thisWeek: "Esta Semana",
        avgRating: "Valoración Media",
        totalCustomers: "Total Clientes",
      }
    },
    // Reservas
    reservations: {
      title: "Reservas",
      subtitle: "Gestiona todas las reservas del restaurante",
      newReservation: "Nueva Reserva",
      editReservation: "Editar Reserva",
      searchPlaceholder: "Buscar por nombre de cliente...",
      filters: {
        all: "Todas",
        confirmed: "Confirmadas",
        pending: "Pendientes",
        completed: "Completadas",
      },
      form: {
        existingCustomer: "Cliente Existente",
        selectCustomer: "Seleccionar cliente...",
        name: "Nombre",
        email: "Email",
        phone: "Teléfono",
        guests: "Comensales",
        date: "Fecha",
        time: "Hora",
        table: "Mesa",
        status: "Estado",
        specialOccasion: "Ocasión Especial",
        notes: "Notas",
        cancel: "Cancelar",
        create: "Crear Reserva",
        update: "Actualizar",
        saving: "Guardando...",
      },
      status: {
        confirmed: "Confirmada",
        pending: "Pendiente",
        seated: "Sentada",
        completed: "Completada",
        cancelled: "Cancelada",
        noShow: "No Show",
      }
    },
    // Clientes
    customers: {
      title: "Clientes",
      subtitle: "Gestiona tu base de datos de clientes",
      newCustomer: "Nuevo Cliente",
      editCustomer: "Editar Cliente",
      searchPlaceholder: "Buscar por nombre, email o teléfono...",
      noResults: "No se encontraron clientes",
      deleteWarning: "Esta acción no se puede deshacer. El cliente se eliminará permanentemente.",
      form: {
        name: "Nombre",
        email: "Email",
        phone: "Teléfono",
        tags: "Etiquetas",
        preferences: "Preferencias",
        allergies: "Alergias",
        internalNotes: "Notas Internas",
        cancel: "Cancelar",
        create: "Crear Cliente",
        update: "Actualizar",
        saving: "Guardando...",
      }
    },
    // Mesas
    tables: {
      title: "Floorplan",
      subtitle: "Organiza y gestiona la distribución del restaurante",
      newTable: "Nueva Mesa",
      editTable: "Editar Mesa",
      locked: "Bloqueado",
      unlocked: "Desbloqueado",
      form: {
        tableNumber: "Número de Mesa",
        capacity: "Capacidad",
        shape: "Forma",
        room: "Sala",
        status: "Estado",
        cancel: "Cancelar",
        create: "Crear Mesa",
        update: "Actualizar",
        saving: "Guardando...",
      }
    },
    // Flows
    flows: {
      title: "Flow de Clientes",
      subtitle: "Visualiza los cubiertos por franja horaria",
      total: "Total",
      restaurantClosed: "Restaurante cerrado",
      noData: "No hay datos de flujo para mostrar en este día.",
      noReservations: "Sin reservas para este día",
    },
    // Etiquetas
    tags: {
      title: "Etiquetas",
      subtitle: "Organiza y clasifica a tus clientes",
      newTag: "Nueva Etiqueta",
      editTag: "Editar Etiqueta",
      existingTags: "Etiquetas Existentes",
      deleteWarning: "Esta acción no se puede deshacer. La etiqueta se eliminará permanentemente.",
      form: {
        name: "Nombre de la Etiqueta",
        color: "Color",
        cancel: "Cancelar",
        create: "Crear Etiqueta",
        update: "Actualizar",
        saving: "Guardando...",
      }
    },
    // Campañas
    campaigns: {
      title: "Campañas",
      subtitle: "Envía mensajes personalizados a tus clientes",
      emailMarketing: "Email Marketing",
      whatsapp: "WhatsApp",
      sms: "SMS",
      comingSoon: "Próximamente",
      emailDescription: "Envía newsletters y promociones directamente al correo de tus clientes.",
      whatsappDescription: "Comunícate por WhatsApp con tus clientes de forma directa.",
      smsDescription: "Envía recordatorios y notificaciones por SMS.",
    },
    // Reviews
    reviews: {
      title: "Reviews",
      subtitle: "Opiniones y valoraciones de tus clientes",
      basedOn: "Basado en",
      opinions: "opiniones",
      food: "comida",
      service: "servicio",
      ambiance: "ambiente",
      price: "precio",
    },
    // Horarios
    schedules: {
      title: "Gestión de Horarios",
      subtitle: "Define cuándo tu restaurante está abierto al público",
      weeklySchedule: "Horario Semanal",
      specialDays: "Días Especiales",
      days: {
        lunes: "Lunes",
        martes: "Martes",
        miércoles: "Miércoles",
        jueves: "Jueves",
        viernes: "Viernes",
        sábado: "Sábado",
        domingo: "Domingo",
      }
    },
    // Configuración
    settings: {
      title: "Configuración",
      subtitle: "Personaliza tu restaurante",
      generalInfo: "Información General",
      defaultTimings: "Tiempos por Defecto",
      customization: "Personalización",
      languageRegion: "Idioma y Región",
    },
    // Común
    common: {
      save: "Guardar",
      cancel: "Cancelar",
      edit: "Editar",
      delete: "Eliminar",
      search: "Buscar",
      filter: "Filtrar",
      loading: "Cargando...",
      noData: "No hay datos disponibles",
      today: "Hoy",
      yesterday: "Ayer",
      tomorrow: "Mañana",
      persons: "personas",
      table: "Mesa",
      confirmDelete: "¿Confirmar eliminación?",
    }
  },
  en: {
    // Navigation
    nav: {
      dashboard: "Dashboard",
      reservations: "Reservations",
      floorplan: "Floorplan",
      customers: "Customers",
      flows: "Flows",
      tags: "Tags",
      campaigns: "Campaigns",
      reviews: "Reviews",
      schedules: "Schedules",
      settings: "Settings",
    },
    // Dashboard
    dashboard: {
      title: "Dashboard",
      subtitle: "General overview of your restaurant",
      todayReservations: "Today's Reservations",
      recentReviews: "Recent Reviews",
      quickActions: "Quick Actions",
      stats: {
        todayReservations: "Today's Reservations",
        thisWeek: "This Week",
        avgRating: "Average Rating",
        totalCustomers: "Total Customers",
      }
    },
    // Reservations
    reservations: {
      title: "Reservations",
      subtitle: "Manage all restaurant reservations",
      newReservation: "New Reservation",
      editReservation: "Edit Reservation",
      searchPlaceholder: "Search by customer name...",
      filters: {
        all: "All",
        confirmed: "Confirmed",
        pending: "Pending",
        completed: "Completed",
      },
      form: {
        existingCustomer: "Existing Customer",
        selectCustomer: "Select customer...",
        name: "Name",
        email: "Email",
        phone: "Phone",
        guests: "Guests",
        date: "Date",
        time: "Time",
        table: "Table",
        status: "Status",
        specialOccasion: "Special Occasion",
        notes: "Notes",
        cancel: "Cancel",
        create: "Create Reservation",
        update: "Update",
        saving: "Saving...",
      },
      status: {
        confirmed: "Confirmed",
        pending: "Pending",
        seated: "Seated",
        completed: "Completed",
        cancelled: "Cancelled",
        noShow: "No Show",
      }
    },
    // Customers
    customers: {
      title: "Customers",
      subtitle: "Manage your customer database",
      newCustomer: "New Customer",
      editCustomer: "Edit Customer",
      searchPlaceholder: "Search by name, email or phone...",
      noResults: "No customers found",
      deleteWarning: "This action cannot be undone. The customer will be permanently deleted.",
      form: {
        name: "Name",
        email: "Email",
        phone: "Phone",
        tags: "Tags",
        preferences: "Preferences",
        allergies: "Allergies",
        internalNotes: "Internal Notes",
        cancel: "Cancel",
        create: "Create Customer",
        update: "Update",
        saving: "Saving...",
      }
    },
    // Tables
    tables: {
      title: "Floorplan",
      subtitle: "Organize and manage restaurant layout",
      newTable: "New Table",
      editTable: "Edit Table",
      locked: "Locked",
      unlocked: "Unlocked",
      form: {
        tableNumber: "Table Number",
        capacity: "Capacity",
        shape: "Shape",
        room: "Room",
        status: "Status",
        cancel: "Cancel",
        create: "Create Table",
        update: "Update",
        saving: "Saving...",
      }
    },
    // Flows
    flows: {
      title: "Customer Flow",
      subtitle: "Visualize covers by time slot",
      total: "Total",
      restaurantClosed: "Restaurant closed",
      noData: "No flow data to display for this day.",
      noReservations: "No reservations for this day",
    },
    // Tags
    tags: {
      title: "Tags",
      subtitle: "Organize and classify your customers",
      newTag: "New Tag",
      editTag: "Edit Tag",
      existingTags: "Existing Tags",
      deleteWarning: "This action cannot be undone. The tag will be permanently deleted.",
      form: {
        name: "Tag Name",
        color: "Color",
        cancel: "Cancel",
        create: "Create Tag",
        update: "Update",
        saving: "Saving...",
      }
    },
    // Campaigns
    campaigns: {
      title: "Campaigns",
      subtitle: "Send personalized messages to your customers",
      emailMarketing: "Email Marketing",
      whatsapp: "WhatsApp",
      sms: "SMS",
      comingSoon: "Coming Soon",
      emailDescription: "Send newsletters and promotions directly to your customers' email.",
      whatsappDescription: "Communicate with your customers via WhatsApp directly.",
      smsDescription: "Send reminders and notifications via SMS.",
    },
    // Reviews
    reviews: {
      title: "Reviews",
      subtitle: "Customer ratings and feedback",
      basedOn: "Based on",
      opinions: "reviews",
      food: "food",
      service: "service",
      ambiance: "ambiance",
      price: "price",
    },
    // Schedules
    schedules: {
      title: "Schedule Management",
      subtitle: "Define when your restaurant is open to the public",
      weeklySchedule: "Weekly Schedule",
      specialDays: "Special Days",
      days: {
        lunes: "Monday",
        martes: "Tuesday",
        miércoles: "Wednesday",
        jueves: "Thursday",
        viernes: "Friday",
        sábado: "Saturday",
        domingo: "Sunday",
      }
    },
    // Settings
    settings: {
      title: "Settings",
      subtitle: "Customize your restaurant",
      generalInfo: "General Information",
      defaultTimings: "Default Timings",
      customization: "Customization",
      languageRegion: "Language & Region",
    },
    // Common
    common: {
      save: "Save",
      cancel: "Cancel",
      edit: "Edit",
      delete: "Delete",
      search: "Search",
      filter: "Filter",
      loading: "Loading...",
      noData: "No data available",
      today: "Today",
      yesterday: "Yesterday",
      tomorrow: "Tomorrow",
      persons: "persons",
      table: "Table",
      confirmDelete: "Confirm deletion?",
    }
  },
  fr: {
    // Navigation
    nav: {
      dashboard: "Tableau de bord",
      reservations: "Réservations",
      floorplan: "Plan de salle",
      customers: "Clients",
      flows: "Flux",
      tags: "Étiquettes",
      campaigns: "Campagnes",
      reviews: "Avis",
      schedules: "Horaires",
      settings: "Paramètres",
    },
    // Dashboard
    dashboard: {
      title: "Tableau de bord",
      subtitle: "Aperçu général de votre restaurant",
      todayReservations: "Réservations d'aujourd'hui",
      recentReviews: "Derniers avis",
      quickActions: "Actions rapides",
      stats: {
        todayReservations: "Réservations aujourd'hui",
        thisWeek: "Cette semaine",
        avgRating: "Note moyenne",
        totalCustomers: "Total clients",
      }
    },
    // Reservations
    reservations: {
      title: "Réservations",
      subtitle: "Gérez toutes les réservations du restaurant",
      newReservation: "Nouvelle réservation",
      editReservation: "Modifier la réservation",
      searchPlaceholder: "Rechercher par nom de client...",
      filters: {
        all: "Toutes",
        confirmed: "Confirmées",
        pending: "En attente",
        completed: "Terminées",
      },
      form: {
        existingCustomer: "Client existant",
        selectCustomer: "Sélectionner un client...",
        name: "Nom",
        email: "Email",
        phone: "Téléphone",
        guests: "Convives",
        date: "Date",
        time: "Heure",
        table: "Table",
        status: "Statut",
        specialOccasion: "Occasion spéciale",
        notes: "Notes",
        cancel: "Annuler",
        create: "Créer réservation",
        update: "Mettre à jour",
        saving: "Enregistrement...",
      },
      status: {
        confirmed: "Confirmée",
        pending: "En attente",
        seated: "Installée",
        completed: "Terminée",
        cancelled: "Annulée",
        noShow: "Absent",
      }
    },
    // Customers
    customers: {
      title: "Clients",
      subtitle: "Gérez votre base de données clients",
      newCustomer: "Nouveau client",
      editCustomer: "Modifier client",
      searchPlaceholder: "Rechercher par nom, email ou téléphone...",
      noResults: "Aucun client trouvé",
      deleteWarning: "Cette action ne peut pas être annulée. Le client sera définitivement supprimé.",
      form: {
        name: "Nom",
        email: "Email",
        phone: "Téléphone",
        tags: "Étiquettes",
        preferences: "Préférences",
        allergies: "Allergies",
        internalNotes: "Notes internes",
        cancel: "Annuler",
        create: "Créer client",
        update: "Mettre à jour",
        saving: "Enregistrement...",
      }
    },
    // Tables
    tables: {
      title: "Plan de salle",
      subtitle: "Organisez et gérez la disposition du restaurant",
      newTable: "Nouvelle table",
      editTable: "Modifier table",
      locked: "Verrouillé",
      unlocked: "Déverrouillé",
      form: {
        tableNumber: "Numéro de table",
        capacity: "Capacité",
        shape: "Forme",
        room: "Salle",
        status: "Statut",
        cancel: "Annuler",
        create: "Créer table",
        update: "Mettre à jour",
        saving: "Enregistrement...",
      }
    },
    // Flows
    flows: {
      title: "Flux de clients",
      subtitle: "Visualisez les couverts par tranche horaire",
      total: "Total",
      restaurantClosed: "Restaurant fermé",
      noData: "Aucune donnée de flux à afficher pour ce jour.",
      noReservations: "Aucune réservation pour ce jour",
    },
    // Tags
    tags: {
      title: "Étiquettes",
      subtitle: "Organisez et classifiez vos clients",
      newTag: "Nouvelle étiquette",
      editTag: "Modifier étiquette",
      existingTags: "Étiquettes existantes",
      deleteWarning: "Cette action ne peut pas être annulée. L'étiquette sera définitivement supprimée.",
      form: {
        name: "Nom de l'étiquette",
        color: "Couleur",
        cancel: "Annuler",
        create: "Créer étiquette",
        update: "Mettre à jour",
        saving: "Enregistrement...",
      }
    },
    // Campañas
    campaigns: {
      title: "Campagnes",
      subtitle: "Envoyez des messages personnalisés à vos clients",
      emailMarketing: "Email Marketing",
      whatsapp: "WhatsApp",
      sms: "SMS",
      comingSoon: "Bientôt disponible",
      emailDescription: "Envoyez des newsletters et promotions directement à l'email de vos clients.",
      whatsappDescription: "Communiquez avec vos clients via WhatsApp directement.",
      smsDescription: "Envoyez des rappels et notifications par SMS.",
    },
    // Reviews
    reviews: {
      title: "Avis",
      subtitle: "Évaluations et commentaires des clients",
      basedOn: "Basé sur",
      opinions: "avis",
      food: "nourriture",
      service: "service",
      ambiance: "ambiance",
      price: "prix",
    },
    // Horarios
    schedules: {
      title: "Gestion des horaires",
      subtitle: "Définissez quand votre restaurant est ouvert au public",
      weeklySchedule: "Horaire hebdomadaire",
      specialDays: "Jours spéciaux",
      days: {
        lunes: "Lundi",
        martes: "Mardi",
        miércoles: "Mercredi",
        jueves: "Jeudi",
        viernes: "Vendredi",
        sábado: "Samedi",
        domingo: "Dimanche",
      }
    },
    // Configuración
    settings: {
      title: "Paramètres",
      subtitle: "Personnalisez votre restaurant",
      generalInfo: "Informations générales",
      defaultTimings: "Durées par défaut",
      customization: "Personnalisation",
      languageRegion: "Langue et région",
    },
    // Común
    common: {
      save: "Enregistrer",
      cancel: "Annuler",
      edit: "Modifier",
      delete: "Supprimer",
      search: "Rechercher",
      filter: "Filtrer",
      loading: "Chargement...",
      noData: "Aucune donnée disponible",
      today: "Aujourd'hui",
      yesterday: "Hier",
      tomorrow: "Demain",
      persons: "personnes",
      table: "Table",
      confirmDelete: "Confirmer la suppression?",
    }
  }
};

export function useTranslation(lang = 'es') {
  return {
    t: (key) => {
      const keys = key.split('.');
      let value = translations[lang] || translations['es'];
      
      for (const k of keys) {
        value = value?.[k];
      }
      
      return value || key;
    },
    lang
  };
}
