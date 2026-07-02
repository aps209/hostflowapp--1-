import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { X, Save, Calendar as CalendarIcon, Filter } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function AdvancedSearch({ 
  filters, 
  onFiltersChange, 
  onSavePreset, 
  savedPresets = [],
  onLoadPreset,
  onDeletePreset,
  filterConfig = []
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [showSavePreset, setShowSavePreset] = useState(false);

  const handleFilterChange = (key, value) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const handleClearFilters = () => {
    const clearedFilters = {};
    filterConfig.forEach(config => {
      clearedFilters[config.key] = config.defaultValue || '';
    });
    onFiltersChange(clearedFilters);
  };

  const handleSavePreset = () => {
    if (presetName.trim()) {
      onSavePreset({ name: presetName, filters });
      setPresetName("");
      setShowSavePreset(false);
    }
  };

  const activeFiltersCount = filterConfig.filter(config => {
    const value = filters[config.key];
    return value && value !== '' && value !== 'all' && value !== config.defaultValue;
  }).length;

  return (
    <Card className="border-0 shadow-xl bg-white dark:bg-slate-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Búsqueda Avanzada</CardTitle>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFiltersCount} filtro{activeFiltersCount !== 1 ? 's' : ''} activo{activeFiltersCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {savedPresets.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    Filtros Guardados
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 bg-white dark:bg-slate-800">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Filtros Predefinidos</h4>
                    {savedPresets.map((preset, index) => (
                      <div key={index} className="flex items-center justify-between p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                        <button
                          onClick={() => onLoadPreset(preset.filters)}
                          className="flex-1 text-left text-sm"
                        >
                          {preset.name}
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeletePreset(index)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? 'Ocultar' : 'Mostrar'} Filtros
            </Button>
          </div>
        </div>
      </CardHeader>

      {showAdvanced && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filterConfig.map((config) => {
              if (config.type === 'text') {
                return (
                  <div key={config.key} className="space-y-2">
                    <Label>{config.label}</Label>
                    <Input
                      placeholder={config.placeholder}
                      value={filters[config.key] || ''}
                      onChange={(e) => handleFilterChange(config.key, e.target.value)}
                      className="bg-white dark:bg-slate-800"
                    />
                  </div>
                );
              }

              if (config.type === 'select') {
                return (
                  <div key={config.key} className="space-y-2">
                    <Label>{config.label}</Label>
                    <Select
                      value={filters[config.key] || config.defaultValue || ''}
                      onValueChange={(value) => handleFilterChange(config.key, value)}
                    >
                      <SelectTrigger className="bg-white dark:bg-slate-800">
                        <SelectValue placeholder={config.placeholder} />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-800">
                        {config.options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              }

              if (config.type === 'date') {
                return (
                  <div key={config.key} className="space-y-2">
                    <Label>{config.label}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start bg-white dark:bg-slate-800">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filters[config.key] ? format(filters[config.key], 'PPP', { locale: es }) : config.placeholder}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-white dark:bg-slate-800">
                        <Calendar
                          mode="single"
                          selected={filters[config.key]}
                          onSelect={(date) => handleFilterChange(config.key, date)}
                          locale={es}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                );
              }

              if (config.type === 'number') {
                return (
                  <div key={config.key} className="space-y-2">
                    <Label>{config.label}</Label>
                    <Input
                      type="number"
                      placeholder={config.placeholder}
                      value={filters[config.key] || ''}
                      onChange={(e) => handleFilterChange(config.key, e.target.value)}
                      min={config.min}
                      max={config.max}
                      className="bg-white dark:bg-slate-800"
                    />
                  </div>
                );
              }

              return null;
            })}
          </div>

          <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
            {activeFiltersCount > 0 && (
              <Button variant="outline" onClick={handleClearFilters}>
                Limpiar Filtros
              </Button>
            )}
            {!showSavePreset ? (
              <Button variant="outline" onClick={() => setShowSavePreset(true)}>
                <Save className="w-4 h-4 mr-2" />
                Guardar Filtros
              </Button>
            ) : (
              <div className="flex gap-2 flex-1">
                <Input
                  placeholder="Nombre del filtro..."
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  className="flex-1 bg-white dark:bg-slate-800"
                />
                <Button onClick={handleSavePreset}>Guardar</Button>
                <Button variant="outline" onClick={() => setShowSavePreset(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}