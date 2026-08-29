import * as THREE from "three";
import { gsap } from "../animation/conductor.js";

/**
 * The bookplate.
 *
 * Progress is reported by THREE.LoadingManager against real work: the two
 * typefaces, the procedural surface library, the environment probe, the room,
 * and every volume as its artwork is drawn. Nothing here is a timer pretending
 * to be a loading bar.
 */

const FONT_FACES = [
  '420 96px "Bodoni Moda Variable"',
  '500 96px "Bodoni Moda Variable"',
  'italic 420 96px "Bodoni Moda Variable"',
  '550 16px "Geist Variable"',
  '600 16px "Geist Variable"'
];

export function createLoader(root, { reduceMotion } = {}) {
  const percent = root.querySelector("[data-loader-percent]");
  const bar = root.querySelector("[data-loader-bar]");
  const status = root.querySelector("[data-loader-status]");
  const startedAt = performance.now();

  const manager = new THREE.LoadingManager();
  let shown = 0;

  manager.onProgress = (_url, loaded, total) => {
    const value = total ? loaded / total : 0;
    // Never let the readout jump backwards as the total grows.
    shown = Math.max(shown, value);
    percent.textContent = `${Math.round(shown * 100).toString().padStart(3, "0")}%`;
    bar.style.transform = `scaleX(${shown.toFixed(4)})`;
  };
  manager.onError = (url) => {
    status.textContent = `Archive continuing without ${String(url).split("/").pop()}`;
  };

  // Print the bookplate: the outline draws, the monogram sets, the wordmark
  // closes its tracking.
  const outlines = root.querySelectorAll(".loader__outline, .loader__rule");
  outlines.forEach((path) => {
    const length = path.getTotalLength();
    path.style.setProperty("--len", String(length));
  });

  const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
  if (!reduceMotion) {
    intro
      .to(outlines, { strokeDashoffset: 0, duration: 1.05, stagger: 0.09 }, 0)
      .fromTo(".loader__monogram", { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.6 }, 0.5)
      .fromTo(".loader__wordmark",
        { opacity: 0, letterSpacing: "0.45em" },
        { opacity: 1, letterSpacing: "0.12em", duration: 0.95, ease: "power2.out" }, 0.62)
      .fromTo(".loader__progress", { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.86);
  } else {
    gsap.set(outlines, { strokeDashoffset: 0 });
    gsap.set([".loader__monogram", ".loader__wordmark", ".loader__progress"], { opacity: 1 });
    gsap.set(".loader__wordmark", { letterSpacing: "0.12em" });
  }

  async function loadFonts() {
    manager.itemStart("fonts");
    try {
      await Promise.all(FONT_FACES.map((face) => document.fonts.load(face, "Websites worth keeping")));
      await document.fonts.ready;
    } catch {
      manager.itemError("fonts");
    }
    manager.itemEnd("fonts");
  }

  function step(label) {
    manager.itemStart(label);
    return () => manager.itemEnd(label);
  }

  async function dismiss() {
    const elapsed = performance.now() - startedAt;
    // The bookplate is part of the identity; give it its full beat.
    if (elapsed < 1500) {
      await new Promise((resolve) => window.setTimeout(resolve, 1500 - elapsed));
    }
    percent.textContent = "100%";
    bar.style.transform = "scaleX(1)";
    // Whatever the bookplate animation did or did not reach, the mark is set
    // before the cover closes on it.
    intro.progress(1);

    const wipe = gsap.timeline({ paused: true })
      .to(".loader__bar span", { backgroundColor: "#ad8955", duration: 0.16 }, 0)
      .to(".loader__book", { scaleX: 0.955, duration: 0.3, ease: "power2.inOut" }, 0.12)
      .to(root, {
        clipPath: "inset(0 0 100% 0)",
        duration: reduceMotion ? 0.01 : 0.9,
        ease: "power4.inOut"
      }, 0.32);

    await new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      wipe.eventCallback("onComplete", finish);
      wipe.play();
      // A background tab throttles animation frames. The archive still opens.
      window.setTimeout(() => {
        if (settled) return;
        wipe.progress(1);
        finish();
      }, 2600);
    });

    root.hidden = true;
    intro.kill();
    wipe.kill();
  }

  return { manager, loadFonts, step, dismiss };
}
