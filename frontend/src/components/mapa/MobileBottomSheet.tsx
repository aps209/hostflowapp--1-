import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X, Edit, Trash2, CheckCircle, Clock, Users, MapPin } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function MobileBottomSheet({ 
  isOpen, 
  onClose, 
  table, 
  reservation,
  onEdit,
  onDelete,
  onStatusChange,
  availableStatuses = []
}) {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[100] md:hidden"
            onClick={handleBackdropClick}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl z-[101] md:hidden max-h-[85vh] overflow-y-auto"
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
            </div>

            {/* Content */}
            <div className="p-6 pb-8">
              <div className="flex items-start justify-between mb-4">
                <div>
                  {table && (
                    <>
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Mesa {table.numero}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-sm text-slate-600 dark:text-slate-400">
                        <Users className="w-4 h-4" />
                        <span>Capacidad: {table.capacidad} personas</span>
                      </div>
                      {table.sala && (
                        <div className="flex items-center gap-2 mt-1 text-sm text-slate-600 dark:text-slate-400">
                          <MapPin className="w-4 h-4" />
                          <span>{table.sala}</span>
                        </div>
                      )}
                    </>
                  )}
                  {reservation && (
                    <>
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {reservation.cliente_nombre}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-sm text-slate-600 dark:text-slate-400">
                        <Clock className="w-4 h-4" />
                        <span>{reservation.hora} • {reservation.comensales} personas</span>
                      </div>
                    </>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-slate-500 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Reservation details */}
              {reservation && (
                <div className="space-y-4 mb-6">
                  {reservation.reservation_id && (
                    <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-700">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Código</span>
                      <span className="font-medium text-slate-900 dark:text-white">{reservation.reservation_id}</span>
                    </div>
                  )}
                  
                  {reservation.mesa_numero && (
                    <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-700">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Mesa</span>
                      <span className="font-medium text-slate-900 dark:text-white">{reservation.mesa_numero}</span>
                    </div>
                  )}

                  {reservation.notas && (
                    <div className="py-2 border-b border-slate-200 dark:border-slate-700">
                      <span className="text-sm text-slate-600 dark:text-slate-400 block mb-1">Notas</span>
                      <p className="text-sm text-slate-900 dark:text-white">{reservation.notas}</p>
                    </div>
                  )}

                  {/* Status selector */}
                  <div className="py-2">
                    <label className="text-sm text-slate-600 dark:text-slate-400 block mb-2">
                      Cambiar estado
                    </label>
                    <Select
                      value={reservation.estado}
                      onValueChange={(newStatus) => {
                        onStatusChange(reservation.id, newStatus);
                        onClose();
                      }}
                    >
                      <SelectTrigger className="w-full h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendiente">⏳ Pendiente</SelectItem>
                        <SelectItem value="confirmada">✅ Confirmada</SelectItem>
                        <SelectItem value="sentada">💺 Sentada</SelectItem>
                        <SelectItem value="completada">✔️ Completada</SelectItem>
                        <SelectItem value="cancelada">❌ Cancelada</SelectItem>
                        <SelectItem value="no_show">⚠️ No Show</SelectItem>
                        {availableStatuses.map((status) => (
                          <SelectItem key={status.key} value={status.key}>
                            {status.icon || '📌'} {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-3">
                {onEdit && (
                  <Button
                    onClick={() => {
                      onEdit(reservation || table);
                      onClose();
                    }}
                    className="w-full h-14 text-base bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Edit className="w-5 h-5 mr-2" />
                    Editar {reservation ? 'reserva' : 'mesa'}
                  </Button>
                )}

                {onDelete && (
                  <Button
                    onClick={() => {
                      if (confirm(`¿Eliminar ${reservation ? 'reserva' : 'mesa'}?`)) {
                        onDelete((reservation || table).id);
                        onClose();
                      }
                    }}
                    variant="outline"
                    className="w-full h-14 text-base border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-5 h-5 mr-2" />
                    Eliminar
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}