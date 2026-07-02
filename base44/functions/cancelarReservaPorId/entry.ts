import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { reservationId, restaurantId, telefono, webhookSecret } = payload;

    // Validar secret
    const EXPECTED_SECRET = Deno.env.get('VAPI_WEBHOOK_SECRET');
    if (EXPECTED_SECRET && webhookSecret !== EXPECTED_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!restaurantId) {
      return Response.json({ error: 'Se requiere el campo "restaurantId"' }, { status: 400 });
    }

    if (!telefono && !reservationId) {
      return Response.json({ error: 'Se requiere "telefono" o "reservationId"' }, { status: 400 });
    }

    let reservation = null;

    if (telefono) {
      // Buscar todas las reservas del restaurante con ese teléfono
      const matches = await base44.asServiceRole.entities.Reservation.filter({
        restaurant_id: restaurantId,
        cliente_telefono: telefono
      });

      const active = matches.filter(r => r.estado !== 'cancelada' && r.estado !== 'completada' && r.estado !== 'no_show');

      if (active.length === 0) {
        return Response.json({ error: 'No se encontraron reservas activas para ese teléfono', telefono }, { status: 404 });
      }

      if (active.length === 1) {
        // Solo hay una, usarla directamente
        reservation = active[0];
      } else {
        // Hay varias, necesitamos el reservationId para distinguir
        if (!reservationId) {
          const resIds = active.map(r => r.reservation_id || r.id).join(', ');
          return Response.json({
            error: 'Hay varias reservas activas para ese teléfono. Indica el reservationId para identificar cuál cancelar.',
            reservas: active.map(r => ({ reservation_id: r.reservation_id, fecha: r.fecha, hora: r.hora }))
          }, { status: 400 });
        }

        // Buscar entre las del teléfono la que coincida con el reservationId
        reservation = active.find(r => r.reservation_id === reservationId || r.id === reservationId) || null;

        if (!reservation) {
          return Response.json({ error: 'No se encontró la reserva con ese ID para el teléfono indicado' }, { status: 404 });
        }
      }
    } else {
      // Sin teléfono: buscar por id interno o por reservation_id
      try {
        reservation = await base44.asServiceRole.entities.Reservation.get(reservationId);
      } catch (_) {}

      if (!reservation) {
        const matches = await base44.asServiceRole.entities.Reservation.filter({ reservation_id: reservationId });
        reservation = matches[0] || null;
      }

      if (!reservation) {
        return Response.json({ error: 'Reserva no encontrada', reservationId }, { status: 404 });
      }

      // Verificar que pertenece al restaurante
      if (reservation.restaurant_id !== restaurantId) {
        return Response.json({ error: 'Reserva no encontrada para este restaurante' }, { status: 404 });
      }
    }

    // Verificar que no esté ya cancelada
    if (reservation.estado === 'cancelada') {
      return Response.json({ error: 'La reserva ya está cancelada' }, { status: 400 });
    }

    // Cancelar usando el id interno
    await base44.asServiceRole.entities.Reservation.update(reservation.id, { estado: 'cancelada' });

    return Response.json({
      success: true,
      message: 'Reserva cancelada correctamente',
      reservationId,
      cliente_nombre: reservation.cliente_nombre,
      fecha: reservation.fecha,
      hora: reservation.hora
    });

  } catch (error) {
    console.error('Error en cancelarReservaPorId:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});