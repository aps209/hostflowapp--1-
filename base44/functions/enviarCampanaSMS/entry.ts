import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { campaign_id, destinatarios, mensaje } = await req.json();

    if (!campaign_id || !destinatarios || !Array.isArray(destinatarios)) {
      return Response.json({ 
        error: 'Faltan parámetros requeridos (campaign_id, destinatarios, mensaje)' 
      }, { status: 400 });
    }

    // Nota: Para SMS necesitarías integrar un servicio como Twilio, Vonage, etc.
    // Este es un ejemplo básico de la estructura

    let enviados = 0;
    let entregados = 0;
    let errores = 0;
    const detalles = [];
    
    // Obtener información de la campaña y el restaurante
    const campaign = await base44.asServiceRole.entities.Campaign.filter({ id: campaign_id });
    if (!campaign || campaign.length === 0) {
      return Response.json({ error: 'Campaña no encontrada' }, { status: 404 });
    }

    const restaurants = await base44.asServiceRole.entities.Restaurant.filter({ 
      id: campaign[0].restaurant_id 
    });
    const restaurantName = restaurants.length > 0 ? restaurants[0].nombre : 'Nuestro Restaurante';

    // Crear mensaje con el nombre del restaurante
    const mensajeCompleto = `${restaurantName}:\n\n${mensaje}`;

    for (const destinatario of destinatarios) {
      if (!destinatario.telefono) {
        errores++;
        detalles.push({
          cliente: destinatario.nombre,
          resultado: 'Error: Sin teléfono'
        });
        continue;
      }

      try {
        const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
        const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
        const twilioNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

        if (!accountSid || !authToken || !twilioNumber) {
          throw new Error('Credenciales de Twilio no configuradas');
        }

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              From: twilioNumber,
              To: destinatario.telefono,
              Body: mensajeCompleto
            })
          }
        );

        if (response.ok) {
          const data = await response.json();
          enviados++;
          entregados++;
          
          detalles.push({
            cliente: destinatario.nombre,
            telefono: destinatario.telefono,
            resultado: 'Enviado correctamente',
            twilioSid: data.sid
          });
        } else {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Error al enviar SMS');
        }

      } catch (error) {
        errores++;
        detalles.push({
          cliente: destinatario.nombre,
          telefono: destinatario.telefono,
          resultado: `Error: ${error.message}`
        });
      }
    }

    return Response.json({
      success: true,
      enviados,
      entregados,
      errores,
      total: destinatarios.length,
      detalles
    });

  } catch (error) {
    console.error('Error enviando campaña de SMS:', error);
    return Response.json({ 
      error: error.message || 'Error al enviar campaña' 
    }, { status: 500 });
  }
});