import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Forbidden() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-6 text-center space-y-4">
          <ShieldAlert className="w-10 h-10 mx-auto text-slate-500" />
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Acceso no permitido</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Tu licencia o rol no permite abrir este modulo.
            </p>
          </div>
          <Button asChild>
            <Link to="/Dashboard">Volver al dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
