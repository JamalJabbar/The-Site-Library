# QA Report

Verified on 2026-08-27 with headless Chromium against the Vite development server.

## Final status

- Static checks: passed.
- Production build: passed with no chunk-size warning.
- Browser scenarios: 5 passed in 3.7 minutes.
- Application console errors and warnings: none.
- Horizontal overflow: none at 1440x900, 1280x800, 768x1024, and 390x844.
- Project transform restoration: position, rotation, and scale error each remain below `0.0001`.
- Keyboard inspection flow: focus enters the dialog, loops between its controls, closes with Escape, and returns to the origin control.

## Enforced WebGL ceilings

- Shelf render calls: fewer than 190.
- Reverse-scroll hero render calls: fewer than 130.
- Rendered triangles: fewer than 500,000.
- Resident textures: fewer than 50.
- Active hero and selected project volumes: verified inside the camera frame on desktop and tablet.

The software-rendered headless browser may emit Chromium `GL Driver Message` readback notices. The suite filters only those browser-driver notices; application warnings, console errors, and page errors still fail the run.

## Behavioral matrix

- Desktop forward journey and exact reverse journey.
- Desktop project inspection and shelf restoration.
- Tablet compact-camera composition.
- Mobile hero, selected works, and dedicated inspection-cover stage.
- Reduced-motion project browsing.
- Forced static fallback with all seven projects and commission CTA.
- Reading room, binding, studio, and commission chapter labels and compositions.
- WebGL context fallback hooks, adaptive device-pixel ratio, visibility pausing, and runtime quality degradation are present in the implementation.

## Evidence

- `test-results/evidence/desktop-hero.png`
- `test-results/evidence/desktop-journey.png`
- `test-results/evidence/desktop-shelf.png`
- `test-results/evidence/desktop-inspection.png`
- `test-results/evidence/desktop-reading-room.png`
- `test-results/evidence/desktop-binding.png`
- `test-results/evidence/desktop-studio.png`
- `test-results/evidence/desktop-commission.png`
- `test-results/evidence/tablet-hero.png`
- `test-results/evidence/tablet-shelf.png`
- `test-results/evidence/mobile-hero.png`
- `test-results/evidence/mobile-shelf.png`
- `test-results/evidence/mobile-inspection.png`
- `test-results/evidence/mobile-reduced-motion.png`
- `test-results/evidence/mobile-fallback.png`

## Production output

The final production build generated three JavaScript paths:

- Application: 59.75 kB raw, 19.19 kB gzip.
- Motion: 131.52 kB raw, 49.47 kB gzip.
- Three.js: 538.90 kB raw, 135.46 kB gzip.

Fonts are self-hosted through package assets. The generated fallback image is local, so the published experience has no third-party media dependency.
