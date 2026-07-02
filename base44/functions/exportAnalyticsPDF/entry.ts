import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { jsPDF } from 'npm:jspdf@2.5.1';
import 'npm:jspdf-autotable@3.8.2';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { reportData, reportType, filters } = await req.json();

        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(20);
        doc.text('Reporte de Analytics', 20, 20);
        
        doc.setFontSize(10);
        doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, 20, 30);
        doc.text(`Usuario: ${user.full_name}`, 20, 36);
        
        if (filters) {
            doc.text(`Período: ${filters.period || 'Personalizado'}`, 20, 42);
            if (filters.startDate) doc.text(`Desde: ${filters.startDate}`, 20, 48);
            if (filters.endDate) doc.text(`Hasta: ${filters.endDate}`, 20, 54);
            if (filters.waiter) doc.text(`Camarero: ${filters.waiter}`, 20, 60);
            if (filters.source) doc.text(`Fuente: ${filters.source}`, 20, 66);
        }

        let startY = filters ? 76 : 50;

        // Render based on report type
        if (reportType === 'reservations') {
            doc.setFontSize(14);
            doc.text('Reporte de Reservas', 20, startY);
            
            doc.autoTable({
                startY: startY + 10,
                head: [['ID', 'Fecha', 'Hora', 'Cliente', 'Comensales', 'Mesa', 'Estado']],
                body: reportData.map(r => [
                    r.reservation_id || r.id,
                    r.fecha,
                    r.hora,
                    r.cliente_nombre,
                    r.comensales,
                    r.mesa_numero,
                    r.estado
                ]),
                theme: 'grid',
                styles: { fontSize: 8 }
            });
        } else if (reportType === 'waiters') {
            doc.setFontSize(14);
            doc.text('Rendimiento de Camareros', 20, startY);
            
            doc.autoTable({
                startY: startY + 10,
                head: [['Camarero', 'Reservas', 'Ingresos']],
                body: reportData.map(w => [
                    w.name,
                    w.reservations,
                    `€${w.revenue.toFixed(2)}`
                ]),
                theme: 'grid',
                styles: { fontSize: 10 }
            });
        } else if (reportType === 'tables') {
            doc.setFontSize(14);
            doc.text('Performance de Mesas', 20, startY);
            
            doc.autoTable({
                startY: startY + 10,
                head: [['Mesa', 'Reservas', 'Comensales', 'Tasa Ocupación', 'Ingresos']],
                body: reportData.map(t => [
                    t.mesa,
                    t.reservas,
                    t.comensales,
                    `${t.ocupacion.toFixed(1)}%`,
                    `€${t.ingresos.toFixed(2)}`
                ]),
                theme: 'grid',
                styles: { fontSize: 9 }
            });
        }

        const pdfBytes = doc.output('arraybuffer');

        return new Response(pdfBytes, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=reporte_${reportType}_${Date.now()}.pdf`
            }
        });
    } catch (error) {
        console.error('Error generating PDF:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});