const fs = require("fs");
const os = require("os");
const path = require("path");
const multer = require("multer");

// No limit on how many files: the client uploads whole months of invoices in one go.
// Files go to disk (not memory) so large batches don't exhaust the server's RAM.
const MAX_FILE_SIZE_MB = 20;
const UPLOAD_DIR = path.join(os.tmpdir(), "docmanager-uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// busboy decodes multipart file names as latin1, which garbles "Facturación ñ.xml".
const decodeFileName = (name) => {
  if (!name || [...name].some((char) => char.charCodeAt(0) > 0xff)) return name;
  const decoded = Buffer.from(name, "latin1").toString("utf8");
  return decoded.includes("�") ? name : decoded;
};

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  // Files stream one at a time, so this is the file being read if a size limit is hit.
  fileFilter: (req, file, cb) => {
    req.currentUploadFile = decodeFileName(file.originalname);
    cb(null, true);
  },
}).array("files");

const MULTER_ERRORS = {
  LIMIT_FILE_SIZE: (err, req) => ({
    status: 413,
    code: "FILE_TOO_LARGE",
    message: `${req.currentUploadFile ? `El archivo "${req.currentUploadFile}"` : "Un archivo"} supera el límite de ${MAX_FILE_SIZE_MB} MB.`,
    hint: "Un XML de factura normalmente pesa menos de 1 MB; verifica que sea el archivo correcto.",
    fileName: req.currentUploadFile || null,
  }),
  LIMIT_UNEXPECTED_FILE: (err) => ({
    status: 400,
    code: "UNEXPECTED_FIELD",
    message: `Campo de archivo inesperado "${err.field}". Los archivos deben enviarse en el campo "files".`,
  }),
};

const removeTempFiles = (files) => {
  (files || []).forEach((file) => fs.promises.unlink(file.path).catch(() => {}));
};

const uploadXmlFiles = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      const mapped = err instanceof multer.MulterError && MULTER_ERRORS[err.code]
        ? MULTER_ERRORS[err.code](err, req)
        : { status: 400, code: "UPLOAD_FAILED", message: "No se pudieron recibir los archivos.", hint: "Intenta de nuevo." };
      const { status, ...error } = mapped;
      console.warn(`[upload ${req.requestId}] ${error.code}: ${err.message}`);
      return res.status(status).json({
        error: { ...error, details: { reason: err.message } },
        requestId: req.requestId,
      });
    }
    res.on("close", () => removeTempFiles(req.files));
    (req.files || []).forEach((file) => {
      file.originalname = decodeFileName(file.originalname);
    });
    next();
  });
};

module.exports = { uploadXmlFiles, decodeFileName, MAX_FILE_SIZE_MB, UPLOAD_DIR };
