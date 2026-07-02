import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Edit, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
import { useTranslation } from "../components/TranslationProvider";
import { useRestaurant } from "../components/RestaurantContext";

const colorPresets = [
  "#fecaca", "#fed7aa", "#fef08a", "#d9f99d", "#bfdbfe",
  "#e9d5ff", "#fbcfe8", "#bae6fd", "#a7f3d0", "#d1d5db"
];

function TagForm({ tag, onSubmit, onCancel, isLoading, t }) {
  const [formData, setFormData] = useState(tag || { nombre: "", color: colorPresets[0] });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900 mb-6">
      <CardHeader className="border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-900 dark:text-white">{tag ? t('tags.editTag') : t('tags.newTag')}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre" className="text-slate-900 dark:text-white">{t('tags.form.name')}</Label>
            <Input
              id="nombre"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder="Ej: VIP, Frecuente, Alérgico..."
              required
              className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-900 dark:text-white">{t('tags.form.color')}</Label>
            <div className="flex gap-2 flex-wrap">
              {colorPresets.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-8 h-8 rounded-full transition-all ${formData.color === color ? 'ring-2 ring-offset-2 ring-blue-800 dark:ring-blue-400' : ''}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel} className="dark:bg-slate-800 dark:text-white">
              {t('tags.form.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700">
              {isLoading ? t('tags.form.saving') : (tag ? t('tags.form.update') : t('tags.form.create'))}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function Tags() {
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [tagToDelete, setTagToDelete] = useState(null);

  const queryClient = useQueryClient();
  const { restaurantId, loading: loadingRestaurant } = useRestaurant();

  const { data: configs = [] } = useQuery({
    queryKey: ['restaurantConfig', restaurantId],
    queryFn: () => base44.entities.RestaurantConfig.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  const config = configs[0];
  const currentLang = config?.idioma || 'es';
  const { t } = useTranslation(currentLang);

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['tags', restaurantId],
    queryFn: () => base44.entities.Tag.filter({ restaurant_id: restaurantId }, '-created_date'),
    enabled: !!restaurantId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Tag.create({ ...data, restaurant_id: restaurantId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', restaurantId] });
      setShowForm(false);
      setEditingTag(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Tag.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', restaurantId] });
      setShowForm(false);
      setEditingTag(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Tag.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', restaurantId] });
      setTagToDelete(null);
    },
  });

  const handleSubmit = (data) => {
    if (editingTag) {
      updateMutation.mutate({ id: editingTag.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (tag) => {
    setEditingTag(tag);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleDeleteConfirm = () => {
    if (tagToDelete) {
      deleteMutation.mutate(tagToDelete);
    }
  };

  if (loadingRestaurant || !restaurantId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-600 dark:text-slate-400">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t('tags.title')}</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">{t('tags.subtitle')}</p>
        </div>
        <Button onClick={() => { setEditingTag(null); setShowForm(!showForm); }} className="bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 shadow-lg">
          <Plus className="w-4 h-4 mr-2" />
          {t('tags.newTag')}
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <TagForm
              tag={editingTag}
              onSubmit={handleSubmit}
              onCancel={() => { setShowForm(false); setEditingTag(null); }}
              isLoading={createMutation.isPending || updateMutation.isPending}
              t={t}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900">
        <CardHeader className="border-b border-slate-100 dark:border-slate-700">
          <CardTitle className="text-slate-900 dark:text-white">{t('tags.existingTags')}</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4">
            {isLoading && <p className="text-slate-500 dark:text-slate-400">{t('common.loading')}</p>}
            {tags.map(tag => (
              <div key={tag.id} className="flex items-center gap-2 group">
                <span className="font-medium px-3 py-1 rounded-full text-sm" style={{ backgroundColor: tag.color, color: '#1e293b' }}>
                  {tag.nombre}
                </span>
                <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                   <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => handleEdit(tag)}>
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-7 h-7 text-red-500 hover:text-red-600" onClick={() => setTagToDelete(tag.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      <AlertDialog open={!!tagToDelete} onOpenChange={(open) => !open && setTagToDelete(null)}>
        <AlertDialogContent className="bg-white dark:bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 dark:text-white">{t('common.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              {t('tags.deleteWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-slate-800 dark:text-white">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}