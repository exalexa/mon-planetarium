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
function wing(s, { len, depth, h, floors, wall = C.stone, roof = C.slate, roofH = 0.3, mansard = true, flat = false, dormersN = 0, x = 0, z = 0, lit = true, furnish = 'school', doors = { '+z': 0, '-z': 0 }, seed = 1 }) {
  const k = kitOf(s);
  hollow(k, { w: len, d: depth, h, x, z, floors, wall, doors, furnish, seed, inner: 0xf1e9d8 });
  // Corniche
  faceBands(k, len, depth, x, z, h - 0.035, 0.035, 0xf6f0e2, { out: 0.012 });
  if (flat) {
    // Toit-terrasse à balustrade (ailes du Château-Neuf de Meudon)
    k.box(len, 0.012, depth, x, h, z, 0xd8ccb2);
    for (const sz of [1, -1]) {
      k.box(len, 0.012, 0.018, x, h + 0.05, z + sz * (depth / 2 - 0.01), wall, { collide: false });
      for (let i = 0; i <= Math.round(len / 0.035); i++) k.box(0.01, 0.04, 0.01, x - len / 2 + i * 0.035, h + 0.01, z + sz * (depth / 2 - 0.01), wall, { collide: false });
    }
  } else if (mansard) mansardRoof(s, len, roofH, depth, mat(roof), x, h, z);
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
    // Position : soit à plat (x, z) près du pôle, soit une direction explicite (carte, bord de terrasse)
    const n = c.userData.dir ? c.userData.dir.clone() : new THREE.Vector3(x, Math.sqrt(Math.max(R * R - x * x - z * z, 0.01)), z).normalize();
    // Relief à deux niveaux (Meudon) : le bâtiment se pose sur le niveau de son terrain
    const relief = group.userData.relief;
    const lift = c.userData.lift ?? (relief ? relief(n) : 0);
    c.position.copy(n).multiplyScalar(R + y0 + lift - 0.004);
    c.quaternion.premultiply(c.userData.quat || new THREE.Quaternion().setFromUnitVectors(UP, n));
  }
  group.userData.afterDrape?.(group);
}

// Lune au relief doux ; la calotte nord reste légèrement sous le niveau R pour accueillir la pelouse
const MOON_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
MOON_MAT.userData.tex = 2; MOON_MAT.userData.texScale = 16;
function createMoon({ radius, seed, colors, cap = 0.62, relief = null, flatten = null, ground = null, paint = null }) {
  // Relief à niveaux : maillage fin pour que les ruptures de pente suivent les murs
  const geometry = new THREE.IcosahedronGeometry(radius, relief ? 44 : 5);
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();
  const rnd = mulberry32(seed * 77);
  const craters = Array.from({ length: 10 }, () => ({ c: new THREE.Vector3(rnd() - 0.5, rnd() - 0.75, rnd() - 0.5).normalize(), r: 0.2 + rnd() * 0.28 }));
  const cosCap = Math.cos(cap + 0.12);
  const hs = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let h = 1 + (fbm3(v.x * 3 + seed, v.y * 3, v.z * 3) - 0.5) * 0.09;
    if (!relief) for (const { c, r } of craters) {
      const d = v.distanceTo(c);
      if (d < r) { const k = d / r; h -= 0.06 * (1 - k * k) - 0.02 * Math.exp(-Math.pow((k - 0.92) * 9, 2)); }
    }
    // Près du pôle, le sol rejoint doucement la sphère idéale
    const t = THREE.MathUtils.smoothstep(v.y, cosCap - 0.15, cosCap);
    h = THREE.MathUtils.lerp(h, relief ? 0.999 : 0.992, t);
    if (flatten) h = THREE.MathUtils.lerp(h, 0.999, flatten(v));
    hs[i] = h;
    const lift = relief ? relief(v) : 0;
    v.multiplyScalar(radius * h + lift);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const cols = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    const h = (hs[i] + hs[i + 1] + hs[i + 2]) / 3;
    const t = THREE.MathUtils.clamp((h - 0.93) / 0.1, 0, 1);
    const k = Math.min(colors.length - 2, Math.floor(t * (colors.length - 1)));
    c.set(colors[k]).lerp(new THREE.Color(colors[k + 1]), t * (colors.length - 1) - k);
    if (ground != null) {
      // Pelouse peinte dans la lune elle-même (pas de calotte rapportée)
      const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3, cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3, cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      const vy = cy / Math.hypot(cx, cy, cz);
      const edge = Math.cos(cap) - 0.015 * (Math.sin(Math.atan2(cz, cx) * 7 + seed) + 1);
      if (vy > edge) c.set(ground);
    }
    if (paint) {
      // Sol peint d'après la carte (forêt, prairies, allées, parterres…)
      const d = new THREE.Vector3(pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2), pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2), pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)).normalize();
      const pc = paint(d);
      if (pc != null) c.set(pc).multiplyScalar(0.94 + 0.12 * fbm3(d.x * 40, d.y * 40, d.z * 40));
    }
    for (let j = 0; j < 3; j++) cols.set([c.r, c.g, c.b], (i + j) * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geometry.computeVertexNormals();
  const m = new THREE.Mesh(geometry, MOON_MAT);
  m.userData.terrain = true;
  return m;
}


// Assemble lune + pelouse + monument drapé (le reste de la lune est peuplé ensuite, voir cover.js)
export function createLandmarkMoon({ radius = 4, seed = 1, colors, landmark, ground = C.grass, cap = 0.62 }) {
  const moon = new THREE.Group();
  const lm = landmark(radius);
  const relief = lm.userData.relief || null;
  moon.add(createMoon({ radius, seed, colors, cap, relief, flatten: lm.userData.flatten || null, ground: relief ? ground : null, paint: lm.userData.paint || null }));
  // Pelouse / sol aménagé en calotte, bord légèrement irrégulier
  if (!relief) {
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
  }
  drape(lm, radius);
  moon.add(lm);
  moon.userData.topY = radius;
  moon.userData.cap = cap;
  return moon;
}

// ---------------------------------------------------------------------------
// Pays autour d'un monument : le site reste plat, puis viennent collines, vallée d'un fleuve
// (creusée dans la lune, mise en eau par le niveau de la mer du thème) ou littoral.
// ---------------------------------------------------------------------------
function country({ seed = 1, amp = 0.35, cap = 0.62, river = null, sea = null, cliffs = null, tones }) {
  const ss = THREE.MathUtils.smoothstep;
  const riverS = (d) => {
    // Distance signée au cours du fleuve (petit cercle qui serpente)
    const u = d.dot(river.n);
    return u - river.c - 0.035 * Math.sin(Math.atan2(d.dot(river.a), d.dot(river.b)) * 5 + seed);
  };
  const seaS = (d) => d.dot(sea.n) - sea.c + 0.06 * (fbm3(d.x * 5 + seed, d.y * 5, d.z * 5) - 0.5);
  const relief = (d) => {
    const f = Math.acos(THREE.MathUtils.clamp(d.y, -1, 1));
    const out = ss(f, cap + 0.08, cap + 0.5);
    const n = fbm3(d.x * 2.6 + seed * 3.1, d.y * 2.6 - seed, d.z * 2.6 + 1.7);
    let h = amp * out * Math.pow(n, 1.4) * 1.9;
    if (river) {
      const r = Math.abs(riverS(d));
      // Fond de vallée large, lit du fleuve plus creux
      h *= 0.25 + 0.75 * ss(r, 0.1, 0.34);
      h -= river.depth * (1 - ss(r, river.w * 0.5, river.w)) * ss(f, cap + 0.02, cap + 0.12);
    }
    if (sea) {
      const sv = seaS(d);
      const isl = sea.islands ? Math.max(0, fbm3(d.x * 7 + 9, d.y * 7, d.z * 7 + seed) - 0.62) * 2.2 : 0;
      h = THREE.MathUtils.lerp(h, -sea.depth + isl, ss(sv, -0.02, 0.07) * ss(f, cap, cap + 0.1));
    }
    return h;
  };
  const flatten = (d) => 1 - ss(Math.acos(THREE.MathUtils.clamp(d.y, -1, 1)), cap + 0.02, cap + 0.2);
  const paint = (d) => {
    const f = Math.acos(THREE.MathUtils.clamp(d.y, -1, 1));
    if (f < cap - 0.02) return null;
    if (river && Math.abs(riverS(d)) < river.w * 0.55) return tones.bed;
    if (sea) { const sv = seaS(d); if (sv > 0.05) return relief(d) > -sea.depth * 0.75 ? tones.rock : tones.bed; if (sv > 0.0) return tones.beach ?? tones.bed; }
    const h = relief(d);
    const n2 = fbm3(d.x * 9 + seed, d.y * 9, d.z * 9);
    // Falaises : seulement le front du coteau, sauf massif rocheux (calanques)
    if (cliffs && h > amp * cliffs && (sea || h < amp * (cliffs + 0.14))) return tones.rock;
    if (h > amp * 0.42) return tones.wood;
    // Parcellaire : champs en damier irrégulier
    if (tones.fields && f > cap + 0.25) return tones.fields[Math.floor(n2 * 7.99) % tones.fields.length];
    return tones.grass;
  };
  return { relief, flatten, paint };
}
const V3 = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

// ---------------------------------------------------------------------------
// Lycée Pierre Corneille, Rouen
// Ailes classiques en pierre autour d'une cour d'honneur, toits d'ardoise à lucarnes,
// chapelle Saint-Louis à façade blanche (deux ordres, baie en plein cintre, fronton, statues, escalier).
// ---------------------------------------------------------------------------
export function lyceeCorneille(R = 4) {
  const g = new THREE.Group();
  Object.assign(g.userData, country({ seed: 3, amp: 0.5, cliffs: 0.5, river: { n: V3(0.15, -0.35, 1), a: V3(1, 0, -0.15), b: V3(0, 1, 0.35), c: 0.42, w: 0.11, depth: 0.2 }, tones: { bed: 0x6c8d92, rock: 0xe9e4d2, wood: 0x3f6136, grass: 0x7fa155, fields: [0x8fae5c, 0xb9b262, 0x7a9c4e, 0xa6b86a] } }));
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
  const cuis = sphereBand(R, 0, 0.32, 0xcfc4ad, 0.0042);
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
// Abbaye de Cluny, d'après le plan du site (mètres ; origine au centre du cloître, x vers l'est, z vers le sud).
// Projection sur la lune : le cloître au pôle, échelle qui se resserre vers l'extérieur, de sorte que
// l'enclos de l'abbaye, puis la ville, puis les vallons (forêts et vignobles) se succèdent jusqu'au bout de la lune.
// Grande église Cluny III (en ruine, sauf le bras sud du grand transept, le clocher de l'Eau-Bénite et
// la tour de l'Horloge), bâtiments du cloître XVIIIe (Arts et Métiers), ateliers, farinier et tour du Moulin,
// tours Fabry et Ronde, palais Jean de Bourbon et du pape Gélase, tours Barabans, haras, enceinte ;
// en ville la tour des Fromages, Notre-Dame et Saint-Marcel.
// ---------------------------------------------------------------------------
const CP = { cx: 70, cz: -30, k0: 0.0105, r0: 250 };
export function clunyDir(x, z) {
  x -= CP.cx; z -= CP.cz;
  const r = Math.hypot(x, z);
  if (r < 1e-6) return UP.clone();
  const f = (CP.k0 * r) / (1 + r / CP.r0);
  return new THREE.Vector3((Math.sin(f) * x) / r, Math.cos(f), (Math.sin(f) * z) / r);
}
export function clunyMap(d) {
  const f = Math.acos(THREE.MathUtils.clamp(d.y, -1, 1));
  const den = CP.k0 - f / CP.r0;
  if (den < 2e-5) return null;
  const r = f / den, h = Math.hypot(d.x, d.z);
  if (h < 1e-9) return [CP.cx, CP.cz];
  return [CP.cx + (r * d.x) / h, CP.cz + (r * d.z) / h];
}
// Plan relevé sur la vue aérienne annotée (1 px ≈ 1 m ; origine au centre du cloître, x est, z sud)
const CH = { a0: [-97, -100], a1: [72, -50] };                       // axe de la Maior Ecclesia (ouest → est)
CH.len = Math.hypot(CH.a1[0] - CH.a0[0], CH.a1[1] - CH.a0[1]);
CH.u = [(CH.a1[0] - CH.a0[0]) / CH.len, (CH.a1[1] - CH.a0[1]) / CH.len];
CH.n = [-CH.u[1], CH.u[0]];
CH.ang = Math.atan2(CH.u[1], CH.u[0]);
CH.pt = (s, t) => [CH.a0[0] + CH.u[0] * s + CH.n[0] * t, CH.a0[1] + CH.u[1] * s + CH.n[1] * t];
CH.st = ([x, z]) => [(x - CH.a0[0]) * CH.u[0] + (z - CH.a0[1]) * CH.u[1], (x - CH.a0[0]) * CH.n[0] + (z - CH.a0[1]) * CH.n[1]];
const CL = {
  // Enceinte (marron) : tracé du mur, puis emprise complète de l'abbaye (mur + bâtiments + église)
  wallA: [[32, 90], [40, 112], [82, 130], [128, 128]],
  wallB: [[142, 127], [182, 125], [192, 105], [237, 110], [252, 35], [257, -85], [252, -165], [127, -190], [102, -155], [87, -85], [84, -52]],
  abbey: [[127, -190], [252, -165], [257, -85], [252, 35], [237, 110], [192, 105], [182, 125], [82, 130], [40, 112], [-32, 40], [-34, -34], [-70, -58], [-112, -84], [-104, -126], [-60, -116], [84, -62], [87, -85], [102, -155]],
  parterre: [[34, -6], [84, -6], [84, 66], [34, 66]],
  lawns: [[[92, -8], [128, -8], [128, 40], [92, 40]], [[92, 50], [240, 50], [232, 100], [92, 104]], [[200, -80], [250, -80], [246, 36], [200, 36]]],
  garth: [[-14, -19], [11, -19], [11, 16], [-14, 16]],
  place: [[-84, -64], [-36, -40], [-36, -8], [-84, -8]],
  yard: [[124, -160], [204, -160], [204, -10], [124, -10]],
  // La Grosne à l'est ; le Médasson la rejoint (en partie souterrain sous la ville)
  grosne: [[520, -420], [466, -115], [422, -5], [392, 115], [367, 245], [330, 420], [350, 700]],
  medasson: [[380, -420], [382, -265], [387, -165], [420, -60]],
};
function clunyCountry(d) { return fbm3(d.x * 2.2 + 7, d.y * 2.2, d.z * 2.2 - 3); }
const clunyRiver = (m) => Math.min(segDist(m, CL.grosne), segDist(m, CL.medasson) + 5);
function clunyRelief(d) {
  const m = clunyMap(d);
  const f = Math.acos(THREE.MathUtils.clamp(d.y, -1, 1));
  // Vallons du Clunisois au-delà de la ville ; la vallée de la Grosne se creuse à l'est
  const out = THREE.MathUtils.smoothstep(f, 1.5, 1.85);
  let h = 0.42 * out * Math.pow(fbm3(d.x * 3.1 + 2, d.y * 3.1 - 5, d.z * 3.1 + 1), 1.3) * 1.6;
  if (m) {
    const rd = clunyRiver(m);
    h -= 0.1 * (1 - THREE.MathUtils.smoothstep(rd, 12, 60));
    // La ville monte doucement vers l'ouest ; la nef en ruine est en contrebas de la place
    h += 0.1 * THREE.MathUtils.smoothstep(-m[0], 60, 300) * (1 - out);
    const [s, t] = CH.st(m);
    if (s > 0 && s < 100 && Math.abs(t) < 20) h -= 0.035;
  }
  return h;
}
function clunyFlatten(d) {
  const m = clunyMap(d);
  if (!m) return 0;
  return 1 - THREE.MathUtils.smoothstep(Math.hypot(m[0] - CP.cx, m[1] - CP.cz), 330, 520);
}
function clunyPaint(d) {
  const m = clunyMap(d);
  if (m) {
    if (segDist(m, CL.grosne) < 8 || segDist(m, CL.medasson) < 4) return 0x4f8299;
    if (inPoly(m, CL.abbey)) {
      const [s, t] = CH.st(m);
      if (s > -6 && s < 100 && Math.abs(t) < 21) return (Math.floor(s / 4) + Math.floor((t + 40) / 4)) % 2 ? 0xd9cba9 : 0xcfc09c;
      if (inPoly(m, CL.garth)) { const r = Math.hypot(m[0] + 1.5, m[1] + 1.5); return (r > 5 && r < 7.5) || Math.abs(m[0] + 1.5) < 1.2 || Math.abs(m[1] + 1.5) < 1.2 ? 0xd8cdb4 : 0x7fa758; }
      if (inPoly(m, CL.place)) return 0xc9bb9b;
      if (inPoly(m, CL.parterre)) {
        // Parterre à la française : allées de gravier rose en croix et en diagonales
        const x = m[0] - 59, z = m[1] - 30, zz = ((z + 36) % 36) - 18, xx = x;
        if (Math.abs(x) < 2 || Math.abs(zz) < 1.6 || Math.abs(Math.abs(xx) - Math.abs(zz) * 1.35) < 1.7 || Math.abs(x) > 23) return 0xd8a58e;
        return 0x76a551;
      }
      if (inPoly(m, CL.yard)) return 0xaaa69c;
      if (CL.lawns.some((P) => inPoly(m, P))) return 0x7aa653;
      // Allées de gravier le long des bâtiments, pelouse ailleurs
      return (m[0] > 32 && m[0] < 92 && m[1] > -40 && m[1] < 100) || fbm3(m[0] * 0.03, 1, m[1] * 0.03) > 0.72 ? 0xd2b79a : 0x86a65c;
    }
    const r = Math.hypot(m[0] - CP.cx, m[1] - CP.cz);
    if (r < 345 && m[0] < 340) return fbm3(m[0] * 0.05, 3, m[1] * 0.05) > 0.5 ? 0xb9ac92 : 0xad9f85;
  }
  if (Math.acos(THREE.MathUtils.clamp(d.y, -1, 1)) < 1.5) return 0x8a9d5c;
  const c = clunyCountry(d);
  if (c > 0.53) return 0x3f5a33;
  if (c < 0.46) return Math.sin((d.x * 0.8 + d.z * 0.6 + d.y * 0.3) * 80) > 0.1 ? 0x6d7b3c : 0x8a7650;
  return 0x87a05a;
}
export function clunyZone(d) {
  const m = clunyMap(d);
  if (m) {
    if (clunyRiver(m) < 16) return 'river';
    if (inPoly(m, CL.abbey)) return CL.lawns.some((P) => inPoly(m, P)) ? 'garden' : 'abbey';
    // Abords dégagés : haras au nord, tour Ronde, places
    if (Math.hypot(m[0] - 212, m[1] + 232) < 60 || Math.hypot(m[0] - 267, m[1] + 138) < 22 || Math.hypot(m[0] + 105, m[1] + 140) < 30) return 'abbey';
    const r = Math.hypot(m[0] - CP.cx, m[1] - CP.cz);
    if (r < 345 && m[0] < 340) return 'town';
  }
  if (Math.acos(THREE.MathUtils.clamp(d.y, -1, 1)) < 1.5) return 'meadow';
  const c = clunyCountry(d);
  return c > 0.53 ? 'forest' : c < 0.46 ? 'vine' : 'meadow';
}

export function abbayeCluny(R = 4) {
  const g = new THREE.Group();
  g.userData.relief = clunyRelief;
  g.userData.flatten = clunyFlatten;
  g.userData.paint = clunyPaint;
  // Pierre calcaire dorée du Clunisois, enduit ocre des bâtiments du XVIIIe, tuile brune, ardoise des clochers
  const ST = 0xdcc79b, STD = 0xc9b283, OCRE = 0xe3c489, TILE = 0x7d5240, TILE2 = 0x94634a, SLATE = 0x4a525c;
  const stone = mat(ST), dark = mat(0x221d18);
  const atMap = (x, z, ang = 0, plinth = true) => {
    const st = structure(g, 0, 0, -ang, plinth);
    st.userData.dir = clunyDir(x, z);
    return st;
  };
  const span = (x, z, ang, L) => clunyDir(x - (Math.cos(ang) * L) / 2, z - (Math.sin(ang) * L) / 2)
    .angleTo(clunyDir(x + (Math.cos(ang) * L) / 2, z + (Math.sin(ang) * L) / 2)) * R;
  const wallLine = (pts, { h = 0.1, w = 0.05, color = ST, merlons = false, walk = false, ragged = 0 } = {}) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 14));
      for (let j = 0; j < n; j++) {
        const x0 = ax + ((bx - ax) * j) / n, z0 = az + ((bz - az) * j) / n, x1 = ax + ((bx - ax) * (j + 1)) / n, z1 = az + ((bz - az) * (j + 1)) / n;
        const ang = Math.atan2(z1 - z0, x1 - x0);
        const st = atMap((x0 + x1) / 2, (z0 + z1) / 2, ang, false);
        const L = span((x0 + x1) / 2, (z0 + z1) / 2, ang, Math.hypot(x1 - x0, z1 - z0)) + w;
        const k = kitOf(st);
        const hh = h * (1 + ragged * (((i * 7 + j * 3) % 5) / 5 - 0.4));
        k.box(L, hh + 0.14, w, 0, -0.14, 0, color);
        if (walk) k.box(L, 0.012, w + 0.03, 0, hh, 0, 0xcbb98f, { collide: false });
        if (merlons) for (let x = -L / 2 + 0.03; x < L / 2; x += 0.07) k.box(0.035, 0.04, w + 0.01, x, hh, 0, color, { collide: false });
      }
    }
  };
  // Aile maçonnée à toit de tuile à deux pans, lucarnes et souches de cheminée
  const range = (x, z, ang, L, D, o = {}) => {
    const st = atMap(x, z, ang);
    const len = span(x, z, ang, L), dep = Math.max(0.2, span(x, z, ang + Math.PI / 2, D));
    wing(st, { len, depth: dep, h: o.h ?? 0.6, floors: o.floors ?? 2, wall: o.wall ?? OCRE, roof: o.roof ?? TILE, mansard: false, roofH: o.roofH ?? dep * 0.42, dormersN: o.dormers ?? 0, furnish: o.furnish ?? 'school', doors: o.doors ?? { '+z': 0, '-z': 0 }, seed: o.seed ?? 3 });
    const k = kitOf(st);
    for (let i = 0; i < (o.chimneys ?? 0); i++) k.box(0.035, (o.roofH ?? dep * 0.42) + 0.1, 0.06, -len / 2 + (len * (i + 0.5)) / o.chimneys, o.h ?? 0.6, (i % 2 ? 1 : -1) * dep * 0.2, 0xd9c7a0, { collide: false });
    // Chaînes d'angle en pierre
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.03, o.h ?? 0.6, 0.03, sx * (len / 2 - 0.01), 0, sz * (dep / 2 - 0.01), 0xe9dcc0, { collide: false });
    return { st, len, dep };
  };

  // ---- Maior Ecclesia (Cluny III) : vestiges ----
  const P = CH.pt;
  // Murs gouttereaux arasés de la nef et de l'avant-nef, pans de mur encore hauts au sud-ouest
  wallLine([P(0, -19), P(92, -19)], { h: 0.07, w: 0.06, ragged: 0.8 });
  wallLine([P(40, 19), P(92, 19)], { h: 0.07, w: 0.06, ragged: 0.8 });
  wallLine([P(0, 19), P(38, 19)], { h: 0.5, w: 0.07, ragged: 0.9, color: STD });
  wallLine([P(0, -19), P(0, -8)], { h: 0.3, w: 0.07, ragged: 0.6, color: STD });
  // Chevet : déambulatoire en hémicycle
  {
    const pts = [];
    for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + (i / 8) * Math.PI; pts.push(P(CH.len - 4 + Math.cos(a) * 18, Math.sin(a) * 18)); }
    wallLine(pts, { h: 0.05, w: 0.05 });
    wallLine([P(126, -19), P(CH.len - 4, -18)], { h: 0.05, w: 0.05 });
  }
  // Bases des piles : faisceaux de colonnes engagées (quatre files, cinq vaisseaux)
  for (let s = 8; s <= 96; s += 9.5) for (const t of [-12.5, -5.5, 5.5, 12.5]) {
    const p = atMap(...P(s, t), CH.ang, false);
    const k = kitOf(p), hh = 0.05 + 0.1 * (((s * 3 + t * 7) % 11 + 11) % 11) / 11;
    k.box(0.085, hh + 0.08, 0.085, 0, -0.08, 0, 0xd8c8a6);
    for (const [ox, oz] of [[0.05, 0], [-0.05, 0], [0, 0.05], [0, -0.05]]) k.cyl(0.02, 0.022, hh * 0.8 + 0.08, ox, -0.08, oz, 0xe2d4b4, { seg: 6, collide: false });
  }
  // Emmarchement qui descend de la place vers la nef
  {
    const e = atMap(...P(-4, 0), CH.ang + Math.PI / 2, false);
    const k = kitOf(e), L = span(...P(-4, 0), CH.ang + Math.PI / 2, 30);
    for (let i = 0; i < 5; i++) k.box(L, 0.012 * (5 - i) + 0.1, 0.03, 0, -0.1 - 0.035, -0.06 + i * 0.03, 0xcdbf9f);
  }
  // Tours Barabans (bases des deux tours de la façade occidentale)
  for (const t of [-13, 13]) {
    const b = atMap(...P(-12, t), CH.ang);
    hollow(kitOf(b), { w: 0.34, d: 0.34, h: 0.62, floors: 1, wall: ST, inner: 0xe0d2b4, furnish: 'none', seed: 11, doorW: 0.08, doors: { '+x': 0 } });
    box(b, 0.37, 0.03, 0.37, mat(0xe2d2b2), 0, 0.62, 0);
    for (const [ox, oz] of [[-1, -1], [1, -1], [1, 1]]) box(b, 0.1, 0.1, 0.1, stone, ox * 0.12, 0.65, oz * 0.12);
    arch(b, 0.07, 0.2, dark, 0, 0.25, 0.172);
  }
  // Bras sud du grand transept (seul élevé), clocher de l'Eau-Bénite, chapelle Jean de Bourbon
  {
    const tc = P(104, 30);
    const t = atMap(tc[0], tc[1], CH.ang + Math.PI / 2);
    const k = kitOf(t);
    const L = span(tc[0], tc[1], CH.ang + Math.PI / 2, 34) * 1.25, D = 0.52, Ht = 1.3;
    hollow(k, { w: L, d: D, h: Ht, floors: 1, wall: ST, inner: 0xe8dcc0, doors: { '-x': 0, '+z': -L * 0.25 }, doorW: 0.1, doorH: 0.2, furnish: 'church', floorCol: 0xb5a180, seed: 6 });
    gableRoof(t, L, 0.34, D, mat(TILE2), 0, Ht, 0);
    for (let i = 0; i < 5; i++) { const x = -L / 2 + (L * i) / 4; for (const sz of [1, -1]) k.box(0.07, Ht * 0.8, 0.08, x, 0, sz * (D / 2 + 0.03), ST); }
    for (let i = 0; i < 4; i++) { const x = -L / 2 + (L * (i + 0.5)) / 4; for (const sz of [1, -1]) { arch(t, 0.09, 0.26, dark, x, 0.3, sz * (D / 2 + 0.005)); arch(t, 0.08, 0.2, dark, x, 0.85, sz * (D / 2 + 0.005)); } }
    for (const y of [0.62, 1.1]) faceBands(k, L, D, 0, 0, y, 0.025, 0xe6d8b6, { out: 0.01 });
    // Absidioles à l'est (dont la petite à coupole)
    for (const [x, r] of [[-L * 0.2, 0.17], [L * 0.22, 0.13]]) {
      add(t, new THREE.CylinderGeometry(r, r, 0.6, 12, 1, false, 0, Math.PI), stone, x, 0.3, D / 2, [0, -Math.PI / 2, 0]);
      add(t, new THREE.SphereGeometry(r * 1.02, 12, 5, 0, Math.PI, 0, Math.PI / 2), mat(x < 0 ? TILE2 : 0x8fa3ad), x, 0.6, D / 2, [0, -Math.PI / 2, 0]);
    }
    // Clocher de l'Eau-Bénite : souche carrée, deux étages octogonaux à baies géminées, flèche d'ardoise
    const c = new THREE.Group(); c.position.set(0, Ht, 0); t.add(c);
    box(c, 0.58, 0.5, 0.58, stone, 0, 0, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cone(c, 0.12, 0.2, 4, mat(TILE2), sx * 0.22, 0.5, sz * 0.22, [0, Math.PI / 4, 0]);
    for (const [y, h, r] of [[0.5, 0.4, 0.33], [0.95, 0.36, 0.3]]) {
      cyl(c, r + 0.035, r + 0.035, 0.045, 8, mat(0xe9dcbc), 0, y - 0.045, 0);
      cyl(c, r, r, h, 8, stone, 0, y, 0);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const face = new THREE.Group(); face.position.set(Math.sin(a) * r * 0.93, y, Math.cos(a) * r * 0.93); face.rotation.y = a; c.add(face);
        arch(face, 0.06, h * 0.62, dark, -0.04, h * 0.18, 0.005);
        arch(face, 0.06, h * 0.62, dark, 0.04, h * 0.18, 0.005);
        box(face, 0.012, h * 0.6, 0.012, mat(0xefe4c8), 0, h * 0.18, 0.012);
        cyl(c, 0.016, 0.016, h, 6, mat(0xe8dcc0), Math.sin(a + Math.PI / 8) * r, y, Math.cos(a + Math.PI / 8) * r);
      }
    }
    cyl(c, 0.35, 0.33, 0.05, 8, mat(0xe9dcbc), 0, 1.31, 0);
    cone(c, 0.35, 1.0, 8, mat(SLATE), 0, 1.36, 0);
    add(c, new THREE.SphereGeometry(0.025, 6, 5), mat(C.gold), 0, 2.38, 0);
    box(c, 0.008, 0.14, 0.008, mat(0x2a2a2a), 0, 2.4, 0);
    box(c, 0.07, 0.008, 0.008, mat(0x2a2a2a), 0, 2.48, 0);
    // Tour de l'Horloge : tourelle carrée à flèche d'ardoise galbée, contre le transept
    const hp = P(96, 44);
    const h = atMap(hp[0], hp[1], CH.ang);
    const kh = kitOf(h);
    hollow(kh, { w: 0.3, d: 0.3, h: 1.55, floors: 2, stair: 'spiral', wall: ST, inner: 0xe0d2b4, furnish: 'none', seed: 7, doorW: 0.08 });
    for (const y of [0.5, 1.0, 1.4]) faceBands(kh, 0.3, 0.3, 0, 0, y, 0.025, 0xe6d8b6, { out: 0.01, gap: { x0: -0.06, x1: 0.06, y1: 0.16 } });
    add(h, new THREE.CylinderGeometry(0.07, 0.07, 0.02, 20), glow(0xffe6b0, 1.2), 0, 1.28, 0.16, [Math.PI / 2, 0, 0]);
    cone(h, 0.24, 0.3, 4, mat(SLATE), 0, 1.55, 0, [0, Math.PI / 4, 0]);
    cyl(h, 0.07, 0.09, 0.12, 8, mat(SLATE), 0, 1.8, 0);
    cone(h, 0.08, 0.3, 8, mat(SLATE), 0, 1.92, 0);
  }

  // ---- Bâtiments conventuels du XVIIIe (Arts et Métiers) ----
  // Grande façade sur le jardin : long corps nord-sud, pavillon central à fronton, deux ailes en retour
  {
    const f = range(22, 28, Math.PI / 2, 112, 20, { h: 0.62, dormers: 9, chimneys: 8, furnish: 'school', seed: 8 });
    const pv = atMap(34, 28, Math.PI / 2);
    // Avant-corps central : la face « −z » de l'aile regarde le jardin (est)
    const kp = kitOf(pv);
    kp.box(0.46, 0.7, 0.08, 0, 0, -f.dep / 2 + 0.26, 0xefe2c4, { collide: false });
    for (const sx of [-0.18, -0.06, 0.06, 0.18]) kp.box(0.03, 0.66, 0.03, sx, 0, -f.dep / 2 + 0.21, 0xf3ead2, { collide: false });
    pediment(pv, 0.5, 0.14, 0.05, 0xefe2c4, 0, 0.7, -f.dep / 2 + 0.24);
    for (let i = 0; i < 4; i++) kp.box(0.5 + i * 0.06, 0.012, 0.03, 0, -0.012 * (i + 1), -f.dep / 2 + 0.2 - i * 0.03, 0xd9cdb0, { collide: false });
    range(58, -17, 0, 54, 18, { h: 0.62, dormers: 4, chimneys: 3, furnish: 'library', seed: 26 });
    range(46, 77, 0, 30, 18, { h: 0.62, dormers: 2, chimneys: 2, furnish: 'school', seed: 27 });
  }
  // Cloître : ailes ouest et sud, galerie nord adossée à l'église ; préau à galeries d'arcades
  range(-22, -3, Math.PI / 2, 64, 14, { h: 0.56, dormers: 5, chimneys: 4, wall: 0xe9d6a8, furnish: 'school', seed: 28 });
  range(-8, 24, 0, 42, 14, { h: 0.56, dormers: 3, chimneys: 3, wall: 0xe9d6a8, furnish: 'workshop', seed: 29 });
  range(-6, -27, 0, 30, 9, { h: 0.4, floors: 1, wall: 0xe9d6a8, furnish: 'hall', seed: 30 });
  {
    const cl = atMap(-1.5, -1.5, 0, false);
    const k = kitOf(cl), gx = span(-1.5, -1.5, 0, 25) / 2, gz = span(-1.5, -1.5, Math.PI / 2, 35) / 2;
    // Galeries : file d'arcades en plein cintre sous un appentis de tuile, sur les quatre côtés
    for (const [ax, sgn] of [['x', 1], ['x', -1], ['z', 1], ['z', -1]]) {
      const half = ax === 'x' ? gx : gz, off = (ax === 'x' ? gz : gx) - 0.03;
      const n = Math.max(4, Math.round((half * 2) / 0.085));
      for (let i = 0; i <= n; i++) {
        const u = -half + (2 * half * i) / n;
        const [x, z] = ax === 'x' ? [u, sgn * off] : [sgn * off, u];
        k.box(0.022, 0.2, 0.022, x, 0, z, 0xefe2c4, { collide: false });
        if (i < n) { const um = u + half / n; const [mx, mz] = ax === 'x' ? [um, sgn * off] : [sgn * off, um]; k.box(ax === 'x' ? (2 * half) / n : 0.02, 0.045, ax === 'x' ? 0.02 : (2 * half) / n, mx, 0.2, mz, 0xefe2c4, { collide: false }); }
      }
      k.box(ax === 'x' ? half * 2 : 0.09, 0.012, ax === 'x' ? 0.09 : half * 2, ax === 'x' ? 0 : sgn * (off + 0.03), 0.25, ax === 'x' ? sgn * (off + 0.03) : 0, TILE, { collide: false, [ax === 'x' ? 'rotX' : 'rotZ']: (ax === 'x' ? -sgn : sgn) * 0.3 });
    }
    // Bassin circulaire au centre du préau
    k.cyl(0.07, 0.07, 0.03, 0, 0, 0, 0xc8b894, { seg: 14 });
    k.cyl(0.055, 0.055, 0.032, 0, 0, 0, 0x5f8a6a, { seg: 14, collide: false });
  }
  // Palais du pape Gélase : façade gothique sur la place (arcades au rez-de-chaussée, baies géminées à l'étage)
  {
    const pg = range(-48, -34, Math.PI / 2, 50, 13, { h: 0.6, floors: 2, wall: 0xe9dfc6, roofH: 0.16, furnish: 'library', seed: 31, doors: { '+z': 0 } });
    const k = kitOf(pg.st), z = pg.dep / 2 + 0.006, n = 9;
    for (let i = 0; i < n; i++) {
      const x = -pg.len / 2 + (pg.len * (i + 0.5)) / n;
      if (i !== 4) { arch(pg.st, pg.len / n * 0.78, 0.17, mat(0x5a2f2a), x, 0.02, z); }
      k.box(0.012, 0.3, 0.02, x - pg.len / n / 2, 0, z, 0xf3ead2, { collide: false });
      for (const o of [-0.25, 0.25]) arch(pg.st, pg.len / n * 0.3, 0.13, mat(0x2a3140), x + o * pg.len / n, 0.42, z);
    }
    k.box(pg.len, 0.02, 0.03, 0, 0.36, z, 0xf3ead2, { collide: false });
    k.box(pg.len, 0.02, 0.03, 0, 0.585, z, 0xb5714a, { collide: false });
  }
  // Palais Jean de Bourbon (musée d'art et d'archéologie), au nord-ouest
  {
    const pj = range(-103, -140, 0.2, 34, 14, { h: 0.5, wall: ST, roofH: 0.26, furnish: 'library', seed: 32 });
    cyl(pj.st, 0.08, 0.08, 0.7, 10, mat(STD), -pj.len / 2, 0, -pj.dep / 2);
    cone(pj.st, 0.1, 0.22, 10, mat(TILE), -pj.len / 2, 0.7, -pj.dep / 2);
  }
  // Tour des Fromages, à l'entrée de l'abbaye côté ville
  {
    const tf = atMap(-76, -22, 0);
    hollow(kitOf(tf), { w: 0.3, d: 0.3, h: 1.15, floors: 2, stair: 'spiral', wall: STD, inner: 0xe0d2b4, furnish: 'none', seed: 10, doorW: 0.09, toRoof: true });
    for (const y of [0.45, 0.85]) box(tf, 0.05, 0.12, 0.02, dark, 0, y, 0.155);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(tf, 0.07, 0.06, 0.07, mat(STD), sx * 0.12, 1.15, sz * 0.12);
  }

  // ---- Ateliers d'Arts et Métiers (vert) : grande halle à toits en sheds ----
  {
    const cx = 165, cz = -85;
    const st = atMap(cx, cz, Math.PI / 2);
    const L = span(cx, cz, Math.PI / 2, 138), D = span(cx, cz, 0, 62);
    const k = kitOf(st);
    hollow(k, { w: L, d: D, h: 0.3, floors: 1, wall: 0xe6d3a6, inner: 0xe8e2d6, doors: { '+z': 0, '-z': 0, '+x': 0 }, doorW: 0.14, doorH: 0.2, furnish: 'workshop', seed: 33 });
    faceBands(k, L, D, 0, 0, 0, 0.05, 0xb5664a, { out: 0.008 });
    const n = Math.max(6, Math.round(L / 0.2));
    for (let i = 0; i < n; i++) {
      const sx = -L / 2 + (L / n) * (i + 0.5), w = L / n;
      // Shed : versant de tuile au sud, vitrage vertical au nord
      k.box(w * 1.08, 0.012, D, sx, 0.345, 0, i % 2 ? 0x855544 : 0x93604a, { collide: false, rotZ: 0.42 });
      k.box(0.01, 0.085, D * 0.97, sx + w / 2 - 0.006, 0.3, 0, 0x9fbccd, { collide: false });
      for (const sz of [-1, 1]) k.box(w, 0.09, 0.012, sx, 0.3, sz * (D / 2 - 0.006), 0xe6d3a6, { collide: false });
    }
    for (let i = 0; i < 10; i++) for (const sz of [-1, 1]) arch(st, 0.11, 0.2, mat(0x3f4a55), -L / 2 + (L * (i + 0.5)) / 10, 0.05, sz * (D / 2 + 0.004));
    // Cheminée de la fonderie
    k.cyl(0.035, 0.05, 0.9, L / 2 - 0.2, 0, D / 2 + 0.12, 0xb5664a, { seg: 10 });
  }
  // ---- Jardins : tilleuls taillés du parterre, grands arbres du parc ----
  for (const [x, z] of [[46, 4], [46, 20], [46, 40], [46, 58], [72, 4], [72, 20], [72, 40], [72, 58], [59, 12], [59, 48]]) {
    const tr = atMap(x, z, 0, false);
    cone(tr, 0.05, 0.11, 8, mat(0x3e6a35), 0, 0, 0);
    tr.userData.colliders = { boxes: [], cyls: [[0, 0, 0.04, -0.05, 0.1]], rings: [] };
  }
  for (const [x, z, s] of [[112, 62, 1.7], [150, 20, 1.2], [215, 70, 1.3], [226, -40, 1.2], [110, -20, 1.0], [190, 80, 1.1], [150, 88, 1.0], [232, 10, 1.0]]) {
    const tr = atMap(x, z, 0, false); tree(tr, 0, 0, 0, s, 0x4f7c3f);
    tr.userData.colliders = { boxes: [], cyls: [[0, 0, 0.05, -0.05, 0.4]], rings: [] };
  }
  // ---- Farinier (beige) et tour du Moulin ----
  {
    const fa = atMap(95, 108, Math.PI / 2);
    const L = span(95, 108, Math.PI / 2, 38), D = span(95, 108, 0, 14) * 1.2;
    const k = kitOf(fa);
    hollow(k, { w: L, d: D, h: 0.46, floors: 2, wall: ST, inner: 0xd8c8a6, doors: { '-z': 0.1 }, furnish: 'hall', seed: 9 });
    gableRoof(fa, L, 0.3, D, mat(TILE), 0, 0.46, 0);
    for (let x = -L / 2 + 0.1; x < L / 2; x += 0.2) for (const sz of [-1, 1]) k.box(0.05, 0.38, 0.05, x, 0, sz * (D / 2 + 0.02), ST);
    const tm = atMap(95, 132, 0);
    hollow(kitOf(tm), { w: 0.26, d: 0.26, h: 0.8, floors: 2, stair: 'spiral', wall: STD, inner: 0xe0d2b4, furnish: 'none', seed: 12, doorW: 0.08 });
    cone(tm, 0.22, 0.2, 4, mat(TILE), 0, 0.8, 0, [0, Math.PI / 4, 0]);
  }
  // ---- Enceinte (marron) et tours ----
  wallLine(CL.wallA, { h: 0.26, w: 0.06, merlons: true, walk: true, color: STD });
  wallLine(CL.wallB, { h: 0.26, w: 0.06, merlons: true, walk: true, color: STD });
  // Tour Ronde (jaune) : haut fût cylindrique, corbeaux de hourds, tourelle d'escalier polygonale, toit conique bas
  {
    const tr = atMap(267, -138, 0);
    const k = kitOf(tr), r = 0.2, h = 1.5;
    hollow(k, { w: r * 1.35, d: r * 1.35, h: h * 0.92, floors: 3, stair: 'spiral', wall: STD, inner: 0xd8c8a6, furnish: 'none', seed: 31, doorW: 0.08, doors: { '+z': 0 } });
    add(tr, new THREE.CylinderGeometry(r * 0.96, r * 1.06, h, 18, 1, true, 0.22, Math.PI * 2 - 0.44), mat(STD), 0, h / 2, 0);
    k.ring(0, 0, r, 0, h, [[-0.22, 0.22]]);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; k.box(0.02, 0.02, 0.07, Math.sin(a) * (r + 0.02), h * 0.76, Math.cos(a) * (r + 0.02), 0x5a4634, { collide: false, rotY: a }); }
    for (const [a, y] of [[0.6, 0.55], [2.4, 0.9], [4.0, 0.4], [5.2, 1.1], [1.5, 1.25], [3.3, 1.25]]) k.box(0.014, 0.07, 0.012, Math.sin(a) * r, y, Math.cos(a) * r, 0x221d18, { collide: false, rotY: a });
    cyl(tr, r * 1.12, r * 1.0, 0.03, 18, mat(0x6b6f5c), 0, h, 0);
    cone(tr, r * 1.14, 0.3, 18, mat(0x6f7360), 0, h + 0.03, 0);
    // Tourelle demi-hexagonale côté ouest, coiffée d'un petit toit
    add(tr, new THREE.CylinderGeometry(0.09, 0.1, h * 0.58, 6), mat(ST), -r * 0.92, h * 0.29, 0.02);
    add(tr, new THREE.ConeGeometry(0.13, 0.08, 6), mat(0x6f7360), -r * 0.92, h * 0.58 + 0.06, 0.02);
  }
  // Tour Fabry (angle nord de l'enceinte), élancée, toit pointu
  {
    const tf = atMap(127, -190, 0);
    const k = kitOf(tf);
    hollow(k, { w: 0.2, d: 0.2, h: 0.85, floors: 2, stair: 'spiral', wall: STD, inner: 0xd8c8a6, furnish: 'none', seed: 30, doorW: 0.07 });
    cyl(tf, 0.14, 0.15, 0.9, 14, mat(STD), 0, 0, 0);
    cone(tf, 0.16, 0.5, 14, mat(TILE), 0, 0.9, 0);
  }
  // ---- Haras national (au nord de l'enceinte) : écuries autour d'une cour ----
  range(212, -246, 0.15, 80, 12, { h: 0.3, floors: 1, wall: 0xe6dcc6, roofH: 0.14, furnish: 'hall', seed: 34 });
  range(178, -226, 0.15 + Math.PI / 2, 34, 11, { h: 0.3, floors: 1, wall: 0xe6dcc6, roofH: 0.14, furnish: 'hall', seed: 35 });
  range(248, -216, 0.15 + Math.PI / 2, 34, 11, { h: 0.3, floors: 1, wall: 0xe6dcc6, roofH: 0.14, furnish: 'hall', seed: 36 });
  // ---- En ville : Notre-Dame et Saint-Marcel (clocher octogonal à flèche) ----
  for (const [x, z, spire, seed] of [[-150, -60, 0.45, 35], [-60, 250, 0.9, 36]]) {
    const ch = atMap(x, z, 0);
    const L = span(x, z, 0, 44), D = span(x, z, Math.PI / 2, 17) * 1.3;
    hollow(kitOf(ch), { w: L, d: D, h: 0.4, floors: 1, wall: ST, inner: 0xe8dcc0, doors: { '-x': 0 }, furnish: 'church', seed });
    gableRoof(ch, L, 0.26, D, mat(TILE), 0, 0.4, 0);
    cyl(ch, 0.11, 0.11, 0.5, 8, mat(ST), L * 0.2, 0.4, 0);
    cone(ch, 0.12, spire, 8, mat(spire > 0.6 ? TILE : SLATE), L * 0.2, 0.9, 0);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Arts et Métiers, campus de Paris (151 bd de l'Hôpital, Georges Roussi, 1912)
// Façade en pierre de quatre niveaux sous toit de zinc, avant-corps central à grande porte cintrée,
// halles technologiques en brique polychrome (grande baie centrale, toits en sheds), boulevard arboré.
// ---------------------------------------------------------------------------
export function ensamParis(R = 4) {
  const g = new THREE.Group();
  Object.assign(g.userData, country({ seed: 5, amp: 0.22, river: { n: V3(-0.2, -0.3, -1), a: V3(1, 0, -0.2), b: V3(0, 1, -0.3), c: 0.4, w: 0.1, depth: 0.16 }, tones: { bed: 0x6f8f8a, rock: 0xd8d2c2, wood: 0x4a6a3e, grass: 0xa9a48f } }));
  // Façade sur le boulevard de l'Hôpital, cour intérieure pavée bordée d'ailes, halles au fond
  const court = sphereBand(R, 0, 0.62, 0xcfc6b4, 0.0042);
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
  Object.assign(g.userData, country({ seed: 7, amp: 0.3, river: { n: V3(1, -0.3, 0.2), a: V3(-0.2, 0, 1), b: V3(0.3, 1, 0), c: 0.45, w: 0.09, depth: 0.16 }, tones: { bed: 0x6e8e86, rock: 0xcbb98f, wood: 0x3b5c33, grass: 0x7da453, fields: [0x86aa58, 0x9bb463, 0x6f9648, 0xb5b56a, 0x7da453] } }));
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
  Object.assign(g.userData, country({ seed: 9, amp: 0.62, cliffs: 0.3, sea: { n: V3(-0.55, -0.35, 0.75), c: 0.28, depth: 0.3, islands: true }, tones: { bed: 0xd9cfa8, beach: 0xe6dcb8, rock: 0xefeadc, wood: 0x5d7a45, grass: 0xb9ad7c } }));
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
// ---------------------------------------------------------------------------
// Meudon d'après la carte. La lune a deux niveaux : le plateau (rayon R : observatoire, forêt,
// étang de Bel-Air) et la moitié basse creusée de H (jardins, ville, RER). La limite est un plan
// passant par le centre (deux moitiés de même surface) : s = n·d = 0.
// La carte (pixels de la vue aérienne annotée) est projetée sur la lune : la Grande Coupole au pôle,
// projection azimutale dont l'échelle se resserre vers le bord pour que toute la zone haute tienne
// sur le plateau. Le bord de la terrasse de la carte tombe alors sur le grand cercle limite.
// ---------------------------------------------------------------------------
export const MEUDON = { H: 0.8, Z0: 0.75, R: 4, TRACK: 0.68, K: 0.75 / Math.sqrt(16 - 0.5625), spots: [] };
const MN = new THREE.Vector3(0, -MEUDON.K, 1).normalize();   // normale de la limite (vers le bas)
const MA = new THREE.Vector3(0, 1, MEUDON.K).normalize();    // point de la limite au pied du château
const ME = new THREE.Vector3(1, 0, 0);
export function meudonS(d) { return d.dot(MN); }
// Abscisse le long de la limite (0 au pied du château, croissante vers l'est)
const meudonT = (d) => Math.atan2(d.dot(ME), d.dot(MA));
const TERR = { T0: -0.475, T1: 1.425, dT: 0.19 };
function meudonSharp(d) {
  if (d.dot(MA) < 0) return 0;
  const t = meudonT(d);
  return THREE.MathUtils.smoothstep(t, TERR.T0 - 0.06, TERR.T0 + 0.01) * (1 - THREE.MathUtils.smoothstep(t, TERR.T1 - 0.01, TERR.T1 + 0.06));
}
// Repère au bord de la terrasse : x le long du mur (vers l'est), y vertical, z vers le bas ; off = décalage vers le bas
function terraceFrame(t, off = 0, R = 4) {
  const B = MA.clone().multiplyScalar(Math.cos(t)).addScaledVector(ME, Math.sin(t));
  const T = MA.clone().multiplyScalar(-Math.sin(t)).addScaledVector(ME, Math.cos(t));
  const dir = B.multiplyScalar(Math.cos(off / R)).addScaledVector(MN, Math.sin(off / R)).normalize();
  const Z = new THREE.Vector3().crossVectors(T, dir);
  return { dir, quat: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(T, dir, Z)) };
}
// Projection de la carte
const MM = { x0: 300, y0: 578, k0: 0.00533, r0: 495 };
export function meudonMapDir(px, py) {
  const dx = px - MM.x0, dy = py - MM.y0, r = Math.hypot(dx, dy);
  if (r < 1e-6) return UP.clone();
  const f = (MM.k0 * r) / (1 + r / MM.r0);
  return new THREE.Vector3((Math.sin(f) * dx) / r, Math.cos(f), (Math.sin(f) * dy) / r);
}
export function meudonDirMap(d) {
  const f = Math.acos(THREE.MathUtils.clamp(d.y, -1, 1));
  const den = MM.k0 - f / MM.r0;
  if (den < 1e-4) return null;
  const r = f / den, h = Math.hypot(d.x, d.z);
  if (h < 1e-9) return [MM.x0, MM.y0];
  return [MM.x0 + (r * d.x) / h, MM.y0 + (r * d.z) / h];
}
function inPoly([x, y], P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function segDist([x, y], L) {
  let m = Infinity;
  for (let i = 0; i < L.length - 1; i++) {
    const [ax, ay] = L[i], [bx, by] = L[i + 1], vx = bx - ax, vy = by - ay;
    const u = THREE.MathUtils.clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy), 0, 1);
    m = Math.min(m, Math.hypot(x - ax - u * vx, y - ay - u * vy));
  }
  return m;
}
// Éléments de la carte (pixels)
const MZ = {
  // Clairières et prairies du plateau (le reste est la forêt domaniale)
  meadow: [
    [[150, 560], [165, 505], [195, 455], [235, 415], [272, 382], [330, 365], [380, 385], [420, 410], [470, 400], [530, 395], [568, 420], [592, 470], [602, 522], [590, 562], [540, 578], [420, 590], [300, 600], [200, 600]],
    [[205, 125], [340, 118], [348, 210], [420, 232], [415, 266], [352, 276], [342, 362], [265, 372], [203, 352], [198, 230]],
    [[722, 492], [906, 488], [916, 582], [718, 586]],
  ],
  // Routes forestières
  roads: [
    [[392, 232], [372, 330], [348, 420], [330, 520], [318, 560]],
    [[392, 232], [600, 278], [880, 322]],
    [[852, 140], [878, 300], [904, 420], [916, 520]],
  ],
  // Pièce d'eau du Bel-Air : ellipse (centre, demi-axes, angle)
  lake: { cx: 728, cy: 452, a: 128, b: 38, rot: -0.09 },
  // Jardin bas : parterres de la terrasse de l'Observatoire et jardin sous le château
  garden: [[[372, 628], [796, 620], [798, 756], [372, 760]], [[205, 622], [372, 622], [372, 700], [205, 700]]],
  lawns: [
    [[392, 650], [780, 646], [782, 688], [392, 692]],
    [[402, 706], [776, 702], [778, 742], [404, 744]],
    [[228, 640], [285, 640], [285, 690], [228, 690]], [[315, 640], [362, 640], [362, 690], [315, 690]],
  ],
};
const lakeE = ([x, y]) => {
  const L = MZ.lake, dx = x - L.cx, dy = y - L.cy, c = Math.cos(L.rot), s = Math.sin(L.rot);
  const u = dx * c + dy * s, v = -dx * s + dy * c;
  return Math.sqrt((u / L.a) ** 2 + (v / L.b) ** 2);
};
const inAny = (m, list) => list.some((P) => inPoly(m, P));
function meudonRelief(d) {
  const s = meudonS(d), sh = meudonSharp(d);
  // Sous la terrasse, la rupture est brutale (noyée dans le mur) ; ailleurs, pente boisée
  const sharp = THREE.MathUtils.smoothstep(s, -0.062, -0.022);
  const wide = THREE.MathUtils.smoothstep(s, -0.16, 0.16);
  let h = -MEUDON.H * THREE.MathUtils.lerp(wide, sharp, sh);
  if (s < -0.1) {
    const m = meudonDirMap(d);
    if (m) { const e = lakeE(m); if (e < 1.05) h -= 0.13 * (1 - THREE.MathUtils.smoothstep(e, 0.72, 1.0)); }
  }
  return h;
}
function meudonFlatten(d) {
  // Plates-formes : voie ferrée, bord de terrasse, jardin bas, rives de l'étang
  let f = 1 - THREE.MathUtils.smoothstep(Math.abs(d.z - MEUDON.TRACK), 0.03, 0.055);
  const s = meudonS(d), sh = meudonSharp(d);
  f = Math.max(f, sh * (1 - THREE.MathUtils.smoothstep(Math.abs(s), 0.13, 0.18)));
  const m = meudonDirMap(d);
  if (m) {
    if (s > 0 && inAny(m, MZ.garden)) f = 1;
    if (s < 0) f = Math.max(f, 1 - THREE.MathUtils.smoothstep(lakeE(m), 1.3, 2.0), inAny(m, MZ.meadow) ? 0.6 : 0);
  }
  return f;
}
function meudonPaint(d) {
  const s = meudonS(d), m = meudonDirMap(d);
  if (s < -0.005) {
    if (!m) return 0x3b5531;
    if (lakeE(m) < 1.06) return 0x5f6e48;
    if (segDist(m, MZ.roads[0]) < 4.5 || segDist(m, MZ.roads[1]) < 4.5 || segDist(m, MZ.roads[2]) < 4.5) return 0xb7a985;
    if (inAny(m, MZ.meadow)) return 0x9d9a60;
    return 0x3e5933;
  }
  if (s > 0.005 && m) {
    if (inAny(m, MZ.lawns)) return 0x78a24c;
    if (inAny(m, MZ.garden)) return 0xd4c7a2;
  }
  return null;
}
export function meudonZone(d) {
  const s = meudonS(d), sh = meudonSharp(d);
  const m = meudonDirMap(d);
  if (s >= 0) {
    if (sh < 0.5 && s < 0.16) return 'slope';
    if (m && inAny(m, MZ.garden)) return 'garden';
    return 'low';
  }
  if (sh > 0.5 ? s > -0.1 : s > -0.16) return sh > 0.5 ? 'wall' : 'slope';
  for (const sp of MEUDON.spots) if (d.angleTo(sp.dir) < sp.r) return 'built';
  if (!m) return 'high';
  if (lakeE(m) < 1.3) return 'lake';
  if (MZ.roads.some((L) => segDist(m, L) < 7)) return 'road';
  if (inAny(m, MZ.meadow)) return 'meadow';
  return 'high';
}

export function observatoireMeudon(R = 4) {
  const g = new THREE.Group();
  g.userData.relief = meudonRelief;
  g.userData.flatten = meudonFlatten;
  g.userData.paint = meudonPaint;
  // Le Château-Neuf repose sur un soubassement, au bord de la terrasse ; escalier à double révolution
  const c0 = structure(g, 0, -0.15);
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
    wing(s, { len: 0.8, depth: 0.62, h: 0.72, floors: 2, wall: 0xe4d4b4, flat: true, furnish: 'observatory', doors: { '+z': 0 }, seed: 19 + sx });
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
  // ---- Placement d'après la carte ----
  const H = MEUDON.H;
  MEUDON.spots.length = 0;
  const A = (deg) => (deg * Math.PI) / 180;
  // Structure posée au point (px, py) de la carte ; ang = orientation du grand axe sur la carte (y vers le bas)
  const atMap = (px, py, ang = 0, plinth = true) => {
    const st = structure(g, 0, 0, -ang, plinth);
    st.userData.dir = meudonMapDir(px, py);
    return st;
  };
  // Longueur réelle (unités lune) d'un segment de la carte, mesurée sur la projection
  const span = (px, py, ang, L) => meudonMapDir(px - (Math.cos(ang) * L) / 2, py - (Math.sin(ang) * L) / 2)
    .angleTo(meudonMapDir(px + (Math.cos(ang) * L) / 2, py + (Math.sin(ang) * L) / 2)) * R;
  const spot = (px, py, r) => MEUDON.spots.push({ dir: meudonMapDir(px, py), r: r / R });
  const box2 = (px, py, ang, Lpx, Wpx, k = 1) => ({ len: span(px, py, ang, Lpx) * k, dep: span(px, py, ang + Math.PI / 2, Wpx) * k });
  // Bâtiment rectangulaire (labo moderne à toit plat, ou pavillon à toit d'ardoise)
  const lab = (px, py, ang, Lpx, Wpx, { h = 0.3, floors = 1, flat = true, wall = 0xe9e6de, k = 1, furnish = 'observatory', seed = 40 } = {}) => {
    const { len, dep } = box2(px, py, ang, Lpx, Wpx, k);
    const st = atMap(px, py, ang);
    wing(st, { len, depth: Math.max(dep, 0.16), h, floors, wall, flat, mansard: !flat, roofH: 0.18, furnish, doors: { '+z': 0 }, seed });
    spot(px, py, Math.hypot(len, dep) / 2 + 0.06);
    return st;
  };
  // Quadrilatère autour d'une cour (ou deux), ailes à combles d'ardoise
  const quad = (px, py, ang, Lpx, Wpx, { h = 0.42, floors = 2, wall = 0xe2d6bd, k = 1, courts = 1, seed = 50 } = {}) => {
    const { len, dep } = box2(px, py, ang, Lpx, Wpx, k);
    const wd = Math.min(0.2, dep * 0.3);
    const c = Math.cos(ang), s = Math.sin(ang);
    const put = (ox, oz, a, L, d, sd) => {
      // ox, oz en unités dans le repère du bâtiment → pixels de carte
      const mx = px + (ox * c) * (Lpx / len) - (oz * s) * (Wpx / dep), my = py + (ox * s) * (Lpx / len) + (oz * c) * (Wpx / dep);
      const st = atMap(mx, my, ang + a);
      wing(st, { len: L, depth: d, h, floors, wall, mansard: true, roofH: 0.14, furnish: 'office', doors: { '+z': 0 }, seed: sd });
    };
    put(0, -(dep - wd) / 2, 0, len, wd, seed);
    put(0, (dep - wd) / 2, 0, len, wd, seed + 1);
    for (let i = 0; i <= courts; i++) {
      const ox = -len / 2 + wd / 2 + (i * (len - wd)) / courts;
      put(ox, 0, Math.PI / 2, dep - 2 * wd + 0.01, wd, seed + 2 + i);
    }
    spot(px, py, Math.hypot(len, dep) / 2 + 0.06);
  };
  // Petite coupole (table équatoriale)
  const dome = (px, py, r = 0.16) => {
    const st = atMap(px, py, 0);
    const k = kitOf(st);
    // Tambour cylindrique blanc, soubassement, bandeau, porte et galerie à garde-corps
    k.cyl(r * 1.08, r * 1.12, 0.05, 0, 0, 0, 0xcfc8ba, { seg: 20 });
    k.cyl(r, r, 0.27, 0, 0.05, 0, 0xf1eee6, { seg: 20 });
    k.cyl(r * 1.1, r * 1.1, 0.018, 0, 0.3, 0, 0xd9d4c8, { seg: 20, collide: false });
    k.box(0.05, 0.11, 0.012, 0, 0.05, r - 0.002, 0x5a4634, { collide: false });
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.8; k.box(0.035, 0.05, 0.01, Math.sin(a) * r, 0.18, Math.cos(a) * r, 0x9fc0d8, { collide: false, glow: true, rotY: a }); }
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; k.box(0.006, 0.04, 0.006, Math.sin(a) * r * 1.08, 0.318, Math.cos(a) * r * 1.08, 0x8f979e, { collide: false }); }
    add(st, new THREE.TorusGeometry(r * 1.08, 0.004, 4, 28), mat(0x8f979e), 0, 0.36, 0, [Math.PI / 2, 0, 0]);
    // Coupole à cimier ouvert, orientée vers l'amas ; la lunette dépasse par la trappe
    const top = new THREE.Group(); top.position.y = 0.32; top.rotation.y = 2.2 + px * 0.01; st.add(top);
    const GAPD = 0.5;
    const shell = new THREE.SphereGeometry(r * 1.02, 22, 9, Math.PI / 2 + GAPD / 2, Math.PI * 2 - GAPD, 0, Math.PI / 2);
    top.add(new THREE.Mesh(shell, new THREE.MeshStandardMaterial({ color: 0xf4f3ee, metalness: 0.2, roughness: 0.6, flatShading: true })));
    top.add(new THREE.Mesh(shell, new THREE.MeshStandardMaterial({ color: 0x2c2d33, side: THREE.BackSide })));
    for (const sgn of [-1, 1]) add(top, new THREE.TorusGeometry(r * 1.03, 0.005, 4, 14, Math.PI / 2), mat(0xaab2b8), 0, 0, 0, [0, sgn * (GAPD / 2) - Math.PI / 2 + (sgn > 0 ? 0 : 0), 0]);
    const tube = new THREE.CylinderGeometry(r * 0.16, r * 0.14, r * 1.5, 10); tube.rotateX(Math.PI / 2);
    const tb = add(top, tube, mat(0xe8e6e0), 0, r * 0.28, r * 0.25); tb.rotation.x = -0.75;
    add(top, new THREE.CylinderGeometry(r * 0.17, r * 0.17, 0.012, 10), mat(0x30343a), 0, r * 0.28 + Math.sin(0.75) * r * 0.75, r * 0.25 + Math.cos(0.75) * r * 0.75, [Math.PI / 2 - 0.75, 0, 0]);
    cyl(top, r * 0.1, r * 0.14, r * 0.3, 8, mat(0x5a5f66), 0, 0, 0);
    spot(px, py, r * 1.6 + 0.05);
  };

  // ---- Terrasse : mur de soutènement le long du bord du plateau (grand cercle limite) ----
  // Volées d'escalier : départ en haut (abscisse tTop le long du mur), sens de descente
  const STAIRS = [{ tTop: -0.41 / R, dir: -1 }, { tTop: 0.41 / R, dir: 1 }, { tTop: 0.95, dir: 1 }];
  const nSteps = Math.ceil(H / M(0.19)), rise = H / nSteps, run = 0.95 / nSteps;
  for (let i = Math.round(TERR.T0 / TERR.dT + 0.5); i <= Math.round(TERR.T1 / TERR.dT - 0.5); i++) {
    const t = i * TERR.dT;
    const w = new THREE.Group(); g.add(w);
    const fr = terraceFrame(t, 0, R);
    Object.assign(w.userData, { dir: fr.dir, quat: fr.quat, lift: 0, plinth: false });
    const kw = kitOf(w);
    const L = TERR.dT * R + 0.02;
    const brick = i === 0;
    // Parement (pierre, partie centrale en brique), corps épais dont le dessus est le sol de la terrasse
    kw.box(L, H + 0.6, 0.06, 0, -H - 0.6, -0.03, brick ? 0xa8664c : 0xcdbd9c);
    kw.box(L, H + 0.6, 0.36, 0, -H - 0.6, -0.24, 0xbfae8c);
    kw.box(L + 0.01, 0.006, 0.36, 0, -0.004, -0.24, 0xcfc3a3, { collide: false });
    kw.box(L + 0.02, 0.025, 0.08, 0, 0, -0.03, 0xe6dcc6, { collide: false });
    for (const by of [-H * 0.33, -H * 0.66]) kw.box(L + 0.01, 0.012, 0.065, 0, by, -0.03, 0xb3a283, { collide: false });
    if (brick) for (const nx of [-0.25, 0, 0.25]) kw.box(0.08, 0.16, 0.01, nx, -H + 0.08, 0.005, 0x4a3326, { collide: false });
    // Balustrade, ouverte au-dessus des escaliers
    const gaps = STAIRS.map(({ tTop, dir }) => [(tTop - t) * R - 0.11 + dir * 0.06, (tTop - t) * R + 0.11 + dir * 0.06]);
    const open = (x) => gaps.some(([a0, a1]) => x > a0 && x < a1);
    for (let x = -L / 2 + 0.025; x < L / 2; x += 0.05) if (!open(x)) kw.box(0.012, 0.05, 0.012, x, 0, -0.02, 0xefe7d6, { collide: false });
    let a0 = null;
    for (let x = -L / 2; x <= L / 2 + 1e-6; x += 0.01) {
      const o = open(x) || x > L / 2 - 0.005;
      if (!o && a0 === null) a0 = x;
      if (o && a0 !== null) {
        if (x - a0 > 0.02) { kw.box(x - a0, 0.015, 0.03, (a0 + x) / 2, 0.05, -0.02, 0xefe7d6); kw.solid(a0, 0, -0.035, x, 0.07, -0.005); }
        a0 = null;
      }
    }
  }
  // Escaliers adossés au mur, du haut de la terrasse jusqu'au jardin
  for (const { tTop, dir } of STAIRS) {
    const st = new THREE.Group(); g.add(st);
    const fr = terraceFrame(tTop + (dir * 0.475) / R, 0.075, R);
    Object.assign(st.userData, { dir: fr.dir, quat: fr.quat, lift: 0, plinth: false });
    const ks = kitOf(st);
    for (let i = 0; i < nSteps; i++) {
      const xi = -dir * 0.475 + dir * (i * run + run / 2);
      ks.box(run + 0.002, H + 0.6 - (i + 1) * rise, 0.12, xi, -H - 0.6, 0, 0xc8bca6);
    }
    for (let i = 0; i < nSteps; i += 6) ks.box(run * 6, 0.05, 0.012, -dir * 0.475 + dir * (i + 3) * run, -(i + 3) * rise, 0.065, 0xefe7d6, { collide: false });
  }

  // ---- Jardin bas (sous la terrasse) ----
  // Bassin circulaire sous le château, entre les deux parterres
  {
    const bs = atMap(300, 664, 0, false);
    add(bs, new THREE.TorusGeometry(0.26, 0.02, 6, 40), mat(0xd8cfbd), 0, 0.02, 0, [Math.PI / 2, 0, 0]);
    const pool = add(bs, new THREE.CircleGeometry(0.25, 40), new THREE.MeshStandardMaterial({ color: 0x5a8fa8, roughness: 0.2, emissive: 0x0b2c44, emissiveIntensity: 0.3 }), 0, 0.012, 0, [-Math.PI / 2, 0, 0]);
    pool.userData.water = true;
    kitOf(bs).ring(0, 0, 0.26, -0.02, 0.04);
  }
  // Allées d'arbres taillés de la grande perspective (trois rangées), haies basses le long des parterres
  for (const y of [640, 698, 752]) {
    for (let x = 384; x <= 786; x += 22) {
      const tr = atMap(x, y - (x - 384) * 0.01, 0, false);
      tree(tr, 0, 0, 0, 0.85, 0x3f6a34);
      tr.userData.colliders = { boxes: [], cyls: [[0, 0, 0.03, -0.05, 0.25]], rings: [] };
    }
  }
  // La Loggia : petit pavillon et son jardin carré
  {
    const lg = atMap(262, 728, 0);
    const { len, dep } = box2(262, 728, 0, 70, 34, 1.2);
    wing(lg, { len, depth: dep, h: 0.24, floors: 1, wall: 0xe9dfca, flat: true, furnish: 'hall', doors: { '+z': 0 }, seed: 60 });
  }

  // ---- Plateau : bâtiments de l'observatoire, d'après la carte ----
  // Laboratoires au nord-ouest : grand quadrilatère, bâtiment en L, bâtiment de la tour solaire
  quad(287, 170, A(-7), 86, 80, { h: 0.4, floors: 2, k: 1.15, seed: 52 });
  lab(231, 252, A(88), 62, 24, { h: 0.26, k: 1.15, seed: 41 });
  lab(288, 234, A(-6), 92, 16, { h: 0.26, k: 1.15, seed: 42 });
  lab(255, 327, A(-7), 96, 18, { h: 0.3, floors: 2, k: 1.15, seed: 43 });
  // Tour solaire (jaune sur la carte) : fût cylindrique blanc, plate-forme en soucoupe vitrée
  {
    const ts = atMap(219, 298, 0, false);
    const kt = kitOf(ts), TW = 0.22, TH = 1.6;
    // Fût creux : on y entre, un escalier à vis monte jusqu'à la plate-forme d'observation
    hollow(kt, { w: TW, d: TW, h: TH, floors: 5, stair: 'spiral', wall: 0xeeeeea, inner: 0xe6e6e2, floorCol: 0x8f979e, furnish: 'none', seed: 61, doorW: 0.08, toRoof: true, lamps: true });
    add(ts, new THREE.CylinderGeometry(0.15, 0.16, TH, 18, 1, true, 0.3, Math.PI * 2 - 0.6), mat(0xeeeeea), 0, TH / 2, 0);
    for (let i = 0; i < 6; i++) kt.box(0.02, 0.07, 0.01, 0.06, 0.3 + i * 0.22, TW / 2 + 0.002, 0x9fc8e0, { collide: false, glow: true });
    // Soucoupe : plancher praticable autour de la trémie, garde-corps, lanterne vitrée et cœlostat
    cyl(ts, 0.36, 0.14, 0.16, 28, mat(0xeeeeea), 0, TH - 0.17, 0);
    cyl(ts, 0.37, 0.37, 0.012, 28, mat(0xdcdcd8), 0, TH - 0.012, 0);
    const hw = TW / 2;
    kt.solid(-0.36, TH - 0.03, hw, 0.36, TH, 0.36); kt.solid(-0.36, TH - 0.03, -0.36, 0.36, TH, -hw);
    kt.solid(hw, TH - 0.03, -hw, 0.36, TH, hw); kt.solid(-0.36, TH - 0.03, -hw, -hw, TH, hw);
    kt.ring(0, 0, 0.36, TH, TH + 0.06);
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; kt.box(0.008, 0.055, 0.008, Math.sin(a) * 0.36, TH, Math.cos(a) * 0.36, 0x8f979e, { collide: false }); }
    add(ts, new THREE.TorusGeometry(0.36, 0.005, 4, 32), mat(0x8f979e), 0, TH + 0.058, 0, [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; kt.box(0.012, 0.2, 0.012, Math.sin(a) * 0.3, TH, Math.cos(a) * 0.3, 0xdcdcd8, { collide: false }); }
    add(ts, new THREE.SphereGeometry(0.33, 28, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x8c9298), 0, TH + 0.2, 0).scale.y = 0.22;
    add(ts, new THREE.CylinderGeometry(0.05, 0.05, 0.008, 14), new THREE.MeshStandardMaterial({ color: 0xcfe6ff, metalness: 0.9, roughness: 0.1, emissive: 0x6688aa, emissiveIntensity: 0.5 }), 0.2, TH + 0.1, 0, [0.9, 0.4, 0]);
    spot(219, 298, 0.25);
  }
  // Coupoles et tables équatoriales de la prairie
  lab(292, 486, A(90), 46, 20, { h: 0.24, seed: 44 }); dome(292, 456, 0.15);
  lab(352, 500, A(75), 40, 22, { h: 0.24, seed: 45 }); dome(346, 474, 0.14);
  lab(436, 452, A(1), 74, 20, { h: 0.24, seed: 46 }); dome(394, 451, 0.15);
  dome(485, 506, 0.13);
  // Interféromètre solaire : rangée d'instruments est-ouest dans la prairie
  {
    const it = atMap(470, 532, A(2));
    const ki = kitOf(it);
    const L = span(470, 532, 0, 110);
    ki.box(L, 0.02, 0.08, 0, 0, 0, 0xc8c4bc);
    for (let i = 0; i < 6; i++) {
      const ix = -L / 2 + 0.08 + (i * (L - 0.16)) / 5;
      ki.cyl(0.02, 0.025, 0.12, ix, 0.02, 0, 0xe8e8e4);
      add(it, new THREE.SphereGeometry(0.06, 12, 5, 0, Math.PI * 2, 0, Math.PI / 3), mat(0xf2f2f0, { side: THREE.DoubleSide }), ix, 0.2, 0, [Math.PI * 0.75, 0, 0]);
    }
    spot(470, 532, L / 2 + 0.1);
  }
  // Antennes de radioastronomie
  for (const [px, py, sc] of [[540, 455, 1.1], [574, 500, 0.9], [560, 552, 1.0]]) {
    const a = atMap(px, py, 0, false);
    a.userData.colliders = { boxes: [], cyls: [[0, 0, 0.05 * sc, -0.05, 0.3 * sc]], rings: [] };
    cyl(a, 0.025 * sc, 0.04 * sc, 0.3 * sc, 8, mat(0xd8dce0), 0, 0, 0);
    add(a, new THREE.SphereGeometry(0.22 * sc, 18, 6, 0, Math.PI * 2, 0, Math.PI / 3), mat(0xf0f0ee, { side: THREE.DoubleSide }), 0, 0.42 * sc, 0, [Math.PI * 0.7, 0.4, 0]);
    spot(px, py, 0.25 * sc);
  }
  // Anciennes écuries (communs) : long quadrilatère à deux cours, au bout de la terrasse
  quad(822, 522, A(-2), 152, 56, { h: 0.36, floors: 2, k: 1.15, courts: 2, seed: 55 });
  // Pièce d'eau du Bel-Air : surface d'eau qui épouse la cuvette creusée dans la lune
  {
    const Lk = MZ.lake, NR = 10, NA = 72;
    const pos = [], idx = [];
    const Rw = R - 0.05;
    for (let i = 0; i <= NR; i++) for (let j = 0; j < NA; j++) {
      const rr = (i / NR) * 1.04, a = (j / NA) * Math.PI * 2;
      const u = Lk.a * rr * Math.cos(a), v = Lk.b * rr * Math.sin(a);
      const d = meudonMapDir(Lk.cx + u * Math.cos(Lk.rot) - v * Math.sin(Lk.rot), Lk.cy + u * Math.sin(Lk.rot) + v * Math.cos(Lk.rot));
      pos.push(d.x * Rw, d.y * Rw, d.z * Rw);
    }
    for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++) {
      const a = i * NA + j, b = i * NA + ((j + 1) % NA), c = a + NA, d = b + NA;
      idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const water = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x6f9a86, roughness: 0.15, emissive: 0x0b2c3a, emissiveIntensity: 0.3, side: THREE.DoubleSide }));
    water.userData.water = true; water.userData.noDrape = true;
    g.add(water);
  }

  // RER C : voie ferrée en cercle autour de la partie basse, gare de Meudon-Val-Fleury, train qui circule
  const ZT = MEUDON.TRACK, th = Math.acos(ZT);
  const toZ = new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(0, 0, 1));
  const rail = new THREE.Group(); rail.userData.noDrape = true; g.add(rail);
  for (const [a0, a1, col, lift] of [[th - 0.028, th + 0.028, 0x8a8478, 0.004], [th - 0.013, th - 0.009, 0xb8bcc0, 0.007], [th + 0.009, th + 0.013, 0xb8bcc0, 0.007]]) {
    const RL = R - H;
    const b = sphereBand(RL, RL * Math.sin(a0), RL * Math.sin(a1), col, lift, 160);
    b.quaternion.copy(toZ);
    rail.add(b);
  }
  const st = structure(g, 0, R * ZT, 0, false);
  st.userData.lift = -H;
  const kst = kitOf(st);
  for (const sz of [-1, 1]) {
    kst.box(1.1, 0.055, 0.14, 0, -0.04, sz * 0.2, 0xb8b2a6);
    for (const px of [-0.4, 0, 0.4]) kst.cyl(0.01, 0.01, 0.16, px, 0.015, sz * 0.24, 0x5a6670);
    kst.box(0.95, 0.015, 0.1, 0, 0.175, sz * 0.23, 0x2f5f8a, { collide: false });
  }
  kst.box(0.6, 0.12, 0.08, 0, 0.015, -0.32, 0xd8cdb8);
  const sign = textPlane('RER C · MEUDON-VAL-FLEURY', 0.5, 0.05, { color: '#ffffff', bg: '#2f5f8a' });
  sign.position.set(0, 0.22, 0.29); st.add(sign);
  // Train à deux niveaux (4 voitures), animé le long de la voie
  const train = new THREE.Group(); train.userData.noDrape = true; g.add(train);
  const cars = [];
  for (let i = 0; i < 4; i++) {
    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.17, 0.42), mat(0xf2f2f0)); body.position.y = 0.1; car.add(body);
    for (const [y, c] of [[0.07, 0x1d3f7a], [0.135, 0x1d3f7a], [0.025, 0xc8323a]]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.102, 0.03, 0.4), y === 0.025 ? mat(c) : glow(0x9fd0ff, 0.5)); band.position.y = y + 0.015; car.add(band);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.015, 0.4), mat(0x9aa0a8)); roof.position.y = 0.19; car.add(roof);
    train.add(car); cars.push(car);
  }
  const RT = R - H + 0.002;
  const ringR = Math.sqrt(1 - ZT * ZT) * RT;
  const p = new THREE.Vector3(), up = new THREE.Vector3(), tan = new THREE.Vector3(), side = new THREE.Vector3(), m = new THREE.Matrix4();
  const place = (car, phi) => {
    p.set(Math.cos(phi) * ringR, Math.sin(phi) * ringR, ZT * RT);
    up.copy(p).normalize();
    tan.set(-Math.sin(phi), Math.cos(phi), 0);
    side.crossVectors(up, tan).normalize();
    m.makeBasis(side, up, tan);
    car.quaternion.setFromRotationMatrix(m);
    car.position.copy(p);
  };
  // Un tour en 90 s, dont 10 s d'arrêt en gare (au point le plus haut du cercle, φ = π/2)
  train.userData.tick = (t) => {
    const T = 90, dwell = 10, u = ((t % T) + T) % T;
    const s = u < dwell ? 0 : THREE.MathUtils.smoothstep(u, dwell, dwell + 6) * 0 + (u - dwell) / (T - dwell);
    const phi = Math.PI / 2 + s * Math.PI * 2;
    cars.forEach((c, i) => place(c, phi - (i - 1.5) * (0.44 / ringR)));
  };
  train.userData.tick(0);
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

// ---------------------------------------------------------------------------
// Station orbitale E139 : modules pressurisés visitables autour d'un moyeu, serre, observatoire,
// baie d'amarrage, panneaux solaires et radiateurs, posés sur un noyau métallique.
// ---------------------------------------------------------------------------
export function orbitalStation() {
  const g = new THREE.Group();
  const HULL = 0xd9dde3, DARK = 0x3a4048, ACC = 0xe8833a;
  // Moyeu central à deux niveaux, coupole d'observation au sommet
  const hub = structure(g, 0, 0);
  const kh = kitOf(hub);
  hollow(kh, { w: 0.7, d: 0.7, h: 0.62, floors: 2, wall: HULL, inner: 0xeef1f4, floorCol: 0x7d8792, doors: { '+z': 0, '-z': 0, '+x': 0, '-x': 0 }, furnish: 'observatory', seed: 71, toRoof: true });
  faceBands(kh, 0.7, 0.7, 0, 0, 0.29, 0.03, ACC, { out: 0.008 });
  faceBands(kh, 0.7, 0.7, 0, 0, 0.6, 0.03, DARK, { out: 0.01 });
  add(hub, new THREE.SphereGeometry(0.24, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9fd0ee, transparent: true, opacity: 0.35, roughness: 0.1 }), 0.12, 0.63, 0.12);
  cyl(hub, 0.012, 0.012, 0.7, 6, mat(DARK), -0.25, 0.62, -0.25);
  add(hub, new THREE.SphereGeometry(0.03, 8, 6), glow(0xff5a4a, 1.6), -0.25, 1.33, -0.25);
  // Quatre modules en croix, reliés au moyeu par des coursives
  const mods = [
    [0, 1.05, 0, 'home', 'Quartiers'], [0, -1.05, 0, 'workshop', 'Atelier'],
    [1.05, 0, Math.PI / 2, 'library', 'Laboratoire'], [-1.05, 0, Math.PI / 2, 'hall', 'Baie d’amarrage'],
  ];
  mods.forEach(([x, z, rot, furnish], i) => {
    const m = structure(g, x, z, rot);
    const k = kitOf(m);
    hollow(k, { w: 0.5, d: 0.9, h: 0.3, floors: 1, wall: HULL, inner: 0xeef1f4, floorCol: 0x7d8792, doors: { '+z': 0, '-z': 0 }, furnish, seed: 72 + i });
    // Coque arrondie, anneaux de structure, hublots
    const hull = new THREE.CylinderGeometry(0.27, 0.27, 0.9, 14, 1, false, -Math.PI / 2, Math.PI); hull.rotateX(Math.PI / 2);
    add(m, hull, mat(HULL), 0, 0.3, 0);
    for (const zz of [-0.43, 0, 0.43]) k.box(0.56, 0.32, 0.03, 0, 0, zz, DARK, { collide: false });
    for (const zz of [-0.22, 0.22]) for (const sx of [-1, 1]) k.box(0.012, 0.07, 0.1, sx * 0.256, 0.14, zz, 0x9fd8ff, { collide: false, glow: true });
    k.box(0.5, 0.012, 0.03, 0, 0.285, 0.455, ACC, { collide: false });
    // Coursive vers le moyeu
    const c = structure(g, x * 0.52, z * 0.52, rot, false);
    const kc = kitOf(c);
    kc.box(0.2, 0.012, 0.3, 0, 0.0, 0, 0x7d8792);
    for (const sx of [-1, 1]) kc.box(0.012, 0.2, 0.3, sx * 0.1, 0, 0, HULL);
    kc.box(0.2, 0.012, 0.3, 0, 0.2, 0, HULL, { collide: false });
  });
  // Serre sous dôme
  const sr = structure(g, 1.15, 1.15, 0, false);
  const ks = kitOf(sr);
  ks.cyl(0.36, 0.38, 0.06, 0, 0, 0, DARK, { seg: 16, collide: false });
  add(sr, new THREE.SphereGeometry(0.36, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xbfe8d0, transparent: true, opacity: 0.3, roughness: 0.1, side: THREE.DoubleSide }), 0, 0.05, 0);
  for (const [tx, tz] of [[0.1, 0.05], [-0.12, 0.1], [0, -0.14]]) tree(sr, tx, 0.05, tz, 0.5, 0x4c8a4f);
  ks.ring(0, 0, 0.36, 0, 0.3, [[1.2, 1.9]]);
  // Panneaux solaires sur mâts orientables, radiateurs
  for (const [x, z, rot] of [[-1.25, 1.2, 0.5], [1.25, -1.2, 0.5], [-1.3, -1.2, -0.5]]) {
    const p = structure(g, x, z, rot, false);
    const kp = kitOf(p);
    kp.cyl(0.025, 0.035, 0.5, 0, 0, 0, DARK, { seg: 8 });
    for (const sx of [-1, 1]) {
      const pan = add(p, new THREE.BoxGeometry(0.62, 0.012, 0.3), new THREE.MeshStandardMaterial({ color: 0x1c2f5e, metalness: 0.6, roughness: 0.3, emissive: 0x0a1a44, emissiveIntensity: 0.6 }), sx * 0.36, 0.52, 0);
      pan.rotation.x = -0.5;
      for (let i = 1; i < 4; i++) kp.box(0.006, 0.014, 0.31, sx * (0.05 + i * 0.155), 0.515, 0, 0xc9ced6, { collide: false, rotX: -0.5 });
    }
  }
  // Parabole de liaison et balises de la piste
  const an = structure(g, -0.55, 1.5, 0, false);
  cyl(an, 0.02, 0.03, 0.4, 8, mat(DARK), 0, 0, 0);
  add(an, new THREE.SphereGeometry(0.28, 16, 6, 0, Math.PI * 2, 0, Math.PI / 3), mat(0xf0f0ee, { side: THREE.DoubleSide }), 0, 0.55, 0, [Math.PI * 0.8, 0, 0.3]);
  an.userData.colliders = { boxes: [], cyls: [[0, 0, 0.04, 0, 0.4]], rings: [] };
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const b = structure(g, -1.95 + Math.cos(a) * 0.32, 0 + Math.sin(a) * 0.32, 0, false);
    add(b, new THREE.BoxGeometry(0.03, 0.015, 0.03), glow(i % 2 ? 0x59e0ff : 0xffb35c, 1.4), 0, 0.01, 0);
  }
  return g;
}
