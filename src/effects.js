// Effets visuels inspirés d'Outer Wilds : ciel, étoiles, soleil, atmosphères, orbites, post-traitement.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// --- Bruit procédural partagé (value noise 3D + fbm) ---
const NOISE_GLSL = /* glsl */ `
  float hash3(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(i + vec3(0,0,0)), hash3(i + vec3(1,0,0)), f.x),
          mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x),
          mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise3(p);
      p = p * 2.03 + vec3(1.7, 9.2, 3.1);
      a *= 0.5;
    }
    return v;
  }
`;

// --- Ciel : poussière nébulaire bleutée + bande galactique chaude ---
export function createSky(radius = 12000) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {},
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      ${NOISE_GLSL}
      void main() {
        vec3 d = normalize(vDir);
        float n  = fbm(d * 2.4);
        float n2 = fbm(d * 5.5 + 10.0);
        float band = exp(-pow(dot(d, normalize(vec3(0.35, 1.0, 0.15))) * 3.2, 2.0));
        vec3 col = vec3(0.006, 0.009, 0.022);
        col += vec3(0.03, 0.09, 0.14) * smoothstep(0.42, 0.85, n) * 0.55;
        col += vec3(0.12, 0.05, 0.10) * smoothstep(0.55, 0.92, n2) * 0.30;
        col += vec3(0.20, 0.13, 0.08) * band * (0.35 + 0.65 * n2) * 0.32;
        col *= 1.0 - 0.55 * band * smoothstep(0.48, 0.72, fbm(d * 11.0 + 3.0));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), material);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

// --- Champ d'étoiles scintillantes, couleurs selon la température ---
export function createStarfield(count = 7000, radius = 9000) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const palette = [
    new THREE.Color('#9fc4ff'), new THREE.Color('#cfe0ff'), new THREE.Color('#ffffff'),
    new THREE.Color('#fff1d6'), new THREE.Color('#ffd29a'), new THREE.Color('#ffb07a'),
  ];
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    v.randomDirection();
    // Densité un peu plus forte le long de la bande galactique
    if (Math.random() < 0.35) {
      v.y *= 0.18;
      v.normalize();
      v.applyAxisAngle(new THREE.Vector3(0, 0, 1), -0.33);
    }
    v.multiplyScalar(radius * (0.92 + Math.random() * 0.08));
    positions.set([v.x, v.y, v.z], i * 3);
    const c = palette[Math.floor(Math.pow(Math.random(), 0.8) * palette.length)];
    const bright = 0.45 + Math.pow(Math.random(), 3) * 1.6;
    colors.set([c.r * bright, c.g * bright, c.b * bright], i * 3);
    sizes[i] = 1.2 + Math.pow(Math.random(), 6) * 5.5;
    phases[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3 vColor;
      void main() {
        float tw = 0.72 + 0.28 * sin(uTime * (0.6 + aPhase * 2.2) + aPhase * 6.2831);
        vColor = aColor * tw;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (0.85 + 0.15 * tw);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float core = smoothstep(0.5, 0.0, d);
        core *= core;
        gl_FragColor = vec4(vColor * core, core);
      }
    `,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = -9;
  return points;
}

// --- Matériau du soleil : granulation animée, bord incandescent ---
export function createSunMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBoost: { value: 0 }, // 0 → normal, 1 → supernova
    },
    vertexShader: /* glsl */ `
      varying vec3 vObjNormal;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vObjNormal = normalize(position);
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uBoost;
      varying vec3 vObjNormal;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      ${NOISE_GLSL}
      void main() {
        vec3 p = vObjNormal * 3.2;
        float t = uTime * 0.04;
        float g = fbm(p + vec3(t, -t * 0.6, t * 0.3));
        float cells = fbm(p * 3.5 - vec3(t * 2.0));
        float heat = clamp(g * 0.75 + cells * 0.45, 0.0, 1.0);
        vec3 deep = vec3(1.0, 0.28, 0.04);
        vec3 hot  = vec3(1.0, 0.72, 0.36);
        vec3 col = mix(deep, hot, smoothstep(0.35, 0.85, heat));
        float rim = 1.0 - clamp(dot(normalize(vNormal), normalize(vViewDir)), 0.0, 1.0);
        col += vec3(1.0, 0.45, 0.12) * pow(rim, 2.5) * 0.9;
        col *= 1.45 + uBoost * 6.0;
        col = mix(col, vec3(0.6, 0.8, 1.6) * 8.0, uBoost * uBoost * 0.7);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

// --- Halo / couronne du soleil (sprite additif) ---
export function createCorona(size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
  g.addColorStop(0.0, 'rgba(255, 214, 160, 0.95)');
  g.addColorStop(0.22, 'rgba(255, 160, 80, 0.55)');
  g.addColorStop(0.42, 'rgba(255, 110, 40, 0.16)');
  g.addColorStop(0.7, 'rgba(255, 80, 30, 0.04)');
  g.addColorStop(1.0, 'rgba(255, 60, 20, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: tex,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.9,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(size);
  sprite.renderOrder = 2;
  return sprite;
}

// --- Atmosphère : halo extérieur + voile de diffusion sur le disque ---
export function createAtmosphere(radius, color, { shell = 1.2, strength = 1.0 } = {}) {
  const group = new THREE.Group();
  const uniforms = {
    uColor: { value: new THREE.Color(color) },
    uSunPos: { value: new THREE.Vector3() },
    uLimb: { value: Math.sqrt(1 - 1 / (shell * shell)) },
    uStrength: { value: strength },
  };
  const vertex = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying vec3 vWorldNormal;
    varying vec3 vWorldPos;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vViewDir = normalize(-mv.xyz);
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * mv;
    }
  `;
  const daylight = /* glsl */ `
    float daylight() {
      vec3 toSun = normalize(uSunPos - vWorldPos);
      return clamp(dot(normalize(vWorldNormal), toSun) * 0.9 + 0.35, 0.06, 1.0);
    }
  `;
  // Halo extérieur (faces arrière d'une sphère plus grande)
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(radius * shell, 64, 48),
    new THREE.ShaderMaterial({
      uniforms,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: vertex,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform vec3 uSunPos; uniform float uLimb; uniform float uStrength;
        varying vec3 vNormal; varying vec3 vViewDir; varying vec3 vWorldNormal; varying vec3 vWorldPos;
        ${daylight}
        void main() {
          float ad = abs(dot(normalize(vNormal), normalize(vViewDir)));
          float glow = pow(smoothstep(0.0, uLimb, ad), 3.0);
          gl_FragColor = vec4(uColor * glow * daylight() * 0.9 * uStrength, 1.0);
        }
      `,
    })
  );
  // Voile de Fresnel sur la surface (faces avant, légèrement au-dessus du sol)
  const veil = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.015, 64, 48),
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: vertex,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform vec3 uSunPos; uniform float uStrength;
        varying vec3 vNormal; varying vec3 vViewDir; varying vec3 vWorldNormal; varying vec3 vWorldPos;
        ${daylight}
        void main() {
          float f = 1.0 - clamp(dot(normalize(vNormal), normalize(vViewDir)), 0.0, 1.0);
          float glow = pow(f, 3.2) * 0.5;
          gl_FragColor = vec4(uColor * glow * daylight() * uStrength, 1.0);
        }
      `,
    })
  );
  halo.renderOrder = 3;
  veil.renderOrder = 3;
  group.add(halo, veil);
  group.userData.uniforms = uniforms;
  return group;
}

// --- Orbites : fins cercles façon « carte du vaisseau » ---
export function createOrbit(radius, { color = 0xf2a65a, opacity = 0.16, dashed = false, segments = 256 } = {}) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(pts);
  const material = dashed
    ? new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: radius * 0.03, gapSize: radius * 0.025, depthWrite: false })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  const line = new THREE.Line(geometry, material);
  if (dashed) line.computeLineDistances();
  return line;
}

// --- Petite lune rocheuse procédurale (facettes, cratères) ---
export function createMoon(radius) {
  const geometry = new THREE.IcosahedronGeometry(radius, 3);
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();
  const craters = Array.from({ length: 9 }, () => ({
    c: new THREE.Vector3().randomDirection(),
    r: 0.25 + Math.random() * 0.35,
  }));
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let h = 1 + (Math.random() - 0.5) * 0.04;
    for (const { c, r } of craters) {
      const d = v.distanceTo(c);
      if (d < r) {
        const k = d / r;
        h -= 0.09 * (1 - k * k) - 0.03 * Math.exp(-Math.pow((k - 0.95) * 8, 2));
      }
    }
    v.multiplyScalar(radius * h);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color: 0x9c8a74, roughness: 1, metalness: 0, flatShading: true });
  return new THREE.Mesh(geometry, material);
}

// --- Balise lumineuse clignotante (sprite) ---
export function createBeacon(size, color = '#8fd3ff') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  }));
  sprite.scale.setScalar(size);
  return sprite;
}

// --- Post-traitement : bloom + grain argentique, vignette, aberration chromatique ---
const FilmShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.035 },
    uVignette: { value: 0.9 },
    uAberration: { value: 0.0 },
    uFlash: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uGrain, uVignette, uAberration, uFlash;
    varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      float r = length(c);
      vec2 off = c * uAberration * (0.4 + r * 2.0);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      float vig = smoothstep(0.85, 0.2, r * uVignette);
      col *= mix(0.55, 1.0, vig);
      float n = rand(vUv * 1000.0 + fract(uTime * 7.0) * 100.0) - 0.5;
      col += n * uGrain * (0.6 + 0.4 * (1.0 - dot(col, vec3(0.299, 0.587, 0.114))));
      col = mix(col, vec3(1.0, 0.97, 0.92), uFlash);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createComposer(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.65, 0.75, 0.78);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const film = new ShaderPass(FilmShader);
  composer.addPass(film);
  return { composer, bloom, film };
}

// --- Ceinture d'astéroïdes : rochers facettés instanciés, répartis sur un anneau épais ---
export function createAsteroidBelt({ inner, outer, count = 900, thickness = 6, color = 0x8b8073, size = [0.4, 2.2], seed = 1 }) {
  let s = seed * 9973;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const geo = new THREE.IcosahedronGeometry(1, 0);
  // Déformation pour des rochers irréguliers
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.8 + ((i * 7) % 5) * 0.08), p.getY(i) * (0.7 + ((i * 3) % 4) * 0.1), p.getZ(i));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    // Densité plus forte au milieu de l'anneau
    const t = (rnd() + rnd() + rnd()) / 3;
    const r = inner + t * (outer - inner);
    v.set(Math.cos(a) * r, (rnd() - 0.5) * thickness * (1 - Math.abs(t - 0.5)), Math.sin(a) * r);
    e.set(rnd() * 6.3, rnd() * 6.3, rnd() * 6.3);
    q.setFromEuler(e);
    const k = size[0] + Math.pow(rnd(), 3) * (size[1] - size[0]);
    sc.set(k * (0.7 + rnd() * 0.6), k * (0.6 + rnd() * 0.5), k * (0.7 + rnd() * 0.6));
    m.compose(v, q, sc);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.set(color).offsetHSL(0, (rnd() - 0.5) * 0.08, (rnd() - 0.5) * 0.12));
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  return mesh;
}

// --- Galaxies lointaines peintes sur des plans, accrochées au ciel ---
function galaxyTexture(kind, seed) {
  let s = seed * 7919 + 1;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const N = 512, c = document.createElement('canvas');
  c.width = c.height = N;
  const x = c.getContext('2d');
  const cx = N / 2, cy = N / 2;
  const core = x.createRadialGradient(cx, cy, 0, cx, cy, N * (kind === 'elliptical' ? 0.45 : 0.16));
  core.addColorStop(0, 'rgba(255,236,200,0.95)');
  core.addColorStop(0.35, 'rgba(255,200,140,0.35)');
  core.addColorStop(1, 'rgba(255,180,120,0)');
  x.fillStyle = core;
  x.fillRect(0, 0, N, N);
  if (kind === 'spiral') {
    const arms = 2 + Math.floor(rnd() * 2);
    const b = 0.22 + rnd() * 0.1;
    for (let i = 0; i < 9000; i++) {
      const arm = i % arms;
      const th = rnd() * 4.6;
      const r = 14 * Math.exp(b * th * 1.9) * (0.85 + rnd() * 0.3);
      if (r > N * 0.48) continue;
      const ang = th + (arm / arms) * Math.PI * 2 + (rnd() - 0.5) * 0.5;
      const px = cx + Math.cos(ang) * r, py = cy + Math.sin(ang) * r;
      const blue = r / (N * 0.48);
      x.fillStyle = `rgba(${Math.round(255 - blue * 90)},${Math.round(220 - blue * 30)},${Math.round(190 + blue * 65)},${0.05 + rnd() * 0.18})`;
      const sz = 1 + rnd() * 2.2;
      x.fillRect(px, py, sz, sz);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function createGalaxies(radius = 8000, count = 9) {
  const g = new THREE.Group();
  let s = 4242;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const tex = [galaxyTexture('spiral', 1), galaxyTexture('spiral', 2), galaxyTexture('spiral', 3), galaxyTexture('elliptical', 4)];
  for (let i = 0; i < count; i++) {
    const dir = new THREE.Vector3(rnd() - 0.5, (rnd() - 0.5) * 1.4, rnd() - 0.5).normalize();
    const size = i === 0 ? 1900 : 280 + rnd() * 650;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({
        map: tex[i === 0 ? 0 : Math.floor(rnd() * tex.length)], transparent: true, opacity: i === 0 ? 0.75 : 0.5 + rnd() * 0.4,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      })
    );
    mesh.position.copy(dir).multiplyScalar(radius);
    mesh.lookAt(0, 0, 0);
    mesh.rotateZ(rnd() * Math.PI * 2);
    mesh.rotateX(0.3 + rnd() * 1.0);
    mesh.renderOrder = -8;
    g.add(mesh);
  }
  return g;
}

// --- Vent solaire : flux de particules en spirale de Parker (le soleil tourne pendant que le plasma s'éloigne) ---
export function createSolarWind({ sunRadius, maxRadius = 1100, count = 7000, streams = 70 } = {}) {
  let s = 77;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const dirs = [];
  for (let i = 0; i < streams; i++) {
    // Flux concentrés près du plan de l'écliptique (vent lent) avec quelques flux rapides en hautes latitudes
    const fast = rnd() < 0.25;
    const lat = (rnd() - 0.5) * (fast ? 2.2 : 0.6);
    const lon = rnd() * Math.PI * 2;
    dirs.push({ lat, lon, speed: fast ? 120 + rnd() * 40 : 60 + rnd() * 25 });
  }
  const aDir = new Float32Array(count * 3);
  const aPhase = new Float32Array(count);
  const aSpeed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const st = dirs[i % streams];
    const lat = st.lat + (rnd() - 0.5) * 0.06, lon = st.lon + (rnd() - 0.5) * 0.06;
    aDir.set([Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)], i * 3);
    aPhase[i] = rnd();
    aSpeed[i] = st.speed * (0.9 + rnd() * 0.2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('aDir', new THREE.BufferAttribute(aDir, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(aSpeed, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uR: { value: sunRadius }, uMax: { value: maxRadius }, uOmega: { value: 0.08 }, uPixelRatio: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aDir; attribute float aPhase; attribute float aSpeed;
      uniform float uTime, uR, uMax, uOmega, uPixelRatio;
      varying float vA;
      void main() {
        float span = uMax - uR;
        float r = uR + mod(uTime * aSpeed + aPhase * span, span);
        // Spirale de Parker : l'angle recule de Ω·(r − R)/v
        float a = -uOmega * (r - uR) / aSpeed;
        vec3 d = vec3(aDir.x * cos(a) - aDir.z * sin(a), aDir.y, aDir.x * sin(a) + aDir.z * cos(a));
        vec4 mv = modelViewMatrix * vec4(d * r, 1.0);
        gl_Position = projectionMatrix * mv;
        float k = (r - uR) / span;
        vA = smoothstep(0.0, 0.04, k) * pow(1.0 - k, 1.6);
        gl_PointSize = clamp(260.0 / -mv.z, 1.0, 3.5) * uPixelRatio;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float m = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(1.0, 0.82, 0.58) * m * vA * 0.55, 1.0);
      }
    `,
  });
  const pts = new THREE.Points(geo, material);
  pts.frustumCulled = false;
  return pts;
}

// --- Protubérances : boucles de plasma ancrées à la surface du soleil ---
export function createProminences(R, count = 7) {
  const g = new THREE.Group();
  let s = 31;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    const size = R * (0.12 + rnd() * 0.16);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.9, 0.3), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
    const arc = new THREE.Mesh(new THREE.TorusGeometry(size, size * 0.09, 8, 32, Math.PI), mat);
    const dir = new THREE.Vector3(rnd() - 0.5, (rnd() - 0.5) * 0.9, rnd() - 0.5).normalize();
    const holder = new THREE.Group();
    holder.position.copy(dir).multiplyScalar(R * 0.97);
    holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    holder.rotateY(rnd() * Math.PI);
    holder.add(arc);
    holder.userData = { phase: rnd() * 10, period: 14 + rnd() * 16, size };
    g.add(holder);
  }
  g.userData.update = (t) => {
    g.children.forEach((h) => {
      const { phase, period } = h.userData;
      const k = ((t + phase * period) % period) / period; // cycle de vie
      const grow = Math.sin(Math.min(1, k * 1.4) * Math.PI);
      h.scale.set(1, 0.4 + grow * 0.9, 1);
      h.children[0].material.opacity = 0.85 * Math.sin(k * Math.PI);
    });
  };
  return g;
}

// --- Comète : noyau, chevelure et deux queues (ions, bleutée et droite ; poussières, dorée et large) ---
function tailMesh(length, radius, color) {
  const geo = new THREE.ConeGeometry(radius, length, 20, 8, true);
  geo.translate(0, -length / 2, 0); // la pointe du cône à l'origine, la queue vers −Y
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const c = new THREE.Color(color);
  for (let i = 0; i < pos.count; i++) {
    const k = Math.pow(1 + pos.getY(i) / length, 1.8); // 1 près du noyau, 0 au bout
    cols.set([c.r * k, c.g * k, c.b * k], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
}
export function createComet() {
  const g = new THREE.Group();
  const nucleus = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 1), new THREE.MeshStandardMaterial({ color: 0x8c8780, flatShading: true }));
  g.add(nucleus);
  const coma = createBeacon(14, '#bfe6ff');
  coma.material.opacity = 0.7;
  g.add(coma);
  const tails = new THREE.Group();
  const ion = tailMesh(1, 0.06, '#7fc8ff');
  const dust = tailMesh(1, 0.16, '#ffd9a0');
  dust.rotation.z = 0.12;
  tails.add(ion, dust);
  g.add(tails);
  // Oriente les queues à l'opposé du soleil, longueur selon la distance
  g.userData.update = (sunPos) => {
    const away = g.position.clone().sub(sunPos);
    const r = away.length();
    away.normalize();
    tails.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), away);
    const L = THREE.MathUtils.clamp(9000 / r, 6, 140);
    ion.scale.set(L * 0.9, L, L * 0.9);
    dust.scale.set(L * 0.8, L * 0.7, L * 0.8);
    coma.scale.setScalar(THREE.MathUtils.clamp(2400 / r, 4, 26));
  };
  return g;
}

// --- Repère de planète pour la vue d'ensemble (point lumineux de taille fixe à l'écran) ---
export function createMapDot(color) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false }));
  sp.scale.setScalar(0.018);
  return sp;
}
