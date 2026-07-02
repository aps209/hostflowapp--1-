import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Calendar, Clock, Users, Loader2, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ConfirmarReserva() {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [reservation, setReservation] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [action, setAction] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const loadReservation = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = urlParams.get('token');
        const urlAction = urlParams.get('action');

        if (!urlToken) {
          setError('Token de reserva no encontrado');
          setLoading(false);
          return;
        }

        setToken(urlToken);
        setAction(urlAction);

        const response = await base44.functions.invoke('gestionarReservaPorToken', {
          token: urlToken
        });

        if (!response.data.success) {
          setError(response.data.error || 'Error al cargar la reserva');
          setLoading(false);
          return;
        }

        setReservation(response.data.reservation);
        setRestaurant(response.data.restaurant);
        
        // NUEVO: Si la acción es "cancelar", ejecutar automáticamente
        if (urlAction === 'cancelar' && response.data.reservation.estado !== 'cancelada') {
          setLoading(false);
          // Ejecutar cancelación automáticamente
          handleCancelAutomatic(urlToken);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading reservation:', err);
        setError('Error al cargar la reserva');
        setLoading(false);
      }
    };

    loadReservation();
  }, []);

  const handleCancelAutomatic = async (tokenToUse) => {
    setProcessing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const response = await base44.functions.invoke('gestionarReservaPorToken', {
        token: tokenToUse,
        action: 'cancelar'
      });

      if (response.data.success) {
        setSuccess(response.data.message);
        setReservation(response.data.reservation);
      } else {
        setError(response.data.error || 'Error al cancelar la reserva');
      }
    } catch (err) {
      console.error('Error canceling reservation:', err);
      setError('Error al cancelar la reserva. Por favor, contacta con el restaurante.');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirm = async () => {
    setProcessing(true);
    try {
      const response = await base44.functions.invoke('gestionarReservaPorToken', {
        token,
        action: 'confirmar'
      });

      if (response.data.success) {
        setSuccess(response.data.message);
        setReservation(response.data.reservation);
      } else {
        setError(response.data.error || 'Error al confirmar la reserva');
      }
    } catch (err) {
      console.error('Error confirming reservation:', err);
      setError('Error al confirmar la reserva. Por favor, contacta con el restaurante.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-12 text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-600 mb-4" />
            <p className="text-slate-600">Cargando reserva...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (processing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-12 text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-600 mb-4" />
            <p className="text-slate-600">Procesando cancelación...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200">
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Error</h2>
            <p className="text-slate-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-green-200">
          <CardContent className="p-12 text-center">
            <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-4">¡Perfecto!</h2>
            <p className="text-slate-600 mb-6">{success}</p>
            {restaurant?.website && (
              <Button
                onClick={() => window.location.href = restaurant.website}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                Volver al sitio web
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const fechaFormateada = format(parseISO(reservation.fecha), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
  const isPast = new Date(reservation.fecha) < new Date();
  const canModify = !isPast && reservation.estado !== 'cancelada' && reservation.estado !== 'completada';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-8">
          {restaurant?.logo_url && (
            <img src={restaurant.logo_url} alt={restaurant.nombre} className="h-12 mb-4 object-contain" />
          )}
          <CardTitle className="text-3xl font-bold">{restaurant?.nombre || 'Gestión de Reserva'}</CardTitle>
          <p className="text-blue-100 mt-2">Código: {reservation.reservation_id}</p>
        </CardHeader>

        <CardContent className="p-8">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-slate-900">Detalles de tu Reserva</h3>
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                reservation.estado === 'confirmada' ? 'bg-green-100 text-green-800' :
                reservation.estado === 'cancelada' ? 'bg-red-100 text-red-800' :
                reservation.estado === 'pendiente' ? 'bg-amber-100 text-amber-800' :
                'bg-slate-100 text-slate-800'
              }`}>
                {reservation.estado === 'confirmada' ? '✅ Confirmada' :
                 reservation.estado === 'cancelada' ? '❌ Cancelada' :
                 reservation.estado === 'pendiente' ? '⏳ Pendiente' :
                 reservation.estado}
              </span>
            </div>

            <div className="space-y-4 bg-slate-50 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-blue-600 mt-1" />
                <div>
                  <p className="text-sm text-slate-600">Fecha</p>
                  <p className="font-semibold text-slate-900">{fechaFormateada}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-600 mt-1" />
                <div>
                  <p className="text-sm text-slate-600">Hora</p>
                  <p className="font-semibold text-slate-900">{reservation.hora}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-blue-600 mt-1" />
                <div>
                  <p className="text-sm text-slate-600">Comensales</p>
                  <p className="font-semibold text-slate-900">{reservation.comensales} personas</p>
                </div>
              </div>

              {reservation.mesas_numeros && reservation.mesas_numeros.length > 0 && (
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-blue-600 text-white rounded flex items-center justify-center text-xs font-bold mt-1">
                    #
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Mesa{reservation.mesas_numeros.length > 1 ? 's' : ''}</p>
                    <p className="font-semibold text-slate-900">
                      {reservation.mesas_numeros.join(', ')}
                    </p>
                  </div>
                </div>
              )}

              {reservation.notas && (
                <div className="pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-600 mb-1">Notas</p>
                  <p className="text-slate-700 whitespace-pre-wrap">{reservation.notas}</p>
                </div>
              )}
            </div>
          </div>

          {canModify && action === 'confirmar' && reservation.estado === 'pendiente' && (
            <div className="space-y-3">
              <Button
                onClick={handleConfirm}
                disabled={processing}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-6 text-lg"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Confirmar Asistencia
                  </>
                )}
              </Button>
            </div>
          )}

          {!canModify && !action && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <p className="text-blue-900 text-sm">
                {reservation.estado === 'cancelada' 
                  ? 'Esta reserva ha sido cancelada.'
                  : reservation.estado === 'completada'
                  ? 'Esta reserva ya ha sido completada.'
                  : isPast
                  ? 'Esta reserva ya ha pasado.'
                  : 'Esta reserva ya está confirmada.'}
              </p>
            </div>
          )}

          {restaurant && (
            <div className="mt-8 pt-6 border-t border-slate-200 text-center">
              <p className="text-slate-600 text-sm mb-2">¿Necesitas ayuda?</p>
              {restaurant.telefono && (
                <p className="text-slate-900 font-medium">📞 {restaurant.telefono}</p>
              )}
              {restaurant.email && (
                <p className="text-slate-900 font-medium">✉️ {restaurant.email}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}