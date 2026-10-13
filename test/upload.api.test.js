const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const request = require("supertest");
const app = require("../app");
const { fixturePath, readWorkbook } = require("./helpers");
const { MAX_FILES, MAX_FILE_SIZE_MB } = require("../middleware/uploadXmlFiles");

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

  test(`413 TOO_MANY_FILES above ${MAX_FILES} files`, async () => {
    const req = request(app).post("/upload").set("Accept", "application/json");
    const xml = fs.readFileSync(fixturePath("valid-tiquete-v44.xml"));
    for (let i = 0; i <= MAX_FILES; i++) req.attach("files", xml, `t${i}.xml`);
    const res = await req;
    assert.equal(res.status, 413);
    assert.equal(res.body.error.code, "TOO_MANY_FILES");
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
