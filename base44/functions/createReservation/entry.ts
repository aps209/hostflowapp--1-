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
  
  const s1 = new Date(`1970-01-01T${s1Norm}:00`);
  let e1 = new Date(`1970-01-01T${e1Norm}:00`);
  const s2 = new Date(`1970-01-01T${s2Norm}:00`);
  let e2 = new Date(`1970-01-01T${e2Norm}:00`);
  
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

Deno.serve(async (req) => {
    const requestId = crypto.randomUUID().substring(0, 8);
    console.log(`\n[createReservation][${requestId}] 💾 Creando reserva...`);
    
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();
        
        const { restaurant_id, fecha, hora, comensales, nombre, telefono, email, notas, table_ids } = payload;
        
        // Validar parámetros obligatorios
        const missing = [];
        if (!restaurant_id) missing.push('restaurant_id');
        if (!fecha) missing.push('fecha');
        if (!hora) missing.push('hora');
        if (!comensales) missing.push('comensales');
        if (!nombre) missing.push('nombre');
        if (!telefono) missing.push('telefono');
        if (!table_ids || table_ids.length === 0) missing.push('table_ids');
        
        if (missing.length > 0) {
            return Response.json({ 
                success: false, 
                message: `Faltan parámetros: ${missing.join(', ')}`
            }, { status: 400 });
        }
        
        console.log(`[createReservation][${requestId}] Datos:`, { fecha, hora, comensales, nombre, table_ids });
        
        // Validar que no sea fecha/hora pasada
        const fechaNorm = fecha.trim();
        const horaNorm = telefono ? hora.trim().split(':').slice(0, 2).join(':') : hora.trim();
        const now = new Date();
        const requestDateTime = new Date(`${fechaNorm}T${horaNorm}:00`);
        
        if (requestDateTime < now) {
            console.log(`[createReservation][${requestId}] ❌ Fecha/hora en el pasado rechazada`);
            return Response.json({
                success: false,
                message: `No puedo hacer reservas en el pasado. Por favor, selecciona una fecha y hora futura.`
            }, { status: 400 });
        }
        
        // Cargar datos
        const [tables, allReservations, existingCustomers, tableAvailability, configs] = await Promise.all([
            base44.asServiceRole.entities.Table.filter({ restaurant_id }),
            base44.asServiceRole.entities.Reservation.filter({ restaurant_id }),
            base44.asServiceRole.entities.Customer.filter({ restaurant_id }),
            base44.asServiceRole.entities.TableAvailability.filter({ restaurant_id }),
            base44.asServiceRole.entities.RestaurantConfig.filter({ restaurant_id })
        ]);
        
        const config = configs[0] || {};
        const duracionDefaultGlobal = config.duracion_reserva_default || 90;
        
        // 🔥 CRÍTICO: Normalizar fecha PRIMERO antes de usarla
        const fechaNormalizada = fecha.trim();
        const horaNormalizada = normalizeTime(hora);
        
        // Cargar schedules y specialDays para calcular duración correcta
        const [schedules, specialDays] = await Promise.all([
            base44.asServiceRole.entities.Schedule.filter({ restaurant_id }),
            base44.asServiceRole.entities.SpecialDay.filter({ restaurant_id })
        ]);
        
        // 🔥 CRÍTICO: Calcular duración efectiva para ESTA fecha específica
        const calculateEffectiveDuration = (fechaString) => {
            const specialDay = specialDays.find(sd => sd.date === fechaString);
            if (specialDay?.duracion_reserva_default) {
                console.log(`[createReservation][${requestId}] ⏱️ Usando duración de día especial: ${specialDay.duracion_reserva_default} min`);
                return specialDay.duracion_reserva_default;
            }
            
            const date = new Date(fechaString + 'T00:00:00');
            const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
            const dayOfWeekName = dayNames[date.getDay()];
            const schedule = schedules.find(s => s.day_of_week === dayOfWeekName);
            
            if (schedule?.duracion_reserva_default) {
                console.log(`[createReservation][${requestId}] ⏱️ Usando duración del día ${dayOfWeekName}: ${schedule.duracion_reserva_default} min`);
                return schedule.duracion_reserva_default;
            }
            
            console.log(`[createReservation][${requestId}] ⏱️ Usando duración por defecto: ${duracionDefaultGlobal} min`);
            return duracionDefaultGlobal;
        };
        
        const duracionDefault = calculateEffectiveDuration(fechaNormalizada);
        
        // 🔥 CRÍTICO: Obtener mesas bloqueadas por TableAvailability ANTES de verificar mesas
        const unavailableTableIds = tableAvailability.filter(ta => ta.fecha === fechaNormalizada).map(ta => ta.mesa_id);
        console.log(`[createReservation][${requestId}] 🚫 Mesas bloqueadas para ${fechaNormalizada}: ${unavailableTableIds.length}`);
        if (unavailableTableIds.length > 0) {
            const blockedTables = tables.filter(t => unavailableTableIds.includes(t.id));
            console.log(`[createReservation][${requestId}]    IDs bloqueados: ${unavailableTableIds.join(', ')}`);
            console.log(`[createReservation][${requestId}]    Nombres: ${blockedTables.map(t => t.numero).join(', ')}`);
        }
        
        // Verificar que las mesas existen
        const selectedTables = tables.filter(t => table_ids.includes(t.id));
        if (selectedTables.length !== table_ids.length) {
            return Response.json({
                success: false,
                message: 'Una o más mesas especificadas no existen'
            }, { status: 400 });
        }
        
        selectedTables.sort((a, b) => a.numero - b.numero);
        const primaryTable = selectedTables[0];
        
        // 🔥 VERIFICACIÓN CRÍTICA: Comprobar que TODAS las mesas estén realmente disponibles
        const horaFin = addMinutes(horaNormalizada, duracionDefault);
        
        const reservacionesDelDia = allReservations.filter(r => {
            const fechaReserva = r.fecha ? r.fecha.trim() : '';
            if (fechaReserva !== fechaNormalizada) return false;
            if (r.estado === 'cancelada' || r.estado === 'completada' || r.estado === 'no_show') return false;
            return true;
        });
        
        console.log(`[createReservation][${requestId}] Reservas activas del día: ${reservacionesDelDia.length}`);
        
        // Verificar cada mesa solicitada
        for (const tableId of table_ids) {
            const table = tables.find(t => t.id === tableId);
            
            if (!table.activa) {
                console.log(`[createReservation][${requestId}] ❌ Mesa ${table.numero} está inactiva`);
                return Response.json({
                    success: false,
                    message: `La Mesa ${table.numero} no está disponible (inactiva)`
                }, { status: 409 });
            }
            
            if (unavailableTableIds.includes(tableId)) {
                console.log(`[createReservation][${requestId}] ❌ Mesa ${table.numero} bloqueada manualmente`);
                return Response.json({
                    success: false,
                    message: `La Mesa ${table.numero} no está disponible (bloqueada)`
                }, { status: 409 });
            }
            
            // Buscar conflictos
            const tableReservations = reservacionesDelDia.filter(r => 
                r.mesa_id === tableId || (r.mesas_unidas && r.mesas_unidas.includes(tableId))
            );
            
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
                
                if (timeRangesOverlap(horaNormalizada, horaFin, reservaHoraInicio, reservaHoraFin)) {
                    console.log(`[createReservation][${requestId}] ❌ CONFLICTO DETECTADO:`);
                    console.log(`  Mesa: ${table.numero}`);
                    console.log(`  Nueva: ${horaNormalizada}-${horaFin}`);
                    console.log(`  Existente: ${reservaHoraInicio}-${reservaHoraFin} (${reserva.reservation_id})`);
                    console.log(`  Cliente: ${reserva.cliente_nombre}`);
                    
                    return Response.json({
                        success: false,
                        message: `La Mesa ${table.numero} ya está reservada en ese horario (${reservaHoraInicio}-${reservaHoraFin}). Verifica disponibilidad nuevamente.`,
                        conflicting_reservation: {
                            id: reserva.id,
                            hora: reservaHoraInicio,
                            hora_fin: reservaHoraFin,
                            cliente: reserva.cliente_nombre
                        }
                    }, { status: 409 });
                }
            }
        }
        
        console.log(`[createReservation][${requestId}] ✅ Todas las mesas están disponibles`);
        
        // Buscar o crear cliente
        let customer = existingCustomers.find(c => 
            (telefono && c.telefono === telefono) || (email && c.email === email)
        );
        
        if (!customer) {
            customer = await base44.asServiceRole.entities.Customer.create({
                restaurant_id,
                nombre,
                telefono: telefono || '',
                estado: 'activo',
                total_visitas: 0
            });
            console.log(`[createReservation][${requestId}] Cliente creado: ${customer.id}`);
        } else {
            console.log(`[createReservation][${requestId}] Cliente existente: ${customer.id}`);
        }
        
        // Generar ID de reserva con formato R-YYYY-XXXX
        const currentYear = new Date().getFullYear();
        const yearPrefix = `R-${currentYear}-`;
        const existingReservations = allReservations.filter(r => 
            r.reservation_id && r.reservation_id.startsWith(yearPrefix)
        );
        const existingIds = existingReservations.map(r => {
            const parts = r.reservation_id.split('-');
            return parts.length === 3 ? parseInt(parts[2], 10) : 0;
        }).filter(num => !isNaN(num));
        const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
        const reservationId = `${yearPrefix}${String(maxId + 1).padStart(4, '0')}`;
        
        // Generar token de confirmación único
        const confirmationToken = crypto.randomUUID().replace(/-/g, '') + Date.now().toString(36);
        
        // Crear reserva
        const reservation = await base44.asServiceRole.entities.Reservation.create({
            restaurant_id,
            reservation_id: reservationId,
            cliente_id: customer?.id || null,
            cliente_nombre: nombre,
            cliente_telefono: telefono || '',
            fecha: fechaNormalizada,
            hora: horaNormalizada,
            comensales,
            mesa_id: primaryTable.id,
            mesa_numero: primaryTable.numero,
            mesas_unidas: selectedTables.length > 1 ? selectedTables.slice(1).map(t => t.id) : [],
            mesas_numeros: selectedTables.map(t => t.numero),
            estado: 'pendiente',
            notas: notas || '',
            origen: 'chatbot',
            duracion_estimada: duracionDefault,
            created_by: 'Raquel (Agente IA)',
            confirmation_token: confirmationToken
        });
        
        console.log(`[createReservation][${requestId}] ✅ Reserva creada: ${reservation.id}`);
        
        // Enviar email de confirmación si hay email
        if (email) {
            try {
                const appUrl = Deno.env.get('BASE44_APP_URL') || 'https://preview--hostflowapp.base44.app';
                const cancelUrl = `${appUrl}/functions/cancelarReservaDirecto?token=${confirmationToken}`;
                
                const mesasTextoEmail = selectedTables.length > 1 
                    ? `Mesas ${selectedTables.map(t => t.numero).join(', ')}`
                    : `Mesa ${primaryTable.numero}`;
                
                const emailBody = `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
                    <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                      <h1 style="color: #1e293b; margin-bottom: 20px;">✅ Reserva Confirmada</h1>
                      
                      <p style="color: #475569; font-size: 16px; margin-bottom: 20px;">
                        Hola ${nombre},
                      </p>
                      
                      <p style="color: #475569; font-size: 16px; margin-bottom: 30px;">
                        Tu reserva ha sido confirmada exitosamente.
                      </p>
                      
                      <div style="background-color: #f1f5f9; border-radius: 6px; padding: 20px; margin-bottom: 30px;">
                        <p style="color: #64748b; font-size: 14px; margin: 0 0 10px 0;">📅 Fecha</p>
                        <p style="color: #1e293b; font-size: 18px; font-weight: bold; margin: 0 0 20px 0;">${fechaNormalizada}</p>
                        
                        <p style="color: #64748b; font-size: 14px; margin: 0 0 10px 0;">🕐 Hora</p>
                        <p style="color: #1e293b; font-size: 18px; font-weight: bold; margin: 0 0 20px 0;">${horaNormalizada}</p>
                        
                        <p style="color: #64748b; font-size: 14px; margin: 0 0 10px 0;">👥 Comensales</p>
                        <p style="color: #1e293b; font-size: 18px; font-weight: bold; margin: 0 0 20px 0;">${comensales}</p>
                        
                        <p style="color: #64748b; font-size: 14px; margin: 0 0 10px 0;">🪑 Mesa</p>
                        <p style="color: #1e293b; font-size: 18px; font-weight: bold; margin: 0;">${mesasTextoEmail}</p>
                      </div>
                      
                      <p style="color: #475569; font-size: 14px; margin-bottom: 20px;">
                        ¡Te esperamos!
                      </p>
                      
                      <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 20px;">
                        <p style="color: #94a3b8; font-size: 12px; margin-bottom: 10px;">
                          ¿Necesitas cancelar tu reserva?
                        </p>
                        <a href="${cancelUrl}" 
                           style="display: inline-block; background-color: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 14px;">
                          Cancelar Reserva
                        </a>
                      </div>
                    </div>
                  </div>
                `;
                
                await base44.asServiceRole.integrations.Core.SendEmail({
                    to: email,
                    subject: `Confirmación de Reserva - ${fechaNormalizada} a las ${horaNormalizada}`,
                    body: emailBody
                });
                
                console.log(`[createReservation][${requestId}] ✅ Email de confirmación enviado a ${email}`);
            } catch (emailError) {
                console.error(`[createReservation][${requestId}] ⚠️ Error al enviar email:`, emailError.message);
                // No fallar la reserva si el email falla
            }
        }
        
        const [year, month, day] = fecha.split('-');
        const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        const fechaLegible = `${parseInt(day)} de ${meses[parseInt(month) - 1]}`;
        
        const mesasTexto = selectedTables.length > 1 
            ? `Mesas ${selectedTables.map(t => t.numero).join(', ')} (${selectedTables.length} mesas unidas)`
            : `Mesa ${primaryTable.numero}`;
        
        return Response.json({
            success: true,
            reservation_id: reservation.id,
            message: `¡Perfecto! He confirmado tu reserva:\n\n📅 ${fechaLegible}\n🕐 ${hora}\n👥 ${comensales} ${comensales === 1 ? 'persona' : 'personas'}\n🪑 ${mesasTexto}\n\n¡Te esperamos! Si necesitas cancelar, llámanos con antelación.`,
            reservation_data: {
                id: reservation.id,
                fecha,
                hora,
                comensales,
                mesas: selectedTables.map(t => t.numero),
                nombre
            }
        });
        
    } catch (error) {
        console.error(`[createReservation][${requestId}] Error:`, error.message);
        console.error(error.stack);
        return Response.json({
            success: false,
            message: 'Error al crear la reserva',
            error: error.message
        }, { status: 500 });
    }
});