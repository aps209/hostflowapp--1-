import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Calendar, Clock, Users, Loader2, AlertCircle, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function FormularioGestionReserva() {
  const [step, setStep] = useState('search');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [reservationId, setReservationId] = useState('');
  const [email, setEmail] = useState('');
  const [reservation, setReservation] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [restaurantSlug, setRestaurantSlug] = useState(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('restaurant');
    if (slug) {
      setRestaurantSlug(slug);
    }
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await base44.functions.invoke('consultarReserva', {
        reservation_id: reservationId.trim(),
        cliente_email: email.trim(),
        restaurant_slug: restaurantSlug
      });

      if (response.data.success) {
        setReservation(response.data.reservation);
        setRestaurant(response.data.restaurant);
        setStep('view');
      } else {
        // Verificar si hay información del restaurante correcto
        if (response.data.correctRestaurantSlug && response.data.correctRestaurantName) {
          const correctUrl = `https://preview--hostflowapp.base44.app/FormularioGestionReserva?restaurant=${response.data.correctRestaurantSlug}`;
          setError(
            <div className="space-y-3">
              <p>Esta reserva pertenece a <strong>{response.data.correctRestaurantName}</strong>.</p>
              <a 
                href={correctUrl}
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Ir al formulario de {response.data.correctRestaurantName}
              </a>
            </div>
          );
        } else {
          setError(response.data.error || 'No se encontró la reserva');
        }
      }
    } catch (err) {
      console.error('Error searching reservation:', err);
      // Capturar el mensaje de error específico del backend
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err.response?.status === 404) {
        setError('No se encontró ninguna reserva con ese código');
      } else if (err.response?.status === 403) {
        // Verificar si hay información del restaurante correcto
        if (err.response?.data?.correctRestaurantSlug && err.response?.data?.correctRestaurantName) {
          const correctUrl = `https://preview--hostflowapp.base44.app/FormularioGestionReserva?restaurant=${err.response.data.correctRestaurantSlug}`;
          setError(
            <div className="space-y-3">
              <p>Esta reserva pertenece a <strong>{err.response.data.correctRestaurantName}</strong>.</p>
              <a 
                href={correctUrl}
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Ir al formulario de {err.response.data.correctRestaurantName}
              </a>
            </div>
          );
        } else {
          setError('El email no coincide con la reserva o esta reserva no pertenece a este restaurante');
        }
      } else {
        setError('Error al buscar la reserva. Verifica que el código y el email sean correctos.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action) => {
    setProcessing(true);
    setError(null);

    try {
      const response = await base44.functions.invoke('consultarReserva', {
        reservation_id: reservationId.trim(),
        cliente_email: email.trim(),
        action: action,
        restaurant_slug: restaurantSlug
      });

      if (response.data.success) {
        setSuccessMessage(response.data.message);
        setReservation(response.data.reservation);
        setStep('success');
      } else {
        setError(response.data.error || 'Error al procesar la acción');
      }
    } catch (err) {
      console.error('Error processing action:', err);
      // Capturar el mensaje de error específico del backend
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Error al procesar la solicitud. Intenta nuevamente.');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setStep('search');
    setReservationId('');
    setEmail('');
    setReservation(null);
    setRestaurant(null);
    setError(null);
    setSuccessMessage(null);
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-green-200">
          <CardContent className="p-12 text-center">
            <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-4">¡Perfecto!</h2>
            <p className="text-slate-600 mb-6">{successMessage}</p>
            {restaurant?.website && (
              <Button
                onClick={() => window.location.href = restaurant.website}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 mb-2 w-full"
              >
                Volver al sitio web
              </Button>
            )}
            <Button
              onClick={handleReset}
              variant="outline"
              className="w-full"
            >
              Consultar otra reserva
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'view' && reservation) {
    const fechaFormateada = format(parseISO(reservation.fecha), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
    
    // Permitir cancelación siempre que no esté ya cancelada o completada
    const canModify = reservation.estado !== 'cancelada' && reservation.estado !== 'completada';

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl shadow-2xl">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-8">
            {restaurant?.logo_url && (
              <img src={restaurant.logo_url} alt={restaurant.nombre} className="h-12 mb-4 object-contain" />
            )}
            <CardTitle className="text-3xl font-bold">{restaurant?.nombre || 'Tu Reserva'}</CardTitle>
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

            {/* Botón de cancelar: solo si NO está cancelada ni completada */}
            {canModify && (
              <div className="space-y-3 mb-4">
                <Button
                  onClick={() => handleAction('cancelar')}
                  disabled={processing}
                  variant="destructive"
                  className="w-full bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 py-6 text-lg"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Cancelando...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 mr-2" />
                      Cancelar Reserva
                    </>
                  )}
                </Button>
              </div>
            )}

            {!canModify && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center mb-4">
                <p className="text-blue-900 text-sm">
                  {reservation.estado === 'cancelada' 
                    ? 'Esta reserva ha sido cancelada.'
                    : 'Esta reserva ya ha sido completada.'}
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-red-900 text-sm">{error}</p>
                </div>
              </div>
            )}

            <Button
              onClick={handleReset}
              variant="outline"
              className="w-full"
            >
              Volver al formulario
            </Button>

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-8">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold text-center">Gestiona tu Reserva</CardTitle>
          <p className="text-blue-100 text-center mt-2">
            {restaurantSlug ? `Restaurante: ${restaurantSlug}` : 'Ingresa los datos de tu reserva'}
          </p>
        </CardHeader>

        <CardContent className="p-8">
          <form onSubmit={handleSearch} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="reservation_id" className="text-slate-900 font-medium">
                Código de Reserva
              </Label>
              <Input
                id="reservation_id"
                type="text"
                value={reservationId}
                onChange={(e) => setReservationId(e.target.value)}
                placeholder="Ej: R-2025-0001"
                required
                className="h-12 text-base"
              />
              <p className="text-xs text-slate-500">
                El código aparece en tu email de confirmación
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-900 font-medium">
                Email de Confirmación
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="h-12 text-base"
              />
              <p className="text-xs text-slate-500">
                El email que usaste al hacer la reserva
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="text-red-900 text-sm">{error}</div>
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 h-12 text-base font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5 mr-2" />
                  Buscar Reserva
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-xs text-slate-500 text-center">
              Si tienes problemas para encontrar tu reserva, contacta con el restaurante directamente.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}