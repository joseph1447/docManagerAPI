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

module.exports = { readFacturaFromXml };
