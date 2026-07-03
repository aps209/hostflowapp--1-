import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [licenseKey, setLicenseKey] = useState('');
  const [licensePlan, setLicensePlan] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [ceoFullName, setCeoFullName] = useState('');
  const [ceoEmail, setCeoEmail] = useState('');
  const [ceoPassword, setCeoPassword] = useState('');
  const [ceoPin, setCeoPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateLicense = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await base44.auth.validateLicense(licenseKey.trim());
      setLicensePlan(result.plan);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Licencia invalida');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!licensePlan) {
      await validateLicense();
      return;
    }
    if (ceoPassword.length < 8) {
      setError('La contrasena debe tener al menos 8 caracteres');
      return;
    }
    if (!/^\d{4,12}$/.test(ceoPin)) {
      setError('El PIN debe tener entre 4 y 12 digitos');
      return;
    }

    setLoading(true);
    try {
      await register({
        license_key: licenseKey.trim(),
        company_name: companyName.trim(),
        ceo_full_name: ceoFullName.trim(),
        ceo_email: ceoEmail.trim(),
        ceo_password: ceoPassword,
        ceo_pin: ceoPin,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'No se pudo activar la licencia');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #C8E8FA 0%, #EDF8FF 60%, #C8E8FA 100%)' }}>
      <Card className="w-full max-w-lg border-slate-200 shadow-lg">
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#3498db]">
              <Utensils className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl text-slate-900">Activar licencia</CardTitle>
              <p className="text-sm text-slate-600">{licensePlan ? `Plan ${licensePlan}` : 'Introduce tu clave para crear la empresa'}</p>
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

            <div className="space-y-2">
              <Label htmlFor="license">Licencia</Label>
              <div className="flex gap-2">
                <Input id="license" value={licenseKey} onChange={(event) => setLicenseKey(event.target.value.toUpperCase())} required disabled={!!licensePlan} />
                {!licensePlan && (
                  <Button type="button" variant="outline" onClick={validateLicense} disabled={loading || !licenseKey.trim()}>
                    Validar
                  </Button>
                )}
              </div>
            </div>

            {licensePlan && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="company">Empresa/restaurante</Label>
                  <Input id="company" value={companyName} onChange={(event) => setCompanyName(event.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ceo">Nombre CEO</Label>
                  <Input id="ceo" value={ceoFullName} onChange={(event) => setCeoFullName(event.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email CEO</Label>
                  <Input id="email" type="email" value={ceoEmail} onChange={(event) => setCeoEmail(event.target.value)} required />
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="password">Contrasena</Label>
                    <Input id="password" type="password" value={ceoPassword} onChange={(event) => setCeoPassword(event.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pin">PIN privado</Label>
                    <Input id="pin" type="password" inputMode="numeric" value={ceoPin} onChange={(event) => setCeoPin(event.target.value.replace(/\D/g, '').slice(0, 12))} required />
                  </div>
                </div>
              </>
            )}

            <Button type="submit" className="w-full bg-[#3498db] hover:bg-[#2d86c1] text-white" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {licensePlan ? 'Crear empresa y CEO' : 'Validar licencia'}
            </Button>
          </form>

          <div className="mt-6 text-sm text-center text-slate-600">
            Ya tienes cuenta?{' '}
            <Link to="/Login" className="font-medium text-[#1e3a8a] hover:underline">
              Entrar
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
