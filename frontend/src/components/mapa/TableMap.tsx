import React, { useState, useEffect, useRef, forwardRef } from "react";
import TableItem from "./TableItem";

const MAP_CENTER = 1000;

// Define constants for map dimensions and grid
const mapWidth = 2000;
const mapHeight = 2000;
const gridSize = 100; // Represents the spacing for grid lines when zoom is 1

const TableMap = forwardRef(({
  tables,
  zoom = 1,
  tableScale = 1,
  badgeScale = 1,
  isLocked,
  panMode = false,
  showGrid = true,
  showJoinGroups = false,
  hideEditButtons = false,
  showCustomerNames = false,
  onTableMove,
  onTableEdit,
  onTableDelete,
  onReservationClick,
  onReservationStatusChange,
  floorplanColors = null,
  alertNoShowEnabled = false,
  currentDateTime = null,
  onZoomChange,
  isMobile = false,
}, ref) => {
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const [processedTables, setProcessedTables] = useState([]);
  
  const [pinchStart, setPinchStart] = useState(null);
  const [initialZoom, setInitialZoom] = useState(1);

  useEffect(() => {
    if (ref && typeof ref === 'function') {
      ref(containerRef.current);
    } else if (ref) {
      ref.current = containerRef.current;
    }
  }, [ref]);

  useEffect(() => {
    const allReservationsWithJoins = [];
    const processedReservationIds = new Set();

    tables.forEach(table => {
      (table.reservationsForDay || []).forEach(reservation => {
        if (reservation.mesas_unidas && reservation.mesas_unidas.length > 0 && !processedReservationIds.has(reservation.id)) {
          allReservationsWithJoins.push(reservation);
          processedReservationIds.add(reservation.id);
        }
      });
    });

    const updatedTables = tables.map(table => {
      const tableJoinedReservations = allReservationsWithJoins.filter(reservation => {
        const allTableIdsForReservation = [reservation.mesa_id, ...(reservation.mesas_unidas || [])].filter(Boolean);
        return allTableIdsForReservation.includes(table.id);
      });
      return { ...table, joinedReservations: tableJoinedReservations };
    });

    setProcessedTables(updatedTables);
  }, [tables]);

  const handleTouchStart = (e) => {
    if (e.touches.length === 2 && !isMobile) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      setPinchStart(distance);
      setInitialZoom(zoom);
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsPanning(true);
      setPanStart({ x: touch.clientX, y: touch.clientY });
      setScrollStart({
        x: containerRef.current?.scrollLeft || 0,
        y: containerRef.current?.scrollTop || 0
      });
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && pinchStart !== null && !isMobile) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const scale = distance / pinchStart;
      const newZoom = Math.max(0.2, Math.min(2, initialZoom * scale));
      if (onZoomChange) {
        onZoomChange(newZoom);
      }
    } else if (e.touches.length === 1 && isPanning && containerRef.current) {
      e.preventDefault();
      const touch = e.touches[0];
      const dx = touch.clientX - panStart.x;
      const dy = touch.clientY - panStart.y;
      
      containerRef.current.scrollLeft = scrollStart.x - dx;
      containerRef.current.scrollTop = scrollStart.y - dy;
    }
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length < 2) {
      setPinchStart(null);
    }
    if (e.touches.length === 0) {
      setIsPanning(false);
    }
  };

  const handlePanStart = (e) => {
    if (!panMode) return;
    setIsPanning(true);

    if (e.type === 'touchstart' || e.button === 0) {
      e.preventDefault();
    }

    const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
    const clientY = e.clientY || e.touches?.[0]?.clientY || 0;

    setPanStart({ x: clientX, y: clientY });
    setScrollStart({
      x: containerRef.current?.scrollLeft || 0,
      y: containerRef.current?.scrollTop || 0
    });

    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    if (!isPanning || !containerRef.current) {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      return;
    }

    const handlePanMove = (e) => {
      if (e.cancelable) e.preventDefault();

      const clientX = e.clientX || e.touches?.[0]?.clientX || panStart.x;
      const clientY = e.clientY || e.touches?.[0]?.clientY || panStart.y;

      const dx = clientX - panStart.x;
      const dy = clientY - panStart.y;

      containerRef.current.scrollLeft = scrollStart.x - dx;
      containerRef.current.scrollTop = scrollStart.y - dy;
    };

    const handlePanEnd = () => {
      setIsPanning(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('pointermove', handlePanMove);
    window.addEventListener('pointerup', handlePanEnd);
    window.addEventListener('pointercancel', handlePanEnd);
    window.addEventListener('touchmove', handlePanMove, { passive: false });
    window.addEventListener('touchend', handlePanEnd);

    return () => {
      window.removeEventListener('pointermove', handlePanMove);
      window.removeEventListener('pointerup', handlePanEnd);
      window.removeEventListener('pointercancel', handlePanEnd);
      window.removeEventListener('touchmove', handlePanMove);
      window.removeEventListener('touchend', handlePanEnd);
    };
  }, [isPanning, panStart, scrollStart]);

  const getTableCenter = (table) => {
    return {
      x: (table.posicion_x || 0) + MAP_CENTER,
      y: MAP_CENTER - (table.posicion_y || 0)
    };
  };

  const analyzeTableGeometry = (tableIds, tables) => {
    const tablePositions = tableIds.map(id => {
      const table = tables.find(t => t.id === id);
      if (!table) return null;
      return {
        id,
        x: table.posicion_x || 0,
        y: table.posicion_y || 0,
        numero: table.numero
      };
    }).filter(Boolean).sort((a, b) => {
      if (Math.abs(a.y - b.y) < 50) {
        return a.x - b.x;
      }
      return a.y - b.y;
    });

    if (tablePositions.length < 2) return null;

    const isHorizontal = tablePositions.every((t, i, arr) => i === 0 || Math.abs(t.y - arr[0].y) < 50);
    const isVertical = tablePositions.every((t, i, arr) => i === 0 || Math.abs(t.x - arr[0].x) < 50);

    if (isHorizontal) return { type: 'horizontal', tables: tablePositions };
    if (isVertical) return { type: 'vertical', tables: tablePositions };

    if (tablePositions.length === 3) {
      const sortedX = [...tablePositions].sort((a, b) => a.x - b.x || a.y - b.y);
      const sortedY = [...tablePositions].sort((a, b) => a.y - b.y || a.x - b.x);

      const isLShape =
        (Math.abs(sortedX[0].x - sortedX[1].x) < 50 && Math.abs(sortedY[0].y - sortedY[1].y) < 50 && Math.abs(sortedX[0].x - sortedX[2].x) > 50 && Math.abs(sortedY[0].y - sortedY[2].y) > 50) ||
        (Math.abs(sortedX[1].x - sortedX[2].x) < 50 && Math.abs(sortedY[1].y - sortedY[2].y) < 50 && Math.abs(sortedX[0].x - sortedX[2].x) > 50 && Math.abs(sortedY[0].y - sortedY[2].y) > 50) ||
        (Math.abs(sortedX[0].x - sortedX[2].x) < 50 && Math.abs(sortedY[0].y - sortedY[2].y) < 50 && Math.abs(sortedX[0].x - sortedX[1].x) > 50 && Math.abs(sortedY[0].y - sortedY[1].y) > 50);

      if (isLShape) return { type: 'L-shape', tables: tablePositions };
    }

    return { type: 'irregular', tables: tablePositions };
  };


  const renderTableConnections = () => {
    if (!showJoinGroups) return null;

    const connections = [];
    const processedReservations = new Set();

    processedTables.forEach(table => {
      (table.joinedReservations || []).forEach(reservation => {
        if (!reservation.mesas_unidas || reservation.mesas_unidas.length === 0) return;
        if (processedReservations.has(reservation.id)) return;

        processedReservations.add(reservation.id);

        const allTableIds = [reservation.mesa_id, ...reservation.mesas_unidas];
        const geometry = analyzeTableGeometry(allTableIds, processedTables);

        if (!geometry || geometry.tables.length < 2) return;

        const tablePoints = geometry.tables.map(t => getTableCenter(processedTables.find(pt => pt.id === t.id)));

        tablePoints.sort((a, b) => {
          if (Math.abs(a.y - b.y) < 50) return a.x - b.x;
          return a.y - b.y;
        });


        for (let i = 0; i < tablePoints.length - 1; i++) {
          const p1 = tablePoints[i];
          const p2 = tablePoints[i + 1];

          connections.push(
            <line
              key={`line-${reservation.id}-${i}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="#9333ea"
              strokeWidth={5 / zoom}
              opacity="0.8"
              strokeLinecap="round"
              strokeDasharray={geometry.type === 'irregular' ? (10 / zoom) + ' ' + (5 / zoom) : ''}
              className="pointer-events-none"
            />
          );
        }

        tablePoints.forEach((p, index) => {
          connections.push(
            <circle
              key={`circle-${reservation.id}-${index}`}
              cx={p.x}
              cy={p.y}
              r={10 / zoom}
              fill="#9333ea"
              opacity="0.9"
              className="pointer-events-none"
            />,
            <text
              key={`text-${reservation.id}-${index}`}
              x={p.x}
              y={p.y}
              fill="white"
              fontSize={12 / zoom}
              textAnchor="middle"
              dominantBaseline="middle"
              fontWeight="bold"
              className="pointer-events-none"
            >
              {index + 1}
            </text>
          );
        });
      });
    });

    return connections;
  };

  const handlers = {
    onMouseDown: handlePanStart,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full overflow-auto touch-manipulation"
      style={{ 
        WebkitOverflowScrolling: 'touch',
        overflowX: 'scroll',
        overflowY: 'scroll',
      }}
      {...handlers}
    >
      <style>{`
        .overflow-auto::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        @media (max-width: 767px) {
          .overflow-auto::-webkit-scrollbar {
            display: none;
          }
        }
        .overflow-auto::-webkit-scrollbar-track {
          background: #1e293b;
        }
        .overflow-auto::-webkit-scrollbar-thumb {
          background: #64748b;
          border-radius: 5px;
        }
        .overflow-auto::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
      <div
        className="relative"
        style={{
          width: `${mapWidth * zoom}px`,
          height: `${mapHeight * zoom}px`,
          minWidth: `${mapWidth * zoom}px`,
          minHeight: `${mapHeight * zoom}px`,
          backgroundImage: showGrid
            ? `repeating-linear-gradient(0deg, rgba(148, 163, 184, 0.1) 0px, rgba(148, 163, 184, 0.1) 1px, transparent 1px, transparent ${gridSize * zoom}px),
               repeating-linear-gradient(90deg, rgba(148, 163, 184, 0.1) 0px, rgba(148, 163, 184, 0.1) 1px, transparent 1px, transparent ${gridSize * zoom}px)`
            : 'none',
          backgroundSize: `${gridSize * zoom}px ${gridSize * zoom}px`,
          backgroundPosition: `${gridSize * zoom / 2}px ${gridSize * zoom / 2}px`,
        }}
      >
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{
            width: `${mapWidth}px`,
            height: `${mapHeight}px`,
            zIndex: 0,
          }}
        >
          {renderTableConnections()}
        </svg>

        {processedTables.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 pointer-events-none">
            <div className="text-6xl mb-4">🪑</div>
            <p className="text-xl font-semibold">No hay mesas configuradas</p>
            <p className="text-sm mt-2">Haz clic en "Nueva Mesa" para empezar</p>
            <div className="mt-6 max-w-md text-center">
              <p className="text-xs">💡 <strong>Tip:</strong> Haz clic en "Desbloquear" en la barra superior para poder mover las mesas</p>
            </div>
          </div>
        )}

        {processedTables.map(table => (
          <TableItem
            key={table.id}
            table={table}
            isLocked={isLocked}
            onMove={onTableMove}
            onEdit={onTableEdit}
            onDelete={onTableDelete}
            tableScale={tableScale}
            badgeScale={badgeScale}
            panMode={panMode}
            zoom={zoom}
            showJoinGroups={showJoinGroups}
            hideEditButtons={hideEditButtons}
            showCustomerNames={showCustomerNames}
            joinedReservations={table.joinedReservations || []}
            onReservationClick={onReservationClick}
            onReservationStatusChange={onReservationStatusChange}
            floorplanColors={floorplanColors}
            alertNoShowEnabled={alertNoShowEnabled}
            currentDateTime={currentDateTime}
          />
        ))}
      </div>
    </div>
  );
});

TableMap.displayName = 'TableMap';

export default TableMap;