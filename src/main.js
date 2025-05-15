import './style.css'

import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Scene
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('#bg'),
});

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.set(400,400,200)

renderer.render(scene, camera);

// Geometry
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'; 
let mixer; // Pour les animations
const clock = new THREE.Clock();

// Références des astres
const astres = [];
const satellites = {};
let currentAstreIndex = 0;
let currentSatelliteIndex = 0; // Commence sur la planète elle-même

// --- Correction portée éruptions solaires ---
let etoileRef = null;
let etoileRadius = 80;
let minOrbitRadius = 100; // sera corrigé dynamiquement

// --- NOMS DES ASTRES (planètes et satellites) ---
const astroDisplayNames = {
  'Etoile': 'LEXA',
  'Planète_11': 'PERSION',
  'Roche004': 'PETRA',
  'Feuilles002': 'SYLVIA',
  'Planète_2': 'PROXION',
  'Cube002': 'SIMULX_5',
  'Cube': 'EXP_//223',
  'Cube012': 'LOG_EX',
  'Cube013': 'C4D3X'
};

// --- LABELS 3D AU-DESSUS DES ASTRES ---
const astroLabels = {};
function createAstroLabel(name) {
  const label = document.createElement('div');
  label.className = 'astro-label';
  label.innerText = astroDisplayNames[name] || name;
  label.style.position = 'fixed';
  label.style.pointerEvents = 'none';
  label.style.fontFamily = '"Share Tech Mono", "Fira Mono", monospace';
  label.style.fontSize = '2.1rem';
  label.style.fontWeight = 'bold';
  label.style.letterSpacing = '0.08em';
  label.style.color = '#fff';
  label.style.textShadow = '0 0 18px rgb(127, 62, 143), 0 0 8px #fff, 0 2px 8px #0ff, 0 0 32px #0ff8';
  label.style.filter = 'drop-shadow(0 0 8px rgb(127, 62, 143))';
  label.style.opacity = '0';
  label.style.transition = 'opacity 0.4s';
  label.style.zIndex = '1003';
  label.style.textAlign = 'center';
  label.style.userSelect = 'none';
  document.body.appendChild(label);
  return label;
}

// Création des labels pour chaque astre et satellite
['Etoile','Planète_11','Roche004','Feuilles002','Planète_2','Cube002','Cube','Cube012','Cube013'].forEach(name => {
  astroLabels[name] = createAstroLabel(name);
});

// --- PARAMÈTRES DE ROTATION ET RÉVOLUTION ---
// Périodes en secondes (modifiable dynamiquement)
const planetMotionParams = {
  // Planète 1.1 (PERSION)
  T11: 52, // Révolution autour de l'étoile (en s)
  t11: 12,  // Rotation sur elle-même (en s)
  // Planète 2 (PROXION)
  T21: 68, // Révolution autour de l'étoile
  t21: 24, // Rotation sur elle-même
  // Roche (PETRA)
  T12: 15,  // Révolution autour de Planète 1.1
  t12: 15,  // Rotation sur elle-même
  // Cube (EXP_//223)
  T22: 18,  // Révolution autour de l'étoile (allongé)
  t22: 2.5, // Rotation sur elle-même
  // Cube002 (SIMULX_5)
  T23: 28, // Révolution autour de l'étoile (allongé)
  t23: 4,  // Rotation sur elle-même
  // Cube012
  T24: 36, // Révolution autour de Proxia
  t24: 3.5, // Rotation sur elle-même
  // Cube013
  T25: 44, // Révolution autour de Proxia
  t25: 5.5  // Rotation sur elle-même
};
// --- STOCKAGE DES ANGLES ORBITAUX ---
const planetMotionState = {
  theta11: 0, theta21: 0, theta12: 0, theta22: 0, theta23: 0, theta24: 0, theta25: 0,
  rot11: 0, rot21: 0, rot12: 0, rot22: 0, rot23: 0, rot24: 0, rot25: 0
};
let lastAnimTime = performance.now();

// --- CALCUL DES RAYONS ORBITAUX DYNAMIQUES (après chargement GLB) ---
let r1 = 180, r2 = 320, r12 = 38, r22 = 38, r23 = 60, r24 = 48, r25 = 54; // valeurs par défaut

const loader = new GLTFLoader();
loader.load('/public/Planetarium.glb', function (gltf) {
  scene.add(gltf.scene);
  gltf.scene.position.set(0, 0, 0);


  // Debug : Affiche tous les noms d'objets du gltf.scene
  gltf.scene.traverse(obj => {
    if (obj.name) {
      console.log('Nom trouvé dans gltf.scene :', obj.name);
    }
  });

  // Récupération des objets par leur nom (corrigé selon la liste affichée)
  const etoile = gltf.scene.getObjectByName('Etoile');
  const planete1 = gltf.scene.getObjectByName('Planète_11');
  const planete2 = gltf.scene.getObjectByName('Planète_2');
  const roche = gltf.scene.getObjectByName('Roche004');
  const feuilles = gltf.scene.getObjectByName('Feuilles002');
  const cube = gltf.scene.getObjectByName('Cube002');
  const cube2 = gltf.scene.getObjectByName('Cube');
  const cube012 = gltf.scene.getObjectByName('Cube012');
  const cube013 = gltf.scene.getObjectByName('Cube013');

  // Calcul dynamique des rayons orbitaux à partir des positions initiales du GLB
  if (etoile && planete1) {
    r1 = etoile.position.distanceTo(planete1.position);
  }
  if (etoile && planete2) {
    r2 = etoile.position.distanceTo(planete2.position);
  }
  if (planete1 && roche) {
    r12 = planete1.position.distanceTo(roche.position);
  }
  if (planete2 && cube) {
    r22 = planete2.position.distanceTo(cube.position);
  }
  if (planete2 && cube2) {
    r23 = planete2.position.distanceTo(cube2.position);
  }
  if (planete2 && cube012) {
    r24 = planete2.position.distanceTo(cube012.position);
  }
  if (planete2 && cube013) {
    r25 = planete2.position.distanceTo(cube013.position);
  }

  // Astres principaux (ordre de navigation)
  astres.push(etoile, planete1, planete2);
  // Pour chaque astre (planète), la liste satellites inclut la planète elle-même en premier
  satellites[0] = [etoile]; // étoile n'a pas de satellites
  satellites[1] = [planete1, roche, feuilles]; // planète 1 et ses satellites (roche, feuilles)
  satellites[2] = [planete2, cube, cube2, cube012, cube013]; // planète 2 et ses satellites

  focusOnAstre();

  // Stocker la référence de l'étoile pour les éruptions
  etoileRef = etoile;
  etoileRadius = 80;
  if (etoile && etoile.geometry && etoile.geometry.boundingSphere) {
    etoileRadius = etoile.geometry.boundingSphere.radius;
  }
  // Calcul du rayon minimal de sécurité (rayon étoile + marge)
  minOrbitRadius = etoileRadius * 1.12; // 12% de marge
}, undefined, function (error) {
  console.error(error);
});

// Smooth camera transition
const CAMERA_SMOOTH_DURATION = 1.1;
let cameraSmoothT = 1;
let cameraStartPos = camera.position.clone();
let cameraStartLookAt = new THREE.Vector3();
let targetCameraPosition = camera.position.clone();
let targetLookAt = new THREE.Vector3();
let cameraTransitionMode = 'linear'; // 'linear', 'backward', 'zoomout'
let cameraZoomOutPos = null;

function getCameraForward() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  return dir.normalize();
}

function computeArcParamsSimple(start, end, focus) {
  // Arc de cercle simple : centre = barycentre (start+end+focus)/3, rayon = distance au centre
  // Mais on n'utilise l'arc que si la distance à l'étoile est inférieure à un certain seuil
  const distToFocus = (start.distanceTo(focus) + end.distanceTo(focus)) / 2;
  const distStartEnd = start.distanceTo(end);
  // On n'utilise l'arc que si on est proche de l'étoile (ex : navigation étoile <-> planète)
  if (distToFocus < 1.5 * distStartEnd) {
    const center = focus.clone().add(start).add(end).multiplyScalar(1/3);
    const radius = center.distanceTo(start);
    const normal = start.clone().sub(center).cross(end.clone().sub(center)).normalize();
    return { center, radius, normal };
  }
  return null;
}

function slerpOnArc(center, radius, start, end, normal, t) {
  // Interpolation sphérique sur l'arc de cercle
  const vStart = start.clone().sub(center).normalize();
  const vEnd = end.clone().sub(center).normalize();
  const angle = vStart.angleTo(vEnd);
  const axis = normal;
  const quat = new THREE.Quaternion().setFromAxisAngle(axis, angle * t);
  const v = vStart.clone().applyQuaternion(quat).multiplyScalar(radius);
  return center.clone().add(v);
}

// Ajout d'un conteneur pour les textes d'astres
const infoContainer = document.createElement('div');
infoContainer.id = 'astro-info-container';
infoContainer.style.position = 'absolute';
infoContainer.style.top = '30px';
infoContainer.style.left = '30px';
infoContainer.style.zIndex = '10';
infoContainer.style.maxWidth = '600px';
infoContainer.style.maxHeight = '600px';
infoContainer.style.overflowY = 'auto';
infoContainer.style.background = 'rgba(0,0,0,0.7)';
infoContainer.style.color = '#fff';
infoContainer.style.padding = '16px';
infoContainer.style.borderRadius = '12px';
infoContainer.style.display = 'none';
infoContainer.style.transition = 'opacity 0.5s cubic-bezier(.4,2,.6,1), transform 0.5s cubic-bezier(.4,2,.6,1)';
infoContainer.style.opacity = '0';
infoContainer.style.transform = 'translateY(20px)';
document.body.appendChild(infoContainer);

// Overlay pour affichage projet (modale)
const projectOverlay = document.createElement('div');
projectOverlay.id = 'project-overlay';
projectOverlay.style.position = 'fixed';
projectOverlay.style.top = '0';
projectOverlay.style.left = '0';
projectOverlay.style.width = '100vw';
projectOverlay.style.height = '100vh';
projectOverlay.style.background = 'rgba(0,0,0,0.92)';
projectOverlay.style.display = 'none';
projectOverlay.style.zIndex = '1000';
projectOverlay.style.justifyContent = 'center';
projectOverlay.style.alignItems = 'center';
projectOverlay.style.flexDirection = 'column';
projectOverlay.style.transition = 'opacity 0.4s';
// Variable globale pour savoir si un overlay projet est ouvert
let isProjectOverlayOpen = false;
// On affiche dynamiquement le contenu selon le projet
function showProjectOverlay(type) {
  let html = '';
  if (type === 'sim3d') {
    html = `
      <div style="max-width:1200px;width:96vw;padding:40px 32px 32px 32px;background:#181818;border-radius:22px;box-shadow:0 8px 32px #000a;color:#fff;position:relative;display:flex;flex-direction:column;align-items:center;">
        <h2 style="margin-top:0">Jumeau numérique de presse à injecter</h2>
        <div id="project-photos" style="display:flex;gap:32px;flex-wrap:wrap;justify-content:center;margin-bottom:24px;">
          <img src="/public/sim3d_1.jpg.png" alt="Capture 1" style="max-width:340px;max-height:420px;border-radius:12px;box-shadow:0 2px 16px #0008;">
          <img src="/public/sim3d_2.jpg.png" alt="Capture 2" style="max-width:340px;max-height:420px;border-radius:12px;box-shadow:0 2px 16px #0008;">
          <img src="/public/sim3d_3.jpg.png" alt="Capture 3" style="max-width:340px;max-height:420px;border-radius:12px;box-shadow:0 2px 16px #0008;">
        </div>
        <button id="close-project-overlay" style="margin-top:8px;padding:12px 38px;font-size:1.2em;background:#fff;color:#222;border:none;border-radius:10px;cursor:pointer;">Retour</button>
      </div>
    `;
  } else if (type === 'expo') {
    html = `
      <div style="max-width:1200px;width:96vw;padding:40px 32px 32px 32px;background:#181818;border-radius:22px;box-shadow:0 8px 32px #000a;color:#fff;position:relative;display:flex;flex-direction:column;align-items:center;">
        <h2 style="margin-top:0">Exposition photo</h2>
        <div id="project-photos" style="display:flex;gap:32px;flex-wrap:wrap;justify-content:center;margin-bottom:24px;">
          <img src="/public/expo_1.jpg.png" alt="Photo expo 1" style="max-width:420px;max-height:520px;border-radius:12px;box-shadow:0 2px 16px #0008;">
          <img src="/public/expo_2.jpg.png" alt="Photo expo 2" style="max-width:420px;max-height:520px;border-radius:12px;box-shadow:0 2px 16px #0008;">
        </div>
        <button id="close-project-overlay" style="margin-top:8px;padding:12px 38px;font-size:1.2em;background:#fff;color:#222;border:none;border-radius:10px;cursor:pointer;">Retour</button>
      </div>
    `;
  }
  projectOverlay.innerHTML = html;
  projectOverlay.style.display = 'flex';
  setTimeout(() => { projectOverlay.style.opacity = '1'; }, 10);
  isProjectOverlayOpen = true;
  updateAstroLabels(true); // force le masquage de tous les labels
}
function closeProjectOverlay() {
  projectOverlay.style.opacity = '0';
  setTimeout(() => { projectOverlay.style.display = 'none'; }, 400);
  isProjectOverlayOpen = false;
  // Réafficher le label du focus après la fermeture
  setTimeout(() => { updateAstroLabels(); }, 420);
}
document.body.appendChild(projectOverlay);

document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'voir-projet-sim3d') {
    showProjectOverlay('sim3d');
  }
  if (e.target && e.target.id === 'voir-projet-expo') {
    showProjectOverlay('expo');
  }
  if (e.target && e.target.id === 'close-project-overlay') {
    closeProjectOverlay();
  }
});

// Ajout du titre Planétarium centré en haut avec effet glow
const planetariumTitle = document.createElement('div');
planetariumTitle.id = 'planetarium-title';
planetariumTitle.innerText = 'Sys-E139';
planetariumTitle.style.position = 'fixed';
planetariumTitle.style.top = '32px';
planetariumTitle.style.left = '50%';
planetariumTitle.style.transform = 'translateX(-50%)';
planetariumTitle.style.fontFamily = 'Montserrat, Arial, sans-serif';
planetariumTitle.style.fontWeight = '900';
planetariumTitle.style.fontSize = 'clamp(2.8rem, 7vw, 5.2rem)';
planetariumTitle.style.letterSpacing = '0.08em';
planetariumTitle.style.color = '#fff';
planetariumTitle.style.textShadow = '0 0 32px rgba(51, 6, 49, 0.31), 0 0 12px #fff, 0 2px 8px rgb(40, 19, 41), 0 0 80px rgba(48, 36, 47, 0.53)';
planetariumTitle.style.zIndex = '900'; // Doit être inférieur à l'overlay (1000)
planetariumTitle.style.userSelect = 'none';
planetariumTitle.style.pointerEvents = 'none';
planetariumTitle.style.textAlign = 'center';
planetariumTitle.style.filter = 'drop-shadow(0 0 18px rgb(34, 6, 39))';
planetariumTitle.style.display = 'none'; // Par défaut masqué

document.body.appendChild(planetariumTitle);

function updatePlanetariumTitle() {
  if (currentAstreIndex === 0) {
    planetariumTitle.style.display = 'block';
  } else {
    planetariumTitle.style.display = 'none';
  }
}

// Textes HTML riches pour chaque objet (astre ou satellite)
const astroTexts = {
  'Etoile': `<h2>Bienvenue sur mon Planétarium !</h2><p>Utilisez les <b>flèches directionnelles</b> pour naviguer entre les astres et satellites.<br>Chaque planète ou satellite représente une facette de mon parcours ou de mes projets.<br><br><i>⭣/⭡</i> : changer d'astre principal<br><i>⭠/⭢</i> : naviguer entre planète et satellites<br><br>Bonne visite !</p>`,
  'Planète_11': `<div style="display:flex;align-items:flex-start;"><img src="/public/perso_1.jpg" alt="Axel Mannu Corrieras" style="margin:0 18px 0 0;max-width:110px;border-radius:14px;box-shadow:0 2px 12px #0008;flex-shrink:0;" /><div><h2>Axel Mannu Corrieras</h2><p><a href="https://www.linkedin.com/in/axel-mannu-corrieras-6b4449284/" target="_blank" rel="noopener">Linkedin</a><p><p>Élève en école d'ingénierie.<p><p>Passionné par les arts et les sciences,<br>Ici, vous pourrez en découvrir plus sur mon parcours et mes centres d'intérêt.</p></div></div>`,
  'Roche004': `<h2>Formation & Diplômes</h2><ul><li>2024-2027 : Arts et Métiers ParisTech (ENSAM) – Ingénieur généraliste</li><li>2022-2024 : CPGE PCSI-PC* – Lycée Pierre Corneille, Rouen</li><li>2022 : Baccalauréat Scientifique – Mention TB</li><li>2020 : Brevet Initiation Aéronautique - Mention TB</li></ul>`,
  'Feuilles002': `<h2>Centres d'intérêt</h2><ul><li>Astrophysique, astronomie, physique</li><li>Photographie, astrophoto, argentique : <a href="https://www.instagram.com/axelcorrieras/" target="_blank" rel="noopener">insta</a></li><li>Piano --- 11 années au CRR Rouen</li><li>Composition musicale : <a href="https://soundcloud.com/user-163788646-509251636" target="_blank" rel="noopener">soundcloud</a></li><li>Poésie [symbolisme, romantisme, haïkaï]</li><li>Arts martiaux : Iaido, Iaijutsu, Kenjutsu</li></ul>`,
  'Planète_2': `<h2>Projets</h2><p>Explorez mes réalisations, projets scolaires et initiatives personnelles,<br>en parcourant les différents satellites.</p>`,
  'Cube002': `<h2>Simulateur 3D</h2><p>Développement d'un jumeau numérique d'une presse à injection plastique, de la CAO au rendu VR en passant par l'animation des différentes étapes du processus.<br><a href='#' id='voir-projet-sim3d'>Voir le projet</a></p>`,
  'Cube': `<h2>Exposition</h2><p>Réalisation d'une exposition de photographie argentique à la galerie l'Embrasser, Paris.<br><a href='#' id='voir-projet-expo'>Voir l'expo photo</a></p>`,
  'Cube012': `<h2>Tutorat</h2><p><li>Tutorat : <b>Mathématiques</b> (Lycéens), <b><a href="https://artsetmetiers.fr/fr/actualites/campus-de-cluny-cordee-de-la-reussite-optim-avec-axel-mannu" target="_blank" rel="noopener">OPTIM</b></a>, et <b>Piano</b></li><li>Participation à un concours d'éloquence : <a href="https://www.youtube.com/watch?v=_RCy0VlvdUQ&list=PLTTBdPeOTS-h5duX9-Byo_IA9M5DWnXqG&index=8" target="_blank" rel="noopener">vidéo</a></li></p>`,
  'Cube013': `<h2>Info</h2><p><b>Réalisation de plusieurs projets informatiques :</b><li>Bibliothèque de divertissement local : scan automatiquement les fichiers et récupère les informations via des bases de données </li><li>Réalisation de ce portfolio</li></p>`
};

// Placement configurable pour chaque objet (top/left en px)
const astroTextPositions = {
  'Etoile': { top: '30px', left: '30px' },
  'Planète_11': { top: '30px', left: '30px' },
  'Roche004': { top: 'auto', left: '30px', bottom: '30px' },
  'Feuilles002': { top: 'auto', left: '50%', bottom: '30px', transform: 'translateX(-50%)' },
  'Planète_2': { top: '30px', right: '30px', left: 'auto' },
  'Cube002': { top: 'auto', right: '30px', bottom: '30px', left: 'auto' },
  'Cube': { top: 'auto', left: '50%', bottom: '30px', transform: 'translateX(-50%)' },
  'Cube012': { top: 'auto', right: '30px', bottom: '120px', left: 'auto' },
  'Cube013': { top: 'auto', left: '50%', bottom: '120px', transform: 'translateX(-50%)' }
};

// Animation d'apparition/disparition
let lastAstroText = '';
let hackerAnimTimeout = null;

// Fonction utilitaire pour effet hacker sur texte HTML riche
function animateHackerText(html, container, duration = 1100, interval = 18) {
  if (hackerAnimTimeout) clearTimeout(hackerAnimTimeout);
  container.innerHTML = '';
  // Découper le HTML en tokens (balises ou caractères)
  const tokens = [];
  let i = 0;
  while (i < html.length) {
    if (html[i] === '<') {
      // Balise HTML
      const close = html.indexOf('>', i);
      if (close !== -1) {
        tokens.push({ type: 'tag', value: html.slice(i, close + 1) });
        i = close + 1;
      } else {
        tokens.push({ type: 'char', value: html[i] });
        i++;
      }
    } else {
      tokens.push({ type: 'char', value: html[i] });
      i++;
    }
  }
  // Indices des caractères à révéler (on ignore les balises)
  const charIndices = tokens.map((t, idx) => t.type === 'char' ? idx : null).filter(idx => idx !== null);
  const totalChars = charIndices.length;
  const startTime = performance.now();
  const randomChars = 'Ա Զ Է Ր Ե Ը Ի Ո Պ Խ Դ Ֆ Ք Հ Ճ Կ Լ Մ Ւ Ց Գ Վ Բ Ն ಐ ಓ ಔ ಕ ಖ ಗ ಘ ಙ ಝ ಞ ಲ ಶ ಹ ೀ ಾ ಿ ಧಿ ೈ ೋ ೌ ೬ ೂ ೄ';

  function render(progress) {
    let revealed = Math.floor(progress * totalChars);
    let htmlOut = '';
    let revealedCount = 0;
    for (let t = 0; t < tokens.length; t++) {
      if (tokens[t].type === 'tag') {
        htmlOut += tokens[t].value;
      } else {
        if (revealedCount < revealed) {
          htmlOut += tokens[t].value;
        } else {
          // Caractère aléatoire
          htmlOut += randomChars[Math.floor(Math.random() * randomChars.length)];
        }
        revealedCount++;
      }
    }
    container.innerHTML = htmlOut;
  }

  function step() {
    const now = performance.now();
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    render(progress);
    if (progress < 1) {
      hackerAnimTimeout = setTimeout(step, interval);
    } else {
      // Affiche le texte final (pour liens, sélection, etc.)
      container.innerHTML = html;
    }
  }
  step();
}

function updateAstroText() {
  const satList = satellites[currentAstreIndex];
  if (!satList) { infoContainer.style.display = 'none'; return; }
  const obj = satList[currentSatelliteIndex];
  if (!obj) { infoContainer.style.display = 'none'; return; }
  const name = obj.name;
  const html = astroTexts[name];
  if (html) {
    if (lastAstroText !== name) {
      infoContainer.style.display = 'block';
      infoContainer.style.opacity = '0';
      infoContainer.style.transform = 'translateY(20px)';
      setTimeout(() => {
        // Placement configurable
        infoContainer.style.top = astroTextPositions[name]?.top || '';
        infoContainer.style.left = astroTextPositions[name]?.left || '';
        infoContainer.style.right = astroTextPositions[name]?.right || '';
        infoContainer.style.bottom = astroTextPositions[name]?.bottom || '';
        infoContainer.style.transform = astroTextPositions[name]?.transform || 'translateY(0)';
        setTimeout(() => {
          infoContainer.style.opacity = '1';
          if (!astroTextPositions[name]?.transform) infoContainer.style.transform = 'translateY(0)';
        }, 10);
        // Effet hacker sur le texte
        animateHackerText(html, infoContainer);
      }, 200);
      lastAstroText = name;
    }
  } else {
    if (infoContainer.style.display !== 'none') {
      infoContainer.style.opacity = '0';
      infoContainer.style.transform = 'translateY(20px)';
      setTimeout(() => {
        infoContainer.style.display = 'none';
        infoContainer.innerHTML = '';
      }, 400);
      lastAstroText = '';
    }
  }
}

function updateAstroLabels(forceHide = false) {
  // Masque tous les labels d'abord
  Object.values(astroLabels).forEach(label => { label.style.opacity = '0'; });
  if (forceHide) return;

  // Si la caméra est centrée sur l'étoile, on affiche seulement les labels des objets principaux (étoile, planètes, cubes)
  if (currentAstreIndex === 0) {
    // Liste des objets principaux à labeler (pas les satellites de planète 1)
    const mainObjects = [
      satellites[0][0], // Etoile
      satellites[1][0], // Planète 1
      satellites[2][0], satellites[2][1], satellites[2][2], satellites[2][3], satellites[2][4] // Planète 2 + ses satellites (cubes)
    ];
    mainObjects.forEach(obj => {
      if (!obj) return;
      const name = obj.name;
      const label = astroLabels[name];
      if (!label) return;
      const worldPos = obj.getWorldPosition(new THREE.Vector3());
      const screenPos = worldPos.clone().project(camera);
      const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-(screenPos.y * 0.5) + 0.5) * window.innerHeight - 48;
      label.style.left = `${x}px`;
      label.style.top = `${y}px`;
      label.style.opacity = '1';
    });
    return;
  }
  // Sinon, affiche et positionne le label de l'objet focus
  const satList = satellites[currentAstreIndex];
  if (!satList) return;
  const obj = satList[currentSatelliteIndex];
  if (!obj) return;
  const name = obj.name;
  const label = astroLabels[name];
  if (!label) return;
  const worldPos = obj.getWorldPosition(new THREE.Vector3());
  const screenPos = worldPos.clone().project(camera);
  const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-(screenPos.y * 0.5) + 0.5) * window.innerHeight - 48;
  label.style.left = `${x}px`;
  label.style.top = `${y}px`;
  label.style.opacity = '1';
}

function focusOnAstre() {
  const satList = satellites[currentAstreIndex];
  if (satList && satList[currentSatelliteIndex]) {
    const obj = satList[currentSatelliteIndex];
    const pos = obj.getWorldPosition(new THREE.Vector3());
    let offset, lookAtTarget;
    if (currentAstreIndex === 0) {
      offset = new THREE.Vector3(200, 100, 200).sub(pos);
      lookAtTarget = pos.clone();
      targetCameraPosition = pos.clone().add(offset);
      targetLookAt = lookAtTarget.clone();
    } else if (currentAstreIndex === 2 && currentSatelliteIndex === 0) {
      const etoile = satellites[0][0];
      const etoilePos = etoile.getWorldPosition(new THREE.Vector3());
      const axis = new THREE.Vector3().subVectors(pos, etoilePos);
      axis.y = 0;
      axis.normalize();
      offset = axis.clone().multiplyScalar(25).add(new THREE.Vector3(0, 12, 0));
      const cameraPos = pos.clone().add(offset);
      cameraPos.y = Math.max(cameraPos.y, 12);
      targetCameraPosition = cameraPos;
      lookAtTarget = pos.clone().add(axis.clone().multiplyScalar(-10)).setY(0);
      targetLookAt = lookAtTarget.clone();
    } else if (currentSatelliteIndex === 0) {
      const etoile = satellites[0][0];
      const etoilePos = etoile.getWorldPosition(new THREE.Vector3());
      const axis = new THREE.Vector3().subVectors(pos, etoilePos);
      axis.y = 0;
      axis.normalize();
      offset = axis.clone().multiplyScalar(5);
      const cameraPos = pos.clone().add(offset);
      cameraPos.y = 0;
      targetCameraPosition = cameraPos;
      lookAtTarget = etoilePos.clone().setY(0);
      targetLookAt = lookAtTarget.clone();
    } else if (currentAstreIndex === 2 && (currentSatelliteIndex === 1 || currentSatelliteIndex === 2)) {
      offset = new THREE.Vector3(0, 10, 5);
      targetCameraPosition = pos.clone().add(offset);
      lookAtTarget = pos.clone();
      targetLookAt = lookAtTarget.clone();
    } else if (currentAstreIndex === 1 && currentSatelliteIndex === 1) {
      offset = new THREE.Vector3(0, 3, 1.5);
      targetCameraPosition = pos.clone().add(offset);
      lookAtTarget = pos.clone();
      targetLookAt = lookAtTarget.clone();
    } else if (currentAstreIndex === 1 && currentSatelliteIndex === 2) {
      offset = new THREE.Vector3(0, 3, 1.5);
      targetCameraPosition = pos.clone().add(offset);
      lookAtTarget = pos.clone();
      targetLookAt = lookAtTarget.clone();
    } else if (currentAstreIndex === 2 && currentSatelliteIndex === 3) {
      offset = new THREE.Vector3(0, 18, 32);
      targetCameraPosition = pos.clone().add(offset);
      lookAtTarget = pos.clone();
      targetLookAt = lookAtTarget.clone();
    } else if (currentAstreIndex === 2 && currentSatelliteIndex === 4) {
      offset = new THREE.Vector3(0, 18, 32);
      targetCameraPosition = pos.clone().add(offset);
      lookAtTarget = pos.clone();
      targetLookAt = lookAtTarget.clone();
    } else {
      const planete = satList[0];
      const planetePos = planete.getWorldPosition(new THREE.Vector3());
      const axis = new THREE.Vector3().subVectors(pos, planetePos);
      axis.y = 0;
      axis.normalize();
      offset = axis.clone().multiplyScalar(5);
      const cameraPos = pos.clone().add(offset);
      cameraPos.y = 0;
      targetCameraPosition = cameraPos;
      lookAtTarget = planetePos.clone().setY(0);
      targetLookAt = lookAtTarget.clone();
    }
    camera.userData.targetObject = obj;
    camera.userData.offset = offset;
    camera.userData.lookAtTarget = lookAtTarget;
    cameraStartPos.copy(camera.position);
    cameraStartLookAt.copy(getCurrentCameraLookAt());
    cameraSmoothT = 0;
    // Détermination du mode de transition
    const camToTarget = targetCameraPosition.clone().sub(cameraStartPos).normalize();
    const camForward = getCameraForward();
    const dot = camToTarget.dot(camForward);
    const dist = cameraStartPos.distanceTo(targetCameraPosition);
    // Cas spécial : Planète 1.1 <-> Roche (jamais de recul)
    const isPlanete1Roche = (
      (satList[0]?.name === 'Planète_11' && obj.name === 'Roche004') ||
      (satList[0]?.name === 'Roche004' && obj.name === 'Planète_11')
    );
    // Pas de recul si objets proches (< 80)
    if (isPlanete1Roche || dist < 80) {
      cameraTransitionMode = 'linear';
    } else if (dot < -0.35) {
      cameraTransitionMode = 'backward';
    } else {
      // Optionnel : si derrière l'étoile (intersection segment caméra-cible avec sphère étoile)
      const etoile = satellites[0][0];
      if (etoile) {
        const etoilePos = etoile.getWorldPosition(new THREE.Vector3());
        const etoileRay = etoileRadius * 1.1;
        const seg = {start: cameraStartPos, end: targetCameraPosition};
        const d = seg.end.clone().sub(seg.start);
        const f = seg.start.clone().sub(etoilePos);
        const a = d.dot(d);
        const b = 2 * f.dot(d);
        const c = f.dot(f) - etoileRay * etoileRay;
        const discriminant = b*b - 4*a*c;
        if (discriminant > 0) {
          // Il y a intersection, donc derrière l'étoile
          cameraTransitionMode = 'zoomout';
          // Position de dézoom : on recule sur la droite caméra-cible
          const mid = cameraStartPos.clone().add(targetCameraPosition).multiplyScalar(0.5);
          const dir = mid.clone().sub(etoilePos).normalize();
          cameraZoomOutPos = etoilePos.clone().add(dir.multiplyScalar(etoileRay * 2.2));
        } else {
          cameraTransitionMode = 'linear';
        }
      } else {
        cameraTransitionMode = 'linear';
      }
    }
  }
  updateAstroText();
  updatePlanetariumTitle();
  updateAstroLabels();
}

function getCurrentCameraLookAt() {
  // Utilise un rayon pour obtenir le lookAt courant
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  return camera.position.clone().add(direction.multiplyScalar(100));
}

function smoothstep(t) {
  // Accélère puis ralentit (ease in/out)
  return t * t * (3 - 2 * t);
}

function lerpVec3(a, b, t) {
  return new THREE.Vector3(
    a.x + (b.x - a.x) * t,
    a.y + (b.y - a.y) * t,
    a.z + (b.z - a.z) * t
  );
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { // Inversé !
    currentAstreIndex = (currentAstreIndex + 1) % astres.length;
    currentSatelliteIndex = 0;
    focusOnAstre();
  } else if (e.key === 'ArrowUp') { // Inversé !
    currentAstreIndex = (currentAstreIndex - 1 + astres.length) % astres.length;
    currentSatelliteIndex = 0;
    focusOnAstre();
  } else if (e.key === 'ArrowRight') {
    const satList = satellites[currentAstreIndex];
    if (satList) {
      currentSatelliteIndex = (currentSatelliteIndex + 1) % satList.length;
      focusOnAstre();
    }
  } else if (e.key === 'ArrowLeft') {
    const satList = satellites[currentAstreIndex];
    if (satList) {
      currentSatelliteIndex = (currentSatelliteIndex - 1 + satList.length) % satList.length;
      focusOnAstre();
    }
  }
});

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 2); // Intensité augmentée
scene.add(ambientLight);

// Optionnel : ajout d'une HemisphereLight pour un effet plus naturel
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
hemiLight.position.set(0, 200, 0);
scene.add(hemiLight);

const controls = new OrbitControls(camera, renderer.domElement);

// Stars
function addStar() {
  const geometry = new THREE.SphereGeometry(0.25, 24, 24);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const star = new THREE.Mesh(geometry, material);

  const [x, y, z] = Array(3).fill().map(() => THREE.MathUtils.randFloatSpread(1000));
  star.position.set(x, y, z);
  scene.add(star);
}
Array(2000).fill().forEach(addStar); 

// Render Loop
function animate() {
  requestAnimationFrame(animate);

  // --- ANIMATION MANUELLE DES ASTRES ---
  const now = performance.now();
  const dt = (now - lastAnimTime) / 1000; // en secondes
  lastAnimTime = now;
  // Récupération des objets (si chargés)
  const etoile = satellites[0]?.[0];
  const planete1 = satellites[1]?.[0];
  const roche = satellites[1]?.[1];
  const planete2 = satellites[2]?.[0];
  const cube = satellites[2]?.[1];
  const cube2 = satellites[2]?.[2];
  const cube012 = satellites[2]?.[3];
  const cube013 = satellites[2]?.[4];

  // Planète 1.1 (PERSION)
  if (etoile && planete1) {
    // Révolution antihoraire
    planetMotionState.theta11 -= (2 * Math.PI / planetMotionParams.T11) * dt;
    planete1.position.x = etoile.position.x + r1 * Math.cos(planetMotionState.theta11);
    planete1.position.z = etoile.position.z + r1 * Math.sin(planetMotionState.theta11);
    planete1.position.y = etoile.position.y;
    // Pas de rotation sur elle-même
  }
  // Planète 2 (PROXION)
  if (etoile && planete2) {
    planetMotionState.theta21 -= (2 * Math.PI / planetMotionParams.T21) * dt;
    planete2.position.x = etoile.position.x + r2 * Math.cos(planetMotionState.theta21);
    planete2.position.z = etoile.position.z + r2 * Math.sin(planetMotionState.theta21);
    planete2.position.y = etoile.position.y;
    // Pas de rotation sur elle-même
  }
  // Roche (PETRA) autour de Planète 1.1
  if (planete1 && roche) {
    planetMotionState.theta12 -= (2 * Math.PI / planetMotionParams.T12) * dt;
    roche.position.x = planete1.position.x + r12 * Math.cos(planetMotionState.theta12);
    roche.position.z = planete1.position.z + r12 * Math.sin(planetMotionState.theta12);
    roche.position.y = planete1.position.y;
    // Rotation sur elle-même (seule Roche)
    planetMotionState.rot12 -= (2 * Math.PI / planetMotionParams.t12) * dt;
    roche.rotation.y = planetMotionState.rot12;
  }
  // Cube (EXP_//223) autour de l'étoile sur un cercle dans un plan incliné
  if (etoile && cube) {
    planetMotionState.theta22 -= (2 * Math.PI / planetMotionParams.T22) * dt;
    // Plan incliné (ex: 30° autour de X)
    const rCube = r2 * 0.92;
    const angleIncline = Math.PI / 6; // 30°
    const x = etoile.position.x + rCube * Math.cos(planetMotionState.theta22);
    const y = etoile.position.y + rCube * Math.sin(planetMotionState.theta22) * Math.sin(angleIncline);
    const z = etoile.position.z + rCube * Math.sin(planetMotionState.theta22) * Math.cos(angleIncline);
    cube.position.set(x, y, z);
  }
  // Cube002 (SIMULX_5) autour de l'étoile sur un cercle dans un autre plan incliné
  if (etoile && cube2) {
    planetMotionState.theta23 -= (2 * Math.PI / planetMotionParams.T23) * dt;
    // Plan incliné (ex: -25° autour de X)
    const rCube2 = r2 * 1.05;
    const angleIncline2 = -Math.PI / 7; // -25°
    const x = etoile.position.x + rCube2 * Math.cos(planetMotionState.theta23);
    const y = etoile.position.y + rCube2 * Math.sin(planetMotionState.theta23) * Math.sin(angleIncline2);
    const z = etoile.position.z + rCube2 * Math.sin(planetMotionState.theta23) * Math.cos(angleIncline2);
    cube2.position.set(x, y, z);
  }
  // Cube012 (LOG_EX) autour de l'étoile sur un cercle dans un plan incliné
  if (etoile && cube012) {
    planetMotionState.theta24 -= (2 * Math.PI / planetMotionParams.T24) * dt;
    const rCube012 = r2 * 0.98;
    const angleIncline3 = Math.PI / 4; // 45°
    const x = etoile.position.x + rCube012 * Math.cos(planetMotionState.theta24);
    const y = etoile.position.y + rCube012 * Math.sin(planetMotionState.theta24) * Math.sin(angleIncline3);
    const z = etoile.position.z + rCube012 * Math.sin(planetMotionState.theta24) * Math.cos(angleIncline3);
    cube012.position.set(x, y, z);
    // Correction du lookAt pour la caméra si focus sur ce cube
    if (camera.userData.targetObject === cube012) {
      targetCameraPosition = cube012.position.clone().add(new THREE.Vector3(0, 18, 32));
      targetLookAt = cube012.position.clone();
    }
  }
  // Cube013 (C4D3X) autour de l'étoile sur un cercle dans un plan incliné
  if (etoile && cube013) {
    planetMotionState.theta25 -= (2 * Math.PI / planetMotionParams.T25) * dt;
    const rCube013 = r2 * 1.08;
    const angleIncline4 = -Math.PI / 5; // -36°
    const x = etoile.position.x + rCube013 * Math.cos(planetMotionState.theta25);
    const y = etoile.position.y + rCube013 * Math.sin(planetMotionState.theta25) * Math.sin(angleIncline4);
    const z = etoile.position.z + rCube013 * Math.sin(planetMotionState.theta25) * Math.cos(angleIncline4);
    cube013.position.set(x, y, z);
    planetMotionState.rot25 -= (2 * Math.PI / planetMotionParams.t25) * dt;
    cube013.rotation.y = planetMotionState.rot25;
    // Correction du lookAt pour la caméra si focus sur ce cube
    if (camera.userData.targetObject === cube013) {
      targetCameraPosition = cube013.position.clone().add(new THREE.Vector3(0, 18, 32));
      targetLookAt = cube013.position.clone();
    }
  }

  if (camera.userData.targetObject) {
    // Utilise directement la position courante de l'objet (après animation manuelle)
    const obj = camera.userData.targetObject;
    const pos = obj.getWorldPosition(new THREE.Vector3());
    let nextTargetCameraPosition, nextTargetLookAt;
    if (currentAstreIndex === 0) {
      nextTargetCameraPosition = pos.clone().add(new THREE.Vector3(200, 100, 200));
      nextTargetLookAt = pos.clone();
    } else if (currentAstreIndex === 2 && currentSatelliteIndex === 0) {
      const etoile = satellites[0][0];
      const etoilePos = etoile.getWorldPosition(new THREE.Vector3());
      const axis = new THREE.Vector3().subVectors(pos, etoilePos);
      axis.y = 0;
      axis.normalize();
      nextTargetCameraPosition = pos.clone().add(axis.clone().multiplyScalar(25)).add(new THREE.Vector3(0, 12, 0));
      nextTargetCameraPosition.y = Math.max(nextTargetCameraPosition.y, 12);
      nextTargetLookAt = pos.clone().add(axis.clone().multiplyScalar(-10)).setY(0);
    } else if (currentSatelliteIndex === 0) {
      const etoile = satellites[0][0];
      const etoilePos = etoile.getWorldPosition(new THREE.Vector3());
      const axis = new THREE.Vector3().subVectors(pos, etoilePos);
      axis.y = 0;
      axis.normalize();
      nextTargetCameraPosition = pos.clone().add(axis.clone().multiplyScalar(5));
      nextTargetCameraPosition.y = 0;
      nextTargetLookAt = etoilePos.clone().setY(0);
    } else if (currentAstreIndex === 2 && (currentSatelliteIndex === 1 || currentSatelliteIndex === 2)) {
      nextTargetCameraPosition = pos.clone().add(new THREE.Vector3(0, 10, 5));
      nextTargetLookAt = pos.clone();
    } else if (currentAstreIndex === 1 && currentSatelliteIndex === 1) {
      nextTargetCameraPosition = pos.clone().add(new THREE.Vector3(0, 3, 1.5));
      nextTargetLookAt = pos.clone();
    } else if (currentAstreIndex === 1 && currentSatelliteIndex === 2) {
      nextTargetCameraPosition = pos.clone().add(new THREE.Vector3(0, 3, 1.5));
      nextTargetLookAt = pos.clone();
    } else if (currentAstreIndex === 2 && currentSatelliteIndex === 3) {
      nextTargetCameraPosition = pos.clone().add(new THREE.Vector3(0, 18, 32));
      nextTargetLookAt = pos.clone();
    } else if (currentAstreIndex === 2 && currentSatelliteIndex === 4) {
      nextTargetCameraPosition = pos.clone().add(new THREE.Vector3(0, 18, 32));
      nextTargetLookAt = pos.clone();
    } else {
      const planete = satellites[currentAstreIndex][0];
      const planetePos = planete.getWorldPosition(new THREE.Vector3());
      const axis = new THREE.Vector3().subVectors(pos, planetePos);
      axis.y = 0;
      axis.normalize();
      nextTargetCameraPosition = pos.clone().add(axis.clone().multiplyScalar(5));
      nextTargetCameraPosition.y = 0;
      nextTargetLookAt = planetePos.clone().setY(0);
    }
    // Smooth transition
    if (cameraSmoothT < 1) {
      cameraSmoothT = Math.min(1, cameraSmoothT + (dt / CAMERA_SMOOTH_DURATION));
      const t = smoothstep(cameraSmoothT);
      if (cameraTransitionMode === 'backward') {
        // On recule d'abord, puis avance
        let mid = cameraStartPos.clone().sub(getCameraForward().multiplyScalar(120));
        if (t < 0.5) {
          camera.position.copy(lerpVec3(cameraStartPos, mid, t * 2));
        } else {
          camera.position.copy(lerpVec3(mid, nextTargetCameraPosition, (t-0.5)*2));
        }
      } else if (cameraTransitionMode === 'zoomout' && cameraZoomOutPos) {
        // On va vers une position éloignée, puis vers la cible
        if (t < 0.5) {
          camera.position.copy(lerpVec3(cameraStartPos, cameraZoomOutPos, t * 2));
        } else {
          camera.position.copy(lerpVec3(cameraZoomOutPos, nextTargetCameraPosition, (t-0.5)*2));
        }
      } else {
        // Linéaire avec ease in/out
        camera.position.copy(lerpVec3(cameraStartPos, nextTargetCameraPosition, t));
      }
      const lerpedLookAt = lerpVec3(cameraStartLookAt, nextTargetLookAt, t);
      camera.lookAt(lerpedLookAt);
    } else {
      camera.position.copy(nextTargetCameraPosition);
      camera.lookAt(nextTargetLookAt);
    }
  }

  updateAstroLabels(isProjectOverlayOpen); // repositionne le label à chaque frame, mais masque si overlay

  if (mixer) {
    const delta = clock.getDelta();
    mixer.update(delta);
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  updateAstroLabels(isProjectOverlayOpen);
});

updatePlanetariumTitle();
animate();