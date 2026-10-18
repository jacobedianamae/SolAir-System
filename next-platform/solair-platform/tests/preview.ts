import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
mkdirSync("docs/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
await page.goto(process.env.TEST_URL||"http://localhost:3000");
await page.getByLabel('Email address').fill('operator@solair.local');
await page.getByLabel('Password',{exact:true}).fill('SolairDemo!2026');
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.getByRole("heading", { name: "Fleet overview" }).waitFor();
await page.getByLabel('Data mode').selectOption('demo');
await page.waitForFunction(()=>{const image=document.querySelector('.vehicle-hero img') as HTMLImageElement|null;return image?.complete&&image.naturalWidth>0;});
await page.waitForTimeout(1600);
await page.waitForFunction(()=>document.querySelectorAll('.leaflet-tile-loaded').length>0,{},{timeout:15000}).catch(()=>console.log('Tile network unavailable during screenshot'));
await page.waitForTimeout(1800);
await page.locator('.vehicle-hero img').evaluate((image:HTMLImageElement)=>image.decode());
await page.screenshot({
  path: "docs/screenshots/operator.png",
  fullPage: false,
});
console.log("Operator screenshot captured");
await page.getByRole("button", { name: "Log out", exact: true }).click();
await page.getByLabel('Email address').fill('engineer@solair.local');
await page.getByLabel('Password',{exact:true}).fill('SolairDemo!2026');
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.getByRole("button", { name: "CPE Lab", exact: false }).click();
await page.getByRole("heading", { name: "From breadboard to road." }).waitFor();
await page.getByLabel('Data mode').selectOption('hardware');
await page.getByText('Never connected',{exact:true}).first().waitFor();
await page.evaluate(()=>window.scrollTo(0,0));
await page.screenshot({ path: "docs/screenshots/cpe-lab.png", fullPage: true });
await page.getByRole("button", { name: "Log out", exact: true }).click();
await page.getByLabel('Email address').fill('driver@solair.local');
await page.getByLabel('Password',{exact:true}).fill('SolairDemo!2026');
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page
  .getByRole("heading", { name: "Ready for the road, Miguel." })
  .waitFor();
await page.setViewportSize({ width: 390, height: 844 });
await page.getByLabel('Data mode').selectOption('demo');
await page.locator('.vehicle-hero img').waitFor();
await page.waitForFunction(()=>{const image=document.querySelector('.vehicle-hero img') as HTMLImageElement|null;return image?.complete&&image.naturalWidth>0;});
await page.evaluate(()=>window.scrollTo(0,0));
await page.screenshot({ path: "docs/screenshots/driver.png", fullPage: true });
console.log("Driver and Lab captured");
await browser.close();
