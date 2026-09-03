/**
 * Single source of truth for the collection.
 *
 * Adding a volume means adding one entry here. The shelf layout, the 3D books,
 * the cover artwork, the metadata rail, the inspection panel and the no-WebGL
 * edition are all derived from this array. Nothing about a project is hard-wired
 * anywhere else in the scene.
 *
 * book.cloth   binding material family, drives roughness and weave scale
 * book.motif   cover device drawn in foil on the front board
 * book.layout  typographic arrangement of the front board
 */

export const PROJECTS = [
  {
    slug: "assurance-remodeling",
    volume: "01",
    client: "Assurance Remodeling",
    title: "Assurance Remodeling",
    year: "2026",
    industry: "Residential architecture",
    category: "Digital flagship",
    services: ["Art direction", "UX/UI", "Web development", "Motion"],
    technology: ["Vite", "GSAP", "Three.js"],
    premise: "A composed digital home for a renovation practice built on clarity and trust.",
    description:
      "Measured typography, architectural pacing and precise project storytelling turn a complex service into a confident client experience.",
    url: "https://thesitelibrary.com/work/assurance-remodeling",
    palette: { primary: "#2b3427", secondary: "#d6c8ae", foil: "#b7975e", ink: "#efe8d6" },
    book: { width: 1.30, height: 2.34, depth: 0.34, cloth: "linen", motif: "plan", layout: "stacked" }
  },
  {
    slug: "node-jm",
    volume: "02",
    client: "Node JM",
    title: "Node JM",
    year: "2026",
    industry: "Creative technology",
    category: "Identity and platform",
    services: ["Identity", "Digital design", "Development", "Interaction"],
    technology: ["WebGL", "GSAP", "Headless CMS"],
    premise: "A visual system for a studio working where computation meets culture.",
    description:
      "A strict typographic field is interrupted by responsive generative marks, allowing technical work to feel human and authored.",
    url: "https://thesitelibrary.com/work/node-jm",
    palette: { primary: "#191b1d", secondary: "#c7ccd0", foil: "#cdd3d6", ink: "#f2efe7" },
    book: { width: 1.12, height: 2.52, depth: 0.29, cloth: "buckram", motif: "node", layout: "display" }
  },
  {
    slug: "maison-orra",
    volume: "03",
    client: "Maison Orra",
    title: "Maison Orra",
    year: "2025",
    industry: "Hospitality",
    category: "Editorial commerce",
    services: ["Art direction", "Editorial design", "Commerce", "Motion"],
    technology: ["Shopify", "GSAP", "Sanity"],
    premise: "A reservation and commerce experience shaped by the quiet rhythm of a private dining room.",
    description:
      "Photography, menus and objects unfold with an unhurried cadence while booking and purchase actions remain direct.",
    url: "https://thesitelibrary.com/work/maison-orra",
    palette: { primary: "#5b2a2d", secondary: "#d6c4ae", foil: "#c8a271", ink: "#f4ead8" },
    book: { width: 1.42, height: 2.26, depth: 0.38, cloth: "cloth", motif: "arch", layout: "centred" }
  },
  {
    slug: "fieldworks-archive",
    volume: "04",
    client: "Fieldworks Archive",
    title: "Fieldworks Archive",
    year: "2025",
    industry: "Landscape research",
    category: "Digital archive",
    services: ["Information design", "UX/UI", "Development", "Data storytelling"],
    technology: ["Mapbox", "Web Components", "Cloudflare"],
    premise: "A searchable field record that treats landscape research as living evidence.",
    description:
      "Maps, notes, specimens and long-form essays share one disciplined index without flattening the character of the source material.",
    url: "https://thesitelibrary.com/work/fieldworks-archive",
    palette: { primary: "#4a5546", secondary: "#c8c3a7", foil: "#b5a065", ink: "#eeead9" },
    book: { width: 1.36, height: 2.64, depth: 0.32, cloth: "linen", motif: "topography", layout: "stacked" }
  },
  {
    slug: "selene-objects",
    volume: "05",
    client: "Selene Objects",
    title: "Selene Objects",
    year: "2025",
    industry: "Collectible design",
    category: "Digital showroom",
    services: ["Creative direction", "3D direction", "Commerce", "Development"],
    technology: ["Three.js", "Shopify", "GSAP"],
    premise: "A nocturnal showroom for limited furniture and sculptural domestic objects.",
    description:
      "Controlled light and close material studies create a measured sense of discovery without slowing the path to specifications or purchase.",
    url: "https://thesitelibrary.com/work/selene-objects",
    palette: { primary: "#1e2a36", secondary: "#9da7ad", foil: "#c6cbc8", ink: "#eef1ee" },
    book: { width: 1.20, height: 2.42, depth: 0.42, cloth: "buckram", motif: "moon", layout: "centred" }
  },
  {
    slug: "northline-atelier",
    volume: "06",
    client: "Northline Atelier",
    title: "Northline Atelier",
    year: "2024",
    industry: "Architecture",
    category: "Portfolio system",
    services: ["Strategy", "Digital identity", "Web design", "Development"],
    technology: ["Vite", "Contentful", "View Transitions"],
    premise: "A precise project index for an architecture practice defined by material economy.",
    description:
      "The interface borrows its order from drawing sets, then softens that rigour with generous image fields and calm transitions.",
    url: "https://thesitelibrary.com/work/northline-atelier",
    palette: { primary: "#b3aca0", secondary: "#313331", foil: "#6e624f", ink: "#26251f" },
    book: { width: 1.50, height: 2.48, depth: 0.30, cloth: "paper", motif: "section", layout: "display" }
  },
  {
    slug: "morrow-editions",
    volume: "07",
    client: "Morrow Editions",
    title: "Morrow Editions",
    year: "2024",
    industry: "Independent publishing",
    category: "Catalogue and journal",
    services: ["Art direction", "Design system", "Development", "Editorial tools"],
    technology: ["Astro", "Sanity", "GSAP"],
    premise: "A publishing platform that gives each title a distinct room inside one recognisable house.",
    description:
      "Flexible title pages, a disciplined catalogue and considered reading views balance each book's identity with the publisher's own voice.",
    url: "https://thesitelibrary.com/work/morrow-editions",
    palette: { primary: "#7a5b4a", secondary: "#d6c5aa", foil: "#c9a877", ink: "#f3ebdc" },
    book: { width: 1.30, height: 2.20, depth: 0.36, cloth: "cloth", motif: "folio", layout: "stacked" }
  }
];

export const HERO_VOLUME = {
  slug: "the-site-library",
  volume: "I",
  client: "The Site Library",
  title: "The Site Library",
  year: "2026",
  industry: "Digital design studio",
  category: "Collected works",
  services: ["Art direction", "Digital design", "Development", "Motion and 3D"],
  technology: ["Three.js", "GSAP", "Lenis"],
  premise: "Digital editions for distinctive brands.",
  description: "A working index of authored digital identities and web experiences.",
  url: "#commission",
  // Deep oxblood cloth with restrained brass. The frontispiece is a bleached
  // cream field, so the studio's own volume has to be the one dark object in
  // it; a cream binding would dissolve into the room it is standing in.
  palette: { primary: "#4b2025", secondary: "#d9cdb6", foil: "#b58d55", ink: "#f4e9d5" },
  book: { width: 1.46, height: 2.56, depth: 0.40, cloth: "linen", motif: "bookplate", layout: "hero" }
};

/**
 * Shelf layout, derived rather than authored.
 *
 * Volumes are shelved the way volumes actually are: spine out, standing on
 * their tails. What a volume spends along the shelf run is therefore its
 * thickness, not the width of its boards, and the width of its boards becomes
 * the depth it needs inside the case.
 *
 * The row leans because one place at its tail is deliberately empty. Nothing
 * is holding the last volumes upright, so they tip toward the gap in a run
 * that opens up as it goes, resting back on the block of stock at the head of
 * the row. Lean is authored per volume; every position is then solved from it.
 *
 * Two leaning boards stay parallel only while their angles agree. Where the
 * lean opens up between neighbours the pair closes at the top, so the run has
 * to carry that wedge as well as the thickness, or two volumes that look
 * shelved at the board would be inside each other at the head.
 */
export const SHELF = (() => {
  const GAP = 0.03;
  const EMPTY_WIDTH = 0.66;
  // The reserved place does not take focus the instant it becomes the nearest
  // slot. The last bound volume keeps the frame until the lens has travelled
  // decisively into the gap after it.
  const RESERVED_FOCUS_BIAS = 0.55;
  const RADIANS = Math.PI / 180;

  // The whole row also rests back into the case. It is a small angle, but a
  // volume shelved spine out is deep, so the corner it drops is not: without
  // this the standing edge would sit a couple of millimetres inside the board.
  const TILT = 0.035;

  // Where the spines stand. A hand-shelved row is pulled forward to the edge
  // of the board, not pushed to the back of the case.
  const FACE_Z = 0.16;

  // How far along the run the lens aims past the volume it is reading, so the
  // volume that comes out of the shelf sits clear of the metadata column.
  // The compact composition has no side column, so it aims at the volume.
  const AIM = 0.4;
  const AIM_COMPACT = -0.5;

  // Lean in degrees, tipping toward the head of the row. It opens up along the
  // run: the volumes nearest the reserved place have least holding them.
  const LEANS = [1.4, 2.2, 3.3, 2.7, 4.5, 3.9, 5.7, 7.2];

  const row = [HERO_VOLUME, ...PROJECTS].map((project, index) => ({
    lean: LEANS[index % LEANS.length] * RADIANS,
    thickness: project.book.depth,
    height: project.book.height,
    depth: project.book.width
  }));
  // The reserved place stands square: there is nothing in it to lean.
  row.push({ lean: 0, thickness: EMPTY_WIDTH, height: 2.4, depth: 1.34 });

  const slots = [];
  let pivot = 0;
  row.forEach((item, index) => {
    const { lean, thickness, height, depth } = item;
    const run = thickness / Math.cos(lean);
    slots.push({
      // The centre of the volume, solved from the corner that is actually
      // touching the board rather than assumed to be above it.
      x: pivot + (thickness * Math.cos(lean) - height * Math.sin(lean)) / 2,
      // Height of that centre above the shelf: the lowest corner of the box
      // under both the lean and the tilt, which is what is actually standing
      // on the board.
      y: (
        thickness * Math.sin(lean) +
        height * Math.cos(lean) * Math.cos(TILT) +
        depth * Math.cos(lean) * Math.sin(TILT)
      ) / 2,
      z: FACE_Z - depth / 2,
      width: run,
      pivot,
      lean,
      thickness,
      height,
      depth
    });
    const next = row[index + 1];
    const wedge = next
      ? Math.max(0, Math.min(height, next.height) * (Math.tan(next.lean) - Math.tan(lean)))
      : 0;
    pivot += run + GAP + wedge;
  });

  const span = pivot - GAP;
  const shift = -span / 2;
  slots.forEach((slot) => {
    slot.x += shift;
    slot.pivot += shift;
  });

  const heroSlot = slots[0];
  const emptySlot = slots[slots.length - 1];
  const projectSlots = PROJECTS.map((_, index) => slots[index + 1]);
  const firstProjectSlot = projectSlots[0];
  const lastProjectSlot = projectSlots[projectSlots.length - 1];
  // This is the same boundary used to release the final book in the world and
  // to begin fading the selected-works UI. Publishing it here keeps those two
  // events tied to the derived shelf layout when volumes are added or resized.
  const focusReleaseX = (
    emptySlot.x + RESERVED_FOCUS_BIAS * lastProjectSlot.x
  ) / (1 + RESERVED_FOCUS_BIAS);
  const traverseExit = (
    focusReleaseX - firstProjectSlot.x
  ) / (emptySlot.x - firstProjectSlot.x);

  return {
    gap: GAP,
    span,
    faceZ: FACE_Z,
    tilt: TILT,
    aim: AIM,
    aimCompact: AIM_COMPACT,
    heroSlot,
    emptySlot,
    projectSlots,
    focusReleaseX,
    traverseExit,
    all: slots,
    // Standing surface of the shelf board the collection sits on.
    baseY: 0,
    // The widest volume in the collection: what the case has to be able to
    // hold, now that boards run into the shelf rather than across it.
    deepest: Math.max(...row.map((item) => item.depth))
  };
})();
