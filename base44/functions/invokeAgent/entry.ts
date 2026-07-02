import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// Función helper para sumar minutos a una hora
const addMinutes = (time, minutes) => {
    if (!time) return "";
    const [hours, mins] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, mins, 0);
    date.setMinutes(date.getMinutes() + minutes);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// Función para verificar solapamiento de rangos horarios
const timeRangesOverlap = (start1, end1, start2, end2) => {
    const s1 = new Date(`1970-01-01T${start1}:00`);
    let e1 = new Date(`1970-01-01T${end1}:00`);
    const s2 = new Date(`1970-01-01T${start2}:00`);
    let e2 = new Date(`1970-01-01T${end2}:00`);
    
    if (e1 <= s1) e1 = new Date(e1.getTime() + 24 * 60 * 60 * 1000);
    if (e2 <= s2) e2 = new Date(e2.getTime() + 24 * 60 * 60 * 1000);
    
    return s1 < e2 && s2 < e1;
};

// Función helper para encontrar mesas disponibles CON verificación de solapamiento real
function findAvailableTables(tables, reservations, comensales, fecha, hora, duracionReserva, tableAvailability, schedules, specialDays, duracionDefaultGlobal) {
    console.log(`[findAvailableTables] 🔍 Buscando para ${comensales}p el ${fecha} a las ${hora} (${duracionReserva}min)`);
    
    const horaFin = addMinutes(hora, duracionReserva);
    console.log(`[findAvailableTables] 🎯 Rango buscado: ${hora} - ${horaFin}`);
    
    // 🔥 CRÍTICO: Función para calcular duración de reservas existentes según su fecha
    const getReservationDuration = (reserva) => {
        // Si la reserva tiene duración guardada, usarla
        if (reserva.duracion_estimada) {
            return reserva.duracion_estimada;
        }
        
        // Si no, calcular según el día de esa reserva
        const reservaFecha = reserva.fecha;
        const specialDay = specialDays.find(sd => sd.date === reservaFecha);
        if (specialDay?.duracion_reserva_default) {
            return specialDay.duracion_reserva_default;
        }
        
        const date = new Date(reservaFecha + 'T00:00:00');
        const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
        const dayOfWeekName = dayNames[date.getDay()];
        const schedule = schedules.find(s => s.day_of_week === dayOfWeekName);
        
        if (schedule?.duracion_reserva_default) {
            return schedule.duracion_reserva_default;
        }
        
        return duracionDefaultGlobal;
    };
    
    // Mesas bloqueadas manualmente para esta fecha
    const unavailableTableIds = tableAvailability.filter(ta => ta.fecha === fecha).map(ta => ta.mesa_id);
    console.log(`[findAvailableTables] 🚫 Mesas bloqueadas: ${unavailableTableIds.length}`);
    
    const reservacionesDelDia = reservations.filter(r => 
        r.fecha === fecha && 
        r.estado !== 'cancelada' && 
        r.estado !== 'no_show' &&
        r.estado !== 'completada'
    );
    
    console.log(`[findAvailableTables] 📋 Reservas activas del día: ${reservacionesDelDia.length}`);
    
    // Log detallado de cada reserva para debugging
    if (reservacionesDelDia.length > 0) {
        console.log(`[findAvailableTables] 📝 Detalle de reservas:`);
        reservacionesDelDia.forEach(r => {
            const rDur = getReservationDuration(r);
            const rFin = addMinutes(r.hora, rDur);
            console.log(`   - ${r.reservation_id || r.id.substring(0,8)}: Mesa ${r.mesa_numero} | ${r.hora}-${rFin} (${rDur}min) | ${r.cliente_nombre}`);
        });
    }
    
    const availableTables = tables.filter(table => {
        // Verificar si la mesa está activa
        if (!table.activa) {
            console.log(`[findAvailableTables] ❌ Mesa ${table.numero}: INACTIVA`);
            return false;
        }
        
        // Verificar capacidad
        if (table.capacidad < comensales) {
            console.log(`[findAvailableTables] ❌ Mesa ${table.numero}: capacidad ${table.capacidad} < ${comensales}`);
            return false;
        }
        
        // Verificar si está bloqueada manualmente
        if (unavailableTableIds.includes(table.id)) {
            console.log(`[findAvailableTables] ❌ Mesa ${table.numero}: BLOQUEADA manualmente`);
            return false;
        }
        
        // Buscar todas las reservas que usen esta mesa
        const tableReservations = reservacionesDelDia.filter(r => 
            r.mesa_id === table.id || 
            (r.mesas_unidas && r.mesas_unidas.includes(table.id))
        );
        
        if (tableReservations.length === 0) {
            console.log(`[findAvailableTables] ✅ Mesa ${table.numero}: LIBRE (sin reservas)`);
            return true;
        }
        
        // 🔥 CRÍTICO: Verificar solapamiento de horarios con CADA reserva
        for (const reserva of tableReservations) {
            const reservaDuracion = getReservationDuration(reserva);
            const reservaHoraFin = addMinutes(reserva.hora, reservaDuracion);
            
            console.log(`[findAvailableTables] 🔍 Mesa ${table.numero}: Verificando vs reserva ${reserva.hora}-${reservaHoraFin} (${reservaDuracion}min)`);
            
            const hasConflict = timeRangesOverlap(hora, horaFin, reserva.hora, reservaHoraFin);
            
            if (hasConflict) {
                console.log(`[findAvailableTables] ❌ Mesa ${table.numero}: CONFLICTO con reserva ${reserva.hora}-${reservaHoraFin} (cliente: ${reserva.cliente_nombre})`);
                return false;
            } else {
                console.log(`[findAvailableTables] ✓ Mesa ${table.numero}: Sin conflicto con ${reserva.hora}-${reservaHoraFin}`);
            }
        }
        
        console.log(`[findAvailableTables] ✅ Mesa ${table.numero}: DISPONIBLE (sin conflictos)`);
        return true;
    });
    
    console.log(`[findAvailableTables] 📊 Mesas disponibles: ${availableTables.length}`);
    
    return availableTables.sort((a, b) => {
        const diffA = a.capacidad - comensales;
        const diffB = b.capacidad - comensales;
        if (diffA !== diffB) return diffA - diffB;
        return a.numero - b.numero;
    });
}

// Función helper para procesar intención de reserva
async function processReservationIntent(base44, userMessage, restaurantId) {
    console.log('[invokeAgent] 🤖 Procesando intención de reserva...');
    
    // Llamar a la integración InvokeLLM para extraer datos estructurados
    const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Eres un asistente de reservas de restaurante. Analiza el siguiente mensaje del cliente y extrae la información de la reserva.

Mensaje del cliente: "${userMessage}"

Extrae la siguiente información:
- nombre: nombre del cliente (string)
- telefono: teléfono si lo menciona (string o null)
- email: email si lo menciona (string o null) — NO es obligatorio, déjalo en null si no se menciona
- comensales: número de personas (number)
- fecha: fecha deseada en formato YYYY-MM-DD (usa la fecha actual si dice "hoy" o no especifica)
- hora: hora en formato HH:MM (24 horas)
- notas: cualquier nota o preferencia especial (string o null)

Los campos OBLIGATORIOS son: nombre, comensales, fecha, hora. El email y teléfono son OPCIONALES, nunca los incluyas en "missing_info".
Si falta alguno de los campos obligatorios, indica qué falta en el campo "missing_info".
Si el mensaje NO es sobre hacer una reserva, indica "not_reservation_request": true.`,
        response_json_schema: {
            type: "object",
            properties: {
                not_reservation_request: { type: "boolean" },
                missing_info: { 
                    type: "array",
                    items: { type: "string" }
                },
                nombre: { type: "string" },
                telefono: { type: "string" },
                email: { anyOf: [{ type: "string" }, { type: "null" }] },
                comensales: { type: "number" },
                fecha: { type: "string" },
                hora: { type: "string" },
                notas: { type: "string" }
            }
        }
    });
    
    const extractedData = llmResponse;
    console.log('[invokeAgent] 📊 Datos extraídos:', extractedData);
    
    // Si no es una solicitud de reserva
    if (extractedData.not_reservation_request) {
        return {
            success: false,
            response: "Entiendo que quieres hacer una consulta. Soy el asistente de reservas y puedo ayudarte a reservar una mesa. ¿Te gustaría hacer una reserva?",
            needsMoreInfo: false
        };
    }
    
    // Si falta información crítica
    if (extractedData.missing_info && extractedData.missing_info.length > 0) {
        const missingFields = extractedData.missing_info.join(", ");
        return {
            success: false,
            response: `Para completar tu reserva, necesito la siguiente información: ${missingFields}. ¿Puedes proporcionármela?`,
            needsMoreInfo: true,
            extractedData
        };
    }
    
    // Cargar datos necesarios
    const [tables, reservations, tableAvailability, configs, schedules, specialDays] = await Promise.all([
        base44.asServiceRole.entities.Table.filter({ restaurant_id: restaurantId }),
        base44.asServiceRole.entities.Reservation.filter({ restaurant_id: restaurantId }),
        base44.asServiceRole.entities.TableAvailability.filter({ restaurant_id: restaurantId }),
        base44.asServiceRole.entities.RestaurantConfig.filter({ restaurant_id: restaurantId }),
        base44.asServiceRole.entities.Schedule.filter({ restaurant_id: restaurantId }),
        base44.asServiceRole.entities.SpecialDay.filter({ restaurant_id: restaurantId })
    ]);
    
    const config = configs[0] || {};
    const duracionDefaultGlobal = config.duracion_reserva_default || 90;
    
    // 🔥 CRÍTICO: Calcular duración efectiva para ESTA fecha específica
    const calculateEffectiveDuration = (fechaString) => {
        const specialDay = specialDays.find(sd => sd.date === fechaString);
        if (specialDay?.duracion_reserva_default) {
            console.log(`[invokeAgent] ⏱️ Usando duración de día especial: ${specialDay.duracion_reserva_default} min`);
            return specialDay.duracion_reserva_default;
        }
        
        const date = new Date(fechaString + 'T00:00:00');
        const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
        const dayOfWeekName = dayNames[date.getDay()];
        const schedule = schedules.find(s => s.day_of_week === dayOfWeekName);
        
        if (schedule?.duracion_reserva_default) {
            console.log(`[invokeAgent] ⏱️ Usando duración del día ${dayOfWeekName}: ${schedule.duracion_reserva_default} min`);
            return schedule.duracion_reserva_default;
        }
        
        console.log(`[invokeAgent] ⏱️ Usando duración por defecto: ${duracionDefaultGlobal} min`);
        return duracionDefaultGlobal;
    };
    
    const duracionReserva = calculateEffectiveDuration(extractedData.fecha);
    
    // 🔥 VERIFICAR si el restaurante está cerrado ese día (día especial con is_open=false)
    const specialDayCheck = specialDays.find(sd => sd.date === extractedData.fecha);
    if (specialDayCheck && specialDayCheck.is_open === false) {
        console.log(`[invokeAgent] ❌ El restaurante está CERRADO el ${extractedData.fecha} (${specialDayCheck.name})`);
        return {
            success: false,
            response: `Lo siento, el restaurante está cerrado el ${extractedData.fecha}${specialDayCheck.name ? ` (${specialDayCheck.name})` : ''}. ¿Te gustaría reservar para otra fecha?`,
            needsMoreInfo: false
        };
    }

    // 🔥 VERIFICAR también si el día de la semana está cerrado
    const dateObj = new Date(extractedData.fecha + 'T00:00:00');
    const dayNamesCheck = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    const dayNameCheck = dayNamesCheck[dateObj.getDay()];
    const dayScheduleCheck = schedules.find(s => s.day_of_week === dayNameCheck);
    if (dayScheduleCheck && dayScheduleCheck.is_open === false) {
        console.log(`[invokeAgent] ❌ El restaurante está CERRADO los ${dayNameCheck}`);
        return {
            success: false,
            response: `Lo siento, el restaurante está cerrado los ${dayNameCheck}. ¿Te gustaría reservar para otra fecha?`,
            needsMoreInfo: false
        };
    }

    console.log(`[invokeAgent] 🔍 Verificando disponibilidad...`);
    const availableTables = findAvailableTables(
        tables, 
        reservations, 
        extractedData.comensales, 
        extractedData.fecha, 
        extractedData.hora,
        duracionReserva,
        tableAvailability,
        schedules,
        specialDays,
        duracionDefaultGlobal
    );
    
    if (availableTables.length === 0) {
        return {
            success: false,
            response: `Lo siento, no tengo mesas disponibles para ${extractedData.comensales} personas el ${extractedData.fecha} a las ${extractedData.hora}. ¿Te gustaría probar con otro horario?`,
            needsMoreInfo: false
        };
    }
    
    // Buscar o crear cliente
    let customer = null;
    if (extractedData.telefono || extractedData.email) {
        const existingCustomers = await base44.asServiceRole.entities.Customer.filter({ 
            restaurant_id: restaurantId
        });
        
        customer = existingCustomers.find(c => 
            (extractedData.telefono && c.telefono === extractedData.telefono) ||
            (extractedData.email && c.email === extractedData.email)
        );
        
        if (!customer) {
            customer = await base44.asServiceRole.entities.Customer.create({
                restaurant_id: restaurantId,
                nombre: extractedData.nombre,
                telefono: extractedData.telefono || '',
                email: extractedData.email || '',
                estado: 'activo'
            });
            console.log('[invokeAgent] ✅ Cliente creado:', customer.id);
        } else {
            console.log('[invokeAgent] ✅ Cliente existente encontrado:', customer.id);
        }
    }
    
    // Crear reserva
    const selectedTable = availableTables[0];
    
    const reservation = await base44.asServiceRole.entities.Reservation.create({
        restaurant_id: restaurantId,
        cliente_id: customer?.id || null,
        cliente_nombre: extractedData.nombre,
        cliente_telefono: extractedData.telefono || '',
        cliente_email: extractedData.email || null,
        fecha: extractedData.fecha,
        hora: extractedData.hora,
        comensales: extractedData.comensales,
        mesa_id: selectedTable.id,
        mesa_numero: selectedTable.numero,
        estado: 'confirmada',
        notas: extractedData.notas || '',
        origen: 'chatbot',
        duracion_estimada: duracionReserva
    });
    
    console.log('[invokeAgent] ✅ Reserva creada:', reservation.id);
    
    return {
        success: true,
        response: `¡Perfecto! He confirmado tu reserva:\n\n📅 Fecha: ${extractedData.fecha}\n🕐 Hora: ${extractedData.hora}\n👥 Personas: ${extractedData.comensales}\n🪑 Mesa: ${selectedTable.numero}\n\n¡Te esperamos! Si necesitas modificar o cancelar tu reserva, házmelo saber.`,
        needsMoreInfo: false,
        reservationId: reservation.id,
        extractedData
    };
}

Deno.serve(async (req) => {
    console.log('[invokeAgent] 🚀 Nueva petición recibida');
    
    try {
        const base44 = createClientFromRequest(req);
        
        let payload;
        try {
            payload = await req.json();
        } catch (e) {
            console.error('[invokeAgent] ❌ Error parseando JSON:', e);
            return Response.json({
                success: false,
                error: 'Error al parsear datos'
            }, { status: 400 });
        }
        
        const { userMessage, restaurantId, conversationId, webhookSecret } = payload;
        
        console.log('[invokeAgent] 📦 Payload:', { 
            hasUserMessage: !!userMessage, 
            restaurantId, 
            conversationId,
            hasWebhookSecret: !!webhookSecret
        });

        // Validación de parámetros
        if (!userMessage) {
            console.error('[invokeAgent] ❌ Falta userMessage');
            return Response.json({ 
                success: false, 
                error: 'Se requiere userMessage' 
            }, { status: 400 });
        }
        
        if (!restaurantId) {
            console.error('[invokeAgent] ❌ Falta restaurantId');
            return Response.json({ 
                success: false, 
                error: 'Se requiere restaurantId' 
            }, { status: 400 });
        }

        // SEGURIDAD: Validar webhook secret
        const EXPECTED_WEBHOOK_SECRET = Deno.env.get('VAPI_WEBHOOK_SECRET');
        
        if (EXPECTED_WEBHOOK_SECRET && webhookSecret !== EXPECTED_WEBHOOK_SECRET) {
            console.error('[invokeAgent] ⚠️ Webhook secret inválido');
            return Response.json({ 
                success: false, 
                error: 'Unauthorized' 
            }, { status: 401 });
        }

        // Procesar el mensaje con nuestra lógica de agente
        const result = await processReservationIntent(base44, userMessage, restaurantId);
        
        console.log('[invokeAgent] ✅ Resultado:', result.success ? 'Éxito' : 'Necesita más info');

        return Response.json({
            success: result.success,
            agentResponse: result.response,
            needsMoreInfo: result.needsMoreInfo,
            reservationId: result.reservationId,
            extractedData: result.extractedData,
            metadata: {
                restaurant_id: restaurantId,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('[invokeAgent] 💥 Error crítico:', error);
        console.error('[invokeAgent] 📍 Stack:', error.stack);
        
        return Response.json({
            success: false,
            error: error.message || 'Error interno del servidor',
            details: error.stack
        }, { status: 500 });
    }
});