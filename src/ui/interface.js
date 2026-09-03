import { gsap } from "../animation/conductor.js";
import { CHAPTERS } from "../data/chapters.js";
import { coverDataURL } from "../three/textures.js";

/**
 * Everything the reader touches that is not made of triangles.
 *
 * The DOM carries the meaning; the world carries the place. The index rail is a
 * real, visible row of buttons rather than a hidden accessibility shim, so the
 * keyboard route through the collection is the same route everyone else uses.
 */

const pad = (value) => String(value).padStart(2, "0");

export function createInterface({ projects, reduceMotion }) {
  const el = {
    chapterNumber: document.querySelector("[data-chapter-number]"),
    chapterLabel: document.querySelector("[data-chapter-label]"),
    progressFill: document.querySelector("[data-progress-fill]"),
    metaCount: document.querySelector("[data-meta-count]"),
    metaTitle: document.querySelector("[data-meta-title]"),
    metaIndustry: document.querySelector("[data-meta-industry]"),
    metaYear: document.querySelector("[data-meta-year]"),
    meta: document.querySelector("[data-meta]"),
    openFocused: document.querySelector("[data-open-focused]"),
    rail: document.querySelector("[data-rail]"),
    panel: document.querySelector("[data-panel]"),
    cursor: document.querySelector("[data-cursor]"),
    cursorLabel: document.querySelector("[data-cursor-label]"),
    announce: document.querySelector("[data-announce]"),
    edition: document.querySelector("[data-edition]"),
    editionGrid: document.querySelector("[data-edition-grid]"),
    editionNote: document.querySelector("[data-edition-note]"),
    menuToggle: document.querySelector(".masthead__toggle"),
    menuLabel: document.querySelector("[data-menu-label]"),
    diagnostics: document.querySelector("[data-diagnostics]"),
    diagnosticsOut: document.querySelector("[data-diagnostics-output]"),
    commissionCta: document.querySelector("[data-commission-cta]"),
    grain: document.querySelector(".grain"),
    scrim: document.querySelector(".scrim"),
    backdrop: document.querySelector("[data-backdrop]")
  };

  const total = pad(projects.length);
  document.querySelectorAll(".works__count").forEach((node) => {
    node.innerHTML = `<span data-meta-count>01</span> / ${total}`;
  });
  el.metaCount = document.querySelector("[data-meta-count]");
  el.panel.querySelector(".volume__number").innerHTML =
    `<span data-panel-volume>Volume 01</span> / ${total}`;

  let currentIndex = -1;
  let surface = "light";
  let grainValue = -1;
  let scrimValue = -1;

  /* ---- index rail ------------------------------------------------------ */

  const railButtons = projects.map((project, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rail__item";
    button.dataset.index = String(index);
    button.setAttribute("aria-label", `Open volume ${project.volume}, ${project.title}`);
    button.innerHTML =
      `<span class="rail__index">${project.volume}</span><span>${project.title}</span>`;
    el.rail.append(button);
    return button;
  });

  function setFocus(index) {
    if (index === currentIndex) return;
    const previous = currentIndex;
    currentIndex = index;

    railButtons.forEach((button, i) => {
      if (i === index) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });

    if (index < 0) return;
    const project = projects[index];
    const apply = () => {
      el.metaCount.textContent = project.volume;
      el.metaTitle.textContent = project.title;
      el.metaIndustry.textContent = project.industry;
      el.metaYear.textContent = project.year;
      el.openFocused.setAttribute("aria-label", `Open volume ${project.volume}, ${project.title}`);
    };

    if (reduceMotion || previous < 0) {
      apply();
      return;
    }

    // Metadata is replaced the way a catalogue card is swapped: the lines lift
    // out, the card changes, the lines settle back.
    //
    // The travel is measured in pixels and kept well inside each line's own
    // box. These four lines sit in normal flow with nothing masking them, so a
    // line thrown a whole line-height clear would be read across the line
    // above it for the length of the stagger.
    const targets = [el.metaCount, el.metaTitle, el.metaIndustry, el.metaYear];
    gsap.timeline()
      .to(targets, { y: -9, opacity: 0, duration: 0.2, ease: "power2.in", stagger: 0.02 })
      .add(apply)
      .set(targets, { y: 11 })
      .to(targets, { y: 0, opacity: 1, duration: 0.42, ease: "power3.out", stagger: 0.035 });
  }

  /* ---- chapter ledger --------------------------------------------------- */

  function setChapter(index, chapter) {
    el.chapterNumber.textContent = chapter.number;
    el.chapterLabel.textContent = chapter.label;
    document.documentElement.dataset.chapter = chapter.id;
    document.querySelectorAll('.nav a[href^="#"]').forEach((link) => {
      if (link.getAttribute("href") === `#${chapter.id}`) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function setProgress(value) {
    el.progressFill.parentElement.style.setProperty("--progress", value.toFixed(4));
  }

  /**
   * The interface follows the light in the room, not a hard-coded chapter list.
   * When the world is bright the type is ink; when it is dark the type is cream.
   * This is why the masthead is never cream on cream.
   */
  /**
   * Turns the page over.
   *
   * The ledger authors when a chapter is read in dark type on a pale ground
   * and when it is read in pale type on a dark one, because a room can still
   * be lit long after its distance haze has gone dark and the page has to turn
   * when the copy stops being readable, not when the fog says so.
   *
   * The two thresholds are a deadband. Scrubbed scroll crosses a single
   * threshold repeatedly on the smallest gesture, and every crossing would
   * restate the ink, the plate under it, the hairlines and the browser chrome.
   */
  function setSurface(ink) {
    const next = ink > 0.5 ? "dark" : ink < 0.4 ? "light" : surface;
    if (next !== surface) {
      surface = next;
      document.documentElement.dataset.surface = next;
      document.querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", next === "light" ? "#f0ece3" : "#18110e");
    }
  }

  /** Only ever called with a value the world says has actually changed. */
  function setBackdrop(colour) {
    if (colour) el.backdrop.style.backgroundColor = colour;
  }

  /**
   * How far the room is dimmed under the copy.
   *
   * One layer over the whole viewport, carrying an authored channel that is
   * interpolated every frame, so the room descends into shadow continuously
   * rather than a chapter switching a plate on underneath itself. Rounded for
   * the same reason the grain is: a hundred steps is past what an eye can
   * separate, and it keeps this off the style recalculation on most frames.
   */
  function setScrim(value) {
    const rounded = Math.round(value * 100) / 100;
    if (rounded === scrimValue) return;
    scrimValue = rounded;
    el.scrim.style.setProperty("--scrim-strength", String(rounded));
  }

  function setGrain(value) {
    const rounded = Math.round(value * 100) / 100;
    if (rounded === grainValue) return;
    grainValue = rounded;
    el.grain.style.setProperty("--grain", String(rounded));
  }

  /* ---- inspection panel ------------------------------------------------- */

  function fillPanel(project) {
    const q = (selector) => el.panel.querySelector(selector);
    q("[data-panel-volume]").textContent = `Volume ${project.volume}`;
    q("[data-panel-title]").textContent = project.title;
    q("[data-panel-premise]").textContent = project.premise;
    q("[data-panel-client]").textContent = project.client;
    q("[data-panel-year]").textContent = project.year;
    q("[data-panel-industry]").textContent = project.industry;
    q("[data-panel-description]").textContent = project.description;
    q("[data-panel-services]").textContent = project.services.join(" / ");
    q("[data-panel-technology]").textContent = project.technology.join(" / ");
    const link = q("[data-panel-url]");
    link.href = project.url;
    link.setAttribute("aria-label", `Visit the ${project.title} site, opens the live project`);
    el.announce.textContent =
      `${project.title} opened. Volume ${project.volume} of ${total}. Press Escape to return to the library.`;
  }

  function announceClose(project) {
    el.announce.textContent = `${project.title} closed. Back at the shelf.`;
  }

  /* ---- cursor ----------------------------------------------------------- */

  let setCursorX = null;
  let setCursorY = null;

  function initCursor() {
    if (reduceMotion || !window.matchMedia("(pointer: fine)").matches) return false;
    setCursorX = gsap.quickSetter(el.cursor, "x", "px");
    setCursorY = gsap.quickSetter(el.cursor, "y", "px");
    return true;
  }

  function moveCursor(x, y) {
    setCursorX?.(x);
    setCursorY?.(y);
    document.documentElement.classList.add("cursor-live");
  }

  function setCursorLabel(label) {
    if (!setCursorX) return;
    if (el.cursorLabel.textContent !== (label || "")) {
      el.cursorLabel.textContent = label || "";
    }
    document.documentElement.classList.toggle("cursor-active", Boolean(label));
  }

  function hideCursor() {
    document.documentElement.classList.remove("cursor-live", "cursor-active");
  }

  /* ---- menu ------------------------------------------------------------- */

  function initMenu(onNavigate) {
    el.menuToggle.addEventListener("click", () => {
      const open = !document.documentElement.classList.contains("menu-open");
      document.documentElement.classList.toggle("menu-open", open);
      el.menuToggle.setAttribute("aria-expanded", String(open));
      el.menuLabel.textContent = open ? "Close" : "Menu";
    });
    document.querySelectorAll('.nav a[href^="#"]').forEach((link) => {
      link.addEventListener("click", () => {
        document.documentElement.classList.remove("menu-open");
        el.menuToggle.setAttribute("aria-expanded", "false");
        el.menuLabel.textContent = "Menu";
        onNavigate?.();
      });
    });
  }

  /* ---- static edition ---------------------------------------------------- */

  function buildEdition(note) {
    if (el.editionGrid.childElementCount === 0) {
      const fragment = document.createDocumentFragment();
      projects.forEach((project) => {
        const item = document.createElement("article");
        item.className = "edition__item";
        const image = document.createElement("img");
        // The same artwork the 3D volume wears, drawn as a flat board.
        image.src = coverDataURL(project);
        image.alt = `Front board of Volume ${project.volume}, ${project.title}`;
        image.loading = "lazy";
        image.decoding = "async";
        const meta = document.createElement("p");
        meta.className = "edition__meta";
        meta.textContent = `Volume ${project.volume} / ${project.year}`;
        const title = document.createElement("h3");
        title.textContent = project.title;
        const premise = document.createElement("p");
        premise.textContent = project.premise;
        const link = document.createElement("a");
        link.href = project.url;
        link.textContent = "Visit live site";
        link.setAttribute("aria-label", `Visit the ${project.title} site`);
        item.append(image, meta, title, premise, link);
        fragment.append(item);
      });
      el.editionGrid.append(fragment);
    }
    if (note) el.editionNote.textContent = note;
    el.edition.hidden = false;
    document.documentElement.classList.add("no-webgl");
  }

  return {
    el,
    railButtons,
    setFocus,
    setChapter,
    setProgress,
    setSurface,
    setBackdrop,
    setScrim,
    setGrain,
    fillPanel,
    announceClose,
    initCursor,
    moveCursor,
    setCursorLabel,
    hideCursor,
    initMenu,
    buildEdition,
    get focusIndex() { return currentIndex; },
    chapters: CHAPTERS
  };
}
