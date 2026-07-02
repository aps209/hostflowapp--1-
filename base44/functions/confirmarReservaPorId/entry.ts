import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { reservationId, restaurantId, webhookSecret } = payload;

    // Validar secret
    const EXPECTED_SECRET = Deno.env.get('VAPI_WEBHOOK_SECRET');
    if (EXPECTED_SECRET && webhookSecret !== EXPECTED_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!restaurantId || !reservationId) {
      return Response.json({ error: 'Faltan parámetros: reservationId y restaurantId son obligatorios' }, { status: 400 });
    }

    // Buscar la reserva por ID interno
    let reservation = null;
    try {
      reservation = await base44.asServiceRole.entities.Reservation.get(reservationId);
    } catch (_) {}

    // Si no se encontró, buscar por reservation_id (formato R-0001)
    if (!reservation) {
      const matches = await base44.asServiceRole.entities.Reservation.filter({ reservation_id: reservationId });
      reservation = matches[0] || null;
    }

    if (!reservation || reservation.restaurant_id !== restaurantId) {
      return Response.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    // Verificar estado actual
    if (reservation.estado === 'confirmada') {
      return Response.json({ success: true, message: 'La reserva ya estaba confirmada' });
    }

    // Actualizar a estado 'confirmada'
    await base44.asServiceRole.entities.Reservation.update(reservation.id, { estado: 'confirmada' });

    return Response.json({
      success: true,
      message: 'Reserva confirmada correctamente',
      reservationId,
      cliente_nombre: reservation.cliente_nombre,
      fecha: reservation.fecha,
      hora: reservation.hora
    });

  } catch (error) {
    console.error('Error en confirmarReservaPorId:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});