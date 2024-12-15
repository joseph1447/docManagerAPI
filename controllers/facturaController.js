const facturaService = require("../services/facturaService");

exports.uploadFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No se subieron archivos." });
    }

    // Procesar facturas usando el servicio
    const buffer = await facturaService.processInvoices(req.files);

    // Configurar cabeceras para la descarga del archivo
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=facturas.xlsx");

    res.send(buffer);
  } catch (err) {
    console.error("Error en el controlador de facturas:", err);
    res.status(500).json({ error: "Error interno del servidor." });
  } finally {
    // Eliminar archivos temporales
    req.files.forEach((file) => require("fs").unlinkSync(file.path));
  }
};