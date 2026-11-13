import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  createSky, createStarfield, createSunMaterial, createCorona, createAtmosphere, createComposer,
} from './effects.js';
import { createLandmarkMoon } from './models.js';
import { SYSTEM, flattenSystem } from './system.js';
import { TEXTS, GALLERIES } from './content.js';

const BODIES = flattenSystem();
const byId = Object.fromEntries(BODIES.map((b) => [b.id, b]));
const SUN_RADIUS = 40;
// Gravitation (unités de la scène, temps accéléré) : T = 2π √(a³ / GM)
const GM_SUN = 1480;
const GM_PLANET = 150;
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
scene.add(sky, stars);

// Lumière : le soleil éclaire, la nuit reste bleutée
const sunLight = new THREE.PointLight(0xffd6a8, 3.2, 0, 0);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x2a3b66, 0.55));

const { composer, film } = createComposer(renderer, scene, camera);
composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

const sunMaterial = createSunMaterial();
const corona = createCorona(SUN_RADIUS * 5);
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
function prepareOrbit(o, GM) {
  o.T = 2 * Math.PI * Math.sqrt((o.a ** 3) / GM);
  o.n = (2 * Math.PI) / o.T;
  o.M = o.M0 || 0;
  const deg = Math.PI / 180;
  o.q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.node || 0)
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
    if (b.glb) {
      const obj = g.getObjectByName(b.glb) || scene.getObjectByName(b.glb);
      if (!obj) { console.warn('Objet introuvable dans le GLB :', b.glb); continue; }
      if (!b.attached && b.kind !== 'star') {
        scene.attach(obj);
        obj.scale.multiplyScalar(b.glbScale || 1);
      }
      b.obj = obj;
    } else if (b.landmark) {
      b.obj = createLandmarkMoon({ radius: 3, seed: b.moon?.seed, colors: b.moon?.colors, landmark: b.landmark });
      b.radius = b.radius || 3.4;
      b.isLandmark = true;
      scene.add(b.obj);
    } else if (b.build) {
      b.obj = b.build();
      scene.add(b.obj);
    }
    if (b.atmosphere) {
      b.atmo = createAtmosphere(b.atmosphere.radius, b.atmosphere.color, { shell: b.atmosphere.shell });
      scene.add(b.atmo);
    }
    if (b.orbit) prepareOrbit(b.orbit, b.kind === 'planet' ? GM_SUN : GM_PLANET * (b.parent?.mass || 1));
  }
  for (const b of BODIES) if (b.obj && b.kind !== 'star') toonify(b.obj);
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
      if (!c.orbit) continue;
      c.orbitLine = orbitLine(c.orbit, c.color, 0.22, true);
      scene.add(c.orbitLine);
    }
  }

  placeBodies(0);
  for (const b of BODIES) if (b.obj) measure(b);
  byId.lexa.viewRadius = SUN_RADIUS;
  ready = true;
}

// ---------------------------------------------------------------------------
// Mouvements orbitaux
// ---------------------------------------------------------------------------
let simTime = 0;
function placeBodies(dt) {
  for (const p of SYSTEM) {
    if (p.kind === 'star' || !p.obj) continue;
    p.orbit.M += p.orbit.n * dt;
    keplerPosition(p.orbit, p.obj.position);
    p.atmo?.position.copy(p.obj.position);
    p.obj.rotation.y += dt * 0.02;
    for (const c of p.children) {
      if (!c.obj || c.attached) continue;
      c.orbit.M += c.orbit.n * dt;
      keplerPosition(c.orbit, c.obj.position).add(p.obj.position);
      if (c.isLandmark) {
        // Les lunes-monuments présentent leur façade vers le côté éclairé
        const toSun = tmpV.copy(c.obj.position).negate();
        c.obj.rotation.y = Math.atan2(toSun.x, toSun.z) + 0.7 + 0.45;
      } else if (c.spin) {
        c.obj.rotation.y += c.spin * dt;
      }
      c.orbitLine?.position.copy(p.obj.position);
      c.obj.userData.update?.(simTime);
      c.obj.children.forEach((ch) => ch.userData.update?.(simTime));
    }
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

function frameFor(b) {
  const center = bodyCenter(b);
  if (b.kind === 'star') {
    const yaw = 0.55 + user.yaw;
    const pitch = THREE.MathUtils.clamp(0.62 + user.pitch, 0.05, 1.45);
    const dist = 1500 * user.zoom * Math.max(1, 1.05 / camera.aspect);
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    return { pos: center.clone().addScaledVector(dir, dist), look: center };
  }
  const R = b.viewRadius || 3;
  let dir;
  if (b.view?.surface && b.parent) {
    // Vue rasante au-dessus d'un élément posé sur une planète
    const n = center.clone().sub(bodyCenter(b.parent)).normalize();
    const side = new THREE.Vector3(0, 1, 0).cross(n).normalize();
    dir = n.clone().multiplyScalar(0.8).addScaledVector(side, 0.45).add(new THREE.Vector3(0, 0.35, 0)).normalize();
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), user.yaw);
  } else {
    const toSun = center.clone().negate().setY(0).normalize();
    const yaw = Math.atan2(toSun.x, toSun.z) + 0.7 + user.yaw;
    const basePitch = b.view?.pitch ?? (b.isLandmark ? 0.6 : b.kind === 'planet' ? 0.3 : 0.35);
    const pitch = THREE.MathUtils.clamp(basePitch + user.pitch, -1.2, 1.4);
    dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  }
  // En portrait (mobile), le champ horizontal est étroit : on recule
  const portrait = Math.max(1, 1.05 / camera.aspect);
  const dist = R * 3.1 * (b.view?.dist || (b.isLandmark ? 0.8 : 1)) * user.zoom * portrait;
  // Pour les lunes-monuments, on vise le bâtiment posé au sommet
  if (b.isLandmark) center.y += b.obj.userData.topY * 0.8;
  return { pos: center.clone().addScaledVector(dir, dist), look: center };
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function bezier(a, b, c, d, t) {
  const u = 1 - t;
  return a.clone().multiplyScalar(u * u * u)
    .addScaledVector(b, 3 * u * u * t)
    .addScaledVector(c, 3 * u * t * t)
    .addScaledVector(d, t * t * t);
}

function startTransition(target) {
  const to = frameFor(target).pos;
  const from = camera.position.clone();
  const d = from.distanceTo(to);
  // Arc : on s'élève, et on contourne le soleil si la trajectoire le traverse
  const seg = to.clone().sub(from);
  const t = THREE.MathUtils.clamp(-from.dot(seg) / Math.max(seg.lengthSq(), 1e-6), 0, 1);
  const closest = from.clone().addScaledVector(seg, t);
  const lift = new THREE.Vector3(0, d * 0.16, 0);
  const safe = SUN_RADIUS * 2.0;
  if (closest.length() < safe) {
    const away = closest.lengthSq() > 1 ? closest.clone().normalize() : new THREE.Vector3(0, 1, 0);
    lift.addScaledVector(away, (safe - closest.length()) * 1.6);
  }
  trans = {
    from, fromLook: look.clone(), lift, t: 0,
    dur: reduceMotion ? 0.01 : THREE.MathUtils.clamp(1.1 + d / 700, 1.1, 3.0),
  };
}

function updateCamera(dt) {
  user.yaw += (user.tYaw - user.yaw) * Math.min(1, dt * 8);
  user.pitch += (user.tPitch - user.pitch) * Math.min(1, dt * 8);
  user.zoom += (user.tZoom - user.zoom) * Math.min(1, dt * 8);
  const f = frameFor(current);
  let fov = 50;
  if (trans) {
    trans.t = Math.min(1, trans.t + dt / trans.dur);
    const u = easeInOut(trans.t);
    const c1 = trans.from.clone().add(trans.lift);
    const c2 = f.pos.clone().addScaledVector(trans.lift, 0.6);
    camera.position.copy(bezier(trans.from, c1, c2, f.pos, u));
    look.copy(trans.fromLook).lerp(f.look, easeInOut(Math.min(1, trans.t * 1.25)));
    fov = 50 + Math.sin(u * Math.PI) * 7;
    if (trans.t >= 1) trans = null;
  } else {
    camera.position.copy(f.pos);
    look.copy(f.look);
  }
  camera.lookAt(look);
  // Décalage du point de fuite pour laisser l'astre entre le panneau et le journal
  viewOffset.x += (viewOffset.tx - viewOffset.x) * Math.min(1, dt * 5);
  viewOffset.y += (viewOffset.ty - viewOffset.y) * Math.min(1, dt * 5);
  camera.fov = fov;
  const w = window.innerWidth, h = window.innerHeight;
  camera.setViewOffset(w, h, viewOffset.x, viewOffset.y, w, h);
  camera.updateProjectionMatrix();
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
// Navigation
// ---------------------------------------------------------------------------
function goTo(id) {
  const b = byId[id];
  if (!b || !ready || b === current || overlayOpen) return;
  const first = !current;
  current = b;
  user.tYaw = user.tPitch = 0;
  user.tZoom = 1;
  if (first) {
    camera.position.copy(frameFor(b).pos).add(new THREE.Vector3(0, 900, 1400));
    look.set(0, 0, 0);
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
    if (ready && current && !overlayOpen && b.obj) {
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
  const k = { ArrowDown: () => stepPlanet(1), ArrowUp: () => stepPlanet(-1), ArrowRight: () => stepMoon(1), ArrowLeft: () => stepMoon(-1), Escape: () => goTo('lexa') }[e.key];
  if (k) { e.preventDefault(); k(); }
});
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
  user.tPitch = THREE.MathUtils.clamp(user.tPitch + dy * 0.004, -1.1, 1.0);
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
  user.tZoom = THREE.MathUtils.clamp(user.tZoom * Math.exp(e.deltaY * 0.001), 0.45, 2.6);
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
  film.uniforms.uTime.value = simTime;
  corona.material.rotation = simTime * 0.01;
  if (!nova) corona.scale.setScalar(SUN_RADIUS * 5 * (1 + Math.sin(simTime * 0.7) * 0.02));

  if (ready) {
    placeBodies(dt);
    if (current) updateCamera(dt);
    updateLabels();
    updateOrbits();
    updateLoop(dt);
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
    [ui.nav, ui.timer, tree].forEach((el) => el.classList.add('visible'));
    const start = location.hash.slice(1);
    goTo(byId[start] ? start : 'lexa');
}
function onModelError(err) {
  console.error(err);
  ui.loaderPct.textContent = 'Impossible de charger le système.';
}
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
