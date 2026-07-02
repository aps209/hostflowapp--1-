import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import twilio from 'npm:twilio';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verificar autenticación (puede ser llamado por cron job o manualmente)
    const user = await base44.auth.me().catch(() => null);
    
    const payload = await req.json();
    const { restaurant_id } = payload;

    if (!restaurant_id) {
      return Response.json({ 
        error: 'restaurant_id es requerido' 
      }, { status: 400 });
    }

    // Obtener configuración de recordatorios
    const configs = await base44.asServiceRole.entities.ReminderConfig.filter({
      restaurant_id: restaurant_id
    });

    if (configs.length === 0 || !configs[0].enabled) {
      return Response.json({
        success: true,
        message: 'Recordatorios no activados para este restaurante',
        enviados: 0
      });
    }

    const config = configs[0];

    // Calcular fecha/hora objetivo según hours_before
    const now = new Date();
    const targetTime = new Date(now.getTime() + (config.hours_before * 60 * 60 * 1000));
    const targetDate = targetTime.toISOString().split('T')[0]; // YYYY-MM-DD

    // Obtener restaurante
    const restaurants = await base44.asServiceRole.entities.Restaurant.filter({
      id: restaurant_id
    });
    const restaurant = restaurants[0] || { nombre: 'Restaurante' };

    // Buscar reservas que cumplan los criterios
    let reservations = await base44.asServiceRole.entities.Reservation.filter({
      restaurant_id: restaurant_id,
      fecha: targetDate
    });

    // Filtrar por estado si está configurado
    if (config.only_confirmed) {
      reservations = reservations.filter(r => r.estado === 'confirmada');
    }

    // Filtrar solo las que tienen teléfono
    reservations = reservations.filter(r => r.cliente_telefono);

    if (reservations.length === 0) {
      return Response.json({
        success: true,
        message: 'No hay reservas que requieran recordatorio en este momento',
        enviados: 0
      });
    }

    // Configurar Twilio
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhone = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !twilioPhone) {
      return Response.json({
        error: 'Twilio no está configurado correctamente'
      }, { status: 500 });
    }

    const client = twilio(accountSid, authToken);

    let enviados = 0;
    let errores = 0;
    const detalles = [];

    for (const reservation of reservations) {
      try {
        // Preparar variables para el template
        const fechaObj = new Date(reservation.fecha + 'T00:00:00');
        const fechaFormateada = fechaObj.toLocaleDateString('es-ES', { 
          weekday: 'long', 
          day: 'numeric', 
          month: 'long' 
        });

        const mesaInfo = reservation.mesas_numeros && reservation.mesas_numeros.length > 0 
          ? reservation.mesas_numeros.join(', ')
          : reservation.mesa_numero || 'Por asignar';

        const cancelUrl = `https://preview--hostflowapp.base44.app/confirmar-reserva?token=${reservation.confirmation_token}&action=cancelar`;

        // Reemplazar variables en el template
        let mensaje = config.sms_message_template
          .replace(/{nombre}/g, reservation.cliente_nombre || 'Cliente')
          .replace(/{restaurante}/g, restaurant.nombre)
          .replace(/{fecha}/g, fechaFormateada)
          .replace(/{hora}/g, reservation.hora)
          .replace(/{mesa}/g, mesaInfo)
          .replace(/{comensales}/g, reservation.comensales.toString())
          .replace(/{link_cancelar}/g, cancelUrl);

        // Enviar SMS
        await client.messages.create({
          body: mensaje,
          from: twilioPhone,
          to: reservation.cliente_telefono
        });

        enviados++;
        detalles.push({
          reserva_id: reservation.reservation_id,
          cliente: reservation.cliente_nombre,
          telefono: reservation.cliente_telefono,
          resultado: 'Enviado correctamente'
        });

      } catch (error) {
        errores++;
        detalles.push({
          reserva_id: reservation.reservation_id,
          cliente: reservation.cliente_nombre,
          telefono: reservation.cliente_telefono,
          resultado: `Error: ${error.message}`
        });
      }
    }

    return Response.json({
      success: true,
      enviados,
      errores,
      total: reservations.length,
      detalles
    });

  } catch (error) {
    console.error('Error enviando recordatorios:', error);
    return Response.json({ 
      error: error.message || 'Error al enviar recordatorios' 
    }, { status: 500 });
  }
});