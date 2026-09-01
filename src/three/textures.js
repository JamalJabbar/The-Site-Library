import * as THREE from "three";

/**
 * Every surface in the library is drawn at runtime on a 2D canvas. Nothing is
 * fetched, so the archive has no third-party media dependency and the no-WebGL
 * edition can reuse the very same cover artwork as flat images.
 *
 * Cover boards are painted in two passes. The ink pass lands only on the colour
 * map. The foil pass lands on the colour map *and* on a mask, and that mask
 * becomes the metalness and roughness channels of a packed ORM texture. The
 * result is that foil is genuinely metallic: it reflects the environment and
 * catches the key light as the book turns, instead of faking a glow.
 */

const registry = new Set();

/**
 * Binding cloth. A 13 cm board carries something like sixty threads across, so
 * the weave has to tile hard or it reads as sacking rather than book cloth.
 */
const CLOTH = {
  linen: { normal: 0.2, roughness: 0.86, weave: 0.34 },
  buckram: { normal: 0.26, roughness: 0.8, weave: 0.44 },
  cloth: { normal: 0.17, roughness: 0.82, weave: 0.28 },
  paper: { normal: 0.07, roughness: 0.72, weave: 0.1 }
};

export function clothProfile(name) {
  return CLOTH[name] || CLOTH.cloth;
}

function seeded(seed = 1) {
  let value = (seed >>> 0) || 1;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    value >>>= 0;
    return value / 4294967296;
  };
}

function canvasOf(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function register(canvas, { srgb = true, repeat = false, mirror = false, anisotropy = 8 } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = anisotropy;
  // Mirrored wrapping guarantees edge continuity, so a procedural surface never
  // has to be perfectly seamless to tile across a large plane.
  const wrap = mirror
    ? THREE.MirroredRepeatWrapping
    : repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.wrapS = wrap;
  texture.wrapT = wrap;
  texture.needsUpdate = true;
  registry.add(texture);
  return texture;
}

function registerExternal(texture) {
  registry.add(texture);
  return texture;
}

function rgb(hex) {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function shade(hex, amount) {
  const [r, g, b] = rgb(hex);
  const target = amount > 0 ? 255 : 0;
  const a = Math.abs(amount);
  const mix = (channel) => Math.round(channel + (target - channel) * a);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

/** Draws text with true letter tracking, which canvas does not offer portably. */
function tracked(context, text, x, y, tracking, align = "center") {
  const characters = [...text];
  const widths = characters.map((character) => context.measureText(character).width);
  const total = widths.reduce((sum, width) => sum + width, 0) + tracking * (characters.length - 1);
  let cursor = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  const baseline = context.textAlign;
  context.textAlign = "left";
  characters.forEach((character, index) => {
    context.fillText(character, cursor, y);
    cursor += widths[index] + tracking;
  });
  context.textAlign = baseline;
  return total;
}

function serif(size, weight = 500, italic = false) {
  return `${italic ? "italic " : ""}${weight} ${size}px "Bodoni Moda Variable", "Bodoni Moda", Georgia, serif`;
}

function grotesk(size, weight = 600) {
  return `${weight} ${size}px "Manrope Variable", Manrope, "Helvetica Neue", Arial, sans-serif`;
}

/* ------------------------------------------------------------------ *
 * Shared surface maps
 * ------------------------------------------------------------------ */

function weaveNormal() {
  const size = 256;
  const canvas = canvasOf(size, size);
  const context = canvas.getContext("2d");
  const image = context.createImageData(size, size);
  const random = seeded(0x51f3);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      // Interleaved warp and weft, offset every other thread so the weave reads
      // as fabric rather than a grid.
      const warpPhase = Math.sin((x + (Math.floor(y / 4) % 2) * 2) * 0.7854);
      const weftPhase = Math.sin((y + (Math.floor(x / 4) % 2) * 2) * 0.7854);
      const fibre = (random() - 0.5) * 10;
      image.data[index] = THREE.MathUtils.clamp(128 + warpPhase * 34 + fibre, 0, 255);
      image.data[index + 1] = THREE.MathUtils.clamp(128 + weftPhase * 34 + fibre, 0, 255);
      image.data[index + 2] = 236;
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return register(canvas, { srgb: false, repeat: true, anisotropy: 4 });
}

function pageEdge() {
  const canvas = canvasOf(256, 256);
  const context = canvas.getContext("2d");
  const random = seeded(0x2ad9);
  context.fillStyle = "#e3d9c6";
  context.fillRect(0, 0, 256, 256);
  // Leaf edges: irregular vertical striations of slightly different creams.
  for (let x = 0; x < 256; x += 1) {
    const tone = 208 + Math.floor(random() * 40);
    context.fillStyle = `rgba(${tone}, ${tone - 8}, ${tone - 24}, ${0.25 + random() * 0.5})`;
    context.fillRect(x, 0, 1, 256);
    if (random() > 0.86) {
      context.fillStyle = `rgba(126, 106, 78, ${0.1 + random() * 0.16})`;
      context.fillRect(x, 0, 1, 256);
    }
  }
  return register(canvas, { srgb: true, repeat: true });
}

function paperGrain() {
  const canvas = canvasOf(256, 256);
  const context = canvas.getContext("2d");
  const random = seeded(0x7c11);
  context.fillStyle = "#ddd3c0";
  context.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5200; i += 1) {
    context.fillStyle = `rgba(96, 82, 60, ${random() * 0.045})`;
    context.fillRect(random() * 256, random() * 256, 1, 1);
  }
  return register(canvas, { srgb: true, repeat: true });
}

function walnut() {
  const size = 512;
  const canvas = canvasOf(size, size);
  const context = canvas.getContext("2d");
  const random = seeded(0x9e3b);

  // Flat ground, no corner-to-corner gradient: a tiled diagonal ramp puts a
  // hard value step at every tile seam, which reads as a patchwork across
  // anything as large as a table top.
  context.fillStyle = "#3d2819";
  context.fillRect(0, 0, size, size);

  // Quarter-sawn grain: mostly straight lines with a slow cathedral sweep.
  for (let i = 0; i < 240; i += 1) {
    const y = random() * size;
    const amplitude = 4 + random() * 26;
    context.beginPath();
    context.moveTo(-10, y);
    context.bezierCurveTo(size * 0.3, y + amplitude, size * 0.7, y - amplitude, size + 10, y + (random() - 0.5) * 8);
    const tone = 24 + random() * 40;
    context.strokeStyle = `rgba(${tone}, ${tone * 0.62}, ${tone * 0.4}, ${0.14 + random() * 0.3})`;
    context.lineWidth = 0.4 + random() * 2.1;
    context.stroke();
  }
  for (let i = 0; i < 900; i += 1) {
    context.fillStyle = `rgba(20, 12, 7, ${random() * 0.2})`;
    context.fillRect(random() * size, random() * size, 1, 1 + random() * 3);
  }
  return register(canvas, { srgb: true, mirror: true, anisotropy: 12 });
}

function plaster() {
  const size = 256;
  const canvas = canvasOf(size, size);
  const context = canvas.getContext("2d");
  const random = seeded(0x3311);
  context.fillStyle = "#a3968a";
  context.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i += 1) {
    const radius = 6 + random() * 30;
    context.beginPath();
    context.arc(random() * size, random() * size, radius, 0, Math.PI * 2);
    context.fillStyle = random() > 0.5
      ? `rgba(255, 250, 240, ${random() * 0.05})`
      : `rgba(46, 36, 28, ${random() * 0.05})`;
    context.fill();
  }
  return register(canvas, { srgb: true, mirror: true });
}

function contactShadow() {
  const canvas = canvasOf(256, 256);
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(128, 128, 4, 128, 128, 126);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.92)");
  gradient.addColorStop(0.32, "rgba(0, 0, 0, 0.52)");
  gradient.addColorStop(0.68, "rgba(0, 0, 0, 0.14)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  return register(canvas, { srgb: false });
}

let surfaces = null;
export function createSurfaceMaps() {
  if (surfaces) return surfaces;
  const weave = weaveNormal();
  // Tiled tightly enough that the threads read as texture, not as a grid.
  weave.repeat.set(11, 16);
  // A spine's UV runs the short way around the arc, so it needs its own
  // tiling or the same weave stretches into horizontal banding.
  const spineWeave = weave.clone();
  spineWeave.repeat.set(2, 16);
  spineWeave.needsUpdate = true;
  registerExternal(spineWeave);
  surfaces = {
    weave,
    spineWeave,
    pageEdge: pageEdge(),
    paper: paperGrain(),
    walnut: walnut(),
    plaster: plaster(),
    shadow: contactShadow()
  };
  return surfaces;
}

/* ------------------------------------------------------------------ *
 * Cover artwork
 * ------------------------------------------------------------------ */

/** Runs one drawing routine across the colour map and the foil mask together. */
function foilPass(colour, mask, foilColour, draw) {
  colour.save();
  mask.save();
  colour.fillStyle = foilColour;
  colour.strokeStyle = foilColour;
  mask.fillStyle = "#ffffff";
  mask.strokeStyle = "#ffffff";
  draw(colour);
  draw(mask);
  colour.restore();
  mask.restore();
}

function clothGround(context, project, width, height, seed) {
  const random = seeded(seed);
  context.fillStyle = project.palette.primary;
  context.fillRect(0, 0, width, height);

  const profile = clothProfile(project.book.cloth);
  // Woven tone break at thread scale, so the flat fill never reads as plastic.
  for (let y = 0; y < height; y += 2) {
    context.fillStyle = `rgba(255, 255, 255, ${0.02 * profile.weave})`;
    context.fillRect(0, y, width, 1);
  }
  for (let x = 0; x < width; x += 2) {
    context.fillStyle = `rgba(0, 0, 0, ${0.028 * profile.weave})`;
    context.fillRect(x, 0, 1, height);
  }
  for (let i = 0; i < 2600; i += 1) {
    const alpha = 0.014 + random() * 0.03;
    context.fillStyle = random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    context.fillRect(random() * width, random() * height, 1, 1 + random() * 3);
  }
  // Board edges catch a little more light than the centre of the panel.
  const vignette = context.createRadialGradient(
    width * 0.5, height * 0.44, width * 0.1,
    width * 0.5, height * 0.5, height * 0.72
  );
  vignette.addColorStop(0, "rgba(255,255,255,0.05)");
  vignette.addColorStop(1, "rgba(0,0,0,0.16)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);
}

function motif(context, name, width, height, cx, cy, scale) {
  const unit = width * scale;
  context.lineWidth = Math.max(1.4, width * 0.0055);
  context.lineJoin = "round";

  if (name === "plan") {
    // Stacked floor bands with a circulation spine.
    for (let i = -2; i <= 2; i += 1) {
      context.strokeRect(cx - unit * 0.9, cy + i * unit * 0.34 - unit * 0.09, unit * 1.8, unit * 0.18);
    }
    context.beginPath();
    context.moveTo(cx, cy - unit * 0.92);
    context.lineTo(cx, cy + unit * 0.92);
    context.stroke();
  } else if (name === "section") {
    context.strokeRect(cx - unit, cy - unit * 0.62, unit * 2, unit * 1.24);
    context.beginPath();
    context.moveTo(cx - unit, cy - unit * 0.62);
    context.lineTo(cx, cy - unit * 1.1);
    context.lineTo(cx + unit, cy - unit * 0.62);
    context.stroke();
    for (let i = 1; i < 4; i += 1) {
      context.beginPath();
      context.moveTo(cx - unit, cy - unit * 0.62 + (i * unit * 1.24) / 4);
      context.lineTo(cx + unit, cy - unit * 0.62 + (i * unit * 1.24) / 4);
      context.stroke();
    }
  } else if (name === "node") {
    const points = [[-0.82, -0.3], [0.16, -0.86], [0.9, 0.2], [-0.3, 0.88]];
    context.beginPath();
    points.forEach(([px, py], index) => {
      const x = cx + px * unit;
      const y = cy + py * unit;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.closePath();
    context.stroke();
    context.beginPath();
    context.moveTo(cx + points[0][0] * unit, cy + points[0][1] * unit);
    context.lineTo(cx + points[2][0] * unit, cy + points[2][1] * unit);
    context.stroke();
    points.forEach(([px, py]) => {
      context.beginPath();
      context.arc(cx + px * unit, cy + py * unit, unit * 0.075, 0, Math.PI * 2);
      context.fill();
    });
  } else if (name === "arch") {
    context.beginPath();
    context.moveTo(cx - unit * 0.86, cy + unit * 0.95);
    context.lineTo(cx - unit * 0.86, cy - unit * 0.12);
    context.arc(cx, cy - unit * 0.12, unit * 0.86, Math.PI, 0);
    context.lineTo(cx + unit * 0.86, cy + unit * 0.95);
    context.stroke();
    context.beginPath();
    context.moveTo(cx - unit * 0.4, cy + unit * 0.95);
    context.lineTo(cx - unit * 0.4, cy - unit * 0.1);
    context.arc(cx, cy - unit * 0.1, unit * 0.4, Math.PI, 0);
    context.lineTo(cx + unit * 0.4, cy + unit * 0.95);
    context.stroke();
  } else if (name === "topography") {
    for (let i = 0; i < 8; i += 1) {
      const factor = 0.16 + i * 0.115;
      context.beginPath();
      context.ellipse(
        cx + Math.sin(i * 1.1) * unit * 0.08,
        cy + Math.cos(i * 0.7) * unit * 0.05,
        unit * factor,
        unit * factor * 0.66,
        -0.34, 0, Math.PI * 2
      );
      context.stroke();
    }
  } else if (name === "moon") {
    context.beginPath();
    context.arc(cx, cy, unit * 0.86, 0, Math.PI * 2);
    context.stroke();
    context.save();
    context.beginPath();
    context.arc(cx, cy, unit * 0.86, 0, Math.PI * 2);
    context.clip();
    context.globalAlpha = 0.55;
    context.beginPath();
    context.arc(cx + unit * 0.42, cy - unit * 0.16, unit * 0.86, 0, Math.PI * 2);
    context.fill();
    context.restore();
  } else if (name === "folio") {
    const line = unit * 0.2;
    for (let i = 0; i < 7; i += 1) {
      const w = unit * (1.7 - (i % 3) * 0.35);
      context.fillRect(cx - unit * 0.9, cy - line * 3.2 + i * line, w, Math.max(1.4, unit * 0.028));
    }
  } else if (name === "bookplate") {
    context.strokeRect(cx - unit * 0.98, cy - unit * 0.72, unit * 1.96, unit * 1.44);
    context.strokeRect(cx - unit * 0.86, cy - unit * 0.6, unit * 1.72, unit * 1.2);
    context.beginPath();
    context.moveTo(cx - unit * 0.4, cy + unit * 0.86);
    context.lineTo(cx + unit * 0.4, cy + unit * 0.86);
    context.stroke();
  }
}

function frontBoard(project, hero) {
  const width = hero ? 768 : 640;
  const height = hero ? 1332 : 1120;
  const colourCanvas = canvasOf(width, height);
  const maskCanvas = canvasOf(width, height);
  const colour = colourCanvas.getContext("2d");
  const mask = maskCanvas.getContext("2d");

  mask.fillStyle = "#000000";
  mask.fillRect(0, 0, width, height);
  clothGround(colour, project, width, height, project.slug.length * 9173 + 41);

  const inset = width * 0.085;
  const foil = project.palette.foil;

  foilPass(colour, mask, foil, (context) => {
    context.lineWidth = Math.max(1.6, width * 0.0042);
    context.strokeRect(inset, inset * 0.86, width - inset * 2, height - inset * 1.72);
  });

  const layout = project.book.layout;
  const centreY = layout === "display" ? height * 0.3 : layout === "hero" ? height * 0.28 : height * 0.36;

  foilPass(colour, mask, foil, (context) => {
    motif(context, project.book.motif, width, height, width * 0.5, centreY, layout === "display" ? 0.13 : 0.17);
  });

  foilPass(colour, mask, foil, (context) => {
    context.font = grotesk(width * 0.03, 600);
    context.textBaseline = "middle";
    tracked(context, hero ? "VOLUME I" : `VOLUME ${project.volume}`, width * 0.5, inset * 2.1, width * 0.017);
  });

  colour.fillStyle = project.palette.ink;
  colour.textBaseline = "middle";
  colour.textAlign = "center";

  if (layout === "hero") {
    const size = width * 0.148;
    colour.font = serif(size, 500);
    ["THE", "SITE", "LIBRARY"].forEach((line, index) => {
      tracked(colour, line, width * 0.5, height * (0.47 + index * 0.098), width * 0.004);
    });
    colour.font = grotesk(width * 0.027, 500);
    colour.globalAlpha = 0.82;
    tracked(colour, "DIGITAL EDITIONS", width * 0.5, height * 0.8, width * 0.016);
    tracked(colour, "FOR DISTINCTIVE BRANDS", width * 0.5, height * 0.838, width * 0.016);
    colour.globalAlpha = 1;
  } else {
    const words = project.title.toUpperCase().split(" ");
    const lines = words.length > 1 ? [words[0], words.slice(1).join(" ")] : words;
    const maxSize = layout === "display" ? width * 0.16 : width * 0.115;
    let size = maxSize;
    for (; size > 26; size -= 2) {
      colour.font = serif(size, 500);
      const widest = Math.max(...lines.map((line) => colour.measureText(line).width + size * 0.03 * (line.length - 1)));
      if (widest <= width * 0.74) break;
    }
    colour.font = serif(size, 500);
    const blockTop = layout === "display" ? height * 0.5 : height * 0.615;
    lines.forEach((line, index) => {
      tracked(colour, line, width * 0.5, blockTop + index * size * 1.02, size * 0.03);
    });

    colour.font = grotesk(width * 0.026, 500);
    colour.globalAlpha = 0.78;
    tracked(colour, project.category.toUpperCase(), width * 0.5, height * 0.845, width * 0.016);
    tracked(colour, project.year, width * 0.5, height * 0.882, width * 0.018);
    colour.globalAlpha = 1;
  }

  foilPass(colour, mask, foil, (context) => {
    context.fillRect(width * 0.44, height * 0.905, width * 0.12, Math.max(1.4, width * 0.0034));
  });

  return { colour: colourCanvas, mask: maskCanvas, width, height };
}

function spineBoard(project, hero) {
  const width = hero ? 176 : 152;
  const height = hero ? 1332 : 1120;
  const colourCanvas = canvasOf(width, height);
  const maskCanvas = canvasOf(width, height);
  const colour = colourCanvas.getContext("2d");
  const mask = maskCanvas.getContext("2d");

  mask.fillStyle = "#000000";
  mask.fillRect(0, 0, width, height);
  clothGround(colour, project, width, height, project.slug.length * 5501 + 7);

  // A spine is curved, so it always carries a lit crown and shaded shoulders.
  const roll = colour.createLinearGradient(0, 0, width, 0);
  roll.addColorStop(0, "rgba(0,0,0,0.34)");
  roll.addColorStop(0.42, "rgba(255,255,255,0.09)");
  roll.addColorStop(1, "rgba(0,0,0,0.34)");
  colour.fillStyle = roll;
  colour.fillRect(0, 0, width, height);

  const foil = project.palette.foil;
  foilPass(colour, mask, foil, (context) => {
    context.lineWidth = Math.max(1.2, width * 0.014);
    context.beginPath();
    context.moveTo(width * 0.22, height * 0.09);
    context.lineTo(width * 0.78, height * 0.09);
    context.moveTo(width * 0.22, height * 0.915);
    context.lineTo(width * 0.78, height * 0.915);
    context.stroke();
  });

  colour.save();
  mask.save();
  [colour, mask].forEach((context) => {
    context.translate(width * 0.5, height * 0.5);
    context.rotate(Math.PI / 2);
    context.textBaseline = "middle";
  });
  colour.fillStyle = project.palette.ink;
  colour.font = serif(hero ? 60 : 52, 500);
  tracked(colour, project.title.toUpperCase(), -height * 0.06, 0, 3.4);

  foilPass(colour, mask, foil, (context) => {
    context.font = grotesk(hero ? 30 : 27, 600);
    tracked(context, hero ? "VOL. I" : `VOL. ${project.volume}`, height * 0.36, 0, 3);
  });
  colour.restore();
  mask.restore();

  return { colour: colourCanvas, mask: maskCanvas, width, height };
}

function backBoard(project, hero) {
  const width = hero ? 768 : 640;
  const height = hero ? 1332 : 1120;
  const canvas = canvasOf(width, height);
  const context = canvas.getContext("2d");
  clothGround(context, project, width, height, project.slug.length * 3313 + 19);

  const inset = width * 0.085;
  context.strokeStyle = project.palette.foil;
  context.globalAlpha = 0.34;
  context.lineWidth = Math.max(1.2, width * 0.003);
  context.strokeRect(inset, inset * 0.86, width - inset * 2, height - inset * 1.72);
  context.globalAlpha = 1;

  // Back boards carry the blurb, never a mirrored front cover.
  context.fillStyle = project.palette.ink;
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.font = serif(width * 0.052, 450);
  const words = project.premise.split(" ");
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const trial = line ? `${line} ${word}` : word;
    if (context.measureText(trial).width > width * 0.66 && line) {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  });
  lines.push(line);
  lines.slice(0, 6).forEach((text, index) => {
    context.fillText(text, width * 0.17, height * (0.29 + index * 0.062));
  });

  context.globalAlpha = 0.66;
  context.font = grotesk(width * 0.019, 500);
  tracked(context, "THE SITE LIBRARY", width * 0.17, height * 0.79, width * 0.013, "left");
  tracked(context, `VOLUME ${project.volume}  /  ${project.year}`, width * 0.17, height * 0.822, width * 0.013, "left");
  context.globalAlpha = 1;

  return canvas;
}

/**
 * Packs the foil mask into an ORM texture.
 * R = ambient occlusion, G = roughness, B = metalness.
 */
function packORM(mask, project, scale = 0.5) {
  const width = Math.max(2, Math.round(mask.width * scale));
  const height = Math.max(2, Math.round(mask.height * scale));
  const canvas = canvasOf(width, height);
  const context = canvas.getContext("2d");
  context.drawImage(mask, 0, 0, width, height);
  const image = context.getImageData(0, 0, width, height);
  const profile = clothProfile(project.book.cloth);
  const clothRough = Math.round(profile.roughness * 255);
  const foilRough = 78;

  for (let i = 0; i < image.data.length; i += 4) {
    const foil = image.data[i] / 255;
    image.data[i] = 255;
    image.data[i + 1] = Math.round(clothRough + (foilRough - clothRough) * foil);
    image.data[i + 2] = Math.round(foil * 242);
    image.data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return register(canvas, { srgb: false, anisotropy: 4 });
}

export function createBookArtwork(project, hero = false) {
  const front = frontBoard(project, hero);
  const spine = spineBoard(project, hero);
  return {
    front: register(front.colour),
    frontORM: packORM(front.mask, project),
    spine: register(spine.colour),
    spineORM: packORM(spine.mask, project, 0.6),
    back: register(backBoard(project, hero)),
    // Kept for the no-WebGL edition, which renders the boards as flat images.
    frontCanvas: front.colour
  };
}

/** Front board as a data URL, for the static edition and social imagery. */
export function coverDataURL(project, hero = false) {
  return frontBoard(project, hero).colour.toDataURL("image/webp", 0.86);
}

export function disposeTextures() {
  registry.forEach((texture) => texture.dispose());
  registry.clear();
  surfaces = null;
}
