# AI Manager y Cost Intelligence

## Que se ha implementado

- `AI Manager`: chat interno para preguntar por ventas, margenes, stock, clientes y campanas.
- `Cost Intelligence`: ingredientes de coste, platos, recetas, facturas rapidas, desglose de coste, recomendaciones y simulador de precio.
- Backend con routers separados, schemas Pydantic, servicios de calculo, tools internas y proveedor IA configurable.
- Frontend con rutas `/ai-manager` y `/cost-intelligence`, integradas en el sidebar.
- Logs de acciones IA en la entidad `AIActionLog`.

## Configurar la API key

Para usar Gemini:

1. Crear API key en Google AI Studio.
2. Copiar `.env.example` a `.env` en la raiz del proyecto, o poner estas variables en `backend/.env`.
3. Editar el archivo elegido:

```env
GEMINI_API_KEY=tu_api_key
AI_PROVIDER=gemini
AI_MODEL=gemini-2.5-flash
```

4. Reiniciar backend con `docker compose up -d --force-recreate backend` o reiniciar tu proceso local de `uvicorn`.

La API key no se envia al frontend. El frontend llama al backend y el backend llama al proveedor IA.

Nota: `gemini-2.5-flash` es el identificador estable actual de Flash para `generateContent`. Si quieres usar otro modelo, cambia `AI_MODEL`.

## Cambiar de modelo o proveedor

- Modelo: cambia `AI_MODEL` en `.env`.
- Proveedor: cambia `AI_PROVIDER`.
- Para anadir otro proveedor, crea una clase en `backend/app/services/ai/providers/` que implemente `AIProvider` y registrala en `factory.py`.

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
- Password: `Hostflow123!`

## Endpoints disponibles

AI Manager:

- `POST /api/ai-manager/chat`
- `GET /api/ai-manager/suggestions`
- `POST /api/ai-manager/action/confirm`

Tools internas de reservas para AI Manager:

- `list_reservations`: consulta reservas y permite filtros por `fecha`, `estado`, `cliente`, `reservation_id` y `service`.
- `service=comida`: reservas antes de las 18:00.
- `service=cena`: reservas desde las 18:00.
- `create_reservation`: accion confirmable para crear reservas.
- `update_reservation`: accion confirmable para modificar reservas.
- `delete_reservation`: accion confirmable para eliminar reservas.

Payloads de acciones confirmables:

```json
{
  "id": "create_reservation",
  "payload": {
    "cliente_nombre": "Ana Garcia",
    "cliente_telefono": "+34600111222",
    "fecha": "2026-07-05",
    "hora": "21:15",
    "comensales": 2,
    "notas": "Mesa tranquila"
  }
}
```

```json
{
  "id": "update_reservation",
  "payload": {
    "reservation_id": "R-2026-0003",
    "hora": "21:30",
    "notas": "Cambio solicitado por cliente"
  }
}
```

```json
{
  "id": "delete_reservation",
  "payload": {
    "reservation_id": "R-2026-0003"
  }
}
```

Cost Intelligence:

- `GET /api/cost-intelligence/ingredients`
- `POST /api/cost-intelligence/ingredients`
- `GET /api/cost-intelligence/suppliers`
- `POST /api/cost-intelligence/suppliers`
- `GET /api/cost-intelligence/dishes`
- `POST /api/cost-intelligence/dishes`
- `GET /api/cost-intelligence/recipes`
- `POST /api/cost-intelligence/recipes`
- `GET /api/cost-intelligence/dishes/{id}/cost-breakdown`
- `POST /api/cost-intelligence/invoices`
- `POST /api/cost-intelligence/recommendations/generate`
- `POST /api/cost-intelligence/simulate-price-change`

## Seguridad

- Entradas validadas con Pydantic.
- No se expone ninguna API key al frontend.
- La IA no ejecuta SQL libre.
- El chat solo usa tools internas controladas.
- Las acciones que modifican datos requieren confirmacion.
- Las acciones IA se registran como `AIActionLog`.

## Limitaciones actuales

- MVP sobre entidades JSONB existentes, sin Alembic.
- Rate limit no implementado; queda pendiente anadir middleware si se define una politica global.
- Costes usa conversiones simples entre `g/kg`, `ml/l` y `unidad`.
- La estimacion de impacto mensual usa `estimated_monthly_units` del plato.
- Las recomendaciones crean registros historicos cada vez que se generan.

## Proximos pasos recomendados

- Anadir edicion y borrado de ingredientes, platos y recetas.
- Conectar ventas reales por plato para estimar unidades mensuales automaticamente.
- Importar facturas desde PDF/CSV.
- Anadir rate limiting por usuario/restaurante.
- Versionar esquema con Alembic si el modelo deja de ser JSONB generico.
