import { test } from "node:test";
import assert from "node:assert/strict";
import { sheetRows, summaryLine, sideStats, xlsxFilename, SHEET_COLUMNS, SHEET_HINTS, buildWorkbook } from "./export.js";
import { score } from "./score.js";
import { EXAMPLE, blankWorkflow } from "./store.js";

test("sheet rows use the sheet's labels and skip unnamed rows", () => {
  const rows = sheetRows([...EXAMPLE(), blankWorkflow()]);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], ["Demo form → HubSpot", "HubSpot", "Demo form submitted", "Priya (RevOps)", "No", "A rep or customer complains", 40, "Keep"]);
  assert.deepEqual(rows[2], ["Old webinar sync", "Zapier", "New webinar registrant", "", "No", "We wouldn't", 0, "Kill"]);
  assert.equal(SHEET_COLUMNS.length, 8); assert.equal(SHEET_HINTS.length, 8);
});

test("summary and side stats match the sheet's banner", () => {
  const s = score(EXAMPLE());
  assert.equal(summaryLine(s), "2 of 3 workflows could break and nobody would notice within a day");
  assert.equal(sideStats(s), "Not sure: 1     To fix: 1     To kill: 1");
  assert.equal(xlsxFilename(new Date(2026, 10, 4)), "dexraflow-workflow-inventory-2026-11-04.xlsx");
});

test("buildWorkbook writes title, banner, headers, hints and styled rows through the ExcelJS API", () => {
  // Minimal fake of the ExcelJS surface we use, so the layout is checked without the library.
  const cells = new Map(), merges = [];
  const cell = (r, c) => { const k = `${r}:${c}`; if (!cells.has(k)) cells.set(k, {}); return cells.get(k); };
  const ws = { views: [], columns: [], mergeCells: (...a) => merges.push(a), getRow: (n) => ({ getCell: (c) => cell(n, c), set height(h) { cell(n, 0).height = h; } }), getCell: (r, c) => cell(r, c) };
  const FakeExcelJS = { Workbook: class { addWorksheet() { return ws; } } };
  buildWorkbook(FakeExcelJS, EXAMPLE(), score(EXAMPLE()));
  assert.equal(cell(1, 1).value, "GTM Workflow Inventory");
  assert.equal(cell(3, 1).value, "2 of 3 workflows could break and nobody would notice within a day");
  assert.equal(cell(5, 5).value, SHEET_COLUMNS[4]); assert.equal(cell(6, 1).value, SHEET_HINTS[0]);
  assert.equal(cell(7, 5).value, "No"); assert.equal(cell(7, 5).fill.fgColor.argb, "FFFCEFDC");
  assert.equal(cell(9, 8).value, "Kill"); assert.equal(cell(9, 8).font.color.argb, "FFB8322B"); assert.equal(cell(9, 1).font.strike, true);
  assert.ok(cell(7, 5).dataValidation.formulae[0].includes("Not sure"));
  assert.deepEqual(merges[0], [1, 1, 1, 8]);
});
