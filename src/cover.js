// Peuplement des astres solides : villages et bâtiments en rapport avec chaque lieu, forêts,
// lacs, champs, rochers, cristaux… Tout est instancié (un maillage par modèle et par astre),
// et chaque bâtiment est creux, meublé et praticable (volumes de collision par instance).
import * as THREE from 'three';
import { Kit, hollow, faceBands, facadeWindows, M, U, rng, kitSolid, kitGlow, kitGlass } from './kit.js';
import { meudonZone, MEUDON, clunyZone } from './landmarks.js';
// Zone demandée (ex. 'high|slope') : vrai si la direction tombe dans l'une d'elles
const zoneOk = (theme, d, zone) => !zone || !theme.zone || zone.split('|').includes(theme.zone(d));

// ---------------------------------------------------------------------------
// Échantillonneur de surface : rayon du sol dans une direction donnée (repère local de l'astre)
// ---------------------------------------------------------------------------
const NLON = 128, NLAT = 64;
export class Sampler {
  constructor(obj, center, filter) {
    obj.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
    const m = new THREE.Matrix4();
    const v = new THREE.Vector3();
    const list = [];
    obj.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || !filter(o)) return;
      m.multiplyMatrices(inv, o.matrixWorld);
      const pos = o.geometry.attributes.position, idx = o.geometry.index;
      const n = idx ? idx.count : pos.count;
      for (let i = 0; i < n; i++) {
        v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(m).sub(center);
        list.push(v.x, v.y, v.z);
      }
    });
    this.center = center.clone();
    this.tri = new Float32Array(list);
    this.count = this.tri.length / 9;
    this.cells = Array.from({ length: NLON * NLAT }, () => []);
    const T = this.tri, d = new THREE.Vector3();
    for (let t = 0; t < this.count; t++) {
      let la0 = 9, la1 = -9, lo = [];
      for (let j = 0; j < 3; j++) {
        d.set(T[t * 9 + j * 3], T[t * 9 + j * 3 + 1], T[t * 9 + j * 3 + 2]);
        const L = d.length(); if (L < 1e-9) continue;
        const lat = Math.asin(THREE.MathUtils.clamp(d.y / L, -1, 1));
        la0 = Math.min(la0, lat); la1 = Math.max(la1, lat);
        lo.push(Math.atan2(d.z, d.x));
      }
      if (!lo.length) continue;
      let lo0 = Math.min(...lo), lo1 = Math.max(...lo);
      const wrap = lo1 - lo0 > Math.PI;
      const i0 = Math.max(0, Math.floor(((la0 + Math.PI / 2) / Math.PI) * NLAT) - 1);
      const i1 = Math.min(NLAT - 1, Math.floor(((la1 + Math.PI / 2) / Math.PI) * NLAT) + 1);
      const polar = la1 > 1.35 || la0 < -1.35;
      const addLon = (a0, a1, row) => {
        const j0 = Math.floor(((a0 + Math.PI) / (2 * Math.PI)) * NLON) - 1, j1 = Math.floor(((a1 + Math.PI) / (2 * Math.PI)) * NLON) + 1;
        for (let j = j0; j <= j1; j++) this.cells[row * NLON + ((j % NLON) + NLON) % NLON].push(t);
      };
      for (let i = i0; i <= i1; i++) {
        if (polar) { for (let j = 0; j < NLON; j++) this.cells[i * NLON + j].push(t); continue; }
        if (wrap) {
          const pos = lo.filter((a) => a > 0), neg = lo.filter((a) => a <= 0);
          addLon(Math.min(...pos), Math.PI, i); addLon(-Math.PI, Math.max(...neg), i);
        } else addLon(lo0, lo1, i);
      }
    }
    this.cells = this.cells.map((c) => (c.length ? Int32Array.from(new Set(c)) : null));
  }
  // Rayon (distance au centre) de la surface la plus haute dans la direction dir (unitaire), et sa normale
  query(dir, out = {}) {
    const lat = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)), lon = Math.atan2(dir.z, dir.x);
    const i = Math.min(NLAT - 1, Math.max(0, Math.floor(((lat + Math.PI / 2) / Math.PI) * NLAT)));
    const j = Math.min(NLON - 1, Math.max(0, Math.floor(((lon + Math.PI) / (2 * Math.PI)) * NLON)));
    const cell = this.cells[i * NLON + j];
    out.r = -1;
    if (!cell) return out;
    const T = this.tri, dx = dir.x, dy = dir.y, dz = dir.z;
    for (let q = 0; q < cell.length; q++) {
      const o = cell[q] * 9;
      const ax = T[o], ay = T[o + 1], az = T[o + 2];
      const e1x = T[o + 3] - ax, e1y = T[o + 4] - ay, e1z = T[o + 5] - az;
      const e2x = T[o + 6] - ax, e2y = T[o + 7] - ay, e2z = T[o + 8] - az;
      const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
      const det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-12) continue;
      const id = 1 / det;
      const tx = -ax, ty = -ay, tz = -az;
      const u = (tx * px + ty * py + tz * pz) * id;
      if (u < -1e-6 || u > 1 + 1e-6) continue;
      const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
      const vv = (dx * qx + dy * qy + dz * qz) * id;
      if (vv < -1e-6 || u + vv > 1 + 1e-6) continue;
      const t = (e2x * qx + e2y * qy + e2z * qz) * id;
      if (t > out.r) {
        out.r = t;
        let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
        const L = Math.hypot(nx, ny, nz) || 1;
        const s = (nx * dx + ny * dy + nz * dz) < 0 ? -1 / L : 1 / L;
        out.nx = nx * s; out.ny = ny * s; out.nz = nz * s;
      }
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// Bibliothèque de modèles (construits en unités de monument : 1 m = M(1))
// ---------------------------------------------------------------------------
const ROOF = { slate: 0x4a5161, tile: 0x9a5a3a, terracotta: 0xd2774a, zinc: 0x7f8c99, red: 0xa0503a };
function house(k, { W, D, H, floors = 1, wall, inner = 0xf3ece0, roof = ROOF.tile, roofH = 2.5, roofType = 'gable', furnish = 'home', doorX = 0, cols = 3, seed = 1, glowCol = 0xffc070, floorCol = 0x8a5a36, doorW = 1.7, doorH = 2.6, base = true }) {
  hollow(k, { w: M(W), d: M(D), h: M(H), floors, wall, inner, doors: { '+z': M(doorX) }, furnish, seed, floorCol, doorW: M(doorW), doorH: M(doorH) });
  const fh = M(H / floors);
  facadeWindows(k, { w: M(W - 1.2), x: 0, z: M(D / 2), y0: 0, floors, fh, cols, side: 1, ww: M(1.0), wh: M(1.3), lit: glowCol, skip: (a, f) => f === 0 && Math.abs(a - M(doorX)) < M(1.4) });
  facadeWindows(k, { w: M(W - 1.2), x: 0, z: -M(D / 2), y0: 0, floors, fh, cols, side: -1, ww: M(1.0), wh: M(1.3), lit: glowCol });
  facadeWindows(k, { w: M(D - 1.6), x: M(W / 2), z: 0, y0: 0, floors, fh, cols: Math.max(1, Math.round(D / 4)), side: 1, axis: 'x', ww: M(1.0), wh: M(1.3), lit: glowCol });
  if (roofType === 'gable') k.gable(M(W), M(roofH), M(D), 0, M(H), 0, roof, { over: M(0.35) });
  else if (roofType === 'hip') k.hip(M(W), M(roofH), M(D), 0, M(H), 0, roof, 0.3);
  else if (roofType === 'flat') k.box(M(W + 0.6), M(0.35), M(D + 0.6), 0, M(H), 0, roof);
  if (base) {
    // Fondations (enterrées) et marches devant la porte, pour rattraper la pente du terrain
    k.box(M(W + 0.3), M(3), M(D + 0.3), 0, -M(3), 0, 0x8d8272);
    for (let i = 0; i < 4; i++) k.box(M(doorW + 0.8), M(3 - 0.28 * (i + 1)), M(0.34), M(doorX), -M(3), M(D / 2 + 0.15 + 0.34 * i + 0.17), 0x9d9282);
  }
}
const PREFABS = {
  // Maison à colombages normande (Rouen)
  colombage: { hx: 4.3, hz: 3.8, build(k, s) {
    const W = 8, D = 6, H = 5.6;
    house(k, { W, D, H, floors: 2, wall: 0xf1e6cf, roof: ROOF.slate, roofH: 4, doorX: -1.8, seed: s });
    const beam = 0x5a3a22, o = { collide: false };
    for (const sd of [1, -1]) {
      const z = sd * M(D / 2 + 0.04);
      for (let i = 0; i <= 8; i++) {
        const x = -W / 2 + (i * W) / 8;
        if (sd > 0 && Math.abs(x + 1.8) < 1.2) { k.box(M(0.2), M(H - 2.8), M(0.08), M(x), M(2.8), z, beam, o); continue; }
        k.box(M(0.2), M(H), M(0.08), M(x), 0, z, beam, o);
      }
      for (const y of [0, 2.75, 5.45]) k.box(M(W), M(0.2), M(0.08), 0, M(y), z, beam, o);
      for (let i = 0; i < 8; i += 2) k.box(M(0.16), M(3.2), M(0.06), M(-W / 2 + (i + 1) * W / 8), M(2.95), z, beam, { collide: false, rotZ: i % 4 ? 0.5 : -0.5 });
    }
    k.box(M(0.8), M(2.4), M(0.8), M(2.4), M(H + 1.6), -M(1), 0x9a6a4a, o);
  } },
  // Maison de pierre bourguignonne (Cluny)
  // Maison romane de Cluny : arcade de boutique en plein cintre, claire-voie de petites baies à colonnettes à l'étage
  romane: { hx: 3.5, hz: 4.3, build(k, s) {
    const W = 6.4, D = 8, H = 6.6, o = { collide: false }, zf = M(D / 2 + 0.03);
    house(k, { W, D, H, floors: 2, wall: [0xdcc79b, 0xd2bb8c, 0xe3d2aa, 0xcdb589][s % 4], inner: 0xeee2c8, roof: s % 3 ? 0x7d5240 : 0x94634a, roofH: 1.5, seed: s, cols: 1, doorX: -2.1, doorW: 1.2 });
    k.box(M(2.8), M(2.0), M(0.06), M(0.9), 0, zf, 0x3a2a20, o);
    { const gg = new THREE.CylinderGeometry(M(1.4), M(1.4), M(0.06), 12, 1, false, Math.PI / 2, Math.PI); gg.rotateX(Math.PI / 2); gg.translate(M(0.9), M(2.0), zf); k.geo(gg, 0x3a2a20); }
    k.box(M(W + 0.3), M(0.2), M(0.16), 0, M(3.25), zf, 0xbfa878, o);
    for (let i = 0; i < 6; i++) {
      const x = -W / 2 + 0.75 + (i * (W - 1.5)) / 5;
      k.box(M(0.6), M(1.15), M(0.05), M(x), M(3.75), zf, i % 3 === 1 ? 0xffc070 : 0x2c241e, { collide: false, glow: i % 3 === 1 });
      k.box(M(0.1), M(1.15), M(0.09), M(x + 0.42), M(3.75), zf, 0xefe4c8, o);
    }
    k.box(M(W + 0.3), M(0.16), M(0.16), 0, M(4.95), zf, 0xbfa878, o);
    k.box(M(0.7), M(1.8), M(0.7), M(-2), M(H), M(-1.5), 0xc7b083, o);
  } },
  pierre: { hx: 4.3, hz: 3.6, build(k, s) {
    house(k, { W: 8, D: 6.5, H: 3.4, floors: 1, wall: 0xd8c49a, inner: 0xeee2c8, roof: ROOF.tile, roofH: 2.6, seed: s, cols: 2 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(M(0.5), M(3.4), M(0.5), sx * M(3.8), 0, sz * M(3.05), 0xc7b083, { collide: false });
  } },
  // Immeuble haussmannien (Paris)
  haussmann: { hx: 7.4, hz: 5.4, maxDrop: 1.5, build(k, s) {
    const W = 14, D = 10, H = 15;
    house(k, { W, D, H, floors: 5, wall: 0xeadfc8, inner: 0xf2ead8, roof: ROOF.zinc, roofH: 3.6, roofType: 'hip', cols: 5, seed: s, doorX: 0, floorCol: 0x9a6e48 });
    for (const y of [3, 12]) k.box(M(W + 0.2), M(0.12), M(0.9), 0, M(y), M(D / 2 + 0.45), 0x2b2b2b, { collide: false });
    for (const y of [3.95, 12.95]) k.box(M(W), M(0.9), M(0.05), 0, M(y - 0.83), M(D / 2 + 0.88), 0x2b2b2b, { collide: false });
    k.box(M(W + 0.3), M(0.3), M(D + 0.3), 0, M(H - 0.3), 0, 0xf6f0e2, { collide: false });
  } },
  // Pavillon contemporain (Le Mans)
  pavillon: { hx: 5.3, hz: 4.3, build(k, s) {
    house(k, { W: 10, D: 8, H: 3.3, floors: 1, wall: 0xf2f0ea, inner: 0xf6f4ee, roof: 0xb4583a, roofType: 'hip', roofH: 2.2, cols: 3, seed: s, doorX: 2, glowCol: 0x9fd8ff, floorCol: 0xb08a5a });
    k.box(M(0.25), M(3.3), M(0.3), M(3.3), 0, M(4.1), 0xe07a3a, { collide: false });
  } },
  // Mas provençal (Marseille)
  mas: { hx: 4.3, hz: 3.8, build(k, s) {
    house(k, { W: 8, D: 7, H: 6, floors: 2, wall: 0xf3e6cc, inner: 0xf6eedc, roof: ROOF.terracotta, roofH: 1.6, seed: s, doorX: 1.5 });
    for (let f = 0; f < 2; f++) for (let c = 0; c < 3; c++) {
      const x = -3.4 + 6.8 * (c + 0.5) / 3;
      if (f === 0 && Math.abs(x - 1.5) < 1.4) continue;
      for (const sx of [-1, 1]) k.box(M(0.45), M(1.4), M(0.06), M(x + sx * 0.75), M(f * 3 + 0.9), M(3.56), 0x3f6fa8, { collide: false });
    }
  } },
  // Villa en meulière (Meudon)
  meuliere: { hx: 4.3, hz: 3.8, build(k, s) {
    house(k, { W: 8, D: 7, H: 6, floors: 2, wall: 0xc9a882, inner: 0xf0e4cc, roof: ROOF.red, roofH: 3, seed: s, doorX: -1.5 });
    const kk = k; faceBands(kk, M(8), M(7), 0, 0, M(2.9), M(0.3), 0xa4513a, { out: M(0.05) });
    faceBands(kk, M(8), M(7), 0, 0, M(5.7), M(0.3), 0xa4513a, { out: M(0.05) });
  } },
  // Laboratoire / clinique (Glénos)
  labo: { hx: 8.4, hz: 5.4, maxDrop: 1.4, build(k, s) {
    house(k, { W: 16, D: 10, H: 7, floors: 2, wall: 0xf4f4f0, inner: 0xf8f8f6, roof: 0xb8c0c8, roofType: 'flat', furnish: 'lab', cols: 6, seed: s, glowCol: 0x9fd8ff, floorCol: 0xc8ccd0 });
    k.box(M(1.2), M(1.2), M(0.1), M(5), M(5.6), M(5.06), 0x3fae6a, { glow: true });
  } },
  // École (Schola)
  ecole: { hx: 8.4, hz: 4.9, maxDrop: 1.4, build(k, s) {
    house(k, { W: 16, D: 9, H: 7, floors: 2, wall: 0xf0d9a8, inner: 0xf6ecd4, roof: ROOF.red, roofH: 3, furnish: 'school', cols: 6, seed: s });
    k.cyl(M(0.8), M(0.8), M(0.1), 0, M(7.6), M(4.56), 0xffe6b0, { glow: true, collide: false, seg: 16 });
    k.box(M(0.1), M(5), M(0.1), M(7.4), M(7), M(4), 0x555555, { collide: false });
    [0x1f3a93, 0xf5f5f5, 0xd62828].forEach((c, i) => k.box(M(0.6), M(1), M(0.05), M(7.75 + i * 0.6), M(10.8), M(4), c, { collide: false }));
  } },
  // Église de village
  chapelle: { hx: 4.5, hz: 10.5, maxDrop: 1.5, build(k, s) {
    house(k, { W: 8, D: 16, H: 7, floors: 1, wall: 0xe4d8bf, inner: 0xf2ead8, roof: ROOF.slate, roofH: 4.5, furnish: 'church', cols: 0, seed: s, doorW: 2, doorH: 3.2, glowCol: 0xffd28a });
    k.box(M(3.6), M(14), M(3.6), 0, 0, -M(9.6), 0xe4d8bf);
    k.cone(M(2.6), M(7), 0, M(14), -M(9.6), ROOF.slate, { seg: 4, rotY: Math.PI / 4 });
    k.box(M(0.12), M(1.4), M(0.12), 0, M(21), -M(9.6), 0xd9ab45, { collide: false });
    k.box(M(0.8), M(0.12), M(0.12), 0, M(21.9), -M(9.6), 0xd9ab45, { collide: false });
    k.cyl(M(0.6), M(0.6), M(0.1), 0, M(11), -M(7.75), 0xffe6b0, { glow: true, collide: false, seg: 16 });
  } },
  // Module d'habitat (avant-postes)
  module: { hx: 5.4, hz: 3.4, build(k, s) {
    house(k, { W: 10, D: 6, H: 3.4, floors: 1, wall: 0xe2e6ea, inner: 0xf2f4f6, roof: 0x9aa4ad, roofType: 'flat', furnish: 'lab', cols: 3, seed: s, glowCol: 0x9fd8ff, floorCol: 0x8a9298 });
    faceBands(k, M(10), M(6), 0, 0, M(2.4), M(0.35), 0xe07a3a, { out: M(0.05) });
    k.cyl(M(0.08), M(0.08), M(4), M(3.5), M(3.7), -M(1.5), 0x9aa4ad, { collide: false });
    k.sphere(M(0.9), M(3.5), M(8), -M(1.5), 0xe8e8e8, { half: true });
  } },
  // Hangar d'assemblage (Proxion)
  hangar: { hx: 11.5, hz: 8.5, maxDrop: 1.6, build(k, s) {
    house(k, { W: 22, D: 16, H: 8, floors: 1, wall: 0xb8b4ac, inner: 0xd8d4cc, roof: 0x8c949c, roofType: 'none', furnish: 'workshop', cols: 0, seed: s, doorW: 7, doorH: 6, floorCol: 0x6f7378 });
    const arc = new THREE.CylinderGeometry(M(8.3), M(8.3), M(22.4), 24, 1, true, 0, Math.PI);
    arc.rotateZ(Math.PI / 2); arc.rotateX(Math.PI / 2); arc.scale(1, 0.45, 1); arc.translate(0, M(8), 0);
    k.geo(arc, 0x8c949c);
    k.box(M(6), M(1.2), M(0.15), 0, M(6.4), M(8.1), 0xe07a3a, { collide: false });
  } },
  // Serre sous dôme de verre
  serre: { hx: 7.4, hz: 7.4, build(k, s) {
    const R = 7;
    k.cyl(M(R + 0.3), M(R + 0.3), M(3), 0, -M(3), 0, 0x8d8272);
    k.cyl(M(R), M(R), M(0.1), 0, 0, 0, 0xb8a888, { collide: false });
    const g = new THREE.SphereGeometry(M(R), 24, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    k.glass.push(g.toNonIndexed());
    k.ring(0, 0, M(R), 0, M(R), [[Math.PI / 2 - 0.16, Math.PI / 2 + 0.16]]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      if (Math.abs(a - Math.PI / 2) < 0.6) continue;
      k.box(M(2.4), M(0.6), M(1.2), Math.cos(a) * M(4), 0, Math.sin(a) * M(4), 0x6a4a2a);
      k.sphere(M(0.6), Math.cos(a) * M(4), M(1.1), Math.sin(a) * M(4), 0x4f9a4c);
    }
    k.box(M(0.3), M(0.3), M(0.3), 0, M(R - 0.6), 0, 0xffe0a0, { glow: true });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const h = new THREE.TorusGeometry(M(R + 0.02), M(0.08), 4, 16, Math.PI); h.rotateY(a);
      k.geo(h, 0xd0d6dc);
    }
  } },
  // Kiosque à musique (Nocturne)
  kiosque: { hx: 5, hz: 5, build(k, s) {
    k.cyl(M(4.2), M(4.4), M(3.8), 0, -M(3), 0, 0xd8cfbd, { seg: 8 });
    for (let i = 0; i < 4; i++) k.box(M(2.4), M(0.8 - 0.2 * i) + M(3), M(0.4), 0, -M(3), M(4.5 + 0.4 * i), 0xc8bca6);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      k.cyl(M(0.15), M(0.15), M(3), Math.cos(a) * M(3.8), M(0.8), Math.sin(a) * M(3.8), 0xf3ece0);
      k.sphere(M(0.3), Math.cos(a) * M(3.8), M(3.6), Math.sin(a) * M(3.8), 0xffd28a, { glow: true });
    }
    k.cone(M(5), M(2.6), 0, M(3.8), 0, 0x6a4a7a, { seg: 8 });
    k.box(M(1.6), M(1.1), M(1.4), 0, M(0.8), 0, 0x1a1a1a);
  } },
  eolienne: { hx: 2, hz: 2, maxDrop: 3, build(k) {
    k.cyl(M(0.5), M(0.9), M(20), 0, -M(2), 0, 0xf2f4f6, { seg: 10 });
    k.box(M(1.0), M(1.0), M(2.6), 0, M(18), 0, 0xe8ecef, { collide: false });
    k.sphere(M(0.6), 0, M(18.5), M(1.5), 0xf2f4f6);
    for (let i = 0; i < 3; i++) {
      const g = new THREE.BoxGeometry(M(0.6), M(9), M(0.18));
      g.translate(0, M(4.5), 0); g.rotateZ((i * Math.PI * 2) / 3 + 0.3); g.translate(0, M(18.5), M(1.7));
      k.geo(g, 0xf6f8fa);
    }
    k.box(M(0.3), M(0.3), M(0.3), 0, M(19.2), 0, 0xff4a3a, { glow: true });
  } },
  solaire: { hx: 6, hz: 3, build(k) {
    for (let i = 0; i < 4; i++) {
      const x = -4.5 + i * 3;
      k.cyl(M(0.1), M(0.1), M(1.4), M(x), 0, 0, 0x9aa4ad);
      k.box(M(2.8), M(0.12), M(2.2), M(x), M(1.4), 0, 0x1b2f63, { rotX: -0.45 });
    }
    k.solid(-M(6), 0, -M(1.2), M(6), M(1.6), M(1.2));
  } },
  lampadaire: { hx: 0.4, hz: 0.4, maxDrop: 3, build(k) {
    k.cyl(M(0.1), M(0.14), M(4.6), 0, -M(1), 0, 0x2b2b2b, { seg: 6 });
    k.sphere(M(0.4), 0, M(3.9), 0, 0xffd28a, { glow: true });
  } },
  antenne: { hx: 2.5, hz: 2.5, maxDrop: 2, build(k) {
    k.cyl(M(0.3), M(0.5), M(6), 0, -M(1), 0, 0x9aa4ad, { seg: 6 });
    const d = new THREE.SphereGeometry(M(2.4), 14, 6, 0, Math.PI * 2, 0, Math.PI / 3);
    d.rotateX(Math.PI * 0.75); d.translate(0, M(5.6), 0);
    k.geo(d, 0xe8e8e8);
    k.box(M(0.3), M(0.3), M(0.3), 0, M(6), M(0.6), 0x7dffc8, { glow: true });
  } },
  // Végétation et décor
  // ---- Petite végétation et minéraux (sans collision, semés en dernier) ----
  herbe: { tree: true, plant: true, build(k) {
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4, r = 0.12 + (i % 3) * 0.14, h = 0.45 + ((i * 7) % 5) * 0.11;
      k.box(M(0.07), M(h), M(0.03), M(Math.cos(a) * r), -M(0.05), M(Math.sin(a) * r), [0x5f9a44, 0x74ad4f, 0x4f8a3c][i % 3], { collide: false, rotY: a, rotZ: 0.12 + (i % 4) * 0.08 });
    }
  } },
  fougere: { tree: true, plant: true, build(k) {
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; k.box(M(0.9), M(0.03), M(0.26), M(Math.cos(a) * 0.4), M(0.28), M(-Math.sin(a) * 0.4), i % 2 ? 0x3f7a3a : 0x4c8a45, { collide: false, rotY: a, rotZ: 0.5 }); }
  } },
  buisson: { tree: true, plant: true, build(k) {
    k.sphere(M(0.8), 0, M(0.5), 0, 0x3f7238, { seg: 6, sy: 0.8 });
    k.sphere(M(0.55), M(0.6), M(0.55), M(0.2), 0x4c8442, { seg: 6 });
    k.sphere(M(0.5), -M(0.5), M(0.45), -M(0.3), 0x356632, { seg: 5 });
    for (const [x, y, z] of [[0.3, 0.9, 0.5], [-0.4, 0.8, -0.2], [0.7, 0.7, -0.1], [-0.1, 1.05, 0.3]]) k.box(M(0.09), M(0.09), M(0.09), M(x), M(y), M(z), 0xc23a4a, { collide: false });
  } },
  rocher: { tree: true, plant: true, build(k) {
    k.sphere(M(0.75), 0, M(0.2), 0, 0x8d8a84, { seg: 5, sy: 0.65 });
    k.sphere(M(0.45), M(0.6), M(0.12), M(0.3), 0x9a968e, { seg: 5, sy: 0.7 });
    k.sphere(M(0.25), -M(0.55), M(0.05), M(0.5), 0x7d7a75, { seg: 4, sy: 0.7 });
  } },
  champignon: { tree: true, plant: true, build(k) {
    for (const [x, z, s] of [[0, 0, 1], [0.3, 0.2, 0.7], [-0.2, 0.3, 0.55]]) {
      k.cyl(M(0.05 * s), M(0.07 * s), M(0.3 * s), M(x), 0, M(z), 0xf1ead8, { seg: 6, collide: false });
      k.sphere(M(0.2 * s), M(x), M(0.3 * s), M(z), 0xc8402e, { seg: 7, half: true });
    }
  } },
  ...Object.fromEntries([['paquerette', 0xf6f3ea, 0xf2c94c], ['coquelicot', 0xd8342c, 0x2a2420], ['bleuet', 0x5a78d8, 0xe8e2f8], ['bouton-or', 0xf2c530, 0xe0a020]].map(([name, petal, heart]) => [name, { tree: true, plant: true, build(k) {
    for (let i = 0; i < 6; i++) {
      const a = i * 1.9, r = 0.1 + (i % 3) * 0.2, h = 0.3 + (i % 4) * 0.08, x = Math.cos(a) * r, z = Math.sin(a) * r;
      k.box(M(0.025), M(h), M(0.025), M(x), 0, M(z), 0x4f8a3c, { collide: false });
      k.box(M(0.16), M(0.04), M(0.16), M(x), M(h), M(z), petal, { collide: false, rotY: a });
      k.box(M(0.06), M(0.06), M(0.06), M(x), M(h + 0.01), M(z), heart, { collide: false });
    }
  } }])),
  roseau: { tree: true, plant: true, build(k) {
    for (let i = 0; i < 7; i++) { const a = i * 2.1, r = 0.1 + (i % 3) * 0.12; k.box(M(0.04), M(1.5 + (i % 3) * 0.3), M(0.04), M(Math.cos(a) * r), -M(0.1), M(Math.sin(a) * r), 0x8a9a4a, { collide: false, rotZ: 0.04 * (i - 3) }); if (i % 2) k.box(M(0.08), M(0.3), M(0.08), M(Math.cos(a) * r), M(1.3), M(Math.sin(a) * r), 0x5a3a22, { collide: false }); }
  } },
  feuillu: { tree: true, build(k, s, rnd) {
    k.cyl(M(0.22), M(0.34), M(3.4), 0, -M(0.4), 0, 0x5a3d26, { seg: 6 });
    k.sphere(M(2.3), 0, M(4.6), 0, 0x4c7a3d, { seg: 7 });
    k.sphere(M(1.6), M(1.1), M(5.6), M(0.4), 0x5a8a45, { seg: 6 });
  } },
  pin: { tree: true, build(k) {
    k.cyl(M(0.18), M(0.26), M(2.6), 0, -M(0.4), 0, 0x4b3322, { seg: 6 });
    k.cone(M(2.0), M(3.2), 0, M(1.8), 0, 0x2f5a3a, { seg: 7 });
    k.cone(M(1.6), M(2.8), 0, M(3.4), 0, 0x356640, { seg: 7 });
    k.cone(M(1.1), M(2.2), 0, M(5.0), 0, 0x3a6e45, { seg: 7 });
  } },
  peuplier: { tree: true, build(k) {
    k.cyl(M(0.16), M(0.24), M(2.4), 0, -M(0.4), 0, 0x6a5a40, { seg: 6 });
    k.sphere(M(1.3), 0, M(6.4), 0, 0x5f8f3f, { seg: 7, sy: 3.4 });
  } },
  platane: { tree: true, build(k) {
    k.cyl(M(0.3), M(0.4), M(4.2), 0, -M(0.4), 0, 0xb0a07a, { seg: 6 });
    k.sphere(M(3.0), 0, M(6.4), 0, 0x6a9a48, { seg: 7, sy: 0.75 });
  } },
  palmier: { tree: true, build(k) {
    k.cyl(M(0.2), M(0.35), M(7), 0, -M(0.4), 0, 0x8a6a48, { seg: 6 });
    for (let i = 0; i < 7; i++) {
      const g = new THREE.BoxGeometry(M(4), M(0.15), M(0.8));
      g.translate(M(2), 0, 0); g.rotateZ(-0.45); g.rotateY((i / 7) * Math.PI * 2); g.translate(0, M(6.6), 0);
      k.geo(g, 0x4f8a3c);
    }
  } },
  olivier: { tree: true, build(k) {
    k.cyl(M(0.25), M(0.4), M(2.2), 0, -M(0.4), 0, 0x6a5a48, { seg: 6 });
    k.sphere(M(1.8), 0, M(3), 0, 0x8a9a6a, { seg: 6, sy: 0.7 });
  } },
  sapin: { tree: true, build(k) {
    k.cyl(M(0.16), M(0.24), M(2), 0, -M(0.4), 0, 0x4b3322, { seg: 6 });
    k.cone(M(1.8), M(4.2), 0, M(1.2), 0, 0xdfe8ee, { seg: 7 });
    k.cone(M(1.2), M(3), 0, M(3.6), 0, 0xf2f6f8, { seg: 7 });
  } },
  cristal: { tree: true, build(k, s, rnd) {
    const cols = [0x9fe8ff, 0xc9a0ff, 0x7dffc8];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.ConeGeometry(M(0.4 + rnd() * 0.4), M(1.4 + rnd() * 1.6), 5);
      g.translate(0, M(0.8), 0); g.rotateZ((rnd() - 0.5) * 0.7); g.rotateX((rnd() - 0.5) * 0.7); g.translate(M((rnd() - 0.5) * 1.6), 0, M((rnd() - 0.5) * 1.6));
      k.geo(g, cols[i % 3], { glow: i === 0 });
      if (i) k.geo(g, cols[i % 3]);
    }
    k.cyls.push([0, 0, M(1.2), -M(0.5), M(2.5)]);
  } },
  rocher: { tree: true, build(k, s, rnd) {
    const g = new THREE.IcosahedronGeometry(M(1.6), 0);
    g.scale(1 + rnd() * 0.5, 0.6 + rnd() * 0.4, 1 + rnd() * 0.4);
    g.translate(0, M(0.3), 0);
    k.geo(g, 0x8a8175);
    k.cyls.push([0, 0, M(1.5), -M(0.5), M(1.2)]);
  } },
  calcaire: { tree: true, build(k, s, rnd) {
    const g = new THREE.IcosahedronGeometry(M(2.4), 0);
    g.scale(1, 1.2 + rnd(), 0.8);
    g.translate(0, M(1.2), 0);
    k.geo(g, 0xece6d8);
    k.cyls.push([0, 0, M(2), -M(0.5), M(3)]);
  } },
  vigne: { hx: 4.5, hz: 0.6, maxDrop: 1.5, build(k) {
    for (let i = 0; i < 5; i++) k.cyl(M(0.06), M(0.06), M(1.4), M(-4 + i * 2), -M(0.3), 0, 0x6a5a40, { collide: false, seg: 4 });
    k.box(M(8.6), M(0.9), M(0.7), 0, M(0.3), 0, 0x5f8a3a);
  } },
  champ: { hx: 7, hz: 5, flat: true, build(k, s, rnd) {
    const c = [0xd8c070, 0x9ab85a, 0xb8c86a, 0xc8a85a][Math.floor(rnd() * 4)];
    k.box(M(14), M(0.9), M(10), 0, -M(0.75), 0, c, { collide: false });
    for (let i = 0; i < 6; i++) k.box(M(14), M(0.06), M(0.3), 0, M(0.15), M(-4 + i * 1.6), 0x8a7a40, { collide: false });
  } },
  lavande: { hx: 6, hz: 4, flat: true, build(k) {
    k.box(M(12), M(0.9), M(8), 0, -M(0.75), 0, 0x8a7a50, { collide: false });
    for (let i = 0; i < 7; i++) k.box(M(11.4), M(0.5), M(0.6), 0, M(0.1), M(-3.4 + i * 1.13), 0x9a7ab8, { collide: false });
  } },
};
const built = {};
function prefab(name) {
  if (built[name]) return built[name];
  const p = PREFABS[name];
  const k = new Kit();
  p.build(k, 7, rng(name.length * 31 + 7));
  const m = k.merged();
  let rad = 0;
  for (const b of m.colliders.boxes) rad = Math.max(rad, Math.hypot(Math.max(Math.abs(b[0]), Math.abs(b[3])), Math.max(Math.abs(b[2]), Math.abs(b[5]))));
  for (const c of m.colliders.cyls) rad = Math.max(rad, Math.hypot(c[0], c[1]) + c[2]);
  for (const r of m.colliders.rings) rad = Math.max(rad, Math.hypot(r.x, r.z) + r.r);
  built[name] = { ...m, def: p, radius: rad, hx: M(p.hx || 1.5), hz: M(p.hz || 1.5) };
  return built[name];
}

// ---------------------------------------------------------------------------
// Thèmes par astre
// ---------------------------------------------------------------------------
// Rm : rayon de l'astre en mètres (échelle du personnage). villages : [modèle, nombre de villages, maisons par village]
export const THEMES = {
  corneille: { villages: [['colombage', 6, 11]], extra: [['chapelle', 2], ['lampadaire', 30]], forests: [['feuillu', 6, 26], ['peuplier', 3, 14]], fields: [['champ', 10]], lakes: 1, ocean: 0.07 },
  // Cluny : ville de pierre autour de l'enceinte, puis vallons de forêts, prés et vignes
  cluny: {
    zone: clunyZone,
    villages: [['romane', 30, 12, 'town']], extra: [['chapelle', 3, 'meadow|vine'], ['lampadaire', 40, 'town'], ['feuillu', 700, 'forest'], ['pin', 120, 'forest'], ['feuillu', 60, 'meadow'], ['peuplier', 40, 'river|meadow']],
    forests: [], fields: [['vigne', 700, 'vine'], ['champ', 10, 'meadow']], lakes: 0,
  },
  lutece: { villages: [['haussmann', 6, 7]], extra: [['lampadaire', 50], ['chapelle', 1]], forests: [['platane', 8, 12]], fields: [], lakes: 0, ocean: 0.06 },
  cenomane: { villages: [['pavillon', 7, 9]], extra: [['chapelle', 1], ['lampadaire', 20]], forests: [['feuillu', 6, 28], ['pin', 4, 20]], fields: [['champ', 8]], lakes: 1, ocean: 0.055 },
  massalia: { villages: [['mas', 6, 9]], extra: [['calcaire', 70], ['lampadaire', 14]], forests: [['pin', 6, 16], ['olivier', 5, 14], ['palmier', 3, 8]], fields: [['lavande', 10]], lakes: 0, ocean: 0.26 },
  // Meudon : ville et jardins en bas, observatoire, forêt et étang sur le plateau ; pas de maison sur la voie du RER
  meudon: {
    zone: meudonZone, avoid: (d) => Math.abs(d.z - MEUDON.TRACK) < 0.06,
    villages: [['meuliere', 9, 9, 'low']], extra: [['lampadaire', 28, 'low'], ['feuillu', 900, 'high|slope'], ['pin', 260, 'high|slope'], ['feuillu', 30, 'meadow'], ['feuillu', 30, 'low']],
    forests: [], fields: [], lakes: 0,
  },
  glenos: { villages: [['labo', 3, 4], ['pavillon', 3, 7]], extra: [['antenne', 6], ['lampadaire', 18]], forests: [['feuillu', 5, 22]], fields: [['champ', 4]], lakes: 2 },
  enedis: { villages: [['pavillon', 3, 6]], extra: [['eolienne', 22], ['solaire', 30], ['lampadaire', 10]], forests: [['feuillu', 4, 18]], fields: [['champ', 8]], lakes: 2 },
  station: { villages: [['module', 3, 3]], extra: [['antenne', 5], ['lampadaire', 24], ['cristal', 14]], forests: [], fields: [], lakes: 0 },
  nocturne: { villages: [['mas', 3, 7], ['colombage', 2, 6]], extra: [['kiosque', 6], ['lampadaire', 60]], forests: [['feuillu', 5, 22], ['peuplier', 3, 10]], fields: [['lavande', 4]], lakes: 2 },
  schola: { Rm: 170, villages: [['ecole', 10, 4], ['colombage', 8, 8], ['pierre', 6, 8]], extra: [['chapelle', 6], ['lampadaire', 40]], forests: [['feuillu', 18, 30], ['pin', 10, 24]], fields: [['champ', 30]], ocean: 0.32 },
  persion: { Rm: 220, villages: [['pavillon', 6, 7], ['mas', 4, 7]], extra: [['lampadaire', 30], ['antenne', 3]], forests: [['feuillu', 10, 26], ['pin', 8, 22]], fields: [['champ', 14]] },
  proxion: { Rm: 160, villages: [['module', 6, 5]], extra: [['hangar', 6], ['serre', 7], ['solaire', 30], ['antenne', 10], ['rocher', 140]], forests: [], fields: [], lakes: 0, exclude: 'rocket' },
  ceres: { Rm: 60, villages: [['module', 2, 3]], extra: [['serre', 2], ['antenne', 2], ['rocher', 70], ['cristal', 40]], forests: [], fields: [], ice: 3 },
  pluton: { Rm: 110, villages: [['module', 3, 4]], extra: [['serre', 3], ['antenne', 3], ['cristal', 60], ['rocher', 60]], forests: [['sapin', 4, 14]], fields: [], ice: 4 },
  charon: { Rm: 60, villages: [['module', 1, 3]], extra: [['antenne', 2], ['rocher', 90], ['cristal', 30]], forests: [], fields: [], ice: 2 },
  haumea: { Rm: 80, villages: [['module', 2, 3]], extra: [['cristal', 70], ['antenne', 2], ['rocher', 40]], forests: [], fields: [], ice: 2 },
  makemake: { Rm: 75, villages: [['module', 2, 3]], extra: [['rocher', 110], ['cristal', 40], ['serre', 2]], forests: [], fields: [], ice: 2 },
  eris: { Rm: 95, villages: [['module', 2, 4]], extra: [['cristal', 80], ['serre', 2], ['antenne', 2]], forests: [['sapin', 3, 12]], fields: [], ice: 3 },
  ricochet: { Rm: 55, villages: [['mas', 2, 4]], extra: [['lampadaire', 10], ['palmier', 16]], forests: [], fields: [] },
};

// ---------------------------------------------------------------------------
// Lacs creusés dans le relief (ou lacs gelés sur les astres glacés)
// ---------------------------------------------------------------------------
function carveLakes(b, center, sampler, list, m2u) {
  if (!list.length) return;
  const obj = b.obj;
  obj.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
  const v = new THREE.Vector3(), d = new THREE.Vector3();
  obj.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.userData.terrain || o.userData.water || o.userData.lawn) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), mi = m.clone().invert();
    const pos = o.geometry.attributes.position;
    let changed = false;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m).sub(center);
      const r = v.length(); d.copy(v).divideScalar(r);
      for (const L of list) {
        const ang = Math.acos(THREE.MathUtils.clamp(d.dot(L.dir), -1, 1));
        if (ang > L.ang * 1.35) continue;
        const k = THREE.MathUtils.smoothstep(ang, L.ang * 1.35, L.ang * 0.4);
        const target = L.level - L.depth;
        const nr = r - (r - Math.min(r, target)) * k;
        if (nr < r) { v.multiplyScalar(nr / r); changed = true; }
      }
      v.add(center).applyMatrix4(mi);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    if (changed) { pos.needsUpdate = true; o.geometry.computeVertexNormals(); o.geometry.computeBoundingSphere(); }
  });
}

// ---------------------------------------------------------------------------
// Peuplement d'un astre
// ---------------------------------------------------------------------------
const qTmp = new THREE.Quaternion(), mTmp = new THREE.Matrix4(), sTmp = new THREE.Vector3();
export function populate(b, { center, m2u = null, theme, seed, exclude, waterMat }) {
  const rnd = rng(seed);
  const obj = b.obj;
  const terrainFilter = (o) => o.userData.terrain && !o.userData.water;
  let sampler = new Sampler(obj, center, terrainFilter);
  // Rayon moyen et répartition des altitudes
  const probe = [];
  const d = new THREE.Vector3(), q = {};
  for (let i = 0; i < 400; i++) {
    d.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
    sampler.query(d, q); if (q.r > 0) probe.push(q.r);
  }
  probe.sort((a, c) => a - c);
  const R = probe[probe.length >> 1] || 1;
  if (!m2u) m2u = R / (theme.Rm || 100);
  const group = new THREE.Group(); group.name = 'cover';
  const waterMeshes = [];
  const randDir = () => d.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().clone();
  const excluded = (dir) => exclude && exclude(dir);
  // Océan
  if (theme.ocean) {
    const level = probe[Math.floor(probe.length * theme.ocean)];
    const sea = new THREE.Mesh(new THREE.SphereGeometry(level, 96, 48), waterMat.clone());
    sea.position.copy(center);
    sea.userData.water = true;
    group.add(sea); waterMeshes.push(sea);
  }
  // Lacs (et lacs gelés)
  const lakes = [];
  const nl = (theme.lakes || 0) + (theme.ice || 0);
  for (let i = 0, tries = 0; i < nl && tries < 200; tries++) {
    const dir = randDir();
    if (excluded(dir)) continue;
    if (theme.lakeZone && !zoneOk(theme, dir, theme.lakeZone)) continue;
    if (theme.avoid && theme.avoid(dir)) continue;
    const ang = (M(14 + rnd() * 14) / U) * m2u / R;
    if (lakes.some((L) => L.dir.angleTo(dir) < (L.ang + ang) * 1.4)) continue;
    sampler.query(dir, q); if (q.r < 0) continue;
    // Niveau : un peu sous le plus bas de la rive
    let rim = Infinity, bad = false;
    const t1 = new THREE.Vector3().crossVectors(dir, Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
    const t2 = new THREE.Vector3().crossVectors(dir, t1);
    for (let a = 0; a < 12; a++) {
      const p = dir.clone().addScaledVector(t1, Math.cos(a) * ang).addScaledVector(t2, Math.sin(a) * ang).normalize();
      // Toute la rive doit rester dans la zone voulue (pas de lac à cheval sur deux niveaux)
      if ((theme.lakeZone && !zoneOk(theme, p, theme.lakeZone)) || (theme.avoid && theme.avoid(p)) || excluded(p)) bad = true;
      sampler.query(p, q); if (q.r > 0) rim = Math.min(rim, q.r);
    }
    if (bad || !isFinite(rim)) continue;
    const ice = i >= (theme.lakes || 0);
    lakes.push({ dir, ang, level: rim - 0.6 * m2u, depth: 3 * m2u, ice });
    i++;
  }
  carveLakes(b, center, sampler, lakes, m2u);
  for (const L of lakes) {
    const g = new THREE.SphereGeometry(L.level, 40, 10, 0, Math.PI * 2, 0, L.ang * 1.3);
    const mtl = L.ice
      ? new THREE.MeshStandardMaterial({ color: 0xcfeaf6, roughness: 0.15, metalness: 0.1, emissive: 0x2a4a5a, emissiveIntensity: 0.25 })
      : waterMat.clone();
    const m = new THREE.Mesh(g, mtl);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), L.dir);
    m.position.copy(center);
    if (L.ice) m.userData.terrain = true; else { m.userData.water = true; waterMeshes.push(m); }
    group.add(m);
  }
  obj.add(group);
  // Échantillonneurs définitifs (relief creusé, lacs gelés praticables) et eau
  sampler = new Sampler(obj, center, terrainFilter);
  const water = new Sampler(obj, center, (o) => !!o.userData.water);
  const wq = {};
  const isWater = (dir, r) => { water.query(dir, wq); return wq.r > 0 && wq.r > r - 0.05 * m2u; };

  // Placement
  const S = m2u / U;
  const occupied = [];
  const instances = {};
  const colliders = [];
  const up = new THREE.Vector3(0, 1, 0);
  const tryPlace = (name, dir, yaw, margin = 1, zone = null) => {
    const P = prefab(name);
    if (excluded(dir)) return false;
    if (!zoneOk(theme, dir, zone)) return false;
    if (theme.avoid && theme.avoid(dir)) return false;
    const def = P.def;
    const fr = Math.hypot(P.hx, P.hz) * S;
    const ang = (fr / R) * margin;
    for (const o of occupied) if (o.dir.angleTo(dir) < o.ang + ang) return false;
    // Repère local : haut radial, avant tourné de yaw
    const t1 = new THREE.Vector3().crossVectors(Math.abs(dir.y) < 0.9 ? up : new THREE.Vector3(1, 0, 0), dir).normalize();
    const t2 = new THREE.Vector3().crossVectors(dir, t1);
    const fx = t1.clone().multiplyScalar(Math.cos(yaw)).addScaledVector(t2, Math.sin(yaw));
    const fz = new THREE.Vector3().crossVectors(fx, dir);
    sampler.query(dir, q);
    if (q.r < 0) return false;
    if (isWater(dir, q.r)) return false;
    let rMin = q.r, rMax = q.r;
    if (!def.tree) {
      for (const [a, c] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const p = dir.clone().addScaledVector(fx, (a * P.hx * S) / R).addScaledVector(fz, (c * P.hz * S) / R).normalize();
        sampler.query(p, q);
        if (q.r < 0) return false;
        if (isWater(p, q.r)) return false;
        rMin = Math.min(rMin, q.r); rMax = Math.max(rMax, q.r);
      }
      if (rMax - rMin > (def.maxDrop || 1.2) * m2u * (def.flat ? 1.5 : 1)) return false;
    } else {
      // Pas d'arbre dans les pentes trop fortes
      if (q.nx * dir.x + q.ny * dir.y + q.nz * dir.z < 0.75) return false;
    }
    const base = def.tree ? q.r - 0.15 * m2u : def.flat ? (rMin + rMax) / 2 : rMax;
    const pos = center.clone().addScaledVector(dir, base);
    mTmp.makeBasis(fx, dir, fz);
    qTmp.setFromRotationMatrix(mTmp);
    const sc = def.tree ? S * (0.8 + rnd() * 0.45) : S;
    const mat = new THREE.Matrix4().compose(pos, qTmp, sTmp.set(sc, sc, sc));
    (instances[name] || (instances[name] = [])).push(mat);
    if (!def.plant) occupied.push({ dir: dir.clone(), ang: def.tree ? ang * 0.35 : ang });
    if (P.colliders.boxes.length || P.colliders.cyls.length || P.colliders.rings.length) {
      colliders.push({ m: mat, s: sc, center: pos, radius: P.radius * sc, col: P.colliders });
    }
    return true;
  };
  const near = (c, angR) => {
    const t1 = new THREE.Vector3().crossVectors(Math.abs(c.y) < 0.9 ? up : new THREE.Vector3(1, 0, 0), c).normalize();
    const t2 = new THREE.Vector3().crossVectors(c, t1);
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * angR;
    return c.clone().addScaledVector(t1, Math.cos(a) * r).addScaledVector(t2, Math.sin(a) * r).normalize();
  };
  const goodCenter = (zone = null) => {
    for (let t = 0; t < 60; t++) {
      const c = randDir();
      if (excluded(c)) continue;
      if (!zoneOk(theme, c, zone)) continue;
      if (theme.avoid && theme.avoid(c)) continue;
      sampler.query(c, q);
      if (q.r > 0 && !isWater(c, q.r)) return c;
    }
    return null;
  };
  // Villages : maisons tournées vers la place du village
  for (const [name, nv, nh, zone] of theme.villages || []) {
    for (let v = 0; v < nv; v++) {
      const c = goodCenter(zone); if (!c) continue;
      const spread = (M(18 + nh * 2.4) / U) * m2u / R;
      let placed = 0;
      for (let t = 0; t < nh * 12 && placed < nh; t++) {
        const dir = near(c, spread);
        // Façade vers le centre du village
        const t1 = new THREE.Vector3().crossVectors(Math.abs(dir.y) < 0.9 ? up : new THREE.Vector3(1, 0, 0), dir).normalize();
        const t2 = new THREE.Vector3().crossVectors(dir, t1);
        const toC = c.clone().sub(dir);
        const yaw = Math.atan2(toC.dot(t1), -toC.dot(t2)) + (rnd() - 0.5) * 0.3;
        if (tryPlace(name, dir, yaw, 1.15, zone)) placed++;
      }
      // Lampadaires autour de la place
      for (let l = 0; l < 4; l++) tryPlace('lampadaire', near(c, spread * 0.4), rnd() * 6.28, 1, zone);
    }
  }
  for (const [name, n, zone] of theme.extra || []) {
    for (let i = 0, t = 0; i < n && t < n * 8; t++) if (tryPlace(name, randDir(), rnd() * Math.PI * 2, PREFABS[name].tree ? 1 : 1.1, zone)) i++;
  }
  for (const [name, n, zone] of theme.fields || []) {
    if (name === 'vigne') {
      // Rangs de vigne parallèles, par parcelles
      for (let p = 0; p < n / 10; p++) {
        const c = goodCenter(zone); if (!c) continue;
        const yaw = rnd() * Math.PI;
        const t1 = new THREE.Vector3().crossVectors(Math.abs(c.y) < 0.9 ? up : new THREE.Vector3(1, 0, 0), c).normalize();
        const t2 = new THREE.Vector3().crossVectors(c, t1);
        const across = t1.clone().multiplyScalar(-Math.sin(yaw)).addScaledVector(t2, Math.cos(yaw));
        for (let r = 0; r < 10; r++) tryPlace('vigne', c.clone().addScaledVector(across, ((r - 5) * 2.6 * m2u) / R).normalize(), yaw, 0.6, zone);
      }
    } else for (let i = 0, t = 0; i < n && t < n * 8; t++) if (tryPlace(name, randDir(), rnd() * Math.PI * 2, 1, zone)) i++;
  }
  for (const [name, nf, nt, zone] of theme.forests || []) {
    for (let f = 0; f < nf; f++) {
      const c = goodCenter(zone); if (!c) continue;
      const spread = (M(16 + nt * 0.9) / U) * m2u / R;
      for (let i = 0, t = 0; i < nt && t < nt * 4; t++) if (tryPlace(name, near(c, spread), rnd() * 6.28, 1, zone)) i++;
    }
  }
  // Maillages instanciés
  const col = new THREE.Color();
  // Végétation basse : herbes, fleurs des champs, fougères et buissons, rochers ; roseaux près de l'eau
  {
    const BARREN = ['ceres', 'pluton', 'charon', 'eris', 'haumea', 'makemake', 'station', 'petra', 'ricochet', 'glenos'];
    const kk = Math.min(3, Math.max(0.5, (R / m2u) / 75) ** 2);
    const list = theme.plants || (BARREN.includes(b.id)
      ? [['rocher', 120]]
      : [['herbe', 900], ['paquerette', 130], ['coquelicot', 80], ['bleuet', 60], ['bouton-or', 90], ['fougere', 140], ['buisson', 110], ['rocher', 70], ['champignon', 40]]);
    for (const [name, n, zone] of list) {
      const N = Math.round(n * kk);
      for (let i = 0, t = 0; i < N && t < N * 4; t++) if (tryPlace(name, randDir(), rnd() * Math.PI * 2, 0.2, zone)) i++;
    }
    for (const L of lakes) for (let i = 0; i < 26; i++) tryPlace('roseau', near(L.dir, L.ang * 1.15), rnd() * 6.28, 0.2);
  }

  for (const [name, mats] of Object.entries(instances)) {
    const P = prefab(name);
    for (const [geo, mtl] of [[P.solid, kitSolid], [P.glow, kitGlow], [P.glass, kitGlass]]) {
      if (!geo) continue;
      const im = new THREE.InstancedMesh(geo, mtl, mats.length);
      mats.forEach((m, i) => {
        im.setMatrixAt(i, m);
        if (mtl === kitSolid) im.setColorAt(i, col.setScalar(0.9 + rnd() * 0.18));
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      im.userData.cover = true;
      if (mtl === kitGlass) im.renderOrder = 3;
      group.add(im);
    }
  }
  return { sampler, water, colliders, group, R, lakes, m2u };
}
