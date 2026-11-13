// Description du système Sys-E139 : chaque astre, son orbite, sa couleur dans l'arbre et son modèle.
// Pour ajouter un astre : ajoutez une entrée ici et un texte dans content.js (même id).
//
// Architecture calquée sur le système solaire, à échelle compressée pour rester navigable :
//   distance au soleil  d = 190 × (UA)^0.7   (1 UA → 190 unités)
//   rayon               R ≈ 6 × (rayon / rayon terrestre), compressé pour les géantes
//   planètes rocheuses → ceinture d'astéroïdes → géantes → ceinture de Kuiper
// Les éléments orbitaux (e, i, nœud, périhélie) et l'inclinaison de l'axe reprennent ceux
// de la planète réelle qui sert de modèle ; les périodes suivent la 3e loi de Kepler.
import * as THREE from 'three';
import * as M from './models.js';
import * as L from './landmarks.js';

const deg = Math.PI / 180;

// orbit : a = demi-grand axe, e = excentricité, i = inclinaison (degrés),
//         node = longitude du nœud ascendant, peri = argument du périastre, M0 = anomalie moyenne initiale (radians).
//         Pour les lunes, l'orbite est rapportée au plan équatorial de la planète.
// tilt : inclinaison de l'axe de rotation (radians) · spin : vitesse de rotation propre (rad/s, négative = rétrograde)
// mu : rapport de masse planète / soleil (période des lunes, position des points de Lagrange)
// lagrange : satellite en orbite de halo / Lissajous autour du point L2 ou L3 de sa planète
// view : réglages de cadrage caméra (pitch = élévation en radians, dist = multiplicateur de distance)
export const SYSTEM = [
  {
    id: 'lexa', name: 'LEXA', section: 'Accueil', color: '#ffb35c', kind: 'star', glb: 'Etoile',
  },
  // ---------- Planètes rocheuses ----------
  {
    // Modèle : Vénus (0,72 UA), rotation rétrograde très lente
    id: 'schola', name: 'SCHOLA', section: 'Formation', color: '#8fd18b', kind: 'planet',
    build: () => M.createPlanet({ radius: 5.7, seed: 3, amp: 0.08, colors: [0x2f5d7a, 0x4f8a4a, 0x6f9c4f, 0x9c8e64, 0xd8d0c0], trees: 70, treeColor: 0x2e5a36 }),
    radius: 5.7, mu: 0.003, tilt: 177.4 * deg, spin: -0.012,
    orbit: { a: 151, e: 0.0068, i: 3.39, node: 1.338, peri: 0.958, M0: 2.1 },
    atmosphere: { color: '#8ee6a6', shell: 1.2, radius: 5.9, strength: 0.55 },
    children: [
      { id: 'corneille', name: 'CORNEILLE', section: 'Lycée Pierre Corneille, Rouen', landmark: L.lyceeCorneille, moon: { seed: 11, ground: 0xc9bea4, colors: [0x6b6f72, 0x8b8e8a, 0xb7b6a8] }, orbit: { a: 14, e: 0.02, i: 1.0, node: 0.3, peri: 1.2, M0: 0.2 } },
      { id: 'cluny', name: 'CLUNY', section: 'Abbaye de Cluny, Arts et Métiers', landmark: L.abbayeCluny, moon: { seed: 12, ground: 0x86a65c, colors: [0x6c6152, 0x8e8068, 0xbfb08a] }, orbit: { a: 18, e: 0.03, i: -1.5, node: 2.5, peri: 2.4, M0: 1.5 } },
      { id: 'lutece', name: 'LUTÈCE', section: 'Arts et Métiers, Paris', landmark: L.ensamParis, moon: { seed: 13, ground: 0xb9b2a2, colors: [0x5f6470, 0x7d8290, 0xaeb2b8] }, orbit: { a: 22, e: 0.025, i: 0.8, node: 4.9, peri: 3.6, M0: 2.9 } },
      { id: 'cenomane', name: 'CÉNOMANE', section: 'Le Mans Université', landmark: L.universiteLeMans, moon: { seed: 14, ground: 0x86a85c, colors: [0x5d6a4e, 0x7c8c5c, 0x9fb07a] }, orbit: { a: 26, e: 0.035, i: -1.0, node: 0.9, peri: 4.8, M0: 4.2 } },
      { id: 'massalia', name: 'MASSALIA', section: 'Aix-Marseille Université', landmark: L.amuMarseille, moon: { seed: 15, ground: 0xb3a77a, colors: [0x8a8476, 0xb7ae98, 0xe6dfcd] }, orbit: { a: 30, e: 0.03, i: 1.6, node: 2.9, peri: 5.9, M0: 5.4 } },
    ],
  },
  {
    // Modèle : la Terre (1 UA)
    id: 'persion', name: 'PERSION', section: 'Profil', color: '#7ec4e8', kind: 'planet', glb: 'Planète_11',
    glbScale: 6, mu: 0.003, tilt: 23.44 * deg, spin: 0.06,
    orbit: { a: 190, e: 0.0167, i: 0.0, node: -0.197, peri: 1.993, M0: 0.6 },
    atmosphere: { color: '#7cc6ff', shell: 1.35, radius: 6 },
    view: { dist: 0.9 },
    children: [
      { id: 'sylvia', name: 'SYLVIA', section: "Centres d'intérêt", glb: 'Feuilles002', attached: true, view: { radius: 3.2, surface: true } },
      { id: 'petra', name: 'PETRA', section: 'Compétences et langues', glb: 'Roche004', glbScale: 6, orbit: { a: 20, e: 0.055, i: 5.1, node: 0.0, peri: 1.0, M0: 0.0 } },
    ],
  },
  {
    // Modèle : Mars (1,52 UA)
    id: 'proxion', name: 'PROXION', section: 'Ingénierie', color: '#f0955a', kind: 'planet', glb: 'Planète_2',
    glbScale: 0.36, mu: 0.002, tilt: 25.19 * deg, spin: 0.058,
    orbit: { a: 254, e: 0.0934, i: 1.85, node: 0.865, peri: 5.0, M0: 5.0 },
    atmosphere: { color: '#ffb27a', shell: 1.18, radius: 3.25 },
    view: { dist: 1.4 },
    children: [
      { id: 'simulx', name: 'SIMULX_5', section: 'Jumeau numérique · point L2', glb: 'Cube002', glbScale: 0.9, lagrange: { point: 'L2', Ax: 1.5, Ay: 6, Az: 4, period: 70, wz: 1 }, spin: 0.05 },
      { id: 'glenos', name: 'GLÉNOS', section: "Prothèse d'épaule", build: () => { const g = M.glenoidImplant(); g.scale.setScalar(0.6); return g; }, radius: 1.4, orbit: { a: 9, e: 0.015, i: 1.1, node: 2.7, peri: 2.4, M0: 1.6 }, spin: 0.25 },
      { id: 'enedis', name: 'ENEDIS', section: 'Data Challenge', landmark: L.enedisPylon, moon: { seed: 31, scale: 0.4, ground: 0x7e9f5a, colors: [0x4f5a52, 0x6a7a66, 0x8fa284] }, orbit: { a: 12.5, e: 0.0151, i: 1.08, node: 4.9, peri: 3.6, M0: 2.9 } },
      { id: 'ricochet', name: 'RICOCHET', section: 'TIPE', build: () => M.ricochetMoon(1.5), radius: 1.5, view: { pitch: 0.8, dist: 1.15 }, orbit: { a: 16, e: 0.0003, i: 0.9, node: 0.7, peri: 4.7, M0: 4.1 }, spin: 0.04 },
      { id: 'c4d3x', name: 'C4D3X', section: 'Code et projets personnels', glb: 'Cube013', glbScale: 0.7, orbit: { a: 20, e: 0.02, i: 1.8, node: 2.7, peri: 5.8, M0: 5.3 }, spin: 0.2 },
    ],
  },
  // ---------- Au-delà de la ceinture d'astéroïdes : les géantes ----------
  {
    // Modèle : Jupiter (5,2 UA), avec les anneaux et l'axe incliné de Saturne
    id: 'astra', name: 'ASTRA', section: 'Recherche', color: '#b9a2e8', kind: 'planet',
    build: () => {
      const p = M.createGasGiant({ radius: 24, seed: 7, bands: 11, colors: ['#4a3f86', '#7d6cb4', '#c9bde8', '#8f7bc4', '#e8e0f6'], storm: { dir: new THREE.Vector3(0.6, -0.35, 0.7).normalize(), size: 0.16, color: '#f0b8d8' } });
      p.add(M.createPlanetRing(31, 52));
      return p;
    },
    radius: 24, mu: 0.008, tilt: 26.73 * deg, spin: 0.14,
    orbit: { a: 603, e: 0.0489, i: 1.3, node: 1.753, peri: 4.78, M0: 3.6 },
    atmosphere: { color: '#a98cff', shell: 1.08, radius: 24.2 },
    view: { dist: 1.0 },
    children: [
      { id: 'meudon', name: 'MEUDON', section: 'Stage LIRA, Observatoire de Paris', landmark: L.observatoireMeudon, moon: { seed: 21, scale: 0.6, ground: 0x6f9a4c, colors: [0x55604d, 0x6e7d5a, 0x93a172] }, orbit: { a: 62, e: 0.009, i: 0.4, node: 0.8, peri: 1.4, M0: 0.5 } },
      { id: 'omega', name: 'ω CEN', section: 'Publication', build: () => M.globularCluster(4), radius: 4, orbit: { a: 76, e: 0.007, i: 0.2, node: 3.7, peri: 3.0, M0: 2.2 }, spin: 0.05 },
      { id: 'gaia', name: 'GAIA', section: 'Données et outils · point L2', build: M.gaiaProbe, radius: 2.4, view: { dist: 1.5 }, lagrange: { point: 'L2', Ax: 3, Ay: 22, Az: 14, period: 90, wz: 1.13 }, spin: 0.35 },
      { id: 'euclid', name: 'EUCLID', section: 'Thèmes de recherche · point L2', build: M.euclidProbe, radius: 2.4, view: { dist: 1.5 }, lagrange: { point: 'L2', Ax: 2, Ay: 9, Az: 6, period: 70, wz: 1, phase: 2.2 }, spin: 0.08 },
    ],
  },
  {
    // Modèle : géante de glace couchée sur le côté comme Uranus (orbite de Saturne, 9,5 UA)
    id: 'musa', name: 'MUSA', section: 'Arts et transmission', color: '#ef8fb5', kind: 'planet',
    build: () => {
      const p = M.createGasGiant({ radius: 16, seed: 5, bands: 7, turbulence: 0.2, colors: ['#e9a7c4', '#f6d2df', '#f2bfd2', '#fbe6ee'] });
      p.add(M.createPlanetRing(20, 26, { colors: ['#9a8f99', '#b8adb6'], opacity: 0.5, dust: false }));
      return p;
    },
    radius: 16, mu: 0.006, tilt: 97.77 * deg, spin: -0.1,
    orbit: { a: 920, e: 0.0565, i: 2.49, node: 1.984, peri: 5.924, M0: 1.2 },
    atmosphere: { color: '#ffb0cf', shell: 1.1, radius: 16.2 },
    view: { dist: 1.1 },
    children: [
      { id: 'exp', name: 'EXP_//223', section: 'Photographie · point L3', glb: 'Cube', glbScale: 1.2, lagrange: { point: 'L3', Ax: 2, Ay: 14, Az: 4, period: 120, wz: 1 }, spin: 0.06 },
      { id: 'nocturne', name: 'NOCTURNE', section: 'Musique', build: M.grandPiano, radius: 2.6, orbit: { a: 36, e: 0.0012, i: 0.3, node: 4.4, peri: 3.3, M0: 2.6 }, spin: 0.1 },
      { id: 'logex', name: 'LOG_EX', section: 'Transmission', glb: 'Cube012', glbScale: 1.3, orbit: { a: 46, e: 0.0039, i: 0.1, node: 1.2, peri: 5.0, M0: 4.4 }, spin: 0.05 },
    ],
  },
];

// Liste à plat dans l'ordre de navigation, avec les liens parent / enfants
export function flattenSystem() {
  const list = [];
  for (const p of SYSTEM) {
    list.push(p);
    p.children = p.children || [];
    for (const c of p.children) {
      c.parent = p;
      c.kind = c.kind || 'moon';
      c.color = c.color || p.color;
      list.push(c);
    }
  }
  return list;
}
