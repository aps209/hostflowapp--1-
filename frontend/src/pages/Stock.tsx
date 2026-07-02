import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Search, AlertTriangle, Package, TrendingUp } from "lucide-react";
import { useRestaurant } from "../components/RestaurantContext";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

function IngredientForm({ ingredient, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState(ingredient || {
    nombre: "",
    categoria: "otros",
    unidad_medida: "kg",
    stock_actual: 0,
    stock_minimo: 0,
    coste_unitario: 0,
    proveedor: "",
    activo: true,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      stock_actual: parseFloat(formData.stock_actual),
      stock_minimo: parseFloat(formData.stock_minimo),
      coste_unitario: parseFloat(formData.coste_unitario),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nombre" className="text-slate-900 dark:text-white">Nombre del Ingrediente *</Label>
          <Input
            id="nombre"
            value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            placeholder="Ej: Tomate"
            required
            className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="categoria" className="text-slate-900 dark:text-white">Categoría *</Label>
          <Select value={formData.categoria} onValueChange={(value) => setFormData({ ...formData, categoria: value })}>
            <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700 dark:text-white">
              <SelectValue placeholder="Seleccionar categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="carnes">Carnes</SelectItem>
              <SelectItem value="pescados">Pescados</SelectItem>
              <SelectItem value="verduras">Verduras</SelectItem>
              <SelectItem value="lacteos">Lácteos</SelectItem>
              <SelectItem value="bebidas">Bebidas</SelectItem>
              <SelectItem value="condimentos">Condimentos</SelectItem>
              <SelectItem value="otros">Otros</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="unidad_medida" className="text-slate-900 dark:text-white">Unidad de Medida *</Label>
          <Select value={formData.unidad_medida} onValueChange={(value) => setFormData({ ...formData, unidad_medida: value })}>
            <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700 dark:text-white">
              <SelectValue placeholder="Unidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kg">Kilogramos (kg)</SelectItem>
              <SelectItem value="g">Gramos (g)</SelectItem>
              <SelectItem value="l">Litros (l)</SelectItem>
              <SelectItem value="ml">Mililitros (ml)</SelectItem>
              <SelectItem value="unidad">Unidades</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="stock_actual" className="text-slate-900 dark:text-white">Stock Actual *</Label>
          <Input
            id="stock_actual"
            type="number"
            step="0.01"
            min="0"
            value={formData.stock_actual}
            onChange={(e) => setFormData({ ...formData, stock_actual: e.target.value })}
            placeholder="100"
            required
            className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="stock_minimo" className="text-slate-900 dark:text-white">Stock Mínimo *</Label>
          <Input
            id="stock_minimo"
            type="number"
            step="0.01"
            min="0"
            value={formData.stock_minimo}
            onChange={(e) => setFormData({ ...formData, stock_minimo: e.target.value })}
            placeholder="20"
            required
            className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="coste_unitario" className="text-slate-900 dark:text-white">Coste Unitario (€) *</Label>
          <Input
            id="coste_unitario"
            type="number"
            step="0.01"
            min="0"
            value={formData.coste_unitario}
            onChange={(e) => setFormData({ ...formData, coste_unitario: e.target.value })}
            placeholder="2.50"
            required
            className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="proveedor" className="text-slate-900 dark:text-white">Proveedor</Label>
          <Input
            id="proveedor"
            value={formData.proveedor}
            onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}
            placeholder="Nombre del proveedor"
            className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="activo"
          type="checkbox"
          checked={formData.activo}
          onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
          className="w-4 h-4"
        />
        <Label htmlFor="activo" className="text-slate-900 dark:text-white">Ingrediente activo</Label>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="dark:bg-slate-800 dark:text-white">
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading} className="bg-gradient-to-r from-blue-900 to-blue-800">
          {isLoading ? "Guardando..." : (ingredient ? "Actualizar" : "Crear Ingrediente")}
        </Button>
      </div>
    </form>
  );
}

export default function Stock() {
  const [showForm, setShowForm] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showOnlyLowStock, setShowOnlyLowStock] = useState(false);
  const [ingredientToDelete, setIngredientToDelete] = useState(null);

  const { restaurantId } = useRestaurant();
  const queryClient = useQueryClient();

  const { data: ingredients = [], isLoading } = useQuery({
    queryKey: ['ingredients', restaurantId],
    queryFn: () => base44.entities.Ingredient.filter({ restaurant_id: restaurantId }, '-created_date'),
    enabled: !!restaurantId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Ingredient.create({ ...data, restaurant_id: restaurantId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients', restaurantId] });
      setShowForm(false);
      setEditingIngredient(null);
      toast.success('Ingrediente creado correctamente');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Ingredient.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients', restaurantId] });
      setShowForm(false);
      setEditingIngredient(null);
      toast.success('Ingrediente actualizado correctamente');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Ingredient.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients', restaurantId] });
      setIngredientToDelete(null);
      toast.success('Ingrediente eliminado correctamente');
    },
  });

  const handleSubmit = (data) => {
    if (editingIngredient) {
      updateMutation.mutate({ id: editingIngredient.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredIngredients = ingredients.filter(i => {
    const matchesSearch = i.nombre?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || i.categoria === categoryFilter;
    const matchesLowStock = !showOnlyLowStock || i.stock_actual <= i.stock_minimo;
    return matchesSearch && matchesCategory && matchesLowStock;
  });

  const ingredientsByCategory = {
    carnes: filteredIngredients.filter(i => i.categoria === "carnes"),
    pescados: filteredIngredients.filter(i => i.categoria === "pescados"),
    verduras: filteredIngredients.filter(i => i.categoria === "verduras"),
    lacteos: filteredIngredients.filter(i => i.categoria === "lacteos"),
    bebidas: filteredIngredients.filter(i => i.categoria === "bebidas"),
    condimentos: filteredIngredients.filter(i => i.categoria === "condimentos"),
    otros: filteredIngredients.filter(i => i.categoria === "otros"),
  };

  const totalIngredientes = ingredients.length;
  const ingredientesBajoStock = ingredients.filter(i => i.stock_actual <= i.stock_minimo).length;
  const valorTotalStock = ingredients.reduce((sum, i) => sum + (i.stock_actual * i.coste_unitario), 0);

  return (
    <div className="p-6 md:p-8 space-y-6 bg-slate-50 dark:bg-black min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Control de Stock</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Gestiona el inventario de ingredientes</p>
        </div>
        <Button
          onClick={() => {
            setEditingIngredient(null);
            setShowForm(true);
          }}
          className="bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 shadow-lg text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Ingrediente
        </Button>
      </div>

      {/* Estadísticas */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-xl bg-white dark:bg-slate-900">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Ingredientes</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalIngredientes}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl bg-white dark:bg-slate-900">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Stock Bajo</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{ingredientesBajoStock}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl bg-white dark:bg-slate-900">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Valor Total Stock</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{valorTotalStock.toFixed(2)}€</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Buscar ingredientes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="md:w-48 dark:bg-slate-800 dark:border-slate-700 dark:text-white">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            <SelectItem value="carnes">Carnes</SelectItem>
            <SelectItem value="pescados">Pescados</SelectItem>
            <SelectItem value="verduras">Verduras</SelectItem>
            <SelectItem value="lacteos">Lácteos</SelectItem>
            <SelectItem value="bebidas">Bebidas</SelectItem>
            <SelectItem value="condimentos">Condimentos</SelectItem>
            <SelectItem value="otros">Otros</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={showOnlyLowStock ? "default" : "outline"}
          onClick={() => setShowOnlyLowStock(!showOnlyLowStock)}
          className={showOnlyLowStock ? "bg-red-600 hover:bg-red-700 text-white" : ""}
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          Stock Bajo
        </Button>
      </div>

      {/* Lista de ingredientes por categoría */}
      <div className="space-y-6">
        {Object.entries(ingredientsByCategory).map(([categoria, items]) => {
          if (items.length === 0) return null;

          const categoryLabels = {
            carnes: "Carnes",
            pescados: "Pescados",
            verduras: "Verduras",
            lacteos: "Lácteos",
            bebidas: "Bebidas",
            condimentos: "Condimentos",
            otros: "Otros"
          };

          return (
            <Card key={categoria} className="border-0 shadow-xl bg-white dark:bg-slate-900">
              <CardHeader className="border-b border-slate-100 dark:border-slate-700">
                <CardTitle className="text-slate-900 dark:text-white">{categoryLabels[categoria]}</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((ingredient) => {
                    const isLowStock = ingredient.stock_actual <= ingredient.stock_minimo;
                    const stockPercentage = (ingredient.stock_actual / ingredient.stock_minimo) * 100;

                    return (
                      <div
                        key={ingredient.id}
                        className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                          isLowStock ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 dark:text-white">{ingredient.nombre}</h3>
                            {isLowStock && (
                              <Badge className="bg-red-100 text-red-800 mt-1">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Stock Bajo
                              </Badge>
                            )}
                            {!ingredient.activo && (
                              <Badge variant="outline" className="mt-1">Inactivo</Badge>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-8 h-8"
                              onClick={() => {
                                setEditingIngredient(ingredient);
                                setShowForm(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-8 h-8 text-red-500"
                              onClick={() => setIngredientToDelete(ingredient.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600 dark:text-slate-400">Stock:</span>
                            <span className={`font-medium ${isLowStock ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                              {ingredient.stock_actual} {ingredient.unidad_medida}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600 dark:text-slate-400">Mínimo:</span>
                            <span className="text-slate-900 dark:text-white">{ingredient.stock_minimo} {ingredient.unidad_medida}</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                isLowStock ? 'bg-red-600' : 'bg-green-600'
                              }`}
                              style={{ width: `${Math.min(stockPercentage, 100)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-sm pt-2 border-t border-slate-200 dark:border-slate-700">
                            <span className="text-slate-600 dark:text-slate-400">Coste:</span>
                            <span className="font-medium text-slate-900 dark:text-white">
                              {ingredient.coste_unitario.toFixed(2)}€/{ingredient.unidad_medida}
                            </span>
                          </div>
                          {ingredient.proveedor && (
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-600 dark:text-slate-400">Proveedor:</span>
                              <span className="text-slate-900 dark:text-white text-xs">{ingredient.proveedor}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredIngredients.length === 0 && !isLoading && (
        <Card className="border-0 shadow-xl bg-white dark:bg-slate-900">
          <CardContent className="p-12 text-center">
            <Package className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400">
              {searchTerm || categoryFilter !== "all" || showOnlyLowStock ? "No se encontraron ingredientes" : "No hay ingredientes registrados"}
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">
              {editingIngredient ? "Editar Ingrediente" : "Nuevo Ingrediente"}
            </DialogTitle>
          </DialogHeader>
          <IngredientForm
            ingredient={editingIngredient}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingIngredient(null);
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!ingredientToDelete} onOpenChange={(open) => !open && setIngredientToDelete(null)}>
        <AlertDialogContent className="bg-white dark:bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 dark:text-white">¿Eliminar ingrediente?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              Esta acción no se puede deshacer. El ingrediente se eliminará permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-slate-800 dark:text-white">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => ingredientToDelete && deleteMutation.mutate(ingredientToDelete)}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}