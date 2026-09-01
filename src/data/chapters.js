import { SHELF } from "./projects.js";

/**
 * The scene ledger.
 *
 * CHAPTERS give the document its scroll weight and the indicator its labels.
 * KEYFRAMES are the authored camera and world states. Each keyframe is anchored
 * to a chapter plus a local position inside it, so changing a section's height
 * never desynchronises the choreography from the copy.
 *
 * Every world value is interpolated between adjacent keyframes once per frame.
 * No subsystem reads raw scroll or compares progress against its own threshold.
 *
 * Units are decimetres. The shelf carrying the collection is y = 0; the floor is
 * 14 units below it and the reading table 6.4 units below it.
 */

export const CHAPTERS = [
  { id: "frontispiece", number: "01", label: "Frontispiece", nav: "Index", weight: 1.0, tone: "light" },
  { id: "stacks", number: "02", label: "Into the Stacks", nav: "Into the Stacks", weight: 5.4, tone: "shift" },
  { id: "selected-works", number: "03", label: "Selected Works", nav: "Selected Works", weight: 5.0, tone: "dark" },
  { id: "reading-room", number: "04", label: "The Reading Room", nav: "Reading Room", weight: 2.4, tone: "dark" },
  { id: "binding", number: "05", label: "Binding", nav: "Binding", weight: 3.4, tone: "dark" },
  { id: "studio", number: "06", label: "The Studio", nav: "Studio", weight: 2.4, tone: "light" },
  { id: "commission", number: "07", label: "Commission", nav: "Contact", weight: 2.6, tone: "dark" }
];

/** Where the hero volume floats before it is returned to the collection. */
export const HERO_REST = { x: 0.35, y: 1.0, z: 4.6 };

/** Where the hero volume lies for the closing chapter. */
export const TABLE_REST = { x: 4.4, y: -6.14, z: 2.9 };

/** Where the binding sequence takes the volume apart. Right of frame, because
 *  the process copy occupies the left column. */
export const BINDING_REST = { x: 3.3, y: 0.55, z: 2.6 };

/**
 * World channel reference
 *
 * key         directional key light intensity
 * env         scene environment intensity, the soft studio bounce
 * practical   the brass picture lights washing the case
 * table       the reading-table lamp
 * hazeNear    linear fog start. At hero values the room beyond the book is
 * hazeFar     bleached into an abstract cream field; opening these distances
 *             lets the architecture resolve without one opacity animation.
 * ground      colour the fog and the background resolve toward
 * dust        motes in the shelf light
 * grain       film grain over the page
 * exposure    tone-mapping exposure
 */

export const KEYFRAMES = [
  {
    id: "frontispiece",
    chapter: "frontispiece",
    local: 0,
    camera: {
      // Held back a further tenth so the volume clears the headline: its edge
      // should land mid-way through the last letter of "Websites", not swallow
      // the whole of it. The lens moves, not the book, which has to keep its
      // true size to sit correctly in the shelf later.
      position: [0.021, 1.12, 12.05],
      target: [0.181, 0.86, 4.6],
      fov: 34,
      mobile: { position: [0.1, 1.1, 14.15], target: [0.3, 0.9, 4.6], fov: 41 }
    },
    world: {
      // The volume sits about 7.45 units from the lens. Everything past it is
      // bleached out of the key light, so the room is present but unreadable:
      // an abstract cream field. Opening these two distances is the reveal.
      key: 2.05, env: 0.85, practical: 0, table: 0, heroLight: 1,
      hazeNear: 7.72, hazeFar: 9.78, ground: "#f0ece3",
      dust: 0, grain: 0.14, exposure: 1.0
    }
  },
  {
    id: "departure",
    chapter: "stacks",
    local: 0.28,
    camera: {
      position: [0.1, 1.2, 9.6],
      target: [0.2, 0.7, 2.6],
      fov: 35,
      mobile: { position: [0.05, 1.25, 11.5], target: [0.15, 0.72, 2.6], fov: 42 }
    },
    world: {
      key: 1.85, env: 0.72, practical: 0.4, table: 0, heroLight: 0.72,
      hazeNear: 7.4, hazeFar: 12.5, ground: "#ddd3c1",
      dust: 0.12, grain: 0.16, exposure: 1.04
    }
  },
  {
    id: "architecture",
    chapter: "stacks",
    local: 0.6,
    camera: {
      position: [-1.4, 1.1, 8.9],
      target: [-1.8, 0.45, 0.8],
      fov: 37,
      mobile: { position: [-1.0, 1.15, 10.7], target: [-1.4, 0.5, 0.8], fov: 44 }
    },
    world: {
      key: 1.6, env: 0.66, practical: 1.1, table: 0, heroLight: 0.18,
      hazeNear: 10, hazeFar: 48, ground: "#4c3b2c",
      dust: 0.5, grain: 0.19, exposure: 0.99
    }
  },
  {
    id: "reveal",
    chapter: "stacks",
    local: 1,
    camera: {
      position: [SHELF.heroSlot.x + 1.25, 0.95, 8.9],
      target: [SHELF.heroSlot.x + 0.9, 0.2, -0.28],
      fov: 39,
      mobile: {
        position: [SHELF.heroSlot.x + 0.7, 1.0, 10.9],
        target: [SHELF.heroSlot.x + 0.5, 0.25, -0.28],
        fov: 46
      }
    },
    world: {
      key: 1.0, env: 0.44, practical: 1.5, table: 0,
      hazeNear: 12, hazeFar: 66, ground: "#251b13",
      dust: 0.82, grain: 0.21, exposure: 0.97
    }
  },
  {
    id: "shelf-open",
    chapter: "selected-works",
    local: 0.16,
    // The traverse is a dolly on rails: straight, level, constant speed, so the
    // collection passes the lens at an even rhythm.
    linear: true,
    camera: {
      position: [SHELF.projectSlots[0].x, 1.38, 6.45],
      target: [SHELF.projectSlots[0].x, 1.16, -0.28],
      fov: 34,
      mobile: {
        position: [SHELF.projectSlots[0].x, 1.42, 8.1],
        target: [SHELF.projectSlots[0].x, 1.2, -0.28],
        fov: 43
      }
    },
    world: {
      key: 0.85, env: 0.42, practical: 1.65, table: 0,
      hazeNear: 13, hazeFar: 72, ground: "#1e150f",
      dust: 0.92, grain: 0.21, exposure: 0.96
    }
  },
  {
    id: "shelf-close",
    chapter: "selected-works",
    local: 1,
    camera: {
      position: [SHELF.emptySlot.x, 1.3, 6.05],
      target: [SHELF.emptySlot.x, 1.08, -0.28],
      fov: 33,
      mobile: { position: [SHELF.emptySlot.x, 1.34, 7.6], target: [SHELF.emptySlot.x, 1.12, -0.28], fov: 42 }
    },
    world: {
      key: 0.85, env: 0.42, practical: 1.65, table: 0,
      hazeNear: 13, hazeFar: 72, ground: "#1e150f",
      dust: 0.92, grain: 0.21, exposure: 0.96
    }
  },
  {
    id: "reading-room",
    chapter: "reading-room",
    local: 1,
    camera: {
      position: [10.6, -1.1, 10.2],
      target: [4.2, -5.4, 1.5],
      fov: 38,
      mobile: { position: [9.4, -0.4, 11.8], target: [4.0, -5.1, 1.5], fov: 45 }
    },
    world: {
      key: 0.72, env: 0.36, practical: 1.1, table: 2.2,
      hazeNear: 10, hazeFar: 54, ground: "#1c1510",
      dust: 0.5, grain: 0.19, exposure: 0.95
    }
  },
  {
    id: "binding",
    chapter: "binding",
    local: 0.52,
    camera: {
      position: [2.3, 1.25, 9.6],
      target: [3.3, 0.48, 2.6],
      fov: 34,
      mobile: { position: [2.9, 1.5, 10.8], target: [3.3, 0.5, 2.6], fov: 42 }
    },
    world: {
      key: 1.5, env: 0.6, practical: 0.8, table: 0.5,
      hazeNear: 9, hazeFar: 30, ground: "#1f1812",
      dust: 0.38, grain: 0.17, exposure: 1.0
    }
  },
  {
    id: "studio",
    chapter: "studio",
    local: 1,
    camera: {
      position: [-7.2, -0.6, 6.0],
      target: [-3.6, -1.9, -0.2],
      fov: 40,
      mobile: { position: [-6.0, -0.3, 7.4], target: [-3.2, -1.7, -0.2], fov: 47 }
    },
    world: {
      // The studio pages step back into daylight. The haze closes right in, so
      // the case dissolves into a parchment field after its first metre and the
      // editorial copy can sit in ink again without a scrim over the room.
      key: 2.3, env: 1.15, practical: 0.35, table: 0.2,
      hazeNear: 3.6, hazeFar: 8.4, ground: "#d3c7b2",
      dust: 0.22, grain: 0.13, exposure: 1.04
    }
  },
  {
    id: "commission",
    chapter: "commission",
    local: 1,
    camera: {
      position: [5.85, -2.55, 7.05],
      target: [4.4, -6.1, 2.9],
      fov: 36,
      mobile: { position: [5.3, -2.2, 7.9], target: [4.4, -6.05, 2.9], fov: 43 }
    },
    world: {
      key: 0.5, env: 0.2, practical: 0.55, table: 2.1,
      hazeNear: 6, hazeFar: 28, ground: "#120c08",
      dust: 0.7, grain: 0.23, exposure: 0.92
    }
  }
];
