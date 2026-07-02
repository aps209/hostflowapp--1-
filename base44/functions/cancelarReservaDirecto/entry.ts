import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    console.log('[cancelarReservaDirecto] Token recibido:', token);

    if (!token) {
      return new Response(generateHTML('error', 'No se proporcionó un token de cancelación válido.'), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    const base44 = createClientFromRequest(req);
    
    console.log('[cancelarReservaDirecto] Buscando reserva con token...');
    const reservations = await base44.asServiceRole.entities.Reservation.filter({ confirmation_token: token });
    console.log('[cancelarReservaDirecto] Reservas encontradas:', reservations.length);
    
    if (!reservations || reservations.length === 0) {
      return new Response(generateHTML('error', 'Reserva no encontrada o token inválido.'), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    const reservation = reservations[0];

    if (reservation.estado === 'cancelada') {
      return new Response(generateHTML('success', 'La reserva ya estaba cancelada.'), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    console.log('[cancelarReservaDirecto] Actualizando reserva a cancelada...');
    await base44.asServiceRole.entities.Reservation.update(reservation.id, {
      estado: 'cancelada'
    });
    console.log('[cancelarReservaDirecto] Reserva cancelada exitosamente');

    return new Response(generateHTML('success', 'Su reserva ha sido cancelada correctamente.'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (error) {
    console.error('[cancelarReservaDirecto] Error completo:', error);
    console.error('[cancelarReservaDirecto] Error message:', error.message);
    console.error('[cancelarReservaDirecto] Error stack:', error.stack);
    return new Response(generateHTML('error', `Hubo un error al procesar su solicitud: ${error.message}`), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      status: 500
    });
  }
});

function generateHTML(status, message) {
  const isSuccess = status === 'success';
  const icon = isSuccess ? '✅' : '❌';
  const color = isSuccess ? '#10b981' : '#ef4444';
  const title = isSuccess ? '¡Reserva Cancelada!' : 'Error al Cancelar';

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          margin: 0;
          padding: 20px;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          background: white;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          padding: 48px 32px;
          text-align: center;
          max-width: 500px;
          width: 100%;
        }
        .icon {
          font-size: 64px;
          margin-bottom: 24px;
        }
        h1 {
          color: ${color};
          font-size: 28px;
          margin: 0 0 16px 0;
          font-weight: 600;
        }
        p {
          color: #6b7280;
          font-size: 16px;
          line-height: 1.6;
          margin: 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">${icon}</div>
        <h1>${title}</h1>
        <p>${message}</p>
      </div>
    </body>
    </html>
  `;
}