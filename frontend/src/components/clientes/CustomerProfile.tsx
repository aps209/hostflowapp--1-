import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Mail, Phone, Calendar, DollarSign, TrendingUp, Clock, MapPin, Utensils } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import LoyaltyBadge from "./LoyaltyBadge";

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

const statusColors = {
  confirmada: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
  pendiente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
  sentada: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
  completada: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
  cancelada: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
  no_show: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
};

export default function CustomerProfile({ customer, reservations = [], allTags = [], onClose, onEdit }) {
  const customerTags = (customer.tags || [])
    .map(tagName => allTags.find(tag => tag.nombre === tagName))
    .filter(Boolean);

  const completedReservations = reservations.filter(r => r.estado === 'completada');
  const totalSpent = completedReservations.reduce((sum, r) => sum + (r.gasto_total || 0), 0);
  const avgSpent = completedReservations.length > 0 ? totalSpent / completedReservations.length : 0;

  // Últimas reservas (ordenadas por fecha descendente)
  const sortedReservations = [...reservations].sort((a, b) => {
    const dateA = parseISO(a.fecha);
    const dateB = parseISO(b.fecha);
    return dateB - dateA;
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 p-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
              {customer.nombre.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{customer.nombre}</h2>
                <LoyaltyBadge totalVisitas={customer.total_visitas || 0} />
              </div>
              {customerTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {customerTags.map((tag) => (
                    <Badge 
                      key={tag.id} 
                      style={{ backgroundColor: tag.color, color: getTextColor(tag.color) }} 
                      className="text-xs border-none"
                    >
                      {tag.nombre}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onEdit(customer)} size="sm">
              Editar
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Información de contacto */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Información de Contacto</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {customer.email && (
              <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                <Mail className="w-5 h-5 text-slate-400" />
                <span>{customer.email}</span>
              </div>
            )}
            {customer.telefono && (
              <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                <Phone className="w-5 h-5 text-slate-400" />
                <span>{customer.telefono}</span>
              </div>
            )}
          </div>
        </div>

        {/* Métricas clave */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Resumen</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-slate-200 dark:border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs">Total Visitas</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{customer.total_visitas || 0}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 dark:border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-1">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-xs">Gasto Total</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">€{totalSpent.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 dark:border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs">Ticket Medio</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">€{avgSpent.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 dark:border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs">Última Visita</span>
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {customer.ultima_visita ? format(parseISO(customer.ultima_visita), 'dd/MM/yyyy', { locale: es }) : '-'}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Preferencias y alergias */}
        {(customer.preferencias || customer.alergias) && (
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Preferencias y Alergias</h3>
            <div className="space-y-3">
              {customer.preferencias && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-blue-900 dark:text-blue-200">Preferencias</p>
                      <p className="text-sm text-blue-800 dark:text-blue-300">{customer.preferencias}</p>
                    </div>
                  </div>
                </div>
              )}
              {customer.alergias && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Utensils className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-red-900 dark:text-red-200">Alergias</p>
                      <p className="text-sm text-red-800 dark:text-red-300">{customer.alergias}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notas internas */}
        {customer.notas && (
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Notas Internas</h3>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 whitespace-pre-wrap">{customer.notas}</p>
            </div>
          </div>
        )}

        {/* Historial de reservas */}
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Historial de Reservas ({reservations.length})
          </h3>
          {sortedReservations.length === 0 ? (
            <Card className="border-slate-200 dark:border-slate-700">
              <CardContent className="p-8 text-center">
                <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400">No hay reservas registradas</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {sortedReservations.map((reservation) => (
                <Card key={reservation.id} className="border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {format(parseISO(reservation.fecha), 'dd MMM yyyy', { locale: es })}
                          </span>
                          <span className="text-slate-600 dark:text-slate-400">•</span>
                          <span className="text-slate-600 dark:text-slate-400">{reservation.hora}</span>
                          <Badge className={statusColors[reservation.estado] || 'bg-gray-100'}>
                            {reservation.estado}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-400">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span>Mesa {reservation.mesa_numero}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{reservation.comensales} personas</span>
                          </div>
                          {reservation.gasto_total > 0 && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-4 h-4" />
                              <span>€{reservation.gasto_total.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                        {reservation.notas && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 italic">
                            {reservation.notas}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {reservation.reservation_id}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}