import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  console.log('[enviarEmailCancelacion] 🚀 Nueva solicitud recibida');
  
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { reservationId } = payload;

    if (!reservationId) {
      return Response.json({ 
        success: false, 
        error: 'reservationId es requerido' 
      }, { status: 400 });
    }

    // Obtener la reserva
    const reservations = await base44.asServiceRole.entities.Reservation.filter({
      id: reservationId
    });

    if (reservations.length === 0) {
      return Response.json({ 
        success: false, 
        error: 'Reserva no encontrada' 
      }, { status: 404 });
    }

    const reservation = reservations[0];

    if (!reservation.cliente_email) {
      console.log('[enviarEmailCancelacion] ℹ️ La reserva no tiene email asociado');
      return Response.json({ 
        success: false, 
        error: 'La reserva no tiene email asociado' 
      }, { status: 400 });
    }

    // Obtener el restaurante
    const restaurants = await base44.asServiceRole.entities.Restaurant.filter({
      id: reservation.restaurant_id
    });

    const restaurant = restaurants[0] || { nombre: 'Restaurante' };

    // Obtener configuración del restaurante
    const configs = await base44.asServiceRole.entities.RestaurantConfig.filter({
      restaurant_id: reservation.restaurant_id
    });
    const restaurantConfig = configs[0] || {};

    const fechaObj = new Date(reservation.fecha + 'T00:00:00');
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const fechaFormateada = fechaObj.toLocaleDateString('es-ES', opciones);

    const nombreCompleto = `${reservation.cliente_nombre || ''} ${reservation.cliente_apellidos || ''}`.trim() || 'Cliente';

    let mesaInfoEmail = '';
    if (reservation.mesas_numeros && reservation.mesas_numeros.length > 1) {
      mesaInfoEmail = `<p style="margin: 0 0 8px 0; color: #555555; font-size: 15px;"><strong>Mesas:</strong> ${reservation.mesas_numeros.join(', ')}</p>`;
    } else if (reservation.mesas_numeros && reservation.mesas_numeros.length === 1) {
      mesaInfoEmail = `<p style="margin: 0 0 8px 0; color: #555555; font-size: 15px;"><strong>Mesa:</strong> ${reservation.mesas_numeros[0]}</p>`;
    }

    const emailHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reserva cancelada</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px;">Reserva Cancelada</h1>
              <p style="margin: 10px 0 0 0; color: #fca5a5; font-size: 16px;">${restaurant.nombre}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px;">Hola <strong>${nombreCompleto}</strong>,</p>
              <p style="margin: 0 0 30px 0; color: #333333; font-size: 16px;">
                Lamentamos informarte que tu reserva ha sido <strong>cancelada</strong>.
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fee2e2; border-radius: 8px; padding: 20px; margin-bottom: 30px; border-left: 4px solid #dc2626;">
                <tr>
                  <td>
                    <h3 style="margin: 0 0 15px 0; color: #dc2626; font-size: 18px;">📋 Detalles de la Reserva Cancelada</h3>
                    <p style="margin: 0 0 8px 0; color: #555555; font-size: 15px;">
                      <strong>🔑 Código:</strong> 
                      <span style="background: #fef3c7; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${reservation.reservation_id}</span>
                    </p>
                    <p style="margin: 0 0 8px 0; color: #555555; font-size: 15px;"><strong>❌ Estado:</strong> Cancelada</p>
                    <p style="margin: 0 0 8px 0; color: #555555; font-size: 15px;"><strong>📅 Fecha:</strong> ${fechaFormateada}</p>
                    <p style="margin: 0 0 8px 0; color: #555555; font-size: 15px;"><strong>🕐 Hora:</strong> ${reservation.hora}</p>
                    <p style="margin: 0 0 8px 0; color: #555555; font-size: 15px;"><strong>👥 Personas:</strong> ${reservation.comensales}</p>
                    ${mesaInfoEmail}
                  </td>
                </tr>
              </table>

              ${restaurantConfig.show_custom_message_in_cancellation_email && restaurantConfig.email_custom_message ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f9ff; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
                <tr>
                  <td>
                    <p style="margin: 0; color: #1e40af; font-size: 14px; line-height: 1.6;">
                      ${restaurantConfig.email_custom_message}
                    </p>
                  </td>
                </tr>
              </table>
              ` : ''}

              <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px;">
                Si tienes alguna pregunta o necesitas más información${restaurant.telefono ? `, puedes llamarnos al ${restaurant.telefono}` : ', no dudes en contactarnos'}.
              </p>
              <p style="margin: 0; color: #666666; font-size: 14px;">
                Esperamos verte en otra ocasión.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              ${restaurantConfig.show_custom_message_in_cancellation_email && restaurantConfig.email_footer_message ? `
              <p style="margin: 0 0 15px 0; color: #666666; font-size: 13px; font-style: italic;">
                ${restaurantConfig.email_footer_message}
              </p>
              ` : ''}
              <p style="margin: 0; color: #999999; font-size: 12px;">${restaurant.nombre}</p>
              ${restaurant.direccion ? `<p style="margin: 5px 0 0 0; color: #999999; font-size: 12px;">${restaurant.direccion}</p>` : ''}
              ${restaurant.telefono ? `<p style="margin: 5px 0 0 0; color: #999999; font-size: 12px;">📞 ${restaurant.telefono}</p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    console.log('[enviarEmailCancelacion] 📧 Intentando enviar email de cancelación:', {
      to: reservation.cliente_email,
      from_name: restaurant.nombre,
      reservation_id: reservation.reservation_id,
      subject: `❌ Reserva cancelada ${reservation.reservation_id} - ${restaurant.nombre}`
    });

    const emailResult = await base44.asServiceRole.integrations.Core.SendEmail({
      from_name: restaurant.nombre,
      to: reservation.cliente_email,
      subject: `❌ Reserva cancelada ${reservation.reservation_id} - ${restaurant.nombre}`,
      body: emailHtml
    });

    console.log('[enviarEmailCancelacion] ✅ Email de cancelación enviado exitosamente:', {
      to: reservation.cliente_email,
      reservation_id: reservation.reservation_id,
      result: emailResult
    });

    return Response.json({
      success: true,
      message: 'Email de cancelación enviado correctamente',
      emailResult
    });

  } catch (error) {
    console.error('[enviarEmailCancelacion] 💥 Error crítico:', {
      message: error.message,
      stack: error.stack,
      reservationId: error.reservationId
    });
    return Response.json({ 
      success: false, 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
});