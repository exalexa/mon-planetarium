// Description du système Sys-E139 : chaque astre, son orbite, sa couleur dans l'arbre et son modèle.
// Pour ajouter un astre : ajoutez une entrée ici et un texte dans content.js (même id).
import * as M from './models.js';

// orbit : éléments képlériens. a = demi-grand axe, e = excentricité, i = inclinaison (degrés),
//         node = longitude du nœud ascendant, peri = argument du périastre, M0 = anomalie moyenne initiale (radians).
//         La période découle de la 3e loi de Kepler (T² ∝ a³ / M), voir main.js.
// mass : masse relative d'une planète (fixe la période de ses lunes)
// view : réglages de cadrage caméra (pitch = élévation en radians, dist = multiplicateur de distance)
export const SYSTEM = [
  {
    id: 'lexa', name: 'LEXA', section: 'Accueil', color: '#ffb35c', kind: 'star', glb: 'Etoile',
  },
  {
    id: 'persion', name: 'PERSION', section: 'Profil', color: '#7ec4e8', kind: 'planet', glb: 'Planète_11',
    mass: 1, glbScale: 6, orbit: { a: 150, e: 0.04, i: 1.5, node: 0.4, peri: 1.1, M0: 0.6 }, atmosphere: { color: '#7cc6ff', shell: 1.35, radius: 6 },
    view: { dist: 0.55 },
    children: [
      { id: 'sylvia', name: 'SYLVIA', section: "Centres d'intérêt", glb: 'Feuilles002', attached: true, view: { radius: 3.2, surface: true } },
      { id: 'petra', name: 'PETRA', section: 'Compétences et langues', glb: 'Roche004', glbScale: 6, orbit: { a: 30, e: 0.023, i: 5.0, node: 0.0, peri: 1.0, M0: 0.0 } },
    ],
  },
  {
    id: 'schola', name: 'SCHOLA', section: 'Formation', color: '#8fd18b', kind: 'planet',
    build: () => M.createPlanet({ radius: 10, seed: 3, amp: 0.08, colors: [0x2f5d7a, 0x4f8a4a, 0x6f9c4f, 0x9c8e64, 0xd8d0c0], trees: 70, treeColor: 0x2e5a36 }),
    radius: 10, orbit: { a: 220, e: 0.09, i: 3.0, node: 1.9, peri: 0.3, M0: 2.1 }, atmosphere: { color: '#8ee6a6', shell: 1.22, radius: 10.4 },
    children: [
      { id: 'corneille', name: 'CORNEILLE', section: 'Lycée Pierre Corneille, Rouen', landmark: M.lyceeCorneille, moon: { seed: 11, colors: [0x6b6f72, 0x8b8e8a, 0xb7b6a8] }, orbit: { a: 24, e: 0.053, i: 3.0, node: 0.3, peri: 1.2, M0: 0.2 } },
      { id: 'cluny', name: 'CLUNY', section: 'Abbaye de Cluny, Arts et Métiers', landmark: M.abbayeCluny, moon: { seed: 12, colors: [0x6c6152, 0x8e8068, 0xbfb08a] }, orbit: { a: 33, e: 0.055, i: -4.0, node: 2.5, peri: 2.4, M0: 1.5 } },
      { id: 'lutece', name: 'LUTÈCE', section: 'Arts et Métiers, Paris', landmark: M.ensamParis, moon: { seed: 13, colors: [0x5f6470, 0x7d8290, 0xaeb2b8] }, orbit: { a: 42, e: 0.071, i: 2.0, node: 4.9, peri: 3.6, M0: 2.9 } },
      { id: 'cenomane', name: 'CÉNOMANE', section: 'Le Mans Université', landmark: M.universiteLeMans, moon: { seed: 14, colors: [0x5d6a4e, 0x7c8c5c, 0x9fb07a] }, orbit: { a: 51, e: 0.054, i: -2.4, node: 0.9, peri: 4.8, M0: 4.2 } },
      { id: 'massalia', name: 'MASSALIA', section: 'Aix-Marseille Université', landmark: M.amuMarseille, moon: { seed: 15, colors: [0x8a8476, 0xb7ae98, 0xe6dfcd] }, orbit: { a: 60, e: 0.059, i: 3.6, node: 2.9, peri: 5.9, M0: 5.4 } },
    ],
  },
  {
    id: 'astra', name: 'ASTRA', section: 'Recherche', color: '#b9a2e8', kind: 'planet',
    build: () => {
      const p = M.createPlanet({ radius: 11, seed: 7, amp: 0.06, freq: 1.8, colors: [0x2a2650, 0x3d3872, 0x5a4f96, 0x7d6cb4, 0xb3a5dc] });
      const ring = M.createRing(15, 21, 0xc9b8ff);
      ring.rotation.x = 0.35;
      p.add(ring);
      return p;
    },
    radius: 11, orbit: { a: 320, e: 0.06, i: 2.2, node: 3.1, peri: 2.4, M0: 3.6 }, atmosphere: { color: '#a98cff', shell: 1.25, radius: 11.4 },
    view: { dist: 1.25 },
    children: [
      { id: 'meudon', name: 'MEUDON', section: 'Stage LIRA, Observatoire de Paris', landmark: M.observatoireMeudon, moon: { seed: 21, colors: [0x55604d, 0x6e7d5a, 0x93a172] }, orbit: { a: 30, e: 0.04, i: 4.0, node: 0.8, peri: 1.4, M0: 0.5 } },
      { id: 'omega', name: 'ω CEN', section: 'Publication', build: () => M.globularCluster(3.2), radius: 3.2, orbit: { a: 40, e: 0.071, i: -5.0, node: 3.7, peri: 3.0, M0: 2.2 }, spin: 0.05 },
      { id: 'gaia', name: 'GAIA', section: 'Données et outils', build: M.gaiaProbe, radius: 2.4, orbit: { a: 50, e: 0.075, i: 6.0, node: 0.3, peri: 4.5, M0: 3.9 }, spin: 0.35 },
      { id: 'euclid', name: 'EUCLID', section: 'Thèmes de recherche', build: M.euclidProbe, radius: 2.4, orbit: { a: 60, e: 0.023, i: -3.0, node: 2.7, peri: 5.8, M0: 5.3 }, spin: 0.08 },
    ],
  },
  {
    id: 'proxion', name: 'PROXION', section: 'Ingénierie', color: '#f0955a', kind: 'planet', glb: 'Planète_2',
    orbit: { a: 470, e: 0.11, i: 4.0, node: 4.4, peri: 5.0, M0: 5.0 }, atmosphere: { color: '#ffb27a', shell: 1.22, radius: 9 },
    view: { dist: 1.5 },
    children: [
      { id: 'simulx', name: 'SIMULX_5', section: 'Jumeau numérique', glb: 'Cube002', glbScale: 1.4, orbit: { a: 26, e: 0.07, i: 4.0, node: 0.5, peri: 1.3, M0: 0.3 }, spin: 0.05 },
      { id: 'glenos', name: 'GLÉNOS', section: "Prothèse d'épaule", build: M.glenoidImplant, radius: 2.2, orbit: { a: 35, e: 0.069, i: -4.0, node: 2.7, peri: 2.4, M0: 1.6 }, spin: 0.25 },
      { id: 'enedis', name: 'ENEDIS', section: 'Data Challenge', landmark: M.enedisPylon, moon: { seed: 31, colors: [0x4f5a52, 0x6a7a66, 0x8fa284] }, orbit: { a: 44, e: 0.067, i: 2.0, node: 4.9, peri: 3.6, M0: 2.9 } },
      { id: 'ricochet', name: 'RICOCHET', section: 'TIPE', build: () => M.ricochetMoon(2.8), radius: 2.8, view: { pitch: 0.8, dist: 1.15 }, orbit: { a: 53, e: 0.027, i: -2.0, node: 0.7, peri: 4.7, M0: 4.1 }, spin: 0.04 },
      { id: 'c4d3x', name: 'C4D3X', section: 'Code et projets personnels', glb: 'Cube013', glbScale: 1.3, orbit: { a: 62, e: 0.061, i: 5.0, node: 2.7, peri: 5.8, M0: 5.3 }, spin: 0.2 },
    ],
  },
  {
    id: 'musa', name: 'MUSA', section: 'Arts et transmission', color: '#ef8fb5', kind: 'planet',
    build: () => M.createPlanet({ radius: 9, seed: 5, amp: 0.05, freq: 2.2, colors: [0x7a3b3a, 0xb0624a, 0xd89a6a, 0xeac39a, 0xf6e2c4] }),
    radius: 9, orbit: { a: 680, e: 0.08, i: 2.6, node: 5.6, peri: 0.9, M0: 1.2 }, atmosphere: { color: '#ffa0c8', shell: 1.25, radius: 9.2 },
    children: [
      { id: 'exp', name: 'EXP_//223', section: 'Photographie', glb: 'Cube', glbScale: 1.2, orbit: { a: 24, e: 0.069, i: 4.0, node: 1.4, peri: 1.7, M0: 0.8 }, spin: 0.06 },
      { id: 'nocturne', name: 'NOCTURNE', section: 'Musique', build: M.grandPiano, radius: 2.6, orbit: { a: 34, e: 0.037, i: -4.0, node: 4.4, peri: 3.3, M0: 2.6 }, spin: 0.1 },
      { id: 'logex', name: 'LOG_EX', section: 'Transmission', glb: 'Cube012', glbScale: 1.3, orbit: { a: 44, e: 0.033, i: 2.4, node: 1.2, peri: 5.0, M0: 4.4 }, spin: 0.05 },
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
