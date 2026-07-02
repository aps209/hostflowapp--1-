import React, { useState, useEffect } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, CheckCircle, AlertCircle, Sparkles, Clock, Loader2, Calendar as CalendarIcon, Link as LinkIcon, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, isBefore, startOfDay, differenceInHours } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { es } from "date-fns/locale";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandGroup } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useRestaurant } from "../RestaurantContext";

const normalizeText = (text) => {
  if (!text) return '';
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '');
};

const timeRangesOverlap = (start1, end1, start2, end2) => {
  const s1 = new Date(`1970-01-01T${start1}:00`);
  let e1 = new Date(`1970-01-01T${end1}:00`);
  const s2 = new Date(`1970-01-01T${start2}:00`);
  let e2 = new Date(`1970-01-01T${end2}:00`);
  
  if (e1 <= s1) e1 = new Date(e1.getTime() + 24 * 60 * 60 * 1000);
  if (e2 <= s2) e2 = new Date(e2.getTime() + 24 * 60 * 60 * 1000);
  
  const overlaps = s1 < e2 && s2 < e1;
  
  console.log(`    [timeRangesOverlap]`);
  console.log(`      Rango 1 (nuevo): ${start1} - ${end1}`);
  console.log(`      Rango 2 (existente): ${start2} - ${end2}`);
  console.log(`      Comparación: ${start1} < ${end2}? ${s1 < e2} | ${start2} < ${end1}? ${s2 < e1}`);
  console.log(`      Resultado: ${overlaps ? '⚠️ SÍ SE SOLAPAN' : '✅ NO SE SOLAPAN'}`);
  
  return overlaps;
};

const addMinutes = (time, minutes) => {
  if (!time) return "";
  const [hours, mins] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, mins, 0);
  date.setMinutes(date.getMinutes() + minutes);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const getHoursUntilReservation = (fecha, hora) => {
  const now = new Date();
  const reservationDateTime = new Date(`${fecha}T${hora}:00`);
  return differenceInHours(reservationDateTime, now);
};

const calculateDayOccupancy = (fecha, reservations, totalCapacity) => {
  if (!totalCapacity || totalCapacity === 0) return 0;
  const dayReservations = reservations.filter(r =>
    r.fecha === fecha && r.estado !== 'cancelada' && r.estado !== 'no_show'
  );
  const totalCovers = dayReservations.reduce((sum, r) => sum + (r.comensales || 0), 0);
  return (totalCovers / totalCapacity) * 100;
};

const isVIPCustomer = (clienteId, customers) => {
  if (!clienteId) return false;
  const customer = customers.find(c => c.id === clienteId);
  return customer?.tags?.includes('VIP') || customer?.tags?.includes('Frecuente');
};

const findOptimalTable = (tables, reservations, comensales, fecha, hora, customerRoomPreferences, currentReservationId, duracionReserva, customers, clienteId, totalCapacity, tableAvailability, allowTableJoining = false) => {
  if (!comensales || !fecha || !hora || !duracionReserva) return null;

  console.log('\n🤖 [findOptimalTable FORMULARIO INTERNO] 🔍 INICIO');
  console.log(`   📅 Fecha: ${fecha}`);
  console.log(`   🕐 Hora: ${hora}`);
  console.log(`   👥 Comensales: ${comensales}`);
  console.log(`   ⏱️  Duración: ${duracionReserva} min`);
  console.log(`   📊 Total mesas recibidas: ${tables.length}`);
  console.log(`   🏠 Preferencia de área: ${customerRoomPreferences || 'No especificada'}`);

  const horaFin = addMinutes(hora, duracionReserva);
  const hoursUntil = getHoursUntilReservation(fecha, hora);
  const occupancy = calculateDayOccupancy(fecha, reservations, totalCapacity);
  const isVIP = isVIPCustomer(clienteId, customers);
  const areaPreferida = customerRoomPreferences ? customerRoomPreferences.toLowerCase().trim() : null;

  const unavailableTableIds = tableAvailability.filter(ta => ta.fecha === fecha).map(ta => ta.mesa_id);
  const reservacionesDelDia = reservations.filter(r => r.fecha === fecha && r.estado !== 'cancelada' && r.estado !== 'completada' && r.id !== currentReservationId);

  console.log(`   📊 Reservas activas del día: ${reservacionesDelDia.length}`);
  if (reservacionesDelDia.length > 0) {
    console.log(`   📋 Detalle de reservas existentes:`);
    reservacionesDelDia.forEach(r => {
      const rDur = r.duracion_estimada || duracionReserva;
      const rFin = addMinutes(r.hora, rDur);
      console.log(`      • ${r.reservation_id}: Mesa ${r.mesa_numero} | ${r.hora}-${rFin} (${rDur} min) | ${r.comensales}p - ${r.cliente_nombre}`);
    });
  }

  const isTableAvailable = (tableId) => {
    const table = tables.find(t => t.id === tableId);
    if (!table || !table.activa || unavailableTableIds.includes(table.id) || table.estado === 'no_disponible') {
      console.log(`   ❌ Mesa ID ${tableId} NO DISPONIBLE (activa: ${table?.activa}, bloqueada: ${unavailableTableIds.includes(table?.id)}, estado: ${table?.estado})`);
      return false;
    }

    const tableReservations = reservacionesDelDia
      .filter(r => r.mesa_id === tableId || (r.mesas_unidas && r.mesas_unidas.includes(tableId)))
      .sort((a, b) => a.hora.localeCompare(b.hora));
    
    console.log(`   🔍 Mesa ${table.numero} - Verificando ${tableReservations.length} reservas existentes...`);
    
    const hasDirectConflict = tableReservations.some(reserva => {
      const reservaDuracion = reserva.duracion_estimada || duracionReserva;
      const reservaHoraFin = addMinutes(reserva.hora, reservaDuracion);
      const overlaps = timeRangesOverlap(hora, horaFin, reserva.hora, reservaHoraFin);
      
      if (overlaps) {
        console.log(`      ❌ CONFLICTO: Nueva ${hora}-${horaFin} vs Existente ${reserva.hora}-${reservaHoraFin} (${reserva.cliente_nombre})`);
      }
      
      return overlaps;
    });

    if (hasDirectConflict) {
      console.log(`   ❌ Mesa ${table.numero} OCUPADA por conflicto directo`);
      return false;
    }

    let fitsInGap = true;
    if (tableReservations.length > 0 && tableReservations[0].hora < horaFin) {
      if (hora < tableReservations[0].hora && horaFin > tableReservations[0].hora) fitsInGap = false;
    }

    for (let i = 0; i < tableReservations.length - 1 && fitsInGap; i++) {
      const currentRes = tableReservations[i];
      const nextRes = tableReservations[i + 1];
      const currentResDuracion = currentRes.duracion_estimada || duracionReserva;
      const currentResEnd = addMinutes(currentRes.hora, currentResDuracion);
      if (hora >= currentResEnd && hora < nextRes.hora && horaFin > nextRes.hora) fitsInGap = false;
    }

    if (fitsInGap) {
      console.log(`   ✅ Mesa ${table.numero} DISPONIBLE`);
    } else {
      console.log(`   ❌ Mesa ${table.numero} NO CABE en huecos disponibles`);
    }

    return fitsInGap;
  };

  const suitableTables = tables.filter(table => {
      if (!table.activa) {
        console.log(`   ⛔ Mesa ${table.numero} FILTRADA - no activa`);
        return false;
      }
      if (unavailableTableIds.includes(table.id)) {
        console.log(`   ⛔ Mesa ${table.numero} FILTRADA - bloqueada manualmente`);
        return false;
      }
      if (table.estado === 'no_disponible') {
        console.log(`   ⛔ Mesa ${table.numero} FILTRADA - estado no_disponible`);
        return false;
      }
      if (table.capacidad < comensales) {
        console.log(`   ⛔ Mesa ${table.numero} FILTRADA - capacidad insuficiente (${table.capacidad} < ${comensales})`);
        return false;
      }
      if (table.exact_capacity_only && table.capacidad !== comensales) {
        console.log(`   ⛔ Mesa ${table.numero} FILTRADA - requiere capacidad exacta (${table.capacidad} personas exactas, solicitado: ${comensales})`);
        return false;
      }
      if (table.capacidad >= 8 && comensales < 6 && hoursUntil > 1) {
        console.log(`   ⛔ Mesa ${table.numero} FILTRADA - mesa grande reservada para grupos`);
        return false;
      }
      
      const available = isTableAvailable(table.id);
      if (!available) {
        console.log(`   ⛔ Mesa ${table.numero} FILTRADA - no disponible en este horario`);
      }
      
      return available;
    }).sort((a, b) => {
      const excessA = a.capacidad - comensales;
      const excessB = b.capacidad - comensales;
      if (excessA !== excessB) return excessA - excessB;
      const aIsInPreferredArea = areaPreferida && a.sala && a.sala.toLowerCase().includes(areaPreferida);
      const bIsInPreferredArea = areaPreferida && b.sala && b.sala.toLowerCase().includes(areaPreferida);
      if (aIsInPreferredArea && !bIsInPreferredArea) return -1;
      if (!aIsInPreferredArea && bIsInPreferredArea) return 1;
      return a.numero - b.numero;
    });

  console.log(`\n   📋 Mesas candidatas después de filtros: ${suitableTables.length}`);
  if (suitableTables.length > 0) {
    console.log(`      Mesas disponibles: ${suitableTables.map(t => `${t.numero} (${t.sala})`).join(', ')}`);
  }

  if (suitableTables.length > 0) {
    const table = suitableTables[0];
    const isInPreferredArea = areaPreferida && table.sala && table.sala.toLowerCase().includes(areaPreferida);
    
    console.log(`\n   ✅✅✅ MESA ASIGNADA: ${table.numero}`);
    console.log(`      Zona: ${table.sala}`);
    console.log(`      Capacidad: ${table.capacidad} personas`);
    console.log(`      Coincide con preferencia: ${isInPreferredArea ? 'SÍ ✅' : 'NO ❌'}\n`);
    
    let reason = 'Mesa asignada automáticamente';
    let warning = null;
    const sizeDiff = table.capacidad - comensales;

    if (isInPreferredArea) reason = `Mesa en ${table.sala} (área preferida)`;
    if (isVIP) {
      reason = (reason === 'Mesa asignada automáticamente' ? '' : reason + ' | ') + 'Asignación VIP prioritaria';
      if (sizeDiff > 0) warning = `Mesa con ${sizeDiff} asientos libres.`;
    } else if (sizeDiff > 0) {
      if (table.capacidad > comensales + 2) {
        reason += ' (Mesa más grande de lo necesario)';
        warning = `Mesa con ${sizeDiff} asientos libres. Es la mesa más pequeña disponible.`;
      } else {
        warning = `Mesa con ${sizeDiff} asientos libres.`;
      }
    }

    if (hoursUntil <= 1) warning = (warning ? warning + " " : "") + "Asignación urgente (< 1 hora).";
    else if (occupancy >= 80 && sizeDiff > 0) warning = (warning ? warning + " " : "") + `Ocupación alta (${occupancy.toFixed(0)}%). Mesa con ${sizeDiff} asientos libres.`;

    return { table, reason, warning, isJoined: false };
  }

  console.log(`\n   ❌ No hay mesas individuales disponibles`);

  if (allowTableJoining) {
    console.log(`   🔗 Intentando unir mesas...`);
    
    const joinGroups = {};
    tables.forEach(table => {
      if (!table.activa || unavailableTableIds.includes(table.id) || table.estado === 'no_disponible') return;
      
      const groupIds = table.join_group_ids || (table.join_group_id ? [table.join_group_id] : []);
      
      groupIds.forEach(groupId => {
        if (groupId) {
          if (!joinGroups[groupId]) {
            joinGroups[groupId] = [];
          }
          joinGroups[groupId].push(table);
        }
      });
    });

    let bestCombination = null;
    let minExcessCapacity = Infinity;
    let bestGroupId = null;

    for (const [groupId, groupTables] of Object.entries(joinGroups)) {
      const availableGroupTables = groupTables.filter(table => isTableAvailable(table.id));
      
      if (availableGroupTables.length === 0) continue;

      availableGroupTables.sort((a, b) => a.capacidad - b.capacidad || a.numero - b.numero);

      const findCombinationsRecursive = (currentIndex, currentCombo) => {
          const currentCapacity = currentCombo.reduce((sum, t) => sum + t.capacidad, 0);

          if (currentCapacity >= comensales) {
              const excess = currentCapacity - comensales;
              if (excess < minExcessCapacity) {
                  minExcessCapacity = excess;
                  bestCombination = [...currentCombo];
                  bestGroupId = groupId;
              }
              if (excess === 0) return; 
          }

          if (currentIndex >= availableGroupTables.length || (bestCombination && currentCapacity + (availableGroupTables[currentIndex]?.capacidad || 0) > comensales + minExcessCapacity)) {
            return;
          }

          findCombinationsRecursive(currentIndex + 1, [...currentCombo, availableGroupTables[currentIndex]]);
          findCombinationsRecursive(currentIndex + 1, currentCombo);
      };
      
      findCombinationsRecursive(0, []);
    }

    if (bestCombination) {
      const totalCapacity = bestCombination.reduce((sum, t) => sum + t.capacidad, 0);
      const sortedCombination = bestCombination.sort((a, b) => a.numero - b.numero);
      const primaryTable = sortedCombination[0];
      
      console.log(`\n   ✅✅✅ MESAS UNIDAS: ${sortedCombination.map(t => t.numero).join(', ')}`);
      console.log(`      Capacidad total: ${totalCapacity} personas\n`);
      
      return {
        table: primaryTable,
        joinedTables: sortedCombination.slice(1),
        reason: `Mesas unidas automáticamente (Grupo: ${bestGroupId})`,
        warning: `${bestCombination.length} mesas unidas: ${bestCombination.map(t => t.numero).join(', ')}. Capacidad total: ${totalCapacity} personas.`,
        isJoined: true,
        allTables: sortedCombination
      };
    }
  }

  console.log(`\n   ❌❌❌ SIN DISPONIBILIDAD - No hay mesas ni combinaciones disponibles\n`);

  return {
    table: null,
    reason: allowTableJoining ? "No hay mesas individuales ni combinaciones disponibles para este horario." : "No hay mesas disponibles para este horario.",
    warning: `Duración de bloqueo: ${Math.round(duracionReserva)} min | Ocupación: ${occupancy.toFixed(0)}%`,
    isAlternative: true
  };
};

const isDayAvailable = (date, tables, reservations, schedules, specialDays, duracionReservaFunc, customers, totalCapacity, tableAvailability, allowTableJoining) => {
  const formattedDate = format(date, 'yyyy-MM-dd');
  const specialDay = specialDays.find(d => d.date === formattedDate);
  let daySchedule = null;

  if (specialDay) {
    daySchedule = specialDay;
  } else {
    const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    const dayName = dayNames[date.getDay()];
    daySchedule = schedules.find(s => s.day_of_week === dayName);
  }

  if (!daySchedule || !daySchedule.is_open || !daySchedule.slots || daySchedule.slots.length === 0) return false;

  const allPossibleTimes = [];
  daySchedule.slots.forEach(slot => {
    const start = new Date(`1970-01-01T${slot.opening_time}`);
    const end = new Date(`1970-01-01T${slot.closing_time}`);
    for (let d = new Date(start); d.getTime() <= end.getTime(); d.setMinutes(d.getMinutes() + 15)) {
      allPossibleTimes.push(format(d, 'HH:mm'));
    }
  });

  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');
  const currentTime = format(now, 'HH:mm');

  const activeTablesForIntelligent = tables.filter(t => 
    (t.activa === true || t.activa === undefined) && 
    t.estado !== 'no_disponible'
  );

  for (const hora of allPossibleTimes) {
    if (formattedDate === today && hora <= currentTime) continue;
    const effectiveDurationForDate = duracionReservaFunc(formattedDate);
    const result = findOptimalTable(activeTablesForIntelligent, reservations, 2, formattedDate, hora, null, null, effectiveDurationForDate, customers, null, totalCapacity, tableAvailability, allowTableJoining);
    if (result && result.table) return true;
  }
  return false;
};

const getAvailableTablesAtTime = (tables, reservations, fecha, hora, duracionReserva, currentReservationId, tableAvailability) => {
  if (!hora || !fecha || !duracionReserva) return [];
  const horaFin = addMinutes(hora, duracionReserva);
  const reservacionesDelDia = reservations.filter(r => r.fecha === fecha && r.estado !== 'cancelada' && r.estado !== 'completada' && r.id !== currentReservationId);
  const unavailableTableIds = tableAvailability.filter(ta => ta.fecha === fecha).map(ta => ta.mesa_id);

  return tables.filter(table => {
    if (!table.activa || unavailableTableIds.includes(table.id) || table.estado === 'no_disponible') return false;
    const tableReservations = reservacionesDelDia.filter(r => r.mesa_id === table.id || (r.mesas_unidas && r.mesas_unidas.includes(table.id))).sort((a, b) => a.hora.localeCompare(b.hora));
    
    const hasDirectConflict = tableReservations.some(reserva => {
      const reservaDuracion = reserva.duracion_estimada || duracionReserva;
      const reservaHoraFin = addMinutes(reserva.hora, reservaDuracion);
      return timeRangesOverlap(hora, horaFin, reserva.hora, reservaHoraFin);
    });

    if (hasDirectConflict) return false;

    if (tableReservations.length > 0 && tableReservations[0].hora < horaFin) {
      if (hora < tableReservations[0].hora && horaFin > tableReservations[0].hora) return false;
    }

    for (let i = 0; i < tableReservations.length - 1; i++) {
      const currentRes = tableReservations[i];
      const nextRes = tableReservations[i + 1];
      const currentResDuracion = currentRes.duracion_estimada || duracionReserva;
      const currentResEnd = addMinutes(currentRes.hora, currentResDuracion);
      if (hora >= currentResEnd && hora < nextRes.hora && horaFin > nextRes.hora) return false;
    }
    return true;
  });
};

const checkTableConflicts = (table, reservations, fecha, hora, duracionReserva, currentReservationId, tableAvailability) => {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`[checkTableConflicts] 🔍 INICIANDO verificación Mesa ${table.numero} (ID: ${table.id})`);
  console.log(`  📅 Fecha: ${fecha}`);
  console.log(`  🕐 Hora propuesta: ${hora}`);
  console.log(`  ⏱️  Duración: ${duracionReserva} minutos`);
  
  if (!hora || !fecha || !duracionReserva) {
    console.log(`  ❌ Datos incompletos - sin conflicto por defecto`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    return { hasConflict: false, reason: '' };
  }
  
  if (table.activa === false) {
    console.log(`  🚫 Mesa bloqueada permanentemente (activa: false)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    return { hasConflict: true, reason: 'Mesa bloqueada permanentemente.' };
  }

  const unavailableTableIds = tableAvailability.filter(ta => ta.fecha === fecha).map(ta => ta.mesa_id);
  if (unavailableTableIds.includes(table.id)) {
    console.log(`  🚫 Mesa bloqueada manualmente para ${fecha}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    return { hasConflict: true, reason: 'Mesa bloqueada manualmente para este día.' };
  }
  
  if (table.estado === 'no_disponible') {
    console.log(`  🚫 Mesa con estado 'no_disponible'`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    return { hasConflict: true, reason: 'Mesa con estado "no disponible".' };
  }

  const horaFin = addMinutes(hora, duracionReserva);
  console.log(`  📍 Rango COMPLETO de la nueva reserva: ${hora} - ${horaFin} (${duracionReserva} min)`);
  
  const fechaNormalizada = fecha.trim();
  console.log(`  📅 Fecha normalizada: "${fechaNormalizada}"`);
  
  const reservacionesDelDia = reservations.filter(r => {
    const fechaReserva = r.fecha ? r.fecha.trim() : '';
    const esElMismoDia = fechaReserva === fechaNormalizada;
    const noEsCancelada = r.estado !== 'cancelada';
    const noEsCompletada = r.estado !== 'completada';
    const noEsNoShow = r.estado !== 'no_show';
    const noEsActual = r.id !== currentReservationId;
    
    return esElMismoDia && noEsCancelada && noEsCompletada && noEsNoShow && noEsActual;
  });

  console.log(`  📊 Total reservas activas del día: ${reservacionesDelDia.length}`);
  
  if (reservacionesDelDia.length > 0) {
    console.log(`  📋 Detalle de TODAS las reservas del día:`);
    reservacionesDelDia.forEach(r => {
      const duracion = r.duracion_estimada || duracionReserva;
      const fin = addMinutes(r.hora, duracion);
      console.log(`     - ${r.reservation_id}: Mesa ${r.mesa_numero} | ${r.hora} - ${fin} (${duracion} min) | ${r.cliente_nombre}`);
    });
  }

  const tableReservations = reservacionesDelDia.filter(r => {
    const esMesaPrincipal = r.mesa_id === table.id;
    const esMesaUnida = r.mesas_unidas && Array.isArray(r.mesas_unidas) && r.mesas_unidas.includes(table.id);
    const usaEstaMesa = esMesaPrincipal || esMesaUnida;
    
    if (usaEstaMesa) {
      console.log(`  ✓ Reserva ${r.reservation_id} USA esta mesa (principal: ${esMesaPrincipal}, unida: ${esMesaUnida})`);
    }
    
    return usaEstaMesa;
  });

  console.log(`\n  🎯 TOTAL de reservas que usan Mesa ${table.numero}: ${tableReservations.length}`);

  if (tableReservations.length === 0) {
    console.log(`  ✅ Mesa ${table.numero} SIN RESERVAS - DISPONIBLE`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    return { hasConflict: false, reason: '' };
  }

  console.log(`\n  🔍 VERIFICANDO SOLAPAMIENTOS:`);
  
  for (let i = 0; i < tableReservations.length; i++) {
    const reserva = tableReservations[i];
    const reservaDuracion = reserva.duracion_estimada || duracionReserva;
    const reservaHoraFin = addMinutes(reserva.hora, reservaDuracion);
    
    console.log(`\n  ┌─ Reserva ${i + 1}/${tableReservations.length}: ${reserva.reservation_id}`);
    console.log(`  │  Cliente: ${reserva.cliente_nombre}`);
    console.log(`  │  Estado: ${reserva.estado}`);
    console.log(`  │  Rango COMPLETO existente: ${reserva.hora} - ${reservaHoraFin} (${reservaDuracion} min)`);
    console.log(`  │  Rango COMPLETO propuesto: ${hora} - ${horaFin} (${duracionReserva} min)`);
    console.log(`  └─ Comparando...`);
    
    const overlaps = timeRangesOverlap(hora, horaFin, reserva.hora, reservaHoraFin);
    
    if (overlaps) {
      const conflictMessage = `Bloqueada de ${reserva.hora} a ${reservaHoraFin} (${Math.round(reservaDuracion)} min) - ${reserva.cliente_nombre}`;
      console.log(`\n  ❌❌❌ ¡CONFLICTO DETECTADO! ❌❌❌`);
      console.log(`     Mesa: ${table.numero}`);
      console.log(`     Mensaje: ${conflictMessage}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      
      return { 
        hasConflict: true, 
        reason: conflictMessage
      };
    } else {
      console.log(`     ✅ Sin conflicto con esta reserva`);
    }
  }

  console.log(`\n  ✅✅✅ Mesa ${table.numero} DISPONIBLE (sin conflictos) ✅✅✅`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  return { hasConflict: false, reason: '' };
};


const diagnoseAvailability = (tables, comensales, allowTableJoining) => {
  const activeTables = tables.filter(t => t.activa && t.estado !== 'no_disponible');
  const maxIndividualCapacity = activeTables.length > 0 ? Math.max(...activeTables.map(t => t.capacidad)) : 0;
  
  if (comensales > maxIndividualCapacity) {
    if (!allowTableJoining) {
      return {
        issue: 'capacity_exceeded_joining_disabled',
        message: `Necesitas ${comensales} personas, pero la mesa individual más grande disponible solo tiene capacidad para ${maxIndividualCapacity}. La unión de mesas está desactivada.`,
        suggestion: 'Activa la unión de mesas en Configuración -> General para permitir grupos grandes.'
      };
    } else {
      const tablesWithJoinGroup = activeTables.filter(t => t.join_group_id || (t.join_group_ids && t.join_group_ids.length > 0 && t.join_group_ids.some(id => id)));
      if (tablesWithJoinGroup.length === 0) {
        return {
          issue: 'no_join_groups_configured',
          message: `Necesitas ${comensales} personas, pero ninguna mesa tiene configurado un "Grupo de Unión" para poder unirse.`,
          suggestion: 'Ve a Floorplan y asigna un ID de "Grupo de Unión" a las mesas que se pueden unir.'
        };
      }
      return {
        issue: 'no_joined_capacity',
        message: `Incluso uniendo mesas, no se puede acomodar a ${comensales} personas en este momento.`,
        suggestion: 'Intenta reducir el número de comensales, o revisa la capacidad de las mesas unibles.'
      };
    }
  }
  return null;
};

export default function ReservationForm({ reservation, tables, customers, allReservations = [], schedules = [], specialDays = [], onSubmit, onCancel, isLoading, t, restaurantId }) {
  const [formData, setFormData] = useState({
    cliente_nombre: "", cliente_email: "", cliente_telefono: "",
    hora: "", comensales: 2,
    mesa_id: "", mesa_numero: "", mesas_unidas: [], mesas_numeros: [],
    notas: "", ocasion_especial: "ninguna", duracion_estimada: 90,
    preferencias: "",
    origen: "admin",
    ...reservation,
    fecha: reservation?.fecha ? new Date(reservation.fecha + 'T00:00:00') : new Date(),
    estado: reservation?.estado || "confirmada",
  });

  const [assignedTable, setAssignedTable] = useState(null);
  const [assignmentReason, setAssignmentReason] = useState("");
  const [assignmentWarning, setAssignmentWarning] = useState("");
  const [noTableAvailable, setNoTableAvailable] = useState(false);
  const [customerPreferences, setCustomerPreferences] = useState("");
  const [availableTimes, setAvailableTimes] = useState([]);
  const [isDayClosed, setIsDayClosed] = useState(false);
  const [availableTablesForManual, setAvailableTablesForManual] = useState([]);
  const [allTablesForManual, setAllTablesForManual] = useState([]);
  const [tableConflicts, setTableConflicts] = useState({});
  const [openCustomerSelect, setOpenCustomerSelect] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [manualOverride, setManualOverride] = useState(false);
  const [shouldAssignTable, setShouldAssignTable] = useState(false);
  const [selectedManualTables, setSelectedManualTables] = useState([]);
  const [availabilityDiagnosis, setAvailabilityDiagnosis] = useState(null);
  const [allowPastTimes, setAllowPastTimes] = useState(false);
  const [selectedWaiterId, setSelectedWaiterId] = useState(reservation?.waiter_id || '');
  
  const { user } = useRestaurant();

  const { data: latestReservations = [] } = useQuery({
    queryKey: ['latestReservationId', restaurantId],
    queryFn: async () => {
      const results = await base44.entities.Reservation.filter(
        { restaurant_id: restaurantId },
        '-created_date',
        50
      );
      return results;
    },
    enabled: !!restaurantId && !reservation,
    staleTime: 0,
    cacheTime: 0,
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['restaurantConfig', restaurantId],
    queryFn: () => base44.entities.RestaurantConfig.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 0,
    cacheTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const { data: tableAvailability = [] } = useQuery({
    queryKey: ['tableAvailability', restaurantId],
    queryFn: () => base44.entities.TableAvailability.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 0,
    cacheTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const { data: freshTables = [] } = useQuery({
    queryKey: ['tables-form', restaurantId],
    queryFn: () => base44.entities.Table.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 0,
    cacheTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const { data: freshReservations = [] } = useQuery({
    queryKey: ['reservations-form', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 0,
    cacheTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
  });

  const effectiveReservations = freshReservations.length > 0 ? freshReservations : allReservations;
  const effectiveTables = freshTables.length > 0 ? freshTables : tables;
  const config = configs[0];
  const duracionDefault = config?.duracion_reserva_default || 90;
  const totalCapacity = config?.capacidad_total || 100;
  const colorPrimario = config?.color_primario || '#1e3a8a';
  const colorAccento = config?.color_acento || '#f59e0b';
  const allowTableJoining = config?.allow_table_joining || false;

  const { data: waiters = [] } = useQuery({
    queryKey: ['waiters', restaurantId],
    queryFn: () => base44.entities.Waiter.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const calculateEffectiveDuration = (fechaString) => {
    if (!fechaString) {
      console.log(`[calculateEffectiveDuration] ⚠️ Sin fecha | Duración: ${duracionDefault} min (Default)`);
      return duracionDefault;
    }
    
    // Normalizar la fecha para asegurar comparación correcta
    const targetDate = new Date(fechaString + 'T00:00:00');
    const formattedDate = format(targetDate, 'yyyy-MM-dd');

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[calculateEffectiveDuration] 🔍 CALCULANDO DURACIÓN`);
    console.log(`  📅 Fecha recibida: ${fechaString}`);
    console.log(`  📅 Fecha formateada: ${formattedDate}`);
    console.log(`  📊 Total días especiales: ${specialDays.length}`);
    console.log(`  📊 Total horarios semanales: ${schedules.length}`);

    // PRIORIDAD 1: Día especial (tiene prioridad sobre todo)
    const specialDay = specialDays.find(sd => sd.date === formattedDate);
    console.log(`  🔎 Buscando día especial para: ${formattedDate}`);
    if (specialDay) {
      console.log(`  ✅ Día especial encontrado: "${specialDay.name}"`);
      console.log(`     - date: ${specialDay.date}`);
      console.log(`     - duracion_reserva_default: ${specialDay.duracion_reserva_default}`);
      console.log(`     - tipo: ${typeof specialDay.duracion_reserva_default}`);
      
      if (typeof specialDay.duracion_reserva_default === 'number') {
        console.log(`  🎯 RESULTADO: ${specialDay.duracion_reserva_default} min (Día Especial: ${specialDay.name})`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        return specialDay.duracion_reserva_default;
      } else {
        console.log(`  ⚠️ Día especial encontrado pero duracion_reserva_default no es un número válido`);
      }
    } else {
      console.log(`  ❌ No se encontró día especial para ${formattedDate}`);
      if (specialDays.length > 0) {
        console.log(`  📋 Días especiales disponibles:`);
        specialDays.forEach(sd => {
          console.log(`     - ${sd.date} (${sd.name}) - ${sd.duracion_reserva_default} min`);
        });
      }
    }

    // PRIORIDAD 2: Horario del día de la semana
    const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    const dayOfWeekName = dayNames[targetDate.getDay()];
    console.log(`  🔎 Buscando horario semanal para: ${dayOfWeekName}`);
    const daySchedule = schedules.find(s => s.day_of_week === dayOfWeekName);
    if (daySchedule) {
      console.log(`  ✅ Horario semanal encontrado para ${dayOfWeekName}`);
      console.log(`     - duracion_reserva_default: ${daySchedule.duracion_reserva_default}`);
      if (typeof daySchedule.duracion_reserva_default === 'number') {
        console.log(`  📅 RESULTADO: ${daySchedule.duracion_reserva_default} min (Horario: ${dayOfWeekName})`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        return daySchedule.duracion_reserva_default;
      }
    } else {
      console.log(`  ❌ No se encontró horario semanal para ${dayOfWeekName}`);
    }

    // PRIORIDAD 3: Duración por defecto del restaurante
    console.log(`  ⚙️ RESULTADO: ${duracionDefault} min (Default del restaurante)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    return duracionDefault;
  };

  const duracionReserva = calculateEffectiveDuration(formData.fecha ? format(formData.fecha, 'yyyy-MM-dd') : null);
  
  console.log(`[ReservationForm] 📊 Duración calculada para usar: ${duracionReserva} min | formData.duracion_estimada: ${formData.duracion_estimada} min`);

  useEffect(() => {
    if (!reservation && !manualOverride && formData.comensales && formData.fecha && formData.hora) {
      setShouldAssignTable(true);
    }
  }, [formData.comensales, formData.fecha, formData.hora, formData.cliente_id, manualOverride, reservation]);

  useEffect(() => {
    if (reservation && reservation.mesa_id) {
      setManualOverride(true);
      const tableIds = [reservation.mesa_id];
      if (reservation.mesas_unidas && reservation.mesas_unidas.length > 0) tableIds.push(...reservation.mesas_unidas);
      setSelectedManualTables(tableIds);
    } else {
      setManualOverride(false);
      setSelectedManualTables([]);
    }
    if (reservation && reservation.cliente_id && customers.length > 0) {
      const existingCustomer = customers.find(c => c.id === reservation.cliente_id);
      if (existingCustomer) {
        setCustomerPreferences(existingCustomer.preferencias || "");
        setFormData(prev => ({ ...prev, preferencias: existingCustomer.preferencias || "" }));
      }
    }
  }, [reservation, customers]);

  useEffect(() => {
    const effectiveDuration = calculateEffectiveDuration(formData.fecha ? format(formData.fecha, 'yyyy-MM-dd') : null);
    console.log(`[useEffect duracion] Actualizando duración a: ${effectiveDuration} min`);
    setFormData(prev => ({ ...prev, duracion_estimada: effectiveDuration }));
  }, [config, formData.fecha, schedules, specialDays, duracionDefault]);


  useEffect(() => {
    if (!formData.fecha || !formData.comensales) {
      setAvailableTimes([]);
      setIsDayClosed(false);
      setAvailabilityDiagnosis(null);
      return;
    }

    const date = formData.fecha;
    const formattedDate = format(date, 'yyyy-MM-dd');

    if (allowPastTimes) {
      const allTimes = [];
      for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
          const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
          allTimes.push(timeStr);
        }
      }
      setAvailableTimes(allTimes);
      setIsDayClosed(false);
      setAvailabilityDiagnosis(null);
      return;
    }

    if (!schedules || !specialDays) {
      setAvailableTimes([]);
      setIsDayClosed(false);
      setAvailabilityDiagnosis(null);
      return;
    }

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
      setIsDayClosed(true);
      setAvailableTimes([]);
      if (!reservation) {
        setFormData(prev => ({ ...prev, hora: "" }));
      }
      setAvailabilityDiagnosis(null);
      return;
    }

    setIsDayClosed(false);

    const allPossibleTimes = [];
    daySchedule.slots.forEach(slot => {
      const start = new Date(`1970-01-01T${slot.opening_time}`);
      const end = new Date(`1970-01-01T${slot.closing_time}`);
      for (let d = new Date(start); d.getTime() <= end.getTime(); d.setMinutes(d.getMinutes() + 15)) {
        allPossibleTimes.push(format(d, 'HH:mm'));
      }
    });

    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    const currentTime = format(now, 'HH:mm');

    const activeTablesForIntelligent = effectiveTables.filter(t => 
      (t.activa === true || t.activa === undefined) && 
      t.estado !== 'no_disponible'
    );

    const timesWithAvailability = allPossibleTimes.filter(hora => {
      if (formattedDate === today && hora <= currentTime) return false;
      const result = findOptimalTable(activeTablesForIntelligent, effectiveReservations, formData.comensales, formattedDate, hora, customerPreferences, reservation?.id, duracionReserva, customers, formData.cliente_id, totalCapacity, tableAvailability, allowTableJoining);
      if (result === null) {
        console.log(`[useEffect time availability] findOptimalTable returned null for hora: ${hora}. Check inputs.`);
        return false;
      }
      return result.table;
    });

    if (reservation && reservation.hora && !timesWithAvailability.includes(reservation.hora)) {
      timesWithAvailability.push(reservation.hora);
      timesWithAvailability.sort((a, b) => {
        const timeA = new Date(`1970-01-01T${a}`);
        const timeB = new Date(`1970-01-01T${b}`);
        return timeA - timeB;
      });
    }

    timesWithAvailability.sort((a, b) => {
      const timeA = new Date(`1970-01-01T${a}`);
      const timeB = new Date(`1970-01-01T${b}`);
      return timeA - timeB;
    });

    setAvailableTimes(timesWithAvailability);

    if (timesWithAvailability.length === 0) {
      const diagnosis = diagnoseAvailability(activeTablesForIntelligent, formData.comensales, allowTableJoining);
      setAvailabilityDiagnosis(diagnosis);
    } else {
      setAvailabilityDiagnosis(null);
    }

    if (!reservation && formData.hora && !timesWithAvailability.includes(formData.hora)) {
      setFormData(prev => ({ ...prev, hora: "" }));
    }
  }, [formData.fecha, formData.comensales, schedules, specialDays, effectiveTables, effectiveReservations, customerPreferences, reservation?.id, duracionReserva, customers, formData.cliente_id, totalCapacity, tableAvailability, allowTableJoining, reservation, allowPastTimes]);

  useEffect(() => {
    if (formData.fecha && formData.hora && duracionReserva) {
      const formattedDate = format(formData.fecha, 'yyyy-MM-dd');
      const available = getAvailableTablesAtTime(effectiveTables, effectiveReservations, formattedDate, formData.hora, duracionReserva, reservation?.id, tableAvailability);
      setAvailableTablesForManual(available);
      
      const allActive = effectiveTables.filter(t => t.estado !== 'no_disponible');
      setAllTablesForManual(allActive);
      
      console.log('\n🔄 RECALCULANDO CONFLICTOS PARA TODAS LAS MESAS');
      console.log(`📅 Fecha: ${formattedDate}`);
      console.log(`🕐 Hora: ${formData.hora}`);
      console.log(`⏱️  Duración: ${duracionReserva} min`);
      console.log(`📊 Total mesas para selección manual: ${allActive.length}`);
      console.log(`📊 Total reservas en base de datos: ${effectiveReservations.length}`);
      
      const conflicts = {};
      allActive.forEach(table => {
        const conflict = checkTableConflicts(
          table, 
          effectiveReservations,
          formattedDate, 
          formData.hora, 
          duracionReserva, 
          reservation?.id, 
          tableAvailability
        );
        conflicts[table.id] = conflict;
        
        if (conflict.hasConflict) {
          console.log(`  ⚠️ Mesa ${table.numero}: ${conflict.reason}`);
        }
      });
      
      setTableConflicts(conflicts);
      
      const conflictCount = Object.values(conflicts).filter(c => c.hasConflict).length;
      const availableCount = allActive.length - conflictCount;
      console.log(`\n📊 Resumen: ${availableCount} mesas LIBRES | ${conflictCount} con conflicto | ${allActive.length} totales\n`);
    } else {
      setAvailableTablesForManual([]);
      setAllTablesForManual([]);
      setTableConflicts({});
    }
  }, [formData.fecha, formData.hora, effectiveTables, effectiveReservations, duracionReserva, reservation?.id, tableAvailability]);

  useEffect(() => {
    if (manualOverride) {
      setShouldAssignTable(false);
      return;
    }
    if (reservation) return;
    if (!reservation && !shouldAssignTable) return;

    if (!formData.comensales || !formData.fecha || !formData.hora || !effectiveTables.length || !duracionReserva) {
      setAssignedTable(null);
      setAssignmentReason("");
      setAssignmentWarning("");
      setNoTableAvailable(false);
      setFormData(prev => ({ ...prev, mesa_id: "", mesa_numero: "", mesas_unidas: [], mesas_numeros: [] }));
      setShouldAssignTable(false);
      return;
    }
    
    const formattedDate = format(formData.fecha, 'yyyy-MM-dd');
    
    const activeTablesForIntelligent = effectiveTables.filter(t => 
      (t.activa === true || t.activa === undefined) && 
      t.estado !== 'no_disponible'
    );
    
    console.log(`\n🤖 [ASIGNACIÓN INTELIGENTE] Iniciando...`);
    console.log(`   Total mesas en BD: ${effectiveTables.length}`);
    console.log(`   Mesas activas para inteligente: ${activeTablesForIntelligent.length}`);
    console.log(`   Fecha: ${formattedDate}, Hora: ${formData.hora}, Comensales: ${formData.comensales}`);
    
    const result = findOptimalTable(
      activeTablesForIntelligent,
      effectiveReservations,
      formData.comensales, 
      formattedDate, 
      formData.hora, 
      customerPreferences, 
      reservation?.id, 
      duracionReserva, 
      customers, 
      formData.cliente_id, 
      totalCapacity, 
      tableAvailability, 
      allowTableJoining
    );

    if (result && result.table) {
      setAssignedTable(result.table);
      setAssignmentReason(result.reason);
      setAssignmentWarning(result.warning || "");
      
      if (result.isJoined && result.allTables) {
        const primaryTable = result.allTables[0];
        const additionalTables = result.allTables.slice(1);
        
        setFormData(prev => ({
          ...prev,
          mesa_id: primaryTable.id,
          mesa_numero: primaryTable.numero,
          mesas_unidas: additionalTables.map(t => t.id),
          mesas_numeros: result.allTables.map(t => t.numero),
          duracion_estimada: duracionReserva
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          mesa_id: result.table.id,
          mesa_numero: result.table.numero,
          mesas_unidas: [],
          mesas_numeros: [result.table.numero],
          duracion_estimada: duracionReserva
        }));
      }
      setNoTableAvailable(false);
    } else if (result && result.isAlternative) {
      setAssignedTable(null);
      setAssignmentReason(result.reason);
      setAssignmentWarning(result.warning || "");
      setNoTableAvailable(true);
      setFormData(prev => ({ ...prev, mesa_id: "", mesa_numero: "", mesas_unidas: [], mesas_numeros: [] }));
    } else {
      setAssignedTable(null);
      setAssignmentReason("");
      setAssignmentWarning("");
      setNoTableAvailable(false);
      setFormData(prev => ({ ...prev, mesa_id: "", mesa_numero: "", mesas_unidas: [], mesas_numeros: [] }));
    }
    setShouldAssignTable(false);
  }, [formData.comensales, formData.fecha, formData.hora, formData.cliente_id, customerPreferences, manualOverride, effectiveTables, effectiveReservations, reservation, duracionReserva, customers, totalCapacity, tableAvailability, shouldAssignTable, allowTableJoining]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (noTableAvailable && !formData.mesa_id) {
      alert("No hay mesas disponibles para este horario. Por favor, selecciona otro horario o asigna una mesa manualmente.");
      return;
    }
    
    let finalReservationId = formData.reservation_id;
    if (!reservation && !finalReservationId) {
      const currentYear = new Date().getFullYear();
      const yearPrefix = `R-${currentYear}-`;
      
      const existingIds = latestReservations
        .filter(r => r.reservation_id && r.reservation_id.startsWith(yearPrefix))
        .map(r => {
          const parts = r.reservation_id.split('-');
          return parts.length === 3 ? parseInt(parts[2], 10) : 0;
        })
        .filter(num => !isNaN(num));
      
      const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
      finalReservationId = `${yearPrefix}${String(maxId + 1).padStart(4, '0')}`;
    }
    
    const dataToSubmit = {
      ...formData,
      fecha: format(formData.fecha, 'yyyy-MM-dd'),
      waiter_id: selectedWaiterId || null,
      waiter_name: selectedWaiterId ? waiters.find(w => w.id === selectedWaiterId)?.nombre : null,
      reservation_id: finalReservationId,
      created_by: user?.email || formData.created_by,
    };
    onSubmit(dataToSubmit);
  };

  const handleCustomerSelect = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setCustomerPreferences(customer.preferencias || "");
      setFormData(prev => ({
        ...prev,
        cliente_id: customer.id,
        cliente_nombre: customer.nombre,
        cliente_email: customer.email,
        cliente_telefono: customer.telefono,
        preferencias: customer.preferencias || "",
        notas: prev.notas,
      }));
    } else {
      setCustomerPreferences("");
      setFormData(prev => ({ ...prev, cliente_id: "", cliente_nombre: "", cliente_email: "", cliente_telefono: "", preferencias: "", notas: "" }));
    }
    setOpenCustomerSelect(false);
  };

  const handleManualTableToggle = (tableId) => {
    setSelectedManualTables(prev => {
      const isSelected = prev.includes(tableId);
      if (isSelected) {
        return prev.filter(id => id !== tableId);
      } else {
        if (!formData.fecha || !formData.hora) return prev;
        return [...prev, tableId];
      }
    });
  };

  const handleApplyManualSelection = () => {
    if (selectedManualTables.length === 0) {
      setFormData(prev => ({ ...prev, mesa_id: "", mesa_numero: "", mesas_unidas: [], mesas_numeros: [] }));
      setManualOverride(false);
      setAssignedTable(null);
      setAssignmentReason("");
      setAssignmentWarning("");
      toast.success("Selección manual limpiada");
      return;
    }

    setManualOverride(true);
    const selectedTablesObjects = effectiveTables.filter(t => selectedManualTables.includes(t.id));
    selectedTablesObjects.sort((a, b) => a.numero - b.numero);
    const primaryTable = selectedTablesObjects[0];
    const additionalTables = selectedTablesObjects.slice(1);
    const totalCapacityManual = selectedTablesObjects.reduce((sum, t) => sum + t.capacidad, 0);
    const selectedTableNumbers = selectedTablesObjects.map(t => t.numero);

    setAssignedTable(null);
    setNoTableAvailable(false);
    setFormData(prev => ({
      ...prev,
      mesa_id: primaryTable.id,
      mesa_numero: primaryTable.numero,
      mesas_unidas: additionalTables.map(t => t.id),
      mesas_numeros: selectedTableNumbers
    }));

    let reason = "Mesa(s) asignada(s) manualmente.";
    let warning = "";
    
    const hasAnyConflict = selectedManualTables.some(id => tableConflicts[id]?.hasConflict);
    
    const hasPermanentlyBlocked = selectedTablesObjects.some(t => t.activa === false);

    if (selectedManualTables.length > 1) {
      warning = `${selectedManualTables.length} mesas unidas: ${selectedTableNumbers.join(', ')}. Capacidad total: ${totalCapacityManual} personas.`;
      toast.success(`Selección manual aplicada: ${selectedManualTables.length} mesas unidas (${selectedTableNumbers.join(', ')})`);
    } else {
      warning = `Mesa ${primaryTable.numero} (Capacidad: ${primaryTable.capacidad} personas).`;
      toast.success(`Selección manual aplicada: Mesa ${primaryTable.numero}`);
    }

    if (hasPermanentlyBlocked) {
      warning += " ⚠️ INCLUYE MESA(S) BLOQUEADA(S) PERMANENTEMENTE - Solo permitido en selección manual.";
      toast.warning("⚠️ Has seleccionado mesa(s) bloqueada(s) permanentemente");
    } else if (hasAnyConflict) {
      warning += " La selección manual ignora todas las restricciones, incluyendo conflictos.";
      toast.warning("⚠️ Mesa(s) con conflictos seleccionadas");
    } else {
      warning += " La asignación manual anula las reglas de negocio.";
    }

    setAssignmentReason(reason);
    setAssignmentWarning(warning);
  };

  const disabledDays = (date) => {
    if (isBefore(startOfDay(date), startOfDay(new Date()))) return true;
    if (!schedules || schedules.length === 0 || !effectiveTables || effectiveTables.length === 0) return true;
    return !isDayAvailable(date, effectiveTables, effectiveReservations, schedules, specialDays, calculateEffectiveDuration, customers, totalCapacity, tableAvailability, allowTableJoining);
  };

  const filteredCustomers = React.useMemo(() => {
    if (!customerSearch) return customers;
    const searchNormalized = normalizeText(customerSearch);
    return customers.filter(customer => {
      const nombreNormalized = normalizeText(customer.nombre || '');
      const emailNormalized = normalizeText(customer.email || '');
      const telefonoNormalized = normalizeText(customer.telefono || '');
      return nombreNormalized.includes(searchNormalized) || emailNormalized.includes(searchNormalized) || telefonoNormalized.includes(searchNormalized);
    });
  }, [customers, customerSearch]);

  const hasSchedules = schedules.length > 0 || specialDays.length > 0;
  const isSubmitDisabled = isLoading || !formData.cliente_nombre || !formData.fecha || !formData.hora || !formData.comensales || !selectedWaiterId;

  return (
    <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <CardTitle className="text-slate-900 dark:text-white text-lg md:text-xl">
          {reservation ? t('reservations.editReservation') : t('reservations.newReservation')}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onCancel} className="text-slate-900 dark:text-white p-0 h-auto">
          <X className="w-4 h-4" />
        </Button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        {!reservation && (
          <div className="space-y-2">
            <Label htmlFor="origen" className="text-slate-700 dark:text-slate-300">
              Tipo de reserva
            </Label>
            <Select
              value={formData.origen}
              onValueChange={(value) => setFormData({ ...formData, origen: value })}
            >
              <SelectTrigger className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                <SelectValue placeholder="Selecciona el tipo" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-800">
                <SelectItem value="admin">Reserva Normal (Admin)</SelectItem>
                <SelectItem value="walk_in">Walk-in (Sin reserva)</SelectItem>
              </SelectContent>
            </Select>
            {formData.origen === 'walk_in' && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                ℹ️ Walk-in: Cliente que llega sin reserva previa
              </p>
            )}
          </div>
        )}

        {!hasSchedules && (
          <Alert className="mb-3 border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 text-sm">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-900 dark:text-amber-300">
              <p className="font-semibold text-sm">No hay horarios configurados</p>
              <p className="text-xs mt-1">Por favor, configura los horarios del restaurante en la sección "Horarios" antes de crear reservas.</p>
            </AlertDescription>
          </Alert>
        )}
        {(!effectiveTables || effectiveTables.length === 0) && (
          <Alert className="mb-3 border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 text-sm">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-900 dark:text-amber-300">
              <p className="font-semibold text-sm">No hay mesas configuradas</p>
              <p className="text-xs mt-1">Por favor, configura las mesas del restaurante en la sección "Mesas" antes de crear reservas.</p>
            </AlertDescription>
          </Alert>
        )}

        {availabilityDiagnosis && (
          <Alert className="mb-3 border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800 text-sm">
            <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <AlertDescription className="text-orange-900 dark:text-orange-300">
              <p className="font-semibold text-sm">Sin horarios disponibles</p>
              <p className="text-sm mt-1">{availabilityDiagnosis.message}</p>
              <p className="text-xs mt-2 font-medium">💡 Solución: {availabilityDiagnosis.suggestion}</p>
            </AlertDescription>
          </Alert>
        )}

          <div className="grid gap-3 md:gap-4">
            <div className="space-y-2">
              <Label className="text-sm md:text-base text-slate-900 dark:text-white">{t('reservations.form.existingCustomer')}</Label>
              <Popover open={openCustomerSelect} onOpenChange={setOpenCustomerSelect}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={openCustomerSelect} className="w-full justify-between bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm h-9 px-3">
                    {formData.cliente_id ? customers.find((customer) => customer.id === formData.cliente_id)?.nombre : t('reservations.form.selectCustomer')}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full sm:w-[400px] p-0 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                  <Command shouldFilter={false} className="bg-white dark:bg-slate-800">
                    <CommandInput placeholder="Buscar cliente por nombre, email o teléfono..." value={customerSearch} onValueChange={setCustomerSearch} className="text-slate-900 dark:text-white" />
                    <CommandEmpty className="text-slate-500 dark:text-slate-400 p-4">No se encontró ningún cliente.</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto bg-white dark:bg-slate-800">
                      {filteredCustomers.map((customer) => (
                        <CommandItem key={customer.id} value={customer.id} onSelect={() => handleCustomerSelect(customer.id)} className="text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                          <Check className={cn("mr-2 h-4 w-4", formData.cliente_id === customer.id ? "opacity-100" : "opacity-0")} />
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-900 dark:text-white">{customer.nombre}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">{customer.email} • {customer.telefono}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-3 md:grid-cols-2 md:gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombre" className="text-sm md:text-base text-slate-900 dark:text-white">{t('reservations.form.name')} *</Label>
                <Input id="nombre" required value={formData.cliente_nombre} onChange={(e) => setFormData({ ...formData, cliente_nombre: e.target.value })} placeholder="Nombre del cliente" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm h-9" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm md:text-base text-slate-900 dark:text-white">{t('reservations.form.email')}</Label>
                <Input id="email" type="email" value={formData.cliente_email} onChange={(e) => setFormData({ ...formData, cliente_email: e.target.value })} placeholder="email@ejemplo.com" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm h-9" />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 md:gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefono" className="text-sm md:text-base text-slate-900 dark:text-white">{t('reservations.form.phone')}</Label>
                <Input id="telefono" value={formData.cliente_telefono} onChange={(e) => setFormData({ ...formData, cliente_telefono: e.target.value })} placeholder="+34 600 000 000" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm h-9" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comensales" className="text-sm md:text-base text-slate-900 dark:text-white">{t('reservations.form.guests')} *</Label>
                <Input
                  id="comensales"
                  type="number"
                  min="1"
                  max="999"
                  value={formData.comensales}
                  onChange={(e) => setFormData({ ...formData, comensales: parseInt(e.target.value) })}
                  required
                  className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm h-9"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Formulario interno: sin límite de comensales
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 md:gap-4">
              <div className="space-y-2">
                <Label htmlFor="fecha" className="text-sm md:text-base text-slate-900 dark:text-white">{t('reservations.form.date')} *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button id="fecha" variant="outline" className="w-full justify-start text-left font-normal bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm h-9 px-3" disabled={!hasSchedules || !effectiveTables || effectiveTables.length === 0}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.fecha ? format(formData.fecha, 'PPP', { locale: es }) : t('reservations.form.selectDate')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                    <Calendar 
                      mode="single" 
                      selected={formData.fecha || undefined} 
                      onSelect={(date) => { if (date) setFormData({ ...formData, fecha: date }); }} 
                      disabled={disabledDays} 
                      initialFocus 
                      locale={es} 
                      className="rounded-md" 
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-slate-500 dark:text-slate-400">{!hasSchedules ? "Configura horarios primero" : !effectiveTables || effectiveTables.length === 0 ? "Configura mesas primero" : "Solo días con disponibilidad"}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hora" className="text-sm md:text-base text-slate-900 dark:text-white">{t('reservations.form.time')} *</Label>
                <Select required value={formData.hora} onValueChange={(value) => setFormData({ ...formData, hora: value })} disabled={!allowPastTimes && (isDayClosed || availableTimes.length === 0 || !formData.comensales || !formData.fecha)}>
                  <SelectTrigger id="hora" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm h-9 px-3">
                    <SelectValue placeholder={
                      allowPastTimes 
                        ? "Selecciona una hora..."
                        : isDayClosed 
                        ? "Restaurante cerrado" 
                        : !formData.fecha 
                        ? "Selecciona una fecha primero" 
                        : !formData.comensales 
                        ? "Selecciona comensales primero" 
                        : availableTimes.length === 0 
                        ? "Sin disponibilidad" 
                        : t('reservations.form.selectTime')
                    } />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-800 max-h-64">
                    {availableTimes.map(time => (
                      <SelectItem key={time} value={time} className="text-sm text-slate-900 dark:text-white">{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 mt-2">
                  <Checkbox 
                    id="allowPastTimes" 
                    checked={allowPastTimes} 
                    onCheckedChange={setAllowPastTimes}
                  />
                  <Label 
                    htmlFor="allowPastTimes" 
                    className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
                  >
                    Ignorar restricciones de hora
                  </Label>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {allowPastTimes 
                    ? "⚠️ Se mostrarán todas las horas del día" 
                    : formData.fecha && formData.comensales && availableTimes.length === 0 
                    ? "No hay disponibilidad para este número de comensales" 
                    : "Solo horas con mesas disponibles"}
                </p>
              </div>
            </div>
          </div>

          {assignedTable && (
            <Alert className="mb-3 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800">
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <AlertDescription className="text-emerald-900 dark:text-emerald-200 text-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Mesa asignada automáticamente
                    </p>
                    <p className="text-sm mt-1">Mesa <strong>{formData.mesa_numero}</strong> ({assignedTable.capacidad} personas) - Área: {assignedTable.sala}</p>
                    {formData.mesas_unidas && formData.mesas_unidas.length > 0 && (
                      <p className="text-xs mt-1 text-emerald-700 dark:text-emerald-300">Mesas unidas: {formData.mesas_numeros.join(', ')}</p>
                    )}
                    <p className="text-xs mt-1 text-emerald-700 dark:text-emerald-300">{assignmentReason}</p>
                    {assignmentWarning && (
                      <p className="text-xs mt-1 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {assignmentWarning}
                      </p>
                    )}
                    <p className="text-xs mt-1 text-emerald-600 dark:text-emerald-400">Bloqueada de {formData.hora} a {addMinutes(formData.hora, duracionReserva)} ({Math.round(duracionReserva)} min)</p>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {noTableAvailable && (
            <Alert variant="destructive" className="mb-3 border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 text-sm">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <AlertDescription className="text-red-900 dark:text-red-200">
                <p className="font-semibold text-sm">No hay mesas disponibles</p>
                <p className="text-sm mt-1">{assignmentReason || `No hay mesas disponibles para ${formData.comensales} personas el ${format(formData.fecha, 'yyyy-MM-dd')} a las ${formData.hora}.`}</p>
                {assignmentWarning && <p className="text-xs mt-2 text-red-700 dark:text-red-300">{assignmentWarning}</p>}
                <p className="text-xs mt-2 text-red-700 dark:text-red-300">Por favor, selecciona otro horario o asigna una mesa manualmente.</p>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label className="text-sm md:text-base text-slate-900 dark:text-white">
              {allowTableJoining ? "Mesas (Selección múltiple permitida)" : "Mesa"}
              {assignedTable ? " (Cambiar si es necesario)" : " (Asignar manualmente)"}
            </Label>
            
            {allowTableJoining ? (
              <div className="space-y-2">
                <div className="border border-slate-200 dark:border-slate-700 rounded-md max-h-48 overflow-y-auto bg-white dark:bg-slate-800 p-2">
                  {!formData.fecha || !formData.hora ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">Selecciona fecha y hora primero</p>
                  ) : allTablesForManual.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">No hay mesas configuradas</p>
                  ) : (
                    allTablesForManual.sort((a, b) => a.numero - b.numero).map(table => {
                      const conflict = tableConflicts[table.id];
                      const hasConflict = conflict?.hasConflict;
                      const isPermanentlyBlocked = table.activa === false;
                      
                      return (
                        <div 
                          key={table.id} 
                          className={cn(
                            "flex items-start space-x-2 py-2 px-2 rounded transition-colors",
                            isPermanentlyBlocked
                              ? "hover:bg-orange-50 dark:hover:bg-orange-900/20"
                              : hasConflict 
                              ? "hover:bg-red-50 dark:hover:bg-red-900/20" 
                              : "hover:bg-slate-50 dark:hover:bg-slate-700"
                          )}
                        >
                          <Checkbox 
                            id={`table-${table.id}`} 
                            checked={selectedManualTables.includes(table.id)} 
                            onCheckedChange={() => handleManualTableToggle(table.id)} 
                            disabled={!formData.fecha || !formData.hora}
                          />
                          <label 
                            htmlFor={`table-${table.id}`} 
                            className="text-sm cursor-pointer flex-1"
                          >
                            <div className={cn(
                              "font-medium",
                              isPermanentlyBlocked
                                ? "text-orange-700 dark:text-orange-400"
                                : hasConflict 
                                ? "text-red-700 dark:text-red-400" 
                                : "text-slate-900 dark:text-white"
                            )}>
                              Mesa {table.numero} ({table.capacidad} personas) - {table.sala}
                              {isPermanentlyBlocked && (
                                <span className="ml-2 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 px-2 py-0.5 rounded font-medium">
                                  🔒 Bloqueada Permanentemente
                                </span>
                              )}
                              {!isPermanentlyBlocked && hasConflict && (
                                <span className="ml-2 text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 px-2 py-0.5 rounded">
                                  ⚠️ Conflicto
                                </span>
                              )}
                            </div>
                            {isPermanentlyBlocked && (
                              <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                                Solo disponible mediante selección manual en formulario interno
                              </div>
                            )}
                            {!isPermanentlyBlocked && hasConflict && (
                              <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                                {conflict.reason}
                              </div>
                            )}
                          </label>
                        </div>
                      );
                    })
                  )}
                </div>
                
                {selectedManualTables.length > 0 && (
                  <Alert className={cn(
                    "border-2",
                    selectedManualTables.some(id => {
                      const table = effectiveTables.find(t => t.id === id);
                      return table?.activa === false;
                    })
                      ? "bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-800"
                      : selectedManualTables.some(id => tableConflicts[id]?.hasConflict)
                      ? "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800"
                      : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                  )}>
                    <LinkIcon className={cn(
                      "h-4 w-4",
                      selectedManualTables.some(id => {
                        const table = effectiveTables.find(t => t.id === id);
                        return table?.activa === false;
                      })
                        ? "text-orange-600 dark:text-orange-400"
                        : selectedManualTables.some(id => tableConflicts[id]?.hasConflict)
                        ? "text-red-600 dark:text-red-400"
                        : "text-blue-600 dark:text-blue-400"
                    )} />
                    <AlertDescription className={cn(
                      "text-sm",
                      selectedManualTables.some(id => {
                        const table = effectiveTables.find(t => t.id === id);
                        return table?.activa === false;
                      })
                        ? "text-orange-900 dark:text-orange-300"
                        : selectedManualTables.some(id => tableConflicts[id]?.hasConflict)
                        ? "text-red-900 dark:text-red-300"
                        : "text-blue-900 dark:text-blue-300"
                    )}>
                      <p className="font-semibold">
                        {selectedManualTables.some(id => {
                          const table = effectiveTables.find(t => t.id === id);
                          return table?.activa === false;
                        }) && (
                          <span>🔒 Selección manual con mesa(s) bloqueada(s) permanentemente - </span>
                        )}
                        {!selectedManualTables.some(id => {
                          const table = effectiveTables.find(t => t.id === id);
                          return table?.activa === false;
                        }) && selectedManualTables.some(id => tableConflicts[id]?.hasConflict) && (
                          <span>⚠️ Selección manual con conflictos - </span>
                        )}
                        {selectedManualTables.length} mesa(s) seleccionada(s)
                      </p>
                      <p className="text-xs mt-1">
                        Mesas: {effectiveTables.filter(t => selectedManualTables.includes(t.id)).map(t => t.numero).join(', ')}
                        <br />
                        Capacidad total: {effectiveTables.filter(t => selectedManualTables.includes(t.id)).reduce((sum, t) => sum + t.capacidad, 0)} personas
                      </p>
                      {selectedManualTables.some(id => {
                        const table = effectiveTables.find(t => t.id === id);
                        return table?.activa === false;
                      }) && (
                        <p className="text-xs mt-2 font-semibold">
                          Las mesas bloqueadas permanentemente SOLO se pueden usar con selección manual en el formulario interno.
                        </p>
                      )}
                      {!selectedManualTables.some(id => {
                        const table = effectiveTables.find(t => t.id === id);
                        return table?.activa === false;
                      }) && selectedManualTables.some(id => tableConflicts[id]?.hasConflict) && (
                        <p className="text-xs mt-2 font-semibold">
                          La selección manual ignora todas las restricciones. Asegúrate de gestionar los conflictos manualmente.
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleApplyManualSelection} 
                  disabled={!formData.fecha || !formData.hora || (selectedManualTables.length === 0 && !formData.mesa_id)} 
                  className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700" 
                  size="sm"
                >
                  {selectedManualTables.length > 0 || formData.mesa_id ? "Aplicar Selección Manual" : "Limpiar Selección"}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Select 
                  value={formData.mesa_id} 
                  onValueChange={(value) => {
                    const table = effectiveTables.find(t => t.id === value);
                    setFormData(prev => ({ 
                      ...prev, 
                      mesa_id: value, 
                      mesa_numero: table?.numero || "", 
                      mesas_unidas: [], 
                      mesas_numeros: table?.numero ? [table.numero] : [] 
                    }));
                    setManualOverride(true);
                    setAssignedTable(null);
                    
                    const isPermanentlyBlocked = table?.activa === false;
                    const conflict = tableConflicts[value];
                    
                    if (isPermanentlyBlocked) {
                      setAssignmentReason("Mesa bloqueada permanentemente asignada manualmente.");
                      setAssignmentWarning("🔒 Esta mesa está bloqueada permanentemente. Solo se puede usar con selección manual en el formulario interno.");
                      toast.success(`Mesa bloqueada ${table.numero} seleccionada manualmente`);
                    } else if (conflict?.hasConflict) {
                      setAssignmentReason("Mesa asignada manualmente.");
                      setAssignmentWarning(`⚠️ ${conflict.reason} La selección manual ignora las restricciones.`);
                      toast.warning("⚠️ Mesa con conflicto seleccionada manualmente.");
                    } else {
                      setAssignmentReason("Mesa asignada manualmente.");
                      setAssignmentWarning("La asignación manual anula las reglas de negocio.");
                      toast.success(`Selección manual aplicada: Mesa ${table.numero}`);
                    }
                    
                    setNoTableAvailable(false);
                    setSelectedManualTables([value]);
                  }}
                  disabled={!formData.fecha || !formData.hora}
                >
                  <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm h-9 px-3">
                    <SelectValue placeholder={
                      !formData.fecha || !formData.hora 
                        ? "Selecciona fecha y hora primero" 
                        : allTablesForManual.length === 0 
                        ? "No hay mesas configuradas" 
                        : "Asignar mesa manualmente..."
                    } />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-800 max-h-64">
                    {allTablesForManual.sort((a, b) => a.numero - b.numero).map(table => {
                      const conflict = tableConflicts[table.id];
                      const hasConflict = conflict?.hasConflict;
                      const isPermanentlyBlocked = table.activa === false;
                      
                      return (
                        <SelectItem 
                          key={table.id} 
                          value={table.id} 
                          className={cn(
                            "text-sm",
                            isPermanentlyBlocked
                              ? "text-orange-700 dark:text-orange-400"
                              : hasConflict 
                              ? "text-red-700 dark:text-red-400" 
                              : "text-slate-900 dark:text-white"
                          )}
                        >
                          Mesa {table.numero} ({table.capacidad} personas) - {table.sala}
                          {isPermanentlyBlocked && " 🔒 Bloqueada"}
                          {!isPermanentlyBlocked && hasConflict && " ⚠️ Conflicto"}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                
                {formData.mesa_id && (() => {
                  const selectedTable = effectiveTables.find(t => t.id === formData.mesa_id);
                  const isPermanentlyBlocked = selectedTable?.activa === false;
                  const hasConflict = tableConflicts[formData.mesa_id]?.hasConflict;
                  
                  if (isPermanentlyBlocked) {
                    return (
                      <Alert className="bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-800 mt-2">
                        <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        <AlertDescription className="text-sm text-orange-900 dark:text-orange-300">
                          <p className="font-semibold">🔒 Mesa bloqueada permanentemente seleccionada</p>
                          <p className="text-xs mt-1">Esta mesa solo está disponible mediante selección manual en el formulario interno.</p>
                          <p className="text-xs mt-2 font-semibold">
                            La mesa NO aparecerá en el formulario público ni en la asignación automática.
                          </p>
                        </AlertDescription>
                      </Alert>
                    );
                  }
                  
                  if (hasConflict) {
                    return (
                      <Alert className="bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800 mt-2">
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <AlertDescription className="text-sm text-red-900 dark:text-red-300">
                          <p className="font-semibold">⚠️ Mesa con conflicto seleccionada</p>
                          <p className="text-xs mt-1">{tableConflicts[formData.mesa_id].reason}</p>
                          <p className="text-xs mt-2 font-semibold">
                            La selección manual ignora todas las restricciones. Asegúrate de gestionar el conflicto manualmente.
                          </p>
                        </AlertDescription>
                      </Alert>
                    );
                  }
                  
                  return null;
                })()}
              </div>
            )}
            
            <p className="text-xs text-slate-500 dark:text-slate-400">
              La selección manual muestra TODAS las mesas (incluyendo bloqueadas permanentemente y ocupadas). Las mesas con problemas se marcan con ⚠️ o 🔒 pero puedes seleccionarlas de todas formas.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 md:gap-4">
            <div className="space-y-2">
              <Label className="text-sm md:text-base text-slate-900 dark:text-white">{t('reservations.form.status')}</Label>
              <Select value={formData.estado} onValueChange={(value) => setFormData({ ...formData, estado: value })}>
                <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm h-9 px-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-800">
                  <SelectItem value="pendiente" className="text-sm text-slate-900 dark:text-white">Pendiente</SelectItem>
                  <SelectItem value="confirmada" className="text-sm text-slate-900 dark:text-white">Confirmada</SelectItem>
                  <SelectItem value="sentada" className="text-sm text-slate-900 dark:text-white">Sentada</SelectItem>
                  <SelectItem value="completada" className="text-sm text-slate-900 dark:text-white">Completada</SelectItem>
                  <SelectItem value="cancelada" className="text-sm text-slate-900 dark:text-white">Cancelada</SelectItem>
                  <SelectItem value="no_show" className="text-sm text-slate-900 dark:text-white">No Show</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm md:text-base text-slate-900 dark:text-white">{t('reservations.form.specialOccasion')}</Label>
              <Select value={formData.ocasion_especial} onValueChange={(value) => setFormData({ ...formData, ocasion_especial: value })}>
                <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm h-9 px-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-800">
                  <SelectItem value="ninguna" className="text-sm text-slate-900 dark:text-white">Ninguna</SelectItem>
                  <SelectItem value="cumpleanos" className="text-sm text-slate-900 dark:text-white">Cumpleaños</SelectItem>
                  <SelectItem value="aniversario" className="text-sm text-slate-900 dark:text-white">Aniversario</SelectItem>
                  <SelectItem value="negocio" className="text-sm text-slate-900 dark:text-white">Negocio</SelectItem>
                  <SelectItem value="cita" className="text-sm text-slate-900 dark:text-white">Cita</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm md:text-base text-slate-900 dark:text-white">Preferencias de Área</Label>
            <Input value={formData.preferencias || ""} onChange={(e) => { setFormData({ ...formData, preferencias: e.target.value }); setCustomerPreferences(e.target.value); }} placeholder="Ej: Terraza, Interior, Junto a ventana..." className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm h-9" />
            <p className="text-xs text-slate-500 dark:text-slate-400">El sistema intentará asignar una mesa en el área preferida si está disponible</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="waiter" className="text-sm md:text-base text-slate-900 dark:text-white">Camarero que toma la reserva *</Label>
            <Select value={selectedWaiterId} onValueChange={setSelectedWaiterId} required>
              <SelectTrigger id="waiter" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm h-9 px-3">
                <SelectValue placeholder="Seleccionar camarero..." />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-800">
                {waiters.map((waiter) => (
                  <SelectItem key={waiter.id} value={waiter.id} className="text-sm text-slate-900 dark:text-white">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: waiter.color }}
                      />
                      {waiter.nombre} {waiter.apellidos}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm md:text-base text-slate-900 dark:text-white">{t('reservations.form.notes')}</Label>
            <Textarea value={formData.notas} onChange={(e) => setFormData({ ...formData, notas: e.target.value })} placeholder="Alergias, preferencias, solicitudes especiales..." rows={3} className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm" />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onCancel} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 w-full sm:w-auto text-sm" size="sm">
              {t('reservations.form.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitDisabled} className="w-full sm:w-auto text-sm shadow-lg" style={{ background: isSubmitDisabled ? '#94a3b8' : `linear-gradient(135deg, ${colorPrimario}, ${colorAccento})` }}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('reservations.form.saving')}
                </>
              ) : (
                t(reservation ? 'reservations.form.update' : 'reservations.form.create')
              )}
            </Button>
          </div>
        </form>
    </Card>
  );
}
