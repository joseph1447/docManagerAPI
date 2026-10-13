# docManagerAPI

API Express (CommonJS) de DocManager, desplegada en Render (`npm start` → `server.js`).
El front es otro repo: **`C:\Repos\docManagerFront`** (Vite + React en Vercel).

> **Desde 2026-10 el front ya no usa `POST /upload`**: XML → Excel se procesa en el navegador (ver el `CLAUDE.md` del front, que ahora es la fuente de verdad de esa lógica). El endpoint queda por compatibilidad. Si cambias la lógica de facturas, hazlo en el front; aquí solo si algún cliente externo todavía llama `/upload`.

- `app.js` arma la app sin efectos secundarios (sin conectar a Mongo ni escuchar puerto), para poder probarla.
- `server.js` carga `.env`, conecta Mongo y escucha.
- Facturas: `middleware/uploadXmlFiles.js` (multer a disco temporal, sin tope de cantidad, nombres con tildes) → `controllers/facturaController.js` → `services/facturaService.js`.

## Antes de dar algo por terminado

```bash
npm test   # node --test "test/**/*.test.js" — tiene que pasar completo
```

| Archivo | Qué protege |
| --- | --- |
| `test/facturaService.test.js` | Un caso por fixture: estado y código de error de cada XML. |
| `test/excelCompat.test.js` | **El Excel no cambia**: compara fila por fila contra la implementación original congelada en `test/legacy/` (no editar ese archivo). |
| `test/upload.api.test.js` | El endpoint real con supertest: contrato JSON, contrato binario viejo, 400/413/422, nombres con tildes, 300 archivos en una petición, limpieza de temporales. |

Si `excelCompat` falla, cambiaste lo que recibe la clienta: no ajustes la prueba sin que ella lo haya pedido.

## Cuando la clienta reporta un XML que falla

1. Pide el XML (o el texto de «Copiar reporte de errores», trae el `Ref`/`requestId` para buscar en los logs de Render: `[upload <requestId>]`).
2. Anonimízalo (nombres, cédulas, montos) y guárdalo en `test/fixtures/`.
3. Agrega una fila a `CASES` en `test/facturaService.test.js` con el estado y código esperados. Debe fallar.
4. Arregla `services/facturaService.js` hasta que pase, sin romper `excelCompat`.

## Códigos de error (`report.files[].error.code` / `warnings[].code`)

Por archivo (el archivo NO entra al Excel):

| Código | Cuándo |
| --- | --- |
| `EMPTY_FILE` | 0 bytes o solo espacios. |
| `NOT_XML` | Es un PDF, ZIP o página HTML con extensión `.xml`. |
| `INVALID_XML` | XML mal formado. `details` trae `line`, `column` y `parserMessage`. |
| `UNSUPPORTED_DOCUMENT` | No es Factura ni Tiquete (MensajeHacienda, Nota de Crédito/Débito, FE Compra/Exportación, otro XML). `details.rootElement`. |
| `INVALID_DATE` | `FechaEmision` no es una fecha. |
| `UNEXPECTED_PARSE_ERROR` | Excepción no prevista; `details.errorMessage`. Si aparece, convertirlo en un caso con su propio código. |

Advertencias (el archivo SÍ entra al Excel, como antes):

| Código | Cuándo |
| --- | --- |
| `MISSING_FIELDS` | Falta consecutivo, fecha, emisor o total. |
| `INVALID_AMOUNT` | Un monto no es numérico (queda `NaN` en el Excel). |
| `DUPLICATE_DOCUMENT` | Misma clave (o emisor + consecutivo) que otro archivo del lote. |

De la petición: `NO_FILES` (400), `FILE_TOO_LARGE` (413, con `fileName`; tope de 20 MB por archivo), `UNEXPECTED_FIELD` (400), `NO_VALID_FILES` (422, con `report`), `INTERNAL_ERROR` (500), `CORS_NOT_ALLOWED` (403).

**No hay límite de cantidad de archivos** por carga: la clienta sube meses completos y lo pidió explícitamente. Los archivos van a disco (`os.tmpdir()/docmanager-uploads`, se borran al cerrar la respuesta) y se leen de a uno, así que la memoria no crece con el lote. Referencia: 3000 facturas en una petición ≈ 3 s en local.

Todo mensaje nuevo: en español, dice qué pasó y trae `hint` con cómo resolverlo.

## Conocido / pendiente

- `Fecha` usa `toISOString()` (UTC): una factura emitida después de las 18:00 hora de Costa Rica sale con la fecha del día siguiente. Se mantiene igual que antes a propósito (lo fija `excelCompat`); corregirlo es un cambio visible para la clienta.
- Notas de crédito/débito no se procesan todavía (`UNSUPPORTED_DOCUMENT`).
