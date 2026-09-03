import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { CHAPTERS, KEYFRAMES, SELECTED_WORKS_EXIT } from "../data/chapters.js";

gsap.registerPlugin(ScrollTrigger);
export { gsap, ScrollTrigger };

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

  /**
   * States the position once. Every consumer of the journey is written from
   * here and from nowhere else, so a reader who arrives in the middle of the
   * document is described exactly as one who scrolled there.
   */
  function publish(t, direction, scrolled) {
    state.exact = t;
    state.direction = direction;
    document.documentElement.classList.toggle("is-scrolled", scrolled > 90);
    const next = chapterAt(t);
    if (next !== state.chapter) {
      state.chapter = next;
      onChapter?.(next, CHAPTERS[next]);
    }
    onProgress?.(t);
  }

  // The bands have to exist before the first position is published. A reload
  // halfway down the document restores the reader's place before this module
  // runs, so the trigger's opening update carries a real progress value, and
  // chapterAt would answer it out of an empty list.
  measure();

  const progress = ScrollTrigger.create({
    id: "narrative",
    start: 0,
    end: "max",
    onUpdate: (self) => publish(self.progress, self.direction, self.scroll())
  });
  cleanup.push(() => progress.kill());

  /**
   * Re-measures the document and restates the position.
   *
   * ScrollTrigger only calls onUpdate when progress changes, so a reader who
   * has not moved since the archive opened would never be described at all:
   * the ledger would read chapter one over whichever chapter they are on.
   * Forgetting the chapter first is what makes the restatement unconditional.
   */
  function sync() {
    const anchors = measure();
    state.chapter = -1;
    publish(progress.progress, state.direction, window.scrollY);
    return anchors;
  }

  /* ------------------------------------------------------------------ *
   * DOM beats
   *
   * Copy is choreographed against the same scroll the camera uses, so a line
   * of type and the shot it belongs to always arrive together.
   * ------------------------------------------------------------------ */

  /**
   * A chapter's copy, scrubbed against its own scroll.
   *
   * Every beat in these timelines is written as a fraction of the chapter: a
   * tween placed at 0.8 lands four fifths of the way through it, and one that
   * runs for 0.07 occupies seven hundredths of it. That only holds if the
   * timeline is exactly one unit long, so each is normalised once every beat
   * has been added. Without it the scale would be whatever the last tween
   * happened to end at, two blocks authored to hand over cleanly would still
   * be on screen together, and the copy would be unreadable for the length of
   * the overlap.
   */
  const scrubs = [];

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
    scrubs.push(timeline);
    cleanup.push(() => {
      timeline.scrollTrigger?.kill();
      timeline.kill();
    });
    return timeline;
  }


  function buildBeats() {
    if (reduceMotion) return;

    // 01 -> 02  The frontispiece releases its hold. The headline goes last,
    // and the two lines leave in the order they arrived.
    scrubbed("#frontispiece", { start: "top top", end: "bottom top", scrub: 0.6 })
      .to(".kicker", { opacity: 0, y: -18, duration: 0.32, ease: "none" }, 0)
      .to(".frontispiece__open", { opacity: 0, y: 12, duration: 0.3, ease: "none" }, 0)
      .to(".frontispiece__deck", { opacity: 0, y: -14, duration: 0.34, ease: "none" }, 0.06)
      .to(".line--upper", { xPercent: -5, opacity: 0, duration: 0.46, ease: "none" }, 0.1)
      .to(".line--lower", { xPercent: 7, opacity: 0, duration: 0.46, ease: "none" }, 0.18);

    // 02  Two captions on the same centre line, so the first has to be gone
    // before the second arrives. They share a grid cell: any overlap in time
    // is an overlap in space.
    scrubbed("#stacks")
      .fromTo(".caption--room", { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.1, ease: "none" }, 0.3)
      .to(".caption--room", { opacity: 0, y: -20, duration: 0.09, ease: "none" }, 0.52)
      .fromTo(".caption--collection", { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.1, ease: "none" }, 0.7)
      // Gone before the stage is: the last screen of a chapter is the one it
      // spends travelling out of frame, and copy still lit while that happens
      // is read up through the masthead over the chapter arriving behind it.
      .to(".caption--collection", { opacity: 0, y: -18, duration: 0.08, ease: "none" }, 0.92);

    // 03  Metadata arrives with the shelf and hands over to the reserved place.
    // The exit begins only after the lens has crossed the final volume's
    // derived focus boundary. Those two also share a cell, so the handover is
    // a relay and not a crossfade: the card is off the page before the note is
    // on it.
    const selectedWorksHandoff = (1 - SELECTED_WORKS_EXIT) / 2;
    scrubbed("#selected-works")
      .fromTo(".works__meta", { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.08, ease: "none" }, 0.05)
      .fromTo(".rail", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.08, ease: "none" }, 0.07)
      .to(".works__meta", { opacity: 0, y: -18, duration: selectedWorksHandoff, ease: "none" }, SELECTED_WORKS_EXIT)
      .to(".rail", { opacity: 0.35, duration: selectedWorksHandoff, ease: "none" }, SELECTED_WORKS_EXIT)
      .fromTo(".works__reserved", { opacity: 0, y: 22 },
        { opacity: 1, y: 0, duration: selectedWorksHandoff, ease: "none" },
        SELECTED_WORKS_EXIT + selectedWorksHandoff);

    /*
      04, 06, 07  The reading chapters.

      These are scrubbed against their own chapter rather than triggered as the
      chapter approaches, and that is a legibility decision rather than a
      stylistic one. A stage is sticky: it travels up the viewport before it
      pins and travels out again after. `top top` to `bottom bottom` is exactly
      the window in which it is pinned, so copy that arrives after 0 and leaves
      before 1 is only ever on screen while its chapter is holding the frame.
      Copy revealed on approach is read through the masthead on the way in and
      through the ledger on the way out, over whichever chapter is arriving
      behind it.

      Blocks move together and resolve one after another: the group carries the
      travel, the stagger is carried by opacity alone. Lines that each threw
      themselves a line-height clear would cross their neighbours on the way.
    */
    const reading = scrubbed("#reading-room");
    reading
      .fromTo(".reading__lede", { opacity: 0, y: 26 },
        { opacity: 1, y: 0, duration: 0.12, ease: "none" }, 0.04)
      .fromTo(".catalogue li", { opacity: 0 },
        { opacity: 1, duration: 0.1, stagger: 0.03, ease: "none" }, 0.1)
      .to([".reading__lede", ".catalogue"], { opacity: 0, y: -12, duration: 0.1, ease: "none" }, 0.88);

    const studio = scrubbed("#studio");
    studio
      .fromTo(".studio__lede", { opacity: 0, y: 26 },
        { opacity: 1, y: 0, duration: 0.12, ease: "none" }, 0.04)
      .fromTo([".studio__lead", ".studio__quote", ".studio__facts > div"], { opacity: 0 },
        { opacity: 1, duration: 0.1, stagger: 0.035, ease: "none" }, 0.1)
      .to([".studio__lede", ".studio__body"], { opacity: 0, y: -12, duration: 0.1, ease: "none" }, 0.88);

    // The last chapter keeps what it brings: the reader finishes here, and the
    // address has to still be on the page when they do.
    scrubbed("#commission")
      .fromTo(".commission__body", { opacity: 0, y: 26 },
        { opacity: 1, y: 0, duration: 0.12, ease: "none" }, 0.04)
      .fromTo([".commission__ask", ".commission__cta", ".commission__email"], { opacity: 0 },
        { opacity: 1, duration: 0.1, stagger: 0.04, ease: "none" }, 0.12)
      .fromTo(".colophon", { opacity: 0 },
        { opacity: 1, duration: 0.1, ease: "none" }, 0.34);

    // 05  Each step lights as its layer separates from the binding.
    const binding = scrubbed("#binding");
    binding.fromTo(".binding__lede", { opacity: 0, y: 26 },
      { opacity: 1, y: 0, duration: 0.09, ease: "none" }, 0.04);
    // The list is held down to a sixteenth in the stylesheet so an unlit step
    // still reads as a step. That is dim, not invisible, so it has to arrive
    // with the chapter rather than sit lit while the stage is still climbing
    // the frame over the chapter behind it.
    binding.fromTo(".process", { opacity: 0 },
      { opacity: 1, duration: 0.09, ease: "none" }, 0.06);
    gsap.utils.toArray(".process__step").forEach((step, index, all) => {
      const at = 0.2 + (index / all.length) * 0.56;
      binding.to(step, { opacity: 1, ease: "none", duration: 0.09 }, at);
      binding.to(step, { opacity: 0.2, ease: "none", duration: 0.09 }, at + 0.13);
    });
    // The lede and the list leave together, before the stage does.
    binding.to([".binding__lede", ".process"], { opacity: 0, y: -10, duration: 0.09, ease: "none" }, 0.89);

    /*
      A chapter leaves with its own copy.

      The last screen of a chapter is the one its stage spends travelling out
      of the frame, and the scrubbed timelines above all finish at the moment
      that begins. Anything still lit is then carried up through the masthead
      and read across the chapter arriving behind it. So each chapter dims as
      it goes, on the stage itself: one property, written by nothing else, so
      it can never fight the beats it is carrying.

      The frontispiece is not in the list because it already writes its own
      exit, and the commission is not because the document ends underneath it.
    */
    ["#stacks", "#selected-works", "#reading-room", "#binding", "#studio"].forEach((chapter) => {
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: chapter,
          start: "bottom bottom",
          // Quickly. The stage has a whole screen of travel ahead of it and
          // the fixed chrome is waiting at both ends of that journey, so the
          // copy is out of the way well before it reaches either.
          end: "bottom 76%",
          scrub: 0.5,
          invalidateOnRefresh: true
        }
      });
      timeline.to(`${chapter} .chapter__stage`, { opacity: 0, ease: "none" });
      cleanup.push(() => {
        timeline.scrollTrigger?.kill();
        timeline.kill();
      });
    });

    // Every beat above is a fraction of its own chapter; this is what makes
    // that true.
    scrubs.forEach((timeline) => timeline.totalDuration(1));
  }

  /**
   * Forgets the pose the choreographed copy is interpolating from.
   *
   * A beat records where a block was the first time it renders, and everything
   * it does afterwards is measured from there. Nothing calls this on the way
   * through the document, because on that route the recorded pose is the right
   * one. It exists for the moment the frontispiece entrance is abandoned: the
   * copy was primed for an entrance, a beat may already have read that priming
   * as the place the copy lives, and the copy has since been put back where the
   * stylesheet left it.
   */
  function invalidateBeats() {
    scrubs.forEach((timeline) => timeline.invalidate());
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
    sync,
    invalidateBeats,
    scrollTo,
    scrollForProgress,
    raf: (time) => lenis?.raf(time),
    refresh: () => {
      measure();
      ScrollTrigger.refresh();
      sync();
    },
    stop: () => lenis?.stop(),
    start: () => lenis?.start(),
    destroy: () => {
      cleanup.forEach((fn) => fn());
      lenis?.destroy();
    }
  };
}
