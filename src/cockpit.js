// Cockpit du pilote automatique : poste de pilotage en 3D (pupitre en bois, façade d'instruments,
// clavier mécanique, manettes) rendu par-dessus la vue spatiale, et texte orangé « analogique »
// projeté sur la verrière.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

let seed = 1234567;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Touches du clavier de bord : [légende, sous-titre, largeur, code clavier, action, voyant]
export const COCKPIT_KEYS = [
  ['↑', 'astre −', 1, 'ArrowUp', 'prevPlanet'],
  ['↓', 'astre +', 1, 'ArrowDown', 'nextPlanet'],
  ['←', 'satellite', 1, 'ArrowLeft', 'prevMoon'],
  ['→', 'satellite', 1, 'ArrowRight', 'nextMoon'],
  ['Échap', 'vue d’ensemble', 2, 'Escape', 'home'],
  ['F', 'fiche', 1, 'KeyF', 'fiche', 'fiche'],
  ['J', 'journal', 1, 'KeyJ', 'journal', 'journal'],
  ['G', 'galerie', 1, 'KeyG', 'gallery', 'gallery'],
  ['L', 'lunette', 1, 'KeyL', 'scope', 'scope'],
  ['M', 'vol libre', 2, 'KeyM', 'free'],
  ['O', 'orbites', 2, 'KeyO', 'orbits', 'orbits'],
  ['Pilote auto', 'transfert', 4, null, null, 'transfer'],
  ['H', 'affichage', 2, 'KeyH', 'hud', 'hud'],
];

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  if (draw) draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function createCockpit(renderer) {
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.02, 20);
  camera.position.set(0, 1.36, 0.36);
  camera.lookAt(0, 1.2, -1.5);

  // Lumières : halo orangé du texte projeté, lumière de l'étoile (orientée selon la vue), lampes de bord
  scene.add(new THREE.AmbientLight(0xffe2c0, 0.35));
  const sunLight = new THREE.DirectionalLight(0xfff0d8, 1.2);
  scene.add(sunLight, sunLight.target);
  const fill = new THREE.DirectionalLight(0xbfd4ff, 0.45); fill.position.set(0.3, 2, -2); scene.add(fill);
  const hudGlow = new THREE.PointLight(0xff9a40, 2.2, 3, 1.5); hudGlow.position.set(0, 1.2, -0.75); scene.add(hudGlow);
  for (const x of [-0.9, 0.9]) { const l = new THREE.PointLight(0xffc98a, 1.1, 2, 2); l.position.set(x, 1.05, -0.55); scene.add(l); }

  // Matériaux
  const woodTex = canvasTex(1024, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#7a4a28'); g.addColorStop(1, '#5a3418');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) {
      x.strokeStyle = `rgba(${rnd() < 0.5 ? '40,20,8' : '150,95,50'},${0.08 + rnd() * 0.12})`;
      x.lineWidth = 1 + rnd() * 3;
      const y = rnd() * h; x.beginPath(); x.moveTo(0, y);
      for (let px = 0; px <= w; px += 64) x.lineTo(px, y + Math.sin(px * 0.01 + i) * 6 + (rnd() - 0.5) * 3);
      x.stroke();
    }
  });
  woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping; woodTex.repeat.set(2, 1);
  const wood = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.55 });
  const woodFace = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.55, color: new THREE.Color(0.75, 0.68, 0.62), side: THREE.DoubleSide });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc89050, roughness: 0.32, metalness: 0.9 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 0.6, metalness: 0.5 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.85 });

  // Pupitre en arc autour du pilote
  const A0 = THREE.MathUtils.degToRad(82);
  const arcTorus = (r, tube, y, mat) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 160, A0 * 2), mat);
    m.rotation.set(Math.PI / 2, 0, -Math.PI / 2 - A0); m.position.y = y; scene.add(m); return m;
  };
  {
    const s = new THREE.Shape(), N = 64, r1 = 0.42, r2 = 0.9;
    for (let i = 0; i <= N; i++) { const a = -A0 + 2 * A0 * i / N; i ? s.lineTo(Math.sin(a) * r2, Math.cos(a) * r2) : s.moveTo(Math.sin(a) * r2, Math.cos(a) * r2); }
    for (let i = N; i >= 0; i--) { const a = -A0 + 2 * A0 * i / N; s.lineTo(Math.sin(a) * r1, Math.cos(a) * r1); }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 3, curveSegments: 64 });
    g.rotateX(-Math.PI / 2);
    const desk = new THREE.Mesh(g, wood); desk.position.y = 0.74; scene.add(desk);
  }
  arcTorus(0.42, 0.014, 0.79, brass);
  const apron = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.4, 0.5, 96, 1, true, Math.PI - A0, A0 * 2), leather); apron.position.y = 0.49; scene.add(apron);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.3, 64), new THREE.MeshStandardMaterial({ color: 0x1c130d, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.24; scene.add(floor);
  const well = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.56, 64, 1, true), new THREE.MeshStandardMaterial({ color: 0x2a1b12, roughness: 0.9, side: THREE.BackSide }));
  well.position.y = 0.5; scene.add(well);

  // Façade d'instruments inclinée vers le pilote ; la verrière commence juste au-dessus
  const FR0 = 0.9, FR1 = 1.2, FH = 0.17, FY = 0.775 + FH / 2;
  const fascia = new THREE.Mesh(new THREE.CylinderGeometry(FR1, FR0, FH, 128, 1, true, Math.PI - A0, A0 * 2), woodFace);
  fascia.position.y = FY; scene.add(fascia);
  arcTorus(FR1, 0.016, FY + FH / 2, brass);
  arcTorus(FR1 + 0.04, 0.028, FY + FH / 2 + 0.02, darkMetal);
  const sillPoint = new THREE.Vector3(0, FY + FH / 2 + 0.05, -(FR1 + 0.04));

  const slope = Math.atan2(FR1 - FR0, FH);
  function onFascia(obj, phiDeg, h = 0.5, out = 0.012) {
    const phi = THREE.MathUtils.degToRad(phiDeg);
    const r = THREE.MathUtils.lerp(FR0, FR1, h) - out;
    const y = FY - FH / 2 + FH * h;
    obj.position.set(Math.sin(phi) * r, y, -Math.cos(phi) * r);
    obj.lookAt(0, y, 0);
    obj.rotateX(-slope);
    scene.add(obj);
    return obj;
  }

  // Écrans cathodiques (redessinés en direct)
  function crt() {
    const tex = canvasTex(512, 320);
    const g = new THREE.Group();
    const bezel = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.17, 0.03, 4, 0.02), darkMetal); bezel.position.z = -0.012; g.add(bezel);
    const ring = new THREE.Mesh(new RoundedBoxGeometry(0.275, 0.185, 0.02, 4, 0.024), brass); ring.position.z = -0.02; g.add(ring);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.235, 0.147), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    screen.position.z = 0.0045; g.add(screen);
    g.userData.tex = tex;
    return g;
  }
  function drawCrt(tex, lines, k = 1) {
    const c = tex.image, x = c.getContext('2d'), w = c.width, h = c.height;
    const g = x.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w * 0.7);
    g.addColorStop(0, '#3a1a06'); g.addColorStop(1, '#0d0502');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.font = '38px VT323, monospace'; x.textBaseline = 'top';
    x.shadowColor = 'rgba(255,130,40,0.9)'; x.shadowBlur = 10;
    lines.forEach((ln, i) => {
      let px = 24 + (rnd() < 0.06 * k ? 7 : 0);
      for (const ch of ln) {
        const r = rnd();
        const a = r < 0.025 * k ? 0.08 : r < 0.08 * k ? 0.3 : 0.75 + rnd() * 0.25;
        x.fillStyle = `rgba(255,${150 + Math.floor(rnd() * 30)},60,${a})`;
        x.fillText(ch, px, 20 + i * 56 + (r > 0.985 ? -3 : 0));
        px += x.measureText(ch).width + 1.5;
      }
    });
    x.shadowBlur = 0;
    for (let y = 0; y < h; y += 4) { x.fillStyle = 'rgba(0,0,0,0.28)'; x.fillRect(0, y, w, 1.5); }
    tex.needsUpdate = true;
  }

  // Cadrans analogiques à aiguille mobile
  function gauge(label, sc = 1.25) {
    const tex = canvasTex(512, 512, (x, w) => {
      x.fillStyle = '#f3e6cc'; x.beginPath(); x.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#6b4a2c'; x.lineWidth = 6;
      for (let a = -120; a <= 120; a += 15) {
        const t = (a - 90) * Math.PI / 180, r1 = w * 0.44, r2 = a % 60 === 0 ? w * 0.34 : w * 0.39;
        x.beginPath(); x.moveTo(w / 2 + Math.cos(t) * r1, w / 2 + Math.sin(t) * r1); x.lineTo(w / 2 + Math.cos(t) * r2, w / 2 + Math.sin(t) * r2); x.stroke();
      }
      x.strokeStyle = '#c0392b'; x.lineWidth = 14; x.beginPath(); x.arc(w / 2, w / 2, w * 0.415, (60 - 90) * Math.PI / 180, (120 - 90) * Math.PI / 180); x.stroke();
      x.fillStyle = '#6b4a2c'; x.font = '800 40px Nunito, sans-serif'; x.textAlign = 'center'; x.fillText(label.toUpperCase(), w / 2, w * 0.74);
    });
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.035, 48), brass); body.rotation.x = Math.PI / 2; body.position.z = -0.012; g.add(body);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.064, 48), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 })); face.position.z = 0.006; g.add(face);
    const pivot = new THREE.Group(); pivot.position.z = 0.009; g.add(pivot);
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.048, 0.002), new THREE.MeshStandardMaterial({ color: 0xb8261a, roughness: 0.4 }));
    needle.position.y = 0.022; pivot.add(needle);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 16), darkMetal); cap.rotation.x = Math.PI / 2; cap.position.z = 0.011; g.add(cap);
    const glassC = new THREE.Mesh(new THREE.SphereGeometry(0.07, 32, 12, 0, Math.PI * 2, 0, 0.5), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.05 }));
    glassC.rotation.x = Math.PI / 2; glassC.position.z = -0.055; g.add(glassC);
    g.scale.setScalar(sc);
    g.userData.value = 0;
    g.userData.set = (v, dt = 1) => {
      g.userData.value += (THREE.MathUtils.clamp(v, 0, 1) - g.userData.value) * Math.min(1, dt * 4);
      pivot.rotation.z = THREE.MathUtils.degToRad(120 - 240 * g.userData.value);
    };
    return g;
  }
  function toggle(up) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 16), brass); base.rotation.x = Math.PI / 2; g.add(base);
    const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.05, 8), new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.3, metalness: 0.4 }));
    lever.position.set(0, up ? 0.015 : -0.015, 0.022); lever.rotation.x = Math.PI / 2 + (up ? -0.5 : 0.5); g.add(lever);
    return g;
  }
  const lampMat = (color) => new THREE.MeshStandardMaterial({ color: 0x220a00, emissive: color, emissiveIntensity: 0.2 });
  function lamp(color) { return new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), lampMat(color)); }
  function plate(text) {
    const tex = canvasTex(512, 96, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e7c27e'); g.addColorStop(1, '#a77a3c');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = '#3a2614'; x.font = 'italic 40px Spectral, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 2);
    });
    return new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.045), new THREE.MeshStandardMaterial({ map: tex, metalness: 0.6, roughness: 0.35 }));
  }

  const crtL = onFascia(crt(), -50, 0.5);
  const crtR = onFascia(crt(), 50, 0.5);
  const gThrust = onFascia(gauge('Poussée'), -25, 0.5);
  const gWind = onFascia(gauge('Vent solaire'), 25, 0.5);
  const gDist = onFascia(gauge('Distance'), -70, 0.3);
  const gLoop = onFascia(gauge('Boucle'), 70, 0.3);
  onFascia(plate('Sys-E139 · vaisseau d’exploration'), 0, 0.72);
  for (const [phi, up] of [[-12, true], [-8, false], [-4, true], [4, false], [8, true], [12, false]]) onFascia(toggle(up), phi, 0.32);
  const lamps = {
    engine: onFascia(lamp(0xff8a2a), -70, 0.62), nav: onFascia(lamp(0x7dff9a), -66, 0.62),
    storm: onFascia(lamp(0xff5a3a), 70, 0.62), hud: onFascia(lamp(0xff8a2a), 66, 0.62),
  };

  // Clavier mécanique posé sur le pupitre, incliné vers le pilote
  const kb = new THREE.Group();
  kb.position.set(0, 0.79, -0.6); kb.rotation.x = 0.16; kb.scale.setScalar(1.25);
  scene.add(kb);
  const KW = 0.62, KD = 0.17, COLS = 10, U = (KW - 0.05) / COLS;
  const kbBase = new THREE.Mesh(new RoundedBoxGeometry(KW, 0.035, KD, 4, 0.012), darkMetal); kb.add(kbBase);
  const kbRim = new THREE.Mesh(new RoundedBoxGeometry(KW + 0.016, 0.03, KD + 0.016, 4, 0.014), brass); kbRim.position.y = -0.006; kb.add(kbRim);
  const capMat = new THREE.MeshStandardMaterial({ color: 0xf0e2c4, roughness: 0.45 });
  const keys = [];
  const keyByCode = {};
  let col = 0, row = 0;
  for (const [lab, sub, span, code, action, led] of COCKPIT_KEYS) {
    if (col + span > COLS) { col = 0; row++; }
    const w = U * span;
    const x = -KW / 2 + 0.025 + U * col + w / 2;
    const z = -KD / 2 + 0.02 + U * row + U / 2;
    const cap = new THREE.Group(); cap.position.set(x, 0.024, z); kb.add(cap);
    const mat = capMat.clone(); mat.emissive = new THREE.Color(0xff7a20); mat.emissiveIntensity = 0;
    const body = new THREE.Mesh(new RoundedBoxGeometry(w - 0.008, 0.02, U - 0.008, 4, 0.007), mat); cap.add(body);
    const tex = canvasTex(Math.round(128 * span), 128);
    const drawLegend = () => {
      const c = tex.image.getContext('2d'), cw = tex.image.width;
      c.clearRect(0, 0, cw, 128);
      c.fillStyle = '#3a2614'; c.textAlign = 'center';
      c.font = `800 ${lab.length > 3 ? 30 : 56}px Nunito, sans-serif`; c.fillText(lab, cw / 2, sub ? 70 : 82);
      if (sub) { c.font = '800 19px Nunito, sans-serif'; c.fillStyle = '#7a5530'; c.fillText(sub.toUpperCase(), cw / 2, 106); }
      tex.needsUpdate = true;
    };
    drawLegend();
    const legend = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.014, U - 0.014), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    legend.rotation.x = -Math.PI / 2; legend.position.y = 0.0102; cap.add(legend);
    let ledMesh = null;
    if (led) {
      ledMesh = lamp(0xff8a2a); ledMesh.scale.setScalar(0.35);
      ledMesh.position.set(w / 2 - 0.012, 0.011, -U / 2 + 0.012); cap.add(ledMesh);
    }
    const k = { cap, mat, body, legend, ledMesh, led, action, code, press: 0, drawLegend };
    body.userData.key = legend.userData.key = k;
    keys.push(k);
    if (code) keyByCode[code] = k;
    col += span;
  }
  // Manette des gaz (à droite) et manche (à gauche)
  const throttle = new THREE.Group(); throttle.position.set(0.56, 0.79, -0.6); scene.add(throttle);
  throttle.add(new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.03, 0.16, 4, 0.01), darkMetal));
  const lever = new THREE.Group(); lever.position.y = 0.015; throttle.add(lever);
  const tl = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.14, 12), brass); tl.position.y = 0.07; lever.add(tl);
  const tk = new THREE.Mesh(new THREE.SphereGeometry(0.022, 20, 16), new THREE.MeshStandardMaterial({ color: 0xe07a3a, roughness: 0.4 })); tk.position.y = 0.145; lever.add(tk);
  const stick = new THREE.Group(); stick.position.set(-0.56, 0.79, -0.6); scene.add(stick);
  stick.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.025, 24), darkMetal));
  const stickArm = new THREE.Group(); stick.add(stickArm);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.15, 12), brass); st.position.y = 0.075; stickArm.add(st);
  const sk = new THREE.Mesh(new THREE.SphereGeometry(0.024, 20, 16), new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 0.5 })); sk.position.y = 0.15; stickArm.add(sk);

  // Les légendes et écrans utilisent VT323 / Nunito : on les redessine une fois les polices prêtes
  document.fonts?.ready.then(() => keys.forEach((k) => k.drawLegend()));

  // --- API ---
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const keyMeshes = keys.flatMap((k) => [k.body, k.legend]);
  const tmp = new THREE.Vector3();
  let crtTimer = 0;
  const lit = {};

  return {
    scene, camera,
    resize(w, h) {
      camera.aspect = w / h;
      // Écran étroit : on élargit le champ pour garder le clavier et les cadrans
      camera.fov = w / h < 1.45 ? 74 + (1.45 - w / h) * 30 : 74;
      camera.updateProjectionMatrix();
    },
    // Bas de la verrière (en pixels), au centre de l'écran
    glassBottom(h) {
      tmp.copy(sillPoint).project(camera);
      return (-tmp.y * 0.5 + 0.5) * h;
    },
    keyAt(x, y) {
      ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return raycaster.intersectObjects(keyMeshes, false)[0]?.object.userData.key || null;
    },
    press(k) { if (k) k.press = 1; },
    keyFor(code) { return keyByCode[code] || null; },
    setLit(name, on) { lit[name] = on; },
    update(dt, s) {
      // s : { thrust, wind, dist (0-1), loop (0-1), sunDir (repère caméra), sunPower, storm, crtLeft, crtRight }
      gThrust.userData.set(s.thrust, dt);
      gWind.userData.set(s.wind, dt);
      gDist.userData.set(s.dist, dt);
      gLoop.userData.set(s.loop, dt);
      lever.rotation.x += ((-0.5 + s.thrust * 1.0) - lever.rotation.x) * Math.min(1, dt * 3);
      stickArm.rotation.z += ((s.turn || 0) * 0.3 - stickArm.rotation.z) * Math.min(1, dt * 3);
      stickArm.rotation.x += ((s.pitch || 0) * 0.3 - stickArm.rotation.x) * Math.min(1, dt * 3);
      // Lumière de l'étoile, venant de sa direction réelle par rapport à la vue
      sunLight.position.copy(s.sunDir).multiplyScalar(5).add(camera.position);
      sunLight.target.position.copy(camera.position);
      sunLight.intensity = s.sunPower;
      hudGlow.intensity = 2.0 + s.storm * 1.5 + (rnd() < 0.03 ? -0.6 : 0);
      lamps.engine.material.emissiveIntensity = 0.3 + s.thrust * 3;
      lamps.nav.material.emissiveIntensity = lit.transfer ? 3 : 0.3;
      lamps.storm.material.emissiveIntensity = s.storm > 0.2 ? 1.5 + Math.sin(performance.now() * 0.012) * 1.5 : 0.2;
      lamps.hud.material.emissiveIntensity = lit.hud ? 3 : 0.3;
      for (const k of keys) {
        k.press = Math.max(0, k.press - dt * 5);
        const on = k.led && lit[k.led];
        k.cap.position.y = 0.024 - (k.press > 0 ? 0.007 : 0) - (on && !k.code ? 0.004 : 0);
        k.mat.emissiveIntensity = (on ? 0.35 : 0) + k.press * 0.5;
        if (k.ledMesh) k.ledMesh.material.emissiveIntensity = on ? 3 : 0.15;
      }
      crtTimer -= dt;
      if (crtTimer <= 0) {
        crtTimer = 0.2;
        drawCrt(crtL.userData.tex, s.crtLeft, 1);
        drawCrt(crtR.userData.tex, s.crtRight, 1);
      }
    },
  };
}

// --- Texte « analogique » sur la verrière : lettres qui grisaillent, sautent et s'effacent ---
const GLITCH_MARK = 'glitched';
export function glitchify(root, k = 1) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest('.gc, img, svg, script, style') || !n.nodeValue.trim() ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const frag = document.createDocumentFragment();
    // Les espaces restent de simples caractères pour garder la césure des lignes
    for (const part of n.nodeValue.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); continue; }
      const word = document.createElement('span');
      word.className = 'gw';
      for (const ch of part) {
        const s = document.createElement('span');
        s.className = 'gc';
        s.textContent = ch;
        const r = Math.random();
        if (r < 0.01 * k) s.classList.add('g-drop');
        else if (r < 0.035 * k) s.classList.add('g-ghost');
        word.appendChild(s);
      }
      frag.appendChild(word);
    }
    n.parentNode.replaceChild(frag, n);
  }
  root.dataset[GLITCH_MARK] = '1';
}
// Fait « vivre » le grisaillement : quelques lettres changent d'état à chaque appel
export function flickerGlitch(roots, k = 1) {
  for (const root of roots) {
    if (!root) continue;
    const all = root.getElementsByClassName('gc');
    if (!all.length) continue;
    const n = Math.max(1, Math.round(all.length * 0.004 * k));
    for (let i = 0; i < n; i++) {
      const s = all[Math.floor(Math.random() * all.length)];
      const r = Math.random();
      s.classList.remove('g-drop', 'g-ghost', 'g-jit');
      if (r < 0.25) s.classList.add('g-drop');
      else if (r < 0.65) s.classList.add('g-ghost');
      else if (r < 0.8) s.classList.add('g-jit');
    }
  }
}
// Version SVG (texte sur les arcs de la verrière)
export function glitchTspans(text, k = 1) {
  return [...text].map((ch) => {
    const r = Math.random();
    const o = r < 0.012 * k ? 0.08 : r < 0.045 * k ? 0.3 : (0.75 + Math.random() * 0.25).toFixed(2);
    const esc = ch === '<' ? '&lt;' : ch === '&' ? '&amp;' : ch;
    return `<tspan opacity="${o}">${esc}</tspan>`;
  }).join('');
}
