/* Excel export that mirrors the Dexraflow "GTM Workflow Inventory" sheet:
   dark title band, score line, teal header row, hint row, coloured cells.
   sheetRows/summaryLine are pure; buildWorkbook takes the ExcelJS global. */
import { NOTICE_LABELS, FINDOUT_LABELS, DECISION_LABELS, namedWorkflows } from "./score.js";

export const SHEET_TITLE = "GTM Workflow Inventory";
export const SHEET_SUBTITLE = "Would anyone notice if it broke? List every workflow that touches a lead or deal, then answer honestly.   |   Template by Dexraflow";
export const SHEET_COLUMNS = [
  "Workflow name", "Tool (HubSpot / Salesforce / Zapier / other)", "What triggers it", "Owner (who fixes it)",
  "If it broke, would anyone notice within a day? (Yes / No / Not sure)", "How would we find out?",
  "Leads or deals it touches per week", "Keep / Fix / Kill",
];
export const SHEET_HINTS = [
  "Name it so a new hire would recognise it", "HubSpot, Salesforce, Zapier, Make, Clay...", "Form submit, new contact, field change, schedule",
  "A named person, not a team", "Pick Yes, No or Not sure", "Alert, report, a rep complains, or we wouldn't", "A rough number is fine", "Pick Keep, Fix or Kill",
];

export function sheetRows(workflows) {
  return namedWorkflows(workflows).map((w) => [
    w.name.trim(), w.tool || "", w.trigger || "", w.owner || "",
    NOTICE_LABELS[w.notice] || "", FINDOUT_LABELS[w.findOut] || "",
    Number.isFinite(w.leadsPerWeek) ? w.leadsPerWeek : "", DECISION_LABELS[w.decision] || "",
  ]);
}
export const summaryLine = (s) => `${s.no} of ${s.total} workflows could break and nobody would notice within a day`;
export const sideStats = (s) => `Not sure: ${s.notSure}     To fix: ${s.fix}     To kill: ${s.kill}`;
export function xlsxFilename(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `dexraflow-workflow-inventory-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.xlsx`;
}

const C = { ink: "FF0F1A1F", night: "FF0C1315", brand: "FF0B6E69", brandNight: "FF3BBFAF", amber: "FFE8962E", amberInk: "FF8A4B00",
  amberSoft: "FFFCEFDC", amberPale: "FFFDF6EA", tealSoft: "FFDCEFEC", greenSoft: "FFE3F2EA", green: "FF1E7A4A", redSoft: "FFFBE7E5", red: "FFB8322B",
  surface: "FFF5F7F6", sunken: "FFE9EEEC", line: "FFD3DCD9", muted: "FF4F5E5B", white: "FFFFFFFF" };
const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const thin = { style: "thin", color: { argb: C.line } };

/** Returns an ExcelJS workbook. `ExcelJS` is the UMD global loaded on demand. */
export function buildWorkbook(ExcelJS, workflows, s) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Dexraflow";
  const ws = wb.addWorksheet("Inventory", { views: [{ state: "frozen", ySplit: 6 }] });
  ws.columns = [30, 26, 32, 22, 30, 30, 16, 14].map((width) => ({ width }));
  const cols = SHEET_COLUMNS.length;
  const band = (rowNo, height) => { const r = ws.getRow(rowNo); r.height = height; for (let c = 1; c <= cols; c++) r.getCell(c).fill = fill(C.night); return r; };

  const r1 = band(1, 34); ws.mergeCells(1, 1, 1, cols);
  r1.getCell(1).value = SHEET_TITLE; r1.getCell(1).font = { name: "Arial", size: 20, bold: true, color: { argb: C.white } }; r1.getCell(1).alignment = { vertical: "middle" };
  const r2 = band(2, 22); ws.mergeCells(2, 1, 2, cols);
  r2.getCell(1).value = SHEET_SUBTITLE; r2.getCell(1).font = { name: "Arial", size: 11, color: { argb: C.brandNight } }; r2.getCell(1).alignment = { vertical: "middle" };
  const r3 = band(3, 26); ws.mergeCells(3, 1, 3, 5); ws.mergeCells(3, 6, 3, cols);
  r3.getCell(1).value = summaryLine(s); r3.getCell(1).font = { name: "Arial", size: 13, bold: true, color: { argb: C.amber } }; r3.getCell(1).alignment = { vertical: "middle" };
  r3.getCell(6).value = sideStats(s); r3.getCell(6).font = { name: "Arial", size: 11, color: { argb: "FFE6EEEC" } }; r3.getCell(6).alignment = { vertical: "middle", horizontal: "right" };
  ws.getRow(4).height = 10;

  const head = ws.getRow(5); head.height = 54;
  SHEET_COLUMNS.forEach((h, i) => { const c = head.getCell(i + 1); c.value = h; c.fill = fill(C.brand); c.font = { name: "Arial", size: 11, bold: true, color: { argb: C.white } }; c.alignment = { vertical: "middle", wrapText: true }; c.border = { bottom: thin }; });
  const hint = ws.getRow(6); hint.height = 30;
  SHEET_HINTS.forEach((h, i) => { const c = hint.getCell(i + 1); c.value = h; c.fill = fill(C.sunken); c.font = { name: "Arial", size: 9, italic: true, color: { argb: C.muted } }; c.alignment = { vertical: "middle", wrapText: true }; c.border = { bottom: thin }; });

  const rows = sheetRows(workflows);
  const noticeStyle = { No: [C.amberSoft, C.amberInk, true], "Not sure": [C.amberPale, C.amberInk, false], Yes: [C.tealSoft, C.brand, true] };
  const decisionStyle = { Keep: [C.greenSoft, C.green], Fix: [C.amberSoft, C.amberInk], Kill: [C.redSoft, C.red] };
  rows.forEach((vals, i) => {
    const r = ws.getRow(7 + i); r.height = 24;
    vals.forEach((v, j) => {
      const c = r.getCell(j + 1); c.value = v;
      c.font = { name: "Arial", size: 11, color: { argb: C.ink } };
      c.alignment = { vertical: "middle", wrapText: true, horizontal: j === 6 ? "center" : j === 4 || j === 7 ? "center" : "left" };
      c.fill = fill(i % 2 ? C.surface : C.white);
      c.border = { bottom: thin };
    });
    const nameCell = r.getCell(1), noticeCell = r.getCell(5), decCell = r.getCell(8);
    nameCell.font = { name: "Arial", size: 11, bold: true, color: { argb: vals[4] === "No" ? C.amberInk : C.ink } };
    if (noticeStyle[vals[4]]) { const [bg, fg, bold] = noticeStyle[vals[4]]; noticeCell.fill = fill(bg); noticeCell.font = { name: "Arial", size: 11, bold, color: { argb: fg } }; }
    if (decisionStyle[vals[7]]) { const [bg, fg] = decisionStyle[vals[7]]; decCell.fill = fill(bg); decCell.font = { name: "Arial", size: 11, bold: true, color: { argb: fg } }; }
    if (vals[7] === "Kill") nameCell.font = { ...nameCell.font, strike: true, color: { argb: C.muted } };
  });
  // Dropdowns for the two pick columns, on filled rows plus 20 spare ones.
  const last = 7 + Math.max(rows.length, 0) + 20;
  for (let n = 7; n < last; n++) {
    ws.getCell(n, 5).dataValidation = { type: "list", allowBlank: true, formulae: ['"Yes,No,Not sure"'] };
    ws.getCell(n, 8).dataValidation = { type: "list", allowBlank: true, formulae: ['"Keep,Fix,Kill"'] };
  }
  return wb;
}
