// -----------------------------------------------------------------------------
// SERVIDOR EXPRESS — API REST PARA GENERACIÓN DE FACTURAS
// -----------------------------------------------------------------------------
// Recibe JSON, valida, y genera PDF con pdfmake. Sin Puppeteer.
// -----------------------------------------------------------------------------

import express from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import * as invoiceUtils from '../utils/invoice_utils.js';
import { generatePdfBuffer } from '../utils/doc_definition.js';
import { validateInvoice } from '../utils/invoice_schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -----------------------------
// CONFIGURACIÓN
// -----------------------------
const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'supersecretkey';
const assetsDir = path.join(__dirname, '../assets');
const companyPath = path.join(__dirname, '../data/company.json');

// -----------------------------
// MIDDLEWARES
// -----------------------------
app.use(express.json());

const apiKeyAuth = (req, res, next) => {
  const key = req.get('x-api-key');
  if (key && key === API_KEY) return next();
  res.status(401).json({ error: 'No autorizado', details: ['API Key inválida o ausente'] });
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones', details: ['Has excedido el límite de peticiones, intenta más tarde.'] },
});

// -----------------------------
// ENDPOINT: GENERAR FACTURA
// -----------------------------
app.post('/generate-invoice', limiter, apiKeyAuth, validateInvoice, async (req, res) => {
  try {
    // Cargar datos de empresa y combinar
    const companyData = JSON.parse(fs.readFileSync(companyPath, 'utf8'));
    const dataRaw = { ...req.body, company: companyData };

    // Adaptar, calcular, generar
    const adapted = invoiceUtils.adaptInvoiceData(dataRaw);
    const data = invoiceUtils.calcularTotales(adapted);
    const pdfBuffer = await generatePdfBuffer(data, assetsDir);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=factura.pdf');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generando PDF:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: [error.message] });
  }
});

// -----------------------------
// INICIO
// -----------------------------
export { app };

// Solo arranca el listener cuando este archivo se ejecuta directamente
// (node src/api/server.js o pnpm run api). Cuando se importa (tests),
// la app queda exportada y quien importa decide puerto y arranque.
const isEntryPoint = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) {
  app.listen(PORT, () => {
    console.log(`Servidor de facturas escuchando en http://localhost:${PORT}`);
  });
}
