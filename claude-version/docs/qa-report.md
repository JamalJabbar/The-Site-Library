# QA report

Rebuild verified 2026-08-28 in Chromium at 1440x900 and 390x844.

Because the test browser pane throttles animation frames whenever it is not
composited, screenshots taken through it are unreliable. Every visual result
below was captured by rendering a frame synchronously and reading the
framebuffer, and every numeric result was read from live state rather than
inferred.

## Journey

Eleven narrative positions rendered and reviewed: frontispiece, departure,
architecture emerging, mid-flight, reveal, three points along the shelf, the
reserved place, reading room, binding, studio, commission.

- The volume reaches the shelf slot at exactly `SHELF.heroSlot`
  (`-5.45, 1.28, -0.28`) with the slot's own quaternion. The endpoint is copied
  from the slot object rather than sampled from the flight curve, so there is no
  terminal drift and no snap.
- Reverse scroll reproduces every position: state is a pure function of scroll.
- The shelf traverse is a straight, level dolly. Camera Y moves 1.38 to 1.32 and
  Z 6.45 to 6.13 across the whole shot, and focus advances 0, 2, 4, 6 evenly
  across the seven volumes.

## Inspection

Opened from the index rail and by raycast, at volumes 3 and 4.

- Composition solves from the live aspect ratio. At 1440 wide the volume
  occupies NDC x -0.805 to -0.144 and the editorial column starts at 739px,
  leaving a 123px gap. At 390 wide it centres and the panel stacks below.
- Restoration is exact: position error 0, rotation error 2.2e-16, scale error 0.
- `window.scrollY` is unchanged across the whole cycle. Scroll is held, not
  moved, so there is no saved position to restore.
- Escape closes, focus returns to the originating rail button, and the live
  region announces both the open and the close with the volume number.

## Contrast

Measured as the resolved token against the painted backdrop at each chapter:

| chapter | surface | ratio |
| --- | --- | ---: |
| frontispiece | light | 15.7 |
| into the stacks | dark | 9.7 |
| selected works | dark | 16.4 |
| reading room | dark | 16.4 |
| binding | dark | 16.0 |
| studio | light | 11.1 |
| commission | dark | 17.7 |

The interface follows measured background luminance rather than a chapter list,
which is what stops cream type appearing over a cream room. Copy columns in the
dark chapters carry a local gradient scrim so type stays legible where it
crosses a lit binding.

## Performance

Sampled across 41 positions spanning the whole journey, at 1440x900, high tier:

- peak draw calls 139 (desktop budget 90 to 160)
- peak triangles 11,456
- textures 54, geometries 78, programs 25
- production build: app 79.4 kB (26.7 gzip), motion 131.5 kB (49.3 gzip),
  three 537.6 kB (135.0 gzip), CSS 31.6 kB (7.5 gzip). Fonts are self-hosted and
  subset by unicode range.

Shadow maps redraw only when something has moved. Only the boards cast; the
leaves and spine sit inside that silhouette and were costing a pass for nothing.

## Responsive

- 1440x900 and 390x844 rendered and reviewed.
- No horizontal overflow at either width.
- The compact composition resolves its own camera keyframes, and haze distances
  scale with the camera-to-subject ratio so the atmosphere reads identically at
  both breakpoints from one set of authored numbers.
- Breakpoint changes are picked up by a ResizeObserver as well as the window
  resize event.

## Reduced motion

Verified with `prefers-reduced-motion` forced true.

- Lenis is not created; smoothed progress is pinned to exact.
- Sections collapse to one viewport each (document height 6300 for 7 chapters).
- All copy that the journey would have revealed is present at full opacity:
  metadata, reserved note, index rail, closing caption, process steps.
- Exactly one visible copy of each headline line; the layout twins stay hidden.
- The decision is published as a class so the stylesheet and the module cannot
  disagree.

## No-WebGL edition

All seven volumes render as their real generated cover artwork (WebP data URLs
from the same canvas the 3D boards wear), with alt text, volume metadata,
premise and an outbound link each.

## Console

Clean. No errors, no warnings, no framework notices.

## Known gaps

- Not exercised on physical mobile hardware; the low tier is selected by
  pointer, memory and core heuristics and was verified only by emulation.
- The case-study media stage described in the brief's section 24 is not built.
  Inspection presents the full editorial record and an outbound link; there is
  no in-page screenshot gallery.
- Sound is not implemented. The brief marks it optional.
