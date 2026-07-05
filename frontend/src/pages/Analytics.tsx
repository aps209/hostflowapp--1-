import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Users, DollarSign, Percent, Download, UserCog, Utensils, FileText, Filter, Grid3x3, Calendar } from "lucide-react";
import { useRestaurant } from "../components/RestaurantContext";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function Analytics() {
  const { restaurantId } = useRestaurant();
  const [selectedPeriod, setSelectedPeriod] = useState('30days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedWaiter, setSelectedWaiter] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', restaurantId],
    queryFn: () => base44.entities.Customer.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: waiters = [] } = useQuery({
    queryKey: ['waiters', restaurantId],
    queryFn: () => base44.entities.Waiter.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: tables = [] } = useQuery({
    queryKey: ['tables', restaurantId],
    queryFn: () => base44.entities.Table.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['orders', restaurantId],
    queryFn: async () => {
      try {
        return await base44.entities.Order.filter({ restaurant_id: restaurantId });
      } catch {
        return [];
      }
    },
    enabled: !!restaurantId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', restaurantId],
    queryFn: async () => {
      try {
        return await base44.entities.Product.filter({ restaurant_id: restaurantId });
      } catch {
        return [];
      }
    },
    enabled: !!restaurantId,
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['restaurantConfig', restaurantId],
    queryFn: () => base44.entities.RestaurantConfig.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const config = configs[0] || {};
  const totalCapacity = tables
    .filter(table => table.activa !== false)
    .reduce((sum, table) => sum + (Number(table.capacidad) || 0), 0) || config.capacidad_total || 0;

  // Filtrar datos según el período seleccionado y filtros
  const selectedDateRange = useMemo(() => {
    const now = new Date();
    let startDate;
    let endDate = now;

    if (selectedPeriod === 'custom') {
      if (!customStartDate || !customEndDate) return { startDate: null, endDate: null };
      startDate = parseISO(customStartDate);
      endDate = parseISO(customEndDate);
    } else {
      switch (selectedPeriod) {
        case '7days':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30days':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90days':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'thisMonth':
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
          break;
        case 'lastMonth':
          startDate = startOfMonth(subMonths(now, 1));
          endDate = endOfMonth(subMonths(now, 1));
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
    }

    return { startDate, endDate };
  }, [selectedPeriod, customStartDate, customEndDate]);

  const filteredReservations = useMemo(() => {
    const { startDate, endDate } = selectedDateRange;
    if (!startDate || !endDate) return [];

    return reservations.filter(r => {
      if (!r.fecha) return false;
      const resDate = parseISO(r.fecha);
      const inDateRange = isWithinInterval(resDate, { start: startDate, end: endDate });
      
      const waiterMatch = selectedWaiter === 'all' || r.waiter_id === selectedWaiter;
      const sourceMatch = selectedSource === 'all' || r.origen === selectedSource;
      
      return inDateRange && waiterMatch && sourceMatch;
    });
  }, [reservations, selectedDateRange, selectedWaiter, selectedSource]);

  const filteredOrders = useMemo(() => {
    const { startDate, endDate } = selectedDateRange;
    if (!startDate || !endDate) return [];

    return orders.filter(order => {
      if (!order.fecha_hora) return false;
      return isWithinInterval(new Date(order.fecha_hora), { start: startDate, end: endDate });
    });
  }, [orders, selectedDateRange]);

  // Métricas principales
  const totalReservations = filteredReservations.length;
  const completedReservations = filteredReservations.filter(r => r.estado === 'completada');
  const totalRevenue = completedReservations.reduce((sum, r) => sum + (r.gasto_total || 0), 0);
  const avgTicket = completedReservations.length > 0 ? totalRevenue / completedReservations.length : 0;
  const totalCovers = filteredReservations.reduce((sum, r) => sum + (r.comensales || 0), 0);
  const cancelledReservations = filteredReservations.filter(r => r.estado === 'cancelada').length;
  const cancellationRate = totalReservations > 0 ? (cancelledReservations / totalReservations) * 100 : 0;
  const repeatCustomers = customers.filter(c => (c.total_visitas || 0) > 1).length;
  const repeatRate = customers.length > 0 ? (repeatCustomers / customers.length) * 100 : 0;

  // Ingresos reales por pedidos (comandas pagadas)
  const paidOrders = filteredOrders.filter(o => o.estado === 'pagado');
  const ordersRevenue = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const ordersTicket = paidOrders.length > 0 ? ordersRevenue / paidOrders.length : 0;

  const ordersByTable = useMemo(() => {
    const map = {};
    filteredOrders
      .filter(o => o.estado === 'pagado')
      .forEach(o => {
        if (o.mesa_numero == null) return;
        map[o.mesa_numero] = (map[o.mesa_numero] || 0) + (o.total || 0);
      });
    return map;
  }, [filteredOrders]);

  // Ocupación diaria
  const dailyOccupancy = useMemo(() => {
    const now = new Date();
    const last30Days = eachDayOfInterval({
      start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      end: now
    });

    return last30Days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayReservations = reservations.filter(r => 
        r.fecha === dateStr && r.estado !== 'cancelada' && r.estado !== 'no_show'
      );
      const totalCovers = dayReservations.reduce((sum, r) => sum + (r.comensales || 0), 0);
      const occupancyRate = totalCapacity > 0 ? (totalCovers / totalCapacity) * 100 : 0;

      return {
        fecha: format(day, 'dd MMM', { locale: es }),
        ocupacion: Math.round(occupancyRate),
        comensales: totalCovers,
        reservas: dayReservations.length
      };
    });
  }, [reservations, totalCapacity]);

  // Reservas por fuente
  const reservationsBySource = useMemo(() => {
    const sources = filteredReservations.reduce((acc, r) => {
      const source = r.origen || 'admin';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {});

    const sourceLabels = {
      admin: 'Panel Admin',
      web: 'Formulario Web',
      chatbot: 'Asistente de Voz',
      walk_in: 'Walk-in'
    };

    return Object.entries(sources).map(([key, value]) => ({
      name: sourceLabels[key] || key,
      value,
      percentage: filteredReservations.length > 0 ? ((Number(value) / filteredReservations.length) * 100).toFixed(1) : '0.0'
    }));
  }, [filteredReservations]);

  // Rendimiento de camareros
  const waiterPerformance = useMemo(() => {
    const waiterStats = {};

    waiters.forEach(waiter => {
      waiterStats[waiter.id] = {
        name: `${waiter.nombre} ${waiter.apellidos || ''}`,
        color: waiter.color,
        reservations: 0,
        revenue: 0
      };
    });

    filteredReservations.forEach(r => {
      if (r.waiter_id && waiterStats[r.waiter_id]) {
        waiterStats[r.waiter_id].reservations += 1;
        if (r.estado === 'completada') {
          waiterStats[r.waiter_id].revenue += (r.gasto_total || 0);
        }
      }
    });

    return Object.values(waiterStats)
      .filter(w => w.reservations > 0)
      .sort((a, b) => b.reservations - a.reservations);
  }, [filteredReservations, waiters]);

  // Platos más vendidos
  const topProducts = useMemo(() => {
    const productCounts = {};

    filteredOrders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          if (!productCounts[item.product_id]) {
            productCounts[item.product_id] = {
              name: item.product_name,
              cantidad: 0,
              revenue: 0
            };
          }
          productCounts[item.product_id].cantidad += item.cantidad || 0;
          productCounts[item.product_id].revenue += item.subtotal || 0;
        });
      }
    });

    return Object.values(productCounts)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10);
  }, [filteredOrders]);

  // Estados de reservas
  const reservationStates = useMemo(() => {
    const states = filteredReservations.reduce((acc, r) => {
      const state = r.estado || 'pendiente';
      acc[state] = (acc[state] || 0) + 1;
      return acc;
    }, {});

    const stateLabels = {
      confirmada: 'Confirmada',
      pendiente: 'Pendiente',
      sentada: 'Sentada',
      completada: 'Completada',
      cancelada: 'Cancelada',
      no_show: 'No Show'
    };

    return Object.entries(states).map(([key, value]) => ({
      name: stateLabels[key] || key,
      value
    }));
  }, [filteredReservations]);

  // Performance de mesas
  const tablePerformance = useMemo(() => {
    const tableStats = {};

    filteredReservations.forEach(r => {
      if (!r.mesa_numero) return;
      
      const tableKey = r.mesa_numero;
      if (!tableStats[tableKey]) {
        tableStats[tableKey] = {
          mesa: tableKey,
          reservas: 0,
          comensales: 0,
          ingresos: 0
        };
      }
      
      tableStats[tableKey].reservas += 1;
      tableStats[tableKey].comensales += r.comensales || 0;
      if (r.estado === 'completada') {
        tableStats[tableKey].ingresos += r.gasto_total || 0;
      }
    });

    // Sumar ingresos reales de comandas pagadas por mesa
    Object.entries(ordersByTable).forEach(([mesa, revenue]) => {
      if (!tableStats[mesa]) {
        tableStats[mesa] = { mesa, reservas: 0, comensales: 0, ingresos: 0 };
      }
      tableStats[mesa].ingresos += revenue;
    });

    return Object.values(tableStats).map(t => ({
      ...t,
      ocupacion: t.reservas > 0 ? (t.reservas / filteredReservations.length) * 100 : 0
    })).sort((a, b) => b.ingresos - a.ingresos || b.reservas - a.reservas);
  }, [filteredReservations, ordersByTable]);

  // Función para exportar a CSV
  const exportToCSV = (data, filename) => {
    if (data.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    toast.success('CSV exportado correctamente');
  };

  const exportReservationsCSV = () => {
    const data = filteredReservations.map(r => ({
      ID: r.reservation_id || r.id,
      Fecha: r.fecha,
      Hora: r.hora,
      Cliente: r.cliente_nombre,
      Email: r.cliente_email,
      Telefono: r.cliente_telefono,
      Comensales: r.comensales,
      Mesa: r.mesa_numero,
      Estado: r.estado,
      Origen: r.origen,
      Camarero: r.waiter_name || '',
      Gasto: r.gasto_total || 0,
      Notas: r.notas || ''
    }));
    exportToCSV(data, 'reservas');
  };

  const exportWaitersCSV = () => {
    exportToCSV(waiterPerformance, 'rendimiento_camareros');
  };

  const exportProductsCSV = () => {
    if (topProducts.length === 0) return;
    exportToCSV(topProducts, 'productos_mas_vendidos');
  };

  const exportTablesCSV = () => {
    exportToCSV(tablePerformance, 'performance_mesas');
  };

  // Función para exportar a PDF
  const exportToPDF = async (reportType) => {
    try {
      let reportData;
      let filters = {
        period: selectedPeriod,
        startDate: customStartDate,
        endDate: customEndDate,
        waiter: selectedWaiter !== 'all' ? waiters.find(w => w.id === selectedWaiter)?.nombre : null,
        source: selectedSource !== 'all' ? selectedSource : null
      };

      switch (reportType) {
        case 'reservations':
          reportData = filteredReservations;
          break;
        case 'waiters':
          reportData = waiterPerformance;
          break;
        case 'tables':
          reportData = tablePerformance;
          break;
        default:
          reportData = [];
      }

      const response = await base44.functions.invoke('exportAnalyticsPDF', {
        reportData,
        reportType,
        filters
      });

      if (typeof response.data !== 'string' && !(response.data instanceof Blob)) {
        toast.info(response.data?.message || 'Exportacion PDF no disponible en modo local');
        return;
      }

      const blob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reporte_${reportType}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF generado correctamente');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Error al generar el PDF');
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Analytics Avanzado</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Métricas y reportes detallados</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="w-4 h-4" />
            Filtros
          </Button>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-48 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-slate-800">
              <SelectItem value="7days">Últimos 7 días</SelectItem>
              <SelectItem value="30days">Últimos 30 días</SelectItem>
              <SelectItem value="90days">Últimos 90 días</SelectItem>
              <SelectItem value="thisMonth">Este mes</SelectItem>
              <SelectItem value="lastMonth">Mes anterior</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Panel de filtros */}
      {showFilters && (
        <Card className="border-0 shadow-xl bg-white dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="dark:text-white text-lg">Filtros Avanzados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {selectedPeriod === 'custom' && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-700 dark:text-slate-300">Fecha Inicio</Label>
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-700 dark:text-slate-300">Fecha Fin</Label>
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="bg-white dark:bg-slate-800"
                    />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label className="text-sm text-slate-700 dark:text-slate-300">Camarero</Label>
                <Select value={selectedWaiter} onValueChange={setSelectedWaiter}>
                  <SelectTrigger className="bg-white dark:bg-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-800">
                    <SelectItem value="all">Todos</SelectItem>
                    {waiters.map(w => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.nombre} {w.apellidos}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-slate-700 dark:text-slate-300">Fuente</Label>
                <Select value={selectedSource} onValueChange={setSelectedSource}>
                  <SelectTrigger className="bg-white dark:bg-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-800">
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="admin">Panel Admin</SelectItem>
                    <SelectItem value="web">Formulario Web</SelectItem>
                    <SelectItem value="chatbot">Asistente de Voz</SelectItem>
                    <SelectItem value="walk_in">Walk-in</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedWaiter('all');
                  setSelectedSource('all');
                  setCustomStartDate('');
                  setCustomEndDate('');
                  toast.success('Filtros limpiados');
                }}
                size="sm"
              >
                Limpiar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Indicador de filtros activos */}
      {(selectedWaiter !== 'all' || selectedSource !== 'all' || selectedPeriod === 'custom') && (
        <div className="flex flex-wrap gap-2">
          {selectedWaiter !== 'all' && (
            <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-sm">
              Camarero: {waiters.find(w => w.id === selectedWaiter)?.nombre}
            </div>
          )}
          {selectedSource !== 'all' && (
            <div className="px-3 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-full text-sm">
              Fuente: {selectedSource}
            </div>
          )}
          {selectedPeriod === 'custom' && customStartDate && customEndDate && (
            <div className="px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-full text-sm">
              {customStartDate} - {customEndDate}
            </div>
          )}
        </div>
      )}

      {/* Métricas principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card className="border-0 shadow-xl bg-white dark:bg-slate-900">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className="p-2 md:p-3 rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white">
                <DollarSign className="w-4 h-4 md:w-5 md:h-5" />
              </div>
            </div>
            <p className="text-xs md:text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Ventas (Pedidos)</p>
            <p className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">€{ordersRevenue.toFixed(2)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{paidOrders.length} pagados · ticket €{ordersTicket.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl bg-white dark:bg-slate-900">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className="p-2 md:p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
                <Calendar className="w-4 h-4 md:w-5 md:h-5" />
              </div>
            </div>
            <p className="text-xs md:text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Total Reservas</p>
            <p className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{totalReservations}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl bg-white dark:bg-slate-900">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className="p-2 md:p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
                <Users className="w-4 h-4 md:w-5 md:h-5" />
              </div>
            </div>
            <p className="text-xs md:text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Comensales Totales</p>
            <p className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{totalCovers.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl bg-white dark:bg-slate-900">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className="p-2 md:p-3 rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white">
                <Percent className="w-4 h-4 md:w-5 md:h-5" />
              </div>
            </div>
            <p className="text-xs md:text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Tasa de Cancelación</p>
            <p className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{cancellationRate.toFixed(1)}%</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl bg-white dark:bg-slate-900">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className="p-2 md:p-3 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white">
                <Percent className="w-4 h-4 md:w-5 md:h-5" />
              </div>
            </div>
            <p className="text-xs md:text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Tasa de Repetición</p>
            <p className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{repeatRate.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Ocupación diaria */}
      <Card className="border-0 shadow-xl bg-white dark:bg-slate-900">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="dark:text-white">Ocupación Diaria (Últimos 30 días)</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportReservationsCSV} className="gap-2">
              <Download className="w-4 h-4" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToPDF('reservations')} className="gap-2">
              <FileText className="w-4 h-4" />
              PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyOccupancy}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
              <XAxis dataKey="fecha" className="text-slate-600 dark:text-slate-400" />
              <YAxis className="text-slate-600 dark:text-slate-400" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: 'white' }}
                labelStyle={{ color: '#cbd5e1' }}
              />
              <Line type="monotone" dataKey="ocupacion" stroke="#3b82f6" strokeWidth={2} name="Ocupación %" />
              <Line type="monotone" dataKey="comensales" stroke="#10b981" strokeWidth={2} name="Comensales" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Reservas por fuente y estados */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-xl bg-white dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="dark:text-white">Reservas por Fuente</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={reservationsBySource}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {reservationsBySource.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl bg-white dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="dark:text-white">Reservas por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={reservationStates}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis dataKey="name" className="text-slate-600 dark:text-slate-400" />
                <YAxis className="text-slate-600 dark:text-slate-400" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: 'white' }}
                />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Performance de mesas */}
      {tablePerformance.length > 0 && (
        <Card className="border-0 shadow-xl bg-white dark:bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="dark:text-white flex items-center gap-2">
              <Grid3x3 className="w-5 h-5" />
              Performance de Mesas
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportTablesCSV} className="gap-2">
                <Download className="w-4 h-4" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportToPDF('tables')} className="gap-2">
                <FileText className="w-4 h-4" />
                PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Mesa</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Reservas</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Comensales</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">% del total</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {tablePerformance.slice(0, 10).map((table, index) => (
                    <tr key={index} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4 text-sm font-medium text-slate-900 dark:text-white">Mesa {table.mesa}</td>
                      <td className="py-3 px-4 text-sm text-slate-700 dark:text-slate-300">{table.reservas}</td>
                      <td className="py-3 px-4 text-sm text-slate-700 dark:text-slate-300">{table.comensales}</td>
                      <td className="py-3 px-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full"
                              style={{ width: `${Math.min(table.ocupacion, 100)}%` }}
                            />
                          </div>
                          <span className="text-slate-700 dark:text-slate-300 min-w-[45px]">{table.ocupacion.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-slate-900 dark:text-white">€{table.ingresos.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rendimiento de camareros */}
      {waiterPerformance.length > 0 && (
        <Card className="border-0 shadow-xl bg-white dark:bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="dark:text-white flex items-center gap-2">
              <UserCog className="w-5 h-5" />
              Rendimiento de Camareros
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportWaitersCSV} className="gap-2">
                <Download className="w-4 h-4" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportToPDF('waiters')} className="gap-2">
                <FileText className="w-4 h-4" />
                PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {waiterPerformance.map((waiter, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: waiter.color }}
                  >
                    {waiter.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-slate-900 dark:text-white">{waiter.name}</span>
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {waiter.reservations} reservas • €{waiter.revenue.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full transition-all"
                        style={{ 
                          width: `${(waiter.reservations / Math.max(...waiterPerformance.map(w => w.reservations))) * 100}%`,
                          backgroundColor: waiter.color
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Platos más vendidos */}
      {topProducts.length > 0 && (
        <Card className="border-0 shadow-xl bg-white dark:bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="dark:text-white flex items-center gap-2">
              <Utensils className="w-5 h-5" />
              Productos Más Vendidos
            </CardTitle>
            <Button variant="outline" size="sm" onClick={exportProductsCSV} className="gap-2">
              <Download className="w-4 h-4" />
              Exportar
            </Button>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis type="number" className="text-slate-600 dark:text-slate-400" />
                <YAxis dataKey="name" type="category" width={150} className="text-slate-600 dark:text-slate-400" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: 'white' }}
                />
                <Bar dataKey="cantidad" fill="#10b981" name="Cantidad vendida" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Botón de exportación global */}
      <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold mb-1">Exportar Reportes Completos</h3>
              <p className="text-blue-100 text-sm">Descarga todos los datos en CSV o PDF</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="secondary" 
                onClick={exportReservationsCSV}
                className="gap-2 bg-white text-blue-600 hover:bg-blue-50"
              >
                <Download className="w-4 h-4" />
                Reservas CSV
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => exportToPDF('reservations')}
                className="gap-2 bg-white text-blue-600 hover:bg-blue-50"
              >
                <FileText className="w-4 h-4" />
                Reservas PDF
              </Button>
              {tablePerformance.length > 0 && (
                <>
                  <Button 
                    variant="secondary" 
                    onClick={exportTablesCSV}
                    className="gap-2 bg-white text-blue-600 hover:bg-blue-50"
                  >
                    <Download className="w-4 h-4" />
                    Mesas CSV
                  </Button>
                  <Button 
                    variant="secondary" 
                    onClick={() => exportToPDF('tables')}
                    className="gap-2 bg-white text-blue-600 hover:bg-blue-50"
                  >
                    <FileText className="w-4 h-4" />
                    Mesas PDF
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
