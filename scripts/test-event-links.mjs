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

// etkinlikler — bağlantı görünümü + navigasyon
await page.goto(`${BASE}/etkinlikler`);
await page.waitForTimeout(1400);
// ilk etkinliğin adına tıkla → detaya gitmeli
await page.locator("div.pgrid-row").first().locator('button.group\\/name').click();
await page.waitForURL(/\/etkinlikler\/.+/, { timeout: 10000 });
await page.waitForTimeout(1200);
// katılımcı adı görünümü
await page.screenshot({ path: "shots/19-etkinlik-ad-linkleri.png" });
// katılımcı linkine tıkla → kişi çekmecesi açılmalı
await page.locator("div.pgrid-row").first().locator("a.group\\/name").first().click();
await page.waitForURL(/\/kisiler\?open=.+/, { timeout: 10000 });
await page.waitForTimeout(1000);
const drawerVisible = await page.getByRole("tab", { name: /Görüşmeler/ }).isVisible();

await ctx.close();
await browser.close();
console.log(`kişi çekmecesi açıldı: ${drawerVisible}`);
console.log(errors.length ? `HATALAR:\n${errors.join("\n")}` : "Konsol hatası yok");
