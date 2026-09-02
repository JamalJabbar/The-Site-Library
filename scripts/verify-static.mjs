/**
 * Static gate.
 *
 * Cheap assertions that guard the specific things that were previously wrong,
 * so they cannot come back silently. Run with `npm run test:static`.
 */
import { readFile } from "node:fs/promises";
import { PROJECTS, HERO_VOLUME, SHELF } from "../src/data/projects.js";
import { CHAPTERS, KEYFRAMES, PRESENTATION } from "../src/data/chapters.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [html, css, main, world, environment, book, architecture, ledger, conductor] =
  await Promise.all([
    read("../index.html"),
    read("../src/style.css"),
    read("../src/main.js"),
    read("../src/three/World.js"),
    read("../src/three/environment.js"),
    read("../src/three/Book3D.js"),
    read("../src/three/architecture.js"),
    read("../src/data/chapters.js"),
    read("../src/animation/conductor.js")
  ]);

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

/** The declaration block a selector appears in, for reading a property off it. */
const ruleFor = (selector, from = 0) => {
  const at = css.indexOf(selector, from);
  if (at < 0) return null;
  const close = css.indexOf("}", at);
  return { at, text: close < 0 ? css.slice(at) : css.slice(at, close) };
};

const declares = (selector, property) => {
  for (let rule = ruleFor(selector); rule; rule = ruleFor(selector, rule.at + selector.length)) {
    if (rule.text.includes(property)) return true;
  }
  return false;
};

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

// The collection is shelved spine out and leaning, so what a volume spends
// along the run is its thickness, and what it needs inside the case is the
// width of its boards.
check(SHELF.faceZ != null && SHELF.deepest > 0 && SHELF.aim != null,
  "The shelf must publish its spine line, its depth and its camera aim");
SHELF.all.forEach((slot, index) => {
  check(slot.lean >= 0 && slot.lean < 0.25, `Shelf slot ${index} has no plausible lean`);
  check(Math.abs(slot.z - (SHELF.faceZ - slot.depth / 2)) < 1e-9,
    `Shelf slot ${index} does not stand its spine on the front line`);
  check(slot.width >= slot.thickness - 1e-9,
    `Shelf slot ${index} spends less run along the shelf than it is thick`);
});

// Two leaning boards stay parallel only while their angles agree. Where the
// lean opens up between neighbours the pair closes at the head, so clearance
// has to be measured up the whole board and not just at the shelf. This is the
// check that stops an authored lean from putting one volume inside another.
SHELF.all.slice(1).forEach((slot, index) => {
  const previous = SHELF.all[index];
  const shared = Math.min(previous.height, slot.height);
  let tightest = Infinity;
  for (let step = 0; step <= 12; step += 1) {
    const y = (shared * step) / 12;
    const trailing = previous.pivot + previous.width - y * Math.tan(previous.lean);
    const leading = slot.pivot - y * Math.tan(slot.lean);
    tightest = Math.min(tightest, leading - trailing);
  }
  check(tightest > 0.004,
    `Volumes ${index} and ${index + 1} pass through each other on the shelf`);
  check(tightest < 0.3,
    "Volumes must stand shoulder to shoulder, not spaced out on a display rack");
});

/* ---- ledger -------------------------------------------------------- */

const chapterIds = new Set(CHAPTERS.map((chapter) => chapter.id));
KEYFRAMES.forEach((frame) => {
  check(chapterIds.has(frame.chapter), `Keyframe ${frame.id} names an unknown chapter`);
  check(frame.camera.mobile, `Keyframe ${frame.id} has no compact composition`);
  ["key", "env", "hazeNear", "hazeFar", "ground", "exposure", "ink"].forEach((channel) => {
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
check(/PMREMGenerator/.test(environment),
  "The environment probe must be generated, not assumed");
check(!/\.material\.opacity/.test(book),
  "Volumes must recede through light, not through opacity");
check(/setHSL\([^)]*SRGBColorSpace/.test(architecture),
  "setHSL defaults to the linear working space; shelved stock must declare sRGB");
check(/caseBackZ:\s*SHELF\.faceZ - SHELF\.deepest/.test(architecture),
  "The case must be derived from the collection, or a wide volume stands proud of it");
check(/SPINE_OUT/.test(world) && /function shelfPose/.test(world),
  "The collection is shelved spine out, and that turn must be composed rather than authored");
check(/setPresentedPose/.test(world) && /composeTarget/.test(book),
  "A volume must travel between a shelf pose and a presented pose, with exact endpoints");

// The lens aims past the slot it is reading so the volume it draws out of the
// row has somewhere to stand. If the keyframes and the focus test disagree
// about that offset, the metadata names one volume while another is out.
const traverse = KEYFRAMES.filter((frame) => frame.chapter === "selected-works");
check(traverse.length >= 2, "The shelf traverse needs both of its keyframes");
traverse.forEach((frame) => {
  check(Math.abs(frame.camera.target[0] - frame.camera.position[0]) < 1e-9,
    `Keyframe ${frame.id} is not a straight-on traverse`);
});
check(/SHELF\.aim\b/.test(ledger) && /SHELF\.aim\b/.test(world),
  "The traverse keyframes and the focus test must share one aim offset");
check(Math.abs(SHELF.aimCompact - PRESENTATION.x) < 1e-9,
  "The compact traverse must aim at the volume it is presenting");
check(PRESENTATION.z > 0 && PRESENTATION.y > 0,
  "A presented volume has to leave the shelf and clear the board");

/* ---- legibility ---------------------------------------------------- */

// The audited invariants. Full coverage lives in scripts/text-audit.js, which
// walks the document in a browser and measures every line of type against what
// is painted behind it. These are the structural pieces that make its result
// hold, and the ones a later edit is most likely to take back out.

// A chapter's copy is clipped to its own frame, so a block that outgrows its
// stage can never be read over the chapter before it and the chapter after it.
check(declares(".chapter__stage", "overflow: hidden"),
  "Chapter stages must clip: two sticky stages share the viewport at every handover");

// Type sits on a live render, so contrast is laid down by the design rather
// than left to whatever the camera happens to be pointing at.
check(css.includes("--scrim:") && css.includes("--scrim-strength:"),
  "Copy needs a plate of its own; contrast cannot be left to the shot");
check(declares('[data-surface="dark"]', "--scrim:"),
  "The plate must turn over with the ink, or the two disagree at every surface change");

// Every list that pairs an index with a description places both of its
// columns. Left to auto-flow the description drops into the index column, sets
// one word to a line, and takes the chapter past the bottom of its own stage.
[".catalogue li p", ".process__step p"].forEach((selector) => {
  check(declares(selector, "grid-column"),
    `${selector} must be placed in the second column, not left to auto-flow`);
});

// Copy revealed by scroll is held at zero in the stylesheet rather than by the
// first run of its tween. A reader who loads the page and scrolls straight
// down would otherwise meet a chapter's copy lit while its stage is still
// climbing the frame, over the chapter it is climbing past.
[".reading__lede", ".catalogue li", ".studio__lede", ".commission__body", ".colophon"]
  .forEach((selector) => {
    check(declares(selector, "opacity: 0"),
      `${selector} must start held, not wait for its tween to run`);
  });

// Beats are authored as fractions of a chapter, which only holds if each
// chapter's timeline is exactly one unit long.
check(conductor.includes("totalDuration(1)"),
  "Scrubbed chapter timelines must be normalised, or authored positions mean nothing");

// A chapter's scrubbed window ends the moment its stage begins to leave, so
// anything still lit at that point is carried up through the masthead and read
// over the chapter arriving behind it.
check(conductor.includes('start: "bottom bottom"') &&
  conductor.includes(".chapter__stage`, { opacity: 0"),
  "Each chapter must dim as its stage leaves the frame");

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
// revealed by scroll choreography is left stranded at zero opacity. Every
// block held at zero above has to be released by name.
check(/classList\.toggle\("reduced-motion"/.test(main),
  "The reduced-motion decision must be published to the stylesheet as a class");
[".reading__lede", ".catalogue li", ".studio__lede", ".commission__body", ".colophon", ".process"]
  .forEach((selector) => {
    check(css.includes(`.reduced-motion ${selector}`),
      `${selector} is held at zero but never released under reduced motion`);
  });

check(!/addEventListener\(\s*["']scroll["']/.test(main + world),
  "Scroll must reach the world through the conductor, not a raw listener");

// The hero entrance is primed under the loader, played from one guarded call,
// and never asks either GSAP or CSS to repeat it.
check(main.includes("paused: true") && main.includes("playHeroIntroOnce()"),
  "The hero entrance must be ready before the loader dismisses and play through its one-shot guard");
check(main.indexOf("heroIntro = createHeroIntro(world)") < main.lastIndexOf("await dismiss()"),
  "The hero entrance must be created before the preloader is dismissed");
check(!/\.ready \.frontispiece__open svg[\s\S]*?infinite/.test(css),
  "The hero's load-time arrow animation must not repeat");

const visible = html.replace(/<!--[\s\S]*?-->/g, "");
check(!visible.includes("—") && !visible.includes("–"),
  "Visible copy contains a long dash");

if (failures.length) {
  console.error(`${failures.length} check(s) failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("Static verification passed: data, derived shelf layout, scene ledger, regression guards, legibility structure, interface hooks and motion fallback are all in place.");
}
