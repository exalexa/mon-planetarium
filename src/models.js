// Modèles procéduraux low-poly : planètes, lunes, lieux d'études, sondes spatiales, projets.
// Style volontairement « fait main », facetté, proche de l'esthétique d'Outer Wilds.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------
export function mulberry32(seed) {
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
export function fbm3(x, y, z, oct = 4) {
  let v = 0, a = 0.5;
  for (let i = 0; i < oct; i++) {
    v += a * noise3(x, y, z);
    x = x * 2.03 + 1.7; y = y * 2.03 + 9.2; z = z * 2.03 + 3.1;
    a *= 0.5;
  }
  return v;
}

export const mat = (color, o = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...o });
export const glow = (color, intensity = 2) =>
  new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: intensity, roughness: 1 });

export function add(parent, geometry, material, x = 0, y = 0, z = 0, rot = null) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  parent.add(m);
  return m;
}
export const box = (p, w, h, d, m, x, y, z, rot) => add(p, new THREE.BoxGeometry(w, h, d), m, x, y + h / 2, z, rot);
export const cyl = (p, rt, rb, h, seg, m, x, y, z, rot) => add(p, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y + h / 2, z, rot);
export const cone = (p, r, h, seg, m, x, y, z, rot) => add(p, new THREE.ConeGeometry(r, h, seg), m, x, y + h / 2, z, rot);

// Toit à deux pans (prisme triangulaire), faîtage selon X
export function gableRoof(p, w, h, d, m, x, y, z) {
  const s = new THREE.Shape();
  s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  g.translate(0, 0, -w / 2);
  g.rotateY(Math.PI / 2);
  return add(p, g, m, x, y, z);
}
// Toit mansardé (trapèze), faîtage selon X
export function mansardRoof(p, w, h, d, m, x, y, z, inset = 0.28) {
  const s = new THREE.Shape();
  s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(d / 2 - d * inset, h); s.lineTo(-d / 2 + d * inset, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  g.translate(0, 0, -w / 2);
  g.rotateY(Math.PI / 2);
  return add(p, g, m, x, y, z);
}
// Rangées de fenêtres éclairées sur une façade (face +Z ou -Z)
// Rangées de fenêtres : vitre (éclairée ou sombre), appui et linteau en pierre claire.
// Toutes les pièces sont fusionnées en deux maillages pour rester léger.
export function windows(p, { w, rows, cols, y0, dy, z, h = 0.09, ww = 0.07, m, trim = 0xf3ecdc }) {
  const panes = [], frames = [];
  const side = z >= 0 ? 1 : -1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + (w / cols) * (c + 0.5);
      const y = y0 + r * dy;
      panes.push(new THREE.BoxGeometry(ww, h, 0.02).translate(x, y, z));
      // Croisée (meneau et traverse) devant la vitre
      frames.push(new THREE.BoxGeometry(0.008, h, 0.012).translate(x, y, z + side * 0.012));
      frames.push(new THREE.BoxGeometry(ww, 0.008, 0.012).translate(x, y + h * 0.15, z + side * 0.012));
      // Appui et linteau
      frames.push(new THREE.BoxGeometry(ww + 0.03, 0.016, 0.04).translate(x, y - h / 2 - 0.008, z));
      frames.push(new THREE.BoxGeometry(ww + 0.02, 0.014, 0.03).translate(x, y + h / 2 + 0.007, z));
    }
  }
  if (panes.length) p.add(new THREE.Mesh(mergeGeometries(panes), m));
  if (frames.length) p.add(new THREE.Mesh(mergeGeometries(frames), mat(trim)));
}
export function tree(p, x, y, z, s = 1, color = 0x3f6b3a) {
  cyl(p, 0.025 * s, 0.035 * s, 0.14 * s, 5, mat(0x5a3d26), x, y, z);
  add(p, new THREE.IcosahedronGeometry(0.13 * s, 0), mat(color), x, y + 0.24 * s, z);
}
export function pine(p, x, y, z, s = 1, color = 0x2f5a3a) {
  cyl(p, 0.02 * s, 0.03 * s, 0.1 * s, 5, mat(0x4b3322), x, y, z);
  cone(p, 0.14 * s, 0.36 * s, 6, mat(color), x, y + 0.08 * s, z);
}

// Place un objet sur une sphère, orienté selon la normale
export function placeOnSphere(obj, radius, dir) {
  const n = dir.clone().normalize();
  obj.position.copy(n).multiplyScalar(radius);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  return obj;
}

// ---------------------------------------------------------------------------
// Planètes et lunes
// ---------------------------------------------------------------------------
// Planète rocheuse facettée, couleurs selon l'altitude
export function createPlanet({ radius, seed = 1, detail = 5, amp = 0.07, freq = 1.4, colors, trees = 0, treeColor, veins = null, patch = null }) {
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
    if (patch) {
      // Région claire (ex. Tombaugh Regio, le « cœur » de Pluton)
      v.fromBufferAttribute(pos, i).normalize();
      const d = v.distanceTo(patch.dir) + (fbm3(v.x * 5, v.y * 5, v.z * 5) - 0.5) * 0.15;
      if (d < patch.size) c.set(patch.color);
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

// Lune-océan avec un galet qui ricoche (TIPE)
export function ricochetMoon(radius = 2.8) {
  const g = new THREE.Group();
  const water = new THREE.MeshStandardMaterial({ color: 0x1f6f9a, roughness: 0.18, metalness: 0.1, emissive: 0x062033, emissiveIntensity: 0.5 });
  const sea = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 5), water);
  sea.userData.water = true;
  g.add(sea);
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
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
  return new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.22, map: new THREE.CanvasTexture(c), transparent: true, opacity: 0.55, depthWrite: false }));
}

// Géante gazeuse ou de glace : bandes nuageuses selon la latitude, turbulences, éventuelle tempête
export function createGasGiant({ radius, colors, seed = 1, turbulence = 0.35, bands = 9, storm = null }) {
  const geo = new THREE.SphereGeometry(radius, 128, 80);
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  const c = new THREE.Color(), c2 = new THREE.Color();
  const pal = colors.map((x) => new THREE.Color(x));
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const n = fbm3(v.x * 3 + seed, v.y * 6, v.z * 3 - seed);
    const lat = Math.asin(v.y) + (n - 0.5) * turbulence;
    const b = (Math.sin(lat * bands) * 0.5 + 0.5) * (pal.length - 1);
    const k = Math.min(pal.length - 2, Math.floor(b));
    c.copy(pal[k]).lerp(pal[k + 1], b - k);
    if (storm) {
      const d = v.distanceTo(storm.dir);
      if (d < storm.size) c.lerp(c2.set(storm.color), Math.pow(1 - d / storm.size, 0.7));
    }
    cols.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
  return g;
}

// Anneaux plats à bandes (coordonnées de texture radiales) + poussière scintillante
export function createPlanetRing(inner, outer, { colors = ['#d8cfe8', '#b9aedb', '#efe6ff'], opacity = 0.85, dust = true } = {}) {
  const geo = new THREE.RingGeometry(inner, outer, 160, 1);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    uv.setXY(i, (r - inner) / (outer - inner), 0.5);
  }
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 4;
  const x = cv.getContext('2d');
  let s = 17;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let px = 0; px < 512; px++) {
    const k = px / 512;
    // Divisions (lacunes) façon Cassini
    const gap = (k > 0.58 && k < 0.63) || (k > 0.88 && k < 0.9);
    const a = gap ? 0.05 : (0.35 + rnd() * 0.5) * Math.sin(Math.PI * Math.min(1, k * 1.05 + 0.02));
    x.fillStyle = colors[Math.floor(rnd() * colors.length)];
    x.globalAlpha = Math.max(0, a);
    x.fillRect(px, 0, 1, 4);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const ring = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, roughness: 1 }));
  ring.rotation.x = -Math.PI / 2;
  const g = new THREE.Group();
  g.add(ring);
  if (dust) g.add(createRing(inner * 1.02, outer * 0.98, 0xe9e0ff, 1800));
  return g;
}

// ---------------------------------------------------------------------------
// Vaisseau d'exploration (esprit « fait main » : coque ronde, bandeau de bois, hublot)
// Avant du vaisseau vers +Z.
// ---------------------------------------------------------------------------
export function createShip() {
  const g = new THREE.Group();
  const hull = mat(0xe9e0cc), orange = mat(0xe07a3a), wood = mat(0x8a5a36), metal = mat(0x8f969c), dark = mat(0x2a2622);
  const body = add(g, new THREE.SphereGeometry(0.62, 20, 14), hull, 0, 0, 0);
  body.scale.set(1, 0.82, 1.2);
  add(g, new THREE.TorusGeometry(0.66, 0.06, 8, 32), wood, 0, -0.02, 0, [Math.PI / 2, 0, 0]).scale.set(1, 1.2, 1);
  add(g, new THREE.TorusGeometry(0.6, 0.035, 6, 32), orange, 0, 0.2, 0, [Math.PI / 2, 0, 0]).scale.set(1, 1.15, 1);
  // Hublot avant éclairé
  const win = add(g, new THREE.SphereGeometry(0.34, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), new THREE.MeshStandardMaterial({ color: 0x1d2a33, emissive: 0xffc27a, emissiveIntensity: 0.9, roughness: 0.2 }), 0, 0.08, 0.6);
  win.rotation.x = Math.PI / 2;
  add(g, new THREE.TorusGeometry(0.33, 0.04, 8, 24), metal, 0, 0.08, 0.66);
  // Pieds d'atterrissage
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 3;
    const leg = add(g, new THREE.CylinderGeometry(0.03, 0.035, 0.7, 6), metal, Math.sin(a) * 0.5, -0.55, Math.cos(a) * 0.55);
    leg.rotation.set(Math.cos(a) * 0.45, 0, -Math.sin(a) * 0.45);
    add(g, new THREE.CylinderGeometry(0.1, 0.12, 0.04, 10), dark, Math.sin(a) * 0.68, -0.88, Math.cos(a) * 0.73);
  }
  // Réacteur arrière et petits propulseurs
  add(g, new THREE.CylinderGeometry(0.22, 0.3, 0.3, 14), metal, 0, 0, -0.78, [Math.PI / 2, 0, 0]);
  for (const sx of [-1, 1]) add(g, new THREE.CylinderGeometry(0.07, 0.09, 0.2, 8), metal, sx * 0.55, 0.05, -0.55, [Math.PI / 2, 0, 0]);
  // Antenne et feux de position
  cyl(g, 0.012, 0.012, 0.45, 5, metal, 0.18, 0.45, -0.1);
  add(g, new THREE.SphereGeometry(0.035, 6, 6), glow(0xff5a4a, 3), -0.62, 0, 0.1);
  add(g, new THREE.SphereGeometry(0.035, 6, 6), glow(0x5aff8a, 3), 0.62, 0, 0.1);
  add(g, new THREE.SphereGeometry(0.03, 6, 6), glow(0xfff0c0, 4), 0.18, 0.68, -0.1);
  // Flammes : jet principal (dégradé bleu → orange), deux propulseurs latéraux, halo et gerbe d'étincelles
  const flameMat = (inner, outer) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uThrust: { value: 0.3 }, uInner: { value: new THREE.Color(...inner) }, uOuter: { value: new THREE.Color(...outer) } },
    vertexShader: /* glsl */ `
      uniform float uTime, uThrust; varying float vL; varying vec3 vN; varying vec3 vV;
      void main() {
        vec3 p = position;
        vL = clamp(-p.z / 1.6, 0.0, 1.0);
        // Ondulation de la flamme
        float w = sin(uTime * 38.0 + p.z * 9.0) * 0.04 + sin(uTime * 23.0 - p.z * 5.0) * 0.03;
        p.xy *= 1.0 + w * vL;
        p.z *= 0.35 + uThrust * 0.9 + sin(uTime * 31.0) * 0.05 * uThrust;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uThrust; uniform vec3 uInner, uOuter; varying float vL; varying vec3 vN; varying vec3 vV;
      void main() {
        float core = abs(dot(vN, vV));
        vec3 col = mix(uInner, uOuter, smoothstep(0.05, 0.6, vL));
        float a = pow(core, 1.5) * (1.0 - vL) * (0.4 + 0.8 * uThrust);
        gl_FragColor = vec4(col * a * 2.2, 1.0);
      }
    `,
  });
  const flameGeo = new THREE.ConeGeometry(0.24, 1.6, 20, 6, true);
  flameGeo.translate(0, 0.8, 0);
  flameGeo.rotateX(-Math.PI / 2); // base contre la tuyère, pointe vers l'arrière (−Z)
  const main = new THREE.Mesh(flameGeo, flameMat([0.7, 0.85, 1.6], [1.6, 0.55, 0.15]));
  main.position.z = -0.92;
  g.add(main);
  const inner = new THREE.Mesh(flameGeo.clone(), flameMat([1.4, 1.6, 2.0], [1.4, 0.9, 0.4]));
  inner.scale.set(0.45, 0.45, 0.6);
  inner.position.z = -0.92;
  g.add(inner);
  const sides = [-1, 1].map((sx) => {
    const f = new THREE.Mesh(flameGeo.clone(), flameMat([0.9, 0.9, 1.5], [1.4, 0.5, 0.2]));
    f.scale.set(0.35, 0.35, 0.45);
    f.position.set(sx * 0.55, 0.05, -0.66);
    g.add(f);
    return f;
  });
  // Halo de tuyère
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ color: new THREE.Color(1.6, 0.9, 0.5), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    halo.material.map = new THREE.CanvasTexture(c);
  }
  halo.position.z = -1.0;
  halo.scale.setScalar(0.9);
  g.add(halo);
  // Étincelles : particules procédurales éjectées vers l'arrière
  const N = 160;
  const seeds = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) seeds.set([Math.random(), Math.random() - 0.5, Math.random() - 0.5], i * 3);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  sparkGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  const sparkMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uThrust: { value: 0.3 } },
    vertexShader: /* glsl */ `
      attribute vec3 aSeed; uniform float uTime, uThrust; varying float vA;
      void main() {
        float t = fract(aSeed.x + uTime * 1.8);
        vec3 p = vec3(aSeed.y * 0.25 * (1.0 + t * 2.0), aSeed.z * 0.25 * (1.0 + t * 2.0), -0.95 - t * (1.0 + uThrust * 3.0));
        vA = (1.0 - t) * uThrust;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(18.0 / -mv.z, 1.0, 6.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(1.0, 0.7, 0.35) * smoothstep(0.5, 0.0, d) * vA * 1.4, 1.0); }
    `,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  g.add(sparks);
  const mats = [main, inner, ...sides].map((m) => m.material).concat([sparkMat]);
  g.userData.setThrust = (k, t) => {
    mats.forEach((m) => { m.uniforms.uTime.value = t; m.uniforms.uThrust.value = k; });
    halo.material.opacity = 0.25 + 0.6 * k;
    halo.scale.setScalar(0.6 + k * 0.8);
  };
  return g;
}

// ---------------------------------------------------------------------------
// Véhicule tout-terrain amphibie (avant vers +Z, haut vers +Y, hauteur de roue ≈ 0,22)
// ---------------------------------------------------------------------------
export function createRover() {
  const g = new THREE.Group();
  const body = mat(0xe9dcc2), orange = mat(0xe07a3a), dark = mat(0x2a2622), metal = mat(0x8f969c), wood = mat(0x8a5a36);
  // Caisse et flotteurs latéraux (amphibie)
  const hull = add(g, new THREE.BoxGeometry(0.62, 0.22, 1.05), body, 0, 0.36, 0);
  hull.scale.set(1, 1, 1);
  add(g, new THREE.BoxGeometry(0.66, 0.05, 1.1), orange, 0, 0.27, 0);
  for (const sx of [-1, 1]) {
    const f = add(g, new THREE.CylinderGeometry(0.09, 0.09, 1.0, 12), wood, sx * 0.36, 0.33, 0, [Math.PI / 2, 0, 0]);
    add(g, new THREE.SphereGeometry(0.09, 10, 8), wood, sx * 0.36, 0.33, 0.5);
    f.userData.float = true;
  }
  // Cabine vitrée
  const cab = add(g, new THREE.SphereGeometry(0.24, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1d2a33, emissive: 0xffc27a, emissiveIntensity: 0.5, roughness: 0.2 }), 0, 0.47, 0.12);
  cab.scale.set(1, 0.9, 1.25);
  add(g, new THREE.TorusGeometry(0.24, 0.025, 6, 24), metal, 0, 0.47, 0.12, [Math.PI / 2, 0, 0]).scale.set(1, 1.25, 1);
  // Phares et feux
  for (const sx of [-1, 1]) {
    add(g, new THREE.SphereGeometry(0.04, 8, 6), glow(0xfff0c0, 4), sx * 0.2, 0.38, 0.53);
    add(g, new THREE.SphereGeometry(0.025, 6, 6), glow(0xff4a3a, 3), sx * 0.24, 0.38, -0.53);
  }
  // Antenne avec fanion
  cyl(g, 0.008, 0.008, 0.5, 5, metal, -0.22, 0.47, -0.38);
  box(g, 0.12, 0.07, 0.005, orange, -0.16, 0.9, -0.38);
  // Hélice arrière pour la navigation sur l'eau
  const prop = new THREE.Group(); prop.position.set(0, 0.3, -0.58); g.add(prop);
  for (let i = 0; i < 3; i++) {
    const b = add(prop, new THREE.BoxGeometry(0.03, 0.14, 0.01), metal, 0, 0.06, 0);
    b.parent.remove(b);
    const h = new THREE.Group(); h.rotation.z = (i / 3) * Math.PI * 2; h.add(b); prop.add(h);
  }
  // Six roues à gros pneus
  const wheels = [];
  for (const z of [-0.36, 0, 0.36]) {
    for (const sx of [-1, 1]) {
      const w = new THREE.Group(); w.position.set(sx * 0.38, 0.13, z); g.add(w);
      const tire = add(w, new THREE.CylinderGeometry(0.13, 0.13, 0.11, 14), dark, 0, 0, 0, [0, 0, Math.PI / 2]);
      add(w, new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8), metal, 0, 0, 0, [0, 0, Math.PI / 2]);
      for (let k = 0; k < 6; k++) {
        const lug = add(w, new THREE.BoxGeometry(0.115, 0.03, 0.03), dark, 0, 0, 0);
        lug.position.set(0, Math.cos((k / 6) * Math.PI * 2) * 0.13, Math.sin((k / 6) * Math.PI * 2) * 0.13);
        lug.rotation.x = (k / 6) * Math.PI * 2;
      }
      tire.userData.wheel = true;
      wheels.push(w);
    }
  }
  g.userData.roll = (dist, wheelR = 0.13) => {
    wheels.forEach((w) => { w.rotation.x += dist / wheelR; });
    prop.rotation.z += dist * 40;
  };
  return g;
}
