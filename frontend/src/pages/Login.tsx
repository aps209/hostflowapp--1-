import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, LockKeyhole, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/lib/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, verifyPin } = useAuth();
  const [email, setEmail] = useState('admin@hostflow.local');
  const [password, setPassword] = useState('Hostflow123!');
  const [pin, setPin] = useState('');
  const [temporaryToken, setTemporaryToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const params = new URLSearchParams(location.search);
  const returnTo = params.get('returnTo') || '/';
  const isPinStep = !!temporaryToken;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isPinStep) {
        await verifyPin(temporaryToken, pin);
        navigate(returnTo, { replace: true });
        return;
      }

      const result = await login(email.trim(), password);
      if (result?.requires_pin) {
        setTemporaryToken(result.temporary_token);
        setPin('');
        return;
      }
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'No se pudo iniciar sesion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #C8E8FA 0%, #EDF8FF 60%, #C8E8FA 100%)' }}>
      <Card className="w-full max-w-md border-slate-200 shadow-lg">
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#3498db]">
              {isPinStep ? <LockKeyhole className="w-5 h-5 text-white" /> : <Utensils className="w-5 h-5 text-white" />}
            </div>
            <div>
              <CardTitle className="text-2xl text-slate-900">HostFlow</CardTitle>
              <p className="text-sm text-slate-600">{isPinStep ? 'Introduce tu PIN' : 'Accede a tu restaurante'}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!isPinStep ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Contrasena</Label>
                  <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="pin">PIN privado</Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 12))}
                  autoComplete="one-time-code"
                  required
                />
              </div>
            )}

            <Button type="submit" className="w-full bg-[#3498db] hover:bg-[#2d86c1] text-white" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isPinStep ? 'Verificar PIN' : 'Continuar'}
            </Button>
          </form>

          {!isPinStep && (
            <div className="mt-6 text-sm text-center text-slate-600">
              Tienes una licencia?{' '}
              <Link to="/Register" className="font-medium text-[#1e3a8a] hover:underline">
                Activarla
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
