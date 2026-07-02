import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    const requestId = crypto.randomUUID().substring(0, 8);
    console.log(`\n[actualizarDuracionReservas][${requestId}] 🔄 Iniciando actualización de duraciones`);
    
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const { restaurant_id, day_of_week, date, new_duration } = await req.json();
        
        if (!restaurant_id || !new_duration) {
            return Response.json({ 
                error: 'Faltan parámetros: restaurant_id y new_duration son obligatorios' 
            }, { status: 400 });
        }
        
        console.log(`[actualizarDuracionReservas][${requestId}] Parámetros:`, {
            restaurant_id,
            day_of_week: day_of_week || 'N/A',
            date: date || 'N/A',
            new_duration
        });
        
        // Determinar qué reservas actualizar
        let reservationsToUpdate = [];
        
        if (date) {
            // Actualizar reservas de un día especial específico
            console.log(`[actualizarDuracionReservas][${requestId}] Buscando reservas para día especial: ${date}`);
            reservationsToUpdate = await base44.asServiceRole.entities.Reservation.filter({
                restaurant_id,
                fecha: date,
                estado: { $nin: ['cancelada', 'completada', 'no_show'] }
            });
        } else if (day_of_week) {
            // Actualizar reservas de un día de la semana
            console.log(`[actualizarDuracionReservas][${requestId}] Buscando reservas para día de la semana: ${day_of_week}`);
            
            const allReservations = await base44.asServiceRole.entities.Reservation.filter({
                restaurant_id,
                estado: { $nin: ['cancelada', 'completada', 'no_show'] }
            });
            
            const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
            const dayIndex = dayNames.indexOf(day_of_week);
            
            if (dayIndex === -1) {
                return Response.json({ 
                    error: `Día de la semana inválido: ${day_of_week}` 
                }, { status: 400 });
            }
            
            // Filtrar reservas que correspondan a este día de la semana
            reservationsToUpdate = allReservations.filter(r => {
                if (!r.fecha) return false;
                const reservationDate = new Date(r.fecha + 'T00:00:00');
                return reservationDate.getDay() === dayIndex;
            });
        } else {
            return Response.json({ 
                error: 'Debes especificar day_of_week o date' 
            }, { status: 400 });
        }
        
        console.log(`[actualizarDuracionReservas][${requestId}] Total reservas encontradas: ${reservationsToUpdate.length}`);
        
        if (reservationsToUpdate.length === 0) {
            console.log(`[actualizarDuracionReservas][${requestId}] ✅ No hay reservas para actualizar`);
            return Response.json({
                success: true,
                updated: 0,
                message: 'No hay reservas activas para actualizar en este periodo'
            });
        }
        
        // Actualizar todas las reservas
        const updates = [];
        for (const reservation of reservationsToUpdate) {
            console.log(`[actualizarDuracionReservas][${requestId}] Actualizando reserva ${reservation.reservation_id}: ${reservation.duracion_estimada || 'sin duración'} min -> ${new_duration} min`);
            updates.push(
                base44.asServiceRole.entities.Reservation.update(reservation.id, {
                    duracion_estimada: new_duration
                })
            );
        }
        
        await Promise.all(updates);
        
        console.log(`[actualizarDuracionReservas][${requestId}] ✅ ${updates.length} reservas actualizadas correctamente`);
        
        return Response.json({
            success: true,
            updated: updates.length,
            message: `${updates.length} reserva(s) actualizada(s) con nueva duración de ${new_duration} minutos`
        });
        
    } catch (error) {
        console.error(`[actualizarDuracionReservas][${requestId}] ❌ Error:`, error);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});