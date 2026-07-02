import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const body = await req.json();
        const restaurantSlug = body.slug;

        if (!restaurantSlug) {
            return Response.json({ success: false, error: "Falta el slug del restaurante" }, { status: 400 });
        }

        const restaurants = await base44.asServiceRole.entities.Restaurant.filter({ slug: restaurantSlug });
        
        if (restaurants.length === 0) {
            return Response.json({ success: false, error: "Restaurante no encontrado" }, { status: 404 });
        }

        const restaurant = restaurants[0];
        const today = new Date().toISOString().split('T')[0];

        // 🔥 TODAS las consultas en paralelo + filtro de fecha en la query (no en memoria)
        const [configs, schedules, specialDays, allTables, reservations, tableAvailability] = await Promise.all([
            base44.asServiceRole.entities.RestaurantConfig.filter({ restaurant_id: restaurant.id }),
            base44.asServiceRole.entities.Schedule.filter({ restaurant_id: restaurant.id }),
            base44.asServiceRole.entities.SpecialDay.filter({ restaurant_id: restaurant.id }),
            base44.asServiceRole.entities.Table.filter({ restaurant_id: restaurant.id }),
            base44.asServiceRole.entities.Reservation.filter({ restaurant_id: restaurant.id, fecha: { $gte: today } }),
            base44.asServiceRole.entities.TableAvailability.filter({ restaurant_id: restaurant.id })
        ]);

        const config = configs[0] || {};

        console.log(`[obtenerInfoRestaurante] Restaurante: ${restaurant.id} | Mesas: ${allTables.length} | Reservas (hoy+): ${reservations.length}`);

        return Response.json({
            success: true,
            restaurant: {
                id: restaurant.id,
                nombre: restaurant.nombre,
                descripcion: restaurant.descripcion,
                logo_url: restaurant.logo_url,
                direccion: restaurant.direccion,
                telefono: restaurant.telefono
            },
            config: {
                color_primario: config.color_primario || '#1e3a8a',
                color_acento: config.color_acento || '#f59e0b',
                duracion_reserva_default: config.duracion_reserva_default || 90,
                max_comensales_reserva: config.max_comensales_reserva || 20,
                idioma: config.idioma || 'es',
                allow_table_joining: config.allow_table_joining || false,
                require_table_zone_selection: config.require_table_zone_selection || false,
                available_zones: config.available_zones || ["Terraza", "Interior", "Barra", "Ventana"],
                email_custom_message: config.email_custom_message || '',
                email_footer_message: config.email_footer_message || '',
                public_form_custom_message: config.public_form_custom_message || '',
                show_custom_message_in_public_form: config.show_custom_message_in_public_form || false,
                show_custom_message_in_confirmation_email: config.show_custom_message_in_confirmation_email || false,
                show_custom_message_in_cancellation_email: config.show_custom_message_in_cancellation_email || false
            },
            schedules,
            specialDays,
            tables: allTables,
            reservations,
            tableAvailability
        });

    } catch (error) {
        console.error("[obtenerInfoRestaurante] Error:", error);
        return Response.json({ success: false, error: error.message || "Error interno" }, { status: 500 });
    }
});