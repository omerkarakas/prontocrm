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
await page.waitForTimeout(1400);

// 1) Liste Seçenekleri
await page.goto(`${BASE}/liste-secenekleri`);
await page.waitForTimeout(1200);
await page.getByRole("tab", { name: "Şehirler" }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: "shots/14-liste-secenekleri.png" });

// 2) kişiler — Ad bağlantı affordance (hover'sız görünür)
await page.goto(`${BASE}/kisiler`);
await page.waitForTimeout(1400);
await page.screenshot({ path: "shots/15-kisiler-ad-link.png" });

// 3) etkinlikler — arama + durum filtresi + sıralama
await page.goto(`${BASE}/etkinlikler`);
await page.waitForTimeout(1200);
await page.getByRole("combobox").click();
await page.getByRole("option", { name: "Tamamlandı" }).click();
await page.waitForTimeout(400);
// tarih sütununa tıkla → sıralama
await page.getByRole("columnheader", { name: /Tarih/ }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: "shots/16-etkinlikler-filtre.png" });

// 4) etkinlik detayı — katılımcı arama + durum filtresi
await page.locator('[role="gridcell"] button').first().click();
await page.waitForTimeout(1200);
await page.getByPlaceholder("Katılımcı ara…").fill("a");
await page.waitForTimeout(400);
await page.screenshot({ path: "shots/17-etkinlik-detay-filtre.png" });

await ctx.close();
await browser.close();
console.log(errors.length ? `HATALAR:\n${errors.join("\n")}` : "Konsol hatası yok");
