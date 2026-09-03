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
  // The heaviest chapter in the book. Every volume in the collection has to
  // leave the shelf, turn, be read and go back, so the traverse is paced for
  // dwell on each one rather than for the distance the lens covers.
  { id: "selected-works", number: "03", label: "Selected Works", nav: "Selected Works", weight: 6.5, tone: "dark" },
  { id: "reading-room", number: "04", label: "The Reading Room", nav: "Reading Room", weight: 2.4, tone: "dark" },
  { id: "binding", number: "05", label: "Binding", nav: "Binding", weight: 3.4, tone: "dark" },
  { id: "studio", number: "06", label: "The Studio", nav: "Studio", weight: 2.4, tone: "dark" },
  { id: "commission", number: "07", label: "Commission", nav: "Contact", weight: 2.6, tone: "dark" }
];

/** Where the hero volume floats before it is returned to the collection. */
export const HERO_REST = { x: 0.35, y: 1.0, z: 4.6 };

/** Where the hero volume lies for the closing chapter. The roll is shared with
 * the table dressing so its final footprint can keep real object clearance. */
export const TABLE_REST = { x: 4.4, y: -6.14, z: 2.9, roll: -0.14 };

/** Where the binding sequence takes the volume apart. Right of frame, because
 *  the process copy occupies the left column. */
export const BINDING_REST = { x: 3.3, y: 0.55, z: 2.6 };

/**
 * Where a volume stands once it has been drawn out of the collection.
 *
 * The shelf holds the row spine out, so a volume has to leave the shelf before
 * a reader can see what it is. It comes out along the front of the case, rises
 * clear of the board, drifts to the left of the metadata column, and turns
 * until its front board is square to the lens with just enough of the spine
 * still showing to say what it came off.
 *
 * x      offset along the run from the volume's own slot
 * y      height of the volume's centre above the shelf, the same for every one
 *        of them: a collection presented off a common base would ride up and
 *        down the frame with the height of each binding
 * z      measured from the line the spines stand on, so every volume comes out
 *        to the same mark whatever the depth of its boards
 * yaw    the turn off spine out, short of square, so the binding still reads
 * pitch  head tipped a little away from the lens, the way a held book sits
 * tip    a transient tip out by the head while it is still leaving the shelf
 * arc    how far it rises through the move before it settles
 */
export const PRESENTATION = {
  x: -0.5,
  y: 1.44,
  z: 0.9,
  yaw: 13,
  pitch: -3.5,
  tip: 0.1,
  arc: 0.12
};

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
 * ink         0 sets the page in dark type on a pale ground, 1 in pale type on
 *             a dark one. Authored rather than guessed from the fog colour: a
 *             room can be lit long after its distance haze has gone dark, and
 *             the page has to turn over when the copy stops being readable,
 *             not when the fog says so. The scrim under the copy turns over on
 *             the same value, so ink and plate can never disagree.
 * dust        motes in the shelf light
 * scrim       how far the room is dimmed under the copy, 0 for not at all.
 *             One layer across the whole viewport rather than a plate inside
 *             each chapter: a plate is a box, and a box has edges, so two
 *             sticky chapters sharing the frame at a handover met along a
 *             hard horizontal line and a band of dimmed room read as a strip
 *             laid over the picture. Interpolated every frame like the light
 *             it belongs to, so the room descends into shadow continuously
 *             and there is no step anywhere in the document.
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
      hazeNear: 7.72, hazeFar: 9.78, ground: "#f0ece3", ink: 0,
      scrim: 0, dust: 0, grain: 0.14, exposure: 1.0
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
      key: 1.75, env: 0.86, practical: 1.0, table: 0, heroLight: 0.38,
      // The page turns here, and this is the only place in the document it
      // turns. It happens while the frontispiece is still sliding out of the
      // frame: the room drops into shadow, the copy goes to cream, and there
      // is nothing on screen being read across the change. Every chapter
      // after this one is set in pale type on a dark ground and stays there,
      // so a reader meets one handover and then never sees the page move
      // under them again.
      hazeNear: 7.8, hazeFar: 22, ground: "#5d4b35", ink: 1,
      scrim: 0.55, dust: 0.26, grain: 0.17, exposure: 1.06
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
      key: 1.62, env: 0.9, practical: 1.45, table: 0, heroLight: 0.18,
      hazeNear: 10, hazeFar: 48, ground: "#584535", ink: 1,
      scrim: 0.72, dust: 0.5, grain: 0.19, exposure: 1.05
    }
  },
  {
    id: "reveal",
    chapter: "stacks",
    local: 1,
    camera: {
      position: [SHELF.heroSlot.x + 0.95, 1.15, 8.9],
      target: [SHELF.heroSlot.x + 0.6, 0.7, SHELF.faceZ - 0.5],
      fov: 39,
      mobile: {
        position: [SHELF.heroSlot.x + 0.55, 1.2, 10.9],
        target: [SHELF.heroSlot.x + 0.35, 0.75, SHELF.faceZ - 0.5],
        fov: 46
      }
    },
    world: {
      key: 1.12, env: 0.78, practical: 1.95, table: 0, ink: 1,
      hazeNear: 12, hazeFar: 66, ground: "#3a2a1d",
      scrim: 0.76, dust: 0.82, grain: 0.21, exposure: 1.05
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
      // The lens aims past the slot it is reading, so the volume that comes
      // out of the shelf lands left of the metadata column. The compact
      // composition has no side column, so there it aims at the volume itself.
      position: [SHELF.projectSlots[0].x + SHELF.aim, 1.5, 8.35],
      target: [SHELF.projectSlots[0].x + SHELF.aim, 1.2, SHELF.faceZ - 0.5],
      fov: 34,
      mobile: {
        position: [SHELF.projectSlots[0].x + SHELF.aimCompact, 1.54, 7.5],
        target: [SHELF.projectSlots[0].x + SHELF.aimCompact, 1.24, SHELF.faceZ - 0.5],
        fov: 42
      }
    },
    world: {
      key: 0.98, env: 0.76, practical: 2.15, table: 0, ink: 1,
      hazeNear: 13, hazeFar: 72, ground: "#35271b",
      scrim: 0.78, dust: 0.92, grain: 0.21, exposure: 1.06
    }
  },
  {
    id: "shelf-close",
    chapter: "selected-works",
    local: 1,
    camera: {
      // The same rails, a shade closer: the traverse closes in on the
      // collection as it runs out of volumes to read.
      position: [SHELF.emptySlot.x + SHELF.aim, 1.44, 8.0],
      target: [SHELF.emptySlot.x + SHELF.aim, 1.14, SHELF.faceZ - 0.5],
      fov: 33,
      mobile: {
        position: [SHELF.emptySlot.x + SHELF.aimCompact, 1.48, 7.2],
        target: [SHELF.emptySlot.x + SHELF.aimCompact, 1.18, SHELF.faceZ - 0.5],
        fov: 42
      }
    },
    world: {
      key: 0.98, env: 0.76, practical: 2.15, table: 0, ink: 1,
      hazeNear: 13, hazeFar: 72, ground: "#35271b",
      scrim: 0.78, dust: 0.92, grain: 0.21, exposure: 1.06
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
      key: 0.86, env: 0.68, practical: 1.5, table: 2.5, ink: 1,
      hazeNear: 10, hazeFar: 54, ground: "#33271e",
      scrim: 0.76, dust: 0.5, grain: 0.19, exposure: 1.05
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
      key: 1.52, env: 0.86, practical: 1.15, table: 0.8, ink: 1,
      hazeNear: 9, hazeFar: 30, ground: "#372b21",
      scrim: 0.78, dust: 0.38, grain: 0.17, exposure: 1.07
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
      // The studio steps back, but it does not step back into daylight. The
      // haze still closes right in, so the case dissolves after its first
      // metre and the editorial copy has a quiet field to sit on. That field
      // is the most open the room gets after the frontispiece, which is what
      // makes this chapter read as air; it does it on the light in the room
      // rather than by turning the page over, because turning it here would
      // put a white page under copy the reader is already halfway through.
      key: 1.38, env: 0.8, practical: 0.95, table: 0.9, ink: 1,
      hazeNear: 3.6, hazeFar: 9.4, ground: "#453729",
      scrim: 0.76, dust: 0.3, grain: 0.15, exposure: 1.06
    }
  },
  {
    id: "commission",
    chapter: "commission",
    local: 1,
    camera: {
      // Aimed to the left of the volume rather than at it, so the closing
      // headline has the left of the frame to itself and the book is not read
      // through it. The lens holds the same distance and the same angle.
      position: [4.75, -2.55, 7.05],
      target: [3.3, -6.1, 2.9],
      fov: 36,
      mobile: { position: [5.3, -2.2, 7.9], target: [4.4, -6.05, 2.9], fov: 43 }
    },
    world: {
      key: 0.62, env: 0.46, practical: 0.9, table: 2.4, ink: 1,
      hazeNear: 6, hazeFar: 28, ground: "#241a12",
      scrim: 0.8, dust: 0.7, grain: 0.23, exposure: 1.02
    }
  }
];

/**
 * Local selected-works progress at which the lens has moved beyond the final
 * bound volume and into the reserved place. UI exits must not begin before
 * this boundary, or the index fades while volume 07 is still being read.
 */
const shelfOpen = KEYFRAMES.find((frame) => frame.id === "shelf-open");
const shelfClose = KEYFRAMES.find((frame) => frame.id === "shelf-close");
export const SELECTED_WORKS_EXIT = shelfOpen.local +
  (shelfClose.local - shelfOpen.local) * SHELF.traverseExit;
