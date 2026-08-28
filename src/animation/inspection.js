import { gsap, ScrollTrigger } from "./scroll.js";

export function createInspectionController({ world, lenis, overlay, onOpen, onClose }) {
  let current = null;
  let timeline = null;
  let savedScroll = 0;
  let origin = null;
  let cameraPose = null;
  const backgroundRegions = [
    document.querySelector(".site-header"),
    document.querySelector(".hero-copy"),
    document.querySelector("main")
  ].filter(Boolean);

  function setBackgroundInert(value) {
    backgroundRegions.forEach((region) => {
      region.inert = value;
    });
  }

  function trapFocus(event) {
    if (event.key !== "Tab" || !current) return;
    const focusable = [...overlay.querySelectorAll("a[href], button:not([disabled])")]
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

  document.addEventListener("keydown", trapFocus);

  function open(book, originElement) {
    if (!book || current || timeline) return;
    const trigger = ScrollTrigger.getById("library-traversal");
    savedScroll = window.scrollY;
    origin = originElement || document.activeElement;
    current = book;
    cameraPose = {
      position: world.pathRig.position.clone(),
      quaternion: world.pathRig.quaternion.clone(),
      fov: world.camera.fov
    };
    const base = {
      position: book.position.clone(),
      quaternion: book.quaternion.clone(),
      scale: book.scale.clone()
    };
    current.userData.inspectionBase = base;
    book.visual.position.set(0, 0, 0);
    book.visual.rotation.set(0, 0, 0);
    const target = world.getInspectionPose(book);

    lenis?.stop();
    trigger?.disable(false);
    world.beginInspection(book);
    setBackgroundInert(true);
    document.documentElement.classList.add("project-is-open");
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    onOpen?.(book.project);

    timeline = gsap.timeline({
      defaults: { duration: 1.15, ease: "power4.inOut" },
      onComplete: () => {
        timeline = null;
        overlay.querySelector("[data-close-project]")?.focus({ preventScroll: true });
      }
    });
    timeline
      .to(book.position, {
        x: target.position.x,
        y: target.position.y,
        z: target.position.z
      }, 0)
      .to(book.quaternion, {
        x: target.quaternion.x,
        y: target.quaternion.y,
        z: target.quaternion.z,
        w: target.quaternion.w
      }, 0)
      .to(book.scale, {
        x: target.scale.x,
        y: target.scale.y,
        z: target.scale.z
      }, 0)
      .to(world.camera, { fov: Math.max(29, world.camera.fov - 2), onUpdate: () => world.camera.updateProjectionMatrix() }, 0)
      .fromTo(overlay.querySelector(".project-panel__inner"),
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.72, ease: "power3.out" },
        0.48
      );
  }

  function close() {
    if (!current || timeline) return;
    const book = current;
    const base = book.userData.inspectionBase;
    const trigger = ScrollTrigger.getById("library-traversal");
    document.documentElement.classList.add("project-is-closing");

    timeline = gsap.timeline({
      defaults: { duration: 1.05, ease: "power4.inOut" },
      onComplete: () => {
        world.endInspection();
        overlay.hidden = true;
        overlay.setAttribute("aria-hidden", "true");
        setBackgroundInert(false);
        document.documentElement.classList.remove("project-is-open", "project-is-closing");
        trigger?.enable(false, false);
        window.scrollTo(0, savedScroll);
        lenis?.start();
        origin?.focus?.({ preventScroll: true });
        onClose?.(book.project);
        current = null;
        timeline = null;
      }
    });
    timeline
      .to(overlay.querySelector(".project-panel__inner"), {
        opacity: 0,
        y: 22,
        duration: 0.38,
        ease: "power2.out"
      }, 0)
      .to(book.position, {
        x: base.position.x,
        y: base.position.y,
        z: base.position.z
      }, 0.08)
      .to(book.quaternion, {
        x: base.quaternion.x,
        y: base.quaternion.y,
        z: base.quaternion.z,
        w: base.quaternion.w
      }, 0.08)
      .to(book.scale, {
        x: base.scale.x,
        y: base.scale.y,
        z: base.scale.z
      }, 0.08)
      .to(world.pathRig.position, {
        x: cameraPose.position.x,
        y: cameraPose.position.y,
        z: cameraPose.position.z
      }, 0.08)
      .to(world.pathRig.quaternion, {
        x: cameraPose.quaternion.x,
        y: cameraPose.quaternion.y,
        z: cameraPose.quaternion.z,
        w: cameraPose.quaternion.w
      }, 0.08)
      .to(world.camera, {
        fov: cameraPose.fov,
        onUpdate: () => world.camera.updateProjectionMatrix()
      }, 0.08);
  }

  function destroy() {
    timeline?.kill();
    setBackgroundInert(false);
    document.removeEventListener("keydown", trapFocus);
    timeline = null;
    current = null;
  }

  return { open, close, destroy, get current() { return current; } };
}
