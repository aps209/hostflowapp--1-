import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, Plus, Trash2, Edit2, AlertCircle, GripVertical, RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useRestaurant } from "../RestaurantContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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

export default function ReservationStatusManager() {
  const { restaurantId } = useRestaurant();
  const queryClient = useQueryClient();

  const [showDialog, setShowDialog] = useState(false);
  const [editingStatus, setEditingStatus] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [formData, setFormData] = useState({
    key: "",
    label: "",
    description: "",
    color: "#3b82f6",
    icon: "",
  });

  const { data: statuses = [], isLoading, error, refetch } = useQuery({
    queryKey: ['reservationStatuses', restaurantId],
    queryFn: async () => {
      try {
        const result = await base44.entities.ReservationStatus.filter({ restaurant_id: restaurantId }, 'order');
        return result || [];
      } catch (err) {
        console.error('[ReservationStatusManager] Error fetching statuses:', err);
        return [];
      }
    },
    enabled: !!restaurantId,
    retry: 1,
    staleTime: 5000,
    cacheTime: 10000,
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ReservationStatus.create({
      ...data,
      restaurant_id: restaurantId,
      is_system: false,
      order: statuses.length,
      active: true,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservationStatuses', restaurantId] });
      toast.success('Estado creado correctamente');
      handleCloseDialog();
    },
    onError: (error) => {
      console.error('[ReservationStatusManager] Create error:', error);
      toast.error(`Error: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ReservationStatus.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservationStatuses', restaurantId] });
      toast.success('Estado actualizado correctamente');
      handleCloseDialog();
    },
    onError: (error) => {
      console.error('[ReservationStatusManager] Update error:', error);
      toast.error(`Error: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ReservationStatus.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservationStatuses', restaurantId] });
      toast.success('Estado eliminado correctamente');
      setDeleteTarget(null);
    },
    onError: (error) => {
      console.error('[ReservationStatusManager] Delete error:', error);
      toast.error(`Error: ${error.message}`);
    },
  });

  const handleOpenDialog = (status = null) => {
    if (status) {
      setEditingStatus(status);
      setFormData({
        key: status.key,
        label: status.label,
        description: status.description || "",
        color: status.color,
        icon: status.icon || "",
      });
    } else {
      setEditingStatus(null);
      setFormData({
        key: "",
        label: "",
        description: "",
        color: "#3b82f6",
        icon: "",
      });
    }
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingStatus(null);
    setFormData({
      key: "",
      label: "",
      description: "",
      color: "#3b82f6",
      icon: "",
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const cleanKey = formData.key.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    
    if (!cleanKey || !formData.label || !formData.color) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    const keyExists = statuses.some(s => 
      s.key === cleanKey && s.id !== editingStatus?.id
    );

    if (keyExists) {
      toast.error('Ya existe un estado con esta clave');
      return;
    }

    const data = {
      ...formData,
      key: cleanKey,
    };

    if (editingStatus) {
      updateMutation.mutate({ id: editingStatus.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
    }
  };

  if (!restaurantId) {
    return (
      <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <CardContent className="p-6">
          <p className="text-slate-500">Cargando configuración...</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <CardContent className="p-12 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-slate-400 mb-4" />
          <p className="text-slate-500">Cargando estados personalizados...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Estados de Reserva Personalizados
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400 mt-1">
              Crea estados personalizados para el ciclo de vida de tus reservas
            </CardDescription>
          </div>
          <Button
            onClick={() => handleOpenDialog()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Estado
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-900 dark:text-blue-300 text-sm">
            <p className="font-semibold mb-1">Estados del Sistema (No Editables):</p>
            <p className="text-xs mb-2">Confirmada, Pendiente, Sentada, Completada, Cancelada, No Show</p>
            <p className="font-semibold mb-1 mt-3">💡 Ejemplos de estados personalizados:</p>
            <p className="text-xs">• VIP Confirmada • Lista de Espera • Pre-pago Requerido • En Revisión</p>
            <p className="text-xs mt-2 italic">Los estados personalizados aparecen en el selector cuando cambias el estado de una reserva.</p>
          </AlertDescription>
        </Alert>

        <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-900 dark:text-amber-300 text-sm">
            <p className="font-semibold mb-1">🔑 ¿Qué es la "Clave"?</p>
            <p className="text-xs mb-2">
              La clave es el identificador técnico único (ej: <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">vip_confirmada</code>)
            </p>
            <p className="text-xs">
              • <strong>Nombre visible</strong>: "VIP Confirmada" ← Esto es lo que ves en la interfaz<br/>
              • <strong>Clave técnica</strong>: "vip_confirmada" ← Esto se usa en la base de datos<br/>
              • El nombre puede cambiar, pero la clave NUNCA cambia
            </p>
          </AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold mb-2">Error al cargar estados</p>
              <p className="text-sm mb-3">La entidad ReservationStatus se está sincronizando. Intenta recargar en unos segundos.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetch()}
                className="mt-2"
              >
                <RefreshCw className="w-3 h-3 mr-2" />
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!error && statuses.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="font-semibold">No hay estados personalizados creados</p>
            <p className="text-sm mt-2">Los 6 estados del sistema siempre están disponibles</p>
            <p className="text-sm mt-1">Haz clic en "Nuevo Estado" para crear uno personalizado</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {statuses.map((status) => (
              <div
                key={status.id}
                className="flex items-center justify-between p-4 rounded-lg border-2 bg-white dark:bg-slate-800 hover:shadow-md transition-shadow"
                style={{ borderColor: status.color + '40' }}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-slate-400" />
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center"
                      style={{ backgroundColor: status.color }}
                    >
                      {status.icon && (
                        <span className="text-white text-sm">{status.icon}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {status.label}
                      </h3>
                      {status.is_system && (
                        <Badge variant="outline" className="text-xs">
                          Sistema
                        </Badge>
                      )}
                    </div>
                    {status.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {status.description}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                      Clave: <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{status.key}</code>
                    </p>
                  </div>
                </div>
                {!status.is_system && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleOpenDialog(status)}
                      className="h-8 w-8"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeleteTarget(status)}
                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">
              {editingStatus ? 'Editar Estado' : 'Nuevo Estado de Reserva'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="label" className="text-slate-900 dark:text-white">
                Nombre del Estado * (visible en interfaz)
              </Label>
              <Input
                id="label"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="Ej: VIP Confirmada, Lista de Espera"
                className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="key" className="text-slate-900 dark:text-white">
                Clave Técnica * (identificador en base de datos)
              </Label>
              <Input
                id="key"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                placeholder="Ej: vip_confirmada, lista_espera"
                className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-mono text-sm"
                required
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Se convierte automáticamente a minúsculas sin espacios. Esta clave NUNCA debe cambiar.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-slate-900 dark:text-white">
                Descripción (opcional)
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe cuándo usar este estado..."
                className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="color" className="text-slate-900 dark:text-white">
                  Color *
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-16 h-10 cursor-pointer"
                    required
                  />
                  <Input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="flex-1 font-mono text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    placeholder="#3b82f6"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="icon" className="text-slate-900 dark:text-white">
                  Icono (emoji opcional)
                </Label>
                <Input
                  id="icon"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="🌟"
                  className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-center text-2xl"
                  maxLength={2}
                />
              </div>
            </div>

            <div
              className="p-4 rounded-lg flex items-center gap-3 border-2"
              style={{ 
                backgroundColor: formData.color + '20',
                borderColor: formData.color + '60'
              }}
            >
              <div
                className="w-10 h-10 rounded-md flex items-center justify-center"
                style={{ backgroundColor: formData.color }}
              >
                {formData.icon && <span className="text-white text-lg">{formData.icon}</span>}
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {formData.label || 'Vista previa'}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {formData.description || 'Así se verá en el selector de estados'}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                className="dark:bg-slate-800 dark:text-white"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : (editingStatus ? 'Actualizar' : 'Crear Estado')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-white dark:bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 dark:text-white">
              ¿Eliminar estado "{deleteTarget?.label}"?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              Esta acción no se puede deshacer. El estado se eliminará permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-slate-800 dark:text-white">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}