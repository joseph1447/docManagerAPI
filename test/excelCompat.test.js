// Golden-master test: the Excel produced for the client must not change when we refactor.
// Compares the new service against the frozen original implementation in test/legacy.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const legacy = require("./legacy/facturaService.legacy");
const { processInvoices, COLUMNS } = require("../services/facturaService");
const { FIXTURES_DIR, fixtureFile, fixturePath, readWorkbook } = require("./helpers");

const ALL_FIXTURES = fs.readdirSync(FIXTURES_DIR).filter((name) => name.endsWith(".xml")).sort();

const legacyRows = async (names) => {
  const buffer = await legacy.processInvoices(names.map((name) => ({ path: fixturePath(name) })));
  return readWorkbook(buffer);
};

const newRows = async (names) => {
  const { buffer } = await processInvoices(names.map((name) => fixtureFile(name)));
  return readWorkbook(buffer);
};

describe("Excel compatibility with the original implementation", () => {
  const originalConsoleError = console.error;
  before(() => { console.error = () => {}; }); // legacy logs every failed file
  after(() => { console.error = originalConsoleError; });

  test("sheet name and headers are unchanged", async () => {
    const result = await newRows(["valid-factura-v43-crc.xml"]);
    assert.deepEqual(result.sheetNames, ["Comprobantes"]);
    assert.deepEqual(result.headers, COLUMNS.map((c) => c.header));
    assert.deepEqual(result.headers, (await legacyRows(["valid-factura-v43-crc.xml"])).headers);
  });

  for (const name of ALL_FIXTURES) {
    test(`same rows as before for ${name}`, async () => {
      let expected;
      try {
        expected = (await legacyRows([name])).rows;
      } catch {
        expected = []; // legacy threw "No se pudieron procesar los archivos." => file was dropped
      }
      const { buffer } = await processInvoices([fixtureFile(name)]);
      const actual = buffer ? (await readWorkbook(buffer)).rows : [];
      assert.deepEqual(actual, expected);
    });
  }

  test("same rows as before for the whole fixtures folder in one batch", async () => {
    assert.deepEqual((await newRows(ALL_FIXTURES)).rows, (await legacyRows(ALL_FIXTURES)).rows);
  });

  test("known values of a valid invoice", async () => {
    const { rows } = await newRows(["valid-factura-v44-usd.xml"]);
    const row = Object.fromEntries(COLUMNS.map((c, i) => [c.key, rows[0][i]]));
    assert.equal(row.NoFactura, "00100001010000004567");
    assert.equal(row.TipoTransaccion, "FACT");
    assert.equal(row.GrupoFacturacion, "Proveedores Locales (USD)");
    assert.equal(row.Descripcion, "Licencia de software anual");
    assert.equal(row.SubTotal, 200);
    assert.equal(row.Impuesto, 26);
    assert.equal(row.MontoTotal, 226);
    assert.equal(row.TipoCambioTransaccion, 512.35);
  });
});
