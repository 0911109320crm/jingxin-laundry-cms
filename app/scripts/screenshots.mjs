// One-off: log in as owner and screenshot every admin page for the
// CMS feature overview doc. Run with `node scripts/screenshots.mjs`
// while the dev server is running on http://localhost:3000.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = "http://localhost:3000";
const EMAIL = "ren.studio.dev@gmail.com";
const PASSWORD = "admin1234";
const OUT_DIR = path.resolve("../docs/screenshots");

const VIEWPORT = { width: 1440, height: 900 };

// List of pages to capture. Each entry has a label used as filename.
const PAGES = [
  { name: "01-login", url: "/login", needsAuth: false },
  { name: "02-dashboard", url: "/dashboard" },
  { name: "03-customers-list", url: "/customers" },
  { name: "04-customers-detail", url: "_first_customer_" },
  { name: "05-customer-edit", url: "_first_customer_edit_" },
  { name: "06-orders-list", url: "/orders" },
  { name: "07-orders-tech-filter", url: "_orders_tech_" },
  { name: "08-order-detail", url: "_first_order_" },
  { name: "09-order-new", url: "/orders/new" },
  { name: "10-calendar", url: "/calendar" },
  { name: "11-payroll-list", url: "/payroll" },
  { name: "12-payroll-detail", url: "_first_tech_payroll_" },
  { name: "13-payroll-settlements", url: "/payroll/settlements" },
  { name: "14-reports", url: "/reports" },
  { name: "15-reminders", url: "/reminders" },
  { name: "16-scores", url: "/scores" },
  { name: "17-settings", url: "/settings" },
  { name: "18-settings-services", url: "/settings/services" },
  { name: "19-settings-machine-brands", url: "/settings/machine-brands" },
  { name: "20-settings-promotion-types", url: "/settings/promotion-types" },
  { name: "21-settings-users", url: "/settings/users" },
  { name: "22-settings-audit", url: "/settings/audit" },
];

async function dismissPwaPrompt(page) {
  // Some pages register a PWA install prompt that may obscure UI
  await page.evaluate(() => {
    try {
      window.dispatchEvent(new Event("appinstalled"));
    } catch {
      /* noop */
    }
  });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Saving screenshots to ${OUT_DIR}`);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    locale: "zh-TW",
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // 1) Capture login page (un-authed)
  console.log("→ /login");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.screenshot({
    path: path.join(OUT_DIR, "01-login.png"),
    fullPage: true,
  });

  // 2) Log in
  console.log("→ logging in");
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 30000,
    }),
    page.click('button[type="submit"]'),
  ]);

  // Find a real customer id + order id + tech id to use for dynamic pages
  console.log("→ /customers (also discover real ids)");
  await page.goto(`${BASE}/customers`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(OUT_DIR, "03-customers-list.png"),
    fullPage: true,
  });
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const customerHrefs = await page
    .locator('a[href^="/customers/"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  const firstCustomerId = customerHrefs
    .map((h) => h?.replace(/^\/customers\//, "").replace(/[/?].*$/, ""))
    .find((id) => id && UUID_RE.test(id));
  console.log(`   firstCustomerId=${firstCustomerId}`);

  console.log("→ /orders (also discover order id)");
  await page.goto(`${BASE}/orders`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(OUT_DIR, "06-orders-list.png"),
    fullPage: true,
  });
  const orderHrefs = await page
    .locator('a[href^="/orders/"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  const firstOrderId = orderHrefs
    .map((h) => h?.replace(/^\/orders\//, "").replace(/[/?].*$/, ""))
    .find((id) => id && UUID_RE.test(id));
  console.log(`   firstOrderId=${firstOrderId}`);

  console.log("→ /payroll (also discover tech id)");
  await page.goto(`${BASE}/payroll`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(OUT_DIR, "11-payroll-list.png"),
    fullPage: true,
  });
  const payrollHrefs = await page
    .locator('a[href^="/payroll/"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  const firstTechId = payrollHrefs
    .map((h) => h?.replace(/^\/payroll\//, "").replace(/[/?].*$/, ""))
    .find((id) => id && UUID_RE.test(id));
  console.log(`   firstTechId=${firstTechId}`);

  // Static pages
  const staticPages = [
    { name: "02-dashboard", url: "/dashboard" },
    { name: "09-order-new", url: "/orders/new" },
    { name: "10-calendar", url: "/calendar" },
    { name: "13-payroll-settlements", url: "/payroll/settlements" },
    { name: "14-reports", url: "/reports" },
    { name: "15-reminders", url: "/reminders" },
    { name: "16-scores", url: "/scores" },
    { name: "17-settings", url: "/settings" },
    { name: "18-settings-services", url: "/settings/services" },
    { name: "19-settings-machine-brands", url: "/settings/machine-brands" },
    { name: "20-settings-promotion-types", url: "/settings/promotion-types" },
    { name: "21-settings-users", url: "/settings/users" },
    { name: "22-settings-audit", url: "/settings/audit" },
  ];

  for (const p of staticPages) {
    console.log(`→ ${p.url}`);
    try {
      await page.goto(`${BASE}${p.url}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
      await dismissPwaPrompt(page);
      await page.screenshot({
        path: path.join(OUT_DIR, `${p.name}.png`),
        fullPage: true,
      });
    } catch (err) {
      console.log(`   FAIL ${p.url}: ${err.message}`);
    }
  }

  // Dynamic pages
  if (firstCustomerId) {
    console.log(`→ /customers/${firstCustomerId}`);
    await page.goto(`${BASE}/customers/${firstCustomerId}`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(OUT_DIR, "04-customers-detail.png"),
      fullPage: true,
    });

    console.log(`→ /customers/${firstCustomerId}/edit`);
    await page.goto(`${BASE}/customers/${firstCustomerId}/edit`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(OUT_DIR, "05-customer-edit.png"),
      fullPage: true,
    });
  }

  if (firstOrderId) {
    console.log(`→ /orders/${firstOrderId}`);
    await page.goto(`${BASE}/orders/${firstOrderId}`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(OUT_DIR, "08-order-detail.png"),
      fullPage: true,
    });
  }

  if (firstTechId) {
    console.log(`→ /payroll/${firstTechId}`);
    await page.goto(`${BASE}/payroll/${firstTechId}`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(OUT_DIR, "12-payroll-detail.png"),
      fullPage: true,
    });

    console.log(`→ /orders?tech=${firstTechId} (filter view)`);
    await page.goto(`${BASE}/orders?tech=${firstTechId}`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(OUT_DIR, "07-orders-tech-filter.png"),
      fullPage: true,
    });
  }

  // Cmd+K global search demo
  console.log("→ Cmd+K global search overlay");
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(500);
  // Type a search term
  await page.keyboard.type("0911");
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(OUT_DIR, "23-global-search.png"),
    fullPage: false,
  });
  await page.keyboard.press("Escape");

  // Staff PWA preview (just the start page; auth required)
  console.log("→ /staff");
  try {
    await page.goto(`${BASE}/staff`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    await page.setViewportSize({ width: 414, height: 896 });
    await page.screenshot({
      path: path.join(OUT_DIR, "24-staff-pwa.png"),
      fullPage: true,
    });
    await page.setViewportSize(VIEWPORT);
  } catch (err) {
    console.log(`   staff page skipped: ${err.message}`);
  }

  await browser.close();
  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
