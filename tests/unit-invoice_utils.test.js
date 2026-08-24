// -----------------------------------------------------------------------------
// TESTS UNITARIOS — invoice_utils.js
// -----------------------------------------------------------------------------

import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { calcularTotales, adaptInvoiceData, numeroATexto } from '../src/utils/invoice_utils.js';

// =============================
// numeroATexto
// =============================

test('numeroATexto: cero retorna "cero"', () => {
  assert.is(numeroATexto(0), 'cero');
});

test('numeroATexto: entero simple con 00/100', () => {
  const r = numeroATexto(1500);
  assert.ok(r.includes('1500') || r.includes('MIL'), `Contiene parte entera: ${r}`);
  assert.ok(r.includes('00/100'), `Tiene decimales 00/100: ${r}`);
});

test('numeroATexto: con decimales reales', () => {
  const r = numeroATexto(1234.56);
  assert.ok(r.includes('56/100'), `Decimales 56/100: ${r}`);
});

test('numeroATexto: millones', () => {
  const r = numeroATexto(1500000);
  assert.ok(r.includes('MILLÓN') || r.includes('MILLONES'), `Menciona millones: ${r}`);
});

test('numeroATexto: NaN retorna string vacío', () => {
  assert.is(numeroATexto(NaN), '');
});

test('numeroATexto: retorna mayúsculas para enteros > 0', () => {
  const r = numeroATexto(100);
  assert.is(r, r.toUpperCase(), 'Todo mayúsculas');
});

// =============================
// adaptInvoiceData
// =============================

test('adaptInvoiceData: rellena valores por defecto', () => {
  const r = adaptInvoiceData({});
  assert.ok(r.company, 'company existe');
  assert.ok(r.client, 'client existe');
  assert.ok(r.invoice, 'invoice existe');
  assert.ok(Array.isArray(r.items), 'items es array');
  assert.is(r.client.name, '');
});

test('adaptInvoiceData: preserva datos existentes', () => {
  const input = {
    client: { name: 'Felipe', nit: '123', code: 'C1' },
    invoice: { type: 'Factura', number: '001', place: 'Tunja', date: '2025-01-01' },
    items: [{ code: 'P1', name: 'Prod', quantity: 5, unit_price: 10000 }],
  };
  const r = adaptInvoiceData(input);
  assert.is(r.client.name, 'Felipe');
  assert.is(r.invoice.number, '001');
  assert.is(r.items[0].quantity, 5);
});

test('adaptInvoiceData: normaliza aliases (description→name, price→unit_price)', () => {
  const r = adaptInvoiceData({
    items: [{ code: 'X', description: 'Mi prod', quantity: 2, price: 5000 }],
  });
  assert.is(r.items[0].name, 'Mi prod');
  assert.is(r.items[0].unit_price, 5000);
});

test('adaptInvoiceData: iva en raíz vs invoice', () => {
  assert.is(adaptInvoiceData({ iva: 19 }).iva, 19);
  assert.is(adaptInvoiceData({ invoice: { iva: '10%' } }).iva, '10%');
});

test('adaptInvoiceData: descuento en raíz vs invoice', () => {
  assert.is(adaptInvoiceData({ descuento: 10 }).descuento, 10);
  assert.is(adaptInvoiceData({ invoice: { descuento: '5%' } }).descuento, '5%');
});

// =============================
// calcularTotales
// =============================

test('calcularTotales: básico sin IVA ni descuento', () => {
  const r = calcularTotales(adaptInvoiceData({
    items: [
      { code: 'A', name: 'A', quantity: 2, unit_price: 10000 },
      { code: 'B', name: 'B', quantity: 1, unit_price: 5000 },
    ],
  }));
  assert.is(r.totals.subtotal, 25000);
  assert.is(r.totals.iva, 0);
  assert.is(r.totals.descuento, 0);
  assert.is(r.totals.total_numeric, 25000);
});

test('calcularTotales: IVA porcentaje 19%', () => {
  const r = calcularTotales(adaptInvoiceData({
    items: [{ code: 'A', name: 'A', quantity: 1, unit_price: 100000 }],
    iva: 19,
  }));
  assert.is(r.totals.iva, 19000);
  assert.is(r.totals.total_numeric, 119000);
});

test('calcularTotales: IVA string "19%"', () => {
  const r = calcularTotales(adaptInvoiceData({
    items: [{ code: 'A', name: 'A', quantity: 1, unit_price: 100000 }],
    iva: '19%',
  }));
  assert.is(r.totals.iva, 19000);
});

test('calcularTotales: IVA absoluto (>100)', () => {
  const r = calcularTotales(adaptInvoiceData({
    items: [{ code: 'A', name: 'A', quantity: 1, unit_price: 100000 }],
    iva: 50000,
  }));
  assert.is(r.totals.iva, 50000);
});

test('calcularTotales: descuento porcentaje', () => {
  const r = calcularTotales(adaptInvoiceData({
    items: [{ code: 'A', name: 'A', quantity: 1, unit_price: 100000 }],
    descuento: 10,
  }));
  assert.is(r.totals.descuento, 10000);
  assert.is(r.totals.total_numeric, 90000);
});

test('calcularTotales: descuento porcentaje string "10%"', () => {
  const r = calcularTotales(adaptInvoiceData({
    items: [{ code: 'A', name: 'A', quantity: 1, unit_price: 100000 }],
    descuento: '10%',
  }));
  assert.is(r.totals.descuento, 10000);
  assert.is(r.totals.total_numeric, 90000);
});

test('calcularTotales: descuento en invoice (raíz vs invoice)', () => {
  const r = calcularTotales(adaptInvoiceData({
    items: [{ code: 'A', name: 'A', quantity: 1, unit_price: 100000 }],
    invoice: { descuento: '10%' },
  }));
  assert.is(r.totals.descuento, 10000);
  assert.is(r.totals.total_numeric, 90000);
});

test('calcularTotales: IVA + descuento combinados', () => {
  const r = calcularTotales(adaptInvoiceData({
    items: [{ code: 'A', name: 'A', quantity: 1, unit_price: 100000 }],
    iva: 19,
    descuento: 10,
  }));
  assert.is(r.totals.subtotal, 100000);
  assert.is(r.totals.iva, 19000);
  assert.is(r.totals.descuento, 10000);
  assert.is(r.totals.total_numeric, 109000);
});

test('calcularTotales: total_text es string no vacío', () => {
  const r = calcularTotales(adaptInvoiceData({
    items: [{ code: 'A', name: 'A', quantity: 1, unit_price: 25000 }],
  }));
  assert.ok(typeof r.totals.total_text === 'string');
  assert.ok(r.totals.total_text.length > 0);
});

test('calcularTotales: items con decimales', () => {
  const r = calcularTotales(adaptInvoiceData({
    items: [{ code: 'A', name: 'A', quantity: 1.5, unit_price: 10000 }],
  }));
  assert.is(r.totals.subtotal, 15000);
});

test('calcularTotales: no muta el original', () => {
  const orig = adaptInvoiceData({
    items: [{ code: 'A', name: 'A', quantity: 1, unit_price: 10000 }],
    iva: 19,
  });
  const snap = JSON.stringify(orig);
  calcularTotales(orig);
  assert.is(JSON.stringify(orig), snap);
});

// =============================
// calcularTotales — nueva estructura taxes[]
// =============================

test('calcularTotales: taxes[] array con IVA 19%', () => {
  const r = calcularTotales(adaptInvoiceData({
    items: [{ code: 'A', name: 'A', quantity: 1, unit_price: 100000 }],
    taxes: [{ name: 'IVA', rate: 19 }],
  }));
  assert.is(r.totals.taxes.length, 1);
  assert.is(r.totals.taxes[0].name, 'IVA');
  assert.is(r.totals.taxes[0].amount, 19000);
  assert.is(r.totals.total_taxes, 19000);
  assert.is(r.totals.total_numeric, 119000);
});

test('calcularTotales: taxes[] con múltiples impuestos', () => {
  const r = calcularTotales(adaptInvoiceData({
    items: [{ code: 'A', name: 'A', quantity: 1, unit_price: 100000 }],
    taxes: [
      { name: 'IVA', rate: 19 },
      { name: 'ICA', rate: 0.7 },
    ],
  }));
  assert.is(r.totals.taxes.length, 2);
  assert.is(r.totals.taxes[0].name, 'IVA');
  assert.is(r.totals.taxes[0].amount, 19000);
  assert.is(r.totals.taxes[1].name, 'ICA');
  assert.is(r.totals.taxes[1].amount, 700);
  assert.is(r.totals.total_taxes, 19700);
  assert.is(r.totals.total_numeric, 119700);
});

test('calcularTotales: taxes[] tiene prioridad sobre iva legacy', () => {
  const r = calcularTotales(adaptInvoiceData({
    items: [{ code: 'A', name: 'A', quantity: 1, unit_price: 100000 }],
    taxes: [{ name: 'IVA', rate: 5 }],
    iva: 19, // ignorado porque taxes[] existe
  }));
  assert.is(r.totals.taxes[0].amount, 5000);
  assert.is(r.totals.total_numeric, 105000);
});

test('calcularTotales: descuento global por rate', () => {
  const r = calcularTotales(adaptInvoiceData({
    items: [{ code: 'A', name: 'A', quantity: 1, unit_price: 100000 }],
    discount: { global_rate: 10 },
  }));
  assert.is(r.totals.descuento_global, 10000);
  assert.is(r.totals.global_discount_rate, 10);
  assert.is(r.totals.total_numeric, 90000);
});

test('calcularTotales: descuento global por amount', () => {
  const r = calcularTotales(adaptInvoiceData({
    items: [{ code: 'A', name: 'A', quantity: 1, unit_price: 100000 }],
    discount: { global_amount: 15000 },
  }));
  assert.is(r.totals.descuento_global, 15000);
  assert.is(r.totals.total_numeric, 85000);
});

test('calcularTotales: descuento por item', () => {
  const r = calcularTotales(adaptInvoiceData({
    items: [
      { code: 'A', name: 'A', quantity: 2, unit_price: 50000, discount_rate: 10 },
      { code: 'B', name: 'B', quantity: 1, unit_price: 30000 },
    ],
  }));
  // Item A: 2*50000=100000, desc 10%=10000, subtotal=90000
  // Item B: 1*30000=30000, sin desc, subtotal=30000
  assert.is(r.items[0].item_discount, 10000);
  assert.is(r.items[0].subtotal, 90000);
  assert.is(r.items[1].item_discount, 0);
  assert.is(r.items[1].subtotal, 30000);
  assert.is(r.totals.subtotal, 120000);
  assert.is(r.totals.descuento_items, 10000);
});

test('calcularTotales: descuento global + por item + taxes combinados', () => {
  const r = calcularTotales(adaptInvoiceData({
    items: [
      { code: 'A', name: 'A', quantity: 1, unit_price: 100000, discount_rate: 10 },
    ],
    taxes: [{ name: 'IVA', rate: 19 }],
    discount: { global_rate: 5 },
  }));
  // Item: 100000 - 10% = 90000
  // Subtotal: 90000
  // IVA: 90000 * 19% = 17100
  // Desc global: 90000 * 5% = 4500
  // Total: 90000 + 17100 - 4500 = 102600
  assert.is(r.items[0].subtotal, 90000);
  assert.is(r.totals.subtotal, 90000);
  assert.is(r.totals.taxes[0].amount, 17100);
  assert.is(r.totals.descuento_global, 4500);
  assert.is(r.totals.total_numeric, 102600);
});

test('calcularTotales: item con taxable=false no afecta cálculo (impuestos van al subtotal)', () => {
  // Nota: taxable es un flag informativo por ahora, los impuestos se calculan
  // sobre el subtotal de TODOS los items. El campo existe para futura extensión.
  const r = calcularTotales(adaptInvoiceData({
    items: [
      { code: 'A', name: 'A', quantity: 1, unit_price: 100000, taxable: false },
    ],
    taxes: [{ name: 'IVA', rate: 19 }],
  }));
  // Por ahora taxable no filtra — el IVA se calcula sobre todo el subtotal
  assert.is(r.items[0].taxable, false);
  assert.is(r.totals.subtotal, 100000);
});

test.run();
