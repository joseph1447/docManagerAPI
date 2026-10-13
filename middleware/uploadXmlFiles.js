const multer = require("multer");

const MAX_FILES = 100;
const MAX_FILE_SIZE_MB = 5;

// busboy decodes multipart file names as latin1, which garbles "Facturación ñ.xml".
const decodeFileName = (name) => {
  if (!name || [...name].some((char) => char.charCodeAt(0) > 0xff)) return name;
  const decoded = Buffer.from(name, "latin1").toString("utf8");
  return decoded.includes("�") ? name : decoded;
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: MAX_FILES, fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  // Files stream one at a time, so this is the file being read if a size limit is hit.
  fileFilter: (req, file, cb) => {
    req.currentUploadFile = decodeFileName(file.originalname);
    cb(null, true);
  },
}).array("files", MAX_FILES);

const MULTER_ERRORS = {
  LIMIT_FILE_COUNT: () => ({
    status: 413,
    code: "TOO_MANY_FILES",
    message: `Se pueden subir máximo ${MAX_FILES} archivos por carga.`,
    hint: `Divide los archivos en grupos de ${MAX_FILES} o menos.`,
  }),
  LIMIT_FILE_SIZE: (err, req) => ({
    status: 413,
    code: "FILE_TOO_LARGE",
    message: `${req.currentUploadFile ? `El archivo "${req.currentUploadFile}"` : "Un archivo"} supera el límite de ${MAX_FILE_SIZE_MB} MB.`,
    hint: "Un XML de factura normalmente pesa menos de 1 MB; verifica que sea el archivo correcto.",
    fileName: req.currentUploadFile || null,
  }),
  LIMIT_UNEXPECTED_FILE: (err) =>
    err.field === "files"
      ? MULTER_ERRORS.LIMIT_FILE_COUNT()
      : {
          status: 400,
          code: "UNEXPECTED_FIELD",
          message: `Campo de archivo inesperado "${err.field}". Los archivos deben enviarse en el campo "files".`,
        },
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
    (req.files || []).forEach((file) => {
      file.originalname = decodeFileName(file.originalname);
    });
    next();
  });
};

module.exports = { uploadXmlFiles, decodeFileName, MAX_FILES, MAX_FILE_SIZE_MB };
