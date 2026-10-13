const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const { processInvoices } = require("../services/facturaService");
const { fixtureFile, fixturePath, bufferFile, readWorkbook } = require("./helpers");

const processOne = async (file) => (await processInvoices([file])).report.files[0];

// Add a row here (and the XML in test/fixtures) for every new failing file reported by users.
const CASES = [
  { fixture: "valid-factura-v43-crc.xml", status: "ok" },
  { fixture: "valid-factura-v44-usd.xml", status: "ok" },
  { fixture: "valid-tiquete-v44.xml", status: "ok" },
  { fixture: "campos-faltantes.xml", status: "warning", code: "MISSING_FIELDS", message: /NumeroConsecutivo, Emisor\/Nombre/ },
  { fixture: "monto-invalido.xml", status: "warning", code: "INVALID_AMOUNT", message: /"ciento trece".*TotalComprobante/ },
  { fixture: "vacio.xml", status: "error", code: "EMPTY_FILE", message: /vacío/ },
  { fixture: "malformada-cortada.xml", status: "error", code: "INVALID_XML", message: /línea 6.*incompleto o cortado/ },
  { fixture: "malformada-etiqueta.xml", status: "error", code: "INVALID_XML", message: /línea 3.*etiqueta de cierre/ },
  { fixture: "fecha-invalida.xml", status: "error", code: "INVALID_DATE", message: /"15\/03\/2024"/ },
  { fixture: "mensaje-hacienda.xml", status: "error", code: "UNSUPPORTED_DOCUMENT", message: /respuesta de Hacienda/ },
  { fixture: "nota-credito.xml", status: "error", code: "UNSUPPORTED_DOCUMENT", message: /Nota de Crédito/ },
  { fixture: "no-es-comprobante.xml", status: "error", code: "UNSUPPORTED_DOCUMENT", message: /<catalogo>/ },
];

describe("processInvoices: one report entry per file", () => {
  for (const { fixture, status, code, message } of CASES) {
    test(`${fixture} -> ${status}${code ? ` (${code})` : ""}`, async () => {
      const entry = await processOne(fixtureFile(fixture));
      assert.equal(entry.fileName, fixture);
      assert.equal(entry.status, status);
      if (status === "ok") {
        assert.equal(entry.error, null);
        assert.deepEqual(entry.warnings, []);
      }
      if (status === "error") {
        assert.equal(entry.error.code, code);
        assert.match(entry.error.message, message);
        assert.ok(entry.error.hint, "every error must tell the user how to fix it");
      }
      if (status === "warning") {
        const warning = entry.warnings.find((w) => w.code === code);
        assert.ok(warning, `expected warning ${code}`);
        assert.match(warning.message, message);
      }
    });
  }
});

describe("processInvoices: content sniffing", () => {
  test("PDF renamed to .xml", async () => {
    const entry = await processOne(bufferFile("factura.xml", "%PDF-1.7\n%âãÏÓ binary"));
    assert.equal(entry.error.code, "NOT_XML");
    assert.match(entry.error.message, /PDF/);
  });

  test("ZIP renamed to .xml", async () => {
    const entry = await processOne(bufferFile("lote.xml", Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00])));
    assert.equal(entry.error.code, "NOT_XML");
    assert.match(entry.error.message, /ZIP/);
  });

  test("HTML error page saved as .xml", async () => {
    const entry = await processOne(bufferFile("descarga.xml", "<!DOCTYPE html><html><body>Sesión expirada</body></html>"));
    assert.equal(entry.error.code, "NOT_XML");
    assert.match(entry.error.message, /HTML/);
  });

  test("UTF-8 BOM is accepted", async () => {
    const xml = fs.readFileSync(fixturePath("valid-factura-v43-crc.xml"));
    const entry = await processOne(bufferFile("bom.xml", Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), xml])));
    assert.equal(entry.status, "ok");
  });

  test("UTF-16 LE file is decoded", async () => {
    const xml = fs.readFileSync(fixturePath("valid-tiquete-v44.xml"), "utf-8").replace('encoding="utf-8"', 'encoding="utf-16"');
    const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(xml, "utf16le")]);
    const entry = await processOne(bufferFile("utf16.xml", utf16));
    assert.equal(entry.status, "ok");
    assert.equal(entry.consecutivo, "00100001040000000789");
  });
});

describe("processInvoices: batch behaviour", () => {
  test("keeps upload order, names every failed file and only exports valid rows", async () => {
    const names = ["valid-factura-v43-crc.xml", "mensaje-hacienda.xml", "valid-tiquete-v44.xml", "vacio.xml", "campos-faltantes.xml"];
    const { buffer, report } = await processInvoices(names.map((n) => fixtureFile(n)));

    assert.deepEqual(report.files.map((f) => f.fileName), names);
    assert.deepEqual(report.files.map((f) => f.index), [0, 1, 2, 3, 4]);
    assert.deepEqual(report.summary, { total: 5, processed: 3, failed: 2, withWarnings: 1 });

    const { rows } = await readWorkbook(buffer);
    assert.equal(rows.length, 3);
  });

  test("exposes document metadata for the UI", async () => {
    const entry = await processOne(fixtureFile("valid-factura-v44-usd.xml"));
    assert.equal(entry.documentType, "FacturaElectronica");
    assert.equal(entry.version, "4.4");
    assert.equal(entry.consecutivo, "00100001010000004567");
    assert.equal(entry.emisor, "Importadora Ejemplo Ltda.");
    assert.equal(entry.clave, "50630112500310100000200100001010000004567100000002");
  });

  test("warns about the same invoice uploaded twice (still exported twice, like before)", async () => {
    const { buffer, report } = await processInvoices([
      fixtureFile("valid-factura-v43-crc.xml", "original.xml"),
      fixtureFile("valid-factura-v43-crc.xml", "copia.xml"),
    ]);
    assert.equal(report.files[0].status, "ok");
    assert.equal(report.files[1].status, "warning");
    assert.equal(report.files[1].warnings[0].code, "DUPLICATE_DOCUMENT");
    assert.match(report.files[1].warnings[0].message, /"original.xml"/);
    assert.equal((await readWorkbook(buffer)).rows.length, 2);
  });

  test("returns no workbook when every file fails", async () => {
    const { buffer, report } = await processInvoices([fixtureFile("vacio.xml"), fixtureFile("nota-credito.xml")]);
    assert.equal(buffer, null);
    assert.deepEqual(report.summary, { total: 2, processed: 0, failed: 2, withWarnings: 0 });
  });

  test("an unexpected exception in one file does not hide the others", async () => {
    // <Detalle> with attributes makes xml2js return an object; the original code crashed on .replace().
    const weird = fs
      .readFileSync(fixturePath("valid-factura-v43-crc.xml"), "utf-8")
      .replace("<Detalle>Servicio de limpieza</Detalle>", '<Detalle lang="es">Servicio de limpieza</Detalle>');
    const { report } = await processInvoices([bufferFile("rara.xml", weird), fixtureFile("valid-tiquete-v44.xml")]);
    assert.equal(report.files[0].status, "error");
    assert.equal(report.files[0].error.code, "UNEXPECTED_PARSE_ERROR");
    assert.ok(report.files[0].error.details.errorMessage);
    assert.equal(report.files[1].status, "ok");
  });
});
