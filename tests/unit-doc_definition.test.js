// -----------------------------------------------------------------------------
// TESTS UNITARIOS — doc_definition.js
// -----------------------------------------------------------------------------
// Prueba buildDocDefinition sin servidor (genera docDefinition, no PDF).
// -----------------------------------------------------------------------------

import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { buildDocDefinition } from '../src/utils/doc_definition.js';
import { adaptInvoiceData, calcularTotales } from '../src/utils/invoice_utils.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const assetsDir = path.join(__dirname, '../src/assets');

/** Helper: crea datos de factura de prueba */
function fakeData(overrides = {}) {
  const base = {
    client: { name: 'Cliente Test', nit: '900123456', code: 'C001' },
    invoice: { type: 'Cotización', number: '001', place: 'Tunja', date: '2025-01-01', conditions: 'Contado' },
    items: [{ code: 'P001', name: 'Producto A', quantity: 2, unit_price: 50000 }],
    ...overrides,
  };
  const adapted = adaptInvoiceData(base);
  return calcularTotales(adapted);
}

// =============================
// buildDocDefinition
// =============================

test('buildDocDefinition: retorna objeto válido', () => {
  const doc = buildDocDefinition(fakeData(), assetsDir);
  assert.ok(doc, 'docDefinition no es null/undefined');
  assert.ok(typeof doc === 'object', 'es un objeto');
});

test('buildDocDefinition: tiene content y pageSize', () => {
  const doc = buildDocDefinition(fakeData(), assetsDir);
  assert.ok(Array.isArray(doc.content), 'content es array');
  assert.is(doc.pageSize, 'A4');
  assert.ok(doc.pageMargins, 'pageMargins existe');
});

test('buildDocDefinition: incluye estilos por defecto', () => {
  const doc = buildDocDefinition(fakeData(), assetsDir);
  assert.is(doc.defaultStyle.font, 'Montserrat');
  assert.ok(doc.styles, 'styles existe');
  assert.ok(doc.styles.companyName, 'companyName style existe');
  assert.ok(doc.styles.tableHeader, 'tableHeader style existe');
});

test('buildDocDefinition: genera tabla de items con filas correctas', () => {
  const data = fakeData({
    items: [
      { code: 'A', name: 'Prod A', quantity: 1, unit_price: 10000 },
      { code: 'B', name: 'Prod B', quantity: 3, unit_price: 5000 },
    ],
  });
  const doc = buildDocDefinition(data, assetsDir);
  // Buscar la tabla de items (la que tiene headerRows: 1)
  const table = doc.content.find(c => c.table && c.table.headerRows === 1);
  assert.ok(table, 'Tabla de items encontrada');
  // header + 2 filas de items
  assert.is(table.table.body.length, 3, '3 filas (1 header + 2 items)');
});

test('buildDocDefinition: maneja items con details', () => {
  const data = fakeData({
    items: [{ code: 'X', name: 'Prod X', details: ['Detalle 1', 'Detalle 2'], quantity: 1, unit_price: 1000 }],
  });
  const doc = buildDocDefinition(data, assetsDir);
  const table = doc.content.find(c => c.table && c.table.headerRows === 1);
  // La celda de descripción debe ser un stack con nombre + detalles
  const descCell = table.table.body[1][1];
  assert.ok(Array.isArray(descCell), 'La descripción es un array (stack)');
  assert.ok(descCell.length > 1, 'Tiene nombre + detalles');
});

test('buildDocDefinition: totales reflejan IVA y descuento', () => {
  const data = fakeData({
    items: [{ code: 'A', name: 'A', quantity: 1, unit_price: 100000 }],
    iva: 19,
    descuento: 10,
  });
  const doc = buildDocDefinition(data, assetsDir);
  // La columna de totales es la última del column layout (obs + línea + totales)
  const colLayout = doc.content.find(c =>
    c.columns && c.columns.some(col =>
      col.stack && col.stack.length >= 3
    )
  );
  assert.ok(colLayout, 'Column layout con totales existe');
  const totalsCol = colLayout.columns[colLayout.columns.length - 1];
  assert.ok(totalsCol.stack, 'Columna de totales tiene stack');
  assert.ok(totalsCol.stack.length >= 2, 'Totales tiene subtotal/IVA/desc + total box');
});

test('buildDocDefinition: observaciones aparecen en el doc', () => {
  const data = fakeData({ observations: ['Obs 1', 'Obs 2'] });
  const doc = buildDocDefinition(data, assetsDir);
  // Buscar el column layout que contiene "Observaciones:" en alguna columna
  const colLayout = doc.content.find(c =>
    c.columns && c.columns.some(col =>
      col.stack && col.stack.some(item => item.text === 'Observaciones:')
    )
  );
  assert.ok(colLayout, 'Column layout con observaciones existe');
  const obsCol = colLayout.columns.find(col =>
    col.stack && col.stack.some(item => item.text === 'Observaciones:')
  );
  const obsHeader = obsCol.stack.find(c => c.text === 'Observaciones:');
  assert.ok(obsHeader, 'Header "Observaciones:" existe');
  const obsItems = obsCol.stack.filter(c => c.text && c.text.startsWith('- Obs'));
  assert.is(obsItems.length, 2, '2 items de observaciones');
});

test('buildDocDefinition: sin observaciones no genera header de obs', () => {
  const data = fakeData({ observations: [] });
  const doc = buildDocDefinition(data, assetsDir);
  const obsHeader = doc.content.find(c => c.text === 'Observaciones:');
  assert.not.ok(obsHeader, 'No hay header "Observaciones:" cuando está vacío');
});

test('buildDocDefinition: logos no-existentes no crashean', () => {
  const data = fakeData();
  data.company.logo = 'no-existe.png';
  data.company.logo_small = 'tampoco.png';
  assert.not.throws(() => buildDocDefinition(data, assetsDir), 'No crashea con logos faltantes');
});

test.run();
