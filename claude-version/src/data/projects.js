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
    outcome: "A focused flagship that gives the work room to speak and makes the enquiry path immediate.",
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
    outcome: "A flexible publishing system that holds research, commissions and experiments with equal confidence.",
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
    outcome: "A single digital address for the house, its seasonal table and its small collection of objects.",
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
    outcome: "An expandable archive that serves specialists while inviting the public to explore.",
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
    outcome: "A product experience that makes each release feel considered, scarce and physically present.",
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
    outcome: "A durable portfolio framework that can absorb projects without losing hierarchy or character.",
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
    outcome: "A catalogue designed for discovery, close reading and long-term growth.",
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
  outcome: "Websites worth keeping.",
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
 * Volumes stand shoulder to shoulder in reading order. The Site Library's own
 * volume takes a reserved slot at the head of the row, and one slot is left
 * deliberately empty at the tail: the place the next commission will occupy.
 */
export const SHELF = (() => {
  const GAP = 0.045;
  const HERO_INDEX = 0;
  const EMPTY_WIDTH = 1.34;

  const widths = [];
  widths[HERO_INDEX] = HERO_VOLUME.book.width;
  PROJECTS.forEach((project, index) => {
    widths[index + 1] = project.book.width;
  });
  widths.push(EMPTY_WIDTH);

  const total = widths.reduce((sum, width) => sum + width, 0) + GAP * (widths.length - 1);
  const slots = [];
  let cursor = -total / 2;
  widths.forEach((width) => {
    slots.push({ x: cursor + width / 2, width });
    cursor += width + GAP;
  });

  return {
    gap: GAP,
    span: total,
    heroSlot: slots[HERO_INDEX],
    emptySlot: slots[slots.length - 1],
    projectSlots: PROJECTS.map((_, index) => slots[index + 1]),
    // Standing surface of the shelf board the collection sits on.
    baseY: 0,
    // Book centres sit this far forward of the case back panel.
    restZ: -0.28
  };
})();
