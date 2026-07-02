import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Plus,
  Minus,
  Lock,
  Unlock,
  Hand,
  ZoomIn,
  ZoomOut,
  LocateFixed,
  Eye,
  EyeOff,
  Users,
  Settings,
  ChevronUp,
  Maximize2,
  Minimize2,
  Clock,
  Utensils,
  Moon,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react";

export default function MobileFloorplanControls({
  isLocked,
  onToggleLock,
  panMode,
  onTogglePan,
  hideEditButtons,
  onToggleEditButtons,
  showCustomerNames,
  onToggleCustomerNames,
  tableScale,
  onTableScaleChange,
  badgeScale,
  onBadgeScaleChange,
  onCenterView,
  onNewReservation,
  onNewTable,
  floorplanViewMode,
  onFloorplanViewModeChange,
  selectedDate,
  onDateChange,
  formatDateForDisplay,
  locale,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      {/* 🔥 MEJORADO: Floating Action Buttons - reducir espacio inferior */}
      <div className="fixed bottom-20 right-4 z-[60] flex flex-col gap-3 md:hidden">
        {/* Quick actions */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col gap-2"
        >
          <Button
            size="icon"
            onClick={onCenterView}
            className="h-12 w-12 rounded-full shadow-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-2 border-slate-200 dark:border-slate-700"
          >
            <LocateFixed className="w-5 h-5" />
          </Button>
        </motion.div>
      </div>

      {/* 🔥 MEJORADO: New Reservation FAB - reducir tamaño */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="fixed bottom-20 left-4 z-[60] md:hidden"
      >
        <Button
          onClick={onNewReservation}
          className="h-14 w-14 rounded-full shadow-2xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </motion.div>

      {/* 🔥 MEJORADO: Bottom Navigation Bar - más compacto */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-[60] md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Expandable controls */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-b border-slate-200 dark:border-slate-800 overflow-hidden"
            >
              <div className="p-3 space-y-2 max-h-[50vh] overflow-y-auto">
                {/* Selector de fecha */}
                <div className="space-y-2">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium px-1">
                    Fecha
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => {
                        const newDate = new Date(selectedDate);
                        newDate.setDate(newDate.getDate() - 1);
                        onDateChange(newDate);
                      }}
                      className="h-11 w-11"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="flex-1 h-11">
                          <Calendar className="w-4 h-4 mr-2" />
                          <span className="text-sm font-semibold">
                            {formatDateForDisplay ? formatDateForDisplay(selectedDate) : selectedDate.toLocaleDateString()}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <CalendarComponent
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => date && onDateChange(date)}
                          locale={locale}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => {
                        const newDate = new Date(selectedDate);
                        newDate.setDate(newDate.getDate() + 1);
                        onDateChange(newDate);
                      }}
                      className="h-11 w-11"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Lock/Unlock */}
                <Button
                  onClick={onToggleLock}
                  variant={isLocked ? "outline" : "default"}
                  className={`w-full h-11 ${
                    !isLocked && "bg-amber-600 hover:bg-amber-700 text-white"
                  }`}
                >
                  {isLocked ? (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      Bloqueado
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4 mr-2" />
                      Desbloqueado
                    </>
                  )}
                </Button>

                {/* Toggle buttons visibility */}
                <Button
                  onClick={onToggleEditButtons}
                  variant={hideEditButtons ? "default" : "outline"}
                  className={`w-full h-11 ${
                    hideEditButtons && "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {hideEditButtons ? (
                    <>
                      <EyeOff className="w-4 h-4 mr-2" />
                      Botones ocultos
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Ocultar botones
                    </>
                  )}
                </Button>

                {/* Toggle customer names */}
                <Button
                  onClick={onToggleCustomerNames}
                  variant={showCustomerNames ? "default" : "outline"}
                  className={`w-full h-11 ${
                    showCustomerNames && "bg-green-600 hover:bg-green-700 text-white"
                  }`}
                >
                  <Users className="w-4 h-4 mr-2" />
                  {showCustomerNames ? "Nombres visibles" : "Mostrar nombres"}
                </Button>

                {/* Floorplan View Mode */}
                <div className="space-y-2">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium px-1">
                    Vista del día
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      onClick={() => onFloorplanViewModeChange("all")}
                      variant={floorplanViewMode === "all" ? "default" : "outline"}
                      size="sm"
                      className={`h-9 ${
                        floorplanViewMode === "all" && "bg-blue-800 hover:bg-blue-700 text-white"
                      }`}
                    >
                      <Clock className="w-3 h-3 mr-1" />
                      <span className="text-xs">Todo</span>
                    </Button>
                    <Button
                      onClick={() => onFloorplanViewModeChange("lunch")}
                      variant={floorplanViewMode === "lunch" ? "default" : "outline"}
                      size="sm"
                      className={`h-9 ${
                        floorplanViewMode === "lunch" && "bg-amber-600 hover:bg-amber-700 text-white"
                      }`}
                    >
                      <Utensils className="w-3 h-3 mr-1" />
                      <span className="text-xs">Comida</span>
                    </Button>
                    <Button
                      onClick={() => onFloorplanViewModeChange("dinner")}
                      variant={floorplanViewMode === "dinner" ? "default" : "outline"}
                      size="sm"
                      className={`h-9 ${
                        floorplanViewMode === "dinner" && "bg-indigo-600 hover:bg-indigo-700 text-white"
                      }`}
                    >
                      <Moon className="w-3 h-3 mr-1" />
                      <span className="text-xs">Cena</span>
                    </Button>
                  </div>
                </div>

                {/* Table scale */}
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    onClick={() => onTableScaleChange(Math.max(tableScale - 0.1, 0.5))}
                    variant="outline"
                    className="h-9 w-9"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </Button>
                  <div className="flex-1 text-center text-xs text-slate-600 dark:text-slate-400">
                    Mesas: {(tableScale * 100).toFixed(0)}%
                  </div>
                  <Button
                    size="icon"
                    onClick={() => onTableScaleChange(Math.min(tableScale + 0.1, 2))}
                    variant="outline"
                    className="h-9 w-9"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Badge scale */}
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    onClick={() => onBadgeScaleChange(Math.max(badgeScale - 0.1, 0.5))}
                    variant="outline"
                    className="h-9 w-9"
                  >
                    <Clock className="w-3 h-3" />
                  </Button>
                  <div className="flex-1 text-center text-xs text-slate-600 dark:text-slate-400">
                    Horarios: {(badgeScale * 100).toFixed(0)}%
                  </div>
                  <Button
                    size="icon"
                    onClick={() => onBadgeScaleChange(Math.min(badgeScale + 0.1, 2))}
                    variant="outline"
                    className="h-9 w-9"
                  >
                    <Clock className="w-4 h-4" />
                  </Button>
                </div>

                {/* New table button */}
                {!isLocked && (
                  <Button
                    onClick={onNewTable}
                    variant="outline"
                    className="w-full h-11"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Mesa
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 🔥 MEJORADO: Main bar - más compacto */}
        <div className="px-4 py-3">
          <Button
            onClick={() => setIsExpanded(!isExpanded)}
            variant="outline"
            className="w-full h-11 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span className="text-sm">Controles</span>
            </div>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronUp className="w-4 h-4" />
            </motion.div>
          </Button>
        </div>
      </motion.div>
    </>
  );
}