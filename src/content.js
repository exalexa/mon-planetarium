// Contenu du portfolio (d'après le CV de novembre 2026). Une entrée par astre (même id que system.js).
// Attention : pas d'entités HTML (&amp;…) ni de « < » dans le texte, à cause de l'animation de déchiffrage.

const BASE = import.meta.env.BASE_URL;

export const TEXTS = {
  lexa: `
    <p class="log-kicker">Journal de bord · entrée 00</p>
    <h2>Bienvenue dans le système Sys-E139</h2>
    <p>Ce petit système solaire est mon portfolio. Chaque planète regroupe une partie de mon parcours, et chaque satellite en raconte un épisode : études, recherche, ingénierie et arts.</p>
    <ul class="log-keys">
      <li><kbd>↑</kbd><kbd>↓</kbd> changer de planète</li>
      <li><kbd>←</kbd><kbd>→</kbd> visiter ses satellites</li>
      <li><kbd>glisser</kbd> tourner autour d'un astre, <kbd>molette</kbd> zoomer</li>
    </ul>
    <p>Vous pouvez aussi cliquer sur un astre, ou utiliser le journal à droite : il garde la trace de ce que vous avez déjà exploré.</p>
    <p class="log-note">Le soleil est stable. Pour l'instant.</p>`,

  // ----- PERSION · profil -----
  persion: `
    <div class="log-profile">
      <img src="${BASE}perso_1.jpg" alt="Axel Mannu Corrieras" />
      <div>
        <p class="log-kicker">PERSION · profil</p>
        <h2>Axel Mannu Corrieras</h2>
        <p class="log-sub">Étudiant en physique et en ingénierie<br>Master de Physique, Aix-Marseille Université<br>Arts et Métiers (ENSAM)</p>
      </div>
    </div>
    <p>Je m'intéresse aux sciences fondamentales et aux approches interdisciplinaires. Je crois qu'une compréhension profonde de la nature naît de la rencontre entre mathématiques, physique, ingénierie, philosophie et arts.</p>
    <p>Mes recherches portent sur la dynamique galactique : modélisation numérique et exploitation de grands relevés astronomiques.</p>
    <p class="log-links"><a href="https://www.linkedin.com/in/axel-mannu-corrieras-6b4449284/" target="_blank" rel="noopener">LinkedIn</a><a href="https://arxiv.org/abs/2610.07581" target="_blank" rel="noopener">arXiv</a></p>`,

  sylvia: `
    <p class="log-kicker">PERSION · SYLVIA</p>
    <h2>Centres d'intérêt</h2>
    <ul>
      <li><b>Poésie</b> : symbolisme, romantisme, hermétisme, waka (Hyakunin Isshu)</li>
      <li><b>Arts martiaux</b> : iaidō, iaijutsu, kenjutsu, étude des nihontō</li>
      <li><b>Photographie</b> : argentique et numérique · <a href="https://www.instagram.com/axelcorrieras/" target="_blank" rel="noopener">Instagram</a></li>
      <li><b>Musique</b> : piano et composition (voir NOCTURNE, autour de MUSA)</li>
      <li><b>Astrophysique</b> : de la dynamique des galaxies à la cosmologie</li>
    </ul>`,

  petra: `
    <p class="log-kicker">PERSION · PETRA</p>
    <h2>Compétences et langues</h2>
    <h3>Outils</h3>
    <p class="log-tags">Python · SQL · LaTeX · VS Code · galpy · AGAMA · CATIA · 3DEXPERIENCE · Abaqus · COMSOL · Wolfram Mathematica · Unity</p>
    <h3>Langues</h3>
    <ul>
      <li><b>Français</b> : langue maternelle</li>
      <li><b>Anglais</b> : C1 (TOEFL iBT 95/120)</li>
      <li><b>Espagnol</b>, <b>allemand</b> : A2</li>
      <li><b>Japonais</b> : A1</li>
    </ul>`,

  // ----- SCHOLA · formation -----
  schola: `
    <p class="log-kicker">SCHOLA · formation</p>
    <h2>Parcours</h2>
    <p>Chaque lune de SCHOLA porte l'un des lieux où j'ai étudié. Approchez-vous pour les découvrir.</p>
    <ul class="log-timeline">
      <li><span class="when">2026 →</span><b>Master de Physique</b>, Aix-Marseille Université</li>
      <li><span class="when">2024 →</span><b>Master Ingénierie mécanique et industrielle</b>, Arts et Métiers</li>
      <li><span class="when">2025-26</span><b>Licence de Physique</b>, Le Mans Université</li>
      <li><span class="when">2022-24</span><b>CPGE PCSI-PC*</b>, Lycée Pierre Corneille, Rouen</li>
      <li><span class="when">2022</span><b>Baccalauréat</b>, mention Très Bien, Lycée Saint Jean-Baptiste de La Salle, Rouen</li>
      <li><span class="when">2020</span><b>Brevet d'Initiation Aéronautique</b>, mention Très Bien</li>
      <li><span class="when">2012-22</span><b>Conservatoire à rayonnement régional de Rouen</b> : piano, musique de chambre, écriture, formation musicale</li>
    </ul>`,

  corneille: `
    <p class="log-kicker">SCHOLA · CORNEILLE</p>
    <h2>Lycée Pierre Corneille, Rouen</h2>
    <p class="log-sub">Classes préparatoires PCSI puis PC* · 2022-2024</p>
    <p>Deux années intensives de préparation aux concours d'ingénieurs.</p>
    <ul>
      <li><b>Mathématiques</b> : algèbre linéaire, topologie, analyse, calcul différentiel, probabilités, arithmétique</li>
      <li><b>Physique</b> : électronique, optique, thermodynamique, mécanique classique et quantique, électromagnétisme, ondes</li>
      <li><b>Chimie</b> : chimie organique et inorganique, stratégies de synthèse, cinétique et thermodynamique, chimie quantique</li>
    </ul>
    <p>TIPE sur la dynamique des ricochets (voir RICOCHET, autour de PROXION).</p>`,

  cluny: `
    <p class="log-kicker">SCHOLA · CLUNY</p>
    <h2>Arts et Métiers, campus de Cluny</h2>
    <p class="log-sub">Master Ingénierie mécanique et industrielle · depuis 2024</p>
    <p>Le campus de Cluny est installé dans les bâtiments de l'ancienne abbaye, au pied du clocher de l'Eau-Bénite.</p>
    <h3>Tronc commun</h3>
    <p class="log-tags">Science des matériaux · Mécanique des solides · Éléments finis · Mécanique des fluides · Thermodynamique · Conception de systèmes · Algorithmes d'optimisation · Électronique</p>
    <p>C'est aussi à Cluny que j'ai participé au concours d'éloquence (3e place en 2026) et au tutorat des Cordées de la réussite.</p>`,

  lutece: `
    <p class="log-kicker">SCHOLA · LUTÈCE</p>
    <h2>Arts et Métiers, campus de Paris</h2>
    <p class="log-sub">Master Ingénierie mécanique et industrielle</p>
    <h3>Approfondissements</h3>
    <p class="log-tags">Aérodynamique et modélisation de la turbulence · Mécanique des fluides numérique · Aéroacoustique · Écoulements incompressibles et multiphasiques</p>
    <p>En 2026, j'ai organisé et animé au 47e Forum Arts et Métiers une table ronde sur la souveraineté spatiale (voir LOG_EX, autour de MUSA).</p>`,

  cenomane: `
    <p class="log-kicker">SCHOLA · CÉNOMANE</p>
    <h2>Le Mans Université</h2>
    <p class="log-sub">Licence de Physique · 2025-2026</p>
    <p>Une licence de physique suivie en parallèle de l'école d'ingénieurs, pour consolider les bases théoriques.</p>
    <p class="log-tags">Mécanique analytique et quantique · Optique · Électromagnétisme · Physique nucléaire · Thermodynamique statistique · Transferts thermiques · Mécanique des milieux continus</p>`,

  massalia: `
    <p class="log-kicker">SCHOLA · MASSALIA</p>
    <h2>Aix-Marseille Université</h2>
    <p class="log-sub">Master de Physique · depuis 2026</p>
    <h3>Tronc commun</h3>
    <p class="log-tags">Physique statistique · Mécanique quantique · Matière condensée · Électromagnétisme et optique</p>
    <h3>Approfondissements</h3>
    <p class="log-tags">Astrophysique · Physique des plasmas · Physique des particules · Mécanique des milieux continus</p>`,

  // ----- ASTRA · recherche -----
  astra: `
    <p class="log-kicker">ASTRA · recherche</p>
    <h2>Recherche</h2>
    <p>Mes recherches portent sur la dynamique de la Voie lactée : comprendre comment les structures qui la composent ont été assemblées et transformées au fil du temps.</p>
    <p>Pendant mon stage, j'ai développé seul des outils et des méthodes de calcul, et manipulé de grands catalogues d'étoiles. J'aime apprendre vite de nouveaux concepts et de nouveaux environnements logiciels pour aborder des problèmes à la frontière de plusieurs disciplines.</p>
    <ul>
      <li><b>MEUDON</b> : le stage au LIRA</li>
      <li><b>ω CEN</b> : la publication</li>
      <li><b>GAIA</b> : les données et les outils</li>
      <li><b>EUCLID</b> : mes thèmes de recherche</li>
    </ul>`,

  meudon: `
    <p class="log-kicker">ASTRA · MEUDON</p>
    <h2>LIRA, Observatoire de Paris</h2>
    <p class="log-sub">Stage de recherche · 6 semaines · été 2026 · Meudon<br>Encadrant : Dr Chervin Laporte</p>
    <p>Étude de l'évolution dynamique de sous-structures galactiques, comme Gaia-Sausage-Enceladus et l'amas globulaire ω Centauri, dans un potentiel galactique qui évolue au cours du temps. La barre galactique y est modélisée avec une vitesse de rotation et une longueur variables.</p>
    <p>Analyse chimio-dynamique et intégration orbitale à rebours pour suivre les trajectoires dans l'espace (Lz, E) et repérer leurs convergences.</p>
    <p>Résultat : un article soumis en premier auteur (voir ω CEN).</p>`,

  omega: `
    <p class="log-kicker">ASTRA · ω CEN</p>
    <h2>Publication</h2>
    <p><i>Stirred, not shaken: Dislodging ω Centauri from the Sausage galaxy through bar resonances</i></p>
    <p class="log-muted">A. Mannu, C. F. P. Laporte, M. D. A. Orkney, Y. R. Khalil, B. Famaey · soumis à MNRAS, 2026</p>
    <p>ω Centauri, l'amas globulaire le plus massif de la Voie lactée, serait le noyau d'une galaxie naine absorbée. L'article étudie comment les résonances de la barre galactique ont pu le détacher des débris de Gaia-Sausage-Enceladus.</p>
    <p class="log-links"><a href="https://arxiv.org/abs/2610.07581" target="_blank" rel="noopener">arXiv:2610.07581 [astro-ph.GA]</a></p>`,

  gaia: `
    <p class="log-kicker">ASTRA · GAIA</p>
    <h2>Données et outils</h2>
    <p>Le satellite Gaia de l'ESA cartographie plus d'un milliard d'étoiles de notre galaxie. Ses données, croisées avec des relevés spectroscopiques, sont au cœur de mon travail.</p>
    <h3>Relevés</h3>
    <p class="log-tags">Gaia DR3 · APOGEE DR19 · GALAH DR3 · StarHorse</p>
    <h3>Modélisation</h3>
    <p class="log-tags">galpy · AGAMA · Python</p>`,

  euclid: `
    <p class="log-kicker">ASTRA · EUCLID</p>
    <h2>Thèmes de recherche</h2>
    <p>Le télescope Euclid explore l'univers sombre. Mes centres d'intérêt vont de la même façon des étoiles de notre galaxie jusqu'aux grandes échelles.</p>
    <ul>
      <li>Dynamique galactique</li>
      <li>Archéologie galactique</li>
      <li>Dynamique stellaire</li>
      <li>Astrophysique numérique</li>
      <li>Trous noirs</li>
      <li>Cosmologie</li>
    </ul>`,

  // ----- PROXION · ingénierie -----
  proxion: `
    <p class="log-kicker">PROXION · ingénierie</p>
    <h2>Projets d'ingénierie</h2>
    <p>Les satellites de PROXION rassemblent mes projets d'école et mes projets personnels, de la conception mécanique à l'apprentissage automatique.</p>
    <h3>Expérience industrielle</h3>
    <ul class="log-timeline">
      <li><span class="when">2025</span><b>Stage industriel</b>, Borflex, Rouen (4 semaines)<br><span class="log-muted">Fabrication d'élastomères : sablage, collage, coulée de polyuréthane, enrobage caoutchouc, finition, vérification des devis, emballage</span></li>
    </ul>`,

  simulx: `
    <p class="log-kicker">PROXION · SIMULX_5 · ENSAM 2024-2025</p>
    <h2>Jumeau numérique d'une presse à injecter</h2>
    <p>Création du jumeau numérique d'une presse à injection plastique pour observer son fonctionnement en temps réel : de la CAO à l'animation des différentes étapes du procédé, jusqu'au rendu en réalité virtuelle.</p>
    <p class="log-tags">CATIA · Unity</p>
    <button class="log-button" data-gallery="sim3d" type="button">Voir le projet</button>`,

  glenos: `
    <p class="log-kicker">PROXION · GLÉNOS · ENSAM 2025-2026</p>
    <h2>Prothèse d'épaule</h2>
    <p>Conception d'un implant glénoïdien en polyéthylène UHMWPE pour limiter l'effet « rocking horse », le basculement de l'implant qui finit par le desceller.</p>
    <p>Modélisation sous CATIA, analyse par éléments finis sous Abaqus et essais in vivo.</p>
    <p class="log-tags">CATIA · Abaqus · éléments finis</p>`,

  enedis: `
    <p class="log-kicker">PROXION · ENEDIS · ENSAM 2025-2026</p>
    <h2>Enedis Data Challenge</h2>
    <p>Développement d'un modèle d'apprentissage automatique qui prédit les données manquantes à partir des historiques existants.</p>
    <p class="log-muted">Sur la lune, les cubes verts sont les mesures connues, les cubes orange celles que le modèle reconstitue.</p>
    <p class="log-tags">Python · apprentissage automatique · séries temporelles</p>`,

  ricochet: `
    <p class="log-kicker">PROXION · RICOCHET · PC* 2024</p>
    <h2>TIPE : la physique des ricochets</h2>
    <p>Étude expérimentale de la dynamique d'un galet qui ricoche sur l'eau, et comparaison avec les modèles théoriques.</p>`,

  c4d3x: `
    <p class="log-kicker">PROXION · C4D3X</p>
    <h2>Code et projets personnels</h2>
    <ul>
      <li><b>Bibliothèque multimédia locale</b> : analyse automatiquement les fichiers et récupère leurs informations dans des bases de données en ligne</li>
      <li><b>Ce portfolio</b> : système solaire interactif en Three.js, avec des modèles 3D faits main</li>
    </ul>
    <p class="log-tags">Python · SQL · JavaScript · Three.js · LaTeX</p>`,

  // ----- MUSA · arts et transmission -----
  musa: `
    <p class="log-kicker">MUSA · arts et transmission</p>
    <h2>Arts et transmission</h2>
    <p>La photographie, la musique et le goût de transmettre occupent une place aussi importante que les sciences dans mon parcours.</p>
    <ul>
      <li><b>EXP_//223</b> : photographie et exposition</li>
      <li><b>NOCTURNE</b> : musique</li>
      <li><b>LOG_EX</b> : enseignement et prise de parole</li>
    </ul>`,

  exp: `
    <p class="log-kicker">MUSA · EXP_//223</p>
    <h2>Exposition « L'Attente »</h2>
    <p class="log-sub">Décembre 2023 · Galerie L'Embrasser, île Saint-Louis, Paris</p>
    <p>Exposition de photographie argentique dont j'étais le seul artiste exposé.</p>
    <h3>Édition</h3>
    <ul>
      <li>Photographe pour <i>Histoire de la bibliophilie</i> de Christian Galantaris (Ipagine, 2024)</li>
      <li>Photographe pour le roman graphique <i>Mes années brumes</i> de Jean-Gabriel Montador (Ipagine, 2023)</li>
    </ul>
    <button class="log-button" data-gallery="expo" type="button">Voir l'exposition</button>`,

  nocturne: `
    <p class="log-kicker">MUSA · NOCTURNE</p>
    <h2>Musique</h2>
    <p>Dix ans au Conservatoire à rayonnement régional de Rouen (2012-2022) : piano et musique de chambre (certificats d'études musicales), écriture et formation musicale.</p>
    <p>Je joue surtout le répertoire classique et romantique, et je compose avec l'aide de l'ordinateur.</p>
    <p class="log-links"><a href="https://soundcloud.com/user-163788646-509251636" target="_blank" rel="noopener">SoundCloud</a></p>`,

  logex: `
    <p class="log-kicker">MUSA · LOG_EX</p>
    <h2>Transmettre et prendre la parole</h2>
    <ul class="log-timeline">
      <li><span class="when">2026</span><b>Table ronde sur la souveraineté spatiale</b>, organisée et animée au 47e Forum Arts et Métiers (Paris), avec le CEO de ThrustMe, le président de l'Observatoire de Paris-PSL et le responsable des relations publiques de MaiaSpace</li>
      <li><span class="when">2025-26</span><b>Concours d'éloquence</b> universitaire, Cluny : participation en 2025, 3e place en 2026 · <a href="https://www.youtube.com/watch?v=_RCy0VlvdUQ&list=PLTTBdPeOTS-h5duX9-Byo_IA9M5DWnXqG&index=8" target="_blank" rel="noopener">vidéo</a></li>
      <li><span class="when">2024-25</span><b>Tutorat bénévole</b>, Cordées de la réussite <a href="https://artsetmetiers.fr/fr/actualites/campus-de-cluny-cordee-de-la-reussite-optim-avec-axel-mannu" target="_blank" rel="noopener">OPTIM</a>, auprès d'élèves de l'éducation prioritaire</li>
      <li><span class="when">2020-26</span><b>Cours particuliers</b> pour lycéens : mathématiques, physique, français, piano</li>
    </ul>`,
};

export const GALLERIES = {
  sim3d: {
    title: "Jumeau numérique d'une presse à injecter",
    kicker: 'SIMULX_5 · archives',
    images: [
      { src: `${BASE}sim3d_1.jpg.png`, alt: 'Capture du jumeau numérique 1' },
      { src: `${BASE}sim3d_2.jpg.png`, alt: 'Capture du jumeau numérique 2' },
      { src: `${BASE}sim3d_3.jpg.png`, alt: 'Capture du jumeau numérique 3' },
    ],
  },
  expo: {
    title: "Exposition « L'Attente »",
    kicker: 'EXP_//223 · archives',
    images: [
      { src: `${BASE}expo_1.jpg.png`, alt: "Photographie de l'exposition 1" },
      { src: `${BASE}expo_2.jpg.png`, alt: "Photographie de l'exposition 2" },
    ],
  },
};
