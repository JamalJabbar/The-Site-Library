import "@fontsource-variable/bodoni-moda/wght.css";
import "@fontsource-variable/bodoni-moda/wght-italic.css";
import "@fontsource-variable/manrope/wght.css";
import "./style.css";

import * as THREE from "three";
import Lenis from "lenis";
import { PROJECTS, HERO_VOLUME } from "./data/projects.js";
import { CHAPTERS } from "./data/chapters.js";
import { LibraryWorld, supportsWebGL } from "./three/world.js";
import { connectLoader } from "./utils/preload.js";
import { gsap, ScrollTrigger, setupScrollStory } from "./animation/scroll.js";
import { createInspectionController } from "./animation/inspection.js";

const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointerQuery = window.matchMedia("(pointer: fine)");
const searchParams = new URLSearchParams(window.location.search);
const forcedFallback = searchParams.has("fallback");
const diagnosticsEnabled = searchParams.has("diagnostics");
const debugEnabled = searchParams.has("debug") || diagnosticsEnabled;

if (!window.location.hash) {
  history.scrollRestoration = "manual";
  window.scrollTo(0, 0);
}

const state = {
  journey: 0,
  library: 0,
  reading: 0,
  binding: 0,
  studio: 0,
  commission: 0,
  commissionHover: 0,
  reduceMotion: reduceMotionQuery.matches,
  elapsed: 0
};

const elements = {
  canvas: document.querySelector("#world-canvas"),
  loader: document.querySelector("[data-loader]"),
  loaderPercentage: document.querySelector("[data-loader-percentage]"),
  loaderBar: document.querySelector("[data-loader-bar]"),
  loaderStatus: document.querySelector("[data-loader-status]"),
  chapterCurrent: document.querySelector("[data-chapter-current]"),
  chapterLabel: document.querySelector("[data-chapter-label]"),
  projectButtons: document.querySelector("[data-project-buttons]"),
  metaVolume: document.querySelector("[data-meta-volume]"),
  metaTitle: document.querySelector("[data-meta-title]"),
  metaCategory: document.querySelector("[data-meta-category]"),
  metaYear: document.querySelector("[data-meta-year]"),
  openFocusedProject: document.querySelector("[data-open-focused-project]"),
  panel: document.querySelector("[data-project-panel]"),
  closeProject: document.querySelector("[data-close-project]"),
  liveStatus: document.querySelector("[data-live-status]"),
  fallback: document.querySelector("[data-webgl-fallback]"),
  fallbackMessage: document.querySelector("[data-fallback-message]"),
  fallbackProjects: document.querySelector("[data-fallback-projects]"),
  cursor: document.querySelector("[data-cursor]"),
  cursorLabel: document.querySelector("[data-cursor] span"),
  menuToggle: document.querySelector(".menu-toggle"),
  debugPanel: document.querySelector("[data-debug-panel]"),
  debugOutput: document.querySelector("[data-debug-output]"),
  commissionCta: document.querySelector("[data-commission-cta]"),
  mobileInspectionCover: document.querySelector("[data-mobile-inspection-cover]")
};

let world = null;
let lenis = null;
let scrollStory = null;
let inspection = null;
let focusedIndex = 0;
let pointerEvent = null;
let raycastPending = false;
let lastDebugUpdate = 0;
let resizeWidth = window.innerWidth;

function buildAccessibleProjectControls() {
  const fragment = document.createDocumentFragment();
  PROJECTS.forEach((project, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "project-focus-button";
    button.dataset.projectFocus = String(index);
    button.setAttribute("aria-label", `View ${project.title} project`);
    const label = document.createElement("span");
    label.textContent = `${project.volume} / ${project.title}`;
    button.append(label);
    fragment.append(button);
  });
  elements.projectButtons.append(fragment);
}

function buildFallback() {
  const fragment = document.createDocumentFragment();
  PROJECTS.forEach((project) => {
    const article = document.createElement("article");
    article.className = "fallback-project";
    article.style.setProperty("--fallback-accent", project.palette.primary);
    const meta = document.createElement("span");
    meta.textContent = `Volume ${project.volume} / ${project.year}`;
    const title = document.createElement("h3");
    title.textContent = project.title;
    const description = document.createElement("p");
    description.textContent = project.premise;
    const link = document.createElement("a");
    link.href = project.url;
    link.textContent = "View project";
    link.setAttribute("aria-label", `View ${project.title} project`);
    article.append(meta, title, description, link);
    fragment.append(article);
  });
  elements.fallbackProjects.append(fragment);
}

function showFallback(message) {
  if (!message) {
    document.documentElement.classList.remove("webgl-failed");
    elements.fallback.hidden = true;
    return;
  }
  elements.fallbackMessage.textContent = message;
  elements.fallback.hidden = false;
  document.documentElement.classList.add("webgl-failed");
}

function updateChapter(index, chapter) {
  elements.chapterCurrent.textContent = chapter.number;
  elements.chapterLabel.textContent = chapter.label;
  document.querySelectorAll(".primary-navigation a[href^='#']").forEach((link) => {
    const matches = link.getAttribute("href") === `#${chapter.id}`;
    if (matches) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (index !== 2) document.documentElement.classList.remove("cursor-book");
}

function updateProjectMeta(index, immediate = false) {
  if (index < 0 || !PROJECTS[index] || index === focusedIndex && !immediate) return;
  focusedIndex = index;
  const project = PROJECTS[index];
  const targets = [elements.metaVolume, elements.metaTitle, elements.metaCategory, elements.metaYear];
  const apply = () => {
    elements.metaVolume.textContent = `${project.volume} / ${PROJECTS.length.toString().padStart(2, "0")}`;
    elements.metaTitle.textContent = project.title;
    elements.metaCategory.textContent = project.industry;
    elements.metaYear.textContent = project.year;
  };
  world?.setFocusedProject(index);
  if (immediate || state.reduceMotion) {
    apply();
    return;
  }
  gsap.timeline()
    .to(targets, { y: -12, opacity: 0, duration: 0.18, ease: "power2.in" })
    .add(apply)
    .set(targets, { y: 14 })
    .to(targets, { y: 0, opacity: 1, duration: 0.32, stagger: 0.025, ease: "power3.out" });
}

function populateInspection(project) {
  const index = PROJECTS.indexOf(project);
  elements.panel.querySelector("[data-panel-volume]").textContent = `Volume ${project.volume} / ${PROJECTS.length.toString().padStart(2, "0")}`;
  elements.panel.querySelector("[data-panel-title]").textContent = project.title;
  elements.panel.querySelector("[data-panel-client]").textContent = project.client;
  elements.panel.querySelector("[data-panel-year]").textContent = project.year;
  elements.panel.querySelector("[data-panel-industry]").textContent = project.industry;
  elements.panel.querySelector("[data-panel-premise]").textContent = project.premise;
  elements.panel.querySelector("[data-panel-description]").textContent = project.description;
  elements.panel.querySelector("[data-panel-services]").textContent = project.services.join(" / ");
  elements.panel.querySelector("[data-panel-technology]").textContent = project.technology.join(" / ");
  elements.panel.querySelector("[data-panel-outcome]").textContent = project.outcome;
  const url = elements.panel.querySelector("[data-panel-url]");
  url.href = project.url;
  url.setAttribute("aria-label", `Visit ${project.title} live site`);
  elements.liveStatus.textContent = `${project.title} project opened. Volume ${index + 1} of ${PROJECTS.length}.`;
}

function scrollToProject(index) {
  const next = THREE.MathUtils.clamp(index, 0, PROJECTS.length - 1);
  const trigger = ScrollTrigger.getById("library-traversal");
  if (!trigger || state.reduceMotion) {
    state.library = 0.12 + (next / (PROJECTS.length - 1)) * 0.8;
    updateProjectMeta(next, true);
    return;
  }
  const progress = 0.12 + (next / (PROJECTS.length - 1)) * 0.8;
  const target = trigger.start + (trigger.end - trigger.start) * progress;
  lenis?.scrollTo(target, { duration: 0.82, force: true });
}

function openProject(index, origin) {
  const book = world?.projectBooks[index];
  if (!book || inspection?.current) return;
  const source = book.artwork.front.image;
  const cover = elements.mobileInspectionCover;
  if (source && cover) {
    cover.width = source.width;
    cover.height = source.height;
    cover.getContext("2d")?.drawImage(source, 0, 0);
  }
  updateProjectMeta(index, true);
  inspection.open(book, origin);
}

function attachProjectEvents() {
  elements.projectButtons.querySelectorAll("[data-project-focus]").forEach((button) => {
    const index = Number(button.dataset.projectFocus);
    button.addEventListener("focus", () => scrollToProject(index));
    button.addEventListener("click", () => {
      if (focusedIndex !== index && !state.reduceMotion) {
        scrollToProject(index);
        gsap.delayedCall(0.72, () => openProject(index, button));
      } else {
        openProject(index, button);
      }
    });
  });

  elements.openFocusedProject.addEventListener("click", () => {
    openProject(focusedIndex, elements.openFocusedProject);
  });
  elements.closeProject.addEventListener("click", () => inspection?.close());

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && inspection?.current) {
      event.preventDefault();
      inspection.close();
      return;
    }
    if (!document.documentElement.classList.contains("library-is-active") || inspection?.current) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollToProject(focusedIndex + 1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollToProject(focusedIndex - 1);
    }
  });
}

function attachNavigation() {
  document.querySelectorAll("a[href^='#']").forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target || state.reduceMotion || !lenis) return;
      event.preventDefault();
      lenis.scrollTo(target, { duration: 1.15 });
      document.documentElement.classList.remove("menu-is-open");
      elements.menuToggle.setAttribute("aria-expanded", "false");
    });
  });

  elements.menuToggle.addEventListener("click", () => {
    const open = !document.documentElement.classList.contains("menu-is-open");
    document.documentElement.classList.toggle("menu-is-open", open);
    elements.menuToggle.setAttribute("aria-expanded", String(open));
    elements.menuToggle.textContent = open ? "Close" : "Menu";
  });
}

function attachPointerEvents() {
  if (!finePointerQuery.matches) return;
  const setCursorX = gsap.quickSetter(elements.cursor, "x", "px");
  const setCursorY = gsap.quickSetter(elements.cursor, "y", "px");
  document.addEventListener("pointermove", (event) => {
    world?.setPointer(event.clientX, event.clientY);
    setCursorX(event.clientX);
    setCursorY(event.clientY);
    document.documentElement.classList.add("cursor-visible");
    pointerEvent = event;
    raycastPending = true;
  }, { passive: true });

  document.addEventListener("pointerleave", () => {
    document.documentElement.classList.remove("cursor-visible", "cursor-book");
    world?.setHoveredBook(null);
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest("a, button") || inspection?.current) return;
    const book = world?.raycast(event.clientX, event.clientY);
    if (book) openProject(book.userData.index, elements.projectButtons.querySelector(`[data-project-focus="${book.userData.index}"]`));
  });
}

function processPointerRaycast() {
  if (!raycastPending || !pointerEvent || !world || inspection?.current) return;
  raycastPending = false;
  const overInterface = pointerEvent.target.closest("a, button, .project-meta, .site-header");
  const book = overInterface ? null : world.raycast(pointerEvent.clientX, pointerEvent.clientY);
  world.setHoveredBook(book);
  document.documentElement.classList.toggle("cursor-book", Boolean(book));
  elements.cursorLabel.textContent = book ? "View" : "";
}

function attachResponsiveLifecycle() {
  window.addEventListener("resize", () => {
    const widthChanged = window.innerWidth !== resizeWidth;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (coarse && !widthChanged) return;
    resizeWidth = window.innerWidth;
    world?.resize();
    scrollStory?.refresh();
  }, { passive: true });

  reduceMotionQuery.addEventListener("change", () => {
    window.location.reload();
  });
}

function attachCommissionInteraction() {
  const setHover = (value) => gsap.to(state, {
    commissionHover: value,
    duration: state.reduceMotion ? 0 : 0.55,
    ease: "power3.out",
    overwrite: true
  });
  elements.commissionCta.addEventListener("pointerenter", () => setHover(1));
  elements.commissionCta.addEventListener("pointerleave", () => setHover(0));
  elements.commissionCta.addEventListener("focus", () => setHover(1));
  elements.commissionCta.addEventListener("blur", () => setHover(0));
}

function setupDebug() {
  if (!debugEnabled) return;
  elements.debugPanel.hidden = !diagnosticsEnabled;
  window.__TSL_DEBUG__ = {
    state,
    getStats: () => world?.getStats(),
    getRestorationError: (index) => world?.getRestorationError(index),
    projects: PROJECTS,
    chapters: CHAPTERS,
    forceFallback: () => showFallback("The 3D archive was disabled for fallback verification."),
    restoreWorld: () => showFallback(null)
  };
}

async function init() {
  buildAccessibleProjectControls();
  buildFallback();
  attachNavigation();

  const manager = new THREE.LoadingManager();
  manager.itemStart("bootstrap");
  const loader = connectLoader(manager, {
    root: elements.loader,
    percentage: elements.loaderPercentage,
    bar: elements.loaderBar,
    status: elements.loaderStatus
  });
  const criticalLoads = loader.startCriticalLoads();

  if (!supportsWebGL() || forcedFallback) {
    await criticalLoads;
    manager.itemEnd("bootstrap");
    showFallback(forcedFallback
      ? "The static edition was requested. Every selected project remains available."
      : "WebGL is unavailable. Every selected project remains available in this static edition.");
    await loader.dismiss();
    return;
  }

  await document.fonts.ready;
  world = new LibraryWorld({
    canvas: elements.canvas,
    manager,
    projects: PROJECTS,
    heroVolume: HERO_VOLUME,
    onFallback: (message) => showFallback(message),
    onProjectFocus: (index) => updateProjectMeta(index)
  });
  manager.itemEnd("bootstrap");

  if (!state.reduceMotion) {
    lenis = new Lenis({
      lerp: 0.08,
      wheelMultiplier: 1,
      smoothWheel: true
    });
    lenis.on("scroll", ScrollTrigger.update);
  }

  gsap.ticker.lagSmoothing(0);
  gsap.ticker.add((time) => {
    lenis?.raf(time * 1000);
    processPointerRaycast();
    world?.render(state);
    if (diagnosticsEnabled && time - lastDebugUpdate > 0.5) {
      lastDebugUpdate = time;
      elements.debugOutput.textContent = JSON.stringify({
        state: {
          journey: Number(state.journey.toFixed(3)),
          library: Number(state.library.toFixed(3)),
          reading: Number(state.reading.toFixed(3)),
          binding: Number(state.binding.toFixed(3)),
          studio: Number(state.studio.toFixed(3)),
          commission: Number(state.commission.toFixed(3))
        },
        renderer: world.getStats()
      }, null, 2);
    }
  });

  inspection = createInspectionController({
    world,
    lenis,
    overlay: elements.panel,
    onOpen: (project) => {
      populateInspection(project);
      elements.cursorLabel.textContent = "Back";
    },
    onClose: (project) => {
      elements.liveStatus.textContent = `${project.title} closed. Returned to the selected works shelf.`;
      elements.cursorLabel.textContent = "";
    }
  });

  scrollStory = setupScrollStory({
    state,
    onChapterChange: updateChapter,
    onProjectFocusRequest: scrollToProject
  });
  attachProjectEvents();
  attachPointerEvents();
  attachResponsiveLifecycle();
  attachCommissionInteraction();
  setupDebug();
  updateProjectMeta(0, true);

  await criticalLoads;
  await loader.dismiss();
  document.documentElement.classList.add("experience-ready");

  if (!state.reduceMotion) {
    gsap.timeline()
      .fromTo(world.heroBook.scale, { x: 1.08, y: 1.08, z: 1.08 }, { x: 1, y: 1, z: 1, duration: 1.4, ease: "power3.out" })
      .fromTo(".hero-title__back, .hero-title__front", { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 1.15, stagger: 0.08, ease: "power3.out" }, 0.05)
      .fromTo(".hero-deck", { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.85, ease: "power3.out" }, 0.42)
      .fromTo(".hero-kicker, .open-library", { opacity: 0 }, { opacity: 1, duration: 0.7, stagger: 0.1, ease: "power2.out" }, 0.7);
  }

  scrollStory.refresh();
}

init().catch((error) => {
  console.error("The Site Library failed to initialize", error);
  showFallback("The live archive could not initialize. Every selected project remains available in this static edition.");
  elements.loader.hidden = true;
});

window.addEventListener("beforeunload", () => {
  inspection?.destroy();
  scrollStory?.destroy();
  lenis?.destroy();
  world?.destroy();
});
