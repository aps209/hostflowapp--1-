import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Users, Link as LinkIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import ReservationQuickView from "./ReservationQuickView";

const MAP_CENTER = 1000;

export default function TableItem({
  table,
  isLocked,
  onMove,
  onEdit,
  onDelete,
  tableScale = 1,
  badgeScale = 1,
  panMode = false,
  zoom = 1,
  showJoinGroups = false,
  hideEditButtons = false,
  showCustomerNames = false, // 🔥 NUEVO
  joinedReservations = [],
  onReservationClick,
  onReservationStatusChange,
  floorplanColors = null,
  alertNoShowEnabled = false,
  currentDateTime = null,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({
    x: (table.posicion_x || 0) + MAP_CENTER,
    y: MAP_CENTER - (table.posicion_y || 0)
  });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [openReservationId, setOpenReservationId] = useState(null);
  const tableRef = useRef(null);

  useEffect(() => {
    setPosition({
      x: (table.posicion_x || 0) + MAP_CENTER,
      y: MAP_CENTER - (table.posicion_y || 0)
    });
  }, [table.posicion_x, table.posicion_y]);

  const handlePointerDown = (e) => {
    if (isLocked || panMode) return;
    if (e.button !== 0 && e.type !== 'touchstart') return;
    
    e.stopPropagation();
    setIsDragging(true);
    
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    
    setDragStart({
      x: clientX - position.x,
      y: clientY - position.y
    });
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e) => {
      const clientX = e.clientX || e.touches?.[0]?.clientX || dragStart.x + position.x;
      const clientY = e.clientY || e.touches?.[0]?.clientY || dragStart.y + position.y;
      
      const newX = clientX - dragStart.x;
      const newY = clientY - dragStart.y;
      
      setPosition({ x: newX, y: newY });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      
      const mapX = position.x - MAP_CENTER;
      const mapY = MAP_CENTER - position.y;
      
      onMove(table.id, mapX, mapY);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isDragging, dragStart, position, onMove, table.id]);

  const getTableDimensions = () => {
    const baseSize = 60;
    const scaledSize = baseSize * tableScale;
    
    if (table.forma === 'rectangular_horizontal') {
      return { width: scaledSize * 1.5, height: scaledSize * 0.8, borderRadius: '8px' };
    }
    if (table.forma === 'rectangular_vertical') {
      return { width: scaledSize * 0.8, height: scaledSize * 1.5, borderRadius: '8px' };
    }
    if (table.forma === 'redonda') {
      return { width: scaledSize, height: scaledSize, borderRadius: '50%' };
    }
    return { width: scaledSize, height: scaledSize, borderRadius: '12px' };
  };

  const dimensions = getTableDimensions();

  const getStateColor = (estado, customColorOverride = null) => {
    // 🔥 NUEVO: Si hay un color personalizado (de estado de reserva), usarlo
    if (customColorOverride) {
      const hex = customColorOverride.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      
      return {
        bg: `rgba(${r}, ${g}, ${b}, 0.15)`,
        bgDark: `rgba(${r}, ${g}, ${b}, 0.2)`,
        border: `rgba(${r}, ${g}, ${b}, 0.6)`,
        borderDark: `rgba(${r}, ${g}, ${b}, 0.7)`,
        text: `rgb(${Math.max(0, r - 80)}, ${Math.max(0, g - 80)}, ${Math.max(0, b - 80)})`,
        textDark: `rgb(${Math.min(255, r + 100)}, ${Math.min(255, g + 100)}, ${Math.min(255, b + 100)})`
      };
    }

    if (floorplanColors && floorplanColors[estado]) {
      const color = floorplanColors[estado];
      const hex = color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      
      return {
        bg: `rgba(${r}, ${g}, ${b}, 0.15)`,
        bgDark: `rgba(${r}, ${g}, ${b}, 0.2)`,
        border: `rgba(${r}, ${g}, ${b}, 0.6)`,
        borderDark: `rgba(${r}, ${g}, ${b}, 0.7)`,
        text: `rgb(${Math.max(0, r - 80)}, ${Math.max(0, g - 80)}, ${Math.max(0, b - 80)})`,
        textDark: `rgb(${Math.min(255, r + 100)}, ${Math.min(255, g + 100)}, ${Math.min(255, b + 100)})`
      };
    }
    
    const defaultColors = {
      libre: {
        bg: 'rgba(16, 185, 129, 0.15)',
        bgDark: 'rgba(16, 185, 129, 0.2)',
        border: 'rgba(16, 185, 129, 0.6)',
        borderDark: 'rgba(16, 185, 129, 0.7)',
        text: 'rgb(6, 78, 59)',
        textDark: 'rgb(209, 250, 229)'
      },
      reservada: {
        bg: 'rgba(245, 158, 11, 0.15)',
        bgDark: 'rgba(245, 158, 11, 0.2)',
        border: 'rgba(245, 158, 11, 0.6)',
        borderDark: 'rgba(245, 158, 11, 0.7)',
        text: 'rgb(120, 53, 15)',
        textDark: 'rgb(254, 243, 199)'
      },
      reservada_unida: {
        bg: 'rgba(249, 115, 22, 0.15)',
        bgDark: 'rgba(249, 115, 22, 0.2)',
        border: 'rgba(249, 115, 22, 0.6)',
        borderDark: 'rgba(249, 115, 22, 0.7)',
        text: 'rgb(124, 45, 18)',
        textDark: 'rgb(255, 237, 213)'
      },
      sentada: {
        bg: 'rgba(59, 130, 246, 0.15)',
        bgDark: 'rgba(59, 130, 246, 0.2)',
        border: 'rgba(59, 130, 246, 0.6)',
        borderDark: 'rgba(59, 130, 246, 0.7)',
        text: 'rgb(30, 58, 138)',
        textDark: 'rgb(219, 234, 254)'
      },
      no_disponible: {
        bg: 'rgba(239, 68, 68, 0.15)',
        bgDark: 'rgba(239, 68, 68, 0.2)',
        border: 'rgba(239, 68, 68, 0.6)',
        borderDark: 'rgba(239, 68, 68, 0.7)',
        text: 'rgb(127, 29, 29)',
        textDark: 'rgb(254, 202, 202)'
      },
      inactiva_permanente: {
        bg: 'rgba(100, 116, 139, 0.15)',
        bgDark: 'rgba(100, 116, 139, 0.25)',
        border: 'rgba(100, 116, 139, 0.6)',
        borderDark: 'rgba(100, 116, 139, 0.7)',
        text: 'rgb(51, 65, 85)',
        textDark: 'rgb(203, 213, 225)'
      }
    };
    
    return defaultColors[estado] || defaultColors.libre;
  };

  const reservationsForDay = table.reservationsForDay || [];
  const isInJoinedGroup = joinedReservations && joinedReservations.length > 0;

  const estadoVisual = table.estado || 'libre';
  const customColorToUse = table.customColor || null;

  // Usar color personalizado si está disponible
  const stateColor = getStateColor(estadoVisual, customColorToUse);

  const allReservationsForBadges = React.useMemo(() => {
    const reservationMap = new Map();
    
    joinedReservations.forEach(res => {
      if (res.mesas_unidas && res.mesas_unidas.length > 0) {
        reservationMap.set(res.id, { ...res, isJoined: true });
      }
    });
    
    reservationsForDay.forEach(res => {
      if (!reservationMap.has(res.id)) {
        reservationMap.set(res.id, { ...res, isJoined: false });
      }
    });
    
    return Array.from(reservationMap.values()).sort((a, b) => a.hora.localeCompare(b.hora));
  }, [joinedReservations, reservationsForDay]);

  const isPermanentlyInactive = table.isPermanentlyInactive || table.activa === false;

  const hasNoShowAlert = React.useMemo(() => {
    if (!alertNoShowEnabled || !currentDateTime || isPermanentlyInactive) return false;
    
    const now = new Date(currentDateTime);
    
    return allReservationsForBadges.some(res => {
      // Solo parpadear si está confirmada o pendiente (no sentada, no completada, no cancelada)
      if (res.estado !== 'confirmada' && res.estado !== 'pendiente') {
        return false;
      }
      
      const reservationDateTime = new Date(`${res.fecha}T${res.hora}:00`);
      
      // 🔥 Parpadear inmediatamente cuando pasa la hora de la reserva
      return now >= reservationDateTime;
    });
  }, [alertNoShowEnabled, currentDateTime, allReservationsForBadges, isPermanentlyInactive]);

  return (
    <div
      ref={tableRef}
      className={`absolute ${isLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} ${isDragging ? 'opacity-50' : ''} group`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -50%)',
        touchAction: 'none',
        zIndex: isDragging ? 1000 : 1,
      }}
      onPointerDown={handlePointerDown}
      onTouchStart={handlePointerDown}
    >
      <div className="relative">
        {!isPermanentlyInactive && showJoinGroups && table.join_group_ids && table.join_group_ids.length > 0 && (
          <div 
            className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-600 dark:bg-blue-500 text-white px-2 py-0.5 rounded-full text-[9px] font-semibold shadow-md whitespace-nowrap z-10 pointer-events-none"
            style={{
              transform: `translateX(-50%) scale(${Math.min(badgeScale, 1)})`,
              transformOrigin: 'center bottom',
            }}
          >
            Grupos: {table.join_group_ids.join(', ')}
          </div>
        )}

        {!isPermanentlyInactive && isInJoinedGroup && showJoinGroups && (
          <div 
            className="absolute -top-2 -right-2 bg-purple-600 dark:bg-purple-500 text-white p-1 rounded-full shadow-md z-10 pointer-events-none"
            style={{
              transform: `scale(${Math.min(badgeScale, 1)})`,
            }}
          >
            <LinkIcon className="w-3 h-3" />
          </div>
        )}

        <div
          className={`shadow-lg border-2 flex flex-col items-center justify-center font-bold transition-all ${!isLocked && 'hover:shadow-xl'} ${isPermanentlyInactive ? 'opacity-60' : ''} ${hasNoShowAlert ? 'animate-pulse-colors' : ''}`}
          style={{
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`,
            borderRadius: dimensions.borderRadius,
            fontSize: `${Math.max(12, 16 * tableScale)}px`,
            backgroundColor: stateColor.bg,
            borderColor: stateColor.border,
            color: stateColor.text
          }}
        >
          <style>{`
            @keyframes pulse-colors {
              0%, 100% { 
                opacity: 1;
                filter: brightness(1);
              }
              50% { 
                opacity: 0.6;
                filter: brightness(1.4);
              }
            }
            .animate-pulse-colors {
              animation: pulse-colors 1.5s ease-in-out infinite;
            }
          `}</style>

          <div className="text-center">
            <div className="font-bold text-lg">{table.numero}</div>
            <div className="flex items-center justify-center gap-1 text-xs opacity-70">
              <Users className="w-3 h-3" />
              <span>{table.capacidad}</span>
            </div>
            {isPermanentlyInactive && (
              <div className="text-[8px] mt-0.5 opacity-80">BLOQUEADA</div>
            )}
          </div>
          
          {!hideEditButtons && (
            <div className="absolute -bottom-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
              <Button
                size="icon"
                variant="secondary"
                className="h-6 w-6 rounded-full shadow-lg bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(table);
                }}
              >
                <Edit className="w-3 h-3" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="h-6 w-6 rounded-full shadow-lg bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950 text-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`¿Eliminar la mesa ${table.numero}?`)) {
                    onDelete(table.id);
                  }
                }}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>

        {/* 🔥 NUEVO: Mostrar badges con nombres O con horas según el toggle */}
        {!isPermanentlyInactive && allReservationsForBadges.length > 0 && (
          <div
            className="absolute -top-1 left-1/2 -translate-x-1/2 flex flex-col gap-1 z-50"
            style={{
              transform: `translateX(-50%) scale(${badgeScale})`,
              transformOrigin: 'center bottom',
            }}
          >
            {allReservationsForBadges.slice(0, 3).map((reservation, index) => (
              <Popover key={`${reservation.id}-${index}`} open={openReservationId === reservation.id} onOpenChange={(open) => setOpenReservationId(open ? reservation.id : null)}>
                <PopoverTrigger asChild>
                  <button
                    className={`${reservation.isJoined ? 'bg-purple-800 dark:bg-purple-700 border-purple-600' : 'bg-blue-900 dark:bg-blue-800 border-blue-700 dark:border-blue-600'} text-white px-2 py-0.5 rounded-full text-[10px] font-semibold shadow-lg whitespace-nowrap border flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity`}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    {reservation.isJoined && <LinkIcon className="w-2.5 h-2.5" />}
                    {/* 🔥 NUEVO: Mostrar nombre O hora según el toggle */}
                    {showCustomerNames 
                      ? `${reservation.cliente_nombre.split(' ')[0]} • ${reservation.comensales}p`
                      : `${reservation.hora} • ${reservation.comensales}p`
                    }
                  </button>
                </PopoverTrigger>
                <PopoverContent 
                  className="p-0 w-auto border-0 shadow-none" 
                  side="top" 
                  align="center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ReservationQuickView
                    reservation={reservation}
                    onClose={() => setOpenReservationId(null)}
                    onEdit={(res) => {
                      setOpenReservationId(null);
                      if (onReservationClick) {
                        onReservationClick(res);
                      }
                    }}
                    onStatusChange={(id, newStatus) => {
                      if (onReservationStatusChange) {
                        onReservationStatusChange(id, newStatus);
                      }
                      setOpenReservationId(null);
                    }}
                  />
                </PopoverContent>
              </Popover>
            ))}
            {allReservationsForBadges.length > 3 && (
              <div className="bg-slate-700 dark:bg-slate-600 text-white px-2 py-0.5 rounded-full text-[10px] font-semibold shadow-lg pointer-events-none">
                +{allReservationsForBadges.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}