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
  
  // Si la hora de fin es 00:00, significa medianoche del día siguiente (24:00)
  const e1Display = e1Norm === "00:00" ? "24:00" : e1Norm;
  const e2Display = e2Norm === "00:00" ? "24:00" : e2Norm;
  
  const s1 = new Date(`1970-01-01T${s1Norm}:00`);
  let e1 = new Date(`1970-01-01T${e1Norm}:00`);
  const s2 = new Date(`1970-01-01T${s2Norm}:00`);
  let e2 = new Date(`1970-01-01T${e2Norm}:00`);
  
  // Si la hora de fin es menor o igual que la hora de inicio, añadir un día
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
    console.log(`[checkAvailability][${requestId}] 🔍 VERIFICANDO DISPONIBILIDAD`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();
        
        const { restaurant_id, fecha, hora, comensales } = payload;
        
        if (!restaurant_id || !fecha || !hora || !comensales) {
            return Response.json({ 
                success: false, 
                message: 'Faltan parámetros requeridos: restaurant_id, fecha, hora, comensales'
            }, { status: 400 });
        }
        
        // Normalizar fecha y hora
        const fechaNormalizada = fecha.trim();
        const horaNormalizada = normalizeTime(hora);
        
        console.log(`[checkAvailability][${requestId}] Parámetros:`);
        console.log(`  📅 Fecha: "${fechaNormalizada}"`);
        console.log(`  🕐 Hora: "${horaNormalizada}"`);
        console.log(`  👥 Comensales: ${comensales}`);
        
        // Validar que no sea fecha/hora pasada
        const now = new Date();
        const requestDateTime = new Date(`${fechaNormalizada}T${horaNormalizada}:00`);
        
        if (requestDateTime < now) {
            console.log(`[checkAvailability][${requestId}] ❌ Fecha/hora en el pasado`);
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
        
        // 🔥 CRÍTICO: Calcular duración efectiva para ESTA fecha específica
        const calculateEffectiveDuration = (fechaString) => {
            // 🔥 PRIORIDAD 1: Día especial con duración configurada
            const specialDay = specialDays.find(sd => sd.date === fechaString);
            if (specialDay) {
                if (specialDay.duracion_reserva_default) {
                    console.log(`[checkAvailability][${requestId}] ⏱️ Usando duración de día especial: ${specialDay.duracion_reserva_default} min`);
                    return specialDay.duracion_reserva_default;
                }
                // Si es día especial pero sin duración configurada, usar GLOBAL (no el día de la semana)
                console.log(`[checkAvailability][${requestId}] ⏱️ Día especial sin duración → usando global: ${duracionDefaultGlobal} min`);
                return duracionDefaultGlobal;
            }
            
            // PRIORIDAD 2: Duración del día de la semana (solo si NO es día especial)
            const date = new Date(fechaString + 'T00:00:00');
            const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
            const dayOfWeekName = dayNames[date.getDay()];
            const schedule = schedules.find(s => s.day_of_week === dayOfWeekName);
            
            if (schedule?.duracion_reserva_default) {
                console.log(`[checkAvailability][${requestId}] ⏱️ Usando duración del día ${dayOfWeekName}: ${schedule.duracion_reserva_default} min`);
                return schedule.duracion_reserva_default;
            }
            
            // PRIORIDAD 3: Global del restaurante
            console.log(`[checkAvailability][${requestId}] ⏱️ Usando duración por defecto: ${duracionDefaultGlobal} min`);
            return duracionDefaultGlobal;
        };
        
        const duracionDefault = calculateEffectiveDuration(fechaNormalizada);
        
        // Verificar si el restaurante está abierto en la fecha/hora solicitada
        const specialDay = specialDays.find(d => d.date === fechaNormalizada);
        let daySchedule = null;
        
        if (specialDay) {
            daySchedule = specialDay;
        } else {
            const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
            const requestDate = new Date(fechaNormalizada + 'T00:00:00');
            const dayName = dayNames[requestDate.getDay()];
            daySchedule = schedules.find(s => s.day_of_week === dayName);
        }
        
        // Verificar si el restaurante está cerrado
        if (!daySchedule || !daySchedule.is_open || !daySchedule.slots || daySchedule.slots.length === 0) {
            console.log(`[checkAvailability][${requestId}] ❌ Restaurante CERRADO`);
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
            console.log(`[checkAvailability][${requestId}] ❌ Fuera del horario de apertura`);
            const openingSlots = daySchedule.slots.map(s => `${s.opening_time} - ${s.closing_time}`).join(', ');
            return Response.json({
                success: true,
                available: false,
                is_closed: true,
                opening_hours: openingSlots,
                message: `Lo siento, el restaurante abre de ${openingSlots}.`
            });
        }
        
        console.log(`\n[checkAvailability][${requestId}] Datos cargados:`);
        console.log(`  🪑 Mesas totales: ${tables.length}`);
        console.log(`  📅 Reservas totales BD: ${allReservations.length}`);
        console.log(`  ⏱️  Duración reserva: ${duracionDefault} min`);
        
        const horaFin = addMinutes(horaNormalizada, duracionDefault);
        console.log(`  🎯 Rango buscado: ${horaNormalizada} - ${horaFin}`);
        
        const unavailableTableIds = tableAvailability.filter(ta => ta.fecha === fechaNormalizada).map(ta => ta.mesa_id);
        console.log(`  🚫 Mesas bloqueadas manualmente: ${unavailableTableIds.length}`);
        if (unavailableTableIds.length > 0) {
            const blockedTables = tables.filter(t => unavailableTableIds.includes(t.id));
            console.log(`     IDs bloqueados: ${unavailableTableIds.join(', ')}`);
            console.log(`     Nombres: ${blockedTables.map(t => t.numero).join(', ')}`);
        }
        
        // 🔥 FILTRADO CRÍTICO: Reservas activas del día
        console.log(`\n[checkAvailability][${requestId}] 🔍 Filtrando reservas...`);
        
        const reservacionesDelDia = allReservations.filter(r => {
            const fechaReserva = r.fecha ? r.fecha.trim() : '';
            const esDelDia = fechaReserva === fechaNormalizada;
            
            if (!esDelDia) return false;
            
            const esActiva = r.estado !== 'cancelada' && r.estado !== 'completada' && r.estado !== 'no_show';
            
            console.log(`  ${esActiva ? '✓' : '✗'} Reserva ${r.reservation_id || r.id.substring(0,8)} | ${r.fecha} | ${r.hora} | ${r.estado}`);
            
            return esActiva;
        });
        
        console.log(`\n📋 Total reservas ACTIVAS del día ${fechaNormalizada}: ${reservacionesDelDia.length}`);
        
        if (reservacionesDelDia.length > 0) {
            console.log(`  Detalle completo de reservas activas:`);
            reservacionesDelDia.forEach((r, idx) => {
                // 🔥 CRÍTICO: Usar duracion_estimada guardada o calcular según el día de esa reserva
                let rDur;
                if (r.duracion_estimada) {
                    rDur = r.duracion_estimada;
                } else {
                    rDur = calculateEffectiveDuration(r.fecha || fechaNormalizada);
                }
                const rFin = addMinutes(r.hora, rDur);
                console.log(`    ${idx + 1}. ID: ${r.reservation_id || r.id.substring(0,8)}`);
                console.log(`       Mesa: ${r.mesa_numero} (ID: ${r.mesa_id?.substring(0,8)})`);
                console.log(`       Horario: ${r.hora} - ${rFin} (${rDur} min)`);
                console.log(`       Comensales: ${r.comensales} | Estado: ${r.estado}`);
                console.log(`       Cliente: ${r.cliente_nombre}`);
            });
        } else {
            console.log(`  ℹ️ No hay reservas activas para este día`);
        }
        
        // Verificar disponibilidad de cada mesa
        const isTableAvailable = (tableId, tableName) => {
            const table = tables.find(t => t.id === tableId);
            
            console.log(`\n  🔍 ═══ Verificando Mesa ${tableName} ═══`);
            console.log(`     ID: ${tableId.substring(0,8)}`);
            
            if (!table) {
                console.log(`     ❌ RESULTADO: NO ENCONTRADA`);
                return false;
            }
            
            if (!table.activa) {
                console.log(`     ❌ RESULTADO: INACTIVA`);
                return false;
            }
            
            if (unavailableTableIds.includes(table.id)) {
                console.log(`     ❌ RESULTADO: BLOQUEADA MANUALMENTE`);
                return false;
            }
            
            // 🔥 CRÍTICO: Buscar TODAS las reservas que usen esta mesa
            const tableReservations = reservacionesDelDia.filter(r => {
                const esMainTable = r.mesa_id === tableId;
                const esUnida = r.mesas_unidas && Array.isArray(r.mesas_unidas) && r.mesas_unidas.includes(tableId);
                
                const usaEstaMesa = esMainTable || esUnida;
                
                if (usaEstaMesa) {
                    console.log(`     ✓ Reserva ${r.reservation_id || r.id.substring(0,8)} USA esta mesa`);
                    console.log(`       - Principal: ${esMainTable} | Unida: ${esUnida}`);
                    console.log(`       - Hora: ${r.hora} | Duración: ${r.duracion_estimada || duracionDefault} min`);
                }
                
                return usaEstaMesa;
            });
            
            if (tableReservations.length === 0) {
                console.log(`     ✅ RESULTADO: LIBRE (sin reservas)`);
                return true;
            }
            
            console.log(`     📌 Tiene ${tableReservations.length} reserva(s) - VERIFICANDO CONFLICTOS:`);
            
            // Verificar CADA reserva para detectar solapamientos
            for (let i = 0; i < tableReservations.length; i++) {
                const reserva = tableReservations[i];
                // 🔥 CRÍTICO: Usar duracion_estimada guardada o calcular según el día
                let reservaDuracion;
                if (reserva.duracion_estimada) {
                    reservaDuracion = reserva.duracion_estimada;
                } else {
                    reservaDuracion = calculateEffectiveDuration(reserva.fecha || fechaNormalizada);
                }
                const reservaHoraInicio = normalizeTime(reserva.hora);
                const reservaHoraFin = addMinutes(reservaHoraInicio, reservaDuracion);

                console.log(`\n     Reserva ${i+1}/${tableReservations.length}: ${reserva.reservation_id || reserva.id.substring(0,8)}`);
                console.log(`       Cliente: ${reserva.cliente_nombre}`);
                console.log(`       Estado: ${reserva.estado}`);
                console.log(`       Existente: ${reservaHoraInicio} - ${reservaHoraFin} (${reservaDuracion} min)`);
                console.log(`       Solicitado: ${horaNormalizada} - ${horaFin} (${duracionDefault} min)`);

                const hasConflict = timeRangesOverlap(horaNormalizada, horaFin, reservaHoraInicio, reservaHoraFin);
                
                if (hasConflict) {
                    console.log(`       ❌❌❌ ¡CONFLICTO DETECTADO!`);
                    console.log(`     ❌ RESULTADO: Mesa ${tableName} OCUPADA (conflicto con ${reserva.reservation_id || reserva.id.substring(0,8)})`);
                    return false;
                }
                
                console.log(`       ✅ Sin conflicto con esta reserva`);
            }
            
            console.log(`     ✅ RESULTADO: DISPONIBLE (sin conflictos)`);
            return true;
        };
        
        // Buscar mesas individuales disponibles
        const activeTables = tables.filter(t => t.activa && !unavailableTableIds.includes(t.id));
        console.log(`\n[checkAvailability][${requestId}] 🏢 Mesas activas para evaluar: ${activeTables.length}`);
        
        const availableTables = activeTables.filter(table => {
            if (table.capacidad < comensales) {
                console.log(`  ⛔ Mesa ${table.numero}: capacidad ${table.capacidad} < ${comensales} - DESCARTADA`);
                return false;
            }
            return isTableAvailable(table.id, table.numero);
        }).sort((a, b) => {
            const excessA = a.capacidad - comensales;
            const excessB = b.capacidad - comensales;
            if (excessA !== excessB) return excessA - excessB;
            return a.numero - b.numero;
        });
        
        console.log(`\n[checkAvailability][${requestId}] 📊 Mesas individuales DISPONIBLES: ${availableTables.length}`);
        
        if (availableTables.length > 0) {
            const table = availableTables[0];
            console.log(`\n✅✅✅ DISPONIBILIDAD CONFIRMADA: Mesa ${table.numero} (${table.capacidad} personas)`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            
            return Response.json({
                success: true,
                available: true,
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
            console.log(`\n[checkAvailability][${requestId}] 🔗 Buscando combinaciones de mesas...`);
            
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
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                
                return Response.json({
                    success: true,
                    available: true,
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
        
        // Generar todas las horas posibles del día basado en slots de apertura
        daySchedule.slots.forEach(slot => {
            const start = new Date(`1970-01-01T${slot.opening_time}:00`);
            const end = new Date(`1970-01-01T${slot.closing_time}:00`);
            for (let d = new Date(start); d.getTime() <= end.getTime(); d.setMinutes(d.getMinutes() + 15)) {
                const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                if (timeStr !== horaNormalizada) { // Excluir la hora solicitada
                    allPossibleTimes.push(timeStr);
                }
            }
        });
        
        // Verificar disponibilidad para cada hora
        for (const altHora of allPossibleTimes) {
            if (alternatives.length >= 3) break;
            
            const altHoraFin = addMinutes(altHora, duracionDefault);
            
            // Verificar si hay mesas disponibles en esta hora alternativa
            const altAvailableTables = activeTables.filter(table => {
                if (table.capacidad < comensales) return false;
                
                const tableReservations = reservacionesDelDia.filter(r => {
                    const esMainTable = r.mesa_id === table.id;
                    const esUnida = r.mesas_unidas && Array.isArray(r.mesas_unidas) && r.mesas_unidas.includes(table.id);
                    return esMainTable || esUnida;
                });
                
                if (tableReservations.length === 0) return true;
                
                for (const reserva of tableReservations) {
                    // 🔥 CRÍTICO: Usar duracion_estimada guardada o calcular según el día
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
        
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
        return Response.json({
            success: true,
            available: false,
            alternatives: alternatives.length > 0 ? alternatives : null,
            message: `Lo siento, no hay mesas disponibles para ${comensales} personas el ${fecha} a las ${hora}.`
        });
        
    } catch (error) {
        console.error(`\n[checkAvailability][${requestId}] 💥 ERROR:`, error.message);
        console.error(error.stack);
        return Response.json({
            success: false,
            message: 'Error al verificar disponibilidad',
            error: error.message
        }, { status: 500 });
    }
});