import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Calendar as CalendarIcon, Clock, Users, CheckCircle, AlertCircle, Utensils, Phone } from "lucide-react";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Alert, AlertDescription } from "@/components/ui/alert";

const addMinutes = (timeStr, minutes) => {
  if (!timeStr) return "";
  const [hours, mins] = timeStr.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const finalMinutes = totalMinutes % (24 * 60);
  const finalHours = Math.floor(finalMinutes / 60);
  const finalMins = finalMinutes % 60;
  return `${String(finalHours).padStart(2, '0')}:${String(finalMins).padStart(2, '0')}`;
};

const timeRangesOverlap = (start1, end1, start2, end2) => {
  const timeToMinutes = (time) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };
  
  const start1Min = timeToMinutes(start1);
  let end1Min = timeToMinutes(end1);
  const start2Min = timeToMinutes(start2);
  let end2Min = timeToMinutes(end2);
  
  if (end1Min <= start1Min) end1Min += 24 * 60;
  if (end2Min <= start2Min) end2Min += 24 * 60;
  
  const overlaps = start1Min < end2Min && start2Min < end1Min;
  console.log(`  [Overlap] ${start1}-${end1} vs ${start2}-${end2} = ${overlaps ? 'SÍ' : 'NO'}`);
  return overlaps;
};

// NUEVO: Configuración de validación por país
const phoneValidation = {
  '+34': { digits: 9, example: '+34 612 345 678', label: 'España' },
  '+33': { digits: 9, example: '+33 6 12 34 56 78', label: 'Francia' },
  '+44': { digits: 10, example: '+44 7911 123456', label: 'Reino Unido' },
  '+1': { digits: 10, example: '+1 202 555 0123', label: 'EE.UU./Canadá' },
  '+49': { digits: 10, example: '+49 151 12345678', label: 'Alemania' },
  '+39': { digits: 10, example: '+39 320 1234567', label: 'Italia' },
  '+351': { digits: 9, example: '+351 912 345 678', label: 'Portugal' },
  '+52': { digits: 10, example: '+52 55 1234 5678', label: 'México' },
  '+54': { digits: 10, example: '+54 11 2345 6789', label: 'Argentina' },
};

// NUEVO: Función para validar teléfono
const validatePhoneNumber = (phone) => {
  // Remover espacios y guiones
  const cleanPhone = phone.replace(/[\s-]/g, '');
  
  // Detectar prefijo
  const prefix = Object.keys(phoneValidation).find(p => cleanPhone.startsWith(p));
  
  if (!prefix) {
    return {
      valid: false,
      error: 'Debes incluir el prefijo internacional (ej: +34, +33, +1)',
      example: '+34 612 345 678'
    };
  }
  
  const config = phoneValidation[prefix];
  const digitsAfterPrefix = cleanPhone.slice(prefix.length);
  
  if (digitsAfterPrefix.length < config.digits) {
    return {
      valid: false,
      error: `El número de ${config.label} debe tener ${config.digits} dígitos después del prefijo`,
      example: config.example
    };
  }
  
  if (digitsAfterPrefix.length > config.digits) {
    return {
      valid: false,
      error: `El número de ${config.label} no debe superar ${config.digits} dígitos después del prefijo`,
      example: config.example
    };
  }
  
  return { valid: true };
};

const findAvailableTable = (tables, reservations, comensales, fecha, hora, duracionReserva, allowTableJoining, tableAvailability = []) => {
  // 🔒 VALIDACIONES CRÍTICAS
  if (!comensales || !fecha || !hora || !duracionReserva) {
    return { available: false, reason: "Datos incompletos" };
  }

  if (!Array.isArray(tables) || !Array.isArray(reservations) || !Array.isArray(tableAvailability)) {
    console.error('[CRITICAL] Datos de entrada inválidos en findAvailableTable');
    return { available: false, reason: "Error en datos del sistema" };
  }

  try {
    console.log(`\n━━━ VERIFICANDO: ${fecha} ${hora} (${comensales} personas) ━━━`);
  const horaFin = addMinutes(hora, duracionReserva);
  console.log(`Nueva reserva: ${hora} - ${horaFin}`);

  const unavailableTableIds = tableAvailability.filter(ta => ta.fecha === fecha).map(ta => ta.mesa_id);
  const reservacionesDelDia = reservations.filter(r => 
    r.fecha === fecha && r.estado !== 'cancelada' && r.estado !== 'completada' && r.estado !== 'no_show'
  );

  console.log(`Reservas del día: ${reservacionesDelDia.length}`);
  reservacionesDelDia.forEach(r => {
    const rFin = addMinutes(r.hora, r.duracion_estimada || duracionReserva);
    console.log(`  - Mesa ${r.mesa_numero}: ${r.hora}-${rFin} (${r.cliente_nombre})`);
  });

  const isTableAvailableAtTime = (tableId) => {
    const table = tables.find(t => t.id === tableId);
    if (!table || !table.activa || unavailableTableIds.includes(tableId) || table.estado === 'no_disponible') {
      return false;
    }

    const reservasEnEstaMesa = reservacionesDelDia.filter(r => 
      r.mesa_id === tableId || (r.mesas_unidas && r.mesas_unidas.includes(tableId))
    );

    if (reservasEnEstaMesa.length === 0) {
      console.log(`  Mesa ${table.numero}: LIBRE`);
      return true;
    }

    for (const reserva of reservasEnEstaMesa) {
      const reservaDuracion = reserva.duracion_estimada || duracionReserva;
      const reservaHoraFin = addMinutes(reserva.hora, reservaDuracion);
      
      if (timeRangesOverlap(hora, horaFin, reserva.hora, reservaHoraFin)) {
        console.log(`  Mesa ${table.numero}: OCUPADA (conflicto con ${reserva.reservation_id})`);
        return false;
      }
    }

    console.log(`  Mesa ${table.numero}: DISPONIBLE`);
    return true;
  };

  const mesasDisponibles = tables.filter(table => {
    if (!table.activa || unavailableTableIds.includes(table.id) || table.estado === 'no_disponible') return false;
    if (table.capacidad < comensales) return false;
    
    // 🔥 CRÍTICO: Respetar capacidad exacta
    if (table.exact_capacity_only === true && table.capacidad !== comensales) {
      return false;
    }
    
    return isTableAvailableAtTime(table.id);
  }).sort((a, b) => (a.capacidad - comensales) - (b.capacidad - comensales) || a.numero - b.numero);

  if (mesasDisponibles.length > 0) {
    console.log(`✅ DISPONIBLE - Mesa ${mesasDisponibles[0].numero}\n`);
    return { available: true, table: mesasDisponibles[0], isJoined: false };
  }

  if (allowTableJoining) {
    console.log("Buscando combinaciones...");
    const joinGroups = {};
    tables.forEach(table => {
      if (!table.activa || unavailableTableIds.includes(table.id) || table.estado === 'no_disponible') return;
      
      // 🔥 CRÍTICO: Excluir mesas con capacidad exacta de las combinaciones
      // Solo se pueden usar solas con su número exacto de comensales
      if (table.exact_capacity_only === true) return;
      
      const groupIds = table.join_group_ids || (table.join_group_id ? [table.join_group_id] : []);
      groupIds.forEach(groupId => {
        if (groupId) {
          if (!joinGroups[groupId]) joinGroups[groupId] = [];
          joinGroups[groupId].push(table);
        }
      });
    });

    let bestCombination = null;
    let minExcessCapacity = Infinity;

    for (const [groupId, groupTables] of Object.entries(joinGroups)) {
      const availableGroupTables = groupTables.filter(table => isTableAvailableAtTime(table.id));
      if (availableGroupTables.length === 0) continue;

      availableGroupTables.sort((a, b) => a.capacidad - b.capacidad || a.numero - b.numero);

      const findCombinationsRecursive = (currentIndex, currentCombo) => {
        const currentCapacity = currentCombo.reduce((sum, t) => sum + t.capacidad, 0);
        if (currentCapacity >= comensales) {
          const excess = currentCapacity - comensales;
          if (excess < minExcessCapacity) {
            minExcessCapacity = excess;
            bestCombination = [...currentCombo];
          }
          if (excess === 0) return;
        }
        if (currentIndex >= availableGroupTables.length || 
            (bestCombination && currentCapacity + (availableGroupTables[currentIndex]?.capacidad || 0) > comensales + minExcessCapacity)) {
          return;
        }
        findCombinationsRecursive(currentIndex + 1, [...currentCombo, availableGroupTables[currentIndex]]);
        findCombinationsRecursive(currentIndex + 1, currentCombo);
      };
      
      findCombinationsRecursive(0, []);
    }

    if (bestCombination) {
      const sortedCombination = bestCombination.sort((a, b) => a.numero - b.numero);
      console.log(`✅ DISPONIBLE - Mesas ${sortedCombination.map(t => t.numero).join(', ')}\n`);
      return {
        available: true,
        table: sortedCombination[0],
        joinedTables: sortedCombination.slice(1),
        allTables: sortedCombination,
        isJoined: true
      };
    }
  }

  console.log(`❌ NO DISPONIBLE\n`);
  return { available: false, reason: `No hay mesas disponibles para ${comensales} personas` };
  } catch (error) {
    console.error('[CRITICAL ERROR] Error en findAvailableTable:', error);
    return { available: false, reason: "Error verificando disponibilidad" };
  }
};

export default function ReservarPublico() {
  const errorAlertRef = React.useRef(null);
  const zoneConflictAlertRef = React.useRef(null);
  const [restaurantSlug, setRestaurantSlug] = useState("");
  const [restaurant, setRestaurant] = useState(null);
  const [config, setConfig] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [specialDays, setSpecialDays] = useState([]);
  const [tables, setTables] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [restaurantId, setRestaurantId] = useState(null);
  const [tableAvailability, setTableAvailability] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [reservationId, setReservationId] = useState("");

  const [zoneConflict, setZoneConflict] = useState(null);
  const [checkingZone, setCheckingZone] = useState(false);

  const maxComensalesPermitidos = config?.max_comensales_reserva || 20;
  const colorPrimario = config?.color_primario || '#1e3a8a';
  const colorAccento = config?.color_acento || '#f59e0b';
  const allowTableJoining = config?.allow_table_joining || false;

  const [formData, setFormData] = useState({
    cliente_nombre: "",
    cliente_apellidos: "",
    cliente_email: "",
    cliente_telefono: "",
    fecha: "",
    hora: "",
    comensales: 2,
    ocasion_especial: "ninguna",
    alergias: "",
    notas: "",
    zona_preferida: ""
  });

  // NUEVO: Estado para validación de teléfono
  const [phoneError, setPhoneError] = useState(null);

  const [availableTimes, setAvailableTimes] = useState([]);
  const [isDayClosed, setIsDayClosed] = useState(false);

  // NUEVO: Obtener usuario autenticado al cargar
  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        
        // Auto-rellenar email si el usuario está autenticado
        if (user?.email) {
          setFormData(prev => ({
            ...prev,
            cliente_email: user.email
          }));
        }
      } catch (err) {
        // Usuario no autenticado, continuar sin email
        console.log('Usuario no autenticado');
      }
    };
    
    loadUser();
  }, []);

  const fetchRestaurantData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await base44.functions.invoke('obtenerInfoRestaurante', { slug: restaurantSlug });

      if (response.data.success) {
        setRestaurant(response.data.restaurant);
        setConfig(response.data.config);
        setSchedules(response.data.schedules);
        setSpecialDays(response.data.specialDays);
        setTables(response.data.tables);
        setReservations(response.data.reservations);
        setRestaurantId(response.data.restaurant.id);
        setTableAvailability(response.data.tableAvailability || []);
        setError(null);
      } else {
        setError(response.data.error || "Error al cargar información");
      }
    } catch (err) {
      setError("Error al cargar: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [restaurantSlug]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('restaurant');
    if (slug) {
      setRestaurantSlug(slug);
    } else {
      setError("No se especificó un restaurante");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (restaurantSlug) {
      fetchRestaurantData();
    }
  }, [restaurantSlug, fetchRestaurantData]);

  const calculateEffectiveDuration = useCallback((fecha) => {
    if (!fecha || !config) return 90;
    const specialDay = specialDays.find(sd => sd.date === fecha);
    if (specialDay?.duracion_reserva_default) return specialDay.duracion_reserva_default;
    const date = new Date(fecha + 'T00:00:00');
    const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    const dayOfWeekName = dayNames[date.getDay()];
    const daySchedule = schedules.find(s => s.day_of_week === dayOfWeekName);
    if (daySchedule?.duracion_reserva_default) return daySchedule.duracion_reserva_default;
    return config.duracion_reserva_default || 90;
  }, [config, schedules, specialDays]);

  useEffect(() => {
    // 🔒 VALIDACIONES CRÍTICAS: Prevenir errores si faltan datos
    if (!formData.fecha || !config || !schedules || !specialDays || !tables || !reservations || !formData.comensales || !restaurant) {
      setAvailableTimes([]);
      setIsDayClosed(false);
      return;
    }

    // 🔒 PROTECCIÓN EXTRA: Validar tipos y valores
    if (!Array.isArray(schedules) || !Array.isArray(specialDays) || !Array.isArray(tables) || !Array.isArray(reservations)) {
      console.error('[CRITICAL] Datos corruptos detectados');
      setAvailableTimes([]);
      return;
    }

    if (typeof formData.comensales !== 'number' || formData.comensales < 1) {
      console.error('[CRITICAL] Número de comensales inválido');
      setAvailableTimes([]);
      return;
    }

    try {
      console.log(`\n═══ CALCULANDO HORARIOS: ${formData.fecha} (${formData.comensales} personas) ═══`);
      const date = new Date(formData.fecha + 'T00:00:00');
      
      // 🔒 VALIDACIÓN: Verificar que la fecha sea válida
      if (isNaN(date.getTime())) {
        console.error('[CRITICAL] Fecha inválida:', formData.fecha);
        setAvailableTimes([]);
        return;
      }
      
      const formattedDate = format(date, 'yyyy-MM-dd');
      
      let daySchedule = null;
      const specialDay = specialDays.find(d => d.date === formattedDate);
      if (specialDay) {
        daySchedule = specialDay;
      } else {
        const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
        const dayName = dayNames[date.getDay()];
        daySchedule = schedules.find(s => s.day_of_week === dayName);
      }

      if (!daySchedule || !daySchedule.is_open || !daySchedule.slots || daySchedule.slots.length === 0) {
        console.log("Día cerrado\n");
        setIsDayClosed(true);
        setAvailableTimes([]);
        setFormData(prev => ({ ...prev, hora: "" }));
        return;
      }

      setIsDayClosed(false);
      const duracionTotal = calculateEffectiveDuration(formattedDate);
      
      // 🔒 VALIDACIÓN: Verificar duración válida
      if (!duracionTotal || duracionTotal < 30 || duracionTotal > 480) {
        console.error('[CRITICAL] Duración inválida:', duracionTotal);
        setAvailableTimes([]);
        return;
      }

      const allPossibleTimes = [];
      daySchedule.slots.forEach(slot => {
        try {
          if (!slot.opening_time || !slot.closing_time) return;
          const start = new Date(`1970-01-01T${slot.opening_time}`);
          const end = new Date(`1970-01-01T${slot.closing_time}`);
          
          // 🔒 VALIDACIÓN: Verificar horarios válidos
          if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
          
          for (let d = new Date(start); d.getTime() <= end.getTime(); d.setMinutes(d.getMinutes() + 15)) {
            allPossibleTimes.push(format(d, 'HH:mm'));
          }
        } catch (slotError) {
          console.error('[ERROR] Error procesando slot:', slot, slotError);
        }
      });

      if (allPossibleTimes.length === 0) {
        console.log("No hay horarios disponibles\n");
        setAvailableTimes([]);
        return;
      }

      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      const currentTime = format(now, 'HH:mm');

      const timesWithAvailability = allPossibleTimes.filter(hora => {
        try {
          if (formattedDate === today && hora <= currentTime) return false;
          const result = findAvailableTable(
            tables, 
            reservations, 
            formData.comensales, 
            formattedDate, 
            hora, 
            duracionTotal, 
            allowTableJoining, 
            tableAvailability
          );
          return result && result.available;
        } catch (filterError) {
          console.error('[ERROR] Error verificando disponibilidad para hora:', hora, filterError);
          return false;
        }
      });

      timesWithAvailability.sort((a, b) => new Date(`1970-01-01T${a}`) - new Date(`1970-01-01T${b}`));
      console.log(`RESULTADO: ${timesWithAvailability.length} horarios disponibles`);
      if (timesWithAvailability.length > 0) {
        console.log(`Horarios: ${timesWithAvailability.join(', ')}`);
      }
      console.log("═══════════════════════════════════════════\n");
      
      setAvailableTimes(timesWithAvailability);
      if (formData.hora && !timesWithAvailability.includes(formData.hora)) {
        setFormData(prev => ({ ...prev, hora: "" }));
      }
    } catch (criticalError) {
      // 🔒 CAPTURA DE ERRORES: Evitar pantalla en blanco
      console.error('[CRITICAL ERROR] Error calculando horarios disponibles:', criticalError);
      setAvailableTimes([]);
      setError("Error al calcular disponibilidad. Por favor recarga la página.");
    }
  }, [formData.fecha, formData.comensales, config, schedules, specialDays, tables, reservations, restaurant, allowTableJoining, calculateEffectiveDuration, tableAvailability]);

  useEffect(() => {
    if (!config?.require_table_zone_selection || !formData.zona_preferida || !formData.fecha || !formData.hora || !formData.comensales) {
      setZoneConflict(null);
      return;
    }

    const duracionReserva = calculateEffectiveDuration(formData.fecha);
    if (!duracionReserva) {
        setZoneConflict(null);
        return;
    }

    setCheckingZone(true);
    setZoneConflict(null);

    const checkZoneAvailability = async () => {
      try {
        const preferredZoneTables = tables.filter(t => {
          const normalizeZone = (zone) => zone ? zone.trim().toLowerCase() : '';
          return normalizeZone(t.sala) === normalizeZone(formData.zona_preferida);
        });

        let result = findAvailableTable(
          preferredZoneTables, 
          reservations, 
          formData.comensales, 
          formData.fecha, 
          formData.hora, 
          duracionReserva, 
          allowTableJoining, 
          tableAvailability
        );

        if (result && result.available) {
          setZoneConflict(null);
        } else {
          const anyTableResult = findAvailableTable(
            tables, 
            reservations, 
            formData.comensales, 
            formData.fecha, 
            formData.hora, 
            duracionReserva, 
            allowTableJoining, 
            tableAvailability
          );

          if (anyTableResult && anyTableResult.available && anyTableResult.table) {
            const fechaFormateada = format(new Date(formData.fecha + 'T00:00:00'), 'PPP', { locale: es });
            setZoneConflict({
              zonaSolicitada: formData.zona_preferida,
              zonaDisponible: anyTableResult.table.sala,
              mensaje: `Lo sentimos, no tenemos mesas disponibles en la zona "${formData.zona_preferida}". Sin embargo, tenemos disponibilidad en "${anyTableResult.table.sala}". ¿Deseas continuar?`
            });
          } else {
            const fechaFormateada = format(new Date(formData.fecha + 'T00:00:00'), 'PPP', { locale: es });
            setZoneConflict({
              zonaSolicitada: formData.zona_preferida,
              zonaDisponible: null,
              mensaje: `No hay mesas disponibles para ${formData.comensales} personas el ${fechaFormateada} a las ${formData.hora}.`
            });
          }
        }
      } catch (error) {
        console.error('[checkZoneAvailability]', error);
      } finally {
        setCheckingZone(false);
      }
    };

    const timeoutId = setTimeout(() => {
      checkZoneAvailability();
    }, 500);

    return () => {
        clearTimeout(timeoutId);
        setCheckingZone(false);
    };
  }, [formData.zona_preferida, formData.fecha, formData.hora, formData.comensales, config, tables, reservations, allowTableJoining, tableAvailability, calculateEffectiveDuration, es]);

  useEffect(() => {
    if (error && errorAlertRef.current) {
      errorAlertRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [error]);

  useEffect(() => {
    if (zoneConflict && zoneConflictAlertRef.current) {
      zoneConflictAlertRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [zoneConflict]);

  const disabledDays = (date) => {
    if (isBefore(startOfDay(date), startOfDay(new Date()))) return true;
    if (!config || !schedules || !specialDays) return true;
    const formattedDate = format(date, 'yyyy-MM-dd');
    const specialDay = specialDays.find(d => d.date === formattedDate);
    if (specialDay) return !specialDay.is_open || !specialDay.slots || specialDay.slots.length === 0;
    const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    const dayName = dayNames[date.getDay()];
    const daySchedule = schedules.find(s => s.day_of_week === dayName);
    return !daySchedule || !daySchedule.is_open || !daySchedule.slots || daySchedule.slots.length === 0;
  };

  // NUEVO: Handler para validar teléfono en tiempo real
  const handlePhoneChange = (value) => {
    setFormData({ ...formData, cliente_telefono: value });
    
    if (value.length >= 3) {
      const validation = validatePhoneNumber(value);
      setPhoneError(validation.valid ? null : validation);
    } else {
      setPhoneError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const requiredFields = [
      formData.cliente_nombre,
      formData.cliente_apellidos,
      formData.cliente_email,
      formData.cliente_telefono,
      formData.fecha,
      formData.hora,
      formData.comensales
    ];
    
    if (requiredFields.some(field => !field)) {
      setError("Por favor completa todos los campos requeridos");
      return;
    }

    // NUEVO: Validar teléfono antes de enviar
    const phoneValidationResult = validatePhoneNumber(formData.cliente_telefono);
    if (!phoneValidationResult.valid) {
      setError(phoneValidationResult.error);
      setPhoneError(phoneValidationResult);
      return;
    }
    
    if (config?.require_table_zone_selection && !formData.zona_preferida) {
      setError("Por favor selecciona la zona");
      return;
    }
    
    if (!restaurantSlug) {
      setError("Error: No se pudo identificar el restaurante");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const finalCheckResponse = await base44.functions.invoke('obtenerInfoRestaurante', { slug: restaurantSlug });
      
      if (!finalCheckResponse.data.success) {
        setError("Error al verificar disponibilidad");
        setSubmitting(false);
        return;
      }

      const freshReservations = finalCheckResponse.data.reservations;
      const freshTables = finalCheckResponse.data.tables;
      const freshTableAvailability = finalCheckResponse.data.tableAvailability || [];
      const duracionReserva = calculateEffectiveDuration(formData.fecha);
      
      const availabilityCheck = findAvailableTable(
        freshTables, 
        freshReservations, 
        formData.comensales, 
        formData.fecha, 
        formData.hora, 
        duracionReserva, 
        allowTableJoining, 
        freshTableAvailability
      );

      if (!availabilityCheck || !availabilityCheck.available) {
        const fechaFormateada = format(new Date(formData.fecha + 'T00:00:00'), 'PPP', { locale: es });
        const errorMessage = availabilityCheck?.reason || `No hay mesas disponibles para ${formData.comensales} personas el ${fechaFormateada} a las ${formData.hora}.`;
        setError(errorMessage);
        setSubmitting(false);
        await fetchRestaurantData();
        return;
      }

      const payload = {
        slug: restaurantSlug,
        cliente_nombre: formData.cliente_nombre,
        cliente_apellidos: formData.cliente_apellidos,
        cliente_email: formData.cliente_email,
        cliente_telefono: formData.cliente_telefono,
        fecha: formData.fecha,
        hora: formData.hora,
        comensales: formData.comensales,
        ocasion_especial: formData.ocasion_especial || 'ninguna',
        alergias: formData.alergias || '',
        notas: formData.notas || '',
        preferencias: '',
        zona_preferida: formData.zona_preferida || '',
        force_alternative_zone: true
      };

      const response = await base44.functions.invoke('crearReservaPublica', payload);

      if (response.data && response.data.success) {
        setSuccess(true);
        setReservationId(response.data.reservation?.reservation_id || "");
        await fetchRestaurantData();
        setFormData({
          cliente_nombre: "",
          cliente_apellidos: "",
          cliente_email: currentUser?.email || "",
          cliente_telefono: "",
          fecha: "",
          hora: "",
          comensales: 2,
          ocasion_especial: "ninguna",
          alergias: "",
          notas: "",
          zona_preferida: ""
        });
        setPhoneError(null);
        setZoneConflict(null);
      } else if (response.data && response.data.requiresZoneConfirmation) {
        setZoneConflict({
          zonaSolicitada: response.data.originalZone,
          zonaDisponible: response.data.alternativeZone,
          mensaje: response.data.message
        });
      } else {
        const errorMsg = response.data?.error || response.data?.message || "Error al crear la reserva";
        setError(errorMsg);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || "Error inesperado";
      setError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptAlternativeZone = () => {
    if (!zoneConflict || !zoneConflict.zonaDisponible) {
      setError("No hay zona alternativa disponible");
      return;
    }
    setFormData(prev => ({ ...prev, zona_preferida: zoneConflict.zonaDisponible }));
    setZoneConflict(null);
    setError(null);
  };

  const handleDeclineAlternativeZone = () => {
    setZoneConflict(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl border-0 shadow-2xl">
          <CardContent className="p-12 text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-600 mb-4" />
            <p className="text-slate-600">Cargando información del restaurante...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !restaurant && !zoneConflict) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl border-0 shadow-2xl">
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Error</h2>
            <p className="text-slate-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl border-0 shadow-2xl">
          <CardContent className="p-12 text-center">
            <CheckCircle className="w-20 h-20 mx-auto text-emerald-500 mb-6" />
            <h2 className="text-3xl font-bold text-slate-900 mb-4">¡Reserva Confirmada!</h2>
            {reservationId && (
              <p className="text-lg text-slate-600 mb-2">
                Tu número de reserva es: <strong className="text-blue-600">{reservationId}</strong>
              </p>
            )}
            <p className="text-slate-600 mb-6">
              Hemos recibido tu solicitud de reserva. Te contactaremos pronto.
            </p>
            <Button
              onClick={() => {
                setSuccess(false);
                setReservationId("");
              }}
              style={{ background: `linear-gradient(135deg, ${colorPrimario}, ${colorAccento})` }}
              className="text-white"
            >
              Hacer otra reserva
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!restaurant || !config) {
    return null;
  }

  const isFormValid = formData.cliente_nombre && 
                       formData.cliente_apellidos && 
                       formData.cliente_email && 
                       formData.cliente_telefono && 
                       formData.fecha && 
                       formData.hora && 
                       (!config?.require_table_zone_selection || formData.zona_preferida) &&
                       !phoneError;

  const isButtonDisabled = submitting || 
                           checkingZone || 
                           !isFormValid ||
                           zoneConflict !== null;

  const buttonStyle = {
    background: isButtonDisabled ? '#94a3b8' : `linear-gradient(135deg, ${colorPrimario}, ${colorAccento})`
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl border-0 shadow-2xl">
        <CardHeader 
          className="text-white p-8" 
          style={{ background: `linear-gradient(135deg, ${colorPrimario}, ${colorAccento})` }}
        >
          <div className="flex items-center gap-4 mb-4">
            {restaurant.logo_url && (
              <img 
                src={restaurant.logo_url} 
                alt={restaurant.nombre} 
                className="w-16 h-16 object-contain bg-white rounded-lg p-2" 
              />
            )}
            <div>
              <CardTitle className="text-3xl font-bold">{restaurant.nombre}</CardTitle>
              {restaurant.direccion && <p className="text-white/90 text-sm mt-1">{restaurant.direccion}</p>}
            </div>
          </div>
          <p className="text-white/90">Reserva tu mesa online</p>
        </CardHeader>

        <CardContent className="p-8">
          {error && (
            <Alert ref={errorAlertRef} variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {zoneConflict && (
            <Alert ref={zoneConflictAlertRef} className="mb-6 border-amber-500 bg-amber-50">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <AlertDescription className="text-amber-900">
                <p className="font-semibold mb-2">⚠️ Zona no disponible</p>
                <p className="mb-4 text-sm">{zoneConflict.mensaje}</p>
                {zoneConflict.zonaDisponible && (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button 
                      onClick={handleAcceptAlternativeZone} 
                      className="bg-blue-600 hover:bg-blue-700 text-white" 
                      size="sm"
                    >
                      ✓ Aceptar zona "{zoneConflict.zonaDisponible}"
                    </Button>
                    <Button 
                      onClick={handleDeclineAlternativeZone} 
                      variant="outline" 
                      size="sm"
                    >
                      ✕ Cambiar fecha/hora
                    </Button>
                  </div>
                )}
                {!zoneConflict.zonaDisponible && (
                  <p className="text-xs text-amber-800 mt-2">
                    Por favor, selecciona otra fecha u hora con disponibilidad.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {checkingZone && (
            <Alert className="mb-6 border-blue-200 bg-blue-50">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <AlertDescription className="text-blue-900 text-sm">
                Verificando disponibilidad en tu zona preferida...
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="nombre" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />Nombre *
                </Label>
                <Input 
                  id="nombre" 
                  required 
                  value={formData.cliente_nombre} 
                  onChange={(e) => setFormData({ ...formData, cliente_nombre: e.target.value })} 
                  placeholder="Tu nombre" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apellidos">Apellidos *</Label>
                <Input 
                  id="apellidos" 
                  required 
                  value={formData.cliente_apellidos} 
                  onChange={(e) => setFormData({ ...formData, cliente_apellidos: e.target.value })} 
                  placeholder="Tus apellidos" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input 
                  id="email" 
                  type="email" 
                  required 
                  value={formData.cliente_email} 
                  onChange={(e) => setFormData({ ...formData, cliente_email: e.target.value })} 
                  placeholder="tu@email.com"
                  disabled={!!currentUser?.email}
                  className={currentUser?.email ? 'bg-slate-100 cursor-not-allowed' : ''}
                />
                {currentUser?.email && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Email de tu cuenta de usuario
                  </p>
                )}
              </div>
              
              {/* NUEVO: Campo de teléfono con validación */}
              <div className="space-y-2">
                <Label htmlFor="telefono" className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />Teléfono *
                </Label>
                <Input 
                  id="telefono" 
                  required 
                  type="tel" 
                  value={formData.cliente_telefono} 
                  onChange={(e) => handlePhoneChange(e.target.value)} 
                  placeholder="+34 612 345 678"
                  className={phoneError && !phoneError.valid ? 'border-red-500' : ''}
                />
                {phoneError && !phoneError.valid && (
                  <div className="text-xs space-y-1">
                    <p className="text-red-600 font-semibold">{phoneError.error}</p>
                    <p className="text-slate-600">
                      Ejemplo: <code className="bg-slate-100 px-1 rounded">{phoneError.example}</code>
                    </p>
                  </div>
                )}
                {!phoneError && formData.cliente_telefono && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Número válido
                  </p>
                )}
                {!formData.cliente_telefono && (
                  <p className="text-xs text-slate-500">
                    Incluye el prefijo internacional (ej: +34, +1, +33)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="comensales">Número de Personas *</Label>
                <Select 
                  value={formData.comensales?.toString() || ""} 
                  onValueChange={(value) => setFormData({ ...formData, comensales: parseInt(value) })} 
                  required
                >
                  <SelectTrigger id="comensales"><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: maxComensalesPermitidos }, (_, i) => i + 1).map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} {num === 1 ? 'persona' : 'personas'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" />Fecha *
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start text-left font-normal" 
                      style={{ borderColor: colorPrimario }}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.fecha ? (
                        format(new Date(formData.fecha + 'T00:00:00'), 'PPP', { locale: es })
                      ) : (
                        'Selecciona una fecha'
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar 
                      mode="single" 
                      selected={formData.fecha ? new Date(formData.fecha + 'T00:00:00') : undefined} 
                      onSelect={(date) => { 
                        if (date) setFormData({ ...formData, fecha: format(date, 'yyyy-MM-dd'), hora: "" }); 
                      }} 
                      disabled={disabledDays} 
                      initialFocus 
                      locale={es} 
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hora" className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />Hora *
                </Label>
                <Select 
                  value={formData.hora || ""} 
                  onValueChange={(value) => setFormData({ ...formData, hora: value })} 
                  disabled={!formData.fecha || !formData.comensales || isDayClosed || availableTimes.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue 
                      placeholder={
                        !formData.fecha ? "Selecciona una fecha primero" : 
                        !formData.comensales ? "Selecciona número de personas" : 
                        isDayClosed ? "Restaurante cerrado este día" : 
                        availableTimes.length === 0 ? "Sin disponibilidad" : 
                        "Selecciona una hora"
                      } 
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(availableTimes || []).map(time => (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.fecha && formData.comensales && availableTimes.length === 0 && !isDayClosed && (
                  <p className="text-xs text-red-600">
                    No hay disponibilidad para {formData.comensales} personas en esta fecha.
                  </p>
                )}
              </div>
            </div>

            {config?.require_table_zone_selection && config?.available_zones && config.available_zones.length > 0 && (
              <div className="space-y-2 p-4 rounded-lg border-2 border-blue-200 bg-blue-50">
                <Label htmlFor="zona" className="flex items-center gap-2 font-semibold text-slate-900">
                  <Utensils className="w-4 h-4" />Zona Preferida * (Requerido)
                </Label>
                <Select 
                  value={formData.zona_preferida} 
                  onValueChange={(value) => setFormData({ ...formData, zona_preferida: value })} 
                  required={config?.require_table_zone_selection}
                  disabled={checkingZone}
                >
                  <SelectTrigger id="zona" className="bg-white">
                    <SelectValue placeholder="Selecciona dónde prefieres sentarte" />
                  </SelectTrigger>
                  <SelectContent>
                    {config.available_zones.map((zone) => (
                      <SelectItem key={zone} value={zone}>📍 {zone}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-600">
                  Haremos lo posible por asignarte una mesa en la zona que prefieres según disponibilidad
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="ocasion_especial">Ocasión Especial (opcional)</Label>
              <Select 
                value={formData.ocasion_especial} 
                onValueChange={(value) => setFormData({ ...formData, ocasion_especial: value })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguna">Ninguna</SelectItem>
                  <SelectItem value="cumpleanos">Cumpleaños</SelectItem>
                  <SelectItem value="aniversario">Aniversario</SelectItem>
                  <SelectItem value="negocio">Negocio</SelectItem>
                  <SelectItem value="cita">Cita</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="alergias">Alergias (opcional)</Label>
              <Input 
                id="alergias" 
                value={formData.alergias} 
                onChange={(e) => setFormData({ ...formData, alergias: e.target.value })} 
                placeholder="Ej: Frutos secos, gluten..." 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas">Notas adicionales (opcional)</Label>
              <Textarea 
                id="notas" 
                value={formData.notas} 
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })} 
                placeholder="Cualquier información adicional..." 
                rows={3} 
              />
            </div>

            {config?.show_custom_message_in_public_form && config?.public_form_custom_message && (
              <Alert className="border-blue-200 bg-blue-50">
                <AlertDescription className="text-blue-900">
                  <p className="font-semibold text-sm mb-1">💬 Mensaje del restaurante:</p>
                  <p className="text-sm">{config.public_form_custom_message}</p>
                </AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full text-white text-lg py-6" 
              disabled={isButtonDisabled}
              style={buttonStyle}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Utensils className="w-5 h-5 mr-2" />
                  Confirmar Reserva
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}