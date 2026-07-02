import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verificar autenticación
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { campaign_id, destinatarios, mensaje } = body;

        if (!campaign_id || !destinatarios || !mensaje) {
            return Response.json({ 
                error: 'Faltan parámetros requeridos: campaign_id, destinatarios, mensaje' 
            }, { status: 400 });
        }

        console.log('[enviarCampanaWhatsApp] Enviando campaña:', campaign_id);
        console.log('[enviarCampanaWhatsApp] Destinatarios:', destinatarios.length);

        let enviados = 0;
        const errores = [];

        // Enviar mensajes a cada destinatario
        for (const destinatario of destinatarios) {
            try {
                // En producción, aquí usarías una API real de WhatsApp como:
                // - Twilio WhatsApp API
                // - WhatsApp Business API
                // - Meta WhatsApp Cloud API
                
                // Por ahora, simulamos el envío con un email como notificación
                // (o puedes comentar esto si no quieres enviar emails)
                
                const mensajePersonalizado = `Hola ${destinatario.nombre},\n\n${mensaje}`;
                
                // OPCIONAL: Enviar email como backup/notificación
                if (destinatario.email) {
                    try {
                        await base44.asServiceRole.integrations.Core.SendEmail({
                            to: destinatario.email,
                            subject: "Mensaje de tu restaurante",
                            body: mensajePersonalizado,
                        });
                    } catch (emailError) {
                        console.error('[enviarCampanaWhatsApp] Error enviando email backup:', emailError);
                        // No fallar la campaña por esto
                    }
                }

                // Aquí iría el código real de WhatsApp:
                /*
                const whatsappResponse = await fetch('https://api.whatsapp.com/send', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${Deno.env.get('WHATSAPP_API_KEY')}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        to: destinatario.telefono,
                        message: mensajePersonalizado,
                    }),
                });
                
                if (!whatsappResponse.ok) {
                    throw new Error('Error al enviar WhatsApp');
                }
                */

                enviados++;
                
                // Pequeña pausa para no saturar APIs (ajustar según rate limits)
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error('[enviarCampanaWhatsApp] Error enviando a:', destinatario.telefono, error);
                errores.push({
                    destinatario: destinatario.nombre,
                    telefono: destinatario.telefono,
                    error: error.message,
                });
            }
        }

        console.log('[enviarCampanaWhatsApp] Campaña completada. Enviados:', enviados);

        return Response.json({
            success: true,
            enviados,
            total: destinatarios.length,
            errores: errores.length > 0 ? errores : undefined,
        });

    } catch (error) {
        console.error('[enviarCampanaWhatsApp] Error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});