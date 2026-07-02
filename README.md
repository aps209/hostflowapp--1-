# HostFlow App

Aplicacion fullstack migrada desde una app React/Base44 en JavaScript a una arquitectura local con React + TypeScript, FastAPI, PostgreSQL y Docker.

## Que se detecto

- El frontend ya era una app Vite/React en JavaScript con Tailwind, Radix UI y componentes propios.
- El backend original no estaba en el repo como servidor tradicional: la app dependia de entidades y funciones Base44 en `base44/`.
- Las pantallas consumian `base44.entities.*`, `base44.auth.*` y `base44.functions.invoke(...)`.
- Para conservar comportamiento y UI, se mantuvo ese contrato en el frontend y se reemplazo por una API REST propia.

## Arquitectura

- `frontend/`: React + TypeScript + TSX + Vite. Conserva estilos, componentes, rutas y assets del frontend original.
- `backend/`: FastAPI + SQLAlchemy + Pydantic + JWT + Passlib/Bcrypt.
- `postgres`: base de datos persistente en Docker.
- Las entidades de negocio se guardan en PostgreSQL como registros JSONB por tipo. Esto mantiene los campos existentes de Base44 sin forzar una migracion rigida por cada modulo.

## Ejecutar con Docker

```bash
docker compose up --build
```

URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Healthcheck: `http://localhost:8000/health`

Usuario seed:

- Email: `admin@hostflow.local`
- Contrasena: `Hostflow123!`

## Variables de entorno

Copia `.env.example` a `.env` si quieres cambiar credenciales o secretos:

```bash
cp .env.example .env
```

Variables principales:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `JWT_SECRET_KEY`
- `CORS_ORIGINS`
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`
- `PLATFORM_ADMIN_EMAIL` email del unico usuario que puede ver el panel Admin de plataforma.
- `GOOGLE_PLACES_API_KEY` para sincronizar reseñas con Google Places API (New) usando el `google_place_id` del restaurante.
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` para enviar recordatorios SMS reales.
- `PUBLIC_APP_URL` URL usada en enlaces de confirmacion/cancelacion dentro de recordatorios.

## Endpoints principales

Auth:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Entidades:

- `GET /api/entities/{Entity}`
- `GET /api/entities/{Entity}/filter?filters={...}`
- `GET /api/entities/{Entity}/{id}`
- `POST /api/entities/{Entity}`
- `POST /api/entities/{Entity}/bulk`
- `PATCH /api/entities/{Entity}/{id}`
- `DELETE /api/entities/{Entity}/{id}`

Funciones compatibles:

- `POST /api/functions/obtenerInfoRestaurante`
- `POST /api/functions/crearReservaPublica`
- `POST /api/functions/consultarReserva`
- `POST /api/functions/gestionarReservaPorToken`
- Adaptadores locales OK para emails, campanas, PDF y sincronizaciones externas.

## Desarrollo local sin Docker

Backend:

```bash
cd backend
python -m pip install -r requirements.txt
set DATABASE_URL=postgresql+psycopg://hostflow:hostflow@localhost:5432/hostflow
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Verificaciones realizadas

- `npm run build` en `frontend/`: OK.
- `docker compose config`: OK.
- `docker compose build`: OK.
- `docker compose up -d`: OK.
- `GET /health`: OK.
- Login seed contra `POST /api/auth/login`: OK.
- `GET /api/auth/me` y `GET /api/entities/Restaurant` con JWT: OK.
- Frontend responde en `http://localhost:5173`: OK.

Notas:

- El build muestra avisos no bloqueantes de bundle grande, browserslist antiguo y una clave duplicada heredada en `ReservationForm.tsx`.
- Las integraciones externas de email/SMS/PDF/Google Reviews estan en modo local y devuelven exito simulado.
- Alembic no se inicializo todavia; el esquema inicial se crea con `SQLAlchemy.metadata.create_all()` al arrancar. La siguiente fase natural seria introducir migraciones versionadas.
