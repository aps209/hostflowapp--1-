# Autenticacion, Licencias y Usuarios

## Resumen

HostFlow ahora soporta licencias multi-tenant sobre la estructura existente:

- `License`: guarda hash de la licencia, plan y estado.
- `Company`: representa la empresa/restaurante SaaS.
- `User`: mantiene `restaurant_id` para datos actuales y añade `company_id`, `pin_hash`, `role` e `is_active`.
- El tenant efectivo de datos sigue siendo `restaurant_id` para no romper entidades JSONB existentes.

## Planes

- `STANDARD`: CEO con `dashboard`.
- `PREMIUM`: CEO con `dashboard`, `crm`, `user_management`; workers con `dashboard`.
- `ULTRA`: CEO con `dashboard`, `crm`, `chatbot`, `cost_intelligence`, `user_management`; workers con `dashboard`.

## Generar Licencias

Desde la raiz del proyecto:

```bash
python tools/license_generator/generate_license.py --plan STANDARD --count 10
python tools/license_generator/generate_license.py --plan PREMIUM --count 10
python tools/license_generator/generate_license.py --plan ULTRA --count 10
```

Opcional:

```bash
python tools/license_generator/generate_license.py --plan ULTRA --count 5 --expires-at 2027-01-01 --output licenses.txt
```

El archivo `licenses.txt` contiene secretos si lo usas. No lo subas a Git.

## Activar Empresa

1. Abrir `/Register`.
2. Introducir licencia.
3. Crear empresa y CEO con email, password y PIN.

Endpoints:

```bash
curl -X POST http://localhost:8000/api/auth/validate-license \
  -H "Content-Type: application/json" \
  -d "{\"license_key\":\"RESTO-ULTRA-XXXX-XXXX-XXXX\"}"
```

```bash
curl -X POST http://localhost:8000/api/auth/register-company \
  -H "Content-Type: application/json" \
  -d "{\"license_key\":\"RESTO-ULTRA-XXXX-XXXX-XXXX\",\"company_name\":\"Demo\",\"ceo_full_name\":\"CEO Demo\",\"ceo_email\":\"ceo@example.com\",\"ceo_password\":\"Password123!\",\"ceo_pin\":\"1234\"}"
```

## Login con PIN

1. `POST /api/auth/login` con email/password.
2. Devuelve `requires_pin` y `temporary_token`.
3. `POST /api/auth/verify-pin` con `temporary_token` y PIN.

El JWT final incluye `company_id`, `role`, `plan` y `permissions`.

## Gestion de Usuarios

Solo CEOs `PREMIUM` y `ULTRA` pueden usar:

- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/{id}`
- `DELETE /api/users/{id}`

Desde frontend, la pagina esta en `/Users`.

## Proteger Nuevos Endpoints

Usa:

```python
from app.api.deps import require_permission

@router.get("/example")
def example(current_user=Depends(require_permission("crm"))):
    ...
```

Permisos disponibles:

- `dashboard`
- `crm`
- `chatbot`
- `cost_intelligence`
- `user_management`

## Docker

```bash
docker compose up -d --build
```

Variables nuevas:

```env
TEMP_LOGIN_TOKEN_EXPIRE_MINUTES=5
REFRESH_TOKEN_EXPIRE_DAYS=30
LICENSE_HASH_SECRET=change_me_license_secret
```

## Pruebas Manuales

- Generar una licencia `STANDARD`.
- Activarla en `/Register`.
- Comprobar que el CEO solo ve Dashboard.
- Generar una licencia `PREMIUM`.
- Activarla y crear un worker en `/Users`.
- Comprobar que el worker solo ve Dashboard.
- Generar una licencia `ULTRA`.
- Activarla y comprobar que el CEO ve AI Manager y Cost Intelligence.
- Intentar acceder manualmente a `/api/ai-manager/suggestions` con STANDARD/PREMIUM y confirmar `403`.
- Intentar PIN incorrecto y confirmar `401`.

## Consideraciones de Produccion

- Cambiar `JWT_SECRET_KEY` y `LICENSE_HASH_SECRET`.
- Usar migraciones Alembic versionadas.
- Anadir refresh tokens persistentes y revocacion.
- Anadir rate limit en login/PIN.
- Anadir endpoint de cambio de PIN.
- Revisar el mapeo fino de endpoints legacy de entidades por modulo.
