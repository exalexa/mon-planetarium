// Modèles procéduraux low-poly : planètes, lunes, lieux d'études, sondes spatiales, projets.
// Style volontairement « fait main », facetté, proche de l'esthétique d'Outer Wilds.
import * as THREE from 'three';

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
export function windows(p, { w, rows, cols, y0, dy, z, h = 0.09, ww = 0.07, m }) {
  const g = new THREE.BoxGeometry(ww, h, 0.02);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + (w / cols) * (c + 0.5);
      add(p, g, m, x, y0 + r * dy, z);
    }
  }
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
