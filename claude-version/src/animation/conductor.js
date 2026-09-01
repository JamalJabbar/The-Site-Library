import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { CHAPTERS, KEYFRAMES } from "../data/chapters.js";

gsap.registerPlugin(ScrollTrigger);
export { gsap, ScrollTrigger };

const EASE = "power3.out";

/**
 * Native document scroll is the only source of truth.
 *
 *   scroll  ->  Lenis  ->  ScrollTrigger  ->  exact progress  ->  world state
 *
 * `exact` is the reproducible story position and drives every discrete decision:
 * the chapter, the focused volume, the navigation state. `smooth` is a damped
 * copy used only for camera and grade, so the picture stays cinematic while the
 * state stays exact. Scrolling to the same pixel always produces the same frame,
 * forwards, backwards, after a jump or after a reload.
 */
export function createConductor({ reduceMotion, onProgress, onChapter }) {
  const cleanup = [];
  const state = {
    exact: 0,
    smooth: 0,
    direction: 1,
    chapter: 0,
    anchors: KEYFRAMES.map((_, index) => index / (KEYFRAMES.length - 1)),
    ranges: []
  };

  // Section heights come from the ledger, so scroll pacing is authored in one
  // place alongside the camera.
  CHAPTERS.forEach((chapter) => {
    const section = document.getElementById(chapter.id);
    if (section) section.style.setProperty("--weight", String(chapter.weight));
  });

  let lenis = null;
  if (!reduceMotion) {
    lenis = new Lenis({ lerp: 0.08, wheelMultiplier: 1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
  }

  function measure() {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const starts = CHAPTERS.map((chapter) => {
      const section = document.getElementById(chapter.id);
      return section ? Math.min(1, section.offsetTop / maxScroll) : 0;
    });
    state.ranges = CHAPTERS.map((_, index) => ({
      start: starts[index],
      end: index === CHAPTERS.length - 1 ? 1 : starts[index + 1]
    }));
    state.anchors = KEYFRAMES.map((frame) => {
      const index = CHAPTERS.findIndex((chapter) => chapter.id === frame.chapter);
      const band = state.ranges[Math.max(0, index)];
      return band.start + (band.end - band.start) * frame.local;
    });
    // Anchors must be strictly increasing for the segment search to be stable.
    for (let i = 1; i < state.anchors.length; i += 1) {
      if (state.anchors[i] <= state.anchors[i - 1]) {
        state.anchors[i] = state.anchors[i - 1] + 1e-4;
      }
    }
    return state.anchors;
  }

  function chapterAt(t) {
    for (let index = state.ranges.length - 1; index >= 0; index -= 1) {
      if (t >= state.ranges[index].start - 1e-6) return index;
    }
    return 0;
  }

  const progress = ScrollTrigger.create({
    id: "narrative",
    start: 0,
    end: "max",
    onUpdate: (self) => {
      state.exact = self.progress;
      state.direction = self.direction;
      document.documentElement.classList.toggle("is-scrolled", self.scroll() > 90);
      const next = chapterAt(self.progress);
      if (next !== state.chapter) {
        state.chapter = next;
        onChapter?.(next, CHAPTERS[next]);
      }
      onProgress?.(self.progress);
    }
  });
  cleanup.push(() => progress.kill());

  /* ------------------------------------------------------------------ *
   * DOM beats
   *
   * Copy is choreographed against the same scroll the camera uses, so a line
   * of type and the shot it belongs to always arrive together.
   * ------------------------------------------------------------------ */

  function scrubbed(trigger, options = {}) {
    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger,
        start: options.start || "top top",
        end: options.end || "bottom bottom",
        scrub: options.scrub ?? 0.85,
        invalidateOnRefresh: true
      }
    });
    cleanup.push(() => {
      timeline.scrollTrigger?.kill();
      timeline.kill();
    });
    return timeline;
  }

  function entrance(targets, trigger, options = {}) {
    const tween = gsap.from(targets, {
      opacity: 0,
      y: options.y ?? 26,
      duration: options.duration ?? 0.95,
      ease: EASE,
      stagger: options.stagger ?? 0.07,
      scrollTrigger: {
        trigger,
        start: options.start || "top 62%",
        once: true
      }
    });
    cleanup.push(() => {
      tween.scrollTrigger?.kill();
      tween.kill();
    });
    return tween;
  }

  function buildBeats() {
    if (reduceMotion) return;

    // 01 -> 02  The frontispiece releases its hold.
    scrubbed("#frontispiece", { start: "top top", end: "bottom top", scrub: 0.6 })
      .to(".kicker", { opacity: 0, y: -18, ease: "none" }, 0)
      .to(".frontispiece__deck", { opacity: 0, y: -14, ease: "none" }, 0.04)
      .to(".frontispiece__open", { opacity: 0, y: 12, ease: "none" }, 0)
      .to(".line--upper", { xPercent: -5, opacity: 0, ease: "none" }, 0.08)
      .to(".line--lower", { xPercent: 7, opacity: 0, ease: "none" }, 0.12);

    // 02  Two captions, each landing on its own beat of the camera move.
    scrubbed("#stacks")
      .fromTo(".caption--room", { opacity: 0, y: 22 }, { opacity: 1, y: 0, ease: "none" }, 0.42)
      .to(".caption--room", { opacity: 0, y: -20, ease: "none" }, 0.6)
      .fromTo(".caption--collection", { opacity: 0, y: 26 }, { opacity: 1, y: 0, ease: "none" }, 0.86);

    // 03  Metadata arrives with the shelf, and hands over to the reserved place.
    scrubbed("#selected-works")
      .fromTo(".works__meta", { opacity: 0, y: 22 }, { opacity: 1, y: 0, ease: "none" }, 0.04)
      .fromTo(".rail", { opacity: 0, y: 16 }, { opacity: 1, y: 0, ease: "none" }, 0.06)
      .to(".caption--collection", { opacity: 0, ease: "none" }, 0)
      .to(".works__meta", { opacity: 0, y: -18, ease: "none" }, 0.87)
      .fromTo(".works__reserved", { opacity: 0, y: 22 }, { opacity: 1, y: 0, ease: "none" }, 0.9)
      .to(".rail", { opacity: 0.35, ease: "none" }, 0.9);

    // 04, 06, 07  Reading beats: content enters once and then stays put.
    entrance([".reading__lede h2", ".reading__lede p"], "#reading-room", { start: "top 55%" });
    entrance(".catalogue li", "#reading-room", { start: "top 42%", stagger: 0.09 });
    entrance([".studio__lede h2", ".studio__lead", ".studio__quote", ".studio__facts > div"],
      "#studio", { start: "top 52%", stagger: 0.08 });
    entrance([".commission__body h2", ".commission__ask", ".commission__cta", ".commission__email"],
      "#commission", { start: "top 50%", stagger: 0.09 });
    entrance(".colophon", "#commission", { start: "top 18%", y: 16 });

    // 05  Each step lights as its layer separates from the binding.
    const binding = scrubbed("#binding");
    binding.fromTo(".binding__lede", { opacity: 0, y: 26 }, { opacity: 1, y: 0, ease: "none" }, 0.05);
    gsap.utils.toArray(".process__step").forEach((step, index, all) => {
      const at = 0.2 + (index / all.length) * 0.56;
      binding.to(step, { opacity: 1, ease: "none", duration: 0.09 }, at);
      binding.to(step, { opacity: 0.2, ease: "none", duration: 0.09 }, at + 0.13);
    });
    binding.to(".binding__lede", { opacity: 0, y: -18, ease: "none" }, 0.9);
  }

  function attachAnchors(scrollTo) {
    const handler = (event) => {
      const link = event.target.closest?.('a[href^="#"]');
      if (!link) return;
      const id = link.getAttribute("href");
      if (id === "#" || !document.querySelector(id)) return;
      event.preventDefault();
      scrollTo(document.querySelector(id));
    };
    document.addEventListener("click", handler);
    cleanup.push(() => document.removeEventListener("click", handler));
  }

  function scrollTo(target, options = {}) {
    if (lenis) {
      lenis.scrollTo(target, { duration: options.duration ?? 1.15, ...options });
    } else if (typeof target === "number") {
      window.scrollTo(0, target);
    } else {
      target.scrollIntoView({ behavior: "auto", block: "start" });
    }
  }

  /** Absolute scroll position for a narrative progress value in [0, 1]. */
  function scrollForProgress(t) {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    return Math.round(Math.min(1, Math.max(0, t)) * maxScroll);
  }

  attachAnchors(scrollTo);
  buildBeats();

  return {
    state,
    lenis,
    measure,
    scrollTo,
    scrollForProgress,
    raf: (time) => lenis?.raf(time),
    refresh: () => {
      measure();
      ScrollTrigger.refresh();
    },
    stop: () => lenis?.stop(),
    start: () => lenis?.start(),
    destroy: () => {
      cleanup.forEach((fn) => fn());
      lenis?.destroy();
    }
  };
}
