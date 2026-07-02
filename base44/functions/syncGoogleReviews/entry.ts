import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * FUNCIÓN DE SINCRONIZACIÓN DE RESEÑAS DE GOOGLE
 * 
 * ESTADO ACTUAL:
 * - Usa Google Places API (limitada a ~5 reseñas más relevantes)
 * - Sincronización manual desde el panel de Admin
 * 
 * MEJORAS FUTURAS RECOMENDADAS:
 * 
 * 1. GOOGLE MY BUSINESS API (para todas las reseñas):
 *    - Permite acceder a TODAS las reseñas históricas
 *    - Requiere verificación de propiedad del negocio
 *    - Endpoint: https://mybusinessaccountmanagement.googleapis.com/v1/accounts/{accountId}/locations/{locationId}/reviews
 *    - Documentación: https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews
 * 
 * 2. SINCRONIZACIÓN AUTOMÁTICA:
 *    Opción A: Configurar un Cron Job en Deno Deploy
 *    - Ejecutar esta función cada X horas automáticamente
 *    - Requiere configuración de scheduled tasks en Deno Deploy
 * 
 *    Opción B: Webhook de Google My Business
 *    - Google notifica cuando hay nuevas reseñas
 *    - Más eficiente que polling
 *    - Requiere endpoint público para recibir webhooks
 * 
 * 3. IMPLEMENTACIÓN DE GOOGLE MY BUSINESS API:
 * 
 * // Ejemplo de código para Google My Business API:
 * 
 * const MY_BUSINESS_API_KEY = Deno.env.get('GOOGLE_MY_BUSINESS_API_KEY');
 * const accountId = 'YOUR_ACCOUNT_ID'; // De Google My Business
 * const locationId = restaurant.google_location_id; // Nuevo campo necesario en Restaurant
 * 
 * const url = `https://mybusinessaccountmanagement.googleapis.com/v1/accounts/${accountId}/locations/${locationId}/reviews?pageSize=50`;
 * 
 * const response = await fetch(url, {
 *     headers: {
 *         'Authorization': `Bearer ${MY_BUSINESS_API_KEY}`,
 *         'Content-Type': 'application/json',
 *     }
 * });
 * 
 * const data = await response.json();
 * const allReviews = data.reviews || [];
 * 
 * // Para paginación (si hay más de 50 reseñas):
 * let nextPageToken = data.nextPageToken;
 * while (nextPageToken) {
 *     const nextUrl = `${url}&pageToken=${nextPageToken}`;
 *     const nextResponse = await fetch(nextUrl, { headers: ... });
 *     const nextData = await nextResponse.json();
 *     allReviews.push(...(nextData.reviews || []));
 *     nextPageToken = nextData.nextPageToken;
 * }
 */

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    try {
        // Verificar autenticación primero
        const user = await base44.auth.me();
        if (!user) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'No autenticado' 
            }), { 
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Parsear body
        const body = await req.json();
        const { restaurantId } = body;
        
        if (!restaurantId) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Se requiere restaurantId' 
            }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Obtener restaurante
        const allRestaurants = await base44.asServiceRole.entities.Restaurant.list();
        const restaurant = allRestaurants.find(r => r.id === restaurantId);
        
        if (!restaurant) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Restaurante no encontrado' 
            }), { 
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!restaurant.google_place_id) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'El restaurante no tiene Google Place ID configurado' 
            }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Obtener API Key
        const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
        if (!apiKey) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Google Places API Key no configurada' 
            }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // ACTUAL: Google Places API (limitado a ~5 reseñas)
        // TODO: Migrar a Google My Business API para obtener todas las reseñas
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${restaurant.google_place_id}&fields=reviews,rating,user_ratings_total&key=${apiKey}&language=es`;
        
        const googleResponse = await fetch(url);
        const googleData = await googleResponse.json();

        if (googleData.status !== 'OK') {
            return new Response(JSON.stringify({ 
                success: false, 
                error: `Google API Error: ${googleData.status}`,
                details: googleData.error_message || 'Sin detalles',
                note: 'Google Places API solo devuelve las 5 reseñas más relevantes. Para todas las reseñas, usa Google My Business API.'
            }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const reviews = googleData.result?.reviews || [];
        
        if (reviews.length === 0) {
            return new Response(JSON.stringify({ 
                success: true, 
                reviewsImported: 0,
                totalReviews: 0,
                message: 'No hay reseñas disponibles en Google para este lugar',
                note: 'Google Places API solo devuelve las 5 reseñas más relevantes.'
            }), { 
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Importar reviews
        let reviewsImported = 0;
        const errors = [];
        
        for (const googleReview of reviews) {
            try {
                // Buscar si ya existe
                const existingReviews = await base44.asServiceRole.entities.Review.list();
                const exists = existingReviews.some(r => 
                    r.restaurant_id === restaurantId && 
                    r.cliente_nombre === googleReview.author_name &&
                    r.comentario === (googleReview.text || '')
                );

                if (!exists) {
                    // Ya no guardamos aspectos detallados (comida, servicio, ambiente, precio)
                    await base44.asServiceRole.entities.Review.create({
                        restaurant_id: restaurantId,
                        cliente_nombre: googleReview.author_name,
                        calificacion: googleReview.rating,
                        comentario: googleReview.text || '',
                        fecha_visita: new Date(googleReview.time * 1000).toISOString().split('T')[0],
                        estado: 'publicada'
                    });
                    reviewsImported++;
                }
            } catch (error) {
                errors.push(`Error con ${googleReview.author_name}: ${error.message}`);
            }
        }

        return new Response(JSON.stringify({ 
            success: true, 
            reviewsImported,
            totalReviews: reviews.length,
            message: `${reviewsImported} reseñas nuevas de ${reviews.length} totales`,
            note: 'Google Places API solo devuelve las ~5 reseñas más relevantes. Para importar todas las reseñas, considera usar Google My Business API.',
            errors: errors.length > 0 ? errors : undefined
        }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message,
            stack: error.stack
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});