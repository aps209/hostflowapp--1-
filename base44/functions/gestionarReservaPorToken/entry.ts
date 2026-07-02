import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  console.log('[gestionarReservaPorToken] 🚀 Iniciando función...');
  
  try {
    const base44 = createClientFromRequest(req);
    
    let payload;
    try {
      payload = await req.json();
    } catch (e) {
      console.error('[gestionarReservaPorToken] ❌ Error parseando JSON:', e);
      return Response.json({
        success: false,
        error: 'Error al parsear datos'
      }, { status: 400 });
    }
    
    console.log('[gestionarReservaPorToken] 📦 Payload recibido:', JSON.stringify(payload, null, 2));
    
    const { token, action } = payload;

    if (!token) {
      console.error('[gestionarReservaPorToken] ❌ Falta token');
      return Response.json({
        success: false,
        error: 'Falta el token de reserva'
      }, { status: 400 });
    }

    // Buscar la reserva por token
    console.log('[gestionarReservaPorToken] 🔍 Buscando reserva con token...');
    const reservations = await base44.asServiceRole.entities.Reservation.filter({
      confirmation_token: token
    });
    
    if (reservations.length === 0) {
      console.error('[gestionarReservaPorToken] ❌ Reserva no encontrada');
      return Response.json({ 
        success: false, 
        error: 'Reserva no encontrada o token inválido' 
      }, { status: 404 });
    }
    
    const reservation = reservations[0];
    
    // Cargar información del restaurante
    console.log('[gestionarReservaPorToken] 🏢 Obteniendo restaurante...');
    const restaurants = await base44.asServiceRole.entities.Restaurant.filter({
      id: reservation.restaurant_id
    });
    const restaurant = restaurants[0] || null;

    // Si es solo consulta (no action), devolver los datos
    if (!action) {
      console.log('[gestionarReservaPorToken] 📋 Devolviendo datos de reserva');
      return Response.json({
        success: true,
        reservation,
        restaurant
      });
    }

    // Si hay una acción, ejecutarla
    if (action === 'confirmar') {
      console.log('[gestionarReservaPorToken] ✅ Confirmando reserva...');
      await base44.asServiceRole.entities.Reservation.update(reservation.id, {
        estado: 'confirmada'
      });
      
      return Response.json({
        success: true,
        message: 'Reserva confirmada con éxito',
        reservation: { ...reservation, estado: 'confirmada' },
        restaurant
      });
    }
    
    if (action === 'cancelar') {
      console.log('[gestionarReservaPorToken] ❌ Cancelando reserva...');
      await base44.asServiceRole.entities.Reservation.update(reservation.id, {
        estado: 'cancelada'
      });
      
      // Enviar email de cancelación
      if (reservation.cliente_email) {
        try {
          console.log('[gestionarReservaPorToken] 📧 Enviando email de cancelación...');
          await base44.asServiceRole.functions.invoke('enviarEmailCancelacion', {
            reservationId: reservation.id
          });
          console.log('[gestionarReservaPorToken] ✅ Email de cancelación enviado');
        } catch (emailError) {
          console.error('[gestionarReservaPorToken] ⚠️ Error enviando email:', emailError.message);
        }
      }
      
      return Response.json({
        success: true,
        message: 'Reserva cancelada correctamente',
        reservation: { ...reservation, estado: 'cancelada' },
        restaurant
      });
    }

    return Response.json({
      success: false,
      error: 'Acción no válida'
    }, { status: 400 });

  } catch (error) {
    console.error('[gestionarReservaPorToken] 💥 Error crítico:', error);
    console.error('[gestionarReservaPorToken] 📍 Stack:', error.stack);
    return Response.json({
      success: false,
      error: error.message || 'Error interno del servidor',
      details: error.stack
    }, { status: 500 });
  }
});