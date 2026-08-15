// -----------------------------------------------------------------------------
// GENERADOR DE FACTURAS EN PDF — CLI
// -----------------------------------------------------------------------------
// Genera un PDF directamente desde datos JSON usando pdfmake.
// Sin Puppeteer, sin Chromium, sin Handlebars.
// -----------------------------------------------------------------------------

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as invoiceUtils from './src/utils/invoice_utils.js';
import { generatePdfBuffer } from './src/utils/doc_definition.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -----------------------------
// PARÁMETROS CLI (simplificados — sin yargs)
// -----------------------------
const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

const baseDir = __dirname;
const dataPath = getArg('data') || path.join(baseDir, 'src/data/invoice.json');
const companyPath = path.join(baseDir, 'src/data/company.json');
const outputPdf = getArg('output') || path.join(baseDir, 'src/output/invoice.pdf');
const assetsDir = path.join(baseDir, 'src/assets');

// -----------------------------
// FLUJO PRINCIPAL
// -----------------------------
(async () => {
  try {
    // Validar archivos
    if (!fs.existsSync(dataPath)) throw new Error(`No se encontró el archivo de datos: ${dataPath}`);
    if (!fs.existsSync(companyPath)) throw new Error(`No se encontró company.json: ${companyPath}`);

    // Cargar y combinar datos
    const invoiceRaw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const companyData = JSON.parse(fs.readFileSync(companyPath, 'utf8'));
    const dataRaw = { ...invoiceRaw, company: companyData };

    // Adaptar y calcular totales
    const adapted = invoiceUtils.adaptInvoiceData(dataRaw);
    const data = invoiceUtils.calcularTotales(adapted);

    // Generar PDF
    console.log('Generando PDF...');
    const pdfBuffer = await generatePdfBuffer(data, assetsDir);

    // Guardar
    fs.mkdirSync(path.dirname(outputPdf), { recursive: true });
    fs.writeFileSync(outputPdf, pdfBuffer);
    console.log(`PDF generado: ${outputPdf}`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
