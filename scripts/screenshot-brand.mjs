import { chromium } from "playwright";

const BASE = "http://localhost:3002";
const browser = await chromium.launch();

async function session() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("favicon")) errors.push(`console: ${m.text().slice(0, 200)}`);
  });
  return { ctx, page, errors };
}

// 1) giriş ekranı (marka paneli) + oturum
{
  const { ctx, page } = await session();
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "shots/20-login-yeni-marka.png" });
  await page.getByRole("button", { name: /ayse@pronto\.app/ }).click();
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL("**/kisiler", { timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "shots/21-kisiler-yeni-marka.png" });
  await ctx.close();
}

// 2) gece modu
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "shots/22-login-gece.png" });
  await page.getByRole("button", { name: /ayse@pronto\.app/ }).click();
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL("**/kisiler", { timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "shots/23-kisiler-gece-yeni-marka.png" });
  await ctx.close();
}

await browser.close();
console.log("tamam");
