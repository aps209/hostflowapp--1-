import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

const getTextColor = (hexcolor) => {
  if (!hexcolor) return '#1e293b';
  hexcolor = hexcolor.replace("#", "");
  if (hexcolor.length === 3) {
    hexcolor = hexcolor[0] + hexcolor[0] + hexcolor[1] + hexcolor[1] + hexcolor[2] + hexcolor[2];
  }
  if (hexcolor.length !== 6) return '#1e293b';
  var r = parseInt(hexcolor.substr(0, 2), 16);
  var g = parseInt(hexcolor.substr(2, 2), 16);
  var b = parseInt(hexcolor.substr(4, 2), 16);
  var yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 160) ? '#1e293b' : '#ffffff';
};

export default function CustomerForm({ customer, allTags, onSubmit, onCancel, isLoading, t }) {
  const [formData, setFormData] = useState(customer || {
    nombre: "",
    email: "",
    telefono: "",
    preferencias: "",
    alergias: "",
    notas: "",
    tags: [],
  });

  useEffect(() => {
    if (customer) {
      setFormData(customer);
    } else {
      setFormData({
        nombre: "",
        email: "",
        telefono: "",
        preferencias: "",
        alergias: "",
        notas: "",
        tags: [],
      });
    }
  }, [customer]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleTagToggle = (tagName) => {
    const currentTags = formData.tags || [];
    const newTags = currentTags.includes(tagName)
      ? currentTags.filter(t => t !== tagName)
      : [...currentTags, tagName];
    setFormData({ ...formData, tags: newTags });
  };

  return (
    <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900">
      <CardHeader className="border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-900 dark:text-white">
            {customer ? t('customers.editCustomer') : t('customers.newCustomer')}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="nombre" className="text-slate-900 dark:text-white">{t('customers.form.name')} *</Label>
              <Input
                id="nombre"
                required
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder={t('customers.form.name')}
                className="text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-900 dark:text-white">{t('customers.form.email')}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder={t('customers.form.email')}
                className="text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono" className="text-slate-900 dark:text-white">{t('customers.form.phone')}</Label>
              <Input
                id="telefono"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                placeholder={t('customers.form.phone')}
                className="text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-900 dark:text-white">{t('customers.form.tags')}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start font-normal h-auto py-2 dark:bg-slate-800 dark:border-slate-700" type="button">
                  <div className="flex gap-2 flex-wrap items-center min-h-[1.5rem]">
                    {(formData.tags && formData.tags.length > 0) ? (
                      formData.tags.map(tagName => {
                        const tag = allTags.find(t => t.nombre === tagName);
                        return tag ? (
                          <Badge key={tag.id} style={{ backgroundColor: tag.color, color: getTextColor(tag.color) }} className="border-none text-xs h-auto py-1">
                            {tag.nombre}
                          </Badge>
                        ) : null;
                      })
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400">{t('customers.form.tags')}</span>
                    )}
                  </div>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 dark:bg-slate-800 dark:border-slate-700" align="start">
                 <div className="p-2 space-y-1">
                  {allTags.length > 0 ? (
                    allTags.map(tag => {
                      const isSelected = (formData.tags || []).includes(tag.nombre);
                      return (
                        <Button
                          key={tag.id}
                          variant="ghost"
                          className={`w-full justify-start dark:hover:bg-slate-700 ${isSelected ? 'font-bold' : ''}`}
                          onClick={() => handleTagToggle(tag.nombre)}
                          type="button"
                        >
                          <div className={`w-4 h-4 mr-2 rounded-sm flex items-center justify-center border ${isSelected ? 'border-transparent' : 'border-slate-300 dark:border-slate-600'}`} style={{ backgroundColor: isSelected ? tag.color : 'transparent' }}>
                            {isSelected && <Check className="w-3 h-3" style={{ color: getTextColor(tag.color) }} />}
                          </div>
                          <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: tag.color }} />
                          {tag.nombre}
                        </Button>
                      )
                    })
                  ) : (
                    <div className="p-2 text-sm text-slate-500 dark:text-slate-400">No hay etiquetas disponibles.</div>
                  )}
                 </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="preferencias" className="text-slate-900 dark:text-white">{t('customers.form.preferences')}</Label>
            <Textarea
              id="preferencias"
              value={formData.preferencias}
              onChange={(e) => setFormData({ ...formData, preferencias: e.target.value })}
              placeholder={t('customers.form.preferences')}
              rows={2}
              className="text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="alergias" className="text-slate-900 dark:text-white">{t('customers.form.allergies')}</Label>
            <Textarea
              id="alergias"
              value={formData.alergias}
              onChange={(e) => setFormData({ ...formData, alergias: e.target.value })}
              placeholder={t('customers.form.allergies')}
              rows={2}
              className="text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas" className="text-slate-900 dark:text-white">{t('customers.form.internalNotes')}</Label>
            <Textarea
              id="notas"
              value={formData.notas}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              placeholder={t('customers.form.internalNotes')}
              rows={3}
              className="text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading} className="text-slate-900 dark:bg-slate-800 dark:text-white">
              {t('customers.form.cancel')}
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              className="bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700"
            >
              {isLoading ? t('customers.form.saving') : (customer ? t('customers.form.update') : t('customers.form.create'))}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}