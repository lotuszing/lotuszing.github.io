#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQrOnoEOnNWqOypLuXT_vgHewY6JKRGooYGfpAGGnpg3oskyxZ_9fEU3p1T44eZtA9qo2IuszIrf-EB/pub?gid=0&single=true&output=csv";
const OUT_FILE = path.join(__dirname, "..", "listings", "listings.json");
const LIMITS = {
  rentMin: 5000,
  rentMax: 150000,
  depositMin: 0,
  depositMax: 500000,
  budgetMin: 5000,
  budgetMax: 150000,
  occupantsMin: 1,
  occupantsMax: 8,
  datePastDays: 120,
  dateFutureDays: 730
};

function parseCSV(text) {
  const rows = [];
  let row = [""];
  let insideQuote = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        row[row.length - 1] += '"';
        i += 1;
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === "," && !insideQuote) {
      row.push("");
    } else if ((char === "\r" || char === "\n") && !insideQuote) {
      if (char === "\r" && nextChar === "\n") i += 1;
      rows.push(row);
      row = [""];
    } else {
      row[row.length - 1] += char;
    }
  }
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows.filter((cells) => cells.some((cell) => String(cell).trim()));
}

function mapHeaders(headers) {
  const mapping = {};
  const setOnce = (key, index) => {
    if (mapping[key] === undefined) mapping[key] = index;
  };

  headers.forEach((header, index) => {
    const h = String(header || "").toLowerCase().trim();
    if (h.includes("submission id")) setOnce("submissionId", index);
    else if (h.includes("what are you listing") || h === "listing type" || h.includes("listing?")) setOnce("listingType", index);
    else if (h.includes("preferred tower") || h.includes("preferred area") || h === "preferred tower/area") setOnce("preferredArea", index);
    else if (h.includes("tower") || h.includes("flat") || h.includes("unit")) setOnce("towerFlat", index);
    else if (h.includes("bhk") || h.includes("room type") || h.includes("room")) {
      setOnce("bhkType", index);
      setOnce("preferredBhk", index);
    } else if (h.includes("furnish")) setOnce("furnishing", index);
    else if (h.includes("rent") || h.includes("price") || h.includes("monthly")) setOnce("monthlyRent", index);
    else if (h.includes("deposit") || h.includes("security")) setOnce("securityDeposit", index);
    else if (h.includes("available from") || h.includes("from")) setOnce("availableFrom", index);
    else if (h.includes("preferred tenant")) setOnce("preferredTenant", index);
    else if (h.includes("tenant type")) {
      setOnce("tenantType", index);
      setOnce("preferredTenant", index);
    } else if (h.includes("parking")) setOnce("parking", index);
    else if (h.includes("listed") || h.includes("broker") || h.includes("agent") || h.includes("owner")) setOnce("listedBy", index);
    else if (h.includes("name") || h.includes("poster")) setOnce("posterName", index);
    else if (h.includes("contact") || h.includes("phone") || h.includes("mobile")) setOnce("contactNumber", index);
    else if (h.includes("notes") || h.includes("comment") || h.includes("desc") || h.includes("free text")) setOnce("notes", index);
    else if (h.includes("budget") || h.includes("max")) setOnce("budget", index);
    else if (h.includes("move") || h.includes("move-in")) setOnce("preferredMoveIn", index);
    else if (h.includes("occupants") || h.includes("people")) setOnce("occupants", index);
    else if (h.includes("area")) setOnce("preferredArea", index);
    else if (h.includes("timestamp") || h.includes("submitted") || h.includes("time")) setOnce("timestamp", index);
  });

  return mapping;
}

function getRowValue(row, mapping, key) {
  const index = mapping[key];
  return index !== undefined && index < row.length ? String(row[index] || "").trim() : "";
}

function classifyListingRow(row, mapping) {
  const listingType = getRowValue(row, mapping, "listingType").toLowerCase();
  if (listingType.includes("looking") || listingType.includes("request") || listingType.includes("tenant")) return "looking";
  if (listingType.includes("available") || listingType.includes("rent") || listingType.includes("flat")) return "rent";
  if (getRowValue(row, mapping, "towerFlat") || getRowValue(row, mapping, "monthlyRent")) return "rent";
  if (getRowValue(row, mapping, "budget") || getRowValue(row, mapping, "preferredArea")) return "looking";
  return "";
}

function formatPreferredArea(value) {
  const allowed = new Set(["1", "2", "3", "4", "5", "6", "15", "16"]);
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/any/i.test(raw)) return "Any allowed tower";

  const towers = [];
  const seen = new Set();
  const matches = raw.match(/\b(?:1[56]|[1-6])\b/g) || [];
  matches.forEach((tower) => {
    if (allowed.has(tower) && !seen.has(tower)) {
      seen.add(tower);
      towers.push(`Tower ${tower}`);
    }
  });
  return towers.length ? towers.join(", ") : raw;
}

function numberFrom(value) {
  return parseInt(String(value || "").replace(/[^0-9]/g, ""), 10) || 0;
}

function numberInRange(value, min, max) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= min && amount <= max;
}

function safeParseDate(value) {
  if (!value) return null;
  const parsed = new Date(String(value).trim().replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function hasReasonableDate(value) {
  const raw = String(value || "").trim();
  if (!raw || /immediate|ready|now/i.test(raw)) return true;
  const parsed = safeParseDate(raw);
  if (!parsed) return false;
  const now = new Date();
  const min = new Date(now);
  min.setDate(min.getDate() - LIMITS.datePastDays);
  const max = new Date(now);
  max.setDate(max.getDate() + LIMITS.dateFutureDays);
  return parsed >= min && parsed <= max;
}

function normalizePhoneDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
}

function hasTowerAndUnit(value) {
  const numbers = String(value || "").match(/\d+/g) || [];
  return numbers.length >= 2;
}

function rowToRentListing(row, mapping, idx) {
  const getVal = (key) => getRowValue(row, mapping, key);
  return {
    id: `sheet-rent-${getVal("submissionId") || idx}`,
    timestamp: getVal("timestamp") || new Date().toISOString(),
    towerFlat: getVal("towerFlat") || "Unknown Unit",
    bhkType: getVal("bhkType") || "2 BHK",
    furnishing: getVal("furnishing") || "Semi-Furnished",
    monthlyRent: numberFrom(getVal("monthlyRent")),
    securityDeposit: numberFrom(getVal("securityDeposit")),
    availableFrom: getVal("availableFrom") || "Immediate",
    preferredTenant: getVal("preferredTenant") || "Any",
    parking: getVal("parking") || "Yes",
    listedBy: getVal("listedBy") || "Owner",
    posterName: getVal("posterName") || "Resident",
    contactNumber: getVal("contactNumber") || "",
    notes: getVal("notes") || ""
  };
}

function rowToLookingListing(row, mapping, idx) {
  const getVal = (key) => getRowValue(row, mapping, key);
  return {
    id: `sheet-looking-${getVal("submissionId") || idx}`,
    timestamp: getVal("timestamp") || new Date().toISOString(),
    preferredBhk: getVal("preferredBhk") || "2 BHK",
    budget: numberFrom(getVal("budget")),
    preferredMoveIn: getVal("preferredMoveIn") || "Immediate",
    occupants: numberFrom(getVal("occupants")) || 1,
    tenantType: getVal("tenantType") || "Family",
    preferredArea: formatPreferredArea(getVal("preferredArea")) || "Any allowed tower",
    posterName: getVal("posterName") || "Resident",
    contactNumber: getVal("contactNumber") || "",
    notes: getVal("notes") || ""
  };
}

function rentValidationReasons(item) {
  const reasons = [];
  if (!item || !item.towerFlat || item.towerFlat === "Unknown Unit" || !hasTowerAndUnit(item.towerFlat)) {
    reasons.push("add both tower and flat number");
  }
  if (!numberInRange(item?.monthlyRent, LIMITS.rentMin, LIMITS.rentMax)) {
    reasons.push(`rent must be ₹${LIMITS.rentMin.toLocaleString("en-IN")}-₹${LIMITS.rentMax.toLocaleString("en-IN")}`);
  }
  if (!numberInRange(item?.securityDeposit, LIMITS.depositMin, LIMITS.depositMax)) {
    reasons.push(`deposit must be ₹${LIMITS.depositMin.toLocaleString("en-IN")}-₹${LIMITS.depositMax.toLocaleString("en-IN")}`);
  }
  if (!hasReasonableDate(item?.availableFrom)) {
    reasons.push("available date looks invalid");
  }
  if (normalizePhoneDigits(item?.contactNumber).length !== 10) {
    reasons.push("enter a valid 10-digit phone number");
  }
  return reasons;
}

function isValidRentListing(item) {
  return rentValidationReasons(item).length === 0;
}

function lookingValidationReasons(item) {
  const reasons = [];
  if (!numberInRange(item?.budget, LIMITS.budgetMin, LIMITS.budgetMax)) {
    reasons.push(`budget must be ₹${LIMITS.budgetMin.toLocaleString("en-IN")}-₹${LIMITS.budgetMax.toLocaleString("en-IN")}`);
  }
  if (!numberInRange(item?.occupants, LIMITS.occupantsMin, LIMITS.occupantsMax)) {
    reasons.push(`occupants must be ${LIMITS.occupantsMin}-${LIMITS.occupantsMax}`);
  }
  if (!hasReasonableDate(item?.preferredMoveIn)) {
    reasons.push("move-in date looks invalid");
  }
  if (normalizePhoneDigits(item?.contactNumber).length !== 10) {
    reasons.push("enter a valid 10-digit phone number");
  }
  return reasons;
}

function isValidLookingListing(item) {
  return lookingValidationReasons(item).length === 0;
}

async function main() {
  const response = await fetch(`${CSV_URL}&v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`CSV fetch failed: ${response.status}`);

  const rows = parseCSV(await response.text());
  const mapping = mapHeaders(rows[0] || []);

  const rentListings = [];
  const lookingListings = [];
  const skippedRows = [];

  rows.slice(1).forEach((row, idx) => {
    const listingType = classifyListingRow(row, mapping);
    if (listingType === "rent") {
      const listing = rowToRentListing(row, mapping, idx);
      if (isValidRentListing(listing)) rentListings.push(listing);
      else skippedRows.push({ row: idx + 2, type: "rent", reasons: rentValidationReasons(listing) });
    }
    if (listingType === "looking") {
      const listing = rowToLookingListing(row, mapping, idx);
      if (isValidLookingListing(listing)) lookingListings.push(listing);
      else skippedRows.push({ row: idx + 2, type: "looking", reasons: lookingValidationReasons(listing) });
    }
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    skippedRows,
    rentListings,
    lookingListings
  };

  fs.writeFileSync(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Updated ${OUT_FILE}: ${rentListings.length} flats, ${lookingListings.length} tenant requests, ${skippedRows.length} skipped`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
