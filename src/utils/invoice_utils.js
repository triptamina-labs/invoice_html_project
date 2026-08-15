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
 * Calcula los totales de la factura a partir de los items y los campos opcionales de IVA y descuento.
 * Permite que IVA y descuento sean porcentajes (ej: 19, "19%") o valores absolutos.
 *
 * @param {Object} data - Objeto de datos de la factura (company, client, items, iva, descuento, etc.)
 * @returns {Object} - Objeto con los campos calculados: items (con subtotal), totals: {subtotal, iva, descuento, total_numeric, total_text}
 */
function calcularTotales(data) {
  // Copia profunda para no mutar el original
  const factura = JSON.parse(JSON.stringify(data));

  // Permitir que iva y descuento estén en la raíz o en invoice
  // Prioridad: raíz > invoice
  let ivaRaw = factura.iva;
  let descuentoRaw = factura.descuento;
  if (typeof ivaRaw === 'undefined' && factura.invoice && typeof factura.invoice.iva !== 'undefined') {
    ivaRaw = factura.invoice.iva;
  }
  if (typeof descuentoRaw === 'undefined' && factura.invoice && typeof factura.invoice.descuento !== 'undefined') {
    descuentoRaw = factura.invoice.descuento;
  }

  // Calcular subtotal y total de cada item
  factura.items = factura.items.map(item => {
    const subtotal = Number(item.quantity) * Number(item.unit_price);
    return { ...item, subtotal };
  });
  // Subtotal general
  const subtotal = factura.items.reduce((acc, item) => acc + item.subtotal, 0);

  // === IVA ===
  // Puede ser porcentaje (ej: 19, "19%") o valor absoluto
  let iva = 0;
  if (typeof ivaRaw !== 'undefined' && ivaRaw !== null && ivaRaw !== '') {
    if (typeof ivaRaw === 'number') {
      // Si es número entero y <=100, se interpreta como porcentaje
      if (ivaRaw > 0 && ivaRaw <= 100) {
        iva = subtotal * (ivaRaw / 100);
      } else {
        iva = ivaRaw; // valor absoluto
      }
    } else if (typeof ivaRaw === 'string') {
      if (ivaRaw.endsWith('%')) {
        iva = subtotal * (parseFloat(ivaRaw) / 100);
      } else if (!isNaN(Number(ivaRaw))) {
        // Si es string numérico, se interpreta como porcentaje
        const num = Number(ivaRaw);
        if (num > 0 && num <= 100) {
          iva = subtotal * (num / 100);
        } else {
          iva = num; // valor absoluto
        }
      } else {
        iva = 0;
      }
    }
  }

  // === Descuento ===
  // Puede ser porcentaje (ej: 10, "10%") o valor absoluto
  let descuento = 0;
  if (typeof descuentoRaw !== 'undefined' && descuentoRaw !== null && descuentoRaw !== '') {
    if (typeof descuentoRaw === 'number') {
      // Si es número entero y <=100, se interpreta como porcentaje
      if (descuentoRaw > 0 && descuentoRaw <= 100) {
        descuento = subtotal * (descuentoRaw / 100);
      } else {
        descuento = descuentoRaw; // valor absoluto
      }
    } else if (typeof descuentoRaw === 'string') {
      if (descuentoRaw.endsWith('%')) {
        descuento = subtotal * (parseFloat(descuentoRaw) / 100);
      } else if (!isNaN(Number(descuentoRaw))) {
        // Si es string numérico, se interpreta como porcentaje
        const num = Number(descuentoRaw);
        if (num > 0 && num <= 100) {
          descuento = subtotal * (num / 100);
        } else {
          descuento = num; // valor absoluto
        }
      } else {
        descuento = 0;
      }
    }
  }

  // Total numérico
  const total_numeric = subtotal + iva - descuento;
  // Total en texto (en letras)
  const total_text = numeroATexto(total_numeric);
  return {
    ...factura,
    items: factura.items,
    totals: {
      subtotal,
      iva,
      descuento,
      total_numeric,
      total_text
    }
  };
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
    unit_price: item.unit_price || item.price || 0
  }));
  // Construir objeto adaptado
  return {
    company: { ...defaultCompany, ...(data.company || {}) },
    client: { ...defaultClient, ...(data.client || {}) },
    invoice: { ...defaultInvoice, ...(data.invoice || {}) },
    items: adaptItems(data.items),
    iva: data.iva || (data.invoice && data.invoice.iva) || '',
    descuento: data.descuento || (data.invoice && data.invoice.descuento) || '',
    observations: data.observations || []
  };
}

// -----------------------------
// EXPORTACIÓN DE FUNCIONES
// -----------------------------
export { calcularTotales, numeroATexto, adaptInvoiceData }; 