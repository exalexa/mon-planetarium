// Intérieur de la station : module habité à l'échelle humaine (mètres), rendu par-dessus le monde.
// Les hublots sont de vraies ouvertures : on y voit la planète rendue par la scène principale.
// Contenu : écrans muraux du portfolio, deux télés (caméra extérieure et caméra de Voyager),
// planétarium 3D sur la table centrale (cliquer une planète pour s'y rendre).
import * as THREE from 'three';

const W = 4.4, H = 3.2, Z0 = -9, Z1 = 9;           // largeur, hauteur, extrémités du module
const TABLE = { x: 0, z: 3.4, r: 1.0, top: 0.92 };
export const EYE = 1.62;

function strip(html) {
  const d = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  const out = { title: '', lines: [] };
  const h = d.querySelector('h2'); if (h) out.title = h.textContent.trim();
  d.querySelectorAll('p, li, h3').forEach((n) => {
    if (n.classList.contains('log-kicker') || n.classList.contains('log-links')) return;
    const t = n.textContent.replace(/\s+/g, ' ').trim();
    if (t.length > 2) out.lines.push((n.tagName === 'LI' ? '• ' : '') + t);
  });
  return out;
}

function wrap(ctx, text, maxW) {
  const words = text.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawScreen(cv, { title, sub, lines, color, tag }) {
  const c = cv.getContext('2d'), w = cv.width, h = cv.height;
  c.fillStyle = '#030d17'; c.fillRect(0, 0, w, h);
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(60,140,200,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.strokeStyle = color; c.lineWidth = 3; c.strokeRect(6, 6, w - 12, h - 12);
  c.fillStyle = color; c.fillRect(6, 6, w - 12, 8);
  c.font = '600 15px monospace'; c.fillStyle = 'rgba(190,225,255,0.65)';
  c.fillText(tag || '', 22, 38);
  c.font = '700 30px sans-serif'; c.fillStyle = '#eaf6ff';
  c.fillText(title, 22, 76);
  c.font = '500 16px sans-serif'; c.fillStyle = color;
  c.fillText(sub || '', 22, 100);
  c.font = '400 17px sans-serif'; c.fillStyle = 'rgba(220,235,250,0.92)';
  let y = 130;
  for (const l of lines) {
    for (const s of wrap(c, l, w - 44)) {
      if (y > h - 36) { c.fillText('…', 22, h - 16); return; }
      c.fillText(s, 22, y); y += 22;
    }
    y += 4;
  }
}

function labelTexture(text, color = '#9fd4ff') {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
  const c = cv.getContext('2d');
  c.fillStyle = 'rgba(2,10,18,0.0)'; c.fillRect(0, 0, 512, 64);
  c.font = '600 26px monospace'; c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, 256, 34);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function noiseTexture(msg) {
  const cv = document.createElement('canvas'); cv.width = 384; cv.height = 216;
  const c = cv.getContext('2d');
  const id = c.createImageData(384, 216);
  for (let i = 0; i < id.data.length; i += 4) { const v = 20 + Math.random() * 60; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
  c.putImageData(id, 0, 0);
  c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(0, 84, 384, 48);
  c.font = '600 20px monospace'; c.fillStyle = '#9fd4ff'; c.textAlign = 'center';
  c.fillText(msg, 192, 114);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createIss({ planets, getPos, getSummary, tvTextures }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 80);
  camera.rotation.order = 'YXZ';
  scene.add(new THREE.AmbientLight(0xdfe9f5, 0.95));
  const hemi = new THREE.HemisphereLight(0xffffff, 0x6a7686, 0.55); scene.add(hemi);
  const pickables = [];

  const matWall = new THREE.MeshLambertMaterial({ color: 0xcdd3d9 });
  const matDark = new THREE.MeshLambertMaterial({ color: 0x3a424c });
  const matMid = new THREE.MeshLambertMaterial({ color: 0x8a96a3 });
  const matFloor = new THREE.MeshLambertMaterial({ color: 0x5a636d });
  const matTrim = new THREE.MeshLambertMaterial({ color: 0xe9ecef });
  const glow = (hex) => new THREE.MeshBasicMaterial({ color: hex });
  const box = (w, h, d, x, y, z, m = matWall, parent = scene) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o;
  };

  // --- Coque : sol, plafond, parois, ouvertures de hublot ---
  box(W, 0.12, Z1 - Z0, 0, -0.06, (Z0 + Z1) / 2, matFloor);
  for (let i = -3; i <= 3; i++) box(0.05, 0.015, Z1 - Z0 - 0.4, i * 0.55, 0.005, (Z0 + Z1) / 2, matDark);
  box(W, 0.12, Z1 - Z0, 0, H + 0.06, (Z0 + Z1) / 2, matWall);
  for (const sx of [-1, 1]) box(0.16, 0.05, Z1 - Z0 - 1, sx * 0.9, H - 0.02, (Z0 + Z1) / 2, glow(0xfaf6ee));
  // paroi du fond
  box(W, H, 0.12, 0, H / 2, Z0 - 0.06, matWall);
  // paroi avant avec grande baie (hublot panoramique)
  const winF = { x0: -1.7, x1: 1.7, y0: 0.55, y1: 2.75 };
  box((W / 2 + winF.x0), H, 0.14, (-W / 2 + winF.x0) / 2 - 0 + 0, H / 2, Z1 + 0.07, matWall).scale.set(1, 1, 1);
  box((W / 2 - winF.x1), H, 0.14, (W / 2 + winF.x1) / 2, H / 2, Z1 + 0.07, matWall);
  box(winF.x1 - winF.x0, winF.y0, 0.14, 0, winF.y0 / 2, Z1 + 0.07, matWall);
  box(winF.x1 - winF.x0, H - winF.y1, 0.14, 0, (H + winF.y1) / 2, Z1 + 0.07, matWall);
  // encadrement et montants de la baie
  const fr = (w, h, d, x, y, z) => box(w, h, d, x, y, z, matDark);
  fr(3.5, 0.1, 0.22, 0, winF.y0, Z1 - 0.02); fr(3.5, 0.1, 0.22, 0, winF.y1, Z1 - 0.02);
  for (const x of [-1.7, -0.57, 0.57, 1.7]) fr(0.1, 2.3, 0.22, x, 1.65, Z1 - 0.02);
  // parois latérales avec hublots latéraux
  const winS = { z0: 5.9, z1: 8.0, y0: 0.95, y1: 2.45 };
  for (const sx of [-1, 1]) {
    const x = sx * (W / 2 + 0.06);
    box(0.12, H, winS.z0 - Z0, x, H / 2, (Z0 + winS.z0) / 2);
    box(0.12, H, Z1 - winS.z1, x, H / 2, (winS.z1 + Z1) / 2);
    box(0.12, winS.y0, winS.z1 - winS.z0, x, winS.y0 / 2, (winS.z0 + winS.z1) / 2);
    box(0.12, H - winS.y1, winS.z1 - winS.z0, x, (H + winS.y1) / 2, (winS.z0 + winS.z1) / 2);
    box(0.24, 0.08, winS.z1 - winS.z0 + 0.1, sx * (W / 2 - 0.03), winS.y0, (winS.z0 + winS.z1) / 2, matDark);
    box(0.24, 0.08, winS.z1 - winS.z0 + 0.1, sx * (W / 2 - 0.03), winS.y1, (winS.z0 + winS.z1) / 2, matDark);
    box(0.24, winS.y1 - winS.y0, 0.08, sx * (W / 2 - 0.03), (winS.y0 + winS.y1) / 2, (winS.z0 + winS.z1) / 2, matDark);
  }
  // nervures de la coque (cadres le long du module)
  for (let z = Z0 + 1; z < Z1; z += 2) {
    for (const sx of [-1, 1]) box(0.1, H, 0.12, sx * (W / 2 - 0.04), H / 2, z, matTrim);
    box(W, 0.1, 0.12, 0, H - 0.04, z, matTrim);
  }
  // mains courantes et gaines
  for (const sx of [-1, 1]) {
    box(0.06, 0.06, Z1 - Z0 - 2, sx * 1.95, 1.05, (Z0 + Z1) / 2, matMid);
    box(0.14, 0.14, Z1 - Z0 - 2, sx * 1.98, 2.9, (Z0 + Z1) / 2, matDark);
  }

  // --- Racks d'instruments : baies sombres, voyants, grilles ---
  const ledCols = [0x7dffb0, 0xffb35c, 0x7fc8ff, 0xff6a6a];
  const leds = [];
  const rack = (sx, z, w = 1.2) => {
    box(0.45, 2.7, w, sx * (W / 2 - 0.3), 1.35, z, matDark);
    for (let i = 0; i < 7; i++) for (let j = 0; j < 4; j++) {
      const l = box(0.02, 0.05, 0.05, sx * (W / 2 - 0.52), 0.35 + i * 0.36, z - w / 2 + 0.18 + j * (w - 0.3) / 3, glow(ledCols[(i + j) % 4]));
      leds.push([l, i * 1.7 + j * 0.9]);
    }
  };
  for (const sx of [-1, 1]) { rack(sx, -8.2, 1.3); rack(sx, 3.2 - 0.4 * sx, 1.0); }

  // --- Écrans muraux du portfolio (clic ou E : se rendre à l'astre) ---
  const screens = [];
  const addScreen = (sx, z, id, tag) => {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 320;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const sw = 1.9, sh = sw * 320 / 512;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: tex }));
    const x = sx * (W / 2 - 0.1);
    m.position.set(x, 1.62, z); m.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(m);
    box(0.06, sh + 0.14, sw + 0.14, sx * (W / 2 - 0.05), 1.62, z, matDark);
    const s = { mesh: m, cv, tex, id, tag };
    m.userData = { action: 'goto', id, screen: s, label: tag };
    pickables.push(m); screens.push(s);
    return s;
  };
  const defs = [[-1, -6.4, 'schola', 'FORMATION'], [-1, -4.1, 'persion', 'PROFIL'], [-1, -1.8, 'proxion', 'INGÉNIERIE'],
    [1, -6.4, 'astra', 'RECHERCHE'], [1, -4.1, 'musa', 'ARTS & TRANSMISSION'], [1, -1.8, 'current', 'JOURNAL · LIEU ACTUEL']];
  for (const [sx, z, id, tag] of defs) addScreen(sx, z, id, tag);
  const refreshScreens = (current) => {
    for (const s of screens) {
      const id = s.id === 'current' ? current?.id : s.id;
      const b = planets.find((p) => p.id === id) || current;
      if (!b) continue;
      const sum = strip(getSummary(b.id));
      drawScreen(s.cv, { title: sum.title || b.name, sub: `${b.name} · ${b.section}`, lines: sum.lines.slice(0, 6), color: b.color || '#6cf', tag: s.tag });
      s.tex.needsUpdate = true;
      s.mesh.userData.id = b.id;
      s.mesh.userData.label = `${s.tag} : ${b.name}`;
    }
  };

  // --- Télés : caméra extérieure de la station, caméra de Voyager ---
  const tvs = [];
  const addTv = (x, key, caption) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.125), new THREE.MeshBasicMaterial({ map: tvTextures[key] }));
    m.position.set(x, 1.75, Z0 + 0.085); m.rotation.y = 0;
    scene.add(m);
    box(2.16, 1.29, 0.08, x, 1.75, Z0 + 0.03, matDark);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.25), new THREE.MeshBasicMaterial({ map: labelTexture(caption), transparent: true }));
    lab.position.set(x, 2.58, Z0 + 0.09); scene.add(lab);
    m.userData = { action: 'tv', key, label: caption };
    pickables.push(m);
    const tv = { mesh: m, key, live: tvTextures[key], off: noiseTexture(key === 'voy' ? 'SIGNAL VOYAGER · EN ATTENTE' : 'SIGNAL PERDU') };
    tvs.push(tv);
    return tv;
  };
  addTv(-1.15, 'iss', 'CAM EXT · STATION E139');
  addTv(1.15, 'voy', 'CAM VOYAGER · SONDE LOINTAINE');
  const setTvLive = (key, on) => { const t = tvs.find((v) => v.key === key); if (t) t.mesh.material.map = on ? t.live : t.off; };
  // console sous les télés
  box(3.8, 0.9, 0.5, 0, 0.45, Z0 + 0.35, matDark);
  for (let i = 0; i < 10; i++) box(0.12, 0.03, 0.12, -1.6 + i * 0.36, 0.92, Z0 + 0.42, glow(ledCols[i % 4]));

  // --- Planétarium 3D sur la table centrale ---
  const tbl = new THREE.Group(); tbl.position.set(TABLE.x, 0, TABLE.z); scene.add(tbl);
  const cyl = (rt, rb, h, y, m) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 36), m); o.position.y = y; tbl.add(o); return o; };
  cyl(0.28, 0.42, TABLE.top - 0.05, (TABLE.top - 0.05) / 2, matDark);
  cyl(TABLE.r + 0.18, TABLE.r + 0.18, 0.08, TABLE.top, matMid);
  cyl(TABLE.r + 0.1, TABLE.r + 0.1, 0.02, TABLE.top + 0.05, new THREE.MeshBasicMaterial({ color: 0x0b2236 }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(TABLE.r + 0.14, 0.012, 6, 64), glow(0x6fe3ff)); ring.rotation.x = Math.PI / 2; ring.position.y = TABLE.top + 0.05; tbl.add(ring);
  const holoY = TABLE.top + 0.42;
  const holo = new THREE.Group(); holo.position.y = holoY; tbl.add(holo);
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(TABLE.r * 0.97, TABLE.r * 0.97, holoY - TABLE.top - 0.05, 40, 1, true), new THREE.MeshBasicMaterial({ color: 0x4fb8ff, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false }));
  dome.position.y = (TABLE.top + 0.05 - holoY) / 2 + 0.0; holo.add(dome);
  const bodies = [];
  const hitGeo = new THREE.SphereGeometry(0.1, 10, 8);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const sun = planets.find((p) => p.kind === 'star');
  for (const b of planets) {
    const isSun = b.kind === 'star';
    const r = isSun ? 0.07 : 0.028 + (b.gas ? 0.014 : 0);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(b.color || '#fff') }));
    const hit = new THREE.Mesh(hitGeo, hitMat);
    hit.userData = { action: 'goto', id: b.id, label: `Planétarium : ${b.name}` };
    pickables.push(hit);
    const grp = new THREE.Group(); grp.add(mesh, hit); holo.add(grp);
    const orbit = isSun ? null : new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x4fb8ff, transparent: true, opacity: 0.35 }));
    if (orbit) holo.add(orbit);
    bodies.push({ b, grp, mesh, orbit, isSun, r });
  }
  const marker = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.004, 6, 30), glow(0xffffff)); marker.rotation.x = Math.PI / 2; holo.add(marker);
  let rmax = 1;
  const v3 = new THREE.Vector3();
  const updateHolo = (current, t) => {
    rmax = 1;
    for (const e of bodies) if (!e.isSun) { getPos(e.b, v3); rmax = Math.max(rmax, Math.hypot(v3.x, v3.z)); }
    const sc = (r) => TABLE.r * 0.92 * Math.pow(r / rmax, 0.45);
    for (const e of bodies) {
      if (e.isSun) { e.grp.position.set(0, 0, 0); e.mesh.rotation.y = t * 0.2; continue; }
      getPos(e.b, v3);
      const r = Math.hypot(v3.x, v3.z), a = Math.atan2(v3.z, v3.x), rr = sc(r);
      e.grp.position.set(Math.cos(a) * rr, v3.y * 0.0, Math.sin(a) * rr);
      if (e.orbit) {
        const pts = []; for (let i = 0; i <= 72; i++) pts.push(new THREE.Vector3(Math.cos(i / 72 * Math.PI * 2) * rr, 0, Math.sin(i / 72 * Math.PI * 2) * rr));
        if (!e.orbit.userData.r || Math.abs(e.orbit.userData.r - rr) > 1e-4) { e.orbit.geometry.setFromPoints(pts); e.orbit.userData.r = rr; }
      }
    }
    const grpOf = (b) => (b ? (b.parent || b) : null);
    const cur = bodies.find((e) => e.b === grpOf(current)) || bodies.find((e) => e.isSun);
    marker.position.copy(cur.grp.position); marker.scale.setScalar(1 + 0.12 * Math.sin(t * 4));
    marker.material.color.set(current?.color || '#fff');
  };

  // --- Boucle intérieure ---
  const state = { x: 0, z: 1.0, hover: null, tmp: new THREE.Vector3() };
  const ray = new THREE.Raycaster(); ray.far = 6;
  const bounds = { x: 1.55, z0: Z0 + 1.35, z1: Z1 - 0.7 };
  function walk(dt, input, yaw) {
    const f = input.fwd, s = input.side;
    if (f || s) {
      const h = Math.PI + yaw;
      const fx = -Math.sin(h), fz = -Math.cos(h), sx = Math.cos(h), sz = -Math.sin(h);
      const sp = 2.1 * dt;
      state.x += (fx * f + sx * s) * sp; state.z += (fz * f + sz * s) * sp;
    }
    state.x = THREE.MathUtils.clamp(state.x, -bounds.x, bounds.x);
    state.z = THREE.MathUtils.clamp(state.z, bounds.z0, bounds.z1);
    // La table du planétarium est un obstacle rond
    const dx = state.x - TABLE.x, dz = state.z - TABLE.z, d = Math.hypot(dx, dz), R = TABLE.r + 0.45;
    if (d < R) { state.x = TABLE.x + (dx / (d || 1)) * R; state.z = TABLE.z + (dz / (d || 1)) * R; }
  }
  function update(dt, t, { yaw, pitch, input, current, aspect, bob }) {
    walk(dt, input, yaw);
    camera.aspect = aspect; camera.updateProjectionMatrix();
    const moving = input.fwd || input.side;
    camera.position.set(state.x, EYE + (moving ? Math.sin(t * 9) * 0.012 : 0), state.z);
    camera.rotation.set(pitch, Math.PI + yaw, 0);
    updateHolo(current, t);
    for (const [l, ph] of leds) l.visible = Math.sin(t * 2.2 + ph) > -0.5;
    for (const tv of tvs) if (tv.mesh.material.map === tv.off && Math.random() < 0.3) { tv.off.offset.set(Math.random(), Math.random()); tv.off.wrapS = tv.off.wrapT = THREE.RepeatWrapping; }
    void bob;
  }
  // Pointeur : ndc ∈ [-1, 1]
  function pick(ndcX, ndcY, maxDist = 6) {
    ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    ray.far = maxDist;
    const hit = ray.intersectObjects(pickables, false)[0];
    return hit ? { ...hit.object.userData, dist: hit.distance } : null;
  }
  return { scene, camera, update, pick, refreshScreens, setTvLive, state, tvs, W, H };
}
