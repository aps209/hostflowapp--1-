import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Parsear el cuerpo de la solicitud para obtener el número de teléfono, fecha y opcionalmente la hora
    const { telefono, fecha, hora } = await req.json();

    if (!telefono) {
      return Response.json({ error: 'Número de teléfono no proporcionado.' }, { status: 400 });
    }

    if (!fecha) {
      return Response.json({ error: 'Fecha de la reserva no proporcionada.' }, { status: 400 });
    }

    // Normalizar el número de teléfono (quitar espacios y caracteres especiales)
    const normalizedPhone = telefono.replace(/[\s\-\(\)]/g, '');
    
    // Buscar todas las reservas activas para esa fecha - primero búsqueda exacta
    let reservations = await base44.asServiceRole.entities.Reservation.filter(
      { cliente_telefono: telefono, fecha: fecha, estado: { $ne: 'cancelada' } },
      '-created_date'
    );

    // Si no se encuentra nada, buscar todas las reservas activas de esa fecha y filtrar manualmente
    if (!reservations || reservations.length === 0) {
      const allReservations = await base44.asServiceRole.entities.Reservation.filter(
        { fecha: fecha, estado: { $ne: 'cancelada' } },
        '-created_date'
      );
      
      // Filtrar por números que coincidan (con o sin prefijo)
      reservations = allReservations.filter(r => {
        if (!r.cliente_telefono) return false;
        const savedPhone = r.cliente_telefono.replace(/[\s\-\(\)]/g, '');
        // Comparar números sin prefijo (últimos dígitos)
        return savedPhone.endsWith(normalizedPhone) || normalizedPhone.endsWith(savedPhone);
      });
    }

    if (!reservations || reservations.length === 0) {
      return Response.json({ error: 'No se encontró ninguna reserva activa para este número de teléfono en la fecha indicada.' }, { status: 404 });
    }

    // Si hay múltiples reservas en esa fecha y no se especificó la hora, pedir la hora
    if (reservations.length > 1 && !hora) {
      return Response.json({
        multiple_reservations: true,
        message: 'Se encontraron múltiples reservas para esa fecha. Por favor, indica la hora de la reserva que deseas cancelar.',
        reservations: reservations.map(r => ({
          hora: r.hora,
          comensales: r.comensales,
          mesa_numero: r.mesa_numero
        }))
      });
    }

    // Determinar qué reserva cancelar
    let reservationToCancel;
    if (hora) {
      reservationToCancel = reservations.find(r => r.hora === hora);
      if (!reservationToCancel) {
        return Response.json({ 
          error: 'No se encontró una reserva a esa hora para este número de teléfono en la fecha indicada.',
          available_reservations: reservations.map(r => ({
            hora: r.hora,
            comensales: r.comensales
          }))
        }, { status: 404 });
      }
    } else {
      // Si solo hay una reserva en esa fecha, cancelarla directamente
      reservationToCancel = reservations[0];
    }

    // Actualizar el estado de la reserva a 'cancelada'
    await base44.asServiceRole.entities.Reservation.update(reservationToCancel.id, {
      estado: 'cancelada'
    });

    return Response.json({ 
      message: 'Reserva cancelada exitosamente.', 
      reservationId: reservationToCancel.reservation_id,
      fecha: reservationToCancel.fecha,
      hora: reservationToCancel.hora,
      comensales: reservationToCancel.comensales
    });

  } catch (error) {
    console.error('[cancelarReservaAsistenteVoz] Error:', error);
    return Response.json({ error: `Hubo un error al cancelar la reserva: ${error.message}` }, { status: 500 });
  }
});