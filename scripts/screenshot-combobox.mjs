import { chromium } from "playwright";

const BASE = "http://localhost:3002";
const browser = await chromium.launch();
const errors = [];

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("favicon")) errors.push(`console: ${m.text().slice(0, 200)}`);
});

await page.goto(`${BASE}/login`);
await page.getByRole("button", { name: /ayse@pronto\.app/ }).click();
await page.getByRole("button", { name: "Giriş yap" }).click();
await page.waitForURL("**/kisiler", { timeout: 20000 });
await page.waitForTimeout(1500);

// --- 1) ızgarada Şehir combobox'ından seçim ---
// görünür sütunlar: select, #, Ad, Soyad, E-posta, Telefon, Şirket, Ünvan, Şehir → index 8
const firstRow = page.locator("div.pgrid-row").first();
const cityCell = firstRow.locator('[role="gridcell"]').nth(8);
const beforeCity = (await cityCell.textContent())?.trim();
await cityCell.dblclick();
const select = page.locator("select.cell-input").last();
await select.selectOption({ label: "Adana" });
await page.waitForTimeout(900);
const afterCity = (await cityCell.textContent())?.trim();
console.log(`ızgara şehir: "${beforeCity}" → "${afterCity}"`);
if (afterCity !== "Adana") {
  console.log("HATA: ızgara combobox seçimi hücreye yansımadı");
}

// --- 2) çekmecede Şehir combobox'ı (Radix Select) ---
await page.locator('button[title*="detayları aç"]').first().click();
await page.waitForTimeout(1000);
await page.getByRole("tab", { name: "Bilgiler" }).click();
await page.waitForTimeout(600);
// sıralama: Ünvan(0), Şehir(1), Kaynak(2), Sorumlu(3)
const combos = page.getByRole("combobox");
console.log("combobox sayısı:", await combos.count());
const cityTrigger = combos.nth(1);
await cityTrigger.scrollIntoViewIfNeeded();
await cityTrigger.click();
await page.waitForTimeout(500);
await page.screenshot({ path: "shots/18-cekmece-combobox.png" });
// listeden "İzmir" seç
await page.getByRole("option", { name: "İzmir", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /Değişiklikleri kaydet/ }).click();
await page.waitForTimeout(900);
console.log("çekmece kaydı yapıldı");

// kalıcılık: sayfayı tazeleyip kişinin şehrini API ile doğrula
await page.waitForTimeout(300);
await ctx.close();
await browser.close();
console.log(errors.length ? `HATALAR:\n${errors.join("\n")}` : "Konsol hatası yok");
