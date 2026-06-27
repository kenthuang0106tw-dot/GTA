import * as THREE from "../vendor/three.module.js";
import { GLTFLoader } from "../vendor/GLTFLoader.js";

const root = document.getElementById("game");
const healthEl = document.getElementById("health");
const armorEl = document.getElementById("armor");
const ammoEl = document.getElementById("ammo");
const modeEl = document.getElementById("mode");
const starsEl = document.getElementById("stars");
const missionEl = document.getElementById("mission");
const weaponEl = document.getElementById("weapon");
missionEl.textContent = "Booting 3D renderer...";

const WORLD = 2600;
const ROAD_EVERY = 280;
const ROAD_W = 58;
const keys = new Set();
const colliders = [];
const vehicles = [];
const pedestrians = [];
const cops = [];
const bullets = [];
const particles = [];
const carModels = {};
const input = { x: 0, y: 0, lookX: 0, lookY: 0, fire: false, gas: false };
const center = new THREE.Vector2(0, 0);
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();

let audioCtx = null;
let engineOsc = null;
let engineGain = null;

const player = {
  pos: new THREE.Vector3(0, 7.2, -96),
  yaw: Math.PI,
  pitch: -0.02,
  health: 100,
  armor: 35,
  ammo: 48,
  wanted: 0,
  shootCd: 0,
  meleeCd: 0,
  reloadCd: 0,
  car: null
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd7b67e);
scene.fog = new THREE.FogExp2(0xd7b67e, 0.00072);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 900);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
root.appendChild(renderer.domElement);

const textureLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();
const textures = {
  asphalt: loadTexture("./assets/textures/asphalt.svg", 8),
  facade: loadTexture("./assets/textures/facade.svg", 2),
  grass: loadTexture("./assets/textures/grass.svg", 10),
  sidewalk: loadTexture("./assets/textures/sidewalk.svg", 8),
  sky: loadTexture("./assets/textures/sky.svg", 1)
};

const mats = {
  ground: new THREE.MeshStandardMaterial({ color: 0x8b8657, map: textures.grass, roughness: 0.92 }),
  road: new THREE.MeshStandardMaterial({ color: 0x4a4437, map: textures.asphalt, roughness: 0.94, emissive: 0x120f0a, emissiveIntensity: 0.42 }),
  sidewalk: new THREE.MeshStandardMaterial({ color: 0xa0947c, map: textures.sidewalk, roughness: 0.86, emissive: 0x080706, emissiveIntensity: 0.22 }),
  facade: colors => new THREE.MeshStandardMaterial({ color: colors, map: textures.facade, roughness: 0.84, metalness: 0.03, emissive: 0x100d08, emissiveIntensity: 0.28 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x272a2a, roughness: 0.8 }),
  line: new THREE.MeshBasicMaterial({ color: 0xd6c57b }),
  tire: new THREE.MeshStandardMaterial({ color: 0x070707, roughness: 0.85 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x17222a, roughness: 0.28, metalness: 0.18 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xd4d0c2, roughness: 0.32, metalness: 0.55 }),
  skin: new THREE.MeshStandardMaterial({ color: 0xd9b38d, roughness: 0.72 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x25211f, roughness: 0.8 }),
  black: new THREE.MeshBasicMaterial({ color: 0x080706 }),
  warmWindow: new THREE.MeshBasicMaterial({ color: 0xffd27a }),
  coldWindow: new THREE.MeshBasicMaterial({ color: 0x82b7c8 }),
  shopGlass: new THREE.MeshStandardMaterial({ color: 0x16272d, roughness: 0.18, metalness: 0.18, emissive: 0x061014, emissiveIntensity: 0.55 }),
  curb: new THREE.MeshStandardMaterial({ color: 0xd6c8a2, roughness: 0.7 }),
  whitePaint: new THREE.MeshBasicMaterial({ color: 0xf5ead0 }),
  yellowPaint: new THREE.MeshBasicMaterial({ color: 0xd9b84f })
};

const carModelPaths = {
  sedan: "./assets/models/cars/sedan.glb",
  taxi: "./assets/models/cars/taxi.glb",
  suv: "./assets/models/cars/suv.glb",
  van: "./assets/models/cars/van.glb",
  police: "./assets/models/cars/police.glb"
};

const carPalettes = {
  sedan: 0xa63d2e,
  taxi: 0xe6c139,
  suv: 0x2e5f7e,
  van: 0x6b7378,
  police: 0xf1f2ed
};

for (const [name, path] of Object.entries(carModelPaths)) {
  gltfLoader.load(path, gltf => {
    carModels[name] = gltf.scene;
    for (const car of vehicles) {
      if (car.modelName === name) applyCarModel(car);
    }
  });
}

const hemi = new THREE.HemisphereLight(0xffefc2, 0x7a725b, 2.25);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffd090, 3.45);
sun.position.set(-160, 260, 90);
sun.castShadow = true;
sun.shadow.camera.left = -360;
sun.shadow.camera.right = 360;
sun.shadow.camera.top = 360;
sun.shadow.camera.bottom = -360;
scene.add(sun);

function loadTexture(path, repeat) {
  const texture = textureLoader.load(path);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  return texture;
}

function rnd(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function isRoad(x, z) {
  const gx = Math.abs(((x + ROAD_EVERY / 2) % ROAD_EVERY) - ROAD_EVERY / 2);
  const gz = Math.abs(((z + ROAD_EVERY / 2) % ROAD_EVERY) - ROAD_EVERY / 2);
  return gx < ROAD_W / 2 || gz < ROAD_W / 2;
}

function box(w, h, d, mat, x, y, z, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = cast;
  scene.add(mesh);
  return mesh;
}

function addTo(group, mesh, x, y, z) {
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function spawnCity() {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(WORLD * 0.72, 24, 12),
    new THREE.MeshBasicMaterial({ color: 0xd9b87f, side: THREE.BackSide, depthWrite: false })
  );
  sky.position.y = 90;
  scene.add(sky);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, WORLD), mats.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  for (let i = -WORLD / 2; i <= WORLD / 2; i += ROAD_EVERY) {
    box(ROAD_W, 0.08, WORLD, mats.road, i, 0.02, 0, false);
    box(WORLD, 0.08, ROAD_W, mats.road, 0, 0.025, i, false);
    box(3, 0.14, WORLD, mats.line, i, 0.12, 0, false);
    box(WORLD, 0.14, 3, mats.line, 0, 0.125, i, false);

    const sideOffset = ROAD_W / 2 + 10;
    box(14, 0.12, WORLD, mats.sidewalk, i - sideOffset, 0.09, 0, false);
    box(14, 0.12, WORLD, mats.sidewalk, i + sideOffset, 0.09, 0, false);
    box(WORLD, 0.12, 14, mats.sidewalk, 0, 0.095, i - sideOffset, false);
    box(WORLD, 0.12, 14, mats.sidewalk, 0, 0.095, i + sideOffset, false);

    box(2, 0.2, WORLD, mats.curb, i - ROAD_W / 2, 0.2, 0, false);
    box(2, 0.2, WORLD, mats.curb, i + ROAD_W / 2, 0.2, 0, false);
    box(WORLD, 0.2, 2, mats.curb, 0, 0.205, i - ROAD_W / 2, false);
    box(WORLD, 0.2, 2, mats.curb, 0, 0.205, i + ROAD_W / 2, false);
  }

  const facadeColors = [0x8b8274, 0x787f85, 0x6e818c, 0x808773, 0x747486];
  for (let ix = -WORLD / 2 + 90; ix < WORLD / 2 - 90; ix += 145) {
    for (let iz = -WORLD / 2 + 90; iz < WORLD / 2 - 90; iz += 145) {
      if (isRoad(ix, iz) || rnd(ix + iz) < 0.25) continue;
      const w = 48 + rnd(ix * 2 + iz) * 54;
      const d = 48 + rnd(ix + iz * 2) * 54;
      const h = 26 + rnd(ix * iz) * 120;
      const mat = mats.facade(facadeColors[Math.floor(rnd(ix - iz) * facadeColors.length)]);
      const b = box(w, h, d, mat, ix, h / 2, iz);
      b.userData.solid = true;
      colliders.push({ mesh: b, x: ix, z: iz, w, d });
      box(w * 0.92, 1.5, d * 0.92, mats.roof, ix, h + 1, iz, false);
      decorateBuilding(ix, iz, w, d, h, ix + iz);

      if (rnd(ix + iz * 4) > 0.72) {
        const signMat = new THREE.MeshBasicMaterial({ color: [0xffc857, 0x3dd6d0, 0xff6b6b][Math.floor(rnd(ix) * 3)] });
        box(w * 0.5, 5, 1, signMat, ix, Math.min(h - 8, 22), iz - d / 2 - 0.8, false);
      }
    }
  }

  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2;
    const dist = WORLD * 0.46;
    const h = 120 + rnd(i) * 260;
    const w = 60 + rnd(i + 2) * 90;
    box(w, h, w * 0.8, new THREE.MeshStandardMaterial({ color: 0x6c7071, roughness: 0.95 }), Math.sin(a) * dist, h / 2 - 8, Math.cos(a) * dist, false);
  }

  for (let i = 0; i < 210; i++) {
    const vertical = rnd(i) > 0.5;
    const lane = Math.floor(rnd(i + 14) * 9 - 4) * ROAD_EVERY + (rnd(i + 17) - 0.5) * 28;
    const along = -WORLD / 2 + 110 + rnd(i + 23) * (WORLD - 220);
    const x = vertical ? lane : along;
    const z = vertical ? along : lane;
    if (rnd(i + 11) > 0.5) spawnLamp(x + 38, z + 38);
    else spawnTree(x + 38, z + 38);
  }

  decorateMainStreet();
}

function decorateBuilding(x, z, w, d, h, seed) {
  const floors = Math.max(2, Math.floor(h / 16));
  const colsFront = Math.max(2, Math.floor(w / 16));
  const colsSide = Math.max(2, Math.floor(d / 18));
  for (let floor = 0; floor < Math.min(floors, 8); floor++) {
    const y = 10 + floor * 14;
    if (y > h - 8) break;
    for (let i = 0; i < colsFront; i++) {
      const px = x - w * 0.38 + (i / Math.max(1, colsFront - 1)) * w * 0.76;
      const lit = rnd(seed + floor * 19 + i * 5) > 0.62;
      const mat = lit ? mats.warmWindow : mats.black;
      box(5.4, 6.2, 0.7, mat, px, y, z - d / 2 - 0.45, false);
      box(5.4, 0.6, 0.9, mats.dark, px, y + 3.5, z - d / 2 - 0.5, false);
      box(5.4, 6.2, 0.7, mat, px, y, z + d / 2 + 0.45, false);
    }
    for (let i = 0; i < colsSide; i++) {
      const pz = z - d * 0.36 + (i / Math.max(1, colsSide - 1)) * d * 0.72;
      const mat = rnd(seed + floor * 11 + i * 3) > 0.68 ? mats.coldWindow : mats.black;
      box(0.7, 5.8, 5, mat, x - w / 2 - 0.45, y, pz, false);
      box(0.7, 5.8, 5, mat, x + w / 2 + 0.45, y, pz, false);
    }
  }

  if (w > 65 && d > 65) {
    box(12, 5, 10, new THREE.MeshStandardMaterial({ color: 0x3a3b38, roughness: 0.72 }), x - w * 0.22, h + 4.3, z + d * 0.18, false);
    box(7, 9, 7, new THREE.MeshStandardMaterial({ color: 0x4c4d47, roughness: 0.68 }), x + w * 0.18, h + 6.2, z - d * 0.18, false);
  }
}

function decorateMainStreet() {
  box(86, 0.16, 980, mats.road, 0, 0.28, 250, false);
  box(2.4, 0.2, 900, mats.curb, -35, 0.38, 250, false);
  box(2.4, 0.2, 900, mats.curb, 35, 0.38, 250, false);
  box(30, 0.18, 980, mats.road, -58, 0.27, 250, false);
  box(30, 0.18, 980, mats.road, 58, 0.27, 250, false);

  for (let z = -120; z <= 640; z += 72) {
    addLaneDash(0, z);
  }

  addCrosswalk(0, 42);
  addCrosswalk(0, 318);
  spawnTrafficLight(-42, 42, 1);
  spawnTrafficLight(42, 318, -1);

  for (let z = 18; z <= 520; z += 72) {
    addStorefront(-68, z, 1, z);
    addStorefront(68, z + 28, -1, z + 4);
  }

  for (let z = -42; z <= 520; z += 112) {
    const left = makeVehicle(-38, z, false);
    left.group.rotation.y = Math.PI;
    left.ai = false;
    left.speed = 0;
    const right = makeVehicle(38, z + 56, false);
    right.group.rotation.y = 0;
    right.ai = false;
    right.speed = 0;
  }

  for (let z = 0; z <= 600; z += 64) {
    spawnTrashCan(-51, z + 18);
    spawnNewsBox(51, z + 46);
    spawnPostBox(-50, z + 46);
    spawnPlanter(50, z + 18);
    spawnLamp(-55, z + 36);
    spawnLamp(55, z + 4);
  }

  for (let z = -34; z <= 210; z += 48) {
    makePedestrian(-24, z + 18);
    makePedestrian(24, z + 42);
  }

  const showcase = makeVehicle(0, 78, false);
  showcase.group.rotation.y = Math.PI;
  showcase.ai = false;
  showcase.speed = 0;
}

function addLaneDash(x, z) {
  box(2.2, 0.12, 34, mats.yellowPaint, x, 0.44, z, false);
}

function addCrosswalk(x, z) {
  for (let i = -4; i <= 4; i++) {
    box(9, 0.13, 46, mats.whitePaint, x + i * 9, 0.45, z, false);
  }
}

function addStorefront(x, z, side, seed) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;

  const wallMat = new THREE.MeshStandardMaterial({
    color: [0x8a7358, 0x776d63, 0x716f82, 0x7f806c][Math.floor(rnd(seed) * 4)],
    roughness: 0.82
  });
  addTo(group, new THREE.Mesh(new THREE.BoxGeometry(42, 54, 5), wallMat), 0, 27, 0);
  addTo(group, new THREE.Mesh(new THREE.BoxGeometry(32, 12, 1.2), mats.shopGlass), 0, 8, -3.1);
  addTo(group, new THREE.Mesh(new THREE.BoxGeometry(7, 10, 1.3), new THREE.MeshStandardMaterial({ color: 0x2f2420, roughness: 0.7 })), -13, 6, -3.9);
  addTo(group, new THREE.Mesh(new THREE.BoxGeometry(5, 5.5, 1.4), mats.shopGlass), -13, 8, -4.2);

  const signColor = [0xff6158, 0xffc857, 0x5be0c7, 0x77a6ff][Math.floor(rnd(seed + 9) * 4)];
  const sign = addTo(group, new THREE.Mesh(new THREE.BoxGeometry(36, 5, 1.4), new THREE.MeshBasicMaterial({ color: signColor })), 0, 18, -3.7);
  const awning = addTo(group, new THREE.Mesh(new THREE.BoxGeometry(39, 2.5, 8), new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.6 })), 0, 14, -6);
  awning.rotation.x = -0.12;
  sign.userData.decor = true;

  for (let i = -1; i <= 1; i++) {
    addTo(group, new THREE.Mesh(new THREE.BoxGeometry(7, 3, 1), new THREE.MeshBasicMaterial({ color: 0xffefb2 })), i * 10, 8, -3.8);
  }
  for (let floor = 0; floor < 3; floor++) {
    for (let i = -1; i <= 1; i++) {
      const lit = rnd(seed + floor * 13 + i * 7) > 0.48;
      const mat = new THREE.MeshBasicMaterial({ color: lit ? 0xffd37a : 0x17120d });
      const wx = i * 12;
      const wy = 28 + floor * 8;
      addTo(group, new THREE.Mesh(new THREE.BoxGeometry(5.8, 4.2, 1), mat), wx, wy, -3.7);
      addTo(group, new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.55, 1.2), mats.dark), wx, wy + 2.45, -3.95);
      addTo(group, new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.55, 1.2), mats.dark), wx, wy - 2.45, -3.95);
      addTo(group, new THREE.Mesh(new THREE.BoxGeometry(0.55, 5.4, 1.2), mats.dark), wx - 3.6, wy, -3.95);
      addTo(group, new THREE.Mesh(new THREE.BoxGeometry(0.55, 5.4, 1.2), mats.dark), wx + 3.6, wy, -3.95);
      if (floor === 1 && i === 1) {
        addTo(group, new THREE.Mesh(new THREE.BoxGeometry(5.8, 1.8, 2.2), new THREE.MeshStandardMaterial({ color: 0xc5c0ad, roughness: 0.55 })), wx, wy - 4.2, -4.9);
        addTo(group, new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.7, 3), mats.dark), wx, wy - 6.4, -5.2);
      }
    }
  }
  const bladeColor = [0xff4e56, 0x47f0c9, 0xffd45a][Math.floor(rnd(seed + 31) * 3)];
  addTo(group, new THREE.Mesh(new THREE.BoxGeometry(2.2, 14, 1.3), new THREE.MeshBasicMaterial({ color: bladeColor })), 20, 25, -5.2);
  addTo(group, new THREE.Mesh(new THREE.BoxGeometry(5, 3, 2), new THREE.MeshStandardMaterial({ color: 0xc8c2ad, roughness: 0.55 })), -20, 25, -4.8);
  for (let floor = 0; floor < 2; floor++) {
    const y = 30 + floor * 10;
    addTo(group, new THREE.Mesh(new THREE.BoxGeometry(10, 0.8, 4), mats.dark), -18, y - 4, -5.4);
    addTo(group, new THREE.Mesh(new THREE.BoxGeometry(0.6, 5, 0.8), mats.dark), -22.5, y - 1.6, -5.4);
    addTo(group, new THREE.Mesh(new THREE.BoxGeometry(0.6, 5, 0.8), mats.dark), -13.5, y - 1.6, -5.4);
  }
  addTo(group, new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 5, 12), new THREE.MeshStandardMaterial({ color: 0x4b5658, roughness: 0.62, metalness: 0.18 })), 0, 58, 0);

  scene.add(group);
}

function spawnTrashCan(x, z) {
  const can = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 5, 8), new THREE.MeshStandardMaterial({ color: 0x26322d, roughness: 0.8 }));
  can.position.set(x, 2.5, z);
  can.castShadow = true;
  scene.add(can);
}

function spawnNewsBox(x, z) {
  box(5.2, 6.2, 3.5, new THREE.MeshStandardMaterial({ color: 0x2b6aa0, roughness: 0.52 }), x, 3.1, z);
}

function spawnPostBox(x, z) {
  box(4.2, 5.4, 3.2, new THREE.MeshStandardMaterial({ color: 0xb7362e, roughness: 0.55 }), x, 2.7, z);
  box(3.8, 0.35, 3.4, new THREE.MeshBasicMaterial({ color: 0xffd9ad }), x, 4.2, z - 1.8, false);
}

function spawnPlanter(x, z) {
  box(9, 3, 4.6, new THREE.MeshStandardMaterial({ color: 0x554438, roughness: 0.78 }), x, 1.5, z);
  const shrub = new THREE.Mesh(new THREE.DodecahedronGeometry(4.2, 0), new THREE.MeshStandardMaterial({ color: 0x3f7a46, roughness: 0.8 }));
  shrub.position.set(x, 5.2, z);
  shrub.castShadow = true;
  scene.add(shrub);
}

function spawnTrafficLight(x, z, side) {
  box(1.2, 18, 1.2, new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.35 }), x, 9, z);
  box(17, 1.1, 1.1, new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.35 }), x + side * 8, 17.4, z);
  const housing = box(3.2, 8, 2.2, new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.58 }), x + side * 16, 14.2, z);
  housing.rotation.y = Math.PI / 2;
  for (let i = 0; i < 3; i++) {
    const color = [0xff2d2d, 0xffc82f, 0x44e062][i];
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), new THREE.MeshBasicMaterial({ color }));
    bulb.position.set(x + side * 16, 16.4 - i * 2.4, z - 1.2);
    scene.add(bulb);
  }
}

function spawnLamp(x, z) {
  box(1.2, 13, 1.2, new THREE.MeshStandardMaterial({ color: 0x30302d, roughness: 0.55, metalness: 0.3 }), x, 6.5, z);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(2.8, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd782 }));
  bulb.position.set(x, 14, z);
  scene.add(bulb);
}

function spawnTree(x, z) {
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3824, roughness: 0.82 });
  const leafMats = [
    new THREE.MeshStandardMaterial({ color: 0x2f6a3d, roughness: 0.86 }),
    new THREE.MeshStandardMaterial({ color: 0x3f7e45, roughness: 0.86 }),
    new THREE.MeshStandardMaterial({ color: 0x244f34, roughness: 0.9 })
  ];
  box(11, 1.2, 11, new THREE.MeshStandardMaterial({ color: 0x5a5040, roughness: 0.78 }), x, 0.6, z, false);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.4, 15, 8), trunkMat);
  trunk.position.set(x, 7.5, z);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  scene.add(trunk);

  for (let i = 0; i < 4; i++) {
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.8, 8, 6), trunkMat);
    branch.position.set(x + Math.sin(i * Math.PI / 2) * 3.2, 15 + i * 0.9, z + Math.cos(i * Math.PI / 2) * 3.2);
    branch.rotation.z = Math.sin(i * Math.PI / 2) * 0.72;
    branch.rotation.x = Math.cos(i * Math.PI / 2) * 0.72;
    branch.castShadow = true;
    scene.add(branch);
  }

  const clumps = [
    [0, 23, 0, 12, 16],
    [-6, 19, 2, 9, 12],
    [6, 20, -2, 9, 12],
    [0, 18, 7, 8, 10]
  ];
  for (let i = 0; i < clumps.length; i++) {
    const [ox, oy, oz, r, h] = clumps[i];
    const top = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), leafMats[i % leafMats.length]);
    top.position.set(x + ox, oy, z + oz);
    top.rotation.y = rnd(x + z + i) * Math.PI;
    top.castShadow = true;
    top.receiveShadow = true;
    scene.add(top);
  }
}

function makeVehicle(x, z, police = false) {
  const group = new THREE.Group();
  group.position.set(x, 0.55, z);
  group.rotation.y = rnd(x + z) * Math.PI * 2;
  const visual = new THREE.Group();
  group.add(visual);

  const colors = [0xb64234, 0x27689a, 0xdbb94c, 0x394044, 0x6f8b58, 0x7d487f];
  const modelPool = ["sedan", "taxi", "suv", "van"];
  const modelName = police ? "police" : modelPool[Math.floor(rnd(x + z + 19) * modelPool.length)];
  const bodyMat = new THREE.MeshStandardMaterial({
    color: police ? 0xe9ebe2 : colors[Math.floor(rnd(x) * colors.length)],
    roughness: 0.48,
    metalness: 0.18
  });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe4a0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff322f });

  addTo(visual, new THREE.Mesh(new THREE.BoxGeometry(18, 4.6, 31), bodyMat), 0, 3.3, 0);
  addTo(visual, new THREE.Mesh(new THREE.BoxGeometry(16, 3.2, 12), bodyMat), 0, 5.1, -12);
  addTo(visual, new THREE.Mesh(new THREE.BoxGeometry(16, 3, 8), bodyMat), 0, 5, 13);
  addTo(visual, new THREE.Mesh(new THREE.BoxGeometry(13, 6, 13), mats.glass), 0, 8, -1);
  addTo(visual, new THREE.Mesh(new THREE.BoxGeometry(17, 2, 1.6), mats.chrome), 0, 2.6, -16.6);
  addTo(visual, new THREE.Mesh(new THREE.BoxGeometry(17, 2, 1.6), mats.chrome), 0, 2.6, 16.6);

  const wheels = [];
  for (const sx of [-8.8, 8.8]) {
    for (const sz of [-11, 11]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 2.2, 10), mats.tire);
      wheel.rotation.z = Math.PI / 2;
      addTo(visual, wheel, sx, 2, sz);
      wheels.push(wheel);
    }
  }

  for (const sx of [-5.5, 5.5]) {
    addTo(visual, new THREE.Mesh(new THREE.BoxGeometry(4, 1.3, 0.6), headMat), sx, 4.2, -17.6);
    addTo(visual, new THREE.Mesh(new THREE.BoxGeometry(4, 1.3, 0.6), tailMat), sx, 4.2, 17.6);
  }

  let siren = null;
  if (police) {
    siren = addTo(visual, new THREE.Mesh(new THREE.BoxGeometry(9, 1.2, 2.5), new THREE.MeshBasicMaterial({ color: 0x224dff })), 0, 12, -3);
    addTo(visual, new THREE.Mesh(new THREE.BoxGeometry(18.4, 0.2, 5), new THREE.MeshBasicMaterial({ color: 0x1c3047 })), 0, 5.7, 4);
  }

  scene.add(group);
  const car = {
    group,
    visual,
    modelName,
    wheels,
    siren,
    police,
    occupied: false,
    ai: true,
    hp: police ? 150 : 100,
    speed: 18 + rnd(x - z) * 24,
    turnTimer: rnd(x + z) * 2
  };
  vehicles.push(car);
  if (police) cops.push(car);
  applyCarModel(car);
  return car;
}

function applyCarModel(car) {
  const source = carModels[car.modelName];
  if (!source) return;
  car.visual.clear();
  const model = source.clone(true);
  const bodyColor = carPalettes[car.modelName] || 0x8a8f92;
  model.traverse(child => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      const name = `${child.name} ${child.material?.name || ""}`.toLowerCase();
      const mat = child.material?.clone?.() || new THREE.MeshStandardMaterial();
      if (name.includes("wheel")) {
        mat.color = new THREE.Color(0x080808);
        mat.roughness = 0.88;
        mat.metalness = 0.05;
      } else if (!mat.map) {
        mat.color = new THREE.Color(bodyColor);
        mat.roughness = 0.52;
        mat.metalness = 0.12;
      } else {
        mat.color = new THREE.Color(0xffffff);
        mat.roughness = 0.58;
        mat.metalness = 0.04;
      }
      child.material = mat;
      child.material.needsUpdate = true;
    }
  });
  model.scale.setScalar(7.8);
  model.position.set(0, 0.2, 0);
  model.rotation.y = Math.PI;
  car.visual.add(model);
  addCarModelTrim(car, bodyColor);
}

function addCarModelTrim(car, bodyColor) {
  const glass = new THREE.MeshStandardMaterial({ color: 0x111b22, roughness: 0.22, metalness: 0.12, emissive: 0x03080c, emissiveIntensity: 0.35 });
  const head = new THREE.MeshBasicMaterial({ color: 0xffe7a0 });
  const tail = new THREE.MeshBasicMaterial({ color: 0xff3a2f });
  const plate = new THREE.MeshBasicMaterial({ color: 0xf2ead0 });
  const trim = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5, metalness: 0.16 });

  addTo(car.visual, new THREE.Mesh(new THREE.BoxGeometry(12, 0.3, 7), glass), 0, 7.6, -3.5);
  addTo(car.visual, new THREE.Mesh(new THREE.BoxGeometry(4, 3, 0.28), glass), -7.1, 5.9, -1.5);
  addTo(car.visual, new THREE.Mesh(new THREE.BoxGeometry(4, 3, 0.28), glass), 7.1, 5.9, -1.5);
  addTo(car.visual, new THREE.Mesh(new THREE.BoxGeometry(13, 0.7, 1.1), trim), 0, 4.6, -13.6);
  addTo(car.visual, new THREE.Mesh(new THREE.BoxGeometry(13, 0.7, 1.1), trim), 0, 4.6, 13.6);

  for (const sx of [-4.5, 4.5]) {
    addTo(car.visual, new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 0.55), head), sx, 4.2, -15.6);
    addTo(car.visual, new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 0.55), tail), sx, 4.2, 15.6);
  }
  addTo(car.visual, new THREE.Mesh(new THREE.BoxGeometry(5, 1.2, 0.42), plate), 0, 3.1, -16.05);
  addTo(car.visual, new THREE.Mesh(new THREE.BoxGeometry(5, 1.2, 0.42), plate), 0, 3.1, 16.05);

  if (car.police) {
    addTo(car.visual, new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.9, 2), new THREE.MeshBasicMaterial({ color: 0x2365ff })), -2.6, 8.9, -2.5);
    addTo(car.visual, new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.9, 2), new THREE.MeshBasicMaterial({ color: 0xff3030 })), 2.6, 8.9, -2.5);
  }
}

function makePedestrian(x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const clothes = [0xc98b6a, 0x8fb6cf, 0xb9a36c, 0x8aa66a, 0xaf7b91];
  const pantsColors = [0x1c252d, 0x2c2a25, 0x343a4a, 0x3b2f2f];
  const cloth = new THREE.MeshStandardMaterial({ color: clothes[Math.floor(rnd(x + z) * clothes.length)], roughness: 0.78 });
  const pants = new THREE.MeshStandardMaterial({ color: pantsColors[Math.floor(rnd(x - z) * pantsColors.length)], roughness: 0.78 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x080706, roughness: 0.7 });
  const accent = new THREE.MeshStandardMaterial({ color: [0xf0d06c, 0x79c5d6, 0xdc7063][Math.floor(rnd(x + 12) * 3)], roughness: 0.65 });
  const torso = addTo(group, new THREE.Mesh(new THREE.BoxGeometry(3.7, 5.4, 2.4), cloth), 0, 6.2, 0);
  addTo(group, new THREE.Mesh(new THREE.BoxGeometry(4, 0.75, 2.55), accent), 0, 8.8, -0.03);
  addTo(group, new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.55, 2.55), mats.dark), 0, 3.65, -0.02);
  const head = addTo(group, new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.7, 2.7), mats.skin), 0, 10.2, 0);
  const hair = addTo(group, new THREE.Mesh(new THREE.BoxGeometry(2.95, 0.95, 2.95), mats.dark), 0, 11.55, 0);
  addTo(group, new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 0.55), mats.dark), 0, 10.95, -1.55);
  addTo(group, new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.18), mats.black), -0.55, 10.35, -1.45);
  addTo(group, new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.18), mats.black), 0.55, 10.35, -1.45);
  addTo(group, new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.22, 0.16), new THREE.MeshBasicMaterial({ color: 0x7b3a32 })), 0, 9.75, -1.46);
  const leftArm = addTo(group, new THREE.Mesh(new THREE.BoxGeometry(1.05, 4.5, 0.9), mats.skin), -2.55, 5.8, 0);
  const rightArm = addTo(group, new THREE.Mesh(new THREE.BoxGeometry(1.05, 4.5, 0.9), mats.skin), 2.55, 5.8, 0);
  addTo(group, new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.2, 0.95), cloth), -2.55, 8.45, 0);
  addTo(group, new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.2, 0.95), cloth), 2.55, 8.45, 0);
  addTo(group, new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 0.95), mats.skin), -2.55, 3.1, 0);
  addTo(group, new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 0.95), mats.skin), 2.55, 3.1, 0);
  const leftLeg = addTo(group, new THREE.Mesh(new THREE.BoxGeometry(1.15, 4.3, 1.05), pants), -0.85, 2.4, 0);
  const rightLeg = addTo(group, new THREE.Mesh(new THREE.BoxGeometry(1.15, 4.3, 1.05), pants), 0.85, 2.4, 0);
  addTo(group, new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 2), shoeMat), -0.85, 0.35, -0.28);
  addTo(group, new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 2), shoeMat), 0.85, 0.35, -0.28);
  if (rnd(x + z + 33) > 0.5) {
    addTo(group, new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.2, 0.8), new THREE.MeshStandardMaterial({ color: 0x27313b, roughness: 0.82 })), 0, 6.2, 1.5);
  } else {
    addTo(group, new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.85, 0.55, 12), accent), 0, 12.1, 0);
  }
  torso.name = "torso"; head.name = "head"; hair.name = "hair";
  scene.add(group);

  const ped = {
    group,
    limbs: { leftArm, rightArm, leftLeg, rightLeg },
    hp: 40,
    angle: rnd(x * z) * Math.PI * 2,
    speed: 9 + rnd(x - z) * 8,
    stride: rnd(x + z + 99) * Math.PI * 2,
    panic: 0,
    dead: false
  };
  pedestrians.push(ped);
  return ped;
}

function spawnActors() {
  for (let i = 0; i < 70; i++) {
    const vertical = rnd(i) > 0.5;
    const lane = Math.floor(rnd(i + 14) * 9 - 4) * ROAD_EVERY + (rnd(i + 17) - 0.5) * 28;
    const along = -WORLD / 2 + 110 + rnd(i + 23) * (WORLD - 220);
    makeVehicle(vertical ? lane : along, vertical ? along : lane, false);
  }
  for (let i = 0; i < 7; i++) makeVehicle(-700 + i * 80, -780 + i * 120, true);
  for (let i = 0; i < 85; i++) {
    let x = -WORLD / 2 + 80 + rnd(i + 50) * (WORLD - 160);
    let z = -WORLD / 2 + 80 + rnd(i + 80) * (WORLD - 160);
    if (!isRoad(x, z)) {
      x = Math.round(x / ROAD_EVERY) * ROAD_EVERY + 44;
      z += (rnd(i + 12) - 0.5) * 90;
    }
    makePedestrian(x, z);
  }
}

function collides(x, z, radius) {
  for (const c of colliders) {
    if (Math.abs(x - c.x) < c.w / 2 + radius && Math.abs(z - c.z) < c.d / 2 + radius) return true;
  }
  return false;
}

function tryMove(pos, dx, dz, radius) {
  const nx = clamp(pos.x + dx, -WORLD / 2 + radius, WORLD / 2 - radius);
  const nz = clamp(pos.z + dz, -WORLD / 2 + radius, WORLD / 2 - radius);
  if (!collides(nx, pos.z, radius)) pos.x = nx;
  if (!collides(pos.x, nz, radius)) pos.z = nz;
}

function forwardFromYaw(yaw) {
  return new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
}

function rightFromYaw(yaw) {
  return new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
}

function enterExitCar() {
  ensureAudio();
  if (player.car) {
    const car = player.car;
    car.occupied = false;
    car.ai = false;
    player.car = null;
    player.pos.copy(car.group.position);
    player.pos.y = 1.8;
    player.pos.add(rightFromYaw(player.yaw).multiplyScalar(12));
    missionEl.textContent = "On foot. Mouse look and shoot through the city streets.";
    return;
  }

  let best = null;
  let bestD = 22;
  for (const car of vehicles) {
    const d = car.group.position.distanceTo(player.pos);
    if (!car.occupied && d < bestD) {
      best = car;
      bestD = d;
    }
  }
  if (!best) {
    missionEl.textContent = "No vehicle nearby. Walk closer to a car.";
    return;
  }
  player.car = best;
  best.occupied = true;
  best.ai = false;
  player.yaw = best.group.rotation.y;
  missionEl.textContent = "Driving. W/GAS moves forward, S brakes, E exits.";
}

function shoot() {
  ensureAudio();
  if (player.shootCd > 0 || player.reloadCd > 0 || player.ammo <= 0) return;
  player.shootCd = player.car ? 0.12 : 0.16;
  player.ammo--;
  player.wanted = clamp(player.wanted + 0.12, 0, 5);
  playShot();
  weaponEl.classList.remove("recoil");
  void weaponEl.offsetWidth;
  weaponEl.classList.add("recoil");

  raycaster.setFromCamera(center, camera);
  const targets = [
    ...pedestrians.filter(p => !p.dead).map(p => p.group),
    ...vehicles.filter(v => v !== player.car).map(v => v.group)
  ];
  const hit = raycaster.intersectObjects(targets, true)[0];
  const origin = camera.position.clone();
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  const bulletMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 3.2), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
  bulletMesh.position.copy(origin);
  bulletMesh.lookAt(origin.clone().add(direction));
  scene.add(bulletMesh);
  bullets.push({ pos: origin.clone(), vel: direction.clone().multiplyScalar(360), life: 0.7, mesh: bulletMesh });
  spawnParticle(origin.clone().add(direction.clone().multiplyScalar(3.4)), 0xffd16c, 0.12, direction.clone().multiplyScalar(16));

  if (!hit || hit.distance > 180) return;
  const targetGroup = findTargetGroup(hit.object);
  const ped = pedestrians.find(p => p.group === targetGroup);
  const car = vehicles.find(v => v.group === targetGroup);
  if (ped && !ped.dead) {
    ped.hp -= 35;
    ped.panic = 4;
    spawnImpact(hit.point, 0xc43e35);
    if (ped.hp <= 0) {
      ped.dead = true;
      ped.group.visible = false;
    }
    player.wanted = clamp(player.wanted + 0.35, 0, 5);
  }
  if (car) {
    car.hp -= 22;
    spawnImpact(hit.point, 0xffb447);
    if (car.hp <= 0) {
      car.ai = false;
      car.speed = 0;
      spawnExplosion(car.group.position);
    }
    player.wanted = clamp(player.wanted + 0.2, 0, 5);
  }
}

function findTargetGroup(obj) {
  let o = obj;
  while (o && o.parent && o.parent !== scene) o = o.parent;
  return o;
}

function melee() {
  ensureAudio();
  if (player.meleeCd > 0 || player.car) return;
  player.meleeCd = 0.45;
  playThump();
  const hitPos = player.pos.clone().add(forwardFromYaw(player.yaw).multiplyScalar(8));
  for (const ped of pedestrians) {
    if (ped.dead) continue;
    if (ped.group.position.distanceTo(hitPos) < 7) {
      ped.hp -= 30;
      ped.panic = 4;
      spawnImpact(ped.group.position, 0xf0d070);
      player.wanted = clamp(player.wanted + 0.35, 0, 5);
      if (ped.hp <= 0) {
        ped.dead = true;
        ped.group.visible = false;
      }
    }
  }
}

function reload() {
  if (player.reloadCd > 0 || player.ammo >= 48) return;
  player.reloadCd = 0.9;
  missionEl.textContent = "Reloading...";
  setTimeout(() => {
    player.ammo = 48;
    missionEl.textContent = "Reloaded.";
  }, 760);
}

function damagePlayer(amount) {
  const armorHit = Math.min(player.armor, amount * 0.65);
  player.armor -= armorHit;
  player.health = clamp(player.health - (amount - armorHit), 0, 100);
  if (player.health <= 0) {
    player.health = 100;
    player.armor = 25;
    player.pos.set(0, 1.8, 0);
    if (player.car) {
      player.car.occupied = false;
      player.car = null;
    }
    player.wanted = Math.max(0, player.wanted - 2);
    missionEl.textContent = "Busted. Respawned downtown.";
  }
}

function updatePlayer(dt) {
  player.shootCd = Math.max(0, player.shootCd - dt);
  player.meleeCd = Math.max(0, player.meleeCd - dt);
  player.reloadCd = Math.max(0, player.reloadCd - dt);
  player.wanted = Math.max(0, player.wanted - dt * 0.025);
  player.yaw -= input.lookX * dt * 1.8;
  player.pitch = clamp(player.pitch - input.lookY * dt * 1.3, -1.1, 0.85);

  if (player.car) {
    const car = player.car;
    const gas = keys.has("w") || keys.has("arrowup") || input.y < -0.2 || input.gas ? 1 : 0;
    const brake = keys.has("s") || keys.has("arrowdown") || input.y > 0.35 ? 1 : 0;
    const steer = (keys.has("a") || keys.has("arrowleft") ? 1 : 0) - (keys.has("d") || keys.has("arrowright") ? 1 : 0) - input.x;
    car.speed += gas * 80 * dt;
    car.speed -= brake * 90 * dt;
    car.speed *= Math.pow(keys.has(" ") ? 0.92 : 0.982, dt * 60);
    car.speed = clamp(car.speed, -34, input.gas ? 92 : 68);
    car.group.rotation.y += steer * (1.1 + Math.abs(car.speed) * 0.025) * dt * Math.sign(car.speed || 1);
    player.yaw += angleDiff(car.group.rotation.y, player.yaw) * Math.min(1, dt * 7);
    const f = forwardFromYaw(car.group.rotation.y);
    tryMove(car.group.position, f.x * car.speed * dt, f.z * car.speed * dt, 10);
    player.pos.copy(car.group.position);
    player.pos.y = 5.8;

    for (const w of car.wheels) w.rotation.x += car.speed * dt * 0.22;

    for (const ped of pedestrians) {
      if (ped.dead) continue;
      if (ped.group.position.distanceTo(car.group.position) < 9 && Math.abs(car.speed) > 22) {
        ped.hp -= Math.abs(car.speed) * 0.7;
        ped.panic = 5;
        spawnImpact(ped.group.position, 0xc43e35);
        player.wanted = clamp(player.wanted + 0.16, 0, 5);
        if (ped.hp <= 0) {
          ped.dead = true;
          ped.group.visible = false;
        }
      }
    }
  } else {
    const x = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0) + input.x;
    const y = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0) + input.y;
    const mag = Math.hypot(x, y);
    if (mag > 0.05) {
      const speed = keys.has("shift") ? 54 : 34;
      const move = forwardFromYaw(player.yaw)
        .multiplyScalar(-y / Math.max(1, mag))
        .add(rightFromYaw(player.yaw).multiplyScalar(x / Math.max(1, mag)));
      tryMove(player.pos, move.x * speed * dt, move.z * speed * dt, 3.2);
    }
  }

  if (input.fire) shoot();
  camera.position.copy(player.pos);
  if (player.car) {
    camera.position.y += 7;
    camera.position.add(new THREE.Vector3(Math.sin(player.yaw) * 7, 0, Math.cos(player.yaw) * 7));
  }
  camera.rotation.order = "YXZ";
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

function updateTraffic(dt) {
  for (const car of vehicles) {
    if (!car.ai || car.occupied || car.hp <= 0) continue;
    const pos = car.group.position;
    if (car.police && player.wanted > 0.6) {
      const target = player.car ? player.car.group.position : player.pos;
      const angle = Math.atan2(-(target.x - pos.x), -(target.z - pos.z));
      car.group.rotation.y += angleDiff(angle, car.group.rotation.y) * Math.min(1, dt * 1.7);
      car.speed += (60 - car.speed) * dt;
      if (pos.distanceTo(target) < 16) damagePlayer(14 * dt);
    } else {
      car.turnTimer -= dt;
      if (car.turnTimer <= 0) {
        car.turnTimer = 1.5 + rnd(performance.now() + pos.x) * 3;
        if (rnd(pos.x + pos.z + performance.now()) > 0.78) car.group.rotation.y += (rnd(pos.x) > 0.5 ? 1 : -1) * Math.PI / 2;
      }
      car.speed += ((18 + rnd(pos.x + pos.z) * 20) - car.speed) * dt;
    }
    const f = forwardFromYaw(car.group.rotation.y);
    tryMove(pos, f.x * car.speed * dt, f.z * car.speed * dt, 10);
    for (const w of car.wheels) w.rotation.x += car.speed * dt * 0.18;
    if (car.siren && player.wanted > 0.6) car.siren.material.color.setHex(Math.sin(performance.now() / 80) > 0 ? 0x224dff : 0xff3030);
  }

  if (player.wanted > 1.4 && cops.length < 12 && rnd(performance.now()) > 0.985) {
    const a = rnd(performance.now() + 3) * Math.PI * 2;
    const d = 260 + rnd(performance.now() + 5) * 160;
    makeVehicle(clamp(player.pos.x + Math.sin(a) * d, -WORLD / 2 + 60, WORLD / 2 - 60), clamp(player.pos.z + Math.cos(a) * d, -WORLD / 2 + 60, WORLD / 2 - 60), true);
  }
}

function updatePedestrians(dt) {
  const target = player.car ? player.car.group.position : player.pos;
  for (const ped of pedestrians) {
    if (ped.dead) continue;
    const pos = ped.group.position;
    const d = pos.distanceTo(target);
    if (d < 38 && player.wanted > 0.3) ped.panic = Math.max(ped.panic, 3);
    if (ped.panic > 0) {
      ped.angle = Math.atan2(pos.x - target.x, pos.z - target.z);
      ped.panic -= dt;
    } else if (rnd(Math.floor(performance.now() / 900) + pos.x) > 0.985) {
      ped.angle += (rnd(pos.z + performance.now()) - 0.5) * 1.2;
    }
    const speed = ped.panic > 0 ? ped.speed * 2.4 : ped.speed;
    tryMove(pos, Math.sin(ped.angle) * speed * dt, Math.cos(ped.angle) * speed * dt, 2.5);
    ped.group.rotation.y = ped.angle;
    ped.stride += dt * speed * 0.55;
    const swing = Math.sin(ped.stride) * (ped.panic > 0 ? 0.72 : 0.42);
    ped.limbs.leftArm.rotation.x = swing;
    ped.limbs.rightArm.rotation.x = -swing;
    ped.limbs.leftLeg.rotation.x = -swing;
    ped.limbs.rightLeg.rotation.x = swing;
    ped.group.position.y = Math.abs(Math.sin(ped.stride * 2)) * (ped.panic > 0 ? 0.22 : 0.1);
  }
}

function updateEffects(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.pos.addScaledVector(b.vel, dt);
    b.life -= dt;
    b.mesh.position.copy(b.pos);
    if (b.life <= 0) {
      scene.remove(b.mesh);
      bullets.splice(i, 1);
    }
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.scale.multiplyScalar(Math.pow(0.94, dt * 60));
    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }
  updateEngineAudio();
}

function spawnImpact(point, color) {
  for (let i = 0; i < 9; i++) {
    const vel = new THREE.Vector3(rnd(i + point.x) - 0.5, rnd(i + point.y) * 0.8, rnd(i + point.z) - 0.5).multiplyScalar(18);
    spawnParticle(point, color, 0.35 + rnd(i) * 0.2, vel);
  }
}

function spawnExplosion(pos) {
  playExplosion();
  for (let i = 0; i < 28; i++) {
    const vel = new THREE.Vector3(rnd(i) - 0.5, rnd(i + 9), rnd(i + 18) - 0.5).multiplyScalar(42);
    spawnParticle(pos.clone().add(new THREE.Vector3(0, 5, 0)), i % 2 ? 0xff5d38 : 0xffc15a, 0.65, vel);
  }
}

function spawnParticle(pos, color, life, vel) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshBasicMaterial({ color }));
  mesh.position.copy(pos);
  scene.add(mesh);
  particles.push({ mesh, life, vel });
}

function ensureAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  engineOsc = audioCtx.createOscillator();
  engineGain = audioCtx.createGain();
  engineOsc.type = "sawtooth";
  engineOsc.frequency.value = 42;
  engineGain.gain.value = 0;
  engineOsc.connect(engineGain).connect(audioCtx.destination);
  engineOsc.start();
}

function playShot() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(165, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(38, audioCtx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.09);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.1);
}

function playThump() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(82, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.13);
}

function playExplosion() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(58, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.16, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.45);
}

function updateEngineAudio() {
  if (!audioCtx || !engineGain || !engineOsc) return;
  const driving = !!player.car;
  const speed = driving ? Math.abs(player.car.speed) : 0;
  engineGain.gain.setTargetAtTime(driving ? 0.025 + speed * 0.0005 : 0, audioCtx.currentTime, 0.08);
  engineOsc.frequency.setTargetAtTime(38 + speed * 1.5, audioCtx.currentTime, 0.08);
}

function updateHud() {
  healthEl.style.width = `${player.health}%`;
  armorEl.style.width = `${player.armor}%`;
  ammoEl.textContent = player.reloadCd > 0 ? "..." : player.ammo;
  modeEl.textContent = player.car ? "Driving" : "On foot";
  weaponEl.classList.toggle("driving", !!player.car);
  starsEl.innerHTML = "";
  const full = Math.ceil(player.wanted);
  for (let i = 1; i <= 5; i++) {
    const el = document.createElement(i <= full ? "b" : "span");
    el.textContent = "★";
    starsEl.appendChild(el);
  }
}

function loop() {
  const dt = Math.min(clock.getDelta(), 0.033);
  updatePlayer(dt);
  updateTraffic(dt);
  updatePedestrians(dt);
  updateEffects(dt);
  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function bindStick(id, knobId, onMove, onEnd) {
  const el = document.getElementById(id);
  const knob = document.getElementById(knobId);
  let activePointer = null;

  function reset() {
    activePointer = null;
    knob.style.transform = "translate3d(0, 0, 0)";
    el.classList.remove("active");
    onEnd();
  }

  function move(e) {
    if (activePointer !== e.pointerId) return;
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const mag = Math.hypot(dx, dy) || 1;
    const max = rect.width * 0.34;
    const m = Math.min(max, mag);
    const nx = dx / mag;
    const ny = dy / mag;
    knob.style.transform = `translate3d(${nx * m}px, ${ny * m}px, 0)`;
    onMove(nx * (m / max), ny * (m / max));
  }
  function start(e) {
    e.preventDefault();
    e.stopPropagation();
    if (activePointer !== null) return;
    activePointer = e.pointerId;
    el.classList.add("active");
    el.setPointerCapture?.(e.pointerId);
    move(e);
  }

  function end(e) {
    if (activePointer !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    reset();
  }

  el.addEventListener("pointerdown", start);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener("lostpointercapture", reset);
  addEventListener("blur", reset);
}

function bindHold(id, down, up) {
  const el = document.getElementById(id);
  let activePointer = null;
  function release(e) {
    if (activePointer !== null && e?.pointerId !== undefined && e.pointerId !== activePointer) return;
    activePointer = null;
    el.classList.remove("active");
    up();
  }
  el.addEventListener("pointerdown", e => {
    e.preventDefault();
    e.stopPropagation();
    if (activePointer !== null) return;
    activePointer = e.pointerId;
    el.classList.add("active");
    el.setPointerCapture?.(e.pointerId);
    down();
  });
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);
  el.addEventListener("lostpointercapture", release);
  addEventListener("blur", release);
}

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

addEventListener("keydown", e => {
  const k = e.key.toLowerCase();
  keys.add(k);
  if (k === "e") enterExitCar();
  if (k === "f") melee();
  if (k === "r") reload();
});

addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));

addEventListener("click", () => {
  ensureAudio();
  renderer.domElement.requestPointerLock?.();
});

addEventListener("mousemove", e => {
  if (document.pointerLockElement === renderer.domElement) {
    player.yaw -= e.movementX * 0.0022;
    player.pitch = clamp(player.pitch - e.movementY * 0.002, -1.1, 0.85);
  }
});

addEventListener("mousedown", e => {
  ensureAudio();
  if (e.button === 0) input.fire = true;
});

addEventListener("mouseup", () => {
  input.fire = false;
});

bindStick("stick", "moveKnob", (x, y) => {
  input.x = x;
  input.y = y;
}, () => {
  input.x = 0;
  input.y = 0;
});

bindStick("look", "lookKnob", (x, y) => {
  input.lookX = x;
  input.lookY = y;
}, () => {
  input.lookX = 0;
  input.lookY = 0;
});

bindHold("fireBtn", () => {
  ensureAudio();
  input.fire = true;
}, () => {
  input.fire = false;
});

bindHold("gasBtn", () => {
  ensureAudio();
  input.gas = true;
}, () => {
  input.gas = false;
});

function resetTouchInput() {
  input.x = 0;
  input.y = 0;
  input.lookX = 0;
  input.lookY = 0;
  input.fire = false;
  input.gas = false;
  document.querySelectorAll(".knob").forEach(knob => {
    knob.style.transform = "translate3d(0, 0, 0)";
  });
  document.querySelectorAll(".touch .active").forEach(el => el.classList.remove("active"));
}

addEventListener("pointercancel", resetTouchInput);
addEventListener("pagehide", resetTouchInput);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) resetTouchInput();
});

document.getElementById("hitBtn").addEventListener("pointerdown", e => {
  e.preventDefault();
  e.stopPropagation();
  melee();
});

document.getElementById("carBtn").addEventListener("pointerdown", e => {
  e.preventDefault();
  e.stopPropagation();
  enterExitCar();
});

document.querySelectorAll(".touch, .touch *").forEach(el => {
  el.addEventListener("contextmenu", e => e.preventDefault());
  el.addEventListener("selectstart", e => e.preventDefault());
  el.addEventListener("dragstart", e => e.preventDefault());
  el.addEventListener("touchstart", e => e.preventDefault(), { passive: false });
  el.addEventListener("touchmove", e => e.preventDefault(), { passive: false });
});

spawnCity();
spawnActors();
updateHud();
missionEl.textContent = "3D scene ready. Find a car, drive, shoot, and survive the wanted level.";
loop();
