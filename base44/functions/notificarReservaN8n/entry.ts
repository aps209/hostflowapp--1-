import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { event, data } = payload;

    if (!data) {
      return Response.json({ error: 'Sin datos de reserva' }, { status: 400 });
    }

    const webhookUrl = Deno.env.get('N8N_WEBHOOK_URL');
    if (!webhookUrl) {
      return Response.json({ error: 'N8N_WEBHOOK_URL no configurada' }, { status: 500 });
    }

    const body = {
      event_type: event?.type || 'create',
      reservation_id: data.reservation_id || data.id,
      id: data.id,
      restaurant_id: data.restaurant_id,
      cliente_nombre: data.cliente_nombre,
      cliente_apellidos: data.cliente_apellidos || '',
      cliente_email: data.cliente_email || '',
      cliente_telefono: data.cliente_telefono || '',
      fecha: data.fecha,
      hora: data.hora,
      comensales: data.comensales,
      mesa_numero: data.mesa_numero || '',
      estado: data.estado,
      origen: data.origen || '',
      notas: data.notas || '',
      ocasion_especial: data.ocasion_especial || '',
      zona_preferida: data.zona_preferida || '',
      created_date: data.created_date,
      timestamp: new Date().toISOString()
    };

    console.log('[notificarReservaN8n] Enviando a n8n:', body.reservation_id);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[notificarReservaN8n] Error de n8n:', response.status, text);
      return Response.json({ error: 'Error enviando a n8n', status: response.status }, { status: 500 });
    }

    console.log('[notificarReservaN8n] ✅ Enviado correctamente');
    return Response.json({ success: true });

  } catch (error) {
    console.error('[notificarReservaN8n] Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});