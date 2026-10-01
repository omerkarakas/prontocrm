import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
fs.mkdirSync("shots", { recursive: true });

const browser = await chromium.launch();
const errors = [];

let storageState;
async function newPage(dark = false) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState });
  if (dark) await ctx.emulateMedia?.({ colorScheme: "dark" }).catch(() => {});
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("favicon")) errors.push(`console: ${m.text().slice(0, 300)}`);
  });
  return { ctx, page };
}

// 1) giriş ekranı + oturum yakala
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("favicon")) errors.push(`console: ${m.text().slice(0, 300)}`);
  });
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "shots/01-login.png" });

  // 2) demo hesabıyla giriş
  await page.getByRole("button", { name: /ayse@pronto\.app/ }).click();
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL("**/kisiler", { timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "shots/02-kisiler.png" });
  storageState = await ctx.storageState({ path: "shots/state.json" });

  // 3) kişi detayı çekmecesi (ad butonu "… — detayları aç" başlıklıdır)
  await page.locator('button[title*="detayları aç"]').first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "shots/03-kisi-detay.png" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // 4) satır seçimi + toplu çubuk
  await page.locator('[role="row"] [role="gridcell"] button[role="checkbox"], [role="row"] [role="gridcell"] button[data-state]').first().click().catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: "shots/04-toplu-islem.png" });

  // 5) komut paleti
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(900);
  await page.screenshot({ path: "shots/05-komut-paleti.png" });
  await page.keyboard.press("Escape");
  await ctx.close();
}

// 6) etkinlikler
{
  const { ctx, page } = await newPage();
  await page.goto(`${BASE}/etkinlikler`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "shots/06-etkinlikler.png" });
  // ilk etkinlik detayı
  await page.locator('[role="gridcell"] button').first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "shots/07-etkinlik-detay.png" });
  await ctx.close();
}

// 7) içe aktar
{
  const { ctx, page } = await newPage();
  await page.goto(`${BASE}/ice-aktar`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "shots/08-ice-aktar.png" });
  await ctx.close();
}

// 8) ayarlar
{
  const { ctx, page } = await newPage();
  await page.goto(`${BASE}/ayarlar`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "shots/09-ayarlar.png" });
  await page.getByRole("tab", { name: "API Entegrasyonları" }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "shots/10-ayarlar-api.png" });
  await ctx.close();
}

// 9) gece modu
{
  const { ctx, page } = await newPage();
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.goto(`${BASE}/kisiler`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "shots/11-kisiler-gece.png" });
  await ctx.close();
}

await browser.close();
console.log(errors.length ? `HATALAR (${errors.length}):\n` + errors.slice(0, 12).join("\n") : "Konsol hatası yok");
