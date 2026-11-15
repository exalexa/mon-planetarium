// Intérieur du vaisseau (visitable quand il est posé) et véhicule amphibie rangé dans la soute.
// L'intérieur est construit à l'échelle du personnage, logé dans la coque, avec une rampe latérale.
import * as THREE from 'three';
import { Kit, hollow, M, U, plain } from './kit.js';

// k : mètres par unité du modèle de vaisseau (le vaisseau posé mesure environ 14 m)
export function buildInterior(k) {
  const g = new THREE.Group();
  const kit = new Kit();
  const W = 0.72 * k, D = 0.8 * k, H = 2.5, FY = 0.6 * k;
  const WOOD = 0x8a5a36, HULL = 0xe4dac4, MET = 0x8f969c, DARK = 0x2a2622, ORANGE = 0xe07a3a;
  const o = { collide: false };
  // Cabine : plancher de bois, parois claires, grande baie à l'avant, porte de soute à tribord
  hollow(kit, { w: M(W), d: M(D), h: M(H), floors: 1, wall: HULL, inner: 0xeadfc8, floorCol: WOOD, ceil: 0xd9ceb6, doors: { '+x': M(-D * 0.18) }, open: ['+z'], doorW: M(2.3), doorH: M(2.05), furnish: 'none', lamps: true, seed: 5 });
  // Baie avant vitrée (allège pleine, montants, vitre)
  kit.box(M(W), M(0.85), M(0.12), 0, 0, M(D / 2 - 0.06), HULL);
  kit.solid(-M(W / 2), 0, M(D / 2 - 0.1), M(W / 2), M(H), M(D / 2));
  for (const sx of [-1, 0, 1]) kit.box(M(0.08), M(H - 0.85), M(0.1), sx * M(W / 2 - 0.04), M(0.85), M(D / 2 - 0.05), MET, o);
  kit.box(M(W), M(0.1), M(0.1), 0, M(H - 0.1), M(D / 2 - 0.05), MET, o);
  kit.box(M(W - 0.16), M(H - 0.95), M(0.02), 0, M(0.85), M(D / 2 - 0.05), 0xffffff, { glass: true });
  // Poste de pilotage : siège, manche, tableau de bord et écrans
  const sz = D / 2 - 1.15;
  kit.box(M(0.6), M(0.45), M(0.6), 0, 0, M(sz), 0x5a3a22);
  kit.box(M(0.6), M(0.75), M(0.12), 0, M(0.45), M(sz - 0.3), ORANGE, o);
  kit.box(M(W * 0.7), M(0.2), M(0.5), 0, M(0.72), M(D / 2 - 0.4), WOOD, o);
  kit.box(M(0.06), M(0.3), M(0.06), 0, M(0.5), M(sz + 0.42), DARK, o);
  for (const [x, c] of [[-0.75, 0xffb35c], [-0.25, 0x7dffb0], [0.25, 0xffb35c], [0.75, 0x7cc6ff]]) kit.box(M(0.36), M(0.22), M(0.03), M(x), M(0.93), M(D / 2 - 0.28), c, { collide: false, glow: true, rotX: -0.5 });
  // Rangements, couchette, journal de bord, extincteur : la vie à bord
  kit.box(M(0.5), M(0.9), M(1.3), -M(W / 2 - 0.3), 0, M(0.2), WOOD);
  kit.box(M(0.46), M(0.03), M(1.26), -M(W / 2 - 0.3), M(0.9), M(0.2), 0xd8b47a, o);
  kit.box(M(0.3), M(0.22), M(0.2), -M(W / 2 - 0.3), M(0.93), M(0.5), 0x7dffb0, { collide: false, glow: true });
  kit.box(M(0.7), M(0.35), M(1.9), -M(W / 2 - 0.4), M(1.45), -M(D / 2 - 1.05), 0xb5683a, o);
  kit.box(M(0.12), M(0.4), M(0.12), M(W / 2 - 0.12), M(0.3), M(D / 2 - 1.0), 0xc23a2e, o);
  for (let i = 0; i < 2; i++) kit.box(M(0.5), M(0.5), M(0.5), -M(W / 2 - 0.32) + M(i * 0.55), 0, -M(D / 2 - 0.3), [0x6b4a30, 0x7a5a3c, 0x5a3a22][i], { collide: i < 2 });
  // Bandeau orange et lisses de bois, comme sur la coque
  kit.box(M(0.02), M(0.12), M(D - 0.1), -M(W / 2 - 0.03), M(1.2), 0, ORANGE, o);
  kit.box(M(W - 0.1), M(0.12), M(0.02), 0, M(1.2), -M(D / 2 - 0.03), ORANGE, o);
  // Rampe de soute à tribord : marches larges jusqu'au sol (et au-delà si le terrain descend)
  const rise = 0.2, run = 0.36, n = Math.ceil((FY + 1.6) / rise), dz = -D * 0.18;
  kit.box(M(0.5), M(0.12), M(2.5), M(W / 2 + 0.25), -M(0.12), M(dz), MET);
  for (let i = 0; i < n; i++) {
    kit.box(M(run + 0.01), M(0.14), M(2.3), M(W / 2 + 0.5 + i * run + run / 2), -M((i + 1) * rise) - M(0.14) + M(0.0), M(dz), i % 2 ? 0x9aa1a7 : MET);
    kit.solid(M(W / 2 + 0.5 + i * run), -M((i + 1) * rise) - M(0.6), M(dz - 1.15), M(W / 2 + 0.5 + (i + 1) * run), -M((i + 1) * rise), M(dz + 1.15));
  }
  for (const sz2 of [-1, 1]) kit.box(M(n * run), M(0.06), M(0.06), M(W / 2 + 0.5 + (n * run) / 2), -M((n * rise) / 2) + M(0.9), M(dz + sz2 * 1.18), ORANGE, { collide: false, rotZ: -Math.atan2(rise, run) });
  kit.build(g); plain(g);
  return {
    group: g, W, D, H, FY, scale: 1 / U,
    seat: new THREE.Vector3(0, 0, M(sz - 0.75)),                 // où l'on se tient pour reprendre les commandes
    spawn: new THREE.Vector3(M(0.5), M(0.05), M(sz - 0.9)),
    bay: new THREE.Vector3(M(W / 2 - 1.15), 0, -M(D / 2 - 1.75)), // emplacement de l'amphibie
    inside: (l) => Math.abs(l.x) < M(W / 2) && Math.abs(l.z) < M(D / 2) && l.y > -M(0.3) && l.y < M(H),
  };
}

// Véhicule amphibie (mètres) : coque-flotteur, six roues, bulle vitrée, hélice et phare
export function buildRover() {
  const g = new THREE.Group(), k = new Kit(), c = { collide: false };
  const HULL = 0xe07a3a, CREAM = 0xe9e0cc, DARK = 0x2a2622, MET = 0x8f969c;
  k.box(1.5, 0.45, 2.5, 0, 0.35, 0, HULL, c);
  k.box(1.3, 0.2, 2.0, 0, 0.18, 0, 0xb85e2a, c);
  k.box(1.5, 0.1, 0.5, 0, 0.5, 1.4, HULL, { collide: false, rotX: 0.5 });
  k.box(1.56, 0.08, 2.56, 0, 0.78, 0, 0x8a5a36, c);
  k.box(1.1, 0.5, 0.9, 0, 0.86, -0.55, CREAM, c);
  k.box(0.5, 0.3, 0.5, 0, 0.86, 0.75, DARK, c);
  for (const sx of [-1, 1]) for (const z of [-0.85, 0, 0.85]) {
    const w = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10); w.rotateZ(Math.PI / 2); w.translate(sx * 0.86, 0.34, z);
    k.geo(w, DARK);
    const h = new THREE.CylinderGeometry(0.14, 0.14, 0.28, 8); h.rotateZ(Math.PI / 2); h.translate(sx * 0.86, 0.34, z);
    k.geo(h, MET);
  }
  k.box(0.06, 0.9, 0.06, -0.6, 0.86, -0.9, MET, c);
  k.box(0.2, 0.12, 0.05, -0.6, 1.76, -0.9, 0xff5a4a, { collide: false, glow: true });
  for (const sx of [-1, 1]) k.box(0.22, 0.16, 0.06, sx * 0.5, 0.52, 1.3, 0xfff0c0, { collide: false, glow: true });
  const prop = new THREE.CylinderGeometry(0.28, 0.28, 0.06, 8); prop.rotateX(Math.PI / 2); prop.translate(0, 0.5, -1.32);
  k.geo(prop, MET);
  k.build(g); plain(g);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9fd0ee, transparent: true, opacity: 0.35, roughness: 0.1 }));
  dome.position.set(0, 0.9, 0.2); dome.scale.set(1, 0.9, 1.1);
  g.add(dome);
  return g;
}
