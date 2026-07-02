import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { fecha, restaurantId, webhookSecret } = payload;

    // Validar secret
    const EXPECTED_SECRET = Deno.env.get('VAPI_WEBHOOK_SECRET');
    if (EXPECTED_SECRET && webhookSecret !== EXPECTED_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!fecha) {
      return Response.json({ error: 'Se requiere el campo "fecha" en formato YYYY-MM-DD' }, { status: 400 });
    }

    if (!restaurantId) {
      return Response.json({ error: 'Se requiere el campo "restaurantId"' }, { status: 400 });
    }

    const reservations = await base44.asServiceRole.entities.Reservation.filter({
      restaurant_id: restaurantId,
      fecha: fecha
    });

    // Filtrar canceladas y no shows
    const active = reservations.filter(r =>
      r.estado !== 'cancelada' && r.estado !== 'no_show'
    );

    // Ordenar por hora
    active.sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));

    const result = active.map(r => ({
      id: r.id,
      reservation_id: r.reservation_id || r.id,
      nombre: `${r.cliente_nombre || ''}${r.cliente_apellidos ? ' ' + r.cliente_apellidos : ''}`.trim(),
      telefono: r.cliente_telefono || null,
      email: r.cliente_email || null,
      fecha: r.fecha,
      hora: r.hora,
      comensales: r.comensales,
      estado: r.estado,
      mesa_numero: r.mesa_numero || null,
      notas: r.notas || null
    }));

    return Response.json({
      success: true,
      fecha,
      total: result.length,
      reservations: result
    });

  } catch (error) {
    console.error('Error en getReservationsByDate:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});