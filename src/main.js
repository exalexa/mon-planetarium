import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  createSky, createStarfield, createSunMaterial, createCorona, createAtmosphere, createComposer,
  createAsteroidBelt, createGalaxies, createProminences, createComet, createMapDot,
  createAurora, createBowShock, createCME,
} from './effects.js';
import { createShip, globularCluster } from './models.js';
import { populate, THEMES } from './cover.js';
import { stepWalker, walkerView, PERSON } from './walker.js';
import { createCockpit, glitchify, flickerGlitch, glitchTspans, updateVHS } from './cockpit.js';
import { createLandmarkMoon } from './landmarks.js';
import { SYSTEM, flattenSystem } from './system.js';
import { TEXTS, GALLERIES } from './content.js';

const BODIES = flattenSystem();
const byId = Object.fromEntries(BODIES.map((b) => [b.id, b]));
const SUN_RADIUS = 50;
// Gravitation (unités de la scène, temps accéléré) : T = 2π √(a³ / GM).
// GM du soleil choisi pour qu'une année de PERSION (1 UA) dure 4 minutes.
const GM_SUN = 4701;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || location.search.includes('instant');

// ---------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------
const canvas = document.querySelector('#bg');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const pixelRatio = Math.min(window.devicePixelRatio, 1.75);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const cockpit = createCockpit(renderer);
cockpit.resize(window.innerWidth, window.innerHeight);
let glassPx = cockpit.glassBottom(window.innerHeight);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 30000);
camera.position.set(0, 900, 1600);

const sky = createSky();
const stars = createStarfield();
stars.material.uniforms.uPixelRatio.value = pixelRatio;
stars.add(createGalaxies());
scene.add(sky, stars);

// Lumière : le soleil éclaire, la nuit reste bleutée
const sunLight = new THREE.PointLight(0xffd6a8, 3.2, 0, 0);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x2a3b66, 0.7));
// Lumière d'appoint très douce portée par la caméra, pour lire les faces de nuit
const fill = new THREE.DirectionalLight(0x9fb4e0, 0.35);
fill.position.set(0, 0, 0);
fill.target.position.set(0, -0.3, -1);
camera.add(fill, fill.target);
scene.add(camera);

// Ceintures d'astéroïdes : principale (entre PERSION et SCHOLA) et ceinture glacée au-delà de MUSA
// (2,2 – 3,3 UA → 330 – 440 unités ; Kuiper ramenée à 1150 – 1400 pour rester visible)
const belts = [
  { mesh: createAsteroidBelt({ inner: 330, outer: 440, count: 1800, thickness: 16, color: 0x8b7f70, size: [0.25, 1.6], seed: 3 }), r: 385 },
  { mesh: createAsteroidBelt({ inner: 1150, outer: 1400, count: 2200, thickness: 70, color: 0x9fb2c4, size: [0.8, 4], seed: 8 }), r: 1275 },
];
belts.forEach((b) => { b.n = Math.sqrt(GM_SUN / b.r ** 3); scene.add(b.mesh); });

// Protubérances (le vent solaire n'est montré qu'à travers les éjections de gaz)
const prominences = createProminences(SUN_RADIUS);
scene.add(prominences);

// Comète périodique sur une orbite très excentrique ; ses queues pointent à l'opposé du soleil
// Comètes périodiques (orbites très excentriques inspirées de comètes réelles, compressées)
const COMETS = [
  { name: 'Halley', orbit: { a: 560, e: 0.866, i: 162.3, node: 1.02, peri: 1.95, M0: 0.1 } },   // rétrograde
  { name: 'Encke', orbit: { a: 300, e: 0.75, i: 11.8, node: 5.8, peri: 3.89, M0: 2.6 } },        // courte période
  { name: 'Hale-Bopp', orbit: { a: 1500, e: 0.95, i: 89.4, node: 4.65, peri: 2.27, M0: 6.1 } },  // longue période
  { name: 'Swift-Tuttle', orbit: { a: 820, e: 0.91, i: 113.5, node: 2.43, peri: 2.6, M0: 0.35 } },
];
COMETS.forEach((c) => { c.obj = createComet(); scene.add(c.obj); });

// ω Centauri : amas globulaire lointain, fixé sur la sphère céleste (il suit la caméra comme les étoiles)
const OMEGA_DIR = new THREE.Vector3(0.35, 0.8, -0.48).normalize();
const omegaCluster = globularCluster(31, 6000);
omegaCluster.position.copy(OMEGA_DIR).multiplyScalar(6000);
stars.add(omegaCluster);

// Vaisseau d'exploration, visible pendant les trajets (caméra à la troisième personne)
const ship = createShip();
ship.visible = false;
scene.add(ship);
const TRAIL_N = 90;
const trail = new THREE.Line(
  new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 3), 3))
    .setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 3), 3)),
  new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
);
trail.frustumCulled = false;
trail.visible = false;
scene.add(trail);

// Éjections de masse coronale (deux en vol au plus)
const cmes = [0, 1].map(() => {
  const mesh = createCME({ sunRadius: SUN_RADIUS, maxRadius: 1150 });
  scene.add(mesh);
  return { mesh, active: false, r: 0, dir: new THREE.Vector3(), hits: new Set(), target: null };
});
let nextCME = 14;

const { composer, film } = createComposer(renderer, scene, camera);
composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

const sunMaterial = createSunMaterial();
const corona = createCorona(SUN_RADIUS * 4.6);
scene.add(corona);

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------
const ui = {
  loader: document.getElementById('loader'),
  loaderBar: document.getElementById('loader-progress'),
  loaderPct: document.getElementById('loader-percent'),
  title: document.getElementById('planetarium-title'),
  panel: document.getElementById('astro-info-container'),
  panelBody: document.querySelector('#astro-info-container .panel-body'),
  nav: document.getElementById('hud-nav'),
  path: document.getElementById('hud-path'),
  section: document.getElementById('hud-section'),
  timer: document.getElementById('loop-timer'),
  time: document.getElementById('loop-time'),
  overlay: document.getElementById('project-overlay'),
  flash: document.getElementById('flash'),
};

// --- Arbre d'exploration (journal de bord) ---
const EXPLORED_KEY = 'sysE139.explored';
let explored = new Set();
try { explored = new Set(JSON.parse(localStorage.getItem(EXPLORED_KEY) || '[]')); } catch (e) { /* stockage indisponible */ }
function saveExplored() {
  try { localStorage.setItem(EXPLORED_KEY, JSON.stringify([...explored])); } catch (e) { /* ignore */ }
}

const tree = document.createElement('aside');
tree.id = 'explore-tree';
tree.innerHTML = `
  <button type="button" class="tree-toggle" aria-expanded="false" aria-controls="explore-tree-list">Journal</button>
  <div class="tree-inner">
    <header class="tree-head">
      <span class="tree-title">Journal de bord</span>
      <span class="tree-count"><b id="tree-done">0</b>/<span id="tree-total">0</span></span>
    </header>
    <div class="tree-progress"><span id="tree-bar"></span></div>
    <ul class="tree-list" id="explore-tree-list"></ul>
    <button type="button" class="tree-reset" title="Effacer la progression">réinitialiser</button>
  </div>`;
document.body.appendChild(tree);
const treeList = tree.querySelector('.tree-list');
const chips = {};
function chip(b) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `chip chip-${b.kind}`;
  el.style.setProperty('--c', b.color);
  el.dataset.id = b.id;
  el.innerHTML = `<span class="chip-led"></span><span class="chip-name">${b.name}</span><span class="chip-sec">${b.section}</span><span class="chip-state"></span>`;
  el.addEventListener('click', () => { goTo(b.id); tree.classList.remove('open'); });
  chips[b.id] = el;
  return el;
}
for (const p of SYSTEM) {
  const li = document.createElement('li');
  li.className = 'tree-node';
  li.style.setProperty('--c', p.color);
  li.dataset.id = p.id;
  li.appendChild(chip(p));
  if (p.children.length) {
    const ul = document.createElement('ul');
    ul.className = 'tree-moons';
    for (const c of p.children) {
      const cli = document.createElement('li');
      cli.appendChild(chip(c));
      ul.appendChild(cli);
    }
    li.appendChild(ul);
  }
  treeList.appendChild(li);
}
tree.querySelector('.tree-toggle').addEventListener('click', () => {
  const open = tree.classList.toggle('open');
  tree.querySelector('.tree-toggle').setAttribute('aria-expanded', String(open));
});
tree.querySelector('.tree-reset').addEventListener('click', () => {
  explored = new Set([current?.id].filter(Boolean));
  saveExplored();
  updateTree();
});
document.getElementById('tree-total').textContent = BODIES.length;

function updateTree() {
  const group = current ? (current.parent || current) : null;
  for (const b of BODIES) {
    const el = chips[b.id];
    el.classList.toggle('current', b === current);
    el.classList.toggle('explored', explored.has(b.id));
    const state = el.querySelector('.chip-state');
    state.classList.toggle('unknown', !explored.has(b.id));
    if (!explored.has(b.id)) state.textContent = '?';
    else if (b.children && b.children.length) state.textContent = `${b.children.filter((c) => explored.has(c.id)).length}/${b.children.length}`;
    else state.textContent = '✓';
  }
  treeList.querySelectorAll('.tree-node').forEach((li) => li.classList.toggle('open', group && li.dataset.id === group.id));
  const n = BODIES.filter((b) => explored.has(b.id)).length;
  document.getElementById('tree-done').textContent = n;
  document.getElementById('tree-bar').style.width = `${(100 * n) / BODIES.length}%`;
}

// --- Étiquettes 3D ---
for (const b of BODIES) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'astro-label';
  el.style.setProperty('--c', b.color);
  el.textContent = b.name;
  el.tabIndex = -1;
  el.addEventListener('click', () => goTo(b.id));
  document.body.appendChild(el);
  b.label = el;
}

// ---------------------------------------------------------------------------
// Mécanique céleste : orbites képlériennes
// ---------------------------------------------------------------------------
function prepareOrbit(o, GM, tilt = 0) {
  o.T = 2 * Math.PI * Math.sqrt((o.a ** 3) / GM);
  o.n = (2 * Math.PI) / o.T;
  o.M = o.M0 || 0;
  const deg = Math.PI / 180;
  // Les lunes orbitent dans le plan équatorial de leur planète (incliné de « tilt »)
  o.q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.node || 0))
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (o.i || 0) * deg))
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.peri || 0));
}
// Position sur l'ellipse à partir de l'anomalie excentrique E
function ellipsePoint(o, E, out) {
  return out.set(o.a * (Math.cos(E) - o.e), 0, -o.a * Math.sqrt(1 - o.e * o.e) * Math.sin(E)).applyQuaternion(o.q);
}
// Résolution de l'équation de Kepler M = E − e sin E (Newton)
function keplerPosition(o, out) {
  let E = o.M;
  for (let k = 0; k < 6; k++) E -= (E - o.e * Math.sin(E) - o.M) / (1 - o.e * Math.cos(E));
  return ellipsePoint(o, E, out);
}
function orbitLine(o, color, opacity, dashed) {
  const pts = [];
  for (let k = 0; k <= 256; k++) pts.push(ellipsePoint(o, (k / 256) * Math.PI * 2, new THREE.Vector3()));
  const geometry = new THREE.BufferGeometry().setFromPoints(pts);
  const material = dashed
    ? new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: o.a * 0.05, gapSize: o.a * 0.04, depthWrite: false })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  const line = new THREE.Line(geometry, material);
  if (dashed) line.computeLineDistances();
  return line;
}

// ---------------------------------------------------------------------------
// Matériaux cartoon : ombrage en paliers doux + léger liseré de lumière
// ---------------------------------------------------------------------------
const gradientMap = (() => {
  const t = new THREE.DataTexture(new Uint8Array([46, 92, 150, 205, 240, 255]), 6, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();
const toonCache = new Map();
function toToon(m) {
  if (!m || !(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial || m.isMeshLambertMaterial)) return m;
  if (toonCache.has(m)) return toonCache.get(m);
  const t = new THREE.MeshToonMaterial({
    name: m.name, color: m.color.clone(), map: m.map, vertexColors: m.vertexColors,
    emissive: m.emissive.clone(), emissiveIntensity: m.emissiveIntensity, emissiveMap: m.emissiveMap,
    transparent: m.transparent, opacity: m.opacity, side: m.side, gradientMap,
  });
  // Les métaux deviennent des aplats un peu plus clairs (pas de reflets réalistes)
  if (m.metalness > 0.4) t.color.offsetHSL(0, -0.05, 0.08);
  t.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float rim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
       outgoingLight += vec3(0.62, 0.72, 1.0) * rim * 0.22;
       #include <opaque_fragment>`
    );
  };
  toonCache.set(m, t);
  return t;
}
function toonify(root) {
  root.traverse((o) => {
    if (!o.isMesh || o === byId.lexa?.obj) return;
    o.material = Array.isArray(o.material) ? o.material.map(toToon) : toToon(o.material);
  });
}

// ---------------------------------------------------------------------------
// Construction du système
// ---------------------------------------------------------------------------
const tmpV = new THREE.Vector3();
const tmpBox = new THREE.Box3();
const tmpSphere = new THREE.Sphere();
const pickables = [];
let ready = false;

function measure(b) {
  b.obj.updateMatrixWorld(true);
  tmpBox.setFromObject(b.obj);
  tmpBox.getBoundingSphere(tmpSphere);
  b.centerLocal = b.obj.worldToLocal(tmpSphere.center.clone());
  b.viewRadius = b.view?.radius || b.radius || tmpSphere.radius;
}

function tagPickable(b) {
  b.obj.traverse((o) => {
    if (o.isMesh || o.isPoints) {
      o.userData.bodyId = b.id;
      if (!pickables.includes(o)) pickables.push(o);
    }
  });
}

function buildSystem(gltf) {
  const g = gltf.scene;
  g.updateMatrixWorld(true);

  // Le soleil : sphère lisse et matériau animé
  const etoile = g.getObjectByName('Etoile');
  [...etoile.children].forEach((c) => scene.attach(c));
  scene.attach(etoile);
  etoile.geometry = new THREE.SphereGeometry(1, 96, 64);
  etoile.material = sunMaterial;
  etoile.position.set(0, 0, 0);
  etoile.rotation.set(0, 0, 0);
  etoile.scale.setScalar(SUN_RADIUS);

  // Fusée de PROXION : on retire une pièce égarée loin du modèle
  const rocket = g.getObjectByName('Rocket') || scene.getObjectByName('Rocket');
  rocket?.traverse((o) => {
    if (o.isMesh && o.material?.name === 'Matériau.007') o.userData.remove = true;
  });
  rocket && [...rocket.children].filter((o) => o.userData.remove).forEach((o) => o.parent.remove(o));

  for (const b of BODIES) {
    if (b.sky) continue;
    if (b.glb) {
      const obj = g.getObjectByName(b.glb) || scene.getObjectByName(b.glb);
      if (!obj) { console.warn('Objet introuvable dans le GLB :', b.glb); continue; }
      if (!b.attached && b.kind !== 'star') {
        scene.attach(obj);
        obj.scale.multiplyScalar(b.glbScale || 1);
      }
      b.obj = obj;
    } else if (b.landmark) {
      b.obj = createLandmarkMoon({ radius: 4, seed: b.moon?.seed, colors: b.moon?.colors, ground: b.moon?.ground, landmark: b.landmark });
      const sc = b.moon?.scale ?? 0.45;
      b.obj.scale.setScalar(sc);
      b.radius = b.radius || 4.6 * sc;
      b.isLandmark = true;
      scene.add(b.obj);
    } else if (b.build) {
      b.obj = b.build();
      scene.add(b.obj);
    }
    if (b.atmosphere) {
      b.atmo = createAtmosphere(b.atmosphere.radius, b.atmosphere.color, { shell: b.atmosphere.shell, strength: b.atmosphere.strength ?? 1 });
      scene.add(b.atmo);
    }
    if (b.orbit) prepareOrbit(b.orbit, b.kind === 'planet' ? GM_SUN : GM_SUN * b.parent.mu, b.kind === 'planet' ? 0 : b.parent.tilt || 0);
    if (b.kind === 'planet' && b.obj) {
      // Inclinaison de l'axe : on tourne d'abord sur l'axe propre (Y), puis on incline (Z)
      b.obj.rotation.order = 'ZYX';
      b.obj.rotation.z = b.tilt || 0;
      b.mapDot = createMapDot(b.color);
      if (b.dwarf) b.mapDot.scale.setScalar(0.011);
      scene.add(b.mapDot);
    }
    if (b.magnetic && b.obj) {
      // Champ magnétique : dipôle incliné par rapport à l'axe de rotation, aurores aux pôles magnétiques
      const R = b.atmosphere?.radius || b.radius || 6;
      b.mag = new THREE.Group();
      b.mag.rotation.order = 'ZYX';
      b.mag.rotation.z = (b.tilt || 0) + b.magnetic.tilt;
      b.aurora = createAurora(R * 1.03, { bottom: b.magnetic.bottom, top: b.magnetic.top });
      b.magneto = createBowShock(R, b.magnetic.bottom);
      b.mag.add(b.aurora, b.magneto);
      b.storm = 0;
      scene.add(b.mag);
    }
  }
  for (const b of BODIES) if (b.obj && b.kind !== 'star') toonify(b.obj);
  toonify(ship);
  // L'océan de PERSION
  if (byId.persion?.obj) byId.persion.obj.userData.water = true;
  // Grande lunette de Meudon : pièces animées
  const mo = byId.meudon?.obj;
  if (mo) {
    tele = {
      cp: mo.getObjectByName('coupole'), rot: mo.getObjectByName('coupole-rot'),
      a: mo.getObjectByName('shutter-a'), b: mo.getObjectByName('shutter-b'),
      alt: mo.getObjectByName('tube-alt'), eye: mo.getObjectByName('eyepiece'), open: 0,
    };
    tele.gap = tele.rot.userData.gap;
  }
  belts.forEach((b) => { b.mesh.material = toToon(b.mesh.material); });
  // Pickables : parents d'abord, puis enfants attachés (SYLVIA dans PERSION)
  for (const b of BODIES) if (b.obj && !b.attached) tagPickable(b);
  for (const b of BODIES) if (b.obj && b.attached) tagPickable(b);

  // Trajectoires elliptiques
  for (const p of SYSTEM) {
    if (p.orbit) {
      p.orbitLine = orbitLine(p.orbit, p.color, 0.2, false);
      scene.add(p.orbitLine);
    }
    for (const c of p.children) {
      if (c.orbit) {
        c.orbitLine = orbitLine(c.orbit, c.color, 0.22, true);
        scene.add(c.orbitLine);
      } else if (c.lagrange) {
        c.orbitLine = haloLine(c.lagrange, c.color);
        scene.add(c.orbitLine);
        ensureLagrangeMarker(p, c.lagrange.point);
      }
    }
  }

  COMETS.forEach((c) => {
    prepareOrbit(c.orbit, GM_SUN);
    c.line = orbitLine(c.orbit, '#bfe6ff', 0.06, true);
    scene.add(c.line);
  });

  // Sol praticable : surfaces des planètes (hors arbres, fusée…), le reste est obstacle
  for (const b of BODIES) {
    if (!b.glb || !b.obj || b.kind === 'star') continue;
    b.obj.traverse((o) => {
      if (!o.isMesh) return;
      let inRocket = false, leaf = false;
      for (let q = o; q && q !== b.obj; q = q.parent) { if (q.name === 'Rocket') inRocket = true; if (/Feuille/.test(q.name)) leaf = true; }
      o.userData.terrain = !inRocket && !leaf;
    });  // PERSION : la sphère bleue est l'océan, le continent est le rocher ; les nuages ne portent rien
  if (byId.persion?.obj) {
    byId.persion.obj.userData.terrain = false;
    byId.persion.obj.traverse((o) => { if (/Nuage/.test(o.name)) o.userData.terrain = false; });
  }

  }

  placeBodies(0);
  for (const b of BODIES) if (b.obj && !b.sky) measure(b);
  // Base de lancement : position de la fusée dans le repère de PROXION
  if (rocket && byId.proxion?.obj) {
    byId.proxion.obj.updateMatrixWorld(true);
    byId.proxion.launchLocal = byId.proxion.obj.worldToLocal(rocket.getWorldPosition(new THREE.Vector3()));
  }
  byId.lexa.viewRadius = SUN_RADIUS;
  setupWalking();
  // Éléments animés des monuments (train du RER à Meudon…)
  for (const b of BODIES) b.obj?.traverse((o) => { if (o.userData.tick) ticks.push(o.userData.tick); });
  ready = true;
}

// ---------------------------------------------------------------------------
// Astres praticables à pied : peuplement (villages, forêts, lacs) et données de collision
// ---------------------------------------------------------------------------
const WATER_MAT = new THREE.MeshStandardMaterial({ color: 0x3a8fc0, roughness: 0.22, metalness: 0.1, emissive: 0x0b2c44, emissiveIntensity: 0.35, transparent: true, opacity: 0.9 });
function terrainCentroid(obj) {
  obj.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
  const sum = new THREE.Vector3(), v = new THREE.Vector3();
  let n = 0;
  obj.traverse((o) => {
    if (!o.isMesh || !(o.userData.terrain || o.userData.water)) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 3) { sum.add(v.fromBufferAttribute(pos, i).applyMatrix4(m)); n++; }
  });
  return n ? sum.divideScalar(n) : new THREE.Vector3();
}
function colliderGroups(obj) {
  obj.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
  const out = [];
  let scope = null;
  obj.traverse((o) => {
    if (o.name === 'cover') return;
    if (o.userData.scope) scope = { obj: o, ...o.userData.scope };
    const col = o.userData.colliders;
    if (!col || !(col.boxes.length || col.cyls.length || col.rings.length)) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const sc = new THREE.Vector3().setFromMatrixScale(m).x;
    let rad = 0;
    for (const b of col.boxes) rad = Math.max(rad, Math.hypot(Math.max(Math.abs(b[0]), Math.abs(b[3])), Math.max(Math.abs(b[1]), Math.abs(b[4])), Math.max(Math.abs(b[2]), Math.abs(b[5]))));
    for (const c of col.cyls) rad = Math.max(rad, Math.hypot(c[0], c[1]) + c[2] + Math.abs(c[4]));
    for (const r of col.rings) rad = Math.max(rad, Math.hypot(r.x, r.z) + r.r + r.y1);
    out.push({ m, inv: m.clone().invert(), s: sc, center: new THREE.Vector3().setFromMatrixPosition(m), radius: rad * sc, col });
  });
  if (scope) {
    const m = new THREE.Matrix4().multiplyMatrices(inv, scope.obj.matrixWorld);
    scope.m = m; scope.inv = m.clone().invert();
  }
  return { groups: out, scope };
}
const ticks = [];
function setupWalking() {
  const t0 = performance.now();
  for (const b of BODIES) {
    const theme = THEMES[b.id];
    if (!theme || !b.obj) continue;
    const center = b.glb ? terrainCentroid(b.obj) : new THREE.Vector3();
    let exclude = null;
    if (b.isLandmark) {
      const cosCap = Math.cos((b.obj.userData.cap || 0.62) + 0.07);
      exclude = (d) => d.y > cosCap;
    } else if (theme.exclude === 'rocket' && b.launchLocal) {
      const rd = b.launchLocal.clone().sub(center).normalize();
      exclude = (d) => d.angleTo(rd) < 0.34;
    }
    const res = populate(b, { center, m2u: b.isLandmark ? 0.095 / 1.75 : null, theme, seed: b.id.length * 97 + b.id.charCodeAt(0), exclude, waterMat: WATER_MAT });
    toonify(res.group);
    const { groups, scope } = colliderGroups(b.obj);
    b.walk = { center, m2u: res.m2u, sampler: res.sampler, water: res.water, groups: groups.concat(res.colliders.map((g) => ({ ...g, inv: g.m.clone().invert() }))), R: res.R, scope };
    b.landable = true;
  }
  if (location.search.includes('debug')) console.log('T: peuplement', Math.round(performance.now() - t0), 'ms');
}

// ---------------------------------------------------------------------------
// Points de Lagrange L2 / L3 et orbites de halo
// ---------------------------------------------------------------------------
// Repère tournant lié au couple soleil–planète : u = radial, w = normale au plan, v = tangentiel
const LBasis = { u: new THREE.Vector3(), v: new THREE.Vector3(), w: new THREE.Vector3(0, 1, 0), m: new THREE.Matrix4() };
function rotatingFrame(p) {
  LBasis.u.copy(p.obj.position).normalize();
  LBasis.v.crossVectors(LBasis.w, LBasis.u).normalize();
  return LBasis;
}
function lagrangePoint(p, which, out) {
  const r = p.obj.position.length();
  const mu = p.mu || 0.003;
  const { u } = rotatingFrame(p);
  if (which === 'L3') return out.copy(u).multiplyScalar(-r * (1 + (5 * mu) / 12));
  const rh = r * Math.cbrt(mu / 3);
  return out.copy(p.obj.position).addScaledVector(u, which === 'L1' ? -rh : rh);
}
// Décalage sur l'orbite de halo / Lissajous, exprimé dans le repère tournant (x = u, y = w, z = v)
function haloLocal(l, phi, out) {
  return out.set(l.Ax * Math.cos(phi), l.Az * Math.sin((l.wz || 1) * phi + (l.phase ?? Math.PI / 2)), l.Ay * Math.sin(phi));
}
function haloLine(l, color) {
  const pts = [];
  const loops = (l.wz || 1) === 1 ? 1 : 6;
  for (let k = 0; k <= 200 * loops; k++) pts.push(haloLocal(l, (k / 200) * Math.PI * 2, new THREE.Vector3()));
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color, transparent: true, opacity: 0.25, dashSize: 1.2, gapSize: 0.9, depthWrite: false }));
  line.computeLineDistances();
  line.matrixAutoUpdate = false;
  return line;
}
function labelSprite(text, color) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const x = c.getContext('2d');
  x.strokeStyle = color; x.lineWidth = 4;
  x.beginPath(); x.arc(32, 32, 14, 0, Math.PI * 2); x.stroke();
  x.beginPath(); x.moveTo(32, 8); x.lineTo(32, 56); x.moveTo(8, 32); x.lineTo(56, 32); x.stroke();
  x.fillStyle = color; x.font = 'bold 34px Nunito, sans-serif'; x.textBaseline = 'middle'; x.fillText(text, 62, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.8, sizeAttenuation: false }));
  sp.scale.set(0.07, 0.035, 1);
  sp.center.set(0.25, 0.5);
  return sp;
}
const lagrangeMarkers = [];
function ensureLagrangeMarker(p, which) {
  if (lagrangeMarkers.some((m) => m.p === p && m.which === which)) return;
  const sprite = labelSprite(which, p.color);
  // Axe soleil – planète – point de Lagrange
  const axis = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineDashedMaterial({ color: p.color, transparent: true, opacity: 0.18, dashSize: 4, gapSize: 3, depthWrite: false }));
  axis.frustumCulled = false;
  scene.add(sprite, axis);
  lagrangeMarkers.push({ p, which, sprite, axis });
}
function updateLagrangeMarkers() {
  const g = current ? (current.parent || current) : null;
  for (const m of lagrangeMarkers) {
    lagrangePoint(m.p, m.which, m.sprite.position);
    const a = m.axis.geometry.attributes.position;
    const from = m.which === 'L3' ? m.p.obj.position : new THREE.Vector3(0, 0, 0);
    a.setXYZ(0, from.x, from.y, from.z);
    a.setXYZ(1, m.sprite.position.x, m.sprite.position.y, m.sprite.position.z);
    a.needsUpdate = true;
    m.axis.computeLineDistances();
    const show = g === m.p || current?.kind === 'star';
    m.sprite.material.opacity += ((show ? 0.85 : 0) - m.sprite.material.opacity) * 0.08;
    m.axis.material.opacity = m.sprite.material.opacity * 0.25;
    m.sprite.visible = m.axis.visible = m.sprite.material.opacity > 0.02;
  }
}

// ---------------------------------------------------------------------------
// Mouvements orbitaux
// ---------------------------------------------------------------------------
let simTime = 0;
const tmpL = new THREE.Vector3();
const ORIGIN = new THREE.Vector3();
function placeBodies(dt) {
  for (const c of COMETS) {
    c.orbit.M += c.orbit.n * dt;
    keplerPosition(c.orbit, c.obj.position);
    c.obj.userData.update(ORIGIN);
  }
  for (const p of SYSTEM) {
    if (p.kind === 'star' || !p.obj) continue;
    p.orbit.M += p.orbit.n * dt;
    keplerPosition(p.orbit, p.obj.position);
    p.atmo?.position.copy(p.obj.position);
    // Rotation propre, bien visible depuis la caméra alignée
    p.obj.rotation.y += dt * (p.spin ?? 0.06);
    p.mapDot?.position.copy(p.obj.position);
    p.mag?.position.copy(p.obj.position);
    for (const c of p.children) {
      if (!c.obj || c.attached) continue;
      if (c.lagrange) {
        // Satellite en orbite de halo autour de L2 / L3
        const l = c.lagrange;
        l.phi = (l.phi ?? 0) + ((Math.PI * 2) / l.period) * dt;
        lagrangePoint(p, l.point, tmpL);
        const B = rotatingFrame(p);
        B.m.makeBasis(B.u, B.w, B.v).setPosition(tmpL);
        c.obj.position.copy(haloLocal(l, l.phi, tmpV).applyMatrix4(B.m));
        c.orbitLine.matrix.copy(B.m);
        c.orbitLine.matrixWorldNeedsUpdate = true;
      } else if (c.binary) {
        // Système double : les deux corps tournent autour d'un barycentre commun
        c.orbit.M += c.orbit.n * dt;
        const k = keplerPosition(c.orbit, tmpV);
        c.orbitLine?.position.copy(p.obj.position);
        c.obj.position.copy(p.obj.position).addScaledVector(k, 1 - c.binary);
        p.obj.position.addScaledVector(k, -c.binary);
      } else {
        c.orbit.M += c.orbit.n * dt;
        keplerPosition(c.orbit, c.obj.position).add(p.obj.position);
        c.orbitLine?.position.copy(p.obj.position);
      }
      if (c.isLandmark) {
        // Rotation synchrone : le monument tourne le dos à sa planète, face à la caméra
        const out = tmpV.copy(c.obj.position).sub(p.obj.position);
        c.obj.rotation.y = Math.atan2(out.x, out.z) + 0.45;
      } else if (c.spin) {
        c.obj.rotation.y += c.spin * dt;
      }
      if (!c.updaters) { c.updaters = []; c.obj.traverse((o) => { if (o.userData.update) c.updaters.push(o); }); }
      c.updaters.forEach((o) => o.userData.update(simTime));
    }
  }
}

// ---------------------------------------------------------------------------
// Grande lunette : la coupole tourne et la monture suit ω Cen (suivi sidéral)
// ---------------------------------------------------------------------------
let tele = null;
const qInv = new THREE.Quaternion();
function updateTelescope(dt) {
  if (!tele) return;
  byId.meudon.obj.updateMatrixWorld(true);
  tele.cp.getWorldQuaternion(qInv).invert();
  // Direction de l'amas dans le repère local de la coupole : la monture compense
  // à chaque instant la rotation de la lune et le mouvement d'ASTRA
  const d = OMEGA_DIR.clone().applyQuaternion(qInv);
  tele.rot.rotation.y = Math.atan2(d.x, d.z);
  tele.alt.rotation.x = -Math.max(0.05, Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)));
  const target = current?.id === 'omega' || insideDome() ? 1 : 0;
  tele.open += (target - tele.open) * Math.min(1, dt * 1.2);
  tele.a.rotation.y = -tele.open * (tele.gap / 2 + 0.03);
  tele.b.rotation.y = tele.open * (tele.gap / 2 + 0.03);
}

// ---------------------------------------------------------------------------
// Météo spatiale : vent solaire variable, éjections de masse coronale, orages magnétiques
// ---------------------------------------------------------------------------
const MAGNETIC = BODIES.filter((b) => b.magnetic);
let swMessage = '', swTimer = 0;
function swSay(text, cls = '', duration = 9) {
  swMessage = text; swTimer = duration;
  const el = document.getElementById('space-weather');
  document.getElementById('sw-text').textContent = text;
  el.classList.toggle('alert', cls === 'alert');
  el.classList.toggle('aurora', cls === 'aurora');
}
function spawnCME() {
  const c = cmes.find((x) => !x.active);
  if (!c) return;
  const g = current ? groupOf(current) : null;
  let target = null;
  if (g?.magnetic && Math.random() < 0.65) target = g;
  else if (Math.random() < 0.6) target = MAGNETIC[Math.floor(Math.random() * MAGNETIC.length)];
  if (target) c.dir.copy(target.obj.position).normalize();
  else c.dir.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.3, Math.random() - 0.5).normalize();
  c.target = target;
  c.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), c.dir);
  c.r = SUN_RADIUS;
  c.speed = 105 + Math.random() * 40;
  c.hits.clear();
  c.active = true;
  c.mesh.visible = true;
  coronaFlare = 1;
  swSay(target ? `Éjection de masse coronale en route vers ${target.name}` : 'Éjection de masse coronale', 'alert', 12);
}
let coronaFlare = 0;
let windLevel = 0.5;
function updateSpaceWeather(dt) {
  const wind = 0.5 + 0.25 * Math.sin(simTime * 0.13) + 0.15 * Math.sin(simTime * 0.37 + 1);
  windLevel = wind + Math.max(0, ...MAGNETIC.map((p) => p.storm)) * 0.3;
  nextCME -= dt;
  if (nextCME <= 0) { spawnCME(); nextCME = 22 + Math.random() * 20; }
  coronaFlare = Math.max(0, coronaFlare - dt / 3);
  for (const c of cmes) {
    if (!c.active) continue;
    c.r += c.speed * dt;
    const u = c.mesh.userData.uniforms;
    u.uR.value = c.r;
    u.uTime.value = simTime;
    u.uScale.value = (window.innerHeight * pixelRatio) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    u.uFade.value = THREE.MathUtils.smoothstep(c.r, SUN_RADIUS, SUN_RADIUS + 30) * (1 - THREE.MathUtils.smoothstep(c.r, 850, 1150));
    for (const p of MAGNETIC) {
      if (c.hits.has(p)) continue;
      const d = p.obj.position.length();
      if (c.r >= d - 8 && p.obj.position.clone().normalize().dot(c.dir) > Math.cos(0.5)) {
        c.hits.add(p);
        p.storm = 1;
        swSay(`Orage géomagnétique : aurores sur ${p.name}`, 'aurora', 14);
      }
    }
    if (c.r > 1150) { c.active = false; c.mesh.visible = false; }
  }
  const g = current ? groupOf(current) : null;
  for (const p of MAGNETIC) {
    p.storm = Math.max(0, p.storm - dt / 18);
    const au = p.aurora.userData.uniforms;
    au.uTime.value = simTime;
    // Aurores seulement au contact du plasma solaire
    p.aurora.userData.setIntensity(1.6 * p.storm);
    p.aurora.visible = p.storm > 0.01;
    const mu = p.magneto.userData.uniforms;
    // Direction du soleil dans le repère du dipôle (sert à comprimer le champ et à décaler l'ovale auroral)
    p.mag.updateMatrixWorld();
    mu.uSun.value.copy(p.obj.position).negate().normalize().applyQuaternion(p.mag.getWorldQuaternion(qInv).invert());
    au.uSun.value.copy(mu.uSun.value);
    // Onde de choc : la bulle magnétique s'illumine pendant l'impact
    mu.uOpacity.value = Math.min(1, p.storm * 1.4) * (g === p ? 1 : 0.5);
    p.magneto.visible = mu.uOpacity.value > 0.01;
  }
  swTimer -= dt;
  if (swTimer <= 0 && swMessage !== 'calme') {
    swMessage = 'calme';
    const el = document.getElementById('space-weather');
    el.classList.remove('alert', 'aurora');
    document.getElementById('sw-text').textContent = wind > 0.7 ? 'Vent solaire soutenu' : 'Vent solaire calme';
  }
}

// ---------------------------------------------------------------------------
// Caméra : cadrage, glissés entre astres, rotation à la souris
// ---------------------------------------------------------------------------
let current = null;
const look = new THREE.Vector3();
const user = { yaw: 0, pitch: 0, zoom: 1, tYaw: 0, tPitch: 0, tZoom: 1 };
let trans = null;
const viewOffset = { x: 0, y: 0, tx: 0, ty: 0 };

function bodyCenter(b, out = new THREE.Vector3()) {
  if (!b.obj) return out.set(0, 0, 0);
  return b.obj.localToWorld(out.copy(b.centerLocal || tmpV.set(0, 0, 0)));
}

const UP = new THREE.Vector3(0, 1, 0);
// Cadrage : la caméra se place dans l'alignement soleil → planète (ou planète → satellite),
// un peu en retrait et en hauteur. L'astre n'est pas figé au centre : on vise un point
// décalé vers son « parent », pour voir à la fois l'astre qui tourne et ce qui l'éclaire ou l'attire.
function frameFor(b) {
  if (b.telescope && tele) {
    // Vue dans la lunette : la caméra se place à l'objectif et vise l'amas
    const pos = tele.eye.getWorldPosition(new THREE.Vector3());
    return { pos, look: pos.clone().addScaledVector(OMEGA_DIR, 100), fov: THREE.MathUtils.clamp(3.2 * user.zoom, 1.2, 9), approach: OMEGA_DIR };
  }
  const center = bodyCenter(b);
  const portrait = Math.max(1, 1.05 / camera.aspect);
  if (b.kind === 'star') {
    const yaw = 0.55 + user.yaw;
    const pitch = THREE.MathUtils.clamp(0.62 + user.pitch, 0.05, 1.45);
    const dist = 2350 * user.zoom * portrait;
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    return { pos: center.clone().addScaledVector(dir, dist), look: center };
  }
  const R = b.viewRadius || 3;
  const dist = R * 3.1 * (b.view?.dist || (b.isLandmark ? 0.85 : b.kind === 'planet' ? 1.6 : 1)) * user.zoom * portrait;
  if (b.view?.surface && b.parent) {
    // Vue rasante au-dessus d'un élément posé sur une planète
    const n = center.clone().sub(bodyCenter(b.parent)).normalize();
    const side = UP.clone().cross(n).normalize();
    const dir = n.clone().multiplyScalar(0.8).addScaledVector(side, 0.45).add(new THREE.Vector3(0, 0.35, 0)).normalize();
    dir.applyAxisAngle(UP, user.yaw);
    return { pos: center.clone().addScaledVector(dir, dist), look: center };
  }
  // Axe d'alignement : du parent (soleil ou planète) vers l'astre visité
  const parentPos = b.kind === 'planet' ? new THREE.Vector3() : bodyCenter(b.parent);
  const u = center.clone().sub(parentPos).setY(0);
  if (u.lengthSq() < 1e-4) u.set(1, 0, 0);
  u.normalize();
  const side = UP.clone().cross(u).normalize();
  const alpha = (b.kind === 'planet' ? 0.85 : 0.6) + user.yaw;
  const basePitch = b.view?.pitch ?? (b.isLandmark ? 0.5 : b.kind === 'planet' ? 0.26 : 0.3);
  const pitch = THREE.MathUtils.clamp(basePitch + user.pitch, -1.2, 1.4);
  const flat = u.clone().multiplyScalar(Math.cos(alpha)).addScaledVector(side, Math.sin(alpha));
  const dir = flat.multiplyScalar(Math.cos(pitch)).addScaledVector(UP, Math.sin(pitch)).normalize();
  // Pour les lunes-monuments, on vise le bâtiment posé au sommet
  const focus = center.clone();
  if (b.isLandmark) focus.y += b.obj.userData.topY * b.obj.scale.x * 0.75;
  const look = focus.clone().addScaledVector(u, -R * (b.kind === 'planet' ? 1.5 : 0.9));
  return { pos: focus.clone().addScaledVector(dir, dist), look };
}

const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
function bezier(a, b, c, d, t) {
  const u = 1 - t;
  return a.clone().multiplyScalar(u * u * u)
    .addScaledVector(b, 3 * u * u * t)
    .addScaledVector(c, 3 * u * t * t)
    .addScaledVector(d, t * t * t);
}

// Transition : trajectoire courbe et douce, orientation interpolée sans à-coups
// Transfert orbital réaliste en trois phases :
//   1. désorbitage : on quitte l'orbite de l'astre de départ en spirale ;
//   2. transfert : accélération puis croisière et freinage sur un arc autour du soleil
//      (ou de la planète mère, entre deux lunes), comme une orbite de transfert ;
//   3. mise en orbite : on rejoint l'astre visé en tournant autour de lui.
function startTransition(target, prev = null) {
  const f0 = frameFor(target);
  const fromP = camera.position.clone();
  const dist = fromP.distanceTo(f0.pos);
  if (!(dist < 25 || target.telescope || reduceMotion)) {
    const dep = prev && prev.obj && prev.kind !== 'star' && !prev.telescope && !prev.attached ? prev : null;
    const gT = groupOf(target), gP = prev ? groupOf(prev) : null;
    const hub = gP === gT && gT.kind === 'planet' && (prev !== gT || target !== gT) ? gT : null;
    const startOffset = dep ? fromP.clone().sub(bodyCenter(dep)) : null;
    // Départ posé au sol (base de lancement) : montée presque verticale avant de s'incliner
    const fromSurface = !!(dep && startOffset.length() < bodyRadius(dep) * 1.4);
    trail.userData.n = 0;
    const baseDur = THREE.MathUtils.clamp(3.2 + dist / 260, 3.5, 9.5);
    // Avant tout, le vaisseau pivote sur place vers sa destination (sauf au décollage depuis le sol)
    const pivot = fromSurface ? 0 : 1.6;
    trans = {
      kind: 'transfer', from: fromP, dep, hub, startOffset, rDep: startOffset ? startOffset.length() : 0, fromSurface,
      t: 0, d: dist, fP: pivot / (baseDur + pivot),
      fA: fromSurface ? 0.26 : dep ? 0.2 : 0.06, fC: 0.24, thA: fromSurface ? 0.35 : 0.9, thC: 1.2,
      fovFrom: camera.userData.baseFov ?? 50,
      qFrom: camera.quaternion.clone(),
      dur: baseDur + pivot,
    };
    return;
  }
  const to = f0.pos;
  const from = camera.position.clone();
  const d = from.distanceTo(to);
  const seg = to.clone().sub(from);
  // Contournement du soleil si la ligne droite le frôle
  const t = THREE.MathUtils.clamp(-from.dot(seg) / Math.max(seg.lengthSq(), 1e-6), 0, 1);
  const closest = from.clone().addScaledVector(seg, t);
  const lift = new THREE.Vector3(0, d * 0.07, 0);
  const safe = SUN_RADIUS * 2.4;
  if (closest.length() < safe) {
    const away = closest.lengthSq() > 1 ? closest.clone().normalize() : UP.clone();
    lift.addScaledVector(away, (safe - closest.length()) * 1.5);
  }
  // On part dans la direction du regard seulement si la cible est devant
  const fwd = camera.getWorldDirection(new THREE.Vector3());
  const ahead = Math.max(0, fwd.dot(seg.clone().normalize()));
  trail.userData.n = 0;
  trans = {
    kind: 'bezier', from, lift, t: 0, d,
    fovFrom: camera.userData.baseFov ?? 50,
    qFrom: camera.quaternion.clone(),
    lead: fwd.multiplyScalar(d * 0.18 * ahead),
    dur: reduceMotion ? 0.01 : THREE.MathUtils.clamp(2.2 + d / 450, 2.2, 6.5),
  };
}

// Position sur le transfert à l'instant t (0 → 1), recalculée avec les astres là où ils sont
// Temps du transfert proprement dit, une fois le pivotement terminé
const transT = (tr, t = tr.t) => (tr.fP ? Math.max(0, (t - tr.fP) / (1 - tr.fP)) : t);
function transferPos(tr, t, f) {
  t = transT(tr, t);
  const fB = 1 - tr.fA - tr.fC;
  const depC = tr.dep ? bodyCenter(tr.dep) : null;
  const tgtNow = bodyCenter(current);
  const aPoint = (u) => {
    if (!tr.dep) return tr.from.clone();
    const off = tr.startOffset.clone();
    if (tr.fromSurface) off.applyAxisAngle(UP, tr.thA * u);
    else {
      // Désorbitage : on quitte l'orbite en s'écartant progressivement vers la destination
      const toward = tgtNow.clone().sub(depC).normalize();
      const dir = off.clone().normalize().lerp(toward, 0.75 * u * u).normalize();
      off.copy(dir).multiplyScalar(off.length());
    }
    off.setLength(tr.rDep * (1 + (tr.fromSurface ? 4 : 1.3) * u));
    off.y += tr.rDep * (tr.fromSurface ? 0.1 : 0.25) * u;
    return depC.clone().add(off);
  };
  const tgtC = current.isLandmark ? f.look.clone() : bodyCenter(current);
  const endOff = f.pos.clone().sub(tgtC);
  const cPoint = (u) => {
    const off = endOff.clone().applyAxisAngle(UP, -tr.thC * (1 - u));
    off.multiplyScalar(1 + 1.8 * (1 - u) * (1 - u));
    return tgtC.clone().add(off);
  };
  if (t < tr.fA) {
    const u = t / tr.fA;
    return aPoint(u * u); // départ lent, on prend de la vitesse
  }
  if (t < tr.fA + fB) {
    const e0 = (t - tr.fA) / fB;
    const e = 0.45 * e0 + 0.55 * smoother(e0);
    const hubC = tr.hub ? bodyCenter(tr.hub) : new THREE.Vector3();
    const p1 = aPoint(1).sub(hubC), p2 = cPoint(0).sub(hubC);
    const r1 = Math.hypot(p1.x, p1.z), r2 = Math.hypot(p2.x, p2.z);
    const a1 = Math.atan2(p1.z, p1.x);
    let da = Math.atan2(p2.z, p2.x) - a1;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    let r = THREE.MathUtils.lerp(r1, r2, e);
    if (!tr.hub) r = Math.max(r, SUN_RADIUS * 2.6);
    const a = a1 + da * e;
    const y = THREE.MathUtils.lerp(p1.y, p2.y, e) + Math.sin(Math.PI * e) * Math.min(tr.d * 0.05, 50);
    return hubC.add(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  const u = (t - tr.fA - fB) / tr.fC;
  return cPoint(1 - (1 - u) * (1 - u)); // freinage jusqu'à l'orbite
}
function transferPhase(tr) {
  if (!tr) return null;
  if (tr.kind !== 'transfer') return 'En route';
  if (tr.fP && tr.t < tr.fP) return 'Pivotement';
  const fB = 1 - tr.fA - tr.fC;
  const T = transT(tr);
  tr = { ...tr, t: T };
  if (tr.t < tr.fA) return tr.fromSurface ? (tr.t < tr.fA * 0.5 ? 'Décollage' : 'Mise en orbite basse') : 'Désorbitage';
  if (tr.t < tr.fA + fB * 0.35) return 'Accélération';
  if (tr.t < tr.fA + fB * 0.7) return 'Croisière';
  if (tr.t < tr.fA + fB) return 'Freinage';
  return 'Mise en orbite';
}

const qTmp = new THREE.Quaternion();
const mTmp = new THREE.Matrix4();
function updateCamera(dt) {
  user.yaw += (user.tYaw - user.yaw) * Math.min(1, dt * 6);
  user.pitch += (user.tPitch - user.pitch) * Math.min(1, dt * 6);
  user.zoom += (user.tZoom - user.zoom) * Math.min(1, dt * 6);
  const f = frameFor(current);
  const targetFov = f.fov ?? 50;
  let fov = targetFov;
  ship.visible = trail.visible = false; // en pilote automatique, on est dans le cockpit
  camera.up.set(0, 1, 0);
  autoThrust = 0.04;
  if (trans && trans.kind === 'transfer') {
    trans.t = Math.min(1, trans.t + dt / trans.dur);
    const P = transferPos(trans, trans.t, f);
    camera.position.copy(P);
    // Le nez du vaisseau suit la trajectoire, puis se tourne vers l'astre pendant la mise en orbite
    const T = transferPos(trans, Math.min(1, trans.t + 0.004), f).sub(P);
    mTmp.lookAt(P, f.look, UP);
    const qTarget = new THREE.Quaternion().setFromRotationMatrix(mTmp);
    if (T.lengthSq() > 1e-8) mTmp.lookAt(P, P.clone().add(T), UP);
    const qPath = new THREE.Quaternion().setFromRotationMatrix(mTmp);
    // Nez pointé vers la destination
    mTmp.lookAt(P, bodyCenter(current), UP);
    const qDest = new THREE.Quaternion().setFromRotationMatrix(mTmp);
    const t = transT(trans);
    const b = THREE.MathUtils.smoothstep(t, 1 - trans.fC * 0.85, 1);
    if (trans.fP) {
      // 1. pivotement sur place, 2. désorbitage et transfert le nez vers la destination
      camera.quaternion.copy(trans.qFrom).slerp(qDest, smoother(Math.min(1, trans.t / trans.fP)));
    } else {
      camera.quaternion.copy(trans.qFrom).slerp(qPath, THREE.MathUtils.smoothstep(t, 0, trans.fA + 0.06))
        .slerp(qDest, THREE.MathUtils.smoothstep(t, trans.fA, trans.fA + 0.2));
    }
    camera.quaternion.slerp(qTarget, b);
    // Poussée : pivotement aux propulseurs d'attitude, désorbitage, accélération, croisière, freinage, insertion
    const fB = 1 - trans.fA - trans.fC;
    autoThrust = trans.fP && trans.t < trans.fP ? 0.12 : t < trans.fA ? 0.55 : t < trans.fA + fB * 0.35 ? 1 : t < trans.fA + fB * 0.7 ? 0.08 : t < trans.fA + fB ? 0.85 : 0.4;
    fov = THREE.MathUtils.lerp(trans.fovFrom, targetFov, Math.min(1, trans.t * 4)) + Math.sin(Math.PI * THREE.MathUtils.clamp((t - trans.fA) / fB, 0, 1)) * 4;
    look.copy(f.look);
    if (trans.t >= 1) trans = null;
  } else if (trans) {
    trans.t = Math.min(1, trans.t + dt / trans.dur);
    const s = smoother(trans.t);
    const c1 = trans.from.clone().add(trans.lead).add(trans.lift);
    // Vers la lunette : on entre par la trappe, dans l'axe de visée
    const c2 = f.approach ? f.pos.clone().addScaledVector(f.approach, 6) : f.pos.clone().addScaledVector(trans.lift, 0.5);
    const path = (x) => bezier(trans.from, c1, c2, f.pos, x);
    const P = path(s);
    camera.position.copy(P);
    // Orientation : le vaisseau pivote vers sa route, file le nez dans la direction du trajet,
    // puis se tourne vers l'astre en arrivant (moins de rotations parasites)
    mTmp.lookAt(P, f.look, UP);
    const qTarget = new THREE.Quaternion().setFromRotationMatrix(mTmp);
    if (trans.d > 25 && !reduceMotion) {
      const T = path(Math.min(1, s + 0.015)).sub(P);
      if (T.lengthSq() < 1e-8) T.copy(f.look).sub(P);
      mTmp.lookAt(P, P.clone().add(T), UP);
      const qPath = new THREE.Quaternion().setFromRotationMatrix(mTmp);
      const a = THREE.MathUtils.smoothstep(trans.t, 0.0, 0.22);
      const b = THREE.MathUtils.smoothstep(trans.t, 0.66, 0.97);
      camera.quaternion.copy(trans.qFrom).slerp(qPath, a).slerp(qTarget, b);
    } else {
      camera.quaternion.copy(trans.qFrom).slerp(qTarget, smoother(Math.min(1, trans.t * 1.08)));
    }
    autoThrust = 0.15 + 0.85 * Math.sin(Math.PI * Math.min(1, trans.t * 1.15));
    const zoomIn = smoother(THREE.MathUtils.clamp((trans.t - 0.55) / 0.45, 0, 1));
    fov = THREE.MathUtils.lerp(trans.fovFrom, targetFov, zoomIn) + Math.sin(s * Math.PI) * 3;
    look.copy(f.look);
    if (trans.t >= 1) trans = null;
  } else {
    camera.position.copy(f.pos);
    look.copy(f.look);
    camera.lookAt(look);
  }
  if (views.auto === 'tpv' && !current.telescope) {
    // Vue extérieure : le vaisseau suit la trajectoire calculée, la caméra le suit de près
    const P = camera.position.clone(), q = camera.quaternion.clone();
    const d = THREE.MathUtils.clamp(P.distanceTo(bodyCenter(current)) * 0.1, 1.2, 16);
    ship.visible = true;
    ship.position.copy(P);
    ship.quaternion.copy(q).multiply(qFlip);
    ship.scale.setScalar(d * 0.075);
    ship.userData.setThrust(autoThrust, simTime);
    pushTrail(ship.localToWorld(new THREE.Vector3(0, 0, -1.1)), autoThrust);
    camera.position.copy(P).add(new THREE.Vector3(0, d * 0.72, d * 0.95).applyQuaternion(q));
    camera.up.set(0, 1, 0).applyQuaternion(q);
    camera.lookAt(P.clone().add(new THREE.Vector3(0, 0, -d * 0.9).applyQuaternion(q)));
    camera.up.set(0, 1, 0);
  }
  camera.userData.baseFov = trans ? fov : targetFov;
  // Oculaire : masque circulaire une fois dans la lunette
  const inScope = current.telescope && (!trans || trans.t > 0.88);
  document.getElementById('eyepiece').classList.toggle('on', !!inScope);
  document.body.classList.toggle('in-scope', !!inScope);
  // Dans l'oculaire, le fond de ciel nébuleux grossi devient un aplat : on le masque
  sky.visible = !inScope;
  if (inScope) {
    const ep = document.getElementById('eyepiece').style;
    const W = window.innerWidth, H = window.innerHeight;
    const d = cockpitLayout() ? Math.min(glassPx * 0.86, W * 0.7) : Math.min(H * 0.78, W * 0.7);
    const ey = H / 2 - viewOffset.y;
    ep.setProperty('--ex', `${W / 2 - viewOffset.x}px`);
    ep.setProperty('--ey', `${ey}px`);
    ep.setProperty('--ed', `${d}px`);
    ep.setProperty('--ei', `${ey + d / 2 + 6}px`);
  }
  applyProjection(dt, fov);
}

// Décalage du point de fuite pour laisser l'astre entre le panneau et le journal
function applyProjection(dt, fov) {
  viewOffset.x += (viewOffset.tx - viewOffset.x) * Math.min(1, dt * 3);
  viewOffset.y += (viewOffset.ty - viewOffset.y) * Math.min(1, dt * 3);
  camera.fov = fov;
  const w = window.innerWidth, h = window.innerHeight;
  camera.setViewOffset(w, h, viewOffset.x, viewOffset.y, w, h);
  camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------------------
// Tableau de bord du cockpit
// ---------------------------------------------------------------------------
let autoThrust = 0;
let pendingFree = false;
const lastCam = new THREE.Vector3();
let camSpeed = 0;
const UA = 190; // 1 UA = 190 unités de la scène
const fmt = (x, d = 2) => x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const sunDirCam = new THREE.Vector3(), camInv = new THREE.Quaternion();
const hudEl = {
  top: document.getElementById('arc-top-text'), bot: document.getElementById('arc-bot-text'),
  ret: document.getElementById('reticle'), retLabel: document.getElementById('reticle-label'),
};
{
  // Graduations de cap le long de l'arc supérieur de la verrière
  let t = '';
  for (let a = -60; a <= 60; a += 5) {
    const r = (a - 90) * Math.PI / 180, cx = 800, cy = 470, rx = 560, ry = 300, k = a % 15 === 0 ? 0.94 : 0.97;
    t += `<line x1="${(cx + Math.cos(r) * rx).toFixed(1)}" y1="${(cy + Math.sin(r) * ry).toFixed(1)}" x2="${(cx + Math.cos(r) * rx * k).toFixed(1)}" y2="${(cy + Math.sin(r) * ry * k).toFixed(1)}" />`;
  }
  document.getElementById('arc-ticks').innerHTML = t;
}
let hudTimer = 0, flickerTimer = 0;
let showOrbits = true;
function updateDashboard(dt) {
  const v = camera.position.distanceTo(lastCam) / Math.max(dt, 1e-3);
  lastCam.copy(camera.position);
  camSpeed += (v - camSpeed) * Math.min(1, dt * 4);
  if (tpvScreens()) {
    flickerTimer -= dt;
    if (flickerTimer <= 0) {
      flickerTimer = 0.09;
      flickerGlitch([ui.panelBody, tree.querySelector('.tree-inner')]);
      const tc = document.getElementById('tpv-tc');
      const t = performance.now() / 1000;
      tc.textContent = `${trans ? transferPhase(trans).toUpperCase() : 'EN ORBITE'}  ${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${String(Math.floor(t) % 60).padStart(2, '0')}:${String(Math.floor((t % 1) * 25)).padStart(2, '0')}`;
    }
    updateVHS(dt);
  }
  if (!cockpitLayout() || !current) { hudEl.ret.classList.remove('on'); return; }
  const tgt = bodyCenter(current);
  const dist = camera.position.distanceTo(tgt);
  const phase = mode === 'free' ? (free.landed ? 'Posé' : 'Vol libre') : trans ? transferPhase(trans) : current.telescope ? 'À la lunette' : current.kind === 'star' ? 'Vue d’ensemble' : 'En orbite';
  const distTxt = current.telescope ? '≈ 17 000 al' : `${fmt(dist / UA, 3)} UA`;
  // Distance au soleil, convertie par l'échelle d = 190 × UA^0,7
  const helio = `${fmt(Math.pow(camera.position.length() / UA, 1 / 0.7), 2)} UA`;
  const storm = Math.max(0, ...MAGNETIC.map((p) => p.storm));
  const wind = THREE.MathUtils.clamp(windLevel, 0, 1);
  // Lumière de l'étoile dans le repère du cockpit
  camInv.copy(camera.quaternion).invert();
  sunDirCam.copy(camera.position).negate().applyQuaternion(camInv).normalize();
  const sunPower = THREE.MathUtils.clamp(2.2 * Math.pow(UA / Math.max(camera.position.length(), 1), 0.5), 0.25, 2.2);
  const b = document.body.classList;
  cockpit.setLit('transfer', !!trans);
  cockpit.setLit('fiche', !b.contains('hide-fiche'));
  cockpit.setLit('journal', !b.contains('hide-journal'));
  cockpit.setLit('hud', !b.contains('hide-hud'));
  cockpit.setLit('orbits', showOrbits);
  cockpit.setLit('scope', !!current.telescope);
  cockpit.setLit('gallery', !!ui.panelBody.querySelector('[data-gallery]'));
  cockpit.update(dt, {
    thrust: autoThrust, wind, storm, sunDir: sunDirCam, sunPower,
    dist: current.telescope ? 1 : THREE.MathUtils.clamp(Math.log10(1 + dist / 4) / 3, 0, 1),
    loop: 1 - loopLeft / LOOP,
    turn: THREE.MathUtils.clamp(user.tYaw * 0.5, -1, 1), pitch: THREE.MathUtils.clamp(user.tPitch * 0.5, -1, 1),
    crtLeft: ['MÉTÉO SPATIALE', `VENT   ${Math.round(320 + wind * 420)} KM/S`, `ÉMC    ${storm > 0.2 ? 'IMPACT' : 'AUCUNE'}`, `AURORES ${storm > 0.2 ? 'ACTIVES' : 'CALMES'}`, `BOUCLE ${ui.time.textContent}`],
    crtRight: ['NAVIGATION', `CIBLE  ${current.name}`, `PHASE  ${phase.toUpperCase()}`, `DIST   ${distTxt}`, `HÉLIO  ${helio}`],
  });

  // Texte sur les arcs de la verrière
  hudTimer -= dt;
  if (hudTimer <= 0) {
    hudTimer = 0.3;
    const bars = '▮'.repeat(Math.round(autoThrust * 5)) + '▯'.repeat(5 - Math.round(autoThrust * 5));
    hudEl.top.innerHTML = glitchTspans(`◉ ${current.name} · ${current.section.toUpperCase()} ── ${phase.toUpperCase()} ── ${distTxt}`);
    hudEl.bot.innerHTML = glitchTspans(`VIT ${fmt(camSpeed / UA, 2)} UA/S  ·  POUSSÉE ${bars}  ·  VENT ${Math.round(320 + wind * 420)} KM/S${cmes.some((c) => c.active) ? '  ·  ÉMC EN VOL' : ''}`);
  }
  flickerTimer -= dt;
  if (flickerTimer <= 0) {
    flickerTimer = 0.09;
    flickerGlitch([ui.panelBody, tree.querySelector('.tree-inner')]);
  }
  updateVHS(dt);

  // Réticule autour de la cible
  const w = window.innerWidth, h = window.innerHeight;
  const c = tmpV.copy(tgt).project(camera);
  const x = (c.x * 0.5 + 0.5) * w, y = (-c.y * 0.5 + 0.5) * h;
  const show = !current.telescope && current.kind !== 'star' && c.z < 1 && y < glassPx - 20 && x > 0 && x < w;
  hudEl.ret.classList.toggle('on', show);
  if (show) {
    const R = (current.viewRadius || bodyRadius(current)) * 1.15;
    const r = THREE.MathUtils.clamp((R / Math.max(dist, 1e-3)) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * h / 2, 30, h * 0.2);
    Object.assign(hudEl.ret.style, { left: `${x - r}px`, top: `${y - r}px`, width: `${2 * r}px`, height: `${2 * r}px` });
    const label = `${current.name} ▸ ${distTxt}`;
    if (hudEl.retLabel.dataset.t !== label) { hudEl.retLabel.dataset.t = label; hudEl.retLabel.textContent = label; }
  }
}

// Clavier de bord
function cockpitAction(a) {
  const b = document.body.classList;
  ({
    prevPlanet: () => stepPlanet(-1), nextPlanet: () => stepPlanet(1), prevMoon: () => stepMoon(-1), nextMoon: () => stepMoon(1),
    home: () => goTo('lexa'), free: () => setMode(mode === 'auto' ? 'free' : 'auto'), view: () => toggleView(),
    fiche: () => b.toggle('hide-fiche'), journal: () => b.toggle('hide-journal'), hud: () => b.toggle('hide-hud'),
    orbits: () => { showOrbits = !showOrbits; },
    gallery: () => { const g = ui.panelBody.querySelector('[data-gallery]'); if (g) openGallery(g.dataset.gallery); },
    scope: () => goTo(current?.telescope ? 'meudon' : 'omega'),
  })[a]?.();
}

// Traînée du réacteur
function pushTrail(p, w) {
  const pos = trail.geometry.attributes.position, col = trail.geometry.attributes.color;
  const n = Math.min(TRAIL_N, (trail.userData.n || 0) + 1);
  trail.userData.n = n;
  for (let i = n - 1; i > 0; i--) pos.setXYZ(i, pos.getX(i - 1), pos.getY(i - 1), pos.getZ(i - 1));
  pos.setXYZ(0, p.x, p.y, p.z);
  for (let i = 0; i < TRAIL_N; i++) {
    const k = i < n ? Math.pow(1 - i / TRAIL_N, 2) * w : 0;
    col.setXYZ(i, 1.0 * k, 0.6 * k, 0.3 * k);
  }
  trail.geometry.setDrawRange(0, n);
  pos.needsUpdate = col.needsUpdate = true;
  trail.visible = n > 1;
}

// Cockpit sur grand écran : la vue se limite à la verrière (64 % supérieurs de l'écran)
// Pilote automatique en vue extérieure : écran caméra central et écrans verts latéraux
function tpvScreens() { return window.innerWidth > 760 && mode === 'auto' && views.auto === 'tpv'; }
function cockpitLayout() { return window.innerWidth > 760 && views[mode] === 'fpv' && !(mode === 'free' && free.walker); }
function computeViewOffset() {
  const w = window.innerWidth, h = window.innerHeight;
  const mobile = w <= 760;
  if (tpvScreens()) {
    // Centre de l'écran caméra (25 vw à gauche, 23 vw à droite, 6 vh en haut, 11 vh en bas)
    viewOffset.tx = w / 2 - (0.25 * w + 0.77 * w) / 2;
    viewOffset.ty = h / 2 - (0.06 * h + 0.89 * h) / 2;
    return;
  }
  if (cockpitLayout()) {
    glassPx = cockpit.glassBottom(h);
    document.body.style.setProperty('--glass-bottom', `${glassPx}px`);
    viewOffset.tx = 0;
    viewOffset.ty = h / 2 - glassPx / 2;
    return;
  }
  if (mobile) {
    const top = 70;
    const bottom = ui.panel.classList.contains('visible') ? ui.panel.getBoundingClientRect().top : h - 80;
    viewOffset.tx = 0;
    viewOffset.ty = h / 2 - (top + bottom) / 2;
    return;
  }
  const left = ui.panel.classList.contains('visible') ? ui.panel.getBoundingClientRect().right : 0;
  const right = tree.getBoundingClientRect().left || w;
  viewOffset.tx = w / 2 - (left + right) / 2;
  viewOffset.ty = 0;
}


// ---------------------------------------------------------------------------
// Vol libre : pilotage manuel, caméra à la troisième personne
// ---------------------------------------------------------------------------
const MODE_KEY = 'sysE139.mode';
let mode = 'auto';
try { mode = localStorage.getItem(MODE_KEY) === 'free' ? 'free' : 'auto'; } catch (e) { /* ignore */ }
// Vue à la première personne (cockpit) ou à la troisième personne, réglable dans chaque mode
const VIEW_KEY = 'sysE139.views';
const views = { auto: 'fpv', free: 'tpv' };
try { Object.assign(views, JSON.parse(localStorage.getItem(VIEW_KEY) || '{}')); } catch (e) { /* ignore */ }
const qFlip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
function syncLayout() {
  document.body.classList.toggle('cockpit', cockpitLayout());
  const btn = document.getElementById('view-toggle');
  btn.textContent = views[mode] === 'fpv' ? 'Vue cockpit' : 'Vue extérieure';
  btn.classList.toggle('fpv', views[mode] === 'fpv');
  document.body.classList.toggle('walking', mode === 'free' && !!free.walker);
  document.body.classList.toggle('tpv-screens', tpvScreens());
  document.body.classList.toggle('free-tpv', mode === 'free' && views.free === 'tpv' && !free.walker);
  if ((cockpitLayout() || tpvScreens()) && !tree.querySelector('.tree-inner').dataset.glitched) glitchify(tree.querySelector('.tree-inner'), 0.8);
  if ((cockpitLayout() || tpvScreens()) && ui.panelBody.textContent && !ui.panelBody.querySelector('.gc')) glitchify(ui.panelBody);
  computeViewOffset();
}
function toggleView() {
  views[mode] = views[mode] === 'fpv' ? 'tpv' : 'fpv';
  try { localStorage.setItem(VIEW_KEY, JSON.stringify(views)); } catch (e) { /* ignore */ }
  trail.userData.n = 0;
  syncLayout();
}
document.getElementById('view-toggle').addEventListener('click', (e) => { e.stopPropagation(); toggleView(); e.currentTarget.blur(); });
const free = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), offset: new THREE.Vector3(), ang: new THREE.Vector3(),
  anchor: null, target: null, near: null, keys: new Set(), dist: 8, camPos: new THREE.Vector3(), init: false,
  landed: null, walker: null, shipScale: 0.9, touchRot: { x: 0, y: 0 },
  // Gaz des moteurs (montée en régime progressive) : principal, latéral, vertical, post-combustion
  thr: new THREE.Vector3(), boostLvl: 0, retro: 0, reverseHold: 0,
};
// Commandes : ZQSD (ou WASD, mêmes touches physiques) pour se déplacer, Espace / C pour monter / descendre,
// flèches pour le tangage et le lacet, Ctrl + flèches gauche/droite pour le roulis, Maj pour accélérer, E pour sortir à pied
const KEYMAP = {
  KeyW: 'fwd', KeyS: 'back', KeyA: 'left', KeyD: 'right', Space: 'up', KeyC: 'down', ShiftLeft: 'boost', ShiftRight: 'boost',
  ArrowUp: 'pu', ArrowDown: 'pd', ArrowLeft: 'yl', ArrowRight: 'yr', ControlLeft: 'ctrl', ControlRight: 'ctrl',
};
let shipLen1 = 0;
function shipLength() {
  if (!shipLen1) {
    const s = ship.scale.x, p = ship.position.clone(), qq = ship.quaternion.clone();
    ship.scale.setScalar(1); ship.position.set(0, 0, 0); ship.quaternion.identity();
    ship.userData.setThrust(0, 0);
    ship.updateMatrixWorld(true);
    const bx = new THREE.Box3().setFromObject(ship);
    shipLen1 = Math.max(bx.max.x - bx.min.x, bx.max.y - bx.min.y, bx.max.z - bx.min.z) || 2;
    ship.scale.setScalar(s); ship.position.copy(p); ship.quaternion.copy(qq);
  }
  return shipLen1;
}
function bodyRadius(b) { return b.atmosphere?.radius || b.radius || b.viewRadius || 2; }
// Pesanteur à la surface (unités / s²) : de quoi sentir l'attraction sans rendre le pilotage pénible
function surfaceGravity(b) { return b.gas ? 9 : b.kind === 'planet' ? (b.dwarf ? 1.2 : 5) : 1.6; }
function isLandable(b) { return !!b && !b.gas && !b.sky && b.kind !== 'star' && (b.kind === 'planet' || b.isLandmark || b.landable); }
// Corps dont l'influence domine à cet endroit : le vaisseau « suit » alors son mouvement orbital
function findAnchor(p) {
  let best = null, bestK = Infinity;
  for (const b of BODIES) {
    if (!b.obj || b.sky || b.kind === 'star' || b.attached) continue;
    const R = bodyRadius(b);
    const infl = b.kind === 'planet' ? Math.max(R * 10, 40) : R * 6 + 8;
    const d = bodyCenter(b, tmpV).distanceTo(p);
    if (d < infl && d / infl < bestK) { best = b; bestK = d / infl; }
  }
  return best;
}
function findNear(p) {
  let best = null, bestD = Infinity;
  for (const b of BODIES) {
    if (!b.obj || b.sky || b.kind === 'star') continue;
    const R = b.attached ? 2 : bodyRadius(b);
    const range = b.kind === 'planet' ? R * 4 + 10 : R * 5 + 5;
    const d = bodyCenter(b, tmpV).distanceTo(p) - R;
    if (d < range && d < bestD) { best = b; bestD = d; }
  }
  return best;
}
// Base de lancement : à côté de la fusée de PROXION
function launchSite() {
  const b = byId.proxion;
  if (!b?.obj || !b.launchLocal) return null;
  const c = bodyCenter(b);
  const rocketW = b.obj.localToWorld(b.launchLocal.clone());
  const n = rocketW.clone().sub(c).normalize();
  // Un peu à l'écart de la tour de lancement
  const side = new THREE.Vector3(0, 1, 0).cross(n);
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  side.normalize();
  const dir = n.clone().addScaledVector(side, 0.32).normalize();
  const probe = c.clone().addScaledVector(dir, bodyRadius(b) * 2);
  const hit = groundHit(b, probe, true);
  const up = hit ? hit.radial.clone() : dir;
  return { body: b, point: hit ? hit.point : c.clone().addScaledVector(dir, bodyRadius(b)), up, toRocket: rocketW.clone().sub(hit ? hit.point : c).normalize() };
}
// Pose le vaisseau sur la base (vol libre) et place la caméra derrière
function placeShipAtBase() {
  const L = launchSite();
  if (!L) return false;
  enterFree();
  const foot = 0.9 * free.shipScale;
  const pos = L.point.clone().addScaledVector(L.up, foot);
  const f = L.toRocket.clone().addScaledVector(L.up, -L.toRocket.dot(L.up)).normalize();
  mTmp.makeBasis(L.up.clone().cross(f).normalize(), L.up, f);
  ship.quaternion.setFromRotationMatrix(mTmp);
  const inv = L.body.obj.matrixWorld.clone().invert();
  free.landed = { body: L.body, ground: L.body.obj.worldToLocal(L.point.clone()), localUp: L.up.clone().transformDirection(inv) };
  free.anchor = L.body;
  free.pos.copy(pos);
  free.offset.copy(pos).sub(bodyCenter(L.body));
  ship.position.copy(pos);
  free.camPos.copy(pos).addScaledVector(f, -6).addScaledVector(L.up, 3);
  hint('Base de lancement de PROXION · Espace pour décoller', 7);
  return true;
}

// Sol sous un point : rayon lancé vers le centre de l'astre, contre ses vrais maillages (relief, bâtiments)
const groundRay = new THREE.Raycaster();
function groundMeshes(b) {
  if (!b.groundMeshes) b.groundMeshes = pickables.filter((o) => o.userData.bodyId === b.id || (byId[o.userData.bodyId]?.attached && byId[o.userData.bodyId].parent === b));
  return b.groundMeshes;
}
function terrainMeshes(b) {
  if (!b.terrainMeshes) {
    const t = groundMeshes(b).filter((o) => o.userData.terrain);
    b.terrainMeshes = t.length ? t : groundMeshes(b);
    b.obstacleMeshes = t.length ? groundMeshes(b).filter((o) => !o.userData.terrain) : [];
  }
  return b.terrainMeshes;
}
function groundHit(b, p, terrainOnly = false) {
  const c = bodyCenter(b);
  const n = p.clone().sub(c).normalize();
  groundRay.set(p.clone().addScaledVector(n, bodyRadius(b) * 0.4), n.clone().negate());
  groundRay.far = bodyRadius(b) * 3;
  const hit = groundRay.intersectObjects(terrainOnly ? terrainMeshes(b) : groundMeshes(b), false)[0];
  if (!hit) return null;
  const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : n.clone();
  if (normal.dot(n) < 0) normal.negate();
  return { point: hit.point, normal, radial: n, water: !!hit.object.userData.water, object: hit.object };
}
let hintTimer = 0;
function hint(text, hold = 0) {
  const el = document.getElementById('free-hint');
  el.textContent = text;
  el.classList.toggle('on', !!text);
  hintTimer = hold;
}
function enterFree() {
  const fwd = camera.getWorldDirection(new THREE.Vector3());
  free.pos.copy(camera.position).addScaledVector(fwd, 8);
  free.vel.set(0, 0, 0);
  free.ang.set(0, 0, 0);
  free.anchor = findAnchor(free.pos);
  if (free.anchor) free.offset.copy(free.pos).sub(bodyCenter(free.anchor));
  user.yaw = user.tYaw = user.pitch = user.tPitch = 0;
  free.camPos.copy(camera.position);
  ship.position.copy(free.pos);
  // Le vaisseau (avant +Z) prend l'orientation de la caméra (qui regarde vers −Z)
  ship.quaternion.copy(camera.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.PI));
  free.landed = null;
  leaveWalker();
  trans = null;
  trail.userData.n = 0;
  free.init = true;
  hint('Vol libre : ZQSD pour se déplacer, flèches pour orienter le vaisseau · I : informations', 6);
  // L'aide des commandes se replie d'elle-même après quelques secondes
  const help = document.getElementById('free-help');
  help.classList.remove('mini');
  clearTimeout(help._t);
  help._t = setTimeout(() => help.classList.add('mini'), 14000);
}
function setMode(m, silent = false) {
  if (m === mode && !silent) return;
  mode = m;
  try { localStorage.setItem(MODE_KEY, m); } catch (e) { /* ignore */ }
  document.body.classList.toggle('free', m === 'free');
  document.querySelectorAll('#mode-switch button[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
  syncLayout();
  if (silent || !ready) return;
  if (m === 'free') {
    enterFree();
  } else {
    // Retour au pilote automatique : on rejoint l'astre le plus proche
    const here = ship.position;
    const n = findNear(here) || findAnchor(here) || byId.lexa;
    free.keys.clear();
    leaveWalker();
    free.landed = null;
    camera.up.set(0, 1, 0);
    goTo(n.id, true);
  }
}
document.getElementById('free-help').addEventListener('click', (e) => e.currentTarget.classList.toggle('mini'));
document.getElementById('mode-switch').addEventListener('click', (e) => {
  const m = e.target.closest('button')?.dataset.mode;
  if (m) setMode(m);
});
// Commandes tactiles
document.querySelectorAll('#flight-pad button').forEach((btn) => {
  const k = btn.dataset.key;
  if (k === 'action') { btn.addEventListener('click', () => freeAction()); return; }
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); free.keys.add(k); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, () => free.keys.delete(k)));
});

// Touche E : sortir du vaisseau une fois posé, remonter à bord, ou regarder dans la lunette
function freeAction() {
  if (mode !== 'free') return;
  const w = free.walker;
  if (w) {
    const W = w.body.walk;
    if (w.scope) { w.scope = false; hint('', 0); return; }
    if (nearScope(w)) { w.scope = true; hint('Grande lunette de Meudon : ω Centauri · E pour se relever', 6); return; }
    const shipLocal = w.body.obj.worldToLocal(ship.position.clone());
    if (shipLocal.distanceTo(w.p) < 12 * W.m2u) {
      leaveWalker();
      syncLayout();
      hint('De retour à bord · Espace ou Z pour décoller', 5);
    } else hint('Rapprochez-vous du vaisseau pour remonter à bord', 3);
    return;
  }
  if (!free.landed) { hint('Posez-vous d’abord sur une surface solide', 3); return; }
  const b = free.landed.body;
  if (!b.walk) { hint(`On ne peut pas marcher sur ${b.name}`, 3); return; }
  const W = b.walk, obj = b.obj;
  // Le personnage descend à côté du vaisseau
  const shipLocal = obj.worldToLocal(ship.position.clone());
  const upL = shipLocal.clone().sub(W.center).normalize();
  const fwdW = new THREE.Vector3(0, 0, 1).applyQuaternion(ship.quaternion);
  const fwdL = fwdW.transformDirection(new THREE.Matrix4().copy(obj.matrixWorld).invert());
  const side = new THREE.Vector3().crossVectors(upL, fwdL).normalize();
  const p = shipLocal.clone().addScaledVector(side, 7 * W.m2u);
  const dir = p.clone().sub(W.center).normalize();
  const q = {}; W.sampler.query(dir, q);
  p.copy(W.center).addScaledVector(dir, (q.r > 0 ? q.r : p.distanceTo(W.center)) + 0.3 * W.m2u);
  free.walker = { body: b, p, v: new THREE.Vector3(), heading: fwdL.clone().addScaledVector(dir, -fwdL.dot(dir)).normalize(), pitch: -0.05, onGround: false, swim: false, scope: false };
  user.yaw = user.tYaw = user.pitch = user.tPitch = 0;
  syncLayout();
  hint('À pied : ZQSD pour marcher, souris ou flèches pour regarder, Espace pour sauter, Maj pour courir · E près du vaisseau pour remonter', 9);
}
function leaveWalker() {
  if (!free.walker) return;
  free.walker = null;
  camera.near = 0.05; camera.updateProjectionMatrix();
  if (document.pointerLockElement === canvas) document.exitPointerLock?.();
  document.getElementById('eyepiece').classList.remove('on');
  document.body.classList.remove('in-scope');
}
function nearScope(w) {
  const S = w.body.walk.scope;
  if (!S) return false;
  const l = w.p.clone().applyMatrix4(S.inv);
  return Math.hypot(l.x - S.x, l.z - S.z) < S.r && Math.abs(l.y - S.y) < 0.06;
}
function insideDome() {
  const w = free.walker;
  if (mode !== 'free' || !w || w.body.id !== 'meudon' || !w.body.walk.scope) return false;
  const l = w.p.clone().applyMatrix4(w.body.walk.scope.inv);
  return Math.hypot(l.x, l.z) < 0.62 && l.y > 0.78;
}

const qStep = new THREE.Quaternion();
const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
function updateFree(dt) {
  const k = free.keys;
  // Le regard autour du vaisseau (glisser) revient doucement dans l'axe quand on relâche
  if (!pointer.down) { user.tYaw *= Math.exp(-dt * 1.2); user.tPitch *= Math.exp(-dt * 1.2); }
  user.yaw += (user.tYaw - user.yaw) * Math.min(1, dt * 8);
  user.pitch += (user.tPitch - user.pitch) * Math.min(1, dt * 8);
  hintTimer -= dt;
  if (hintTimer <= 0 && hintTimer > -dt * 2) hint('');
  // Référentiel : on suit l'astre dominant (alignement de vitesse automatique)
  if (free.anchor && !free.landed) free.pos.copy(bodyCenter(free.anchor)).add(free.offset);
  if (!free.landed) free.anchor = findAnchor(free.pos);
  let scaleTarget = free.anchor ? THREE.MathUtils.clamp(bodyRadius(free.anchor) * 0.12, 0.12, 0.9) : 0.9;
  // Près d'un astre praticable, le vaisseau prend sa taille réelle (≈ 14 m) à l'échelle du personnage
  const ref = free.landed?.body || free.anchor;
  if (ref?.walk && free.pos.distanceTo(bodyCenter(ref)) < bodyRadius(ref) * 4) {
    scaleTarget = Math.min(scaleTarget, (14 * ref.walk.m2u * ref.obj.getWorldScale(tmpV).x) / shipLength());
  }
  free.shipScale += (scaleTarget - free.shipScale) * Math.min(1, dt * 2);
  ship.scale.setScalar(free.shipScale);
  ship.visible = true;
  let thrust = 0.08, boost = false;
  let camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(ship.quaternion);

  if (free.walker) {
    updateWalker(dt);
    return;
  }
  if (free.landed) {
    // Posé : le vaisseau reste solidaire du sol (et tourne avec l'astre)
    const L = free.landed, obj = L.body.obj;
    const up = L.localUp.clone().transformDirection(obj.matrixWorld);
    free.pos.copy(obj.localToWorld(L.ground.clone())).addScaledVector(up, 0.9 * free.shipScale);
    const f = new THREE.Vector3(0, 0, 1).applyQuaternion(ship.quaternion);
    f.addScaledVector(up, -f.dot(up));
    if (f.lengthSq() < 1e-6) f.copy(up).cross(AX.x);
    f.normalize();
    mTmp.makeBasis(up.clone().cross(f).normalize(), up, f);
    ship.quaternion.slerp(qTmp.setFromRotationMatrix(mTmp), Math.min(1, dt * 6));
    free.vel.set(0, 0, 0);
    if (k.has('up') || k.has('fwd') || (k.has('ctrl') && k.has('pu'))) {
      free.landed = null;
      free.vel.copy(up).multiplyScalar(4 * free.shipScale + 2);
      free.offset.copy(free.pos).sub(bodyCenter(free.anchor));
      hint('Décollage', 2);
    }
    camUp = up;
  } else {
    // Orientation : flèches = tangage et lacet, Ctrl + flèches = roulis (vitesses angulaires amorties)
    const ctrl = k.has('ctrl');
    // Ctrl + flèches haut / bas : monter / descendre (le tangage est alors suspendu)
    const pitchIn = (ctrl ? 0 : (k.has('pu') ? 1 : 0) - (k.has('pd') ? 1 : 0)) + free.touchRot.y;
    const yawIn = ctrl ? 0 : (k.has('yl') ? 1 : 0) - (k.has('yr') ? 1 : 0) + free.touchRot.x;
    const rollIn = ctrl ? (k.has('yr') ? 1 : 0) - (k.has('yl') ? 1 : 0) : 0;
    free.touchRot.x = free.touchRot.y = 0;
    // Vitesses angulaires : accélération angulaire limitée, amortissement actif quand on relâche
    const spd = free.vel.length();
    const agility = 1 / (1 + spd / 120);
    const tgt = new THREE.Vector3(-pitchIn * 1.3 * (0.6 + 0.4 * agility), yawIn * 1.2 * (0.6 + 0.4 * agility), rollIn * 1.9);
    const angRate = tgt.lengthSq() > 0 ? 3.2 : 4.5;
    free.ang.x += THREE.MathUtils.clamp(tgt.x - free.ang.x, -angRate * dt, angRate * dt);
    free.ang.y += THREE.MathUtils.clamp(tgt.y - free.ang.y, -angRate * dt, angRate * dt);
    free.ang.z += THREE.MathUtils.clamp(tgt.z - free.ang.z, -angRate * dt * 1.3, angRate * dt * 1.3);
    ship.quaternion.multiply(qStep.setFromAxisAngle(AX.x, free.ang.x * dt))
      .multiply(qStep.setFromAxisAngle(AX.y, free.ang.y * dt))
      .multiply(qStep.setFromAxisAngle(AX.z, free.ang.z * dt)).normalize();
    // Translation dans le repère du vaisseau (avant +Z, gauche +X, haut +Y)
    const F = AX.z.clone().applyQuaternion(ship.quaternion);
    const Lf = AX.x.clone().applyQuaternion(ship.quaternion);
    const U = AX.y.clone().applyQuaternion(ship.quaternion);
    const fwdIn = (k.has('fwd') ? 1 : 0) - (k.has('back') ? 1 : 0);
    const sideIn = (k.has('left') ? 1 : 0) - (k.has('right') ? 1 : 0);
    const upIn = (k.has('up') || (ctrl && k.has('pu')) ? 1 : 0) - (k.has('down') || (ctrl && k.has('pd')) ? 1 : 0);
    const vF = free.vel.dot(F);
    // Reculer : on freine d'abord (rétrofusées), la marche arrière ne s'engage qu'une fois arrêté
    let mainCmd = fwdIn;
    free.retro = 0;
    if (fwdIn < 0) {
      if (vF > 0.4) { mainCmd = -1; free.retro = 1; free.reverseHold = 0; }
      else { free.reverseHold += dt; mainCmd = free.reverseHold > 0.5 ? -0.35 : 0; }
    } else free.reverseHold = 0;
    // Montée et descente en régime des moteurs (inertie des turbines)
    const spool = (cur, cmd, up, down) => cur + THREE.MathUtils.clamp(cmd - cur, -down * dt, up * dt);
    free.thr.x = spool(free.thr.x, mainCmd, 0.9, 1.6);
    free.thr.y = spool(free.thr.y, sideIn, 2.2, 3);
    free.thr.z = spool(free.thr.z, upIn, 2.2, 3);
    boost = k.has('boost') && fwdIn > 0;
    free.boostLvl = spool(free.boostLvl, boost ? 1 : 0, 0.55, 1.2);
    const thrusting = Math.abs(free.thr.x) + Math.abs(free.thr.y) + Math.abs(free.thr.z) > 0.03;
    // Accélérations : moteur principal, rétrofusées plus faibles, propulseurs d'attitude encore plus faibles
    const aMain = free.thr.x >= 0 ? 24 + free.boostLvl * 190 : (free.retro ? 18 : 9);
    free.vel.addScaledVector(F, free.thr.x * aMain * dt)
      .addScaledVector(Lf, free.thr.y * 9 * dt)
      .addScaledVector(U, free.thr.z * 11 * dt);
    // Gravité de l'astre dominant : g = g0 (R / r)²
    if (free.anchor) {
      const c = bodyCenter(free.anchor);
      const n = free.pos.clone().sub(c);
      const r = n.length();
      const R = bodyRadius(free.anchor);
      free.vel.addScaledVector(n.normalize(), -surfaceGravity(free.anchor) * (R / r) * (R / r) * dt);
    } else {
      const r = free.pos.length();
      free.vel.addScaledVector(free.pos.clone().normalize(), -(GM_SUN / (r * r)) * dt);
    }
    // Assistance de vol : les dérives latérales s'amortissent doucement (on « tient » le cap),
    // et sans commande le vaisseau ralentit lentement par rapport à l'astre de référence
    const vAlong = free.vel.dot(F);
    const lateral = free.vel.clone().addScaledVector(F, -vAlong);
    lateral.multiplyScalar(Math.exp(-dt * (Math.abs(free.thr.y) + Math.abs(free.thr.z) > 0.05 ? 0.15 : 0.7)));
    free.vel.copy(lateral).addScaledVector(F, vAlong * Math.exp(-dt * (thrusting ? 0.04 : 0.12)));
    // Vitesse limite qui se relâche progressivement (pas de coupure brutale)
    const vmax = 40 + free.boostLvl * 380;
    const v = free.vel.length();
    if (v > vmax) free.vel.setLength(v + (vmax - v) * Math.min(1, dt * 1.5));
    free.pos.addScaledVector(free.vel, dt);
    // Le soleil, les géantes gazeuses et les engins spatiaux restent infranchissables
    if (free.pos.length() < SUN_RADIUS * 1.35) free.pos.setLength(SUN_RADIUS * 1.35);
    for (const b of BODIES) {
      if (!b.obj || b.sky || b.kind === 'star' || b.attached || isLandable(b)) continue;
      const c = bodyCenter(b, tmpV);
      const minD = bodyRadius(b) * (b.gas ? 1.02 : 1.15) + 0.6 * free.shipScale;
      const d = free.pos.distanceTo(c);
      if (d < minD) {
        const n = free.pos.clone().sub(c).normalize();
        free.pos.copy(c).addScaledVector(n, minD);
        const vn = free.vel.dot(n);
        if (vn < 0) free.vel.addScaledVector(n, -vn);
        if (b.gas && hintTimer <= 0) hint(`${b.name} est une géante gazeuse : pas de surface où se poser`, 3);
      }
    }
    // Sol des astres solides : atterrissage en douceur, rebond si l'approche est trop rapide
    const a = free.anchor;
    if (isLandable(a) && free.pos.distanceTo(bodyCenter(a)) < bodyRadius(a) * 2.2) {
      const hit = groundHit(a, free.pos);
      if (hit) {
        const foot = 0.9 * free.shipScale;
        const alt = free.pos.distanceTo(hit.point);
        const below = free.pos.clone().sub(hit.point).dot(hit.radial) < 0;
        if (alt < foot * 4 && !below && hintTimer <= 0) hint(`Approche de ${a.name} : réduisez la vitesse pour vous poser`, 0.5);
        if (alt < foot || below) {
          const vr = free.vel.dot(hit.radial);
          const up = hit.radial.clone().lerp(hit.normal, 0.5).normalize();
          const land = hit.point.clone().addScaledVector(up, foot);
          if (vr > -7) {
            const inv = a.obj.matrixWorld.clone().invert();
            free.landed = { body: a, ground: a.obj.worldToLocal(hit.point.clone()), localUp: up.clone().transformDirection(inv) };
            free.vel.set(0, 0, 0);
            free.pos.copy(land);
            hint(`Posé sur ${a.name}${hit.water ? ' (en mer)' : ''} · E : sortir à pied · Espace : décoller`, 8);
          } else {
            free.pos.copy(land);
            free.vel.addScaledVector(hit.radial, -1.6 * vr).multiplyScalar(0.5);
            hint('Contact trop brutal ! Ralentissez avant de vous poser', 3);
          }
        }
      }
    }
    if (free.anchor) free.offset.copy(free.pos).sub(bodyCenter(free.anchor));
    thrust = 0.06 + Math.max(0, free.thr.x) * (0.55 + 0.4 * free.boostLvl) + (Math.abs(free.thr.y) + Math.abs(free.thr.z)) * 0.12;
  }
  ship.position.copy(free.pos);
  ship.userData.setThrust(free.landed ? 0 : thrust, simTime);
  autoThrust = thrust;
  pushTrail(ship.localToWorld(new THREE.Vector3(0, 0, -1.1)), free.landed ? 0 : thrust);
  // Caméra derrière le vaisseau, dans son repère (le regard peut tourner autour en glissant)
  const qLook = ship.quaternion.clone()
    .multiply(qStep.setFromAxisAngle(AX.y, user.yaw))
    .multiply(new THREE.Quaternion().setFromAxisAngle(AX.x, -user.pitch));
  const dist = free.dist * free.shipScale / 0.9;
  if (views.free === 'fpv') {
    // À bord : la caméra est au poste de pilotage et regarde vers l'avant du vaisseau
    ship.visible = false;
    camera.position.copy(free.pos).add(new THREE.Vector3(0, 0.3, 0.25).multiplyScalar(free.shipScale).applyQuaternion(ship.quaternion));
    camera.quaternion.copy(ship.quaternion)
      .multiply(qStep.setFromAxisAngle(AX.y, user.yaw))
      .multiply(new THREE.Quaternion().setFromAxisAngle(AX.x, -user.pitch))
      .multiply(qFlip);
    camera.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    free.camPos.copy(camera.position);
    free.lastRef = null;
    sky.visible = true;
    document.getElementById('eyepiece').classList.remove('on');
    document.body.classList.remove('in-scope');
  } else {
    const camWant = free.pos.clone().add(new THREE.Vector3(0, dist * 0.62, -dist * 0.82).applyQuaternion(qLook));
    followCamera(dt, camWant, free.pos.clone().add(new THREE.Vector3(0, dist * 0.05, dist * 0.45).applyQuaternion(qLook)), camUp);
  }
  freeHud(dt, boost);
}

// Caméra de poursuite, compensée du mouvement de l'astre de référence pour éviter les tremblements
function followCamera(dt, want, target, up) {
  const ref = free.landed ? free.landed.body : free.anchor;
  if (ref && free.lastRef === ref) free.camPos.add(bodyCenter(ref).sub(free.lastRefPos));
  free.lastRef = ref;
  free.lastRefPos = ref ? bodyCenter(ref) : null;
  free.camPos.lerp(want, 1 - Math.exp(-dt * 8));
  camera.position.copy(free.camPos);
  camera.up.lerp(up, Math.min(1, dt * 4)).normalize();
  camera.lookAt(target);
  sky.visible = true;
  document.getElementById('eyepiece').classList.remove('on');
  document.body.classList.remove('in-scope');
}

// Exploration à pied (vue subjective)
const wEye = new THREE.Vector3(), wLook = new THREE.Vector3(), wUp = new THREE.Vector3();
const lookIn = { yaw: 0, pitch: 0 };
function updateWalker(dt) {
  const w = free.walker, b = w.body, W = b.walk, obj = b.obj, k = free.keys;
  // Le vaisseau reste posé (moteurs éteints)
  if (free.landed) {
    const L = free.landed;
    const up = L.localUp.clone().transformDirection(obj.matrixWorld);
    free.pos.copy(obj.localToWorld(L.ground.clone())).addScaledVector(up, 0.9 * free.shipScale);
    ship.position.copy(free.pos);
  }
  ship.visible = true;
  ship.userData.setThrust(0, simTime);
  autoThrust = 0;
  pushTrail(ship.position, 0);
  if (w.scope && tele) {
    // Dans la grande lunette : la caméra est à l'objectif et vise l'amas
    const pos = tele.eye.getWorldPosition(new THREE.Vector3());
    camera.position.copy(pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(pos.clone().addScaledVector(OMEGA_DIR, 100));
    camera.near = 0.05; camera.updateProjectionMatrix();
    sky.visible = false;
    const ep = document.getElementById('eyepiece');
    ep.classList.add('on');
    document.body.classList.add('in-scope');
    const Wd = window.innerWidth, H = window.innerHeight, d = Math.min(H * 0.78, Wd * 0.7);
    ep.style.setProperty('--ex', `${Wd / 2}px`); ep.style.setProperty('--ey', `${H / 2}px`);
    ep.style.setProperty('--ed', `${d}px`); ep.style.setProperty('--ei', `${H / 2 + d / 2 + 6}px`);
    viewOffset.tx = viewOffset.ty = 0;
    applyProjection(dt, 3.2);
    if (k.has('fwd') || k.has('back') || k.has('left') || k.has('right')) { w.scope = false; hint('', 0); }
    return;
  }
  const input = {
    fwd: (k.has('fwd') ? 1 : 0) - (k.has('back') ? 1 : 0),
    strafe: (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0),
    run: k.has('boost'), jump: k.has('up'),
    yaw: ((k.has('yl') ? 1 : 0) - (k.has('yr') ? 1 : 0)) * 2.0 * dt + lookIn.yaw,
    pitch: ((k.has('pu') ? 1 : 0) - (k.has('pd') ? 1 : 0)) * 1.4 * dt + lookIn.pitch,
  };
  lookIn.yaw = lookIn.pitch = 0;
  stepWalker(w, W, input, Math.min(dt, 0.05));
  walkerView(w, W, wEye, wLook, wUp);
  obj.localToWorld(wEye); obj.localToWorld(wLook);
  wUp.transformDirection(obj.matrixWorld);
  camera.position.copy(wEye);
  camera.up.copy(wUp);
  camera.lookAt(wLook);
  // Plan de coupe proche à l'échelle du personnage, pour voir les intérieurs
  const wpm = W.m2u * obj.getWorldScale(tmpV).x;
  camera.near = Math.max(1e-4, 0.08 * wpm);
  camera.updateProjectionMatrix();
  free.camPos.copy(camera.position);
  free.lastRef = null;
  sky.visible = true;
  document.getElementById('eyepiece').classList.remove('on');
  document.body.classList.remove('in-scope');
  viewOffset.tx = viewOffset.ty = 0;
  // Indications
  if (hintTimer <= 0) {
    const shipLocal = obj.worldToLocal(ship.position.clone());
    if (nearScope(w)) hint('E : regarder dans la grande lunette', 0.3);
    else if (shipLocal.distanceTo(w.p) < 12 * W.m2u) hint('E : remonter à bord du vaisseau', 0.3);
    else if (w.swim) hint('À la nage', 0.3);
  }
  const sp = w.v.length() / W.m2u;
  document.getElementById('free-speed').textContent = `${sp.toFixed(1)} m/s · à pied sur ${b.name}`;
  if (free.near !== b) { free.near = b; showBody(b); }
  updateTargetMarker();
  applyProjection(dt, 70);
}

function freeHud(dt, boost) {
  const near = findNear(free.pos);
  if (near !== free.near) {
    free.near = near;
    const nl = document.getElementById('near-label');
    nl.classList.toggle('on', !!near);
    if (near) {
      nl.textContent = `À proximité : ${near.name} · ${near.section}`;
      showBody(near);
      if (free.target === near) free.target = null;
    }
  }
  const status = free.landed ? `posé sur ${free.landed.body.name}` : free.anchor ? `référentiel ${free.anchor.name}` : 'héliocentrique';
  document.getElementById('free-speed').textContent = `${fmt(free.vel.length() / UA, 2)} UA/s${free.boostLvl > 0.05 ? ` · post-combustion ${Math.round(free.boostLvl * 100)} %` : ''}${free.retro ? ' · freinage' : free.reverseHold > 0.5 ? ' · marche arrière' : ''} · ${status}`;
  updateTargetMarker();
  applyProjection(dt, 55);
}

// Repère de la cible (désignée en cliquant un astre ou une entrée du journal)
function updateTargetMarker() {
  const el = document.getElementById('target-marker');
  const t = free.target;
  if (!t || mode !== 'free') { el.classList.remove('on'); return; }
  const c = bodyCenter(t);
  const d = c.distanceTo(free.pos);
  const p = c.clone().project(camera);
  const w = window.innerWidth, h = window.innerHeight;
  let x = (p.x * 0.5 + 0.5) * w, y = (-p.y * 0.5 + 0.5) * h;
  const behind = p.z > 1;
  const m = 40;
  const inside = !behind && x > m && x < w - m && y > m && y < h - m;
  if (!inside) {
    // Cible hors champ : flèche sur le bord de l'écran
    let dx = x - w / 2, dy = y - h / 2;
    if (behind) { dx = -dx; dy = -dy; }
    const k = Math.min((w / 2 - m) / Math.abs(dx || 1e-3), (h / 2 - m) / Math.abs(dy || 1e-3));
    x = w / 2 + dx * k; y = h / 2 + dy * k;
    el.style.setProperty('--rot', `${Math.atan2(dy, dx) * 180 / Math.PI + 45}deg`);
  }
  el.classList.add('on');
  el.classList.toggle('edge', !inside);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.getElementById('tm-label').textContent = `${t.name} · ${fmt(d / UA, 3)} UA`;
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
// Affiche la fiche d'un astre sans déplacer la caméra (vol libre)
function showBody(b) {
  current = b;
  explored.add(b.id);
  saveExplored();
  updateTree();
  updateHud();
  updatePanel();
}
function goTo(id, force = false) {
  const b = byId[id];
  if (!b || !ready || overlayOpen) return;
  if (mode === 'free' && !force) {
    // En vol libre, on désigne une cible au lieu de s'y rendre automatiquement
    free.target = b.sky ? byId.meudon : b;
    current = b;
    updateTree();
    updateHud();
    updatePanel();
    return;
  }
  if (b === current && !force) return;
  const prev = current;
  const first = !current;
  current = b;
  user.tYaw = user.tPitch = 0;
  user.tZoom = 1;
  let from = first ? null : prev;
  if (first) {
    // Premier trajet : on décolle de la base de lancement de PROXION
    const L = launchSite();
    if (L && b !== byId.proxion) {
      camera.position.copy(L.point).addScaledVector(L.up, 0.5);
      const f = L.toRocket.clone().addScaledVector(L.up, -L.toRocket.dot(L.up)).normalize();
      camera.up.copy(L.up);
      camera.lookAt(camera.position.clone().add(f).addScaledVector(L.up, 0.6));
      camera.up.set(0, 1, 0);
      from = byId.proxion;
    } else {
      camera.position.copy(frameFor(b).pos).add(new THREE.Vector3(0, 900, 1400));
      look.set(0, 0, 0);
      camera.lookAt(look);
    }
  }
  startTransition(b, from);
  explored.add(b.id);
  saveExplored();
  updateTree();
  updateHud();
  updatePanel();
  try { history.replaceState(null, '', `#${b.id}`); } catch (e) { /* ignore */ }
}

function groupOf(b) { return b.parent || b; }
function stepPlanet(d) {
  const i = SYSTEM.indexOf(groupOf(current));
  goTo(SYSTEM[(i + d + SYSTEM.length) % SYSTEM.length].id);
}
function stepMoon(d) {
  const g = groupOf(current);
  const list = [g, ...g.children];
  const i = list.indexOf(current);
  goTo(list[(i + d + list.length) % list.length].id);
}

function updateHud() {
  const g = groupOf(current);
  ui.path.textContent = current === g ? g.name : `${g.name} › ${current.name}`;
  ui.section.textContent = current.section;
  ui.nav.style.setProperty('--c', current.color);
  ui.title.classList.toggle('visible', current.kind === 'star');
}

// --- Panneau de texte : apparition douce, paragraphe après paragraphe ---
function reveal(html, el) {
  el.innerHTML = html;
  [...el.children].forEach((c, i) => c.style.setProperty('--i', i));
  el.classList.remove('reveal');
  void el.offsetWidth;
  el.classList.add('reveal');
}

let panelTimer = null;
function updatePanel() {
  const html = TEXTS[current.id];
  ui.panel.classList.remove('visible');
  ui.panel.style.setProperty('--c', current.color);
  clearTimeout(panelTimer);
  panelTimer = setTimeout(() => {
    if (!html) return;
    ui.panel.scrollTop = 0;
    reveal(html, ui.panelBody);
    if (cockpitLayout() || tpvScreens()) glitchify(ui.panelBody);
    ui.panel.classList.add('visible');
    computeViewOffset();
  }, 260);
  computeViewOffset();
}

// --- Étiquettes ---
function updateLabels() {
  const g = current ? groupOf(current) : null;
  const w = window.innerWidth, h = window.innerHeight;
  for (const b of BODIES) {
    const el = b.label;
    let show = false;
    if (ready && current && !overlayOpen && b.obj && !current.telescope && !(mode === 'free' && free.walker)) {
      if (current.kind === 'star') show = b.kind !== 'moon';
      else show = b === g || b.parent === g || (b.kind !== 'moon' && b !== g);
    }
    if (show) {
      const c = bodyCenter(b, tmpV);
      c.y += (b.viewRadius || 3) * (b.kind === 'star' ? 1.05 : 1.2);
      c.project(camera);
      const sy = (-c.y * 0.5 + 0.5) * h;
      if (c.z > 1 || c.z < -1 || (cockpitLayout() && sy > glassPx - 10)) show = false;
      else {
        el.style.left = `${(c.x * 0.5 + 0.5) * w}px`;
        el.style.top = `${(-c.y * 0.5 + 0.5) * h}px`;
      }
    }
    el.classList.toggle('visible', show);
    el.classList.toggle('current', b === current);
    el.classList.toggle('far', show && b.kind !== 'moon' && g !== b && current.kind !== 'star');
    el.tabIndex = show ? 0 : -1;
  }
}

// --- Lignes d'orbite : on ne montre que celles du groupe visité ---
function updateOrbits() {
  const g = current ? groupOf(current) : null;
  for (const p of SYSTEM) {
    if (p.mapDot) p.mapDot.visible = !current || current.kind === 'star' || g !== p;
    if (p.orbitLine) { p.orbitLine.material.opacity = current?.kind === 'star' ? 0.28 : 0.12; p.orbitLine.visible = showOrbits; }
    for (const c of p.children) {
      if (!c.orbitLine) continue;
      const target = g === p && showOrbits ? 0.3 : 0;
      c.orbitLine.material.opacity += (target - c.orbitLine.material.opacity) * 0.08;
      c.orbitLine.visible = c.orbitLine.material.opacity > 0.01;
    }
  }
}

// ---------------------------------------------------------------------------
// Galeries de projets
// ---------------------------------------------------------------------------
let overlayOpen = false;
function openGallery(key) {
  const gal = GALLERIES[key];
  if (!gal) return;
  ui.overlay.innerHTML = `
    <div class="project-card">
      <p class="log-kicker">${gal.kicker}</p>
      <h2>${gal.title}</h2>
      <div class="project-photos">${gal.images.map((i) => `<img src="${i.src}" alt="${i.alt}" loading="lazy">`).join('')}</div>
      <button class="log-button" type="button" data-close>Retour</button>
    </div>`;
  ui.overlay.style.display = 'flex';
  requestAnimationFrame(() => ui.overlay.classList.add('open'));
  overlayOpen = true;
  ui.overlay.querySelector('[data-close]').focus();
}
function closeGallery() {
  ui.overlay.classList.remove('open');
  setTimeout(() => { ui.overlay.style.display = 'none'; ui.overlay.innerHTML = ''; }, 400);
  overlayOpen = false;
}
document.addEventListener('click', (e) => {
  const g = e.target.closest?.('[data-gallery]');
  if (g) openGallery(g.dataset.gallery);
  if (e.target.closest?.('[data-close]') || e.target === ui.overlay) closeGallery();
});

// ---------------------------------------------------------------------------
// Entrées : clavier, boutons, souris / tactile
// ---------------------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  if (overlayOpen) { if (e.key === 'Escape') closeGallery(); return; }
  if (!current || e.target.closest?.('input, textarea')) return;
  if (cockpitLayout()) cockpit.press(cockpit.keyFor(e.code));
  if (e.code === 'KeyM') { setMode(mode === 'auto' ? 'free' : 'auto'); return; }
  if (e.code === 'KeyV' && !e.ctrlKey) { toggleView(); return; }
  if (e.code === 'KeyI') { document.body.classList.toggle('show-info'); return; }
  if (mode === 'free') {
    if (e.code === 'KeyE') { freeAction(); return; }
    if (e.code === 'Escape' && free.walker?.scope) { free.walker.scope = false; return; }
    if (e.ctrlKey) free.keys.add('ctrl');
    const k = KEYMAP[e.code];
    if (k) { e.preventDefault(); free.keys.add(k); }
    return;
  }
  const k = { ArrowDown: () => stepPlanet(1), ArrowUp: () => stepPlanet(-1), ArrowRight: () => stepMoon(1), ArrowLeft: () => stepMoon(-1), Escape: () => goTo('lexa') }[e.key];
  if (k) { e.preventDefault(); k(); return; }
  const ck = cockpit.keyFor(e.code);
  if (ck?.action && !e.ctrlKey && !e.metaKey && !e.altKey) cockpitAction(ck.action);
});
window.addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
  if (k) free.keys.delete(k);
  if (!e.ctrlKey) free.keys.delete('ctrl');
});
window.addEventListener('blur', () => free.keys.clear());
ui.nav.addEventListener('click', (e) => {
  const d = e.target.closest('button')?.dataset.nav;
  if (!d || !current) return;
  ({ up: () => stepPlanet(-1), down: () => stepPlanet(1), left: () => stepMoon(-1), right: () => stepMoon(1) })[d]();
});

const raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = 0.6;
const pointer = { down: false, x: 0, y: 0, moved: 0, id: null };
canvas.addEventListener('pointerdown', (e) => {
  if (cockpitLayout()) {
    const k = cockpit.keyAt(e.clientX, e.clientY);
    if (k) { cockpit.press(k); if (k.action) cockpitAction(k.action); pointer.skip = true; return; }
  }
  // À pied, un clic capture la souris pour regarder librement (Échap pour la libérer)
  if (mode === 'free' && free.walker && e.pointerType === 'mouse' && document.pointerLockElement !== canvas) {
    canvas.requestPointerLock?.();
  }
  pointer.down = true; pointer.x = e.clientX; pointer.y = e.clientY; pointer.moved = 0; pointer.id = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointer.down) {
    // Survol : curseur main sur les astres
    if (ready) canvas.style.cursor = pick(e.clientX, e.clientY) || (cockpitLayout() && cockpit.keyAt(e.clientX, e.clientY)) ? 'pointer' : 'grab';
    return;
  }
  const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
  pointer.moved += Math.abs(dx) + Math.abs(dy);
  pointer.x = e.clientX; pointer.y = e.clientY;
  if (mode === 'free' && free.walker) {
    lookIn.yaw -= dx * 0.004; lookIn.pitch -= dy * 0.004;
    return;
  }
  if (mode === 'free' && e.pointerType === 'touch') {
    // Sur écran tactile, glisser oriente directement le vaisseau
    free.touchRot.x -= dx * 0.08;
    free.touchRot.y -= dy * 0.08;
    return;
  }
  user.tYaw -= dx * 0.005;
  if (mode === 'free') user.tPitch = THREE.MathUtils.clamp(user.tPitch - dy * 0.004, -1.2, 1.2);
  else user.tPitch = THREE.MathUtils.clamp(user.tPitch + dy * 0.004, -1.1, 1.0);
  canvas.style.cursor = 'grabbing';
});
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas || !free.walker) return;
  lookIn.yaw -= e.movementX * 0.0022;
  lookIn.pitch -= e.movementY * 0.0022;
});
canvas.addEventListener('pointerup', (e) => {
  if (pointer.skip) { pointer.skip = false; return; }
  pointer.down = false;
  canvas.releasePointerCapture?.(e.pointerId);
  canvas.style.cursor = 'grab';
  if (pointer.moved < 6) {
    const id = pick(e.clientX, e.clientY);
    if (id) goTo(id);
  }
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (mode === 'free') free.dist = THREE.MathUtils.clamp(free.dist * Math.exp(e.deltaY * 0.001), 3, 40);
  else user.tZoom = THREE.MathUtils.clamp(user.tZoom * Math.exp(e.deltaY * 0.001), 0.45, 2.6);
}, { passive: false });

function pick(x, y) {
  if (cockpitLayout() && y > glassPx) return null;
  raycaster.setFromCamera(new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1), camera);
  const hit = raycaster.intersectObjects(pickables, false)[0];
  return hit?.object.userData.bodyId || null;
}

// ---------------------------------------------------------------------------
// La boucle de 22 minutes (clin d'œil)
// ---------------------------------------------------------------------------
const LOOP = 22 * 60;
let loopLeft = LOOP;
let nova = null;
function updateLoop(dt) {
  if (nova) {
    nova.t += dt;
    const t = nova.t;
    const boost = t < 3 ? t / 3 : Math.max(0, 1 - (t - 3) / 0.4);
    sunMaterial.uniforms.uBoost.value = boost;
    corona.scale.setScalar(SUN_RADIUS * 5 * (1 + boost * 2.5));
    const flash = t < 2.6 ? 0 : t < 3.2 ? (t - 2.6) / 0.6 : Math.max(0, 1 - (t - 3.2) / 2.2);
    film.uniforms.uFlash.value = flash;
    ui.flash.style.opacity = flash * 0.6;
    if (t > 5.6) { nova = null; loopLeft = LOOP; film.uniforms.uFlash.value = 0; ui.flash.style.opacity = 0; }
    return;
  }
  loopLeft -= dt;
  if (loopLeft <= 0 && !reduceMotion) nova = { t: 0 };
  const s = Math.max(0, Math.ceil(loopLeft));
  ui.time.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Boucle de rendu
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  simTime += dt;
  sunMaterial.uniforms.uTime.value = simTime;
  stars.material.uniforms.uTime.value = simTime;
  prominences.userData.update(simTime);
  film.uniforms.uTime.value = simTime;
  corona.material.rotation = simTime * 0.01;
  if (!nova) corona.scale.setScalar(SUN_RADIUS * 4.6 * (1 + Math.sin(simTime * 0.7) * 0.02 + coronaFlare * 0.25));

  if (ready) {
    placeBodies(dt);
    updateTelescope(dt);
    for (const f of ticks) f(simTime);
    updateSpaceWeather(dt);
    if (mode === 'free' && free.init) updateFree(dt);
    else if (current) updateCamera(dt);
    if (pendingFree && !trans && current) { pendingFree = false; setMode('free'); }
    updateDashboard(dt);
    updateLabels();
    updateOrbits();
    updateLagrangeMarkers();
    updateLoop(dt);
    belts.forEach((b) => { b.mesh.rotation.y += b.n * dt; });
  }
  sky.position.copy(camera.position);
  stars.position.copy(camera.position);
  // Test : caméra imposée dans le repère d'un astre (?debug)
  const dc = window.__debug?.cam;
  if (dc && byId[dc.id]) {
    const o = byId[dc.id].obj;
    camera.position.copy(o.localToWorld(new THREE.Vector3(...dc.from)));
    camera.up.copy(new THREE.Vector3(...dc.up || dc.from).normalize().transformDirection(o.matrixWorld));
    camera.lookAt(o.localToWorld(new THREE.Vector3(...dc.to)));
    camera.near = 0.002; camera.updateProjectionMatrix();
    camera.clearViewOffset();
  }
  composer.render();
  if (ready && cockpitLayout()) {
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(cockpit.scene, cockpit.camera);
    renderer.autoClear = true;
  }
}
frame();

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  cockpit.resize(w, h);
  syncLayout();
});

// ---------------------------------------------------------------------------
// Chargement
// ---------------------------------------------------------------------------
function onModelLoaded(gltf) {
    buildSystem(gltf);
    ui.loader.classList.add('hidden');
    setTimeout(() => ui.loader.remove(), 1400);
    [ui.nav, ui.timer, tree, document.getElementById('space-weather'), document.getElementById('mode-switch')].forEach((el) => el.classList.add('visible'));
    const start = location.hash.slice(1);
    if (mode === 'free') {
      // Vol libre : le vaisseau attend sur la base de lancement de PROXION
      setMode('free', true);
      current = byId.proxion;
      if (placeShipAtBase()) { showBody(byId.proxion); return; }
    }
    mode = 'auto';
    setMode('auto', true);
    goTo(byId[start] ? start : 'lexa');
}
function onModelError(err) {
  console.error(err);
  ui.loaderPct.textContent = 'Impossible de charger le système.';
}
// Test : déposer le personnage sur un astre, en un point du repère local (ou dans une direction)
function debugWalk(id, x, y, z, yaw = 0, pitch = -0.1) {
  const b = byId[id];
  if (!b?.walk) return 'pas de données';
  if (mode !== 'free') setMode('free');
  const W = b.walk;
  const p = new THREE.Vector3(x, y, z);
  const dir = p.clone().sub(W.center).normalize();
  if (p.distanceTo(W.center) < W.R * 0.5) { const q = {}; W.sampler.query(dir, q); p.copy(W.center).addScaledVector(dir, q.r + 0.2 * W.m2u); }
  // Le vaisseau se pose à côté
  const q = {}; const sd = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0).cross(dir).normalize(), 30 * W.m2u / W.R);
  W.sampler.query(sd, q);
  const inv = new THREE.Matrix4().copy(b.obj.matrixWorld).invert();
  free.landed = { body: b, ground: W.center.clone().addScaledVector(sd, q.r), localUp: sd.clone() };
  free.anchor = b;
  const t = new THREE.Vector3(1, 0, 0).addScaledVector(dir, -dir.x).normalize().applyAxisAngle(dir, yaw);
  free.walker = { body: b, p, v: new THREE.Vector3(), heading: t, pitch, onGround: false, swim: false, scope: false };
  syncLayout();
  return W.m2u;
}
if (location.search.includes('debug')) window.__debug = { spawnCME, byId, goTo, free, setMode, freeAction, bodyCenter, ship, debugWalk, keys: free.keys, placeShipAtBase, launchSite };
const gltfLoader = new GLTFLoader();
if (window.__PLANETARIUM_GLB__) {
  // Modèle embarqué en base64 (version aperçu hébergée sans fichier .glb)
  const bin = Uint8Array.from(atob(window.__PLANETARIUM_GLB__), (c) => c.charCodeAt(0));
  gltfLoader.parse(bin.buffer, '', onModelLoaded, onModelError);
} else {
  gltfLoader.load(
    import.meta.env.BASE_URL + 'Planetarium.glb',
    onModelLoaded,
    (xhr) => {
      if (!xhr.total) return;
      const p = Math.round((100 * xhr.loaded) / xhr.total);
      ui.loaderBar.style.width = `${p}%`;
      ui.loaderPct.textContent = `${p} %`;
    },
    onModelError
  );
}
