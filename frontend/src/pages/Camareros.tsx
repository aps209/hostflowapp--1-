import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, User } from "lucide-react";
import { useRestaurant } from "../components/RestaurantContext";


export default function CamarerosPage() {
  const { restaurantId } = useRestaurant();
  const [showForm, setShowForm] = useState(false);
  const [editingWaiter, setEditingWaiter] = useState(null);
  const queryClient = useQueryClient();

  const { data: waiters = [], isLoading } = useQuery({
    queryKey: ['waiters', restaurantId],
    queryFn: () => base44.entities.Waiter.filter({ restaurant_id: restaurantId }, 'nombre'),
    enabled: !!restaurantId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Waiter.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiters'] });
      setShowForm(false);
      setEditingWaiter(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Waiter.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiters'] });
      setShowForm(false);
      setEditingWaiter(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Waiter.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiters'] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      restaurant_id: restaurantId,
      nombre: formData.get('nombre'),
      apellidos: formData.get('apellidos'),
      color: formData.get('color'),
    };

    if (editingWaiter) {
      updateMutation.mutate({ id: editingWaiter.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (!restaurantId || isLoading) {
    return <div className="p-8">Cargando...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Camareros</h1>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingWaiter(null)} className="gap-2">
              <Plus className="w-4 h-4" />
              Añadir Camarero
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingWaiter ? 'Editar Camarero' : 'Nuevo Camarero'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nombre">Nombre *</Label>
                <Input id="nombre" name="nombre" defaultValue={editingWaiter?.nombre} required />
              </div>
              <div>
                <Label htmlFor="apellidos">Apellidos</Label>
                <Input id="apellidos" name="apellidos" defaultValue={editingWaiter?.apellidos} />
              </div>
              <div>
                <Label htmlFor="color">Color identificativo</Label>
                <Input id="color" name="color" type="color" defaultValue={editingWaiter?.color || '#3b82f6'} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingWaiter ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {waiters.map((waiter) => (
          <Card key={waiter.id} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: waiter.color }}
                >
                  {waiter.nombre.charAt(0)}{waiter.apellidos?.charAt(0) || ''}
                </div>
                <div>
                  <h3 className="font-bold text-lg dark:text-white">
                    {waiter.nombre} {waiter.apellidos}
                  </h3>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setEditingWaiter(waiter);
                    setShowForm(true);
                  }}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => deleteMutation.mutate(waiter.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {waiters.length === 0 && (
        <Card className="p-12 text-center">
          <User className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 text-lg">No hay camareros registrados</p>
          <p className="text-slate-400 text-sm mt-2">Añade el primer camarero para comenzar</p>
        </Card>
      )}
    </div>
  );
}