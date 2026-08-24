// -----------------------------------------------------------------------------
// TESTS DE INTEGRACIÓN — API REST
// -----------------------------------------------------------------------------
// Levanta el servidor él mismo en un puerto efímero (listen(0)); no requiere
// un proceso externo corriendo. Ejecutar con: pnpm run test
// -----------------------------------------------------------------------------

import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { fetch } from 'undici';

const { app } = await import('../src/api/server.js');
const API_KEY = 'supersecretkey';

let server;
let API_URL;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address();
      API_URL = `http://localhost:${port}/generate-invoice`;
      resolve();
    });
  });
});

test.after(() => {
  if (server) server.close();
});

/** Helper: payload mínimo válido */
function validPayload(overrides = {}) {
  return {
    client: { name: 'Cliente Test', nit: '900123456', code: 'C001' },
    invoice: { type: 'Cotización', number: '436', place: 'Tunja', date: '2025-01-01', conditions: 'Contado' },
    items: [{ code: 'P001', name: 'Producto A', quantity: 2, unit_price: 50000 }],
    ...overrides,
  };
}

// =============================
// AUTENTICACIÓN
// =============================

test('auth: rechaza sin API Key', async () => {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload()),
  });
  assert.is(res.status, 401);
  const json = await res.json();
  assert.equal(json.error, 'No autorizado');
  assert.ok(json.details.includes('API Key inválida o ausente'));
});

test('auth: rechaza con API Key incorrecta', async () => {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': 'wrong-key' },
    body: JSON.stringify(validPayload()),
  });
  assert.is(res.status, 401);
  const json = await res.json();
  assert.equal(json.error, 'No autorizado');
});

// =============================
// GENERACIÓN DE PDF
// =============================

test('generación: produce PDF válido con datos mínimos', async () => {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify(validPayload()),
  });
  assert.is(res.status, 200);
  assert.is(res.headers.get('content-type'), 'application/pdf');
  assert.is(res.headers.get('content-disposition'), 'attachment; filename=factura.pdf');

  const buf = Buffer.from(await res.arrayBuffer());
  assert.ok(buf.length > 100, `PDF tiene tamaño razonable: ${buf.length} bytes`);
  assert.is(buf.toString('utf8', 0, 5), '%PDF-', 'Header PDF válido');
});

test('generación: PDF con múltiples items', async () => {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify(validPayload({
      items: [
        { code: 'A', name: 'Producto A', quantity: 2, unit_price: 50000 },
        { code: 'B', name: 'Producto B', quantity: 1, unit_price: 120000 },
        { code: 'C', name: 'Producto C', quantity: 5, unit_price: 8000 },
      ],
    })),
  });
  assert.is(res.status, 200);
  const buf = Buffer.from(await res.arrayBuffer());
  assert.is(buf.toString('utf8', 0, 5), '%PDF-');
});

test('generación: PDF con IVA y descuento', async () => {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify(validPayload({
      items: [{ code: 'X', name: 'Servicio', quantity: 1, unit_price: 500000 }],
      invoice: { type: 'Factura', number: '100', place: 'Bogotá', date: '2025-06-01', conditions: 'Crédito', iva: 19, descuento: 5 },
    })),
  });
  assert.is(res.status, 200);
  const buf = Buffer.from(await res.arrayBuffer());
  assert.is(buf.toString('utf8', 0, 5), '%PDF-');
});

test('generación: PDF con items con details', async () => {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify(validPayload({
      items: [{
        code: 'TL-INS-E',
        name: 'Empaque Unión VITON 6"',
        details: ['Material: VITON', 'Diámetro: 6"', 'Rango temperatura: -26°C a +222°C'],
        quantity: 2,
        unit_price: 570000,
      }],
    })),
  });
  assert.is(res.status, 200);
  const buf = Buffer.from(await res.arrayBuffer());
  assert.is(buf.toString('utf8', 0, 5), '%PDF-');
});

test('generación: PDF con observaciones', async () => {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify(validPayload({
      observations: ['Primera observación', 'Segunda observación'],
    })),
  });
  assert.is(res.status, 200);
  const buf = Buffer.from(await res.arrayBuffer());
  assert.is(buf.toString('utf8', 0, 5), '%PDF-');
});

// =============================
// VALIDACIÓN
// =============================

test('validación: rechaza sin client', async () => {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({ invoice: { type: 'F', number: '1', place: 'X', date: '2025-01-01' }, items: [{ code: 'A', name: 'A', quantity: 1, unit_price: 1 }] }),
  });
  assert.is(res.status, 400);
  const json = await res.json();
  assert.equal(json.error, 'Datos de factura inválidos');
  assert.ok(json.details.length > 0, 'Tiene detalles de error');
});

test('validación: rechaza sin items', async () => {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({ client: { name: 'Test', nit: '1', code: 'X' }, invoice: { type: 'F', number: '1', place: 'X', date: '2025-01-01' }, items: [] }),
  });
  assert.ok(res.status === 400 || res.status === 429, `Expected 400 or 429, got ${res.status}`);
});

test('validación: rechaza item sin quantity', async () => {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({ client: { name: 'Test', nit: '1', code: 'X' }, invoice: { type: 'F', number: '1', place: 'X', date: '2025-01-01' }, items: [{ code: 'A', name: 'A', unit_price: 1 }] }),
  });
  assert.ok(res.status === 400 || res.status === 429, `Expected 400 or 429, got ${res.status}`);
});

test('validación: rechaza body no-JSON', async () => {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', 'x-api-key': API_KEY },
    body: 'not json',
  });
  assert.ok(res.status >= 400, `Status ${res.status} es error`);
});

test.run();
