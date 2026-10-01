import { chromium } from "playwright";

const BASE = process.env.TEST_BASE ?? "http://localhost:3002";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("favicon")) errors.push(`console: ${m.text().slice(0, 200)}`);
});

await page.goto(`${BASE}/login`);
await page.getByRole("button", { name: /ayse@pronto\.app/ }).click();
await page.getByRole("button", { name: "Giriş yap" }).click();
await page.waitForURL("**/kisiler", { timeout: 20000 });
await page.waitForTimeout(1500);

// bir satır seç → seçili + sticky opaklık birlikte görünsün
await page.locator("div.pgrid-row [role='checkbox']").first().click();
await page.waitForTimeout(300);

// yatay kaydır
await page.locator('[role="grid"]').evaluate((el) => {
  el.scrollLeft = 650;
});
await page.waitForTimeout(300);
await page.screenshot({ path: "shots/12-yatay-scroll.png" });

// hover durumunda da opaklık korunmalı
await page.locator("div.pgrid-row").nth(7).hover();
await page.waitForTimeout(250);
await page.screenshot({ path: "shots/13-yatay-scroll-hover.png" });

await ctx.close();
await browser.close();
console.log(errors.length ? `HATALAR:\n${errors.join("\n")}` : "Konsol hatası yok");
