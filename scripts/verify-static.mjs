/**
 * Static gate.
 *
 * Cheap assertions that guard the specific things that were previously wrong,
 * so they cannot come back silently. Run with `npm run test:static`.
 */
import { readFile } from "node:fs/promises";
import { PROJECTS, HERO_VOLUME, SHELF } from "../src/data/projects.js";
import { CHAPTERS, KEYFRAMES } from "../src/data/chapters.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [html, css, main, world, environment, book] = await Promise.all([
  read("../index.html"),
  read("../src/style.css"),
  read("../src/main.js"),
  read("../src/three/World.js"),
  read("../src/three/environment.js"),
  read("../src/three/Book3D.js")
]);

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

/* ---- data ---------------------------------------------------------- */

const required = [
  "slug", "volume", "client", "title", "year", "industry", "category",
  "services", "technology", "premise", "description", "outcome", "url",
  "palette", "book"
];
[...PROJECTS, HERO_VOLUME].forEach((project) => {
  required.forEach((field) => {
    check(project[field] != null, `${project.slug} is missing ${field}`);
  });
  ["width", "height", "depth", "cloth", "motif", "layout"].forEach((field) => {
    check(project.book[field] != null, `${project.slug}.book is missing ${field}`);
  });
  ["primary", "secondary", "foil", "ink"].forEach((field) => {
    check(project.palette[field] != null, `${project.slug}.palette is missing ${field}`);
  });
});

// The shelf must be derived from the data, so adding a volume needs no other
// edit anywhere. This is what the previous hard-coded position arrays broke.
check(SHELF.projectSlots.length === PROJECTS.length,
  "Shelf slots and projects are out of step: the layout is not derived from the data");
check(SHELF.emptySlot.x > SHELF.projectSlots[SHELF.projectSlots.length - 1].x,
  "The reserved place must sit after the last volume");
const gaps = SHELF.projectSlots.slice(1).map((slot, i) =>
  slot.x - slot.width / 2 - (SHELF.projectSlots[i].x + SHELF.projectSlots[i].width / 2));
check(gaps.every((gap) => gap > 0 && gap < 0.2),
  "Volumes must stand shoulder to shoulder, not spaced out on a display rack");

/* ---- ledger -------------------------------------------------------- */

const chapterIds = new Set(CHAPTERS.map((chapter) => chapter.id));
KEYFRAMES.forEach((frame) => {
  check(chapterIds.has(frame.chapter), `Keyframe ${frame.id} names an unknown chapter`);
  check(frame.camera.mobile, `Keyframe ${frame.id} has no compact composition`);
  ["key", "env", "hazeNear", "hazeFar", "ground", "exposure"].forEach((channel) => {
    check(frame.world[channel] != null, `Keyframe ${frame.id} is missing world.${channel}`);
  });
  check(frame.world.hazeFar > frame.world.hazeNear, `Keyframe ${frame.id} has inverted haze`);
});
KEYFRAMES.slice(1).forEach((frame, index) => {
  const previous = KEYFRAMES[index];
  const order = (f) => CHAPTERS.findIndex((c) => c.id === f.chapter) + f.local / 1000;
  check(order(frame) > order(previous), `Keyframe ${frame.id} is out of narrative order`);
});

/* ---- regressions --------------------------------------------------- */

check(!/RectAreaLight/.test(environment + world),
  "RectAreaLight needs RectAreaLightUniformsLib or it renders as nothing");
check(/environmentIntensity|scene\.environment\s*=/.test(world),
  "Metals need an environment map or foil and brass render black");
check(/PMREMGenerator/.test(await read("../src/three/environment.js")),
  "The environment probe must be generated, not assumed");
check(!/\.material\.opacity/.test(book),
  "Volumes must recede through light, not through opacity");
check(/setHSL\([^)]*SRGBColorSpace/.test(await read("../src/three/architecture.js")),
  "setHSL defaults to the linear working space; shelved stock must declare sRGB");

/* ---- interface ----------------------------------------------------- */

[
  "data-rail", "data-edition", "data-close-panel", "data-backdrop",
  'aria-live="polite"', "Skip to content", 'role="dialog"', 'aria-modal="true"'
].forEach((needle) => check(html.includes(needle), `HTML is missing ${needle}`));

[
  "--parchment", "--paper", "--cream", "--ink", "--walnut", "--brass", "--line",
  "@media (prefers-reduced-motion: reduce)", ".reduced-motion", "100svh"
].forEach((needle) => check(css.includes(needle), `CSS is missing ${needle}`));

// The stylesheet and the entry module must agree about reduced motion, or copy
// revealed by scroll choreography is left stranded at zero opacity.
check(/classList\.toggle\("reduced-motion"/.test(main),
  "The reduced-motion decision must be published to the stylesheet as a class");

check(!/addEventListener\(\s*["']scroll["']/.test(main + world),
  "Scroll must reach the world through the conductor, not a raw listener");

const visible = html.replace(/<!--[\s\S]*?-->/g, "");
check(!visible.includes("—") && !visible.includes("–"),
  "Visible copy contains a long dash");

if (failures.length) {
  console.error(`${failures.length} check(s) failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("Static verification passed: data, derived shelf layout, scene ledger, regression guards, interface hooks and motion fallback are all in place.");
}
