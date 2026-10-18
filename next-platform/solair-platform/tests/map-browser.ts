import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";

// Read-only map checks against the local development demo accounts.
const base = process.env.TEST_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch();
mkdirSync("test-results/map", { recursive: true });
async function center(page: Page) {
  await page.locator('.fleet-map .leaflet-tile[src^="https://tile.openstreetmap.org/"]').first().waitFor();
  return page.locator(".fleet-map").evaluate((map) => {
    const tile = map.querySelector<HTMLImageElement>('.leaflet-tile[src^="https://tile.openstreetmap.org/"]');
    const match = tile?.src.match(/\/(\d+)\/(\d+)\/(\d+)\.png/);
    if (!tile || !match) throw new Error("No basemap tile coordinates");
    const [, z, x, y] = match.map(Number);
    const bounds = map.getBoundingClientRect();
    const image = tile.getBoundingClientRect();
    const worldX = x * 256 + bounds.left + bounds.width / 2 - image.left;
    const worldY = y * 256 + bounds.top + bounds.height / 2 - image.top;
    const size = 256 * 2 ** z;
    return {
      zoom: z,
      longitude: worldX / size * 360 - 180,
      latitude: Math.atan(Math.sinh(Math.PI * (1 - 2 * worldY / size))) * 180 / Math.PI,
    };
  });
}
async function assertMalabon(page: Page) {
  const position = await center(page);
  assert.equal(position.zoom, 14);
  assert.ok(Math.abs(position.latitude - 14.668) < 0.001, JSON.stringify(position));
  assert.ok(Math.abs(position.longitude - 120.965) < 0.001, JSON.stringify(position));
}
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1050 } });
    let emptyFleet = false;
    let gpsAge = 60000;
    let hardwareFix: { latitude: number; longitude: number; measured_at: string } | null = null;
    const tileReferrers: (string | null)[] = [];
    // Do not repeatedly request public community tiles during automated checks.
    await page.route("https://tile.openstreetmap.org/**", async (route) => {
      tileReferrers.push(await route.request().headerValue("referer"));
      await route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e8efe8"/></svg>' });
    });
    // Browser-only fixtures: never insert synthetic positions into the database.
    await page.route(/\/api\/fleet\?/, async (route) => {
      const demo = new URL(route.request().url()).searchParams.get("mode") === "demo";
      await route.fulfill({ json: emptyFleet ? [] : [{
        id: "ET-01", name: "Map test vehicle", model: "BEMAC 68VM",
        image_url: "/bemac-white.png", driver_name: "Map test driver",
        driver_id: "driver", device_id: "SOL-ET-01", status: "Online",
        nominal_voltage: 60, nominal_capacity: 100, solar_wh: null,
        wind_wh: null, telemetry: !demo && hardwareFix ? { gps_fix: true, gps_fix_age_ms: gpsAge, received_at: new Date().toISOString(), sensor_health: {} } : null,
        gps: demo ? { latitude: 14.61, longitude: 121.03, measured_at: new Date().toISOString() } : hardwareFix,
      }] });
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base);
    await page.getByLabel("Email address").fill("operator@solair.local");
    await page.getByLabel("Password", { exact: true }).fill("SolairDemo!2026");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("heading", { name: "Fleet overview" }).waitFor();
    await page.getByLabel("Data mode").selectOption("demo");
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    try {
      await page.locator(".leaflet-tile-loaded").first().waitFor({ timeout: 15000 });
    } catch (error) {
      await page.screenshot({ path: "test-results/map/check.png", fullPage: true });
      console.log((await page.locator("body").innerText()).slice(0, 5000), errors);
      throw error;
    }
    await page.waitForTimeout(500);
    await assertMalabon(page);
    await page.getByRole("button", { name: "Show vehicles", exact: true }).click();
    const fleetCenter = await center(page);
    assert.ok(Math.abs(fleetCenter.longitude - 120.965) > 0.01);
    await page.getByRole("button", { name: "Malabon", exact: true }).click();
    await assertMalabon(page);
    await page.locator(".leaflet-control-zoom-in").click();
    const before = await center(page);
    const refreshed = page.waitForResponse((response) => response.url().includes("/api/fleet?mode=demo"));
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await refreshed;
    await page.waitForTimeout(300);
    assert.deepEqual(await center(page), before);
    await page.getByRole("button", { name: "Malabon", exact: true }).click();
    if (width < 768) await page.getByRole("button", { name: "Toggle menu" }).click();
    await page.locator(".sidebar nav").getByRole("button", { name: "Live Fleet Map", exact: true }).click();
    await page.locator(".full-map .leaflet-tile-loaded").first().waitFor();
    await assertMalabon(page);
    await page.screenshot({ path: `test-results/map/map-${width}.png`, fullPage: true });
    await page.getByLabel("Data mode").selectOption("hardware");
    await page.getByText("No valid GPS positions", { exact: true }).waitFor();
    await assertMalabon(page);
    assert.equal(await page.getByRole("button", { name: "Show vehicles", exact: true }).isDisabled(), true);
    assert.equal(await page.locator(".map-vehicle").count(), 0);
    await page.screenshot({ path: `test-results/map/empty-${width}.png`, fullPage: true });
    hardwareFix = { latitude: 14.666, longitude: 120.96, measured_at: new Date().toISOString() };
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await page.locator(".map-vehicle").waitFor();
    await page.locator(".map-vehicle .offline").waitFor();
    gpsAge = 0;
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await page.locator(".map-vehicle .online").waitFor();
    const firstFixPosition = await page.locator(".map-vehicle").getAttribute("style");
    hardwareFix = { ...hardwareFix, longitude: 120.962 };
    const gpsRefresh = page.waitForResponse((response) => response.url().includes("/api/fleet?mode=hardware"));
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await gpsRefresh;
    await page.waitForFunction((previous) => document.querySelector(".map-vehicle")?.getAttribute("style") !== previous, firstFixPosition);
    await assertMalabon(page);
    emptyFleet = true;
    const emptyRefresh = page.waitForResponse((response) => response.url().includes("/api/fleet?mode=hardware"));
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await emptyRefresh;
    await page.getByText("No assigned vehicles. Showing Malabon as a reference.", { exact: true }).waitFor();
    await page.locator(".leaflet-tile-loaded").first().waitFor();
    await assertMalabon(page);
    assert.ok(tileReferrers.length > 0, "Map must request canonical tiles");
    assert.ok(tileReferrers.every((referrer) => referrer === new URL(base).origin + "/"), "Tile requests must include the actual site origin");
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: overview/full map default to Malabon, fleet framing, recenter, refresh preserves zoom, empty GPS/fleet, no browser errors`);
    await page.close();
  }
} finally {
  await browser.close();
}
