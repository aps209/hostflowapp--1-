import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  console.log('[consultarReserva] 🚀 Iniciando función...');
  
  try {
    const base44 = createClientFromRequest(req);
    
    let payload;
    try {
      payload = await req.json();
    } catch (e) {
      console.error('[consultarReserva] ❌ Error parseando JSON:', e);
      return Response.json({
        success: false,
        error: 'Error al parsear datos'
      }, { status: 400 });
    }
    
    console.log('[consultarReserva] 📦 Payload recibido:', JSON.stringify(payload, null, 2));
    
    const { reservation_id, cliente_email, action, restaurant_slug } = payload;

    if (!reservation_id || !cliente_email) {
      console.error('[consultarReserva] ❌ Faltan datos requeridos');
      return Response.json({
        success: false,
        error: 'Se requiere el código de reserva y el email'
      }, { status: 400 });
    }

    // PASO 1: Si viene restaurant_slug, buscar primero el restaurante
    let targetRestaurantId = null;
    let restaurant = null;
    
    if (restaurant_slug) {
      console.log('[consultarReserva] 🔍 Buscando restaurante con slug:', restaurant_slug);
      const restaurants = await base44.asServiceRole.entities.Restaurant.filter({
        slug: restaurant_slug.toLowerCase().trim()
      });
      
      if (restaurants.length === 0) {
        console.error('[consultarReserva] ❌ No se encontró restaurante con slug:', restaurant_slug);
        return Response.json({
          success: false,
          error: 'No se encontró el restaurante especificado'
        }, { status: 404 });
      }
      
      restaurant = restaurants[0];
      targetRestaurantId = restaurant.id;
      console.log('[consultarReserva] ✅ Restaurante encontrado:', restaurant.nombre, '- ID:', targetRestaurantId);
    }

    // PASO 2: Buscar la reserva filtrando por reservation_id Y restaurant_id (si existe)
    console.log('[consultarReserva] 🔍 Buscando reserva con ID:', reservation_id.trim());
    
    const filterQuery = {
      reservation_id: reservation_id.trim()
    };
    
    // CRÍTICO: Si tenemos el restaurant_id, filtrar TAMBIÉN por él
    if (targetRestaurantId) {
      filterQuery.restaurant_id = targetRestaurantId;
      console.log('[consultarReserva] 🔍 Filtrando también por restaurant_id:', targetRestaurantId);
    }
    
    const reservations = await base44.asServiceRole.entities.Reservation.filter(filterQuery);
    
    if (reservations.length === 0) {
      console.error('[consultarReserva] ❌ Reserva no encontrada');
      if (targetRestaurantId) {
        return Response.json({ 
          success: false, 
          error: `No se encontró ninguna reserva con el código ${reservation_id} en ${restaurant.nombre}` 
        }, { status: 404 });
      } else {
        return Response.json({ 
          success: false, 
          error: 'No se encontró ninguna reserva con ese código' 
        }, { status: 404 });
      }
    }
    
    const reservation = reservations[0];
    console.log('[consultarReserva] ✅ Reserva encontrada - Restaurant ID:', reservation.restaurant_id);
    
    // PASO 3: Si no teníamos el restaurante, cargarlo ahora
    if (!restaurant) {
      console.log('[consultarReserva] 🏢 Cargando información del restaurante...');
      const restaurants = await base44.asServiceRole.entities.Restaurant.filter({
        id: reservation.restaurant_id
      });
      restaurant = restaurants[0] || null;
    }
    
    // PASO 4: Validar email
    console.log('[consultarReserva] 📧 Validando email...');
    console.log('[consultarReserva] Email de la reserva:', reservation.cliente_email);
    console.log('[consultarReserva] Email recibido:', cliente_email);
    
    const reservationEmail = (reservation.cliente_email || '').toLowerCase().trim();
    const inputEmail = cliente_email.toLowerCase().trim();
    
    if (!reservationEmail) {
      console.error('[consultarReserva] ⚠️ La reserva no tiene email asociado');
      return Response.json({ 
        success: false, 
        error: 'Esta reserva no tiene un email asociado. Por favor contacta con el restaurante directamente.' 
      }, { status: 403 });
    }
    
    if (reservationEmail !== inputEmail) {
      console.error('[consultarReserva] ❌ Email no coincide');
      console.error('[consultarReserva] Expected:', reservationEmail);
      console.error('[consultarReserva] Received:', inputEmail);
      return Response.json({ 
        success: false, 
        error: 'El email no coincide con la reserva. Verifica que estés usando el email correcto.' 
      }, { status: 403 });
    }
    
    console.log('[consultarReserva] ✅ Email validado correctamente');

    // Si es solo consulta (no action), devolver los datos
    if (!action) {
      console.log('[consultarReserva] 📋 Devolviendo datos de reserva');
      return Response.json({
        success: true,
        reservation,
        restaurant
      });
    }

    // Si hay una acción, ejecutarla
    if (action === 'confirmar') {
      console.log('[consultarReserva] ✅ Confirmando reserva...');
      await base44.asServiceRole.entities.Reservation.update(reservation.id, {
        estado: 'confirmada'
      });
      
      return Response.json({
        success: true,
        message: '¡Reserva confirmada con éxito! Te esperamos el día indicado.',
        reservation: { ...reservation, estado: 'confirmada' },
        restaurant
      });
    }
    
    if (action === 'cancelar') {
      console.log('[consultarReserva] ❌ Cancelando reserva...');
      await base44.asServiceRole.entities.Reservation.update(reservation.id, {
        estado: 'cancelada'
      });
      
      return Response.json({
        success: true,
        message: 'Reserva cancelada correctamente. Esperamos verte en otra ocasión.',
        reservation: { ...reservation, estado: 'cancelada' },
        restaurant
      });
    }

    return Response.json({
      success: false,
      error: 'Acción no válida'
    }, { status: 400 });

  } catch (error) {
    console.error('[consultarReserva] 💥 Error crítico:', error);
    console.error('[consultarReserva] 📍 Stack:', error.stack);
    return Response.json({
      success: false,
      error: error.message || 'Error interno del servidor',
      details: error.stack
    }, { status: 500 });
  }
});