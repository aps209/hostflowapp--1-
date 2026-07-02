import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const { restaurantId, selectedPeriod = '30days', customStartDate, customEndDate, selectedWaiter = 'all', selectedSource = 'all' } = await req.json();

        if (!restaurantId) {
            return Response.json({ error: 'restaurantId es requerido' }, { status: 400 });
        }

        // Calcular fechas del período
        const now = new Date();
        let startDate, endDate;

        if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
            startDate = new Date(customStartDate);
            endDate = new Date(customEndDate);
        } else {
            endDate = now;
            switch (selectedPeriod) {
                case '7days':   startDate = new Date(now - 7 * 86400000); break;
                case '30days':  startDate = new Date(now - 30 * 86400000); break;
                case '90days':  startDate = new Date(now - 90 * 86400000); break;
                case 'thisMonth':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    break;
                case 'lastMonth':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                    break;
                default: startDate = new Date(now - 30 * 86400000);
            }
        }

        // Fetch de datos en paralelo
        const [reservations, customers, waiters, orders, configs] = await Promise.all([
            base44.asServiceRole.entities.Reservation.filter({ restaurant_id: restaurantId }),
            base44.asServiceRole.entities.Customer.filter({ restaurant_id: restaurantId }),
            base44.asServiceRole.entities.Waiter.filter({ restaurant_id: restaurantId }),
            base44.asServiceRole.entities.Order.filter({ restaurant_id: restaurantId }),
            base44.asServiceRole.entities.RestaurantConfig.filter({ restaurant_id: restaurantId })
        ]);

        const config = configs[0] || {};
        const totalCapacity = config.capacidad_total || 0;
        const simboloMoneda = config.simbolo_moneda || '€';

        // Filtrar reservas según período y filtros
        const filteredReservations = reservations.filter(r => {
            if (!r.fecha) return false;
            const d = new Date(r.fecha);
            const inRange = d >= startDate && d <= endDate;
            const waiterOk = selectedWaiter === 'all' || r.waiter_id === selectedWaiter;
            const sourceOk = selectedSource === 'all' || r.origen === selectedSource;
            return inRange && waiterOk && sourceOk;
        });

        // ── KPIs ──────────────────────────────────────────────────────────────────
        const total = filteredReservations.length;
        const totalCovers = filteredReservations.reduce((s, r) => s + (r.comensales || 0), 0);
        const cancelled = filteredReservations.filter(r => r.estado === 'cancelada').length;
        const noShow = filteredReservations.filter(r => r.estado === 'no_show').length;
        const completed = filteredReservations.filter(r => r.estado === 'completada').length;
        const cancellationRate = total > 0 ? ((cancelled / total) * 100).toFixed(1) : '0.0';
        const noShowRate = total > 0 ? ((noShow / total) * 100).toFixed(1) : '0.0';
        const totalRevenue = filteredReservations.reduce((s, r) => s + (r.gasto_total || 0), 0);
        const avgTicket = completed > 0 ? (totalRevenue / completed).toFixed(2) : '0.00';
        const repeatCustomers = customers.filter(c => (c.total_visitas || 0) > 1).length;
        const repeatRate = customers.length > 0 ? ((repeatCustomers / customers.length) * 100).toFixed(1) : '0.0';

        // ── Ocupación diaria (últimos 30 días) ───────────────────────────────────
        const dailyOccupancy = [];
        for (let i = 29; i >= 0; i--) {
            const day = new Date(now - i * 86400000);
            const dateStr = day.toISOString().split('T')[0];
            const dayRes = reservations.filter(r => r.fecha === dateStr && r.estado !== 'cancelada' && r.estado !== 'no_show');
            const dayCovers = dayRes.reduce((s, r) => s + (r.comensales || 0), 0);
            dailyOccupancy.push({
                fecha: `${String(day.getDate()).padStart(2,'0')}/${String(day.getMonth()+1).padStart(2,'0')}`,
                ocupacion: totalCapacity > 0 ? Math.round((dayCovers / totalCapacity) * 100) : 0,
                comensales: dayCovers,
                reservas: dayRes.length
            });
        }

        // ── Reservas por origen ───────────────────────────────────────────────────
        const sourceLabels = { admin: 'Panel Admin', web: 'Formulario Web', chatbot: 'Asistente de Voz', walk_in: 'Walk-in' };
        const sourceCounts = filteredReservations.reduce((acc, r) => {
            const s = r.origen || 'admin';
            acc[s] = (acc[s] || 0) + 1;
            return acc;
        }, {});
        const reservationsBySource = Object.entries(sourceCounts).map(([key, value]) => ({
            name: sourceLabels[key] || key,
            value,
            percentage: total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
        }));

        // ── Estados de reservas ──────────────────────────────────────────────────
        const stateLabels = { confirmada: 'Confirmada', pendiente: 'Pendiente', sentada: 'Sentada', completada: 'Completada', cancelada: 'Cancelada', no_show: 'No Show' };
        const stateCounts = filteredReservations.reduce((acc, r) => {
            const s = r.estado || 'pendiente';
            acc[s] = (acc[s] || 0) + 1;
            return acc;
        }, {});
        const reservationStates = Object.entries(stateCounts).map(([key, value]) => ({
            name: stateLabels[key] || key,
            value
        }));

        // ── Rendimiento de camareros ─────────────────────────────────────────────
        const waiterMap = {};
        waiters.forEach(w => {
            waiterMap[w.id] = { id: w.id, name: `${w.nombre} ${w.apellidos || ''}`.trim(), color: w.color || '#3b82f6', reservations: 0, covers: 0, revenue: 0 };
        });
        filteredReservations.forEach(r => {
            if (r.waiter_id && waiterMap[r.waiter_id]) {
                waiterMap[r.waiter_id].reservations++;
                waiterMap[r.waiter_id].covers += r.comensales || 0;
                if (r.estado === 'completada') waiterMap[r.waiter_id].revenue += r.gasto_total || 0;
            }
        });
        const waiterPerformance = Object.values(waiterMap).filter(w => w.reservations > 0).sort((a, b) => b.reservations - a.reservations);

        // ── Performance de mesas ──────────────────────────────────────────────────
        const tableMap = {};
        filteredReservations.forEach(r => {
            if (!r.mesa_numero) return;
            if (!tableMap[r.mesa_numero]) tableMap[r.mesa_numero] = { mesa: r.mesa_numero, reservas: 0, comensales: 0, ingresos: 0 };
            tableMap[r.mesa_numero].reservas++;
            tableMap[r.mesa_numero].comensales += r.comensales || 0;
            if (r.estado === 'completada') tableMap[r.mesa_numero].ingresos += r.gasto_total || 0;
        });
        const tablePerformance = Object.values(tableMap).map(t => ({
            ...t,
            ocupacion: total > 0 ? ((t.reservas / total) * 100).toFixed(1) : '0.0'
        })).sort((a, b) => b.reservas - a.reservas);

        // ── Productos más vendidos ────────────────────────────────────────────────
        const productMap = {};
        orders.forEach(order => {
            if (!order.items) return;
            order.items.forEach(item => {
                const key = item.product_id || item.product_name;
                if (!productMap[key]) productMap[key] = { name: item.product_name, cantidad: 0, revenue: 0 };
                productMap[key].cantidad += item.cantidad || 0;
                productMap[key].revenue += item.subtotal || 0;
            });
        });
        const topProducts = Object.values(productMap).sort((a, b) => b.cantidad - a.cantidad).slice(0, 10);

        // ── Reservas por día de la semana ─────────────────────────────────────────
        const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const byDayOfWeek = Array(7).fill(0).map((_, i) => ({ day: dayNames[i], reservas: 0, comensales: 0 }));
        filteredReservations.forEach(r => {
            if (!r.fecha) return;
            const d = new Date(r.fecha).getDay();
            byDayOfWeek[d].reservas++;
            byDayOfWeek[d].comensales += r.comensales || 0;
        });

        // ── Horas pico ────────────────────────────────────────────────────────────
        const hourMap = {};
        filteredReservations.forEach(r => {
            if (!r.hora) return;
            const h = r.hora.split(':')[0];
            hourMap[h] = (hourMap[h] || 0) + 1;
        });
        const peakHours = Object.entries(hourMap).sort((a, b) => Number(a[0]) - Number(b[0])).map(([hora, reservas]) => ({ hora: `${hora}:00`, reservas }));

        // ── Gráficos via QuickChart.io ────────────────────────────────────────────
        const encodeChart = (config) => {
            return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(config))}&width=600&height=350&backgroundColor=white`;
        };

        // Gráfico 1: Ocupación diaria (línea)
        const chartOcupacion = encodeChart({
            type: 'line',
            data: {
                labels: dailyOccupancy.map(d => d.fecha),
                datasets: [{
                    label: 'Ocupación (%)',
                    data: dailyOccupancy.map(d => d.ocupacion),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59,130,246,0.15)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2
                }]
            },
            options: {
                plugins: { title: { display: true, text: 'Ocupación Diaria (últimos 30 días)' } },
                scales: { y: { beginAtZero: true, max: 100 } }
            }
        });

        // Gráfico 2: Reservas por origen (donut)
        const chartOrigen = encodeChart({
            type: 'doughnut',
            data: {
                labels: reservationsBySource.map(s => s.name),
                datasets: [{
                    data: reservationsBySource.map(s => s.value),
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']
                }]
            },
            options: {
                plugins: { title: { display: true, text: 'Reservas por Origen' } }
            }
        });

        // Gráfico 3: Estados de reservas (barras)
        const chartEstados = encodeChart({
            type: 'bar',
            data: {
                labels: reservationStates.map(s => s.name),
                datasets: [{
                    label: 'Reservas',
                    data: reservationStates.map(s => s.value),
                    backgroundColor: ['#10b981', '#f59e0b', '#3b82f6', '#6366f1', '#ef4444', '#64748b']
                }]
            },
            options: {
                plugins: { title: { display: true, text: 'Distribución de Estados' }, legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });

        // Gráfico 4: Reservas por día de la semana (barras)
        const chartDiaSemana = encodeChart({
            type: 'bar',
            data: {
                labels: byDayOfWeek.map(d => d.day),
                datasets: [{
                    label: 'Reservas',
                    data: byDayOfWeek.map(d => d.reservas),
                    backgroundColor: '#3b82f6'
                }]
            },
            options: {
                plugins: { title: { display: true, text: 'Reservas por Día de la Semana' }, legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });

        // Gráfico 5: Horas pico (barras)
        const chartHoras = encodeChart({
            type: 'bar',
            data: {
                labels: peakHours.map(h => h.hora),
                datasets: [{
                    label: 'Reservas',
                    data: peakHours.map(h => h.reservas),
                    backgroundColor: '#f59e0b'
                }]
            },
            options: {
                plugins: { title: { display: true, text: 'Reservas por Hora del Día' }, legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });

        // Gráfico 6: Top camareros (barras horizontales)
        const topWaiters = waiterPerformance.slice(0, 8);
        const chartCamareros = encodeChart({
            type: 'horizontalBar',
            data: {
                labels: topWaiters.map(w => w.name),
                datasets: [{
                    label: 'Reservas',
                    data: topWaiters.map(w => w.reservations),
                    backgroundColor: topWaiters.map(w => w.color || '#3b82f6')
                }]
            },
            options: {
                plugins: { title: { display: true, text: 'Rendimiento de Camareros' }, legend: { display: false } },
                scales: { x: { beginAtZero: true } }
            }
        });

        // Gráfico 7: Top productos (barras horizontales)
        const top10 = topProducts.slice(0, 8);
        const chartProductos = encodeChart({
            type: 'horizontalBar',
            data: {
                labels: top10.map(p => p.name),
                datasets: [{
                    label: 'Unidades',
                    data: top10.map(p => p.cantidad),
                    backgroundColor: '#10b981'
                }]
            },
            options: {
                plugins: { title: { display: true, text: 'Productos Más Vendidos' }, legend: { display: false } },
                scales: { x: { beginAtZero: true } }
            }
        });

        // ── Respuesta final ───────────────────────────────────────────────────────
        return Response.json({
            periodo: {
                desde: startDate.toISOString().split('T')[0],
                hasta: endDate.toISOString().split('T')[0],
                tipo: selectedPeriod
            },
            kpis: {
                totalReservations: total,
                totalCovers,
                completedReservations: completed,
                cancelledReservations: cancelled,
                noShowReservations: noShow,
                cancellationRate: `${cancellationRate}%`,
                noShowRate: `${noShowRate}%`,
                totalRevenue: parseFloat(totalRevenue.toFixed(2)),
                avgTicket: parseFloat(avgTicket),
                totalCustomers: customers.length,
                repeatCustomers,
                repeatRate: `${repeatRate}%`,
                simboloMoneda
            },
            reservationsBySource,
            reservationStates,
            waiterPerformance,
            tablePerformance,
            topProducts,
            byDayOfWeek,
            peakHours,
            dailyOccupancy,
            graficos: {
                ocupacion_diaria: chartOcupacion,
                origen: chartOrigen,
                estados: chartEstados,
                dia_semana: chartDiaSemana,
                horas_pico: chartHoras,
                camareros: chartCamareros,
                productos: chartProductos
            }
        });

    } catch (error) {
        console.error('Error en getAnalyticsData:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});