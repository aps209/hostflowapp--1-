import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const normalizeTime = (time) => {
  if (!time) return "";
  const cleanTime = time.trim().split(':').slice(0, 2).join(':');
  return cleanTime;
};

const timeRangesOverlap = (start1, end1, start2, end2) => {
  const s1Norm = normalizeTime(start1);
  const e1Norm = normalizeTime(end1);
  const s2Norm = normalizeTime(start2);
  const e2Norm = normalizeTime(end2);
  
  const e1Display = e1Norm === "00:00" ? "24:00" : e1Norm;
  const e2Display = e2Norm === "00:00" ? "24:00" : e2Norm;
  
  const s1 = new Date(`1970-01-01T${s1Norm}:00`);
  let e1 = new Date(`1970-01-01T${e1Norm}:00`);
  const s2 = new Date(`1970-01-01T${s2Norm}:00`);
  let e2 = new Date(`1970-01-01T${e2Norm}:00`);
  
  if (e1 <= s1) e1 = new Date(e1.getTime() + 24 * 60 * 60 * 1000);
  if (e2 <= s2) e2 = new Date(e2.getTime() + 24 * 60 * 60 * 1000);
  
  const overlaps = s1 < e2 && s2 < e1;
  
  console.log(`    Comparando: ${s1Norm}-${e1Display} vs ${s2Norm}-${e2Display} => ${overlaps ? '❌ CONFLICTO' : '✅ OK'}`);
  
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

Deno.serve(async (req) => {
    const requestId = crypto.randomUUID().substring(0, 8);
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[checkVapi][${requestId}] 🔍 VERIFICANDO DISPONIBILIDAD (VAPI)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();
        
        const { userMessage, restaurantId, webhookSecret } = payload;
        
        // Validación de parámetros
        if (!userMessage) {
            console.error(`[checkVapi][${requestId}] ❌ Falta userMessage`);
            return Response.json({ 
                success: false, 
                error: 'Se requiere userMessage' 
            }, { status: 400 });
        }
        
        if (!restaurantId) {
            console.error(`[checkVapi][${requestId}] ❌ Falta restaurantId`);
            return Response.json({ 
                success: false, 
                error: 'Se requiere restaurantId' 
            }, { status: 400 });
        }

        // SEGURIDAD: Validar webhook secret
        const EXPECTED_WEBHOOK_SECRET = Deno.env.get('VAPI_WEBHOOK_SECRET');
        
        if (EXPECTED_WEBHOOK_SECRET && webhookSecret !== EXPECTED_WEBHOOK_SECRET) {
            console.error(`[checkVapi][${requestId}] ⚠️ Webhook secret inválido`);
            return Response.json({ 
                success: false, 
                error: 'Unauthorized' 
            }, { status: 401 });
        }

        console.log(`[checkVapi][${requestId}] 📝 userMessage: "${userMessage}"`);
        console.log(`[checkVapi][${requestId}] 🏪 restaurantId: ${restaurantId}`);

        // Obtener fecha actual para contexto del LLM
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
        const todayDayName = dayNames[today.getDay()];
        
        // Formatear hora actual en zona horaria de Madrid
        const nowMadrid = new Date().toLocaleString('es-ES', { 
            timeZone: 'Europe/Madrid',
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        
        // Generar referencia de los próximos 7 días para contexto
        const nextWeekDays = [];
        for (let i = 0; i < 7; i++) {
            const futureDate = new Date(today);
            futureDate.setDate(today.getDate() + i);
            const dayName = dayNames[futureDate.getDay()];
            const dateStr = futureDate.toISOString().split('T')[0];
            nextWeekDays.push(`${dayName} ${dateStr}`);
        }

        // Usar LLM para extraer datos estructurados del mensaje
        console.log(`[checkVapi][${requestId}] 🤖 Extrayendo datos con LLM...`);
        
        const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `Eres un asistente de reservas de restaurante. Analiza el siguiente mensaje del cliente y extrae la información para verificar disponibilidad.

Fecha y hora actual: ${nowMadrid} (${todayDayName})
Fecha actual (YYYY-MM-DD): ${todayStr}

Próximos días de la semana:
${nextWeekDays.join('\n')}

Mensaje del cliente: "${userMessage}"

Extrae la siguiente información:
- comensales: número de personas (number)
- fecha: fecha deseada en formato YYYY-MM-DD (si dice "hoy" usa ${todayStr}, si dice "mañana" calcula la fecha correcta, etc.)
- hora: hora en formato HH:MM (24 horas)

Si el mensaje NO es sobre hacer una reserva o consultar disponibilidad, indica "not_reservation_request": true.
Si falta información importante (fecha, hora o comensales), indica qué falta en el campo "missing_info".`,
            response_json_schema: {
                type: "object",
                properties: {
                    not_reservation_request: { type: "boolean" },
                    missing_info: { 
                        type: "array",
                        items: { type: "string" }
                    },
                    comensales: { type: "number" },
                    fecha: { type: "string" },
                    hora: { type: "string" }
                }
            }
        });
        
        const extractedData = llmResponse;
        console.log(`[checkVapi][${requestId}] 📊 Datos extraídos:`, extractedData);

        // Si no es una solicitud de reserva
        if (extractedData.not_reservation_request) {
            return Response.json({
                success: false,
                message: "Entiendo que quieres hacer una consulta. Soy el asistente de reservas y puedo ayudarte a reservar una mesa. ¿Te gustaría hacer una reserva?",
                needsMoreInfo: false
            });
        }

        // Si falta información crítica
        if (extractedData.missing_info && extractedData.missing_info.length > 0) {
            const missingFields = extractedData.missing_info.join(", ");
            return Response.json({
                success: false,
                message: `Para verificar disponibilidad, necesito la siguiente información: ${missingFields}. ¿Puedes proporcionármela?`,
                needsMoreInfo: true,
                extractedData
            });
        }

        const { fecha, hora, comensales } = extractedData;
        const restaurant_id = restaurantId;
        
        // Normalizar fecha y hora
        const fechaNormalizada = fecha.trim();
        const horaNormalizada = normalizeTime(hora);
        
        console.log(`[checkVapi][${requestId}] Parámetros extraídos:`);
        console.log(`  📅 Fecha: "${fechaNormalizada}"`);
        console.log(`  🕐 Hora: "${horaNormalizada}"`);
        console.log(`  👥 Comensales: ${comensales}`);
        
        // Validar que no sea fecha/hora pasada
        const now = new Date();
        const requestDateTime = new Date(`${fechaNormalizada}T${horaNormalizada}:00`);
        
        if (requestDateTime < now) {
            console.log(`[checkVapi][${requestId}] ❌ Fecha/hora en el pasado`);
            return Response.json({
                success: false,
                available: false,
                message: `No puedo hacer reservas en el pasado. Por favor, selecciona una fecha y hora futura.`
            });
        }
        
        // Cargar datos
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
        
        // Calcular duración efectiva para ESTA fecha específica
        const calculateEffectiveDuration = (fechaString) => {
            const specialDay = specialDays.find(sd => sd.date === fechaString);
            if (specialDay?.duracion_reserva_default) {
                console.log(`[checkVapi][${requestId}] ⏱️ Usando duración de día especial: ${specialDay.duracion_reserva_default} min`);
                return specialDay.duracion_reserva_default;
            }
            
            const date = new Date(fechaString + 'T00:00:00');
            const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
            const dayOfWeekName = dayNames[date.getDay()];
            const schedule = schedules.find(s => s.day_of_week === dayOfWeekName);
            
            if (schedule?.duracion_reserva_default) {
                console.log(`[checkVapi][${requestId}] ⏱️ Usando duración del día ${dayOfWeekName}: ${schedule.duracion_reserva_default} min`);
                return schedule.duracion_reserva_default;
            }
            
            console.log(`[checkVapi][${requestId}] ⏱️ Usando duración por defecto: ${duracionDefaultGlobal} min`);
            return duracionDefaultGlobal;
        };
        
        const duracionDefault = calculateEffectiveDuration(fechaNormalizada);
        
        // Verificar si el restaurante está abierto en la fecha/hora solicitada
        const specialDay = specialDays.find(d => d.date === fechaNormalizada);
        let daySchedule = null;
        
        if (specialDay) {
            daySchedule = specialDay;
        } else {
            const dayNamesCheck = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
            const requestDate = new Date(fechaNormalizada + 'T00:00:00');
            const dayName = dayNamesCheck[requestDate.getDay()];
            daySchedule = schedules.find(s => s.day_of_week === dayName);
        }
        
        // Verificar si el restaurante está cerrado
        if (!daySchedule || !daySchedule.is_open || !daySchedule.slots || daySchedule.slots.length === 0) {
            console.log(`[checkVapi][${requestId}] ❌ Restaurante CERRADO`);
            return Response.json({
                success: true,
                available: false,
                is_closed: true,
                message: `Lo siento, el restaurante está cerrado ese día.`
            });
        }
        
        // Verificar si la hora está dentro de los slots de apertura
        const requestTime = new Date(`1970-01-01T${horaNormalizada}:00`);
        let isWithinOpeningHours = false;
        
        for (const slot of daySchedule.slots) {
            const openingTime = new Date(`1970-01-01T${slot.opening_time}:00`);
            const closingTime = new Date(`1970-01-01T${slot.closing_time}:00`);
            
            if (requestTime >= openingTime && requestTime <= closingTime) {
                isWithinOpeningHours = true;
                break;
            }
        }
        
        if (!isWithinOpeningHours) {
            console.log(`[checkVapi][${requestId}] ❌ Fuera del horario de apertura`);
            const openingSlots = daySchedule.slots.map(s => `${s.opening_time} - ${s.closing_time}`).join(', ');
            return Response.json({
                success: true,
                available: false,
                is_closed: true,
                opening_hours: openingSlots,
                message: `Lo siento, el restaurante abre de ${openingSlots}.`
            });
        }
        
        console.log(`\n[checkVapi][${requestId}] Datos cargados:`);
        console.log(`  🪑 Mesas totales: ${tables.length}`);
        console.log(`  📅 Reservas totales BD: ${allReservations.length}`);
        console.log(`  ⏱️  Duración reserva: ${duracionDefault} min`);
        
        const horaFin = addMinutes(horaNormalizada, duracionDefault);
        console.log(`  🎯 Rango buscado: ${horaNormalizada} - ${horaFin}`);
        
        const unavailableTableIds = tableAvailability.filter(ta => ta.fecha === fechaNormalizada).map(ta => ta.mesa_id);
        console.log(`  🚫 Mesas bloqueadas manualmente: ${unavailableTableIds.length}`);
        
        // Filtrar reservas activas del día
        const reservacionesDelDia = allReservations.filter(r => {
            const fechaReserva = r.fecha ? r.fecha.trim() : '';
            const esDelDia = fechaReserva === fechaNormalizada;
            
            if (!esDelDia) return false;
            
            const esActiva = r.estado !== 'cancelada' && r.estado !== 'completada' && r.estado !== 'no_show';
            return esActiva;
        });
        
        console.log(`\n📋 Total reservas ACTIVAS del día ${fechaNormalizada}: ${reservacionesDelDia.length}`);
        
        // Verificar disponibilidad de cada mesa
        const isTableAvailable = (tableId, tableName) => {
            const table = tables.find(t => t.id === tableId);
            
            console.log(`\n  🔍 Verificando Mesa ${tableName} (ID: ${tableId?.substring(0,8)})`);
            
            if (!table) {
                console.log(`    ❌ Mesa no encontrada`);
                return false;
            }
            if (!table.activa) {
                console.log(`    ❌ Mesa inactiva`);
                return false;
            }
            if (unavailableTableIds.includes(table.id)) {
                console.log(`    ❌ Mesa bloqueada manualmente`);
                return false;
            }
            
            const tableReservations = reservacionesDelDia.filter(r => {
                const esMainTable = r.mesa_id === tableId;
                const esUnida = r.mesas_unidas && Array.isArray(r.mesas_unidas) && r.mesas_unidas.includes(tableId);
                return esMainTable || esUnida;
            });
            
            if (tableReservations.length === 0) {
                console.log(`    ✅ Sin reservas - DISPONIBLE`);
                return true;
            }
            
            console.log(`    📋 Tiene ${tableReservations.length} reserva(s) existente(s):`);
            
            for (const reserva of tableReservations) {
                let reservaDuracion;
                if (reserva.duracion_estimada) {
                    reservaDuracion = reserva.duracion_estimada;
                } else {
                    reservaDuracion = calculateEffectiveDuration(reserva.fecha || fechaNormalizada);
                }
                const reservaHoraInicio = normalizeTime(reserva.hora);
                const reservaHoraFin = addMinutes(reservaHoraInicio, reservaDuracion);

                console.log(`      - Reserva existente: ${reservaHoraInicio} - ${reservaHoraFin} (${reservaDuracion} min) | Cliente: ${reserva.cliente_nombre}`);
                console.log(`      - Nueva solicitud: ${horaNormalizada} - ${horaFin} (${duracionDefault} min)`);

                const hasConflict = timeRangesOverlap(horaNormalizada, horaFin, reservaHoraInicio, reservaHoraFin);
                
                if (hasConflict) {
                    console.log(`    ❌ CONFLICTO DETECTADO - Mesa NO disponible`);
                    return false;
                }
            }
            
            console.log(`    ✅ Sin conflictos - DISPONIBLE`);
            return true;
        };
        
        // Buscar mesas individuales disponibles
        const activeTables = tables.filter(t => t.activa && !unavailableTableIds.includes(t.id));
        
        const availableTables = activeTables.filter(table => {
            if (table.capacidad < comensales) return false;
            return isTableAvailable(table.id, table.numero);
        }).sort((a, b) => {
            const excessA = a.capacidad - comensales;
            const excessB = b.capacidad - comensales;
            if (excessA !== excessB) return excessA - excessB;
            return a.numero - b.numero;
        });
        
        console.log(`\n[checkVapi][${requestId}] 📊 Mesas individuales DISPONIBLES: ${availableTables.length}`);
        
        if (availableTables.length > 0) {
            const table = availableTables[0];
            console.log(`\n✅✅✅ DISPONIBILIDAD CONFIRMADA: Mesa ${table.numero} (${table.capacidad} personas)`);
            
            return Response.json({
                success: true,
                available: true,
                extractedData: { fecha: fechaNormalizada, hora: horaNormalizada, comensales },
                suggestion: {
                    type: 'single',
                    table_id: table.id,
                    table_number: table.numero,
                    capacity: table.capacidad
                },
                message: `Tengo disponible la Mesa ${table.numero} (capacidad ${table.capacidad} personas) para ${comensales} personas el ${fecha} a las ${hora}.`
            });
        }
        
        // Si no hay individuales, intentar unir mesas
        if (allowTableJoining) {
            console.log(`\n[checkVapi][${requestId}] 🔗 Buscando combinaciones de mesas...`);
            
            const joinGroups = {};
            activeTables.forEach(table => {
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
            
            for (const groupTables of Object.values(joinGroups)) {
                const availableGroupTables = groupTables.filter(table => isTableAvailable(table.id, table.numero));
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
                    
                    if (currentIndex >= availableGroupTables.length) return;
                    
                    findCombinationsRecursive(currentIndex + 1, [...currentCombo, availableGroupTables[currentIndex]]);
                    findCombinationsRecursive(currentIndex + 1, currentCombo);
                };
                
                findCombinationsRecursive(0, []);
            }
            
            if (bestCombination) {
                const sortedCombination = bestCombination.sort((a, b) => a.numero - b.numero);
                const totalCapacity = sortedCombination.reduce((sum, t) => sum + t.capacidad, 0);
                
                console.log(`\n✅✅✅ DISPONIBILIDAD CONFIRMADA (UNIDAS): Mesas ${sortedCombination.map(t => t.numero).join(', ')}`);
                
                return Response.json({
                    success: true,
                    available: true,
                    extractedData: { fecha: fechaNormalizada, hora: horaNormalizada, comensales },
                    suggestion: {
                        type: 'joined',
                        tables: sortedCombination.map(t => ({ id: t.id, numero: t.numero, capacidad: t.capacidad })),
                        total_capacity: totalCapacity
                    },
                    message: `Tengo disponible las Mesas ${sortedCombination.map(t => t.numero).join(', ')} unidas (capacidad total ${totalCapacity} personas) para ${comensales} personas el ${fecha} a las ${hora}.`
                });
            }
        }
        
        console.log(`\n❌❌❌ SIN DISPONIBILIDAD - No hay mesas libres`);
        console.log(`   🔍 Buscando horas alternativas...`);
        
        // Buscar hasta 3 horas alternativas disponibles
        const alternatives = [];
        const allPossibleTimes = [];
        
        daySchedule.slots.forEach(slot => {
            const start = new Date(`1970-01-01T${slot.opening_time}:00`);
            const end = new Date(`1970-01-01T${slot.closing_time}:00`);
            for (let d = new Date(start); d.getTime() <= end.getTime(); d.setMinutes(d.getMinutes() + 15)) {
                const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                if (timeStr !== horaNormalizada) {
                    allPossibleTimes.push(timeStr);
                }
            }
        });
        
        for (const altHora of allPossibleTimes) {
            if (alternatives.length >= 3) break;
            
            const altHoraFin = addMinutes(altHora, duracionDefault);
            
            const altAvailableTables = activeTables.filter(table => {
                if (table.capacidad < comensales) return false;
                
                const tableReservations = reservacionesDelDia.filter(r => {
                    const esMainTable = r.mesa_id === table.id;
                    const esUnida = r.mesas_unidas && Array.isArray(r.mesas_unidas) && r.mesas_unidas.includes(table.id);
                    return esMainTable || esUnida;
                });
                
                if (tableReservations.length === 0) return true;
                
                for (const reserva of tableReservations) {
                    let reservaDuracion;
                    if (reserva.duracion_estimada) {
                        reservaDuracion = reserva.duracion_estimada;
                    } else {
                        reservaDuracion = calculateEffectiveDuration(reserva.fecha || fechaNormalizada);
                    }
                    const reservaHoraInicio = normalizeTime(reserva.hora);
                    const reservaHoraFin = addMinutes(reservaHoraInicio, reservaDuracion);
                    
                    if (timeRangesOverlap(altHora, altHoraFin, reservaHoraInicio, reservaHoraFin)) {
                        return false;
                    }
                }
                
                return true;
            });
            
            if (altAvailableTables.length > 0) {
                alternatives.push(altHora);
                console.log(`   ✅ Alternativa encontrada: ${altHora}`);
            }
        }
        
        return Response.json({
            success: true,
            available: false,
            extractedData: { fecha: fechaNormalizada, hora: horaNormalizada, comensales },
            alternatives: alternatives.length > 0 ? alternatives : null,
            message: `Lo siento, no hay mesas disponibles para ${comensales} personas el ${fecha} a las ${hora}.`
        });
        
    } catch (error) {
        console.error(`\n[checkVapi][${requestId}] 💥 ERROR:`, error.message);
        console.error(error.stack);
        return Response.json({
            success: false,
            message: 'Error al verificar disponibilidad',
            error: error.message
        }, { status: 500 });
    }
});