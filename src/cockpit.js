// Cockpit du pilote automatique : poste de pilotage en 3D (pupitre en bois, façade d'instruments,
// clavier mécanique, manettes) rendu par-dessus la vue spatiale, et texte orangé « analogique »
// projeté sur la verrière.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

let seed = 1234567;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Commandes du tableau de bord : [légende, sous-titre, groupe, code clavier, action, voyant, forme, couleur]
//   nav : croix de navigation au centre ; left / right : platines de part et d'autre
export const COCKPIT_KEYS = [
  ['▲', 'astre −', 'nav', 'ArrowUp', 'prevPlanet', null, 'up'],
  ['▼', 'astre +', 'nav', 'ArrowDown', 'nextPlanet', null, 'down'],
  ['◀', 'satellite', 'nav', 'ArrowLeft', 'prevMoon', null, 'left'],
  ['▶', 'satellite', 'nav', 'ArrowRight', 'nextMoon', null, 'right'],
  ['◎', 'vue d’ensemble', 'nav', 'Escape', 'home', null, 'center'],
  ['F', 'fiche', 'left', 'KeyF', 'fiche', 'fiche', 'square'],
  ['J', 'journal', 'left', 'KeyJ', 'journal', 'journal', 'square'],
  ['H', 'affichage', 'left', 'KeyH', 'hud', 'hud', 'square'],
  ['V', 'vue', 'left', 'KeyV', 'view', null, 'square'],
  ['G', 'galerie', 'right', 'KeyG', 'gallery', 'gallery', 'round', 0xc0643a],
  ['L', 'lunette', 'right', 'KeyL', 'scope', 'scope', 'round', 0x3f8f8a],
  ['O', 'orbites', 'right', 'KeyO', 'orbits', 'orbits', 'round', 0xc9a13b],
  ['M', 'mode', 'right', 'KeyM', 'free', null, 'round', 0x7a4a6a],
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
    // Bande de « tracking » VHS qui descend lentement l'écran
    const band = ((performance.now() / 2600) % 1.3) * h - 30;
    lines.forEach((ln, i) => {
      const y0 = 20 + i * 56;
      const inBand = Math.abs(y0 + 18 - band) < 34;
      let px = 24 + (inBand ? 6 + rnd() * 8 : rnd() < 0.05 * k ? 3 : 0);
      for (const ch of ln) {
        const r = rnd();
        const a = r < 0.006 * k ? 0.15 : r < 0.03 * k ? 0.55 : inBand ? 0.6 + rnd() * 0.2 : 0.85 + rnd() * 0.15;
        x.fillStyle = `rgba(255,${150 + Math.floor(rnd() * 30)},60,${a})`;
        x.fillText(ch, px, 20 + i * 56 + (r > 0.985 ? -3 : 0));
        px += x.measureText(ch).width + 1.5;
      }
    });
    x.shadowBlur = 0;
    for (let y = 0; y < h; y += 4) { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0, y, w, 1.5); }
    x.fillStyle = 'rgba(255,170,90,0.07)'; x.fillRect(0, band, w, 26);
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

  // Commandes posées sur le pupitre : croix de navigation au centre, deux platines inclinées sur les côtés
  const bakelite = new THREE.MeshStandardMaterial({ color: 0x3b2a22, roughness: 0.38, metalness: 0.05 });
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x241a14, roughness: 0.55, metalness: 0.35 });
  const legendTex = (text, size, color = '#f2e3c6', w = 128, h = 128) => canvasTex(w, h, (c) => {
    c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `800 ${size}px Nunito, sans-serif`; c.fillText(text, w / 2, h / 2 + 2);
  });
  const engrave = (text, width) => {
    const tex = canvasTex(256, 48, (c) => {
      c.fillStyle = '#d9b98a'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '800 24px Nunito, sans-serif'; c.fillText(text.toUpperCase(), 128, 26);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 48 / 256), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85 }));
    m.rotation.x = -Math.PI / 2;
    m.userData.redraw = () => { const c = tex.image.getContext('2d'); c.clearRect(0, 0, 256, 48); c.fillStyle = '#d9b98a'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '800 24px Nunito, sans-serif'; c.fillText(text.toUpperCase(), 128, 26); tex.needsUpdate = true; };
    return m;
  };
  // Place un groupe sur le pupitre, à l'angle φ et au rayon r, tourné vers le pilote et un peu incliné
  function onDesk(obj, phiDeg, r, tilt = 0.14) {
    const phi = THREE.MathUtils.degToRad(phiDeg);
    obj.position.set(Math.sin(phi) * r, 0.79, -Math.cos(phi) * r);
    obj.lookAt(0, 0.79, 0);
    obj.rotateX(tilt);
    scene.add(obj);
    return obj;
  }
  const keys = [];
  const keyByCode = {};
  const redraws = [];
  function makeKey(def, parent, x, z) {
    const [lab, sub, , code, action, led, shape, color] = def;
    const cap = new THREE.Group(); cap.position.set(x, 0, z); parent.add(cap);
    let body, legendMat, size;
    if (shape === 'round') {
      size = 0.05;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(size / 2 + 0.004, 0.005, 10, 40), brass); ring.rotation.x = Math.PI / 2; ring.position.y = 0.006; parent.add(ring); ring.position.x = x; ring.position.z = z;
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1, emissive: new THREE.Color(color), emissiveIntensity: 0 });
      body = new THREE.Mesh(new THREE.CylinderGeometry(size / 2, size / 2 + 0.002, 0.018, 36), mat); body.position.y = 0.012; cap.add(body);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(size / 2, 36, 10, 0, Math.PI * 2, 0, 0.35), mat); dome.scale.y = 0.6; dome.position.y = 0.012; cap.add(dome);
      legendMat = new THREE.MeshBasicMaterial({ map: legendTex(lab, 70), transparent: true, color: 0xffffff });
      const lg = new THREE.Mesh(new THREE.CircleGeometry(size * 0.38, 24), legendMat); lg.rotation.x = -Math.PI / 2; lg.position.y = 0.0245; cap.add(lg);
      body.userData.extra = [dome, lg];
    } else {
      const big = shape === 'center';
      size = big ? 0.044 : shape === 'square' ? 0.05 : 0.04;
      const bezel = new THREE.Mesh(new RoundedBoxGeometry(size + 0.012, 0.01, size + 0.012, 3, 0.004), brass);
      bezel.position.set(x, 0.004, z); parent.add(bezel);
      if (big) bezel.visible = false;
      body = big
        ? new THREE.Mesh(new THREE.CylinderGeometry(size / 2, size / 2 + 0.003, 0.02, 36), new THREE.MeshStandardMaterial({ color: 0xe8d6b0, roughness: 0.35, emissive: 0xff7a20, emissiveIntensity: 0 }))
        : new THREE.Mesh(new RoundedBoxGeometry(size, 0.022, size, 4, 0.008), bakelite.clone());
      body.material.emissive = new THREE.Color(0xff7a20);
      body.position.y = 0.013; cap.add(body);
      legendMat = new THREE.MeshBasicMaterial({ map: legendTex(lab, shape === 'square' ? 64 : 58, big ? '#3a2614' : '#f2e3c6'), transparent: true, color: 0xffffff });
      const lg = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.8, size * 0.8), legendMat); lg.rotation.x = -Math.PI / 2; lg.position.y = 0.0245; cap.add(lg);
      body.userData.extra = [lg];
    }
    let ledMesh = null;
    if (led) {
      ledMesh = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 12, 8), lampMat(0xff8a2a));
      ledMesh.position.set(x + size / 2 + 0.008, 0.008, z - size / 2 + 0.004); parent.add(ledMesh);
    }
    const k = { cap, body, legendMat, ledMesh, led, action, code, press: 0, shape };
    for (const m of [body, ...body.userData.extra]) m.userData.key = k;
    keys.push(k);
    if (code) keyByCode[code] = k;
    return k;
  }

  // Croix de navigation dans une coupelle en laiton
  const navPad = new THREE.Group();
  onDesk(navPad, 0, 0.6, 0.18);
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.125, 0.014, 64), brass); dish.position.y = 0.002; navPad.add(dish);
  const dishIn = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.016, 64), plateMat); dishIn.position.y = 0.003; navPad.add(dishIn);
  const navDefs = COCKPIT_KEYS.filter((d) => d[2] === 'nav');
  const navPos = { up: [0, -0.062], down: [0, 0.062], left: [-0.062, 0], right: [0.062, 0], center: [0, 0] };
  for (const d of navDefs) makeKey(d, navPad, ...navPos[d[6]]);
  for (const [t, x, z, w] of [['astre −', 0, -0.142, 0.1], ['astre +', 0, 0.142, 0.1], ['satellite', -0.16, 0, 0.09], ['satellite', 0.16, 0, 0.09]]) {
    const e = engrave(t, w); e.position.set(x, 0.01, z); if (Math.abs(x) > 0) e.rotation.z = 0; navPad.add(e); redraws.push(e);
  }
  { const e = engrave('vue d’ensemble · Échap', 0.15); e.position.set(0, 0.012, 0.03 + 0.002); e.position.z = 0.165; navPad.add(e); redraws.push(e); }

  // Platines latérales
  function sidePanel(group, phi) {
    const defs = COCKPIT_KEYS.filter((d) => d[2] === group);
    const panel = new THREE.Group();
    onDesk(panel, phi, 0.64, 0.2);
    const W = defs.length * 0.075 + 0.04, D = 0.13;
    const plate = new THREE.Mesh(new RoundedBoxGeometry(W, 0.016, D, 4, 0.008), plateMat); plate.position.y = -0.002; panel.add(plate);
    const rim = new THREE.Mesh(new RoundedBoxGeometry(W + 0.012, 0.012, D + 0.012, 4, 0.01), brass); rim.position.y = -0.006; panel.add(rim);
    // Vis de fixation
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.003, 12), brass);
      sc.position.set(sx * (W / 2 - 0.012), 0.007, sz * (D / 2 - 0.012)); panel.add(sc);
    }
    defs.forEach((d, i) => {
      const x = -W / 2 + 0.02 + 0.075 * (i + 0.5);
      makeKey(d, panel, x, -0.012);
      const e = engrave(d[1], 0.07); e.position.set(x, 0.0075, 0.042); panel.add(e); redraws.push(e);
    });
  }
  sidePanel('left', -30);
  sidePanel('right', 30);

  // Manette des gaz (à droite) et manche (à gauche)
  const throttle = new THREE.Group(); onDesk(throttle, 58, 0.64, 0);
  throttle.add(new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.03, 0.16, 4, 0.01), darkMetal));
  const lever = new THREE.Group(); lever.position.y = 0.015; throttle.add(lever);
  const tl = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.14, 12), brass); tl.position.y = 0.07; lever.add(tl);
  const tk = new THREE.Mesh(new THREE.SphereGeometry(0.022, 20, 16), new THREE.MeshStandardMaterial({ color: 0xe07a3a, roughness: 0.4 })); tk.position.y = 0.145; lever.add(tk);
  const stick = new THREE.Group(); onDesk(stick, -58, 0.64, 0);
  stick.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.025, 24), darkMetal));
  const stickArm = new THREE.Group(); stick.add(stickArm);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.15, 12), brass); st.position.y = 0.075; stickArm.add(st);
  const sk = new THREE.Mesh(new THREE.SphereGeometry(0.024, 20, 16), new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 0.5 })); sk.position.y = 0.15; stickArm.add(sk);

  // Les légendes et écrans utilisent VT323 / Nunito : on les redessine une fois les polices prêtes
  document.fonts?.ready.then(() => redraws.forEach((e) => e.userData.redraw()));

  // --- API ---
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const keyMeshes = keys.flatMap((k) => [k.body, ...k.body.userData.extra]);
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
        k.cap.position.y = k.press > 0 ? -0.006 : 0;
        k.body.material.emissiveIntensity = (on ? (k.shape === 'round' ? 0.45 : 0.18) : 0) + k.press * 0.6;
        // Légende rétroéclairée en orange quand la fonction est active
        k.legendMat.color.setHex(on && k.shape !== 'round' ? 0xffa050 : 0xffffff);
        if (k.ledMesh) k.ledMesh.material.emissiveIntensity = on ? 3 : 0.15;
      }
      crtTimer -= dt;
      if (crtTimer <= 0) {
        crtTimer = 0.12;
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
        if (r < 0.003 * k) s.classList.add('g-drop');
        else if (r < 0.012 * k) s.classList.add('g-ghost');
        word.appendChild(s);
      }
      frag.appendChild(word);
    }
    n.parentNode.replaceChild(frag, n);
  }
  root.dataset[GLITCH_MARK] = '1';
}
// Fait « vivre » le grisaillement : quelques lettres faiblissent un instant puis reviennent
const flickered = new Set();
export function flickerGlitch(roots, k = 1) {
  for (const s of flickered) s.classList.remove('g-dim', 'g-drop', 'g-jit');
  flickered.clear();
  for (const root of roots) {
    if (!root) continue;
    const all = root.getElementsByClassName('gc');
    if (!all.length) continue;
    const n = Math.max(1, Math.round(all.length * 0.003 * k));
    for (let i = 0; i < n; i++) {
      const s = all[Math.floor(Math.random() * all.length)];
      const r = Math.random();
      s.classList.add(r < 0.12 ? 'g-drop' : r < 0.8 ? 'g-dim' : 'g-jit');
      flickered.add(s);
    }
  }
}
// Distorsion VHS : décalage horizontal par rangées (filtre SVG) et sursauts de « tracking »
let vhsTimer = 0, vhsBurst = 0;
export function updateVHS(dt) {
  const turb = document.getElementById('vhs-turb'), disp = document.getElementById('vhs-disp');
  if (!turb) return;
  vhsTimer -= dt;
  vhsBurst = Math.max(0, vhsBurst - dt);
  if (vhsTimer > 0) return;
  vhsTimer = 0.09;
  if (Math.random() < 0.025) vhsBurst = 0.18 + Math.random() * 0.2;
  turb.setAttribute('seed', String(Math.floor(Math.random() * 1000)));
  turb.setAttribute('baseFrequency', `0 ${vhsBurst ? 0.025 : 0.06}`);
  disp.setAttribute('scale', vhsBurst ? '9' : '2.2');
}
// Version SVG (texte sur les arcs de la verrière)
export function glitchTspans(text, k = 1) {
  return [...text].map((ch) => {
    const r = Math.random();
    const o = r < 0.004 * k ? 0.15 : r < 0.02 * k ? 0.5 : (0.75 + Math.random() * 0.25).toFixed(2);
    const esc = ch === '<' ? '&lt;' : ch === '&' ? '&amp;' : ch;
    return `<tspan opacity="${o}">${esc}</tspan>`;
  }).join('');
}
