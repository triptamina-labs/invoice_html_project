![Project banner](banner-html-min.png)

# Generador de Facturas en PDF con Node.js

Genera facturas y cotizaciones en PDF a partir de datos JSON. Usa **pdfmake** — sin Puppeteer, sin Chromium, sin dependencias pesadas.

Incluye CLI para uso directo y API REST lista para integrarse con n8n, Zapier, o cualquier backend.

---

## Diagramas de Flujo

### Flujo de Trabajo (CLI)

```mermaid
graph TD
    subgraph Flujo de Trabajo CLI
        A[Usuario] -- ejecuta --> B(pnpm run generate);
        B -- invoca --> C(generate.js);
        C -- lee --> D{invoice.json};
        C -- lee --> E{company.json};
        C -- procesa y calcula --> F[Datos adaptados];
        F -- genera --> G[pdfmake];
        G -- genera --> H(invoice.pdf);
    end
```

### Flujo de Trabajo (API)

```mermaid
sequenceDiagram
    participant Client as Cliente
    participant Server as Servidor Express

    Client->>Server: POST /generate-invoice (JSON + API Key)
    Server->>Server: Rate Limiting + Auth + Validación Joi
    alt Datos Inválidos
        Server-->>Client: 400 Bad Request
    end
    Server->>Server: Adaptar datos + Calcular totales
    Server->>Server: Generar PDF con pdfmake
    Server-->>Client: 200 OK (application/pdf)
```

---

## Características Principales

- **Ligero:** Solo pdfmake (~500KB). Sin Chromium (~400MB).
- **Generación Dual:** CLI y API REST.
- **Cálculos Automáticos:** Subtotales, IVA (porcentaje o absoluto), descuentos.
- **Total en Letras:** Conversión automática a texto en español.
- **Logo Incrustado:** Imágenes embebidas en base64, PDF autocontenido.
- **Multi-página:** La tabla de items fluye entre páginas sin header repetido; el footer lleva número de página en todas y el logo pequeño en la última.
- **API Segura:** Auth por API Key + rate limiting.
- **Validación:** Esquemas Joi para datos de entrada.
- **Docker:** Imagen base `node:20-alpine` (~50MB vs ~800MB antes).

---

## Requisitos

- **Node.js**: v18.0 o superior
- **Gestor de Paquetes**: pnpm (recomendado) o npm

---

## Estructura del Proyecto

```
invoice_html_project/
├── generate.js                   # Script CLI
├── src/
│   ├── api/server.js             # Servidor Express (API REST)
│   ├── assets/
│   │   ├── fonts/                # DanhDa-Bold (título) + Montserrat (cuerpo)
│   │   └── *.png                 # Logos
│   ├── data/
│   │   ├── company.json          # Datos de la empresa
│   │   ├── invoice.json          # Ejemplo de factura corta
│   │   └── factura-large.json    # Ejemplo de factura larga (multi-página)
│   ├── output/                   # PDFs generados (gitignored)
│   └── utils/
│       ├── doc_definition.js     # Builder de docDefinition para pdfmake
│       ├── invoice_schema.js     # Validación Joi
│       └── invoice_utils.js      # Lógica de negocio (totales, nº a texto)
├── tests/                        # Tests uvu (39 en total)
│   ├── api-invoice.test.js       # Integración API (requiere servidor)
│   ├── unit-doc_definition.test.js
│   └── unit-invoice_utils.test.js
├── Dockerfile
└── package.json
```

---

## Instalación

```bash
git clone <repo-url>
cd invoice_html_project
pnpm install
```

---

## Uso por CLI

```bash
# Generar con datos por defecto
pnpm run generate

# Generar con archivos personalizados
node generate.js --data mi-factura.json --output mi-factura.pdf

# Ejemplo de factura larga (multi-página)
node generate.js --data src/data/factura-large.json --output factura-larga.pdf
```

---

## Uso como API REST

```bash
pnpm run api
```

### Endpoint

- **POST** `/generate-invoice`
- **Headers:** `Content-Type: application/json`, `x-api-key: <tu-api-key>`
- **Body:** JSON de la factura (ver `src/data/invoice.json` como ejemplo)
- **Respuesta:** PDF (`application/pdf`)

```bash
curl -X POST http://localhost:3000/generate-invoice \
  -H "Content-Type: application/json" \
  -H "x-api-key: supersecretkey" \
  --data-binary @src/data/invoice.json \
  --output factura.pdf
```

La API Key por defecto es `supersecretkey` (configurable con `API_KEY`). Rate limit: 30 peticiones cada 15 minutos por IP.

---

## Personalización

- **Logo:** Cambia archivos en `src/assets/` y actualiza `company.json`.
- **Fuente:** Coloca cualquier `.ttf` en `src/assets/fonts/` y registra en `doc_definition.js` (sección `setupFonts`).
- **Empresa:** Modifica `src/data/company.json`.
- **Estilos:** Edita el objeto `styles` y los layouts de tabla en `doc_definition.js`.

---

## Tests

```bash
# Terminal 1: iniciar API (requerido solo para tests de integración)
pnpm run api

# Terminal 2: ejecutar todos los tests (39)
pnpm run test

# Solo unit tests (sin servidor)
npx uvu tests "unit-"
```

---

## Docker

```bash
docker build -t invoice-generator .
docker run -p 3000:3000 -e API_KEY=tu-clave invoice-generator
```

---

## Créditos

- [pdfmake](http://pdfmake.org) — generación de PDF en JavaScript puro
- Node.js, Express, Joi, pino
- Licencia MIT
