// La vie sur les astres : habitants et animaux qui discutent, feux de camp, objets à manipuler,
// instruments pilotables. Tout est placé une fois les sols et les bâtiments en place.
import * as THREE from 'three';
import { Kit, plain } from './kit.js';
import { clunyDir, meudonMapDir } from './landmarks.js';

const UP = new THREE.Vector3(0, 1, 0);
const flat = (x, z, R = 4) => new THREE.Vector3(x, Math.sqrt(Math.max(R * R - x * x - z * z, 0.01)), z).normalize();

// ---------------------------------------------------------------------------
// Personnages et animaux (modèles en mètres, fusionnés par le kit)
// ---------------------------------------------------------------------------
// Personnages : figurine fournie (pnj.glb), déclinée en couleurs ; chapeaux et décorations ajoutés par-dessus
let PNJ = null;
const LEGO_YELLOW = 0xf2c94c;
const matCache = new Map();
const legoMat = (c) => { if (!matCache.has(c)) matCache.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.0 })); return matCache.get(c); };
function person(o = {}) {
  const g = new THREE.Group();
  const coat = o.coat ?? 0x5b6f8c, legs = o.long ? coat : (o.legs ?? 0x2f3540), skin = o.skin ?? LEGO_YELLOW;
  const c = { collide: false };
  let top = 1.75, front = 0.21;
  if (PNJ) {
    const m = PNJ.clone();
    const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
    const k = 1.75 / size.y;
    m.scale.setScalar(k);
    m.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k);
    m.traverse((p) => {
      if (!p.isMesh) return;
      const n = p.name;
      p.material = legoMat(/Head|Hand/.test(n) ? skin : /Torso|Arm/.test(n) ? coat : legs);
    });
    g.add(m);
    front = (size.z / 2) * k;
  }
  const k = new Kit();
  // Visage : yeux et sourire
  for (const sx of [-1, 1]) k.box(0.035, 0.05, 0.01, sx * 0.06, 1.55, 0.13, 0x1a1a1a, c);
  k.box(0.1, 0.018, 0.01, 0, 1.47, 0.13, 0x1a1a1a, c);
  if (o.hair !== false && !o.hat) k.box(0.3, 0.07, 0.28, 0, top - 0.04, -0.01, o.hair ?? 0x3a2a1e, c);
  if (o.hat === 'beret') k.cyl(0.19, 0.16, 0.05, 0.03, top - 0.02, 0, o.hatCol ?? 0x23262c, c);
  if (o.hat === 'cap') { k.cyl(0.16, 0.16, 0.08, 0, top - 0.04, 0, o.hatCol ?? 0x2b4c7a, c); k.box(0.2, 0.02, 0.14, 0, top - 0.04, 0.16, o.hatCol ?? 0x2b4c7a, c); }
  if (o.hat === 'helmet') k.sphere(0.19, 0, 1.6, 0, o.hatCol ?? 0xe8e8ea, { seg: 8 });
  if (o.hat === 'hood') k.box(0.34, 0.22, 0.3, 0, 1.56, -0.04, coat, c);
  // Bucque et pin's sur la biaude
  if (o.deco) for (let i = 0; i < 5; i++) k.box(0.05, 0.05, 0.01, -0.12 + i * 0.06, 1.12 - (i % 2) * 0.08, front + 0.004, [0xd8a53a, 0xb8423a, 0x3f7fb5, 0xe8e2d0, 0x4c8a4f][i], c);
  if (o.badge) k.box(0.1, 0.07, 0.01, 0.1, 1.1, front + 0.004, o.badge, c);
  k.build(g); plain(g);
  return g;
}
function animal(kind) {
  const k = new Kit(), g = new THREE.Group(), c = { collide: false };
  const quad = (L, H, W, body, head, legH, o = {}) => {
    k.box(W, H, L, 0, legH, 0, body, c);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(W * 0.24, legH, W * 0.24, sx * W * 0.32, 0, sz * L * 0.36, o.leg ?? head, c);
    k.box(W * 0.7, H * 0.75, L * 0.3, 0, legH + H * (o.neck ?? 0.6), L * 0.6, head, c);
  };
  if (kind === 'chat') { quad(0.42, 0.16, 0.15, 0x6b5b4c, 0x6b5b4c, 0.14); k.box(0.03, 0.26, 0.03, 0, 0.26, -0.22, 0x6b5b4c, c); for (const sx of [-1, 1]) k.box(0.04, 0.05, 0.03, sx * 0.04, 0.36, 0.27, 0x4a3d32, c); }
  else if (kind === 'mouton') { quad(0.9, 0.5, 0.5, 0xf0ece0, 0x3a3532, 0.32); }
  else if (kind === 'cheval') { quad(1.9, 0.62, 0.52, 0x7a4a2c, 0x7a4a2c, 0.95, { neck: 1.1 }); k.box(0.3, 0.62, 0.3, 0, 1.45, 0.82, 0x7a4a2c, c); k.box(0.07, 0.6, 0.07, 0, 0.95, -1.0, 0x2a1c14, c); k.box(0.08, 0.5, 0.4, 0, 1.75, 0.72, 0x2a1c14, c); }
  else if (kind === 'vache') { quad(1.7, 0.7, 0.62, 0xf2efe6, 0x4a3426, 0.7); k.box(0.64, 0.4, 0.5, 0, 0.95, -0.3, 0x4a3426, c); }
  else if (kind === 'biche') { quad(1.1, 0.4, 0.3, 0xb07a4a, 0xb07a4a, 0.68, { neck: 1.2 }); k.box(0.16, 0.36, 0.16, 0, 1.1, 0.5, 0xb07a4a, c); }
  else if (kind === 'sanglier') { quad(1.0, 0.5, 0.42, 0x3b322c, 0x2a2420, 0.3, { neck: 0.3 }); }
  else if (kind === 'poule') { k.sphere(0.16, 0, 0.26, 0, 0xd9813a, { seg: 6 }); k.sphere(0.08, 0, 0.44, 0.12, 0xd9813a, { seg: 6 }); k.box(0.03, 0.06, 0.02, 0, 0.5, 0.14, 0xc22e2e, c); for (const sx of [-1, 1]) k.box(0.02, 0.12, 0.02, sx * 0.05, 0, 0, 0xe0b040, c); }
  else if (kind === 'canard') { k.sphere(0.17, 0, 0.14, 0, 0x7a6a52, { seg: 6, sy: 0.7 }); k.sphere(0.08, 0, 0.33, 0.14, 0x2f6a4a, { seg: 6 }); k.box(0.05, 0.02, 0.08, 0, 0.31, 0.24, 0xe0a030, c); }
  else if (kind === 'goeland') { k.sphere(0.18, 0, 0.26, 0, 0xf4f4f0, { seg: 6, sy: 0.75 }); k.sphere(0.09, 0, 0.44, 0.15, 0xf4f4f0, { seg: 6 }); k.box(0.04, 0.03, 0.1, 0, 0.42, 0.27, 0xe8b030, c); k.box(0.3, 0.04, 0.34, 0, 0.3, -0.06, 0x8a9199, c); for (const sx of [-1, 1]) k.box(0.02, 0.14, 0.02, sx * 0.05, 0, 0, 0xe8b030, c); }
  else if (kind === 'pigeon') { k.sphere(0.12, 0, 0.16, 0, 0x7d8794, { seg: 6, sy: 0.8 }); k.sphere(0.06, 0, 0.3, 0.09, 0x56606e, { seg: 6 }); }
  else if (kind === 'chouette') { k.sphere(0.16, 0, 0.2, 0, 0x8a6f52, { seg: 6, sy: 1.2 }); k.sphere(0.13, 0, 0.42, 0.02, 0xa88a68, { seg: 6 }); for (const sx of [-1, 1]) k.box(0.05, 0.05, 0.01, sx * 0.05, 0.42, 0.13, 0xf0d060, { collide: false, glow: true }); }
  else if (kind === 'robot') { k.box(0.4, 0.4, 0.4, 0, 0.18, 0, 0xc9ced6, c); k.sphere(0.16, 0, 0.72, 0, 0xe8ecf2, { seg: 8 }); k.box(0.2, 0.05, 0.01, 0, 0.72, 0.15, 0x59e0ff, { collide: false, glow: true }); for (const sx of [-1, 1]) k.cyl(0.09, 0.09, 0.08, sx * 0.24, 0.06, 0, 0x30343a, c); }
  k.build(g); plain(g);
  return g;
}
function campfire() {
  const k = new Kit(), g = new THREE.Group(), c = { collide: false };
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; k.box(0.18, 0.14, 0.18, Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5, 0x8a8a86, c); }
  for (let i = 0; i < 3; i++) k.box(0.7, 0.1, 0.1, 0, 0.02 + i * 0.03, 0, 0x5a3a22, { collide: false, rotY: (i / 3) * Math.PI });
  // Bûches-sièges, comme autour de tout bon feu
  for (const [x, z] of [[1.4, 0.3], [-1.2, 0.9]]) k.box(0.9, 0.3, 0.32, x, 0, z, 0x6b4a30, { collide: false, rotY: Math.atan2(x, z) });
  k.build(g); plain(g);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.8, 6), new THREE.MeshBasicMaterial({ color: 0xff9a3c }));
  flame.position.y = 0.5; flame.userData.noToon = true;
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 6), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
  core.position.y = 0.42; core.userData.noToon = true;
  g.add(flame, core);
  g.userData.flame = [flame, core];
  return g;
}
function signpost(color = 0xd8a53a) {
  const k = new Kit(), g = new THREE.Group(), c = { collide: false };
  k.box(0.08, 1.5, 0.08, 0, 0, 0, 0x5a3a22, c);
  k.box(0.8, 0.3, 0.05, 0.2, 1.15, 0, color, c);
  k.build(g); plain(g);
  return g;
}

// ---------------------------------------------------------------------------
// Qui vit où, et ce qui s'y dit
// ---------------------------------------------------------------------------
const GADZ = { coat: 0x8c9096, long: true, deco: true };
const MARSH = [
  'Le chamallow dore doucement.', 'Parfaitement grillé. Un délice.', 'Trop près du feu : carbonisé. Tant pis, on le mange quand même.',
  'Il prend feu. Vous soufflez dessus, l’air de rien.', 'Doré dehors, fondant dedans.',
];
const LIFE = {
  cluny: {
    at: (x, z) => clunyDir(x, z),
    groups: [
      { at: [2, 4], who: [{ name: 'Ancien', ...GADZ, hat: 'beret' }, { name: 'Conscrit', ...GADZ, deco: false, seed: 1 }], lines: [
        [0, 'Conscrit ! Ta biaude est encore toute grise. Il va falloir la décorer avant le Baptême.'],
        [1, 'Oui, l’Ancien. Ma fam’s m’aide à broder ma bucque dans le dos.'],
        [0, 'Bien. Et les chants ? L’hymne des Gadz’Arts, tu le connais par cœur ?'],
        [1, 'Par cœur. On l’a répété tout l’usinage, dans le cloître, à la nuit tombée.'],
        [0, 'Alors tu sais l’essentiel : ici on entre seul, on ressort en promo. Fraternité.'],
      ] },
      { at: [120, -40], who: [{ name: 'Gadz’Arts', ...GADZ, seed: 2 }, { name: 'Chef d’atel’s', coat: 0x2f4f7a, hat: 'cap', seed: 3 }], lines: [
        [0, 'Aux atel’s, le tour ne pardonne rien : un dixième de trop et la pièce part au rebut.'],
        [1, 'Fonderie, forge, usinage… Depuis 1901 on apprend ici le métier avec les mains autant qu’avec la tête.'],
        [0, 'Et le soir, zaloeil aux KIN, puis on file en salle d’étude. Enfin, en théorie.'],
        [1, 'En théorie. Range ta zagette et remets tes lunettes de protection.'],
      ] },
      { at: [-50, -86], who: [{ name: 'Guide', coat: 0x7a5a3c, seed: 1 }, { name: 'Visiteuse', coat: 0xb5524a, seed: 3 }], lines: [
        [0, 'Vous marchez dans la nef de Cluny III, la Maior Ecclesia : 187 mètres de long.'],
        [1, 'Et il n’en reste que ça ?'],
        [0, 'Après la Révolution, elle a servi de carrière de pierres. Seuls le bras sud du transept et le clocher de l’Eau-Bénite sont debout.'],
        [1, 'La plus grande église de la chrétienté, jusqu’à Saint-Pierre de Rome… vendue au mètre cube.'],
      ] },
      { at: [-64, -30], who: [{ name: 'Clunisoise', coat: 0x6f8a5a, seed: 2 }, { name: 'Vigneron', coat: 0x7a3a4a, hat: 'beret', seed: 0 }], lines: [
        [0, 'Montez à la tour des Fromages : de là-haut, on voit la zapointe, les atel’s et la zaronde. On y faisait sécher les fromages, paraît-il.'],
        [1, 'Et de mes vignes, on voit la tour. Chardonnay du Mâconnais, vendangé à la main.'],
        [0, 'Les Gadz’Arts défilent encore en ville cette semaine ?'],
        [1, 'Un monôme en biaude jusqu’à la place de l’Abbaye. On les entend chanter depuis les coteaux.'],
      ] },
    ],
    animals: [['cheval', [205, -226], 'Un cheval du Haras national. Il renifle votre poche, au cas où.'], ['cheval', [222, -224], 'Il s’ébroue. Le haras est installé ici depuis Napoléon.'],
      ['chat', [116, 66], 'Le chat de l’abbaye dort sous le tilleul d’Abélard.'], ['mouton', [330, 240], 'Bêêê.'], ['vache', [470, -330], 'Une charolaise, placide, vous regarde passer.']],
    fire: [160, 72],
    props: [
      { at: [9, -30], label: 'sonner la cloche de la tour de l’Horloge', say: ['Dong… Dong… La cloche résonne sur toute la vallée de la Grosne.', 'Dong ! Quelque part, un conscrit se réveille en sursaut.'] },
      { at: [-1.5, 2], label: 'boire au bassin du cloître', say: ['L’eau est glacée. Les moines s’y lavaient avant d’entrer au réfectoire.'] },
      { at: [-62, -50], sign: true, label: 'lire la plaque', say: ['« Arts et Métiers — Campus de Cluny. École installée dans l’abbaye depuis 1901. »', '« Cluny, 910. Fondée par Guillaume le Pieux, duc d’Aquitaine. »'] },
    ],
  },
  meudon: {
    at: (x, z) => meudonMapDir(x, z),
    groups: [
      { at: [404, 562], who: [{ name: 'Astronome', coat: 0x3b4a66, seed: 1 }, { name: 'Doctorante', coat: 0x8a5a7a, seed: 3 }], lines: [
        [0, 'Ciel dégagé cette nuit. La Grande Lunette pointe ω Centauri : dix millions d’étoiles dans un seul amas.'],
        [1, 'Avec Gaia, on a leurs mouvements propres. Certaines filent trop vite pour l’amas : il y a quelque chose de massif au centre.'],
        [0, 'Un trou noir de masse intermédiaire ? Montre-moi tes courbes de dispersion de vitesses.'],
        [1, 'Dès que le code a fini de tourner. Et que le RER C m’a ramenée au labo.'],
      ] },
      { at: [262, 300], who: [{ name: 'Physicien solaire', coat: 0xc9a23a, hat: 'cap', seed: 0 }, { name: 'Technicienne', coat: 0x4f6f5a, seed: 2 }], lines: [
        [0, 'La tour solaire fait 36 mètres. Le cœlostat, tout en haut, renvoie la lumière du Soleil jusqu’au spectrographe, au sous-sol.'],
        [1, 'Et le spectrohéliographe photographie la chromosphère tous les jours depuis 1908. La plus longue série du monde.'],
        [0, 'Regarde les protubérances aujourd’hui. Une belle éjection de masse coronale se prépare.'],
        [1, 'Je préviens les opérateurs de satellites. Et je monte régler le laser.'],
      ] },
      { at: [0.9, 2.42, 'flat'], who: [{ name: 'Voyageur', coat: 0x5a5a66, seed: 3 }, { name: 'Voyageuse', coat: 0x9a4a3a, seed: 1 }], lines: [
        [0, '« Trafic perturbé sur la ligne C. » Comme tous les matins.'],
        [1, 'Montez plutôt à pied par la terrasse. D’en haut, on voit tout Paris.'],
        [0, 'C’est Le Nôtre qui a dessiné ces jardins. Et Janssen qui a posé un observatoire dans les ruines du château, en 1876.'],
      ] },
    ],
    animals: [['biche', [560, 250], 'Une biche de la forêt de Meudon. Elle vous observe, immobile, puis reprend sa route.'], ['sanglier', [150, 300], 'Un sanglier fouille les feuilles mortes.'],
      ['canard', [612, 478], 'Coin. L’étang de Bel-Air est à lui.'], ['canard', [628, 486], 'Coin coin.'], ['chouette', [470, 420], 'Une chouette hulotte. Elle aussi travaille de nuit.'], ['chat', [330, 520], 'Le chat de l’observatoire. Il connaît toutes les coupoles.']],
    fire: [520, 420],
    scopes: [
      { at: [292, 456], h: 0.56, name: 'Table équatoriale ouest' }, { at: [346, 474], h: 0.56, name: 'Table équatoriale' },
      { at: [394, 451], h: 0.56, name: 'Télescope de 1 mètre' }, { at: [485, 506], h: 0.56, name: 'Coupole du laser', laser: true },
      { at: [219, 298], h: 1.72, r: 30, name: 'Tour solaire · cœlostat', sun: true },
    ],
    props: [
      { at: [232, 306], panel: 'soleil', label: 'consulter les écrans du laboratoire solaire' },
      { at: [470, 540], label: 'écouter l’interféromètre', say: ['Dans le casque : le souffle du Soleil à 169 MHz, et un sursaut radio de type III qui dévale les fréquences.', 'Friture, puis un long sifflement descendant. Des électrons quittent la couronne.'] },
      { at: [540, 462], label: 'orienter l’antenne', say: ['L’antenne pivote vers ASTRA. Sur l’écran, une raie à 21 cm : de l’hydrogène neutre.', 'Signal périodique, 1,337 s. Un pulsar… ou le micro-ondes du labo.'] },
      { at: [300, 664], label: 'regarder le bassin', say: ['Le ciel se reflète dans le bassin. Par temps clair, on y devine la Grande Coupole à l’envers.'] },
    ],
  },
  corneille: {
    groups: [
      { at: [0.2, 0.2], who: [{ name: 'Taupin', coat: 0x39507a, seed: 0 }, { name: 'Khôlleuse', coat: 0x7a3d4f, seed: 3 }], lines: [
        [0, 'Khôlle de maths à 18 h, DS de physique samedi matin. Je ne vois plus le jour.'],
        [1, 'Ici sont passés Corneille, Flaubert, Maupassant. Ils ont survécu, vous survivrez.'],
        [0, 'Corneille n’avait pas d’intégrales à paramètre.'],
        [1, '« À vaincre sans péril, on triomphe sans gloire. » Au tableau.'],
      ] },
      { at: [-0.5, 1.35], who: [{ name: 'Rouennaise', coat: 0x4f7a6a, seed: 2 }, { name: 'Marinier', coat: 0x2f4a66, hat: 'cap', seed: 1 }], lines: [
        [0, 'La chapelle du lycée, c’est l’ancienne chapelle des Jésuites. Dix-septième siècle.'],
        [1, 'Et en bas coule la Seine. De l’Armada aux péniches, tout passe par Rouen.'],
        [0, 'La ville aux cent clochers. Enfin, quand il ne pleut pas.'],
        [1, 'Il pleut.'],
      ] },
    ],
    animals: [['goeland', [1.5, 0.9], 'Un goéland remonté de l’estuaire. Il lorgne votre sandwich.'], ['chat', [-0.4, 0.45], 'Le chat de la cour d’honneur, mascotte officieuse des internes.'], ['pigeon', [0.6, 1.3], 'Rou-rou.']],
    fire: [1.75, 1.3],
    props: [{ at: [0, 1.25], sign: true, label: 'lire la plaque', say: ['« Lycée Pierre-Corneille. Collège des Jésuites fondé en 1593. »', '« Ici étudièrent Pierre Corneille, Gustave Flaubert, Guy de Maupassant, Marcel Duchamp. »'] }],
  },
  lutece: {
    groups: [
      { at: [0.1, 0.45], who: [{ name: 'Gadz’Arts de Pa', ...GADZ, seed: 0 }, { name: 'Chercheuse', coat: 0xe8e8ea, seed: 2 }], lines: [
        [0, 'Boulevard de l’Hôpital, treizième arrondissement. Après Cluny, ça change de la vallée de la Grosne.'],
        [1, 'Ici c’est la dernière année : simulation numérique, mécanique, matériaux, et le projet d’expertise.'],
        [0, 'Et la biaude reste au placard ?'],
        [1, 'Jamais très loin. Regarde la cour un soir de Gala.'],
      ] },
    ],
    animals: [['pigeon', [0.5, 0.3], 'Un pigeon parisien. Il ne vous cède pas le passage.'], ['pigeon', [0.6, 0.38], 'Rou.'], ['chat', [-0.6, 1.3], 'Un chat de gouttière, descendu des toits de la Salpêtrière.']],
    fire: [-1.5, 1.5],
    props: [{ at: [0, 1.35], sign: true, label: 'lire la plaque', say: ['« École nationale supérieure d’Arts et Métiers — 151, boulevard de l’Hôpital. »'] }],
  },
  cenomane: {
    groups: [
      { at: [0.5, 0.4], who: [{ name: 'Acousticien', coat: 0x4a6a8a, seed: 1 }, { name: 'Étudiante', coat: 0xb5683a, seed: 0 }], lines: [
        [0, 'Dans la chambre anechoïque du labo, on entend son propre cœur. Certains ressortent au bout de deux minutes.'],
        [1, 'Le Mans, capitale de l’acoustique. Et des rillettes.'],
        [0, 'Et d’une petite course de voitures, en juin.'],
        [1, 'Vingt-quatre heures de bruit de fond. Un beau sujet de TP.'],
      ] },
      { at: [-0.85, 1.0], who: [{ name: 'Pilote', coat: 0xc23a2e, hat: 'helmet', seed: 2 }, { name: 'Mécano', coat: 0x30343a, hat: 'cap', seed: 3 }], lines: [
        [0, 'Les Hunaudières à 340 km/h, de nuit, sous la pluie. On ne voit que les catadioptres.'],
        [1, 'Rentre au stand dans deux tours. Les plaquettes sont mortes.'],
        [0, 'Sous la passerelle Dunlop, je lève à peine le pied.'],
        [1, 'C’est bien ce que je te reproche.'],
      ] },
    ],
    animals: [['poule', [0.9, 0.9], 'Une poule de Loué, en liberté, évidemment.'], ['poule', [1.0, 0.82], 'Cot cot.'], ['vache', [-1.5, -0.9], 'Elle rumine en regardant passer les prototypes.'], ['chat', [-0.3, 0.9], 'Le chat de la bibliothèque universitaire.']],
    fire: [1.3, 1.3],
    props: [{ at: [0.15, -1.4], label: 'agiter le drapeau à damier', say: ['Le drapeau à damier claque au vent. Vingt-quatre heures, pas une minute de moins.', 'Départ lancé ! Enfin, pour vous, à pied.'] }],
  },
  massalia: {
    groups: [
      { at: [-0.3, 1.2], who: [{ name: 'Marius', coat: 0x4a8ab5, hat: 'cap', hatCol: 0xe8e8ea, seed: 1 }, { name: 'Fanny', coat: 0xd9a03a, seed: 0 }], lines: [
        [0, 'Tu tires ou tu pointes ? Avec ce mistral, la boule dévie de vingt centimètres.'],
        [1, 'C’est de la mécanique des fluides, ça. Demande aux étudiants de la fac, ils te calculeront la traînée.'],
        [0, 'Eux, ils regardent les étoiles depuis les calanques. Astrophysique, ils disent.'],
        [1, 'Vé, la Bonne Mère veille sur tout le monde. Même sur les boules mal tirées.'],
      ] },
      { at: [-0.85, 1.2], who: [{ name: 'Étudiante', coat: 0x6a5a9a, seed: 3 }, { name: 'Professeur', coat: 0x5a6a5a, seed: 2 }], lines: [
        [0, 'Master de physique : relativité générale le matin, cosmologie l’après-midi.'],
        [1, 'Et le soir, le LAM pointe ses instruments vers les galaxies lointaines. Euclid, c’est un peu d’ici.'],
        [0, 'Entre deux cours, je descends voir la mer.'],
        [1, 'La meilleure salle de TD de Marseille.'],
      ] },
    ],
    animals: [['goeland', [0.3, 1.5], 'Un gabian. Il a déjà repéré votre panisse.'], ['goeland', [0.9, 0.9], 'Il rit. Vraiment.'], ['chat', [-1.2, 0.2], 'Un chat du Panier, étalé au soleil.']],
    fire: [1.5, 1.2],
    props: [{ at: [0.4, 0.35], label: 'allumer un cierge à la Bonne Mère', say: ['Le cierge brûle. D’ici, on voit le Frioul, le château d’If et tout le Vieux-Port.', 'Un ex-voto de marin remercie pour une tempête traversée.'] }],
  },
};
// Voyageurs croisés sur les autres astres : une phrase sur ce qu'on y trouve
const WANDER = {
  schola: ['Voyageuse', 'Cinq lunes, cinq écoles. De Rouen à Marseille, chaque étape a laissé une trace ici.', 'Posez-vous sur chacune : on y entre dans les bâtiments.'],
  persion: ['Pêcheur', 'On dit qu’une forêt pousse au milieu de l’océan. SYLVIA. Allez voir.', 'PETRA, là-haut, garde les compétences gravées dans la roche.'],
  proxion: ['Ingénieure', 'Tout ici est né d’un cahier des charges : une prothèse, un jumeau numérique, un réseau électrique.', 'RICOCHET ? Des galets, de la physique, et beaucoup d’essais ratés.'],
  astra: ['Astronome errant', 'Depuis MEUDON, on observe ω Centauri. Montez à la Grande Coupole et regardez dans la lunette.', 'GAIA et EUCLID veillent au point L2. Ils ne dorment jamais.'],
  musa: ['Musicienne', 'Écoutez : NOCTURNE joue encore. Il y a un piano sur la scène.', 'La photographie attend au point L3, toujours cachée derrière la planète.'],
  station: ['Cheffe de station', 'Bienvenue à bord de la station E139. Quartiers au sud, atelier au nord, labo à l’est, baie d’amarrage à l’ouest.', 'La coupole du moyeu donne sur PERSION. On y monte par l’escalier central.', 'La serre produit nos tomates. Ne touchez pas aux tomates.'],
  ceres: ['Prospecteur', 'Rien que de la glace et du silence. Parfait pour réfléchir.'],
  glenos: ['Chirurgien', 'Une épaule, c’est une sphère dans une cavité trop petite. Tout l’art est de la faire tenir.'],
  enedis: ['Technicien réseau', 'Prédire la consommation d’un quartier à partir des courbes de charge : un vrai casse-tête.'],
  nocturne: ['Accordeur', 'Le la est à 442 Hz ce soir. La scène est à vous.'],
  ricochet: ['Lanceur de galets', 'Angle magique : vingt degrés. Mon record est de trente-huit rebonds.'],
  pluton: ['Exilée', 'Planète naine, et alors ? Le cœur de glace est toujours là.'],
  charon: ['Passeur', 'Je fais la navette avec Pluton. Nous nous regardons toujours en face.'],
  eris: ['Ermite', 'Si loin que le Soleil n’est qu’une étoile parmi d’autres.'],
  haumea: ['Patineuse', 'Un jour dure quatre heures ici. On a le tournis.'],
  makemake: ['Sculpteur', 'Rouge de tholins. On dirait une terre cuite oubliée au froid.'],
  petra: ['Graveur', 'Chaque compétence est taillée dans la pierre. Certaines sont encore en cours.'],
  sylvia: ['Botaniste', 'Les centres d’intérêt poussent mieux à l’ombre des grands arbres.'],
};

// ---------------------------------------------------------------------------
// Écrans du laboratoire solaire (tour solaire de Meudon) : le Soleil en direct
// Sources réunies par la page « Le Soleil en direct » d'astrosurf (jiaifer)
// ---------------------------------------------------------------------------
const SOLAR_LIVE = [
  ['SDO · AIA 304 Å', 'Chromosphère et protubérances (hélium ionisé, ≈ 50 000 K)', 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_512_0304.jpg'],
  ['SDO · AIA 171 Å', 'Couronne calme : boucles magnétiques (fer, ≈ 600 000 K)', 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_512_0171.jpg'],
  ['SDO · AIA 193 Å', 'Couronne et trous coronaux (≈ 1,2 MK)', 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_512_0193.jpg'],
  ['SDO · HMI continuum', 'Photosphère : taches solaires', 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_512_HMIIC.jpg'],
  ['SDO · HMI magnétogramme', 'Polarité du champ magnétique en surface', 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_512_HMIB.jpg'],
  ['SOHO · LASCO C2', 'Coronographe : éjections de masse coronale (2 à 6 R☉)', 'https://soho.nascom.nasa.gov/data/realtime/c2/512/latest.jpg'],
  ['SOHO · LASCO C3', 'Coronographe large champ (jusqu\u2019à 30 R☉)', 'https://soho.nascom.nasa.gov/data/realtime/c3/512/latest.jpg'],
];
const SOLAR_LINKS = [
  ['BASS2000 — Observatoire de Paris, Meudon', 'https://bass2000.obspm.fr/home.php?lang=fr'],
  ['CLIMSO — Pic du Midi', 'https://climso.fr/'],
  ['GONG — réseau Hα', 'https://gong2.nso.edu/products/tableView/table.php?configFile=configs/hAlpha.cfg'],
  ['SDO — Le Soleil aujourd\u2019hui', 'https://sdowww.lmsal.com/suntoday/'],
  ['SILSO — nombre de taches', 'https://www.sidc.be/silso/ssngraphics'],
  ['Solarmonitor — régions actives', 'https://www.solarmonitor.org/'],
  ['SpaceWeatherLive — activité solaire', 'https://www.spaceweatherlive.com/fr/activite-solaire'],
  ['NOAA SWPC — alertes', 'https://www.swpc.noaa.gov/'],
  ['JHelioviewer', 'https://www.jhelioviewer.org/'],
  ['Source : « Le Soleil en direct » (astrosurf)', 'https://www.astrosurf.com/jiaifer/pagesoleilendirect.htm'],
];
let solarEl = null;
export function solarOpen() { return !!solarEl?.classList.contains('on'); }
export function closeSolar() { solarEl?.classList.remove('on'); }
function openSolar() {
  if (!solarEl) {
    solarEl = document.createElement('div');
    solarEl.id = 'solar-lab';
    const stamp = Math.floor(Date.now() / 600000);
    solarEl.innerHTML = `<div class="sl-head"><b>Tour solaire de Meudon · Laboratoire</b><span>Le Soleil en direct · E ou Échap pour fermer</span><button type="button" aria-label="Fermer">×</button></div>
      <div class="sl-grid">${SOLAR_LIVE.map(([t, d, u]) => `<figure><img loading="lazy" alt="${t}" src="${u}?t=${stamp}" onerror="this.closest('figure').classList.add('ko')"><figcaption><b>${t}</b>${d}</figcaption></figure>`).join('')}</div>
      <div class="sl-links">${SOLAR_LINKS.map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`).join('')}</div>
      <p class="sl-note">Depuis 1908, le spectrohéliographe de Meudon photographie la chromosphère presque chaque jour : l'une des plus longues séries d'observations solaires au monde, archivée dans BASS2000.</p>`;
    solarEl.querySelector('button').addEventListener('click', closeSolar);
    const st = document.createElement('style');
    st.textContent = `#solar-lab{position:fixed;inset:6vh 6vw;z-index:80;display:none;flex-direction:column;gap:12px;padding:16px 18px;border-radius:14px;overflow:auto;
      background:rgba(14,10,8,.92);border:1px solid rgba(255,140,60,.5);color:#f6e7d6;font:500 13px/1.4 'Space Grotesk',system-ui,sans-serif;box-shadow:0 0 60px rgba(255,90,20,.25)}
      #solar-lab.on{display:flex}#solar-lab .sl-head{display:flex;align-items:baseline;gap:14px}#solar-lab .sl-head b{font-size:17px;color:#ffb35c}#solar-lab .sl-head span{opacity:.7;flex:1}
      #solar-lab .sl-head button{background:none;border:1px solid rgba(255,179,92,.5);color:#ffb35c;border-radius:8px;width:30px;height:30px;font-size:18px;cursor:pointer}
      #solar-lab .sl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}
      #solar-lab figure{margin:0;background:#000;border-radius:10px;overflow:hidden;border:1px solid rgba(255,140,60,.25)}
      #solar-lab img{display:block;width:100%;aspect-ratio:1;object-fit:cover;background:radial-gradient(circle,#3a1608,#000 70%)}
      #solar-lab figure.ko img{opacity:.15}#solar-lab figure.ko figcaption::after{content:' — image indisponible ici';color:#ff8a6a}
      #solar-lab figcaption{padding:7px 9px;font-size:12px;opacity:.9}#solar-lab figcaption b{display:block;color:#ffcf8a;font-size:12px}
      #solar-lab .sl-links{display:flex;flex-wrap:wrap;gap:8px}#solar-lab .sl-links a{color:#ffd9a8;text-decoration:none;border:1px solid rgba(255,179,92,.35);border-radius:999px;padding:4px 10px;font-size:12px}
      #solar-lab .sl-links a:hover{background:rgba(255,140,60,.15)}#solar-lab .sl-note{margin:0;opacity:.75;font-size:12px}`;
    document.head.appendChild(st);
    document.body.appendChild(solarEl);
  }
  if (document.pointerLockElement) document.exitPointerLock?.();
  solarEl.classList.add('on');
}

export function setupLife({ BODIES, toonify, pnj = null }) {
  PNJ = pnj;
  let seed = 9871;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const q = {}, wq = {};
  const fires = [], movers = [], lasers = [];
  // Point au sol dans la direction d (repère de l'astre)
  const ground = (b, d) => {
    const W = b.walk; W.sampler.query(d, q);
    return q.r > 0 ? W.center.clone().addScaledVector(d, q.r) : null;
  };
  const dry = (b, d) => {
    const W = b.walk; W.sampler.query(d, q);
    if (!(q.r > 0)) return false;
    if (W.water) { W.water.query(d, wq); if (wq.r > q.r) return false; }
    const p = W.center.clone().addScaledVector(d, q.r);
    for (const g of W.groups) if (g.center.distanceTo(p) < g.radius + 2 * W.m2u) return false;
    return true;
  };
  const randDir = (b) => {
    for (let i = 0; i < 60; i++) {
      const d = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
      if (dry(b, d)) return d;
    }
    return null;
  };
  // Pose un objet (en mètres) au sol, debout, tourné de yaw
  const place = (b, obj, d, yaw = 0, dx = 0) => {
    const W = b.walk;
    if (dx) {
      const t = new THREE.Vector3().crossVectors(UP, d); if (t.lengthSq() < 1e-4) t.set(1, 0, 0);
      d = d.clone().addScaledVector(t.normalize(), (dx * W.m2u) / W.R).normalize();
    }
    const p = ground(b, d); if (!p) return null;
    obj.position.copy(p);
    obj.quaternion.setFromUnitVectors(UP, d).multiply(new THREE.Quaternion().setFromAxisAngle(UP, yaw));
    obj.scale.setScalar(W.m2u);
    obj.userData.base = { p: p.clone(), d: d.clone(), yaw };
    obj.name = 'life';
    toonify(obj);
    b.obj.add(obj);
    return p;
  };
  const add = (b, it) => { (b.walk.interact || (b.walk.interact = [])).push(it); return it; };

  for (const b of BODIES) {
    if (!b.walk || !b.obj) continue;
    const W = b.walk, def = LIFE[b.id];
    if (!W.R) W.R = 4;
    const at = (a) => (a[2] === 'flat' || !def?.at ? flat(a[0], a[1]) : def.at(a[0], a[1]));
    const convs = (b.walk.convs = []);
    if (def) {
      for (const g of def.groups || []) {
        const d = at(g.at);
        const actors = g.who.map((o, i) => {
          const n = person({ ...o });
          const p = place(b, n, d, i ? -Math.PI / 2 : Math.PI / 2, i ? 0.75 : -0.75);
          if (p) movers.push({ b, obj: n, face: true, phase: rnd() * 6 });
          return p ? { name: o.name, obj: n, p } : null;
        }).filter(Boolean);
        if (!actors.length) continue;
        const c = actors[0].p.clone().lerp(actors[actors.length - 1].p, 0.5);
        const conv = { p: c, actors, lines: g.lines.filter(([i]) => actors[i]), i: -1, t: 0 };
        convs.push(conv);
        add(b, { p: c, r: 4, kind: 'talk', label: `parler à ${actors[0].name}`, conv });
      }
      for (const pr of def.props || []) {
        const d = at(pr.at);
        let p;
        if (pr.sign) p = place(b, signpost(), d, 0, 1.2);
        else p = ground(b, d);
        if (p && pr.panel) add(b, { p, r: 6, kind: 'panel', label: pr.label, panel: pr.panel });
        else if (p) add(b, { p, r: pr.sign ? 3 : 5, kind: 'say', label: pr.label, say: pr.say });
      }
      for (const sc of def.scopes || []) {
        const d = at(sc.at), p = ground(b, d);
        if (!p) continue;
        const it = add(b, { p: sc.r ? p.clone().addScaledVector(d, 1.62) : p, r: sc.r ? 5 : 7, kind: 'scope', label: sc.sun ? 'observer le Soleil au cœlostat' : `piloter : ${sc.name}`, name: sc.name, sun: !!sc.sun, eye: p.clone().addScaledVector(d, sc.h), up: d.clone() });
        if (sc.laser) {
          // Laser vert (étoile guide) tiré de temps en temps vers le ciel
          const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0x4dff6a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
          beam.geometry.translate(0, 0.5, 0);
          const halo = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0x35d455, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
          halo.geometry.translate(0, 0.5, 0);
          const L = new THREE.Group(); L.add(beam, halo);
          L.position.copy(it.eye); L.scale.set(1, 90, 1); L.visible = false;
          L.userData.noToon = true; L.name = 'laser';
          b.obj.add(L);
          const las = { b, obj: L, on: 0, manual: 0 };
          lasers.push(las);
          add(b, { p: p.clone().addScaledVector(new THREE.Vector3().crossVectors(d, UP).normalize(), 0.3), r: 4, kind: 'laser', label: 'tirer le laser vert', las });
        }
      }
    } else if (WANDER[b.id]) {
      const [name, ...lines] = WANDER[b.id];
      const d = randDir(b);
      if (d) {
        const n = person({ coat: 0x7a5a3c, hat: 'hood', seed: b.id.length });
        const p = place(b, n, d, rnd() * 6);
        if (p) {
          movers.push({ b, obj: n, face: true, phase: rnd() * 6 });
          const conv = { p, actors: [{ name, obj: n, p }], lines: lines.map((l) => [0, l]), i: -1, t: 0 };
          convs.push(conv);
          add(b, { p, r: 4, kind: 'talk', label: `parler : ${name}`, conv });
        }
      }
      // (pas de sonde : allègement)
    }
    // Un feu de camp par astre, et de quoi griller un chamallow
    const fd = def?.fire ? at(def.fire) : randDir(b);
    if (fd) {
      const f = campfire();
      const p = place(b, f, fd);
      if (p) { fires.push(f); add(b, { p, r: 3.5, kind: 'say', label: 'griller un chamallow', say: MARSH, random: true }); }
    }
  }

  // ---- Boîte de dialogue ----
  const box = document.createElement('div');
  box.id = 'dialog';
  box.innerHTML = '<b></b><span></span>';
  document.body.appendChild(box);
  const style = document.createElement('style');
  style.textContent = `#dialog{position:fixed;left:50%;bottom:16vh;transform:translateX(-50%) translateY(8px);max-width:min(620px,86vw);padding:12px 18px;border-radius:12px;
    background:rgba(16,14,20,.82);border:1px solid rgba(255,179,92,.45);color:#f3e9d8;font:500 15px/1.45 'Space Grotesk',system-ui,sans-serif;
    opacity:0;pointer-events:none;transition:opacity .25s,transform .25s;z-index:30;backdrop-filter:blur(6px)}
    #dialog.on{opacity:1;transform:translateX(-50%)}#dialog b{display:block;font:600 11px/1 'Space Mono',monospace;letter-spacing:.12em;text-transform:uppercase;color:#ffb35c;margin-bottom:6px}`;
  document.head.appendChild(style);
  let boxT = 0, active = null;
  const show = (name, text, hold = 5) => { box.firstChild.textContent = name; box.lastChild.textContent = text; box.classList.add('on'); boxT = hold; };
  const nextLine = (conv) => {
    conv.i = (conv.i + 1) % conv.lines.length;
    const [who, text] = conv.lines[conv.i];
    conv.speaker = conv.actors[who];
    conv.t = 2.2 + text.length * 0.055;
    show(conv.speaker.name, text, conv.t + 0.5);
  };
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmp3 = new THREE.Vector3(), qy = new THREE.Quaternion();

  return {
    // Élément manipulable le plus proche du marcheur
    nearest(w) {
      const W = w.body.walk; let best = null, bd = Infinity;
      for (const it of W.interact || []) {
        const p = it.follow ? it.follow.position : it.p;
        const d = p.distanceTo(w.p) / W.m2u;
        if (d < it.r && d < bd) { bd = d; best = it; }
      }
      return best;
    },
    use(it) {
      if (it.kind === 'talk') { active = it.conv; nextLine(it.conv); }
      else if (it.kind === 'say') { it.n = it.random ? Math.floor(Math.random() * it.say.length) : ((it.n ?? -1) + 1) % it.say.length; show('', it.say[it.n], 5.5); }
      else if (it.kind === 'panel') openSolar();
      else if (it.kind === 'laser') { it.las.manual = it.las.manual > 0 ? 0 : 20; show('', it.las.manual ? 'Le faisceau vert monte droit vers le ciel : une étoile artificielle s’allume dans la haute atmosphère.' : 'Laser coupé.', 5); }
    },
    update(dt, t, w) {
      for (const f of fires) { const s = 0.85 + 0.25 * Math.sin(t * 11 + f.id) + 0.12 * Math.sin(t * 23); f.userData.flame[0].scale.set(s, 0.8 + 0.4 * Math.abs(Math.sin(t * 7 + f.id)), s); f.userData.flame[1].scale.y = 0.8 + 0.3 * Math.sin(t * 15); }
      for (const l of lasers) {
        l.manual = Math.max(0, l.manual - dt);
        // Tir automatique : une quinzaine de secondes toutes les minutes environ
        const auto = (t % 64) < 14;
        const on = auto || l.manual > 0;
        l.obj.visible = on;
        if (on) l.obj.children[0].material.opacity = 0.75 + 0.2 * Math.sin(t * 40);
      }
      if (boxT > 0) { boxT -= dt; if (boxT <= 0) box.classList.remove('on'); }
      if (!w) { active = null; return; }
      const b = w.body, W = b.walk;
      for (const m of movers) {
        if (m.b !== b) continue;
        const o = m.obj, B = o.userData.base;
        const near = o.position.distanceTo(w.p) / W.m2u;
        if (near > 60) continue;
        if (m.wander) {
          // Petite ronde autour du point de départ
          const a = t * 0.25 + m.phase, r = m.wander * W.m2u;
          tmp.crossVectors(B.d, Math.abs(B.d.y) < 0.9 ? UP : tmp2.set(1, 0, 0)).normalize(); tmp2.crossVectors(B.d, tmp);
          o.position.copy(B.p).addScaledVector(tmp, Math.cos(a) * r).addScaledVector(tmp2, Math.sin(a) * r);
          if (m.hop) o.position.addScaledVector(B.d, Math.abs(Math.sin(t * 6 + m.phase)) * 0.08 * W.m2u);
          // Cap : tangente au cercle parcouru
          const dirW = tmp.clone().multiplyScalar(-Math.sin(a)).addScaledVector(tmp2, Math.cos(a)).normalize();
          o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(B.d, dirW).normalize(), B.d, dirW));
        } else if (m.face && near < 12) {
          // Les habitants se tournent vers le visiteur
          tmp.copy(w.p).sub(o.position); tmp.addScaledVector(B.d, -tmp.dot(B.d));
          if (tmp.lengthSq() > 1e-10) {
            tmp.normalize();
            const m4 = new THREE.Matrix4().makeBasis(tmp3.crossVectors(B.d, tmp).normalize(), B.d, tmp);
            qy.setFromRotationMatrix(m4);
            o.quaternion.slerp(qy, Math.min(1, dt * 3));
          }
        }
      }
      // Conversations : elles s'engagent d'elles-mêmes quand on s'approche
      let closest = null, cd = 10;
      for (const c of W.convs || []) { const d = c.p.distanceTo(w.p) / W.m2u; if (d < cd) { cd = d; closest = c; } }
      if (closest !== active) { active = closest; if (active) { active.t = 0.6; } else if (boxT > 1) boxT = 1; }
      if (active) {
        active.t -= dt;
        if (active.t <= 0) nextLine(active);
        // Celui qui parle hoche la tête
        for (const a of active.actors) a.obj.position.copy(a.obj.userData.base.p).addScaledVector(a.obj.userData.base.d, a === active.speaker ? Math.abs(Math.sin(t * 9)) * 0.03 * W.m2u : 0);
      }
    },
  };
}
