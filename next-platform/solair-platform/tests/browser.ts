import { chromium, type BrowserContext } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
const base = process.env.TEST_URL || "http://127.0.0.1:3000";
mkdirSync("docs/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors: string[] = [];
const results: string[] = [];
const operator = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  }),
  driver = await browser.newContext({ viewport: { width: 390, height: 844 } }),
  engineer = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
async function signIn(context: BrowserContext, role: string) {
  const p = await context.newPage();
  p.on("pageerror", (e: any) => errors.push(e.message));
  await p.goto(base);
  await p.getByLabel("Email address").fill(`${role}@solair.local`);
  await p.getByLabel("Password", { exact: true }).fill("SolairDemo!2026");
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p
    .getByRole("heading", {
      name:
        role === "driver" ? "Ready for the road, Miguel." : "Fleet overview",
    })
    .waitFor();
  await p.getByLabel('Data mode').selectOption('demo');
  await p.waitForFunction(()=>{const image=document.querySelector('.vehicle-hero img') as HTMLImageElement|null;return image?.complete&&image.naturalWidth>0;});
  await p.waitForTimeout(500);
  return p;
}
const op = await signIn(operator, "operator"),
  dr = await signIn(driver, "driver"),
  en = await signIn(engineer, "engineer");
assert.equal(
  await op
    .locator(".vehicle-hero img")
    .evaluate((i: any) => i.naturalWidth > 0),
  true,
);
results.push("Approved white BEMAC image loads");
await op.locator('.map-vehicle').first().waitFor();
await op.locator('.leaflet-control-zoom-in').click();
const markerBeforeRefresh = await op.locator('.map-vehicle').first().getAttribute('style');
const refreshed = op.waitForResponse(r=>r.url().includes('/api/fleet?mode=demo'));
await op.getByRole('button',{name:'Refresh',exact:true}).click();
await refreshed;
await op.waitForTimeout(300);
assert.equal(await op.locator('.map-vehicle').first().getAttribute('style'),markerBeforeRefresh);
results.push('Map refresh preserves operator zoom');
for (const title of [
  "Live Fleet Map",
  "Vehicles",
  "Energy",
  "Security",
  "SOS & Assistance",
  "Messages",
  "History & Reports",
  "Settings",
  "Overview",
]) {
  await op
    .locator(".sidebar nav")
    .getByRole("button", { name: title, exact: title !== "SOS & Assistance" })
    .click();
  await op.waitForTimeout(180);
  assert.equal(await op.locator("main h1").count(), 1);
}
results.push("All operator pages navigate");
let beginDelayed!: () => void;
const startedDelayed = new Promise<void>((r) => { beginDelayed = r; });
await op.route("**/api/fleet?mode=demo", async (route) => {
  const response = await route.fetch();
  beginDelayed();
  await new Promise((r) => setTimeout(r, 600));
  await route.fulfill({ response });
});
await op.getByRole("button", {name: "Refresh", exact: true}).click();
await startedDelayed;
await op.getByLabel("Data mode").selectOption("hardware");
await op
  .locator(".vehicle-hero")
  .getByText("Never connected", { exact: true })
  .waitFor();
await op.waitForTimeout(800);
assert.equal(await op.locator(".vehicle-hero").getByText("Never connected", {exact: true}).count(), 1);
await op.unroute("**/api/fleet?mode=demo");
results.push("Late demo responses cannot overwrite hardware mode");
await op
  .locator(".sidebar nav")
  .getByRole("button", { name: "Energy", exact: true })
  .click();
await op.getByText("Not yet instrumented", { exact: true }).waitFor();
results.push("Real mode has unavailable values and no fabricated GPS");
await op.getByLabel("Data mode").selectOption("demo");
await op
  .locator(".sidebar nav")
  .getByRole("button", { name: "Overview", exact: true })
  .click();
await op.waitForTimeout(500);
await op.screenshot({ path: "docs/screenshots/operator.png", fullPage: true });
await dr
  .locator(".bottom-nav")
  .getByRole("button", { name: "Help", exact: true })
  .click();
await dr.getByLabel("Assistance type").selectOption("Mechanical assistance");
const note = `Browser test ${Date.now()}`;
await dr.getByLabel("Tell your operator what happened").fill(note);
await dr
  .getByRole("button", { name: "Send help request", exact: true })
  .click();
await dr
  .getByText(
    "Server received your request. Awaiting operator acknowledgment.",
    { exact: true },
  )
  .waitFor();
await op
  .locator(".sidebar nav")
  .getByRole("button", { name: "SOS & Assistance", exact: false })
  .click();
await op.getByText(note, { exact: true }).waitFor();
const request = op.locator(".request").filter({ hasText: note });
await request.getByRole("button", { name: "Acknowledge", exact: true }).click();
await dr
  .locator(".request")
  .filter({ hasText: note })
  .getByText("acknowledged", { exact: true })
  .waitFor();
await request
  .getByRole("button", { name: "Mark resolved", exact: true })
  .click();
await dr
  .locator(".request")
  .filter({ hasText: note })
  .getByText("resolved", { exact: true })
  .waitFor();
results.push(
  "Driver SOS/help persists, streams to operator and acknowledgment/resolution returns",
);
await op
  .locator(".sidebar nav")
  .getByRole("button", { name: "Messages", exact: true })
  .click();
const message = `Browser verified message ${Date.now()}`;
await op
  .getByRole("textbox", { name: "Message", exact: true })
  .fill(message);
await op.getByRole("button", { name: "Send", exact: true }).click();
await op.getByText(message, { exact: true }).waitFor();
await op.reload();
await op.getByLabel('Data mode').selectOption('demo');
await op
  .locator(".sidebar nav")
  .getByRole("button", { name: "Messages", exact: true })
  .click();
await op
  .getByText(message, { exact: true })
  .first()
  .waitFor();
results.push("Messages persist after browser reload");
await en
  .locator(".sidebar nav")
  .getByRole("button", { name: "CPE Lab", exact: false })
  .click();
await en.getByRole("heading", { name: "From breadboard to road." }).waitFor();
await en.getByLabel("Data mode").selectOption("hardware");
await en.waitForTimeout(300);
await en.getByLabel("Observed result").selectOption("BLOCKED");
await en
  .getByLabel("Notes", { exact: true })
  .fill("Software browser test only; physical ESP32 not connected");
await en.getByRole("button", { name: "Save test record", exact: true }).click();
await en
  .getByText("Test evidence saved. Physical result recorded by engineer.", {
    exact: true,
  })
  .waitFor();
await en.waitForTimeout(300);
await en.screenshot({ path: "docs/screenshots/cpe-lab.png", fullPage: true });
results.push("Engineering evidence persists; no automatic physical PASS");
assert.equal(
  await dr.evaluate(async()=> (await fetch('/api/bench/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({device_id:'SOL-ET-01'})})).status),
  403,
);
assert.equal(
  await dr.evaluate(async()=> (await fetch('/api/history/ET-02')).status),
  403,
);
results.push("Driver unauthorized API requests fail");
await dr
  .locator(".bottom-nav")
  .getByRole("button", { name: "Home", exact: true })
  .click();
await dr.waitForTimeout(800);
assert.equal(
  await dr.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  ),
  true,
);
await dr.screenshot({ path: "docs/screenshots/driver.png", fullPage: true });
results.push("390px driver layout has no horizontal overflow");
await driver.setOffline(true);
await dr
  .locator(".bottom-nav")
  .getByRole("button", { name: "Help", exact: true })
  .click();
await dr
  .getByLabel("Tell your operator what happened")
  .fill("Queued offline browser test");
await dr
  .getByRole("button", { name: "Send help request", exact: true })
  .click();
await dr
  .getByText("Request QUEUED / UNSENT. No server acknowledgment received.", {
    exact: true,
  })
  .waitFor();
await driver.setOffline(false);
await dr
  .getByText("Queued help request received by server", { exact: true })
  .waitFor();
results.push("Offline help is marked unsent and retried after reconnect");
const manifest = await op.request
  .get(base + "/manifest.webmanifest")
  .then((r: any) => r.json());
assert.equal(manifest.display, "standalone");
for (const i of manifest.icons)
  assert.equal(
    await op.request.get(base + i.src).then((r: any) => r.status()),
    200,
  );
assert.equal(
  await op.request.get(base + "/sw.js").then((r: any) => r.status()),
  200,
);
results.push(
  "PWA manifest, standalone mode, icons and service worker available",
);
await op
  .locator(".sidebar")
  .getByRole("button", { name: "Log out", exact: true })
  .click();
await op.getByRole("heading", { name: "Welcome to SOLAIR" }).waitFor();
assert.equal(
  await op.request.get(base + "/api/me").then((r: any) => r.status()),
  401,
);
results.push("Logout invalidates browser session");
assert.deepEqual(errors, []);
results.push("No browser runtime errors");
writeFileSync(
  "docs/browser-results.json",
  JSON.stringify(
    { at: new Date().toISOString(), base, results, errors },
    null,
    2,
  ),
);
console.log(results.join("\n"));
await browser.close();
