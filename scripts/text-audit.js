/**
 * Text legibility audit.
 *
 * A development harness, never imported by the application. Load it in the dev
 * server from the console or from an automation client:
 *
 *   const audit = await import("/scripts/text-audit.js");
 *   audit.sweep(window.__TSL__, { step: 0.3 });
 *
 * It answers two questions at every scroll position, for every glyph on the
 * page:
 *
 *   1. Does this line of type collide with another line of type?
 *      Measured on text-node ranges, not on element boxes, so a short heading
 *      inside a full-width block is compared as the glyphs it actually paints.
 *
 *   2. Can it be read off what is behind it?
 *      The background is recomposited the way the browser does it: the page
 *      backdrop, then the renderer's own pixels, then the chapter's scrim
 *      gradient. Contrast is then WCAG against the resolved text colour with
 *      every inherited opacity folded in.
 */

// The inspection panel is not excluded here. It is hidden for the whole of a
// normal sweep and [hidden] already covers that, so naming it would only ever
// take it out of the audit at the one moment it is on screen and being read.
const IGNORED = ".sr-only, [hidden], [data-loader], .edition, .cursor";

/* ------------------------------------------------------------------ *
 * Colour
 * ------------------------------------------------------------------ */

function parseColour(value) {
  const match = String(value).match(/rgba?\(([^)]+)\)/);
  if (!match) return { r: 0, g: 0, b: 0, a: 1 };
  const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
}

function over(source, backdrop) {
  const a = source.a;
  return {
    r: source.r * a + backdrop.r * (1 - a),
    g: source.g * a + backdrop.g * (1 - a),
    b: source.b * a + backdrop.b * (1 - a),
    a: 1
  };
}

function relativeLuminance({ r, g, b }) {
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* ------------------------------------------------------------------ *
 * Background
 * ------------------------------------------------------------------ */

/**
 * Parses the axis-aligned scrim gradients the chapters use. Only the forms the
 * stylesheet actually writes are supported; anything else is flagged rather
 * than guessed at, so a new gradient cannot be silently treated as no scrim
 * and turn a passing audit into a fiction.
 */
const AXIS_ANGLES = { 0: "up", 90: "right", 180: "down", 270: "left" };

/**
 * Splits a computed `background-image` into its layers.
 *
 * The commas inside a gradient's own argument list look exactly like the ones
 * separating layers, so this counts brackets rather than splitting on text.
 */
function splitLayers(image) {
  if (!image || image === "none") return [];
  const layers = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < image.length; i += 1) {
    const c = image[i];
    if (c === "(") depth += 1;
    else if (c === ")") depth -= 1;
    else if (c === "," && depth === 0) {
      layers.push(image.slice(start, i).trim());
      start = i + 1;
    }
  }
  layers.push(image.slice(start).trim());
  return layers.filter(Boolean);
}

function parseStops(image) {
  return [...image.matchAll(/rgba?\(([^)]+)\)\s+(-?\d+(?:\.\d+)?)%/g)].map((match) => ({
    colour: parseColour(`rgba(${match[1]})`),
    at: Number(match[2]) / 100
  }));
}

function parseScrimGradient(image) {
  if (!image || image === "none") return null;
  const stops = parseStops(image);
  if (!stops.length) return { unsupported: image };

  const radial = image.match(
    /radial-gradient\(\s*(-?[\d.]+)%\s+(-?[\d.]+)%\s+at\s+(-?[\d.]+)%\s+(-?[\d.]+)%/
  );
  if (radial) {
    const [, rx, ry, cx, cy] = radial.map(Number);
    return { kind: "radial", rx: rx / 100, ry: ry / 100, cx: cx / 100, cy: cy / 100, stops };
  }

  // A gradient with no angle runs to bottom, and browsers serialise 180deg by
  // dropping it, so the two cases arrive here looking identical.
  const written = image.match(/linear-gradient\(\s*(-?\d+(?:\.\d+)?)deg/);
  const angle = written ? Number(written[1]) : 180;
  if (!(angle in AXIS_ANGLES)) return { unsupported: image };
  return { kind: "linear", angle, stops };
}

function sampleGradient(gradient, xFraction, yFraction) {
  let t;
  if (gradient.kind === "radial") {
    // Distance from the centre in units of the ellipse's own radii, which is
    // the parameter a radial gradient's colour stops are measured along.
    const dx = (xFraction - gradient.cx) / gradient.rx;
    const dy = (yFraction - gradient.cy) / gradient.ry;
    t = Math.sqrt(dx * dx + dy * dy);
  } else {
    // CSS angles point at the end of the gradient: 90deg runs left to right,
    // 270deg right to left, 180deg top to bottom, 0deg bottom to top.
    const along = gradient.angle === 90 || gradient.angle === 270 ? xFraction : yFraction;
    t = gradient.angle === 90 || gradient.angle === 180 ? along : 1 - along;
  }
  const stops = gradient.stops;
  if (t <= stops[0].at) return stops[0].colour;
  for (let i = 1; i < stops.length; i += 1) {
    if (t <= stops[i].at) {
      const span = stops[i].at - stops[i - 1].at;
      const k = span > 1e-6 ? (t - stops[i - 1].at) / span : 0;
      const a = stops[i - 1].colour;
      const b = stops[i].colour;
      return {
        r: a.r + (b.r - a.r) * k,
        g: a.g + (b.g - a.g) * k,
        b: a.b + (b.b - a.b) * k,
        a: a.a + (b.a - a.a) * k
      };
    }
  }
  return stops[stops.length - 1].colour;
}

/**
 * Recomposites what sits behind the type: the page backdrop, then the
 * renderer, sampled at a quarter of device resolution because contrast only
 * needs the average under a glyph run.
 */
function buildBackground() {
  const scale = 0.25;
  const width = Math.max(1, Math.round(window.innerWidth * scale));
  const height = Math.max(1, Math.round(window.innerHeight * scale));
  const off = document.createElement("canvas");
  off.width = width;
  off.height = height;
  const ctx = off.getContext("2d", { willReadFrequently: true });

  const backdrop = document.querySelector("[data-backdrop]");
  ctx.fillStyle = backdrop ? getComputedStyle(backdrop).backgroundColor : "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const canvas = document.querySelector("#world");
  if (canvas && canvas.width) ctx.drawImage(canvas, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height).data;

  // Everything dimming the room right now, in paint order: the scrim over the
  // whole viewport, and the plate the chapter ledger carries into the corner
  // of the frame. Chapter stages no longer carry one of their own; a box
  // inside a sticky stage drew its edge across the picture at every handover.
  const PLATES = [[".scrim", null], [".ledger", "::before"]];
  const scrims = [];
  PLATES.forEach(([selector, pseudo]) => {
    document.querySelectorAll(selector).forEach((element) => {
      const style = getComputedStyle(element, pseudo);
      const opacity = Number.parseFloat(style.opacity) || 0;
      if (opacity <= 0.01) return;

      // A background can be several layers, and the first one listed paints on
      // top, so they are composited back to front.
      const layers = splitLayers(style.backgroundImage)
        .map(parseScrimGradient)
        .filter(Boolean)
        .reverse();
      if (!layers.length) return;
      const unsupported = layers.find((layer) => layer.unsupported);
      if (unsupported) {
        console.warn("[text-audit] unreadable plate, contrast under it is not measured:",
          unsupported.unsupported);
        return;
      }

      // A pseudo-element can be inset past its host, so the plate is measured
      // from the host's box grown by the inset the stylesheet gives it.
      const host = element.getBoundingClientRect();
      const grow = (value) => -(Number.parseFloat(value) || 0);
      const box = pseudo
        ? new DOMRect(
            host.left - grow(style.left),
            host.top - grow(style.top),
            host.width + grow(style.left) + grow(style.right),
            host.height + grow(style.top) + grow(style.bottom)
          )
        : host;
      if (box.bottom <= 0 || box.top >= window.innerHeight) return;
      scrims.push({ box, layers, opacity });
    });
  });

  return function sample(x, y) {
    const px = Math.min(width - 1, Math.max(0, Math.round(x * scale)));
    const py = Math.min(height - 1, Math.max(0, Math.round(y * scale)));
    const index = (py * width + px) * 4;
    let colour = { r: pixels[index], g: pixels[index + 1], b: pixels[index + 2], a: 1 };
    scrims.forEach(({ box, layers, opacity }) => {
      if (y < box.top || y > box.bottom || x < box.left || x > box.right) return;
      const fx = (x - box.left) / Math.max(1, box.width);
      const fy = (y - box.top) / Math.max(1, box.height);
      layers.forEach((gradient) => {
        const stop = sampleGradient(gradient, fx, fy);
        colour = over({ ...stop, a: stop.a * opacity }, colour);
      });
    });
    return colour;
  };
}

/* ------------------------------------------------------------------ *
 * Type
 * ------------------------------------------------------------------ */

function effectiveOpacity(element) {
  let opacity = 1;
  let node = element;
  while (node && node !== document.documentElement) {
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return 0;
    opacity *= Number.parseFloat(style.opacity);
    node = node.parentElement;
  }
  return opacity;
}

/**
 * A halo painted behind the glyphs themselves.
 *
 * Only shadows with no offset count: those are light carried by the type
 * rather than a shadow cast by it, and they paint underneath the strokes. The
 * alpha is taken at face value, which understates a blur wide enough to
 * accumulate over itself, so a run that passes with this model passes on the
 * page. A shadow with an offset is ignored: it lands beside the letter, not
 * behind it, and cannot be relied on to carry contrast.
 */
function parseHalo(textShadow) {
  if (!textShadow || textShadow === "none") return [];
  return [...textShadow.matchAll(/(rgba?\([^)]+\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px/g)]
    .filter((match) => Math.abs(Number(match[2])) < 0.5 && Math.abs(Number(match[3])) < 0.5)
    .map((match) => parseColour(match[1]))
    .reverse();
}

/**
 * Opaque and translucent fills between the room and a run of type.
 *
 * The walk stops at the body. The page's own ground is painted by the fixed
 * backdrop layer underneath the renderer, so treating the body's background as
 * something the type sits on would put the room behind the wrong surface and
 * read every dark chapter as if it were parchment.
 */
function ancestorPlates(element) {
  const plates = [];
  let node = element;
  while (node && node !== document.body) {
    const colour = parseColour(getComputedStyle(node).backgroundColor);
    if (colour.a > 0.004) plates.unshift(colour);
    node = node.parentElement;
  }
  return plates;
}

function describe(element) {
  const id = element.id ? `#${element.id}` : "";
  const cls = element.classList.length ? `.${[...element.classList].join(".")}` : "";
  return `${element.tagName.toLowerCase()}${id}${cls}`;
}

/**
 * Every run of painted glyphs currently on screen, as the boxes it occupies.
 * Text-node ranges rather than element boxes: a two-word heading inside a
 * full-width block should be compared as two words, or every audit is a false
 * positive against the empty half of the block it lives in.
 */
export function collectRuns({ minOpacity = 0.045 } = {}) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const runs = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent || parent.closest(IGNORED)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const cache = new Map();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!cache.has(parent)) cache.set(parent, effectiveOpacity(parent));
    const opacity = cache.get(parent);
    if (opacity < minOpacity) continue;

    const style = getComputedStyle(parent);
    const size = Number.parseFloat(style.fontSize);
    const weight = Number.parseFloat(style.fontWeight) || 400;
    // A text-node rect is the font's whole em box, ascent to descent. Display
    // type is set here at leading well under one, so those boxes reach far past
    // the line they belong to and overlap the line above and below even when
    // the printed letters are nowhere near each other. The line box is what the
    // type is actually occupying, so each rect is taken back to it.
    const leading = Number.parseFloat(style.lineHeight) || size * 1.2;

    const range = document.createRange();
    range.selectNodeContents(node);
    const boxes = [...range.getClientRects()]
      .map((box) => {
        if (box.height <= leading + 0.5) return box;
        const inset = (box.height - leading) / 2;
        return new DOMRect(box.left, box.top + inset, box.width, leading);
      })
      .filter((box) =>
        box.width > 1 && box.height > 1 &&
        box.bottom > 0 && box.top < vh && box.right > 0 && box.left < vw
      );
    if (!boxes.length) continue;
    runs.push({
      element: parent,
      selector: describe(parent),
      chapter: parent.closest(".chapter")?.id || "chrome",
      text: node.nodeValue.trim().slice(0, 46),
      boxes,
      opacity,
      // Anything the type is sitting on that is not the room: the masthead's
      // veil, a button's fill. Without these the audit reads a wordmark as if
      // it were floating on the scene it is actually screened from.
      plates: ancestorPlates(parent),
      halo: parseHalo(style.textShadow),
      colour: parseColour(style.color),
      size,
      weight,
      // WCAG large text: 24px, or 18.66px at 700 and up.
      large: size >= 24 || (size >= 18.66 && weight >= 700)
    });
  }
  return runs;
}

const intersects = (a, b, pad) => (
  a.left < b.right - pad && b.left < a.right - pad &&
  a.top < b.bottom - pad && b.top < a.bottom - pad
);

const related = (a, b) => a.contains(b) || b.contains(a);

/** Collisions between two runs of type that are both legible enough to read. */
export function findOverlaps(runs, { pad = 1.5, minOpacity = 0.12 } = {}) {
  const found = [];
  const live = runs.filter((run) => run.opacity >= minOpacity);
  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const a = live[i];
      const b = live[j];
      if (related(a.element, b.element)) continue;
      let worst = null;
      a.boxes.forEach((boxA) => {
        b.boxes.forEach((boxB) => {
          if (!intersects(boxA, boxB, pad)) return;
          const area =
            (Math.min(boxA.right, boxB.right) - Math.max(boxA.left, boxB.left)) *
            (Math.min(boxA.bottom, boxB.bottom) - Math.max(boxA.top, boxB.top));
          if (!worst || area > worst) worst = area;
        });
      });
      if (worst && worst > 6) {
        found.push({
          a: a.selector, aText: a.text, aChapter: a.chapter, aOpacity: +a.opacity.toFixed(2),
          b: b.selector, bText: b.text, bChapter: b.chapter, bOpacity: +b.opacity.toFixed(2),
          area: Math.round(worst)
        });
      }
    }
  }
  return found;
}

export { buildBackground };

/**
 * Freezes CSS transitions and animations.
 *
 * The chrome crossfades its ink over most of a second when the room changes
 * from parchment to walnut. An audit that jumps between scroll positions reads
 * those transitions at their starting value and reports the colour the page is
 * leaving rather than the colour it is going to. Freezing them measures the
 * state the reader actually settles on.
 */
export function freezeTransitions() {
  if (document.getElementById("__audit-freeze")) return () => {};
  const style = document.createElement("style");
  style.id = "__audit-freeze";
  style.textContent =
    "*,*::before,*::after{transition:none!important;animation:none!important}";
  document.head.appendChild(style);
  return () => style.remove();
}

/**
 * Contrast of every run against what the page actually paints behind it.
 *
 * `minOpacity` is where copy stops being something the reader is asked to
 * read. Type that is mid-fade, or held down deliberately — an unlit step of
 * the process list, the index rail behind the volume it indexes — is not the
 * line being read and would fail on the way in and the way out of every
 * transition on the page. It is reported separately rather than counted.
 */
export function findContrastFailures(runs, { minOpacity = 0.6, sample = null } = {}) {
  sample = sample || buildBackground();
  const failures = [];
  runs.forEach((run) => {
    if (run.opacity < minOpacity) return;
    const required = run.large ? 3 : 4.5;
    let worst = Infinity;
    let at = null;
    run.boxes.forEach((box) => {
      const y = Math.min(window.innerHeight - 1, Math.max(0, box.top + box.height / 2));
      const steps = Math.max(3, Math.min(9, Math.round(box.width / 40)));
      for (let s = 0; s <= steps; s += 1) {
        const x = box.left + (box.width * s) / steps;
        if (x < 0 || x > window.innerWidth) continue;
        let behind = sample(x, y);
        run.plates.forEach((plate) => { behind = over(plate, behind); });
        run.halo.forEach((layer) => { behind = over(layer, behind); });
        const ink = over({ ...run.colour, a: run.colour.a * run.opacity }, behind);
        const ratio = contrastRatio(ink, behind);
        if (ratio < worst) {
          worst = ratio;
          at = [Math.round(x), Math.round(y)];
        }
      }
    });
    if (worst < required) {
      failures.push({
        selector: run.selector, text: run.text, chapter: run.chapter,
        opacity: +run.opacity.toFixed(2), size: Math.round(run.size),
        ratio: +worst.toFixed(2), required, at
      });
    }
  });
  return failures;
}

/**
 * Copy that does not fit the chapter it belongs to.
 *
 * A stage is one viewport tall and its content is centred in it, so anything
 * too tall spills equally out of both ends and paints over the chapter before
 * and the chapter after. That is the structural fault behind most collisions,
 * and it is worth catching on its own: an overlap tells you two lines met,
 * this tells you why.
 */
export function findOverflow(runs, { slack = 2, minOpacity = 0.12 } = {}) {
  const spills = [];
  document.querySelectorAll(".chapter__stage").forEach((stage) => {
    const outer = stage.getBoundingClientRect();
    if (outer.bottom <= -window.innerHeight || outer.top >= window.innerHeight * 2) return;
    // The safe area, not the frame. A stage's padding is the room reserved for
    // the masthead above it and the chapter ledger below it, so copy that fits
    // the stage but sits in its padding is copy printed over the chrome.
    const style = getComputedStyle(stage);
    const box = new DOMRect(
      outer.left,
      outer.top + Number.parseFloat(style.paddingTop),
      outer.width,
      outer.height - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom)
    );
    // Measured on the type that is actually lit. A block still travelling out
    // at two per cent opacity is not copy printed over the chrome.
    let top = Infinity;
    let bottom = -Infinity;
    runs.forEach((run) => {
      if (run.opacity < minOpacity) return;
      if (!stage.contains(run.element)) return;
      // The frontispiece pins its copy to the viewport rather than to its
      // chapter, so those lines are not the stage's to hold.
      let node = run.element;
      let pinned = false;
      while (node && node !== stage) {
        if (getComputedStyle(node).position === "fixed") { pinned = true; break; }
        node = node.parentElement;
      }
      if (pinned) return;
      run.boxes.forEach((runBox) => {
        top = Math.min(top, runBox.top);
        bottom = Math.max(bottom, runBox.bottom);
      });
    });
    if (top === Infinity) return;
    const above = box.top - top;
    const below = bottom - box.bottom;
    if (above > slack || below > slack) {
      spills.push({
        chapter: stage.parentElement.id,
        above: Math.round(Math.max(0, above)),
        below: Math.round(Math.max(0, below)),
        content: Math.round(bottom - top),
        safe: Math.round(box.height)
      });
    }
  });
  return spills;
}

export function auditFrame(options = {}) {
  // The renderer's buffer is not preserved, so what is behind the type has to
  // be read before anything else forces a composite.
  const sample = options.sample || buildBackground();
  const runs = collectRuns(options);
  return {
    runs: runs.length,
    overflow: findOverflow(runs, options),
    overlaps: findOverlaps(runs, options),
    contrast: findContrastFailures(runs, { ...options, sample })
  };
}

/**
 * Walks the document the way a reader does and audits every frame.
 *
 * `step` is in viewport heights. Scrubbed timelines are smoothed, so the
 * global timeline is advanced after each seek to let them settle; without it
 * every measurement would be taken mid-catch-up and report the frame before.
 */
export function sweep(harness, { step = 0.35, settle = 1.4, from = 0, to = 1 } = {}) {
  const { conductor, gsap } = harness;
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const stride = Math.max(1, Math.round(window.innerHeight * step));
  // The page is normally driven by the ticker, which a background or automated
  // tab throttles to nothing. Advancing the root by hand is the supported way
  // to run the same timelines deterministically.
  let clock = gsap.globalTimeline.totalTime();
  const advance = (seconds) => {
    const frames = Math.round(seconds * 60);
    for (let i = 0; i < frames; i += 1) {
      clock += 1 / 60;
      gsap.updateRoot(clock);
    }
  };

  // Trigger positions are measured against a layout that is still settling
  // while the fonts load, so a sweep that starts the moment the page is ready
  // reads every chapter as being a little further down the document than it
  // is, and reports collisions between blocks that are nowhere near each
  // other. Re-measuring first is the difference between auditing the page and
  // auditing the load.
  conductor.refresh();
  harness.world.setAnchors(conductor.measure());

  // The opening title sequence is a plain timeline with no trigger, so a root
  // advanced by hand would play it at whatever scroll position the sweep had
  // reached and paint the frontispiece copy over a later chapter. Flushing it
  // at the top of the document is the same kind of correction.
  harness.seek(0);
  advance(4);
  const thaw = freezeTransitions();

  const report = { frames: [], overflow: 0, overlaps: 0, contrast: 0 };
  for (let y = Math.round(from * maxScroll); y <= Math.round(to * maxScroll); y += stride) {
    harness.seek(y / maxScroll);
    advance(settle);
    harness.step(conductor.state.exact);
    const frame = auditFrame({ sample: buildBackground() });
    if (frame.overflow.length || frame.overlaps.length || frame.contrast.length) {
      report.frames.push({
        y, progress: +(y / maxScroll).toFixed(4),
        chapter: document.documentElement.dataset.chapter,
        overflow: frame.overflow, overlaps: frame.overlaps, contrast: frame.contrast
      });
      report.overflow += frame.overflow.length;
      report.overlaps += frame.overlaps.length;
      report.contrast += frame.contrast.length;
    }
  }
  thaw();
  return report;
}

/* ------------------------------------------------------------------ *
 * Proof sheet
 * ------------------------------------------------------------------ */

/** Every word on screen, with the box the browser laid it out in. */
function collectWords(runs) {
  const words = [];
  runs.forEach((run) => {
    const style = getComputedStyle(run.element);
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    run.element.childNodes.forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE || !node.nodeValue.trim()) return;
      const text = node.nodeValue;
      const range = document.createRange();
      let index = 0;
      while (index < text.length) {
        while (index < text.length && /\s/.test(text[index])) index += 1;
        const start = index;
        while (index < text.length && !/\s/.test(text[index])) index += 1;
        if (index === start) break;
        range.setStart(node, start);
        range.setEnd(node, index);
        const box = range.getBoundingClientRect();
        if (box.width > 0.5) {
          words.push({ text: text.slice(start, index), box, font, run });
        }
      }
    });
  });
  return words;
}

/**
 * Redraws the current frame as a flat image.
 *
 * The renderer's own pixels, the plates laid over them, and every word painted
 * in the box the browser laid it out in, in the colour and at the opacity the
 * browser resolved. It is a reconstruction rather than a capture — letterforms
 * are drawn by the canvas rather than by the text engine — but it is built out
 * of the same measurements the audit runs on, so what it shows is what the
 * audit is claiming, and a person can look at it and disagree.
 */
export function renderComposite({ scale = 1 } = {}) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const out = document.createElement("canvas");
  out.width = Math.round(vw * scale);
  out.height = Math.round(vh * scale);
  const ctx = out.getContext("2d");

  // The room and every plate over it, straight from the contrast sampler, so
  // the sheet cannot show a plate the audit did not count.
  const sample = buildBackground();
  const step = 2;
  for (let y = 0; y < vh; y += step) {
    for (let x = 0; x < vw; x += step) {
      const colour = sample(x + step / 2, y + step / 2);
      ctx.fillStyle = `rgb(${colour.r | 0}, ${colour.g | 0}, ${colour.b | 0})`;
      ctx.fillRect(x * scale, y * scale, step * scale + 1, step * scale + 1);
    }
  }

  ctx.scale(scale, scale);
  ctx.textBaseline = "middle";
  collectWords(collectRuns({ minOpacity: 0.02 })).forEach(({ text, box, font, run }) => {
    ctx.save();
    ctx.globalAlpha = Math.min(1, run.opacity * (run.colour.a ?? 1));
    ctx.fillStyle = `rgb(${run.colour.r}, ${run.colour.g}, ${run.colour.b})`;
    ctx.font = font;
    if ("letterSpacing" in ctx) {
      ctx.letterSpacing = getComputedStyle(run.element).letterSpacing;
    }
    if (run.halo.length) {
      const halo = run.halo[run.halo.length - 1];
      ctx.shadowColor = `rgba(${halo.r}, ${halo.g}, ${halo.b}, ${halo.a})`;
      ctx.shadowBlur = 30;
    }
    ctx.fillText(text, box.left, box.top + box.height / 2);
    ctx.restore();
  });

  return out.toDataURL("image/png");
}

/** Sends a proof sheet to a local sink so it can be looked at off the page. */
export async function proof(name, options) {
  const url = renderComposite(options);
  await fetch(`http://127.0.0.1:5210/shot?name=${encodeURIComponent(name)}`, {
    method: "POST",
    body: url
  });
  return { name, bytes: url.length };
}
