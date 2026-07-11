import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pageUrl = `file://${path.join(root, "listings", "index.html")}`;
const apiUrl = "https://lotus-zing-listings-api.lotus-zing.workers.dev/listings";

function isoDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function rentListing(index) {
  const bhk = ["1 BHK", "2 BHK", "3 BHK", "4+ BHK", "Studio"][index % 5];
  const tower = [1, 2, 3, 4, 5, 6, 15, 16][index % 8];
  const flat = 100 + index;
  const rent = 14000 + (index % 18) * 2500;
  return {
    id: `load-rent-${index}`,
    timestamp: isoDaysAgo(index % 24),
    towerFlat: `Tower ${tower}, Flat ${flat}`,
    bhkType: bhk,
    furnishing: index % 3 === 0 ? "Fully Furnished" : "Semi Furnished",
    monthlyRent: rent,
    securityDeposit: rent * 2,
    availableFrom: index % 4 === 0 ? "Immediate" : `2026-08-${String((index % 25) + 1).padStart(2, "0")}`,
    preferredTenant: index % 3 === 0 ? "Family" : index % 3 === 1 ? "Bachelor" : "Any",
    parking: index % 2 === 0 ? "Yes" : "No",
    listedBy: index % 4 === 0 ? "Broker Agent" : "Owner",
    posterName: `Resident ${index + 1}`,
    contactNumber: `98765${String(10000 + index).slice(0, 5)}`,
    notes: index % 5 === 0 ? "Direct sunlight, close to lift, viewing after 6 pm." : "",
    extraFields: [
      { label: "Floor", value: `${(index % 18) + 1}` },
      { label: "Visit slot", value: index % 2 === 0 ? "Evening" : "Weekend" },
      { label: "Brokerage", value: index % 4 === 0 ? "Yes" : "No" }
    ]
  };
}

function lookingListing(index) {
  const bhk = ["1 BHK", "2 BHK", "3 BHK", "4+ BHK"][index % 4];
  return {
    id: `load-looking-${index}`,
    timestamp: isoDaysAgo(index % 20),
    preferredBhk: bhk,
    budget: 18000 + (index % 12) * 3000,
    preferredMoveIn: index % 3 === 0 ? "Immediate" : `2026-08-${String((index % 25) + 1).padStart(2, "0")}`,
    occupants: (index % 5) + 1,
    tenantType: index % 2 === 0 ? "Family" : "Bachelor",
    preferredArea: index % 3 === 0 ? "Any allowed tower" : `Tower ${[1, 3, 5, 15][index % 4]}`,
    posterName: `Tenant Lead ${index + 1}`,
    contactNumber: `98990${String(20000 + index).slice(0, 5)}`,
    notes: index % 4 === 0 ? "Needs parking and prefers owner-only listings." : "",
    extraFields: [
      { label: "Workplace", value: index % 2 === 0 ? "Noida" : "Delhi" },
      { label: "Lease", value: "11 months" }
    ]
  };
}

const payload = {
  generatedAt: new Date().toISOString(),
  rentListings: Array.from({ length: 75 }, (_, index) => rentListing(index)),
  lookingListings: Array.from({ length: 25 }, (_, index) => lookingListing(index))
};

function overlapCount(boxes) {
  let overlaps = 0;
  for (let i = 1; i < boxes.length; i += 1) {
    if (boxes[i].top < boxes[i - 1].bottom - 1) overlaps += 1;
  }
  return overlaps;
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  });
  const page = await browser.newPage({ viewport: { width: 319, height: 854 }, deviceScaleFactor: 2, isMobile: true });
  const consoleErrors = [];
  const pageErrors = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) consoleErrors.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.route(apiUrl, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(payload)
  }));

  const started = Date.now();
  await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll(".listing-card").length >= 75, null, { timeout: 10000 });
  const renderMs = Date.now() - started;

  const rentCards = await page.locator(".listing-card").count();
  const rentSummary = await page.locator("#result-summary").textContent();
  const tabCounts = await page.evaluate(() => ({
    flats: document.querySelector("#rent-count")?.textContent?.trim() || "",
    tenants: document.querySelector("#looking-count")?.textContent?.trim() || ""
  }));

  await page.getByRole("button", { name: /Submit listing or request/i }).click();
  await page.waitForSelector("#submit-rules-dialog[open]", { timeout: 5000 });
  const submitDialogTitle = await page.locator("#submit-rules-title").textContent();
  const submitRuleCount = await page.locator("#submit-rules-list li").count();
  await page.getByRole("button", { name: /Review first/i }).click();

  const boxes = await page.locator(".listing-card").evaluateAll((cards) => cards.slice(0, 12).map((card) => {
    const box = card.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, height: box.height };
  }));

  await page.evaluate(() => {
    const input = document.querySelector("#filter-search-rent");
    if (input) input.value = "Tower 3";
    window.updateFilter("search", "Tower 3");
  });
  await page.waitForTimeout(250);
  const searchSummary = await page.locator("#result-summary").textContent();

  await page.getByRole("button", { name: /Requests|Tenants/i }).click();
  await page.waitForFunction(() => document.querySelectorAll(".listing-card").length >= 25, null, { timeout: 10000 });
  await page.waitForTimeout(800);
  const lookingCards = await page.locator(".listing-card").count();
  const lookingSummary = await page.locator("#result-summary").textContent();

  const screenshotPath = path.join(root, "listings-100-test-mobile.png");
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await browser.close();

  const result = {
    payload: { rent: payload.rentListings.length, looking: payload.lookingListings.length, total: 100 },
    renderMs,
    rentCards,
    lookingCards,
    rentSummary,
    lookingSummary,
    searchSummary,
    tabCounts,
    submitDialogTitle,
    submitRuleCount,
    firstCardHeights: boxes.map((box) => Math.round(box.height)),
    overlapsInFirst12: overlapCount(boxes),
    consoleErrors,
    pageErrors,
    screenshotPath
  };

  fs.writeFileSync(path.join(root, "listings-100-test-result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
