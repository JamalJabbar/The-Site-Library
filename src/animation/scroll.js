import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import { CHAPTERS } from "../data/chapters.js";

gsap.registerPlugin(ScrollTrigger);

export function setupScrollStory({ state, onChapterChange, onProjectFocusRequest }) {
  const reduceMotion = state.reduceMotion;
  const cleanup = [];

  const setChapter = (index) => {
    const chapter = CHAPTERS[index];
    if (!chapter) return;
    document.documentElement.dataset.chapter = chapter.id;
    document.documentElement.dataset.scene = ["journey", "selected-works", "commission"].includes(chapter.id)
      ? "dark"
      : "light";
    onChapterChange?.(index, chapter);
  };

  CHAPTERS.forEach((chapter, index) => {
    const trigger = ScrollTrigger.create({
      id: `chapter:${chapter.id}`,
      trigger: `#${chapter.id}`,
      start: "top 52%",
      end: "bottom 48%",
      onEnter: () => setChapter(index),
      onEnterBack: () => setChapter(index)
    });
    cleanup.push(() => trigger.kill());
  });

  const pageProgress = ScrollTrigger.create({
    id: "page-progress",
    start: 0,
    end: "max",
    onUpdate: (self) => {
      document.documentElement.style.setProperty("--page-progress", self.progress.toFixed(4));
      document.documentElement.classList.toggle("nav-compact", self.scroll() > 120);
    }
  });
  cleanup.push(() => pageProgress.kill());

  if (reduceMotion) {
    const reducedStates = [
      ["#frontispiece", { journey: 0, library: 0, reading: 0, binding: 0, studio: 0, commission: 0 }],
      ["#journey", { journey: 1, library: 0, reading: 0, binding: 0, studio: 0, commission: 0 }],
      ["#selected-works", { journey: 1, library: 0.5, reading: 0, binding: 0, studio: 0, commission: 0 }],
      ["#reading-room", { journey: 1, library: 1, reading: 1, binding: 0, studio: 0, commission: 0 }],
      ["#binding", { journey: 1, library: 1, reading: 1, binding: 0.5, studio: 0, commission: 0 }],
      ["#studio", { journey: 1, library: 1, reading: 1, binding: 1, studio: 1, commission: 0 }],
      ["#commission", { journey: 1, library: 1, reading: 1, binding: 1, studio: 1, commission: 1 }]
    ];
    reducedStates.forEach(([selector, values]) => {
      const trigger = ScrollTrigger.create({
        trigger: selector,
        start: "top 55%",
        end: "bottom 45%",
        onEnter: () => Object.assign(state, values),
        onEnterBack: () => Object.assign(state, values)
      });
      cleanup.push(() => trigger.kill());
    });
    return {
      refresh: () => ScrollTrigger.refresh(),
      destroy: () => cleanup.forEach((fn) => fn())
    };
  }

  const journeyTimeline = gsap.timeline({
    scrollTrigger: {
      id: "hero-to-library",
      trigger: "#journey",
      start: "top top",
      end: "bottom bottom",
      pin: ".journey-stage",
      pinSpacing: false,
      scrub: 1.1,
      anticipatePin: 1,
      invalidateOnRefresh: true
    }
  });
  journeyTimeline
    .addLabel("departure", 0)
    .to(state, { journey: 1, duration: 1, ease: "none" }, 0)
    .to(".hero-kicker, .hero-deck, .open-library", { opacity: 0, yPercent: -8, duration: 0.18, ease: "none" }, 0.02)
    .to(".hero-title__back", { xPercent: -4, opacity: 0, duration: 0.3, ease: "none" }, 0.04)
    .to(".hero-title__front", { xPercent: 5, opacity: 0, duration: 0.32, ease: "none" }, 0.04)
    .addLabel("architecture", 0.18)
    .fromTo(".journey-note--architecture", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.08, ease: "none" }, 0.25)
    .to(".journey-note--architecture", { opacity: 0, y: -18, duration: 0.08, ease: "none" }, 0.48)
    .addLabel("shelf", 0.76)
    .fromTo(".journey-note--collection", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.12, ease: "none" }, 0.8);
  cleanup.push(() => journeyTimeline.scrollTrigger?.kill(), () => journeyTimeline.kill());

  const libraryTimeline = gsap.timeline({
    scrollTrigger: {
      id: "library-traversal",
      trigger: "#selected-works",
      start: "top top",
      end: "bottom bottom",
      pin: ".library-stage",
      pinSpacing: false,
      scrub: 1.1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onEnter: () => document.documentElement.classList.add("library-is-active"),
      onEnterBack: () => document.documentElement.classList.add("library-is-active"),
      onLeave: () => document.documentElement.classList.remove("library-is-active"),
      onLeaveBack: () => document.documentElement.classList.remove("library-is-active")
    }
  });
  libraryTimeline
    .to(state, { library: 1, duration: 1, ease: "none" }, 0)
    .fromTo(".project-meta", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.12, ease: "none" }, 0.08)
    .to(".journey-note--collection", { opacity: 0, duration: 0.06, ease: "none" }, 0);
  cleanup.push(() => libraryTimeline.scrollTrigger?.kill(), () => libraryTimeline.kill());

  const readingTween = gsap.to(state, {
    reading: 1,
    ease: "none",
    scrollTrigger: {
      id: "reading-room-transition",
      trigger: "#reading-room",
      start: "top bottom",
      end: "bottom bottom",
      scrub: 0.8,
      invalidateOnRefresh: true
    }
  });
  cleanup.push(() => readingTween.scrollTrigger?.kill(), () => readingTween.kill());

  const bindingTimeline = gsap.timeline({
    scrollTrigger: {
      id: "binding-sequence",
      trigger: "#binding",
      start: "top top",
      end: "bottom bottom",
      pin: ".binding-stage",
      pinSpacing: false,
      scrub: 1,
      anticipatePin: 1,
      invalidateOnRefresh: true
    }
  });
  bindingTimeline
    .to(state, { binding: 1, duration: 1, ease: "none" }, 0)
    .fromTo(".binding-copy", { opacity: 0 }, { opacity: 1, duration: 0.12, ease: "none" }, 0.04)
    .to(".process-entry", {
      opacity: 1,
      y: 0,
      stagger: 0.11,
      duration: 0.12,
      ease: "none"
    }, 0.16)
    .to(".process-entry", {
      opacity: 0.35,
      stagger: 0.11,
      duration: 0.1,
      ease: "none"
    }, 0.68);
  cleanup.push(() => bindingTimeline.scrollTrigger?.kill(), () => bindingTimeline.kill());

  const studioTween = gsap.to(state, {
    studio: 1,
    ease: "none",
    scrollTrigger: {
      id: "studio-transition",
      trigger: "#studio",
      start: "top bottom",
      end: "bottom bottom",
      scrub: 0.8,
      invalidateOnRefresh: true
    }
  });
  cleanup.push(() => studioTween.scrollTrigger?.kill(), () => studioTween.kill());

  const commissionTween = gsap.to(state, {
    commission: 1,
    ease: "none",
    scrollTrigger: {
      id: "commission-transition",
      trigger: "#commission",
      start: "top bottom",
      end: "bottom bottom",
      scrub: 0.85,
      invalidateOnRefresh: true
    }
  });
  cleanup.push(() => commissionTween.scrollTrigger?.kill(), () => commissionTween.kill());

  const focusTriggers = document.querySelectorAll("[data-project-focus]");
  focusTriggers.forEach((button) => {
    const index = Number(button.dataset.projectFocus);
    button.addEventListener("focus", () => onProjectFocusRequest?.(index));
  });

  return {
    refresh: () => ScrollTrigger.refresh(),
    destroy: () => cleanup.forEach((fn) => fn())
  };
}

export { ScrollTrigger, gsap };
