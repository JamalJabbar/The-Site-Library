# The Site Library

A single-page, scroll-conducted WebGL experience for an independent digital
design studio. One hardbound volume floats in a bleached cream field; as the
reader scrolls it travels across the room and settles into its exact place on a
bookcase, and that bookcase becomes the portfolio.

Vite, Three.js, GSAP, Lenis. No framework, no 3D embed, no prebuilt scenes.
Every texture in the room is drawn on a canvas at runtime, so the site ships
with no third-party media at all.

## Running it

```bash
npm install && npm run dev
```

- `npm run build` production bundle
- `npm run test:static` data, ledger, legibility and regression gate

Development URL flags: `?diagnostics` shows renderer stats and exposes
`window.__TSL__`; `?edition` forces the no-WebGL edition.

Legibility is measured rather than assumed. With the dev server running and
`?diagnostics` on, `scripts/text-audit.js` walks the whole document and reports
every collision between two runs of type, every block of copy that reaches
outside its own chapter, and every line whose contrast falls under WCAG against
the background actually painted behind it:

```js
const audit = await import("/scripts/text-audit.js");
audit.sweep(window.__TSL__, { step: 0.1 });
audit.proof("reading-room");   // and a flat image of the frame it measured
```

It is a harness, never imported by the application.

## How it is put together

```
src/
  main.js                 boot, state machine, input, frame loop
  style.css               design system and every chapter's layout
  data/projects.js        the collection, plus the derived shelf layout
  data/chapters.js        the scene ledger: chapters, camera keyframes, world channels
  three/World.js          renderer, scene graph, camera resolution, interaction
  three/Book3D.js         the volume: boards, curved spine, leaves, joint, foil
  three/architecture.js   the room, the case, the reading table
  three/environment.js    procedural environment probe and the light rig
  three/textures.js       cover artwork and every surface, drawn on canvas
  animation/conductor.js  Lenis, ScrollTrigger, DOM beats, measured anchors
  animation/inspection.js taking a volume off the shelf and putting it back
  ui/interface.js         metadata, index rail, cursor, static edition
  utils/preload.js        the bookplate and real load progress
```

### Scroll is the only clock

```
document scroll -> Lenis -> ScrollTrigger -> exact progress -> world state
```

`exact` is the reproducible story position and drives every discrete decision:
the chapter, the focused volume, navigation state, interaction gating. A damped
copy drives camera and grade so the picture stays cinematic while the state
stays exact. The same scroll position always produces the same frame, forwards,
backwards, after a jump, or after a reload.

Chapter heights come from `CHAPTERS[].weight`, and camera keyframes are anchored
to a chapter plus a local position inside it. Section heights and choreography
therefore cannot drift apart.

### The room is revealed by light, not by fading

Nothing in the scene is ever faded in. The architecture is opaque and present
from the first frame; at the frontispiece the haze is closed to just past the
volume, so the room beyond it is bleached into an abstract cream field. Opening
those two distances is the entire reveal.

The haze is a modified fog chunk that spends its factor on alpha rather than on
colour, so hazed geometry becomes genuinely transparent. Two things follow: the
page paints the ground colour behind the canvas, so haze and background are the
same pixels and cannot seam; and the frontispiece headline, which sits between
the backdrop and the canvas, shows through the bleached room while the volume
stays solid and occludes it.

### Adding a volume

Add an entry to `PROJECTS` in `src/data/projects.js`. The shelf layout, the 3D
book, its cover artwork, the metadata rail, the inspection panel and the
no-WebGL edition are all derived from it. `npm run test:static` asserts that
nothing has been hard-wired anywhere else.

## Accessibility and fallbacks

- The index rail is a real, visible row of buttons: the keyboard route through
  the collection is the route everyone else uses.
- Inspection is a focus-trapped dialog; Escape closes it and focus returns to
  the control that opened it. Scroll is held rather than moved, so there is no
  position to restore.
- Reduced motion is published to the stylesheet as a class from the same media
  query the module reads, so the two can never disagree and strand copy at zero
  opacity. The journey stops travelling; nothing goes missing.
- Without WebGL the site serves a static edition built from the same generated
  cover artwork.
