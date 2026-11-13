// Modèles procéduraux low-poly : planètes, lunes, lieux d'études, sondes spatiales, projets.
// Style volontairement « fait main », facetté, proche de l'esthétique d'Outer Wilds.
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash3(x, y, z) {
  let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  const h = (dx, dy, dz) => hash3(ix + dx, iy + dy, iz + dz);
  return l(
    l(l(h(0, 0, 0), h(1, 0, 0), sx), l(h(0, 1, 0), h(1, 1, 0), sx), sy),
    l(l(h(0, 0, 1), h(1, 0, 1), sx), l(h(0, 1, 1), h(1, 1, 1), sx), sy),
    sz
  );
}
function fbm3(x, y, z, oct = 4) {
  let v = 0, a = 0.5;
  for (let i = 0; i < oct; i++) {
    v += a * noise3(x, y, z);
    x = x * 2.03 + 1.7; y = y * 2.03 + 9.2; z = z * 2.03 + 3.1;
    a *= 0.5;
  }
  return v;
}

const mat = (color, o = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...o });
const glow = (color, intensity = 2) =>
  new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: intensity, roughness: 1 });

function add(parent, geometry, material, x = 0, y = 0, z = 0, rot = null) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  parent.add(m);
  return m;
}
const box = (p, w, h, d, m, x, y, z, rot) => add(p, new THREE.BoxGeometry(w, h, d), m, x, y + h / 2, z, rot);
const cyl = (p, rt, rb, h, seg, m, x, y, z, rot) => add(p, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y + h / 2, z, rot);
const cone = (p, r, h, seg, m, x, y, z, rot) => add(p, new THREE.ConeGeometry(r, h, seg), m, x, y + h / 2, z, rot);

// Toit à deux pans (prisme triangulaire), faîtage selon X
function gableRoof(p, w, h, d, m, x, y, z) {
  const s = new THREE.Shape();
  s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  g.translate(0, 0, -w / 2);
  g.rotateY(Math.PI / 2);
  return add(p, g, m, x, y, z);
}
// Toit mansardé (trapèze), faîtage selon X
function mansardRoof(p, w, h, d, m, x, y, z, inset = 0.28) {
  const s = new THREE.Shape();
  s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(d / 2 - d * inset, h); s.lineTo(-d / 2 + d * inset, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  g.translate(0, 0, -w / 2);
  g.rotateY(Math.PI / 2);
  return add(p, g, m, x, y, z);
}
// Rangées de fenêtres éclairées sur une façade (face +Z ou -Z)
function windows(p, { w, rows, cols, y0, dy, z, h = 0.09, ww = 0.07, m }) {
  const g = new THREE.BoxGeometry(ww, h, 0.02);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + (w / cols) * (c + 0.5);
      add(p, g, m, x, y0 + r * dy, z);
    }
  }
}
function tree(p, x, y, z, s = 1, color = 0x3f6b3a) {
  cyl(p, 0.025 * s, 0.035 * s, 0.14 * s, 5, mat(0x5a3d26), x, y, z);
  add(p, new THREE.IcosahedronGeometry(0.13 * s, 0), mat(color), x, y + 0.24 * s, z);
}
function pine(p, x, y, z, s = 1, color = 0x2f5a3a) {
  cyl(p, 0.02 * s, 0.03 * s, 0.1 * s, 5, mat(0x4b3322), x, y, z);
  cone(p, 0.14 * s, 0.36 * s, 6, mat(color), x, y + 0.08 * s, z);
}

// Place un objet sur une sphère, orienté selon la normale
function placeOnSphere(obj, radius, dir) {
  const n = dir.clone().normalize();
  obj.position.copy(n).multiplyScalar(radius);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  return obj;
}

// ---------------------------------------------------------------------------
// Planètes et lunes
// ---------------------------------------------------------------------------
// Planète rocheuse facettée, couleurs selon l'altitude
export function createPlanet({ radius, seed = 1, detail = 5, amp = 0.07, freq = 1.4, colors, trees = 0, treeColor, veins = null }) {
  const geometry = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();
  const heights = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const n = fbm3(v.x * freq + seed, v.y * freq + seed * 2, v.z * freq - seed);
    const h = (n - 0.5) * 2;
    heights[i] = h;
    v.multiplyScalar(radius * (1 + h * amp));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const cols = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    const h = (heights[i] + heights[i + 1] + heights[i + 2]) / 3;
    const t = THREE.MathUtils.clamp((h + 0.6) / 1.2, 0, 1);
    const k = Math.min(colors.length - 2, Math.floor(t * (colors.length - 1)));
    c.copy(new THREE.Color(colors[k])).lerp(new THREE.Color(colors[k + 1]), t * (colors.length - 1) - k);
    if (veins) {
      v.fromBufferAttribute(pos, i).normalize();
      const vn = Math.abs(fbm3(v.x * 4 + 7, v.y * 4, v.z * 4) - 0.5);
      if (vn < 0.025) c.set(veins);
    }
    for (let j = 0; j < 3; j++) cols.set([c.r, c.g, c.b], (i + j) * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geometry.computeVertexNormals();
  const group = new THREE.Group();
  const surface = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 })
  );
  group.add(surface);
  const rnd = mulberry32(seed * 1000);
  for (let i = 0; i < trees; i++) {
    const dir = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
    const n = fbm3(dir.x * freq + seed, dir.y * freq + seed * 2, dir.z * freq - seed);
    const h = (n - 0.5) * 2;
    if (h < -0.15 || h > 0.45) continue;
    const t = new THREE.Group();
    pine(t, 0, 0, 0, radius * 0.09 * (0.7 + rnd() * 0.6), treeColor);
    placeOnSphere(t, radius * (1 + h * amp) - radius * 0.012, dir);
    group.add(t);
  }
  return group;
}

// Lune cratérisée avec, si demandé, un plateau au pôle nord pour y poser un bâtiment
export function createMoon({ radius = 3, seed = 3, colors = [0x6f6a64, 0x8e877c, 0xb2a894], plateau = true, craters = 8 }) {
  const geometry = new THREE.IcosahedronGeometry(radius, 4);
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();
  const rnd = mulberry32(seed * 77);
  const list = Array.from({ length: craters }, () => {
    const c = new THREE.Vector3(rnd() - 0.5, rnd() - 0.6, rnd() - 0.5).normalize();
    return { c, r: 0.22 + rnd() * 0.3 };
  });
  const plateauY = 0.8;
  const hs = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let h = 1 + (fbm3(v.x * 3 + seed, v.y * 3, v.z * 3) - 0.5) * 0.12;
    for (const { c, r } of list) {
      if (plateau && c.y > 0.55) continue;
      const d = v.distanceTo(c);
      if (d < r) {
        const k = d / r;
        h -= 0.08 * (1 - k * k) - 0.025 * Math.exp(-Math.pow((k - 0.92) * 9, 2));
      }
    }
    hs[i] = h;
    v.multiplyScalar(radius * h);
    if (plateau && v.y > radius * plateauY) v.y = radius * plateauY + (v.y - radius * plateauY) * 0.04;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const cols = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    const h = (hs[i] + hs[i + 1] + hs[i + 2]) / 3;
    const t = THREE.MathUtils.clamp((h - 0.9) / 0.15, 0, 1);
    const k = Math.min(colors.length - 2, Math.floor(t * (colors.length - 1)));
    c.set(colors[k]).lerp(new THREE.Color(colors[k + 1]), t * (colors.length - 1) - k);
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    if (plateau && y > radius * (plateauY - 0.01)) c.lerp(new THREE.Color(colors[colors.length - 1]), 0.6);
    for (let j = 0; j < 3; j++) cols.set([c.r, c.g, c.b], (i + j) * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geometry.computeVertexNormals();
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })));
  group.userData.topY = plateau ? radius * plateauY : radius;
  return group;
}

// Lune portant un monument sur son plateau
export function createLandmarkMoon({ radius = 3, seed, colors, landmark, scale = 1 }) {
  const moon = createMoon({ radius, seed, colors });
  const lm = landmark();
  lm.scale.setScalar(scale);
  lm.position.y = moon.userData.topY - 0.02;
  moon.add(lm);
  return moon;
}

// ---------------------------------------------------------------------------
// Lieux d'études
// ---------------------------------------------------------------------------
const STONE = 0xd8ccb2, STONE_WARM = 0xcdb894, SLATE = 0x464d5c, ZINC = 0x7d8a99, LIT = 0xffb35a;

// Lycée Pierre Corneille, Rouen : long bâtiment classique + chapelle à fronton
export function lyceeCorneille() {
  const g = new THREE.Group();
  const stone = mat(STONE), slate = mat(SLATE), win = glow(LIT, 1.6);
  // Aile principale
  box(g, 2.6, 0.75, 0.7, stone, 0, 0, 0.25);
  mansardRoof(g, 2.6, 0.28, 0.7, slate, 0, 0.75, 0.25);
  windows(g, { w: 2.5, rows: 3, cols: 13, y0: 0.13, dy: 0.22, z: 0.25 + 0.36, m: win });
  windows(g, { w: 2.5, rows: 3, cols: 13, y0: 0.13, dy: 0.22, z: 0.25 - 0.36, m: win });
  // Aile en retour
  box(g, 0.6, 0.75, 1.0, stone, -1.0, 0, -0.55);
  mansardRoof(g, 1.0, 0.28, 0.6, slate, -1.0, 0.75, -0.55).rotation.y = Math.PI / 2;
  // Chapelle
  const ch = new THREE.Group(); ch.position.set(0.85, 0, -0.65); g.add(ch);
  box(ch, 0.7, 1.05, 1.0, mat(0xe2d6bc), 0, 0, 0);
  gableRoof(ch, 1.0, 0.38, 0.7, slate, 0, 1.05, 0).rotation.y = Math.PI / 2;
  // Fronton et pilastres côté +Z
  const front = new THREE.Shape();
  front.moveTo(-0.38, 0); front.lineTo(0.38, 0); front.lineTo(0, 0.3); front.closePath();
  add(ch, new THREE.ExtrudeGeometry(front, { depth: 0.06, bevelEnabled: false }), mat(0xeee3cb), 0, 1.05, 0.5);
  for (const x of [-0.27, -0.09, 0.09, 0.27]) box(ch, 0.05, 1.0, 0.05, mat(0xf1e8d4), x, 0, 0.52);
  add(ch, new THREE.CylinderGeometry(0.12, 0.12, 0.02, 16), win, 0, 0.75, 0.53, [Math.PI / 2, 0, 0]);
  // Lanternon
  cyl(ch, 0.09, 0.11, 0.22, 8, mat(0xe2d6bc), 0, 1.3, -0.2);
  cone(ch, 0.12, 0.22, 8, slate, 0, 1.52, -0.2);
  // Arbres de la cour
  tree(g, 0.2, 0, -0.5, 1.2); tree(g, -0.35, 0, -0.75, 1.1); tree(g, 1.25, 0, 0.75, 1);
  return g;
}

// Abbaye de Cluny : clocher de l'Eau-Bénite octogonal + tour de l'Horloge
export function abbayeCluny() {
  const g = new THREE.Group();
  const stone = mat(STONE_WARM), dark = mat(0x1d1a17), slate = mat(0x5a4a42);
  // Fragment du transept
  box(g, 1.7, 1.3, 0.75, stone, 0, 0, 0);
  gableRoof(g, 1.7, 0.45, 0.75, slate, 0, 1.3, 0);
  for (const x of [-0.6, -0.2, 0.2, 0.6]) {
    box(g, 0.12, 0.38, 0.02, dark, x, 0.55, 0.38);
    add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.02, 10, 1, false, 0, Math.PI), dark, x, 0.93, 0.385, [Math.PI / 2, 0, Math.PI / 2]);
  }
  // Clocher octogonal
  const t = new THREE.Group(); t.position.set(0, 1.3, 0); g.add(t);
  cyl(t, 0.36, 0.4, 0.2, 8, stone, 0, 0.15, 0);
  cyl(t, 0.33, 0.36, 0.45, 8, stone, 0, 0.35, 0);
  cyl(t, 0.3, 0.33, 0.42, 8, stone, 0, 0.8, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    for (const [yy, rr] of [[0.47, 0.345], [0.9, 0.315]]) {
      const w = add(t, new THREE.BoxGeometry(0.1, 0.2, 0.02), dark, Math.sin(a) * rr, yy + 0.1, Math.cos(a) * rr);
      w.rotation.y = a;
    }
  }
  cone(t, 0.34, 0.75, 8, slate, 0, 1.22, 0);
  // Tour de l'Horloge
  box(g, 0.42, 1.55, 0.42, stone, 1.15, 0, 0.55);
  cone(g, 0.33, 0.45, 4, slate, 1.15, 1.55, 0.55, [0, Math.PI / 4, 0]);
  add(g, new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16), glow(0xffe2a8, 1.2), 1.15, 1.25, 0.77, [Math.PI / 2, 0, 0]);
  // Bâtiment conventuel bas (campus)
  box(g, 1.1, 0.55, 0.5, mat(0xe0d2b6), -1.05, 0, 0.75);
  mansardRoof(g, 1.1, 0.2, 0.5, mat(SLATE), -1.05, 0.55, 0.75);
  windows(g, { w: 1.0, rows: 2, cols: 6, y0: 0.12, dy: 0.2, z: 0.75 + 0.26, m: glow(LIT, 1.4) });
  // Clin d'œil gadzarts
  tree(g, -1.2, 0, -0.55, 1.1); tree(g, 0.9, 0, -0.65, 1.2);
  return g;
}

// Arts et Métiers, campus de Paris : façade haussmannienne + pavillon central, et une petite tour Eiffel
export function ensamParis() {
  const g = new THREE.Group();
  const stone = mat(0xe6dac2), zinc = mat(ZINC, { roughness: 0.6 }), win = glow(LIT, 1.5);
  box(g, 2.4, 0.85, 0.75, stone, -0.25, 0, 0.1);
  mansardRoof(g, 2.4, 0.3, 0.75, zinc, -0.25, 0.85, 0.1);
  windows(g, { w: 2.3, rows: 3, cols: 12, y0: 0.14, dy: 0.24, z: 0.1 + 0.385, m: win });
  // Pavillon central
  const pv = new THREE.Group(); pv.position.set(-0.25, 0, 0.2); g.add(pv);
  box(pv, 0.75, 1.1, 0.75, mat(0xeee3cc), 0, 0, 0);
  for (const x of [-0.27, -0.09, 0.09, 0.27]) cyl(pv, 0.035, 0.035, 0.75, 8, mat(0xf6eedd), x, 0.02, 0.4);
  const ped = new THREE.Shape(); ped.moveTo(-0.4, 0); ped.lineTo(0.4, 0); ped.lineTo(0, 0.22); ped.closePath();
  add(pv, new THREE.ExtrudeGeometry(ped, { depth: 0.08, bevelEnabled: false }), mat(0xf6eedd), 0, 0.8, 0.36);
  mansardRoof(pv, 0.75, 0.32, 0.75, zinc, 0, 1.1, 0);
  // Drapeau
  cyl(pv, 0.01, 0.01, 0.45, 5, mat(0x333333), 0, 1.4, 0);
  box(pv, 0.07, 0.12, 0.01, mat(0x1f3a93), 0.045, 1.7, 0);
  box(pv, 0.07, 0.12, 0.01, mat(0xf5f5f5), 0.115, 1.7, 0);
  box(pv, 0.07, 0.12, 0.01, mat(0xd62828), 0.185, 1.7, 0);
  // Tour Eiffel stylisée
  const e = new THREE.Group(); e.position.set(1.25, 0, -0.45); g.add(e);
  const iron = mat(0x6e4f39, { roughness: 0.7, metalness: 0.3 });
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const leg = add(e, new THREE.CylinderGeometry(0.03, 0.06, 0.6, 4), iron, sx * 0.17, 0.27, sz * 0.17);
    leg.rotation.set(sz * -0.32, 0, sx * 0.32);
  }
  box(e, 0.42, 0.05, 0.42, iron, 0, 0.5, 0);
  add(e, new THREE.CylinderGeometry(0.08, 0.16, 0.55, 4), iron, 0, 0.8, 0, [0, Math.PI / 4, 0]);
  box(e, 0.2, 0.04, 0.2, iron, 0, 1.07, 0);
  add(e, new THREE.CylinderGeometry(0.015, 0.075, 0.75, 4), iron, 0, 1.47, 0, [0, Math.PI / 4, 0]);
  add(e, new THREE.SphereGeometry(0.03, 6, 6), glow(0xffd28a, 3), 0, 1.86, 0);
  tree(g, 0.85, 0, 0.75, 1); tree(g, -1.6, 0, -0.5, 1.1);
  return g;
}

// Le Mans Université : bâtiments modernes + circuit des 24 Heures
export function universiteLeMans() {
  const g = new THREE.Group();
  const concrete = mat(0xe9e5dc), glass = new THREE.MeshStandardMaterial({ color: 0x223344, emissive: 0x6fb8ff, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.4 });
  box(g, 1.3, 0.7, 0.55, concrete, -0.15, 0, -0.2);
  for (let i = 0; i < 3; i++) box(g, 1.24, 0.08, 0.57, glass, -0.15, 0.12 + i * 0.2, -0.2);
  box(g, 0.55, 1.0, 0.55, concrete, 0.55, 0, -0.2);
  for (let i = 0; i < 4; i++) box(g, 0.57, 0.08, 0.49, glass, 0.55, 0.12 + i * 0.21, -0.2);
  box(g, 0.6, 0.06, 0.6, mat(0x9aa3ad), 0.55, 1.0, -0.2);
  box(g, 0.5, 0.4, 0.9, concrete, -0.55, 0, 0.45);
  box(g, 0.52, 0.08, 0.6, glass, -0.55, 0.16, 0.45);
  // Circuit
  const track = add(g, new THREE.RingGeometry(1.25, 1.45, 48), new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.9, side: THREE.DoubleSide }), 0, 0.012, 0, [-Math.PI / 2, 0, 0]);
  track.scale.set(1, 0.85, 1);
  add(g, new THREE.RingGeometry(1.44, 1.47, 48), mat(0xe8e1d0, { side: THREE.DoubleSide }), 0, 0.014, 0, [-Math.PI / 2, 0, 0]).scale.set(1, 0.85, 1);
  // Ligne de départ en damier
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++)
    box(g, 0.05, 0.005, 0.05, mat((i + j) % 2 ? 0x111111 : 0xffffff), 1.29 + i * 0.05, 0.014, -0.02 + j * 0.05);
  // Petite voiture rouge
  const car = new THREE.Group(); car.position.set(-0.05, 0.015, 1.15); car.rotation.y = 0.15; g.add(car);
  box(car, 0.24, 0.06, 0.11, mat(0xd8342c, { roughness: 0.4 }), 0, 0.02, 0);
  box(car, 0.1, 0.05, 0.09, mat(0x1b2733), -0.02, 0.08, 0);
  add(car, new THREE.SphereGeometry(0.02, 6, 6), glow(0xfff2c0, 4), 0.125, 0.05, 0.035);
  add(car, new THREE.SphereGeometry(0.02, 6, 6), glow(0xfff2c0, 4), 0.125, 0.05, -0.035);
  tree(g, 0.6, 0, 0.6, 0.9); tree(g, 0.9, 0, 0.3, 0.8);
  return g;
}

// Aix-Marseille Université : Notre-Dame de la Garde sur sa colline, campus et palmier
export function amuMarseille() {
  const g = new THREE.Group();
  const white = mat(0xf0ebe0), green = mat(0x6f8c74), gold = new THREE.MeshStandardMaterial({ color: 0xd4a640, emissive: 0xffb540, emissiveIntensity: 1.8, metalness: 0.8, roughness: 0.3 });
  cone(g, 0.95, 0.7, 7, mat(0xd6cdb9), 0.35, -0.05, -0.25);
  const b = new THREE.Group(); b.position.set(0.35, 0.6, -0.25); g.add(b);
  // Basilique à assises bicolores
  for (let i = 0; i < 5; i++) box(b, 0.75, 0.07, 0.36, i % 2 ? green : white, -0.1, i * 0.07, 0);
  cyl(b, 0.14, 0.14, 0.12, 10, white, -0.35, 0.35, 0);
  add(b, new THREE.SphereGeometry(0.14, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), green, -0.35, 0.47, 0);
  // Clocher
  for (let i = 0; i < 8; i++) box(b, 0.24, 0.08, 0.24, i % 2 ? green : white, 0.32, i * 0.08, 0);
  box(b, 0.2, 0.2, 0.2, white, 0.32, 0.64, 0);
  box(b, 0.12, 0.12, 0.12, white, 0.32, 0.84, 0);
  cyl(b, 0.03, 0.05, 0.1, 6, white, 0.32, 0.96, 0);
  // La « Bonne Mère » dorée
  cyl(b, 0.025, 0.04, 0.16, 8, gold, 0.32, 1.06, 0);
  add(b, new THREE.SphereGeometry(0.025, 8, 6), gold, 0.32, 1.25, 0);
  // Bâtiment universitaire
  box(g, 1.0, 0.45, 0.45, mat(0xf4f1ea), -0.75, 0, 0.6);
  for (let i = 0; i < 2; i++) box(g, 1.02, 0.07, 0.47, new THREE.MeshStandardMaterial({ color: 0x223344, emissive: 0x7cc8ff, emissiveIntensity: 0.8 }), -0.75, 0.1 + i * 0.18, 0.6);
  box(g, 0.08, 0.6, 0.08, mat(0x1c5aa8), -0.2, 0, 0.6);
  // Palmier
  const palm = new THREE.Group(); palm.position.set(0.55, 0, 0.85); g.add(palm);
  const trunk = add(palm, new THREE.CylinderGeometry(0.025, 0.04, 0.6, 5), mat(0x8a6a48), 0, 0.3, 0);
  trunk.rotation.z = 0.12;
  for (let i = 0; i < 6; i++) {
    const leaf = add(palm, new THREE.BoxGeometry(0.32, 0.01, 0.06), mat(0x4f8a3c), 0, 0.6, 0);
    leaf.rotation.set(0, (i / 6) * Math.PI * 2, -0.35);
    leaf.translateX(0.15);
  }
  return g;
}

// Observatoire de Meudon : château et Grande Coupole
export function observatoireMeudon() {
  const g = new THREE.Group();
  const stone = mat(0xe4d9c2), slate = mat(SLATE), win = glow(LIT, 1.5);
  const dome = new THREE.MeshStandardMaterial({ color: 0xb9c3cc, metalness: 0.65, roughness: 0.35, flatShading: true });
  box(g, 2.6, 0.75, 0.75, stone, 0, 0, 0);
  mansardRoof(g, 2.6, 0.3, 0.75, slate, 0, 0.75, 0);
  windows(g, { w: 2.5, rows: 2, cols: 13, y0: 0.15, dy: 0.28, z: 0.385, m: win });
  // Avant-corps et tambour
  box(g, 0.8, 0.95, 0.85, mat(0xece2cd), 0, 0, 0.05);
  cyl(g, 0.62, 0.62, 0.32, 24, mat(0xe9dfc8), 0, 0.95, 0);
  // Grande Coupole
  add(g, new THREE.SphereGeometry(0.66, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), dome, 0, 1.27, 0);
  box(g, 0.12, 0.62, 0.05, mat(0x15181c), 0, 1.3, 0.48, [-0.55, 0, 0]);
  // Petite coupole (lunette)
  cyl(g, 0.22, 0.22, 0.25, 16, stone, 1.05, 0.75, -0.05);
  add(g, new THREE.SphereGeometry(0.24, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), dome, 1.05, 1.0, -0.05);
  // Forêt de Meudon
  for (const [x, z, s] of [[-1.1, -0.8, 1.2], [-0.6, -0.95, 1], [0.6, -0.9, 1.1], [1.25, 0.75, 1], [-1.3, 0.75, 1.15], [0.1, -1.05, 0.9]])
    tree(g, x, 0, z, s, 0x3a5e35);
  return g;
}

// ---------------------------------------------------------------------------
// Sondes et objets célestes de la recherche
// ---------------------------------------------------------------------------
const FOIL = () => new THREE.MeshStandardMaterial({ color: 0xc9973a, metalness: 0.85, roughness: 0.32, flatShading: true });
const CELLS = () => new THREE.MeshStandardMaterial({ color: 0x1b2f63, emissive: 0x0b1840, emissiveIntensity: 0.6, metalness: 0.5, roughness: 0.35 });
const SILVER = () => new THREE.MeshStandardMaterial({ color: 0xd7dbe0, metalness: 0.6, roughness: 0.4, flatShading: true });

// Gaia (ESA) : grand bouclier solaire circulaire, module de service doré, tente thermique
export function gaiaProbe() {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(2.2, 2.2, 0.06, 12), [SILVER(), CELLS(), SILVER()], 0, 0, 0);
  // Lignes des panneaux
  for (let i = 0; i < 6; i++) {
    const l = add(g, new THREE.BoxGeometry(4.3, 0.005, 0.03), mat(0x4a5c88), 0, -0.035, 0);
    l.rotation.y = (i / 6) * Math.PI;
  }
  cyl(g, 0.75, 0.85, 0.55, 6, FOIL(), 0, 0.03, 0);
  cone(g, 1.0, 1.25, 12, new THREE.MeshStandardMaterial({ color: 0x9aa1a8, metalness: 0.3, roughness: 0.7, flatShading: true }), 0, 0.58, 0);
  add(g, new THREE.SphereGeometry(0.06, 8, 8), glow(0x9fe0ff, 3), 0, 1.85, 0);
  g.rotation.x = 0.35;
  return g;
}

// Euclid (ESA) : télescope cylindrique, module hexagonal doré, bouclier-panneau solaire
export function euclidProbe() {
  const g = new THREE.Group();
  cyl(g, 0.75, 0.75, 0.6, 6, FOIL(), 0, 0, 0);
  cyl(g, 0.6, 0.62, 1.9, 16, SILVER(), 0, 0.6, 0);
  add(g, new THREE.CylinderGeometry(0.5, 0.5, 0.02, 16), mat(0x0b0d12), 0, 2.51, 0);
  // Bouclier solaire incliné
  const shield = add(g, new THREE.BoxGeometry(0.07, 2.7, 1.9), [SILVER(), CELLS(), SILVER(), SILVER(), SILVER(), SILVER()], -0.85, 1.3, 0);
  shield.rotation.z = 0.08;
  for (let i = 0; i < 4; i++) box(g, 0.075, 0.01, 1.85, mat(0x4a5c88), -0.86, 0.15 + i * 0.6, 0);
  // Antenne
  add(g, new THREE.SphereGeometry(0.28, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3), SILVER(), 0.55, -0.15, 0.4, [Math.PI, 0, 0]);
  add(g, new THREE.SphereGeometry(0.05, 8, 8), glow(0xffd28a, 3), 0, 2.55, 0);
  g.rotation.z = -0.25;
  return g;
}

// Amas globulaire (ω Centauri) : profil de Plummer, étoiles dorées
export function globularCluster(radius = 3, count = 3500) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const rnd = mulberry32(42);
  const a = radius * 0.28;
  const pal = [new THREE.Color('#ffe2b0'), new THREE.Color('#ffd08a'), new THREE.Color('#fff4e6'), new THREE.Color('#ffb070'), new THREE.Color('#bcd4ff')];
  for (let i = 0; i < count; i++) {
    const r = a / Math.sqrt(Math.pow(rnd() * 0.97 + 0.0001, -2 / 3) - 1);
    const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(Math.min(r, radius * 1.4));
    positions.set([v.x, v.y, v.z], i * 3);
    const c = pal[Math.floor(rnd() * pal.length)];
    const b = 0.35 + rnd() * 0.75;
    colors.set([c.r * b, c.g * b, c.b * b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size: radius * 0.045, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  }));
  const g = new THREE.Group();
  g.add(pts);
  // Noyau lumineux
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffd9a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.28 }));
  core.scale.setScalar(radius * 1.1);
  g.add(core);
  return g;
}

// ---------------------------------------------------------------------------
// Projets d'ingénierie
// ---------------------------------------------------------------------------
// Implant glénoïdien en UHMWPE (en forme de poire, concave) + tête humérale
export function glenoidImplant() {
  const g = new THREE.Group();
  const pe = new THREE.MeshStandardMaterial({ color: 0xf3efe4, roughness: 0.38, metalness: 0 });
  const s = new THREE.Shape();
  s.moveTo(0, -1.25);
  s.bezierCurveTo(0.95, -1.25, 1.0, -0.1, 0.65, 0.45);
  s.bezierCurveTo(0.45, 0.85, 0.25, 1.05, 0, 1.05);
  s.bezierCurveTo(-0.25, 1.05, -0.45, 0.85, -0.65, 0.45);
  s.bezierCurveTo(-1.0, -0.1, -0.95, -1.25, 0, -1.25);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.28, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 3, curveSegments: 24 });
  // Face articulaire concave
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (z > 0.2) p.setZ(i, z - 0.25 * (1 - (x * x + y * y) / 1.6));
  }
  geo.computeVertexNormals();
  const plate = add(g, geo, pe, 0, 0, 0);
  plate.rotation.x = -0.2;
  // Plots d'ancrage
  for (const [x, y] of [[0, 0.55], [-0.35, -0.45], [0.35, -0.45]]) {
    const peg = add(g, new THREE.CylinderGeometry(0.12, 0.09, 0.7, 10), pe, x, y, -0.35);
    peg.rotation.x = Math.PI / 2;
    peg.position.y = y * Math.cos(-0.2);
  }
  // Tête humérale métallique (CoCr)
  add(g, new THREE.SphereGeometry(1.0, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.4), new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 1, roughness: 0.18 }), 0, 0.05, 2.1, [-Math.PI / 2 - 0.2, 0, 0]);
  // Repère FEA : maillage filaire léger
  const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x5fd4ff, wireframe: true, transparent: true, opacity: 0.18 }));
  wire.rotation.x = -0.2;
  wire.scale.setScalar(1.01);
  g.add(wire);
  // Face articulaire tournée vers le haut, pour qu'on la voie depuis la caméra
  g.rotation.x = -1.0;
  const wrap = new THREE.Group();
  wrap.add(g);
  return wrap;
}

// Pylône électrique (Enedis Data Challenge) avec points de données lumineux
export function enedisPylon() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa4ad, metalness: 0.6, roughness: 0.45, flatShading: true });
  const build = (x, z, s) => {
    const p = new THREE.Group(); p.position.set(x, 0, z); p.scale.setScalar(s); g.add(p);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const leg = add(p, new THREE.CylinderGeometry(0.02, 0.03, 1.7, 4), steel, sx * 0.13, 0.82, sz * 0.13);
      leg.rotation.set(sz * -0.1, 0, sx * 0.1);
    }
    for (let i = 0; i < 4; i++) box(p, 0.42 - i * 0.07, 0.025, 0.42 - i * 0.07, steel, 0, 0.3 + i * 0.38, 0);
    box(p, 1.1, 0.04, 0.06, steel, 0, 1.25, 0);
    box(p, 0.8, 0.04, 0.06, steel, 0, 1.55, 0);
    for (const x2 of [-0.52, 0.52, -0.38, 0.38]) add(p, new THREE.SphereGeometry(0.03, 6, 6), glow(0x7dffc8, 2.5), x2, Math.abs(x2) > 0.45 ? 1.2 : 1.5, 0);
    return p;
  };
  build(-0.55, 0, 1);
  build(0.9, -0.35, 0.75);
  // Câbles
  const cable = new THREE.LineBasicMaterial({ color: 0x2a2f36 });
  for (const [y1, y2, dx] of [[1.2, 0.9, 0.52], [1.5, 1.12, 0.38]]) {
    for (const s of [-1, 1]) {
      const a = new THREE.Vector3(-0.55 + s * dx, y1, 0);
      const b = new THREE.Vector3(0.9 + s * dx * 0.75, y2, -0.35);
      const m = a.clone().lerp(b, 0.5); m.y -= 0.12;
      const curve = new THREE.QuadraticBezierCurve3(a, m, b);
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(16)), cable));
    }
  }
  // Données reconstituées : petits cubes lumineux
  const rnd = mulberry32(9);
  const cubeGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
  const known = glow(0x7dffc8, 2.2), filled = glow(0xffb35a, 2.6);
  for (let i = 0; i < 26; i++) {
    const t = i / 25;
    const x = -1.3 + t * 2.6;
    const y = 2.1 + Math.sin(t * 9) * 0.18 + (rnd() - 0.5) * 0.06;
    add(g, cubeGeo, i % 5 === 2 || i % 7 === 4 ? filled : known, x, y, 0.4);
  }
  return g;
}

// Lune-océan avec un galet qui ricoche (TIPE)
export function ricochetMoon(radius = 2.8) {
  const g = new THREE.Group();
  const water = new THREE.MeshStandardMaterial({ color: 0x1f6f9a, roughness: 0.18, metalness: 0.1, emissive: 0x062033, emissiveIntensity: 0.5 });
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 5), water));
  // Petit îlot
  const isle = new THREE.Group();
  add(isle, new THREE.IcosahedronGeometry(0.45, 1), mat(0x8a7a62), 0, -0.15, 0).scale.set(1, 0.45, 1);
  pine(isle, 0.05, 0.02, 0.05, 1.5);
  placeOnSphere(isle, radius, new THREE.Vector3(-0.55, 1, 0.25));
  g.add(isle);
  // Trajectoire du galet : rebonds de plus en plus courts
  const ripples = [];
  const path = new THREE.Vector3(0.6, 1, -0.4).normalize();
  const axis = new THREE.Vector3(0, 0, 1);
  let ang = 0;
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const d = path.clone().applyAxisAngle(axis, ang);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.27, 40),
      new THREE.MeshBasicMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })
    );
    const holder = new THREE.Group();
    holder.add(ring);
    ring.rotation.x = -Math.PI / 2;
    placeOnSphere(holder, radius + 0.01, d);
    g.add(holder);
    ripples.push({ ring, phase: i * 0.6 });
    pts.push(d.clone().multiplyScalar(radius));
    ang += 0.32 - i * 0.04;
  }
  // Arcs du galet
  const arcPts = [];
  for (let i = 0; i < pts.length - 1; i++) {
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      const p = pts[i].clone().lerp(pts[i + 1], t);
      p.setLength(radius + Math.sin(t * Math.PI) * (0.35 - i * 0.05));
      arcPts.push(p);
    }
  }
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(arcPts), new THREE.LineDashedMaterial({ color: 0xffe0b0, dashSize: 0.06, gapSize: 0.05, transparent: true, opacity: 0.7 })));
  g.children[g.children.length - 1].computeLineDistances();
  const stone = add(g, new THREE.SphereGeometry(0.24, 10, 6), mat(0x6c655c), 0, 0, 0);
  stone.scale.set(1, 0.35, 0.8);
  stone.position.copy(pts[pts.length - 1]).setLength(radius + 0.12);
  g.userData.update = (t) => {
    for (const r of ripples) {
      const k = ((t * 0.5 + r.phase) % 1);
      r.ring.scale.setScalar(1 + k * 1.6);
      r.ring.material.opacity = 0.8 * (1 - k);
    }
  };
  return g;
}

// ---------------------------------------------------------------------------
// Arts
// ---------------------------------------------------------------------------
// Piano à queue flottant, entouré de notes lumineuses
export function grandPiano() {
  const g = new THREE.Group();
  const lacquer = new THREE.MeshStandardMaterial({ color: 0x0d0d10, roughness: 0.18, metalness: 0.2 });
  const s = new THREE.Shape();
  s.moveTo(-0.75, 0); s.lineTo(0.75, 0); s.lineTo(0.75, 0.9);
  s.bezierCurveTo(0.75, 1.6, 0.35, 1.65, 0.2, 2.1);
  s.bezierCurveTo(0.05, 2.5, -0.35, 2.6, -0.75, 2.55);
  s.closePath();
  const body = add(g, new THREE.ExtrudeGeometry(s, { depth: 0.38, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, curveSegments: 20 }), lacquer, 0, 0.75, 0, [Math.PI / 2, 0, 0]);
  body.position.y = 1.13;
  // Couvercle ouvert, charnière sur le côté droit (grave), soulevé côté courbe
  const lidGeo = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false, curveSegments: 20 });
  lidGeo.rotateX(Math.PI / 2);
  lidGeo.translate(0.75, 0.03, 0);
  const pivot = new THREE.Group(); pivot.position.set(-0.75, 1.16, 0); g.add(pivot);
  pivot.add(new THREE.Mesh(lidGeo, lacquer));
  pivot.rotation.z = 0.6;
  // Béquille
  const prop = add(g, new THREE.CylinderGeometry(0.012, 0.012, 0.85, 5), lacquer, 0.45, 1.5, 1.2);
  prop.rotation.z = 0.35;
  // Clavier
  box(g, 1.5, 0.05, 0.22, mat(0xf3f0e6), 0, 0.8, -0.12);
  for (let i = 0; i < 15; i++) if (![2, 6, 9, 13].includes(i % 14)) box(g, 0.035, 0.03, 0.12, mat(0x111111), -0.7 + i * 0.1, 0.85, -0.07);
  // Pieds
  for (const [x, z] of [[-0.65, 0], [0.65, 0], [-0.55, 2.3]]) cyl(g, 0.05, 0.04, 0.75, 8, lacquer, x, 0, z);
  // Notes lumineuses
  const notes = new THREE.Group(); g.add(notes);
  const mk = (ch, color) => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'); x.fillStyle = color; x.font = 'bold 48px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, 32, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  };
  const mats = [mk('♪', '#ffd7a0'), mk('♫', '#ff9ccf'), mk('♩', '#ffe9c9')];
  for (let i = 0; i < 9; i++) {
    const sp = new THREE.Sprite(mats[i % 3]);
    sp.scale.setScalar(0.45);
    sp.userData = { a: (i / 9) * Math.PI * 2, r: 1.9 + (i % 3) * 0.35, y: 1.4 + (i % 4) * 0.35 };
    notes.add(sp);
  }
  g.userData.update = (t) => {
    notes.children.forEach((sp, i) => {
      const { a, r, y } = sp.userData;
      sp.position.set(Math.cos(a + t * 0.25) * r, y + Math.sin(t * 0.8 + i) * 0.15, 1.1 + Math.sin(a + t * 0.25) * r);
    });
  };
  g.position.z = -1.1;
  const wrap = new THREE.Group(); wrap.add(g);
  wrap.userData.update = g.userData.update;
  return wrap;
}

// Anneau de poussière pour une planète
export function createRing(inner, outer, color = 0xc9b8ff, count = 2500) {
  const pos = new Float32Array(count * 3);
  const rnd = mulberry32(5);
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const r = inner + Math.pow(rnd(), 0.8) * (outer - inner);
    pos.set([Math.cos(a) * r, (rnd() - 0.5) * 0.25, Math.sin(a) * r], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.18, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }));
}
