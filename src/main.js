import * as THREE from 'three';
import { EventLedger, detectConflicts } from './domain/ledger.ts';
import { MetaAdapter } from './services/metaAdapter.ts';
import {
  MOCK_EVIDENCE_SCREENSHOT,
  MOCK_EVIDENCE_AUDIO,
  MOCK_DILEMMA_DRAFT,
  MOCK_CLASS_DRAFT,
  MOCK_REFINED_BOX,
  MOCK_CLASS_ANCHOR_TURN,
} from './services/fixtures.ts';

// ============================================================================
// ARCADIA 3D · THE LIVING SANCTUARY (THREE.JS ENGINE)
// ============================================================================

const canvas = document.getElementById('webgl-canvas');
const promptElem = document.getElementById('interaction-prompt');
const promptText = document.getElementById('prompt-action-text');
const journalModal = document.getElementById('journal-modal');
const btnCloseJournal = document.getElementById('btn-close-journal');
const btnWeather = document.getElementById('btn-weather');
const weatherIcon = document.getElementById('weather-icon');
const weatherText = document.getElementById('weather-text');
const btnAudio = document.getElementById('btn-audio');
const btnToggleLedger = document.getElementById('btn-toggle-ledger');
const btnCloseLedger = document.getElementById('btn-close-ledger');
const ledgerDrawer = document.getElementById('ledger-drawer');
const ledgerEventsContainer = document.getElementById('ledger-events-container');
const hudLedgerCount = document.getElementById('hud-ledger-count');
const hudChainStatus = document.getElementById('hud-chain-status');
const btnRewind = document.getElementById('btn-rewind');

// RENDERER
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

// SCENE & ATMOSPHERE
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x120d09);
scene.fog = new THREE.FogExp2(0x1a130d, 0.035);

// CAMERA
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 4.5, 7.5);

// LIGHTS
const ambientLight = new THREE.AmbientLight(0xffecd1, 0.8);
scene.add(ambientLight);

// Luz del sol a través de la ventana (Golden Hour)
const sunLight = new THREE.DirectionalLight(0xf59e0b, 2.8);
sunLight.position.set(-6, 7, -3);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 25;
sunLight.shadow.camera.left = -6;
sunLight.shadow.camera.right = 6;
sunLight.shadow.camera.top = 6;
sunLight.shadow.camera.bottom = -6;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

// Lámpara de escritorio cálida
const deskLampLight = new THREE.PointLight(0xffaa33, 2.0, 4.5);
deskLampLight.position.set(2.4, 2.1, -1.8);
deskLampLight.castShadow = true;
scene.add(deskLampLight);

// ============================================================================
// PROCEDURAL TEXTURES (PISOS Y DETALLES DE MADERA REALISTA)
// ============================================================================
function createWoodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#452b1b';
  ctx.fillRect(0, 0, 512, 512);

  // Vetas de madera
  ctx.fillStyle = '#3a2315';
  for (let i = 0; i < 512; i += 64) {
    ctx.fillRect(0, i, 512, 2);
  }
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = 'rgba(25, 14, 8, 0.15)';
    ctx.fillRect(Math.random() * 512, 0, Math.random() * 8 + 2, 512);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

const woodTex = createWoodTexture();

// ============================================================================
// CONSTRUCCIÓN DEL ESPACIO 3D (LA HABITACIÓN / SANTUARIO)
// ============================================================================
const roomGroup = new THREE.Group();
scene.add(roomGroup);

// PISO DE MADERA
const floorGeo = new THREE.PlaneGeometry(12, 12);
const floorMat = new THREE.MeshStandardMaterial({
  map: woodTex,
  roughness: 0.55,
  metalness: 0.1
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
roomGroup.add(floor);

// ALFOMBRA VINTAGE REDONDA
const rugGeo = new THREE.CircleGeometry(2.4, 32);
const rugMat = new THREE.MeshStandardMaterial({ color: 0x7c4f32, roughness: 0.9 });
const rug = new THREE.Mesh(rugGeo, rugMat);
rug.rotation.x = -Math.PI / 2;
rug.position.set(0, 0.01, 0.5);
rug.receiveShadow = true;
roomGroup.add(rug);

// PAREDES
const wallMat = new THREE.MeshStandardMaterial({ color: 0x241d17, roughness: 0.85 });

// Pared Norte (Fondo con Ventana)
const northWallGeo = new THREE.BoxGeometry(12, 6, 0.4);
const northWall = new THREE.Mesh(northWallGeo, wallMat);
northWall.position.set(0, 3, -6);
northWall.receiveShadow = true;
roomGroup.add(northWall);

// Pared Oeste (Izquierda)
const westWallGeo = new THREE.BoxGeometry(0.4, 6, 12);
const westWall = new THREE.Mesh(westWallGeo, wallMat);
westWall.position.set(-6, 3, 0);
westWall.receiveShadow = true;
roomGroup.add(westWall);

// Pared Este (Derecha)
const eastWall = westWall.clone();
eastWall.position.set(6, 3, 0);
roomGroup.add(eastWall);

// ============================================================================
// VENTANA ARQUEADA Y VISTA AL MUNDO EXTERIOR (SKY / WEATHER)
// ============================================================================
const windowFrameGeo = new THREE.BoxGeometry(3.2, 4.2, 0.5);
const windowFrameMat = new THREE.MeshStandardMaterial({ color: 0x422d1f, roughness: 0.6 });
const windowFrame = new THREE.Mesh(windowFrameGeo, windowFrameMat);
windowFrame.position.set(-2.8, 3.2, -5.9);
roomGroup.add(windowFrame);

// Vidrio con cielo
const glassGeo = new THREE.PlaneGeometry(2.8, 3.8);
const glassMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.65 });
const windowGlass = new THREE.Mesh(glassGeo, glassMat);
windowGlass.position.set(-2.8, 3.2, -5.6);
roomGroup.add(windowGlass);

// Fondo Exterior de Arcadia Bay (Montañas / Bosque de Pinos)
const backdropGeo = new THREE.PlaneGeometry(8, 6);
const backdropMat = new THREE.MeshBasicMaterial({ color: 0xd97706 });
const backdrop = new THREE.Mesh(backdropGeo, backdropMat);
backdrop.position.set(-2.8, 3.2, -7.5);
scene.add(backdrop);

// ============================================================================
// MUEBLES 3D ESTILO LIFE IS STRANGE
// ============================================================================

// 1. MESA DE TRABAJO (DESK)
const deskGroup = new THREE.Group();
deskGroup.position.set(2.8, 0, -2.5);

const deskTopGeo = new THREE.BoxGeometry(3.4, 0.15, 1.8);
const deskTopMat = new THREE.MeshStandardMaterial({ color: 0x543725, roughness: 0.5 });
const deskTop = new THREE.Mesh(deskTopGeo, deskTopMat);
deskTop.position.y = 1.4;
deskTop.castShadow = true;
deskTop.receiveShadow = true;
deskGroup.add(deskTop);

// Patas de la mesa
const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.4);
const legMat = new THREE.MeshStandardMaterial({ color: 0x221812 });
[[-1.5, -0.7], [1.5, -0.7], [-1.5, 0.7], [1.5, 0.7]].forEach(([x, z]) => {
  const leg = new THREE.Mesh(legGeo, legMat);
  leg.position.set(x, 0.7, z);
  leg.castShadow = true;
  deskGroup.add(leg);
});

// Laptop sobre la mesa (Corriendo Lumina)
const laptopBase = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 0.5), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.8 }));
laptopBase.position.set(0.6, 1.48, 0);
laptopBase.castShadow = true;
deskGroup.add(laptopBase);

const laptopScreen = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.02), new THREE.MeshBasicMaterial({ color: 0x0f172a }));
laptopScreen.position.set(0.6, 1.7, -0.25);
laptopScreen.rotation.x = 0.2;
deskGroup.add(laptopScreen);

// Lámpara de escritorio vintage
const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.05), new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.7 }));
lampBase.position.set(1.2, 1.5, -0.6);
deskGroup.add(lampBase);

const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.35, 16), new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.3 }));
lampShade.position.set(1.2, 2.1, -0.6);
lampShade.rotation.x = 0.5;
deskGroup.add(lampShade);

// 2. EL CUADERNO DE MAX (OBJETO INTERACTIVO EN LA MESA)
const diaryGeo = new THREE.BoxGeometry(0.65, 0.08, 0.85);
const diaryMat = new THREE.MeshStandardMaterial({ color: 0x3d271d, roughness: 0.7 });
const diaryMesh = new THREE.Mesh(diaryGeo, diaryMat);
diaryMesh.position.set(-0.6, 1.5, 0.1);
diaryMesh.rotation.y = 0.25;
diaryMesh.castShadow = true;
deskGroup.add(diaryMesh);

// Taza de café humeante
const mugGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.25);
const mugMat = new THREE.MeshStandardMaterial({ color: 0xf3f4f6 });
const mugMesh = new THREE.Mesh(mugGeo, mugMat);
mugMesh.position.set(-1.2, 1.6, -0.3);
deskGroup.add(mugMesh);

roomGroup.add(deskGroup);

// 3. TOCADISCOS DE VINILO EN UN MUEBLE LATERAL
const turntableGroup = new THREE.Group();
turntableGroup.position.set(-4.8, 0, 1.2);

const ttStand = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 1.2), new THREE.MeshStandardMaterial({ color: 0x3a2518 }));
ttStand.position.y = 0.65;
ttStand.castShadow = true;
turntableGroup.add(ttStand);

// El plato del tocadiscos
const ttPlatter = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.04), new THREE.MeshStandardMaterial({ color: 0x111111 }));
ttPlatter.position.set(0, 1.32, 0);
turntableGroup.add(ttPlatter);

// Disco de vinilo girando
const vinylGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.02, 32);
const vinylMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.2, metalness: 0.9 });
const vinylDisc = new THREE.Mesh(vinylGeo, vinylMat);
vinylDisc.position.set(0, 1.34, 0);
turntableGroup.add(vinylDisc);

// Etiqueta amarilla en el centro del disco
const labelGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.025);
const labelMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
const vinylLabel = new THREE.Mesh(labelGeo, labelMat);
vinylLabel.position.set(0, 1.345, 0);
turntableGroup.add(vinylLabel);

roomGroup.add(turntableGroup);

// 4. ESTANTERÍA CON LIBROS Y PLANTAS
const shelfGroup = new THREE.Group();
shelfGroup.position.set(-4.8, 0, -3.5);
const shelfFrame = new THREE.Mesh(new THREE.BoxGeometry(1.4, 4.2, 0.6), new THREE.MeshStandardMaterial({ color: 0x2b1c13 }));
shelfFrame.position.y = 2.1;
shelfFrame.castShadow = true;
shelfGroup.add(shelfFrame);

// Libros de colores
const bookColors = [0xb91c1c, 0x1d4ed8, 0x047857, 0xb45309, 0x475569];
for (let i = 0; i < 7; i++) {
  const b = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.45 + Math.random() * 0.2, 0.35),
    new THREE.MeshStandardMaterial({ color: bookColors[i % bookColors.length] })
  );
  b.position.set(-0.4 + i * 0.14, 2.2, 0);
  shelfGroup.add(b);
}

roomGroup.add(shelfGroup);

// ============================================================================
// PARTÍCULAS DE POLVO FLOTANDO EN LA LUZ (ATMÓSFERA INDIE)
// ============================================================================
const dustCount = 200;
const dustGeo = new THREE.BufferGeometry();
const dustPositions = new Float32Array(dustCount * 3);

for (let i = 0; i < dustCount * 3; i += 3) {
  dustPositions[i] = (Math.random() - 0.5) * 8;
  dustPositions[i + 1] = Math.random() * 4.5 + 0.5;
  dustPositions[i + 2] = (Math.random() - 0.5) * 8;
}

dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
const dustMat = new THREE.PointsMaterial({
  color: 0xfcd34d,
  size: 0.04,
  transparent: true,
  opacity: 0.5,
  blending: THREE.AdditiveBlending
});
const dustParticles = new THREE.Points(dustGeo, dustMat);
scene.add(dustParticles);

// ============================================================================
// LA MARIPOSA AZUL 3D FLOTANTE (EL EFECTO MARIPOSA EN VIVO)
// ============================================================================
const butterflyGroup = new THREE.Group();
butterflyGroup.position.set(-1.2, 2.4, 0.2);

const wingGeo = new THREE.PlaneGeometry(0.28, 0.35);
const wingMat = new THREE.MeshBasicMaterial({
  color: 0x38bdf8,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.95
});

const leftWing = new THREE.Mesh(wingGeo, wingMat);
leftWing.position.x = -0.14;
leftWing.rotation.y = 0.3;
butterflyGroup.add(leftWing);

const rightWing = new THREE.Mesh(wingGeo, wingMat);
rightWing.position.x = 0.14;
rightWing.rotation.y = -0.3;
butterflyGroup.add(rightWing);

// Luz azul tenue que emite la mariposa
const butterflyLight = new THREE.PointLight(0x38bdf8, 1.2, 3.0);
butterflyGroup.add(butterflyLight);

scene.add(butterflyGroup);

// ============================================================================
// EL AVATAR 3D JUGABLE (PERSONAJE NARRATIVO CONTROLABLE CON WASD)
// ============================================================================
const avatar = new THREE.Group();
avatar.position.set(0, 0, 1.5);
scene.add(avatar);

// Cabeza y cabello
const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), new THREE.MeshStandardMaterial({ color: 0xfcd34d, roughness: 0.6 }));
headMesh.position.y = 1.6;
headMesh.castShadow = true;
avatar.add(headMesh);

const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.8 }));
hairMesh.position.set(0, 1.65, -0.05);
hairMesh.scale.set(1.05, 1.1, 1.15);
avatar.add(hairMesh);

// Torso con sudadera gris
const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.65, 0.28), new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 }));
bodyMesh.position.y = 1.15;
bodyMesh.castShadow = true;
avatar.add(bodyMesh);

// Mochila bandolera marrón
const bagMesh = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.4, 0.14), new THREE.MeshStandardMaterial({ color: 0x92400e }));
bagMesh.position.set(0, 1.12, -0.2);
avatar.add(bagMesh);

// Brazos
const armGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.55);
const armMat = new THREE.MeshStandardMaterial({ color: 0x475569 });

const leftArm = new THREE.Mesh(armGeo, armMat);
leftArm.position.set(-0.32, 1.15, 0);
avatar.add(leftArm);

const rightArm = new THREE.Mesh(armGeo, armMat);
rightArm.position.set(0.32, 1.15, 0);
avatar.add(rightArm);

// Piernas (para animación de caminata)
const legCharGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.7);
const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });

const leftLeg = new THREE.Mesh(legCharGeo, pantsMat);
leftLeg.position.set(-0.16, 0.45, 0);
leftLeg.castShadow = true;
avatar.add(leftLeg);

const rightLeg = new THREE.Mesh(legCharGeo, pantsMat);
rightLeg.position.set(0.16, 0.45, 0);
rightLeg.castShadow = true;
avatar.add(rightLeg);

// Zapatos marrones
const shoeGeo = new THREE.BoxGeometry(0.14, 0.12, 0.22);
const shoeMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
leftShoe.position.set(-0.16, 0.06, 0.05);
avatar.add(leftShoe);

const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
rightShoe.position.set(0.16, 0.06, 0.05);
avatar.add(rightShoe);

// ============================================================================
// CONTROLES DE MOVIMIENTO (WASD + MOUSE CAMERA)
// ============================================================================
const keys = { w: false, a: false, s: false, d: false };

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') keys.w = true;
  if (k === 'a' || k === 'arrowleft') keys.a = true;
  if (k === 's' || k === 'arrowdown') keys.s = true;
  if (k === 'd' || k === 'arrowright') keys.d = true;

  if (k === 'e') {
    handleInteraction();
  }
  if (e.key === 'Escape') {
    closeJournal();
  }
});

window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') keys.w = false;
  if (k === 'a' || k === 'arrowleft') keys.a = false;
  if (k === 's' || k === 'arrowdown') keys.s = false;
  if (k === 'd' || k === 'arrowright') keys.d = false;
});

// Orbit / Rotación con el ratón
let isDragging = false;
let prevMouseX = 0;
let cameraAngleY = 0;
let cameraDistance = 6.5;

window.addEventListener('mousedown', (e) => {
  if (e.target.id === 'webgl-canvas') {
    isDragging = true;
    prevMouseX = e.clientX;
  }
});

window.addEventListener('mouseup', () => isDragging = false);

window.addEventListener('mousemove', (e) => {
  if (isDragging) {
    const deltaX = e.clientX - prevMouseX;
    cameraAngleY += deltaX * 0.006;
    prevMouseX = e.clientX;
  }
});

window.addEventListener('wheel', (e) => {
  cameraDistance = Math.max(3.5, Math.min(10.0, cameraDistance + e.deltaY * 0.005));
});

// ============================================================================
// SISTEMA DE INTERACCIÓN ESPACIAL (PUNTOS CALIENTES 3D)
// ============================================================================
let activeHotspot = null;

function checkProximity() {
  const avPos = avatar.position;
  const distDesk = avPos.distanceTo(new THREE.Vector3(2.5, 0, -1.8));
  const distButterfly = avPos.distanceTo(butterflyGroup.position);
  const distTurntable = avPos.distanceTo(turntableGroup.position);
  const distWindow = avPos.distanceTo(new THREE.Vector3(-2.8, 0, -4.5));

  if (distDesk < 2.0) {
    activeHotspot = 'desk';
    promptText.innerText = "Abrir Cuaderno de Decisiones de Max";
    promptElem.classList.add('visible');
  } else if (distButterfly < 2.2) {
    activeHotspot = 'butterfly';
    promptText.innerText = "Tocar Mariposa / Explorar Efecto Mariposa";
    promptElem.classList.add('visible');
  } else if (distTurntable < 1.8) {
    activeHotspot = 'turntable';
    promptText.innerText = "Tocar Música Acústica (Life is Strange)";
    promptElem.classList.add('visible');
  } else if (distWindow < 2.2) {
    activeHotspot = 'window';
    promptText.innerText = "Mirar por la Ventana / Cambiar Clima";
    promptElem.classList.add('visible');
  } else {
    activeHotspot = null;
    promptElem.classList.remove('visible');
  }
}

function handleInteraction() {
  if (!activeHotspot) return;

  if (activeHotspot === 'desk' || activeHotspot === 'butterfly') {
    openJournal();
  } else if (activeHotspot === 'turntable') {
    toggleAudio();
  } else if (activeHotspot === 'window') {
    toggleWeather();
  }
}

function openJournal() {
  playAcousticNote(330);
  journalModal.classList.add('active');
}

function closeJournal() {
  playAcousticNote(220);
  journalModal.classList.remove('active');
}

btnCloseJournal.addEventListener('click', closeJournal);

// ============================================================================
// CLIMA Y ESTADO CAUSAL EN 3D (GOLDEN HOUR VS TORMENTA)
// ============================================================================
let isStormy = false;

function toggleWeather() {
  isStormy = !isStormy;
  setWorldState(isStormy);
}

btnWeather.addEventListener('click', toggleWeather);

function setWorldState(storm) {
  playAcousticNote(storm ? 180 : 392);
  if (storm) {
    sunLight.color.setHex(0x38bdf8);
    sunLight.intensity = 0.9;
    ambientLight.color.setHex(0x1e293b);
    backdrop.material.color.setHex(0x0f172a);
    windowGlass.material.color.setHex(0x0284c7);
    weatherIcon.innerText = "🌧️";
    weatherText.innerText = "Tormenta de Dudas";
  } else {
    sunLight.color.setHex(0xf59e0b);
    sunLight.intensity = 2.8;
    ambientLight.color.setHex(0xffecd1);
    backdrop.material.color.setHex(0xd97706);
    windowGlass.material.color.setHex(0xf59e0b);
    weatherIcon.innerText = "☀️";
    weatherText.innerText = "Atardecer Dorado";
  }
}

// ============================================================================
// VERIFIABLE CRYPTOGRAPHIC LEDGER ENGINE (SHA-256 HASH CHAIN)
// ============================================================================
const ledger = new EventLedger();
const adapter = new MetaAdapter({ mock: true });

// Step 1: Ingest multimodal evidence into append-only ledger
ledger.append('evidence.ingested', { evidence: MOCK_EVIDENCE_SCREENSHOT });
ledger.append('evidence.ingested', { evidence: MOCK_EVIDENCE_AUDIO });

// Step 2: Propose verified commitments anchored to SAM 3.1 & Muse Voice
const c1 = {
  ...MOCK_DILEMMA_DRAFT,
  id: 'com-mariana-design',
  anchor: {
    evidenceId: MOCK_EVIDENCE_SCREENSHOT.id,
    box: MOCK_REFINED_BOX,
    confidence: 0.961,
  },
  status: 'proposed',
  recordedAt: '2026-11-03T09:41:00-03:00',
};
ledger.append('commitment.proposed', { commitment: c1 });

const c2 = {
  ...MOCK_CLASS_DRAFT,
  id: 'com-calculus-class',
  anchor: {
    evidenceId: MOCK_EVIDENCE_AUDIO.id,
    audioTurn: MOCK_CLASS_ANCHOR_TURN,
    confidence: 0.985,
  },
  status: 'proposed',
  recordedAt: '2026-11-03T21:14:00-03:00',
};
ledger.append('commitment.proposed', { commitment: c2 });

// Step 3: Run causal schedule collision detector
const detectedConflicts = detectConflicts([c1, c2], new Date().toISOString());
if (detectedConflicts.length > 0) {
  ledger.append('conflict.detected', { conflict: detectedConflicts[0] });
}

function renderLedgerUI() {
  const events = ledger.listEvents();
  if (hudLedgerCount) hudLedgerCount.innerText = events.length;

  const verification = ledger.verify();
  if (hudChainStatus) {
    if (verification.valid) {
      hudChainStatus.innerHTML = `<span style="color:#10b981;">✓ Validado (${verification.checked} bloques)</span>`;
    } else {
      hudChainStatus.innerHTML = `<span style="color:#ef4444;">✗ Corrupción detectada</span>`;
    }
  }

  if (ledgerEventsContainer) {
    ledgerEventsContainer.innerHTML = events
      .map(
        (ev) => `
      <div class="event-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <strong style="color:#fbbf24;">#${ev.seq} · ${ev.type}</strong>
          <span style="color:#94a3b8;font-size:9px;">${ev.timestamp.slice(11, 19)}</span>
        </div>
        <div style="color:#cbd5e1;font-size:10px;margin-bottom:4px;">
          prevHash: <span class="hash-text">${ev.prevHash.slice(0, 16)}...</span>
        </div>
        <div style="color:#cbd5e1;font-size:10px;">
          hash: <span class="hash-text" style="color:#38bdf8;font-weight:bold;">${ev.hash.slice(0, 24)}...</span>
        </div>
      </div>
    `,
      )
      .join('');
  }
}

renderLedgerUI();

// Ledger Drawer toggle
if (btnToggleLedger && ledgerDrawer) {
  btnToggleLedger.addEventListener('click', () => {
    ledgerDrawer.classList.toggle('active');
  });
}

if (btnCloseLedger && ledgerDrawer) {
  btnCloseLedger.addEventListener('click', () => {
    ledgerDrawer.classList.remove('active');
  });
}

// Rewind (Bitemporal asOf query)
if (btnRewind) {
  btnRewind.addEventListener('click', () => {
    playAcousticNote(440);
    // Rewind back to before the conflict occurred
    const snapshotPast = ledger.asOf('2026-11-03T10:00:00-03:00');
    setWorldState(false);
    alert(
      `⏪ REWIND TEMPORAL EJECUTADO (asOf: 2026-11-03 10:00)\n\n` +
      `El ledger ha retrocedido en el tiempo:\n` +
      `• Compromisos activos en ese instante: ${snapshotPast.commitments.length} (sin conflicto)\n` +
      `• El santuario 3D vuelve al estado previo a la decisión.`
    );
  });
}

// BOTONES DE ELECCIÓN EN EL DIARIO
document.getElementById('choice-a').addEventListener('click', () => {
  ledger.append('commitment.verified', {
    commitmentId: c1.id,
    anchor: c1.anchor,
    verifiedAt: new Date().toISOString(),
  });
  renderLedgerUI();
  setWorldState(true);
  alert(
    `⚡ SENDA A SELLADA EN EL LEDGER\n\n` +
    `Se ha añadido el bloque #${ledger.size} con hash criptográfico.\n` +
    `Consecuencia: Tu tiempo colapsa y se desata una tormenta en el santuario 3D.`
  );
  closeJournal();
});

document.getElementById('choice-b').addEventListener('click', () => {
  ledger.append('commitment.verified', {
    commitmentId: c1.id,
    anchor: c1.anchor,
    verifiedAt: new Date().toISOString(),
  });
  renderLedgerUI();
  setWorldState(false);
  alert(
    `✨ SENDA B SELLADA EN EL LEDGER\n\n` +
    `Se ha añadido el bloque #${ledger.size} con hash criptográfico.\n` +
    `Consecuencia: Asistencia protegida, calma mental y luz dorada en el santuario 3D.`
  );
  closeJournal();
});

// ============================================================================
// AUDIO PROCEDURAL INDIE (WEB AUDIO )
// ============================================================================
let audioCtx = null;
let isAudioPlaying = false;
let audioTimer = null;

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playAcousticNote(freq = 220) {
  initAudio();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 1.5);
}

function toggleAudio() {
  initAudio();
  if (isAudioPlaying) {
    clearInterval(audioTimer);
    isAudioPlaying = false;
    document.getElementById('audio-text').innerText = "Música Indie (Pausada)";
  } else {
    isAudioPlaying = true;
    document.getElementById('audio-text').innerText = "Sonando: Syd Matters · Obstacles";
    const chords = [220, 261.63, 329.63, 392.00, 329.63, 261.63];
    let step = 0;
    playAcousticNote(chords[0]);
    audioTimer = setInterval(() => {
      step = (step + 1) % chords.length;
      playAcousticNote(chords[step]);
    }, 1100);
  }
}

btnAudio.addEventListener('click', toggleAudio);

// ============================================================================
// BUCLE DE ANIMACIÓN Y FÍSICA DE MOVIMIENTO
// ============================================================================
let walkCycle = 0;
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  // 1. ROTACIÓN DEL DISCO DE VINILO
  vinylDisc.rotation.y += 0.03;

  // 2. ALETEO Y VUELO DE LA MARIPOSA AZUL
  leftWing.rotation.y = Math.sin(time * 14) * 0.7;
  rightWing.rotation.y = -Math.sin(time * 14) * 0.7;
  butterflyGroup.position.y = 2.2 + Math.sin(time * 2.5) * 0.25;
  butterflyGroup.position.x = -1.2 + Math.cos(time * 1.2) * 0.8;
  butterflyGroup.position.z = 0.2 + Math.sin(time * 1.5) * 0.8;

  // 3. FLOTACIÓN DE POLVO EN LOS RAYOS DE LUZ
  const dustPos = dustParticles.geometry.attributes.position.array;
  for (let i = 1; i < dustCount * 3; i += 3) {
    dustPos[i] -= 0.002;
    if (dustPos[i] < 0.2) dustPos[i] = 4.8;
  }
  dustParticles.geometry.attributes.position.needsUpdate = true;

  // 4. MOVIMIENTO DEL AVATAR CON TECLADO
  const moveVector = new THREE.Vector3();
  if (keys.w) moveVector.z -= 1;
  if (keys.s) moveVector.z += 1;
  if (keys.a) moveVector.x -= 1;
  if (keys.d) moveVector.x += 1;

  const isMoving = moveVector.lengthSq() > 0;

  if (isMoving && !journalModal.classList.contains('active')) {
    moveVector.normalize();

    // Rotar según el ángulo de la cámara
    moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngleY);

    // Mover avatar
    const speed = 3.2 * delta;
    avatar.position.x += moveVector.x * speed;
    avatar.position.z += moveVector.z * speed;

    // Límites de la habitación
    avatar.position.x = Math.max(-5.0, Math.min(5.0, avatar.position.x));
    avatar.position.z = Math.max(-5.0, Math.min(5.0, avatar.position.z));

    // Rotación suave del avatar hacia donde camina
    const targetAngle = Math.atan2(moveVector.x, moveVector.z);
    avatar.rotation.y = THREE.MathUtils.lerp(avatar.rotation.y, targetAngle, 0.15);

    // Animación de caminata
    walkCycle += delta * 12;
    leftLeg.rotation.x = Math.sin(walkCycle) * 0.65;
    rightLeg.rotation.x = -Math.sin(walkCycle) * 0.65;
    leftArm.rotation.x = -Math.sin(walkCycle) * 0.5;
    rightArm.rotation.x = Math.sin(walkCycle) * 0.5;
    avatar.position.y = Math.abs(Math.sin(walkCycle)) * 0.06;
  } else {
    // Respiración idle
    leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, 0, 0.1);
    rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, 0, 0.1);
    leftArm.rotation.x = Math.sin(time * 2) * 0.05;
    rightArm.rotation.x = -Math.sin(time * 2) * 0.05;
    avatar.position.y = Math.sin(time * 2) * 0.02;
  }

  // 5. CÁMARA TERCERA PERSONA SUAVE (FOLLOW CAMERA)
  const targetCamX = avatar.position.x + Math.sin(cameraAngleY) * cameraDistance;
  const targetCamZ = avatar.position.z + Math.cos(cameraAngleY) * cameraDistance;
  const targetCamY = avatar.position.y + 3.2;

  camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCamX, 0.08);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCamY, 0.08);
  camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCamZ, 0.08);
  camera.lookAt(avatar.position.x, avatar.position.y + 1.2, avatar.position.z);

  // 6. DETECCIÓN DE PROXIMIDAD
  checkProximity();

  renderer.render(scene, camera);
}

animate();

// RESIZE HANDLER
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

