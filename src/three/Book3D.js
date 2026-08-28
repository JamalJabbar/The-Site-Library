import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const INTERACTIVE_LAYER = 2;

function roundedBox(width, height, depth, radius = 0.018) {
  return new RoundedBoxGeometry(width, height, depth, 2, Math.min(radius, width * 0.08, depth * 0.2));
}

function makeMaterial(options) {
  return new THREE.MeshPhysicalMaterial({
    clearcoat: 0.04,
    clearcoatRoughness: 0.72,
    ...options
  });
}

export class Book3D extends THREE.Group {
  constructor({ project, artwork, surfaceMaps, shadowTexture, hero = false }) {
    super();
    this.name = `book:${project.slug}`;
    this.userData.project = project;
    this.project = project;
    this.hero = hero;
    this.dimensions = { ...project.book };
    this.artwork = artwork;
    this.surfaceMaps = surfaceMaps;
    this.ownedGeometries = [];
    this.ownedMaterials = [];
    this.basePose = null;
    this.hoverAmount = 0;
    this.focusAmount = 0;
    this.dimAmount = 0;
    this.coverAmount = 0;

    this.visual = new THREE.Group();
    this.visual.name = `${this.name}:visual`;
    this.add(this.visual);

    this.parts = {};
    this.#build(shadowTexture);
  }

  #geometry(geometry) {
    this.ownedGeometries.push(geometry);
    return geometry;
  }

  #material(material) {
    material.userData.baseOpacity = material.opacity ?? 1;
    material.userData.baseTransparent = material.transparent;
    this.ownedMaterials.push(material);
    return material;
  }

  #build(shadowTexture) {
    const { width, height, depth } = this.dimensions;
    const boardDepth = Math.max(0.042, depth * 0.12);
    const boardOverhang = Math.min(0.065, width * 0.045);
    const pageWidth = width - boardOverhang * 1.55;
    const pageHeight = height - boardOverhang * 1.65;
    const pageDepth = depth - boardDepth * 1.48;
    const coverRoughness = this.hero ? 0.78 : 0.72;

    const pageMaterial = this.#material(makeMaterial({
      color: 0xe4dccd,
      map: this.surfaceMaps.paper,
      roughness: 0.84,
      metalness: 0,
      bumpMap: this.surfaceMaps.paper,
      bumpScale: 0.012
    }));

    const frontMaterial = this.#material(makeMaterial({
      color: 0xffffff,
      map: this.artwork.front,
      normalMap: this.surfaceMaps.clothNormal,
      normalScale: new THREE.Vector2(0.24, 0.24),
      roughnessMap: this.surfaceMaps.clothRoughness,
      roughness: coverRoughness,
      metalness: 0
    }));

    const backMaterial = this.#material(makeMaterial({
      color: 0xffffff,
      map: this.artwork.back,
      normalMap: this.surfaceMaps.clothNormal,
      normalScale: new THREE.Vector2(0.24, 0.24),
      roughnessMap: this.surfaceMaps.clothRoughness,
      roughness: coverRoughness,
      metalness: 0
    }));

    const spineMaterial = this.#material(makeMaterial({
      color: 0xffffff,
      map: this.artwork.spine,
      normalMap: this.surfaceMaps.clothNormal,
      normalScale: new THREE.Vector2(0.2, 0.2),
      roughnessMap: this.surfaceMaps.clothRoughness,
      roughness: coverRoughness + 0.04,
      metalness: 0
    }));

    const endpaperMaterial = this.#material(new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.project.palette.secondary),
      roughness: 0.86,
      metalness: 0,
      side: THREE.DoubleSide
    }));

    const foilMaterial = this.#material(new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.project.palette.foil),
      map: this.artwork.foil,
      alphaMap: this.artwork.foil,
      transparent: true,
      opacity: 0.92,
      roughness: 0.32,
      metalness: 0.92,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.5
    }));

    const backBoard = new THREE.Mesh(
      this.#geometry(roundedBox(width, height, boardDepth)),
      backMaterial
    );
    backBoard.name = `${this.name}:back-board`;
    backBoard.position.z = -depth * 0.5;
    backBoard.castShadow = true;
    backBoard.receiveShadow = true;
    this.visual.add(backBoard);
    this.parts.backBoard = backBoard;

    const pageBlock = new THREE.Mesh(
      this.#geometry(roundedBox(pageWidth, pageHeight, pageDepth, 0.012)),
      pageMaterial
    );
    pageBlock.name = `${this.name}:page-block`;
    pageBlock.position.x = boardOverhang * 0.28;
    pageBlock.castShadow = true;
    pageBlock.receiveShadow = true;
    this.visual.add(pageBlock);
    this.parts.pageBlock = pageBlock;

    const spine = new THREE.Mesh(
      this.#geometry(roundedBox(Math.max(0.1, width * 0.095), height - 0.018, depth + boardDepth * 0.46, 0.024)),
      spineMaterial
    );
    spine.name = `${this.name}:spine`;
    spine.position.x = -width * 0.5 + width * 0.035;
    spine.castShadow = true;
    spine.receiveShadow = true;
    this.visual.add(spine);
    this.parts.spine = spine;

    const backEndpaper = new THREE.Mesh(
      this.#geometry(new THREE.PlaneGeometry(pageWidth * 0.96, pageHeight * 0.96)),
      endpaperMaterial
    );
    backEndpaper.name = `${this.name}:back-endpaper`;
    backEndpaper.position.set(boardOverhang * 0.28, 0, -depth * 0.5 + boardDepth * 0.57);
    this.visual.add(backEndpaper);
    this.parts.backEndpaper = backEndpaper;

    const frontCoverPivot = new THREE.Group();
    frontCoverPivot.name = `${this.name}:front-cover-pivot`;
    frontCoverPivot.position.set(-width * 0.5 + width * 0.055, 0, depth * 0.5);
    this.visual.add(frontCoverPivot);
    this.parts.frontCoverPivot = frontCoverPivot;

    const frontBoard = new THREE.Mesh(
      this.#geometry(roundedBox(width, height, boardDepth)),
      frontMaterial
    );
    frontBoard.name = `${this.name}:front-board`;
    frontBoard.position.x = width * 0.5 - width * 0.055;
    frontBoard.castShadow = true;
    frontBoard.receiveShadow = true;
    frontCoverPivot.add(frontBoard);
    this.parts.frontBoard = frontBoard;

    const frontEndpaper = new THREE.Mesh(
      this.#geometry(new THREE.PlaneGeometry(pageWidth * 0.96, pageHeight * 0.96)),
      endpaperMaterial
    );
    frontEndpaper.name = `${this.name}:front-endpaper`;
    frontEndpaper.position.set(width * 0.5 - width * 0.055, 0, -boardDepth * 0.52);
    frontEndpaper.rotation.y = Math.PI;
    frontCoverPivot.add(frontEndpaper);
    this.parts.frontEndpaper = frontEndpaper;

    const foil = new THREE.Mesh(
      this.#geometry(new THREE.PlaneGeometry(width * 0.985, height * 0.985)),
      foilMaterial
    );
    foil.name = `${this.name}:foil-elements`;
    foil.position.set(width * 0.5 - width * 0.055, 0, boardDepth * 0.525);
    foil.renderOrder = 4;
    frontCoverPivot.add(foil);
    this.parts.foil = foil;

    const headbandMaterial = this.#material(new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.project.palette.foil),
      roughness: 0.62,
      metalness: 0.08
    }));
    const headbandGeometry = this.#geometry(new THREE.CylinderGeometry(0.025, 0.025, pageWidth * 0.95, 10));
    const headbandTop = new THREE.Mesh(headbandGeometry, headbandMaterial);
    headbandTop.name = `${this.name}:headband-top`;
    headbandTop.rotation.z = Math.PI * 0.5;
    headbandTop.position.set(boardOverhang * 0.2, pageHeight * 0.5 - 0.018, 0);
    const headbandBottom = headbandTop.clone();
    headbandBottom.name = `${this.name}:headband-bottom`;
    headbandBottom.position.y = -pageHeight * 0.5 + 0.018;
    this.visual.add(headbandTop, headbandBottom);
    this.parts.headbandTop = headbandTop;
    this.parts.headbandBottom = headbandBottom;

    const bookmarkMaterial = this.#material(new THREE.MeshStandardMaterial({
      color: 0x6d252a,
      roughness: 0.8,
      side: THREE.DoubleSide
    }));
    const bookmark = new THREE.Mesh(
      this.#geometry(new THREE.PlaneGeometry(width * 0.075, height * 0.32)),
      bookmarkMaterial
    );
    bookmark.name = `${this.name}:bookmark`;
    bookmark.position.set(width * 0.18, -height * 0.52, depth * 0.1);
    bookmark.rotation.x = -0.06;
    this.visual.add(bookmark);
    this.parts.bookmark = bookmark;

    const shadowMaterial = this.#material(new THREE.MeshBasicMaterial({
      color: 0x140c08,
      map: shadowTexture,
      transparent: true,
      opacity: this.hero ? 0.12 : 0.34,
      depthWrite: false,
      side: THREE.DoubleSide
    }));
    const contactShadow = new THREE.Mesh(
      this.#geometry(new THREE.PlaneGeometry(width * 1.5, depth * 2.8)),
      shadowMaterial
    );
    contactShadow.name = `${this.name}:contact-shadow`;
    contactShadow.position.set(0, -height * 0.5 - 0.025, 0);
    contactShadow.rotation.x = -Math.PI * 0.5;
    this.visual.add(contactShadow);
    this.parts.contactShadow = contactShadow;

    const proxyMaterial = this.#material(new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false
    }));
    const proxy = new THREE.Mesh(
      this.#geometry(new THREE.BoxGeometry(width * 1.02, height * 1.02, depth * 1.6)),
      proxyMaterial
    );
    proxy.name = `${this.name}:proxy`;
    proxy.layers.set(INTERACTIVE_LAYER);
    proxy.userData.book = this;
    proxy.userData.project = this.project;
    this.visual.add(proxy);
    this.proxy = proxy;
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

  setCoverOpen(amount) {
    this.coverAmount = THREE.MathUtils.clamp(amount, 0, 1);
    this.parts.frontCoverPivot.rotation.y = -THREE.MathUtils.degToRad(16) * this.coverAmount;
  }

  setHover(amount) {
    this.hoverAmount = THREE.MathUtils.clamp(amount, 0, 1);
  }

  setFocus(amount) {
    this.focusAmount = THREE.MathUtils.clamp(amount, 0, 1);
  }

  setDim(amount) {
    const next = THREE.MathUtils.clamp(amount, 0, 1);
    if (Math.abs(next - this.dimAmount) < 0.001) return;
    this.dimAmount = next;
    this.ownedMaterials.forEach((material) => {
      if ("opacity" in material && material !== this.parts.contactShadow.material) {
        const baseOpacity = material.userData.baseOpacity ?? 1;
        material.transparent = this.dimAmount > 0.001 || material.userData.baseTransparent;
        material.opacity = baseOpacity * (1 - this.dimAmount * 0.78);
      }
    });
  }

  updatePresentation({ pointerX = 0, pointerY = 0, inspection = false } = {}) {
    const focus = Math.max(this.hoverAmount, this.focusAmount);
    const yaw = inspection ? pointerX * THREE.MathUtils.degToRad(7) : focus * THREE.MathUtils.degToRad(2);
    const pitch = inspection ? -pointerY * THREE.MathUtils.degToRad(4) : 0;
    this.visual.rotation.y = yaw;
    this.visual.rotation.x = pitch;
    this.visual.position.z = focus * 0.055;
    this.parts.foil.material.emissive = new THREE.Color(this.project.palette.foil);
    this.parts.foil.material.emissiveIntensity = focus * 0.07;
    this.parts.contactShadow.material.opacity = ((this.hero ? 0.12 : 0.34) + focus * 0.12) * (1 - this.dimAmount * 0.78);
  }

  setExplode(amount) {
    const value = THREE.MathUtils.clamp(amount, 0, 1);
    this.parts.frontCoverPivot.position.z = this.dimensions.depth * 0.5 + value * 0.42;
    this.parts.backBoard.position.z = -this.dimensions.depth * 0.5 - value * 0.34;
    this.parts.pageBlock.position.z = value * 0.04;
    this.parts.spine.position.x = -this.dimensions.width * 0.5 + this.dimensions.width * 0.035 - value * 0.32;
    this.parts.frontEndpaper.position.z = -this.dimensions.depth * 0.12 - value * 0.12;
    this.parts.backEndpaper.position.z = -this.dimensions.depth * 0.5 + 0.03 - value * 0.12;
    this.parts.bookmark.position.x = this.dimensions.width * 0.18 + value * 0.22;
  }

  dispose() {
    this.ownedGeometries.forEach((geometry) => geometry.dispose());
    this.ownedMaterials.forEach((material) => material.dispose());
    this.ownedGeometries.length = 0;
    this.ownedMaterials.length = 0;
  }
}

export { INTERACTIVE_LAYER };
