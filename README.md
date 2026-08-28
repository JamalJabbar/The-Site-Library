# The Site Library

A luxury digital-library scroll experience built as one persistent Three.js world. Native scrolling moves a hero volume into an authored shelf, traverses seven project editions, and carries the library forward as a spatial memory through the studio story.

## Run locally

```bash
npm install
npm run dev
```

The Vite development server defaults to `http://127.0.0.1:5173`.

## Verification

```bash
npm run test:static
npm run build
npm run test:visual
```

The visual suite uses Chromium and writes its evidence to `test-results/evidence/`.

## Runtime modes

- `?debug=1` exposes `window.__TSL_DEBUG__` for renderer and restoration metrics.
- `?diagnostics=1` also displays the on-screen diagnostic panel.
- `?fallback=1` forces the complete static edition.
- The experience honors `prefers-reduced-motion: reduce` without removing project access.

## Architecture

- Three.js renders one transparent, persistent world with adaptive quality tiers.
- GSAP ScrollTrigger authors chapter state and scroll-linked camera transitions.
- Lenis supplies smooth native scrolling when reduced motion is not requested.
- Procedural canvas artwork, cloth, paper, plaster, shadow, and foil maps avoid external runtime media dependencies.
- The DOM owns typography, navigation, project details, accessibility, and static fallback content.

See [docs/world-bible.md](docs/world-bible.md), [DESIGN.md](DESIGN.md), and [docs/qa-report.md](docs/qa-report.md) for the authored world, visual system, and final verification record.
