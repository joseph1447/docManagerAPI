/**
 * @swagger
 * /upload:
 *   post:
 *     summary: Sube archivos XML (facturas y tiquetes electrónicos) y genera un Excel unificado
 *     description: |
 *       Con `Accept: application/json` responde un JSON con el reporte por archivo y el Excel en base64
 *       (contrato usado por docManagerFront). Sin ese header responde el .xlsx binario (contrato original).
 *       Los archivos que fallan no se incluyen en el Excel; el reporte indica cuál falló y por qué.
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
 *         description: Al menos un archivo se procesó. Con Accept JSON incluye `report` y `excel.base64`.
 *       400:
 *         description: No se subieron archivos (`NO_FILES`) o la carga es inválida.
 *       413:
 *         description: Demasiados archivos (`TOO_MANY_FILES`) o un archivo muy grande (`FILE_TOO_LARGE`).
 *       422:
 *         description: Ningún archivo se pudo procesar (`NO_VALID_FILES`); `report.files` dice por qué falló cada uno.
 *       500:
 *         description: Error interno (`INTERNAL_ERROR`), incluye `requestId` para buscar en los logs.
 */

const facturaService = require("../services/facturaService");

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const EXCEL_FILE_NAME = "facturas.xlsx";

const logReport = (requestId, report) => {
  const { total, processed, failed, withWarnings } = report.summary;
  console.log(`[upload ${requestId}] ${processed}/${total} procesados, ${failed} con error, ${withWarnings} con advertencias`);
  report.files
    .filter((file) => file.status !== "ok")
    .forEach((file) => {
      const issues = file.error ? [file.error] : file.warnings;
      issues.forEach((issue) => console.log(`[upload ${requestId}]   ${file.status} "${file.fileName}": ${issue.code} - ${issue.message}`));
    });
};

exports.uploadFiles = async (req, res) => {
  const { requestId } = req;
  const wantsJson = (req.get("Accept") || "").includes("application/json");

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      error: { code: "NO_FILES", message: "No se subieron archivos.", hint: "Selecciona uno o más archivos XML." },
      requestId,
    });
  }

  try {
    const { buffer, report } = await facturaService.processInvoices(req.files);
    logReport(requestId, report);

    if (!buffer) {
      const total = report.summary.total;
      return res.status(422).json({
        error: {
          code: "NO_VALID_FILES",
          message: total === 1
            ? "El archivo no se pudo procesar."
            : `Ninguno de los ${total} archivos se pudo procesar.`,
          hint: "Revisa el motivo indicado en cada archivo.",
        },
        report,
        requestId,
      });
    }

    if (wantsJson) {
      return res.json({
        report,
        excel: { fileName: EXCEL_FILE_NAME, mimeType: XLSX_MIME, base64: Buffer.from(buffer).toString("base64") },
        requestId,
      });
    }

    res.setHeader("Content-Type", XLSX_MIME);
    res.setHeader("Content-Disposition", `attachment; filename=${EXCEL_FILE_NAME}`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error(`[upload ${requestId}] Error inesperado:`, err);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Error interno del servidor al generar el Excel.",
        hint: "Intenta de nuevo. Si continúa, envía el reporte de errores a soporte.",
        details: { reason: err.message },
      },
      requestId,
    });
  }
};
