const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const FIXTURES_DIR = path.join(__dirname, "fixtures");

const fixturePath = (name) => path.join(FIXTURES_DIR, name);

// Shape of a multer memory-storage file, as the controller passes it to the service.
const fixtureFile = (name, originalname = name) => ({ originalname, buffer: fs.readFileSync(fixturePath(name)) });

const bufferFile = (originalname, content) => ({
  originalname,
  buffer: Buffer.isBuffer(content) ? content : Buffer.from(content),
});

const readWorkbook = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Comprobantes");
  const headers = sheet.getRow(1).values.slice(1);
  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) rows.push(row.values.slice(1));
  });
  return { sheetNames: workbook.worksheets.map((ws) => ws.name), headers, rows };
};

module.exports = { FIXTURES_DIR, fixturePath, fixtureFile, bufferFile, readWorkbook };
