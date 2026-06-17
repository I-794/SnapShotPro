// v21 — True 3D / isometric device mockups.
//
// A screenshot is mapped onto a real three.js (WebGL) device that the user can
// orbit in the preview, with an animated turntable/spin export. three.js is
// lazy-loaded on first use so it never bloats the initial editor bundle (it
// lands in the `vendor-three` chunk).
//
// The hard architectural constraint of this app is that everything bakes into a
// single 2D canvas via render()/renderInto(). So this module renders to a
// module-level WebGL canvas with a TRANSPARENT background, and render.js
// composites it with ctx.drawImage(glCanvas, 0, 0) in BOTH preview and export —
// the page background drawn earlier in renderInto shows through.
//
// All three.js objects (renderer, scene, camera, per-device geometry, the
// screen texture) are created once and reused/resized across calls to keep the
// per-frame cost (and the per-export-frame turntable cost) low.

import { render } from './render.js';

const DEVICES_3D = new Set(['iphone', 'ipad', 'macbook']);

export function isDeviceMockup3d(device) {
  return DEVICES_3D.has(device);
}

// Body finishes. metalness/roughness give the metal some life under the lights.
const MATERIALS = {
  graphite: { color: 0x2a2d33, metalness: 0.62, roughness: 0.34 },
  silver:   { color: 0xd8dadf, metalness: 0.66, roughness: 0.30 },
  gold:     { color: 0xe8d2a6, metalness: 0.64, roughness: 0.32 }
};

// Per-device screen aspect (w/h) used to size both the geometry and the
// cover-fit screenshot texture.
const DEVICE_ASPECT = {
  iphone:  9 / 19.5,
  ipad:    3 / 4,
  macbook: 16 / 10
};

// Scene presets: camera distance + a small extra angle bias + canvas fov.
const SCENES = {
  studio: { dist: 4.2, fov: 32, tiltBias: 0,   roll: 0 },
  float:  { dist: 4.6, fov: 38, tiltBias: 6,   roll: -4 },
  iso:    { dist: 5.0, fov: 26, tiltBias: -18, roll: 0 }
};

// ---- module-level three.js singletons --------------------------------------
let THREE = null;
let threeLoading = false;
let renderer = null;
let scene = null;
let camera = null;
let envTexture = null;

let deviceGroup = null;       // the device root we orbit
let bodyMesh = null;
let screenMesh = null;
let bezelMesh = null;
let baseMesh = null;          // macbook base/wedge

let builtDevice = null;       // which device id the current geometry is for
let builtMaterial = null;     // which material the body currently uses

let screenTexture = null;
let screenTexCanvas = null;
let lastTexImage = null;      // identity of the last screenshot drawn into the texture
let lastTexImageW = 0, lastTexImageH = 0;

let curW = 0, curH = 0;

// Kick off the three.js import once; re-render when it lands so the preview fills
// in. Returns true when THREE is ready to use synchronously.
function ensureThree() {
  if (THREE) return true;
  if (!threeLoading) {
    threeLoading = true;
    import('three').then((mod) => {
      THREE = mod;
      threeLoading = false;
      // Trigger one more render now that the GL stack can initialize.
      try { render(); } catch (_) {}
    }).catch(() => { threeLoading = false; });
  }
  return false;
}

function ensureRenderer() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0);
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

  // Lighting: key + fill directional lights plus ambient/hemisphere fill.
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(3, 5, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 1.0);
  fill.position.set(-4, 2, 3);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.8);
  rim.position.set(0, 3, -6);
  scene.add(rim);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x202028, 0.7);
  scene.add(hemi);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  deviceGroup = new THREE.Group();
  scene.add(deviceGroup);
}

// Simple PMREM room environment so the metal body picks up reflections. Built
// lazily and cached; dependency-light (examples/jsm lands in vendor-three).
async function ensureEnv() {
  if (envTexture) return;
  try {
    const [{ RoomEnvironment }] = await Promise.all([
      import('three/examples/jsm/environments/RoomEnvironment.js')
    ]);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    envTexture = pmrem.fromScene(roomEnv, 0.04).texture;
    pmrem.dispose();
    render();
  } catch (_) { /* lights still cover the look without env */ }
}

// ---- screen texture --------------------------------------------------------
// Re-bake the screen texture for `device`'s aspect, cover-fitting `img` into it.
// Skips work when neither the image nor the device aspect changed.
let lastTexDevice = null;
function ensureScreenTexture(img, device) {
  if (!screenTexCanvas) {
    screenTexCanvas = document.createElement('canvas');
  }
  const dev = device || builtDevice || 'iphone';
  const same = img === lastTexImage && img && img.width === lastTexImageW &&
               img.height === lastTexImageH && dev === lastTexDevice && screenTexture;
  if (!same) {
    // Texture canvas matches the screen aspect for the device; cover-fit the shot.
    const aspect = DEVICE_ASPECT[dev] || (9 / 19.5);
    const TH = 2048;
    const TW = Math.round(TH * aspect);
    if (screenTexCanvas.width !== TW) screenTexCanvas.width = TW;
    if (screenTexCanvas.height !== TH) screenTexCanvas.height = TH;
    const tctx = screenTexCanvas.getContext('2d');
    tctx.clearRect(0, 0, TW, TH);
    tctx.fillStyle = '#000';
    tctx.fillRect(0, 0, TW, TH);
    if (img && img.width && img.height) {
      const ir = img.width / img.height;
      const tr = TW / TH;
      let dw, dh;
      if (ir > tr) { dh = TH; dw = TH * ir; } else { dw = TW; dh = TW / ir; }
      tctx.drawImage(img, (TW - dw) / 2, (TH - dh) / 2, dw, dh);
    }
    if (!screenTexture) {
      screenTexture = new THREE.CanvasTexture(screenTexCanvas);
      screenTexture.colorSpace = THREE.SRGBColorSpace;
    } else {
      screenTexture.needsUpdate = true;
    }
    lastTexImage = img;
    lastTexImageW = img ? img.width : 0;
    lastTexImageH = img ? img.height : 0;
    lastTexDevice = dev;
    if (screenMesh) {
      screenMesh.material.map = screenTexture;
      screenMesh.material.emissiveMap = screenTexture;
      screenMesh.material.needsUpdate = true;
    }
  }
}

// ---- device geometry -------------------------------------------------------
function disposeMesh(m) {
  if (!m) return;
  deviceGroup.remove(m);
  if (m.geometry) m.geometry.dispose();
  if (m.material) {
    if (m.material.map && m.material.map !== screenTexture) m.material.map.dispose();
    m.material.dispose();
  }
}

function buildDevice(device, material) {
  // Tear down previous geometry (keep the shared screen texture alive).
  disposeMesh(bodyMesh); disposeMesh(screenMesh); disposeMesh(bezelMesh); disposeMesh(baseMesh);
  bodyMesh = screenMesh = bezelMesh = baseMesh = null;

  const aspect = DEVICE_ASPECT[device] || (9 / 19.5);
  // Normalize the device to ~2.6 units on its longer screen dimension.
  let sw, sh;
  if (aspect >= 1) { sw = 2.8; sh = sw / aspect; } else { sh = 2.8; sw = sh * aspect; }
  const depth = device === 'macbook' ? 0.06 : 0.12;
  const bezel = device === 'macbook' ? 0.05 : 0.06;

  const mat = MATERIALS[material] || MATERIALS.graphite;
  const bodyMat = new THREE.MeshStandardMaterial({
    color: mat.color, metalness: mat.metalness, roughness: mat.roughness
  });
  if (envTexture) bodyMat.envMap = envTexture;

  // Body slab (slightly larger than the screen for the bezel).
  const bodyGeo = new THREE.BoxGeometry(sw + bezel * 2, sh + bezel * 2, depth);
  bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  deviceGroup.add(bodyMesh);

  // Screen plane, proud of the front face.
  builtDevice = device;
  ensureScreenTexture(lastTexImage, device);
  const screenMat = new THREE.MeshStandardMaterial({
    map: screenTexture, metalness: 0.0, roughness: 0.55,
    emissive: 0xffffff, emissiveMap: screenTexture, emissiveIntensity: 0.55
  });
  const screenGeo = new THREE.PlaneGeometry(sw, sh);
  screenMesh = new THREE.Mesh(screenGeo, screenMat);
  screenMesh.position.z = depth / 2 + 0.001;
  deviceGroup.add(screenMesh);

  // MacBook: add a thin wedge/base under the screen slab so it reads as a laptop.
  if (device === 'macbook') {
    const baseMat = new THREE.MeshStandardMaterial({
      color: mat.color, metalness: mat.metalness, roughness: mat.roughness
    });
    if (envTexture) baseMat.envMap = envTexture;
    const baseGeo = new THREE.BoxGeometry(sw + bezel * 2, depth, sh * 0.62);
    baseMesh = new THREE.Mesh(baseGeo, baseMat);
    // Hinge the base out below the screen, lying flat.
    baseMesh.position.y = -(sh + bezel * 2) / 2 - depth / 2;
    baseMesh.position.z = (sh * 0.62) / 2 - depth;
    baseMesh.rotation.x = 0; // flat deck
    deviceGroup.add(baseMesh);
  }

  builtDevice = device;
  builtMaterial = material;
}

// ---- main entry ------------------------------------------------------------
// Returns the module-level WebGL canvas (renderer.domElement) with the device
// rendered for the current orbit/zoom/scene/material, sized w×h with a
// transparent background. Returns null until three.js is ready (it triggers a
// re-render when loaded).
export function render3dMockup(state3d, w, h, screenshotImg) {
  if (!isDeviceMockup3d(state3d.device)) return null;
  if (!ensureThree()) return null;

  ensureRenderer();
  // Lazily warm the environment map (re-renders when ready).
  if (state3d.envReflections && !envTexture) ensureEnv();

  // (Re)build geometry when the device or material changed.
  if (builtDevice !== state3d.device || builtMaterial !== state3d.material) {
    buildDevice(state3d.device, state3d.material);
  }

  // Toggle env reflections live without rebuilding geometry.
  const envWanted = state3d.envReflections ? envTexture : null;
  if (bodyMesh && bodyMesh.material.envMap !== envWanted) {
    bodyMesh.material.envMap = envWanted; bodyMesh.material.needsUpdate = true;
  }
  if (baseMesh && baseMesh.material.envMap !== envWanted) {
    baseMesh.material.envMap = envWanted; baseMesh.material.needsUpdate = true;
  }

  // Keep the screen texture in sync with the supplied screenshot/source.
  ensureScreenTexture(screenshotImg || lastTexImage, state3d.device);

  // Resize renderer/camera to the canvas.
  if (w !== curW || h !== curH) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    curW = w; curH = h;
  }

  const preset = SCENES[state3d.scene] || SCENES.studio;
  camera.fov = preset.fov;

  // Orbit: rotate the device group. orbitProgress drives the turntable spin.
  const spinDeg = (state3d.spin && state3d.spin.enabled && state3d.orbitProgress)
    ? (state3d.spin.turns || 1) * 360 * state3d.orbitProgress
    : 0;
  const rx = ((state3d.orbitX || 0) + preset.tiltBias) * Math.PI / 180;
  const ry = ((state3d.orbitY || 0) + spinDeg) * Math.PI / 180;
  deviceGroup.rotation.set(0, 0, 0);
  deviceGroup.rotation.order = 'YXZ';
  deviceGroup.rotation.y = ry;
  deviceGroup.rotation.x = rx;
  deviceGroup.rotation.z = (preset.roll || 0) * Math.PI / 180;

  // Camera distance scaled by zoom (larger zoom = closer).
  const dist = preset.dist / Math.max(0.3, state3d.zoom || 1);
  camera.position.set(0, 0, dist);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  renderer.render(scene, camera);
  return renderer.domElement;
}
