import React, { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Loader2, ScanLine, Trash2, Upload, Utensils, X } from "lucide-react";
import { toast } from "sonner";
import { useRestaurant } from "../RestaurantContext";

const CATEGORIES = ["entrantes", "principales", "postres", "bebidas", "vinos", "cafes", "otros"];

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve({ image_base64: base64, mime_type: file.type || "image/jpeg", preview: result });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function MenuScanner() {
  const queryClient = useQueryClient();
  const { restaurantId } = useRestaurant();
  const fileInputRef = useRef(null);

  const [images, setImages] = useState([]);
  const [rows, setRows] = useState(null);
  const [excluded, setExcluded] = useState({});
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);

  const scanMenu = useMutation({
    mutationFn: () => base44.menu.scan(images.map(({ image_base64, mime_type }) => ({ image_base64, mime_type }))),
    onSuccess: (data) => {
      setError(null);
      setRows(data.rows.map((row) => ({ ...row })));
      setExcluded({});
      toast.success(`Detectados ${data.summary?.detected || 0} platos (${data.summary?.new || 0} nuevos)`);
    },
    onError: (err) => {
      const detail = err?.data?.detail || err?.message || "No se pudo leer la carta";
      setError(detail);
      toast.error(detail);
    },
  });

  const applyMenu = useMutation({
    mutationFn: () => {
      const dishes = rows
        .filter((_row, index) => !excluded[index])
        .map(({ nombre, precio, categoria }) => ({ nombre, precio: Number(precio), categoria }));
      return base44.menu.apply(dishes);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products", restaurantId] });
      setRows(null);
      setImages([]);
      setExcluded({});
      toast.success(`${data.created} platos añadidos${data.skipped ? `, ${data.skipped} ya existían` : ""}`);
    },
    onError: () => toast.error("No se pudieron añadir los platos"),
  });

  const addFiles = async (files) => {
    const list = Array.from(files || []).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    setError(null);
    const loaded = await Promise.all(list.map(fileToImage));
    setImages((current) => [...current, ...loaded].slice(0, 8));
  };

  const updateRow = (index, field, value) => {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const includedCount = rows ? rows.filter((_row, index) => !excluded[index]).length : 0;

  return (
    <Card className="border-0 shadow-xl bg-white dark:bg-slate-900">
      <CardHeader className="border-b border-slate-100 dark:border-slate-700">
        <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
          <ScanLine className="h-5 w-5" />
          Lector de carta
        </CardTitle>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Sube una o varias fotos de tu carta y la IA detecta los platos (nombre y precio) y los añade a Pedidos.
        </p>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        {!rows && (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => { e.preventDefault(); setDragActive(false); addFiles(e.dataTransfer.files); }}
              className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                dragActive ? "border-slate-500 bg-slate-50 dark:bg-slate-800/40" : "border-slate-300 dark:border-slate-700"
              }`}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <Upload className="h-5 w-5 text-slate-600 dark:text-slate-300" />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Arrastra las fotos de la carta o selecciónalas</p>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Utensils className="mr-2 h-4 w-4" /> Añadir imágenes
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
            </div>

            {images.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {images.map((img, index) => (
                  <div key={index} className="relative">
                    <img src={img.preview} alt="" className="h-20 w-20 rounded-lg border border-slate-200 object-cover dark:border-slate-700" />
                    <button
                      onClick={() => setImages((current) => current.filter((_, i) => i !== index))}
                      className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </p>
            )}

            <Button className="w-full" disabled={images.length === 0 || scanMenu.isPending} onClick={() => scanMenu.mutate()}>
              {scanMenu.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
              {scanMenu.isPending ? "Leyendo la carta..." : `Detectar platos (${images.length} ${images.length === 1 ? "imagen" : "imágenes"})`}
            </Button>
          </>
        )}

        {rows && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600 dark:text-slate-400">{rows.length} platos detectados · revisa y ajusta antes de añadir</p>
              <Button variant="ghost" size="sm" onClick={() => { setRows(null); }}>
                <X className="mr-1 h-4 w-4" /> Descartar
              </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-800 dark:bg-slate-800/40">
                    <th className="p-2"></th>
                    <th className="p-2 font-medium text-slate-500">Plato</th>
                    <th className="p-2 font-medium text-slate-500">Precio (€)</th>
                    <th className="p-2 font-medium text-slate-500">Categoría</th>
                    <th className="p-2 font-medium text-slate-500"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const off = !!excluded[index];
                    return (
                      <tr key={index} className={`border-b border-slate-100 dark:border-slate-800 ${off ? "opacity-40" : ""}`}>
                        <td className="p-2">
                          <input type="checkbox" className="h-4 w-4" checked={!off}
                            onChange={() => setExcluded((c) => ({ ...c, [index]: !c[index] }))} />
                        </td>
                        <td className="p-2">
                          <Input value={row.nombre} onChange={(e) => updateRow(index, "nombre", e.target.value)} className="h-8 min-w-[160px]" />
                          {row.exists && <Badge variant="outline" className="mt-1 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">ya existe</Badge>}
                        </td>
                        <td className="p-2">
                          <Input type="number" step="0.01" value={row.precio} onChange={(e) => updateRow(index, "precio", e.target.value)} className="h-8 w-24" />
                        </td>
                        <td className="p-2">
                          <Select value={row.categoria} onValueChange={(v) => updateRow(index, "categoria", v)}>
                            <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500"
                            onClick={() => setRows((c) => c.filter((_, i) => i !== index))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Button className="w-full" disabled={includedCount === 0 || applyMenu.isPending} onClick={() => applyMenu.mutate()}>
              <Check className="mr-2 h-4 w-4" />
              {applyMenu.isPending ? "Añadiendo..." : `Añadir ${includedCount} platos a Pedidos`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
