import { gsap } from "../animation/scroll.js";

function loadImage(url, manager) {
  manager.itemStart(url);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      manager.itemEnd(url);
      resolve(image);
    };
    image.onerror = () => {
      manager.itemError(url);
      manager.itemEnd(url);
      resolve(null);
    };
    image.src = url;
  });
}

export function connectLoader(manager, elements) {
  const { root, percentage, bar, status } = elements;
  const startedAt = performance.now();
  let completePromiseResolve;
  const completePromise = new Promise((resolve) => {
    completePromiseResolve = resolve;
  });

  manager.onProgress = (_url, loaded, total) => {
    const progress = total ? loaded / total : 0;
    percentage.textContent = `${Math.round(progress * 100).toString().padStart(3, "0")}%`;
    bar.style.transform = `scaleX(${progress})`;
  };
  manager.onError = (url) => {
    status.textContent = `ARCHIVE CONTINUING WITHOUT ${url.split("/").pop()?.toUpperCase() || "ONE ASSET"}`;
  };
  manager.onLoad = () => completePromiseResolve();

  async function startCriticalLoads() {
    manager.itemStart("fonts");
    const fonts = document.fonts?.ready || Promise.resolve();
    await Promise.all([fonts, loadImage("/images/library-fallback.png", manager)]);
    manager.itemEnd("fonts");
  }

  async function dismiss() {
    await completePromise;
    const elapsed = performance.now() - startedAt;
    if (elapsed < 1500) await new Promise((resolve) => window.setTimeout(resolve, 1500 - elapsed));
    percentage.textContent = "100%";
    bar.style.transform = "scaleX(1)";
    root.classList.add("is-complete");
    await new Promise((resolve) => {
      gsap.timeline({ onComplete: resolve })
        .to(".loader__book", { rotateY: -4, scaleX: 0.94, duration: 0.24, ease: "power2.inOut" })
        .to(".loader__bar-fill", { backgroundColor: "#ad8955", duration: 0.12 }, 0.18)
        .to(root, { clipPath: "inset(0 0 100% 0)", duration: 0.9, ease: "power4.inOut" }, 0.34);
    });
    root.hidden = true;
  }

  return { startCriticalLoads, dismiss };
}
