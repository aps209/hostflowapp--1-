import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const addMinutes = (time, minutes) => {
  if (!time) return "";
  const [hours, mins] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, mins, 0);
  date.setMinutes(date.getMinutes() + minutes);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const timeRangesOverlap = (start1, end1, start2, end2) => {
  const s1 = new Date(`1970-01-01T${start1}:00`);
  let e1 = new Date(`1970-01-01T${end1}:00`);
  const s2 = new Date(`1970-01-01T${start2}:00`);
  let e2 = new Date(`1970-01-01T${end2}:00`);
  
  // Si la hora de fin es menor o igual que la hora de inicio, añadir un día (cruce de medianoche)
  if (e1 <= s1) e1 = new Date(e1.getTime() + 24 * 60 * 60 * 1000);
  if (e2 <= s2) e2 = new Date(e2.getTime() + 24 * 60 * 60 * 1000);
  
  return s1 < e2 && s2 < e1;
};

const normalizeZone = (zone) => {
  if (!zone || zone === null || zone === undefined) return '';
  const normalized = String(zone).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '');
  return normalized;
};

const zonesMatch = (zone1, zone2) => {
  const normalized1 = normalizeZone(zone1);
  const normalized2 = normalizeZone(zone2);
  
  console.log(`[zonesMatch] Comparando: "${zone1}" (normalizado: "${normalized1}") vs "${zone2}" (normalizado: "${normalized2}")`);
  
  if (!normalized1 && !normalized2) return true;
  if (!normalized1 || !normalized2) return false;
  
  // 🔥 CORREGIDO: Solo comparación EXACTA, sin includes
  // Esto evita que "Contrabarra" coincida con "Barra"
  const matches = normalized1 === normalized2;
  
  console.log(`[zonesMatch] Resultado: ${matches ? '✅ COINCIDEN (exacta)' : '❌ NO COINCIDEN'}`);
  
  return matches;
};

const getHoursUntilReservation = (fecha, hora) => {
    const now = new Date();
    const reservationDateTime = new Date(`${fecha}T${hora}:00`);
    const diffMs = reservationDateTime - now;
    return diffMs / (1000 * 60 * 60);
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

const _findOptimalTable = (tables, reservations, comensales, fecha, hora, zona_preferida, currentReservationId, duracionReserva, customers, clienteId, totalCapacity, tableAvailability, allowTableJoining = false, forceAlternativeZone = false, schedules = [], specialDays = []) => {
    if (!comensales || !fecha || !hora || !duracionReserva) return null;

    console.log('[_findOptimalTable] 🔍 INICIO - Parámetros:', { comensales, fecha, hora, zona_preferida, forceAlternativeZone, allowTableJoining, totalTablesReceived: tables.length, duracionReserva });

    // 🔥 CRÍTICO: Filtrar PRIMERO las mesas inactivas o no disponibles
    const activeTables = tables.filter(table => {
        const isActive = table.activa === true || table.activa === undefined;
        const isNotDisabled = table.estado !== 'no_disponible';
        
        if (!isActive) {
            console.log(`[_findOptimalTable] ⛔ MESA ${table.numero} (ID: ${table.id}) FILTRADA - activa: ${table.activa}`);
        }
        if (!isNotDisabled) {
            console.log(`[_findOptimalTable] ⛔ MESA ${table.numero} (ID: ${table.id}) FILTRADA - estado: ${table.estado}`);
        }
        
        return isActive && isNotDisabled;
    });

    console.log(`[_findOptimalTable] ✅ Mesas activas después del filtro: ${activeTables.length} de ${tables.length} totales`);
    
    if (activeTables.length === 0) {
        console.log('[_findOptimalTable] ❌ NO HAY MESAS ACTIVAS DISPONIBLES');
        return {
            table: null,
            reason: "No hay mesas activas disponibles en el restaurante.",
            warning: "Todas las mesas están desactivadas o marcadas como no disponibles.",
            isAlternative: true,
            matchesPreferredZone: false
        };
    }

    const horaFin = addMinutes(hora, duracionReserva);
    const hoursUntil = getHoursUntilReservation(fecha, hora);
    const occupancy = calculateDayOccupancy(fecha, reservations, totalCapacity);
    const isVIP = isVIPCustomer(clienteId, customers);
    
    const areaPreferida = zona_preferida ? normalizeZone(zona_preferida) : null;

    const unavailableTableIds = tableAvailability.filter(ta => ta.fecha === fecha).map(ta => ta.mesa_id);
    const reservacionesDelDia = reservations.filter(r => 
        r.fecha === fecha && 
        r.estado !== 'cancelada' && 
        r.estado !== 'completada' && 
        r.estado !== 'no_show' && 
        r.id !== currentReservationId
    );

    console.log('[_findOptimalTable] 🔍 Análisis del día:');
    console.log('   - Mesas bloqueadas manualmente:', unavailableTableIds.length);
    console.log('   - Reservas activas del día:', reservacionesDelDia.length);
    console.log('   - Nueva reserva:', `${hora} - ${horaFin} (${duracionReserva} min)`);
    
    if (reservacionesDelDia.length > 0) {
        console.log('   - Detalle de reservas existentes:');
        reservacionesDelDia.forEach(r => {
            const rFin = addMinutes(r.hora, r.duracion_estimada || duracionReserva);
            console.log(`     * ${r.reservation_id}: Mesa ${r.mesa_numero} (${r.hora} - ${rFin}) - ${r.comensales} personas`);
        });
    }

    const isTableAvailable = (tableId) => {
        const table = activeTables.find(t => t.id === tableId);
        
        if (!table) {
            console.log(`[isTableAvailable] ❌ Mesa ${tableId} no encontrada en lista de mesas activas`);
            return false;
        }
        
        if (unavailableTableIds.includes(table.id)) {
            console.log(`[isTableAvailable] ❌ Mesa ${table.numero} bloqueada manualmente para ${fecha}`);
            return false;
        }

        const tableReservations = reservacionesDelDia.filter(r => 
            r.mesa_id === tableId || (r.mesas_unidas && r.mesas_unidas.includes(tableId))
        );
        
        console.log(`[isTableAvailable] 🔍 Mesa ${table.numero} - Verificando ${tableReservations.length} reservas`);
        
        if (tableReservations.length === 0) {
            console.log(`[isTableAvailable] ✅ Mesa ${table.numero} LIBRE (sin reservas)`);
            return true;
        }

        for (const reserva of tableReservations) {
            // 🔥 CRÍTICO: Usar duracion_estimada de la reserva existente si existe
            // Si no existe, calcular la duración según el día de esa reserva (no usar duracionReserva de la nueva)
            let reservaDuracion;
            if (reserva.duracion_estimada) {
                reservaDuracion = reserva.duracion_estimada;
                console.log(`[isTableAvailable] ⏱️ Reserva ${reserva.reservation_id} usa duración guardada: ${reservaDuracion} min`);
            } else {
                // Calcular duración según el día de la reserva existente
                const specialDay = specialDays.find(sd => sd.date === reserva.fecha);
                if (specialDay?.duracion_reserva_default) {
                    reservaDuracion = specialDay.duracion_reserva_default;
                    console.log(`[isTableAvailable] ⏱️ Reserva ${reserva.reservation_id} usa duración de día especial: ${reservaDuracion} min`);
                } else {
                    const date = new Date(reserva.fecha + 'T00:00:00');
                    const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
                    const dayOfWeekName = dayNames[date.getDay()];
                    const daySchedule = schedules.find(s => s.day_of_week === dayOfWeekName);
                    
                    if (daySchedule?.duracion_reserva_default) {
                        reservaDuracion = daySchedule.duracion_reserva_default;
                        console.log(`[isTableAvailable] ⏱️ Reserva ${reserva.reservation_id} usa duración del día ${dayOfWeekName}: ${reservaDuracion} min`);
                    } else {
                        reservaDuracion = duracionReserva;
                        console.log(`[isTableAvailable] ⏱️ Reserva ${reserva.reservation_id} usa duración por defecto: ${reservaDuracion} min`);
                    }
                }
            }
            
            const reservaHoraFin = addMinutes(reserva.hora, reservaDuracion);
            
            const overlaps = timeRangesOverlap(hora, horaFin, reserva.hora, reservaHoraFin);
            
            if (overlaps) {
                console.log(`[isTableAvailable] ❌ Mesa ${table.numero} OCUPADA - Conflicto de horario:`);
                console.log(`   Nueva: ${hora} - ${horaFin} (${duracionReserva} min)`);
                console.log(`   Existente: ${reserva.hora} - ${reservaHoraFin} (${reservaDuracion} min) - ${reserva.reservation_id} - ${reserva.cliente_nombre}`);
                return false;
            }
        }

        console.log(`[isTableAvailable] ✅ Mesa ${table.numero} DISPONIBLE (sin conflictos de horario)`);
        return true;
    };

    // PASO 1: Intentar encontrar una mesa individual (SOLO EN MESAS ACTIVAS)
    let suitableTables = activeTables.filter(table => {
        if (unavailableTableIds.includes(table.id)) return false;
        if (table.capacidad < comensales) return false;
        
        // 🔥 CRÍTICO: Verificar exact_capacity_only - SIEMPRE se debe respetar
        if (table.exact_capacity_only === true && table.capacidad !== comensales) {
            console.log(`[_findOptimalTable] ⚠️ Mesa ${table.numero} DESCARTADA - exact_capacity_only=true (capacidad: ${table.capacidad}, comensales: ${comensales})`);
            return false;
        }
        
        if (table.capacidad >= 8 && comensales < 6 && hoursUntil > 1) return false;
        
        // 🔥 CORREGIDO: Si se está buscando en zona específica, usar zonesMatch para comparación correcta
        if (areaPreferida) {
            if (forceAlternativeZone) {
                // Si es zona alternativa forzada, debe coincidir exactamente
                if (!zonesMatch(table.sala, zona_preferida)) {
                    console.log(`[_findOptimalTable] ⚠️ Mesa ${table.numero} DESCARTADA - zona "${table.sala}" no coincide con "${zona_preferida}"`);
                    return false;
                }
            } else {
                // Si es búsqueda normal, priorizar pero no filtrar aún.
                // La zona preferida se usa en la ordenación, no en el filtrado inicial
                // a menos que forceAlternativeZone sea true.
            }
        }
        
        return isTableAvailable(table.id);
    });

    console.log(`[_findOptimalTable] 📋 Mesas candidatas después del filtrado: ${suitableTables.length}`);

    suitableTables = suitableTables.sort((a, b) => {
        const excessA = a.capacidad - comensales;
        const excessB = b.capacidad - comensales;
        
        if (excessA === 0 && excessB !== 0) return -1;
        if (excessB === 0 && excessA !== 0) return 1;
        
        // 🔥 CORREGIDO: Usar zonesMatch para priorización correcta
        if (areaPreferida) {
            const aMatchesZone = zonesMatch(a.sala, zona_preferida);
            const bMatchesZone = zonesMatch(b.sala, zona_preferida);
            
            console.log(`[_findOptimalTable] 🎯 Priorización de zona:`);
            console.log(`   Mesa ${a.numero} (${a.sala}) - Coincide con zona preferida: ${aMatchesZone}`);
            console.log(`   Mesa ${b.numero} (${b.sala}) - Coincide con zona preferida: ${bMatchesZone}`);
            
            if (aMatchesZone && !bMatchesZone) return -1;
            if (!aMatchesZone && bMatchesZone) return 1;
        }
        
        if (excessA !== excessB) return excessA - excessB;
        
        return a.numero - b.numero;
    });

    if (suitableTables.length > 0) {
        const table = suitableTables[0];
        const isInPreferredArea = areaPreferida && zonesMatch(table.sala, zona_preferida);
        
        console.log(`[_findOptimalTable] ✅ Mesa asignada: ${table.numero} (Zona: ${table.sala}, Capacidad: ${table.capacidad})`);
        console.log(`[_findOptimalTable] 🎯 Zona preferida "${zona_preferida}" respetada: ${isInPreferredArea ? 'SÍ ✅' : 'NO ❌'}`);
        
        let reason = 'Mesa asignada automáticamente';
        let warning = null;
        const sizeDiff = table.capacidad - comensales;

        if (forceAlternativeZone && isInPreferredArea) {
            reason = `Mesa en ${table.sala} (zona alternativa aceptada por el cliente)`;
        } else if (isInPreferredArea) {
            reason = `Mesa en ${table.sala} (área preferida)`;
        }
        
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

        return { 
            table, 
            reason, 
            warning, 
            isJoined: false,
            allTables: [table],
            matchesPreferredZone: isInPreferredArea,
            assignedZone: table.sala,
            zonasInvolucradas: [table.sala]
        };
    }

    console.log(`[_findOptimalTable] ❌ No se encontraron mesas individuales disponibles`);

    // PASO 2: Si allowTableJoining está activado, buscar combinaciones (SOLO EN MESAS ACTIVAS)
    if (allowTableJoining) {
        console.log('[_findOptimalTable] 🔗 Intentando unir mesas...');
        
        const joinGroups = {};
        activeTables.forEach(table => {
            if (unavailableTableIds.includes(table.id)) return;
            
            if (forceAlternativeZone && areaPreferida) {
                if (!zonesMatch(table.sala, zona_preferida)) return;
            }
            
            // 🔥 CRÍTICO: Las mesas con exact_capacity_only NO se pueden usar en grupos de unión
            // a menos que el grupo completo sume EXACTAMENTE el número de comensales solicitados
            // Por ahora, descartamos mesas con exact_capacity_only de los grupos de unión
            if (table.exact_capacity_only === true) {
                console.log(`[_findOptimalTable] ⚠️ Mesa ${table.numero} DESCARTADA de grupos de unión - exact_capacity_only=true`);
                return;
            }
            
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
            
            const isInPreferredArea = areaPreferida && zonesMatch(primaryTable.sala, zona_preferida);
            const allZonasInvolved = [...new Set(sortedCombination.map(t => t.sala))];
            
            console.log(`[_findOptimalTable] ✅ Mesas unidas asignadas: ${sortedCombination.map(t => t.numero).join(', ')}`);
            
            return {
                table: primaryTable,
                joinedTables: sortedCombination.slice(1),
                reason: forceAlternativeZone ? `Mesas unidas en ${primaryTable.sala} (zona alternativa aceptada)` : `Mesas unidas automáticamente (Grupo: ${bestGroupId})`,
                warning: `${bestCombination.length} mesas unidas: ${bestCombination.map(t => t.numero).join(', ')}. Capacidad total: ${totalCapacity} personas.`,
                isJoined: true,
                allTables: sortedCombination,
                matchesPreferredZone: isInPreferredArea,
                assignedZone: primaryTable.sala,
                zonasInvolucradas: allZonasInvolved
            };
        }
    }

    console.log('[_findOptimalTable] ❌ No hay disponibilidad (ni mesas individuales ni combinaciones)');
    
    // 🔥 CRÍTICO: Si forceAlternativeZone es true, NO buscar en otras zonas
    if (forceAlternativeZone) {
        console.log('[_findOptimalTable] ⚠️ forceAlternativeZone=true pero no hay mesas en la zona aceptada');
        return {
            table: null,
            reason: `ERROR CRÍTICO: La zona "${zona_preferida}" fue confirmada pero ya no hay mesas disponibles.`,
            warning: `Esto puede indicar una reserva simultánea. La mesa fue tomada por otro usuario.`,
            isAlternative: true,
            matchesPreferredZone: false
        };
    }
    
    // Solo si NO es forzar zona alternativa, buscar en otras zonas (SOLO EN MESAS ACTIVAS)
    const uniqueZones = [...new Set(activeTables.filter(t => t.sala).map(t => t.sala))];
    
    for (const zone of uniqueZones) {
        if (areaPreferida && zonesMatch(zone, zona_preferida)) { // Use zonesMatch for comparison
            continue;
        }
        
        console.log(`[_findOptimalTable] 🔍 Intentando buscar en zona alternativa: ${zone}`);
        const zoneResult = _findOptimalTable(
            activeTables, reservations, comensales, fecha, hora, 
            zone, currentReservationId, duracionReserva, 
            customers, clienteId, totalCapacity, tableAvailability, 
            allowTableJoining, true, schedules, specialDays
        );
        
        if (zoneResult && zoneResult.table) {
            console.log(`[_findOptimalTable] ℹ️ Zona alternativa encontrada: ${zone}`);
            return {
                ...zoneResult,
                needsConfirmation: true,
                alternativeZone: zone,
                originalZoneRequested: zona_preferida,
                matchesPreferredZone: false
            };
        }
    }
    
    return {
        table: null,
        reason: allowTableJoining ? "No hay mesas individuales ni combinaciones disponibles para este horario." : "No hay mesas disponibles para este horario.",
        warning: `Tiempo hasta reserva: ${hoursUntil > 0 ? hoursUntil.toFixed(1) : 0}h | Ocupación: ${occupancy.toFixed(0)}%`,
        isAlternative: true,
        matchesPreferredZone: false
    };
};

Deno.serve(async (req) => {
    const requestId = crypto.randomUUID().substring(0, 8);
    console.log(`[crearReservaPublica][${requestId}] 🚀 Nueva solicitud recibida en: ${new Date().toISOString()}`);
    console.log(`[crearReservaPublica][${requestId}] 📍 URL: ${req.url}`);
    console.log(`[crearReservaPublica][${requestId}] 📍 Method: ${req.method}`);
    
    try {
        const base44 = createClientFromRequest(req);
        
        let body;
        try {
            body = await req.json();
        } catch (e) {
            console.error(`[crearReservaPublica][${requestId}] ❌ Error parseando JSON:`, e);
            return Response.json({
                success: false,
                error: 'Datos inválidos'
            }, { status: 400 });
        }
        
        const { 
            slug, 
            cliente_nombre, 
            cliente_apellidos,
            cliente_email, 
            cliente_telefono,
            fecha, 
            hora, 
            comensales, 
            alergias,
            ocasion_especial,
            notas,
            preferencias,
            zona_preferida,
            force_alternative_zone = false,
            webhookSecret
        } = body;

        console.log(`[crearReservaPublica][${requestId}] 📦 Datos clave de la solicitud:`, { 
            slug: slug || 'FALTA',
            cliente_nombre: cliente_nombre || 'FALTA',
            fecha: fecha || 'FALTA',
            hora: hora || 'FALTA',
            comensales: comensales || 'FALTA',
            zona_preferida: zona_preferida || 'NO ESPECIFICADA',
            force_alternative_zone
        });

        const EXPECTED_WEBHOOK_SECRET = Deno.env.get('VAPI_WEBHOOK_SECRET');
        if (webhookSecret && EXPECTED_WEBHOOK_SECRET && webhookSecret !== EXPECTED_WEBHOOK_SECRET) {
            console.error(`[crearReservaPublica][${requestId}] ⚠️ Webhook secret inválido`);
            return Response.json({ 
                success: false, 
                error: 'No autorizado' 
            }, { status: 401 });
        }

        const missingFields = [];
        if (!slug) missingFields.push('slug');
        if (!cliente_nombre) missingFields.push('cliente_nombre');
        if (!fecha) missingFields.push('fecha');
        if (!hora) missingFields.push('hora');
        if (!comensales) missingFields.push('comensales');

        if (missingFields.length > 0) {
          console.error(`[crearReservaPublica][${requestId}] ❌ Faltan datos requeridos:`, missingFields);
          return Response.json({
            success: false,
            error: `Faltan campos requeridos: ${missingFields.join(', ')}`,
            message: `Error en la reserva: Faltan los siguientes datos obligatorios: ${missingFields.join(', ')}.`
          }, { status: 400 });
        }

        const restaurants = await base44.asServiceRole.entities.Restaurant.filter({ slug });
        
        if (restaurants.length === 0) {
            console.log(`[crearReservaPublica][${requestId}] ❌ Restaurante no encontrado`);
            return Response.json({
                success: false,
                error: 'Restaurante no encontrado'
            }, { status: 404 });
        }

        const restaurant = restaurants[0];
        console.log(`[crearReservaPublica][${requestId}] ✅ Restaurante encontrado (ID: ${restaurant.id})`);

        const configs = await base44.asServiceRole.entities.RestaurantConfig.filter({
            restaurant_id: restaurant.id
        });
        const config = configs[0] || {};
        
        const duracionDefault = config.duracion_reserva_default || 90;
        const maxComensales = config.max_comensales_reserva || 20;
        const totalCapacity = config.capacidad_total || 100;
        const allowTableJoining = config.allow_table_joining || false;

        console.log(`[crearReservaPublica][${requestId}] ⚙️ Configuración del restaurante:`, { duracionDefault, maxComensales, allowTableJoining });

        if (comensales > maxComensales) {
            console.log(`[crearReservaPublica][${requestId}] ❌ Excede máximo de comensales (${comensales} > ${maxComensales})`);
            return Response.json({
                success: false,
                error: `El número máximo de comensales por reserva es ${maxComensales}`
            }, { status: 400 });
        }

        // Cargar datos necesarios para la búsqueda de mesas
        const allTables = await base44.asServiceRole.entities.Table.filter({
            restaurant_id: restaurant.id
        });
        
        const tableAvailability = await base44.asServiceRole.entities.TableAvailability.filter({
            restaurant_id: restaurant.id
        });

        const schedules = await base44.asServiceRole.entities.Schedule.filter({
            restaurant_id: restaurant.id
        });

        const specialDays = await base44.asServiceRole.entities.SpecialDay.filter({
            restaurant_id: restaurant.id
        });

        // 🔥 NUEVO: Calcular duración efectiva para ESTA reserva específica
        const calculateEffectiveDuration = (fechaString) => {
            const specialDay = specialDays.find(sd => sd.date === fechaString);
            if (specialDay?.duracion_reserva_default) {
                console.log(`[crearReservaPublica][${requestId}] ⏱️ Usando duración de día especial: ${specialDay.duracion_reserva_default} minutos`);
                return specialDay.duracion_reserva_default;
            }
            
            const date = new Date(fechaString + 'T00:00:00');
            const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
            const dayOfWeekName = dayNames[date.getDay()];
            const daySchedule = schedules.find(s => s.day_of_week === dayOfWeekName);
            
            if (daySchedule?.duracion_reserva_default) {
                console.log(`[crearReservaPublica][${requestId}] ⏱️ Usando duración del día de la semana (${dayOfWeekName}): ${daySchedule.duracion_reserva_default} minutos`);
                return daySchedule.duracion_reserva_default;
            }
            
            console.log(`[crearReservaPublica][${requestId}] ⏱️ Usando duración por defecto: ${duracionDefault} minutos`);
            return duracionDefault;
        };

        const duracionReserva = calculateEffectiveDuration(fecha);
        console.log(`[crearReservaPublica][${requestId}] ⏱️ Duración de reserva efectiva final:`, duracionReserva, 'minutos');

        // 🔥 VERIFICAR si el restaurante está cerrado ese día (día especial con is_open=false)
        const specialDayCheck = specialDays.find(sd => sd.date === fecha);
        if (specialDayCheck && specialDayCheck.is_open === false) {
            console.log(`[crearReservaPublica][${requestId}] ❌ El restaurante está CERRADO el ${fecha} (${specialDayCheck.name})`);
            return Response.json({
                success: false,
                error: `El restaurante está cerrado el ${fecha}${specialDayCheck.name ? ` (${specialDayCheck.name})` : ''}.`,
                message: `Lo sentimos, el restaurante está cerrado ese día${specialDayCheck.name ? ` (${specialDayCheck.name})` : ''}. Por favor, selecciona otra fecha.`
            }, { status: 400 });
        }

        // 🔥 VERIFICAR también si el día de la semana está cerrado
        const dateObjCheck = new Date(fecha + 'T00:00:00');
        const dayNamesArr = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
        const dayNameCheck = dayNamesArr[dateObjCheck.getDay()];
        const dayScheduleCheck = schedules.find(s => s.day_of_week === dayNameCheck);
        if (dayScheduleCheck && dayScheduleCheck.is_open === false) {
            console.log(`[crearReservaPublica][${requestId}] ❌ El restaurante está CERRADO los ${dayNameCheck}`);
            return Response.json({
                success: false,
                error: `El restaurante está cerrado los ${dayNameCheck}.`,
                message: `Lo sentimos, el restaurante está cerrado los ${dayNameCheck}. Por favor, selecciona otra fecha.`
            }, { status: 400 });
        }

        // 🔥 OPTIMIZACIÓN: Solo cargamos reservas de la fecha solicitada (y estados activos).
        // No tiene sentido cargar el historial completo para verificar disponibilidad de UN día.
        console.log(`[crearReservaPublica][${requestId}] 🔄 Cargando reservas del día ${fecha} para verificación de disponibilidad...`);
        const allReservations = await base44.asServiceRole.entities.Reservation.filter({
            restaurant_id: restaurant.id,
            fecha: fecha
        });

        console.log(`[crearReservaPublica][${requestId}] 📊 Datos cargados - Mesas: ${allTables.length}, Reservas (actualizadas): ${allReservations.length}`);

        console.log(`[crearReservaPublica][${requestId}] 🔍 Buscando mesa óptima...`);
        const mesaResult = _findOptimalTable(
            allTables,
            allReservations, // Usar las reservas más recientes
            comensales,
            fecha,
            hora,
            zona_preferida,
            null, // currentReservationId no aplica para nueva reserva
            duracionReserva, // 🔥 Usando la duración calculada específicamente
            [], // customers: no se carga masivamente, VIP check no aplica en reserva nueva
            null, // clienteId no aplica aún
            totalCapacity,
            tableAvailability,
            allowTableJoining,
            force_alternative_zone,
            schedules, // 🔥 Pasar schedules para calcular duraciones correctas
            specialDays // 🔥 Pasar specialDays para calcular duraciones correctas
        );

        if (mesaResult?.needsConfirmation && !force_alternative_zone) {
            console.log(`[crearReservaPublica][${requestId}] ℹ️ Zona preferida no disponible, ofreciendo alternativa:`, mesaResult.alternativeZone);
            return Response.json({
                success: false,
                requiresZoneConfirmation: true,
                message: `La zona "${mesaResult.originalZoneRequested}" no está disponible. Sin embargo, tenemos disponibilidad en la zona "${mesaResult.alternativeZone}". ¿Deseas continuar con la reserva en "${mesaResult.alternativeZone}"?`,
                alternativeZone: mesaResult.alternativeZone,
                originalZone: mesaResult.originalZoneRequested
            }, { status: 200 });
        }

        if (!mesaResult || !mesaResult.table) {
            console.log(`[crearReservaPublica][${requestId}] ❌ No hay mesas disponibles`);
            return Response.json({
                success: false,
                error: mesaResult?.reason || 'No hay mesas disponibles para este horario',
                message: mesaResult?.reason || 'Lo sentimos, no hay mesas disponibles para este horario. Por favor, selecciona otro horario.'
            }, { status: 400 });
        }

        console.log(`[crearReservaPublica][${requestId}] ✅ Mesa encontrada inicialmente: ${mesaResult.table.numero} (ID: ${mesaResult.table.id})`);

        // 🔥 CRÍTICO: VERIFICACIÓN FINAL contra race condition.
        // Recargar las reservas una última vez justo antes de crear la nueva.
        console.log(`[crearReservaPublica][${requestId}] 🔄 Realizando verificación final de disponibilidad para prevenir conflictos...`);
        const finalReservations = await base44.asServiceRole.entities.Reservation.filter({
            restaurant_id: restaurant.id,
            fecha: fecha
        });

        const finalCheckResult = _findOptimalTable(
            allTables,
            finalReservations, // Usar las reservas más recientes para la verificación final
            comensales,
            fecha,
            hora,
            zona_preferida,
            null,
            duracionReserva, // 🔥 Usando la misma duración calculada
            [], // customers: no se carga masivamente
            null,
            totalCapacity,
            tableAvailability,
            allowTableJoining,
            force_alternative_zone,
            schedules, // 🔥 Pasar schedules para calcular duraciones correctas
            specialDays // 🔥 Pasar specialDays para calcular duraciones correctas
        );

        // Si el resultado de la verificación final no encuentra una mesa,
        // O si la mesa encontrada es diferente a la que habíamos asignado inicialmente,
        // significa que otra reserva tomó la mesa en el ínterim.
        if (!finalCheckResult || !finalCheckResult.table || finalCheckResult.table.id !== mesaResult.table.id) {
            console.log(`[crearReservaPublica][${requestId}] ⚠️ CONFLICTO DETECTADO: La mesa originalmente asignada (ID: ${mesaResult.table.id}) ya no está disponible o ha cambiado.`);
            console.log(`   Resultado de la verificación final:`, finalCheckResult?.table ? `Mesa ID: ${finalCheckResult.table.id}` : 'No se encontró mesa.');
            return Response.json({
                success: false,
                error: 'Lo sentimos, la mesa seleccionada acaba de ser reservada por otra solicitud. Por favor, inténtalo de nuevo seleccionando un horario o zona diferente.',
                message: 'La mesa que intentabas reservar acaba de ser tomada. Por favor, vuelve a intentar.'
            }, { status: 409 }); // 409 Conflict
        }
        console.log(`[crearReservaPublica][${requestId}] ✅ Verificación final de disponibilidad OK. Mesa ID ${mesaResult.table.id} confirmada.`);


        let customerId;
        let customer = null;
        const nombreCompleto = `${cliente_nombre} ${cliente_apellidos || ''}`.trim();

        if (cliente_email) {
            const existingByEmail = await base44.asServiceRole.entities.Customer.filter({
                email: cliente_email,
                restaurant_id: restaurant.id
            });
            if (existingByEmail.length > 0) customer = existingByEmail[0];
        }
        
        if (!customer && cliente_telefono) {
            const existingByPhone = await base44.asServiceRole.entities.Customer.filter({
                telefono: cliente_telefono,
                restaurant_id: restaurant.id
            });
            if (existingByPhone.length > 0) customer = existingByPhone[0];
        }

        if (customer) {
            customerId = customer.id;
            console.log(`[crearReservaPublica][${requestId}] 👤 Cliente existente (ID: ${customerId}) actualizado.`);
            await base44.asServiceRole.entities.Customer.update(customerId, {
                total_visitas: (customer.total_visitas || 0) + 1,
                ultima_visita: fecha,
                nombre: nombreCompleto,
                apellidos: cliente_apellidos || '',
                alergias: alergias && alergias.trim() ? alergias.trim() : customer.alergias
            });
        } else {
            const newCustomer = await base44.asServiceRole.entities.Customer.create({
                nombre: nombreCompleto,
                apellidos: cliente_apellidos || '',
                email: cliente_email || "",
                telefono: cliente_telefono || "",
                total_visitas: 1,
                ultima_visita: fecha,
                restaurant_id: restaurant.id,
                alergias: alergias && alergias.trim() ? alergias.trim() : "",
            });
            customerId = newCustomer.id;
            console.log(`[crearReservaPublica][${requestId}] 👤 Nuevo cliente creado (ID: ${customerId}).`);
        }

        // Generar ID de reserva con formato R-YYYY-XXXX
        // 🔥 OPTIMIZACIÓN: Solo necesitamos las reservas del año actual para calcular el siguiente ID
        const currentYear = new Date().getFullYear();
        const yearPrefix = `R-${currentYear}-`;
        const allReservationsForIdGeneration = await base44.asServiceRole.entities.Reservation.filter({
            restaurant_id: restaurant.id,
            reservation_id: { $regex: `^${yearPrefix}` }
        });
        const existingIds = allReservationsForIdGeneration
            .filter(r => r.reservation_id && r.reservation_id.startsWith(yearPrefix))
            .map(r => {
                const parts = r.reservation_id.split('-');
                return parts.length === 3 ? parseInt(parts[2], 10) : 0;
            })
            .filter(num => !isNaN(num));
        const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
        const reservation_id = `${yearPrefix}${String(maxId + 1).padStart(4, '0')}`;

        const reservaData = {
            restaurant_id: restaurant.id,
            reservation_id: reservation_id,
            cliente_id: customerId || '',
            cliente_nombre: nombreCompleto,
            cliente_apellidos: cliente_apellidos || '',
            cliente_email: cliente_email || '',
            cliente_telefono: cliente_telefono || '',
            fecha,
            hora,
            comensales,
            mesa_id: mesaResult.table.id,
            mesa_numero: mesaResult.table.numero,
            mesas_unidas: mesaResult.joinedTables ? mesaResult.joinedTables.map(t => t.id) : [],
            mesas_numeros: mesaResult.allTables ? mesaResult.allTables.map(t => t.numero) : [mesaResult.table.numero],
            estado: 'pendiente',
            notas: notas || '',
            ocasion_especial: ocasion_especial || 'ninguna',
            duracion_estimada: duracionReserva, // 🔥 GUARDANDO la duración calculada específica
            preferencias: preferencias || '',
            zona_preferida: zona_preferida || '',
            origen: 'web',
            created_by: 'formulario-publico', // Identificador único para formulario público
            confirmation_token: crypto.randomUUID()
        };

        const nuevaReserva = await base44.asServiceRole.entities.Reservation.create(reservaData);
        console.log(`[crearReservaPublica][${requestId}] ✅ Reserva creada (ID: ${nuevaReserva.id}, No: ${reservation_id}) con duración: ${duracionReserva} minutos`);

        if (cliente_email) {
            try {
                await base44.asServiceRole.functions.invoke('enviarEmailConfirmacion', {
                    reservationId: nuevaReserva.id,
                    restaurant_id: restaurant.id
                });
                console.log(`[crearReservaPublica][${requestId}] ✅ Email de confirmación enviado.`);
            } catch (emailError) {
                console.error(`[crearReservaPublica][${requestId}] ⚠️ Error enviando email de confirmación:`, emailError);
            }
        }

        return Response.json({
            success: true,
            reservation: {
                id: nuevaReserva.id,
                reservation_id: reservation_id,
                fecha,
                hora,
                comensales,
                mesa_numero: mesaResult.table.numero,
                mesas_numeros: reservaData.mesas_numeros,
                zona_asignada: mesaResult.assignedZone,
                zonas_involucradas: mesaResult.zonasInvolucradas || [mesaResult.assignedZone],
                duracion_estimada: duracionReserva, // 🔥 Devolver la duración para confirmación
                confirmation_token: nuevaReserva.confirmation_token
            },
            mesa_asignada: mesaResult.isJoined 
                ? `Mesas ${reservaData.mesas_numeros.join(', ')}`
                : `Mesa ${mesaResult.table.numero}`,
            zona_asignada: mesaResult.assignedZone,
            zona_preferida_respetada: mesaResult.matchesPreferredZone,
            message: mesaResult.isJoined 
                ? `Reserva confirmada - Mesas ${reservaData.mesas_numeros.join(', ')} en ${mesaResult.assignedZone}`
                : `Reserva confirmada - Mesa ${mesaResult.table.numero} en ${mesaResult.assignedZone}`
        });

    } catch (error) {
        console.error(`[crearReservaPublica][${requestId}] 💥 Error inesperado:`, error);
        return Response.json({
            success: false,
            error: error.message || 'Error interno al crear la reserva',
            message: 'Ha ocurrido un error inesperado al procesar tu reserva. Por favor, inténtalo de nuevo más tarde.'
        }, { status: 500 });
    }
});