import "./style.css";

import { PROJECTS, HERO_VOLUME, SHELF } from "./data/projects.js";
import { CHAPTERS } from "./data/chapters.js";
import { LibraryWorld, supportsWebGL, detectQuality } from "./three/World.js";
import { createConductor, gsap, ScrollTrigger } from "./animation/conductor.js";
import { createInspection } from "./animation/inspection.js";
import { createInterface } from "./ui/interface.js";
import { createLoader } from "./utils/preload.js";

/**
 * The Site Library.
 *
 * One renderer, one scroll conductor, one state machine. Scroll owns the
 * journey; pointer and keyboard own local response; neither is ever allowed to
 * drive the other's transforms.
 */

const params = new URLSearchParams(window.location.search);
const forceEdition = params.has("edition");
const diagnostics = params.has("diagnostics");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// The stylesheet reveals several blocks through scroll choreography that this
// module skips under reduced motion. Publishing the decision as a class means
// the two can never disagree and leave copy stranded at zero opacity.
document.documentElement.classList.toggle("reduced-motion", reduceMotion);

const canvas = document.querySelector("#world");
const loaderRoot = document.querySelector("[data-loader]");

if (!window.location.hash) {
  history.scrollRestoration = "manual";
  window.scrollTo(0, 0);
}

const ui = createInterface({ projects: PROJECTS, reduceMotion });

let world = null;
let conductor = null;
let inspection = null;
let smooth = 0;
let lastTime = -1;
let pointerEvent = null;
let raycastQueued = false;
let cursorEnabled = false;
let diagnosticsClock = 0;

/* ------------------------------------------------------------------ *
 * Interaction
 * ------------------------------------------------------------------ */

function openVolume(index, source) {
  const book = world?.projectBooks[index];
  if (!book || inspection?.current || inspection?.busy) return;
  ui.setFocus(index);
  inspection.open(book, source);
}

/**
 * Scrolls the shelf so a volume sits at the compositional centre.
 *
 * The traverse is a straight rail between two authored slots, so the point on
 * it that reads a volume is that volume's own place along the rail. Spacing
 * follows the thickness of the bindings and the lean of the row, neither of
 * which is regular, so stepping by index would stop between volumes.
 */
function bringVolumeIntoView(index) {
  if (!conductor || !world) return Promise.resolve();
  const anchors = conductor.state.anchors;
  const first = SHELF.projectSlots[0].x;
  const rail = SHELF.emptySlot.x - first;
  const along = Math.abs(rail) < 1e-6
    ? 0
    : (SHELF.projectSlots[index].x - first) / rail;
  const target = anchors[4] + (anchors[5] - anchors[4]) * along;
  const y = conductor.scrollForProgress(target);
  if (reduceMotion) {
    window.scrollTo(0, y);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    conductor.scrollTo(y, { duration: 0.85, onComplete: resolve });
    window.setTimeout(resolve, 950);
  });
}

function attachRail() {
  ui.railButtons.forEach((button, index) => {
    button.addEventListener("focus", () => {
      if (inspection?.current) return;
      bringVolumeIntoView(index);
    });
    button.addEventListener("click", async () => {
      if (world.focusIndex !== index) await bringVolumeIntoView(index);
      openVolume(index, button);
    });
  });

  ui.el.openFocused.addEventListener("click", () => {
    const index = world.focusIndex >= 0 ? world.focusIndex : 0;
    openVolume(index, ui.el.openFocused);
  });

  ui.el.panel.querySelector("[data-close-panel]")
    .addEventListener("click", () => inspection?.close());

  document.addEventListener("keydown", (event) => {
    if (inspection?.current || document.documentElement.classList.contains("menu-open")) return;
    if (world.focusIndex < 0) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      const next = world.focusIndex + (event.key === "ArrowRight" ? 1 : -1);
      if (next < 0 || next >= PROJECTS.length) return;
      event.preventDefault();
      bringVolumeIntoView(next);
    }
  });
}

function attachPointer() {
  cursorEnabled = ui.initCursor();

  document.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    world?.setPointer(event.clientX, event.clientY);
    if (cursorEnabled) ui.moveCursor(event.clientX, event.clientY);
    pointerEvent = event;
    raycastQueued = true;
  }, { passive: true });

  document.addEventListener("pointerleave", () => {
    ui.hideCursor();
    world?.clearPointer();
    world?.setHovered(null);
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest("a, button")) return;
    if (inspection?.current || inspection?.busy) return;
    const book = world?.raycast(event.clientX, event.clientY);
    if (!book) return;
    const index = book.userData.index;
    openVolume(index, ui.railButtons[index]);
  });

  // Tap-to-open on touch, with the rail as the reliable alternative.
  canvas.addEventListener("pointerup", (event) => {
    if (event.pointerType === "mouse" || inspection?.current) return;
    world?.setPointer(event.clientX, event.clientY);
    const book = world?.raycast(event.clientX, event.clientY);
    if (book) openVolume(book.userData.index, ui.railButtons[book.userData.index]);
  });
}

function processHover() {
  if (!raycastQueued || !pointerEvent || !world) return;
  raycastQueued = false;

  if (inspection?.current) {
    ui.setCursorLabel(pointerEvent.target.closest("a, button") ? "" : "Back");
    return;
  }
  if (pointerEvent.target.closest("a, button")) {
    world.setHovered(null);
    ui.setCursorLabel("Open");
    return;
  }
  const book = world.raycast(pointerEvent.clientX, pointerEvent.clientY);
  world.setHovered(book);
  ui.setCursorLabel(book ? "View" : "");
  if (book) {
    // The cursor picks up the volume's own foil, very slightly.
    ui.el.cursor.style.color = book.project.palette.foil;
  } else {
    ui.el.cursor.style.color = "";
  }
}

function attachCommissionHover() {
  const cta = ui.el.commissionCta;
  // The closed volume lifts its board by about six degrees. Nothing more.
  const proxy = { open: 0 };
  const set = (value) => {
    if (!world || reduceMotion) return;
    gsap.to(proxy, {
      open: value,
      duration: 0.7,
      ease: "power3.out",
      overwrite: true,
      onUpdate: () => world.heroBook.setCoverOpen(proxy.open)
    });
  };
  ["pointerenter", "focus"].forEach((type) => cta.addEventListener(type, () => set(0.34)));
  ["pointerleave", "blur"].forEach((type) => cta.addEventListener(type, () => set(0)));
}

/* ------------------------------------------------------------------ *
 * Frame
 * ------------------------------------------------------------------ */

function frame(time) {
  const now = time * 1000;
  const raw = lastTime < 0 ? 16.7 : now - lastTime;
  const dt = Math.min(raw / 1000, 1 / 30);
  lastTime = now;

  conductor.raf(now);

  const exact = conductor.state.exact;
  // Exact progress drives state; a damped copy drives the picture.
  smooth = reduceMotion
    ? exact
    : smooth + (exact - smooth) * (1 - Math.exp(-7.5 * dt));
  if (Math.abs(exact - smooth) < 0.00002) smooth = exact;
  conductor.state.smooth = smooth;

  processHover();

  const channels = world.update(smooth, dt);
  ui.setSurface(channels.ink);
  ui.setBackdrop(channels.backdrop);
  ui.setGrain(channels.grain);
  world.render(dt);
  world.samplePerformance(raw);

  if (diagnostics && now - diagnosticsClock > 400) {
    diagnosticsClock = now;
    ui.el.diagnosticsOut.textContent = JSON.stringify(
      { exact: Number(exact.toFixed(4)), smooth: Number(smooth.toFixed(4)), ...world.stats() },
      null, 1
    );
  }
}

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */

async function boot() {
  const loader = createLoader(loaderRoot, { reduceMotion });
  const { manager, loadFonts, step, dismiss } = loader;

  manager.itemStart("boot");
  await loadFonts();

  if (!supportsWebGL() || forceEdition) {
    ui.buildEdition(forceEdition
      ? "The static edition was requested. Every volume is set out below."
      : "This browser cannot open the 3D archive. Every volume is set out below.");
    manager.itemEnd("boot");
    await dismiss();
    return;
  }

  const quality = detectQuality();
  const endWorld = step("world");

  world = new LibraryWorld({
    canvas,
    projects: PROJECTS,
    heroVolume: HERO_VOLUME,
    quality,
    reduceMotion,
    onProjectFocus: (index) => ui.setFocus(index),
    onContextLost: () => ui.buildEdition("The 3D archive stopped. Every volume is set out below.")
  });
  endWorld();

  conductor = createConductor({
    reduceMotion,
    onProgress: (value) => ui.setProgress(value),
    onChapter: (index, chapter) => ui.setChapter(index, chapter)
  });

  inspection = createInspection({
    world,
    conductor,
    panel: ui.el.panel,
    reduceMotion,
    onOpen: (project) => ui.fillPanel(project),
    onClose: (project) => {
      ui.announceClose(project);
      ui.setCursorLabel("");
    }
  });

  ui.initMenu();
  attachRail();
  attachPointer();
  attachCommissionHover();
  if (diagnostics) {
    ui.el.diagnostics.hidden = false;
    window.__TSL__ = {
      world, conductor, ui, gsap, projects: PROJECTS, chapters: CHAPTERS,
      get inspection() { return inspection; },
      /** Composes and draws one exact narrative position, without the ticker. */
      step(t) {
        world.setAnchors(conductor.measure());
        smooth = t;
        conductor.state.exact = t;
        const channels = world.update(t, 1 / 60, true);
        ui.setSurface(channels.ink);
        ui.setBackdrop(channels.backdrop);
        ui.setGrain(channels.grain);
        world.render(1 / 60);
        return world.stats();
      },
      /** Moves the document to a narrative position, the way a reader would. */
      seek(t) {
        const y = conductor.scrollForProgress(t);
        conductor.lenis?.scrollTo(y, { immediate: true, force: true });
        window.scrollTo(0, y);
        ScrollTrigger.update();
        return this.step(conductor.state.exact);
      }
    };
  }

  // The first authored frame is composed before the bookplate lifts.
  world.setAnchors(conductor.measure());
  world.update(0, 1 / 60, true);
  world.render(1 / 60);

  // The collection streams in behind the loader, one volume per frame.
  const endCollection = step("collection");
  await world.loadCollection((project) => {
    const end = step(`volume-${project.volume}`);
    end();
  });
  endCollection();
  manager.itemEnd("boot");

  world.setAnchors(conductor.measure());
  ScrollTrigger.refresh();
  world.setAnchors(conductor.measure());
  world.update(conductor.state.exact, 1 / 60, true);
  world.render(1 / 60);

  gsap.ticker.lagSmoothing(0);
  gsap.ticker.add(frame);

  await dismiss();
  document.documentElement.classList.add("ready");

  if (!reduceMotion) {
    // The volume settles into its hero pose; the type resolves after it.
    gsap.timeline({ defaults: { ease: "power3.out" } })
      .fromTo(world.heroBook.scale,
        { x: 1.075, y: 1.075, z: 1.075 },
        { x: 1, y: 1, z: 1, duration: 1.4 }, 0)
      .fromTo(world.heroBook.visual.rotation,
        { y: 0.16, x: 0.05 },
        { y: 0, x: 0, duration: 1.4 }, 0)
      .fromTo([".line--upper", ".line--lower"],
        { yPercent: 46, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 1.15, stagger: 0.1 }, 0.12)
      .fromTo(".frontispiece__deck",
        { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.85 }, 0.5)
      .fromTo(".kicker", { opacity: 0 }, { opacity: 0.7, duration: 0.7 }, 0.82)
      .fromTo(".frontispiece__open", { opacity: 0 }, { opacity: 0.72, duration: 0.7 }, 0.96);
  }
}

/* ------------------------------------------------------------------ *
 * Lifecycle
 * ------------------------------------------------------------------ */

let resizeWidth = window.innerWidth;
let resizeHeight = window.innerHeight;

function handleResize() {
  const widthChanged = window.innerWidth !== resizeWidth;
  const heightChanged = window.innerHeight !== resizeHeight;
  if (!widthChanged && !heightChanged) return;
  // Touch browsers resize on address-bar reveal, which must not rebuild the
  // journey. A width change, or any change at all on a pointer device, does.
  if (!widthChanged && window.matchMedia("(pointer: coarse)").matches) return;
  resizeWidth = window.innerWidth;
  resizeHeight = window.innerHeight;
  world?.resize();
  if (conductor) {
    world?.setAnchors(conductor.measure());
    ScrollTrigger.refresh();
    world?.setAnchors(conductor.measure());
  }
}

window.addEventListener("resize", handleResize, { passive: true });

// The window resize event is not fired for every way a viewport can change,
// notably when the page is embedded and its container is resized. Observing the
// document element catches those too, so the composition never runs at the
// wrong breakpoint.
if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(handleResize).observe(document.documentElement);
}

window.matchMedia("(prefers-reduced-motion: reduce)")
  .addEventListener("change", () => window.location.reload());

window.addEventListener("pagehide", () => {
  inspection?.destroy();
  conductor?.destroy();
  world?.dispose();
});

boot().catch((error) => {
  console.error("The Site Library could not open", error);
  ui.buildEdition("The live archive could not open. Every volume is set out below.");
  loaderRoot.hidden = true;
});
