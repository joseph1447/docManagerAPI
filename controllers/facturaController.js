/**
 * @swagger
 * /upload:
 *   post:
 *     summary: Sube archivos XML para procesar facturas
 *     tags: [Facturas]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Excel generado con las facturas procesadas.
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: No se subieron archivos.
 *       500:
 *         description: Error interno del servidor.
 */


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
