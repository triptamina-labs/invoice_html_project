# Documentación de la API REST — Generación de Facturas

## Descripción

API REST para generar facturas en PDF a partir de JSON. Usa **pdfmake** (sin Puppeteer, sin Chromium).

---

## Ejecución

```bash
pnpm install
pnpm run api       # Inicia el servidor en http://localhost:3000
pnpm run generate  # Genera PDF por CLI con datos de ejemplo
pnpm run test      # Ejecuta tests (requiere servidor corriendo)
```

---

## Autenticación

### API Key
Toda petición debe incluir `x-api-key` en los headers. Por defecto: `supersecretkey` (configurable vía `API_KEY`).

### Rate Limiting
30 peticiones cada 15 minutos por IP. Excede → `429 Demasiadas peticiones`.

---

## Endpoint

### `POST /generate-invoice`

- **Headers:** `Content-Type: application/json`, `x-api-key: <key>`
- **Body:** JSON con datos de la factura (ver estructura abajo)
- **Respuesta:** `200 OK` con `application/pdf`

#### Ejemplo (curl)

```bash
curl -X POST http://localhost:3000/generate-invoice \
  -H "Content-Type: application/json" \
  -H "x-api-key: supersecretkey" \
  --data-binary @src/data/invoice.json \
  --output factura.pdf
```

---

## Estructura de Datos

```json
{
  "client": {
    "name": "Cliente Ejemplo",
    "nit": "900123456-7",
    "code": "C001"
  },
  "invoice": {
    "type": "Cotización",
    "number": "436",
    "place": "Tunja, Boyacá",
    "date": "11 de Julio 2025",
    "expiry_date": "",
    "seller": "",
    "conditions": "Transferencia",
    "reference": "",
    "delivery": "Envío",
    "iva": "19",
    "descuento": "10"
  },
  "items": [
    {
      "code": "TL-INS-E-2-C",
      "name": "Empaque Unión VITON 6\"",
      "details": ["Material: VITON", "Diámetro: 6\""],
      "quantity": 2,
      "unit_price": 570000
    }
  ],
  "observations": ["Observación de ejemplo"]
}
```

Los campos `iva` y `descuento` aceptan porcentaje (`19`, `"19%"`) o valor absoluto.

---

## Respuestas de Error

| Código | Descripción |
|--------|-------------|
| 400 | Datos de factura inválidos (validación Joi) |
| 401 | API Key inválida o ausente |
| 429 | Rate limiting excedido |
| 500 | Error interno del servidor |
