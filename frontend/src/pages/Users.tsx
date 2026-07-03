import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, UserX } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function Users() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ full_name: '', email: '', password: '', pin: '' });

  const { data: users = [], isLoading, isError } = useQuery({
    queryKey: ['tenant-users'],
    queryFn: () => base44.users.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => base44.users.create({ ...form, role: 'WORKER' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-users'] });
      setForm({ full_name: '', email: '', password: '', pin: '' });
      toast.success('Trabajador creado');
    },
    onError: (error) => toast.error(error?.data?.detail || 'No se pudo crear el usuario'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id) => base44.users.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-users'] });
      toast.success('Usuario desactivado');
    },
  });

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Usuarios</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Gestiona trabajadores de tu empresa.</p>
        </div>

        <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 dark:text-white">Crear trabajador</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-5">
            <div className="space-y-2 md:col-span-1">
              <Label>Nombre</Label>
              <Input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-1">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-1">
              <Label>Contrasena</Label>
              <Input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-1">
              <Label>PIN</Label>
              <Input type="password" inputMode="numeric" value={form.pin} onChange={(event) => setForm({ ...form, pin: event.target.value.replace(/\D/g, '').slice(0, 12) })} />
            </div>
            <div className="flex items-end md:col-span-1">
              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !form.full_name || !form.email || form.password.length < 8 || form.pin.length < 4}
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                {createMutation.isPending ? 'Creando' : 'Crear'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 dark:text-white">Cuentas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left dark:border-slate-800">
                    <th className="py-3 pr-4 font-medium text-slate-500">Nombre</th>
                    <th className="py-3 pr-4 font-medium text-slate-500">Email</th>
                    <th className="py-3 pr-4 font-medium text-slate-500">Rol</th>
                    <th className="py-3 pr-4 font-medium text-slate-500">Estado</th>
                    <th className="py-3 pr-4 font-medium text-slate-500">Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500">Cargando usuarios...</td>
                    </tr>
                  )}
                  {isError && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-red-600">No se pudieron cargar los usuarios.</td>
                    </tr>
                  )}
                  {!isLoading && !isError && users.map((user) => (
                    <tr key={user.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white">{user.full_name}</td>
                      <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">{user.email}</td>
                      <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">{user.role}</td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline">{user.is_active ? 'Activo' : 'Inactivo'}</Badge>
                      </td>
                      <td className="py-3 pr-4">
                        {user.role !== 'CEO' && user.is_active && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deactivateMutation.mutate(user.id)}
                            disabled={deactivateMutation.isPending}
                          >
                            {deactivateMutation.isPending ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <UserX className="w-4 h-4 mr-2" />
                            )}
                            {deactivateMutation.isPending ? 'Desactivando' : 'Desactivar'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
