import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();
        const { event, data, old_data, changed_fields } = payload;

        const n8nWebhookUrl = Deno.env.get("N8N_CANCELLATION_WEBHOOK_URL");
        if (!n8nWebhookUrl) {
            console.error("N8N_WEBHOOK_URL no está configurado.");
            return Response.json({ error: "N8N_WEBHOOK_URL is not configured" }, { status: 500 });
        }

        const webhookPayload = {
            event_type: "reservation_cancelled",
            reservation: data,
            old_reservation: old_data,
            cliente_nombre: data?.cliente_nombre,
            cliente_telefono: data?.cliente_telefono,
            cliente_email: data?.cliente_email,
            fecha: data?.fecha,
            hora: data?.hora,
            comensales: data?.comensales,
            mesa_numero: data?.mesa_numero,
            reservation_id: data?.reservation_id,
            timestamp: new Date().toISOString()
        };

        console.log("Enviando webhook de cancelación a n8n:", webhookPayload);

        const response = await fetch(n8nWebhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(webhookPayload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error al enviar webhook: ${response.status} - ${errorText}`);
            return Response.json({ error: `Failed: ${response.status}`, details: errorText }, { status: 500 });
        }

        console.log("Webhook de cancelación enviado correctamente.");
        return Response.json({ success: true });

    } catch (error) {
        console.error("Error en sendCancellationWebhook:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});