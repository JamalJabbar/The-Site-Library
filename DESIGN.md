---
name: The Site Library
description: A tactile digital publishing archive for distinctive web work.
colors:
  parchment: "#f0ece3"
  paper: "#e5ded1"
  cream: "#f8f4eb"
  ink: "#151310"
  soft-ink: "#35302a"
  walnut: "#281d17"
  walnut-dark: "#18110e"
  oxblood: "#592328"
  forest: "#1f2b25"
  navy: "#1c2632"
  brass: "#ad8955"
  brass-soft: "#c6a776"
typography:
  display:
    fontFamily: "Bodoni Moda Variable, Georgia, serif"
    fontSize: "clamp(5rem, 11.5vw, 11rem)"
    fontWeight: 420
    lineHeight: 0.79
    letterSpacing: "-0.075em"
  headline:
    fontFamily: "Bodoni Moda Variable, Georgia, serif"
    fontSize: "clamp(3.7rem, 8.2vw, 8rem)"
    fontWeight: 430
    lineHeight: 0.86
    letterSpacing: "-0.07em"
  body:
    fontFamily: "Manrope Variable, Helvetica Neue, sans-serif"
    fontSize: "clamp(0.95rem, 1.2vw, 1.12rem)"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "normal"
  label:
    fontFamily: "Manrope Variable, Helvetica Neue, sans-serif"
    fontSize: "0.61rem"
    fontWeight: 650
    lineHeight: 1.5
    letterSpacing: "0.16em"
rounded:
  precision: "2px"
spacing:
  hairline: "1px"
  xs: "8px"
  sm: "12px"
  md: "20px"
  lg: "24px"
  xl: "48px"
  section: "96px"
components:
  outlined-action:
    backgroundColor: "#00000000"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.precision}"
    padding: "13px 18px 12px"
    height: "42px"
  outlined-action-dark:
    backgroundColor: "#00000000"
    textColor: "{colors.cream}"
    typography: "{typography.label}"
    rounded: "{rounded.precision}"
    padding: "13px 18px 12px"
    height: "42px"
  text-action:
    backgroundColor: "#00000000"
    textColor: "{colors.cream}"
    typography: "{typography.label}"
    rounded: "{rounded.precision}"
    padding: "9px 0"
---

# Design System: The Site Library

## Overview

**Creative North Star: "The Living Edition"**

The system treats a premium studio portfolio as a contemporary private press. Typography, physical book construction, restrained interface chrome, and one continuous architectural world make the metaphor functional rather than decorative. The mood is quiet, tactile, and exacting, with generous negative space interrupted by deliberate moments of editorial scale.

The visual register rejects generic agency cards, nostalgic old-library theater, black-on-black luxury cliches, and technology-demo spectacle. Motion edits one place over time. On editorial chapters the library recedes to a pale spatial memory, preserving continuity while copy takes priority.

**Key Characteristics:**
- High-contrast publishing typography interrupted by a physical 3D volume.
- Square precision, hairline rules, and almost no decorative rounding.
- Warm neutral architecture with rare brass and project-specific binding colors.
- Asymmetric composition at large sizes and simplified touch-first framing on mobile.
- Reversible, scroll-controlled motion with semantic HTML always present.

## Colors

The palette is a warm publishing neutral system grounded by ink and walnut, with aged brass reserved for physical detail and focus.

### Primary
- **Aged Brass** (`#a8834e`): Foil, progress, focus outlines, and warm shelf highlights. It is an accent, never a page wash.
- **Brass Paper Edge** (`#dcc6a2`): The same metal, alloyed lighter for dark surfaces. Brass reads against walnut; it does not read against the near-black plate the copy is set on, so the dark page carries its own value of it.

### Secondary
- **Oxblood Cloth** (`#592328`): Selected volume identity and bookmark detail.
- **Forest Cloth** (`#1f2b25`): Archival and landscape bindings.
- **Night Navy Cloth** (`#1c2632`): Technology and object bindings.

### Neutral
- **Library Parchment** (`#f0ece3`): Primary light field and detail panel.
- **Page Paper** (`#e5ded1`): Page blocks and recessed editorial surfaces.
- **Reading Cream** (`#f8f4eb`): Light copy on walnut and the fallback hero.
- **Printing Ink** (`#151310`): Primary text, borders, and the deepest readable mark.
- **Soft Ink** (`#1d1913`): Secondary prose only. Secondary, not faint: it carries decks, descriptions and definitions, every one of which is read rather than glanced at, and it holds 4.5:1 against the plate its chapter lays down.
- **Walnut** (`#281d17`) and **Deep Walnut** (`#18110e`): Architecture, shelf darkness, and commission atmosphere.

**The Rare Metal Rule.** Brass stays below roughly 10% of a frame. Its scarcity is what makes foil and focus feel valuable.

**The Plate Rule.** No line of type is read off the render. Every chapter lays a soft plate of the room's own light under the column its copy occupies, and the ink and the plate turn over together on one authored channel, so a page is never set in dark type over a dark room while the two disagree about which it is. Contrast is a property of the design here, not an outcome of the shot. `scripts/text-audit.js` walks the whole document and measures it.

## Typography

**Display Font:** Bodoni Moda Variable (with Georgia fallback)  
**Body Font:** Manrope Variable (with Helvetica Neue fallback)

**Character:** Bodoni Moda supplies real publishing contrast, broad italic gestures, and variable control without defaulting to the overused Instrument Serif reflex. Manrope provides quiet technical clarity for labels, navigation, and explanatory copy.

### Hierarchy
- **Display** (420, `clamp(5rem, 11.5vw, 11rem)`, `0.79`): Hero phrases that may interleave with the physical book.
- **Headline** (430, `clamp(3.7rem, 8.2vw, 8rem)`, `0.86`): Chapter declarations and commission copy.
- **Title** (430, `clamp(2.5rem, 4.7vw, 5.4rem)`, `0.88`): Project names and editorial statements.
- **Body** (400, `clamp(0.95rem, 1.2vw, 1.12rem)`, `1.65`): Explanatory copy, kept near 48 to 64 characters per line.
- **Label** (650, `0.61rem`, `0.16em`, uppercase): Navigation, metadata, wayfinding, and actions.

**The Two Voices Rule.** Bodoni speaks in titles and authored statements. Manrope handles every navigational, factual, and operational sentence.

## Elevation

The system is flat by default. Depth comes from actual 3D lighting, tonal planes, one-pixel rules, and material response rather than stacked UI shadows. DOM shadow is reserved for the project sheet and the mobile bottom sheet, where it communicates a real layer moving over the library.

### Shadow Vocabulary
- **Project Sheet** (`-40px 0 100px rgba(19, 12, 9, 0.18)`): Desktop inspection panel only.
- **Mobile Sheet** (`0 -28px 80px rgba(19, 12, 9, 0.22)`): Mobile inspection panel only.
- **Physical Contact**: Procedural Three.js contact-shadow texture under each book; never reproduce this as a generic card shadow.

**The Physical Depth Rule.** If a layer is not moving above another layer or representing a physical object, it does not receive a shadow.

## Components

Components are refined and restrained. They use hairlines, precise corners, and typographic state changes instead of pill silhouettes or ornamental containers.

### Buttons
- **Shape:** Near-square with `2px` precision radius and a `1px` current-color border.
- **Primary:** Transparent at rest, label typography, `13px 18px 12px` padding, `42px` minimum height.
- **Hover / Focus:** A solid ink or cream field rises from the bottom over `360ms`; focus also receives a `2px` brass outline with `5px` offset.
- **Text Action:** No container, `9px 0` padding, one-pixel underline, and gap expansion from `10px` to `15px`.

### Cards / Containers
- **Corner Style:** Square. The portfolio does not use a card grid; books are the project containers.
- **Background:** Parchment for editorial sheets, transparent for chapter copy, physical materials for the collection.
- **Shadow Strategy:** Only inspection sheets use DOM shadow.
- **Internal Padding:** `36px` to `88px` on desktop detail sheets and `20px` on mobile.

### Navigation
- Fixed `88px` header compressing to `68px` after scroll.
- Labels use Manrope at `0.66rem` with `0.13em` tracking.
- Desktop links draw a one-pixel underline from the interaction edge. Mobile navigation becomes a full-width paper index below the header.

### Project Volume
- Every project uses the same multi-part book construction but distinct width, height, depth, palette, motif, spine, and metadata.
- Focus advances one volume, dims its neighbors, and keeps a real DOM button as the accessible proxy.
- Inspection moves the same object, traps focus in a semantic dialog, and restores its exact saved transform on close.

### Motion
- Scroll uses one persistent Three.js world, Lenis smoothing at `0.08`, and GSAP scrub values from `0.8` to `1.1`.
- Interface motion uses `cubic-bezier(0.16, 1, 0.3, 1)` for arrival and `cubic-bezier(0.76, 0, 0.24, 1)` for deliberate scene changes.
- Reduced motion removes smoothing and continuous choreography while preserving all chapters and project controls.

## Do's and Don'ts

### Do:
- **Do** make the library metaphor functional: each project remains a selectable, inspectable volume.
- **Do** preserve Library Parchment (`#f0ece3`), Printing Ink (`#151310`), and Aged Brass (`#ad8955`) as the global hierarchy.
- **Do** use broad editorial type with narrow label copy and strong negative space.
- **Do** keep camera roll at zero, FOV between 32 and 47 degrees, and local pointer motion under 7 degrees.
- **Do** provide keyboard, touch, reduced-motion, and forced-fallback access to the same content.

### Don't:
- **Don't** turn the portfolio into a standard agency card grid with a decorative 3D hero.
- **Don't** use literal Victorian, gothic, fantasy, Hogwarts, steampunk, or nostalgic old-book imagery.
- **Don't** use generic black luxury styling, neon technology demos, futuristic HUDs, glassmorphism, or floating gradient blobs.
- **Don't** imitate Stripe Press, copy its covers, or borrow Stripe branding.
- **Don't** add Three.js spectacle that is disconnected from navigation or story.
- **Don't** introduce template-driven SaaS hierarchy, excessive rounded cards, pills, or gratuitous scroll effects.
