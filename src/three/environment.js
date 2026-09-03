import * as THREE from "three";
import { SITE } from "./architecture.js";

/**
 * Light rig and image-based lighting.
 *
 * The environment is generated in-engine: a small room of emissive panels is
 * rendered once through PMREMGenerator and then thrown away. Without it, the
 * brass rails and the foil stamping would be metals with nothing to reflect,
 * which is to say black. This one step is the difference between a book that
 * looks photographed and one that looks like a coloured box.
 */

function gradientTexture(stops, size = 64) {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, size);
  stops.forEach(([offset, colour]) => gradient.addColorStop(offset, colour));
  context.fillStyle = gradient;
  context.fillRect(0, 0, 4, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function buildEnvironmentMap(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const scene = new THREE.Scene();
  const disposables = [];

  // The room shell: warm ceiling bounce falling to a dark timber floor.
  const shellTexture = gradientTexture([
    [0, "#fff4e2"],
    [0.34, "#e8dcc6"],
    [0.62, "#9a8770"],
    [1, "#3d2e20"]
  ]);
  disposables.push(shellTexture);
  const shellGeometry = new THREE.BoxGeometry(30, 22, 30);
  const shellMaterial = new THREE.MeshBasicMaterial({ map: shellTexture, side: THREE.BackSide });
  disposables.push(shellGeometry, shellMaterial);
  scene.add(new THREE.Mesh(shellGeometry, shellMaterial));

  const panel = (colour, intensity, width, height, position, rotation) => {
    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(colour).multiplyScalar(intensity) });
    disposables.push(geometry, material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    if (rotation) mesh.rotation.set(...rotation);
    scene.add(mesh);
    return mesh;
  };

  // Broad softbox overhead, the photographic key source.
  panel("#fff6e8", 5.4, 16, 10, [0, 10.6, 1], [Math.PI / 2, 0, 0]);
  // Warm side bounce, roughly where the picture lights sit.
  panel("#ffd7a0", 3.2, 12, 5, [-9, 1.5, 4], [0, Math.PI / 2, 0]);
  // Cool counter-bounce so metals get a second, cooler highlight.
  panel("#cfd9e0", 1.35, 12, 5, [9, 2.5, 2], [0, -Math.PI / 2, 0]);
  // Low warm floor bounce. It is the only source reaching the undersides of
  // the shelves and the back of the case, so it decides whether the joinery
  // behind the collection reads as timber or as a hole.
  panel("#c39a6a", 1.7, 16, 8, [0, -7.5, 2], [-Math.PI / 2, 0, 0]);

  const target = pmrem.fromScene(scene, 0.04);
  disposables.forEach((item) => item.dispose());
  pmrem.dispose();
  return target.texture;
}

export function buildLighting({ scene, quality }) {
  const group = new THREE.Group();
  group.name = "lighting";
  scene.add(group);

  // Photographic key. Front-left and high, the way a still-life is lit.
  const key = new THREE.DirectionalLight(0xfff0d8, 3.1);
  key.position.set(-9, 15, 17);
  key.target.position.set(0, SITE.shelfY, SITE.caseBackZ);
  key.castShadow = quality.shadowMap > 0;
  key.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
  // Wide enough to hold the case and the reading table together. A frustum that
  // stops short of the table puts a straight unshadowed edge across it.
  key.shadow.camera.left = -18;
  key.shadow.camera.right = 18;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -22;
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 56;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.022;
  key.shadow.radius = 2.4;
  group.add(key, key.target);

  // Cool separation from behind the right shoulder.
  const rim = new THREE.DirectionalLight(0xd3dee6, 0.5);
  rim.position.set(13, 6, -8);
  rim.target.position.set(0, SITE.shelfY, 0);
  group.add(rim, rim.target);

  // Practicals under the brass picture lights. Warm, tight, shelf-height.
  const practicals = [-5.4, 0, 5.4].map((x, index) => {
    // The throw clears the full height of the case and the falloff is gentle,
    // so the three fixtures overlap into one continuous wash instead of three
    // bright patches with shadow standing between them.
    const spot = new THREE.SpotLight(0xffc98a, 0, 13, Math.PI * 0.36, 0.9, 1.15);
    spot.name = `practical-${index}`;
    spot.position.set(x, SITE.shelfY + SITE.shelfPitch - 0.55, SITE.caseFrontZ + 0.05);
    spot.target.position.set(x, SITE.shelfY + 0.6, SITE.caseBackZ + 0.4);
    spot.castShadow = quality.shadowMap > 0 && index === 1;
    if (spot.castShadow) {
      spot.shadow.mapSize.set(quality.shadowMap / 2, quality.shadowMap / 2);
      spot.shadow.bias = -0.001;
      spot.shadow.normalBias = 0.02;
      spot.shadow.camera.near = 0.4;
      spot.shadow.camera.far = 12;
    }
    group.add(spot, spot.target);
    return spot;
  });

  // The floor the whole room stands on.
  //
  // Every surface in this building is a pale one — oak, plaster, buckram, a
  // light warm grey on the joinery — so a room lit only by its key and its
  // practicals renders those materials at a fraction of the colour they were
  // authored in and reads as a dark room rather than a warm one. This is the
  // bounce that never comes from anywhere in particular: sky above, oak below,
  // enough of it that shadow is a place you can still see into.
  const ambient = new THREE.HemisphereLight(0xf5e6cd, 0x33251a, 0.62);
  group.add(ambient);

  // Table lamp for the reading room and the commission close-up.
  // Range has to clear the table, not end on it.
  // Tight enough to read as a lamp throwing a pool, not a wash over the room.
  const tableLight = new THREE.SpotLight(0xffd9a6, 0, 26, Math.PI * 0.17, 0.6, 1.3);
  tableLight.position.set(SITE.table.x + 1.2, SITE.table.y + 5.6, SITE.table.z + 2.4);
  tableLight.target.position.set(SITE.table.x, SITE.table.y, SITE.table.z);
  tableLight.castShadow = quality.shadowMap > 0;
  if (tableLight.castShadow) {
    tableLight.shadow.mapSize.set(quality.shadowMap / 2, quality.shadowMap / 2);
    tableLight.shadow.bias = -0.0009;
    tableLight.shadow.normalBias = 0.02;
    tableLight.shadow.camera.near = 1;
    tableLight.shadow.camera.far = 20;
  }
  group.add(tableLight, tableLight.target);

  // Close key for the frontispiece. A flat board under a purely directional
  // light has no gradient across it at all, which is what makes a rendered
  // cover read as a coloured rectangle. A source with real falloff, set just
  // off the volume's shoulder, is what gives the cloth its shape.
  const heroKey = new THREE.SpotLight(0xfff2df, 0, 16, Math.PI * 0.36, 0.95, 1.1);
  heroKey.name = "frontispiece-key";
  heroKey.castShadow = false;
  group.add(heroKey, heroKey.target);

  // A reading light for the volume standing out of the collection.
  //
  // Wide, heavily feathered and warm: this is meant to read as somebody having
  // leaned in with a lamp, not as a second spotlight. Because the cone is broad
  // it lifts the shelf immediately around the volume as well as the volume
  // itself, which is the point — a book picked out of a black row looks cut
  // out of it, and a book picked out of a lit one looks like it belongs there.
  const focusKey = new THREE.SpotLight(0xffe0b4, 0, 14, Math.PI * 0.26, 0.95, 1.2);
  focusKey.name = "focus-key";
  focusKey.visible = false;
  focusKey.castShadow = false;
  group.add(focusKey, focusKey.target);

  // Controlled studio light for a volume taken off the shelf. Off until needed.
  //
  // The cone is narrow and the throw is short, and that is what makes the
  // volume the lit object rather than simply a brighter part of a brighter
  // room. A wide source at this intensity reaches the case standing behind the
  // volume, so raising it lifts the room by as much as the book and the volume
  // reads no more separated than it did before.
  const inspect = new THREE.SpotLight(0xfff1da, 0, 11, Math.PI * 0.13, 0.6, 1.2);
  inspect.name = "inspection-key";
  inspect.visible = false;
  inspect.castShadow = false;
  group.add(inspect, inspect.target);

  return {
    group,
    key,
    rim,
    practicals,
    ambient,
    tableLight,
    heroKey,
    focusKey,
    inspect,
    dispose() {
      practicals.forEach((spot) => spot.shadow?.map?.dispose());
      key.shadow?.map?.dispose();
      tableLight.shadow?.map?.dispose();
      scene.remove(group);
    }
  };
}

/** Motes suspended in the shelf light. Never a snowstorm. */
export function buildDust(count) {
  if (count <= 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, "rgba(255, 244, 224, 1)");
  gradient.addColorStop(0.4, "rgba(255, 236, 206, 0.4)");
  gradient.addColorStop(1, "rgba(255, 236, 206, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 32, 32);
  const sprite = new THREE.CanvasTexture(canvas);
  sprite.colorSpace = THREE.SRGBColorSpace;

  const positions = new Float32Array(count * 3);
  const drift = new Float32Array(count * 2);
  let seed = 0x1b3f;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (random() - 0.5) * 22;
    positions[i * 3 + 1] = SITE.shelfY - 3 + random() * 8;
    positions[i * 3 + 2] = SITE.caseFrontZ + random() * 7;
    drift[i * 2] = random() * Math.PI * 2;
    drift[i * 2 + 1] = 0.25 + random() * 0.7;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    map: sprite,
    color: 0xffe9c8,
    size: 0.075,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const points = new THREE.Points(geometry, material);
  points.name = "dust";
  points.frustumCulled = false;
  points.userData.drift = drift;
  points.userData.base = positions.slice();

  return {
    points,
    material,
    update(elapsed) {
      const array = geometry.attributes.position.array;
      const base = points.userData.base;
      for (let i = 0; i < count; i += 1) {
        const phase = drift[i * 2];
        const speed = drift[i * 2 + 1];
        array[i * 3] = base[i * 3] + Math.sin(elapsed * speed * 0.18 + phase) * 0.34;
        array[i * 3 + 1] = base[i * 3 + 1] + Math.sin(elapsed * speed * 0.11 + phase * 1.7) * 0.22;
      }
      geometry.attributes.position.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      sprite.dispose();
    }
  };
}
