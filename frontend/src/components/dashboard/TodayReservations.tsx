import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users } from "lucide-react";
import { isToday } from "date-fns";

const statusColors = {
  confirmada: "bg-emerald-100 text-emerald-800 border-emerald-200",
  pendiente: "bg-amber-100 text-amber-800 border-amber-200",
  sentada: "bg-blue-100 text-blue-800 border-blue-200",
  completada: "bg-slate-100 text-slate-800 border-slate-200",
  cancelada: "bg-red-100 text-red-800 border-red-200",
  no_show: "bg-rose-100 text-rose-800 border-rose-200",
};

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

const isTimeInRange = (reservationTime, startTime, endTime) => {
  if (!startTime || !endTime) return true;

  const resTime = new Date(`1970-01-01T${reservationTime}:00`);
  const start = new Date(`1970-01-01T${startTime}:00`);
  const end = new Date(`1970-01-01T${endTime}:00`);

  if (start.getTime() > end.getTime()) {
    return resTime >= start || resTime <= end;
  } else {
    return resTime >= start && resTime <= end;
  }
};

export default function TodayReservations({ 
  reservations, 
  selectedDate, 
  customers = [], 
  allTags = [], 
  config = {}, 
  floorplanViewMode = "all" 
}) {
  const title = isToday(selectedDate) ? "Reservas de Hoy" : "Reservas del Día";

  const getCustomerTags = (clienteId) => {
    const customer = customers.find(c => c.id === clienteId);
    if (!customer || !customer.tags) return [];
    return customer.tags.map(tagName => allTags.find(t => t.nombre === tagName)).filter(Boolean);
  };

  const formatTableInfo = (reservation) => {
    if (reservation.mesas_numeros && reservation.mesas_numeros.length > 1) {
      return `Mesas ${reservation.mesas_numeros.join(', ')}`;
    } else if (reservation.mesa_numero) {
      return `Mesa ${reservation.mesa_numero}`;
    }
    return null;
  };

  // Filtrar reservas según el modo de vista
  let filteredReservations = reservations;
  if (floorplanViewMode === 'lunch') {
    filteredReservations = reservations.filter(r => 
      isTimeInRange(r.hora, config?.hora_inicio_comida, config?.hora_fin_comida)
    );
  } else if (floorplanViewMode === 'dinner') {
    filteredReservations = reservations.filter(r => 
      isTimeInRange(r.hora, config?.hora_inicio_cena, config?.hora_fin_cena)
    );
  }

  // Ordenar por hora (ascendente - horas tempranas arriba)
  const sortedReservations = [...filteredReservations].sort((a, b) => {
    return a.hora.localeCompare(b.hora);
  });

  return (
    <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900">
      <CardHeader className="border-b border-slate-100 dark:border-slate-700">
        <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
          <Clock className="w-5 h-5 text-blue-900 dark:text-blue-400" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-96 overflow-y-auto">
          {sortedReservations.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              No hay reservas para este {floorplanViewMode === 'lunch' ? 'servicio de comida' : floorplanViewMode === 'dinner' ? 'servicio de cena' : 'día'}
            </div>
          ) : (
            sortedReservations.map((reservation) => {
              const customerTags = getCustomerTags(reservation.cliente_id);
              const tableInfo = formatTableInfo(reservation);
              
              return (
                <div
                  key={reservation.id}
                  className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-900 to-blue-800 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">
                        {reservation.hora}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-slate-900 dark:text-white">{reservation.cliente_nombre}</p>
                          {reservation.reservation_id && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">({reservation.reservation_id})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <Users className="w-3 h-3" />
                          <span>{reservation.comensales} personas</span>
                          {tableInfo && (
                            <>
                              <span>•</span>
                              <span>{tableInfo}</span>
                            </>
                          )}
                        </div>
                        {customerTags.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {customerTags.map((tag) => (
                              <Badge
                                key={tag.id}
                                style={{ backgroundColor: tag.color, color: getTextColor(tag.color) }}
                                className="border-none text-xs h-auto py-0.5"
                              >
                                {tag.nombre}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge className={`${statusColors[reservation.estado]} border font-medium`}>
                      {reservation.estado}
                    </Badge>
                  </div>
                  {reservation.notas && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 ml-15">{reservation.notas}</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}