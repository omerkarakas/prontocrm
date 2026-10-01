import { chromium } from "playwright";

const BASE = "http://localhost:3002";
const browser = await chromium.launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(`${BASE}/login`);
await page.getByRole("button", { name: /ayse@pronto\.app/ }).click();
await page.getByRole("button", { name: "Giriş yap" }).click();
await page.waitForURL("**/kisiler", { timeout: 20000 });
await page.waitForTimeout(1500);

// şehri "Bursa" OLMAYAN ilk satırı bul
const rows = page.locator("div.pgrid-row");
const n = await rows.count();
let target = -1;
let before = "";
for (let i = 0; i < Math.min(n, 12); i++) {
  const t = (await rows.nth(i).locator('[role="gridcell"]').nth(8).textContent())?.trim() ?? "";
  if (t !== "Bursa") {
    target = i;
    before = t;
    break;
  }
}
if (target < 0) throw new Error("uygun satır bulunamadı");

const cell = rows.nth(target).locator('[role="gridcell"]').nth(8);
const name = (await rows.nth(target).locator('[role="gridcell"]').nth(2).textContent())?.trim();
await cell.dblclick();
await page.locator("select.cell-input").last().selectOption({ label: "Bursa" });
await page.waitForTimeout(900);
const after = (await cell.textContent())?.trim();
console.log(`ızgara combobox: ${name} "${before}" → "${after}"`);
if (after !== "Bursa") throw new Error("hücre güncellenmedi");

await browser.close();
console.log(errors.length ? `HATALAR:\n${errors.join("\n")}` : "Konsol hatası yok");
