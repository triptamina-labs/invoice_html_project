// -----------------------------------------------------------------------------
// UTILIDADES DE FACTURACIÓN: CÁLCULO DE TOTALES Y CONVERSIÓN DE NÚMEROS A TEXTO
// -----------------------------------------------------------------------------
// Este archivo contiene funciones auxiliares para:
//  - Calcular subtotales, IVA, descuentos y totales de una factura
//  - Convertir números a texto en español (para mostrar el total en letras)
//  - Adaptar cualquier JSON de factura a la estructura estándar esperada
// Todas las funciones son puras y no dependen de frameworks externos.
// -----------------------------------------------------------------------------

// -----------------------------
// CÁLCULO DE TOTALES DE FACTURA
// -----------------------------
/**
 * Calcula los totales de la factura a partir de los items, impuestos y descuentos.
 *
 * Estructura nueva (recomendada):
 *   taxes: [{ name: "IVA", rate: 19 }, { name: "ICA", rate: 0.7 }]
 *   discount: { global_rate: 5 }  o  { global_amount: 50000 }
 *   items[].taxable: true/false (default true)
 *   items[].discount_rate: 10  (descuento individual por item)
 *
 * Estructura legacy (sigue funcionando):
 *   iva: 19  /  descuento: 5
 *
 * @param {Object} data - Datos de la factura
 * @returns {Object} - Datos con totals calculados
 */
function calcularTotales(data) {
  const factura = JSON.parse(JSON.stringify(data));

  // ── Subtotal por item ──
  factura.items = factura.items.map(item => {
    const lineTotal = Number(item.quantity) * Number(item.unit_price);

    // Descuento por item
    let itemDiscount = 0;
    if (item.discount_rate != null && item.discount_rate !== '') {
      const rate = Number(item.discount_rate);
      if (rate > 0 && rate <= 100) {
        itemDiscount = lineTotal * (rate / 100);
      } else if (rate > 100) {
        itemDiscount = rate; // valor absoluto
      }
    }

    const subtotal = lineTotal - itemDiscount;
    return { ...item, subtotal, item_discount: itemDiscount };
  });

  const subtotal = factura.items.reduce((acc, item) => acc + item.subtotal, 0);

  // ── Impuestos ──
  // Soporte nuevo: taxes[] array
  // Soporte legacy: data.iva o data.invoice.iva
  let taxes = [];

  if (Array.isArray(factura.taxes) && factura.taxes.length > 0) {
    // Estructura nueva
    taxes = factura.taxes.map(t => {
      const rate = Number(t.rate) || 0;
      const amount = Math.round(subtotal * (rate / 100));
      return { name: t.name, rate, amount };
    });
  } else {
    // Legacy: campo iva
    let ivaRaw = factura.iva;
    if (typeof ivaRaw === 'undefined' && factura.invoice && typeof factura.invoice.iva !== 'undefined') {
      ivaRaw = factura.invoice.iva;
    }
    const ivaParsed = parseRateOrAmount(ivaRaw, subtotal);
    if (ivaParsed > 0) {
      taxes = [{ name: 'IVA', rate: typeof ivaRaw === 'number' && ivaRaw <= 100 ? ivaRaw : 0, amount: ivaParsed }];
    }
  }

  const totalTaxes = taxes.reduce((acc, t) => acc + t.amount, 0);

  // ── Descuento global ──
  // Nuevo: discount.global_rate o discount.global_amount
  // Legacy: data.descuento o data.invoice.descuento
  let descuentoGlobal = 0;
  let globalDiscountRate = 0;

  if (factura.discount && typeof factura.discount === 'object') {
    if (factura.discount.global_rate != null) {
      globalDiscountRate = Number(factura.discount.global_rate);
      descuentoGlobal = subtotal * (globalDiscountRate / 100);
    } else if (factura.discount.global_amount != null) {
      descuentoGlobal = Number(factura.discount.global_amount);
    }
  } else {
    // Legacy
    let descRaw = factura.descuento;
    if (typeof descRaw === 'undefined' && factura.invoice && typeof factura.invoice.descuento !== 'undefined') {
      descRaw = factura.invoice.descuento;
    }
    descuentoGlobal = parseRateOrAmount(descRaw, subtotal);
    if (descRaw != null && descRaw !== '') {
      const num = Number(String(descRaw).replace('%', ''));
      if (num > 0 && num <= 100) globalDiscountRate = num;
    }
  }

  // ── Descuento por item (ya aplicado, solo para totales) ──
  const itemDiscounts = factura.items.reduce((acc, item) => acc + (item.item_discount || 0), 0);

  // ── Total ──
  const total_numeric = subtotal + totalTaxes - descuentoGlobal;
  const total_text = numeroATexto(total_numeric);

  return {
    ...factura,
    items: factura.items,
    totals: {
      subtotal,
      taxes,            // [{ name, rate, amount }]
      total_taxes: totalTaxes,
      descuento_global: descuentoGlobal,
      global_discount_rate: globalDiscountRate,
      descuento_items: itemDiscounts,
      // Legacy compat
      descuento: descuentoGlobal + itemDiscounts,
      iva: taxes.find(t => t.name === 'IVA')?.amount || 0,
      total_numeric,
      total_text
    }
  };
}

/**
 * Parsea un valor que puede ser porcentaje o monto absoluto.
 * - Número ≤ 100 → porcentaje del subtotal
 * - Número > 100 → valor absoluto
 * - String "19%" → porcentaje
 * - String numérico → porcentaje si ≤ 100, absoluto si > 100
 */
function parseRateOrAmount(raw, base) {
  if (raw == null || raw === '') return 0;
  if (typeof raw === 'number') {
    return raw > 0 && raw <= 100 ? base * (raw / 100) : raw;
  }
  if (typeof raw === 'string') {
    if (raw.endsWith('%')) return base * (parseFloat(raw) / 100);
    const num = Number(raw);
    if (!isNaN(num)) return num > 0 && num <= 100 ? base * (num / 100) : num;
  }
  return 0;
}

// -----------------------------
// CONVERSIÓN DE NÚMERO A TEXTO (ESPAÑOL)
// -----------------------------
/**
 * Convierte un número a texto en español (solo enteros hasta millones).
 * Ejemplo: 1234.56 => "MIL DOSCIENTOS TREINTA Y CUATRO 56/100"
 *
 * @param {number} num - Número a convertir
 * @returns {string} - Representación en texto en mayúsculas
 */
function numeroATexto(num) {
  // Implementación simple para números enteros hasta millones
  // Puedes reemplazar por una librería si se requiere más robustez
  const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
  const DECENAS = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const CENTENAS = ['', 'cien', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
  if (typeof num !== 'number' || isNaN(num)) return '';
  const entero = Math.floor(num);
  if (entero === 0) return 'cero';
  if (entero > 999999999) return 'número demasiado grande';
  // Función recursiva para descomponer el número
  function convertir(n) {
    if (n < 10) return UNIDADES[n];
    if (n < 100) {
      if (n % 10 === 0) return DECENAS[Math.floor(n/10)];
      return DECENAS[Math.floor(n/10)] + ' y ' + UNIDADES[n%10];
    }
    if (n < 1000) {
      if (n === 100) return 'cien';
      return CENTENAS[Math.floor(n/100)] + (n%100 > 0 ? ' ' + convertir(n%100) : '');
    }
    if (n < 1000000) {
      if (n === 1000) return 'mil';
      if (n < 2000) return 'mil ' + convertir(n%1000);
      return convertir(Math.floor(n/1000)) + ' mil' + (n%1000 > 0 ? ' ' + convertir(n%1000) : '');
    }
    if (n < 1000000000) {
      if (n === 1000000) return 'un millón';
      if (n < 2000000) return 'un millón ' + convertir(n%1000000);
      return convertir(Math.floor(n/1000000)) + ' millones' + (n%1000000 > 0 ? ' ' + convertir(n%1000000) : '');
    }
    return '';
  }
  // Agregar decimales si existen
  const decimales = Math.round((num - entero) * 100);
  let texto = convertir(entero).toUpperCase();
  if (decimales > 0) {
    texto += ' ' + decimales + '/100';
  } else {
    texto += ' 00/100';
  }
  return texto;
}

// -----------------------------
// ADAPTACIÓN DE DATOS DE FACTURA
// -----------------------------
/**
 * Adapta cualquier JSON de factura (simple o completo) a la estructura estándar esperada por la plantilla.
 * Rellena con valores por defecto si faltan campos, y normaliza los items.
 *
 * @param {Object} data - Objeto de datos de la factura (puede ser simple o completo)
 * @returns {Object} - Objeto adaptado con estructura estándar
 */
function adaptInvoiceData(data) {
  // Valores por defecto para cada sección
  const defaultCompany = {
    name: '', logo: '', logo_small: '', tax_id: '', phone: '', city: '', website: ''
  };
  const defaultClient = {
    name: '', id: '', address: '', nit: '', code: ''
  };
  const defaultInvoice = {
    type: '', number: '', place: '', date: '', expiry_date: '', seller: '', conditions: '', reference: '', delivery: '', iva: '', descuento: ''
  };
  // Adaptar items: normaliza nombres de campos y valores por defecto
  const adaptItems = (items) => (items || []).map(item => ({
    code: item.code || '',
    name: item.name || item.description || '',
    details: item.details || [],
    quantity: item.quantity || 0,
    unit_price: item.unit_price || item.price || 0,
    taxable: item.taxable !== undefined ? item.taxable : true,
    discount_rate: item.discount_rate || 0
  }));
  // Construir objeto adaptado
  return {
    company: { ...defaultCompany, ...(data.company || {}) },
    client: { ...defaultClient, ...(data.client || {}) },
    invoice: { ...defaultInvoice, ...(data.invoice || {}) },
    items: adaptItems(data.items),
    // Nuevo: taxes[] y discount{}
    taxes: data.taxes || [],
    discount: data.discount || null,
    // Legacy compat
    iva: data.iva || (data.invoice && data.invoice.iva) || '',
    descuento: data.descuento || (data.invoice && data.invoice.descuento) || '',
    observations: data.observations || []
  };
}

// -----------------------------
// EXPORTACIÓN DE FUNCIONES
// -----------------------------
export { calcularTotales, numeroATexto, adaptInvoiceData }; 