import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Minus, X, Check, Send, Clock, DollarSign, ShoppingBag, TrendingUp, Search, Utensils, Coffee, Wine, IceCream, Users } from "lucide-react";
import { useRestaurant } from "../components/RestaurantContext";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";



const categoryIcons = {
  entrantes: Utensils,
  principales: Utensils,
  postres: IceCream,
  bebidas: ShoppingBag,
  vinos: Wine,
  cafes: Coffee,
  otros: ShoppingBag,
};

const categoryColors = {
  entrantes: "bg-amber-100 text-amber-800 border-amber-300",
  principales: "bg-red-100 text-red-800 border-red-300",
  postres: "bg-pink-100 text-pink-800 border-pink-300",
  bebidas: "bg-blue-100 text-blue-800 border-blue-300",
  vinos: "bg-purple-100 text-purple-800 border-purple-300",
  cafes: "bg-orange-100 text-orange-800 border-orange-300",
  otros: "bg-slate-100 text-slate-800 border-slate-300",
};

function SelectTableDialog({ open, onClose, onSelectTable, tables, reservations }) {
  const [searchTerm, setSearchTerm] = useState("");
  const today = format(new Date(), 'yyyy-MM-dd');
  
  // Mesas con reservas sentadas hoy
  const tablesWithSeatedReservations = tables.map(table => {
    const seatedReservation = reservations.find(r => 
      (r.mesa_id === table.id || r.mesas_unidas?.includes(table.id)) &&
      r.fecha === today &&
      r.estado === 'sentada'
    );
    return { ...table, seatedReservation };
  }).filter(t => t.seatedReservation);

  // Todas las mesas disponibles
  const allTables = tables.filter(t => 
    !searchTerm || t.numero.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-white text-xl">
            Seleccionar Mesa
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Buscar mesa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>

          {tablesWithSeatedReservations.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                🔵 Mesas con Clientes Sentados
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {tablesWithSeatedReservations.map(table => (
                  <Button
                    key={table.id}
                    onClick={() => onSelectTable(table, table.seatedReservation)}
                    className="h-auto flex-col p-4 bg-blue-50 hover:bg-blue-100 border-2 border-blue-500 text-slate-900"
                    variant="outline"
                  >
                    <div className="text-2xl font-bold">Mesa {table.numero}</div>
                    <div className="text-xs mt-1 text-blue-700">
                      {table.seatedReservation.cliente_nombre}
                    </div>
                    <div className="text-xs text-blue-600">
                      {table.seatedReservation.comensales}p • {table.seatedReservation.hora}
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
              Todas las Mesas
            </h3>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {allTables.map(table => (
                <Button
                  key={table.id}
                  onClick={() => onSelectTable(table, null)}
                  className="h-20 flex-col"
                  variant="outline"
                >
                  <div className="text-lg font-bold">Mesa {table.numero}</div>
                  <div className="text-xs text-slate-500">
                    {table.capacidad} pax
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Pedidos() {
  const [showTableSelector, setShowTableSelector] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("new"); // 'new' o 'active'

  const { restaurantId } = useRestaurant();
  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ['products', restaurantId],
    queryFn: () => base44.entities.Product.filter({ restaurant_id: restaurantId, activo: true }),
    enabled: !!restaurantId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', restaurantId],
    queryFn: () => base44.entities.Customer.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: tables = [] } = useQuery({
    queryKey: ['tables', restaurantId],
    queryFn: () => base44.entities.Table.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    refetchInterval: 15000,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['orders', restaurantId],
    queryFn: () => base44.entities.Order.filter({ restaurant_id: restaurantId }, '-created_date'),
    enabled: !!restaurantId,
    refetchInterval: 10000,
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data) => {
      const year = new Date().getFullYear();
      const orderCount = orders.filter(o => o.order_number?.startsWith(`O-${year}`)).length;
      const orderNumber = `O-${year}-${String(orderCount + 1).padStart(4, '0')}`;

      const order = await base44.entities.Order.create({ 
        ...data, 
        order_number: orderNumber,
        restaurant_id: restaurantId 
      });

      // Actualizar cliente si existe
      if (data.customer_id) {
        const customer = await base44.entities.Customer.filter({ id: data.customer_id });
        if (customer.length > 0) {
          const c = customer[0];
          const newTotalVisitas = (c.total_visitas || 0) + 1;
          const newGastoTotal = (c.gasto_total || 0) + data.total;
          const newGastoMedio = newGastoTotal / newTotalVisitas;

          const productosFavoritos = c.productos_favoritos || [];
          data.items.forEach(item => {
            const existing = productosFavoritos.find(p => p.product_id === item.product_id);
            if (existing) {
              existing.veces_pedido += item.cantidad;
            } else {
              productosFavoritos.push({
                product_id: item.product_id,
                product_name: item.product_name,
                veces_pedido: item.cantidad
              });
            }
          });

          await base44.entities.Customer.update(data.customer_id, {
            total_visitas: newTotalVisitas,
            gasto_total: newGastoTotal,
            gasto_medio: newGastoMedio,
            ultima_visita: format(new Date(), 'yyyy-MM-dd'),
            productos_favoritos: productosFavoritos
          });
        }
      }

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['customers', restaurantId] });
      setCartItems([]);
      setSelectedTable(null);
      setSelectedReservation(null);
      toast.success('Pedido enviado a cocina');
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Order.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', restaurantId] });
      toast.success('Pedido actualizado');
    },
  });

  const handleAddToCart = (product) => {
    const existingIndex = cartItems.findIndex(item => item.product_id === product.id);
    
    if (existingIndex >= 0) {
      const updated = [...cartItems];
      updated[existingIndex].cantidad += 1;
      updated[existingIndex].subtotal = updated[existingIndex].cantidad * product.precio;
      setCartItems(updated);
    } else {
      setCartItems([...cartItems, {
        product_id: product.id,
        product_name: product.nombre,
        cantidad: 1,
        precio_unitario: product.precio,
        subtotal: product.precio,
      }]);
    }
  };

  const handleUpdateQuantity = (index, delta) => {
    const updated = [...cartItems];
    updated[index].cantidad += delta;
    
    if (updated[index].cantidad <= 0) {
      updated.splice(index, 1);
    } else {
      updated[index].subtotal = updated[index].cantidad * updated[index].precio_unitario;
    }
    
    setCartItems(updated);
  };

  const handleRemoveItem = (index) => {
    setCartItems(cartItems.filter((_, i) => i !== index));
  };

  const handleSelectTable = (table, reservation) => {
    setSelectedTable(table);
    setSelectedReservation(reservation);
    setShowTableSelector(false);
  };

  const handleSubmitOrder = () => {
    if (!selectedTable) {
      toast.error('Selecciona una mesa');
      return;
    }
    if (cartItems.length === 0) {
      toast.error('Añade productos al pedido');
      return;
    }

    const subtotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
    const impuestos = subtotal * 0.1;
    const total = subtotal + impuestos;

    createOrderMutation.mutate({
      customer_id: selectedReservation?.cliente_id || null,
      customer_name: selectedReservation?.cliente_nombre || `Mesa ${selectedTable.numero}`,
      mesa_numero: selectedTable.numero,
      reservation_id: selectedReservation?.id || null,
      items: cartItems,
      subtotal,
      impuestos,
      total,
      fecha_hora: new Date().toISOString(),
      estado: 'en_preparacion',
      metodo_pago: 'pendiente',
    });
  };

  const handleChangeOrderStatus = (orderId, newStatus) => {
    updateOrderMutation.mutate({ id: orderId, data: { estado: newStatus } });
  };

  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === "all" || p.categoria === selectedCategory;
    const matchesSearch = !searchTerm || p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const activeOrders = orders.filter(o => 
    o.estado !== 'pagado' && o.estado !== 'cancelado'
  );

  const todayOrders = orders.filter(o => {
    const orderDate = format(new Date(o.fecha_hora), 'yyyy-MM-dd');
    return orderDate === format(new Date(), 'yyyy-MM-dd');
  });

  const totalVentas = orders.filter(o => o.estado === 'pagado').reduce((sum, o) => sum + (o.total || 0), 0);
  const ticketMedio = todayOrders.length > 0 ? todayOrders.reduce((sum, o) => sum + (o.total || 0), 0) / todayOrders.length : 0;

  const subtotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  const impuestos = subtotal * 0.1;
  const total = subtotal + impuestos;

  const statusColors = {
    pendiente: "bg-amber-100 text-amber-800 border-amber-200",
    en_preparacion: "bg-blue-100 text-blue-800 border-blue-200",
    listo: "bg-green-100 text-green-800 border-green-200",
    servido: "bg-indigo-100 text-indigo-800 border-indigo-200",
    pagado: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-black overflow-hidden">
      {/* Header con estadísticas */}
      <div className="flex-shrink-0 p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Ventas Hoy</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{totalVentas.toFixed(0)}€</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Pedidos Activos</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{activeOrders.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Ticket Medio</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{ticketMedio.toFixed(0)}€</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={viewMode} onValueChange={setViewMode} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">Nuevo Pedido</TabsTrigger>
            <TabsTrigger value="active">
              Pedidos Activos ({activeOrders.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 overflow-hidden">
        {viewMode === "new" ? (
          <div className="h-full grid lg:grid-cols-3 gap-4 p-4">
            {/* Panel izquierdo: Productos */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              {/* Selección de mesa */}
              <Card className="border-0 shadow-lg bg-white dark:bg-slate-900">
                <CardContent className="p-4">
                  <Button
                    onClick={() => setShowTableSelector(true)}
                    className="w-full bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 text-white h-14"
                    size="lg"
                  >
                    {selectedTable ? (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-lg font-bold">Mesa {selectedTable.numero}</span>
                        {selectedReservation && (
                          <span className="text-sm">
                            {selectedReservation.cliente_nombre} • {selectedReservation.comensales}p
                          </span>
                        )}
                      </div>
                    ) : (
                      <>
                        <Users className="w-5 h-5 mr-2" />
                        Seleccionar Mesa
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Categorías */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                <Button
                  variant={selectedCategory === "all" ? "default" : "outline"}
                  onClick={() => setSelectedCategory("all")}
                  className={selectedCategory === "all" ? "bg-blue-800" : ""}
                >
                  Todos
                </Button>
                {["entrantes", "principales", "postres", "bebidas", "vinos", "cafes"].map(cat => {
                  const Icon = categoryIcons[cat];
                  return (
                    <Button
                      key={cat}
                      variant={selectedCategory === cat ? "default" : "outline"}
                      onClick={() => setSelectedCategory(cat)}
                      className={selectedCategory === cat ? "bg-blue-800" : ""}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </Button>
                  );
                })}
              </div>

              {/* Buscador */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Buscar producto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 dark:bg-slate-800 dark:border-slate-700 dark:text-white h-12"
                />
              </div>

              {/* Grid de productos */}
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredProducts.map(product => (
                    <Button
                      key={product.id}
                      onClick={() => handleAddToCart(product)}
                      className="h-24 flex-col justify-between p-3 bg-white dark:bg-slate-800 border-2 hover:border-blue-500 text-left"
                      variant="outline"
                    >
                      <div className="w-full">
                        <p className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-2">
                          {product.nombre}
                        </p>
                      </div>
                      <div className="w-full flex justify-between items-center">
                        <Badge className={categoryColors[product.categoria]} variant="outline">
                          {product.categoria}
                        </Badge>
                        <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {product.precio.toFixed(2)}€
                        </span>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Panel derecho: Carrito */}
            <div className="flex flex-col gap-4">
              <Card className="border-0 shadow-lg bg-white dark:bg-slate-900 flex-1 flex flex-col">
                <CardHeader className="border-b border-slate-100 dark:border-slate-700 pb-3">
                  <CardTitle className="text-slate-900 dark:text-white">
                    Pedido Actual ({cartItems.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-2">
                  {cartItems.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                      <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No hay productos</p>
                    </div>
                  ) : (
                    cartItems.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm text-slate-900 dark:text-white">{item.product_name}</p>
                          <p className="text-xs text-slate-500">{item.precio_unitario.toFixed(2)}€</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => handleUpdateQuantity(index, -1)}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="font-bold text-lg w-8 text-center">{item.cantidad}</span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => handleUpdateQuantity(index, 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-900 dark:text-white">{item.subtotal.toFixed(2)}€</p>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-red-500"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>

                {/* Totales y botón enviar */}
                {cartItems.length > 0 && (
                  <div className="border-t border-slate-200 dark:border-slate-700 p-4 space-y-3">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Subtotal:</span>
                        <span className="font-medium text-slate-900 dark:text-white">{subtotal.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">IVA (10%):</span>
                        <span className="font-medium text-slate-900 dark:text-white">{impuestos.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between text-xl font-bold border-t border-slate-200 dark:border-slate-700 pt-2">
                        <span className="text-slate-900 dark:text-white">Total:</span>
                        <span className="text-blue-600 dark:text-blue-400">{total.toFixed(2)}€</span>
                      </div>
                    </div>

                    <Button
                      onClick={handleSubmitOrder}
                      disabled={!selectedTable || createOrderMutation.isPending}
                      className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-600 text-white h-14 text-lg"
                      size="lg"
                    >
                      <Send className="w-5 h-5 mr-2" />
                      {createOrderMutation.isPending ? 'Enviando...' : 'Enviar a Cocina'}
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          </div>
        ) : (
          // Vista de pedidos activos
          <div className="h-full overflow-y-auto p-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeOrders.map(order => (
                <Card key={order.id} className="border-0 shadow-lg bg-white dark:bg-slate-900">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-slate-900 dark:text-white text-lg">
                          Mesa {order.mesa_numero}
                        </CardTitle>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{order.customer_name}</p>
                      </div>
                      <Badge className={statusColors[order.estado]}>
                        {order.estado}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      {order.items?.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-slate-900 dark:text-white">
                            {item.cantidad}x {item.product_name}
                          </span>
                          <span className="text-slate-600 dark:text-slate-400">
                            {item.subtotal?.toFixed(2)}€
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between font-bold">
                        <span className="text-slate-900 dark:text-white">Total:</span>
                        <span className="text-blue-600 dark:text-blue-400">{order.total?.toFixed(2)}€</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {format(new Date(order.fecha_hora), 'HH:mm')}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {order.estado === 'en_preparacion' && (
                        <Button
                          size="sm"
                          onClick={() => handleChangeOrderStatus(order.id, 'listo')}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Listo
                        </Button>
                      )}
                      {order.estado === 'listo' && (
                        <Button
                          size="sm"
                          onClick={() => handleChangeOrderStatus(order.id, 'servido')}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          Servido
                        </Button>
                      )}
                      {order.estado === 'servido' && (
                        <Button
                          size="sm"
                          onClick={() => handleChangeOrderStatus(order.id, 'pagado')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <DollarSign className="w-4 h-4 mr-1" />
                          Pagado
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {activeOrders.length === 0 && (
              <div className="text-center py-12">
                <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                <p className="text-slate-500 dark:text-slate-400">No hay pedidos activos</p>
              </div>
            )}
          </div>
        )}
      </div>

      <SelectTableDialog
        open={showTableSelector}
        onClose={() => setShowTableSelector(false)}
        onSelectTable={handleSelectTable}
        tables={tables}
        reservations={reservations}
      />
    </div>
  );
}