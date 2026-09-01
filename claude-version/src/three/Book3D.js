import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { clothProfile } from "./textures.js";

const mergePair = (a, b) => mergeGeometries([a, b], false);

export const INTERACTIVE_LAYER = 2;

/**
 * A hardbound volume.
 *
 *   BookRoot
 *   └─ visual                     hover / focus / inspection offsets live here
 *      ├─ backBoard               6 material groups: art, endpaper, cloth edges
 *      ├─ pageBlock               6 material groups: leaf edges, page white
 *      ├─ spine                   curved cylinder wedge, artwork wraps the arc
 *      ├─ hingeFront / hingeBack  the groove where cloth folds into the joint
 *      ├─ headbandTop / Bottom
 *      ├─ ribbon                  optional
 *      └─ frontCoverPivot
 *         ├─ frontBoard
 *         └─ frontEndpaper
 *
 * Boards overhang the page block by a real square. The spine is a circular arc
 * rather than a rounded slab, which is what makes a closed book read as bound
 * rather than as a rectangle with a texture on it.
 *
 * Recession is done by lifting the volume out of the light (colour and
 * environment intensity), never by fading opacity. Opaque books never sort
 * badly against the shelf.
 */

const DIM_COLOUR = new THREE.Color("#171009");
const WHITE = new THREE.Color("#ffffff");
const scratchColour = new THREE.Color();

let sharedRibbonGeometry = null;

export class Book3D extends THREE.Group {
  constructor({ project, artwork, surfaces, hero = false, ribbon = false }) {
    super();
    this.name = `volume:${project.slug}`;
    this.project = project;
    this.userData.project = project;
    this.hero = hero;
    this.dimensions = { ...project.book };
    this.artwork = artwork;
    this.surfaces = surfaces;

    this.geometries = [];
    this.materials = [];
    this.parts = {};

    this.basePose = null;
    this.hover = 0;
    this.focus = 0;
    this.dim = 0;
    this.cover = 0;
    this.lift = 0;
    this.presentYaw = 0;
    this.presentPitch = 0;

    this.visual = new THREE.Group();
    this.visual.name = `${this.name}:visual`;
    this.add(this.visual);

    this.#build();
  }

  #geometry(geometry) {
    this.geometries.push(geometry);
    return geometry;
  }

  #material(material) {
    material.userData.baseColour = material.color ? material.color.clone() : null;
    material.userData.baseEnv = material.envMapIntensity ?? 1;
    this.materials.push(material);
    return material;
  }

  #build() {
    const { width, height, depth } = this.dimensions;
    const profile = clothProfile(this.dimensions.cloth);

    // Real bookbinding proportions.
    const board = Math.max(0.026, depth * 0.085); // board thickness
    const square = Math.min(0.05, width * 0.035); // board overhang past the leaves
    const joint = width * 0.055; // distance from spine edge to the hinge
    const pageWidth = width - square * 1.4;
    const pageHeight = height - square * 2;
    const pageDepth = depth - board * 2;
    const crown = Math.min(0.075, depth * 0.2); // how far the spine arc bulges

    const weave = this.surfaces.weave;
    const clothColour = new THREE.Color(this.project.palette.primary);

    const artMaterial = (map, orm) => this.#material(new THREE.MeshStandardMaterial({
      map,
      aoMap: orm,
      roughnessMap: orm,
      metalnessMap: orm,
      roughness: 1,
      metalness: 1,
      normalMap: weave,
      normalScale: new THREE.Vector2(profile.normal, profile.normal),
      envMapIntensity: 1
    }));

    const front = artMaterial(this.artwork.front, this.artwork.frontORM);
    const spineMat = artMaterial(this.artwork.spine, this.artwork.spineORM);
    spineMat.normalMap = this.surfaces.spineWeave;
    spineMat.normalScale.set(profile.normal * 0.6, profile.normal * 0.6);
    // Boards carry a material array, so the two surfaces that respond to
    // attention are kept by reference rather than reached through a mesh.
    this.surfaceMaterials = { front, spine: spineMat };
    const back = this.#material(new THREE.MeshStandardMaterial({
      map: this.artwork.back,
      roughness: profile.roughness,
      metalness: 0,
      normalMap: weave,
      normalScale: new THREE.Vector2(profile.normal, profile.normal),
      envMapIntensity: 1
    }));

    const edge = this.#material(new THREE.MeshStandardMaterial({
      color: clothColour.clone().multiplyScalar(0.88),
      roughness: profile.roughness + 0.05,
      metalness: 0,
      normalMap: weave,
      normalScale: new THREE.Vector2(profile.normal * 0.7, profile.normal * 0.7),
      envMapIntensity: 1
    }));

    const endpaper = this.#material(new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.project.palette.secondary),
      roughness: 0.92,
      metalness: 0,
      envMapIntensity: 1
    }));

    const leaf = this.#material(new THREE.MeshStandardMaterial({
      map: this.surfaces.pageEdge,
      color: 0xf3ecdd,
      roughness: 0.94,
      metalness: 0,
      envMapIntensity: 1
    }));

    const hingeMat = this.#material(new THREE.MeshStandardMaterial({
      color: clothColour.clone().multiplyScalar(0.26),
      roughness: 0.95,
      metalness: 0,
      envMapIntensity: 0.35
    }));

    // A material array costs one draw call per face group, so the boards are
    // built as a cloth-covered body with the artwork applied as a single face.
    // Same silhouette, a third of the draw calls.
    const facePlane = this.#geometry(new THREE.PlaneGeometry(1, 1));

    // Boards stop short of the spine. The gap they leave is the French joint,
    // the groove a case-bound book hinges on, and it is what stops the cover
    // from reading as a slab glued to a tube.
    const boardWidth = width - joint;
    const boardCentreX = joint * 0.5 + square * 0.2;

    // ---- back board -------------------------------------------------
    const backBoard = new THREE.Mesh(
      this.#geometry(new THREE.BoxGeometry(boardWidth, height, board)),
      edge
    );
    backBoard.name = `${this.name}:back-board`;
    backBoard.position.set(boardCentreX, 0, -depth * 0.5 + board * 0.5);
    backBoard.castShadow = true;
    backBoard.receiveShadow = true;
    this.visual.add(backBoard);
    this.parts.backBoard = backBoard;

    const backArt = new THREE.Mesh(facePlane, back);
    backArt.name = `${this.name}:back-art`;
    backArt.scale.set(boardWidth, height, 1);
    backArt.position.set(0, 0, -board * 0.5 - 0.0016);
    backArt.rotation.y = Math.PI;
    backBoard.add(backArt);

    // ---- page block -------------------------------------------------
    // Only the fore-edge, head and tail are ever seen; the two flat faces sit
    // behind the boards, so the whole block can wear one leaf material.
    const pageBlock = new THREE.Mesh(
      this.#geometry(new THREE.BoxGeometry(pageWidth, pageHeight, pageDepth)),
      leaf
    );
    pageBlock.name = `${this.name}:page-block`;
    pageBlock.position.set(square * 0.7, 0, 0);
    // The boards define the silhouette; the leaves and the spine sit inside it,
    // so casting from them costs a shadow pass and changes nothing.
    pageBlock.castShadow = false;
    pageBlock.receiveShadow = true;
    this.visual.add(pageBlock);
    this.parts.pageBlock = pageBlock;

    // ---- curved spine -----------------------------------------------
    // The arc is solved so its two trailing edges land exactly on the board
    // edges at the full depth of the book. Spine and boards then meet along a
    // single line: no slot to see through, and nothing to fight over depth.
    const halfDepth = depth * 0.5;
    const bulge = joint + crown;
    const radius = (halfDepth * halfDepth + bulge * bulge) / (2 * bulge);
    const sweep = Math.asin(Math.min(1, halfDepth / radius));
    const apexX = -width * 0.5 - crown;
    // Open-ended: the head and tail of the spine are covered by the headbands
    // and the boards, so the caps would be two draw calls of nothing.
    const spineGeometry = this.#geometry(new THREE.CylinderGeometry(
      radius, radius, height, 26, 1, true,
      -Math.PI * 0.5 - sweep, sweep * 2
    ));
    const spine = new THREE.Mesh(spineGeometry, spineMat);
    spine.name = `${this.name}:spine`;
    spine.position.set(apexX + radius, 0, 0);
    spine.castShadow = false;
    spine.receiveShadow = true;
    this.visual.add(spine);
    this.parts.spine = spine;

    // ---- the joint ----------------------------------------------------
    // The crease the cover hinges on: a thin shadowed sliver sunk just inside
    // the seam where the spine cloth turns onto the board.
    const grooveGeometry = this.#geometry(
      new THREE.BoxGeometry(joint * 0.14, height * 0.998, depth * 0.97)
    );
    const hinge = new THREE.Mesh(grooveGeometry, hingeMat);
    hinge.name = `${this.name}:joint`;
    hinge.position.set(-width * 0.5 + joint, 0, 0);
    hinge.receiveShadow = true;
    this.visual.add(hinge);
    this.parts.hinge = hinge;

    // ---- front board on its pivot ------------------------------------
    const pivot = new THREE.Group();
    pivot.name = `${this.name}:front-cover-pivot`;
    pivot.position.set(-width * 0.5 + joint, 0, depth * 0.5 - board * 0.5);
    this.visual.add(pivot);
    this.parts.frontCoverPivot = pivot;

    const frontBoard = new THREE.Mesh(
      this.#geometry(new THREE.BoxGeometry(boardWidth, height, board)),
      edge
    );
    frontBoard.name = `${this.name}:front-board`;
    frontBoard.position.set(boardWidth * 0.5 + square * 0.2, 0, 0);
    frontBoard.castShadow = true;
    frontBoard.receiveShadow = true;
    pivot.add(frontBoard);
    this.parts.frontBoard = frontBoard;

    const frontArt = new THREE.Mesh(facePlane, front);
    frontArt.name = `${this.name}:front-art`;
    frontArt.scale.set(boardWidth, height, 1);
    frontArt.position.set(0, 0, board * 0.5 + 0.0016);
    frontBoard.add(frontArt);

    // The inside of the board, seen only when the cover is cracked open.
    const frontEndpaper = new THREE.Mesh(facePlane, endpaper);
    frontEndpaper.name = `${this.name}:front-endpaper`;
    frontEndpaper.scale.set(boardWidth * 0.97, height * 0.97, 1);
    frontEndpaper.position.set(0, 0, -board * 0.5 - 0.0016);
    frontEndpaper.rotation.y = Math.PI;
    frontBoard.add(frontEndpaper);
    this.parts.frontEndpaper = frontEndpaper;

    // ---- headbands ----------------------------------------------------
    // Head and tail in one geometry, so the pair costs a single draw call.
    const headbandUnit = new THREE.CylinderGeometry(depth * 0.055, depth * 0.055, pageDepth * 0.96, 8);
    headbandUnit.rotateX(Math.PI * 0.5);
    const headA = headbandUnit.clone().translate(0, pageHeight * 0.5 - depth * 0.03, 0);
    const headB = headbandUnit.clone().translate(0, -pageHeight * 0.5 + depth * 0.03, 0);
    const headbandGeometry = this.#geometry(mergePair(headA, headB));
    headbandUnit.dispose();
    headA.dispose();
    headB.dispose();

    const headbandMat = this.#material(new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.project.palette.foil).lerp(new THREE.Color("#f2e9d6"), 0.45),
      roughness: 0.68,
      metalness: 0.05,
      envMapIntensity: 1
    }));
    const headbands = new THREE.Mesh(headbandGeometry, headbandMat);
    headbands.name = `${this.name}:headbands`;
    headbands.position.set(-width * 0.5 + joint * 1.5, 0, 0);
    this.visual.add(headbands);
    this.parts.headbands = headbands;

    // ---- ribbon marker -------------------------------------------------
    if (this.hero || this.project.book.motif === "folio" || this.project.book.motif === "arch") {
      if (!sharedRibbonGeometry) sharedRibbonGeometry = new THREE.PlaneGeometry(1, 1);
      const ribbonMat = this.#material(new THREE.MeshStandardMaterial({
        color: new THREE.Color(this.project.palette.primary).multiplyScalar(0.62),
        roughness: 0.74,
        metalness: 0,
        side: THREE.DoubleSide,
        envMapIntensity: 1
      }));
      const ribbon = new THREE.Mesh(sharedRibbonGeometry, ribbonMat);
      ribbon.name = `${this.name}:ribbon`;
      // A place marker, not a bookmark tassel: narrow, short, and anchored
      // inside the leaves so only its tail clears the tail edge.
      ribbon.scale.set(width * 0.045, height * 0.15, 1);
      ribbon.position.set(width * 0.1, -pageHeight * 0.5 - height * 0.032, pageDepth * 0.16);
      ribbon.rotation.x = -0.06;
      ribbon.castShadow = false;
      this.visual.add(ribbon);
      this.parts.ribbon = ribbon;
    }

    // ---- raycast proxy --------------------------------------------------
    // Lives on its own layer, which the camera never enables, so it costs no
    // draw call while still giving pointer and tap a forgiving target.
    const proxy = new THREE.Mesh(
      this.#geometry(new THREE.BoxGeometry(width * 1.06, height * 1.04, depth * 2.1)),
      this.#material(new THREE.MeshBasicMaterial())
    );
    proxy.name = `${this.name}:proxy`;
    proxy.layers.set(INTERACTIVE_LAYER);
    proxy.userData.book = this;
    this.visual.add(proxy);
    this.proxy = proxy;

    this.metrics = { board, square, joint, pageHeight, pageWidth, pageDepth, crown };
  }

  captureBasePose() {
    this.basePose = {
      position: this.position.clone(),
      quaternion: this.quaternion.clone(),
      scale: this.scale.clone()
    };
    return this.basePose;
  }

  restoreBasePose() {
    if (!this.basePose) return;
    this.position.copy(this.basePose.position);
    this.quaternion.copy(this.basePose.quaternion);
    this.scale.copy(this.basePose.scale);
  }

  /** 0 closed, 1 fully cracked open at the design limit of 18 degrees. */
  setCoverOpen(amount) {
    this.cover = THREE.MathUtils.clamp(amount, 0, 1);
    this.parts.frontCoverPivot.rotation.y = -THREE.MathUtils.degToRad(18) * this.cover;
  }

  setHover(amount) {
    this.hover = THREE.MathUtils.clamp(amount, 0, 1);
  }

  setFocus(amount) {
    this.focus = THREE.MathUtils.clamp(amount, 0, 1);
  }

  /** Lets the volume fall out of the key light rather than fading it out. */
  setDim(amount) {
    const next = THREE.MathUtils.clamp(amount, 0, 1);
    if (Math.abs(next - this.dim) < 0.002) return;
    this.dim = next;
    scratchColour.copy(WHITE).lerp(DIM_COLOUR, next * 0.82);
    this.materials.forEach((material) => {
      const base = material.userData.baseColour;
      if (base) material.color.copy(base).multiply(scratchColour);
      material.envMapIntensity = material.userData.baseEnv * (1 - next * 0.85);
    });
  }

  /**
   * Applies hover, shelf focus and inspection pointer response.
   * Called once per frame from the world; allocates nothing.
   */
  present({ pointerX = 0, pointerY = 0, inspection = false, dt = 0.016 } = {}) {
    const attention = Math.max(this.hover, this.focus);
    const targetYaw = inspection
      ? pointerX * THREE.MathUtils.degToRad(7)
      : attention * THREE.MathUtils.degToRad(2.4);
    const targetPitch = inspection ? -pointerY * THREE.MathUtils.degToRad(4) : 0;
    const targetLift = inspection ? 0 : attention * 0.26;

    const damping = 1 - Math.exp(-9 * dt);
    this.presentYaw += (targetYaw - this.presentYaw) * damping;
    this.presentPitch += (targetPitch - this.presentPitch) * damping;
    this.lift += (targetLift - this.lift) * damping;

    this.visual.rotation.y = this.presentYaw;
    this.visual.rotation.x = this.presentPitch;
    this.visual.position.z = this.lift;

    // Foil reads brighter as the volume comes forward because it meets more of
    // the environment, not because anything is switched on.
    const boost = (1 + attention * 0.55) * (1 - this.dim * 0.85);
    this.surfaceMaterials.front.envMapIntensity =
      this.surfaceMaterials.front.userData.baseEnv * boost;
    this.surfaceMaterials.spine.envMapIntensity =
      this.surfaceMaterials.spine.userData.baseEnv * boost;
  }

  resetPresentation() {
    this.presentYaw = 0;
    this.presentPitch = 0;
    this.lift = 0;
    this.visual.rotation.set(0, 0, 0);
    this.visual.position.set(0, 0, 0);
  }

  /** Separates the binding into its component layers for the process chapter. */
  setExplode(amount) {
    const value = THREE.MathUtils.clamp(amount, 0, 1);
    const { depth, width } = this.dimensions;
    const { board } = this.metrics;
    // Layer separation is scaled to the volume, not to its depth, or a thin
    // book would barely come apart while a thick one would fly off.
    this.parts.frontCoverPivot.position.z = depth * 0.5 - board * 0.5 + value * width * 0.72;
    this.parts.backBoard.position.z = -depth * 0.5 + board * 0.5 - value * width * 0.58;
    this.parts.pageBlock.position.z = value * depth * 0.1;
    this.parts.spine.position.x = this.parts.spine.userData.baseX ?? this.parts.spine.position.x;
    if (this.parts.spine.userData.baseX === undefined) {
      this.parts.spine.userData.baseX = this.parts.spine.position.x;
    }
    this.parts.spine.position.x = this.parts.spine.userData.baseX - value * width * 0.82;
    this.parts.hinge.visible = value < 0.04;
    if (this.parts.ribbon) this.parts.ribbon.position.z = value * depth * 0.6;
    this.parts.headbands.position.z = value * depth * 0.32;
  }

  dispose() {
    this.geometries.forEach((geometry) => {
      if (geometry !== sharedRibbonGeometry) geometry.dispose();
    });
    this.materials.forEach((material) => material.dispose());
    this.geometries.length = 0;
    this.materials.length = 0;
  }
}

export function disposeSharedBookGeometry() {
  sharedRibbonGeometry?.dispose();
  sharedRibbonGeometry = null;
}
