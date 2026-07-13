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

const DEFAULT_ALLOWED_ORIGINS = "https://lotuszing.github.io,null";
const CACHE_TTL_SECONDS = 1;

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || "https://lotuszing.github.io";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function json(body, status, request, env, cacheable = false) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheable
        ? `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=30`
        : "no-store",
      "X-Content-Type-Options": "nosniff",
      ...corsHeaders(request, env)
    }
  });
}

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
    else if ((h.includes("tower") && (h.includes("flat") || h.includes("unit"))) || h.includes("tower/flat")) setOnce("towerFlat", index);
    else if (h.includes("tower")) setOnce("tower", index);
    else if (h.includes("flat") || h.includes("unit")) setOnce("flatNo", index);
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
    else if (h.includes("status") || h.includes("moderation") || h.includes("visibility")) setOnce("status", index);
    else if (h.includes("report count") || h === "reports") setOnce("reportCount", index);
    else if (h.includes("report reason")) setOnce("reportReasons", index);
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

function normalizeTowerLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/\b(1[56]|[1-6])\b/);
  return match ? `Tower ${match[1]}` : raw;
}

function hasLocationNumber(value) {
  const numbers = String(value || "").match(/\d+/g) || [];
  return numbers.length >= 1;
}

function combinedTowerFlat(row, mapping) {
  const combined = getRowValue(row, mapping, "towerFlat");
  if (hasLocationNumber(combined)) return combined;
  const tower = normalizeTowerLabel(getRowValue(row, mapping, "tower"));
  const flatNo = getRowValue(row, mapping, "flatNo");
  if (tower && flatNo) return `${tower}, Flat ${flatNo}`;
  return combined || [tower, flatNo].filter(Boolean).join(" ");
}

function classifyListingRow(row, mapping) {
  const listingType = getRowValue(row, mapping, "listingType").toLowerCase();
  if (listingType.includes("looking") || listingType.includes("request") || listingType.includes("tenant")) return "looking";
  if (listingType.includes("available") || listingType.includes("rent") || listingType.includes("flat")) return "rent";
  if (combinedTowerFlat(row, mapping) || getRowValue(row, mapping, "monthlyRent")) return "rent";
  if (getRowValue(row, mapping, "budget") || getRowValue(row, mapping, "preferredArea")) return "looking";
  return "";
}

function isHiddenRow(row, mapping) {
  const status = getRowValue(row, mapping, "status").toLowerCase();
  return /\b(hidden|hide|removed|remove|delete|deleted|spam|fake|rented|closed|inactive)\b/.test(status);
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

function reportCountFrom(row, mapping) {
  return Math.max(0, numberFrom(getRowValue(row, mapping, "reportCount")));
}

function reportRiskFrom(row, mapping) {
  const count = reportCountFrom(row, mapping);
  if (count >= 3) return "high";
  if (count >= 2) return "medium";
  return "";
}

function formatPreferredArea(value) {
  const allowed = new Set(["1", "2", "3", "4", "5", "6", "15", "16"]);
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/any/i.test(raw)) return "Any tower";

  const towers = [];
  const seen = new Set();
  const matches = raw.match(/\b(?:1[56]|[1-6])\b/g) || [];
  matches.forEach((tower) => {
    if (allowed.has(tower) && !seen.has(tower)) {
      seen.add(tower);
      towers.push(tower);
    }
  });
  if (towers.length === 1) return `Tower ${towers[0]}`;
  return towers.length ? `Towers ${towers.join(", ")}` : raw;
}

function normalizeHeaderLabel(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[?*:]+$/g, "")
    .trim();
}

function collectExtraFields(row, headers, mapping) {
  const mappedIndexes = new Set(Object.values(mapping).filter((index) => Number.isInteger(index)));
  const sensitiveHeader = /(submission|respondent|timestamp|submitted|time|contact|phone|mobile|email|name|report|reporter|status|moderation|visibility)/i;
  return headers
    .map((header, index) => {
      const label = normalizeHeaderLabel(header);
      const value = String(row[index] || "").trim();
      if (!label || !value || mappedIndexes.has(index) || sensitiveHeader.test(label)) return null;
      return {
        label: label.slice(0, 42),
        value: value.replace(/\s+/g, " ").slice(0, 160)
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}

function rowToRentListing(row, mapping, idx) {
  const getVal = (key) => getRowValue(row, mapping, key);
  return {
    id: `sheet-rent-${getVal("submissionId") || idx}`,
    timestamp: getVal("timestamp") || new Date().toISOString(),
    towerFlat: combinedTowerFlat(row, mapping) || "Unknown Unit",
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
    notes: getVal("notes") || "",
    reportCount: reportCountFrom(row, mapping),
    reportRisk: reportRiskFrom(row, mapping),
    extraFields: collectExtraFields(row, mapping.__headers || [], mapping)
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
    preferredArea: formatPreferredArea(getVal("preferredArea")) || "Any tower",
    posterName: getVal("posterName") || "Resident",
    contactNumber: getVal("contactNumber") || "",
    notes: getVal("notes") || "",
    reportCount: reportCountFrom(row, mapping),
    reportRisk: reportRiskFrom(row, mapping),
    extraFields: collectExtraFields(row, mapping.__headers || [], mapping)
  };
}

function rentValidationReasons(item) {
  const reasons = [];
  if (!item || !item.towerFlat || item.towerFlat === "Unknown Unit" || !hasLocationNumber(item.towerFlat)) {
    reasons.push("add tower or unit number");
  }
  if (!numberInRange(item?.monthlyRent, LIMITS.rentMin, LIMITS.rentMax)) reasons.push("rent out of range");
  if (!numberInRange(item?.securityDeposit, LIMITS.depositMin, LIMITS.depositMax)) reasons.push("deposit out of range");
  if (!hasReasonableDate(item?.availableFrom)) reasons.push("available date invalid");
  if (normalizePhoneDigits(item?.contactNumber).length !== 10) reasons.push("phone invalid");
  return reasons;
}

function lookingValidationReasons(item) {
  const reasons = [];
  if (!numberInRange(item?.budget, LIMITS.budgetMin, LIMITS.budgetMax)) reasons.push("budget out of range");
  if (!numberInRange(item?.occupants, LIMITS.occupantsMin, LIMITS.occupantsMax)) reasons.push("occupants out of range");
  if (!hasReasonableDate(item?.preferredMoveIn)) reasons.push("move-in date invalid");
  if (normalizePhoneDigits(item?.contactNumber).length !== 10) reasons.push("phone invalid");
  return reasons;
}

function buildListingsPayload(csvText) {
  const rows = parseCSV(csvText);
  const mapping = mapHeaders(rows[0] || []);
  mapping.__headers = rows[0] || [];

  const rentListings = [];
  const lookingListings = [];

  rows.slice(1).forEach((row, idx) => {
    if (isHiddenRow(row, mapping)) return;
    const listingType = classifyListingRow(row, mapping);
    if (listingType === "rent") {
      const listing = rowToRentListing(row, mapping, idx);
      if (rentValidationReasons(listing).length === 0) rentListings.push(listing);
    }
    if (listingType === "looking") {
      const listing = rowToLookingListing(row, mapping, idx);
      if (lookingValidationReasons(listing).length === 0) lookingListings.push(listing);
    }
  });

  return {
    generatedAt: new Date().toISOString(),
    rentListings,
    lookingListings
  };
}

async function fetchListings(request, env) {
  if (!env.SHEET_CSV_URL) {
    return json({ ok: false, error: "Missing SHEET_CSV_URL" }, 500, request, env);
  }

  const cache = caches.default;
  const cacheKey = new Request(new URL("/listings-cache-v1", request.url), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) {
    return new Response(cached.body, {
      status: cached.status,
      headers: {
        ...Object.fromEntries(cached.headers),
        ...corsHeaders(request, env),
        "X-LZ-Cache": "hit"
      }
    });
  }

  const separator = env.SHEET_CSV_URL.includes("?") ? "&" : "?";
  const sheetResponse = await fetch(`${env.SHEET_CSV_URL}${separator}v=${Date.now()}`, {
    headers: { "User-Agent": "LotusZingListingsWorker/1.0" },
    cf: { cacheTtl: 0, cacheEverything: false }
  });
  if (!sheetResponse.ok) {
    return json({ ok: false, error: `Sheet fetch failed: ${sheetResponse.status}` }, 502, request, env);
  }

  const payload = buildListingsPayload(await sheetResponse.text());
  const response = json(payload, 200, request, env, true);
  await cache.put(cacheKey, response.clone());
  return response;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    if (request.method !== "GET") return json({ ok: false, error: "Method not allowed" }, 405, request, env);
    if (url.pathname === "/health") return json({ ok: true }, 200, request, env);
    if (url.pathname === "/" || url.pathname === "/listings") return fetchListings(request, env);
    return json({ ok: false, error: "Not found" }, 404, request, env);
  }
};
