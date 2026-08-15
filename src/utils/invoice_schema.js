// -----------------------------------------------------------------------------
// ESQUEMA DE VALIDACIÓN DE FACTURAS CON JOI PARA EXPRESS
// -----------------------------------------------------------------------------
// Este archivo define el esquema de validación para los datos de una factura,
// usando la librería Joi. Permite validar tanto valores numéricos como porcentajes
// en campos como IVA y descuento, y asegura que la estructura de la factura sea
// la esperada antes de procesarla o guardarla.
// Incluye un middleware para Express que puede usarse directamente en rutas.
// -----------------------------------------------------------------------------

// -----------------------------
// IMPORTACIÓN DE DEPENDENCIAS
// -----------------------------
import Joi from 'joi'; // Librería de validación de esquemas

// -----------------------------
// ESQUEMA PERSONALIZADO PARA CAMPOS NUMÉRICOS O PORCENTAJE
// -----------------------------
/**
 * Permite que un campo sea:
 *  - Un número positivo (valor absoluto o porcentaje)
 *  - Un string que puede ser un número o un porcentaje (ej: "19%")
 * Ejemplos válidos: 50000, 19, "19%", "0%"
 */
const amountOrPercentSchema = Joi.alternatives().try(
    Joi.number().positive().allow(0),
    Joi.string().pattern(/^[0-9]+(?:\.[0-9]+)?%?$/)
);

// -----------------------------
// ESQUEMA PRINCIPAL DE FACTURA
// -----------------------------
/**
 * Define la estructura esperada para los datos de una factura.
 * Valida la presencia y formato de cada campo relevante.
 */
const invoiceSchema = Joi.object({
    company: Joi.object({
        name: Joi.string().allow(''),
        logo: Joi.string().allow(''),
        logo_small: Joi.string().allow(''),
        tax_id: Joi.string().allow(''),
        phone: Joi.string().allow(''),
        city: Joi.string().allow(''),
        website: Joi.string().allow('')
    }).optional(),

    client: Joi.object({
        name: Joi.string().required(), // Nombre del cliente (obligatorio)
        nit: Joi.string().allow('').required(), // NIT o identificación (puede ser vacío)
        code: Joi.string().allow('').required() // Código de cliente (puede ser vacío)
    }).required(),

    invoice: Joi.object({
        type: Joi.string().required(), // Tipo de factura (ej: "venta")
        number: Joi.string().required(), // Número de factura
        place: Joi.string().required(), // Lugar de emisión
        date: Joi.string().required(), // Fecha de emisión
        expiry_date: Joi.string().allow(''), // Fecha de vencimiento (opcional)
        seller: Joi.string().allow(''), // Vendedor (opcional)
        conditions: Joi.string().allow(''), // Condiciones de pago (opcional)
        reference: Joi.string().allow(''), // Referencia (opcional)
        delivery: Joi.string().allow(''), // Entrega (opcional)
        // Usamos el esquema personalizado para iva y descuento
        iva: amountOrPercentSchema.optional(),
        descuento: amountOrPercentSchema.optional()
    }).required(),

    items: Joi.array().items(Joi.object({
        code: Joi.string().required(), // Código del producto/servicio
        name: Joi.string().required(), // Nombre del producto/servicio
        details: Joi.array().items(Joi.string()).optional(), // Detalles adicionales (opcional)
        quantity: Joi.number().positive().required(), // Cantidad (debe ser > 0)
        unit_price: Joi.number().min(0).required() // Precio unitario (>= 0)
    })).min(1).required(), // Debe haber al menos un item

    observations: Joi.array().items(Joi.string()).optional() // Observaciones adicionales (opcional)
});

// -----------------------------
// MIDDLEWARE DE VALIDACIÓN PARA EXPRESS
// -----------------------------
/**
 * Middleware para validar el cuerpo de la petición contra el esquema de factura.
 * Si los datos no cumplen el esquema, responde con error 400 y detalles.
 * Si son válidos, llama a next() para continuar con la ruta.
 * @param {Request} req - Objeto de petición de Express
 * @param {Response} res - Objeto de respuesta de Express
 * @param {Function} next - Siguiente middleware
 */
const validateInvoice = (req, res, next) => {
    const { error } = invoiceSchema.validate(req.body, { abortEarly: false });
    if (error) {
        const errorDetails = error.details.map(detail => detail.message);
        return res.status(400).json({ error: 'Datos de factura inválidos', details: errorDetails });
    }
    next();
};

// -----------------------------
// EXPORTACIÓN DEL MIDDLEWARE
// -----------------------------
export { validateInvoice };
