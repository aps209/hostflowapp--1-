import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, X, Minimize, Maximize2, GripVertical } from "lucide-react";
import ReservationList from "../reservas/ReservationList";

export default function DraggableReservationPanel({
  reservations,
  onEdit,
  onDelete,
  onStatusChange,
  onClose,
  t,
  isMinimized,
  onToggleMinimize,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [position, setPosition] = useState({ x: window.innerWidth - 550, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef(null);

  const handleMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('input')) return;
    
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      const maxX = window.innerWidth - (isMinimized ? 60 : 500);
      const maxY = window.innerHeight - 100;
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, isMinimized]);

  const filteredReservations = reservations.filter(r => {
    const matchesSearch = r.cliente_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.reservation_id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.estado === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div
      ref={panelRef}
      className={`absolute bg-white dark:bg-slate-900 shadow-2xl border-2 border-purple-500 dark:border-purple-600 rounded-xl transition-all duration-200 flex flex-col ${
        isDragging ? 'cursor-grabbing' : ''
      } ${isMinimized ? 'w-16' : 'w-[500px]'}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        maxHeight: '85vh',
        zIndex: 100,
      }}
    >
      {isMinimized ? (
        <div className="h-full flex flex-col items-center py-4 gap-3">
          <div
            className="cursor-grab active:cursor-grabbing p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
            onMouseDown={handleMouseDown}
          >
            <GripVertical className="w-5 h-5 text-slate-400" />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMinimize}
            className="hover:bg-purple-100 dark:hover:bg-purple-900/30"
            title="Expandir panel"
          >
            <Maximize2 className="w-5 h-5 text-purple-600" />
          </Button>
          <div className="transform rotate-90 text-sm font-bold text-purple-600 dark:text-purple-400 whitespace-nowrap origin-center mt-8">
            RESERVAS
          </div>
        </div>
      ) : (
        <>
          <div
            className="flex-shrink-0 p-4 bg-gradient-to-r from-purple-600 to-purple-700 rounded-t-xl flex items-center justify-between cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
          >
            <div className="flex items-center gap-2">
              <GripVertical className="w-5 h-5 text-purple-200" />
              <h2 className="text-lg font-bold text-white">
                Reservas ({filteredReservations.length})
              </h2>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleMinimize}
                className="h-8 w-8 text-white hover:bg-purple-800"
                title="Minimizar panel"
              >
                <Minimize className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 text-white hover:bg-purple-800"
                title="Cerrar panel"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex-shrink-0 p-4 space-y-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Buscar reserva..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white text-sm h-9"
              />
            </div>
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
              <TabsList className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-full grid grid-cols-3 h-9">
                <TabsTrigger value="all" className="data-[state=active]:bg-purple-100 dark:data-[state=active]:bg-purple-900/50 data-[state=active]:text-purple-900 dark:data-[state=active]:text-purple-200 text-slate-700 dark:text-slate-300 text-xs px-2">Todas</TabsTrigger>
                <TabsTrigger value="confirmada" className="data-[state=active]:bg-purple-100 dark:data-[state=active]:bg-purple-900/50 data-[state=active]:text-purple-900 dark:data-[state=active]:text-purple-200 text-slate-700 dark:text-slate-300 text-xs px-2">Confirmadas</TabsTrigger>
                <TabsTrigger value="sentada" className="data-[state=active]:bg-purple-100 dark:data-[state=active]:bg-purple-900/50 data-[state=active]:text-purple-900 dark:data-[state=active]:text-purple-200 text-slate-700 dark:text-slate-300 text-xs px-2">Sentadas</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-black">
            <ReservationList
              reservations={filteredReservations}
              isLoading={false}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
              t={t}
            />
          </div>
        </>
      )}
    </div>
  );
}