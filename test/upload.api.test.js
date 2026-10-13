const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const request = require("supertest");
const app = require("../app");
const { fixturePath, readWorkbook } = require("./helpers");
const { MAX_FILE_SIZE_MB, UPLOAD_DIR } = require("../middleware/uploadXmlFiles");

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const binaryParser = (res, callback) => {
  const chunks = [];
  res.on("data", (chunk) => chunks.push(chunk));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
};

const upload = (names, { json = false } = {}) => {
  const req = request(app).post("/upload");
  if (json) req.set("Accept", "application/json");
  names.forEach((name) => req.attach("files", fixturePath(name)));
  return req;
};

describe("POST /upload", () => {
  test("legacy contract: without Accept JSON returns the .xlsx binary with valid rows only", async () => {
    const res = await upload(["valid-factura-v43-crc.xml", "mensaje-hacienda.xml", "valid-tiquete-v44.xml"])
      .buffer(true)
      .parse(binaryParser);
    assert.equal(res.status, 200);
    assert.equal(res.headers["content-type"], XLSX_MIME);
    assert.match(res.headers["content-disposition"], /facturas\.xlsx/);
    assert.equal((await readWorkbook(res.body)).rows.length, 2);
  });

  test("JSON contract: per-file report + Excel in base64", async () => {
    const res = await upload(["valid-factura-v43-crc.xml", "mensaje-hacienda.xml", "malformada-cortada.xml"], { json: true });
    assert.equal(res.status, 200);
    assert.ok(res.body.requestId);
    assert.equal(res.headers["x-request-id"], res.body.requestId);
    assert.deepEqual(res.body.report.summary, { total: 3, processed: 1, failed: 2, withWarnings: 0 });
    assert.deepEqual(
      res.body.report.files.map((f) => [f.fileName, f.status, f.error?.code ?? null]),
      [
        ["valid-factura-v43-crc.xml", "ok", null],
        ["mensaje-hacienda.xml", "error", "UNSUPPORTED_DOCUMENT"],
        ["malformada-cortada.xml", "error", "INVALID_XML"],
      ]
    );
    assert.equal(res.body.excel.fileName, "facturas.xlsx");
    assert.equal(res.body.excel.mimeType, XLSX_MIME);
    const { rows } = await readWorkbook(Buffer.from(res.body.excel.base64, "base64"));
    assert.equal(rows.length, 1);
  });

  test("422 NO_VALID_FILES names every failed file and why", async () => {
    const res = await upload(["vacio.xml", "nota-credito.xml"]);
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, "NO_VALID_FILES");
    assert.match(res.body.error.message, /Ninguno de los 2 archivos/);
    assert.deepEqual(
      res.body.report.files.map((f) => [f.fileName, f.error.code]),
      [["vacio.xml", "EMPTY_FILE"], ["nota-credito.xml", "UNSUPPORTED_DOCUMENT"]]
    );
  });

  test("400 NO_FILES without crashing the server (regression: finally{} used to throw)", async () => {
    const res = await request(app).post("/upload").field("nada", "x");
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "NO_FILES");
    const again = await upload(["valid-tiquete-v44.xml"], { json: true });
    assert.equal(again.status, 200);
  });

  test("keeps accented file names readable (multer decodes them as latin1)", async () => {
    const res = await request(app)
      .post("/upload")
      .set("Accept", "application/json")
      .attach("files", fs.readFileSync(fixturePath("vacio.xml")), "Factura Ñandú café.xml");
    assert.equal(res.body.report.files[0].fileName, "Factura Ñandú café.xml");
  });

  test("no limit on the number of files: 300 in one request are all processed", async () => {
    const req = request(app).post("/upload").set("Accept", "application/json");
    const valid = fs.readFileSync(fixturePath("valid-tiquete-v44.xml"));
    const broken = fs.readFileSync(fixturePath("malformada-cortada.xml"));
    for (let i = 0; i < 300; i++) req.attach("files", i === 250 ? broken : valid, `t${i}.xml`);
    const res = await req;
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.report.summary, { total: 300, processed: 299, failed: 1, withWarnings: 298 });
    assert.equal(res.body.report.files[250].fileName, "t250.xml");
    assert.equal(res.body.report.files[250].error.code, "INVALID_XML");
    const { rows } = await readWorkbook(Buffer.from(res.body.excel.base64, "base64"));
    assert.equal(rows.length, 299);
  });

  test("temporary upload files are deleted after the response", async () => {
    const before = new Set(fs.readdirSync(UPLOAD_DIR));
    await upload(["valid-factura-v43-crc.xml", "vacio.xml"], { json: true });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const leftovers = fs.readdirSync(UPLOAD_DIR).filter((name) => !before.has(name));
    assert.deepEqual(leftovers, []);
  });

  test(`413 FILE_TOO_LARGE above ${MAX_FILE_SIZE_MB} MB names the file`, async () => {
    const big = Buffer.alloc(MAX_FILE_SIZE_MB * 1024 * 1024 + 1, 0x20);
    const res = await request(app)
      .post("/upload")
      .attach("files", fs.readFileSync(fixturePath("valid-tiquete-v44.xml")), "ok.xml")
      .attach("files", big, "gigante.xml");
    assert.equal(res.status, 413);
    assert.equal(res.body.error.code, "FILE_TOO_LARGE");
    assert.equal(res.body.error.fileName, "gigante.xml");
  });
});
