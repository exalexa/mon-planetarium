import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  createSky, createStarfield, createSunMaterial, createCorona, createAtmosphere, createComposer,
  createAsteroidBelt, createGalaxies, createSolarWind, createProminences, createComet, createMapDot,
  createAurora, createMagnetosphere, createCME,
} from './effects.js';
import { createShip, globularCluster } from './models.js';
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

// Vent solaire (spirale de Parker) et protubérances
const solarWind = createSolarWind({ sunRadius: SUN_RADIUS, maxRadius: 1150 });
solarWind.material.uniforms.uPixelRatio.value = pixelRatio;
scene.add(solarWind);
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
      b.magneto = createMagnetosphere(R, b.color);
      b.mag.add(b.aurora, b.magneto);
      b.storm = 0;
      scene.add(b.mag);
    }
  }
  for (const b of BODIES) if (b.obj && b.kind !== 'star') toonify(b.obj);
  toonify(ship);
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

  placeBodies(0);
  for (const b of BODIES) if (b.obj && !b.sky) measure(b);
  byId.lexa.viewRadius = SUN_RADIUS;
  ready = true;
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
  const target = current?.id === 'omega' ? 1 : 0;
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
  solarWind.material.uniforms.uGain.value = 0.8 + wind * 0.5 + (cmes.some((c) => c.active) ? 0.3 : 0);
  for (const c of cmes) {
    if (!c.active) continue;
    c.r += c.speed * dt;
    const u = c.mesh.userData.uniforms;
    u.uFront.value = (c.r - SUN_RADIUS) / (1150 - SUN_RADIUS);
    u.uTime.value = simTime;
    u.uFade.value = THREE.MathUtils.smoothstep(c.r, SUN_RADIUS, SUN_RADIUS + 30) * (1 - THREE.MathUtils.smoothstep(c.r, 850, 1150));
    c.mesh.userData.cap.scale.setScalar(c.r);
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
    p.aurora.userData.setIntensity(0.14 + 0.22 * wind + 1.5 * p.storm);
    const mu = p.magneto.userData.uniforms;
    mu.uK.value = 0.15 + 0.2 * wind + 0.6 * p.storm;
    // Direction du soleil dans le repère du dipôle (sert à comprimer le champ et à décaler l'ovale auroral)
    p.mag.updateMatrixWorld();
    mu.uSun.value.copy(p.obj.position).negate().normalize().applyQuaternion(p.mag.getWorldQuaternion(qInv).invert());
    au.uSun.value.copy(mu.uSun.value);
    const show = g === p && current.kind !== 'star' ? 0.16 : 0;
    mu.uOpacity.value += (show - mu.uOpacity.value) * Math.min(1, dt * 2);
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
function startTransition(target) {
  const to = frameFor(target).pos;
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
    from, lift, t: 0, d,
    fovFrom: camera.userData.baseFov ?? 50,
    qFrom: camera.quaternion.clone(),
    lead: fwd.multiplyScalar(d * 0.18 * ahead),
    dur: reduceMotion ? 0.01 : THREE.MathUtils.clamp(2.2 + d / 450, 2.2, 6.5),
  };
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
  autoThrust = 0.04;
  if (trans) {
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
  camera.userData.baseFov = trans ? fov : targetFov;
  // Oculaire : masque circulaire une fois dans la lunette
  const inScope = current.telescope && (!trans || trans.t > 0.88);
  document.getElementById('eyepiece').classList.toggle('on', !!inScope);
  document.body.classList.toggle('in-scope', !!inScope);
  // Dans l'oculaire, le fond de ciel nébuleux grossi devient un aplat : on le masque
  sky.visible = !inScope;
  if (inScope) document.getElementById('eyepiece').style.setProperty('--ex', `${window.innerWidth / 2 - viewOffset.x}px`);
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
function updateDashboard(dt) {
  const v = camera.position.distanceTo(lastCam) / Math.max(dt, 1e-3);
  lastCam.copy(camera.position);
  camSpeed += (v - camSpeed) * Math.min(1, dt * 4);
  if (mode !== 'auto' || !current) return;
  const tgt = bodyCenter(current);
  document.getElementById('dash-target').textContent = current.name;
  document.getElementById('dash-status').textContent = trans ? 'Pilote auto : en route' : current.telescope ? 'À la lunette' : current.kind === 'star' ? 'Vue d’ensemble' : 'En orbite';
  document.getElementById('dash-dist').textContent = current.telescope ? '≈ 17 000 al' : `${fmt(camera.position.distanceTo(tgt) / UA, 3)} UA`;
  document.getElementById('dash-speed').textContent = `${fmt(camSpeed / UA, 2)} UA/s`;
  // Distance au soleil, convertie par l'échelle d = 190 × UA^0,7
  document.getElementById('dash-helio').textContent = `${fmt(Math.pow(camera.position.length() / UA, 1 / 0.7), 2)} UA`;
  document.getElementById('dash-needle').style.transform = `rotate(${-110 + 220 * autoThrust}deg)`;
  document.getElementById('dash-needle2').style.transform = `rotate(${-110 + 220 * THREE.MathUtils.clamp(windLevel, 0, 1)}deg)`;
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

function computeViewOffset() {
  const w = window.innerWidth, h = window.innerHeight;
  const mobile = w <= 760;
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
const free = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), offset: new THREE.Vector3(),
  anchor: null, target: null, near: null, keys: new Set(), dist: 8, camPos: new THREE.Vector3(), init: false,
};
const KEYMAP = {
  KeyW: 'fwd', ArrowUp: 'fwd', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'up', KeyC: 'down', ControlLeft: 'down', ShiftLeft: 'boost', ShiftRight: 'boost',
};
function bodyRadius(b) { return b.atmosphere?.radius || b.radius || b.viewRadius || 2; }
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
function enterFree() {
  const fwd = camera.getWorldDirection(new THREE.Vector3());
  free.pos.copy(camera.position).addScaledVector(fwd, 8);
  free.vel.set(0, 0, 0);
  free.anchor = findAnchor(free.pos);
  if (free.anchor) free.offset.copy(free.pos).sub(bodyCenter(free.anchor));
  user.yaw = user.tYaw = Math.atan2(fwd.x, fwd.z);
  user.pitch = user.tPitch = Math.asin(THREE.MathUtils.clamp(fwd.y, -1, 1));
  free.camPos.copy(camera.position);
  ship.position.copy(free.pos);
  ship.lookAt(free.pos.clone().add(fwd));
  ship.scale.setScalar(0.9);
  trans = null;
  trail.userData.n = 0;
  free.init = true;
}
function setMode(m, silent = false) {
  if (m === mode && !silent) return;
  mode = m;
  try { localStorage.setItem(MODE_KEY, m); } catch (e) { /* ignore */ }
  document.body.classList.toggle('cockpit', m === 'auto');
  document.body.classList.toggle('free', m === 'free');
  document.querySelectorAll('#mode-switch button').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
  if (silent || !ready) return;
  if (m === 'free') {
    enterFree();
  } else {
    // Retour au pilote automatique : on rejoint l'astre le plus proche
    const n = findNear(ship.position) || findAnchor(ship.position) || byId.lexa;
    free.keys.clear();
    goTo(n.id, true);
  }
}
document.getElementById('mode-switch').addEventListener('click', (e) => {
  const m = e.target.closest('button')?.dataset.mode;
  if (m) setMode(m);
});
// Commandes tactiles
document.querySelectorAll('#flight-pad button').forEach((btn) => {
  const k = btn.dataset.key;
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); free.keys.add(k); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, () => free.keys.delete(k)));
});

const fwdV = new THREE.Vector3(), rightV = new THREE.Vector3(), inputV = new THREE.Vector3();
function updateFree(dt) {
  user.yaw += (user.tYaw - user.yaw) * Math.min(1, dt * 8);
  user.pitch += (user.tPitch - user.pitch) * Math.min(1, dt * 8);
  // Référentiel : on suit l'astre dominant, comme un « alignement de vitesse » automatique
  const prevAnchor = free.anchor;
  if (prevAnchor) free.pos.copy(bodyCenter(prevAnchor)).add(free.offset);
  const anchor = findAnchor(free.pos);
  if (anchor !== prevAnchor) free.anchor = anchor;
  // Commandes
  fwdV.set(Math.sin(user.yaw) * Math.cos(user.pitch), Math.sin(user.pitch), Math.cos(user.yaw) * Math.cos(user.pitch));
  rightV.crossVectors(fwdV, UP).normalize();
  const k = free.keys;
  inputV.set(0, 0, 0)
    .addScaledVector(fwdV, (k.has('fwd') ? 1 : 0) - (k.has('back') ? 1 : 0))
    .addScaledVector(rightV, (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0))
    .addScaledVector(UP, (k.has('up') ? 1 : 0) - (k.has('down') ? 1 : 0));
  const thrusting = inputV.lengthSq() > 0;
  if (thrusting) inputV.normalize();
  const boost = k.has('boost');
  const accel = boost ? 220 : 26;
  free.vel.addScaledVector(inputV, accel * dt);
  free.vel.multiplyScalar(Math.exp(-dt * (thrusting ? 0.35 : 1.1)));
  const vmax = boost ? 420 : 40;
  if (free.vel.length() > vmax) free.vel.setLength(vmax);
  free.pos.addScaledVector(free.vel, dt);
  // Collisions : on ne traverse ni le soleil ni les astres
  if (free.pos.length() < SUN_RADIUS * 1.35) free.pos.setLength(SUN_RADIUS * 1.35);
  for (const b of BODIES) {
    if (!b.obj || b.sky || b.kind === 'star' || b.attached) continue;
    const c = bodyCenter(b, tmpV);
    const minD = bodyRadius(b) * 1.15 + 0.6;
    const d = free.pos.distanceTo(c);
    if (d < minD) {
      const n = free.pos.clone().sub(c).normalize();
      free.pos.copy(c).addScaledVector(n, minD);
      const vn = free.vel.dot(n);
      if (vn < 0) free.vel.addScaledVector(n, -vn);
    }
  }
  if (free.anchor) free.offset.copy(free.pos).sub(bodyCenter(free.anchor));
  // Vaisseau : il s'oriente dans la direction visée
  ship.visible = true;
  ship.position.copy(free.pos);
  const aim = thrusting && inputV.dot(fwdV) > -0.2 ? fwdV : (free.vel.lengthSq() > 1 ? free.vel.clone().normalize() : fwdV);
  mTmp.lookAt(free.pos.clone().add(aim), free.pos, UP);
  qTmp.setFromRotationMatrix(mTmp);
  ship.quaternion.slerp(qTmp, Math.min(1, dt * 4));
  const thr = thrusting ? (boost ? 1 : 0.6) : 0.1;
  ship.userData.setThrust(thr, simTime);
  autoThrust = thr;
  pushTrail(ship.localToWorld(new THREE.Vector3(0, 0, -1.1)), thrusting ? (boost ? 1 : 0.6) : 0.2);
  // Caméra derrière et au-dessus du vaisseau
  const camWant = free.pos.clone().addScaledVector(fwdV, -free.dist).addScaledVector(UP, free.dist * 0.28);
  if (free.anchor) {
    // dans le référentiel de l'astre, pour éviter le tremblement dû à son orbite
    free.camPos.add(bodyCenter(free.anchor).sub(free.lastAnchorPos || bodyCenter(free.anchor)));
  }
  free.lastAnchorPos = free.anchor ? bodyCenter(free.anchor) : null;
  free.camPos.lerp(camWant, 1 - Math.exp(-dt * 9));
  camera.position.copy(free.camPos);
  camera.lookAt(free.pos.clone().addScaledVector(fwdV, free.dist * 0.8));
  sky.visible = true;
  document.getElementById('eyepiece').classList.remove('on');
  document.body.classList.remove('in-scope');
  // Proximité : on affiche la fiche de l'astre approché
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
  // Vitesse et référentiel
  document.getElementById('free-speed').textContent = `${fmt(free.vel.length() / UA, 2)} UA/s${boost ? ' · propulsion rapide' : ''}${free.anchor ? ` · référentiel ${free.anchor.name}` : ''}`;
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
  const first = !current;
  current = b;
  user.tYaw = user.tPitch = 0;
  user.tZoom = 1;
  if (first) {
    camera.position.copy(frameFor(b).pos).add(new THREE.Vector3(0, 900, 1400));
    look.set(0, 0, 0);
    camera.lookAt(look);
  }
  startTransition(b);
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
    if (ready && current && !overlayOpen && b.obj && !current.telescope) {
      if (current.kind === 'star') show = b.kind !== 'moon';
      else show = b === g || b.parent === g || (b.kind !== 'moon' && b !== g);
    }
    if (show) {
      const c = bodyCenter(b, tmpV);
      c.y += (b.viewRadius || 3) * (b.kind === 'star' ? 1.05 : 1.2);
      c.project(camera);
      if (c.z > 1 || c.z < -1) show = false;
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
    if (p.orbitLine) p.orbitLine.material.opacity = current?.kind === 'star' ? 0.28 : 0.12;
    for (const c of p.children) {
      if (!c.orbitLine) continue;
      const target = g === p ? 0.3 : 0;
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
  if (e.code === 'KeyM') { setMode(mode === 'auto' ? 'free' : 'auto'); return; }
  if (mode === 'free') {
    const k = KEYMAP[e.code];
    if (k) { e.preventDefault(); free.keys.add(k); }
    return;
  }
  const k = { ArrowDown: () => stepPlanet(1), ArrowUp: () => stepPlanet(-1), ArrowRight: () => stepMoon(1), ArrowLeft: () => stepMoon(-1), Escape: () => goTo('lexa') }[e.key];
  if (k) { e.preventDefault(); k(); }
});
window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) free.keys.delete(k); });
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
  pointer.down = true; pointer.x = e.clientX; pointer.y = e.clientY; pointer.moved = 0; pointer.id = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointer.down) {
    // Survol : curseur main sur les astres
    if (ready) canvas.style.cursor = pick(e.clientX, e.clientY) ? 'pointer' : 'grab';
    return;
  }
  const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
  pointer.moved += Math.abs(dx) + Math.abs(dy);
  pointer.x = e.clientX; pointer.y = e.clientY;
  user.tYaw -= dx * 0.005;
  if (mode === 'free') user.tPitch = THREE.MathUtils.clamp(user.tPitch - dy * 0.004, -1.45, 1.45);
  else user.tPitch = THREE.MathUtils.clamp(user.tPitch + dy * 0.004, -1.1, 1.0);
  canvas.style.cursor = 'grabbing';
});
canvas.addEventListener('pointerup', (e) => {
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
  solarWind.material.uniforms.uTime.value = simTime;
  prominences.userData.update(simTime);
  film.uniforms.uTime.value = simTime;
  corona.material.rotation = simTime * 0.01;
  if (!nova) corona.scale.setScalar(SUN_RADIUS * 4.6 * (1 + Math.sin(simTime * 0.7) * 0.02 + coronaFlare * 0.25));

  if (ready) {
    placeBodies(dt);
    updateTelescope(dt);
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
  composer.render();
}
frame();

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  computeViewOffset();
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
    // On démarre toujours en pilote automatique ; le vol libre reprend à la fin du premier trajet
    pendingFree = mode === 'free';
    mode = 'auto';
    setMode('auto', true);
    goTo(byId[start] ? start : 'lexa');
}
function onModelError(err) {
  console.error(err);
  ui.loaderPct.textContent = 'Impossible de charger le système.';
}
if (location.search.includes('debug')) window.__debug = { spawnCME, byId, goTo };
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
