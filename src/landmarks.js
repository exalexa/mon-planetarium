// Lunes-monuments : les lieux d'études et l'observatoire de Meudon, posés sur un sol sphérique.
// Chaque bâtiment est construit à plat dans un « structure() », puis drapé sur la lune :
// il suit la normale de la sphère, et des fondations comblent l'écart dû à la courbure.
import * as THREE from 'three';
import {
  mulberry32, fbm3, mat, glow, add, box, cyl, cone, gableRoof, mansardRoof, windows, tree, pine,
} from './models.js';

const UP = new THREE.Vector3(0, 1, 0);

// Palette
const C = {
  stone: 0xe4d8bf, stoneWarm: 0xd3bd95, stoneLight: 0xefe7d6, white: 0xf3eee3,
  slate: 0x4a5161, zinc: 0x7f8c99, tile: 0x8a573d, brick: 0xa4513a, brick2: 0xbf7350,
  dark: 0x1c1915, bronze: 0x6d5236, grass: 0x7e9f5a, gold: 0xd9ab45,
};
const LIT = 0xffb35a;

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------
function structure(g, x, z, rotY = 0, plinth = true) {
  const s = new THREE.Group();
  s.position.set(x, 0, z);
  s.rotation.y = rotY;
  s.userData.plinth = plinth;
  g.add(s);
  return s;
}

// Aile de bâtiment classique, longueur selon X local, façade principale vers +Z
function wing(s, { len, depth, h, floors, wall = C.stone, roof = C.slate, roofH = 0.3, mansard = true, dormersN = 0, x = 0, z = 0, lit = true }) {
  box(s, len, h, depth, mat(wall), x, 0, z);
  // Bandeau et corniche
  box(s, len + 0.03, 0.035, depth + 0.03, mat(0xf6f0e2), x, h - 0.035, z);
  box(s, len + 0.02, 0.05, depth + 0.02, mat(0xcfc2a6), x, 0, z);
  if (mansard) mansardRoof(s, len, roofH, depth, mat(roof), x, h, z);
  else gableRoof(s, len, roofH, depth, mat(roof), x, h, z);
  const cols = Math.max(2, Math.round(len / 0.19));
  const wm = lit ? glow(LIT, 1.4) : mat(0x2a2f38);
  const dy = (h - 0.12) / floors;
  const g = new THREE.Group(); g.position.x = x; s.add(g);
  windows(g, { w: len - 0.12, rows: floors, cols, y0: 0.1 + dy * 0.35, dy, z: z + depth / 2 + 0.005, h: dy * 0.5, ww: 0.065, m: wm });
  windows(g, { w: len - 0.12, rows: floors, cols, y0: 0.1 + dy * 0.35, dy, z: z - depth / 2 - 0.005, h: dy * 0.5, ww: 0.065, m: wm });
  // Lucarnes
  for (let i = 0; i < dormersN; i++) {
    const dx = x - len / 2 + (len / dormersN) * (i + 0.5);
    for (const sd of [1, -1]) {
      const zz = z + sd * (depth / 2 - depth * 0.2);
      box(s, 0.08, 0.1, 0.08, mat(wall), dx, h + 0.04, zz);
      add(s, new THREE.BoxGeometry(0.04, 0.05, 0.01), glow(LIT, 1.1), dx, h + 0.1, zz + sd * 0.042);
      cone(s, 0.07, 0.07, 4, mat(roof), dx, h + 0.14, zz, [0, Math.PI / 4, 0]);
    }
  }
  return s;
}

// Fronton triangulaire (face +Z)
function pediment(s, w, h, depth, color, x, y, z) {
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.closePath();
  return add(s, new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }), mat(color), x, y, z);
}
// Baie en plein cintre (sombre ou éclairée), sur un plan Z donné
function arch(s, w, h, m, x, y, z) {
  box(s, w, h - w / 2, 0.02, m, x, y, z);
  add(s, new THREE.CylinderGeometry(w / 2, w / 2, 0.02, 12, 1, false, -Math.PI / 2, Math.PI), m, x, y + h - w / 2, z, [Math.PI / 2, 0, 0]);
}
// Petit personnage-statue
function statue(s, x, y, z, color = C.white, sc = 1) {
  cyl(s, 0.025 * sc, 0.03 * sc, 0.09 * sc, 6, mat(color), x, y, z);
  add(s, new THREE.SphereGeometry(0.02 * sc, 6, 5), mat(color), x, y + 0.11 * sc, z);
}
// Texte peint (panneau)
function textPlane(text, w, h, { color = '#2b2118', bg = null, weight = 800 } = {}) {
  const cw = 512, ch = Math.max(32, Math.round((512 * h) / w));
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, cw, ch); }
  x.fillStyle = color;
  x.font = `${weight} ${Math.round(ch * 0.62)}px Georgia, serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, cw / 2, ch / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: !bg }));
}
// Bande sphérique (route, pelouse en anneau…) entre deux distances au pôle, collée à la sphère
function sphereBand(R, r1, r2, color, lift = 0.006, seg = 72) {
  const t1 = Math.asin(Math.min(1, r1 / R)), t2 = Math.asin(Math.min(1, r2 / R));
  return new THREE.Mesh(
    new THREE.SphereGeometry(R + lift, seg, 2, 0, Math.PI * 2, t1, t2 - t1),
    new THREE.MeshStandardMaterial({ color, roughness: 1 })
  );
}

// ---------------------------------------------------------------------------
// Drapé sur la sphère
// ---------------------------------------------------------------------------
const tmpBox = new THREE.Box3();
function drape(group, R) {
  for (const c of [...group.children]) {
    if (c.userData.noDrape) continue;
    const { x, z } = c.position;
    const y0 = c.position.y;
    if (c.userData.plinth) {
      // Fondations : on mesure l'emprise dans le repère du bâtiment
      const rot = c.rotation.y;
      c.position.set(0, 0, 0); c.rotation.set(0, 0, 0);
      c.updateMatrixWorld(true);
      tmpBox.setFromObject(c);
      c.rotation.y = rot;
      const hx = Math.max(Math.abs(tmpBox.min.x), Math.abs(tmpBox.max.x));
      const hz = Math.max(Math.abs(tmpBox.min.z), Math.abs(tmpBox.max.z));
      const sag = (hx * hx + hz * hz) / (2 * R) + 0.1;
      const w = tmpBox.max.x - tmpBox.min.x + 0.06, d = tmpBox.max.z - tmpBox.min.z + 0.06;
      box(c, w, sag, d, mat(0x9d927f), (tmpBox.min.x + tmpBox.max.x) / 2, -sag + 0.01, (tmpBox.min.z + tmpBox.max.z) / 2);
    }
    const n = new THREE.Vector3(x, Math.sqrt(Math.max(R * R - x * x - z * z, 0.01)), z).normalize();
    c.position.copy(n).multiplyScalar(R + y0 - 0.004);
    c.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(UP, n));
  }
  group.userData.afterDrape?.(group);
}

// Lune au relief doux ; la calotte nord reste légèrement sous le niveau R pour accueillir la pelouse
function createMoon({ radius, seed, colors, cap = 0.62 }) {
  const geometry = new THREE.IcosahedronGeometry(radius, 5);
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();
  const rnd = mulberry32(seed * 77);
  const craters = Array.from({ length: 10 }, () => ({ c: new THREE.Vector3(rnd() - 0.5, rnd() - 0.75, rnd() - 0.5).normalize(), r: 0.2 + rnd() * 0.28 }));
  const cosCap = Math.cos(cap + 0.12);
  const hs = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let h = 1 + (fbm3(v.x * 3 + seed, v.y * 3, v.z * 3) - 0.5) * 0.09;
    for (const { c, r } of craters) {
      const d = v.distanceTo(c);
      if (d < r) { const k = d / r; h -= 0.06 * (1 - k * k) - 0.02 * Math.exp(-Math.pow((k - 0.92) * 9, 2)); }
    }
    // Près du pôle, le sol rejoint doucement la sphère idéale
    const t = THREE.MathUtils.smoothstep(v.y, cosCap - 0.15, cosCap);
    h = THREE.MathUtils.lerp(h, 0.992, t);
    hs[i] = h;
    v.multiplyScalar(radius * h);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const cols = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    const h = (hs[i] + hs[i + 1] + hs[i + 2]) / 3;
    const t = THREE.MathUtils.clamp((h - 0.93) / 0.1, 0, 1);
    const k = Math.min(colors.length - 2, Math.floor(t * (colors.length - 1)));
    c.set(colors[k]).lerp(new THREE.Color(colors[k + 1]), t * (colors.length - 1) - k);
    for (let j = 0; j < 3; j++) cols.set([c.r, c.g, c.b], (i + j) * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
}

// Assemble lune + pelouse + monument drapé + quelques rochers et arbres épars
export function createLandmarkMoon({ radius = 4, seed = 1, colors, landmark, ground = C.grass, cap = 0.62 }) {
  const moon = new THREE.Group();
  moon.add(createMoon({ radius, seed, colors, cap }));
  // Pelouse / sol aménagé en calotte, bord légèrement irrégulier
  const lawn = new THREE.Mesh(
    new THREE.SphereGeometry(radius + 0.003, 64, 14, 0, Math.PI * 2, 0, cap),
    new THREE.MeshStandardMaterial({ color: ground, roughness: 1 })
  );
  const lp = lawn.geometry.attributes.position;
  for (let i = 0; i < lp.count; i++) {
    const vy = lp.getY(i) / radius;
    if (vy < Math.cos(cap) + 0.02) {
      const ang = Math.atan2(lp.getZ(i), lp.getX(i));
      const k = 1 - 0.015 * (Math.sin(ang * 7 + seed) + 1);
      lp.setXYZ(i, lp.getX(i) * k, lp.getY(i) + (1 - k) * 2, lp.getZ(i) * k);
    }
  }
  lawn.geometry.computeVertexNormals();
  moon.add(lawn);
  const lm = landmark(radius);
  drape(lm, radius);
  moon.add(lm);
  // Végétation éparse hors de la calotte
  const rnd = mulberry32(seed * 13);
  for (let i = 0; i < 14; i++) {
    const d = new THREE.Vector3(rnd() - 0.5, rnd() * 0.9 - 0.2, rnd() - 0.5).normalize();
    if (d.y > Math.cos(cap) - 0.05) continue;
    const t = new THREE.Group();
    if (rnd() < 0.6) pine(t, 0, 0, 0, 1.2 + rnd() * 0.8, 0x3b5e3a);
    else add(t, new THREE.IcosahedronGeometry(0.12 + rnd() * 0.15, 0), mat(0x8a8175), 0, 0.03, 0);
    t.position.copy(d).multiplyScalar(radius * 0.985);
    t.quaternion.setFromUnitVectors(UP, d);
    moon.add(t);
  }
  moon.userData.topY = radius;
  return moon;
}

// ---------------------------------------------------------------------------
// Lycée Pierre Corneille, Rouen
// Ailes classiques en pierre autour d'une cour d'honneur, toits d'ardoise à lucarnes,
// chapelle Saint-Louis à façade blanche (deux ordres, baie en plein cintre, fronton, statues, escalier).
// ---------------------------------------------------------------------------
export function lyceeCorneille() {
  const g = new THREE.Group();
  wing(structure(g, 0.15, -0.8), { len: 2.4, depth: 0.5, h: 0.82, floors: 3, dormersN: 8 });
  wing(structure(g, 1.15, 0.05, Math.PI / 2), { len: 1.3, depth: 0.48, h: 0.82, floors: 3, dormersN: 4 });
  wing(structure(g, -0.85, 0.05, Math.PI / 2), { len: 1.3, depth: 0.48, h: 0.82, floors: 3, dormersN: 4 });
  // Cheminées
  const n = g.children[0];
  for (const x of [-0.9, 0, 0.9]) box(n, 0.08, 0.2, 0.08, mat(0xb9ad95), x, 1.0, 0);

  // Chapelle Saint-Louis (façade au sud, vers +Z)
  const ch = structure(g, -1.75, 0.3);
  box(ch, 0.56, 1.05, 1.3, mat(C.stone), 0, 0, -0.1);
  gableRoof(ch, 1.3, 0.42, 0.56, mat(C.slate), 0, 1.05, -0.1).rotation.y = Math.PI / 2;
  for (const zz of [-0.55, -0.2, 0.15]) for (const sx of [1, -1]) {
    const side = new THREE.Group(); side.position.set(sx * 0.285, 0, zz); side.rotation.y = sx * Math.PI / 2; ch.add(side);
    arch(side, 0.1, 0.35, mat(0x2b3240), 0, 0.45, 0);
  }
  const F = 0.57; // plan de la façade
  box(ch, 0.8, 0.72, 0.1, mat(C.white), 0, 0, F);
  box(ch, 0.84, 0.06, 0.13, mat(C.stoneLight), 0, 0.72, F);
  for (const x of [-0.33, -0.18, 0.18, 0.33]) cyl(ch, 0.028, 0.03, 0.66, 10, mat(0xfbf7ee), x, 0.02, F + 0.07);
  arch(ch, 0.16, 0.42, mat(0x3b2b20), 0, 0.04, F + 0.06);
  box(ch, 0.5, 0.45, 0.1, mat(C.white), 0, 0.78, F);
  for (const x of [-0.2, 0.2]) cyl(ch, 0.022, 0.025, 0.4, 10, mat(0xfbf7ee), x, 0.8, F + 0.07);
  arch(ch, 0.16, 0.3, glow(0xffcf8a, 1.0), 0, 0.84, F + 0.06);
  // Ailerons à volutes
  for (const sx of [1, -1]) {
    const v = add(ch, new THREE.CylinderGeometry(0.15, 0.15, 0.08, 12, 1, false, 0, Math.PI / 2), mat(C.white), sx * 0.25, 0.78, F);
    v.rotation.set(Math.PI / 2, 0, sx > 0 ? 0 : -Math.PI / 2);
  }
  box(ch, 0.54, 0.05, 0.13, mat(C.stoneLight), 0, 1.23, F);
  pediment(ch, 0.56, 0.2, 0.1, C.white, 0, 1.28, F - 0.05);
  // Statues sur les corniches : saint Louis, Charlemagne, Ignace de Loyola, François d'Assise
  for (const [x, y] of [[-0.34, 0.78], [0.34, 0.78], [-0.22, 1.28], [0.22, 1.28]]) statue(ch, x, y, F + 0.02, 0xf4efe4, 0.9);
  // Escalier monumental
  for (let i = 0; i < 3; i++) box(ch, 0.6 - i * 0.06, 0.03, 0.09, mat(0xd9d0bf), 0, i * 0.03, F + 0.16 - i * 0.05);

  // Statue de Pierre Corneille dans la cour
  const st = structure(g, 0.15, 0.1);
  box(st, 0.16, 0.16, 0.16, mat(0xd4cab5), 0, 0, 0);
  statue(st, 0, 0.16, 0, C.bronze, 1.6);
  // Arbres
  for (const [x, z, s] of [[1.75, 0.9, 1.2], [0.7, 1.25, 1], [-0.45, 1.3, 1.1], [1.8, -1.0, 1.1], [-1.3, -1.1, 1]]) tree(structure(g, x, z, 0, false), 0, 0, 0, s, 0x4c7a3d);
  return g;
}

// ---------------------------------------------------------------------------
// Abbaye de Cluny
// Transept sud de Cluny III et clocher octogonal de l'Eau-Bénite (deux registres d'arcades, flèche),
// tour carrée de l'Horloge, absidiole, et bâtiments conventuels du XVIIIe siècle où loge Arts et Métiers.
// ---------------------------------------------------------------------------
export function abbayeCluny() {
  const g = new THREE.Group();
  const stone = mat(C.stoneWarm), dark = mat(0x221d18);
  const t = structure(g, -0.25, -0.35);
  box(t, 1.9, 1.5, 0.62, stone, 0, 0, 0);
  gableRoof(t, 1.9, 0.48, 0.62, mat(C.tile), 0, 1.5, 0);
  // Contreforts et baies romanes
  for (const x of [-0.9, -0.45, 0, 0.45, 0.9]) for (const sz of [1, -1]) box(t, 0.09, 1.15, 0.1, stone, x, 0, sz * 0.34);
  for (const x of [-0.68, -0.22, 0.22, 0.68]) for (const sz of [1, -1]) {
    arch(t, 0.12, 0.3, dark, x, 0.35, sz * 0.315);
    arch(t, 0.1, 0.24, dark, x, 0.95, sz * 0.315);
  }
  // Absidiole (côté est)
  add(t, new THREE.CylinderGeometry(0.26, 0.26, 0.75, 14, 1, false, Math.PI / 2, Math.PI), stone, 0.55, 0.375, -0.31);
  add(t, new THREE.ConeGeometry(0.28, 0.25, 14, 1, false, Math.PI / 2, Math.PI), mat(C.tile), 0.55, 0.875, -0.31);
  // Clocher de l'Eau-Bénite
  const c = new THREE.Group(); c.position.set(0.1, 1.5, 0); t.add(c);
  box(c, 0.66, 0.62, 0.66, stone, 0, 0, 0);
  const tiers = [[0.62, 0.44, 0.38], [1.12, 0.4, 0.34]];
  for (const [y, h, r] of tiers) {
    cyl(c, r + 0.04, r + 0.04, 0.05, 8, mat(0xe2d2b2), 0, y - 0.05, 0);
    cyl(c, r, r, h, 8, stone, 0, y, 0);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const fx = Math.sin(a) * r * 0.93, fz = Math.cos(a) * r * 0.93;
      const face = new THREE.Group(); face.position.set(fx, y, fz); face.rotation.y = a; c.add(face);
      // Baies géminées sous arcade
      arch(face, 0.07, h * 0.62, dark, -0.045, h * 0.18, 0.005);
      arch(face, 0.07, h * 0.62, dark, 0.045, h * 0.18, 0.005);
      const ca = Math.sin(a + Math.PI / 8) * r, cz = Math.cos(a + Math.PI / 8) * r;
      cyl(c, 0.018, 0.018, h, 6, mat(0xe8dcc0), ca, y, cz);
    }
  }
  cyl(c, 0.38, 0.38, 0.05, 8, mat(0xe2d2b2), 0, 1.52, 0);
  cone(c, 0.37, 0.95, 8, mat(0x6b6a6c), 0, 1.57, 0);
  add(c, new THREE.SphereGeometry(0.03, 6, 5), mat(C.gold), 0, 2.55, 0);
  // Tour de l'Horloge
  const h = structure(g, 1.05, 0.15);
  box(h, 0.42, 1.75, 0.42, stone, 0, 0, 0);
  for (const y of [0.5, 1.0]) box(h, 0.44, 0.03, 0.44, mat(0xe2d2b2), 0, y, 0);
  for (const sz of [1, -1]) for (const y of [0.25, 0.7]) box(h, 0.05, 0.16, 0.02, dark, 0, y, sz * 0.215);
  add(h, new THREE.CylinderGeometry(0.1, 0.1, 0.02, 20), glow(0xffe6b0, 1.2), 0, 1.45, 0.22, [Math.PI / 2, 0, 0]);
  cone(h, 0.33, 0.5, 4, mat(C.tile), 0, 1.75, 0, [0, Math.PI / 4, 0]);
  // Bâtiments conventuels XVIIIe (campus Arts et Métiers)
  const cv = structure(g, 0.05, 1.0);
  wing(cv, { len: 2.5, depth: 0.5, h: 0.72, floors: 3, wall: C.stoneLight, dormersN: 9 });
  box(cv, 0.5, 0.8, 0.56, mat(0xf2ebdc), 0, 0, 0);
  pediment(cv, 0.52, 0.16, 0.06, 0xf2ebdc, 0, 0.8, 0.22);
  for (const [x, z, s] of [[-1.55, 0.3, 1.2], [1.7, -0.6, 1.1], [-1.4, -1.2, 1.0], [1.55, 0.9, 1.0]]) tree(structure(g, x, z, 0, false), 0, 0, 0, s, 0x4f7c3f);
  return g;
}

// ---------------------------------------------------------------------------
// Arts et Métiers, campus de Paris (151 bd de l'Hôpital, Georges Roussi, 1912)
// Façade en pierre de quatre niveaux sous toit de zinc, avant-corps central à grande porte cintrée,
// halles technologiques en brique polychrome (grande baie centrale, toits en sheds), boulevard arboré.
// ---------------------------------------------------------------------------
export function ensamParis() {
  const g = new THREE.Group();
  const f = structure(g, 0, 0.7);
  wing(f, { len: 2.9, depth: 0.45, h: 0.95, floors: 4, wall: 0xe8ddc5, roof: C.zinc, roofH: 0.28, dormersN: 10 });
  // Avant-corps
  box(f, 0.72, 1.12, 0.56, mat(0xf0e7d3), 0, 0, 0.02);
  for (const x of [-0.28, -0.1, 0.1, 0.28]) box(f, 0.05, 0.85, 0.03, mat(0xf8f2e4), x, 0.12, 0.31);
  arch(f, 0.26, 0.5, glow(0xffc77d, 1.0), 0, 0.02, 0.31);
  const sign = textPlane('ARTS ET MÉTIERS', 0.64, 0.09, { color: '#3a2a1c' });
  sign.position.set(0, 1.02, 0.305); f.add(sign);
  mansardRoof(f, 0.72, 0.34, 0.56, mat(C.zinc), 0, 1.12, 0.02);
  // Drapeau tricolore
  cyl(f, 0.008, 0.008, 0.4, 5, mat(0x333333), 0, 1.45, 0.02);
  [0x1f3a93, 0xf5f5f5, 0xd62828].forEach((col, i) => box(f, 0.06, 0.11, 0.008, mat(col), 0.035 + i * 0.06, 1.72, 0.02));
  // Halles technologiques
  const brick = mat(C.brick), brick2 = mat(C.brick2), glass = glow(0x9fd0ff, 0.6);
  [-0.95, 0, 0.95].forEach((x, i) => {
    const hl = structure(g, x, -0.5);
    box(hl, 0.78, 0.6, 1.0, brick, 0, 0, 0);
    for (let k = 0; k < 4; k++) box(hl, 0.8, 0.04, 1.02, k % 2 ? brick : brick2, 0, 0.12 + k * 0.13, 0);
    // Sheds vitrés
    for (let k = 0; k < 4; k++) {
      const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.25, 0); sh.lineTo(0, 0.16); sh.closePath();
      const m = add(hl, new THREE.ExtrudeGeometry(sh, { depth: 0.78, bevelEnabled: false }), mat(0x6f6a66), -0.39, 0.6, -0.25 + k * 0.25);
      m.rotation.y = Math.PI / 2;
      box(hl, 0.76, 0.15, 0.01, glass, 0, 0.6, -0.25 + k * 0.25 + 0.005);
    }
    // Grande baie centrale et baies latérales (pignon vers -Z)
    arch(hl, 0.24, 0.48, glass, 0, 0.06, -0.505);
    arch(hl, 0.1, 0.3, glass, -0.24, 0.06, -0.505);
    arch(hl, 0.1, 0.3, glass, 0.24, 0.06, -0.505);
    if (i === 1) box(hl, 0.3, 0.06, 0.06, mat(0x2b2b2b), 0, 0.6, -0.52);
  });
  // Platanes du boulevard
  for (let i = 0; i < 7; i++) tree(structure(g, -1.5 + i * 0.5, 1.35, 0, false), 0, 0, 0, 1.05, 0x5b8a45);
  // Tour Eiffel, au loin sur la lune
  const e = structure(g, -1.7, -1.35, 0.4, false);
  e.scale.setScalar(0.85);
  const iron = mat(0x6e4f39);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const leg = add(e, new THREE.CylinderGeometry(0.03, 0.06, 0.6, 4), iron, sx * 0.17, 0.27, sz * 0.17);
    leg.rotation.set(sz * -0.32, 0, sx * 0.32);
  }
  box(e, 0.42, 0.05, 0.42, iron, 0, 0.5, 0);
  add(e, new THREE.CylinderGeometry(0.08, 0.16, 0.55, 4), iron, 0, 0.8, 0, [0, Math.PI / 4, 0]);
  box(e, 0.2, 0.04, 0.2, iron, 0, 1.07, 0);
  add(e, new THREE.CylinderGeometry(0.015, 0.075, 0.75, 4), iron, 0, 1.47, 0, [0, Math.PI / 4, 0]);
  add(e, new THREE.SphereGeometry(0.03, 6, 6), glow(0xffd28a, 3), 0, 1.86, 0);
  return g;
}

// ---------------------------------------------------------------------------
// Le Mans Université : bâtiments contemporains (bandeaux vitrés, brise-soleil),
// et le circuit des 24 Heures avec la passerelle Dunlop.
// ---------------------------------------------------------------------------
export function universiteLeMans(R) {
  const g = new THREE.Group();
  const white = mat(0xeceae4), glass = glow(0x8cc7ff, 0.7), accent = mat(0xe07a3a);
  const a = structure(g, -0.35, -0.35);
  box(a, 1.3, 0.62, 0.55, white, 0, 0, 0);
  for (let i = 0; i < 3; i++) box(a, 1.24, 0.09, 0.57, glass, 0, 0.1 + i * 0.18, 0);
  for (let i = 0; i < 9; i++) box(a, 0.03, 0.6, 0.06, accent, -0.6 + i * 0.15, 0, 0.3);
  const b = structure(g, 0.6, -0.45);
  box(b, 0.5, 1.05, 0.5, white, 0, 0, 0);
  for (let i = 0; i < 4; i++) box(b, 0.52, 0.1, 0.52, glass, 0, 0.12 + i * 0.22, 0);
  box(b, 0.54, 0.05, 0.54, mat(0x9aa3ad), 0, 1.05, 0);
  const lib = structure(g, -0.25, 0.45);
  box(lib, 0.9, 0.35, 0.5, white, 0, 0, 0);
  box(lib, 0.88, 0.25, 0.02, glass, 0, 0.05, 0.255);
  box(lib, 0.92, 0.04, 0.52, mat(0x6d9a4e), 0, 0.35, 0);
  for (const [x, z] of [[0.55, 0.5], [0.85, 0.15], [-0.9, 0.75]]) tree(structure(g, x, z, 0, false), 0, 0, 0, 0.95, 0x557f42);

  // Circuit : bande d'asphalte qui épouse la sphère, bordée de lignes blanches
  const track = new THREE.Group(); track.userData.noDrape = true; g.add(track);
  track.add(sphereBand(R, 1.42, 1.66, 0x2c2c31, 0.008));
  track.add(sphereBand(R, 1.4, 1.43, 0xe9e2d0, 0.009));
  track.add(sphereBand(R, 1.65, 1.68, 0xd8342c, 0.009));
  // Passerelle Dunlop (arche en forme de pneu) et voiture
  const dun = structure(g, 1.54, 0, 0, false);
  add(dun, new THREE.TorusGeometry(0.34, 0.07, 10, 28, Math.PI), mat(0x1b1b1d), 0, 0, 0);
  const label = textPlane('DUNLOP', 0.34, 0.07, { color: '#1b1b1d', bg: '#f2c618' });
  label.position.set(0, 0.36, 0.075); label.rotation.y = 0; dun.add(label);
  const label2 = label.clone(); label2.rotation.y = Math.PI; label2.position.z = -0.075; dun.add(label2);
  const car = structure(g, -1.05, 1.13, -Math.PI / 4, false);
  box(car, 0.24, 0.06, 0.11, mat(0xd8342c), 0, 0.01, 0);
  box(car, 0.1, 0.05, 0.09, mat(0x1b2733), -0.02, 0.07, 0);
  box(car, 0.04, 0.02, 0.13, mat(0x111111), -0.12, 0.09, 0);
  for (const sz of [1, -1]) add(car, new THREE.SphereGeometry(0.018, 6, 6), glow(0xfff2c0, 4), 0.125, 0.04, sz * 0.035);
  // Ligne de départ en damier
  const start = structure(g, 0, -1.54, 0, false);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) box(start, 0.05, 0.006, 0.05, mat((i + j) % 2 ? 0x111111 : 0xffffff), -0.1 + i * 0.05, 0.004, j * 0.05);
  return g;
}

// ---------------------------------------------------------------------------
// Aix-Marseille Université : Notre-Dame de la Garde sur sa colline calcaire
// (assises alternées blanches et vertes, coupole, haut clocher, Bonne Mère dorée),
// bâtiment universitaire, palmiers, pins d'Alep, et la Méditerranée.
// ---------------------------------------------------------------------------
export function amuMarseille(R) {
  const g = new THREE.Group();
  const white = mat(0xf2eee4), green = mat(0x7a9278);
  const gold = new THREE.MeshStandardMaterial({ color: 0xd4a640, emissive: 0xffb540, emissiveIntensity: 1.6 });
  const hill = structure(g, 0.4, -0.35, 0, false);
  cyl(hill, 0.32, 1.05, 0.72, 9, mat(0xdcd5c4), 0, -0.05, 0);
  cyl(hill, 0.28, 0.33, 0.06, 9, mat(0xc8c0ac), 0, 0.67, 0);
  const b = new THREE.Group(); b.position.set(0, 0.72, 0); hill.add(b);
  for (let i = 0; i < 5; i++) box(b, 0.62, 0.07, 0.3, i % 2 ? green : white, -0.1, i * 0.07, 0);
  gableRoof(b, 0.62, 0.1, 0.3, mat(0x9a6a4e), -0.1, 0.35, 0);
  cyl(b, 0.11, 0.11, 0.12, 12, white, -0.15, 0.38, 0);
  add(b, new THREE.SphereGeometry(0.11, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), green, -0.15, 0.5, 0);
  // Clocher : socle rayé, beffroi ajouré, lanterne et statue
  for (let i = 0; i < 9; i++) box(b, 0.24, 0.08, 0.24, i % 2 ? green : white, 0.3, i * 0.08, 0);
  box(b, 0.2, 0.2, 0.2, white, 0.3, 0.72, 0);
  for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const fc = new THREE.Group(); fc.position.set(0.3, 0.72, 0); fc.rotation.y = r; b.add(fc);
    arch(fc, 0.08, 0.15, mat(0x2a2620), 0, 0.03, 0.101);
  }
  cyl(b, 0.07, 0.09, 0.12, 8, white, 0.3, 0.92, 0);
  cyl(b, 0.02, 0.035, 0.2, 8, gold, 0.3, 1.04, 0);
  add(b, new THREE.SphereGeometry(0.025, 8, 6), gold, 0.3, 1.27, 0);
  // Bâtiment AMU
  const u = structure(g, -0.85, 0.6);
  box(u, 1.05, 0.48, 0.48, mat(0xf4f1ea), 0, 0, 0);
  for (let i = 0; i < 2; i++) box(u, 1.07, 0.08, 0.5, glow(0x8ccaff, 0.7), 0, 0.1 + i * 0.18, 0);
  box(u, 0.12, 0.62, 0.06, mat(0x1d4f9c), 0.45, 0, 0.26);
  const amu = textPlane('AMU', 0.1, 0.05, { color: '#ffffff', bg: '#1d4f9c' });
  amu.position.set(0.45, 0.5, 0.295); u.add(amu);
  // Palmiers et pins d'Alep
  for (const [x, z] of [[0.55, 0.8], [0.1, 1.05]]) {
    const p = structure(g, x, z, 0, false);
    add(p, new THREE.CylinderGeometry(0.022, 0.035, 0.6, 5), mat(0x8a6a48), 0.02, 0.3, 0).rotation.z = 0.1;
    for (let i = 0; i < 7; i++) {
      const leaf = add(p, new THREE.BoxGeometry(0.3, 0.01, 0.06), mat(0x4f8a3c), 0, 0.6, 0);
      leaf.rotation.set(0, (i / 7) * Math.PI * 2, -0.4);
      leaf.translateX(0.14);
    }
  }
  for (const [x, z] of [[-1.5, -0.4], [1.45, 0.45]]) tree(structure(g, x, z, 0, false), 0, 0, 0, 1.2, 0x5f7d3f);
  // La Méditerranée : une mer en calotte sur le flanc de la lune
  const sea = new THREE.Mesh(
    new THREE.SphereGeometry(R + 0.02, 48, 12, 0, Math.PI * 2, 0, 0.75),
    new THREE.MeshStandardMaterial({ color: 0x2f88b5, roughness: 0.3, emissive: 0x0b2c44, emissiveIntensity: 0.4 })
  );
  sea.quaternion.setFromUnitVectors(UP, new THREE.Vector3(0.8, -0.35, 0.5).normalize());
  sea.userData.noDrape = true;
  g.add(sea);
  return g;
}

// ---------------------------------------------------------------------------
// Observatoire de Meudon : Château-Neuf de Mansart (1706), surmonté de la Grande Coupole (18,5 m, 1895)
// sur un haut tambour, terrasse à balustrade, petites coupoles, forêt de Meudon.
// ---------------------------------------------------------------------------
export function observatoireMeudon() {
  const g = new THREE.Group();
  const c = structure(g, 0, 0.2);
  wing(c, { len: 2.8, depth: 0.62, h: 0.72, floors: 2, wall: 0xe8dec8, roofH: 0.26, dormersN: 0 });
  box(c, 0.9, 0.8, 0.7, mat(0xefe6d2), 0, 0, 0.02);
  pediment(c, 0.92, 0.16, 0.06, 0xefe6d2, 0, 0.8, 0.31);
  // Tambour et Grande Coupole
  cyl(c, 0.6, 0.62, 0.48, 36, mat(0xe6dcc6), 0, 0.8, 0);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const w = add(c, new THREE.BoxGeometry(0.06, 0.13, 0.02), glow(LIT, 1.2), Math.sin(a) * 0.605, 1.03, Math.cos(a) * 0.605);
    w.rotation.y = a;
  }
  cyl(c, 0.66, 0.66, 0.05, 36, mat(0xf2ebdc), 0, 1.28, 0);
  const domeMat = new THREE.MeshStandardMaterial({ color: 0x9aa4ad, metalness: 0.5, roughness: 0.5, flatShading: true });
  add(c, new THREE.SphereGeometry(0.64, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), domeMat, 0, 1.33, 0);
  // Trappe d'observation
  add(c, new THREE.SphereGeometry(0.646, 6, 10, -0.12, 0.24, 0.05, Math.PI / 2 - 0.05), mat(0x15181c), 0, 1.33, 0);
  add(c, new THREE.SphereGeometry(0.05, 8, 6), mat(0x8e98a1), 0, 1.97, 0);
  // Terrasse à balustrade
  const t = structure(g, 0, 1.15);
  box(t, 2.6, 0.06, 0.5, mat(0xd8cfbd), 0, 0, 0);
  for (let i = 0; i < 26; i++) cyl(t, 0.012, 0.012, 0.08, 5, mat(0xefe7d6), -1.25 + i * 0.1, 0.06, 0.23);
  box(t, 2.6, 0.02, 0.03, mat(0xefe7d6), 0, 0.14, 0.23);
  // Petites coupoles (télescope de 1 m, lunette photographique)
  for (const [x, z] of [[-1.45, -0.7], [1.4, -0.75]]) {
    const s = structure(g, x, z);
    box(s, 0.42, 0.32, 0.42, mat(0xe6dcc6), 0, 0, 0);
    cyl(s, 0.2, 0.2, 0.06, 16, mat(0xe6dcc6), 0, 0.32, 0);
    add(s, new THREE.SphereGeometry(0.21, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf4f4f0), 0, 0.38, 0);
  }
  for (const [x, z, s] of [[-1.75, 0.3, 1.2], [-1.1, -1.3, 1.1], [0.2, -1.4, 1], [1.0, -1.3, 1.15], [1.8, 0.35, 1.2], [-0.6, -1.1, 0.9]]) tree(structure(g, x, z, 0, false), 0, 0, 0, s, 0x3c6634);
  return g;
}

// ---------------------------------------------------------------------------
// Enedis Data Challenge : pylônes électriques, câbles, données mesurées et reconstituées
// ---------------------------------------------------------------------------
export function enedisPylon() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa4ad, metalness: 0.6, roughness: 0.45, flatShading: true });
  const ends = [];
  const build = (x, z, s) => {
    const p = structure(g, x, z, 0, false);
    p.scale.setScalar(s);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const leg = add(p, new THREE.CylinderGeometry(0.02, 0.03, 1.7, 4), steel, sx * 0.13, 0.82, sz * 0.13);
      leg.rotation.set(sz * -0.1, 0, sx * 0.1);
    }
    for (let i = 0; i < 4; i++) box(p, 0.42 - i * 0.07, 0.025, 0.42 - i * 0.07, steel, 0, 0.3 + i * 0.38, 0);
    box(p, 1.1, 0.04, 0.06, steel, 0, 1.25, 0);
    box(p, 0.8, 0.04, 0.06, steel, 0, 1.55, 0);
    const pts = [];
    for (const [x2, y2] of [[-0.52, 1.2], [0.52, 1.2], [-0.38, 1.5], [0.38, 1.5]]) {
      add(p, new THREE.SphereGeometry(0.03, 6, 6), glow(0x7dffc8, 2.5), x2, y2, 0);
      const o = new THREE.Object3D(); o.position.set(x2, y2, 0); p.add(o); pts.push(o);
    }
    ends.push(pts);
  };
  build(-0.8, 0.1, 1);
  build(0.95, -0.25, 0.8);
  // Câbles et données, calculés après le drapé à partir des extrémités des consoles
  g.userData.afterDrape = (grp) => {
    grp.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(grp.matrixWorld).invert();
    const P = (o) => o.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    const cable = new THREE.LineBasicMaterial({ color: 0x2a2f36 });
    const wires = new THREE.Group(); wires.userData.noDrape = true; grp.add(wires);
    for (let i = 0; i < 4; i++) {
      const a = P(ends[0][i]), b = P(ends[1][i]);
      const m = a.clone().lerp(b, 0.5); m.y -= 0.12;
      wires.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(a, m, b).getPoints(16)), cable));
    }
    const rnd = mulberry32(9);
    const cubeGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
    const known = glow(0x7dffc8, 2.2), filled = glow(0xffb35a, 2.6);
    const a = P(ends[0][2]), b = P(ends[1][3]);
    for (let i = 0; i < 26; i++) {
      const t = i / 25;
      const p = a.clone().lerp(b, t);
      p.y += 0.55 + Math.sin(t * 9) * 0.15 + (rnd() - 0.5) * 0.05;
      p.z += 0.35;
      add(wires, cubeGeo, i % 5 === 2 || i % 7 === 4 ? filled : known, p.x, p.y, p.z);
    }
  };
  return g;
}
