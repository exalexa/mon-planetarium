// Exploration à pied : un personnage en vue subjective qui marche sur la surface réelle des astres
// (relief échantillonné), entre dans les bâtiments (murs, planchers, escaliers), nage dans l'eau,
// saute en faible pesanteur. Toute la physique se fait dans le repère local de l'astre,
// qui peut tourner sur lui-même ou orbiter sans que le personnage glisse.
import * as THREE from 'three';

export const PERSON = { height: 1.75, eye: 1.62, radius: 0.32, step: 0.62, walk: 4.2, run: 8.5, jump: 4.4, g: 6.5 };

const L = new THREE.Vector3(), F = new THREE.Vector3(), up = new THREE.Vector3(), right = new THREE.Vector3();
const wish = new THREE.Vector3(), vt = new THREE.Vector3(), dir = new THREE.Vector3(), np = new THREE.Vector3();
const q = {}, wq = {};

// Collisions avec un groupe (bâtiment ou objet instancié) dans son repère propre
function resolveGroup(g, P, c, m, st) {
  L.copy(P).applyMatrix4(g.inv);
  const s = g.s, pr = (PERSON.radius * m) / s, ph = (PERSON.height * m) / s, su = (PERSON.step * m) / s;
  const tol = pr * 0.35;
  let moved = false, floorY = -Infinity, ceilY = Infinity;
  for (const b of g.col.boxes) {
    const x0 = b[0], y0 = b[1], z0 = b[2], x1 = b[3], y1 = b[4], z1 = b[5];
    if (L.x < x0 - pr || L.x > x1 + pr || L.z < z0 - pr || L.z > z1 + pr) continue;
    const inside = L.x >= x0 - tol && L.x <= x1 + tol && L.z >= z0 - tol && L.z <= z1 + tol;
    if (y1 <= L.y + su) { if (inside && y1 > floorY) floorY = y1; continue; }
    if (y0 >= L.y + ph) continue;
    if (y0 > L.y + ph * 0.55) { if (inside) ceilY = Math.min(ceilY, y0); continue; }
    const cx = Math.max(x0, Math.min(L.x, x1)), cz = Math.max(z0, Math.min(L.z, z1));
    const dx = L.x - cx, dz = L.z - cz, d2 = dx * dx + dz * dz;
    if (d2 > 1e-14) {
      const d = Math.sqrt(d2);
      if (d < pr) { L.x += (dx / d) * (pr - d); L.z += (dz / d) * (pr - d); moved = true; }
    } else {
      const a = L.x - x0, bb = x1 - L.x, cc = L.z - z0, dd = z1 - L.z;
      const mn = Math.min(a, bb, cc, dd);
      if (mn === a) L.x = x0 - pr; else if (mn === bb) L.x = x1 + pr; else if (mn === cc) L.z = z0 - pr; else L.z = z1 + pr;
      moved = true;
    }
  }
  for (const cy of g.col.cyls) {
    const [x, z, r, y0, y1] = cy;
    const dx = L.x - x, dz = L.z - z, d2 = dx * dx + dz * dz;
    if (d2 > (r + pr) * (r + pr)) continue;
    if (y1 <= L.y + su) { if (d2 < (r + tol) * (r + tol) && y1 > floorY) floorY = y1; continue; }
    if (y0 >= L.y + ph) continue;
    if (y0 > L.y + ph * 0.55) { if (d2 < r * r) ceilY = Math.min(ceilY, y0); continue; }
    const d = Math.sqrt(d2) || 1e-6;
    L.x = x + (dx / d) * (r + pr); L.z = z + (dz / d) * (r + pr);
    moved = true;
  }
  for (const rg of g.col.rings) {
    if (rg.y1 <= L.y + su || rg.y0 >= L.y + ph) continue;
    const dx = L.x - rg.x, dz = L.z - rg.z, d = Math.hypot(dx, dz) || 1e-6;
    if (Math.abs(d - rg.r) > pr) continue;
    const ang = Math.atan2(dz, dx);
    if (rg.gaps.some(([a0, a1]) => ang >= a0 && ang <= a1)) continue;
    const target = d < rg.r ? rg.r - pr : rg.r + pr;
    L.x = rg.x + (dx / d) * target; L.z = rg.z + (dz / d) * target;
    moved = true;
  }
  if (floorY > -Infinity) {
    F.set(L.x, floorY, L.z).applyMatrix4(g.m);
    const r = F.distanceTo(c);
    if (r > st.floor) { st.floor = r; st.group = g; }
  }
  if (ceilY < Infinity) {
    F.set(L.x, ceilY, L.z).applyMatrix4(g.m);
    st.ceil = Math.min(st.ceil, F.distanceTo(c));
  }
  if (moved) P.copy(L).applyMatrix4(g.m);
}

// Un pas de simulation. w : état du marcheur (repère local de l'astre), W : données de l'astre
export function stepWalker(w, W, input, dt) {
  const m = W.m2u, c = W.center;
  up.copy(w.p).sub(c).normalize();
  // Cap : vecteur tangent transporté avec le personnage
  w.heading.addScaledVector(up, -w.heading.dot(up));
  if (w.heading.lengthSq() < 1e-8) w.heading.set(1, 0, 0).addScaledVector(up, -up.x);
  w.heading.normalize();
  if (input.yaw) w.heading.applyAxisAngle(up, input.yaw);
  w.pitch = THREE.MathUtils.clamp(w.pitch + (input.pitch || 0), -1.45, 1.45);
  right.crossVectors(w.heading, up).normalize();
  wish.set(0, 0, 0).addScaledVector(w.heading, input.fwd || 0).addScaledVector(right, input.strafe || 0);
  if (wish.lengthSq() > 1) wish.normalize();
  // À pied ou au volant de l'amphibie (plus rapide, et qui flotte)
  const speed = w.veh ? (input.run ? 17 : 9) * m * (w.swim ? 0.7 : 1) : (input.run ? PERSON.run : PERSON.walk) * m * (w.swim ? 0.5 : 1);
  vt.copy(w.v).addScaledVector(up, -w.v.dot(up));
  let vr = w.v.dot(up);
  if (w.onGround || w.swim) vt.lerp(wish.multiplyScalar(speed), Math.min(1, dt * (w.veh ? 2.5 : w.onGround ? 12 : 4)));
  else { vt.addScaledVector(wish, speed * dt * 1.2); if (vt.length() > speed) vt.setLength(speed); }
  vr -= PERSON.g * m * dt;
  if (input.jump && w.onGround && !w.veh) { vr = PERSON.jump * m; w.onGround = false; }
  if (w.swim) { vr = input.jump && !w.veh ? 1.6 * m : Math.max(vr, -1.0 * m) * 0.9; }
  np.copy(w.p).addScaledVector(vt, dt).addScaledVector(up, vr * dt);
  // Bâtiments et objets proches
  const st = { floor: -Infinity, ceil: Infinity };
  const reach = 4 * m;
  for (const g of W.groups) {
    const rr = g.radius + reach;
    if (g.center.distanceToSquared(np) > rr * rr) continue;
    resolveGroup(g, np, c, m, st);
  }
  // Relief
  dir.copy(np).sub(c).normalize();
  W.sampler.query(dir, q);
  // Pas de sol dans cette direction (océan d'une planète-eau) : on s'enfonce jusqu'à nager
  let terrain = q.r > 0 ? q.r : W.R * 0.6;
  let feet = np.distanceTo(c);
  const stepM = PERSON.step * m;
  // Pente trop raide : on annule le déplacement horizontal
  if (terrain > feet + stepM && terrain > st.floor) {
    const nDot = q.nx * dir.x + q.ny * dir.y + q.nz * dir.z;
    if (nDot < 0.64) {
      np.copy(w.p).addScaledVector(up, Math.max(0, vr) * dt);
      dir.copy(np).sub(c).normalize();
      W.sampler.query(dir, q);
      terrain = q.r > 0 ? q.r : W.R * 0.6;
      feet = np.distanceTo(c);
    }
  }
  const ground = Math.max(terrain, st.floor);
  // Sur un plancher de bâtiment, la verticale de la caméra suit celle du bâtiment (le sol y est plan)
  const g = st.floor >= terrain - 0.01 * m ? st.group : null;
  if (g) {
    if (!g.yAxis) g.yAxis = new THREE.Vector3(0, 1, 0).transformDirection(g.m);
    w.floorUp = g.yAxis;
  } else w.floorUp = null;
  w.onGround = false;
  if (feet <= ground + 0.02 * m || (w.wasGround && vr <= 0 && feet - ground < stepM * 0.7)) {
    if (vr <= 0 || feet < ground) { feet = ground; vr = Math.max(0, vr); w.onGround = true; }
  }
  if (feet + PERSON.height * m > st.ceil && vr > 0) vr = 0;
  // Eau : on nage, la tête hors de l'eau
  w.swim = false;
  if (W.water) {
    W.water.query(dir, wq);
    const dr = w.veh ? 0.45 : 1.25;
    if (wq.r > 0 && wq.r > ground + dr * m && feet < wq.r - dr * m) {
      w.swim = true;
      feet = Math.max(feet, wq.r - (dr + 0.1) * m);
      w.onGround = false;
    }
  }
  w.wasGround = w.onGround;
  w.p.copy(c).addScaledVector(dir, feet);
  // Vitesse reprojetée sur le nouveau plan tangent
  up.copy(dir);
  vt.addScaledVector(up, -vt.dot(up));
  w.v.copy(vt).addScaledVector(up, vr);
  return w;
}

// Pose de la caméra (repère local) : œil et direction du regard
export function walkerView(w, W, eye, look, camUp) {
  const m = W.m2u;
  up.copy(w.p).sub(W.center).normalize();
  eye.copy(w.p).addScaledVector(up, (w.swim ? 1.35 : PERSON.eye) * m);
  look.copy(w.heading).multiplyScalar(Math.cos(w.pitch)).addScaledVector(up, Math.sin(w.pitch)).add(eye);
  // Verticale de la caméra : celle du bâtiment quand on est dedans, sinon la verticale locale
  if (!w.camUp) w.camUp = up.clone();
  w.camUp.lerp(w.floorUp || up, 0.15).normalize();
  camUp.copy(w.camUp);
}
