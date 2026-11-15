// Kit de construction : bâtiments creux et aménagés, praticables à pied.
// Toutes les pièces d'un bâtiment sont fusionnées en un seul maillage à couleurs par sommet
// (plus un maillage lumineux pour les fenêtres et les lampes), et chaque élément solide
// est aussi enregistré comme volume de collision (boîtes alignées, cylindres, murs circulaires).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Échelle des monuments : un personnage de 1,75 m mesure 0,095 unité
export const U = 0.095 / 1.75;
export const M = (v) => v * U;

export function rng(seed) {
  let a = (seed * 9301 + 49297) | 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const tmpC = new THREE.Color();
function prep(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  g.morphAttributes = {};
  tmpC.set(color);
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  // Matière moins plate : pied des murs assombri, dessous dans l'ombre, dessus éclairci,
  // et une légère variation d'une face à l'autre (pierres, enduits, planches)
  const P = g.attributes.position, N = g.attributes.normal;
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) { const y = P.getY(i); if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const span = Math.max(y1 - y0, 1e-6);
  for (let i = 0; i < n; i++) {
    const t = (P.getY(i) - y0) / span, ny = N.getY(i);
    const q = i - (i % 6);
    const hsh = Math.sin((P.getX(q) + P.getX(q + 1) + P.getX(q + 2)) * 91.7 + (P.getY(q) + P.getY(q + 1) + P.getY(q + 2)) * 47.3 + (P.getZ(q) + P.getZ(q + 1) + P.getZ(q + 2)) * 73.1) * 43758.5;
    let f = (0.87 + 0.15 * t) * (1 + ((hsh - Math.floor(hsh)) - 0.5) * 0.07);
    if (ny < -0.5) f *= 0.78; else if (ny > 0.5) f *= 1.04;
    c[i * 3] = tmpC.r * f; c[i * 3 + 1] = tmpC.g * f; c[i * 3 + 2] = tmpC.b * f;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

export const kitSolid = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
kitSolid.userData.tex = 1;
// Même matière sans appareil de pierre : personnages, véhicules, coques, mobilier
export const kitPlain = kitSolid.clone(); kitPlain.userData.tex = 4;
export function plain(g) { g.traverse((o) => { if (o.material === kitSolid) o.material = kitPlain; }); return g; }
export const kitGlow = new THREE.MeshBasicMaterial({ vertexColors: true });
kitGlow.color.setScalar(1.3);
export const kitGlass = new THREE.MeshStandardMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.1, depthWrite: false });

export class Kit {
  constructor() {
    this.parts = []; this.glows = []; this.glass = [];
    this.boxes = []; this.cyls = []; this.rings = []; this.doors = []; this.spots = [];
  }
  // Boîte posée (y = base). Les boîtes non tournées deviennent aussi des volumes de collision.
  box(w, h, d, x, y, z, color, o = {}) {
    if (!(w > 1e-5 && h > 1e-5 && d > 1e-5)) return this;
    const g = new THREE.BoxGeometry(w, h, d);
    if (o.rotX) g.rotateX(o.rotX);
    if (o.rotZ) g.rotateZ(o.rotZ);
    if (o.rotY) g.rotateY(o.rotY);
    g.translate(x, y + h / 2, z);
    if (o.glass) { this.glass.push(prep(g, 0xffffff)); return this; }
    (o.glow ? this.glows : this.parts).push(prep(g, color));
    const rotated = o.rotX || o.rotZ || (o.rotY && Math.abs(Math.sin(o.rotY * 2)) > 1e-3);
    if (o.collide !== false && !o.glow && !rotated) {
      const q = o.rotY && Math.abs(Math.sin(o.rotY)) > 0.5;
      const hw = (q ? d : w) / 2, hd = (q ? w : d) / 2;
      this.boxes.push([x - hw, y, z - hd, x + hw, y + h, z + hd]);
    }
    return this;
  }
  // Géométrie quelconque déjà placée (décor, sans collision)
  geo(g, color, o = {}) { (o.glow ? this.glows : this.parts).push(prep(g, color)); return this; }
  cyl(rt, rb, h, x, y, z, color, o = {}) {
    const g = new THREE.CylinderGeometry(rt, rb, h, o.seg || 12, 1, !!o.open);
    g.translate(x, y + h / 2, z);
    (o.glow ? this.glows : this.parts).push(prep(g, color));
    if (o.collide !== false && !o.glow) this.cyls.push([x, z, Math.max(rt, rb), y, y + h]);
    return this;
  }
  sphere(r, x, y, z, color, o = {}) {
    const g = new THREE.SphereGeometry(r, o.seg || 10, Math.max(4, (o.seg || 10) >> 1), 0, Math.PI * 2, 0, o.half ? Math.PI / 2 : Math.PI);
    if (o.sy) g.scale(1, o.sy, 1);
    g.translate(x, y, z);
    (o.glow ? this.glows : this.parts).push(prep(g, color));
    return this;
  }
  cone(r, h, x, y, z, color, o = {}) {
    const g = new THREE.ConeGeometry(r, h, o.seg || 8);
    if (o.rotY) g.rotateY(o.rotY);
    g.translate(x, y + h / 2, z);
    (o.glow ? this.glows : this.parts).push(prep(g, color));
    if (o.collide) this.cyls.push([x, z, r * 0.6, y, y + h * 0.6]);
    return this;
  }
  // Toit à deux pans, faîtage selon X (ou Z si alongZ)
  gable(w, h, d, x, y, z, color, o = {}) {
    const s = new THREE.Shape();
    const span = o.alongZ ? w : d, len = o.alongZ ? d : w;
    s.moveTo(-span / 2 - (o.over || 0), 0); s.lineTo(span / 2 + (o.over || 0), 0); s.lineTo(0, h); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: len + 2 * (o.over || 0), bevelEnabled: false });
    g.translate(0, 0, -len / 2 - (o.over || 0));
    if (!o.alongZ) g.rotateY(Math.PI / 2);
    g.translate(x, y, z);
    return this.geo(g, color);
  }
  // Toit à quatre pans / mansardé (trapèze extrudé)
  hip(w, h, d, x, y, z, color, inset = 0.3) {
    const s = new THREE.Shape();
    s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(d / 2 - d * inset, h); s.lineTo(-d / 2 + d * inset, h); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
    g.translate(0, 0, -w / 2); g.rotateY(Math.PI / 2); g.translate(x, y, z);
    return this.geo(g, color);
  }
  ring(x, z, r, y0, y1, gaps = []) { this.rings.push({ x, z, r, y0, y1, gaps }); return this; }
  solid(x0, y0, z0, x1, y1, z1) { this.boxes.push([x0, y0, z0, x1, y1, z1]); return this; }
  // Rend les maillages et attache les volumes de collision au parent
  build(parent) {
    if (this.parts.length) { const m = new THREE.Mesh(mergeGeometries(this.parts), kitSolid); m.userData.kit = true; parent.add(m); }
    if (this.glows.length) { const m = new THREE.Mesh(mergeGeometries(this.glows), kitGlow); m.userData.kit = true; parent.add(m); }
    if (this.glass.length) { const m = new THREE.Mesh(mergeGeometries(this.glass), kitGlass); m.userData.kit = true; m.renderOrder = 3; parent.add(m); }
    const c = parent.userData.colliders || (parent.userData.colliders = { boxes: [], cyls: [], rings: [] });
    c.boxes.push(...this.boxes); c.cyls.push(...this.cyls); c.rings.push(...this.rings);
    parent.userData.doors = (parent.userData.doors || []).concat(this.doors);
    parent.userData.spots = (parent.userData.spots || []).concat(this.spots);
    this.parts = []; this.glows = []; this.glass = []; this.boxes = []; this.cyls = []; this.rings = []; this.doors = []; this.spots = [];
    return parent;
  }
  // Géométries fusionnées (pour les maisons instanciées)
  merged() {
    return {
      solid: this.parts.length ? mergeGeometries(this.parts) : null,
      glow: this.glows.length ? mergeGeometries(this.glows) : null,
      glass: this.glass.length ? mergeGeometries(this.glass) : null,
      colliders: { boxes: this.boxes, cyls: this.cyls, rings: this.rings },
    };
  }
}
// Kit attaché à un groupe (créé à la demande)
export function kitOf(s) { return s.userData.kit || (s.userData.kit = new Kit()); }

// ---------------------------------------------------------------------------
// Bâtiment creux : murs percés de portes, planchers, escaliers, plafonds, mobilier, lampes
// ---------------------------------------------------------------------------
const WOOD = 0xa8744a, DARKWOOD = 0x6a4428, METAL = 0x8c949c, WHITE = 0xf2eee6;
export function hollow(k, o) {
  const {
    w, d, h, x = 0, z = 0, floors = 1, wall = 0xe8dcc4, inner = null, floorCol = 0x9a6e48, ceil = 0xf3ece0,
    doors = { '+z': 0 }, open = [], furnish = 'none', t = 0.02, doorW = M(1.7), doorH = M(2.6),
    stair = 'auto', seed = 1, lamps = true, base = 0, roofSlab = true, stairCol = 0x8a5c3a, topRoom = M(3.4),
    toRoof = false, stairX = null, stairZ = null,
  } = o;
  const rnd = rng(seed);
  const X0 = x - w / 2 + t, X1 = x + w / 2 - t, Z0 = z - d / 2 + t, Z1 = z + d / 2 - t;
  const y0 = base;
  // Murs (avec portes)
  for (const side of ['+z', '-z', '+x', '-x']) {
    if (open.includes(side)) continue;
    const alongX = side === '+z' || side === '-z';
    const len = alongX ? w : d - 2 * t;
    const c = alongX ? x : z;
    const fixed = side === '+z' ? z + d / 2 - t / 2 : side === '-z' ? z - d / 2 + t / 2 : side === '+x' ? x + w / 2 - t / 2 : x - w / 2 + t / 2;
    const col = inner ?? wall;
    const seg = (a, b, yA, yB) => {
      if (b - a < 1e-4 || yB - yA < 1e-4) return;
      if (alongX) k.box(b - a, yB - yA, t, (a + b) / 2, yA, fixed, col);
      else k.box(t, yB - yA, b - a, fixed, yA, (a + b) / 2, col);
    };
    const a = c - len / 2, b = c + len / 2;
    const door = doors[side];
    if (door === undefined) seg(a, b, y0, y0 + h);
    else {
      const dc = c + door;
      seg(a, dc - doorW / 2, y0, y0 + h);
      seg(dc + doorW / 2, b, y0, y0 + h);
      seg(dc - doorW / 2, dc + doorW / 2, y0 + doorH, y0 + h);
      const nx = side === '+x' ? 1 : side === '-x' ? -1 : 0, nz = side === '+z' ? 1 : side === '-z' ? -1 : 0;
      k.doors.push({ x: alongX ? dc : fixed, z: alongX ? fixed : dc, nx, nz, w: doorW, y: y0 });
      // Encadrement de porte en bois sombre (décor)
      const fx = alongX ? dc : fixed + nx * t * 0.6, fz = alongX ? fixed + nz * t * 0.6 : dc;
      const jamb = M(0.12);
      for (const s of [-1, 1]) {
        if (alongX) k.box(jamb, doorH, t * 0.4, fx + s * (doorW / 2 + jamb / 2), y0, fz, DARKWOOD, { collide: false });
        else k.box(t * 0.4, doorH, jamb, fx, y0, fz + s * (doorW / 2 + jamb / 2), DARKWOOD, { collide: false });
      }
      if (alongX) k.box(doorW + 2 * jamb, jamb, t * 0.4, fx, y0 + doorH, fz, DARKWOOD, { collide: false });
      else k.box(t * 0.4, jamb, doorW + 2 * jamb, fx, y0 + doorH, fz, DARKWOOD, { collide: false });
    }
  }
  // Niveaux
  const fh = h / floors;
  const level = (i) => (i === 0 ? y0 + 0.012 : y0 + i * fh);
  const flights = toRoof ? floors : floors - 1;
  k.box(X1 - X0, 0.012, Z1 - Z0, x, y0, z, floorCol);
  const slab = Math.min(0.016, fh * 0.08);
  const rise0 = M(0.19), run = M(0.28);
  const sw = Math.min(M(1.3), (Z1 - Z0) / 3);
  const flightLen = (i) => Math.ceil((level(i + 1) - level(i)) / rise0) * run;
  const Lmax = flights > 0 ? flightLen(0) : 0;
  const mode = flights <= 0 ? 'none'
    : stair !== 'spiral' && (X1 - X0) >= Lmax + M(2.6) && (Z1 - Z0) >= 2 * sw + M(2.2) ? 'straight' : 'spiral';
  const holes = [];
  let furnZ0 = Z0 + M(0.35);
  let yTop = y0 + h - topRoom;
  if (mode === 'straight') {
    const zA = stairZ ?? Z0 + sw / 2;
    const lanes = [zA, zA + sw + M(0.12)];
    const xs = stairX ?? X1 - M(1.3) - Lmax;
    for (let f = 0; f < flights; f++) {
      const yA = level(f), yB = level(f + 1);
      const n = Math.ceil((yB - yA) / rise0), r = (yB - yA) / n, L = n * run;
      const lane = lanes[f % 2], dir = f % 2 === 0 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const top = yA + (i + 1) * r;
        const xa = dir > 0 ? xs + i * run : xs + L - (i + 1) * run;
        k.box(run, top - yA, sw, xa + run / 2, yA, lane, i % 2 ? stairCol : 0x7d5234);
      }
      holes[f + 1] = [xs, xs + L, lane - sw / 2 - M(0.05), lane + sw / 2 + M(0.05)];
      // Garde-corps le long de la trémie (les extrémités restent ouvertes)
      const hz = holes[f + 1];
      for (const zz of [hz[2], hz[3]]) {
        if (zz <= Z0 + 0.002) continue;
        k.box(L - 2 * run, M(1.0), M(0.08), xs + L / 2, yB, zz, DARKWOOD);
      }
    }
    furnZ0 = lanes[1] + sw / 2 + M(0.7);
  } else if (mode === 'spiral') {
    // Escalier à noyau central (tours) : il tourne le long des murs jusqu'à la salle haute
    const lw = Math.min(sw, (Math.min(X1 - X0, Z1 - Z0)) / 3.2);
    const cx0 = X0 + lw, cx1 = X1 - lw, cz0 = Z0 + lw, cz1 = Z1 - lw;
    yTop = Math.max(y0 + M(3), y0 + h - topRoom);
    k.box(cx1 - cx0, yTop - y0, cz1 - cz0, (cx0 + cx1) / 2, y0, (cz0 + cz1) / 2, inner ?? wall);
    const cells = [];
    const sideCells = (ax, a0, a1, b0, b1, dirSign) => {
      const len = a1 - a0, m = Math.max(1, Math.floor(len / run)), rr = len / m;
      for (let j = 0; j < m; j++) {
        const s0 = dirSign > 0 ? a0 + j * rr : a1 - (j + 1) * rr;
        cells.push(ax === 'x' ? [s0, s0 + rr, b0, b1] : [b0, b1, s0, s0 + rr]);
      }
    };
    let top = y0 + 0.012, guard = 0;
    const steps = [];
    while (top < yTop - 1e-4 && guard++ < 400) {
      cells.length = 0;
      sideCells('x', cx0, cx1, Z0, cz0, 1); cells.push([cx1, X1, Z0, cz0]);
      sideCells('z', cz0, cz1, cx1, X1, 1); cells.push([cx1, X1, cz1, Z1]);
      sideCells('x', cx0, cx1, cz1, Z1, -1); cells.push([X0, cx0, cz1, Z1]);
      sideCells('z', cz0, cz1, X0, cx0, -1); cells.push([X0, cx0, Z0, cz0]);
      for (const c of cells) { if (top >= yTop - 1e-4) break; top = Math.min(yTop, top + rise0); steps.push([c, top]); }
    }
    steps.forEach(([c, tp], i) => {
      const bottom = Math.max(y0, tp - M(0.55));
      k.box(c[1] - c[0], tp - bottom, c[3] - c[2], (c[0] + c[1]) / 2, bottom, (c[2] + c[3]) / 2, i % 2 ? stairCol : 0x7d5234);
    });
    // Salle haute : plancher sur le noyau prolongé jusqu'aux murs, sauf la dernière volée
    const last = steps.slice(-6).map(([c]) => c);
    const lx0 = Math.min(...last.map((c) => c[0])), lx1 = Math.max(...last.map((c) => c[1]));
    const lz0 = Math.min(...last.map((c) => c[2])), lz1 = Math.max(...last.map((c) => c[3]));
    slabWithHole(k, X0, X1, Z0, Z1, yTop - slab, slab, [lx0, lx1, lz0, lz1], floorCol);
    furnZ0 = null;
  }
  for (let f = 1; f < floors && mode === 'straight'; f++) slabWithHole(k, X0, X1, Z0, Z1, level(f) - slab, slab, holes[f], floorCol);
  if (toRoof && mode === 'straight') slabWithHole(k, X0, X1, Z0, Z1, y0 + h - slab, slab, holes[floors], ceil);
  else if (roofSlab) k.box(X1 - X0, slab, Z1 - Z0, x, y0 + h - slab, z, ceil);
  // Lampes au plafond de chaque niveau
  const levels = mode === 'spiral' ? [[y0, yTop], [yTop, y0 + h]] : Array.from({ length: floors }, (_, f) => [level(f), f === floors - 1 ? y0 + h : level(f + 1)]);
  if (lamps) {
    for (const [, yc] of levels) {
      const nx = Math.max(1, Math.round((X1 - X0) / M(5))), nz = Math.max(1, Math.round((Z1 - Z0) / M(5)));
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const lx = X0 + ((X1 - X0) * (i + 0.5)) / nx, lz = Z0 + ((Z1 - Z0) * (j + 0.5)) / nz;
        k.box(M(0.7), M(0.08), M(0.7), lx, yc - slab - M(0.12), lz, 0xffd9a0, { glow: true });
      }
    }
  }
  // Mobilier
  if (furnish !== 'none') {
    levels.forEach(([yl, yc], f) => {
      if (mode === 'spiral' && f === 0) return;
      const region = mode === 'spiral'
        ? [X0 + M(0.3), X1 - M(0.3), Z0 + M(0.3), Z1 - M(0.3)]
        : [X0 + M(0.35), X1 - M(0.35), furnZ0, Z1 - M(0.35)];
      if (region[1] - region[0] < M(1.5) || region[3] - region[2] < M(1.5)) return;
      const doorsHere = f === 0 ? k.doors.filter((dd) => Math.abs(dd.y - y0) < 1e-6) : [];
      FURNISH[furnish]?.(k, region, yl + (f === 0 ? 0.012 : 0), yc - yl, rnd, doorsHere, f, x, z);
    });
  }
  return { X0, X1, Z0, Z1, level, levels, yTop, mode, holes };
}

function slabWithHole(k, X0, X1, Z0, Z1, y, th, hole, col) {
  if (!hole) { k.box(X1 - X0, th, Z1 - Z0, (X0 + X1) / 2, y, (Z0 + Z1) / 2, col); return; }
  const hx0 = Math.max(X0, hole[0]), hx1 = Math.min(X1, hole[1]), hz0 = Math.max(Z0, hole[2]), hz1 = Math.min(Z1, hole[3]);
  k.box(X1 - X0, th, hz0 - Z0, (X0 + X1) / 2, y, (Z0 + hz0) / 2, col);
  k.box(X1 - X0, th, Z1 - hz1, (X0 + X1) / 2, y, (hz1 + Z1) / 2, col);
  k.box(hx0 - X0, th, hz1 - hz0, (X0 + hx0) / 2, y, (hz0 + hz1) / 2, col);
  k.box(X1 - hx1, th, hz1 - hz0, (hx1 + X1) / 2, y, (hz0 + hz1) / 2, col);
}

// Grille de meubles dans une zone, en laissant libre le passage devant les portes
function grid(region, cw, cd, doors, fn) {
  const [x0, x1, z0, z1] = region;
  const nx = Math.floor((x1 - x0) / cw), nz = Math.floor((z1 - z0) / cd);
  const ox = x0 + (x1 - x0 - nx * cw) / 2, oz = z0 + (z1 - z0 - nz * cd) / 2;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const cx = ox + (i + 0.5) * cw, cz = oz + (j + 0.5) * cd;
    if (doors.some((d) => Math.abs((d.nz ? cx - d.x : cz - d.z)) < M(1.6) + (d.nz ? cw : cd) / 2 && Math.abs(d.nz ? cz - d.z : cx - d.x) < M(4.5))) continue;
    fn(cx, cz, i, j, nx, nz);
  }
}
const chair = (k, x, y, z, face, col = WOOD) => {
  k.box(M(0.45), M(0.45), M(0.45), x, y, z, col);
  k.box(M(0.45), M(0.5), M(0.06), x, y + M(0.45), z - face * M(0.2), col, { collide: false });
};
const plant = (k, x, y, z, rnd) => {
  k.cyl(M(0.22), M(0.18), M(0.45), x, y, z, 0xb5653a);
  k.sphere(M(0.4 + rnd() * 0.15), x, y + M(0.75), z, 0x4f8a3c);
};
const BOOKS = [0x9b3b2f, 0x2f5b8a, 0xd8b45a, 0x3f7a4a, 0x7a4a7a, 0xe0d4b8, 0x2b2b2b];
const shelf = (k, x, y, z, len, h, rnd, alongX = true) => {
  if (alongX) k.box(len, h, M(0.4), x, y, z, DARKWOOD); else k.box(M(0.4), h, len, x, y, z, DARKWOOD);
  for (let r = 0; r < 4; r++) {
    let a = -len / 2 + M(0.05);
    while (a < len / 2 - M(0.1)) {
      const bw = M(0.08 + rnd() * 0.1), bh = M(0.25 + rnd() * 0.08);
      const by = y + M(0.15) + r * (h - M(0.2)) / 4;
      for (const s of [-1, 1]) {
        if (alongX) k.box(bw, bh, M(0.03), x + a + bw / 2, by, z + s * M(0.21), BOOKS[Math.floor(rnd() * BOOKS.length)], { collide: false });
        else k.box(M(0.03), bh, bw, x + s * M(0.21), by, z + a + bw / 2, BOOKS[Math.floor(rnd() * BOOKS.length)], { collide: false });
      }
      a += bw + M(0.01);
    }
  }
};
export const FURNISH = {
  school(k, R, y, fh, rnd, doors) {
    // Tableau noir sur le mur -X, bureau du professeur, pupitres en rangées
    const [x0, x1, z0, z1] = R, zc = (z0 + z1) / 2;
    k.box(M(0.06), M(1.2), Math.min(M(3.2), z1 - z0 - M(0.6)), x0 + M(0.02), y + M(0.95), zc, 0x2f4a3a, { collide: false });
    k.box(M(0.08), M(0.08), Math.min(M(3.2), z1 - z0 - M(0.6)), x0 + M(0.06), y + M(0.9), zc, 0xc8b88f, { collide: false });
    k.box(M(1.4), M(0.75), M(0.7), x0 + M(1.3), y, zc, DARKWOOD);
    grid([x0 + M(2.6), x1, z0, z1], M(1.8), M(1.5), doors, (cx, cz) => {
      k.box(M(1.1), M(0.72), M(0.55), cx, y, cz, WOOD);
      chair(k, cx + M(0.65), y, cz, -1);
    });
  },
  office(k, R, y, fh, rnd, doors) {
    grid(R, M(2.4), M(2.2), doors, (cx, cz, i, j) => {
      if ((i + j) % 5 === 3) { plant(k, cx, y, cz, rnd); return; }
      k.box(M(1.5), M(0.74), M(0.75), cx, y, cz, 0xd8d2c4);
      k.box(M(0.6), M(0.4), M(0.05), cx, y + M(0.78), cz - M(0.2), 0x9fd0ff, { glow: true });
      chair(k, cx, y, cz + M(0.7), 1, 0x3a3f48);
    });
  },
  library(k, R, y, fh, rnd, doors) {
    const [x0, x1, z0, z1] = R;
    const hh = Math.min(M(2.1), fh - M(0.5));
    for (let zz = z0 + M(0.6); zz < z1 - M(2.2); zz += M(1.8)) {
      const len = Math.min(M(4), (x1 - x0) * 0.42);
      shelf(k, x0 + len / 2 + M(0.2), y, zz, len, hh, rnd);
      if (x1 - x0 > len * 2 + M(3)) shelf(k, x1 - len / 2 - M(0.2), y, zz, len, hh, rnd);
    }
    const tz = z1 - M(1.2);
    k.box(M(2.2), M(0.75), M(1.0), (x0 + x1) / 2, y, tz, WOOD);
    k.box(M(0.25), M(0.35), M(0.25), (x0 + x1) / 2 - M(0.6), y + M(0.75), tz, 0xffe0a0, { glow: true });
  },
  church(k, R, y, fh, rnd, doors) {
    const [x0, x1, z0, z1] = R, xc = (x0 + x1) / 2;
    // Allée centrale vers l'autel (au fond, côté -Z)
    k.box(M(1.2), M(0.01), z1 - z0 - M(1), xc, y, (z0 + z1) / 2 + M(0.4), 0x9c2b2b, { collide: false });
    k.box(M(2.0), M(1.0), M(0.8), xc, y, z0 + M(0.8), WHITE);
    k.box(M(0.12), M(0.9), M(0.12), xc, y + M(1.0), z0 + M(0.8), 0xd9ab45, { collide: false });
    k.box(M(0.5), M(0.12), M(0.12), xc, y + M(1.55), z0 + M(0.8), 0xd9ab45, { collide: false });
    for (const s of [-1, 1]) k.box(M(0.1), M(0.3), M(0.1), xc + s * M(0.7), y + M(1.0), z0 + M(0.8), 0xffd28a, { glow: true });
    const bw = Math.min(M(3), (x1 - x0) / 2 - M(1.1));
    if (bw < M(1)) return;
    for (let zz = z0 + M(2.6); zz < z1 - M(1.6); zz += M(1.1)) {
      for (const s of [-1, 1]) {
        const bx = xc + s * (M(0.8) + bw / 2);
        k.box(bw, M(0.45), M(0.45), bx, y, zz, DARKWOOD);
        k.box(bw, M(0.5), M(0.08), bx, y + M(0.45), zz + M(0.22), DARKWOOD, { collide: false });
      }
    }
  },
  lab(k, R, y, fh, rnd, doors) {
    grid(R, M(4), M(2.6), doors, (cx, cz, i) => {
      k.box(M(3), M(0.9), M(0.8), cx, y, cz, WHITE);
      for (let q = 0; q < 4; q++) k.box(M(0.12), M(0.25), M(0.12), cx - M(1.1) + q * M(0.7), y + M(0.9), cz, [0x7dffc8, 0x9fd0ff, 0xffb35a, 0xc9a0ff][q], { glow: true });
      if (i % 2) k.box(M(0.7), M(0.45), M(0.05), cx + M(0.8), y + M(0.95), cz - M(0.3), 0x9fd0ff, { glow: true });
    });
  },
  workshop(k, R, y, fh, rnd, doors) {
    grid(R, M(4), M(3.4), doors, (cx, cz, i, j) => {
      const t = (i * 3 + j) % 3;
      if (t === 0) {
        k.box(M(2.4), M(1.1), M(0.9), cx, y, cz, 0x6f7780);
        k.box(M(0.5), M(0.45), M(0.6), cx - M(0.8), y + M(1.1), cz, 0xe07a3a, { collide: false });
        k.cyl(M(0.12), M(0.12), M(1.1), cx + M(0.4), y + M(1.2), cz, 0xc0c4c8, { collide: false });
      } else if (t === 1) {
        k.box(M(2), M(0.85), M(0.8), cx, y, cz, WOOD);
        k.box(M(0.4), M(0.25), M(0.3), cx - M(0.5), y + M(0.85), cz, 0x3a3f48, { collide: false });
      } else {
        k.box(M(1), M(1), M(1), cx - M(0.4), y, cz, 0xb08a5a);
        k.box(M(0.8), M(0.8), M(0.8), cx + M(0.6), y, cz + M(0.2), 0xa07a4a);
      }
    });
  },
  home(k, R, y, fh, rnd, doors, f) {
    const [x0, x1, z0, z1] = R;
    if (f === 0 || x1 - x0 > M(7)) {
      // Séjour : table, chaises, canapé, cuisine
      const tx = x0 + (x1 - x0) * 0.4, tz = (z0 + z1) / 2;
      k.box(M(1.2), M(0.74), M(0.8), tx, y, tz, WOOD);
      chair(k, tx - M(0.9), y, tz, 1); chair(k, tx + M(0.9), y, tz, -1);
      k.box(M(2.4), M(0.9), M(0.6), x1 - M(1.3), y, z0 + M(0.3), 0xe8e0d0);
      k.box(M(0.6), M(0.3), M(0.4), x1 - M(0.7), y + M(0.9), z0 + M(0.3), 0xffc070, { glow: true });
      k.box(M(2), M(0.45), M(0.8), x0 + M(1.1), y, z1 - M(0.6), 0x8a3f3a);
      k.box(M(2), M(0.5), M(0.2), x0 + M(1.1), y + M(0.45), z1 - M(0.2), 0x8a3f3a, { collide: false });
      k.box(M(2.4), M(0.01), M(1.6), tx, y, tz, 0xc9a26b, { collide: false });
    } else {
      // Chambre : lit, armoire, lampe
      const bx = x0 + M(1.2), bz = (z0 + z1) / 2;
      k.box(M(1.6), M(0.5), M(2.0), bx, y, bz, 0xf2ece0);
      k.box(M(1.6), M(0.12), M(1.4), bx, y + M(0.5), bz + M(0.3), [0x3f6fa8, 0xc0573f, 0x6a9a4f][Math.floor(rnd() * 3)], { collide: false });
      k.box(M(1.6), M(0.9), M(0.12), bx, y, bz - M(1.0), DARKWOOD);
      k.box(M(1.2), M(1.9), M(0.6), x1 - M(0.7), y, z0 + M(0.4), DARKWOOD);
      k.box(M(0.25), M(0.35), M(0.25), bx + M(1.1), y + M(0.5), bz - M(0.8), 0xffd28a, { glow: true });
    }
  },
  shop(k, R, y, fh, rnd, doors) {
    const [x0, x1, z0, z1] = R;
    k.box(Math.min(M(3), x1 - x0 - M(1)), M(1.0), M(0.6), (x0 + x1) / 2, y, z0 + M(1.4), 0xb07a4a);
    shelf(k, (x0 + x1) / 2, y, z0 + M(0.25), Math.min(M(4), x1 - x0 - M(0.6)), M(1.8), rnd);
  },
  hall(k, R, y, fh, rnd, doors) {
    const [x0, x1, z0, z1] = R;
    k.box(Math.min(M(2.6), x1 - x0 - M(1)), M(1.05), M(0.7), (x0 + x1) / 2, y, z0 + M(0.8), 0xc8b08a);
    grid([x0, x1, z0 + M(2.4), z1], M(3.2), M(2.4), doors, (cx, cz, i, j) => {
      if ((i + j) % 2) plant(k, cx, y, cz, rnd);
      else k.box(M(1.8), M(0.45), M(0.5), cx, y, cz, 0x6a7a8a);
    });
  },
  observatory(k, R, y, fh, rnd, doors) {
    const [x0, x1, z0, z1] = R;
    shelf(k, (x0 + x1) / 2, y, z0 + M(0.25), Math.min(M(5), x1 - x0 - M(0.6)), Math.min(M(2.1), fh - M(0.4)), rnd);
    grid([x0, x1, z0 + M(1.6), z1], M(3), M(2.6), doors, (cx, cz, i) => {
      k.box(M(1.8), M(0.76), M(0.9), cx, y, cz, DARKWOOD);
      if (i % 2) k.sphere(M(0.3), cx, y + M(1.1), cz, 0x3f6fa8);
      else k.box(M(0.7), M(0.5), M(0.05), cx, y + M(0.8), cz - M(0.3), 0xffd9a0, { glow: true });
      chair(k, cx, y, cz + M(0.75), 1, 0x5a3a24);
    });
  },
};

// Bandeaux décoratifs sur les quatre faces d'un volume (sans traverser l'intérieur)
export function faceBands(k, w, d, x, z, y, bh, color, { out = 0.006, glow = false, gap = null } = {}) {
  const o = { collide: false, glow };
  if (gap && y < gap.y1) {
    // Bandeau interrompu au droit de la porte (façade +Z)
    const a = x - w / 2 - out, b = x + w / 2 + out;
    k.box(gap.x0 - a, bh, out, (a + gap.x0) / 2, y, z + d / 2 + out / 2, color, o);
    k.box(b - gap.x1, bh, out, (gap.x1 + b) / 2, y, z + d / 2 + out / 2, color, o);
  } else k.box(w + 2 * out, bh, out, x, y, z + d / 2 + out / 2, color, o);
  k.box(w + 2 * out, bh, out, x, y, z - d / 2 - out / 2, color, o);
  k.box(out, bh, d, x + w / 2 + out / 2, y, z, color, o);
  k.box(out, bh, d, x - w / 2 - out / 2, y, z, color, o);
}

// Fenêtres (vitres lumineuses + appui) sur une face d'un volume
export function facadeWindows(k, { w, x, z, y0, floors, fh, cols, side = 1, axis = 'z', ww = M(1.1), wh = M(1.5), lit = 0xffc070, trim = 0xf3ecdc, skip = null }) {
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      const a = -w / 2 + (w / cols) * (c + 0.5);
      if (skip && skip(a, f)) continue;
      const y = y0 + f * fh + fh * 0.32;
      if (axis === 'z') {
        k.box(ww, wh, M(0.06), x + a, y, z + side * M(0.03), lit, { glow: true });
        k.box(ww * 0.9, wh * 0.9, M(0.04), x + a, y + wh * 0.05, z - side * (0.02 + M(0.03)), 0x6f93ad, { glow: true });
        k.box(ww + M(0.3), M(0.12), M(0.25), x + a, y - M(0.12), z + side * M(0.1), trim, { collide: false });
      } else {
        k.box(M(0.06), wh, ww, x + side * M(0.03), y, z + a, lit, { glow: true });
        k.box(M(0.04), wh * 0.9, ww * 0.9, x - side * (0.02 + M(0.03)), y + wh * 0.05, z + a, 0x6f93ad, { glow: true });
        k.box(M(0.25), M(0.12), ww + M(0.3), x + side * M(0.1), y - M(0.12), z + a, trim, { collide: false });
      }
    }
  }
}
