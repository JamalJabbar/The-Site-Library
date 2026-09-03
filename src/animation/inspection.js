import { gsap } from "./conductor.js";

const SCROLL_KEYS = new Set([
  "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Spacebar"
]);

/**
 * Removing a volume from the archive.
 *
 * Scroll is held rather than moved: Lenis stops and the raw scroll events are
 * swallowed, so `window.scrollY` never changes and there is no position to
 * restore afterwards. The volume travels from its measured shelf pose to a
 * composition solved from the live viewport, and returns to the exact transform
 * it was captured at.
 */
export function createInspection({ world, conductor, panel, onOpen, onClose, reduceMotion }) {
  let current = null;
  let timeline = null;
  let origin = null;
  let restore = null;
  const background = [
    document.querySelector(".masthead"),
    document.querySelector("main")
  ].filter(Boolean);

  const sheet = panel.querySelector(".volume__sheet");
  const closeButton = panel.querySelector("[data-close-panel]");

  /**
   * Holds the journey still while a volume is open.
   *
   * The sheet is the one thing on the page that is meant to move, so a gesture
   * that starts inside it is let through whatever kind it is. Its own
   * overscroll-behavior is what makes that safe: a gesture that runs past the
   * end of the sheet stops there rather than chaining to the document, so the
   * archive cannot be scrolled out from under the reader by overscrolling the
   * text they are reading.
   */
  function blockScroll(event) {
    if (!current) return;
    if (event.type === "keydown" && !SCROLL_KEYS.has(event.key)) return;
    if (event.target.closest?.(".volume__sheet")) return;
    event.preventDefault();
  }

  function trapFocus(event) {
    if (event.key !== "Tab" || !current) return;
    const focusable = [...panel.querySelectorAll("a[href], button:not([disabled])")]
      .filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onKeydown(event) {
    if (event.key === "Escape" && current) {
      event.preventDefault();
      close();
      return;
    }
    trapFocus(event);
    blockScroll(event);
  }

  document.addEventListener("keydown", onKeydown);
  window.addEventListener("wheel", blockScroll, { passive: false });
  window.addEventListener("touchmove", blockScroll, { passive: false });

  function setBackgroundInert(value) {
    background.forEach((region) => { region.inert = value; });
  }

  function open(book, source) {
    if (!book || current || timeline) return false;
    current = book;
    origin = source || document.activeElement;

    restore = {
      position: book.position.clone(),
      quaternion: book.quaternion.clone(),
      camera: world.pathRig.position.clone(),
      fov: world.camera.fov
    };

    const plan = world.planInspection(book);
    conductor.stop();
    world.beginInspection(book);
    setBackgroundInert(true);
    document.documentElement.classList.add("panel-open");
    panel.hidden = false;
    onOpen?.(book.project);

    const duration = reduceMotion ? 0.001 : 1.2;
    timeline = gsap.timeline({
      defaults: { duration, ease: "power4.inOut" },
      onComplete: () => {
        timeline = null;
        world.settleInspection();
        closeButton?.focus({ preventScroll: true });
      }
    });

    timeline
      .to(book.position, { x: plan.book.position.x, y: plan.book.position.y, z: plan.book.position.z }, 0)
      .to(book.quaternion, {
        x: plan.book.quaternion.x,
        y: plan.book.quaternion.y,
        z: plan.book.quaternion.z,
        w: plan.book.quaternion.w
      }, 0)
      .to(world.pathRig.position, {
        x: plan.camera.position.x,
        y: plan.camera.position.y,
        z: plan.camera.position.z
      }, 0)
      .to(world.camera, {
        fov: plan.camera.fov,
        onUpdate: () => world.camera.updateProjectionMatrix()
      }, 0)
      .to(world.inputRig.rotation, { x: 0, y: 0, duration: duration * 0.5 }, 0)
      .to(world, { inspectionBlend: 1, duration: duration * 0.8, ease: "power2.inOut" }, 0)
      .fromTo(sheet,
        { opacity: 0, y: 34 },
        { opacity: 1, y: 0, duration: reduceMotion ? 0.001 : 0.8, ease: "power3.out" },
        duration * 0.44)
      .fromTo(panel.querySelector("[data-close-panel]"),
        { opacity: 0 },
        { opacity: 0.78, duration: reduceMotion ? 0.001 : 0.5 },
        duration * 0.34);

    return true;
  }

  function close() {
    if (!current || timeline) return false;
    const book = current;
    world.beginClosing();

    const duration = reduceMotion ? 0.001 : 1.05;
    timeline = gsap.timeline({
      defaults: { duration, ease: "power4.inOut" },
      onComplete: () => {
        world.endInspection();
        panel.hidden = true;
        setBackgroundInert(false);
        document.documentElement.classList.remove("panel-open");
        conductor.start();
        origin?.focus?.({ preventScroll: true });
        onClose?.(book.project);
        current = null;
        timeline = null;
        restore = null;
      }
    });

    timeline
      .to(sheet, { opacity: 0, y: 26, duration: reduceMotion ? 0.001 : 0.36, ease: "power2.in" }, 0)
      .to(panel.querySelector("[data-close-panel]"), { opacity: 0, duration: 0.28 }, 0)
      .to(book.position, {
        x: restore.position.x, y: restore.position.y, z: restore.position.z
      }, 0.1)
      .to(book.quaternion, {
        x: restore.quaternion.x,
        y: restore.quaternion.y,
        z: restore.quaternion.z,
        w: restore.quaternion.w
      }, 0.1)
      .to(world.pathRig.position, {
        x: restore.camera.x, y: restore.camera.y, z: restore.camera.z
      }, 0.1)
      .to(world.camera, {
        fov: restore.fov,
        onUpdate: () => world.camera.updateProjectionMatrix()
      }, 0.1)
      .to(world, { inspectionBlend: 0, duration: duration * 0.9, ease: "power2.inOut" }, 0);

    return true;
  }

  return {
    open,
    close,
    get current() { return current; },
    get busy() { return Boolean(timeline); },
    destroy() {
      timeline?.kill();
      timeline = null;
      current = null;
      setBackgroundInert(false);
      document.removeEventListener("keydown", onKeydown);
      window.removeEventListener("wheel", blockScroll);
      window.removeEventListener("touchmove", blockScroll);
    }
  };
}
