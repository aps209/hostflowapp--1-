import React, { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowRight,
  BarChart3,
  Calculator,
  Check,
  Euro,
  Loader2,
  Package,
  Plus,
  Receipt,
  ScanLine,
  Trash2,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

const money = (value) => `${Number(value || 0).toFixed(2)} €`;
const pct = (value) => `${(Number(value || 0) * 100).toFixed(1)}%`;

const UNITS = ["kg", "g", "l", "ml", "unidad"];
const CATEGORIES = ["carnes", "pescados", "verduras", "lacteos", "bebidas", "condimentos", "otros"];

function marginClass(value) {
  if (value < 0.5) return "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800";
  if (value < 0.65) return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
  return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
}

const STATUS_META = {
  subir_precio: { label: "Subir precio", cls: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800" },
  ajustado: { label: "Ajustado", cls: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800" },
  ok: { label: "Margen OK", cls: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" },
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve({ base64, mime: file.type || "image/jpeg" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CostIntelligence() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [ingredientForm, setIngredientForm] = useState({ name: "", unit: "kg", categoria: "otros", current_cost_per_unit: "", stock_actual: "", stock_minimo: "" });
  const [dishForm, setDishForm] = useState({ name: "", sale_price: "", category: "entrantes", target_margin: "0.68", estimated_monthly_units: "0" });
  const [recipeForm, setRecipeForm] = useState({ dish_id: "", ingredient_id: "", quantity: "", unit: "kg" });
  const [selectedDishId, setSelectedDishId] = useState("");
  const [simulationPrice, setSimulationPrice] = useState("");

  const [costDrafts, setCostDrafts] = useState({});
  const [priceDrafts, setPriceDrafts] = useState({});
  const [pendingDelete, setPendingDelete] = useState(null);

  const [ticketPreview, setTicketPreview] = useState(null);
  const [excludedRows, setExcludedRows] = useState({});
  const [replenishStock, setReplenishStock] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [scanError, setScanError] = useState(null);

  const invalidateCosts = () => {
    ["cost-ingredients", "cost-dishes", "cost-recipes", "cost-price-advice"].forEach((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    );
  };

  const { data: ingredients = [] } = useQuery({ queryKey: ["cost-ingredients"], queryFn: () => base44.costIntelligence.ingredients() });
  const { data: dishes = [] } = useQuery({ queryKey: ["cost-dishes"], queryFn: () => base44.costIntelligence.dishes() });
  const { data: recipes = [] } = useQuery({ queryKey: ["cost-recipes"], queryFn: () => base44.costIntelligence.recipes() });
  const { data: priceAdvice = [] } = useQuery({ queryKey: ["cost-price-advice"], queryFn: () => base44.costIntelligence.priceAdvice() });
  const { data: breakdown } = useQuery({
    queryKey: ["cost-breakdown", selectedDishId],
    queryFn: () => base44.costIntelligence.dishCostBreakdown(selectedDishId),
    enabled: !!selectedDishId,
  });

  const adviceByDish = useMemo(() => {
    const map = {};
    priceAdvice.forEach((item) => { map[item.dish_id] = item; });
    return map;
  }, [priceAdvice]);

  // --- Mutaciones -----------------------------------------------------------
  const createIngredient = useMutation({
    mutationFn: () => base44.costIntelligence.createIngredient({
      name: ingredientForm.name,
      unit: ingredientForm.unit,
      categoria: ingredientForm.categoria,
      current_cost_per_unit: Number(ingredientForm.current_cost_per_unit),
      stock_actual: Number(ingredientForm.stock_actual || 0),
      stock_minimo: Number(ingredientForm.stock_minimo || 0),
    }),
    onSuccess: () => {
      invalidateCosts();
      setIngredientForm({ name: "", unit: "kg", categoria: "otros", current_cost_per_unit: "", stock_actual: "", stock_minimo: "" });
      toast.success("Ingrediente creado");
    },
    onError: () => toast.error("No se pudo crear el ingrediente"),
  });

  const updateIngredientCost = useMutation({
    mutationFn: ({ id, cost }) => base44.costIntelligence.updateIngredient(id, { current_cost_per_unit: Number(cost) }),
    onSuccess: (_data, variables) => {
      invalidateCosts();
      setCostDrafts((current) => { const next = { ...current }; delete next[variables.id]; return next; });
      toast.success("Precio actualizado");
    },
    onError: () => toast.error("No se pudo actualizar el precio"),
  });

  const createDish = useMutation({
    mutationFn: () => base44.costIntelligence.createDish({
      name: dishForm.name,
      sale_price: Number(dishForm.sale_price),
      category: dishForm.category,
      active: true,
      target_margin: Number(dishForm.target_margin),
      estimated_monthly_units: Number(dishForm.estimated_monthly_units),
    }),
    onSuccess: () => {
      invalidateCosts();
      setDishForm({ name: "", sale_price: "", category: "entrantes", target_margin: "0.68", estimated_monthly_units: "0" });
      toast.success("Plato creado");
    },
    onError: () => toast.error("No se pudo crear el plato"),
  });

  const updateDishPrice = useMutation({
    mutationFn: ({ id, price }) => base44.costIntelligence.updateDish(id, { sale_price: Number(price) }),
    onSuccess: (_data, variables) => {
      invalidateCosts();
      setPriceDrafts((current) => { const next = { ...current }; delete next[variables.id]; return next; });
      toast.success("Precio de venta actualizado");
    },
    onError: () => toast.error("No se pudo actualizar el precio"),
  });

  const createRecipeItem = useMutation({
    mutationFn: () => base44.costIntelligence.createRecipeItem({
      dish_id: recipeForm.dish_id,
      ingredient_id: recipeForm.ingredient_id,
      quantity: Number(recipeForm.quantity),
      unit: recipeForm.unit,
    }),
    onSuccess: () => {
      invalidateCosts();
      queryClient.invalidateQueries({ queryKey: ["cost-breakdown", recipeForm.dish_id] });
      setRecipeForm({ dish_id: "", ingredient_id: "", quantity: "", unit: "kg" });
      toast.success("Ingrediente añadido a la receta");
    },
    onError: () => toast.error("No se pudo añadir a la receta"),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ type, id }) =>
      type === "ingredient"
        ? base44.costIntelligence.deleteIngredient(id)
        : base44.costIntelligence.deleteDish(id),
    onSuccess: () => {
      invalidateCosts();
      setPendingDelete(null);
      toast.success("Eliminado");
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  const simulatePrice = useMutation({
    mutationFn: () => base44.costIntelligence.simulatePriceChange(selectedDishId, Number(simulationPrice)),
  });

  const scanTicket = useMutation({
    mutationFn: async (file) => {
      const { base64, mime } = await fileToBase64(file);
      return base44.costIntelligence.scanTicket({ image_base64: base64, mime_type: mime });
    },
    onSuccess: (data) => {
      setScanError(null);
      setTicketPreview(data);
      setExcludedRows({});
      toast.success(`Ticket leído: ${data.summary?.new_count || 0} nuevos, ${data.summary?.update_count || 0} actualizaciones`);
    },
    onError: (error) => {
      const detail = error?.data?.detail || error?.message || "No se pudo leer el ticket";
      setScanError(detail);
      toast.error(detail);
    },
  });

  const applyTicket = useMutation({
    mutationFn: () => {
      const rows = (ticketPreview?.rows || [])
        .filter((_row, index) => !excludedRows[index])
        .map((row) => ({ ...row, replenish: replenishStock }));
      return base44.costIntelligence.applyTicket({
        rows,
        supplier: ticketPreview?.supplier || null,
        date: ticketPreview?.date || null,
        replenish_stock: replenishStock,
      });
    },
    onSuccess: (data) => {
      invalidateCosts();
      setTicketPreview(null);
      setExcludedRows({});
      toast.success(`Aplicado: ${data.created} nuevos, ${data.updated} actualizados`);
    },
    onError: () => toast.error("No se pudieron aplicar los cambios del ticket"),
  });

  // --- Handlers de fichero --------------------------------------------------
  const handleFiles = (files) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Sube una imagen del ticket"); return; }
    setScanError(null);
    scanTicket.mutate(file);
  };

  const includedRows = (ticketPreview?.rows || []).filter((_row, index) => !excludedRows[index]);
  const projectedDishes = ticketPreview?.affected_dishes || [];

  // --- KPIs -----------------------------------------------------------------
  const costedDishes = dishes.filter((dish) => Number(dish.current_cost || 0) > 0);
  const averageMargin = costedDishes.length
    ? costedDishes.reduce((sum, dish) => sum + Number(dish.current_margin || 0), 0) / costedDishes.length
    : 0;
  const dishesToReview = priceAdvice.filter((item) => item.status !== "ok").length;
  const stockValue = ingredients.reduce((sum, ing) => sum + Number(ing.stock_actual || 0) * Number(ing.current_cost_per_unit || 0), 0);

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Cost Intelligence</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Sube un ticket de compra y actualiza costes, stock y precios de tus platos automáticamente.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Euro, label: "Margen medio", value: pct(averageMargin) },
            { icon: TrendingUp, label: "Platos a revisar", value: dishesToReview },
            { icon: Package, label: "Ingredientes", value: ingredients.length },
            { icon: BarChart3, label: "Valor de stock", value: money(stockValue) },
          ].map((kpi) => (
            <Card key={kpi.label} className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <kpi.icon className="h-5 w-5 text-slate-500" />
                  <div>
                    <p className="text-sm text-slate-500">{kpi.label}</p>
                    <p className="text-2xl font-semibold text-slate-900 dark:text-white">{kpi.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Asistente de tickets */}
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <ScanLine className="h-5 w-5" />
              Asistente de tickets
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {!ticketPreview && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
                className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                  dragActive ? "border-slate-500 bg-slate-50 dark:bg-slate-800/40" : "border-slate-300 dark:border-slate-700"
                }`}
              >
                {scanTicket.isPending ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">Leyendo el ticket con IA...</p>
                  </>
                ) : (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                      <Upload className="h-6 w-6 text-slate-600 dark:text-slate-300" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">Arrastra una foto del ticket o factura</p>
                      <p className="text-sm text-slate-500">La IA detecta ingredientes nuevos, actualiza precios y repone stock.</p>
                    </div>
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                      <Receipt className="mr-2 h-4 w-4" />
                      Seleccionar imagen
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFiles(e.target.files)}
                    />
                    {scanError && (
                      <p className="mt-1 max-w-lg rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                        {scanError}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {ticketPreview && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {ticketPreview.supplier && <span className="mr-3">Proveedor: <strong className="text-slate-900 dark:text-white">{ticketPreview.supplier}</strong></span>}
                    {ticketPreview.date && <span>Fecha: <strong className="text-slate-900 dark:text-white">{ticketPreview.date}</strong></span>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setTicketPreview(null)}>
                    <X className="mr-1 h-4 w-4" /> Descartar
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-800 dark:bg-slate-800/40">
                        <th className="p-3 font-medium text-slate-500"></th>
                        <th className="p-3 font-medium text-slate-500">Producto</th>
                        <th className="p-3 font-medium text-slate-500">Acción</th>
                        <th className="p-3 font-medium text-slate-500">Coste</th>
                        <th className="p-3 font-medium text-slate-500">Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ticketPreview.rows.map((row, index) => {
                        const excluded = !!excludedRows[index];
                        return (
                          <tr key={index} className={`border-b border-slate-100 dark:border-slate-800 ${excluded ? "opacity-40" : ""}`}>
                            <td className="p-3">
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={!excluded}
                                onChange={() => setExcludedRows((current) => ({ ...current, [index]: !current[index] }))}
                              />
                            </td>
                            <td className="p-3">
                              <p className="font-medium text-slate-900 dark:text-white">{row.name}</p>
                              {row.ticket_name !== row.name && <p className="text-xs text-slate-400">ticket: {row.ticket_name}</p>}
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className={row.action === "create"
                                ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                                : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"}>
                                {row.action === "create" ? "Nuevo" : "Actualizar"}
                              </Badge>
                            </td>
                            <td className="p-3 text-slate-700 dark:text-slate-300">
                              {row.action === "update" && row.old_cost != null ? (
                                <span className="flex items-center gap-1">
                                  <span className="text-slate-400 line-through">{money(row.old_cost)}</span>
                                  <ArrowRight className="h-3 w-3 text-slate-400" />
                                  <strong>{money(row.new_cost)}</strong>
                                  <span className="text-xs">/{row.unit}</span>
                                </span>
                              ) : (
                                <span><strong>{money(row.new_cost)}</strong> <span className="text-xs">/{row.unit}</span></span>
                              )}
                            </td>
                            <td className="p-3 text-slate-700 dark:text-slate-300">
                              {replenishStock && Number(row.quantity) > 0
                                ? <span className="text-emerald-600 dark:text-emerald-400">+{row.quantity} {row.unit}</span>
                                : <span className="text-slate-400">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {projectedDishes.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                    <p className="mb-2 text-sm font-medium text-amber-900 dark:text-amber-200">Impacto en tus platos</p>
                    <div className="space-y-2">
                      {projectedDishes.map((dish) => (
                        <div key={dish.dish_id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="font-medium text-slate-900 dark:text-white">{dish.dish_name}</span>
                          <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                            Margen {pct(dish.old_margin)} <ArrowRight className="h-3 w-3" /> {pct(dish.new_margin)}
                            {dish.below_target && (
                              <Badge variant="outline" className={STATUS_META.subir_precio.cls}>
                                Subir a {money(dish.recommended_price)}
                              </Badge>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <input type="checkbox" className="h-4 w-4" checked={replenishStock} onChange={(e) => setReplenishStock(e.target.checked)} />
                    Reponer stock con las cantidades del ticket
                  </label>
                  <Button onClick={() => applyTicket.mutate()} disabled={applyTicket.isPending || includedRows.length === 0}>
                    <Check className="mr-2 h-4 w-4" />
                    {applyTicket.isPending ? "Aplicando..." : `Confirmar ${includedRows.length} cambios`}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            {/* Platos */}
            <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="text-slate-900 dark:text-white">Platos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left dark:border-slate-800">
                        <th className="py-3 pr-4 font-medium text-slate-500">Plato</th>
                        <th className="py-3 pr-4 font-medium text-slate-500">Precio venta</th>
                        <th className="py-3 pr-4 font-medium text-slate-500">Coste</th>
                        <th className="py-3 pr-4 font-medium text-slate-500">Margen</th>
                        <th className="py-3 pr-4 font-medium text-slate-500">Estado</th>
                        <th className="py-3 pr-4 font-medium text-slate-500"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {dishes.map((dish) => {
                        const advice = adviceByDish[dish.id];
                        const draft = priceDrafts[dish.id];
                        const priceValue = draft !== undefined ? draft : String(dish.sale_price ?? "");
                        const changed = draft !== undefined && Number(draft) !== Number(dish.sale_price);
                        return (
                          <tr key={dish.id} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white">{dish.name}</td>
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={priceValue}
                                  onChange={(e) => setPriceDrafts((c) => ({ ...c, [dish.id]: e.target.value }))}
                                  className="h-8 w-24"
                                />
                                {changed && (
                                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => updateDishPrice.mutate({ id: dish.id, price: draft })}>
                                    <Check className="h-4 w-4 text-emerald-600" />
                                  </Button>
                                )}
                              </div>
                            </td>
                            <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">{money(dish.current_cost)}</td>
                            <td className="py-3 pr-4">
                              <Badge variant="outline" className={`rounded-md ${marginClass(Number(dish.current_margin || 0))}`}>{pct(dish.current_margin)}</Badge>
                            </td>
                            <td className="py-3 pr-4">
                              {advice ? (
                                <div className="flex flex-col gap-0.5">
                                  <Badge variant="outline" className={`w-fit rounded-md ${STATUS_META[advice.status].cls}`}>{STATUS_META[advice.status].label}</Badge>
                                  {advice.status !== "ok" && <span className="text-xs text-slate-500">sug. {money(advice.recommended_price)}</span>}
                                </div>
                              ) : <span className="text-xs text-slate-400">sin receta</span>}
                            </td>
                            <td className="py-3 pr-4">
                              <div className="flex gap-1">
                                <Button size="sm" variant="outline" onClick={() => setSelectedDishId(dish.id)}>Abrir</Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => setPendingDelete({ type: "dish", id: dish.id, name: dish.name })}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {dishes.length === 0 && (
                        <tr><td colSpan={6} className="py-6 text-center text-slate-400">Aún no hay platos. Crea uno y añade su receta.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Ingredientes */}
            <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-slate-900 dark:text-white">
                  <span>Ingredientes</span>
                  <span className="text-xs font-normal text-slate-400">Conectados con Stock</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left dark:border-slate-800">
                        <th className="py-3 pr-4 font-medium text-slate-500">Ingrediente</th>
                        <th className="py-3 pr-4 font-medium text-slate-500">Coste / unidad</th>
                        <th className="py-3 pr-4 font-medium text-slate-500">Stock</th>
                        <th className="py-3 pr-4 font-medium text-slate-500"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {ingredients.map((ing) => {
                        const draft = costDrafts[ing.id];
                        const costValue = draft !== undefined ? draft : String(ing.current_cost_per_unit ?? "");
                        const changed = draft !== undefined && Number(draft) !== Number(ing.current_cost_per_unit);
                        const lowStock = Number(ing.stock_actual || 0) <= Number(ing.stock_minimo || 0) && Number(ing.stock_minimo || 0) > 0;
                        return (
                          <tr key={ing.id} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="py-3 pr-4">
                              <p className="font-medium text-slate-900 dark:text-white">{ing.name}</p>
                              <p className="text-xs text-slate-400">{ing.categoria} · {ing.unit}</p>
                            </td>
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={costValue}
                                  onChange={(e) => setCostDrafts((c) => ({ ...c, [ing.id]: e.target.value }))}
                                  className="h-8 w-24"
                                />
                                {changed && (
                                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => updateIngredientCost.mutate({ id: ing.id, cost: draft })}>
                                    <Check className="h-4 w-4 text-emerald-600" />
                                  </Button>
                                )}
                              </div>
                            </td>
                            <td className="py-3 pr-4">
                              <span className={lowStock ? "font-medium text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-300"}>
                                {Number(ing.stock_actual || 0)} {ing.unit}
                              </span>
                              {lowStock && <Badge variant="outline" className="ml-2 border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">Bajo</Badge>}
                            </td>
                            <td className="py-3 pr-4">
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => setPendingDelete({ type: "ingredient", id: ing.id, name: ing.name })}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                      {ingredients.length === 0 && (
                        <tr><td colSpan={4} className="py-6 text-center text-slate-400">Sin ingredientes. Créalos aquí o sube un ticket.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Columna lateral */}
          <div className="space-y-5">
            <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <CardHeader><CardTitle className="text-base text-slate-900 dark:text-white">Nuevo ingrediente</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="Nombre" value={ingredientForm.name} onChange={(e) => setIngredientForm({ ...ingredientForm, name: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Select value={ingredientForm.unit} onValueChange={(v) => setIngredientForm({ ...ingredientForm, unit: v })}>
                    <SelectTrigger><SelectValue placeholder="Unidad" /></SelectTrigger>
                    <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={ingredientForm.categoria} onValueChange={(v) => setIngredientForm({ ...ingredientForm, categoria: v })}>
                    <SelectTrigger><SelectValue placeholder="Categoría" /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input type="number" step="0.01" placeholder="Coste" value={ingredientForm.current_cost_per_unit} onChange={(e) => setIngredientForm({ ...ingredientForm, current_cost_per_unit: e.target.value })} />
                  <Input type="number" step="0.01" placeholder="Stock" value={ingredientForm.stock_actual} onChange={(e) => setIngredientForm({ ...ingredientForm, stock_actual: e.target.value })} />
                  <Input type="number" step="0.01" placeholder="Mínimo" value={ingredientForm.stock_minimo} onChange={(e) => setIngredientForm({ ...ingredientForm, stock_minimo: e.target.value })} />
                </div>
                <Button className="w-full" disabled={!ingredientForm.name || !ingredientForm.current_cost_per_unit} onClick={() => createIngredient.mutate()}>
                  <Plus className="mr-2 h-4 w-4" /> Crear ingrediente
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <CardHeader><CardTitle className="text-base text-slate-900 dark:text-white">Nuevo plato</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="Nombre" value={dishForm.name} onChange={(e) => setDishForm({ ...dishForm, name: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" step="0.01" placeholder="Precio venta" value={dishForm.sale_price} onChange={(e) => setDishForm({ ...dishForm, sale_price: e.target.value })} />
                  <Input type="number" placeholder="Unidades/mes" value={dishForm.estimated_monthly_units} onChange={(e) => setDishForm({ ...dishForm, estimated_monthly_units: e.target.value })} />
                </div>
                <Button className="w-full" disabled={!dishForm.name || !dishForm.sale_price} onClick={() => createDish.mutate()}>
                  <Plus className="mr-2 h-4 w-4" /> Crear plato
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <CardHeader><CardTitle className="text-base text-slate-900 dark:text-white">Receta</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Select value={recipeForm.dish_id} onValueChange={(value) => setRecipeForm({ ...recipeForm, dish_id: value })}>
                  <SelectTrigger><SelectValue placeholder="Plato" /></SelectTrigger>
                  <SelectContent>{dishes.map((dish) => <SelectItem key={dish.id} value={dish.id}>{dish.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={recipeForm.ingredient_id} onValueChange={(value) => setRecipeForm({ ...recipeForm, ingredient_id: value })}>
                  <SelectTrigger><SelectValue placeholder="Ingrediente" /></SelectTrigger>
                  <SelectContent>{ingredients.map((ing) => <SelectItem key={ing.id} value={ing.id}>{ing.name}</SelectItem>)}</SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" step="0.001" placeholder="Cantidad" value={recipeForm.quantity} onChange={(e) => setRecipeForm({ ...recipeForm, quantity: e.target.value })} />
                  <Select value={recipeForm.unit} onValueChange={(v) => setRecipeForm({ ...recipeForm, unit: v })}>
                    <SelectTrigger><SelectValue placeholder="Unidad" /></SelectTrigger>
                    <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button className="w-full" disabled={!recipeForm.dish_id || !recipeForm.ingredient_id || !recipeForm.quantity} onClick={() => createRecipeItem.mutate()}>
                  <Calculator className="mr-2 h-4 w-4" /> Añadir a receta
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <CardHeader><CardTitle className="text-base text-slate-900 dark:text-white">Detalle y simulador</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedDishId} onValueChange={setSelectedDishId}>
                  <SelectTrigger><SelectValue placeholder="Selecciona plato" /></SelectTrigger>
                  <SelectContent>{dishes.map((dish) => <SelectItem key={dish.id} value={dish.id}>{dish.name}</SelectItem>)}</SelectContent>
                </Select>
                {breakdown && (
                  <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                    <div className="flex justify-between"><span>Coste</span><strong>{money(breakdown.current_cost)}</strong></div>
                    <div className="flex justify-between"><span>Margen</span><strong>{pct(breakdown.current_margin)}</strong></div>
                    <div className="mt-3 space-y-2">
                      {breakdown.items?.map((item) => (
                        <div key={item.ingredient_id} className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>{item.ingredient_name}</span><span>{money(item.line_cost)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Nuevo precio</Label>
                  <Input type="number" step="0.01" value={simulationPrice} onChange={(e) => setSimulationPrice(e.target.value)} />
                </div>
                <Button className="w-full" disabled={!selectedDishId || !simulationPrice} onClick={() => simulatePrice.mutate()}>Simular precio</Button>
                {simulatePrice.data && (
                  <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                    <div className="flex justify-between"><span>Margen nuevo</span><strong>{pct(simulatePrice.data.new_margin)}</strong></div>
                    <div className="flex justify-between"><span>Impacto mensual</span><strong>{money(simulatePrice.data.estimated_monthly_impact)}</strong></div>
                    <p className="mt-2 text-slate-600 dark:text-slate-400">{simulatePrice.data.explanation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent className="bg-white dark:bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 dark:text-white">¿Eliminar "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              {pendingDelete?.type === "dish"
                ? "Se eliminará el plato y las líneas de su receta."
                : "Se eliminará el ingrediente. Las recetas que lo usen dejarán de contarlo."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-slate-800 dark:text-white">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete)} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
