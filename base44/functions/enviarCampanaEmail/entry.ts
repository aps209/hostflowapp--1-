import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { campaign_id, destinatarios, asunto, mensaje } = await req.json();

    if (!campaign_id || !destinatarios || !Array.isArray(destinatarios)) {
      return Response.json({ 
        error: 'Faltan parámetros requeridos (campaign_id, destinatarios)' 
      }, { status: 400 });
    }

    // Obtener información de la campaña y el restaurante
    const campaign = await base44.asServiceRole.entities.Campaign.filter({ id: campaign_id });
    if (!campaign || campaign.length === 0) {
      return Response.json({ error: 'Campaña no encontrada' }, { status: 404 });
    }

    const restaurants = await base44.asServiceRole.entities.Restaurant.filter({ 
      id: campaign[0].restaurant_id 
    });
    const restaurantName = restaurants.length > 0 ? restaurants[0].nombre : 'Nuestro Restaurante';

    let enviados = 0;
    let entregados = 0;
    let errores = 0;
    const detalles = [];

    for (const destinatario of destinatarios) {
      if (!destinatario.email) {
        errores++;
        detalles.push({
          cliente: destinatario.nombre,
          resultado: 'Error: Sin email'
        });
        continue;
      }

      try {
        const htmlBody = `
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border-radius: 8px; }
                .header { text-align: center; padding-bottom: 20px; border-bottom: 2px solid #eee; margin-bottom: 20px; }
                .restaurant-name { font-size: 24px; font-weight: bold; color: #1e3a8a; margin: 0; }
                .content { padding: 20px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1 class="restaurant-name">${restaurantName}</h1>
                </div>
                <div class="content">
                  ${mensaje}
                </div>
              </div>
            </body>
          </html>
        `;

        const emailResult = await base44.asServiceRole.integrations.Core.SendEmail({
          from_name: restaurantName,
          to: destinatario.email,
          subject: asunto || 'Mensaje de nuestro restaurante',
          body: htmlBody
        });

        console.log(`Email enviado a ${destinatario.email}:`, emailResult);
        
        enviados++;
        entregados++;
        detalles.push({
          cliente: destinatario.nombre,
          email: destinatario.email,
          resultado: 'Enviado y entregado correctamente'
        });
      } catch (error) {
        errores++;
        detalles.push({
          cliente: destinatario.nombre,
          email: destinatario.email,
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
    console.error('Error enviando campaña de email:', error);
    return Response.json({ 
      error: error.message || 'Error al enviar campaña' 
    }, { status: 500 });
  }
});