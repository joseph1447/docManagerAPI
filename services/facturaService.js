const fs = require("fs");
const ExcelJS = require("exceljs");
const xml2js = require("xml2js");

// The "Comprobantes" sheet is consumed by the client's accounting workflow: do not change
// headers, order or keys without coordinating it (test/excelCompat.test.js guards this).
const COLUMNS = [
    { header: "No. Factura", key: "NoFactura", width: 15 },
    { header: "Tipo de Transacción", key: "TipoTransaccion", width: 20 },
    { header: "Proveedor", key: "Proveedor", width: 30 },
    { header: "Grupo de Facturación", key: "GrupoFacturacion", width: 25 },
    { header: "Términos de Pago", key: "TerminoPago", width: 20 },
    { header: "Fecha", key: "Fecha", width: 15 },
    { header: "Descripción", key: "Descripcion", width: 40 },
    { header: "SubTotal", key: "SubTotal", width: 15 },
    { header: "Impuesto", key: "Impuesto", width: 15 },
    { header: "Monto Total", key: "MontoTotal", width: 15 },
    { header: "Cuenta Contable", key: "CuentaContable", width: 20 },
    { header: "Dividir Monto", key: "DividirMonto", width: 15 },
    { header: "Tipo de Cambio (Transacción)", key: "TipoCambioTransaccion", width: 25 },
    { header: "Tipo de Cambio (Cuenta Contable)", key: "TipoCambioCuentaContable", width: 25 },
    { header: "Sucursal", key: "Sucursal", width: 20 },
    { header: "Departamento", key: "Departamento", width: 20 },
    { header: "Unidad de Negocio", key: "UnidadNegocio", width: 20 },
];

const SUPPORTED_DOCUMENTS = {
    FacturaElectronica: "FACT",
    TiqueteElectronico: "TIQ",
};

const ONLY_FACT_TIQ = "Por ahora el sistema solo procesa Facturas Electrónicas y Tiquetes Electrónicos.";

const UNSUPPORTED_DOCUMENTS = {
    MensajeHacienda: {
        message: "Este XML es la respuesta de Hacienda (aceptación o rechazo del comprobante), no la factura.",
        hint: "Con cada factura el proveedor suele enviar dos XML. Sube el de la factura y omite el de la respuesta de Hacienda.",
    },
    MensajeReceptor: {
        message: "Este XML es un mensaje de confirmación del receptor (aceptación o rechazo), no un comprobante.",
        hint: "Sube el XML de la factura o tiquete original.",
    },
    NotaCreditoElectronica: {
        message: `Este XML es una Nota de Crédito Electrónica. ${ONLY_FACT_TIQ}`,
        hint: "Registra la nota de crédito manualmente por ahora.",
    },
    NotaDebitoElectronica: {
        message: `Este XML es una Nota de Débito Electrónica. ${ONLY_FACT_TIQ}`,
        hint: "Registra la nota de débito manualmente por ahora.",
    },
    FacturaElectronicaCompra: {
        message: `Este XML es una Factura Electrónica de Compra. ${ONLY_FACT_TIQ}`,
        hint: "Registra este comprobante manualmente por ahora.",
    },
    FacturaElectronicaExportacion: {
        message: `Este XML es una Factura Electrónica de Exportación. ${ONLY_FACT_TIQ}`,
        hint: "Registra este comprobante manualmente por ahora.",
    },
};

const DOWNLOAD_AGAIN_HINT =
    "Descarga el XML de nuevo desde el correo o portal del proveedor. Si el problema continúa, pide al proveedor que lo reenvíe.";

// sax (used by xml2js) reports errors in English; translate the common ones for end users.
const PARSER_MESSAGES = [
    [/^Unexpected close tag/, "Hay una etiqueta de cierre que no corresponde con la etiqueta abierta"],
    [/^Unclosed root tag/, "El archivo termina sin cerrar la etiqueta principal (parece incompleto o cortado)"],
    [/^Non-whitespace before first tag/, "Hay contenido antes de la primera etiqueta XML"],
    [/^Text data outside of root node/, "Hay texto fuera de la etiqueta principal del documento"],
    [/^Invalid character (in entity name|entity)/, "Hay un carácter '&' o una entidad inválida"],
    [/^(Unquoted attribute value|Attribute without value|Invalid attribute name)/, "Hay un atributo mal formado"],
    [/^Invalid tagname/, "Hay una etiqueta con un nombre inválido"],
    [/^Unexpected end/, "El archivo termina de forma inesperada (parece incompleto o cortado)"],
];

class InvoiceFileError extends Error {
    constructor(code, message, { hint, details } = {}) {
        super(message);
        this.name = "InvoiceFileError";
        this.code = code;
        this.hint = hint;
        this.details = details;
    }
}

const describeParserError = (error) => {
    const raw = String(error.message || error);
    const [firstLine] = raw.split("\n");
    const line = raw.match(/Line:\s*(\d+)/);
    const column = raw.match(/Column:\s*(\d+)/);
    const translated = PARSER_MESSAGES.find(([pattern]) => pattern.test(firstLine))?.[1] || firstLine;
    // sax lines are 0-based; editors show them 1-based.
    const position = line ? ` (línea ${Number(line[1]) + 1}${column ? `, columna ${column[1]}` : ""})` : "";
    const reason = translated.charAt(0).toLowerCase() + translated.slice(1);
    return {
        message: `El archivo no es un XML válido${position}: ${reason}.`,
        details: { parserMessage: raw, line: line ? Number(line[1]) + 1 : null, column: column ? Number(column[1]) : null },
    };
};

const decodeBuffer = (buffer) => {
    if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.toString("utf16le");
    if (buffer[0] === 0xfe && buffer[1] === 0xff) return Buffer.from(buffer).swap16().toString("utf16le");
    return buffer.toString("utf-8");
};

const assertLooksLikeXml = (buffer, text) => {
    if (buffer.length === 0 || text.trim() === "") {
        throw new InvoiceFileError("EMPTY_FILE", "El archivo está vacío.", { hint: DOWNLOAD_AGAIN_HINT });
    }
    if (buffer.subarray(0, 4).toString("latin1") === "%PDF") {
        throw new InvoiceFileError("NOT_XML", "El archivo tiene extensión .xml pero en realidad es un PDF.", {
            hint: "Sube el XML del comprobante, no el PDF.",
        });
    }
    if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
        throw new InvoiceFileError("NOT_XML", "El archivo es un comprimido (ZIP), no un XML.", {
            hint: "Descomprímelo y sube los XML que contiene.",
        });
    }
    if (/^\s*(<!doctype html|<html)/i.test(text)) {
        throw new InvoiceFileError("NOT_XML", "El archivo es una página web (HTML), no un comprobante XML.", {
            hint: "Probablemente se descargó una página de error del portal. " + DOWNLOAD_AGAIN_HINT,
        });
    }
};

const parseXml = async (text) => {
    try {
        return await new xml2js.Parser().parseStringPromise(text);
    } catch (error) {
        const { message, details } = describeParserError(error);
        throw new InvoiceFileError("INVALID_XML", message, { hint: DOWNLOAD_AGAIN_HINT, details });
    }
};

const resolveDocument = (parsed) => {
    const rootName = parsed ? Object.keys(parsed)[0] : undefined;
    if (rootName && SUPPORTED_DOCUMENTS[rootName]) {
        return { rootName, tipoTransaccion: SUPPORTED_DOCUMENTS[rootName], data: parsed[rootName] };
    }
    const known = UNSUPPORTED_DOCUMENTS[rootName];
    if (known) {
        throw new InvoiceFileError("UNSUPPORTED_DOCUMENT", known.message, {
            hint: known.hint,
            details: { rootElement: rootName },
        });
    }
    throw new InvoiceFileError(
        "UNSUPPORTED_DOCUMENT",
        `El XML no es un comprobante electrónico de Hacienda (su etiqueta principal es <${rootName}>).`,
        {
            hint: "Verifica que sea el XML de una factura o tiquete electrónico de Costa Rica.",
            details: { rootElement: rootName },
        }
    );
};

const toIsoDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new InvoiceFileError("INVALID_DATE", `La fecha de emisión "${value}" no es una fecha válida.`, {
            hint: "Revisa la etiqueta <FechaEmision> del XML o pide al proveedor que reenvíe el comprobante.",
            details: { field: "FechaEmision", value },
        });
    }
    return date.toISOString().split("T")[0];
};

const REQUIRED_FIELDS = [
    ["NumeroConsecutivo", (d) => d["NumeroConsecutivo"]?.[0]],
    ["FechaEmision", (d) => d["FechaEmision"]?.[0]],
    ["Emisor/Nombre", (d) => d["Emisor"]?.[0]["Nombre"]?.[0]],
    ["ResumenFactura/TotalComprobante", (d) => d["ResumenFactura"]?.[0]["TotalComprobante"]?.[0]],
];

const NUMERIC_FIELDS = [
    ["ResumenFactura/TotalComprobante", (d) => d["ResumenFactura"]?.[0]["TotalComprobante"]?.[0]],
    ["ResumenFactura/TotalImpuesto", (d) => d["ResumenFactura"]?.[0]["TotalImpuesto"]?.[0]],
    ["ResumenFactura/CodigoTipoMoneda/TipoCambio", (d) => d["ResumenFactura"]?.[0]["CodigoTipoMoneda"]?.[0]["TipoCambio"]?.[0]],
];

const collectWarnings = (data) => {
    const warnings = [];
    const missing = REQUIRED_FIELDS.filter(([, read]) => !read(data)).map(([field]) => field);
    if (missing.length > 0) {
        warnings.push({
            code: "MISSING_FIELDS",
            message: `Faltan datos en el XML: ${missing.join(", ")}. La fila se generó con esas columnas vacías o en 0.`,
            hint: "Revisa esa fila en el Excel antes de usarla.",
            details: { fields: missing },
        });
    }
    for (const [field, read] of NUMERIC_FIELDS) {
        const value = read(data);
        if (typeof value === "string" && value && Number.isNaN(parseFloat(value))) {
            warnings.push({
                code: "INVALID_AMOUNT",
                message: `El valor "${value}" en ${field} no es un número.`,
                hint: "Revisa ese monto en el Excel.",
                details: { field, value },
            });
        }
    }
    return warnings;
};

// Builds the row exactly as the original implementation did (see test/legacy).
const buildRow = (comprobanteData, tipoTransaccion) => {
    const fechaEmision = toIsoDate(comprobanteData["FechaEmision"]?.[0]);
    const totalImpuesto = parseFloat(comprobanteData["ResumenFactura"]?.[0]["TotalImpuesto"]?.[0] || "0");
    const totalComprobante = parseFloat(comprobanteData["ResumenFactura"]?.[0]["TotalComprobante"]?.[0] || "0");
    const subTotal = totalComprobante - totalImpuesto;
    const tipoCambio = parseFloat(
        comprobanteData["ResumenFactura"]?.[0]["CodigoTipoMoneda"]?.[0]["TipoCambio"]?.[0] || "1"
    );

    return {
        NoFactura: comprobanteData["NumeroConsecutivo"]?.[0],
        TipoTransaccion: tipoTransaccion,
        Proveedor: comprobanteData["Emisor"]?.[0]["Nombre"]?.[0],
        GrupoFacturacion:
            comprobanteData["ResumenFactura"]?.[0]["CodigoTipoMoneda"]?.[0]["CodigoMoneda"]?.[0] === "USD"
                ? "Proveedores Locales (USD)"
                : "Proveedores Locales (CRC)",
        TerminoPago: "Contado",
        Fecha: fechaEmision,
        Descripcion:
            comprobanteData["DetalleServicio"]?.[0]["LineaDetalle"]?.[0]["Detalle"]?.[0]?.replace("null-", "") || "",
        SubTotal: subTotal,
        Impuesto: totalImpuesto,
        MontoTotal: totalComprobante,
        DividirMonto: subTotal,
        CuentaContable: "600-001-007-003",
        TipoCambioTransaccion: tipoCambio,
        TipoCambioCuentaContable: tipoCambio,
        Sucursal: "",
        Departamento: "",
        UnidadNegocio: "",
    };
};

const readText = (value) => (typeof value === "string" ? value : undefined);

/**
 * Parses one XML buffer. Returns { row, meta, warnings } or throws InvoiceFileError.
 */
const parseComprobante = async (buffer) => {
    const text = decodeBuffer(buffer);
    assertLooksLikeXml(buffer, text);
    const parsed = await parseXml(text);
    const { rootName, tipoTransaccion, data } = resolveDocument(parsed);
    const row = buildRow(data, tipoTransaccion);
    const version = readText(data.$?.xmlns)?.match(/\/v(\d+(?:\.\d+)*)\//)?.[1] || null;
    const meta = {
        documentType: rootName,
        version,
        clave: readText(data["Clave"]?.[0]) || null,
        consecutivo: readText(row.NoFactura) || null,
        emisor: readText(row.Proveedor) || null,
        emisorId: readText(data["Emisor"]?.[0]?.["Identificacion"]?.[0]?.["Numero"]?.[0]) || null,
    };
    return { row, meta, warnings: collectWarnings(data) };
};

const toReportError = (error) => {
    if (error instanceof InvoiceFileError) {
        return { code: error.code, message: error.message, hint: error.hint || null, details: error.details || null };
    }
    return {
        code: "UNEXPECTED_PARSE_ERROR",
        message: "Ocurrió un error inesperado al leer el comprobante.",
        hint: "Copia el reporte de errores y envíalo a soporte junto con este XML.",
        details: { errorName: error.name, errorMessage: error.message },
    };
};

const buildWorkbook = async (rows) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Comprobantes");
    worksheet.columns = COLUMNS;
    rows.forEach((row) => worksheet.addRow(row));
    return workbook.xlsx.writeBuffer();
};

/**
 * @param {{ originalname: string, buffer?: Buffer, path?: string }[]} files multer files (disk or memory storage).
 * @returns {Promise<{ buffer: Buffer|null, report: object }>} buffer is null when no file could be processed.
 */
exports.processInvoices = async (files) => {
    const rows = [];
    const entries = [];
    const seen = new Map();

    for (const [index, file] of files.entries()) {
        const entry = { index, fileName: file.originalname, status: "ok", error: null, warnings: [] };
        try {
            // One file in memory at a time, whatever the batch size.
            const content = file.buffer ?? (await fs.promises.readFile(file.path));
            const { row, meta, warnings } = await parseComprobante(content);
            Object.assign(entry, meta);
            entry.warnings = warnings;

            const identity = meta.clave || (meta.emisorId && meta.consecutivo ? `${meta.emisorId}-${meta.consecutivo}` : null);
            if (identity && seen.has(identity)) {
                entry.warnings.push({
                    code: "DUPLICATE_DOCUMENT",
                    message: `Este comprobante${meta.consecutivo ? ` (${meta.consecutivo})` : ""} es el mismo que el archivo "${seen.get(identity)}". Aparecerá dos veces en el Excel.`,
                    hint: "Quita uno de los dos archivos si no quieres la fila duplicada.",
                    details: { duplicateOf: seen.get(identity) },
                });
            } else if (identity) {
                seen.set(identity, file.originalname);
            }

            if (entry.warnings.length > 0) entry.status = "warning";
            rows.push(row);
        } catch (error) {
            entry.status = "error";
            entry.error = toReportError(error);
        }
        entries.push(entry);
    }

    const failed = entries.filter((e) => e.status === "error").length;
    const report = {
        summary: {
            total: entries.length,
            processed: entries.length - failed,
            failed,
            withWarnings: entries.filter((e) => e.status === "warning").length,
        },
        files: entries,
    };

    return { buffer: rows.length > 0 ? await buildWorkbook(rows) : null, report };
};

exports.parseComprobante = parseComprobante;
exports.InvoiceFileError = InvoiceFileError;
exports.COLUMNS = COLUMNS;
