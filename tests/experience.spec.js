import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const evidenceDir = "test-results/evidence";

async function enterExperience(page, path = "/?debug=1") {
  const errors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (["error", "warning"].includes(message.type()) && !text.includes("GL Driver Message")) errors.push(text);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(path, { waitUntil: "networkidle" });
  await expect(page.locator("[data-loader]")).toBeHidden({ timeout: 15_000 });
  await page.waitForTimeout(700);
  return errors;
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
}

async function scrollChapter(page, selector, progress = 0.5) {
  await page.evaluate(({ selector, progress }) => {
    const element = document.querySelector(selector);
    const max = Math.max(0, element.offsetHeight - innerHeight);
    window.scrollTo(0, element.offsetTop + max * progress);
  }, { selector, progress });
  await page.waitForTimeout(1200);
}

test.beforeAll(async () => {
  await mkdir(evidenceDir, { recursive: true });
});

test("desktop journey, reverse, and renderer budget", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = await enterExperience(page);
  await expect(page.locator("#world-canvas")).toBeVisible();
  const heroStats = await page.evaluate(() => window.__TSL_DEBUG__.getStats());
  expect(heroStats.heroScreen.inFrame).toBe(true);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: `${evidenceDir}/desktop-hero.png` });

  await scrollChapter(page, "#journey", 0.48);
  await page.screenshot({ path: `${evidenceDir}/desktop-journey.png` });

  await scrollChapter(page, "#selected-works", 0.52);
  await expect(page.locator(".project-meta")).toBeVisible();
  const shelfStats = await page.evaluate(() => window.__TSL_DEBUG__.getStats());
  expect(shelfStats.activeBookScreen.inFrame).toBe(true);
  expect(shelfStats.calls).toBeLessThan(190);
  expect(shelfStats.triangles).toBeLessThan(500_000);
  expect(shelfStats.textures).toBeLessThan(50);
  await page.screenshot({ path: `${evidenceDir}/desktop-shelf.png` });

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1200);
  await expect(page.locator("[data-chapter-current]")).toHaveText("01");
  const stats = await page.evaluate(() => window.__TSL_DEBUG__.getStats());
  expect(stats.calls).toBeLessThan(130);
  expect(stats.triangles).toBeLessThan(500_000);
  expect(stats.textures).toBeLessThan(50);
  expect(errors).toEqual([]);
});

test("desktop inspection traps focus and restores its exact shelf transform", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = await enterExperience(page);
  await scrollChapter(page, "#selected-works", 0.52);
  await page.locator("[data-open-focused-project]").click();
  await expect(page.locator("[data-project-panel]")).toBeVisible();
  await page.waitForTimeout(1300);
  await expect(page.locator("[data-close-project]")).toBeFocused();
  await page.screenshot({ path: `${evidenceDir}/desktop-inspection.png` });
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("[data-panel-url]")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("[data-close-project]")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-project-panel]")).toBeHidden({ timeout: 5_000 });
  const restoration = await page.evaluate(() => window.__TSL_DEBUG__.getRestorationError(3));
  expect(Math.max(restoration.position, restoration.rotation, restoration.scale)).toBeLessThan(0.0001);
  expect(errors).toEqual([]);
});

test("tablet and mobile chapter compositions", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (["error", "warning"].includes(message.type()) && !text.includes("GL Driver Message")) errors.push(text);
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/?debug=1", { waitUntil: "networkidle" });
  await expect(page.locator("[data-loader]")).toBeHidden({ timeout: 15_000 });
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: `${evidenceDir}/tablet-hero.png` });
  await scrollChapter(page, "#selected-works", 0.44);
  const tabletStats = await page.evaluate(() => window.__TSL_DEBUG__.getStats());
  expect(tabletStats.activeBookScreen.inFrame).toBe(true);
  await page.screenshot({ path: `${evidenceDir}/tablet-shelf.png` });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?debug=1&viewport=mobile", { waitUntil: "networkidle" });
  await expect(page.locator("[data-loader]")).toBeHidden({ timeout: 15_000 });
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: `${evidenceDir}/mobile-hero.png` });
  await scrollChapter(page, "#selected-works", 0.62);
  await page.screenshot({ path: `${evidenceDir}/mobile-shelf.png` });
  await page.locator("[data-open-focused-project]").click();
  await expect(page.locator("[data-project-panel]")).toBeVisible();
  await page.waitForTimeout(1300);
  await expect(page.locator("[data-mobile-inspection-cover]")).toBeVisible();
  await expect(page.locator("[data-close-project]")).toBeFocused();
  await page.screenshot({ path: `${evidenceDir}/mobile-inspection.png` });
  expect(errors).toEqual([]);
});

test("reduced motion and static fallback preserve the collection", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedErrors = await enterExperience(page, "/?debug=1");
  await scrollChapter(page, "#selected-works", 0.5);
  await expect(page.locator("[data-project-buttons] button")).toHaveCount(7);
  await page.screenshot({ path: `${evidenceDir}/mobile-reduced-motion.png` });
  expect(reducedErrors).toEqual([]);

  const fallbackPage = await page.context().newPage();
  await fallbackPage.setViewportSize({ width: 390, height: 844 });
  const fallbackErrors = await enterExperience(fallbackPage, "/?fallback=1");
  await expect(fallbackPage.locator("[data-webgl-fallback]")).toBeVisible();
  await expect(fallbackPage.locator(".fallback-project")).toHaveCount(7);
  await fallbackPage.screenshot({ path: `${evidenceDir}/mobile-fallback.png`, fullPage: true });
  await fallbackPage.close();
  expect(fallbackErrors).toEqual([]);
});

test("reading, binding, studio, and commission retain authored chapter states", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await enterExperience(page);
  const chapters = [
    ["#reading-room", 0.62, "THE READING ROOM", "desktop-reading-room.png"],
    ["#binding", 0.5, "BINDING", "desktop-binding.png"],
    ["#studio", 0.62, "THE STUDIO", "desktop-studio.png"],
    ["#commission", 0.7, "COMMISSION", "desktop-commission.png"]
  ];

  for (const [selector, progress, label, filename] of chapters) {
    await scrollChapter(page, selector, progress);
    await expect(page.locator("[data-chapter-label]")).toHaveText(label);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${evidenceDir}/${filename}` });
  }

  expect(errors).toEqual([]);
});
