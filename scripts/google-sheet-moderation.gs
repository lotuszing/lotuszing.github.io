// Google Apps Script moderation/report endpoint for Lotus Zing Flat Board.
// Deploy as a Web App. Store MODERATION_SECRET in Script Properties.
// POST body examples:
// { "action": "report", "submissionId": "abc", "reason": "Wrong information", "reporterKey": "browser-key" }
// { "action": "hide", "secret": "...", "submissionId": "abc", "status": "hidden" }

const SPREADSHEET_ID = "14rYfVSXCmlixo6VlKVHYwhh8RYplxR5f__kiQEdq-uI";
const SHEET_NAME = "Sheet1";
const SUBMISSION_ID_HEADER = "Submission ID";
const STATUS_HEADER = "Status";
const REPORT_COUNT_HEADER = "Report Count";
const REPORT_REASONS_HEADER = "Report Reasons";
const REPORTER_KEYS_HEADER = "Reporter Keys";
const LAST_REPORTED_AT_HEADER = "Last Reported At";

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const secret = PropertiesService.getScriptProperties().getProperty("MODERATION_SECRET");

    const submissionId = String(payload.submissionId || "").trim();
    if (!submissionId) return jsonResponse({ ok: false, error: "Missing submissionId" }, 400);

    const sheetContext = getSheetContext();
    const rowIndex = findSubmissionRow(sheetContext.values, sheetContext.idCol, submissionId);
    if (rowIndex < 0) return jsonResponse({ ok: false, error: "Submission not found" }, 404);

    if (payload.action === "hide") {
      if (!secret || payload.secret !== secret) {
        return jsonResponse({ ok: false, error: "Not allowed" }, 403);
      }
      return hideListing(sheetContext, rowIndex, submissionId, payload.status);
    }

    return reportListing(sheetContext, rowIndex, submissionId, payload.reason, payload.reporterKey);
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error && error.message ? error.message : error) }, 500);
  }
}

function getSheetContext() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("Sheet not found");

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map((value) => String(value || "").trim());
  const idCol = findHeader(headers, SUBMISSION_ID_HEADER);
  if (idCol < 0) throw new Error("Submission ID column not found");

  return {
    sheet,
    values,
    headers,
    idCol,
    statusCol: ensureHeader(sheet, headers, STATUS_HEADER),
    reportCountCol: ensureHeader(sheet, headers, REPORT_COUNT_HEADER),
    reportReasonsCol: ensureHeader(sheet, headers, REPORT_REASONS_HEADER),
    reporterKeysCol: ensureHeader(sheet, headers, REPORTER_KEYS_HEADER),
    lastReportedAtCol: ensureHeader(sheet, headers, LAST_REPORTED_AT_HEADER)
  };
}

function reportListing(context, rowIndex, submissionId, rawReason, rawReporterKey) {
  const reason = String(rawReason || "Other").trim().slice(0, 80);
  const reporterKey = String(rawReporterKey || "").trim().slice(0, 80);
  const previousKeys = String(context.values[rowIndex][context.reporterKeysCol] || "").trim();
  const keyList = previousKeys ? previousKeys.split("|").map((key) => key.trim()).filter(Boolean) : [];
  if (reporterKey && keyList.includes(reporterKey)) {
    return jsonResponse({ ok: true, action: "report", duplicate: true, submissionId, reportCount: Number(context.values[rowIndex][context.reportCountCol]) || 0 }, 200);
  }

  const currentCount = Number(context.values[rowIndex][context.reportCountCol]) || 0;
  const nextCount = currentCount + 1;
  const previousReasons = String(context.values[rowIndex][context.reportReasonsCol] || "").trim();
  const nextReasons = [previousReasons, reason].filter(Boolean).join(" | ").slice(0, 500);
  const nextKeys = reporterKey ? [...keyList, reporterKey].join("|").slice(0, 1000) : previousKeys;

  context.sheet.getRange(rowIndex + 1, context.reportCountCol + 1).setValue(nextCount);
  context.sheet.getRange(rowIndex + 1, context.reportReasonsCol + 1).setValue(nextReasons);
  context.sheet.getRange(rowIndex + 1, context.reporterKeysCol + 1).setValue(nextKeys);
  context.sheet.getRange(rowIndex + 1, context.lastReportedAtCol + 1).setValue(new Date());

  return jsonResponse({ ok: true, action: "report", submissionId, reportCount: nextCount }, 200);
}

function hideListing(context, rowIndex, submissionId, rawStatus) {
  const status = String(rawStatus || "hidden").trim().toLowerCase();
  context.sheet.getRange(rowIndex + 1, context.statusCol + 1).setValue(status);
  return jsonResponse({ ok: true, action: "hide", submissionId, status }, 200);
}

function findSubmissionRow(values, idCol, submissionId) {
  for (let row = 1; row < values.length; row += 1) {
    if (String(values[row][idCol] || "").trim() === submissionId) return row;
  }
  return -1;
}

function findHeader(headers, name) {
  const target = name.toLowerCase();
  return headers.findIndex((header) => header.toLowerCase() === target);
}

function ensureHeader(sheet, headers, name) {
  const existing = findHeader(headers, name);
  if (existing >= 0) return existing;
  const nextCol = headers.length + 1;
  sheet.getRange(1, nextCol).setValue(name);
  headers.push(name);
  return nextCol - 1;
}

function jsonResponse(body, statusCode) {
  return ContentService
    .createTextOutput(JSON.stringify({ statusCode, ...body }))
    .setMimeType(ContentService.MimeType.JSON);
}
