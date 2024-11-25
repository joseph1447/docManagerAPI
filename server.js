const express = require("express");
require('dotenv').config();
const multer = require("multer");
const fs = require("fs");
const ExcelJS = require("exceljs");
const { readFacturaFromXml } = require("./facturaProcessor"); // Función para procesar datos desde XML
const cors = require("cors");

const app = express();
const upload = multer({ dest: "uploads/" });
const port = process.env.PORT || 3000;

// Lista de orígenes permitidos
const allowedOrigins = ["https://doc-manager-front.vercel.app"];

// Configuración personalizada de CORS
const corsOptions = {
  origin: function (origin, callback) {
    // Verificar si el origen está en la lista de permitidos
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error("No permitido por CORS"));
    }
  },
};

// Usar CORS con las opciones configuradas
app.use(cors(corsOptions));
// Ruta raíz
app.get("/", (req, res) => {
  res.send("Hola Mundo");
});
app.post("/upload", upload.array("files", 100), async (req, res) => {
  try {
    // Verificar si se subieron archivos
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No se subieron archivos." });
    }

    // Procesar los XML para obtener los datos de las facturas
    const facturas = [];
    for (const file of req.files) {
      const filePath = file.path; // Ruta temporal del archivo
      const factura = await readFacturaFromXml(filePath); // Procesar XML

      if (factura) {
        facturas.push(factura); // Agregar la factura al arreglo
      } else {
        console.error(`Error procesando el archivo: ${file.filename}`);
      }
    }

    // Validar si se procesaron correctamente las facturas
    if (facturas.length === 0) {
      return res.status(500).json({ error: "No se pudieron procesar los archivos." });
    }

    // Crear archivo Excel con los datos
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Facturas");

    // Encabezados de las columnas
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

    // Agregar datos de las facturas al Excel
    facturas.forEach((factura) => {
      worksheet.addRow({
        NoFactura: factura.NoFactura,
        TipoTransaccion: factura.TipoTransaccion,
        Proveedor: factura.Proveedor,
        GrupoFacturacion: factura.GrupoFacturacion,
        TerminoPago: factura.TerminoPago,
        Fecha: factura.Fecha,
        Descripcion: factura.Descripcion,
        SubTotal: factura.SubTotal,
        Impuesto: factura.Impuesto,
        MontoTotal: factura.MontoTotal,
        CuentaContable: factura.CuentaContable,
        DividirMonto: factura.DividirMonto,
        TipoCambioTransaccion: factura.TipoCambioTransaccion,
        TipoCambioCuentaContable: factura.TipoCambioCuentaContable,
        Sucursal: factura.Sucursal,
        Departamento: factura.Departamento,
        UnidadNegocio: factura.UnidadNegocio,
      });
    });

    // Formatear columnas específicas
    worksheet.getColumn(6).numFmt = "dd-mm-yyyy"; // Formato de fecha
    worksheet.getColumn(8).numFmt = "#,##0.00"; // SubTotal
    worksheet.getColumn(9).numFmt = "#,##0.00"; // Impuesto
    worksheet.getColumn(10).numFmt = "#,##0.00"; // Monto Total
    worksheet.getColumn(12).numFmt = "#,##0.00"; // Dividir Monto

    // Crear archivo en memoria
    const buffer = await workbook.xlsx.writeBuffer();

    // Configurar cabeceras para la descarga del archivo
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=facturas.xlsx");

    // Enviar el archivo al cliente
    res.send(buffer);
  } catch (err) {
    console.error("Error en el servidor:", err);
    res.status(500).json({ error: "Error interno del servidor." });
  } finally {
    // Eliminar archivos temporales
    req.files.forEach((file) => fs.unlinkSync(file.path));
  }
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
