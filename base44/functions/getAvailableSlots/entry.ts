import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const normalizeTime = (time) => {
  if (!time) return "";
  return time.trim().split(':').slice(0, 2).join(':');
};

const addMinutes = (time, minutes) => {
  if (!time) return "";
  const [hours, mins] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, mins, 0, 0);
  date.setMinutes(date.getMinutes() + minutes);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const timeRangesOverlap = (start1, end1, start2, end2) => {
  const toMinutes = (t) => {
    if (t === "00:00") return 24 * 60;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const s1 = toMinutes(start1);
  let e1 = toMinutes(end1);
  const s2 = toMinutes(start2);
  let e2 = toMinutes(end2);
  if (e1 <= s1) e1 += 24 * 60;
  if (e2 <= s2) e2 += 24 * 60;
  return s1 < e2 && s2 < e1;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { userMessage, restaurantId, webhookSecret } = payload;

    if (!userMessage) {
      return Response.json({ success: false, error: 'Se requiere userMessage' }, { status: 400 });
    }
    if (!restaurantId) {
      return Response.json({ success: false, error: 'Se requiere restaurantId' }, { status: 400 });
    }

    const EXPECTED_WEBHOOK_SECRET = Deno.env.get('VAPI_WEBHOOK_SECRET');
    if (EXPECTED_WEBHOOK_SECRET && webhookSecret !== EXPECTED_WEBHOOK_SECRET) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    const todayDayName = dayNames[today.getDay()];
    const nowMadrid = new Date().toLocaleString('es-ES', {
      timeZone: 'Europe/Madrid',
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    });

    const nextWeekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      nextWeekDays.push(`${dayNames[d.getDay()]} ${d.toISOString().split('T')[0]}`);
    }

    const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Eres un asistente de reservas de restaurante. Analiza el siguiente mensaje del cliente y extrae la información para consultar disponibilidad de huecos horarios.

Fecha y hora actual: ${nowMadrid} (${todayDayName})
Fecha actual (YYYY-MM-DD): ${todayStr}

Próximos días de la semana:
${nextWeekDays.join('\n')}

Mensaje del cliente: "${userMessage}"

Extrae la siguiente información:
- comensales: número de personas (number)
- fecha: fecha deseada en formato YYYY-MM-DD (si dice "hoy" usa ${todayStr}, si dice "mañana" calcula la fecha correcta, etc.)
- hora: hora de inicio a partir de la cual buscar disponibilidad en formato HH:MM (24 horas). Si no especifica hora, pon null.

Si el mensaje NO es sobre consultar disponibilidad o hacer una reserva, indica "not_reservation_request": true.
Si falta información importante (fecha o comensales), indica qué falta en el campo "missing_info".`,
      response_json_schema: {
        type: "object",
        properties: {
          not_reservation_request: { type: "boolean" },
          missing_info: { type: "array", items: { type: "string" } },
          comensales: { type: "number" },
          fecha: { type: "string" },
          hora: { type: "string" }
        }
      }
    });

    const extracted = llmResponse;
    console.log('Datos extraídos:', extracted);

    if (extracted.not_reservation_request) {
      return Response.json({
        success: false,
        message: "Soy el asistente de reservas. ¿Te gustaría consultar disponibilidad para reservar una mesa?",
        needsMoreInfo: false
      });
    }

    if (extracted.missing_info && extracted.missing_info.length > 0) {
      return Response.json({
        success: false,
        message: `Para consultar disponibilidad necesito: ${extracted.missing_info.join(", ")}. ¿Puedes proporcionármelo?`,
        needsMoreInfo: true,
        extractedData: extracted
      });
    }

    const { fecha, hora, comensales } = extracted;
    const restaurant_id = restaurantId;
    const fechaNorm = fecha.trim();

    const [tables, allReservations, tableAvailability, configs, schedules, specialDays] = await Promise.all([
      base44.asServiceRole.entities.Table.filter({ restaurant_id }),
      base44.asServiceRole.entities.Reservation.filter({ restaurant_id }),
      base44.asServiceRole.entities.TableAvailability.filter({ restaurant_id }),
      base44.asServiceRole.entities.RestaurantConfig.filter({ restaurant_id }),
      base44.asServiceRole.entities.Schedule.filter({ restaurant_id }),
      base44.asServiceRole.entities.SpecialDay.filter({ restaurant_id })
    ]);

    const config = configs[0] || {};
    const duracionDefaultGlobal = config.duracion_reserva_default || 90;
    const allowTableJoining = config.allow_table_joining || false;

    const calcDuracion = (fechaStr) => {
      const sd = specialDays.find(s => s.date === fechaStr);
      if (sd?.duracion_reserva_default) return sd.duracion_reserva_default;
      const dn = dayNames[new Date(fechaStr + 'T00:00:00').getDay()];
      const sc = schedules.find(s => s.day_of_week === dn);
      if (sc?.duracion_reserva_default) return sc.duracion_reserva_default;
      return duracionDefaultGlobal;
    };

    const duracion = calcDuracion(fechaNorm);

    const specialDay = specialDays.find(d => d.date === fechaNorm);
    let daySchedule = null;
    if (specialDay) {
      daySchedule = specialDay;
    } else {
      const dn = dayNames[new Date(fechaNorm + 'T00:00:00').getDay()];
      daySchedule = schedules.find(s => s.day_of_week === dn);
    }

    if (!daySchedule || !daySchedule.is_open || !daySchedule.slots || daySchedule.slots.length === 0) {
      return Response.json({
        success: true,
        available_slots: [],
        message: `Lo siento, el restaurante está cerrado el ${fecha}.`
      });
    }

    const unavailableTableIds = tableAvailability.filter(ta => ta.fecha === fechaNorm).map(ta => ta.mesa_id);
    const reservasDia = allReservations.filter(r =>
      r.fecha?.trim() === fechaNorm &&
      r.estado !== 'cancelada' && r.estado !== 'completada' && r.estado !== 'no_show'
    );

    const activeTables = tables.filter(t => t.activa && !unavailableTableIds.includes(t.id));

    const isMesaFree = (tableId, slotHora, slotFin) => {
      const reservasMesa = reservasDia.filter(r =>
        r.mesa_id === tableId || (r.mesas_unidas && r.mesas_unidas.includes(tableId))
      );
      for (const r of reservasMesa) {
        const rDur = r.duracion_estimada || calcDuracion(r.fecha || fechaNorm);
        const rFin = addMinutes(normalizeTime(r.hora), rDur);
        if (timeRangesOverlap(slotHora, slotFin, normalizeTime(r.hora), rFin)) return false;
      }
      return true;
    };

    const getAvailabilityInfoAtSlot = (slotHora) => {
      const slotFin = addMinutes(slotHora, duracion);
      const single = activeTables.find(t => {
        if (t.capacidad < comensales) return false;
        if (t.exact_capacity_only && t.capacidad !== comensales) return false;
        return isMesaFree(t.id, slotHora, slotFin);
      });
      if (single) return { available: true, tipo: 'individual', mesa: single.numero, capacidad: single.capacidad, mesa_id: single.id };

      if (allowTableJoining) {
        const joinGroups = {};
        activeTables.forEach(t => {
          const gids = t.join_group_ids || (t.join_group_id ? [t.join_group_id] : []);
          gids.forEach(gid => {
            if (gid) {
              if (!joinGroups[gid]) joinGroups[gid] = [];
              joinGroups[gid].push(t);
            }
          });
        });
        for (const [groupId, groupTables] of Object.entries(joinGroups)) {
          const freeTables = groupTables.filter(t => isMesaFree(t.id, slotHora, slotFin));
          const totalCap = freeTables.reduce((s, t) => s + t.capacidad, 0);
          if (totalCap >= comensales) return {
            available: true,
            tipo: 'union',
            grupo: groupId,
            mesas: freeTables.map(t => ({ numero: t.numero, capacidad: t.capacidad, id: t.id })),
            capacidad_total: totalCap
          };
        }
      }

      return { available: false };
    };

    const hasAvailabilityAtSlot = (slotHora) => getAvailabilityInfoAtSlot(slotHora).available;

    // Generar todos los slots del día en intervalos de 15 min
    const allSlots = [];
    daySchedule.slots.forEach(slot => {
      const [sh, sm] = slot.opening_time.split(':').map(Number);
      const [eh, em] = slot.closing_time.split(':').map(Number);
      let cur = sh * 60 + sm;
      const endMin = eh * 60 + em;
      while (cur <= endMin) {
        allSlots.push(`${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`);
        cur += 15;
      }
    });

    const horaInicio = hora ? normalizeTime(hora) : (allSlots[0] || "00:00");
    const [hi, mi] = horaInicio.split(':').map(Number);
    const horaInicioMin = hi * 60 + mi;

    // Slots disponibles desde la hora solicitada
    const availableSlotsInfo = allSlots
      .filter(slot => {
        const [sh, sm] = slot.split(':').map(Number);
        return (sh * 60 + sm) >= horaInicioMin;
      })
      .map(slot => {
        const info = getAvailabilityInfoAtSlot(slot);
        return info.available ? { hora: slot, ...info } : null;
      })
      .filter(Boolean);

    const availableSlots = availableSlotsInfo.map(s => s.hora);

    if (availableSlots.length === 0) {
      // Buscar alternativas en TODO el día (no solo desde horaInicio)
      const now = new Date();
      const alternatives = [];

      for (const slot of allSlots) {
        if (alternatives.length >= 3) break;
        // Si es hoy, descartar slots ya pasados
        const slotDateTime = new Date(`${fechaNorm}T${slot}:00`);
        if (fechaNorm === todayStr && slotDateTime <= now) continue;
        if (hasAvailabilityAtSlot(slot)) {
          alternatives.push(slot);
        }
      }

      let message = `Lo siento, no hay disponibilidad para ${comensales} personas el ${fecha}${hora ? ` a partir de las ${hora}` : ''}.`;
      if (alternatives.length > 0) {
        message += ` Hay disponibilidad a las: ${alternatives.join(', ')}.`;
      } else {
        message += ` No hay alternativas disponibles para ese día.`;
      }

      return Response.json({
        success: true,
        available_slots: [],
        alternatives: alternatives.length > 0 ? alternatives : null,
        extractedData: { fecha: fechaNorm, hora: horaInicio, comensales },
        message
      });
    }

    return Response.json({
      success: true,
      available_slots: availableSlots,
      available_slots_detail: availableSlotsInfo,
      duracion_reserva: duracion,
      extractedData: { fecha: fechaNorm, hora: horaInicio, comensales },
      fecha,
      comensales,
      message: `Hay ${availableSlots.length} huecos disponibles para ${comensales} personas el ${fecha}. Los horarios son: ${availableSlots.slice(0, 5).join(', ')}${availableSlots.length > 5 ? '...' : ''}.`
    });

  } catch (error) {
    console.error('Error en getAvailableSlots:', error.message);
    return Response.json({
      success: false,
      message: 'Error al consultar disponibilidad',
      error: error.message
    }, { status: 500 });
  }
});