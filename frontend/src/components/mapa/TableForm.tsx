import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Info, AlertCircle, Ban, Check, Link as LinkIcon, Plus, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

export default function TableForm({ 
  table, 
  selectedDate,
  isUnavailableToday = false,
  onSubmit, 
  onToggleAvailability,
  onCancel, 
  isLoading,
  isTogglingAvailability = false,
  t, 
  compact = false,
  allowTableJoining = false
}) {
  // Inicializar join_group_ids desde el array existente o desde el string legacy
  const initialGroupIds = table?.join_group_ids || 
                         (table?.join_group_id ? [table.join_group_id] : []);
  
  const [formData, setFormData] = useState(table || {
    numero: "",
    capacidad: 4,
    forma: "cuadrada",
    sala: "Principal",
    activa: true, // Default to active for new tables
    join_group_ids: [],
  });

  const [joinGroupIds, setJoinGroupIds] = useState(initialGroupIds);
  const [newGroupId, setNewGroupId] = useState("");
  const [isUnavailable, setIsUnavailable] = useState(isUnavailableToday);

  const handleSubmit = (e) => {
    e.preventDefault();
    // IMPORTANTE: Eliminar campos que no deben guardarse en la entidad Table
    const { estado, estadoOriginal, reservationsForDay, isUnavailableThisDay, join_group_id, ...dataToSubmit } = formData;
    
    // Enviar el array de join_group_ids
    const finalData = {
      ...dataToSubmit,
      join_group_ids: joinGroupIds
    };
    
    onSubmit(finalData);
  };

  const handleAddGroupId = () => {
    const trimmedId = newGroupId.trim();
    if (trimmedId && !joinGroupIds.includes(trimmedId)) {
      setJoinGroupIds([...joinGroupIds, trimmedId]);
      setNewGroupId("");
    }
  };

  const handleRemoveGroupId = (idToRemove) => {
    setJoinGroupIds(joinGroupIds.filter(id => id !== idToRemove));
  };

  const handleToggleUnavailable = (checked) => {
    setIsUnavailable(checked);
    if (table && onToggleAvailability) {
      onToggleAvailability(table.id, checked);
    }
  };

  const formattedDate = selectedDate ? format(new Date(selectedDate + 'T00:00:00'), "d 'de' MMMM yyyy", { locale: es }) : '';

  return (
    <div className={compact ? "" : "p-6"}>
      {!table && (
        <Alert className="mb-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-sm text-blue-900 dark:text-blue-300">
            La nueva mesa aparecerá en el centro del mapa. Después podrás moverla arrastrándola.
          </AlertDescription>
        </Alert>
      )}

      {/* NUEVO: Bloqueo Permanente */}
      {table && (
        <Alert className="mb-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <Ban className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-900 dark:text-red-100 mb-1">
                  🔒 Bloqueo Permanente
                </p>
                <p className="text-xs text-red-700 dark:text-red-300">
                  {formData.activa 
                    ? "La mesa está activa y funcionando normalmente" 
                    : "⚠️ Esta mesa está PERMANENTEMENTE deshabilitada. NO aparecerá en ningún día ni en el formulario público."}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <div className="flex flex-col items-end">
                  <span className={`text-xs font-medium ${!formData.activa ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {!formData.activa ? 'INACTIVA' : 'ACTIVA'}
                  </span>
                </div>
                <Switch
                  checked={!formData.activa} // Checked means inactive
                  onCheckedChange={(checked) => setFormData({ ...formData, activa: !checked })}
                  className="data-[state=checked]:bg-red-600"
                />
              </div>
            </div>
            {!formData.activa && (
              <Alert className="mt-3 bg-red-100 dark:bg-red-950 border-red-300 dark:border-red-900">
                <AlertCircle className="h-4 w-4 text-red-700 dark:text-red-400" />
                <AlertDescription className="text-xs text-red-900 dark:text-red-200">
                  <p className="font-semibold mb-1">⚠️ Efectos del bloqueo permanente:</p>
                  <ul className="list-disc ml-4 space-y-0.5">
                    <li>No se podrán crear reservas en esta mesa desde NINGÚN formulario</li>
                    <li>Aparecerá en el mapa pero marcada como permanentemente deshabilitada</li>
                    <li>No consume capacidad del restaurante</li>
                    <li>Útil para mesas en reparación, eliminadas físicamente, o reservadas para eventos privados</li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Bloqueo por día específico (ya existente) */}
      {table && selectedDate && formData.activa && (
        <Alert className="mb-4 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <AlertCircle className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                  ⏰ Disponibilidad para el {formattedDate}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {isUnavailable 
                    ? "Esta mesa NO estará disponible para reservas solo en este día" 
                    : "Esta mesa estará disponible para reservas en este día"}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <div className="flex flex-col items-end">
                  <span className={`text-xs font-medium ${isUnavailable ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {isUnavailable ? 'No Disponible Hoy' : 'Disponible Hoy'}
                  </span>
                </div>
                <Switch
                  checked={isUnavailable}
                  onCheckedChange={handleToggleUnavailable}
                  disabled={isTogglingAvailability}
                  className="data-[state=checked]:bg-orange-600"
                />
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {table && selectedDate && !formData.activa && (
        <Alert className="mb-4 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-sm text-amber-900 dark:text-amber-300">
            💡 La mesa tiene un <strong>bloqueo permanente</strong> activo. El bloqueo diario no está disponible porque la mesa ya está completamente deshabilitada.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-slate-900 dark:text-white text-sm">Número de Mesa *</Label>
            <Input
              required
              value={formData.numero}
              onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
              placeholder="Ej: 1, A1, VIP-1"
              className="dark:bg-slate-800 dark:border-slate-700 dark:text-white h-9 bg-white text-slate-900"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-900 dark:text-white text-sm">Capacidad *</Label>
            <Input
              type="number"
              required
              min="1"
              value={formData.capacidad}
              onChange={(e) => setFormData({ ...formData, capacidad: parseInt(e.target.value) })}
              className="dark:bg-slate-800 dark:border-slate-700 dark:text-white h-9 bg-white text-slate-900"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-900 dark:text-white text-sm">Forma</Label>
            <Select value={formData.forma} onValueChange={(value) => setFormData({ ...formData, forma: value })}>
              <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700 dark:text-white h-9 bg-white text-slate-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                <SelectItem value="redonda">Redonda</SelectItem>
                <SelectItem value="cuadrada">Cuadrada</SelectItem>
                <SelectItem value="rectangular_horizontal">Rectangular Horizontal</SelectItem>
                <SelectItem value="rectangular_vertical">Rectangular Vertical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-900 dark:text-white text-sm">
              Zona / Sala
              <span className="text-blue-600 dark:text-blue-400 ml-1">*</span>
            </Label>
            <Input
              value={formData.sala || ""}
              onChange={(e) => setFormData({ ...formData, sala: e.target.value })}
              placeholder="Ej: Terraza, Interior, Barra, Ventana"
              className="dark:bg-slate-800 dark:border-slate-700 dark:text-white h-9 bg-white text-slate-900"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              💡 Define la zona donde está ubicada esta mesa
            </p>
          </div>
        </div>

        <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-sm text-amber-900 dark:text-amber-300">
            <p className="font-semibold mb-1">📍 Importante sobre Zonas:</p>
            <p className="text-xs">
              Si has activado la opción <strong>"Solicitar zona en formulario público"</strong> en Configuración, 
              asegúrate de que el nombre de la zona de esta mesa coincida exactamente con alguna de las zonas 
              disponibles que configuraste (ej: "Terraza", "Interior", "Barra").
            </p>
          </AlertDescription>
        </Alert>

        <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
          <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    🎯 Capacidad Exacta
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    {formData.exact_capacity_only 
                      ? `⚠️ Esta mesa SOLO aceptará reservas de exactamente ${formData.capacidad || 0} personas. No se asignará para grupos más pequeños ni grandes.` 
                      : `Esta mesa puede aceptar reservas de hasta ${formData.capacidad || 0} personas.`}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <div className="flex flex-col items-end">
                    <span className={`text-xs font-medium ${formData.exact_capacity_only ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {formData.exact_capacity_only ? 'ACTIVADO' : 'DESACTIVADO'}
                    </span>
                  </div>
                  <Switch
                    checked={formData.exact_capacity_only || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, exact_capacity_only: checked })}
                    className="data-[state=checked]:bg-orange-600"
                  />
                </div>
              </div>
            </AlertDescription>
          </Alert>
          {formData.exact_capacity_only && (
            <Alert className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
              <Info className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <AlertDescription className="text-sm text-orange-900 dark:text-orange-300">
                <p className="font-semibold mb-1">💡 Uso recomendado:</p>
                <ul className="text-xs space-y-1 ml-4 list-disc">
                  <li>Ideal para restaurantes que quieren optimizar el uso de cada asiento</li>
                  <li>Una mesa de 4 solo aceptará reservas de exactamente 4 personas</li>
                  <li>Útil para evitar desperdiciar asientos en mesas grandes</li>
                  <li>Ejemplo: Mesa de 4 no se asignará a grupos de 2 o 3 personas</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {allowTableJoining && (
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <Label className="text-slate-900 dark:text-white text-sm font-semibold">
                Configuración de Unión de Mesas
              </Label>
            </div>
            
            <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-sm text-blue-900 dark:text-blue-300">
                <p className="font-semibold mb-2">¿Cómo funciona?</p>
                <ul className="text-xs space-y-1 ml-4 list-disc">
                  <li>Una mesa puede pertenecer a <strong>múltiples grupos</strong> de unión</li>
                  <li>Ejemplo: Mesa 5 puede estar en "terraza-A" y "salon-principal"</li>
                  <li>El sistema buscará combinaciones en todos sus grupos</li>
                  <li>Útil cuando una mesa puede moverse entre diferentes áreas</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label className="text-slate-900 dark:text-white text-sm">
                Grupos de Unión
              </Label>
              
              {/* Lista de grupos actuales */}
              {joinGroupIds.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                  {joinGroupIds.map((groupId, index) => (
                    <Badge 
                      key={index}
                      className="bg-blue-600 dark:bg-blue-500 text-white pl-3 pr-1 py-1 flex items-center gap-2"
                    >
                      <span className="text-xs font-medium">{groupId}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveGroupId(groupId)}
                        className="hover:bg-blue-700 dark:hover:bg-blue-600 rounded-full p-0.5 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Input para añadir nuevo grupo */}
              <div className="flex gap-2">
                <Input
                  value={newGroupId}
                  onChange={(e) => setNewGroupId(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddGroupId();
                    }
                  }}
                  placeholder="Ej: terraza-1, salon-A, vip-principal..."
                  className="dark:bg-slate-800 dark:border-slate-700 dark:text-white h-9 bg-white text-slate-900 flex-1"
                />
                <Button
                  type="button"
                  onClick={handleAddGroupId}
                  disabled={!newGroupId.trim() || joinGroupIds.includes(newGroupId.trim())}
                  className="bg-blue-600 hover:bg-blue-700 text-white h-9 px-3"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Añade uno o más IDs de grupo. Mesas con grupos en común se podrán unir.
              </p>
            </div>

            {joinGroupIds.length > 0 && (
              <Alert className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <AlertDescription className="text-sm text-emerald-900 dark:text-emerald-300">
                  Esta mesa pertenece a <strong>{joinGroupIds.length}</strong> grupo(s):
                  <br />
                  <span className="text-xs font-mono">
                    {joinGroupIds.map((id, idx) => (
                      <span key={idx}>
                        "{id}"{idx < joinGroupIds.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </span>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <Alert className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <AlertDescription className="text-sm text-emerald-900 dark:text-emerald-300">
            <p className="font-semibold mb-1">✅ Estado visual automático en el mapa:</p>
            <ul className="text-xs space-y-1 ml-4 list-disc">
              <li><strong>Libre (verde)</strong>: Mesa sin reservas</li>
              <li><strong>Reservada (amarillo)</strong>: Tiene reservas ese día</li>
              <li><strong>Sentada (naranja)</strong>: Cliente actualmente en la mesa</li>
              <li><strong>No disponible hoy (rojo)</strong>: Bloqueada solo para ese día</li>
              <li><strong>Inactiva permanente (gris)</strong>: Bloqueada de forma permanente</li>
            </ul>
            <p className="text-xs mt-2">💡 El estado se calcula automáticamente según las reservas y bloqueos.</p>
          </AlertDescription>
        </Alert>

        <div className="flex justify-end gap-3 pt-2">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel} 
            className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700"
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            disabled={isLoading}
            className="bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 text-white"
          >
            {isLoading ? 'Guardando...' : (table ? 'Actualizar' : 'Crear Mesa')}
          </Button>
        </div>
      </form>
    </div>
  );
}