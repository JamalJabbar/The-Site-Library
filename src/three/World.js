import * as THREE from "three";
import { Book3D, INTERACTIVE_LAYER, disposeSharedBookGeometry } from "./Book3D.js";
import { buildArchitecture, SITE } from "./architecture.js";
import { buildEnvironmentMap, buildLighting, buildDust } from "./environment.js";
import { createSurfaceMaps, createBookArtwork, disposeTextures } from "./textures.js";
import { KEYFRAMES, HERO_REST, TABLE_REST, BINDING_REST, PRESENTATION } from "../data/chapters.js";
import { SHELF } from "../data/projects.js";

const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);
const smoothstep = (value) => value * value * (3 - 2 * value);
const range = (value, start, end) => clamp01((value - start) / Math.max(1e-6, end - start));
const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));

/**
 * Distance haze, rewritten to dissolve rather than to tint.
 *
 * The stock fog chunk mixes a fragment toward a colour. This one spends the
 * same factor on alpha and leaves the colour alone, so geometry that is fully
 * hazed becomes genuinely transparent instead of merely pale.
 *
 * Two things fall out of that. The page paints the room's ground colour behind
 * the canvas, so haze and background are literally the same pixels and can
 * never meet at a seam. And the frontispiece headline, which sits between the
 * backdrop and the canvas, shows through the bleached room while the volume
 * itself stays solid and occludes it. The book is in the type, not on it.
 */
THREE.ShaderChunk.fog_fragment = /* glsl */`
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  gl_FragColor.a *= ( 1.0 - fogFactor );
#endif
`;

/**
 * Hands the main thread back between volumes. A background tab throttles
 * animation frames to nothing, so a timer keeps the queue moving there too.
 */
function yieldFrame() {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    requestAnimationFrame(finish);
    setTimeout(finish, 60);
  });
}

/** Scratch objects. The render loop allocates nothing. */
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4();
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

/** The quarter turn that puts a volume's spine out into the room. */
const SPINE_OUT = Math.PI / 2;
/** The whole row rests back into the case. The layout solves the standing
 *  height from the same angle, so it is published by the shelf, not repeated. */
const SHELF_TILT = -SHELF.tilt;

/** The three-quarter turn a volume is held at while it is being read. */
const TURN = THREE.MathUtils.degToRad(21);

/**
 * The pose a volume is shelved in.
 *
 * Composed rather than authored as a single Euler, because the order is the
 * whole point: the quarter turn is the volume's own, and the lean and the tilt
 * are the room's. Written as one Euler, the tilt would be applied inside the
 * turn and would tip the volume along the shelf instead of back into it.
 */
function shelfPose(lean, target) {
  target.setFromAxisAngle(AXIS_Z, lean);
  target.multiply(_q2.setFromAxisAngle(AXIS_X, SHELF_TILT));
  return target.multiply(_q2.setFromAxisAngle(AXIS_Y, SPINE_OUT));
}

/** The pose a volume is read in: square to the lens, short of head on. */
function presentedPose(target) {
  target.setFromAxisAngle(AXIS_X, THREE.MathUtils.degToRad(PRESENTATION.pitch));
  return target.multiply(
    _q2.setFromAxisAngle(AXIS_Y, THREE.MathUtils.degToRad(PRESENTATION.yaw))
  );
}
const _c1 = new THREE.Color();
const _c2 = new THREE.Color();

export function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl2") || canvas.getContext("webgl"))
    );
  } catch {
    return false;
  }
}

export function detectQuality() {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const mobile = coarse || window.innerWidth < 760;
  const memory = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;

  if (mobile) {
    return { name: "low", dpr: 1.25, shadowMap: 1024, dust: 60, stockRows: 1, antialias: false, shadowLights: 1 };
  }
  if (memory <= 4 || cores <= 4) {
    return { name: "medium", dpr: 1.4, shadowMap: 1024, dust: 130, stockRows: 2, antialias: true, shadowLights: 1 };
  }
  return { name: "high", dpr: 1.75, shadowMap: 2048, dust: 230, stockRows: 4, antialias: true, shadowLights: 3 };
}

/**
 * One persistent world.
 *
 * The renderer, the room, the lights and the collection are built once and live
 * for the whole visit. Chapters change the camera, the light and the fog; they
 * never build or tear down a scene, and no material is ever faded in to make
 * something appear.
 */
export class LibraryWorld {
  constructor({ canvas, projects, heroVolume, quality, reduceMotion, onProjectFocus, onContextLost }) {
    this.canvas = canvas;
    this.projects = projects;
    this.heroVolume = heroVolume;
    this.quality = quality;
    this.reduceMotion = Boolean(reduceMotion);
    this.onProjectFocus = onProjectFocus;
    this.onContextLost = onContextLost;

    this.inspectionBlend = 0;
    this.mode = "scroll";
    this.running = true;
    this.compact = window.innerWidth <= 900;
    this.mobile = window.innerWidth < 760;
    this.elapsed = 0;
    this.exactProgress = 0;
    this.focusIndex = -1;
    this.heroFloat = 1;
    this.hovered = null;
    this.inspected = null;
    this.frameTimes = [];
    this.slowFrames = 0;
    this.shadowsDirty = true;
    this.settleFrames = 4;
    this.channels = {};

    this.pointer = new THREE.Vector2();
    this.pointerSmooth = new THREE.Vector2();
    this.pointerActive = false;

    // Transparent, so the frontispiece headline can pass behind the volume.
    // The page paints the ground colour underneath, tone mapped to match.
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: quality.antialias,
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
      stencil: false
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = quality.shadowMap > 0;
    // PCFSoft is deprecated in current Three; PCF with a shadow radius gives the
    // same softness here, and the grounding under each volume is a contact
    // shadow rather than a shadow-map lookup anyway.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // The room is static. Shadows redraw only when something has actually moved.
    this.renderer.shadowMap.autoUpdate = false;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(new THREE.Color("#f0ece3"), 6.4, 14.5);
    this.backdrop = -1;

    this.cameraRig = new THREE.Group();
    this.pathRig = new THREE.Group();
    this.inputRig = new THREE.Group();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 140);
    this.inputRig.add(this.camera);
    this.pathRig.add(this.inputRig);
    this.cameraRig.add(this.pathRig);
    this.scene.add(this.cameraRig);

    this.worldRoot = new THREE.Group();
    this.worldRoot.name = "world";
    this.books = new THREE.Group();
    this.books.name = "books";
    this.shadows = new THREE.Group();
    this.shadows.name = "contact-shadows";
    this.atmosphere = new THREE.Group();
    this.atmosphere.name = "atmosphere";
    this.scene.add(this.worldRoot);
    this.worldRoot.add(this.books, this.shadows, this.atmosphere);

    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.set(INTERACTIVE_LAYER);
    this.proxies = [];

    this.surfaces = createSurfaceMaps();
    this.environmentMap = buildEnvironmentMap(this.renderer);
    this.scene.environment = this.environmentMap;
    this.scene.environmentIntensity = 1;

    this.architecture = buildArchitecture({ surfaces: this.surfaces, quality });
    this.worldRoot.add(this.architecture.root);

    this.lighting = buildLighting({ scene: this.scene, quality });
    if (quality.shadowLights < 3) this.lighting.tableLight.castShadow = false;
    if (quality.shadowLights < 2) this.lighting.practicals.forEach((spot) => { spot.castShadow = false; });

    this.dust = buildDust(quality.dust);
    if (this.dust) this.atmosphere.add(this.dust.points);

    this.projectBooks = [];
    this.#createHeroVolume();
    this.#bindLifecycle();
    this.resize();
    this.anchors = KEYFRAMES.map((_, index) => index / (KEYFRAMES.length - 1));
    this.#buildCameraCurves();
    this.update(0, 1 / 60, true);
  }

  /* ---------------------------------------------------------------- *
   * Construction
   * ---------------------------------------------------------------- */

  #shadowFor(book) {
    const material = new THREE.MeshBasicMaterial({
      map: this.surfaces.shadow,
      color: 0x000000,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    mesh.name = `${book.name}:contact-shadow`;
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 1;
    this.shadows.add(mesh);
    return mesh;
  }

  /**
   * The critical path: the hero volume, its exact destination and its flight.
   * The collection itself streams in afterwards, one volume per frame.
   */
  #createHeroVolume() {
    this.shelfQuaternion = shelfPose(SHELF.heroSlot.lean, new THREE.Quaternion());

    this.heroBook = new Book3D({
      project: this.heroVolume,
      artwork: createBookArtwork(this.heroVolume, true),
      surfaces: this.surfaces,
      hero: true
    });
    this.heroBook.position.set(HERO_REST.x, HERO_REST.y, HERO_REST.z);
    this.heroStartQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.05, 0.19, -0.022));
    this.heroBook.quaternion.copy(this.heroStartQuaternion);
    this.books.add(this.heroBook);
    this.heroShadow = this.#shadowFor(this.heroBook);

    // The destination is a real object inside the case, so the endpoint of the
    // flight is measured rather than guessed and there is nothing to snap to.
    this.heroSlot = new THREE.Object3D();
    this.heroSlot.name = "hero-shelf-slot";
    // The row is leaning, so the centre of a volume is neither above the place
    // it stands nor at half its own height. Both come from the layout.
    this.heroSlot.position.set(
      SHELF.heroSlot.x,
      SITE.shelfY + SHELF.heroSlot.y,
      SHELF.heroSlot.z
    );
    this.heroSlot.quaternion.copy(this.shelfQuaternion);
    this.architecture.bookcase.add(this.heroSlot);

    const slot = this.heroSlot.position;
    this.flightCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(HERO_REST.x, HERO_REST.y, HERO_REST.z),
      new THREE.Vector3(HERO_REST.x + 0.55, HERO_REST.y + 0.34, HERO_REST.z - 1.5),
      new THREE.Vector3(HERO_REST.x - 1.3, HERO_REST.y + 0.24, HERO_REST.z - 3.1),
      new THREE.Vector3(slot.x + 1.4, slot.y + 0.4, slot.z + 1.9),
      new THREE.Vector3(slot.x + 0.14, slot.y + 0.05, slot.z + 0.74),
      slot.clone()
    ], false, "centripetal", 0.5);

    this.tableQuaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-Math.PI * 0.5, 0, -0.14)
    );
    this.bindingQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05, 0.62, 0));
  }

  /**
   * Streams the collection in, yielding a frame between volumes so the
   * preloader keeps painting and the first authored frame is never held up by
   * artwork the reader cannot see yet.
   */
  async loadCollection(onStep) {
    for (let index = 0; index < this.projects.length; index += 1) {
      const project = this.projects[index];
      const book = new Book3D({
        project,
        artwork: createBookArtwork(project),
        surfaces: this.surfaces
      });
      const slot = SHELF.projectSlots[index];
      book.position.set(slot.x, SITE.shelfY + slot.y, slot.z);
      shelfPose(slot.lean, book.quaternion);
      // A hand-shelved row is never perfectly regular: a fraction of a degree
      // of skew, so no two spines sit exactly square to the board.
      book.rotateY((((index * 37) % 11) - 5) * 0.0024);
      book.userData.index = index;
      book.captureBasePose();

      // The two poses this volume lives between for the whole of the shelf
      // chapter. Both are absolute, so the blend has exact endpoints and the
      // volume can be caught anywhere along it without drifting.
      book.setShelfPose(book.position, book.quaternion);
      book.setPresentedPose(
        _v1.set(
          slot.x + PRESENTATION.x,
          SITE.shelfY + PRESENTATION.y,
          SHELF.faceZ + PRESENTATION.z
        ),
        presentedPose(_q1),
        this.reduceMotion
          ? { tip: 0, arc: 0 }
          : { tip: PRESENTATION.tip, arc: PRESENTATION.arc }
      );
      book.userData.shadow = this.#shadowFor(book);
      this.books.add(book);
      this.proxies.push(book.proxy);
      this.projectBooks.push(book);
      onStep?.(project);
      await yieldFrame();
    }
    this.shadowsDirty = true;
    // Compile before the shelf is ever on screen, so no seam pays for it.
    if (this.renderer.compileAsync) await this.renderer.compileAsync(this.scene, this.camera);
  }

  #buildCameraCurves() {
    const key = this.compact ? "mobile" : "desktop";
    if (this.curveKey === key && this.positionCurve) return;
    this.curveKey = key;
    const resolve = (frame) => (this.compact && frame.camera.mobile ? frame.camera.mobile : frame.camera);
    this.positionCurve = new THREE.CatmullRomCurve3(
      KEYFRAMES.map((frame) => new THREE.Vector3(...resolve(frame).position)),
      false, "centripetal", 0.5
    );
    this.targetCurve = new THREE.CatmullRomCurve3(
      KEYFRAMES.map((frame) => new THREE.Vector3(...resolve(frame).target)),
      false, "centripetal", 0.5
    );
    this.fovs = KEYFRAMES.map((frame) => resolve(frame).fov);

    // The compact composition stands further back for the same shot, so the
    // haze has to move with it. Scaling by the ratio of subject distances keeps
    // the atmosphere identical at every breakpoint from one set of authored
    // numbers, instead of a second set that would drift out of sync.
    this.hazeScale = KEYFRAMES.map((frame) => {
      if (!this.compact || !frame.camera.mobile) return 1;
      const wide = _v1.fromArray(frame.camera.position)
        .distanceTo(_v2.fromArray(frame.camera.target));
      const compact = _v1.fromArray(frame.camera.mobile.position)
        .distanceTo(_v2.fromArray(frame.camera.mobile.target));
      return wide > 0.01 ? compact / wide : 1;
    });
  }

  #bindLifecycle() {
    this.handleContextLost = (event) => {
      event.preventDefault();
      this.running = false;
      this.onContextLost?.();
    };
    this.handleContextRestored = () => {
      this.running = true;
      this.shadowsDirty = true;
      this.settleFrames = 3;
    };
    this.handleVisibility = () => {
      this.running = !document.hidden;
      if (this.running) {
        this.shadowsDirty = true;
        this.settleFrames = 2;
      }
    };
    this.canvas.addEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.addEventListener("webglcontextrestored", this.handleContextRestored);
    document.addEventListener("visibilitychange", this.handleVisibility);
  }

  /** Absolute narrative positions for every keyframe, measured from the DOM. */
  setAnchors(anchors) {
    this.anchors = anchors;
  }

  /* ---------------------------------------------------------------- *
   * State resolution
   * ---------------------------------------------------------------- */

  #segment(t) {
    const anchors = this.anchors;
    const last = anchors.length - 1;
    if (t <= anchors[0]) return { index: 0, u: 0 };
    if (t >= anchors[last]) return { index: last - 1, u: 1 };
    let index = 0;
    while (index < last - 1 && t > anchors[index + 1]) index += 1;
    const span = anchors[index + 1] - anchors[index];
    return { index, u: span > 1e-6 ? (t - anchors[index]) / span : 0 };
  }

  resolveWorld(t, out) {
    const { index, u } = this.#segment(t);
    const a = KEYFRAMES[index].world;
    const b = KEYFRAMES[index + 1].world;
    const e = smoothstep(u);
    out.key = THREE.MathUtils.lerp(a.key, b.key, e);
    out.env = THREE.MathUtils.lerp(a.env, b.env, e);
    out.practical = THREE.MathUtils.lerp(a.practical, b.practical, e);
    out.table = THREE.MathUtils.lerp(a.table, b.table, e);
    out.heroLight = THREE.MathUtils.lerp(a.heroLight ?? 0, b.heroLight ?? 0, e);
    out.ink = THREE.MathUtils.lerp(a.ink ?? 0, b.ink ?? 0, e);
    const haze = THREE.MathUtils.lerp(this.hazeScale[index], this.hazeScale[index + 1], e);
    out.hazeNear = THREE.MathUtils.lerp(a.hazeNear, b.hazeNear, e) * haze;
    out.hazeFar = THREE.MathUtils.lerp(a.hazeFar, b.hazeFar, e) * haze;
    out.dust = THREE.MathUtils.lerp(a.dust, b.dust, e);
    out.scrim = THREE.MathUtils.lerp(a.scrim ?? 0, b.scrim ?? 0, e);
    out.grain = THREE.MathUtils.lerp(a.grain, b.grain, e);
    out.exposure = THREE.MathUtils.lerp(a.exposure, b.exposure, e);
    _c1.set(a.ground);
    _c2.set(b.ground);
    out.ground = _c1.lerp(_c2, e);
    return out;
  }

  resolveCamera(t, position, target) {
    const { index, u } = this.#segment(t);
    const eased = smoothstep(u);

    if (KEYFRAMES[index].linear) {
      // A tracking shot has to be straight. A spline through this segment would
      // be pulled off the rails by the shots either side of it, which shows up
      // as the camera drifting up and in halfway along the shelf.
      const points = this.positionCurve.points;
      const targets = this.targetCurve.points;
      position.copy(points[index]).lerp(points[index + 1], u);
      target.copy(targets[index]).lerp(targets[index + 1], u);
      return THREE.MathUtils.lerp(this.fovs[index], this.fovs[index + 1], u);
    }

    // Elsewhere the curve gives each authored segment an equal slice of its
    // parameter space, so easing u locally keeps full control of dwell per
    // chapter while the path stays continuous through every keyframe.
    const global = (index + eased) / (KEYFRAMES.length - 1);
    this.positionCurve.getPoint(global, position);
    this.targetCurve.getPoint(global, target);
    return THREE.MathUtils.lerp(this.fovs[index], this.fovs[index + 1], eased);
  }

  /* ---------------------------------------------------------------- *
   * Per-frame
   * ---------------------------------------------------------------- */

  #placeHeroVolume(t) {
    const a = this.anchors;
    const flightStart = THREE.MathUtils.lerp(a[1], a[2], 0.18);
    const flightEnd = a[3];
    const bindStart = THREE.MathUtils.lerp(a[6], a[7], 0.12);
    const bindPeak = a[7];
    const studioAt = a[8];
    const commissionAt = a[9];

    if (t <= flightEnd) {
      const flight = smoothstep(range(t, flightStart, flightEnd));
      if (flight <= 0) {
        this.heroBook.position.set(HERO_REST.x, HERO_REST.y, HERO_REST.z);
        this.heroBook.quaternion.copy(this.heroStartQuaternion);
      } else if (flight >= 1) {
        // Exact endpoint, taken from the slot rather than from the curve.
        this.heroBook.position.copy(this.heroSlot.position);
        this.heroBook.quaternion.copy(this.heroSlot.quaternion);
      } else {
        this.flightCurve.getPoint(flight, _v3);
        this.heroBook.position.copy(_v3);
        this.heroBook.quaternion.slerpQuaternions(
          this.heroStartQuaternion, this.heroSlot.quaternion, smoothstep(flight)
        );
      }
      this.heroBook.setExplode(0);
      this.heroFloat = flight < 0.02 ? 1 : 0;
      return;
    }

    this.heroFloat = 0;

    if (t < bindStart) {
      this.heroBook.position.copy(this.heroSlot.position);
      this.heroBook.quaternion.copy(this.heroSlot.quaternion);
      this.heroBook.setExplode(0);
      return;
    }

    if (t <= studioAt) {
      // Out of the case, taken apart, then reassembled and returned.
      const out = smoothstep(range(t, bindStart, bindPeak));
      const back = smoothstep(range(t, bindPeak, studioAt));
      _v3.copy(this.heroSlot.position)
        .lerp(_v4.set(BINDING_REST.x, BINDING_REST.y, BINDING_REST.z), out);
      if (back > 0) _v3.lerp(this.heroSlot.position, back);
      this.heroBook.position.copy(_v3);
      _q1.copy(this.heroSlot.quaternion).slerp(this.bindingQuaternion, out);
      if (back > 0) _q1.slerp(this.heroSlot.quaternion, back);
      this.heroBook.quaternion.copy(_q1);
      const explode = Math.sin(clamp01(range(t, bindStart, studioAt)) * Math.PI);
      this.heroBook.setExplode(explode * (1 - back * 0.55));
      return;
    }

    // The closing chapter lays the volume on the reading table.
    const lay = smoothstep(range(t, studioAt, commissionAt));
    _v3.copy(this.heroSlot.position)
      .lerp(_v4.set(TABLE_REST.x, TABLE_REST.y, TABLE_REST.z), lay);
    // Carried over the room rather than dragged through the case.
    _v3.y += Math.sin(lay * Math.PI) * 1.7;
    _v3.z += Math.sin(lay * Math.PI) * 2.1;
    this.heroBook.position.copy(_v3);
    this.heroBook.quaternion.slerpQuaternions(this.heroSlot.quaternion, this.tableQuaternion, lay);
    this.heroBook.setExplode(0);
  }

  #updateShadow(mesh, book, strength) {
    // Contact shadows live in world space, not under the book, so a volume in
    // flight does not carry its shadow through the air with it.
    book.getWorldPosition(_v1);

    // A volume can be stood, leant, turned spine out, drawn into the room or
    // laid flat on the table, so its footprint is the oriented box projected
    // onto the floor rather than a pair of dimensions picked by guessing which
    // way up it is. Books hang directly off an untransformed group, so the
    // local rotation is the world rotation.
    const { width, height, depth } = book.dimensions;
    _v2.set(width * 0.5, 0, 0).applyQuaternion(book.quaternion);
    _v3.set(0, height * 0.5, 0).applyQuaternion(book.quaternion);
    _v4.set(0, 0, depth * 0.5).applyQuaternion(book.quaternion);
    const halfX = Math.abs(_v2.x) + Math.abs(_v3.x) + Math.abs(_v4.x);
    const halfZ = Math.abs(_v2.z) + Math.abs(_v3.z) + Math.abs(_v4.z);
    const bottom = _v1.y - (Math.abs(_v2.y) + Math.abs(_v3.y) + Math.abs(_v4.y));

    // Which surface the volume is actually standing on, decided by footprint
    // rather than by height alone. A volume out in the room is not resting on
    // the shelf just because it happens to be level with it.
    const overShelf =
      Math.abs(_v1.x) < SITE.caseHalfWidth + 0.6 &&
      _v1.z > SITE.caseBackZ - 0.4 && _v1.z < SITE.caseFrontZ + 0.9;
    const overTable =
      Math.abs(_v1.x - SITE.table.x) < SITE.table.width * 0.55 &&
      Math.abs(_v1.z - SITE.table.z) < SITE.table.depth * 0.55;

    let support;
    let ceiling = 0.6;
    if (overTable && bottom > SITE.table.y - 1) {
      support = SITE.table.y;
    } else if (overShelf && bottom > SITE.shelfY - 1) {
      support = SITE.shelfY;
    } else {
      // Free in the room: a soft studio shadow that keeps the object anchored
      // in the frame without claiming it is resting on anything.
      support = bottom - 0.5;
      ceiling = 0.2;
    }

    const gap = Math.max(0, bottom - support);
    const proximity = 1 - clamp01(gap / 1.1);
    if (proximity <= 0.004) {
      if (mesh.visible) mesh.visible = false;
      return;
    }

    const spread = 1 + gap * 0.85;
    mesh.visible = true;
    mesh.position.set(_v1.x, support + 0.012, _v1.z);
    mesh.scale.set(halfX * 4.4 * spread, halfZ * 4.4 * spread, 1);
    mesh.material.opacity = ceiling * proximity * strength;
  }

  #updateFocus(exactT) {
    if (this.mode !== "scroll" || !this.projectBooks.length) return;
    const a = this.anchors;
    const inShelf = exactT > THREE.MathUtils.lerp(a[3], a[4], 0.3) && exactT < a[6];
    if (!inShelf) {
      if (this.focusIndex !== -1) {
        this.focusIndex = -1;
        this.onProjectFocus?.(-1);
      }
      return;
    }

    // Focus follows the compositional centre, resolved against real slot
    // positions, so adding a volume needs no index arithmetic anywhere.
    // The lens aims past the slot it is reading so the volume it draws out has
    // somewhere to stand, so the slot it is reading is the aim taken back off.
    this.resolveCamera(exactT, _v1, _v2);
    const centre = _v2.x - (this.compact ? SHELF.aimCompact : SHELF.aim);
    let nearest = -1;
    let best = Infinity;
    for (let index = 0; index < SHELF.projectSlots.length; index += 1) {
      const distance = Math.abs(SHELF.projectSlots[index].x - centre);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    }
    // The reserved place at the end of the row belongs to nobody yet. It only
    // takes the frame once the lens is clearly past the last volume. This is
    // also the selected-works UI exit boundary, so the metadata and rail stay
    // present for the whole time a bound volume is still being read.
    if (centre > SHELF.focusReleaseX) nearest = -1;

    if (nearest !== this.focusIndex) {
      this.focusIndex = nearest;
      this.onProjectFocus?.(nearest);
    }
  }

  update(t, dt, force = false) {
    this.exactProgress = t;
    const world = this.resolveWorld(t, this.channels);
    const a = this.anchors;

    /* -- atmosphere and grade ------------------------------------------- */
    this.scene.fog.near = world.hazeNear;
    this.scene.fog.far = world.hazeFar;

    // The ground colour is painted by the page, and hazed geometry dissolves
    // into it, so this is the single definition of the room's atmosphere.
    const hex = world.ground.getHex(THREE.SRGBColorSpace);
    if (hex !== this.backdrop) {
      this.backdrop = hex;
      world.backdrop = `#${hex.toString(16).padStart(6, "0")}`;
    } else {
      world.backdrop = null;
    }

    // Opening a volume takes the room down and brings a controlled studio light
    // onto the selected object. The scroll state underneath is untouched.
    const veil = this.inspectionBlend;
    this.scene.environmentIntensity = world.env * (1 - veil * 0.45);
    this.lighting.key.intensity = world.key * (1 - veil * 0.62);
    this.lighting.rim.intensity = (0.28 + world.practical * 0.16) * (1 - veil * 0.5);
    this.lighting.practicals.forEach((spot) => {
      spot.intensity = world.practical * 11 * (1 - veil * 0.72);
    });
    this.lighting.tableLight.intensity = world.table * 12 * (1 - veil * 0.8);
    this.architecture.glowMaterial.emissiveIntensity = 0.06 + world.practical * 0.42;

    // The frontispiece key rides with the volume until the room takes over.
    this.lighting.heroKey.intensity = world.heroLight * 26 * (1 - veil);
    if (world.heroLight > 0.004) {
      this.heroBook.getWorldPosition(_v1);
      this.lighting.heroKey.target.position.copy(_v1);
      this.lighting.heroKey.position.set(_v1.x - 2.4, _v1.y + 2.9, _v1.z + 3.1);
      this.lighting.heroKey.visible = true;
    } else if (this.lighting.heroKey.visible) {
      this.lighting.heroKey.visible = false;
    }

    if (veil > 0.002 && this.inspected) {
      this.inspected.getWorldPosition(_v1);
      this.lighting.inspect.target.position.copy(_v1);
      this.camera.getWorldPosition(_v2);
      _v3.copy(_v1).sub(_v2).normalize();
      // Keyed from over the reader's left shoulder, as a still-life would be.
      this.lighting.inspect.position.copy(_v2)
        .addScaledVector(_v3, 0.5)
        .add(_v4.set(-2.2, 2.8, 0.5));
      this.lighting.inspect.intensity = veil * 26;
      this.lighting.inspect.visible = true;
      this.shadowsDirty = true;
    } else if (this.lighting.inspect.visible) {
      this.lighting.inspect.intensity = 0;
      this.lighting.inspect.visible = false;
    }

    if (this.dust) {
      this.dust.material.opacity = world.dust * 0.46 * (1 - veil * 0.6);
      this.dust.points.visible = this.dust.material.opacity > 0.005;
      if (this.dust.points.visible && !this.reduceMotion) this.dust.update(this.elapsed);
    }

    /* -- volumes --------------------------------------------------------- */
    // How far the collection has a volume standing out of it, which is what the
    // reading light rides on. Carried out of the branch below so the light can
    // be placed once, and so that leaving scroll mode puts it out rather than
    // stranding it lit over a shelf nobody is looking at.
    let drawn = 0;
    if (this.mode === "scroll") {
      this.#placeHeroVolume(t);

      // Nothing leaves the shelf until the traverse is on its rails. During
      // the reveal the row is a wall of spines, which is the whole point of it.
      const shelfIn = smoothstep(range(t, THREE.MathUtils.lerp(a[3], a[4], 0.55), a[4]));
      const shelfOut = smoothstep(range(t, a[5], a[6]));
      const attention = this.focusIndex;
      for (let index = 0; index < this.projectBooks.length; index += 1) {
        const book = this.projectBooks[index];
        const focused = index === attention ? 1 : 0;
        // Focus is what draws a volume out of the row, so it has to be a
        // continuous value: the shelf fades it in, the reading room takes it
        // back, and the volume travels between its two poses on it.
        const lift = focused * shelfIn * (1 - shelfOut);
        if (focused) drawn = lift;
        book.setFocus(lift);
        const recede = Math.max(1 - shelfIn, shelfOut * 0.8);
        book.setDim(Math.min(0.88, recede + (attention >= 0 && !focused ? 0.32 : 0)));
        book.present({ dt });
      }
      this.heroBook.setDim(t > a[4] && t < a[6] ? 0.5 : 0);
      this.heroBook.setFocus(0);
      this.heroBook.present({ dt });

      if (this.heroFloat > 0 && !this.reduceMotion) {
        // A slow, shallow drift: about six millimetres and a degree and a half.
        this.heroBook.visual.position.y = Math.sin(this.elapsed * 0.62) * 0.055;
        this.heroBook.visual.rotation.z = Math.sin(this.elapsed * 0.44) * 0.0135;
      } else if (this.heroBook.visual.position.y !== 0) {
        this.heroBook.visual.position.y = damp(this.heroBook.visual.position.y, 0, 6, dt);
        this.heroBook.visual.rotation.z = damp(this.heroBook.visual.rotation.z, 0, 6, dt);
      }
    } else if (this.inspected) {
      this.inspected.present({
        pointerX: this.pointerSmooth.x,
        pointerY: this.pointerSmooth.y,
        inspection: true,
        dt
      });
      if (this.mode === "inspection") {
        this.inspected.setCoverOpen(0.32 + this.pointerSmooth.x * 0.16);
      }
    }

    // The reading light follows the volume out of the row and back into it on
    // the same continuous value that moves the book, so it never switches on: it
    // arrives with the volume and leaves with it. It goes out under the veil,
    // where the inspection key is the only light on the object.
    if (drawn > 0.004 && this.focusIndex >= 0) {
      this.projectBooks[this.focusIndex].getWorldPosition(_v1);
      this.lighting.focusKey.target.position.copy(_v1);
      this.lighting.focusKey.position.set(_v1.x - 1.5, _v1.y + 2.2, _v1.z + 2.9);
      this.lighting.focusKey.intensity = drawn * 30 * (1 - veil);
      this.lighting.focusKey.visible = true;
    } else if (this.lighting.focusKey.visible) {
      this.lighting.focusKey.intensity = 0;
      this.lighting.focusKey.visible = false;
    }

    this.#updateShadow(this.heroShadow, this.heroBook, 1);
    for (let index = 0; index < this.projectBooks.length; index += 1) {
      const book = this.projectBooks[index];
      this.#updateShadow(book.userData.shadow, book, book === this.inspected ? 1 - veil : 1);
    }

    /* -- the reserved place ----------------------------------------------- */
    const arriving = smoothstep(range(t, THREE.MathUtils.lerp(a[4], a[5], 0.72), a[5]));
    const leaving = smoothstep(range(t, a[5], a[6]));
    this.architecture.reservedMaterial.opacity = arriving * 0.7 * (1 - leaving);

    /* -- camera ------------------------------------------------------------ */
    if (this.mode === "scroll") {
      const fov = this.resolveCamera(t, _v1, _v2);
      this.pathRig.position.copy(_v1);
      _m1.lookAt(this.pathRig.position, _v2, this.pathRig.up);
      this.pathRig.quaternion.setFromRotationMatrix(_m1);
      if (Math.abs(this.camera.fov - fov) > 1e-4) {
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
      }
    }

    /* -- pointer ------------------------------------------------------------ */
    const heroWindow = THREE.MathUtils.lerp(a[0], a[1], 0.5);
    const allowParallax = !this.reduceMotion && this.pointerActive &&
      (this.mode === "inspection" || (this.mode === "scroll" && t < heroWindow));
    this.pointerSmooth.x = damp(this.pointerSmooth.x, allowParallax ? this.pointer.x : 0, 3.4, dt);
    this.pointerSmooth.y = damp(this.pointerSmooth.y, allowParallax ? this.pointer.y : 0, 3.4, dt);

    if (this.mode === "scroll") {
      this.inputRig.rotation.y = this.pointerSmooth.x * THREE.MathUtils.degToRad(0.5);
      this.inputRig.rotation.x = -this.pointerSmooth.y * THREE.MathUtils.degToRad(0.32);
      if (this.heroFloat > 0) {
        this.heroBook.visual.rotation.y = this.pointerSmooth.x * THREE.MathUtils.degToRad(3);
        this.heroBook.visual.rotation.x = -this.pointerSmooth.y * THREE.MathUtils.degToRad(2);
      }
    }

    this.#updateFocus(t);
    if (force) {
      this.shadowsDirty = true;
      this.settleFrames = Math.max(this.settleFrames, 2);
    }
    return world;
  }

  render(dt) {
    if (!this.running) return;
    this.elapsed += dt;
    if (this.shadowsDirty || this.settleFrames > 0) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowsDirty = false;
      if (this.settleFrames > 0) this.settleFrames -= 1;
    }
    this.renderer.render(this.scene, this.camera);
  }

  markDirty() {
    this.shadowsDirty = true;
  }

  /* ---------------------------------------------------------------- *
   * Interaction
   * ---------------------------------------------------------------- */

  setPointer(clientX, clientY) {
    this.pointer.set(
      (clientX / window.innerWidth) * 2 - 1,
      -((clientY / window.innerHeight) * 2 - 1)
    );
    this.pointerActive = true;
  }

  clearPointer() {
    this.pointerActive = false;
  }

  /**
   * The volume under the pointer, if it is one the reader can actually take.
   *
   * Only the volume the traverse has drawn out of the row answers. The rest of
   * the collection is a wall of spines: its fronts cannot be seen, a hover that
   * eased one of them forward would offer something that cannot be opened, and
   * a click that opened one would take it out from behind the volume already
   * standing proud, leaving two in the frame at once — the second frozen in a
   * half-drawn pose, because the scroll loop that was presenting it stops the
   * moment an inspection begins.
   */
  raycast(clientX, clientY) {
    if (this.mode !== "scroll" || this.focusIndex < 0 || !this.proxies.length) return null;
    _v1.set((clientX / window.innerWidth) * 2 - 1, -((clientY / window.innerHeight) * 2 - 1), 0);
    this.raycaster.setFromCamera(_v1, this.camera);
    const hit = this.raycaster.intersectObjects(this.proxies, false)[0];
    const book = hit ? hit.object.userData.book : null;
    return book && book.userData.index === this.focusIndex ? book : null;
  }

  setHovered(book) {
    if (this.hovered === book) return;
    if (this.hovered) this.hovered.setHover(0);
    this.hovered = book;
    if (book) book.setHover(1);
    this.shadowsDirty = true;
  }

  /**
   * Editorial inspection composition.
   *
   * The final camera pose is solved first, then the volume is placed against
   * that pose, so the endpoint is exact rather than chased. Framing comes from
   * the live aspect ratio, which is why the volume lands in the same place on a
   * wide desktop and on a 390-wide phone.
   */
  planInspection(book) {
    const fov = this.mobile ? 45 : 32;
    const fill = this.mobile ? 0.4 : 0.6;
    const ndcX = this.mobile ? 0 : -0.44;
    // Set a little below centre on the wide layout: the volume is held closer
    // than the framing asked for, so it stands taller in the frame than it used
    // to, and the way back to the library is written across the top of it.
    const ndcY = this.mobile ? 0.32 : -0.08;

    this.camera.updateMatrixWorld(true);
    const cameraQuaternion = this.camera.getWorldQuaternion(new THREE.Quaternion());
    // Half a unit of push-in gives the move physical weight without
    // invalidating the framing, which is solved against this final position.
    _v2.set(0, 0, -0.55).applyQuaternion(cameraQuaternion);
    const cameraPosition = this.pathRig.position.clone().add(_v2);

    const halfAngle = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    const distance = book.dimensions.height / fill / (2 * halfAngle);
    const halfHeight = distance * halfAngle;
    const halfWidth = halfHeight * this.camera.aspect;

    _v1.set(ndcX * halfWidth, ndcY * halfHeight, -distance).applyQuaternion(cameraQuaternion);
    const position = cameraPosition.clone().add(_v1);

    /*
      The framing asks for a place; the room decides whether it can have it.

      Solved from the fill alone, that place is among the row the volume was
      taken from — the case is only so far from the lens, and a volume set at
      or behind its front face is drawn through its neighbours the whole way
      out and again while it is being read. The lateral half of the framing is
      what makes this more than a question of distance: the offset that sets
      the volume to one side of the frame is measured in the frame's own width,
      so a wider viewport swings it further along the row, and a volume that
      cleared the case on one shape of window is inside it on another.

      So the volume is pulled forward along the ray it is already sitting on.
      Sliding along that ray is what leaves the composition alone: the volume
      holds exactly the place in frame the framing gave it and only grows, the
      way a held object does as it is brought closer.

      The clearance is the volume's own reach — turned to its three-quarter
      pose, how far its back corner sits behind its centre — plus a margin for
      the row, whose volumes lean and stand proud of the face they are shelved
      behind.
    */
    const reach = book.dimensions.width * 0.5 * Math.sin(TURN) +
      book.dimensions.depth * 0.5 * Math.cos(TURN);
    const clear = SHELF.faceZ + reach + 0.8;
    _v3.copy(position).sub(cameraPosition).normalize();
    if (position.z < clear && _v3.z < -1e-4) {
      position.addScaledVector(_v3, (clear - position.z) / _v3.z);
    }

    // A slight three-quarter turn so the boards and the spine both read.
    const quaternion = cameraQuaternion.clone()
      .multiply(_q1.setFromEuler(new THREE.Euler(0.03, -TURN, 0)));

    return {
      camera: { position: cameraPosition, fov },
      book: { position, quaternion }
    };
  }

  beginInspection(book) {
    this.mode = "opening";
    this.inspected = book;
    this.setHovered(null);
    book.resetPresentation();
    // The volume being read is the one lit object in the room. It comes out of
    // the falloff the shelf was holding it in, which is carried by whatever the
    // traverse happened to be doing at the moment it was chosen, and the rest
    // of the collection goes down behind it. Nothing restores this: the scroll
    // loop owns the dim of every volume, and it takes them all back the frame
    // after the room returns.
    book.setDim(0);
    this.projectBooks.forEach((item) => {
      if (item !== book) item.setDim(0.9);
    });
    this.heroBook.setDim(0.9);
    this.shadowsDirty = true;
  }

  settleInspection() {
    this.mode = "inspection";
  }

  beginClosing() {
    this.mode = "closing";
    this.inspected?.setCoverOpen(0);
  }

  endInspection() {
    if (this.inspected) {
      this.inspected.resetPresentation();
      this.inspected.setCoverOpen(0);
      // Back to the transform captured before the volume was taken out.
      this.inspected.restoreBasePose();
    }
    this.inspected = null;
    this.inspectionBlend = 0;
    this.mode = "scroll";
    this.shadowsDirty = true;
  }

  /* ---------------------------------------------------------------- *
   * Lifecycle
   * ---------------------------------------------------------------- */

  samplePerformance(frameMs) {
    this.frameTimes.push(frameMs);
    if (this.frameTimes.length > 180) this.frameTimes.shift();
    if (frameMs > 24) this.slowFrames += 1;
    else this.slowFrames = Math.max(0, this.slowFrames - 2);

    // One conservative downgrade, and never an oscillation back up.
    if (this.slowFrames > 130 && this.quality.name !== "low") {
      this.quality.name = "low";
      this.quality.dpr = Math.min(this.quality.dpr, 1.15);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality.dpr));
      if (this.dust) this.dust.points.visible = false;
      this.lighting.practicals.forEach((spot) => { spot.castShadow = false; });
      this.lighting.tableLight.castShadow = false;
      this.slowFrames = 0;
      this.shadowsDirty = true;
    }
  }

  resize() {
    const wasCompact = this.compact;
    this.compact = window.innerWidth <= 900;
    this.mobile = window.innerWidth < 760;
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const cap = this.mobile ? Math.min(1.25, this.quality.dpr) : this.quality.dpr;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, cap));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (wasCompact !== this.compact) {
      this.curveKey = null;
      this.#buildCameraCurves();
    }
    this.shadowsDirty = true;
    this.settleFrames = 2;
  }

  stats() {
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] || 0;
    return {
      quality: this.quality.name,
      dpr: Number(this.renderer.getPixelRatio().toFixed(2)),
      mode: this.mode,
      focus: this.focusIndex,
      calls: this.renderer.info.render.calls,
      tris: this.renderer.info.render.triangles,
      textures: this.renderer.info.memory.textures,
      geometries: this.renderer.info.memory.geometries,
      programs: this.renderer.info.programs?.length || 0,
      fps50: Number((1000 / Math.max(1, at(0.5))).toFixed(1)),
      ms95: Number(at(0.95).toFixed(2))
    };
  }

  /** Screen-space bounds of a volume. Used by the verification pass. */
  screenBounds(book) {
    if (!book) return null;
    const box = new THREE.Box3().setFromObject(book);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < 8; i += 1) {
      _v1.set(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z
      ).project(this.camera);
      minX = Math.min(minX, _v1.x);
      minY = Math.min(minY, _v1.y);
      maxX = Math.max(maxX, _v1.x);
      maxY = Math.max(maxY, _v1.y);
    }
    return {
      x: [Number(minX.toFixed(3)), Number(maxX.toFixed(3))],
      y: [Number(minY.toFixed(3)), Number(maxY.toFixed(3))],
      width: Number((maxX - minX).toFixed(3)),
      height: Number((maxY - minY).toFixed(3)),
      onScreen: maxX > -1 && minX < 1 && maxY > -1 && minY < 1
    };
  }

  /**
   * How far a volume is from the pose the shelf chapter says it should be in.
   *
   * A volume in the collection is no longer parked at one transform: it lives
   * on a blend between shelved and presented. The invariant that matters after
   * an inspection is therefore that it has returned to that blend, not that it
   * has returned to the board.
   */
  restorationError(index) {
    const book = this.projectBooks[index];
    if (!book?.shelfPose) return null;
    book.composeTarget(book.presence, _v1, _q1);
    return {
      position: book.position.distanceTo(_v1),
      rotation: 1 - Math.abs(book.quaternion.dot(_q1)),
      scale: book.scale.distanceTo(book.basePose.scale)
    };
  }

  dispose() {
    this.running = false;
    this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.handleContextRestored);
    document.removeEventListener("visibilitychange", this.handleVisibility);

    this.projectBooks.forEach((book) => book.dispose());
    this.heroBook.dispose();
    disposeSharedBookGeometry();
    this.shadows.children.forEach((mesh) => {
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
    this.architecture.dispose();
    this.lighting.dispose();
    this.dust?.dispose();
    this.environmentMap.dispose();
    disposeTextures();
    this.renderer.dispose();
  }
}
