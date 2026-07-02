import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

export default function AdvancedSegmentation({ filters, onChange, tags }) {
  const handleFilterChange = (key, value) => {
    onChange({
      ...filters,
      [key]: value
    });
  };

  const handleTagToggle = (tagName) => {
    const currentTags = filters.tags || [];
    const newTags = currentTags.includes(tagName)
      ? currentTags.filter(t => t !== tagName)
      : [...currentTags, tagName];
    
    handleFilterChange('tags', newTags);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm text-slate-700 dark:text-slate-300">
            Visitas Mínimas
          </Label>
          <Input
            type="number"
            min="0"
            placeholder="Ej: 5"
            value={filters.total_visitas_min || ''}
            onChange={(e) => handleFilterChange('total_visitas_min', e.target.value ? parseInt(e.target.value) : null)}
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm text-slate-700 dark:text-slate-300">
            Visitas Máximas
          </Label>
          <Input
            type="number"
            min="0"
            placeholder="Ej: 50"
            value={filters.total_visitas_max || ''}
            onChange={(e) => handleFilterChange('total_visitas_max', e.target.value ? parseInt(e.target.value) : null)}
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm text-slate-700 dark:text-slate-300">
            Gasto Mínimo (€)
          </Label>
          <Input
            type="number"
            min="0"
            placeholder="Ej: 100"
            value={filters.gasto_total_min || ''}
            onChange={(e) => handleFilterChange('gasto_total_min', e.target.value ? parseFloat(e.target.value) : null)}
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm text-slate-700 dark:text-slate-300">
            Gasto Máximo (€)
          </Label>
          <Input
            type="number"
            min="0"
            placeholder="Ej: 1000"
            value={filters.gasto_total_max || ''}
            onChange={(e) => handleFilterChange('gasto_total_max', e.target.value ? parseFloat(e.target.value) : null)}
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm text-slate-700 dark:text-slate-300">
          Última Visita (días atrás)
        </Label>
        <Input
          type="number"
          min="0"
          placeholder="Ej: 30 (últimos 30 días)"
          value={filters.ultima_visita_dias || ''}
          onChange={(e) => handleFilterChange('ultima_visita_dias', e.target.value ? parseInt(e.target.value) : null)}
          className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm text-slate-700 dark:text-slate-300">
          Ocasión Especial
        </Label>
        <Select
          value={filters.ocasion_especial || 'todas'}
          onValueChange={(value) => handleFilterChange('ocasion_especial', value === 'todas' ? null : value)}
        >
          <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <SelectValue placeholder="Seleccionar ocasión" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-slate-800">
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="cumpleanos">Cumpleaños</SelectItem>
            <SelectItem value="aniversario">Aniversario</SelectItem>
            <SelectItem value="negocio">Negocio</SelectItem>
            <SelectItem value="cita">Cita</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-sm text-slate-700 dark:text-slate-300">
          Preferencias
        </Label>
        <Input
          type="text"
          placeholder="Ej: terraza, ventana..."
          value={filters.preferencias || ''}
          onChange={(e) => handleFilterChange('preferencias', e.target.value || null)}
          className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
        />
      </div>

      {tags && tags.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm text-slate-700 dark:text-slate-300">
            Etiquetas
          </Label>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => {
              const isSelected = (filters.tags || []).includes(tag.nombre);
              return (
                <Badge
                  key={tag.id}
                  onClick={() => handleTagToggle(tag.nombre)}
                  className="cursor-pointer transition-all"
                  style={{
                    backgroundColor: isSelected ? tag.color : 'transparent',
                    color: isSelected ? '#fff' : tag.color,
                    borderColor: tag.color,
                    border: '2px solid'
                  }}
                >
                  {tag.nombre}
                  {isSelected && <X className="w-3 h-3 ml-1" />}
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}