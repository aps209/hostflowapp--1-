import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { reservationId, restaurant_id } = payload;

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

    // 🔥 NUEVO: Obtener configuración del restaurante para mensajes personalizados
    const configs = await base44.asServiceRole.entities.RestaurantConfig.filter({
      restaurant_id: reservation.restaurant_id
    });
    const config = configs[0] || {};

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

    let zonaInfoEmail = '';
    if (reservation.zona_preferida) {
      zonaInfoEmail = `<p style="margin: 0 0 8px 0; color: #555555; font-size: 15px;"><strong>Zona:</strong> ${reservation.zona_preferida}</p>`;
    }

    const restaurantSlug = restaurant.slug || '';
    const appUrl = Deno.env.get('BASE44_APP_URL') || 'https://preview--hostflowapp.base44.app';
    const cancelUrl = `${appUrl}/functions/cancelarReservaDirecto?token=${reservation.confirmation_token}`;

    // 🔥 NUEVO: Incluir mensaje personalizado si existe Y si está habilitado
    let customMessageHtml = '';
    if (config.show_custom_message_in_confirmation_email && config.email_custom_message && config.email_custom_message.trim()) {
      customMessageHtml = `
        <div style="background-color: #f0f9ff; border-left: 4px solid #3b82f6; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
          <p style="margin: 0; color: #1e40af; font-size: 15px; line-height: 1.6;">
            ${config.email_custom_message}
          </p>
        </div>
      `;
    }

    // 🔥 NUEVO: Incluir mensaje de pie si existe
    let footerMessageHtml = '';
    if (config.email_footer_message && config.email_footer_message.trim()) {
      footerMessageHtml = `
        <p style="margin: 10px 0 0 0; color: #666666; font-size: 14px; line-height: 1.5;">
          ${config.email_footer_message}
        </p>
      `;
    }

    const emailHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Reserva confirmada</title></head><body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden;"><tr><td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;"><h1 style="margin: 0; color: #ffffff; font-size: 28px;">¡Reserva Confirmada! ✅</h1><p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 16px;">${restaurant.nombre}</p></td></tr><tr><td style="padding: 40px 30px;"><p style="margin: 0 0 20px 0; color: #333333; font-size: 16px;">Hola <strong>${nombreCompleto}</strong>,</p><p style="margin: 0 0 30px 0; color: #333333; font-size: 16px;">Tu reserva ha sido <strong>confirmada automáticamente</strong>. ¡Te esperamos!</p><table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 30px;"><tr><td><h3 style="margin: 0 0 15px 0; color: #667eea; font-size: 18px;">📋 Detalles de tu Reserva</h3><p style="margin: 0 0 8px 0; color: #555555; font-size: 15px;"><strong>🔑 Código:</strong> <span style="background: #fef3c7; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${reservation.reservation_id}</span></p><p style="margin: 0 0 8px 0; color: #555555; font-size: 15px;"><strong>✅ Estado:</strong> Confirmada</p><p style="margin: 0 0 8px 0; color: #555555; font-size: 15px;"><strong>📅 Fecha:</strong> ${fechaFormateada}</p><p style="margin: 0 0 8px 0; color: #555555; font-size: 15px;"><strong>🕐 Hora:</strong> ${reservation.hora}</p><p style="margin: 0 0 8px 0; color: #555555; font-size: 15px;"><strong>👥 Personas:</strong> ${reservation.comensales}</p>${mesaInfoEmail}${zonaInfoEmail}</td></tr></table>${customMessageHtml}<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin-bottom: 30px; border-radius: 4px;"><p style="margin: 0 0 10px 0; color: #856404; font-size: 15px; font-weight: bold;">💡 ¿Necesitas cancelar tu reserva?</p><p style="margin: 0 0 15px 0; color: #856404; font-size: 14px;">Haz clic en el botón de abajo para cancelar de forma instantánea:</p></div><a href="${cancelUrl}" style="display: block; background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; text-decoration: none; padding: 18px 32px; border-radius: 8px; text-align: center; font-weight: bold; font-size: 17px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(220, 38, 38, 0.3);">❌ Cancelar mi Reserva</a><p style="margin: 0 0 10px 0; color: #666666; font-size: 14px;">Si necesitas ayuda, contacta con nosotros${restaurant.telefono ? ` al ${restaurant.telefono}` : ''}.</p><p style="margin: 0; color: #666666; font-size: 14px;">¡Te esperamos!</p>${footerMessageHtml}</td></tr><tr><td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;"><p style="margin: 0; color: #999999; font-size: 12px;">${restaurant.nombre}</p>${restaurant.direccion ? `<p style="margin: 5px 0 0 0; color: #999999; font-size: 12px;">${restaurant.direccion}</p>` : ''}</td></tr></table></td></tr></table></body></html>`;

    console.log('[enviarEmailConfirmacion] 📧 Intentando enviar email:', {
      to: reservation.cliente_email,
      from_name: restaurant.nombre,
      reservation_id: reservation.reservation_id,
      subject: `✅ Reserva confirmada ${reservation.reservation_id} - ${restaurant.nombre}`
    });

    const emailResult = await base44.asServiceRole.integrations.Core.SendEmail({
      from_name: restaurant.nombre,
      to: reservation.cliente_email,
      subject: `✅ Reserva confirmada ${reservation.reservation_id} - ${restaurant.nombre}`,
      body: emailHtml
    });

    console.log('[enviarEmailConfirmacion] ✅ Email enviado exitosamente:', {
      to: reservation.cliente_email,
      reservation_id: reservation.reservation_id,
      result: emailResult
    });

    return Response.json({
      success: true,
      message: 'Email de confirmación enviado correctamente',
      emailResult
    });

  } catch (error) {
    console.error('[enviarEmailConfirmacion] 💥 Error crítico:', {
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