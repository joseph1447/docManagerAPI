const ExcelJS = require("exceljs");

const fs = require("fs");
const xml2js = require("xml2js");
const path = require("path");

// Función para obtener fecha en formato deseado
const obtenerFecha = (fechaXml) => {
    if (!fechaXml) return null;
    // Convierte la fecha del XML al formato deseado
    const fecha = new Date(fechaXml);
    return fecha.toISOString().split("T")[0]; // Retorna formato YYYY-MM-DD
  };
  
  // Función para leer una factura desde un XML
  const readFacturaFromXml = async (filePath) => {
    try {
      const xmlData = fs.readFileSync(filePath, "utf-8");
  
      // Parseamos el XML a un objeto JS
      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(xmlData);
  
      const ns = "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/facturaElectronica";
      const facturaData = result["FacturaElectronica"];
  
      // Obtener campos necesarios
      const fechaEmision = obtenerFecha(facturaData["FechaEmision"]?.[0]);
      const totalImpuesto = parseFloat(facturaData["ResumenFactura"]?.[0]["TotalImpuesto"]?.[0] || "0");
      const totalComprobante = parseFloat(facturaData["ResumenFactura"]?.[0]["TotalComprobante"]?.[0] || "0");
      const subTotal = totalComprobante - totalImpuesto;
      const tipoCambio = parseFloat(
        facturaData["ResumenFactura"]?.[0]["CodigoTipoMoneda"]?.[0]["TipoCambio"]?.[0] || "1"
      );
  
      // Construimos la factura
      const factura = {
        NoFactura: facturaData["NumeroConsecutivo"]?.[0],
        TipoTransaccion: "FACT",
        Proveedor: facturaData["Emisor"]?.[0]["Nombre"]?.[0],
        GrupoFacturacion:
          facturaData["ResumenFactura"]?.[0]["CodigoTipoMoneda"]?.[0]["CodigoMoneda"]?.[0] === "USD"
            ? "Proveedores Locales (USD)"
            : "Proveedores Locales (CRC)",
        TerminoPago: "Contado",
        Fecha: fechaEmision,
        Descripcion:
          facturaData["DetalleServicio"]?.[0]["LineaDetalle"]?.[0]["Detalle"]?.[0]?.replace("null-", "") || "",
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
  
      return factura;
    } catch (error) {
      console.error(`Error al procesar el archivo ${filePath}: ${error.message}`);
      return null;
    }
  };
  

exports.processInvoices = async (files) => {
  const facturas = [];

  for (const file of files) {
    const factura = await readFacturaFromXml(file.path);
    if (factura) facturas.push(factura);
  }

  if (facturas.length === 0) {
    throw new Error("No se pudieron procesar los archivos.");
  }

  // Crear archivo Excel con los datos de las facturas
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Facturas");

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

  facturas.forEach((factura) => worksheet.addRow(factura));

  return await workbook.xlsx.writeBuffer();
};
