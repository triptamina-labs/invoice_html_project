// -----------------------------------------------------------------------------
// DEFINICIÓN DE DOCUMENTO PDFMAKE PARA FACTURAS
// -----------------------------------------------------------------------------
// Transforma datos de factura (JSON) en un docDefinition para pdfmake.
// Sin Puppeteer, sin Chromium, sin Handlebars — solo pdfmake + fs.
// -----------------------------------------------------------------------------

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfMake = require('pdfmake');

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -----------------------------
// CONFIGURACIÓN DE FUENTES (se ejecuta una vez)
// -----------------------------

function setupFonts() {
  // Si ya está configurado, no repetir
  if (pdfMake._fontsConfigured) return;
  pdfMake._fontsConfigured = true;

  // Cargar Roboto (built-in) en el VFS
  const vfsFonts = require('pdfmake/build/vfs_fonts.js');
  for (const [filename, b64] of Object.entries(vfsFonts)) {
    pdfMake.virtualfs.storage[filename] = Buffer.from(b64, 'base64');
  }

  // Fuente custom: Montserrat (default) + DanhDa-Bold (título)
  const fontDir = path.join(__dirname, '../assets/fonts');
  for (const file of ['Montserrat-Regular.ttf', 'Montserrat-Medium.ttf', 'Montserrat-Italic.ttf', 'Montserrat-MediumItalic.ttf']) {
    const fp = path.join(fontDir, file);
    if (fs.existsSync(fp)) pdfMake.virtualfs.storage[file] = fs.readFileSync(fp);
  }
  const danhDaPath = path.join(fontDir, 'DanhDa-Bold.ttf');
  if (fs.existsSync(danhDaPath)) {
    pdfMake.virtualfs.storage['DanhDa-Bold.ttf'] = fs.readFileSync(danhDaPath);
  }

  // Registrar familias de fuentes
  const hasMontserrat = !!pdfMake.virtualfs.storage['Montserrat-Regular.ttf'];
  const hasDanhDa = !!pdfMake.virtualfs.storage['DanhDa-Bold.ttf'];
  pdfMake.fonts = {
    Montserrat: {
      normal: hasMontserrat ? 'Montserrat-Regular.ttf' : 'Roboto-Regular.ttf',
      bold: hasMontserrat ? 'Montserrat-Medium.ttf' : 'Roboto-Medium.ttf',
      italics: hasMontserrat ? 'Montserrat-Italic.ttf' : 'Roboto-Italic.ttf',
      bolditalics: hasMontserrat ? 'Montserrat-MediumItalic.ttf' : 'Roboto-MediumItalic.ttf',
    },
    DanhDa: {
      normal: hasDanhDa ? 'DanhDa-Bold.ttf' : 'Roboto-Regular.ttf',
      bold: hasDanhDa ? 'DanhDa-Bold.ttf' : 'Roboto-Medium.ttf',
      italics: 'Roboto-Italic.ttf',
      bolditalics: 'Roboto-MediumItalic.ttf',
    },
  };
}

// -----------------------------
// FORMATEO
// -----------------------------

const COP = new Intl.NumberFormat('es-CO');

function formatCurrency(value) {
  if (typeof value !== 'number' || isNaN(value)) return '$ 0';
  return '$ ' + COP.format(value);
}

// -----------------------------
// BUILDER DEL DOCUMENTO
// -----------------------------

/**
 * Genera el docDefinition de pdfmake a partir de datos de factura ya procesados.
 * @param {Object} data - Datos adaptados y con totales calculados
 * @param {string} assetsDir - Directorio base de assets
 * @returns {Object} - docDefinition
 */
export function buildDocDefinition(data, assetsDir) {
  setupFonts();

  const { company, client, invoice, items, totals, observations } = data;

  // ---- Logos ----
  let logoDataUri = null;
  let logoSmallDataUri = null;
  if (company.logo) {
    const logoPath = path.isAbsolute(company.logo)
      ? company.logo
      : path.join(assetsDir, company.logo);
    if (fs.existsSync(logoPath)) {
      const b64 = fs.readFileSync(logoPath).toString('base64');
      logoDataUri = `data:image/png;base64,${b64}`;
    }
  }
  if (company.logo_small) {
    const logoSmallPath = path.isAbsolute(company.logo_small)
      ? company.logo_small
      : path.join(assetsDir, company.logo_small);
    if (fs.existsSync(logoSmallPath)) {
      const b64 = fs.readFileSync(logoSmallPath).toString('base64');
      logoSmallDataUri = `data:image/png;base64,${b64}`;
    }
  }

  // ---- Header completo (solo página 1, como primer elemento del content) ----
  const fullHeader = {
    columns: [
      logoDataUri
        ? { image: logoDataUri, width: 80, fit: [80, 90], margin: [0, 0, 10, 0] }
        : { text: '', width: 80 },
      {
        stack: [
          { text: `${company.name || ''} Co.`, style: 'companyName' },
          { text: `Tel. +${company.phone || ''}`, style: 'companyDetail' },
          { text: `NIT. ${company.tax_id || ''}`, style: 'companyDetail' },
          { text: company.city || '', style: 'companyDetail' },
          { text: company.website || '', style: 'companyDetail' },
        ],
        width: '*',
        alignment: 'center',
      },
      {
        stack: [
          { text: invoice.type || '', style: 'invoiceTypeTitle' },
          { text: `NRO. ${invoice.number || ''}`, style: 'invoiceNumber' },
        ],
        width: 150,
        alignment: 'center',
        style: 'quotationBox',
        margin: [10, 8, 10, 8],
      },
    ],
    margin: [0, 0, 0, 15],
  };

  // ---- Tabla de datos de factura ----
  const infoTable = {
    table: {
      widths: ['28%', '27%', '22%', '23%'],
      body: [
        // Fila 1: Cliente (2 cols) | Lugar/Fecha | Vencimiento
        [
          { stack: [
            { text: 'Cliente', style: 'infoLabel' },
            { text: client.name || '', bold: true },
            { text: `NIT: ${client.nit || ''}`, fontSize: 9, color: '#666' },
            { text: `Código: ${client.code || ''}`, fontSize: 9, color: '#666' },
          ], colSpan: 2, margin: [6, 4, 6, 4] },
          '',
          { stack: [
            { text: 'Lugar y fecha de expedición', style: 'infoLabel' },
            { text: invoice.place || '', bold: true },
            { text: invoice.date || '', bold: true },
          ], margin: [6, 4, 6, 4] },
          { stack: [
            { text: 'Vencimiento', style: 'infoLabel' },
            { text: invoice.expiry_date || '—', bold: true },
          ], margin: [6, 4, 6, 4] },
        ],
        // Fila 2: Vendedor | Condiciones | Referencia | Entrega
        [
          { stack: [
            { text: 'Vendedor', style: 'infoLabel' },
            { text: invoice.seller || '—', bold: true },
          ], margin: [6, 4, 6, 4] },
          { stack: [
            { text: 'Condiciones de pago', style: 'infoLabel' },
            { text: invoice.conditions || '—', bold: true },
          ], margin: [6, 4, 6, 4] },
          { stack: [
            { text: 'Referencia', style: 'infoLabel' },
            { text: invoice.reference || '—', bold: true },
          ], margin: [6, 4, 6, 4] },
          { stack: [
            { text: 'Entrega', style: 'infoLabel' },
            { text: invoice.delivery || '—', bold: true },
          ], margin: [6, 4, 6, 4] },
        ],
      ],
    },
    layout: {
      hLineWidth: (i) => (i === 0 || i === 1 || i === 2) ? 1 : 0,
      vLineWidth: () => 0.5,
      hLineColor: () => '#cccccc',
      vLineColor: () => '#cccccc',
      fillColor: () => '#fafafa',
      paddingLeft: () => 2,
      paddingRight: () => 2,
      paddingTop: () => 2,
      paddingBottom: () => 2,
    },
    margin: [0, 0, 0, 15],
  };



  // ---- Tabla de items ----
  const tableHeader = [
    { text: 'Código', style: 'tableHeader', noWrap: true },
    { text: 'Descripción del producto', style: 'tableHeader', noWrap: true },
    { text: 'Cantidad', style: 'tableHeader', alignment: 'right', noWrap: true },
    { text: 'Precio Unit.', style: 'tableHeader', alignment: 'right', noWrap: true },
    { text: 'Subtotal', style: 'tableHeader', alignment: 'right', noWrap: true },
  ];

  const tableRows = (items || []).map(item => {
    const descStack = [{ text: item.name || '', bold: true, fontSize: 9 }];
    if (item.details && item.details.length > 0) {
      item.details.forEach(d => {
        descStack.push({ text: `- ${d}`, color: '#777', fontSize: 8, margin: [10, 2, 0, 0] });
      });
    }
    return [
      { text: item.code || '', bold: true, fontSize: 9 },
      descStack,
      { text: String(item.quantity || 0), alignment: 'right', fontSize: 9 },
      { text: formatCurrency(item.unit_price), alignment: 'right', fontSize: 9 },
      { text: formatCurrency(item.subtotal), alignment: 'right', fontSize: 9 },
    ];
  });

  const itemsTable = {
    table: {
      headerRows: 1,
      widths: ['12%', '42%', '14%', '16%', '16%'],
      body: [tableHeader, ...tableRows],
    },
    layout: {
      hLineWidth: (i) => (i === 0 || i === 1) ? 1 : 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#dddddd',
      vLineColor: () => '#dddddd',
      fillColor: (rowIndex) => {
        if (rowIndex === 0) return '#b4b4b4';
        return rowIndex % 2 === 0 ? '#fafafa' : null;
      },
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 6,
      paddingBottom: () => 6,
    },
    margin: [0, 0, 0, 15],
  };

  // ---- Totales ----
  const totalsBody = [];
  totalsBody.push([
    { text: 'Subtotal:', bold: true, width: '*' },
    { text: formatCurrency(totals.subtotal), alignment: 'right', width: 120 },
  ]);
  if (totals.iva > 0) {
    totalsBody.push([
      { text: 'IVA:', bold: true, width: '*' },
      { text: formatCurrency(totals.iva), alignment: 'right', width: 120 },
    ]);
  }
  if (totals.descuento > 0) {
    totalsBody.push([
      { text: 'Descuento:', bold: true, width: '*' },
      { text: formatCurrency(totals.descuento), alignment: 'right', width: 120 },
    ]);
  }

  const totalsTable = {
    table: {
      widths: ['*', 120],
      body: totalsBody,
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
    margin: [0, 0, 0, 5],
  };

  const totalBox = {
    margin: [0, 0, 0, 0],
    table: {
      widths: ['*', 120],
      body: [
        [{ text: 'TOTAL', bold: true, fontSize: 14, colSpan: 2, alignment: 'right' }, ''],
        [
          '',
          { text: formatCurrency(totals.total_numeric), bold: true, fontSize: 16, alignment: 'right' },
        ],
      ],
    },
    layout: {
      hLineWidth: (i) => (i === 1) ? 2 : 0,
      vLineWidth: () => 0,
      hLineColor: () => '#333333',
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
  };

  const totalText = {
    text: totals.total_text || '',
    italics: true,
    color: '#555555',
    fontSize: 10,
    margin: [0, 5, 0, 0],
  };

  // ---- Observaciones ----
  const obsContent = [];
  if (observations && observations.length > 0) {
    obsContent.push({ text: 'Observaciones:', bold: true, fontSize: 11, margin: [0, 0, 0, 3] });
    observations.forEach(obs => {
      obsContent.push({ text: `- ${obs}`, fontSize: 9, color: '#777777', margin: [0, 1, 0, 1] });
    });
  }

  // ---- Doc Definition ----
  // Footer: número de página en todas las páginas, logo solo en la última
  const pageFooter = (currentPage, pageCount) => {
    const footerCols = [];
    if (currentPage === pageCount && logoSmallDataUri) {
      footerCols.push({ image: logoSmallDataUri, width: 50, fit: [50, 50] });
    }
    footerCols.push({
      text: `Página ${currentPage} de ${pageCount}`,
      fontSize: 9,
      color: '#999999',
      margin: [8, 12, 0, 0],
    });
    return {
      columns: footerCols,
      columnGap: 5,
      alignment: 'left',
      margin: [40, 0, 0, 20],
    };
  };

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 60],
    footer: pageFooter,
    content: [
      fullHeader,
      infoTable,
      itemsTable,
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'Observaciones:', bold: true, fontSize: 11, margin: [0, 0, 0, 3] },
              ...(observations || []).map(obs => ({ text: `- ${obs}`, fontSize: 9, color: '#777777', margin: [0, 1, 0, 1] })),
            ],
          },
          { width: 1, canvas: [{ type: 'line', x1: 0, y1: 0, x2: 0, y2: 200, lineWidth: 0.5, lineColor: '#cccccc' }], margin: [10, 0, 10, 0] },
          { width: 280, stack: [totalsTable, totalBox, totalText] },
        ],
        columnGap: 0,
        margin: [0, 0, 0, 10],
      },
    ],
    defaultStyle: {
      font: 'Montserrat',
      fontSize: 11,
      color: '#333333',
    },
    styles: {
      companyName: { fontSize: 18, bold: true, alignment: 'center', font: 'DanhDa' },
      companyDetail: { fontSize: 10, color: '#555555', alignment: 'center', margin: [0, 1, 0, 1] },
      invoiceTypeTitle: { fontSize: 15, bold: true, alignment: 'center' },
      invoiceNumber: { fontSize: 13, bold: true, alignment: 'center' },
      quotationBox: { border: [1, 1, 1, 1], borderColor: '#dddddd', fillColor: '#fafafa' },
      infoLabel: { fontSize: 9, bold: true, color: '#888888', margin: [0, 0, 0, 2] },
      infoBox: { fillColor: '#fafafa' },
      tableHeader: { bold: true, color: '#ffffff', fontSize: 10 },
    },
  };

  return docDefinition;
}

/**
 * Genera un PDF buffer a partir de datos de factura.
 * @param {Object} data - Datos con totales ya calculados
 * @param {string} assetsDir - Directorio de assets
 * @returns {Promise<Buffer>} - Buffer del PDF
 */
export async function generatePdfBuffer(data, assetsDir) {
  const docDefinition = buildDocDefinition(data, assetsDir);
  const pdfDoc = pdfMake.createPdf(docDefinition);
  const buffer = await pdfDoc.getBuffer();
  return Buffer.from(buffer);
}
