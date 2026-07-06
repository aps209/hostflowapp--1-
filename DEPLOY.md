# Despliegue de HostFlow (Railway + Vercel)

Arquitectura de producción:

- **Frontend** (Vite/React estático) → **Vercel**
- **Backend** (FastAPI, Docker) + **PostgreSQL** → **Railway**
- **Webhook de WhatsApp** → apunta al backend de Railway (URL HTTPS pública y estable)

El repo ya está preparado: `backend/Dockerfile` usa `$PORT`, `DATABASE_URL` se normaliza
para psycopg3, `frontend/vercel.json` tiene el rewrite para SPA, y el frontend lee la API
desde `VITE_API_URL`.

> Orden recomendado: **1) Backend en Railway** (para obtener su URL) → **2) Frontend en Vercel**
> → **3) volver a Railway** a fijar `CORS_ORIGINS` y `PUBLIC_APP_URL` con la URL de Vercel.

---

## 1. Backend + Postgres en Railway

1. Entra en https://railway.app e inicia sesión con GitHub.
2. **New Project → Deploy from GitHub repo** → elige `aps209/hostflowapp--1-`.
3. En el servicio creado → **Settings**:
   - **Root Directory**: `backend`  (Railway usará `backend/Dockerfile` automáticamente).
   - **Networking → Generate Domain**: te da una URL tipo `https://hostflowapp-production.up.railway.app`.
     Anótala como `BACKEND_URL`.
4. Añade la base de datos: **New → Database → Add PostgreSQL**. Railway crea la variable
   `DATABASE_URL` y la comparte con el servicio (si no, cópiala en las variables del backend
   con *Reference → Postgres.DATABASE_URL*).
5. En el servicio backend → **Variables**, añade:

   ```
   JWT_SECRET_KEY=<genera-uno-largo-y-aleatorio>
   PLATFORM_ADMIN_EMAIL=ramon.arteaga@ilustricia.com
   GEMINI_API_KEY=<tu-clave-gemini>
   AI_MODEL=gemini-2.5-flash

   # WhatsApp (Meta) — los valores reales que ya tienes en backend/.env
   WHATSAPP_PHONE_NUMBER_ID=<...>
   WHATSAPP_ACCESS_TOKEN=<...>
   WHATSAPP_APP_SECRET=<...>
   WHATSAPP_VERIFY_TOKEN=<invéntate-uno-y-úsalo-igual-en-Meta>
   WHATSAPP_API_VERSION=v21.0
   WHATSAPP_REMINDER_TEMPLATE=reservation_reminder
   WHATSAPP_REMINDER_TEMPLATE_LANG=es
   REMINDER_TIMEZONE=Europe/Madrid
   RUN_SCHEDULER=true

   # Se rellenan en el paso 3, cuando tengas la URL de Vercel:
   CORS_ORIGINS=https://localhost:5173
   PUBLIC_APP_URL=https://localhost:5173
   ```

   > No pongas `DATABASE_URL` a mano si ya la comparte el plugin de Postgres.
   > `PORT` lo inyecta Railway solo — no lo definas.

6. Railway desplegará. Comprueba `GET {BACKEND_URL}/health` → `{"status":"ok"}`.
   El seed crea el admin (`admin@hostflow.local` / `Hostflow123!`) salvo que cambies
   `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`.

---

## 2. Frontend en Vercel

1. Entra en https://vercel.com e inicia sesión con GitHub.
2. **Add New → Project** → importa `aps209/hostflowapp--1-`.
3. Configuración del proyecto:
   - **Root Directory**: `frontend`
   - Framework preset: **Vite** (autodetectado). Build: `npm run build`, Output: `dist`.
4. **Environment Variables** → añade:

   ```
   VITE_API_URL=https://<BACKEND_URL>/api
   ```

   (ej. `https://hostflowapp-production.up.railway.app/api`). Ojo: incluye `/api` al final.
5. **Deploy**. Vercel te da una URL tipo `https://hostflowapp.vercel.app`. Anótala como `FRONTEND_URL`.

   > Si cambias `VITE_API_URL` después, hay que **redeploy** (es una variable de *build*, se
   > embebe en el bundle).

---

## 3. Enlazar los dos (CORS + enlaces públicos)

Vuelve a Railway → Variables del backend y ajusta con la URL real de Vercel:

```
CORS_ORIGINS=https://hostflowapp.vercel.app
PUBLIC_APP_URL=https://hostflowapp.vercel.app
```

Railway redeploya el backend. Ya deberías poder entrar en `FRONTEND_URL`, hacer login y que
las llamadas a la API funcionen (sin errores CORS en la consola del navegador).

---

## 4. Configurar el webhook de WhatsApp en Meta

Con el backend público ya tienes URL estable para el webhook (no necesitas ngrok):

1. En **Meta App → WhatsApp → Configuration → Webhook**:
   - **Callback URL**: `https://<BACKEND_URL>/api/webhooks/whatsapp`
   - **Verify token**: el mismo valor que pusiste en `WHATSAPP_VERIFY_TOKEN`.
   - Pulsa **Verify and Save** (Meta hará el handshake `GET`; debe validar).
2. **Suscribe el campo `messages`** (Webhook fields → messages).
3. Asegúrate de tener la **plantilla aprobada** (`reservation_reminder`) con 6 variables
   en el cuerpo (nombre, restaurante, fecha, hora, comensales, mesa) + 2 botones Quick Reply
   (Confirmar / Cancelar), en ese orden.

Prueba: crea una reserva con tu móvil en `cliente_telefono`, activa recordatorios en la página
Recordatorios (canal WhatsApp, `send_time` a unos minutos vista) y espera al scheduler, o
lanza el envío manualmente. Al recibir el WhatsApp, pulsa un botón → el webhook actualiza el
estado de la reserva.

---

## Notas y límites

- **Scheduler**: corre in-process dentro del backend (APScheduler). Mantén **1 réplica** del
  servicio en Railway (o pon `RUN_SCHEDULER=false` en réplicas extra) para no duplicar envíos.
- **Base de datos**: el esquema se crea solo al arrancar (`create_all`). No hay migraciones
  Alembic todavía; cambios de esquema destructivos habría que gestionarlos a mano.
- **Secretos**: nunca en `.env.example` (es público). Los valores reales van en `backend/.env`
  (local, gitignored) y en las Variables de Railway (producción).
- **Coste**: Railway Hobby ~5$/mes de crédito; Vercel Hobby gratis para proyectos personales;
  Meta cobra por conversación de WhatsApp.
