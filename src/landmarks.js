// Lunes-monuments : les lieux d'études et l'observatoire de Meudon, posés sur un sol sphérique.
// Chaque bâtiment est construit à plat dans un « structure() », puis drapé sur la lune :
// il suit la normale de la sphère, et des fondations comblent l'écart dû à la courbure.
// Les bâtiments sont creux et aménagés (portes, escaliers, planchers, mobilier) : on peut y entrer à pied.
import * as THREE from 'three';
import {
  mulberry32, fbm3, mat, glow, add, box, cyl, cone, gableRoof, mansardRoof, tree, pine,
  grandPiano, glenoidImplant,
} from './models.js';
import { Kit, kitOf, hollow, faceBands, facadeWindows, M } from './kit.js';

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
// Arbre avec tronc infranchissable
function treeAt(g, x, z, s = 1, color = 0x4c7a3d) {
  const t = structure(g, x, z, 0, false);
  tree(t, 0, 0, 0, s, color);
  t.userData.colliders = { boxes: [], cyls: [[0, 0, 0.035 * s, -0.05, 0.3 * s]], rings: [] };
  return t;
}

// Aile de bâtiment classique, longueur selon X local, façade principale vers +Z.
// Creuse : portes au centre des deux façades, escaliers, planchers, salles meublées.
function wing(s, { len, depth, h, floors, wall = C.stone, roof = C.slate, roofH = 0.3, mansard = true, dormersN = 0, x = 0, z = 0, lit = true, furnish = 'school', doors = { '+z': 0, '-z': 0 }, seed = 1 }) {
  const k = kitOf(s);
  hollow(k, { w: len, d: depth, h, x, z, floors, wall, doors, furnish, seed, inner: 0xf1e9d8 });
  // Corniche
  faceBands(k, len, depth, x, z, h - 0.035, 0.035, 0xf6f0e2, { out: 0.012 });
  if (mansard) mansardRoof(s, len, roofH, depth, mat(roof), x, h, z);
  else gableRoof(s, len, roofH, depth, mat(roof), x, h, z);
  // Fenêtres éclairées (sauf au droit des portes)
  const fh = h / floors, cols = Math.max(2, Math.round(len / 0.19));
  const skip = (side) => (a, f) => f === 0 && doors[side] !== undefined && Math.abs(a - doors[side]) < 0.09;
  facadeWindows(k, { w: len - 0.12, x, z: z + depth / 2, y0: 0, floors, fh, cols, side: 1, ww: 0.065, wh: fh * 0.45, lit: lit ? LIT : 0x2a2f38, skip: skip('+z') });
  facadeWindows(k, { w: len - 0.12, x, z: z - depth / 2, y0: 0, floors, fh, cols, side: -1, ww: 0.065, wh: fh * 0.45, lit: lit ? LIT : 0x2a2f38, skip: skip('-z') });
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
// Avant-corps en saillie devant une façade : un porche creux qui s'ouvre sur la porte de l'aile
function porch(s, { w, d, h, z, wall, doorW = 0.12, doorH = 0.22, furnish = 'none' }) {
  hollow(kitOf(s), { w, d, h, x: 0, z, floors: 1, wall, open: ['-z'], doors: { '+z': 0 }, doorW, doorH, furnish, lamps: true });
}
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
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(R + lift, seg, 2, 0, Math.PI * 2, t1, t2 - t1),
    new THREE.MeshStandardMaterial({ color, roughness: 1 })
  );
  m.userData.terrain = true;
  return m;
}

// ---------------------------------------------------------------------------
// Drapé sur la sphère
// ---------------------------------------------------------------------------
const tmpBox = new THREE.Box3();
const plinthMat = mat(0x9d927f);
function drape(group, R) {
  for (const c of [...group.children]) {
    if (c.userData.noDrape) continue;
    // Les bâtiments du kit sont assemblés avant de mesurer leur emprise
    if (c.userData.kit) { c.userData.kit.build(c); delete c.userData.kit; }
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
      const x0 = tmpBox.min.x - 0.03, x1 = tmpBox.max.x + 0.03, z0 = tmpBox.min.z - 0.03, z1 = tmpBox.max.z + 0.03;
      const k = new Kit();
      // Socle praticable : son dessus prolonge le sol des bâtiments, ses flancs plongent dans la lune
      k.box(x1 - x0, sag + 0.01, z1 - z0, (x0 + x1) / 2, -sag, (z0 + z1) / 2, 0x9d927f);
      // Perrons : marches qui descendent de chaque porte jusqu'au sol
      for (const d of c.userData.doors || []) {
        if (Math.abs(d.y) > 1e-3) continue;
        const ox = d.x + d.nx * 0.03, oz = d.z + d.nz * 0.03;
        // Sol de la lune sous le plan tangent du bâtiment : y ≈ 0,007 − ρ² / 2R
        const ex = ox + d.nx * M(1.5), ez = oz + d.nz * M(1.5);
        const drop = 0.003 + (ex * ex + ez * ez) / (2 * R);
        const rise = M(0.18), run = M(0.32);
        const n = Math.ceil(drop / rise);
        if (n <= 1) continue;
        for (let i = 0; i < n; i++) {
          const top = 0.01 - ((i + 1) * drop) / n;
          const e = i * run + run / 2;
          const sx = ox + d.nx * e, sz = oz + d.nz * e;
          const ww = d.w + M(1.2);
          if (d.nx) k.box(run, 0.12, ww, sx, top - 0.12, sz, 0xb8ad98);
          else k.box(ww, 0.12, run, sx, top - 0.12, sz, 0xb8ad98);
        }
      }
      k.build(c);
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
  const m = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  m.userData.terrain = true;
  return m;
}


// Assemble lune + pelouse + monument drapé (le reste de la lune est peuplé ensuite, voir cover.js)
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
  lawn.userData.terrain = true;
  moon.add(lawn);
  const lm = landmark(radius);
  drape(lm, radius);
  moon.add(lm);
  moon.userData.topY = radius;
  moon.userData.cap = cap;
  return moon;
}

// ---------------------------------------------------------------------------
// Lycée Pierre Corneille, Rouen
// Ailes classiques en pierre autour d'une cour d'honneur, toits d'ardoise à lucarnes,
// chapelle Saint-Louis à façade blanche (deux ordres, baie en plein cintre, fronton, statues, escalier).
// ---------------------------------------------------------------------------
export function lyceeCorneille(R = 4) {
  const g = new THREE.Group();
  // Cour d'honneur gravillonnée, qui épouse la sphère
  const court = sphereBand(R, 0, 0.75, 0xd9cfba, 0.004);
  court.userData.noDrape = true;
  g.add(court);
  // Cour d'honneur fermée sur trois côtés par les ailes des XVIIe-XVIIIe siècles, portail baroque au sud
  const main = wing(structure(g, 0, -0.85), { len: 2.3, depth: 0.5, h: 0.82, floors: 3, dormersN: 8, furnish: 'school', seed: 2 });
  wing(structure(g, 1.0, -0.05, Math.PI / 2), { len: 1.3, depth: 0.48, h: 0.82, floors: 3, dormersN: 4, furnish: 'library', seed: 3 });
  wing(structure(g, -1.0, -0.05, Math.PI / 2), { len: 1.3, depth: 0.48, h: 0.82, floors: 3, dormersN: 4, furnish: 'school', seed: 4 });
  // Portail d'entrée (rue du Maulévrier) : piliers à bossages, arc, fronton brisé, grille ouverte, mur de clôture
  const pt = structure(g, 0, 0.98);
  const kp = kitOf(pt);
  for (const sx of [-1, 1]) {
    kp.box(0.1, 0.42, 0.12, sx * 0.13, 0, 0, C.stoneLight);
    for (let i = 0; i < 4; i++) kp.box(0.112, 0.03, 0.13, sx * 0.13, 0.05 + i * 0.1, 0, 0xd8ccb2, { collide: false });
    kp.box(0.55, 0.26, 0.06, sx * 0.47, 0, 0, C.stone);
    kp.box(0.55, 0.03, 0.08, sx * 0.47, 0.26, 0, C.stoneLight, { collide: false });
    kp.box(0.008, 0.2, 0.08, sx * 0.08, 0, 0.09, 0x2b2b2b, { collide: false, rotY: sx * 0.7 });
  }
  kp.box(0.36, 0.08, 0.13, 0, 0.42, 0, C.stoneLight);
  for (const sx of [-1, 1]) kp.box(0.12, 0.03, 0.12, sx * 0.12, 0.52, 0, C.stoneLight, { collide: false, rotZ: -sx * 0.45 });
  kp.box(0.06, 0.08, 0.06, 0, 0.5, 0, C.white, { collide: false });
  // Cheminées
  for (const x of [-0.9, 0, 0.9]) box(main, 0.08, 0.2, 0.08, mat(0xb9ad95), x, 1.0, 0);
  // Petite cour des cuisines derrière l'aile ouest
  const cuis = sphereBand(R, 0, 0.12, 0xcfc4ad, 0.0042);
  cuis.quaternion.setFromUnitVectors(UP, new THREE.Vector3(-1.05, R, -1.05).normalize());
  cuis.userData.noDrape = true; g.add(cuis);

  // Chapelle Saint-Louis (façade au sud, vers +Z) : nef creuse avec bancs et autel
  const ch = structure(g, -1.75, 0.3);
  const k = kitOf(ch);
  hollow(k, { w: 0.56, d: 1.3, h: 1.05, x: 0, z: -0.1, floors: 1, wall: C.stone, inner: 0xf4efe4, open: ['+z'], doors: {}, furnish: 'church', floorCol: 0xb9a888, seed: 5 });
  gableRoof(ch, 1.3, 0.42, 0.56, mat(C.slate), 0, 1.05, -0.1).rotation.y = Math.PI / 2;
  for (const zz of [-0.55, -0.2, 0.15]) for (const sx of [1, -1]) {
    const side = new THREE.Group(); side.position.set(sx * 0.285, 0, zz); side.rotation.y = sx * Math.PI / 2; ch.add(side);
    arch(side, 0.1, 0.35, mat(0x2b3240), 0, 0.45, 0);
  }
  // Plan hybride gothique et classique : contreforts massifs, transept saillant, chœur à abside
  for (const zz of [-0.37, -0.03, 0.33]) for (const sx of [1, -1]) k.box(0.08, 0.82, 0.1, sx * 0.32, 0, zz, C.stone);
  for (const sx of [1, -1]) {
    k.box(0.22, 0.95, 0.34, sx * 0.39, 0, -0.62, C.stone);
    gableRoof(ch, 0.34, 0.2, 0.22, mat(C.slate), sx * 0.39, 0.95, -0.62).rotation.y = Math.PI / 2;
    const tw = new THREE.Group(); tw.position.set(sx * 0.505, 0, -0.62); tw.rotation.y = sx * Math.PI / 2; ch.add(tw);
    arch(tw, 0.1, 0.3, mat(0x2b3240), 0, 0.45, 0);
  }
  add(ch, new THREE.CylinderGeometry(0.27, 0.27, 0.9, 16, 1, false, Math.PI / 2, Math.PI), mat(C.stone), 0, 0.45, -0.75);
  add(ch, new THREE.ConeGeometry(0.29, 0.3, 16, 1, false, Math.PI / 2, Math.PI), mat(C.slate), 0, 1.05, -0.75);
  k.cyls.push([0, -0.82, 0.2, 0, 0.9]);
  const F = 0.57; // plan de la façade
  // Façade basse percée d'une grande porte en plein cintre
  const DW = 0.14, DH = 0.26;
  k.box((0.8 - DW) / 2, 0.72, 0.1, -(0.8 + DW) / 4, 0, F, C.white);
  k.box((0.8 - DW) / 2, 0.72, 0.1, (0.8 + DW) / 4, 0, F, C.white);
  k.box(DW, 0.72 - DH, 0.1, 0, DH, F, C.white);
  add(ch, new THREE.CylinderGeometry(DW / 2, DW / 2, 0.02, 12, 1, false, -Math.PI / 2, Math.PI), mat(0x3b2b20), 0, DH, F + 0.051, [Math.PI / 2, 0, 0]);
  box(ch, 0.84, 0.06, 0.13, mat(C.stoneLight), 0, 0.72, F);
  for (const x of [-0.33, -0.18, 0.18, 0.33]) cyl(ch, 0.028, 0.03, 0.66, 10, mat(0xfbf7ee), x, 0.02, F + 0.07);
  box(ch, 0.5, 0.45, 0.1, mat(C.white), 0, 0.78, F);
  for (const x of [-0.2, 0.2]) cyl(ch, 0.022, 0.025, 0.4, 10, mat(0xfbf7ee), x, 0.8, F + 0.07);
  arch(ch, 0.16, 0.3, glow(0xffcf8a, 1.0), 0, 0.84, F + 0.06);
  for (const sx of [1, -1]) {
    const v = add(ch, new THREE.CylinderGeometry(0.15, 0.15, 0.08, 12, 1, false, 0, Math.PI / 2), mat(C.white), sx * 0.25, 0.78, F);
    v.rotation.set(Math.PI / 2, 0, sx > 0 ? 0 : -Math.PI / 2);
  }
  box(ch, 0.54, 0.05, 0.13, mat(C.stoneLight), 0, 1.23, F);
  pediment(ch, 0.56, 0.2, 0.1, C.white, 0, 1.28, F - 0.05);
  for (const [x, y] of [[-0.34, 0.78], [0.34, 0.78], [-0.22, 1.28], [0.22, 1.28]]) statue(ch, x, y, F + 0.02, 0xf4efe4, 0.9);
  // Seuil ; l'escalier monumental est le perron généré au drapé
  k.box(DW, 0.012, 0.12, 0, 0, F, 0xb9a888);
  ch.userData.doors = [{ x: 0, z: F + 0.05, nx: 0, nz: 1, w: 0.5, y: 0 }];

  // Statue de Pierre Corneille dans la cour
  const st = structure(g, 0.15, 0.1);
  kitOf(st).box(0.16, 0.16, 0.16, 0, 0, 0, 0xd4cab5);
  statue(st, 0, 0.16, 0, C.bronze, 1.6);
  for (const [x, z, s] of [[1.75, 0.9, 1.2], [0.7, 1.25, 1], [-0.45, 1.3, 1.1], [1.8, -1.0, 1.1], [-1.3, -1.1, 1]]) treeAt(g, x, z, s, 0x4c7a3d);
  return g;
}

// ---------------------------------------------------------------------------
// Abbaye de Cluny
// Transept sud de Cluny III et clocher octogonal de l'Eau-Bénite (deux registres d'arcades, flèche),
// tour carrée de l'Horloge, absidiole, et bâtiments conventuels du XVIIIe siècle où loge Arts et Métiers.
// ---------------------------------------------------------------------------
export function abbayeCluny(R = 4) {
  const g = new THREE.Group();
  const stone = mat(C.stoneWarm), dark = mat(0x221d18);
  // Bras sud du grand transept, orienté nord-sud ; le cloître et les bâtiments du XVIIIe s. sont à l'est
  const t = structure(g, -1.05, -0.35, Math.PI / 2);
  hollow(kitOf(t), { w: 1.9, d: 0.62, h: 1.5, floors: 1, wall: C.stoneWarm, inner: 0xe8dcc0, doors: { '+z': 0.225 }, doorW: 0.1, doorH: 0.2, furnish: 'church', floorCol: 0xb5a180, seed: 6 });
  gableRoof(t, 1.9, 0.48, 0.62, mat(C.tile), 0, 1.5, 0);
  // Contreforts et baies romanes
  for (const x of [-0.9, -0.45, 0, 0.45, 0.9]) for (const sz of [1, -1]) kitOf(t).box(0.09, 1.15, 0.1, x, 0, sz * 0.34, C.stoneWarm);
  for (const x of [-0.68, -0.22, 0.22, 0.68]) for (const sz of [1, -1]) {
    arch(t, 0.12, 0.3, dark, x, 0.35, sz * 0.315);
    arch(t, 0.1, 0.24, dark, x, 0.95, sz * 0.315);
  }
  add(t, new THREE.CylinderGeometry(0.26, 0.26, 0.75, 14, 1, false, Math.PI / 2, Math.PI), stone, 0.55, 0.375, -0.31);
  add(t, new THREE.ConeGeometry(0.28, 0.25, 14, 1, false, Math.PI / 2, Math.PI), mat(C.tile), 0.55, 0.875, -0.31);
  // Clocher de l'Eau-Bénite
  const c = new THREE.Group(); c.position.set(0.1, 1.5, 0); t.add(c);
  box(c, 0.66, 0.62, 0.66, stone, 0, 0, 0);
  for (const [y, h, r] of [[0.62, 0.44, 0.38], [1.12, 0.4, 0.34]]) {
    cyl(c, r + 0.04, r + 0.04, 0.05, 8, mat(0xe2d2b2), 0, y - 0.05, 0);
    cyl(c, r, r, h, 8, stone, 0, y, 0);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const face = new THREE.Group(); face.position.set(Math.sin(a) * r * 0.93, y, Math.cos(a) * r * 0.93); face.rotation.y = a; c.add(face);
      arch(face, 0.07, h * 0.62, dark, -0.045, h * 0.18, 0.005);
      arch(face, 0.07, h * 0.62, dark, 0.045, h * 0.18, 0.005);
      cyl(c, 0.018, 0.018, h, 6, mat(0xe8dcc0), Math.sin(a + Math.PI / 8) * r, y, Math.cos(a + Math.PI / 8) * r);
    }
  }
  cyl(c, 0.38, 0.38, 0.05, 8, mat(0xe2d2b2), 0, 1.52, 0);
  cone(c, 0.37, 0.95, 8, mat(0x6b6a6c), 0, 1.57, 0);
  add(c, new THREE.SphereGeometry(0.03, 6, 5), mat(C.gold), 0, 2.55, 0);
  // Tour de l'Horloge : escalier à vis jusqu'à la salle du mécanisme
  const h = structure(g, -1.62, -0.15);
  const kh = kitOf(h);
  hollow(kh, { w: 0.42, d: 0.42, h: 1.75, floors: 2, stair: 'spiral', wall: C.stoneWarm, inner: 0xe0d2b4, furnish: 'observatory', seed: 7 });
  for (const y of [0.5, 1.0]) faceBands(kh, 0.42, 0.42, 0, 0, y, 0.03, 0xe2d2b2, { out: 0.01, gap: { x0: -0.06, x1: 0.06, y1: 0.16 } });
  for (const sz of [1, -1]) for (const y of [0.35, 0.7]) box(h, 0.05, 0.16, 0.02, dark, 0, y, sz * 0.215);
  add(h, new THREE.CylinderGeometry(0.1, 0.1, 0.02, 20), glow(0xffe6b0, 1.2), 0, 1.45, 0.22, [Math.PI / 2, 0, 0]);
  cone(h, 0.33, 0.5, 4, mat(C.tile), 0, 1.75, 0, [0, Math.PI / 4, 0]);
  // Bâtiments conventuels XVIIIe (campus Arts et Métiers) : quadrilatère autour du cloître,
  // façade principale au sud avec pavillon central à fronton
  const cv = structure(g, 0.55, 0.95);
  wing(cv, { len: 1.7, depth: 0.45, h: 0.72, floors: 3, wall: C.stoneLight, dormersN: 6, furnish: 'workshop', seed: 8 });
  porch(cv, { w: 0.5, d: 0.16, h: 0.8, z: 0.305, wall: 0xf2ebdc });
  pediment(cv, 0.52, 0.16, 0.06, 0xf2ebdc, 0, 0.8, 0.33);
  wing(structure(g, 0.55, -0.6), { len: 1.7, depth: 0.45, h: 0.72, floors: 3, wall: C.stoneLight, dormersN: 6, furnish: 'school', seed: 26 });
  wing(structure(g, 1.4, 0.17, Math.PI / 2), { len: 0.85, depth: 0.45, h: 0.72, floors: 3, wall: C.stoneLight, dormersN: 3, furnish: 'library', seed: 27 });
  wing(structure(g, -0.3, 0.17, -Math.PI / 2), { len: 0.85, depth: 0.45, h: 0.72, floors: 3, wall: C.stoneLight, dormersN: 3, furnish: 'school', seed: 28 });
  // Préau du cloître : pelouse, allées en croix, puits
  const garth = sphereBand(R, 0, 0.115, 0x86a85e, 0.0042);
  garth.quaternion.setFromUnitVectors(UP, new THREE.Vector3(0.55, R, 0.17).normalize());
  garth.userData.noDrape = true; g.add(garth);
  const cl = structure(g, 0.55, 0.17, 0, false);
  box(cl, 0.9, 0.006, 0.07, mat(0xd8cdb4), 0, 0.004, 0);
  box(cl, 0.07, 0.006, 0.8, mat(0xd8cdb4), 0, 0.004, 0);
  cyl(cl, 0.06, 0.06, 0.06, 12, mat(0xc8b894), 0, 0, 0);
  cl.userData.colliders = { boxes: [], cyls: [[0, 0, 0.06, -0.02, 0.06]], rings: [] };
  // Tours Barabans : bases des deux tours de l'ancien narthex
  for (const [x, z] of [[-1.62, -1.45], [-0.95, -1.62]]) {
    const b = structure(g, x, z);
    kitOf(b).box(0.3, 0.55, 0.3, 0, 0, 0, C.stoneWarm);
    box(b, 0.32, 0.04, 0.32, mat(0xe2d2b2), 0, 0.55, 0);
    arch(b, 0.08, 0.2, dark, 0, 0.2, 0.152);
  }
  // Palais Jean de Bourbon (XVe s., musée) : logis gothique à haute toiture et tourelle d'escalier
  const pj = structure(g, -0.25, 1.7, 0.15);
  hollow(kitOf(pj), { w: 0.7, d: 0.4, h: 0.5, floors: 2, wall: 0xd9c49c, inner: 0xeee2c8, doors: { '+z': 0.15 }, furnish: 'library', seed: 29 });
  gableRoof(pj, 0.7, 0.36, 0.4, mat(C.tile), 0, 0.5, 0);
  cyl(pj, 0.09, 0.09, 0.7, 10, mat(0xd2bc94), -0.36, 0, 0.2);
  cone(pj, 0.11, 0.22, 10, mat(C.tile), -0.36, 0.7, 0.2);
  // Farinier (XIIIe s.) et tour du Moulin : long bâtiment bas sous une très haute toiture de tuiles
  const tm = structure(g, -1.78, 1.05);
  kitOf(tm).box(0.26, 0.7, 0.26, 0, 0, 0, C.stoneWarm);
  cone(tm, 0.22, 0.2, 4, mat(C.tile), 0, 0.7, 0, [0, Math.PI / 4, 0]);
  const fa = structure(g, -1.05, 1.05);
  hollow(kitOf(fa), { w: 1.1, d: 0.42, h: 0.42, floors: 1, wall: C.stoneWarm, inner: 0xd8c8a6, doors: { '+z': 0.1 }, furnish: 'hall', seed: 9 });
  gableRoof(fa, 1.1, 0.42, 0.42, mat(C.tile), 0, 0.42, 0);
  for (const x of [-0.4, -0.2, 0, 0.2, 0.4]) kitOf(fa).box(0.07, 0.36, 0.06, x, 0, 0.24, C.stoneWarm);
  // Tour des Fromages : tour carrée élancée, escalier à vis
  const tf = structure(g, 1.55, -1.25);
  hollow(kitOf(tf), { w: 0.32, d: 0.32, h: 1.25, floors: 2, stair: 'spiral', wall: C.stoneWarm, inner: 0xe0d2b4, furnish: 'none', seed: 10, doorW: 0.09 });
  for (const y of [0.45, 0.85]) box(tf, 0.05, 0.12, 0.02, dark, 0, y, 0.165);
  box(tf, 0.36, 0.05, 0.36, mat(0xe2d2b2), 0, 1.25, 0);
  cone(tf, 0.25, 0.25, 4, mat(C.tile), 0, 1.3, 0, [0, Math.PI / 4, 0]);
  for (const [x, z, s] of [[0.2, -1.35, 1.2], [1.9, 0.5, 1.1], [0.8, 1.7, 1.0], [1.7, 1.2, 1.0]]) treeAt(g, x, z, s, 0x4f7c3f);
  return g;
}

// ---------------------------------------------------------------------------
// Arts et Métiers, campus de Paris (151 bd de l'Hôpital, Georges Roussi, 1912)
// Façade en pierre de quatre niveaux sous toit de zinc, avant-corps central à grande porte cintrée,
// halles technologiques en brique polychrome (grande baie centrale, toits en sheds), boulevard arboré.
// ---------------------------------------------------------------------------
export function ensamParis(R = 4) {
  const g = new THREE.Group();
  // Façade sur le boulevard de l'Hôpital, cour intérieure pavée bordée d'ailes, halles au fond
  const court = sphereBand(R, 0, 0.17, 0xcfc6b4, 0.0042);
  court.quaternion.setFromUnitVectors(UP, new THREE.Vector3(0, R, 0.38).normalize());
  court.userData.noDrape = true; g.add(court);
  for (const sx of [-1, 1]) wing(structure(g, sx * 1.6, 0.05, sx * Math.PI / 2), { len: 1.4, depth: 0.42, h: 0.8, floors: 3, wall: 0xe2d6bd, roof: C.zinc, roofH: 0.24, dormersN: 4, furnish: sx > 0 ? 'lab' : 'office', seed: 30 + sx });
  const f = structure(g, 0, 0.95);
  wing(f, { len: 2.9, depth: 0.45, h: 0.95, floors: 4, wall: 0xe8ddc5, roof: C.zinc, roofH: 0.28, dormersN: 10, furnish: 'school', seed: 11 });
  // Avant-corps : porche creux, grande porte cintrée
  porch(f, { w: 0.72, d: 0.18, h: 1.12, z: 0.315, wall: 0xf0e7d3, doorW: 0.15, doorH: 0.28 });
  for (const x of [-0.28, -0.12, 0.12, 0.28]) box(f, 0.05, 0.85, 0.03, mat(0xf8f2e4), x, 0.12, 0.42);
  arch(f, 0.26, 0.2, glow(0xffc77d, 1.0), 0, 0.3, 0.41);
  const sign = textPlane('ARTS ET MÉTIERS', 0.64, 0.09, { color: '#3a2a1c' });
  sign.position.set(0, 1.02, 0.41); f.add(sign);
  mansardRoof(f, 0.72, 0.34, 0.2, mat(C.zinc), 0, 1.12, 0.315);
  cyl(f, 0.008, 0.008, 0.4, 5, mat(0x333333), 0, 1.45, 0.315);
  [0x1f3a93, 0xf5f5f5, 0xd62828].forEach((col, i) => box(f, 0.06, 0.11, 0.008, mat(col), 0.035 + i * 0.06, 1.72, 0.315));
  // Halles technologiques : ateliers creux, machines-outils
  const brick = mat(C.brick), glass = glow(0x9fd0ff, 0.6);
  [-0.95, 0, 0.95].forEach((x, i) => {
    const hl = structure(g, x, -0.5);
    const k = kitOf(hl);
    hollow(k, { w: 0.78, d: 1.0, h: 0.6, floors: 1, wall: C.brick, inner: 0xd9c9b0, doors: { '-z': 0, '+z': 0 }, doorW: 0.12, doorH: 0.17, furnish: 'workshop', floorCol: 0x8a8a86, seed: 12 + i });
    for (let q = 0; q < 4; q++) faceBands(k, 0.78, 1.0, 0, 0, 0.12 + q * 0.13, 0.04, q % 2 ? C.brick : C.brick2, { out: 0.008, gap: { x0: -0.08, x1: 0.08, y1: 0.18 } });
    for (let q = 0; q < 4; q++) {
      const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.25, 0); sh.lineTo(0, 0.16); sh.closePath();
      const m = add(hl, new THREE.ExtrudeGeometry(sh, { depth: 0.78, bevelEnabled: false }), mat(0x6f6a66), -0.39, 0.6, -0.25 + q * 0.25);
      m.rotation.y = Math.PI / 2;
      box(hl, 0.76, 0.15, 0.01, glass, 0, 0.6, -0.25 + q * 0.25 + 0.005);
    }
    arch(hl, 0.24, 0.3, glass, 0, 0.2, -0.515);
    arch(hl, 0.1, 0.3, glass, -0.24, 0.06, -0.515);
    arch(hl, 0.1, 0.3, glass, 0.24, 0.06, -0.515);
    if (i === 1) box(hl, 0.3, 0.06, 0.06, mat(0x2b2b2b), 0, 0.6, -0.53);
  });
  for (let i = 0; i < 7; i++) treeAt(g, -1.5 + i * 0.5, 1.62, 1.05, 0x5b8a45);
  // Tour Eiffel, au loin sur la lune
  const e = structure(g, -1.7, -1.35, 0.4, false);
  e.scale.setScalar(0.85);
  const iron = mat(0x6e4f39);
  const legs = [];
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const leg = add(e, new THREE.CylinderGeometry(0.03, 0.06, 0.6, 4), iron, sx * 0.17, 0.27, sz * 0.17);
    leg.rotation.set(sz * -0.32, 0, sx * 0.32);
    legs.push([sx * 0.26, sz * 0.26, 0.06, -0.05, 0.3]);
  }
  e.userData.colliders = { boxes: [], cyls: legs, rings: [] };
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
  const accent = 0xe07a3a;
  const a = structure(g, -0.35, -0.35);
  const ka = kitOf(a);
  hollow(ka, { w: 1.3, d: 0.55, h: 0.62, floors: 3, wall: 0xeceae4, inner: 0xf4f2ec, doors: { '+z': 0.075, '-z': 0 }, furnish: 'office', floorCol: 0xb8b2a6, seed: 13 });
  for (let i = 0; i < 3; i++) faceBands(ka, 1.3, 0.55, 0, 0, 0.16 + i * 0.18, 0.08, 0x8cc7ff, { out: 0.006, glow: true });
  for (let i = 0; i < 9; i++) ka.box(0.03, 0.6, 0.06, -0.6 + i * 0.15, 0, 0.3, accent);
  const b = structure(g, 0.6, -0.45);
  const kb = kitOf(b);
  hollow(kb, { w: 0.5, d: 0.5, h: 1.05, floors: 2, stair: 'spiral', wall: 0xeceae4, inner: 0xf4f2ec, furnish: 'office', floorCol: 0xb8b2a6, seed: 14 });
  for (let i = 0; i < 4; i++) faceBands(kb, 0.5, 0.5, 0, 0, 0.18 + i * 0.22, 0.09, 0x8cc7ff, { out: 0.006, glow: true });
  kb.box(0.54, 0.05, 0.54, 0, 1.05, 0, 0x9aa3ad);
  const lib = structure(g, -0.25, 0.45);
  const kl = kitOf(lib);
  hollow(kl, { w: 0.9, d: 0.5, h: 0.35, floors: 1, wall: 0xeceae4, inner: 0xf4f2ec, doors: { '+z': 0 }, furnish: 'library', seed: 15 });
  kl.box(0.3, 0.14, 0.006, -0.28, 0.16, 0.253, 0x8cc7ff, { glow: true });
  kl.box(0.3, 0.14, 0.006, 0.28, 0.16, 0.253, 0x8cc7ff, { glow: true });
  kl.box(0.92, 0.04, 0.52, 0, 0.35, 0, 0x6d9a4e);
  for (const [x, z] of [[0.55, 0.5], [0.85, 0.15], [-0.9, 0.75]]) treeAt(g, x, z, 0.95, 0x557f42);

  // Circuit : bande d'asphalte qui épouse la sphère, bordée de lignes blanches
  const track = new THREE.Group(); track.userData.noDrape = true; g.add(track);
  track.add(sphereBand(R, 1.42, 1.66, 0x2c2c31, 0.008));
  track.add(sphereBand(R, 1.4, 1.43, 0xe9e2d0, 0.009));
  track.add(sphereBand(R, 1.65, 1.68, 0xd8342c, 0.009));
  // Passerelle Dunlop (arche en forme de pneu) et voiture
  const dun = structure(g, 1.54, 0, 0, false);
  add(dun, new THREE.TorusGeometry(0.34, 0.07, 10, 28, Math.PI), mat(0x1b1b1d), 0, 0, 0);
  dun.userData.colliders = { boxes: [], cyls: [[0.34, 0, 0.07, -0.05, 0.25], [-0.34, 0, 0.07, -0.05, 0.25]], rings: [] };
  const label = textPlane('DUNLOP', 0.34, 0.07, { color: '#1b1b1d', bg: '#f2c618' });
  label.position.set(0, 0.36, 0.075); dun.add(label);
  const label2 = label.clone(); label2.rotation.y = Math.PI; label2.position.z = -0.075; dun.add(label2);
  const car = structure(g, -1.05, 1.13, -Math.PI / 4, false);
  box(car, 0.24, 0.06, 0.11, mat(0xd8342c), 0, 0.01, 0);
  box(car, 0.1, 0.05, 0.09, mat(0x1b2733), -0.02, 0.07, 0);
  box(car, 0.04, 0.02, 0.13, mat(0x111111), -0.12, 0.09, 0);
  for (const sz of [1, -1]) add(car, new THREE.SphereGeometry(0.018, 6, 6), glow(0xfff2c0, 4), 0.125, 0.04, sz * 0.035);
  car.userData.colliders = { boxes: [], cyls: [[0, 0, 0.1, -0.02, 0.1]], rings: [] };
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
  // Colline calcaire, assez douce pour y monter à pied
  const hill = structure(g, 0.4, -0.35, 0, false);
  const HT = 0.62;
  const hm = cyl(hill, 0.5, 1.4, HT, 18, mat(0xdcd5c4), 0, -0.05, 0);
  hm.userData.terrain = true;
  const cap = cyl(hill, 0.5, 0.5, 0.02, 18, mat(0xc8c0ac), 0, HT - 0.05, 0);
  cap.userData.terrain = true;
  const top = HT - 0.03;
  // Basilique creuse (assises blanches et vertes), parvis côté +Z
  const k = kitOf(hill);
  hollow(k, { w: 0.62, d: 0.3, h: 0.35, x: -0.1, z: 0, base: top, floors: 1, wall: 0xf2eee4, inner: 0xf4efe6, doors: { '+z': 0 }, furnish: 'church', floorCol: 0xc9b890, seed: 16, doorW: 0.1, doorH: 0.18 });
  for (let i = 0; i < 5; i++) faceBands(k, 0.62, 0.3, -0.1, 0, top + i * 0.07, 0.07, i % 2 ? 0x7a9278 : 0xf2eee4, { out: 0.006, gap: { x0: -0.16, x1: -0.04, y1: top + 0.18 } });
  const b = new THREE.Group(); b.position.set(0, top, 0); hill.add(b);
  gableRoof(b, 0.62, 0.1, 0.3, mat(0x9a6a4e), -0.1, 0.35, 0);
  cyl(b, 0.11, 0.11, 0.12, 12, white, -0.15, 0.38, 0);
  add(b, new THREE.SphereGeometry(0.11, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), green, -0.15, 0.5, 0);
  // Clocher creux à escalier à vis, beffroi ajouré, lanterne et statue
  hollow(k, { w: 0.24, d: 0.24, h: 0.72, x: 0.33, z: 0, base: top, floors: 2, stair: 'spiral', wall: 0xf2eee4, inner: 0xeee8dc, doors: { '+z': 0 }, doorW: 0.08, doorH: 0.15, furnish: 'none', seed: 17, topRoom: 0.14 });
  for (let i = 0; i < 9; i++) faceBands(k, 0.24, 0.24, 0.33, 0, top + i * 0.08, 0.08, i % 2 ? 0x7a9278 : 0xf2eee4, { out: 0.005, gap: { x0: 0.28, x1: 0.38, y1: top + 0.16 } });
  box(b, 0.2, 0.2, 0.2, white, 0.33, 0.72, 0);
  for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const fc = new THREE.Group(); fc.position.set(0.33, 0.72, 0); fc.rotation.y = r; b.add(fc);
    arch(fc, 0.08, 0.15, mat(0x2a2620), 0, 0.03, 0.101);
  }
  cyl(b, 0.07, 0.09, 0.12, 8, white, 0.33, 0.92, 0);
  cyl(b, 0.02, 0.035, 0.2, 8, gold, 0.33, 1.04, 0);
  add(b, new THREE.SphereGeometry(0.025, 8, 6), gold, 0.33, 1.27, 0);
  // Bâtiment AMU
  const u = structure(g, -0.85, 0.6);
  const ku = kitOf(u);
  hollow(ku, { w: 1.05, d: 0.48, h: 0.48, floors: 2, wall: 0xf4f1ea, inner: 0xf6f4ee, doors: { '+z': -0.15, '-z': 0 }, furnish: 'office', floorCol: 0xbab4a8, seed: 18 });
  for (let i = 0; i < 2; i++) faceBands(ku, 1.05, 0.48, 0, 0, 0.15 + i * 0.2, 0.07, 0x8ccaff, { out: 0.006, glow: true });
  ku.box(0.12, 0.62, 0.06, 0.45, 0, 0.27, 0x1d4f9c);
  const amu = textPlane('AMU', 0.1, 0.05, { color: '#ffffff', bg: '#1d4f9c' });
  amu.position.set(0.45, 0.5, 0.305); u.add(amu);
  // Palmiers et pins d'Alep
  for (const [x, z] of [[0.55, 0.8], [0.1, 1.05]]) {
    const p = structure(g, x, z, 0, false);
    add(p, new THREE.CylinderGeometry(0.022, 0.035, 0.6, 5), mat(0x8a6a48), 0.02, 0.3, 0).rotation.z = 0.1;
    for (let i = 0; i < 7; i++) {
      const leaf = add(p, new THREE.BoxGeometry(0.3, 0.01, 0.06), mat(0x4f8a3c), 0, 0.6, 0);
      leaf.rotation.set(0, (i / 7) * Math.PI * 2, -0.4);
      leaf.translateX(0.14);
    }
    p.userData.colliders = { boxes: [], cyls: [[0, 0, 0.035, -0.05, 0.4]], rings: [] };
  }
  for (const [x, z] of [[-1.5, -0.4], [1.45, 0.45]]) treeAt(g, x, z, 1.2, 0x5f7d3f);
  // La Méditerranée : une mer en calotte sur le flanc de la lune
  const sea = new THREE.Mesh(
    new THREE.SphereGeometry(R + 0.02, 48, 12, 0, Math.PI * 2, 0, 0.75),
    new THREE.MeshStandardMaterial({ color: 0x2f88b5, roughness: 0.3, emissive: 0x0b2c44, emissiveIntensity: 0.4 })
  );
  sea.quaternion.setFromUnitVectors(UP, new THREE.Vector3(0.8, -0.35, 0.5).normalize());
  sea.userData.noDrape = true;
  sea.userData.water = true;
  g.add(sea);
  return g;
}

// ---------------------------------------------------------------------------
// Observatoire de Meudon : Château-Neuf de Mansart (1706), surmonté de la Grande Coupole (18,5 m, 1895)
// sur un haut tambour, terrasse à balustrade, petites coupoles, forêt de Meudon.
// On entre par le pavillon central, on monte ses trois étages puis l'escalier du tambour
// jusqu'au plancher de la coupole, où se trouve la grande lunette.
// ---------------------------------------------------------------------------
export function observatoireMeudon() {
  const g = new THREE.Group();
  // Le Château-Neuf repose sur un soubassement ; on y monte par un escalier à double révolution
  const c0 = structure(g, 0, 0.2);
  const k0 = kitOf(c0);
  const POD = 0.12;
  k0.box(2.86, POD, 1.24, 0, 0, 0, 0xd2c6ad);
  faceBands(k0, 2.86, 1.24, 0, 0, POD - 0.02, 0.02, 0xefe6d2, { out: 0.01 });
  const stairs = (x0, z0, dx, dz, n, w) => {
    // Volée qui descend de POD jusqu'au sol, dans la direction (dx, dz)
    const run = M(0.3), r = POD / n;
    for (let i = 0; i < n; i++) {
      const top = POD - (i + 1) * r, e = i * run + run / 2;
      if (dx) k0.box(run, top, w, x0 + dx * e, 0, z0, 0xc8bca6);
      else k0.box(w, top, run, x0, 0, z0 + dz * e, 0xc8bca6);
    }
  };
  // Palier devant la porte du pavillon, deux volées latérales symétriques, balustrade côté jardin
  k0.box(0.36, POD, 0.2, 0, 0, 0.7, 0xd2c6ad);
  stairs(-0.18, 0.69, -1, 0, 12, 0.18);
  stairs(0.18, 0.69, 1, 0, 12, 0.18);
  k0.box(0.36, 0.06, 0.02, 0, POD, 0.79, 0xefe6d2);
  for (const sx of [-1, 1]) {
    const q = new THREE.Group(); q.position.set(sx * 0.27, 0, 0.79); c0.add(q);
    add(q, new THREE.BoxGeometry(0.2, 0.02, 0.02), mat(0xefe6d2), 0, POD + 0.03 - 0.05, 0).rotation.z = sx * 0.55;
    // Perrons des ailes
    stairs(sx * 1.0, 0.31, 0, 1, 12, 0.16);
  }
  const c = new THREE.Group(); c.position.y = POD; c0.add(c);
  const k = kitOf(c);
  // Ailes du château, de part et d'autre du pavillon central
  for (const sx of [-1, 1]) {
    const s = new THREE.Group(); s.position.x = sx * 1.0; c.add(s);
    wing(s, { len: 0.8, depth: 0.62, h: 0.72, floors: 2, wall: 0xe8dec8, roofH: 0.26, furnish: 'observatory', doors: { '+z': 0 }, seed: 19 + sx });
    s.userData.kit.build(s); delete s.userData.kit;
  }
  // Pavillon central carré : hall, deux étages de bureaux, escalier jusqu'au toit-terrasse sous le tambour
  const PH = 0.8;
  hollow(k, { w: 1.2, d: 1.2, h: PH, floors: 3, toRoof: true, wall: 0xefe6d2, inner: 0xf3ecdc, doors: { '+z': 0 }, doorW: 0.11, doorH: 0.18, furnish: 'observatory', stairX: -0.2, stairZ: -0.3, seed: 21 });
  facadeWindows(k, { w: 1.1, x: 0, z: 0.6, y0: 0, floors: 3, fh: PH / 3, cols: 5, side: 1, ww: 0.07, wh: 0.11, lit: LIT, skip: (a, f) => f === 0 && Math.abs(a) < 0.12 });
  facadeWindows(k, { w: 1.1, x: 0, z: -0.6, y0: 0, floors: 3, fh: PH / 3, cols: 5, side: -1, ww: 0.07, wh: 0.11, lit: LIT });
  pediment(c, 0.92, 0.16, 0.06, 0xefe6d2, 0, PH, 0.55);
  // Tambour : mur circulaire creux, deux volées droites jusqu'au plancher de la coupole
  const DR = 0.6, DY = PH, DOME = 1.33;
  add(c, new THREE.CylinderGeometry(DR + 0.02, DR + 0.02, DOME - DY, 40, 1, true), mat(0xe6dcc6, { side: THREE.DoubleSide }), 0, DY + (DOME - DY) / 2, 0);
  k.ring(0, 0, DR, DY, DOME + 0.9);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const w = add(c, new THREE.BoxGeometry(0.06, 0.13, 0.02), glow(LIT, 1.2), Math.sin(a) * (DR + 0.025), 1.03, Math.cos(a) * (DR + 0.025));
    w.rotation.y = a;
  }
  const mid = (DY + DOME) / 2;
  const flight = (y0, y1, lane, dir) => {
    const rise = M(0.19), run = M(0.28), n = Math.ceil((y1 - y0) / rise), r = (y1 - y0) / n;
    for (let i = 0; i < n; i++) {
      const xa = dir > 0 ? -0.2 + i * run : -0.2 + n * run - (i + 1) * run;
      k.box(run, (i + 1) * r, 0.075, xa + run / 2, y0, lane, i % 2 ? 0x8a5c3a : 0x7d5234);
    }
    return n * run;
  };
  const L1 = flight(DY, mid, 0.42, 1);
  k.box(0.12, mid - DY, 0.17, -0.2 + L1 + 0.06, DY, 0.375, 0x7d5234);
  const L2 = flight(mid, DOME, 0.33, -1);
  // Plancher de la coupole (fixe), percé au-dessus de la seconde volée
  const floorShape = new THREE.Shape(); floorShape.absarc(0, 0, DR, 0, Math.PI * 2, false);
  const hx0 = -0.2, hx1 = -0.2 + L2, hz0 = 0.29, hz1 = 0.47;
  const hole = new THREE.Path(); hole.moveTo(hx0, hz0); hole.lineTo(hx1, hz0); hole.lineTo(hx1, hz1); hole.lineTo(hx0, hz1); hole.closePath();
  floorShape.holes.push(hole);
  const fg = new THREE.ExtrudeGeometry(floorShape, { depth: 0.02, bevelEnabled: false, curveSegments: 32 });
  fg.rotateX(Math.PI / 2); fg.translate(0, DOME, 0);
  k.geo(fg, 0x5a4636);
  // Collisions du plancher : carré inscrit percé + quatre segments
  const q = DR * 0.7;
  const fy = DOME - 0.02;
  k.solid(-q, fy, -q, q, DOME, hz0);
  k.solid(-q, fy, hz0, hx0, DOME, 0.58); k.solid(hx1, fy, hz0, q, DOME, 0.58);
  for (const [x0, z0, x1, z1] of [[q, -0.4, 0.58, 0.4], [-0.58, -0.4, -q, 0.4], [-0.4, -0.58, 0.4, -q]]) k.solid(x0, fy, z0, x1, DOME, z1);
  // Garde-corps autour de la trémie
  k.box(L2 - 0.03, 0.05, 0.008, -0.2 + L2 / 2 + 0.015, DOME, hz0, 0x6a4428);
  add(c, new THREE.CylinderGeometry(0.66, 0.66, 0.05, 36, 1, true), mat(0xf2ebdc, { side: THREE.DoubleSide }), 0, 1.305, 0);
  // Fauteuil d'observation et lampe rouge (on préserve la vision nocturne)
  k.box(0.04, 0.025, 0.04, 0.12, DOME, -0.12, 0x6a3a2a);
  k.box(0.02, 0.02, 0.02, -0.3, DOME + 0.12, -0.3, 0xff4a3a, { glow: true });
  c.userData.scope = { x: 0, z: 0, y: DOME, r: 0.2 };
  // Grande Coupole : coupole tournante, trappe à deux volets, grande lunette sur sa monture
  const cp = new THREE.Group(); cp.name = 'coupole'; cp.position.set(0, DOME, 0); c.add(cp);
  const rot = new THREE.Group(); rot.name = 'coupole-rot'; cp.add(rot);
  const GAP = 0.44;
  const domeMat = new THREE.MeshStandardMaterial({ color: 0x9aa4ad, metalness: 0.5, roughness: 0.5, flatShading: true });
  const shell = new THREE.SphereGeometry(0.64, 32, 12, Math.PI / 2 + GAP / 2, Math.PI * 2 - GAP, 0, Math.PI / 2);
  rot.add(new THREE.Mesh(shell, domeMat));
  rot.add(new THREE.Mesh(shell, new THREE.MeshStandardMaterial({ color: 0x3b3a40, side: THREE.BackSide })));
  for (let i = 0; i < 12; i++) {
    const a = Math.PI / 2 + GAP / 2 + ((Math.PI * 2 - GAP) * (i + 0.5)) / 12;
    const holder = new THREE.Group(); holder.rotation.y = a + Math.PI;
    holder.add(new THREE.Mesh(new THREE.TorusGeometry(0.645, 0.008, 4, 24, Math.PI / 2), mat(0x7d8790)));
    rot.add(holder);
  }
  const shutterGeo = (start) => new THREE.SphereGeometry(0.652, 6, 12, start, GAP / 2 + 0.01, 0, Math.PI / 2 - 0.02);
  const shA = new THREE.Mesh(shutterGeo(Math.PI / 2 - GAP / 2 - 0.005), domeMat); shA.name = 'shutter-a';
  const shB = new THREE.Mesh(shutterGeo(Math.PI / 2 - 0.005), domeMat); shB.name = 'shutter-b';
  rot.add(shA, shB);
  rot.userData.gap = GAP;
  // Pilier et grande lunette (double réfracteur, 16 m de focale dans la réalité)
  cyl(rot, 0.05, 0.07, 0.3, 10, mat(0x3a3d40), 0, 0, 0);
  k.cyls.push([0, 0, 0.07, DOME, DOME + 0.3]);
  const alt = new THREE.Group(); alt.name = 'tube-alt'; alt.position.set(0, 0.3, 0); rot.add(alt);
  const tubeMat = mat(0x2d3a33);
  const tube = new THREE.CylinderGeometry(0.055, 0.045, 0.95, 14);
  tube.rotateX(Math.PI / 2);
  alt.add(new THREE.Mesh(tube, tubeMat));
  const tube2 = new THREE.CylinderGeometry(0.04, 0.035, 0.95, 12);
  tube2.rotateX(Math.PI / 2);
  const t2 = new THREE.Mesh(tube2, tubeMat); t2.position.set(0.09, 0, 0); alt.add(t2);
  add(alt, new THREE.CylinderGeometry(0.06, 0.06, 0.05, 14), mat(0xb08a4a), 0, 0, 0.47, [Math.PI / 2, 0, 0]);
  add(alt, new THREE.BoxGeometry(0.2, 0.06, 0.08), mat(0x3a3d40), 0.04, -0.06, 0);
  // Oculaire (côté bas du tube) et point de vue de la caméra, devant l'objectif dans l'axe optique
  add(alt, new THREE.CylinderGeometry(0.015, 0.02, 0.06, 8), mat(0xb08a4a), 0, -0.02, -0.5, [Math.PI / 2, 0, 0]);
  const eye = new THREE.Object3D(); eye.name = 'eyepiece'; eye.position.set(0, 0, 0.53); alt.add(eye);
  // Pavillon : son kit est assemblé ici (il n'est pas enfant direct du monument)
  c.userData.kit.build(c); delete c.userData.kit;
  // Grande Terrasse (Le Vau, XVIIe s.) devant le château : esplanade, balustrade, mur de soutènement
  const t = structure(g, 0, 1.45);
  const kt = kitOf(t);
  kt.box(3.0, 0.03, 0.6, 0, 0, 0, 0xd8cfbd);
  for (let i = 0; i < 30; i++) cyl(t, 0.012, 0.012, 0.08, 5, mat(0xefe7d6), -1.45 + i * 0.1, 0.03, 0.28);
  kt.box(3.0, 0.02, 0.03, 0, 0.11, 0.28, 0xefe7d6);
  kt.solid(-1.5, 0.03, 0.265, 1.5, 0.13, 0.295);
  for (const x of [-0.75, 0.75]) { kt.box(0.5, 0.004, 0.3, x, 0.03, -0.05, 0x86a85e, { collide: false }); }
  // Tour solaire (1960-1970) : fût carré d'environ 35 m surmonté d'une petite coupole
  const ts = structure(g, 1.85, -0.25);
  const kts = kitOf(ts);
  kts.box(0.16, 1.85, 0.16, 0, 0, 0, 0xe8e6e0);
  for (let i = 0; i < 6; i++) kts.box(0.17, 0.02, 0.17, 0, 0.25 + i * 0.28, 0, 0xc8c6c0, { collide: false });
  kts.box(0.24, 0.05, 0.24, 0, 1.85, 0, 0xc8c6c0);
  add(ts, new THREE.SphereGeometry(0.1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf4f4f0), 0, 1.9, 0);
  kts.box(0.05, 0.1, 0.01, 0, 0, 0.085, 0x3b2b20, { collide: false });
  // Petites coupoles (télescope de 1 m, lunette photographique), creuses
  for (const [x, z] of [[-1.45, -0.7], [1.4, -0.75]]) {
    const s = structure(g, x, z);
    hollow(kitOf(s), { w: 0.42, d: 0.42, h: 0.32, floors: 1, wall: 0xe6dcc6, inner: 0xf0e8d8, doors: { '+z': 0 }, furnish: 'observatory', seed: 22 });
    cyl(s, 0.2, 0.2, 0.06, 16, mat(0xe6dcc6), 0, 0.32, 0);
    add(s, new THREE.SphereGeometry(0.21, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf4f4f0), 0, 0.38, 0);
  }
  for (const [x, z, s] of [[-1.75, 0.3, 1.2], [-1.1, -1.3, 1.1], [0.2, -1.4, 1], [1.0, -1.3, 1.15], [-0.6, -1.1, 0.9]]) treeAt(g, x, z, s, 0x3c6634);
  return g;
}

// ---------------------------------------------------------------------------
// Enedis Data Challenge : pylônes électriques, câbles, données mesurées et reconstituées,
// poste de transformation et salle de contrôle où l'on peut entrer
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
    p.userData.colliders = { boxes: [], cyls: [[0.2, 0.2, 0.04, -0.05, 0.4], [-0.2, 0.2, 0.04, -0.05, 0.4], [0.2, -0.2, 0.04, -0.05, 0.4], [-0.2, -0.2, 0.04, -0.05, 0.4]], rings: [] };
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
  // Salle de contrôle (écrans des données) et poste de transformation
  const cr = structure(g, 0.1, 0.85);
  const k = kitOf(cr);
  hollow(k, { w: 0.9, d: 0.42, h: 0.3, floors: 1, wall: 0xdfe3e6, inner: 0xeef1f3, doors: { '+z': 0.2 }, furnish: 'office', floorCol: 0x9aa3ad, seed: 23 });
  faceBands(k, 0.9, 0.42, 0, 0, 0.17, 0.07, 0x7dffc8, { out: 0.006, glow: true });
  k.box(0.94, 0.03, 0.46, 0, 0.3, 0, 0x5a6670);
  const tr = structure(g, -0.25, -0.8);
  const kt = kitOf(tr);
  for (let i = 0; i < 3; i++) {
    kt.box(0.14, 0.18, 0.14, -0.2 + i * 0.2, 0, 0, 0x8c949c);
    kt.cyl(0.015, 0.015, 0.08, -0.2 + i * 0.2, 0.18, 0, 0xe8e0d0, { collide: false });
  }
  kt.box(0.7, 0.04, 0.3, 0, 0, 0, 0x6a7078);
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

// ---------------------------------------------------------------------------
// NOCTURNE : un piano à queue sur une scène en plein air, kiosque, loges et lampadaires
// ---------------------------------------------------------------------------
export function pianoStage() {
  const g = new THREE.Group();
  const st = structure(g, 0, 0);
  const k = kitOf(st);
  // Estrade ronde en bois, avec ses marches
  cyl(st, 1.05, 1.1, 0.12, 24, mat(0x8a5a36), 0, 0, 0);
  cyl(st, 1.08, 1.08, 0.025, 24, mat(0xd8b47a), 0, 0.12, 0);
  k.cyls.push([0, 0, 1.08, -0.1, 0.145]);
  for (let i = 0; i < 5; i++) k.box(0.36, 0.029 * (i + 1), 0.035, 0, 0, 1.24 - i * 0.035, i % 2 ? 0xb88a56 : 0xa77a48);
  // Conque acoustique (demi-coupole) derrière le piano
  const shell = add(st, new THREE.SphereGeometry(1.0, 24, 10, Math.PI, Math.PI, 0, Math.PI / 2), mat(0xefe6d6, { side: THREE.DoubleSide }), 0, 0.14, -0.15);
  shell.scale.set(1, 1.15, 0.85);
  k.ring(0, -0.15, 0.85, 0.14, 1.2, [[0, Math.PI]]);
  for (let i = 0; i < 5; i++) {
    const rib = add(st, new THREE.TorusGeometry(1.0 - i * 0.001, 0.015, 4, 20, Math.PI), mat(0xd8c8a8), 0, 0.14, -0.15);
    rib.rotation.set(0, (i / 4) * Math.PI - Math.PI / 2, 0);
    rib.scale.set(1, 1.15, 0.85);
  }
  // Piano à queue et banquette
  const pn = grandPiano();
  pn.scale.setScalar(0.42);
  pn.position.set(0, 0.14, 0.25);
  pn.rotation.y = Math.PI;
  st.add(pn);
  k.solid(-0.24, 0.14, -0.05, 0.24, 0.5, 0.62);
  box(st, 0.25, 0.1, 0.1, mat(0x1a1a1a), 0, 0.14, -0.05);
  // Loges des musiciens (creuses), derrière la scène
  const lg = structure(g, -1.0, -1.15, 0.35);
  hollow(kitOf(lg), { w: 0.7, d: 0.4, h: 0.3, floors: 1, wall: 0x8a6a8c, inner: 0xe8dce6, doors: { '+z': 0 }, furnish: 'home', seed: 24 });
  gableRoof(lg, 0.7, 0.14, 0.4, mat(0x4a3a5a), 0, 0.3, 0);
  facadeWindows(kitOf(lg), { w: 0.6, x: 0, z: 0.2, y0: 0, floors: 1, fh: 0.3, cols: 4, side: 1, ww: 0.06, wh: 0.08, lit: 0xffd28a, skip: (a) => Math.abs(a) < 0.08 });
  // Lampadaires
  for (const [x, z] of [[-1.25, 0.6], [1.25, 0.6]]) {
    const l = structure(g, x, z, 0, false);
    cyl(l, 0.015, 0.02, 0.7, 6, mat(0x2b2b2b), 0, 0, 0);
    add(l, new THREE.SphereGeometry(0.06, 8, 6), glow(0xffd28a, 3), 0, 0.74, 0);
    l.userData.colliders = { boxes: [], cyls: [[0, 0, 0.025, -0.05, 0.7]], rings: [] };
  }
  for (const [x, z, sc] of [[-1.4, -0.4, 1.1], [1.45, -0.8, 1.0], [0.3, 1.6, 0.9]]) treeAt(g, x, z, sc, 0x5a7d48);
  return g;
}

// ---------------------------------------------------------------------------
// GLÉNOS : laboratoire de biomécanique, l'implant exposé en sculpture sur un socle
// ---------------------------------------------------------------------------
export function implantLab() {
  const g = new THREE.Group();
  const pd = structure(g, 0.35, 0.25);
  cyl(pd, 0.32, 0.38, 0.22, 16, mat(0xd9d4ca), 0, 0, 0);
  pd.userData.colliders = { boxes: [], cyls: [[0, 0, 0.38, -0.05, 0.22]], rings: [] };
  const im = glenoidImplant();
  im.scale.setScalar(0.32);
  im.position.set(0, 0.62, 0);
  pd.add(im);
  // Laboratoire : bâtiment bas et moderne, bandeau vitré, verrière
  const lab = structure(g, -0.6, -0.55);
  const k = kitOf(lab);
  hollow(k, { w: 1.3, d: 0.6, h: 0.45, floors: 1, wall: 0xecebe6, inner: 0xf6f6f2, doors: { '+z': -0.4 }, furnish: 'lab', floorCol: 0xc8ccd0, seed: 25 });
  faceBands(k, 1.3, 0.6, 0, 0, 0.2, 0.12, 0x9fd8ff, { out: 0.006, glow: true });
  k.box(0.5, 0.18, 0.4, 0.3, 0.45, 0, 0xbfe8ff, { glow: true });
  // Antenne de télémétrie
  const ant = structure(g, 1.0, -0.6, 0, false);
  cyl(ant, 0.02, 0.03, 0.6, 6, mat(0x9aa4ad), 0, 0, 0);
  add(ant, new THREE.SphereGeometry(0.18, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3), mat(0xe8e8e8, { side: THREE.DoubleSide }), 0, 0.68, 0, [Math.PI * 0.8, 0, 0]);
  ant.userData.colliders = { boxes: [], cyls: [[0, 0, 0.035, -0.05, 0.6]], rings: [] };
  for (const [x, z] of [[-1.3, 0.6], [1.2, 0.9]]) treeAt(g, x, z, 1, 0x557f42);
  return g;
}
