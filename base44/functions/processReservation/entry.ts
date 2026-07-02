import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const timeRangesOverlap = (start1, end1, start2, end2) => {
  const s1 = new Date(`1970-01-01T${start1}:00`);
  let e1 = new Date(`1970-01-01T${end1}:00`);
  const s2 = new Date(`1970-01-01T${start2}:00`);
  let e2 = new Date(`1970-01-01T${end2}:00`);
  
  // Si la hora de fin es menor o igual que la hora de inicio, añadir un día
  if (e1 <= s1) e1 = new Date(e1.getTime() + 24 * 60 * 60 * 1000);
  if (e2 <= s2) e2 = new Date(e2.getTime() + 24 * 60 * 60 * 1000);
  
  return s1 < e2 && s2 < e1;
};

const addMinutes = (time, minutes) => {
  if (!time) return "";
  const [hours, mins] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, mins, 0);
  date.setMinutes(date.getMinutes() + minutes);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// 🔥 CRÍTICO: Calcular duración efectiva para ESTA fecha específica
const calculateEffectiveDuration = (fechaString, schedules, specialDays, duracionDefaultGlobal) => {
    const specialDay = specialDays.find(sd => sd.date === fechaString);
    if (specialDay?.duracion_reserva_default) {
        console.log(`[calculateEffectiveDuration] ⏱️ Día especial: ${specialDay.duracion_reserva_default} min`);
        return specialDay.duracion_reserva_default;
    }
    
    const date = new Date(fechaString + 'T00:00:00');
    const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    const dayOfWeekName = dayNames[date.getDay()];
    const schedule = schedules.find(s => s.day_of_week === dayOfWeekName);
    
    if (schedule?.duracion_reserva_default) {
        console.log(`[calculateEffectiveDuration] ⏱️ Día ${dayOfWeekName}: ${schedule.duracion_reserva_default} min`);
        return schedule.duracion_reserva_default;
    }
    
    console.log(`[calculateEffectiveDuration] ⏱️ Por defecto: ${duracionDefaultGlobal} min`);
    return duracionDefaultGlobal;
};

const findOptimalTable = (tables, allReservations, comensales, fecha, hora, duracionDefaultGlobal, tableAvailability, allowTableJoining, schedules, specialDays) => {
    if (!comensales || !fecha || !hora || !duracionDefaultGlobal) {
        console.log(`[findOptimalTable] ❌ Datos incompletos`);
        return null;
    }
    
    // 🔥 CRÍTICO: Calcular duración efectiva para ESTA fecha
    const duracionReserva = calculateEffectiveDuration(fecha, schedules, specialDays, duracionDefaultGlobal);
    
    console.log(`\n[findOptimalTable] 🔍 === INICIO BÚSQUEDA ===`);
    console.log(`[findOptimalTable] 📅 Fecha: ${fecha} | ⏰ Hora: ${hora} | 👥 Comensales: ${comensales} | ⏱️ Duración efectiva: ${duracionReserva}min`);
    console.log(`[findOptimalTable] 📊 Total reservas recibidas: ${allReservations.length}`);
    
    const horaFin = addMinutes(hora, duracionReserva);
    console.log(`[findOptimalTable] 🎯 Rango horario buscado: ${hora} - ${horaFin}`);
    
    const unavailableTableIds = tableAvailability.filter(ta => ta.fecha === fecha).map(ta => ta.mesa_id);
    console.log(`[findOptimalTable] 🚫 Mesas bloqueadas manualmente: ${unavailableTableIds.length}`);
    
    // 🔥 CRÍTICO: Filtrar MUY ESTRICTAMENTE solo reservas activas del día solicitado
    const reservacionesDelDia = allReservations.filter(r => {
        if (r.fecha !== fecha) return false;
        if (r.estado === 'cancelada' || r.estado === 'completada' || r.estado === 'no_show') return false;
        return true;
    });
    
    console.log(`[findOptimalTable] 📋 Reservas ACTIVAS del día ${fecha}: ${reservacionesDelDia.length}`);
    
    if (reservacionesDelDia.length > 0) {
        console.log(`[findOptimalTable] 📝 Listado de reservas existentes:`);
        reservacionesDelDia.forEach((r, idx) => {
            // 🔥 CRÍTICO: Usar duracion_estimada guardada o calcular según el día de esa reserva
            const rDur = r.duracion_estimada || calculateEffectiveDuration(r.fecha, schedules, specialDays, duracionDefaultGlobal);
            const rFin = addMinutes(r.hora, rDur);
            console.log(`  ${idx + 1}. ID: ${r.id.substring(0, 8)} | Mesa: ${r.mesa_numero} (ID: ${r.mesa_id?.substring(0,8)}) | ${r.hora}-${rFin} (${rDur}min) | ${r.comensales}p | Estado: ${r.estado}`);
        });
    } else {
        console.log(`[findOptimalTable] ℹ️ No hay reservas activas en este día`);
    }

    const isTableAvailable = (tableId, tableName) => {
        const table = tables.find(t => t.id === tableId);
        
        if (!table) {
            console.log(`    ❌ Mesa ${tableName}: NO ENCONTRADA en la lista de mesas`);
            return false;
        }
        
        if (!table.activa) {
            console.log(`    ❌ Mesa ${table.numero}: INACTIVA (activa=${table.activa})`);
            return false;
        }
        
        if (unavailableTableIds.includes(table.id)) {
            console.log(`    ❌ Mesa ${table.numero}: BLOQUEADA manualmente para ${fecha}`);
            return false;
        }
        
        // 🔥 CRÍTICO: Buscar TODAS las reservas que usen esta mesa (como principal o unida)
        const tableReservations = reservacionesDelDia.filter(r => {
            const isMainTable = r.mesa_id === tableId;
            const isJoinedTable = r.mesas_unidas && Array.isArray(r.mesas_unidas) && r.mesas_unidas.includes(tableId);
            return isMainTable || isJoinedTable;
        });
        
        if (tableReservations.length === 0) {
            console.log(`    ✅ Mesa ${table.numero}: LIBRE (sin reservas)`);
            return true;
        }
        
        console.log(`    🔍 Mesa ${table.numero}: Tiene ${tableReservations.length} reserva(s), verificando conflictos...`);
        
        // 🔥 CRÍTICO: Verificar CADA reserva para detectar solapamientos
        for (let i = 0; i < tableReservations.length; i++) {
            const reserva = tableReservations[i];
            // 🔥 CRÍTICO: Usar duracion_estimada guardada o calcular según el día de esa reserva
            const reservaDuracion = reserva.duracion_estimada || calculateEffectiveDuration(reserva.fecha, schedules, specialDays, duracionDefaultGlobal);
            const reservaHoraFin = addMinutes(reserva.hora, reservaDuracion);
            
            console.log(`      Reserva ${i + 1}/${tableReservations.length}:`);
            console.log(`        - ID: ${reserva.id.substring(0, 8)} | Cliente: ${reserva.cliente_nombre}`);
            console.log(`        - Horario existente: ${reserva.hora} - ${reservaHoraFin} (${reservaDuracion}min)`);
            console.log(`        - Horario solicitado: ${hora} - ${horaFin} (${duracionReserva}min)`);
            console.log(`        - Estado: ${reserva.estado}`);
            
            const hasConflict = timeRangesOverlap(hora, horaFin, reserva.hora, reservaHoraFin);
            
            if (hasConflict) {
                console.log(`        ❌ ¡CONFLICTO DETECTADO! La mesa está ocupada en ese horario`);
                console.log(`    ❌ Mesa ${table.numero}: OCUPADA (conflicto con reserva ${reserva.id.substring(0, 8)})`);
                return false;
            } else {
                console.log(`        ✅ Sin conflicto con esta reserva`);
            }
        }
        
        console.log(`    ✅ Mesa ${table.numero}: DISPONIBLE (sin conflictos)`);
        return true;
    };

    const activeTables = tables.filter(t => {
        if (!t.activa) return false;
        if (unavailableTableIds.includes(t.id)) return false;
        return true;
    });
    
    console.log(`\n[findOptimalTable] 🏢 Mesas activas para verificar: ${activeTables.length}`);
    
    let suitableTables = activeTables.filter(table => {
        console.log(`\n  📍 Verificando Mesa ${table.numero} (Cap: ${table.capacidad})...`);
        
        if (table.capacidad < comensales) {
            console.log(`    ❌ Capacidad insuficiente (${table.capacidad} < ${comensales})`);
            return false;
        }
        
        return isTableAvailable(table.id, table.numero);
    });

    console.log(`\n[findOptimalTable] 📊 Mesas disponibles encontradas: ${suitableTables.length}`);

    suitableTables = suitableTables.sort((a, b) => {
        const excessA = a.capacidad - comensales;
        const excessB = b.capacidad - comensales;
        if (excessA !== excessB) return excessA - excessB;
        return a.numero - b.numero;
    });

    if (suitableTables.length > 0) {
        const table = suitableTables[0];
        console.log(`\n[findOptimalTable] ✅✅✅ MESA ASIGNADA: ${table.numero} (Capacidad: ${table.capacidad})`);
        return { 
            table, 
            isJoined: false,
            allTables: [table]
        };
    }

    console.log(`\n[findOptimalTable] ⚠️ No hay mesas individuales disponibles`);

    if (allowTableJoining) {
        console.log(`\n[findOptimalTable] 🔗 === INTENTANDO UNIR MESAS ===`);
        
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

        console.log(`[findOptimalTable] 📦 Grupos de unión encontrados: ${Object.keys(joinGroups).length}`);

        let bestCombination = null;
        let minExcessCapacity = Infinity;

        for (const [groupId, groupTables] of Object.entries(joinGroups)) {
            console.log(`\n  🔗 Grupo "${groupId}" con ${groupTables.length} mesas`);
            
            const availableGroupTables = groupTables.filter(table => {
                const available = isTableAvailable(table.id, table.numero);
                return available;
            });
            
            console.log(`    Mesas disponibles en grupo: ${availableGroupTables.length}`);
            
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
            const primaryTable = sortedCombination[0];
            const totalCap = sortedCombination.reduce((sum, t) => sum + t.capacidad, 0);
            console.log(`\n[findOptimalTable] ✅✅✅ MESAS UNIDAS ASIGNADAS: ${sortedCombination.map(t => t.numero).join(' + ')} (Capacidad total: ${totalCap})`);
            return {
                table: primaryTable,
                joinedTables: sortedCombination.slice(1),
                isJoined: true,
                allTables: sortedCombination
            };
        }
    }

    console.log(`\n[findOptimalTable] ❌❌❌ SIN DISPONIBILIDAD - No se encontraron mesas\n`);
    return null;
};

const findAlternatives = (tables, reservations, comensales, fecha, hora, duracionDefaultGlobal, schedules, specialDays, tableAvailability, allowTableJoining) => {
    console.log(`\n[findAlternatives] 🔍 Buscando alternativas...`);
    const alternatives = [];
    const currentTime = hora;
    const slots = [];

    const specialDay = specialDays.find(d => d.date === fecha);
    let daySchedule = null;
    
    if (specialDay) {
        daySchedule = specialDay;
    } else {
        const date = new Date(fecha + 'T00:00:00');
        const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
        const dayName = dayNames[date.getDay()];
        daySchedule = schedules.find(s => s.day_of_week === dayName);
    }

    if (daySchedule && daySchedule.is_open && daySchedule.slots) {
        daySchedule.slots.forEach(slot => {
            const start = new Date(`1970-01-01T${slot.opening_time}`);
            const end = new Date(`1970-01-01T${slot.closing_time}`);
            for (let d = new Date(start); d <= end; d.setMinutes(d.getMinutes() + 30)) {
                const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                if (timeStr !== currentTime) slots.push(timeStr);
            }
        });
    }

    for (const altHora of slots) {
        if (alternatives.length >= 3) break;
        const result = findOptimalTable(tables, reservations, comensales, fecha, altHora, duracionDefaultGlobal, tableAvailability, allowTableJoining, schedules, specialDays);
        if (result && result.table) {
            alternatives.push({ fecha, hora: altHora });
        }
    }

    if (alternatives.length < 3) {
        for (let i = 1; i <= 2; i++) {
            const nextDate = new Date(fecha + 'T00:00:00');
            nextDate.setDate(nextDate.getDate() + i);
            const nextDateStr = nextDate.toISOString().split('T')[0];
            
            const nextDaySchedule = specialDays.find(d => d.date === nextDateStr) || 
                                   schedules.find(s => s.day_of_week === ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][nextDate.getDay()]);
            
            if (nextDaySchedule && nextDaySchedule.is_open && nextDaySchedule.slots) {
                nextDaySchedule.slots.forEach(slot => {
                    if (alternatives.length >= 3) return;
                    const result = findOptimalTable(tables, reservations, comensales, nextDateStr, slot.opening_time, duracionDefaultGlobal, tableAvailability, allowTableJoining, schedules, specialDays);
                    if (result && result.table) {
                        alternatives.push({ fecha: nextDateStr, hora: slot.opening_time });
                    }
                });
            }
        }
    }

    console.log(`[findAlternatives] ✅ Alternativas encontradas: ${alternatives.length}`);
    return alternatives;
};

Deno.serve(async (req) => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID().substring(0, 8);
    console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[processReservation][${requestId}] 🚀 NUEVA SOLICITUD - ${new Date().toISOString()}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();
        
        const restaurantId = payload.restaurant_id;
        
        if (!restaurantId) {
            console.error(`[processReservation][${requestId}] ❌ Falta restaurant_id`);
            return Response.json({ 
                success: false, 
                message: 'Error de configuración: no se identificó el restaurante. Por favor, contacta con nosotros directamente.'
            }, { status: 400 });
        }
        
        console.log(`[processReservation][${requestId}] ✅ Restaurant ID: ${restaurantId}`);
        
        const { fecha, hora, comensales, nombre, telefono, email, notas } = payload;
        
        const missingParams = [];
        if (!fecha) missingParams.push('fecha');
        if (!hora) missingParams.push('hora');
        if (!comensales) missingParams.push('comensales');
        if (!nombre) missingParams.push('nombre');
        if (!telefono) missingParams.push('teléfono');
        
        if (missingParams.length > 0) {
            console.log(`[processReservation][${requestId}] ⚠️ Faltan parámetros: ${missingParams.join(', ')}`);
            return Response.json({ 
                success: false, 
                message: `Necesito que me proporciones: ${missingParams.join(', ')}`
            }, { status: 400 });
        }
        
        console.log(`[processReservation][${requestId}] 📝 Solicitud:`);
        console.log(`  📅 Fecha: ${fecha}`);
        console.log(`  🕐 Hora: ${hora}`);
        console.log(`  👥 Comensales: ${comensales}`);
        console.log(`  👤 Cliente: ${nombre}`);
        console.log(`  📱 Teléfono: ${telefono}`);

        console.log(`\n[processReservation][${requestId}] 🔄 Cargando datos de la BD...`);
        const [tables, allReservations, existingCustomers, configs, schedules, specialDays, tableAvailability] = await Promise.all([
            base44.asServiceRole.entities.Table.filter({ restaurant_id: restaurantId }),
            base44.asServiceRole.entities.Reservation.filter({ restaurant_id: restaurantId }),
            base44.asServiceRole.entities.Customer.filter({ restaurant_id: restaurantId }),
            base44.asServiceRole.entities.RestaurantConfig.filter({ restaurant_id: restaurantId }),
            base44.asServiceRole.entities.Schedule.filter({ restaurant_id: restaurantId }),
            base44.asServiceRole.entities.SpecialDay.filter({ restaurant_id: restaurantId }),
            base44.asServiceRole.entities.TableAvailability.filter({ restaurant_id: restaurantId })
        ]);
        
        const config = configs[0] || {};
        const duracionDefault = config.duracion_reserva_default || 90;
        const allowTableJoining = config.allow_table_joining || false;
        
        const dbTime = Date.now() - startTime;
        console.log(`[processReservation][${requestId}] ✅ Datos cargados en ${dbTime}ms:`);
        console.log(`  🪑 Mesas: ${tables.length}`);
        console.log(`  📅 Reservas totales: ${allReservations.length}`);
        console.log(`  👥 Clientes: ${existingCustomers.length}`);
        console.log(`  ⚙️  Unión de mesas: ${allowTableJoining ? 'ACTIVADA ✅' : 'DESACTIVADA ❌'}`);
        console.log(`  ⏱️  Duración por defecto: ${duracionDefault} minutos`);
        
        if (tables.length === 0) {
            return Response.json({
                success: false,
                message: 'No hay mesas configuradas. Por favor, llámanos directamente.'
            }, { status: 500 });
        }
        
        // 🔥 VERIFICAR si el restaurante está cerrado ese día (día especial con is_open=false)
        const specialDayCheck = specialDays.find(sd => sd.date === fecha);
        if (specialDayCheck && specialDayCheck.is_open === false) {
            console.log(`[processReservation][${requestId}] ❌ El restaurante está CERRADO el ${fecha} (${specialDayCheck.name})`);
            return Response.json({
                success: false,
                message: `Lo siento, el restaurante está cerrado el ${fecha}${specialDayCheck.name ? ` (${specialDayCheck.name})` : ''}. Por favor, elige otra fecha.`
            });
        }

        // 🔥 VERIFICAR también si el día de la semana está cerrado (is_open=false en Schedule)
        const dateObj = new Date(fecha + 'T00:00:00');
        const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
        const dayName = dayNames[dateObj.getDay()];
        const daySchedule = schedules.find(s => s.day_of_week === dayName);
        if (daySchedule && daySchedule.is_open === false) {
            console.log(`[processReservation][${requestId}] ❌ El restaurante está CERRADO los ${dayName}`);
            return Response.json({
                success: false,
                message: `Lo siento, el restaurante está cerrado los ${dayName}. Por favor, elige otra fecha.`
            });
        }

        // Buscar mesa óptima
        const mesaResult = findOptimalTable(
            tables, 
            allReservations,
            comensales, 
            fecha, 
            hora,
            duracionDefault,
            tableAvailability,
            allowTableJoining,
            schedules,
            specialDays
        );
        
        if (!mesaResult || !mesaResult.table) {
            console.log(`\n[processReservation][${requestId}] ❌ Sin mesas disponibles, buscando alternativas...\n`);
            
            const alternatives = findAlternatives(
                tables, 
                allReservations,
                comensales, 
                fecha, 
                hora,
                duracionDefault,
                schedules,
                specialDays,
                tableAvailability,
                allowTableJoining
            );
            
            if (alternatives.length === 0) {
                console.log(`[processReservation][${requestId}] ❌ No se encontraron alternativas`);
                return Response.json({
                    success: false,
                    message: `Lo siento, no tengo mesas disponibles para ${comensales} personas el ${fecha} a las ${hora}. Por favor, llámanos directamente para más opciones.`
                });
            }
            
            const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
            const alternativasTexto = alternatives.map(alt => {
                const [year, month, day] = alt.fecha.split('-');
                const fechaLegible = `${parseInt(day)} de ${meses[parseInt(month) - 1]}`;
                return `${fechaLegible} a las ${alt.hora}`;
            }).join(', ');
            
            console.log(`[processReservation][${requestId}] ℹ️ Alternativas: ${alternativasTexto}`);
            
            return Response.json({
                success: false,
                message: `Lo siento, no tengo mesas disponibles para ${comensales} personas el ${fecha} a las ${hora}. Pero tengo disponibilidad en: ${alternativasTexto}. ¿Alguna de estas opciones te viene bien?`,
                alternatives: alternatives
            });
        }
        
        const selectedTable = mesaResult.table;
        const selectedTableIds = mesaResult.allTables.map(t => t.id);
        console.log(`\n[processReservation][${requestId}] 🪑 Mesa(s) seleccionada(s): ${mesaResult.allTables.map(t => t.numero).join(' + ')}`);
        
        // 🔥 CRÍTICO: VERIFICACIÓN FINAL - Recargar reservas justo antes de crear para prevenir race conditions
        console.log(`\n[processReservation][${requestId}] 🔒 Verificación final de disponibilidad...`);
        const finalReservations = await base44.asServiceRole.entities.Reservation.filter({ restaurant_id: restaurantId });
        
        const finalCheck = findOptimalTable(
            tables, 
            finalReservations,
            comensales, 
            fecha, 
            hora,
            duracionDefault,
            tableAvailability,
            allowTableJoining,
            schedules,
            specialDays
        );
        
        if (!finalCheck || !finalCheck.table || finalCheck.table.id !== selectedTable.id) {
            console.log(`[processReservation][${requestId}] ⚠️ CONFLICTO DETECTADO en verificación final`);
            console.log(`  Mesa original: ${selectedTable.id}`);
            console.log(`  Mesa en verificación: ${finalCheck?.table?.id || 'ninguna'}`);
            
            return Response.json({
                success: false,
                message: `Lo siento, la mesa que estaba disponible acaba de ser reservada por otra solicitud. Por favor, intenta de nuevo.`
            }, { status: 409 });
        }
        
        console.log(`[processReservation][${requestId}] ✅ Verificación final OK - Mesa ${selectedTable.numero} confirmada`);
        
        // Buscar o crear cliente
        let customer = existingCustomers.find(c => 
            (telefono && c.telefono === telefono) ||
            (email && c.email === email)
        );
        
        if (!customer) {
            console.log(`[processReservation][${requestId}] 👤 Creando nuevo cliente...`);
            customer = await base44.asServiceRole.entities.Customer.create({
                restaurant_id: restaurantId,
                nombre: nombre,
                telefono: telefono || '',
                estado: 'activo',
                total_visitas: 0
            });
            console.log(`[processReservation][${requestId}] ✅ Cliente creado: ${customer.id}`);
        } else {
            console.log(`[processReservation][${requestId}] ✅ Cliente existente: ${customer.id}`);
        }
        
        console.log(`\n[processReservation][${requestId}] 💾 Creando reserva en BD...`);
        
        // Generar ID de reserva con formato R-YYYY-XXXX
        const currentYear = new Date().getFullYear();
        const yearPrefix = `R-${currentYear}-`;
        const existingReservationsWithId = allReservations.filter(r => 
            r.reservation_id && r.reservation_id.startsWith(yearPrefix)
        );
        const existingIdNumbers = existingReservationsWithId.map(r => {
            const parts = r.reservation_id.split('-');
            return parts.length === 3 ? parseInt(parts[2], 10) : 0;
        }).filter(num => !isNaN(num));
        const maxIdNum = existingIdNumbers.length > 0 ? Math.max(...existingIdNumbers) : 0;
        const reservationId = `${yearPrefix}${String(maxIdNum + 1).padStart(4, '0')}`;
        console.log(`[processReservation][${requestId}] 🆔 Reservation ID generado: ${reservationId}`);
        
        // Generar token de confirmación
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        const confirmation_token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        
        const reservation = await base44.asServiceRole.entities.Reservation.create({
            restaurant_id: restaurantId,
            reservation_id: reservationId,
            cliente_id: customer?.id || null,
            cliente_nombre: nombre,
            cliente_email: email || '',
            cliente_telefono: telefono || '',
            fecha: fecha,
            hora: hora,
            comensales: comensales,
            mesa_id: selectedTable.id,
            mesa_numero: selectedTable.numero,
            mesas_unidas: mesaResult.isJoined ? mesaResult.joinedTables.map(t => t.id) : [],
            mesas_numeros: mesaResult.allTables.map(t => t.numero),
            estado: 'confirmada',
            notas: notas || '',
            origen: 'chatbot',
            duracion_estimada: calculateEffectiveDuration(fecha, schedules, specialDays, duracionDefault),
            created_by: 'Raquel (Agente IA)',
            confirmation_token: confirmation_token
        });
        
        console.log(`[processReservation][${requestId}] ✅ Reserva creada con ID: ${reservation.id}`);
        
        // 📧 Enviar email de confirmación si hay email
        if (email) {
            try {
                console.log(`[processReservation][${requestId}] 📧 Enviando email de confirmación...`);
                const emailResult = await base44.asServiceRole.functions.invoke('enviarEmailConfirmacion', {
                    reservationId: reservation.id,
                    restaurant_id: restaurantId
                });
                
                if (emailResult?.data?.success) {
                    console.log(`[processReservation][${requestId}] ✅ Email de confirmación enviado correctamente`);
                } else {
                    console.log(`[processReservation][${requestId}] ⚠️ Error al enviar email:`, emailResult?.data);
                }
            } catch (emailError) {
                console.error(`[processReservation][${requestId}] ❌ Error enviando email de confirmación:`, emailError.message);
            }
        } else {
            console.log(`[processReservation][${requestId}] ℹ️ No se envió email (no proporcionado)`);
        }
        
        const totalTime = Date.now() - startTime;
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`[processReservation][${requestId}] ✅✅✅ RESERVA CREADA EXITOSAMENTE`);
        console.log(`  🆔 ID: ${reservation.id}`);
        console.log(`  ⏱️  Tiempo total: ${totalTime}ms`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`);
        
        const [year, month, day] = fecha.split('-');
        const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        const fechaLegible = `${parseInt(day)} de ${meses[parseInt(month) - 1]}`;
        
        const mesasTexto = mesaResult.isJoined 
            ? `Mesas ${mesaResult.allTables.map(t => t.numero).join(', ')} (${mesaResult.allTables.length} mesas unidas)`
            : `Mesa ${selectedTable.numero}`;
        
        return Response.json({
            success: true,
            message: `¡Perfecto! He confirmado tu reserva:\n\n📅 ${fechaLegible}\n🕐 ${hora}\n👥 ${comensales} ${comensales === 1 ? 'persona' : 'personas'}\n🪑 ${mesasTexto}\n\n¡Te esperamos! Si necesitas cancelar, llámanos con antelación.`,
            reservationId: reservation.id,
            processingTime: `${totalTime}ms`,
            reservationData: {
                fecha: fecha,
                hora: hora,
                comensales: comensales,
                mesas: mesaResult.allTables.map(t => t.numero),
                nombre: nombre,
                isJoined: mesaResult.isJoined
            }
        });

    } catch (error) {
        console.error(`\n[processReservation][${requestId}] 💥💥💥 ERROR CRÍTICO:`);
        console.error(`[processReservation][${requestId}] Message: ${error.message}`);
        console.error(`[processReservation][${requestId}] Stack: ${error.stack}\n`);
        
        return Response.json({
            success: false,
            message: 'Hubo un problema técnico. ¿Podrías llamarnos directamente?',
            error: error.message
        }, { status: 500 });
    }
});