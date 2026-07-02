import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { CheckCircle, Mail } from "lucide-react";

export default function EmailCustomization({ config, onUpdate, isSaving }) {
  const [formData, setFormData] = useState({
    email_custom_message: '',
    email_footer_message: '',
    public_form_custom_message: '',
    show_custom_message_in_confirmation_email: true,
    show_custom_message_in_cancellation_email: false,
    show_custom_message_in_public_form: false,
  });
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData({
        email_custom_message: config.email_custom_message || '',
        email_footer_message: config.email_footer_message || '',
        public_form_custom_message: config.public_form_custom_message || '',
        show_custom_message_in_confirmation_email: config.show_custom_message_in_confirmation_email !== undefined ? config.show_custom_message_in_confirmation_email : true,
        show_custom_message_in_cancellation_email: config.show_custom_message_in_cancellation_email || false,
        show_custom_message_in_public_form: config.show_custom_message_in_public_form || false,
      });
    }
  }, [config]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdate(formData);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <CardHeader>
        <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Personalización de Emails
        </CardTitle>
        <CardDescription className="text-slate-600 dark:text-slate-400">
          Añade mensajes personalizados y elige dónde mostrarlos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {showSuccess && (
            <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-300">
                Configuración de emails guardada correctamente
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email_custom_message" className="text-slate-900 dark:text-white">
              Mensaje personalizado principal
            </Label>
            <Textarea
              id="email_custom_message"
              value={formData.email_custom_message}
              onChange={(e) => setFormData({ ...formData, email_custom_message: e.target.value })}
              placeholder="Ej: ¡Estamos emocionados de recibirte! Recuerda que tenemos menú especial este fin de semana."
              className="min-h-[100px] bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              maxLength={500}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Este mensaje aparecerá después de los detalles de la reserva. Máximo 500 caracteres.
            </p>
          </div>

          <div className="space-y-4 border-t border-slate-200 dark:border-slate-700 pt-4">
            <Label className="text-slate-900 dark:text-white font-semibold">
              ¿Dónde quieres mostrar el mensaje personalizado?
            </Label>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show_confirmation" className="text-slate-900 dark:text-white">
                  Emails de confirmación
                </Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Mostrar en correos cuando se confirma una reserva
                </p>
              </div>
              <Switch
                id="show_confirmation"
                checked={formData.show_custom_message_in_confirmation_email}
                onCheckedChange={(checked) => setFormData({ ...formData, show_custom_message_in_confirmation_email: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show_cancellation" className="text-slate-900 dark:text-white">
                  Emails de cancelación
                </Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Mostrar en correos cuando se cancela una reserva
                </p>
              </div>
              <Switch
                id="show_cancellation"
                checked={formData.show_custom_message_in_cancellation_email}
                onCheckedChange={(checked) => setFormData({ ...formData, show_custom_message_in_cancellation_email: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show_public_form" className="text-slate-900 dark:text-white">
                  Formulario público
                </Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Mostrar en el formulario de reservas públicas
                </p>
              </div>
              <Switch
                id="show_public_form"
                checked={formData.show_custom_message_in_public_form}
                onCheckedChange={(checked) => setFormData({ ...formData, show_custom_message_in_public_form: checked })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="public_form_custom_message" className="text-slate-900 dark:text-white">
              Mensaje personalizado formulario
            </Label>
            <Textarea
              id="public_form_custom_message"
              value={formData.public_form_custom_message}
              onChange={(e) => setFormData({ ...formData, public_form_custom_message: e.target.value })}
              placeholder="Ej: Recuerda que tenemos menú especial este fin de semana. ¡Pregunta por él!"
              className="min-h-[100px] bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              maxLength={500}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Este mensaje se mostrará destacado en el formulario público cuando un cliente vaya a hacer una reserva. Máximo 500 caracteres.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email_footer_message" className="text-slate-900 dark:text-white">
              Mensaje adicional en el pie del email
            </Label>
            <Textarea
              id="email_footer_message"
              value={formData.email_footer_message}
              onChange={(e) => setFormData({ ...formData, email_footer_message: e.target.value })}
              placeholder="Ej: Síguenos en redes sociales @turestaurante para conocer nuestras novedades."
              className="min-h-[80px] bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              maxLength={300}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Este mensaje aparecerá al final del email, antes de la información de contacto. Máximo 300 caracteres.
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
              Vista previa
            </h4>
            <div className="text-xs text-blue-800 dark:text-blue-400 space-y-3">
              {formData.show_custom_message_in_confirmation_email && (
                <div>
                  <p className="font-semibold mb-1">📧 Email de confirmación:</p>
                  <p className="ml-2">1. Saludo y confirmación</p>
                  <p className="ml-2">2. Detalles de la reserva</p>
                  {formData.email_custom_message && (
                    <p className="ml-2 font-semibold text-emerald-600 dark:text-emerald-400">3. → Tu mensaje personalizado ←</p>
                  )}
                  <p className="ml-2">4. Botón para cancelar</p>
                  {formData.email_footer_message && (
                    <p className="ml-2 font-semibold text-emerald-600 dark:text-emerald-400">5. → Tu mensaje en el pie ←</p>
                  )}
                  <p className="ml-2">6. Información de contacto</p>
                </div>
              )}
              
              {formData.show_custom_message_in_cancellation_email && (
                <div>
                  <p className="font-semibold mb-1">❌ Email de cancelación:</p>
                  <p className="ml-2">1. Notificación de cancelación</p>
                  <p className="ml-2">2. Detalles de la reserva cancelada</p>
                  {formData.email_custom_message && (
                    <p className="ml-2 font-semibold text-emerald-600 dark:text-emerald-400">3. → Tu mensaje personalizado ←</p>
                  )}
                  {formData.email_footer_message && (
                    <p className="ml-2 font-semibold text-emerald-600 dark:text-emerald-400">4. → Tu mensaje en el pie ←</p>
                  )}
                  <p className="ml-2">5. Información de contacto</p>
                </div>
              )}
              
              {formData.show_custom_message_in_public_form && (
                <div>
                  <p className="font-semibold mb-1">🌐 Formulario público:</p>
                  <p className="ml-2">1. Campos de reserva</p>
                  {formData.public_form_custom_message && (
                    <p className="ml-2 font-semibold text-emerald-600 dark:text-emerald-400">2. → Tu mensaje de formulario (destacado) ←</p>
                  )}
                  <p className="ml-2">3. Botón de confirmar</p>
                </div>
              )}
              
              {!formData.show_custom_message_in_confirmation_email && 
               !formData.show_custom_message_in_cancellation_email && 
               !formData.show_custom_message_in_public_form && (
                <p className="text-amber-600 dark:text-amber-400">
                  ⚠️ Ninguna opción seleccionada. El mensaje no se mostrará en ningún lugar.
                </p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSaving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSaving ? 'Guardando...' : 'Guardar configuración de emails'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}