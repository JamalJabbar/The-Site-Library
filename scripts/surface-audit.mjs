/**
 * Surface audit.
 *
 * The page is set either in dark type on a pale ground or in pale type on a
 * dark one, and the ledger's `ink` channel decides which. Every change between
 * the two is a moment when the whole page — the copy, the plate under it, the
 * hairlines and the chrome — turns over at once, and a reader is looking at it
 * while it happens.
 *
 * A turn is only invisible if nothing is being read across it. This walks the
 * document the way a reader does, resolves `ink` with the same interpolation
 * the world uses and the same deadband the interface uses, and reports every
 * turn against the copy that is lit at that point. Run with
 * `npm run audit:surface`.
 */
import { CHAPTERS, KEYFRAMES } from "../src/data/chapters.js";

/* The three pieces of runtime behaviour this has to reproduce exactly. */

/** World.js: eased interpolation between adjacent keyframes. */
const smoothstep = (v) => v * v * (3 - 2 * v);
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * conductor.js measure(): chapters are sized in viewport heights by their
 * weight, so narrative progress is the scroll offset over the scrollable
 * distance. The frontispiece is one screen; every other chapter is `weight`
 * screens.
 */
function anchors() {
  const heights = CHAPTERS.map((c, i) => (i === 0 ? 1 : c.weight));
  const total = heights.reduce((a, b) => a + b, 0);
  const maxScroll = total - 1;               // less the one screen in view
  const offsets = [];
  heights.reduce((acc, h) => (offsets.push(acc), acc + h), 0);
  const ranges = CHAPTERS.map((_, i) => ({
    id: CHAPTERS[i].id,
    start: Math.min(1, offsets[i] / maxScroll),
    end: i === CHAPTERS.length - 1 ? 1 : Math.min(1, offsets[i + 1] / maxScroll)
  }));
  const at = KEYFRAMES.map((frame) => {
    const band = ranges[Math.max(0, CHAPTERS.findIndex((c) => c.id === frame.chapter))];
    return band.start + (band.end - band.start) * frame.local;
  });
  for (let i = 1; i < at.length; i += 1) {
    if (at[i] <= at[i - 1]) at[i] = at[i - 1] + 1e-4;
  }
  return { ranges, at };
}

const { ranges, at } = anchors();

/** How many screens of scrolling the whole document is. */
const SCREENS = CHAPTERS.reduce((sum, c, i) => sum + (i === 0 ? 1 : c.weight), 0) - 1;

/** World.js resolveWorld(): any authored channel at a narrative position. */
function channelAt(name, t) {
  const last = at.length - 1;
  if (t <= at[0]) return KEYFRAMES[0].world[name] ?? 0;
  if (t >= at[last]) return KEYFRAMES[last].world[name] ?? 0;
  let i = 0;
  while (i < last - 1 && t > at[i + 1]) i += 1;
  const span = at[i + 1] - at[i];
  const u = span > 1e-6 ? (t - at[i]) / span : 0;
  return lerp(KEYFRAMES[i].world[name] ?? 0, KEYFRAMES[i + 1].world[name] ?? 0, smoothstep(u));
}

const inkAt = (t) => channelAt("ink", t);

/**
 * The steepest the room's dimming ever gets, per screen of scrolling.
 *
 * The dimming is what carries the descent into the archive, and the whole
 * point of moving it out of the chapter stages was that a reader should never
 * be able to find an edge in it. An edge in time is as visible as an edge in
 * space, so this measures the rate rather than the value: how much of the
 * scrim arrives in the space of one viewport of scroll.
 */
function dimmingRamp(screens) {
  const perScreen = 1 / screens;
  const steps = 4000;
  let steepest = 0;
  let at_ = 0;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const rate = Math.abs(channelAt("scrim", Math.min(1, t + perScreen)) - channelAt("scrim", t));
    if (rate > steepest) { steepest = rate; at_ = t; }
  }
  return { steepest, at: at_ };
}

/** interface.js setSurface(): a deadband, so a scrub cannot chatter the page. */
function surfaces(steps = 20000) {
  let surface = "light";
  const flips = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const ink = inkAt(t);
    const next = ink > 0.5 ? "dark" : ink < 0.4 ? "light" : surface;
    if (next !== surface) {
      surface = next;
      flips.push({ t, ink, to: next });
    }
  }
  return flips;
}

/**
 * When each chapter's copy is lit, as a fraction of that chapter.
 *
 * Taken from the scrubbed timelines in animation/conductor.js: the position a
 * chapter's first block starts arriving, and the position its last block has
 * finished leaving. A turn inside one of these windows happens under copy the
 * reader is in the middle of.
 */
const COPY = {
  frontispiece: [0, 1],            // the hero writes its own exit across the chapter
  stacks: [0.3, 1],
  "selected-works": [0.05, 0.99],
  "reading-room": [0.04, 0.98],
  binding: [0.04, 0.98],
  studio: [0.04, 0.98],
  commission: [0.04, 1]
};

const place = (t) => {
  const band = ranges.filter((r) => t >= r.start - 1e-9).pop() ?? ranges[0];
  return { chapter: band.id, local: (t - band.start) / (band.end - band.start) };
};

/** Every surface turn in the document, against the copy lit at that point. */
export function auditSurface() {
  return surfaces().map((flip) => {
    const { chapter, local } = place(flip.t);
    const [from, to] = COPY[chapter] ?? [0, 1];
    return { ...flip, chapter, local, underCopy: local >= from && local <= to };
  });
}

/** The steepest the dimming ever ramps, per screen of scrolling. */
export function auditDimming() {
  const { steepest, at: where } = dimmingRamp(SCREENS);
  return { steepest, at: where, ...place(where), screens: SCREENS };
}

/* Run directly for the readable report; imported by the static gate. */
if (process.argv[1]?.endsWith("surface-audit.mjs")) {
  const report = auditSurface();
  console.log("Surface turns across the document\n");
  if (!report.length) console.log("  none: the page never turns over.");
  report.forEach((r) => {
    console.log(
      `  t=${r.t.toFixed(4)}  ->${r.to.padEnd(5)}  ${r.chapter} @ ${r.local.toFixed(3)}` +
      `  ink=${r.ink.toFixed(3)}` +
      (r.underCopy ? "   <-- turns under copy that is lit" : "   (clear of the copy)")
    );
  });
  const under = report.filter((r) => r.underCopy);
  console.log(`\n${report.length} turn(s), ${under.length} of them under lit copy.`);

  const dim = auditDimming();
  console.log(`\nDimming ramp over ${dim.screens.toFixed(1)} screens of scroll`);
  console.log(`  steepest: ${(dim.steepest * 100).toFixed(1)}% of the scrim per screen,` +
    ` at ${dim.chapter} @ ${dim.local.toFixed(3)}`);
  const tooSteep = dim.steepest > 0.34;
  console.log(tooSteep
    ? "  <-- steep enough to read as the room stepping rather than descending"
    : "  (a descent, not a step)");

  process.exitCode = under.length || tooSteep ? 1 : 0;
}
