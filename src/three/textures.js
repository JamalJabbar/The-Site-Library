import * as THREE from "three";

const textureRegistry = new Set();

function seededRandom(seed = 1) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function registerTexture(canvas, { color = true, repeat = false } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = color ? 4 : 1;
  texture.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  textureRegistry.add(texture);
  return texture;
}

function hexToRgb(hex) {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function mix(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const target = amount > 0 ? 255 : 0;
  const alpha = Math.abs(amount);
  const channel = (value) => Math.round(value + (target - value) * alpha);
  return `rgb(${channel(r)} ${channel(g)} ${channel(b)})`;
}

export function createSurfaceMaps() {
  const size = 256;
  const random = seededRandom(71024);
  const normalCanvas = makeCanvas(size, size);
  const normal = normalCanvas.getContext("2d");
  const normalData = normal.createImageData(size, size);
  const roughCanvas = makeCanvas(size, size);
  const rough = roughCanvas.getContext("2d");
  const roughData = rough.createImageData(size, size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const warp = Math.sin(x * 0.72) * 4.5;
      const weft = Math.sin(y * 0.66) * 4.5;
      const noise = (random() - 0.5) * 6;
      normalData.data[index] = 128 + warp + noise;
      normalData.data[index + 1] = 128 + weft + noise;
      normalData.data[index + 2] = 248;
      normalData.data[index + 3] = 255;

      const value = Math.round(213 + warp * 0.45 + weft * 0.45 + noise);
      roughData.data[index] = value;
      roughData.data[index + 1] = value;
      roughData.data[index + 2] = value;
      roughData.data[index + 3] = 255;
    }
  }

  normal.putImageData(normalData, 0, 0);
  rough.putImageData(roughData, 0, 0);

  const paperCanvas = makeCanvas(256, 256);
  const paper = paperCanvas.getContext("2d");
  paper.fillStyle = "#ddd4c3";
  paper.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    const shade = 194 + Math.floor(random() * 36);
    paper.fillStyle = `rgba(${shade}, ${shade - 5}, ${shade - 14}, ${0.1 + random() * 0.18})`;
    paper.fillRect(0, y, 256, 1);
  }
  for (let i = 0; i < 540; i += 1) {
    paper.fillStyle = `rgba(80, 66, 48, ${random() * 0.035})`;
    paper.fillRect(random() * 256, random() * 256, 1, 1);
  }

  const woodCanvas = makeCanvas(512, 512);
  const wood = woodCanvas.getContext("2d");
  const gradient = wood.createLinearGradient(0, 0, 512, 512);
  gradient.addColorStop(0, "#201610");
  gradient.addColorStop(0.45, "#38241a");
  gradient.addColorStop(1, "#1a110d");
  wood.fillStyle = gradient;
  wood.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 180; i += 1) {
    const y = random() * 512;
    const sway = random() * 22;
    wood.beginPath();
    wood.moveTo(-20, y);
    wood.bezierCurveTo(140, y + sway, 350, y - sway, 532, y + random() * 8);
    wood.strokeStyle = `rgba(${22 + random() * 34}, ${12 + random() * 20}, ${8 + random() * 15}, ${0.12 + random() * 0.25})`;
    wood.lineWidth = 0.5 + random() * 1.8;
    wood.stroke();
  }

  return {
    clothNormal: registerTexture(normalCanvas, { color: false, repeat: true }),
    clothRoughness: registerTexture(roughCanvas, { color: false, repeat: true }),
    paper: registerTexture(paperCanvas, { color: true, repeat: true }),
    wood: registerTexture(woodCanvas, { color: true, repeat: true })
  };
}

function drawMotif(context, project, width, height, color) {
  const { motif } = project.book;
  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.globalAlpha = 0.34;
  context.lineWidth = Math.max(1, width * 0.004);
  const cx = width * 0.5;
  const cy = height * 0.38;

  if (motif === "plan" || motif === "section") {
    const unit = width * 0.09;
    for (let index = -2; index <= 2; index += 1) {
      context.strokeRect(cx - unit * 2.2, cy + index * unit * 0.72, unit * 4.4, unit * 0.5);
    }
    context.beginPath();
    context.moveTo(cx - unit * 1.2, cy - unit * 2);
    context.lineTo(cx - unit * 1.2, cy + unit * 2);
    context.moveTo(cx + unit * 1.2, cy - unit * 2);
    context.lineTo(cx + unit * 1.2, cy + unit * 2);
    context.stroke();
  } else if (motif === "node") {
    const points = [[-0.24, -0.08], [0.05, -0.24], [0.27, 0.06], [-0.09, 0.26]];
    context.beginPath();
    points.forEach(([x, y], index) => {
      const px = cx + x * width;
      const py = cy + y * width;
      if (index === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    });
    context.closePath();
    context.stroke();
    points.forEach(([x, y]) => {
      context.beginPath();
      context.arc(cx + x * width, cy + y * width, width * 0.018, 0, Math.PI * 2);
      context.fill();
    });
  } else if (motif === "arch") {
    context.beginPath();
    context.moveTo(width * 0.27, height * 0.58);
    context.lineTo(width * 0.27, height * 0.34);
    context.arc(cx, height * 0.34, width * 0.23, Math.PI, 0);
    context.lineTo(width * 0.73, height * 0.58);
    context.stroke();
    context.strokeRect(width * 0.36, height * 0.43, width * 0.28, height * 0.15);
  } else if (motif === "topography") {
    for (let index = 0; index < 7; index += 1) {
      context.beginPath();
      context.ellipse(cx, cy, width * (0.11 + index * 0.035), width * (0.07 + index * 0.024), -0.35, 0, Math.PI * 2);
      context.stroke();
    }
  } else if (motif === "moon") {
    context.beginPath();
    context.arc(cx, cy, width * 0.22, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.arc(cx + width * 0.075, cy - width * 0.02, width * 0.2, 0, Math.PI * 2);
    context.stroke();
  } else if (motif === "folio") {
    const lineHeight = height * 0.035;
    for (let index = 0; index < 8; index += 1) {
      context.fillRect(width * 0.25, cy - lineHeight * 3.5 + index * lineHeight, width * (0.5 - (index % 3) * 0.08), 1.5);
    }
  } else {
    context.strokeRect(width * 0.22, height * 0.22, width * 0.56, height * 0.34);
    context.strokeRect(width * 0.27, height * 0.27, width * 0.46, height * 0.24);
  }
  context.restore();
}

function fitTitle(context, title, maxWidth, startSize) {
  let size = startSize;
  do {
    context.font = `500 ${size}px "Bodoni Moda Variable", Georgia, serif`;
    if (context.measureText(title).width <= maxWidth) return size;
    size -= 2;
  } while (size > 30);
  return size;
}

function createFront(project, hero) {
  const width = hero ? 768 : 512;
  const height = hero ? 1280 : 860;
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext("2d");
  const random = seededRandom(project.title.length * 913);
  context.fillStyle = project.palette.primary;
  context.fillRect(0, 0, width, height);

  for (let index = 0; index < 1800; index += 1) {
    const alpha = 0.012 + random() * 0.025;
    context.fillStyle = random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(10,7,4,${alpha})`;
    context.fillRect(random() * width, random() * height, 1, 2 + random() * 5);
  }

  const inset = width * 0.078;
  context.strokeStyle = project.palette.foil;
  context.globalAlpha = 0.55;
  context.lineWidth = Math.max(1.5, width * 0.003);
  context.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
  drawMotif(context, project, width, height, project.palette.foil);
  context.globalAlpha = 1;

  context.fillStyle = project.palette.ink;
  context.textAlign = "center";
  context.textBaseline = "middle";
  if (hero) {
    context.font = `500 ${width * 0.13}px "Bodoni Moda Variable", Georgia, serif`;
    ["THE", "SITE", "LIBRARY"].forEach((line, index) => {
      context.fillText(line, width * 0.5, height * (0.33 + index * 0.105));
    });
    context.font = `600 ${width * 0.021}px "Manrope Variable", sans-serif`;
    context.letterSpacing = `${width * 0.008}px`;
    context.fillText("DIGITAL EDITIONS", width * 0.5, height * 0.71);
    context.fillText("FOR DISTINCTIVE BRANDS", width * 0.5, height * 0.745);
  } else {
    const titleSize = fitTitle(context, project.title.toUpperCase(), width * 0.72, width * 0.092);
    context.font = `500 ${titleSize}px "Bodoni Moda Variable", Georgia, serif`;
    const words = project.title.toUpperCase().split(" ");
    if (words.length > 1) {
      const halfway = Math.ceil(words.length / 2);
      context.fillText(words.slice(0, halfway).join(" "), width * 0.5, height * 0.68);
      context.fillText(words.slice(halfway).join(" "), width * 0.5, height * 0.755);
    } else {
      context.fillText(project.title.toUpperCase(), width * 0.5, height * 0.72);
    }
    context.font = `600 ${width * 0.022}px "Manrope Variable", sans-serif`;
    context.fillText(`${project.category.toUpperCase()}  ${project.year}`, width * 0.5, height * 0.86);
  }

  return registerTexture(canvas);
}

function createSpine(project, hero) {
  const width = hero ? 240 : 160;
  const height = hero ? 1280 : 860;
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext("2d");
  context.fillStyle = mix(project.palette.primary, -0.09);
  context.fillRect(0, 0, width, height);
  context.strokeStyle = project.palette.foil;
  context.globalAlpha = 0.65;
  context.strokeRect(width * 0.16, height * 0.04, width * 0.68, height * 0.92);
  context.globalAlpha = 1;
  context.translate(width * 0.5, height * 0.5);
  context.rotate(Math.PI / 2);
  context.fillStyle = project.palette.ink;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `500 ${hero ? 48 : 34}px "Bodoni Moda Variable", Georgia, serif`;
  context.fillText(`${project.title.toUpperCase()}  /  VOL. ${project.volume}`, 0, 0);
  return registerTexture(canvas);
}

function createBack(project, hero) {
  const width = hero ? 768 : 512;
  const height = hero ? 1280 : 860;
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext("2d");
  context.fillStyle = project.palette.primary;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = project.palette.foil;
  context.globalAlpha = 0.45;
  context.strokeRect(width * 0.08, height * 0.05, width * 0.84, height * 0.9);
  context.globalAlpha = 1;
  context.fillStyle = project.palette.ink;
  context.textAlign = "left";
  context.font = `500 ${width * 0.047}px "Bodoni Moda Variable", Georgia, serif`;
  const words = project.premise.split(" ");
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const trial = `${line} ${word}`.trim();
    if (context.measureText(trial).width > width * 0.69 && line) {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  });
  lines.push(line);
  lines.slice(0, 5).forEach((text, index) => {
    context.fillText(text, width * 0.16, height * (0.2 + index * 0.06));
  });
  context.font = `600 ${width * 0.02}px "Manrope Variable", sans-serif`;
  context.fillText("THE SITE LIBRARY", width * 0.16, height * 0.82);
  context.fillText(`VOLUME ${project.volume}  ${project.year}`, width * 0.16, height * 0.855);
  return registerTexture(canvas);
}

function createFoil(project, hero) {
  const width = hero ? 768 : 512;
  const height = hero ? 1280 : 860;
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, width, height);
  context.strokeStyle = "white";
  context.fillStyle = "white";
  context.globalAlpha = 0.92;
  context.lineWidth = Math.max(2, width * 0.004);
  context.strokeRect(width * 0.078, height * 0.047, width * 0.844, height * 0.906);
  context.textAlign = "center";
  context.font = `600 ${width * 0.025}px "Manrope Variable", sans-serif`;
  context.fillText(hero ? "VOL. I" : `VOL. ${project.volume}`, width * 0.5, height * 0.12);
  context.fillRect(width * 0.42, height * 0.145, width * 0.16, Math.max(2, width * 0.004));
  return registerTexture(canvas, { color: true });
}

export function createBookArtwork(project, hero = false) {
  return {
    front: createFront(project, hero),
    spine: createSpine(project, hero),
    back: createBack(project, hero),
    foil: createFoil(project, hero)
  };
}

export function createContactShadowTexture() {
  const canvas = makeCanvas(256, 256);
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(128, 128, 8, 128, 128, 118);
  gradient.addColorStop(0, "rgba(18, 10, 6, 0.55)");
  gradient.addColorStop(0.38, "rgba(18, 10, 6, 0.22)");
  gradient.addColorStop(1, "rgba(18, 10, 6, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  return registerTexture(canvas);
}

export function disposeTextures() {
  textureRegistry.forEach((texture) => texture.dispose());
  textureRegistry.clear();
}
