const ExcelJS = require("exceljs");
const fs = require("fs");
const xml2js = require("xml2js");
const path = require("path");

// Función para obtener fecha en formato deseado
const obtenerFecha = (fechaXml) => {
    if (!fechaXml) return null;
    const fecha = new Date(fechaXml);
    return fecha.toISOString().split("T")[0];
};

// Función para leer un comprobante (factura o tiquete) desde un XML
const readComprobanteFromXml = async (filePath) => {
    try {
        const xmlData = fs.readFileSync(filePath, "utf-8");
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(xmlData);

        let comprobanteData, tipoTransaccion;
        const nsFactura = "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/facturaElectronica";
        const nsTiquete = "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/tiqueteElectronico";

        if (result["FacturaElectronica"]) {
            comprobanteData = result["FacturaElectronica"];
            tipoTransaccion = "FACT";
        } else if (result["TiqueteElectronico"]) {
            comprobanteData = result["TiqueteElectronico"];
            tipoTransaccion = "TIQ";
        } else {
            throw new Error("El archivo XML no es una factura ni un tiquete electrónico válido.");
        }

        const fechaEmision = obtenerFecha(comprobanteData["FechaEmision"]?.[0]);
        const totalImpuesto = parseFloat(comprobanteData["ResumenFactura"]?.[0]["TotalImpuesto"]?.[0] || "0");
        const totalComprobante = parseFloat(comprobanteData["ResumenFactura"]?.[0]["TotalComprobante"]?.[0] || "0");
        const subTotal = totalComprobante - totalImpuesto;
        const tipoCambio = parseFloat(
            comprobanteData["ResumenFactura"]?.[0]["CodigoTipoMoneda"]?.[0]["TipoCambio"]?.[0] || "1"
        );

        const comprobante = {
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

        return comprobante;
    } catch (error) {
        console.error(`Error al procesar el archivo ${filePath}: ${error.message}`);
        return null;
    }
};

exports.processInvoices = async (files) => {
    const comprobantes = [];

    for (const file of files) {
        const comprobante = await readComprobanteFromXml(file.path);
        if (comprobante) comprobantes.push(comprobante);
    }

    if (comprobantes.length === 0) {
        throw new Error("No se pudieron procesar los archivos.");
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Comprobantes");

    worksheet.columns = [
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

    comprobantes.forEach((comprobante) => worksheet.addRow(comprobante));

    return await workbook.xlsx.writeBuffer();
};