
import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerTable({ customers, isLoading, onEdit, onDelete }) {
  if (isLoading) {
    return (
      <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white/80 backdrop-blur-sm p-6">
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (customers.length === 0) {
    return (
      <Card className="p-12 text-center border-0 shadow-xl shadow-slate-900/5 bg-white/80 backdrop-blur-sm">
        <p className="text-slate-500 text-lg">No se encontraron clientes</p>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white/80 backdrop-blur-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left font-semibold p-4 text-slate-900 dark:text-white">Nombre</th>
              <th className="text-left font-semibold p-4 text-slate-900 dark:text-white">Email</th>
              <th className="text-left font-semibold p-4 text-slate-900 dark:text-white">Teléfono</th>
              <th className="text-left font-semibold p-4 text-slate-900 dark:text-white">Tags</th>
              <th className="text-left font-semibold p-4 text-slate-900 dark:text-white">Visitas</th>
              <th className="text-left font-semibold p-4 text-slate-900 dark:text-white">Última Visita</th>
              <th className="text-right font-semibold p-4 text-slate-900 dark:text-white">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers.map((customer) => (
              <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors">
                {/* Nombre */}
                <td className="p-4">
                  <div className="font-medium text-slate-900">{customer.nombre}</div>
                </td>
                {/* Email */}
                <td className="p-4 text-slate-600">
                  {customer.email || '-'}
                </td>
                {/* Teléfono */}
                <td className="p-4 text-slate-600">
                  {customer.telefono || '-'}
                </td>
                {/* Tags */}
                <td className="p-4">
                  {customer.tags && customer.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {customer.tags.map((tag, i) => (
                        <span key={i} className="inline-block bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                {/* Visitas */}
                <td className="p-4 text-slate-600">
                  {customer.visits || '-'}
                </td>
                {/* Última Visita */}
                <td className="p-4 text-slate-600">
                  {customer.lastVisit ? new Date(customer.lastVisit).toLocaleDateString() : '-'}
                </td>
                {/* Acciones */}
                <td className="p-4">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(customer)}
                      className="hover:bg-blue-50 hover:border-blue-200"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDelete(customer.id)}
                      className="hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
