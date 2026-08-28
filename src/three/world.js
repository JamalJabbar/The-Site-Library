import * as THREE from "three";
import { Book3D, INTERACTIVE_LAYER } from "./Book3D.js";
import {
  createBookArtwork,
  createContactShadowTexture,
  createSurfaceMaps,
  disposeTextures
} from "./textures.js";

const COLORS = {
  parchment: new THREE.Color("#f0ece3"),
  paper: new THREE.Color("#e5ded1"),
  ink: new THREE.Color("#151310"),
  walnut: new THREE.Color("#281d17"),
  walnutDark: new THREE.Color("#18110e"),
  brass: new THREE.Color("#ad8955")
};

const POSES = {
  frontispiece: {
    desktop: { p: [0, 0.25, 8.2], t: [0, 0.22, 0], fov: 35 },
    mobile: { p: [0, 0.35, 10.2], t: [0, 0.3, 0], fov: 40 }
  },
  journey: {
    desktop: { p: [0, 0.5, 8.8], t: [0, 0.35, -5.6], fov: 38 },
    mobile: { p: [0, 0.9, 11.6], t: [0, 0.42, -5.6], fov: 44 }
  },
  reading: {
    desktop: { p: [6.8, 2.1, 8.4], t: [4.5, 0.4, -2], fov: 39 },
    mobile: { p: [4.2, 2.8, 11.5], t: [3.4, 0.8, -2], fov: 46 }
  },
  binding: {
    desktop: { p: [0, 0.8, 7.4], t: [0, 0.2, 0], fov: 36 },
    mobile: { p: [0, 1.35, 10.2], t: [0, 0.3, 0], fov: 43 }
  },
  studio: {
    desktop: { p: [-6.2, 2.4, 10.2], t: [-2.2, 0.6, -2], fov: 40 },
    mobile: { p: [-3.4, 3, 12.5], t: [-2, 0.8, -2], fov: 47 }
  },
  commission: {
    desktop: { p: [0, 3.8, 7.8], t: [0, -0.6, 0.4], fov: 34 },
    mobile: { p: [0, 4.8, 10.2], t: [0, -0.5, 0.4], fov: 41 }
  }
};

const clamp01 = (value) => THREE.MathUtils.clamp(value, 0, 1);
const smoothstep = (value) => value * value * (3 - 2 * value);
const range = (value, start, end) => clamp01((value - start) / Math.max(0.0001, end - start));

function createQualityProfile() {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const memory = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const mobile = coarse || window.innerWidth < 700;
  if (mobile || memory <= 2 || cores <= 4) {
    return { name: "low", dpr: 1.25, shadows: 768, particles: 0, antialias: false };
  }
  if (memory <= 4 || cores <= 6) {
    return { name: "medium", dpr: 1.45, shadows: 1024, particles: 80, antialias: true };
  }
  return { name: "high", dpr: 1.75, shadows: 1536, particles: 160, antialias: true };
}

function seededRandom(seed = 1) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function vector(values) {
  return new THREE.Vector3(...values);
}

function poseFor(id, mobile) {
  return POSES[id][mobile ? "mobile" : "desktop"];
}

function interpolatePose(a, b, amount) {
  const t = smoothstep(clamp01(amount));
  return {
    position: vector(a.p).lerp(vector(b.p), t),
    target: vector(a.t).lerp(vector(b.t), t),
    fov: THREE.MathUtils.lerp(a.fov, b.fov, t)
  };
}

export function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (canvas.getContext("webgl2") || canvas.getContext("webgl")));
  } catch {
    return false;
  }
}

export class LibraryWorld {
  constructor({ canvas, manager, projects, heroVolume, onFallback, onProjectFocus }) {
    this.canvas = canvas;
    this.manager = manager;
    this.projects = projects;
    this.heroVolume = heroVolume;
    this.onFallback = onFallback;
    this.onProjectFocus = onProjectFocus;
    this.quality = createQualityProfile();
    this.timer = new THREE.Timer();
    this.timer.connect(document);
    this.running = true;
    this.mode = "scroll";
    this.hoveredBook = null;
    this.focusedBook = null;
    this.inspectionBook = null;
    this.activeProjectIndex = -1;
    this.pointer = new THREE.Vector2();
    this.pointerSmooth = new THREE.Vector2();
    this.lookMatrix = new THREE.Matrix4();
    this.pointerDirty = false;
    this.frameTimes = [];
    this.slowFrames = 0;
    this.disposables = [];
    this.architectureMaterials = [];
    this.projectBooks = [];
    this.decorativeMaterials = [];
    this.compact = window.innerWidth <= 900;
    this.mobile = window.innerWidth < 768;
    this.shelfBaseY = -1.36;
    this.shelfZ = -5.95;
    this.projectX = [-5.45, -3.82, -2.34, 1.62, 3.08, 4.48, 5.78];

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(COLORS.parchment.clone(), 0.005);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.quality.antialias,
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: "high-performance"
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = this.quality.shadows > 0;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.cameraRig = new THREE.Group();
    this.pathRig = new THREE.Group();
    this.inputRig = new THREE.Group();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.08, 120);
    this.camera.layers.enable(INTERACTIVE_LAYER);
    this.inputRig.add(this.camera);
    this.pathRig.add(this.inputRig);
    this.cameraRig.add(this.pathRig);
    this.scene.add(this.cameraRig);

    this.worldRoot = new THREE.Group();
    this.worldRoot.name = "world";
    this.environment = new THREE.Group();
    this.environment.name = "environment";
    this.architecture = new THREE.Group();
    this.architecture.name = "library-architecture";
    this.booksRoot = new THREE.Group();
    this.booksRoot.name = "books";
    this.interactives = new THREE.Group();
    this.interactives.name = "interactives";
    this.atmosphere = new THREE.Group();
    this.atmosphere.name = "atmosphere";
    this.inspectionRoot = new THREE.Group();
    this.inspectionRoot.name = "inspection-root";
    this.worldRoot.add(this.environment, this.architecture, this.booksRoot, this.interactives, this.atmosphere);
    this.scene.add(this.worldRoot, this.inspectionRoot);

    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.set(INTERACTIVE_LAYER);

    this.manager.itemStart("procedural-surfaces");
    this.surfaceMaps = createSurfaceMaps();
    this.shadowTexture = createContactShadowTexture();
    this.manager.itemEnd("procedural-surfaces");

    this.#createLighting();
    this.#createArchitecture();
    this.#createBooks();
    this.#createAtmosphere();
    this.#bindLifecycle();
    this.resize();
    this.applyPose(poseFor("frontispiece", this.compact));
  }

  #track(value) {
    this.disposables.push(value);
    return value;
  }

  #createLighting() {
    this.hemisphere = new THREE.HemisphereLight(0xfff8ea, 0x25150f, 1.65);
    this.scene.add(this.hemisphere);

    this.keyLight = new THREE.DirectionalLight(0xffead0, 3.6);
    this.keyLight.position.set(-4.2, 7.2, 8.6);
    this.keyLight.castShadow = this.quality.shadows > 0;
    this.keyLight.shadow.mapSize.set(this.quality.shadows, this.quality.shadows);
    this.keyLight.shadow.camera.left = -9;
    this.keyLight.shadow.camera.right = 9;
    this.keyLight.shadow.camera.top = 7;
    this.keyLight.shadow.camera.bottom = -5;
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 30;
    this.keyLight.shadow.bias = -0.0002;
    this.keyLight.shadow.normalBias = 0.018;
    this.scene.add(this.keyLight);

    this.shelfLight = new THREE.RectAreaLight(0xffcc8c, 7.5, 14, 0.32);
    this.shelfLight.position.set(0, 2.02, -5.25);
    this.shelfLight.lookAt(0, 0.2, -5.9);
    this.scene.add(this.shelfLight);

    this.rimLight = new THREE.DirectionalLight(0xd9e1dc, 0.75);
    this.rimLight.position.set(5, 4, -2);
    this.scene.add(this.rimLight);

  }

  #architectureMaterial(options) {
    const material = new THREE.MeshStandardMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: true,
      ...options
    });
    this.architectureMaterials.push(material);
    this.disposables.push(material);
    return material;
  }

  #addBox(group, dimensions, position, material, name, cast = false, receive = true) {
    const geometry = this.#track(new THREE.BoxGeometry(...dimensions));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    group.add(mesh);
    return mesh;
  }

  #createArchitecture() {
    const plaster = this.#architectureMaterial({ color: 0xc6b8a5, roughness: 0.94, metalness: 0 });
    const limestone = this.#architectureMaterial({ color: 0x9c9182, roughness: 0.88, metalness: 0 });
    const wood = this.#architectureMaterial({
      color: 0x5c4030,
      map: this.surfaceMaps.wood,
      roughness: 0.62,
      metalness: 0
    });
    const woodDeep = this.#architectureMaterial({
      color: 0x301d15,
      map: this.surfaceMaps.wood,
      roughness: 0.68,
      metalness: 0
    });
    const brass = this.#architectureMaterial({ color: 0xad8955, roughness: 0.36, metalness: 0.84 });

    this.#addBox(this.environment, [24, 8.5, 0.34], [0, 1.25, -6.72], plaster, "plaster-wall", false, true);
    this.#addBox(this.environment, [28, 0.26, 26], [0, -2.08, -1.8], limestone, "limestone-floor", false, true);
    this.#addBox(this.environment, [24, 0.18, 18], [0, 5.42, -2], plaster, "ceiling", false, true);

    this.#addBox(this.architecture, [16.7, 4.9, 0.38], [0, 0.48, this.shelfZ - 0.26], woodDeep, "shelf-back", false, true);
    this.#addBox(this.architecture, [0.48, 5.2, 0.72], [-8.25, 0.55, this.shelfZ], wood, "shelf-left-post", true, true);
    this.#addBox(this.architecture, [0.48, 5.2, 0.72], [8.25, 0.55, this.shelfZ], wood, "shelf-right-post", true, true);
    this.#addBox(this.architecture, [16.98, 0.36, 0.9], [0, -1.64, this.shelfZ], wood, "shelf-main-base", true, true);
    this.#addBox(this.architecture, [16.98, 0.26, 0.82], [0, 1.75, this.shelfZ], wood, "shelf-upper-base", true, true);
    this.#addBox(this.architecture, [17.1, 0.42, 0.92], [0, 3.02, this.shelfZ], wood, "shelf-crown", true, true);
    this.#addBox(this.architecture, [0.18, 4.5, 0.75], [-6.62, 0.56, this.shelfZ], wood, "shelf-divider-a", true, true);
    this.#addBox(this.architecture, [0.18, 4.5, 0.75], [6.62, 0.56, this.shelfZ], wood, "shelf-divider-b", true, true);
    this.#addBox(this.architecture, [14.9, 0.055, 0.075], [0, 1.55, this.shelfZ + 0.46], brass, "brass-rail", false, false);

    this.readingTable = new THREE.Group();
    this.readingTable.name = "reading-table";
    this.#addBox(this.readingTable, [6.2, 0.25, 3.2], [4.4, -1.34, -0.8], limestone, "reading-table-top", true, true);
    this.#addBox(this.readingTable, [0.38, 1.5, 2.4], [2.2, -1.95, -0.8], limestone, "reading-table-leg-left", false, true);
    this.#addBox(this.readingTable, [0.38, 1.5, 2.4], [6.6, -1.95, -0.8], limestone, "reading-table-leg-right", false, true);
    this.architecture.add(this.readingTable);

    const decorativeGeometry = this.#track(new THREE.BoxGeometry(1, 1, 1));
    const decorativeMaterial = this.#architectureMaterial({ color: 0x3a3027, roughness: 0.82, metalness: 0 });
    const decorativeBooks = new THREE.InstancedMesh(decorativeGeometry, decorativeMaterial, 28);
    decorativeBooks.name = "background-volumes";
    const random = seededRandom(4307);
    const dummy = new THREE.Object3D();
    for (let index = 0; index < 28; index += 1) {
      const upper = index < 15;
      const x = -7.3 + (index % 15) * 1.02 + (random() - 0.5) * 0.11;
      const h = upper ? 0.78 + random() * 0.35 : 0.55 + random() * 0.38;
      dummy.position.set(x, upper ? 2.18 + h * 0.5 : -1.1 + h * 0.5, this.shelfZ + 0.38);
      dummy.scale.set(0.62 + random() * 0.2, h, 0.35 + random() * 0.12);
      dummy.rotation.z = (random() - 0.5) * 0.035;
      dummy.updateMatrix();
      decorativeBooks.setMatrixAt(index, dummy.matrix);
      const hue = new THREE.Color().setHSL(0.05 + random() * 0.07, 0.12 + random() * 0.14, 0.14 + random() * 0.12);
      decorativeBooks.setColorAt(index, hue);
    }
    decorativeBooks.castShadow = false;
    decorativeBooks.receiveShadow = true;
    this.architecture.add(decorativeBooks);
  }

  #createBooks() {
    this.manager.itemStart("cover-artwork");
    const heroArtwork = createBookArtwork(this.heroVolume, true);
    this.heroBook = new Book3D({
      project: this.heroVolume,
      artwork: heroArtwork,
      surfaceMaps: this.surfaceMaps,
      shadowTexture: this.shadowTexture,
      hero: true
    });
    this.heroBook.position.set(0, 0.25, 0);
    this.heroBook.rotation.set(-0.055, 0.2, -0.025);
    this.booksRoot.add(this.heroBook);

    this.heroShelfSlot = new THREE.Object3D();
    this.heroShelfSlot.name = "hero-shelf-slot";
    this.heroShelfSlot.position.set(0, this.shelfBaseY + this.heroVolume.book.height * 0.5, this.shelfZ + 0.54);
    this.architecture.add(this.heroShelfSlot);

    this.projects.forEach((project, index) => {
      const artwork = createBookArtwork(project);
      const book = new Book3D({
        project,
        artwork,
        surfaceMaps: this.surfaceMaps,
        shadowTexture: this.shadowTexture
      });
      book.position.set(
        this.projectX[index],
        this.shelfBaseY + project.book.height * 0.5,
        this.shelfZ + 0.54
      );
      book.rotation.z = [0.008, -0.012, 0.014, -0.008, 0.012, -0.01, 0.006][index];
      book.userData.index = index;
      book.captureBasePose();
      book.visible = false;
      this.projectBooks.push(book);
      this.booksRoot.add(book);
    });
    this.manager.itemEnd("cover-artwork");

    const slot = this.heroShelfSlot.position;
    this.flightCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.25, 0),
      new THREE.Vector3(0.42, 0.7, -1.4),
      new THREE.Vector3(-0.26, 0.46, -3.45),
      new THREE.Vector3(0.08, slot.y + 0.08, slot.z + 0.88),
      slot.clone()
    ], false, "centripetal", 0.5);
    this.heroStartQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.055, 0.2, -0.025));
    this.heroShelfQuaternion = new THREE.Quaternion();
  }

  #createAtmosphere() {
    if (!this.quality.particles) return;
    const random = seededRandom(9997);
    const positions = new Float32Array(this.quality.particles * 3);
    for (let index = 0; index < this.quality.particles; index += 1) {
      positions[index * 3] = (random() - 0.5) * 17;
      positions[index * 3 + 1] = -1.7 + random() * 6;
      positions[index * 3 + 2] = -5.2 + random() * 7;
    }
    const geometry = this.#track(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = this.#track(new THREE.PointsMaterial({
      color: 0xd8c6a4,
      size: 0.018,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true
    }));
    this.dust = new THREE.Points(geometry, material);
    this.dust.name = "dust";
    this.atmosphere.add(this.dust);
  }

  #bindLifecycle() {
    this.onContextLost = (event) => {
      event.preventDefault();
      this.running = false;
      this.onFallback?.("The 3D archive paused. The complete collection remains available below.");
    };
    this.onContextRestored = () => {
      this.running = true;
      this.onFallback?.(null);
    };
    this.onVisibility = () => {
      this.running = !document.hidden;
      if (this.running) this.timer.reset();
    };
    this.canvas.addEventListener("webglcontextlost", this.onContextLost);
    this.canvas.addEventListener("webglcontextrestored", this.onContextRestored);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  applyPose(pose) {
    this.pathRig.position.set(...pose.p);
    this.camera.fov = pose.fov;
    this.camera.updateProjectionMatrix();
    this.#orientPathRig(vector(pose.t));
  }

  #orientPathRig(target) {
    // Matrix4.lookAt aligns negative Z with the target, matching camera forward.
    this.lookMatrix.lookAt(this.pathRig.position, target, this.pathRig.up);
    this.pathRig.quaternion.setFromRotationMatrix(this.lookMatrix);
  }

  setPointer(clientX, clientY) {
    this.pointer.set(
      (clientX / window.innerWidth) * 2 - 1,
      -((clientY / window.innerHeight) * 2 - 1)
    );
    this.pointerDirty = true;
  }

  raycast(clientX, clientY) {
    if (this.mode !== "scroll" || this.activeProjectIndex < 0) return null;
    this.setPointer(clientX, clientY);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const visible = this.projectBooks.filter((book) => book.visible).map((book) => book.proxy);
    const hit = this.raycaster.intersectObjects(visible, false)[0];
    return hit?.object.userData.book || null;
  }

  setHoveredBook(book) {
    if (this.hoveredBook === book) return;
    if (this.hoveredBook) this.hoveredBook.setHover(0);
    this.hoveredBook = book;
    if (book) book.setHover(1);
  }

  setFocusedProject(index) {
    const next = this.projectBooks[index] || null;
    if (this.focusedBook && this.focusedBook !== next) this.focusedBook.setFocus(0);
    this.focusedBook = next;
    if (next) next.setFocus(1);
  }

  getInspectionPose(book) {
    this.scene.updateMatrixWorld(true);
    const local = this.mobile
      ? new THREE.Vector3(0, 1.45, -8)
      : new THREE.Vector3(-1.26, -0.05, -5.7);
    const position = this.camera.localToWorld(local.clone());
    const quaternion = this.camera.getWorldQuaternion(new THREE.Quaternion());
    const inspectionScale = this.mobile ? 0.96 : 1;
    const scale = new THREE.Vector3(inspectionScale, inspectionScale, inspectionScale);
    return { position, quaternion, scale, book };
  }

  beginInspection(book) {
    this.mode = "inspection";
    this.inspectionBook = book;
    this.setHoveredBook(null);
    this.heroBook.visible = false;
    this.projectBooks.forEach((item) => item.setDim(item === book ? 0 : 0.72));
  }

  endInspection() {
    this.projectBooks.forEach((item) => item.setDim(0));
    if (this.inspectionBook) {
      this.inspectionBook.setCoverOpen(0);
      this.inspectionBook.visual.rotation.set(0, 0, 0);
      this.inspectionBook.visual.position.set(0, 0, 0);
    }
    this.heroBook.visible = true;
    this.inspectionBook = null;
    this.mode = "scroll";
  }

  resolveScrollPose(state) {
    const compact = this.compact;
    const hero = poseFor("frontispiece", compact);
    const journey = poseFor("journey", compact);
    const journeyPose = interpolatePose(hero, journey, state.journey);

    const shelfApproach = range(state.library, 0, 0.16);
    const traverse = smoothstep(range(state.library, 0.12, 0.92));
    const shelfCursor = traverse * (this.projectX.length - 1);
    const shelfStart = Math.floor(shelfCursor);
    const shelfEnd = Math.min(this.projectX.length - 1, shelfStart + 1);
    const activeX = THREE.MathUtils.lerp(this.projectX[shelfStart], this.projectX[shelfEnd], shelfCursor - shelfStart);
    const shelfX = activeX + (compact ? 0 : 1.15);
    const shelfZ = compact ? 4.25 : 0.2;
    const shelfY = compact ? 0.55 : 0.32;
    const libraryPosition = new THREE.Vector3(shelfX, shelfY, shelfZ);
    const libraryTarget = new THREE.Vector3(shelfX, 0.2, this.shelfZ + 0.2);
    const libraryPose = {
      position: journeyPose.position.clone().lerp(libraryPosition, smoothstep(shelfApproach)),
      target: journeyPose.target.clone().lerp(libraryTarget, smoothstep(shelfApproach)),
      fov: THREE.MathUtils.lerp(journeyPose.fov, compact ? 42 : 34, smoothstep(shelfApproach))
    };

    let pose = libraryPose;
    if (state.reading > 0) pose = interpolatePose(
      { p: libraryPose.position.toArray(), t: libraryPose.target.toArray(), fov: libraryPose.fov },
      poseFor("reading", compact),
      state.reading
    );
    if (state.binding > 0) pose = interpolatePose(
      poseFor("reading", compact),
      poseFor("binding", compact),
      state.binding
    );
    if (state.studio > 0) pose = interpolatePose(
      poseFor("binding", compact),
      poseFor("studio", compact),
      state.studio
    );
    if (state.commission > 0) pose = interpolatePose(
      poseFor("studio", compact),
      poseFor("commission", compact),
      state.commission
    );
    return pose;
  }

  applyState(state, delta) {
    const journey = clamp01(state.journey);
    const reveal = smoothstep(range(journey, 0.12, 0.46));
    const dark = smoothstep(range(journey, 0.05, 0.58));
    const flight = smoothstep(range(journey, 0.2, 0.9));
    const slot = this.heroShelfSlot.position;

    if (state.binding <= 0 && state.studio <= 0 && state.commission <= 0) {
      this.heroBook.position.copy(this.flightCurve.getPoint(flight));
      this.heroBook.quaternion.slerpQuaternions(this.heroStartQuaternion, this.heroShelfQuaternion, smoothstep(flight));
      if (journey >= 0.999) {
        this.heroBook.position.copy(slot);
        this.heroBook.quaternion.copy(this.heroShelfQuaternion);
      }
      this.heroBook.setExplode(0);
    }

    const isolateMobileInspection = this.mobile && this.mode === "inspection";
    this.environment.visible = !isolateMobileInspection;
    this.architecture.visible = !isolateMobileInspection;
    this.projectBooks.forEach((book) => {
      book.visible = journey > 0.34 && (!isolateMobileInspection || book === this.inspectionBook);
    });
    let chapterRecession = 1;
    if (state.reading > 0) chapterRecession = THREE.MathUtils.lerp(1, 0.1, smoothstep(range(state.reading, 0, 0.35)));
    if (state.binding > 0) chapterRecession = 0.08;
    if (state.studio > 0) chapterRecession = THREE.MathUtils.lerp(0.08, 0.14, smoothstep(state.studio));
    if (state.commission > 0) chapterRecession = THREE.MathUtils.lerp(0.14, 0.68, smoothstep(state.commission));

    this.architectureMaterials.forEach((material) => {
      const inspectionFade = this.mode === "inspection" ? 0.34 : chapterRecession;
      const transparent = reveal < 0.995 || inspectionFade < 0.995;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      material.opacity = reveal * inspectionFade;
      material.depthWrite = reveal > 0.08 && inspectionFade > 0.995;
    });

    const lightBackground = COLORS.parchment.clone();
    const darkBackground = COLORS.walnutDark.clone();
    let background = lightBackground.lerp(darkBackground, dark);
    if (state.reading > 0) background.lerp(COLORS.paper, smoothstep(state.reading));
    if (state.binding > 0) background.lerp(COLORS.parchment, smoothstep(state.binding));
    if (state.studio > 0) background.lerp(COLORS.parchment, smoothstep(state.studio));
    if (state.commission > 0) background.lerp(COLORS.walnutDark, smoothstep(state.commission));
    const sceneBackground = `#${background.getHexString()}`;
    if (sceneBackground !== this.sceneBackground) {
      this.sceneBackground = sceneBackground;
      document.documentElement.style.setProperty("--scene-background", sceneBackground);
    }
    this.scene.fog.color.copy(background);
    this.scene.fog.density = THREE.MathUtils.lerp(0.005, 0.016, dark) * (1 - state.reading * 0.45);

    this.hemisphere.intensity = THREE.MathUtils.lerp(1.65, 0.62, dark);
    this.keyLight.intensity = THREE.MathUtils.lerp(3.6, 1.65, dark);
    this.shelfLight.intensity = reveal * 7.5;
    this.rimLight.intensity = THREE.MathUtils.lerp(0.72, 0.36, dark);
    if (state.binding > 0) {
      this.keyLight.intensity = THREE.MathUtils.lerp(this.keyLight.intensity, 3.1, state.binding);
      this.hemisphere.intensity = THREE.MathUtils.lerp(this.hemisphere.intensity, 1.28, state.binding);
    }
    if (state.commission > 0) {
      this.keyLight.intensity = THREE.MathUtils.lerp(3.1, 2.25, state.commission);
      this.hemisphere.intensity = THREE.MathUtils.lerp(1.28, 0.38, state.commission);
    }
    if (this.dust) {
      this.dust.material.opacity = reveal * 0.24 * (1 - state.reading) * (1 - state.studio);
      this.dust.rotation.y += delta * 0.008;
    }

    const libraryProgress = range(state.library, 0.12, 0.92);
    const index = state.library > 0.1 && state.reading < 0.12
      ? Math.round(libraryProgress * (this.projectBooks.length - 1))
      : -1;
    if (index !== this.activeProjectIndex) {
      this.activeProjectIndex = index;
      this.onProjectFocus?.(index);
    }
    this.projectBooks.forEach((book, bookIndex) => {
      const center = index < 0 ? 0 : Math.max(0, 1 - Math.abs(bookIndex - libraryProgress * 6));
      book.setFocus(center);
      if (this.mode !== "inspection") {
        let collectionDim = index < 0 || bookIndex === index ? 0 : 0.38;
        if (state.reading > 0) collectionDim = THREE.MathUtils.lerp(collectionDim, 0.96, smoothstep(range(state.reading, 0, 0.35)));
        if (state.binding > 0 || state.studio > 0) collectionDim = 0.96;
        if (state.commission > 0) collectionDim = THREE.MathUtils.lerp(0.96, 0.34, smoothstep(state.commission));
        book.setDim(collectionDim);
        book.updatePresentation();
      }
    });
    if (this.mode !== "inspection") {
      let heroDim = index < 0 ? 0 : 0.42;
      if (state.reading > 0) heroDim = THREE.MathUtils.lerp(heroDim, 0.88, smoothstep(range(state.reading, 0, 0.35)));
      if (state.binding > 0) heroDim = 0;
      if (state.studio > 0) heroDim = 0.72;
      if (state.commission > 0) heroDim = THREE.MathUtils.lerp(0.72, 0, smoothstep(state.commission));
      this.heroBook.setDim(heroDim);
    }

    if (state.binding > 0) {
      const enter = smoothstep(range(state.binding, 0, 0.2));
      const bindPosition = this.compact ? new THREE.Vector3(0, 0.35, 1.4) : new THREE.Vector3(-1.1, 0.2, 1.2);
      this.heroBook.position.copy(slot).lerp(bindPosition, enter);
      this.heroBook.quaternion.slerpQuaternions(this.heroShelfQuaternion, new THREE.Quaternion(), enter);
      this.heroBook.setExplode(Math.sin(state.binding * Math.PI));
    }

    if (state.studio > 0) {
      const returnAmount = smoothstep(state.studio);
      const from = this.compact ? new THREE.Vector3(0, 0.35, 1.4) : new THREE.Vector3(-1.1, 0.2, 1.2);
      this.heroBook.position.copy(from).lerp(slot, returnAmount);
      this.heroBook.setExplode(0);
    }

    if (state.commission > 0) {
      const commissionAmount = smoothstep(state.commission);
      const tablePosition = new THREE.Vector3(0, -0.98, 0.55);
      const tableQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI * 0.5, 0, -0.08));
      this.heroBook.position.copy(slot).lerp(tablePosition, commissionAmount);
      this.heroBook.quaternion.slerpQuaternions(this.heroShelfQuaternion, tableQuaternion, commissionAmount);
      this.heroBook.setCoverOpen((state.commissionHover || 0) * commissionAmount * 0.38);
    }

    if (this.mode === "scroll") {
      const pose = this.resolveScrollPose(state);
      this.pathRig.position.copy(pose.position);
      this.#orientPathRig(pose.target);
      this.camera.fov = pose.fov;
      this.camera.updateProjectionMatrix();
    }

    const allowParallax = this.mode === "inspection" || (journey < 0.12 && !state.reduceMotion);
    const damping = 1 - Math.exp(-5.2 * delta);
    this.pointerSmooth.lerp(allowParallax ? this.pointer : new THREE.Vector2(), damping);
    if (this.mode === "scroll" && journey < 0.12) {
      this.inputRig.rotation.y = this.pointerSmooth.x * THREE.MathUtils.degToRad(0.28);
      this.inputRig.rotation.x = -this.pointerSmooth.y * THREE.MathUtils.degToRad(0.18);
      const idle = state.reduceMotion ? 0 : Math.sin(state.elapsed * 0.52);
      this.heroBook.visual.position.y = idle * 0.035;
      this.heroBook.visual.rotation.z = idle * THREE.MathUtils.degToRad(0.35);
      this.heroBook.visual.rotation.y = this.pointerSmooth.x * THREE.MathUtils.degToRad(3);
      this.heroBook.visual.rotation.x = -this.pointerSmooth.y * THREE.MathUtils.degToRad(2);
    } else if (this.mode === "inspection" && this.inspectionBook) {
      this.inspectionBook.setCoverOpen(0.18 + Math.abs(this.pointerSmooth.x) * 0.18);
      this.inspectionBook.updatePresentation({
        pointerX: this.pointerSmooth.x,
        pointerY: this.pointerSmooth.y,
        inspection: true
      });
    } else {
      this.inputRig.rotation.x = 0;
      this.inputRig.rotation.y = 0;
      if (this.mode === "scroll" && journey >= 0.12) {
        this.heroBook.visual.position.y = 0;
        this.heroBook.visual.rotation.set(0, 0, 0);
      }
    }
  }

  render(state) {
    if (!this.running) return;
    this.timer.update();
    const rawDelta = this.timer.getDelta();
    const delta = Math.min(rawDelta, 1 / 30);
    state.elapsed += delta;
    this.applyState(state, delta);
    this.renderer.render(this.scene, this.camera);
    this.#recordPerformance(rawDelta * 1000);
  }

  #recordPerformance(frameMs) {
    this.frameTimes.push(frameMs);
    if (this.frameTimes.length > 180) this.frameTimes.shift();
    if (frameMs > 22) this.slowFrames += 1;
    else this.slowFrames = Math.max(0, this.slowFrames - 2);

    if (this.slowFrames > 120 && this.quality.name !== "low") {
      this.quality.name = "low";
      this.quality.dpr = 1.1;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality.dpr));
      if (this.dust) this.dust.visible = false;
      this.slowFrames = 0;
    }
  }

  getStats() {
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const percentile = (value) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * value))] || 0;
    const screenPosition = (object) => {
      if (!object) return null;
      const projected = object.getWorldPosition(new THREE.Vector3()).project(this.camera);
      return {
        x: Number(projected.x.toFixed(3)),
        y: Number(projected.y.toFixed(3)),
        z: Number(projected.z.toFixed(3)),
        inFrame: Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && projected.z >= -1 && projected.z <= 1
      };
    };
    const activeBook = this.projectBooks[this.activeProjectIndex];
    const activeBookLocal = activeBook
      ? this.camera.worldToLocal(activeBook.getWorldPosition(new THREE.Vector3()))
      : null;
    const activeBookBounds = activeBook
      ? new THREE.Box3().setFromObject(activeBook)
      : null;
    return {
      quality: this.quality.name,
      dpr: this.renderer.getPixelRatio(),
      frameMedian: percentile(0.5),
      frameP95: percentile(0.95),
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      textures: this.renderer.info.memory.textures,
      geometries: this.renderer.info.memory.geometries,
      programs: this.renderer.info.programs?.length || 0,
      activeProject: this.activeProjectIndex,
      mode: this.mode,
      heroScreen: screenPosition(this.heroBook),
      activeBookScreen: screenPosition(activeBook),
      activeBookVisible: activeBook?.visible ?? false,
      activeBookOpacity: activeBook?.parts.frontBoard.material.opacity ?? null,
      activeBookScale: activeBook?.scale.toArray() ?? null,
      activeBookCameraLocal: activeBookLocal?.toArray().map((value) => Number(value.toFixed(3))) ?? null,
      activeBookWorldSize: activeBookBounds?.getSize(new THREE.Vector3()).toArray().map((value) => Number(value.toFixed(3))) ?? null
    };
  }

  getRestorationError(index) {
    const book = this.projectBooks[index];
    if (!book?.basePose) return null;
    return {
      position: book.position.distanceTo(book.basePose.position),
      rotation: 1 - Math.abs(book.quaternion.dot(book.basePose.quaternion)),
      scale: book.scale.distanceTo(book.basePose.scale)
    };
  }

  resize() {
    this.compact = window.innerWidth <= 900;
    this.mobile = window.innerWidth < 768;
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const maxDpr = this.mobile ? Math.min(1.25, this.quality.dpr) : this.quality.dpr;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDpr));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  destroy() {
    this.running = false;
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onContextRestored);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.projectBooks.forEach((book) => book.dispose());
    this.heroBook.dispose();
    this.disposables.forEach((item) => item.dispose?.());
    disposeTextures();
    this.timer.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
