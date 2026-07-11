const CACHE_KEY = "listings-cache-v1";
const MAX_AGE_DAYS = 30;
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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,X-LZ-Webhook-Secret",
  "Access-Control-Max-Age": "86400"
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === "/health") {
      return json({ ok: true, generatedAt: new Date().toISOString() });
    }

    if (url.pathname === "/listings" && request.method === "GET") {
      return getListings(env);
    }

    if (url.pathname === "/webhooks/tally" && request.method === "POST") {
      return handleTallyWebhook(request, env);
    }

    return json({ error: "Not found" }, 404);
  }
};

async function getListings(env) {
  const cache = await readCache(env);
  return json(cache, 200, {
    "Cache-Control": "public, max-age=30, stale-while-revalidate=120"
  });
}

async function handleTallyWebhook(request, env) {
  if (!env.WEBHOOK_SECRET) return json({ error: "Missing worker secret" }, 500);
  const provided = request.headers.get("X-LZ-Webhook-Secret") || new URL(request.url).searchParams.get("secret") || "";
  if (!safeEqual(provided, env.WEBHOOK_SECRET)) return json({ error: "Unauthorized" }, 401);

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return json({ error: "Invalid JSON" }, 400);
  }

  const fields = normalizeTallyFields(body);
  const listingType = classifyFields(fields);
  const cache = await readCache(env);
  let accepted = false;
  let reason = "unknown listing type";

  if (listingType === "rent") {
    const listing = fieldsToRentListing(fields, body);
    const reasons = rentValidationReasons(listing);
    if (reasons.length) reason = reasons.join(", ");
    else {
      cache.rentListings = upsert(cache.rentListings, listing);
      accepted = true;
    }
  } else if (listingType === "looking") {
    const listing = fieldsToLookingListing(fields, body);
    const reasons = lookingValidationReasons(listing);
    if (reasons.length) reason = reasons.join(", ");
    else {
      cache.lookingListings = upsert(cache.lookingListings, listing);
      accepted = true;
    }
  }

  cache.rentListings = pruneActive(cache.rentListings);
  cache.lookingListings = pruneActive(cache.lookingListings);
  cache.generatedAt = new Date().toISOString();
  await env.LISTINGS_KV.put(CACHE_KEY, JSON.stringify(cache));

  if (!accepted) return json({ ok: false, accepted: false, reason }, 202);
  return json({ ok: true, accepted: true, generatedAt: cache.generatedAt });
}

async function readCache(env) {
  const fallback = { generatedAt: "", rentListings: [], lookingListings: [] };
  const raw = await env.LISTINGS_KV.get(CACHE_KEY);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return {
      generatedAt: parsed.generatedAt || "",
      rentListings: Array.isArray(parsed.rentListings) ? parsed.rentListings : [],
      lookingListings: Array.isArray(parsed.lookingListings) ? parsed.lookingListings : []
    };
  } catch (error) {
    return fallback;
  }
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      ...extraHeaders,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function safeEqual(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function normalizeTallyFields(body) {
  const sourceFields = body?.data?.fields || body?.fields || body?.response?.fields || [];
  const entries = {};

  if (Array.isArray(sourceFields)) {
    sourceFields.forEach((field) => {
      const label = field.label || field.title || field.question || field.key || field.name || "";
      const value = normalizeValue(field.value ?? field.answer ?? field.text ?? field.options);
      if (label && value) entries[normalizeKey(label)] = { label, value };
    });
  }

  flattenObject(body?.data?.answers || body?.answers || body?.data || {}).forEach(({ label, value }) => {
    if (label && value && !entries[normalizeKey(label)]) entries[normalizeKey(label)] = { label, value };
  });

  return entries;
}

function flattenObject(value, prefix = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const label = prefix ? `${prefix} ${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) return flattenObject(child, label);
    return [{ label, value: normalizeValue(child) }];
  });
}

function normalizeValue(value) {
  if (Array.isArray(value)) return value.map(normalizeValue).filter(Boolean).join(", ");
  if (value && typeof value === "object") return Object.values(value).map(normalizeValue).filter(Boolean).join(", ");
  return String(value ?? "").trim();
}

function normalizeKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getField(fields, patterns) {
  const keys = Object.keys(fields);
  const key = keys.find((candidate) => patterns.some((pattern) => pattern.test(candidate)));
  return key ? fields[key].value : "";
}

function classifyFields(fields) {
  const listingType = getField(fields, [/what.*listing/, /listing type/, /listing/]).toLowerCase();
  if (/looking|request|tenant/.test(listingType)) return "looking";
  if (/available|rent|flat|owner|broker/.test(listingType)) return "rent";
  if (getField(fields, [/tower|flat|unit/]) || getField(fields, [/monthly|rent|price/])) return "rent";
  if (getField(fields, [/budget|max/]) || getField(fields, [/preferred.*tower|preferred.*area/])) return "looking";
  return "";
}

function fieldsToRentListing(fields, body) {
  const id = body?.data?.responseId || body?.responseId || body?.eventId || crypto.randomUUID();
  return {
    id: `tally-rent-${id}`,
    timestamp: getField(fields, [/timestamp|submitted|time/]) || new Date().toISOString(),
    towerFlat: getField(fields, [/tower|flat|unit/]) || "Unknown Unit",
    bhkType: getField(fields, [/bhk|room type|room/]) || "2 BHK",
    furnishing: getField(fields, [/furnish/]) || "Semi-Furnished",
    monthlyRent: numberFrom(getField(fields, [/monthly|rent|price/])) || 0,
    securityDeposit: numberFrom(getField(fields, [/deposit|security/])) || 0,
    availableFrom: getField(fields, [/available.*from|from/]) || "Immediate",
    preferredTenant: getField(fields, [/preferred.*tenant|tenant type/]) || "Any",
    parking: getField(fields, [/parking/]) || "Yes",
    listedBy: getField(fields, [/listed|broker|agent|owner/]) || "Owner",
    posterName: getField(fields, [/name|poster/]) || "Resident",
    contactNumber: getField(fields, [/contact|phone|mobile/]) || "",
    notes: getField(fields, [/notes|comment|desc|free text/]) || "",
    extraFields: collectExtraFields(fields)
  };
}

function fieldsToLookingListing(fields, body) {
  const id = body?.data?.responseId || body?.responseId || body?.eventId || crypto.randomUUID();
  return {
    id: `tally-looking-${id}`,
    timestamp: getField(fields, [/timestamp|submitted|time/]) || new Date().toISOString(),
    preferredBhk: getField(fields, [/bhk|room type|room/]) || "2 BHK",
    budget: numberFrom(getField(fields, [/budget|max/])) || 0,
    preferredMoveIn: getField(fields, [/move|move in/]) || "Immediate",
    occupants: numberFrom(getField(fields, [/occupants|people/])) || 1,
    tenantType: getField(fields, [/tenant type|preferred tenant/]) || "Family",
    preferredArea: formatPreferredArea(getField(fields, [/preferred.*tower|preferred.*area|area/])) || "Any allowed tower",
    posterName: getField(fields, [/name|poster/]) || "Resident",
    contactNumber: getField(fields, [/contact|phone|mobile/]) || "",
    notes: getField(fields, [/notes|comment|desc|free text/]) || "",
    extraFields: collectExtraFields(fields)
  };
}

function collectExtraFields(fields) {
  const mapped = /(submission|timestamp|submitted|time|contact|phone|mobile|email|name|poster|listing|tower|flat|unit|bhk|room|furnish|rent|price|monthly|deposit|security|available|from|tenant|parking|broker|agent|owner|notes|comment|desc|budget|move|occupants|people|area)/i;
  return Object.values(fields)
    .filter((field) => field.label && field.value && !mapped.test(field.label))
    .map((field) => ({
      label: String(field.label).replace(/\s+/g, " ").slice(0, 42),
      value: String(field.value).replace(/\s+/g, " ").slice(0, 160)
    }))
    .slice(0, 10);
}

function numberFrom(value) {
  return parseInt(String(value || "").replace(/[^0-9]/g, ""), 10) || 0;
}

function numberInRange(value, min, max) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= min && amount <= max;
}

function normalizePhoneDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
}

function hasTowerAndUnit(value) {
  const numbers = String(value || "").match(/\d+/g) || [];
  return numbers.length >= 2;
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

function rentValidationReasons(item) {
  const reasons = [];
  if (!item || !item.towerFlat || item.towerFlat === "Unknown Unit" || !hasTowerAndUnit(item.towerFlat)) reasons.push("add both tower and flat number");
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

function formatPreferredArea(value) {
  const allowed = new Set(["1", "2", "3", "4", "5", "6", "15", "16"]);
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/any/i.test(raw)) return "Any allowed tower";
  const matches = raw.match(/\b(?:1[56]|[1-6])\b/g) || [];
  const towers = [...new Set(matches.filter((tower) => allowed.has(tower)))].map((tower) => `Tower ${tower}`);
  return towers.length ? towers.join(", ") : raw;
}

function upsert(list, item) {
  const without = Array.isArray(list) ? list.filter((existing) => existing.id !== item.id) : [];
  return [item, ...without].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function pruneActive(list) {
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return (Array.isArray(list) ? list : [])
    .filter((item) => {
      const time = safeParseDate(item.timestamp)?.getTime();
      return !time || time >= cutoff;
    })
    .slice(0, 1000);
}
