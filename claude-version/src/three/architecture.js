import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { SHELF } from "../data/projects.js";

/**
 * The room.
 *
 * One unit is one decimetre. A volume is roughly 13 x 23 x 3.5 cm, the shelf
 * that carries the collection stands 140 cm off the floor, and the ceiling is
 * three metres up. Getting that relationship right is most of what separates a
 * library from a display rack.
 *
 * Everything here is opaque and present from the first frame. The room is
 * revealed by fog and light opening up, never by materials fading in.
 */

export const SITE = {
  floorY: -14,
  ceilingY: 16,
  shelfY: SHELF.baseY,
  shelfPitch: 3.4,
  boardThickness: 0.28,
  caseBackZ: -0.62,
  caseFrontZ: 0.33,
  caseHalfWidth: 9.6,
  wallZ: -0.92,
  table: { x: 4.4, y: -6.4, z: 2.9, width: 9.2, depth: 4.4 }
};

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

export function buildArchitecture({ surfaces, quality }) {
  const root = new THREE.Group();
  root.name = "library-architecture";
  const disposables = [];
  const track = (item) => {
    disposables.push(item);
    return item;
  };

  const walnut = track(new THREE.MeshStandardMaterial({
    map: surfaces.walnut,
    color: 0xb9a996,
    roughness: 0.58,
    metalness: 0,
    envMapIntensity: 1
  }));
  surfaces.walnut.repeat.set(1, 1);

  const walnutDeep = track(new THREE.MeshStandardMaterial({
    map: surfaces.walnut,
    color: 0x6f6152,
    roughness: 0.66,
    metalness: 0,
    envMapIntensity: 0.7
  }));

  const plasterMat = track(new THREE.MeshStandardMaterial({
    map: surfaces.plaster,
    color: 0xbcb0a2,
    roughness: 0.96,
    metalness: 0,
    envMapIntensity: 0.9
  }));
  surfaces.plaster.repeat.set(1, 1);

  const limestone = track(new THREE.MeshStandardMaterial({
    color: 0x8b8175,
    roughness: 0.9,
    metalness: 0,
    envMapIntensity: 0.85
  }));

  const brass = track(new THREE.MeshStandardMaterial({
    color: 0xb08d58,
    roughness: 0.31,
    metalness: 0.94,
    envMapIntensity: 1
  }));

  /**
   * The room is static, so its boxes are collected per material and merged into
   * one mesh each at the end. Two dozen boxes become five draw calls.
   */
  const batches = new Map();

  /**
   * Box UVs run 0 to 1 per face regardless of how big the face is, so a merged
   * mesh made of a nine-unit table top and a third-of-a-unit leg would carry
   * the same nine grain lines on each. Rescaling per face by its real size
   * gives the whole room one consistent texel density.
   */
  const scaleFaceUVs = (geometry, w, h, d, density) => {
    const uv = geometry.attributes.uv;
    const faces = [
      [d, h], [d, h], // +x, -x
      [w, d], [w, d], // +y, -y
      [w, h], [w, h]  // +z, -z
    ];
    for (let face = 0; face < 6; face += 1) {
      const [fw, fh] = faces[face];
      for (let i = face * 4; i < face * 4 + 4; i += 1) {
        uv.setXY(i, uv.getX(i) * fw * density, uv.getY(i) * fh * density);
      }
    }
    uv.needsUpdate = true;
  };

  const box = (dimensions, position, material, name, { cast = false, parent = root, density = 0.34 } = {}) => {
    const geometry = new THREE.BoxGeometry(...dimensions);
    scaleFaceUVs(geometry, dimensions[0], dimensions[1], dimensions[2], density);
    geometry.translate(position[0], position[1], position[2]);
    const key = `${parent.uuid}|${material.uuid}|${cast ? "cast" : "flat"}`;
    if (!batches.has(key)) {
      batches.set(key, { parent, material, cast, parts: [], name });
    }
    batches.get(key).parts.push(geometry);
    return geometry;
  };

  const flush = () => {
    batches.forEach((batch, key) => {
      const merged = track(
        batch.parts.length === 1 ? batch.parts[0] : mergeGeometries(batch.parts, false)
      );
      if (batch.parts.length > 1) batch.parts.forEach((part) => part.dispose());
      const mesh = new THREE.Mesh(merged, batch.material);
      mesh.name = `merged:${batch.name}`;
      mesh.castShadow = batch.cast;
      mesh.receiveShadow = true;
      mesh.userData.batch = key;
      batch.parent.add(mesh);
    });
    batches.clear();
  };

  /* ---- shell ------------------------------------------------------- */
  const shell = new THREE.Group();
  shell.name = "shell";
  root.add(shell);

  box([64, 0.6, 46], [0, SITE.floorY - 0.3, 14], limestone, "floor", { parent: shell });
  box([64, 0.6, 46], [0, SITE.ceilingY, 14], plasterMat, "ceiling", { parent: shell });
  box([64, 34, 0.6], [0, 1, SITE.wallZ - 0.3], plasterMat, "back-wall", { parent: shell });
  box([0.6, 34, 46], [-31, 1, 14], plasterMat, "wall-left", { parent: shell });
  box([0.6, 34, 46], [31, 1, 14], plasterMat, "wall-right", { parent: shell });

  // Skirting and a plaster reveal give the wall a believable thickness.
  box([64, 1.1, 0.22], [0, SITE.floorY + 0.55, SITE.wallZ + 0.11], limestone, "skirting", { parent: shell });

  /* ---- bookcase ---------------------------------------------------- */
  const bookcase = new THREE.Group();
  bookcase.name = "bookcase";
  root.add(bookcase);

  const caseDepth = SITE.caseFrontZ - SITE.caseBackZ;
  const caseCentreZ = (SITE.caseFrontZ + SITE.caseBackZ) / 2;
  const caseTopY = SITE.shelfY + SITE.shelfPitch * 2.5;
  const caseBottomY = SITE.floorY;
  const caseHeight = caseTopY - caseBottomY;

  box([SITE.caseHalfWidth * 2 + 0.9, caseHeight, 0.34],
    [0, (caseTopY + caseBottomY) / 2, SITE.caseBackZ - 0.17],
    walnutDeep, "case-back", { parent: bookcase });

  [-1, 1].forEach((side) => {
    box([0.44, caseHeight, caseDepth],
      [side * (SITE.caseHalfWidth + 0.22), (caseTopY + caseBottomY) / 2, caseCentreZ],
      walnut, `case-upright-${side < 0 ? "left" : "right"}`, { cast: true, parent: bookcase });
  });

  // Shelf boards. The one at shelfY carries the collection.
  const shelfLevels = [];
  for (let level = -4; level <= 2; level += 1) {
    const y = SITE.shelfY + level * SITE.shelfPitch;
    if (y < caseBottomY + 1) continue;
    shelfLevels.push(y);
    box([SITE.caseHalfWidth * 2 + 0.9, SITE.boardThickness, caseDepth],
      [0, y - SITE.boardThickness / 2, caseCentreZ],
      walnut, `shelf-board-${level}`, { cast: true, parent: bookcase });
  }

  // Cornice and plinth.
  box([SITE.caseHalfWidth * 2 + 1.6, 0.5, caseDepth + 0.4],
    [0, caseTopY + 0.25, caseCentreZ + 0.08], walnut, "case-cornice", { cast: true, parent: bookcase });
  box([SITE.caseHalfWidth * 2 + 1.3, 0.9, caseDepth + 0.24],
    [0, caseBottomY + 0.45, caseCentreZ + 0.04], walnut, "case-plinth", { cast: true, parent: bookcase });

  // A brass edge rail on the collection shelf and the one above it.
  [0, 1].forEach((level) => {
    box([SITE.caseHalfWidth * 2 + 0.5, 0.045, 0.05],
      [0, SITE.shelfY + level * SITE.shelfPitch - 0.05, SITE.caseFrontZ - 0.03],
      brass, `brass-rail-${level}`, { parent: bookcase });
  });

  /* ---- picture lights ---------------------------------------------- */
  const fittings = new THREE.Group();
  fittings.name = "picture-lights";
  root.add(fittings);

  const glowMaterial = track(new THREE.MeshStandardMaterial({
    color: 0xffe3b4,
    emissive: new THREE.Color(0xffcf92),
    emissiveIntensity: 1,
    roughness: 0.5,
    metalness: 0
  }));

  const lampX = [-5.4, 0, 5.4];
  const lampY = SITE.shelfY + SITE.shelfPitch - 0.42;
  const lampZ = SITE.caseFrontZ - 0.12;
  const shadeParts = [];
  const glowParts = [];

  lampX.forEach((x) => {
    // A picture light is a trough running along the shelf, open side down.
    const shade = new THREE.CylinderGeometry(0.17, 0.17, 2.6, 14, 1, false, 0, Math.PI);
    shade.rotateX(Math.PI);
    shade.rotateZ(Math.PI * 0.5);
    shade.translate(x, lampY, lampZ);
    shadeParts.push(shade);

    const stem = new THREE.BoxGeometry(0.09, 0.5, 0.09);
    stem.translate(x, lampY + 0.28, lampZ - 0.16);
    shadeParts.push(stem);

    // The lit inner face of the trough, tucked up inside it. Visible as warmth
    // rather than as a bar of light.
    const glow = new THREE.PlaneGeometry(2.36, 0.2);
    glow.rotateX(-Math.PI * 0.5);
    glow.translate(x, lampY - 0.145, lampZ - 0.02);
    glowParts.push(glow);
  });

  const shades = new THREE.Mesh(track(mergeGeometries(shadeParts, false)), brass);
  shades.name = "picture-light-shades";
  shadeParts.forEach((part) => part.dispose());
  fittings.add(shades);

  const glows = new THREE.Mesh(track(mergeGeometries(glowParts, false)), glowMaterial);
  glows.name = "picture-light-glows";
  glowParts.forEach((part) => part.dispose());
  fittings.add(glows);

  /* ---- reading table ------------------------------------------------ */
  const table = new THREE.Group();
  table.name = "reading-table";
  root.add(table);

  box([SITE.table.width, 0.32, SITE.table.depth],
    [SITE.table.x, SITE.table.y - 0.16, SITE.table.z], walnut, "table", { cast: true, parent: table });
  box([SITE.table.width - 0.9, 0.5, SITE.table.depth - 0.9],
    [SITE.table.x, SITE.table.y - 0.6, SITE.table.z], walnutDeep, "table-apron", { parent: table });
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], index) => {
    box([0.34, Math.abs(SITE.floorY - SITE.table.y) - 0.5, 0.34],
      [SITE.table.x + sx * (SITE.table.width / 2 - 0.5),
        (SITE.floorY + SITE.table.y - 0.6) / 2,
        SITE.table.z + sz * (SITE.table.depth / 2 - 0.5)],
      walnut, `table-leg-${index}`, { cast: true, parent: table });
  });

  // A working table, not an empty one: a short stack left mid-read, and a
  // single volume set down beside it.
  const tableVolume = track(new THREE.MeshStandardMaterial({
    map: surfaces.walnut,
    color: 0x8d6f52,
    roughness: 0.8,
    metalness: 0,
    envMapIntensity: 0.5
  }));
  const laid = [
    { x: -2.5, z: -0.5, w: 1.4, h: 0.34, d: 2.2, r: 0.06 },
    { x: -2.42, z: -0.44, w: 1.32, h: 0.3, d: 2.1, r: -0.03 },
    { x: -2.55, z: -0.38, w: 1.26, h: 0.26, d: 2.0, r: 0.09 },
    { x: 1.4, z: 0.6, w: 1.5, h: 0.32, d: 2.3, r: -0.22 }
  ];
  let stackY = SITE.table.y;
  laid.forEach((item, index) => {
    const geometry = new THREE.BoxGeometry(item.w, item.h, item.d);
    scaleFaceUVs(geometry, item.w, item.h, item.d, 0.7);
    geometry.rotateY(item.r);
    geometry.translate(SITE.table.x + item.x, stackY + item.h * 0.5, SITE.table.z + item.z);
    stackY = index < 2 ? stackY + item.h : SITE.table.y;
    const key = `${table.uuid}|${tableVolume.uuid}|cast`;
    if (!batches.has(key)) {
      batches.set(key, { parent: table, material: tableVolume, cast: true, parts: [], name: "table-volumes" });
    }
    batches.get(key).parts.push(geometry);
  });

  // Every static box drawn so far collapses into one mesh per material.
  flush();

  /* ---- shelved volumes ---------------------------------------------- */
  // Spine-out stock on the neighbouring shelves and either flank of the
  // collection, instanced so the whole library costs one draw call.
  const stockGeometry = track(new THREE.BoxGeometry(1, 1, 1));
  const stockMaterial = track(new THREE.MeshStandardMaterial({
    roughness: 0.84,
    metalness: 0,
    // Deep inside a case, stock volumes see almost none of the room. Without
    // occlusion in the image-based light, a high value here lights the tops of
    // books that are sitting under a shelf.
    envMapIntensity: 0.22,
    normalMap: surfaces.weave,
    normalScale: new THREE.Vector2(0.3, 0.3)
  }));

  const random = seeded(0x4d21);
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  const placements = [];

  const collectionHalf = SHELF.span / 2;
  const flankRanges = [
    [-SITE.caseHalfWidth + 0.35, -collectionHalf - 0.25],
    [collectionHalf + 0.25, SITE.caseHalfWidth - 0.35]
  ];

  const fillRow = (y, from, to) => {
    let x = from;
    while (x < to - 0.2) {
      const thickness = 0.14 + random() * 0.34;
      if (x + thickness > to) break;
      const height = 1.75 + random() * 0.95;
      const depth = 0.72 + random() * 0.32;
      const lean = random() > 0.94 ? (random() - 0.5) * 0.16 : (random() - 0.5) * 0.012;
      placements.push({
        x: x + thickness / 2,
        y: y + height / 2,
        z: SITE.caseBackZ + 0.22 + depth / 2,
        sx: thickness,
        sy: height,
        sz: depth,
        lean,
        hue: 0.045 + random() * 0.1,
        sat: 0.1 + random() * 0.26,
        light: 0.08 + random() * 0.13
      });
      x += thickness + 0.012 + random() * 0.02;
    }
  };

  flankRanges.forEach(([from, to]) => fillRow(SITE.shelfY, from, to));
  const stockRows = quality.stockRows;
  const rowLevels = [1, -1, 2, -2].slice(0, stockRows);
  rowLevels.forEach((level) => {
    const y = SITE.shelfY + level * SITE.shelfPitch;
    if (y < SITE.floorY + 1 || y > caseTopY - 2) return;
    fillRow(y, -SITE.caseHalfWidth + 0.35, SITE.caseHalfWidth - 0.35);
  });

  const stock = new THREE.InstancedMesh(stockGeometry, stockMaterial, Math.max(1, placements.length));
  stock.name = "shelved-stock";
  stock.castShadow = true;
  stock.receiveShadow = true;
  placements.forEach((item, index) => {
    dummy.position.set(item.x, item.y, item.z);
    dummy.scale.set(item.sx, item.sy, item.sz);
    dummy.rotation.set(0, 0, item.lean);
    dummy.updateMatrix();
    stock.setMatrixAt(index, dummy.matrix);
    // setHSL defaults to the linear working space; these are authored as the
    // colours a binding actually is, so they have to be declared as sRGB or the
    // whole wall of stock lifts to a pale grey.
    stock.setColorAt(index, tint.setHSL(item.hue, item.sat, item.light, THREE.SRGBColorSpace));
  });
  stock.instanceMatrix.needsUpdate = true;
  if (stock.instanceColor) stock.instanceColor.needsUpdate = true;
  bookcase.add(stock);

  /* ---- the reserved place -------------------------------------------- */
  // The empty slot at the end of the collection, waiting for the next volume.
  const reserved = new THREE.Group();
  reserved.name = "reserved-slot";
  reserved.position.set(SHELF.emptySlot.x, SITE.shelfY, SHELF.restZ);
  const reservedMaterial = track(new THREE.MeshBasicMaterial({
    color: 0xc6a97a,
    transparent: true,
    opacity: 0,
    depthWrite: false
  }));
  const outline = new THREE.Mesh(track(new THREE.PlaneGeometry(SHELF.emptySlot.width * 0.9, 0.028)), reservedMaterial);
  outline.position.set(0, 0.02, 0.3);
  outline.rotation.x = -Math.PI * 0.5;
  reserved.add(outline);
  bookcase.add(reserved);

  return {
    root,
    bookcase,
    table,
    shelfLevels,
    glowMaterial,
    reservedMaterial,
    dispose() {
      disposables.forEach((item) => item.dispose?.());
      stockGeometry.dispose();
    }
  };
}
