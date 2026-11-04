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
// ARCADIA 3D · THE LIVING SANCTUARY (LIFE IS STRANGE AESTHETIC ENGINE)
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
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;

// SCENE & ATMOSPHERE
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x24160e);
scene.fog = new THREE.FogExp2(0x382214, 0.024);

// CAMERA
const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 4.2, 7.2);

// LIGHTS
// 1. Hemispheric ambient light (Warm golden sky bounce + dark wooden floor bounce)
const hemiLight = new THREE.HemisphereLight(0xffecd6, 0x422618, 1.4);
scene.add(hemiLight);

// 2. Main Golden Sunbeam pouring through window
const sunLight = new THREE.DirectionalLight(0xf59e0b, 3.8);
sunLight.position.set(-7, 7, -3.5);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 28;
sunLight.shadow.camera.left = -7;
sunLight.shadow.camera.right = 7;
sunLight.shadow.camera.top = 7;
sunLight.shadow.camera.bottom = -7;
sunLight.shadow.bias = -0.0004;
sunLight.shadow.radius = 2.5;
scene.add(sunLight);

// 3. Warm desk lamp point light
const deskLampLight = new THREE.PointLight(0xffa726, 2.4, 6.0, 1.2);
deskLampLight.position.set(2.8, 2.3, -2.4);
deskLampLight.castShadow = true;
deskLampLight.shadow.bias = -0.0008;
scene.add(deskLampLight);

// 4. Subtle cozy warm fill light over the bed & fairy lights
const bedFillLight = new THREE.PointLight(0xfcd34d, 1.2, 7.0, 1.5);
bedFillLight.position.set(-3.6, 2.8, -2.8);
scene.add(bedFillLight);

// ============================================================================
// PROCEDURAL CANVAS TEXTURES (ATMÓSFERA VISUAL RICA & ESTILIZADA)
// ============================================================================

// 1. Piso de madera cálida con vetas y ranuras
function createWoodFloorTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6e472a';
  ctx.fillRect(0, 0, 1024, 1024);

  // Tablones horizontales
  const plankHeight = 128;
  for (let y = 0; y < 1024; y += plankHeight) {
    const tone = Math.sin(y * 0.1) * 15;
    ctx.fillStyle = `rgb(${110 + tone}, ${71 + tone * 0.7}, ${42 + tone * 0.4})`;
    ctx.fillRect(0, y, 1024, plankHeight);

    // Vetas de madera
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = 'rgba(40, 22, 12, 0.08)';
      ctx.fillRect(Math.random() * 1024, y, Math.random() * 20 + 5, plankHeight);
    }

    // Línea de unión entre tablones
    ctx.fillStyle = '#2b170c';
    ctx.fillRect(0, y + plankHeight - 3, 1024, 3);
    ctx.fillStyle = 'rgba(255, 230, 190, 0.12)';
    ctx.fillRect(0, y, 1024, 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

// 2. Paredes cálidas tipo yeso / papel tapiz vintage de Blackwell
function createWallTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  // Color crema / beige cálido característico de Life is Strange
  ctx.fillStyle = '#dfd3c0';
  ctx.fillRect(0, 0, 512, 512);

  // Textura sutil estucada
  for (let i = 0; i < 6000; i++) {
    const v = Math.random() * 20 - 10;
    ctx.fillStyle = `rgba(${200 + v}, ${190 + v}, ${170 + v}, 0.15)`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }

  // Franjas verticales muy tenues de papel tapiz retro
  ctx.fillStyle = 'rgba(180, 160, 140, 0.08)';
  for (let x = 0; x < 512; x += 48) {
    ctx.fillRect(x, 0, 24, 512);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  return tex;
}

// 3. Alfombra bohemia / navajo con motivos geométricos y flecos
function createNavajoRugTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#993d28'; // Terracota base
  ctx.fillRect(0, 0, 512, 512);

  // Bordes geométricos
  ctx.strokeStyle = '#f3e8d2';
  ctx.lineWidth = 8;
  ctx.strokeRect(20, 20, 472, 472);

  ctx.strokeStyle = '#2d3748';
  ctx.lineWidth = 6;
  ctx.strokeRect(36, 36, 440, 440);

  // Diamante central navajo
  ctx.fillStyle = '#d97706';
  ctx.beginPath();
  ctx.moveTo(256, 100);
  ctx.lineTo(400, 256);
  ctx.lineTo(256, 412);
  ctx.lineTo(112, 256);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(256, 150);
  ctx.lineTo(350, 256);
  ctx.lineTo(256, 362);
  ctx.lineTo(162, 256);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(256, 200);
  ctx.lineTo(300, 256);
  ctx.lineTo(256, 312);
  ctx.lineTo(212, 256);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// 4. Manta escocesa / tartán para la cama
function createBlanketTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#831843'; // Granate profundo
  ctx.fillRect(0, 0, 512, 512);

  // Rayas azul marino y verde bosque
  ctx.fillStyle = 'rgba(30, 58, 138, 0.6)';
  for (let i = 0; i < 512; i += 64) {
    ctx.fillRect(i, 0, 24, 512);
    ctx.fillRect(0, i, 512, 24);
  }

  ctx.fillStyle = 'rgba(234, 179, 8, 0.7)';
  for (let i = 16; i < 512; i += 64) {
    ctx.fillRect(i, 0, 4, 512);
    ctx.fillRect(0, i, 512, 4);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

// 5. Textura de foto Polaroid realista
function createPolaroidTexture(caption, type) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 320;
  const ctx = c.getContext('2d');

  // Marco blanco Polaroid
  ctx.fillStyle = '#faf8f5';
  ctx.fillRect(0, 0, 256, 320);

  // Foto interior
  const imgY = 16;
  const imgX = 16;
  const imgW = 224;
  const imgH = 224;

  if (type === 'lighthouse') {
    // Faro de Arcadia Bay al atardecer
    const grad = ctx.createLinearGradient(0, imgY, 0, imgY + imgH);
    grad.addColorStop(0, '#f97316');
    grad.addColorStop(0.5, '#facc15');
    grad.addColorStop(1, '#0284c7');
    ctx.fillStyle = grad;
    ctx.fillRect(imgX, imgY, imgW, imgH);

    // Océano y acantilado
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(imgX, imgY + 160, imgW, 64);
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(imgX, imgY + 224);
    ctx.lineTo(imgX + 110, imgY + 140);
    ctx.lineTo(imgX + 160, imgY + 224);
    ctx.fill();

    // Silueta de Faro blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(imgX + 70, imgY + 95, 14, 50);
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(imgX + 77, imgY + 95, 12, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'chat') {
    // Evidencia WhatsApp con máscara SAM 3.1
    ctx.fillStyle = '#0b141a';
    ctx.fillRect(imgX, imgY, imgW, imgH);
    // Bubble
    ctx.fillStyle = '#202c33';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.fillRect(imgX + 20, imgY + 40, imgW - 40, 80);
    ctx.strokeRect(imgX + 20, imgY + 40, imgW - 40, 80);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('[SAM 3.1 MASK]', imgX + 30, imgY + 60);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '10px sans-serif';
    ctx.fillText('Entrega Jueves 4 PM', imgX + 30, imgY + 80);
    ctx.fillText('$200 acordados', imgX + 30, imgY + 98);
  } else if (type === 'guitar') {
    // Guitarra acústica en la habitación
    ctx.fillStyle = '#451a03';
    ctx.fillRect(imgX, imgY, imgW, imgH);
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.ellipse(imgX + 112, imgY + 150, 50, 60, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.arc(imgX + 112, imgY + 130, 18, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Paisaje de bosque de pinos
    const grad = ctx.createLinearGradient(0, imgY, 0, imgY + imgH);
    grad.addColorStop(0, '#fbbf24');
    grad.addColorStop(1, '#065f46');
    ctx.fillStyle = grad;
    ctx.fillRect(imgX, imgY, imgW, imgH);
    ctx.fillStyle = '#064e3b';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(imgX + 30 + i * 40, imgY + 80);
      ctx.lineTo(imgX + 50 + i * 40, imgY + 224);
      ctx.lineTo(imgX + 10 + i * 40, imgY + 224);
      ctx.fill();
    }
  }

  // Texto a mano en la parte inferior
  ctx.fillStyle = '#3d2e1f';
  ctx.font = '18px "Patrick Hand", cursive, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(caption, 128, 285);

  return new THREE.CanvasTexture(c);
}

// 6. Textura de corcho con notas y pruebas conectadas con hilo rojo
function createCorkboardTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  // Corcho granulado
  ctx.fillStyle = '#bc8a5f';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8000; i++) {
    const v = Math.random() * 30 - 15;
    ctx.fillStyle = `rgb(${188 + v}, ${138 + v}, ${95 + v})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
  }

  // Notas adhesivas
  // Nota amarilla
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(60, 60, 110, 110);
  ctx.fillStyle = '#713f12';
  ctx.font = '14px sans-serif';
  ctx.fillText('Entrega Mariana', 70, 95);
  ctx.fillText('Jueves 4 PM', 70, 120);

  // Nota azul
  ctx.fillStyle = '#bae6fd';
  ctx.fillRect(320, 80, 120, 110);
  ctx.fillStyle = '#0c4a6e';
  ctx.fillText('Clase Cálculo', 330, 115);
  ctx.fillText('Jueves 3 PM', 330, 140);

  // Chinchetas rojas
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(115, 70, 6, 0, Math.PI * 2);
  ctx.arc(380, 90, 6, 0, Math.PI * 2);
  ctx.fill();

  // Hilo rojo que conecta el conflicto (Tesis de Arcadia)
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(115, 70);
  ctx.bezierCurveTo(240, 160, 260, 30, 380, 90);
  ctx.stroke();

  // Etiqueta de Conflicto en el centro del hilo
  ctx.fillStyle = '#fee2e2';
  ctx.fillRect(200, 120, 110, 30);
  ctx.strokeStyle = '#ef4444';
  ctx.strokeRect(200, 120, 110, 30);
  ctx.fillStyle = '#b91c1c';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('! CONFLICT !', 215, 140);

  return new THREE.CanvasTexture(c);
}

// 7. Textura de rostro estilizado de Max Caulfield (pecas, ojos expresivos)
function createMaxFaceTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');

  // Piel cálida
  ctx.fillStyle = '#fde2cc';
  ctx.fillRect(0, 0, 256, 256);

  // Rubor en las mejillas
  ctx.fillStyle = 'rgba(244, 114, 182, 0.25)';
  ctx.beginPath();
  ctx.arc(60, 145, 30, 0, Math.PI * 2);
  ctx.arc(196, 145, 30, 0, Math.PI * 2);
  ctx.fill();

  // Pecas icónicas de Max
  ctx.fillStyle = '#b45309';
  const freckles = [
    [70, 135], [85, 140], [100, 145], [115, 143], [140, 143],
    [155, 145], [170, 140], [185, 135], [128, 138], [110, 152], [145, 152]
  ];
  freckles.forEach(([x, y]) => {
    ctx.fillRect(x, y, 3, 3);
  });

  // Ojos azules / avellana grandes
  [[75, 110], [180, 110]].forEach(([x, y]) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();

    // Brillo en los ojos
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - 3, y - 3, 3, 0, Math.PI * 2);
    ctx.fill();

    // Pestañas sutiles
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y - 2, 17, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  });

  // Cejas suaves
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(55, 85);
  ctx.quadraticCurveTo(75, 80, 95, 88);
  ctx.moveTo(160, 88);
  ctx.quadraticCurveTo(180, 80, 200, 85);
  ctx.stroke();

  // Sonrisa discreta
  ctx.strokeStyle = '#9a3412';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(128, 170, 14, 0.2, Math.PI - 0.2);
  ctx.stroke();

  return new THREE.CanvasTexture(c);
}

// 8. Textura de póster indie en la pared
function createPosterTexture(title, band) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 360;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#1c1917';
  ctx.fillRect(0, 0, 256, 360);

  // Gráfico geométrico vintage
  const grad = ctx.createLinearGradient(0, 0, 256, 360);
  grad.addColorStop(0, '#f59e0b');
  grad.addColorStop(0.5, '#ec4899');
  grad.addColorStop(1, '#3b82f6');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(128, 160, 85, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.arc(128, 160, 45, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fef3c7';
  ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(band, 128, 50);

  ctx.font = '14px "Patrick Hand", cursive';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(title, 128, 300);
  ctx.fillText('BLACKWELL MUSIC FESTIVAL · 2026', 128, 325);

  return new THREE.CanvasTexture(c);
}

// ============================================================================
// CONSTRUCCIÓN DEL SANTUARIO 3D (HABITACIÓN DE MAX EN ARCADIA BAY)
// ============================================================================

const roomGroup = new THREE.Group();
scene.add(roomGroup);

// PISO DE MADERA CÁLIDA
const floorGeo = new THREE.PlaneGeometry(13, 13);
const floorMat = new THREE.MeshStandardMaterial({
  map: createWoodFloorTexture(),
  roughness: 0.45,
  metalness: 0.08
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
roomGroup.add(floor);

// ALFOMBRA BOHEMIA NAVAJO
const rugGeo = new THREE.PlaneGeometry(3.6, 2.8);
const rugMat = new THREE.MeshStandardMaterial({
  map: createNavajoRugTexture(),
  roughness: 0.92,
  metalness: 0.02
});
const rug = new THREE.Mesh(rugGeo, rugMat);
rug.rotation.x = -Math.PI / 2;
rug.position.set(0.2, 0.015, 0.4);
rug.receiveShadow = true;
roomGroup.add(rug);

// PAREDES CÁLIDAS CON TEXTURA ESTILIZADA
const wallTex = createWallTexture();
const wallMat = new THREE.MeshStandardMaterial({
  map: wallTex,
  color: 0xffffff,
  roughness: 0.82,
  metalness: 0.02
});

// Pared Norte (Fondo con Ventana y Corcho)
const northWallGeo = new THREE.BoxGeometry(13, 6.5, 0.4);
const northWall = new THREE.Mesh(northWallGeo, wallMat);
northWall.position.set(0, 3.25, -6.5);
northWall.receiveShadow = true;
roomGroup.add(northWall);

// Pared Oeste (Izquierda - Cama y Luces de Hada)
const westWallGeo = new THREE.BoxGeometry(0.4, 6.5, 13);
const westWall = new THREE.Mesh(westWallGeo, wallMat);
westWall.position.set(-6.5, 3.25, 0);
westWall.receiveShadow = true;
roomGroup.add(westWall);

// Pared Este (Derecha - Escritorio y Estanterías)
const eastWall = westWall.clone();
eastWall.position.set(6.5, 3.25, 0);
roomGroup.add(eastWall);

// RODAPIÉS DE MADERA (BASEBOARDS)
const baseboardMat = new THREE.MeshStandardMaterial({ color: 0x3d2516, roughness: 0.5 });
const baseNorth = new THREE.Mesh(new THREE.BoxGeometry(13, 0.25, 0.08), baseboardMat);
baseNorth.position.set(0, 0.125, -6.25);
roomGroup.add(baseNorth);

const baseWest = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 13), baseboardMat);
baseWest.position.set(-6.25, 0.125, 0);
roomGroup.add(baseWest);

const baseEast = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 13), baseboardMat);
baseEast.position.set(6.25, 0.125, 0);
roomGroup.add(baseEast);

// ============================================================================
// VENTANA PANORÁMICA DE ARCADIA BAY & HAZ DE LUZ VOLUMÉTRICO
// ============================================================================

const windowGroup = new THREE.Group();
windowGroup.position.set(-2.8, 3.4, -6.3);

// Marco exterior de madera de la ventana
const winFrameMat = new THREE.MeshStandardMaterial({ color: 0x4a2e1b, roughness: 0.6 });
const winFrame = new THREE.Mesh(new THREE.BoxGeometry(3.6, 4.4, 0.3), winFrameMat);
windowGroup.add(winFrame);

// Hueco de vidrio / vista
const winGlassMat = new THREE.MeshStandardMaterial({
  color: 0xfde047,
  roughness: 0.1,
  metalness: 0.1,
  transparent: true,
  opacity: 0.4
});
const winGlass = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 3.9), winGlassMat);
winGlass.position.z = 0.05;
windowGroup.add(winGlass);

// Travesaños / cuarterones de la ventana (grid 3x2)
const mullionMat = new THREE.MeshStandardMaterial({ color: 0x3a2315 });
const mullionV1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.9, 0.12), mullionMat);
mullionV1.position.set(-0.52, 0, 0.06);
windowGroup.add(mullionV1);
const mullionV2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.9, 0.12), mullionMat);
mullionV2.position.set(0.52, 0, 0.06);
windowGroup.add(mullionV2);
const mullionH = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.08, 0.12), mullionMat);
mullionH.position.set(0, 0, 0.06);
windowGroup.add(mullionH);

// Cortinas traslúcidas que enmarcan la ventana
const curtainMat = new THREE.MeshStandardMaterial({ color: 0xf5eedb, roughness: 0.9, side: THREE.DoubleSide });
const leftCurtain = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 4.2, 16, 1, false, 0, Math.PI), curtainMat);
leftCurtain.position.set(-1.8, 0, 0.15);
leftCurtain.rotation.y = Math.PI / 2;
windowGroup.add(leftCurtain);

const rightCurtain = leftCurtain.clone();
rightCurtain.position.set(1.8, 0, 0.15);
windowGroup.add(rightCurtain);

// Fondo exterior de Arcadia Bay (Montañas, Acantilados, Pinos al Atardecer)
const backdropCanvas = document.createElement('canvas');
backdropCanvas.width = 512;
backdropCanvas.height = 512;
const bctx = backdropCanvas.getContext('2d');
const skyGrad = bctx.createLinearGradient(0, 0, 0, 512);
skyGrad.addColorStop(0, '#f97316');
skyGrad.addColorStop(0.4, '#fbbf24');
skyGrad.addColorStop(0.7, '#38bdf8');
skyGrad.addColorStop(1, '#1e3a8a');
bctx.fillStyle = skyGrad;
bctx.fillRect(0, 0, 512, 512);

// Siluetas de pinos en el horizonte exterior
bctx.fillStyle = '#1e293b';
for (let i = 0; i < 15; i++) {
  const px = i * 36;
  const py = 320 + Math.sin(i * 1.5) * 40;
  bctx.beginPath();
  bctx.moveTo(px, py - 90);
  bctx.lineTo(px + 24, py);
  bctx.lineTo(px - 24, py);
  bctx.fill();
}
// Silueta del faro al fondo
bctx.fillStyle = '#0f172a';
bctx.fillRect(400, 220, 18, 90);
bctx.fillStyle = '#fef08a';
bctx.beginPath();
bctx.arc(409, 215, 16, 0, Math.PI * 2);
bctx.fill();

const backdropTex = new THREE.CanvasTexture(backdropCanvas);
const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(8, 7), new THREE.MeshBasicMaterial({ map: backdropTex }));
backdrop.position.set(0, 0, -2.5);
windowGroup.add(backdrop);

roomGroup.add(windowGroup);

// HAZ DE LUZ VOLUMÉTRICO (GOD RAYS DEL ATARDECER)
const lightShaftGeo = new THREE.ConeGeometry(2.4, 8.5, 32, 1, true);
const lightShaftMat = new THREE.MeshBasicMaterial({
  color: 0xf59e0b,
  transparent: true,
  opacity: 0.12,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});
const lightShaft = new THREE.Mesh(lightShaftGeo, lightShaftMat);
lightShaft.position.set(-1.8, 1.8, -2.2);
lightShaft.rotation.x = 0.9;
lightShaft.rotation.z = -0.4;
scene.add(lightShaft);

// ============================================================================
// LA CAMA DE MAX CAULFIELD (DORMITORIO DE BLACKWELL)
// ============================================================================

const bedGroup = new THREE.Group();
bedGroup.position.set(-4.5, 0, -3.2);

// Estructura de madera de la cama
const bedWoodMat = new THREE.MeshStandardMaterial({ color: 0x543621, roughness: 0.5 });
const bedBase = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.45, 4.4), bedWoodMat);
bedBase.position.y = 0.35;
bedBase.castShadow = true;
bedBase.receiveShadow = true;
bedGroup.add(bedBase);

// Cabecero alto de madera con listones
const headboard = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 0.15), bedWoodMat);
headboard.position.set(0, 1.3, -2.15);
headboard.castShadow = true;
bedGroup.add(headboard);

// Colchón mullido blanco
const mattressMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 });
const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.38, 4.1), mattressMat);
mattress.position.set(0, 0.65, 0.05);
mattress.castShadow = true;
bedGroup.add(mattress);

// Manta de tartán escocesa doblada en la cama
const blanketMat = new THREE.MeshStandardMaterial({
  map: createBlanketTexture(),
  roughness: 0.85
});
const blanket = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.18, 2.6), blanketMat);
blanket.position.set(0, 0.8, 0.7);
blanket.castShadow = true;
bedGroup.add(blanket);

// Almohadas mullidas
const pillowMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.9 });
const pillow1 = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.22, 0.65), pillowMat);
pillow1.position.set(-0.6, 0.9, -1.5);
pillow1.rotation.x = 0.2;
pillow1.castShadow = true;
bedGroup.add(pillow1);

const pillow2 = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.22, 0.65), pillowMat);
pillow2.position.set(0.6, 0.9, -1.5);
pillow2.rotation.x = 0.2;
pillow2.castShadow = true;
bedGroup.add(pillow2);

roomGroup.add(bedGroup);

// ============================================================================
// GUITARRA ACÚSTICA JUNTO A LA CAMA
// ============================================================================

const guitarGroup = new THREE.Group();
guitarGroup.position.set(-5.8, 0, -1.2);
guitarGroup.rotation.y = 0.6;
guitarGroup.rotation.z = -0.15; // Apoyada contra la pared

const guitarWoodMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.4 });
// Cuerpo inferior
const guitarBody1 = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.16, 24), guitarWoodMat);
guitarBody1.rotation.x = Math.PI / 2;
guitarBody1.position.y = 0.5;
guitarGroup.add(guitarBody1);

// Cuerpo superior
const guitarBody2 = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.16, 24), guitarWoodMat);
guitarBody2.rotation.x = Math.PI / 2;
guitarBody2.position.y = 0.9;
guitarGroup.add(guitarBody2);

// Boca de la guitarra (soundhole)
const soundhole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.18, 16), new THREE.MeshBasicMaterial({ color: 0x111111 }));
soundhole.rotation.x = Math.PI / 2;
soundhole.position.set(0, 0.85, 0.01);
guitarGroup.add(soundhole);

// Mástil de madera
const neckMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
const neck = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.85, 0.08), neckMat);
neck.position.set(0, 1.45, 0);
guitarGroup.add(neck);

// Pala con clavijero
const headstock = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.07), neckMat);
headstock.position.set(0, 1.95, 0);
guitarGroup.add(headstock);

roomGroup.add(guitarGroup);

// ============================================================================
// GUIRNALDA DE LUCES DE HADA (FAIRY STRING LIGHTS) EN LA PARED
// ============================================================================

const fairyLightsGroup = new THREE.Group();
const fairyLightMat = new THREE.MeshStandardMaterial({
  color: 0xfef08a,
  emissive: 0xf59e0b,
  emissiveIntensity: 2.8,
  roughness: 0.2
});

const fairyBulbGeo = new THREE.SphereGeometry(0.06, 12, 12);

// Cable colgante con curvatura catenaria suave
for (let i = 0; i < 18; i++) {
  const t = i / 17;
  const x = -6.28;
  const z = -5.8 + t * 5.2;
  const sag = Math.sin(t * Math.PI) * 0.45;
  const y = 4.2 - sag;

  const bulb = new THREE.Mesh(fairyBulbGeo, fairyLightMat);
  bulb.position.set(x, y, z);
  fairyLightsGroup.add(bulb);
}

// 2 luces tenues que proyectan el resplandor cálido de la guirnalda
const fairyGlow1 = new THREE.PointLight(0xf59e0b, 1.5, 4.0);
fairyGlow1.position.set(-5.9, 3.8, -4.2);
fairyLightsGroup.add(fairyGlow1);

const fairyGlow2 = new THREE.PointLight(0xf59e0b, 1.5, 4.0);
fairyGlow2.position.set(-5.9, 3.8, -1.8);
fairyLightsGroup.add(fairyGlow2);

roomGroup.add(fairyLightsGroup);

// ============================================================================
// TENDEDERO DE FOTOS POLAROID EN LA PARED (HISTORIAS DE ARCADIA)
// ============================================================================

const polaroidGallery = new THREE.Group();
polaroidGallery.position.set(-6.26, 3.2, 0.5);

const polaroidsData = [
  { caption: 'Faro de Arcadia', type: 'lighthouse', z: -1.8, rot: -0.08 },
  { caption: 'Evidencia Mariana', type: 'chat', z: -0.6, rot: 0.05 },
  { caption: 'Mi Guitarra', type: 'guitar', z: 0.6, rot: -0.04 },
  { caption: 'Bosque de Pinos', type: 'nature', z: 1.8, rot: 0.09 },
];

polaroidsData.forEach((p) => {
  const pTex = createPolaroidTexture(p.caption, p.type);
  const pMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.65, 0.8),
    new THREE.MeshStandardMaterial({ map: pTex, roughness: 0.4, side: THREE.DoubleSide })
  );
  pMesh.position.set(0, 0, p.z);
  pMesh.rotation.y = Math.PI / 2;
  pMesh.rotation.x = p.rot;
  polaroidGallery.add(pMesh);

  // Pinza de madera pequeña
  const peg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.04), new THREE.MeshStandardMaterial({ color: 0x854d0e }));
  peg.position.set(0.02, 0.4, p.z);
  polaroidGallery.add(peg);
});

roomGroup.add(polaroidGallery);

// ============================================================================
// TABLÓN DE CORCHO DE INVESTIGACIÓN CON HILO ROJO (SPATIAL EVIDENCE BOARD)
// ============================================================================

const corkboardGroup = new THREE.Group();
corkboardGroup.position.set(0.8, 3.6, -6.28);

const corkFrameMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.6 });
const corkFrame = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.0, 0.08), corkFrameMat);
corkboardGroup.add(corkFrame);

const corkSurfaceMat = new THREE.MeshStandardMaterial({
  map: createCorkboardTexture(),
  roughness: 0.95
});
const corkSurface = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.8), corkSurfaceMat);
corkSurface.position.z = 0.05;
corkboardGroup.add(corkSurface);

roomGroup.add(corkboardGroup);

// PÓSTERS EN LA PARED ESTE
const posterGroup = new THREE.Group();
posterGroup.position.set(6.28, 3.4, 0);

const p1 = new THREE.Mesh(
  new THREE.PlaneGeometry(1.2, 1.7),
  new THREE.MeshStandardMaterial({ map: createPosterTexture('VORTEX CLUB · OCTOBER', 'SYD MATTERS'), roughness: 0.4 })
);
p1.rotation.y = -Math.PI / 2;
p1.position.z = -1.5;
posterGroup.add(p1);

const p2 = new THREE.Mesh(
  new THREE.PlaneGeometry(1.2, 1.7),
  new THREE.MeshStandardMaterial({ map: createPosterTexture('FALL FESTIVAL CONCERT', 'JOSÉ GONZÁLEZ'), roughness: 0.4 })
);
p2.rotation.y = -Math.PI / 2;
p2.position.z = 1.5;
posterGroup.add(p2);

roomGroup.add(posterGroup);

// ============================================================================
// MESA DE TRABAJO (DESK) DE MAX CON LAPTOP, CÁMARA RETRO Y DIARIO
// ============================================================================

const deskGroup = new THREE.Group();
deskGroup.position.set(2.8, 0, -2.5);

// Tablero de madera pulida
const deskTopGeo = new THREE.BoxGeometry(3.6, 0.16, 1.9);
const deskTopMat = new THREE.MeshStandardMaterial({ color: 0x5a3922, roughness: 0.45 });
const deskTop = new THREE.Mesh(deskTopGeo, deskTopMat);
deskTop.position.y = 1.45;
deskTop.castShadow = true;
deskTop.receiveShadow = true;
deskGroup.add(deskTop);

// Cajonera lateral izquierda
const drawerBox = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.25, 1.6), deskTopMat);
drawerBox.position.set(-1.25, 0.72, 0);
drawerBox.castShadow = true;
deskGroup.add(drawerBox);

// Tiradores metálicos de latón
for (let d = 0; d < 3; d++) {
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.03, 0.04), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8 }));
  handle.position.set(-1.25, 1.1 - d * 0.35, 0.82);
  deskGroup.add(handle);
}

// Patas derechas metálicas oscuras
const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.45);
const legMat = new THREE.MeshStandardMaterial({ color: 0x1f1b18 });
[[1.6, -0.75], [1.6, 0.75]].forEach(([x, z]) => {
  const leg = new THREE.Mesh(legGeo, legMat);
  leg.position.set(x, 0.72, z);
  leg.castShadow = true;
  deskGroup.add(leg);
});

// Laptop con pantalla encendida mostrando el Ledger
const laptopBase = new THREE.Mesh(
  new THREE.BoxGeometry(0.75, 0.02, 0.52),
  new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 })
);
laptopBase.position.set(0.65, 1.54, 0);
laptopBase.castShadow = true;
deskGroup.add(laptopBase);

const laptopScreen = new THREE.Mesh(
  new THREE.BoxGeometry(0.75, 0.48, 0.02),
  new THREE.MeshBasicMaterial({ color: 0x0284c7 })
);
laptopScreen.position.set(0.65, 1.78, -0.26);
laptopScreen.rotation.x = 0.22;
deskGroup.add(laptopScreen);

// Lámpara vintage de cuello de cisne (Anglepoise)
const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.05), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8 }));
lampBase.position.set(1.4, 1.55, -0.6);
deskGroup.add(lampBase);

const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.36, 16), new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.3 }));
lampShade.position.set(1.4, 2.2, -0.6);
lampShade.rotation.x = 0.55;
deskGroup.add(lampShade);

// Cuaderno Moleskine interactivo sobre la mesa
const diaryGeo = new THREE.BoxGeometry(0.7, 0.08, 0.9);
const diaryMat = new THREE.MeshStandardMaterial({ color: 0x3d271d, roughness: 0.7 });
const diaryMesh = new THREE.Mesh(diaryGeo, diaryMat);
diaryMesh.position.set(-0.35, 1.57, 0.15);
diaryMesh.rotation.y = 0.18;
diaryMesh.castShadow = true;
deskGroup.add(diaryMesh);

// Cámara instantánea retro Polaroid Sun 660 en la mesa
const cameraBody = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.35), new THREE.MeshStandardMaterial({ color: 0x18181b }));
cameraBody.position.set(-0.25, 1.65, -0.55);
cameraBody.rotation.y = -0.3;
deskGroup.add(cameraBody);

const cameraLens = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 16), new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.9 }));
cameraLens.rotation.x = Math.PI / 2;
cameraLens.position.set(-0.25, 1.65, -0.36);
deskGroup.add(cameraLens);

// Taza de café con vapor humeante
const mugMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.24), new THREE.MeshStandardMaterial({ color: 0xfef08a }));
mugMesh.position.set(1.3, 1.65, 0.25);
deskGroup.add(mugMesh);

roomGroup.add(deskGroup);

// Silla de escritorio retro de madera
const chairGroup = new THREE.Group();
chairGroup.position.set(2.8, 0, -1.2);
chairGroup.rotation.y = Math.PI;

const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 0.85), deskTopMat);
chairSeat.position.y = 0.85;
chairGroup.add(chairSeat);

const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.75, 0.06), deskTopMat);
chairBack.position.set(0, 1.3, -0.4);
chairGroup.add(chairBack);

[[ -0.35, -0.35 ], [ 0.35, -0.35 ], [ -0.35, 0.35 ], [ 0.35, 0.35 ]].forEach(([cx, cz]) => {
  const cl = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.85), legMat);
  cl.position.set(cx, 0.425, cz);
  chairGroup.add(cl);
});
roomGroup.add(chairGroup);

// ============================================================================
// TOCADISCOS VINTAGE Y DISCO GIRATORIO
// ============================================================================

const turntableGroup = new THREE.Group();
turntableGroup.position.set(-5.2, 0, 1.4);

const ttStand = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 1.3), new THREE.MeshStandardMaterial({ color: 0x3d271d }));
ttStand.position.y = 0.65;
ttStand.castShadow = true;
turntableGroup.add(ttStand);

// Rejilla de altavoz frontal de tela vintage
const grilleMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.7), new THREE.MeshStandardMaterial({ color: 0x78563a, roughness: 0.9 }));
grilleMesh.position.set(0, 0.6, 0.66);
turntableGroup.add(grilleMesh);

// Plato y disco de vinilo
const ttPlatter = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.04), new THREE.MeshStandardMaterial({ color: 0x18181b }));
ttPlatter.position.set(0, 1.32, 0);
turntableGroup.add(ttPlatter);

const vinylDisc = new THREE.Mesh(
  new THREE.CylinderGeometry(0.44, 0.44, 0.02, 32),
  new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.2, metalness: 0.9 })
);
vinylDisc.position.set(0, 1.34, 0);
turntableGroup.add(vinylDisc);

const vinylLabel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.025), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
vinylLabel.position.set(0, 1.345, 0);
turntableGroup.add(vinylLabel);

// Brazo fonocaptor de latón
const tonearm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9 }));
tonearm.rotation.z = Math.PI / 2;
tonearm.rotation.y = 0.4;
tonearm.position.set(0.3, 1.36, 0.15);
turntableGroup.add(tonearm);

roomGroup.add(turntableGroup);

// PLANTA MONSTERA EN MACETA DE CERÁMICA
const plantGroup = new THREE.Group();
plantGroup.position.set(5.2, 0, 3.2);

const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.28, 0.6, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
pot.position.y = 0.3;
pot.castShadow = true;
plantGroup.add(pot);

const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6, side: THREE.DoubleSide });
for (let l = 0; l < 8; l++) {
  const angle = (l / 8) * Math.PI * 2;
  const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.8), leafMat);
  leaf.position.set(Math.cos(angle) * 0.2, 0.6 + Math.sin(l) * 0.15, Math.sin(angle) * 0.2);
  leaf.rotation.x = 0.5;
  leaf.rotation.y = angle;
  leaf.castShadow = true;
  plantGroup.add(leaf);
}
roomGroup.add(plantGroup);

// ============================================================================
// PARTÍCULAS DORADAS DE POLVO EN LA LUZ (DUST MOTES)
// ============================================================================

const dustCount = 350;
const dustGeo = new THREE.BufferGeometry();
const dustPositions = new Float32Array(dustCount * 3);

for (let i = 0; i < dustCount * 3; i += 3) {
  dustPositions[i] = (Math.random() - 0.5) * 10;
  dustPositions[i + 1] = Math.random() * 5.0 + 0.3;
  dustPositions[i + 2] = (Math.random() - 0.5) * 10;
}

dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
const dustMat = new THREE.PointsMaterial({
  color: 0xfef08a,
  size: 0.05,
  transparent: true,
  opacity: 0.65,
  blending: THREE.AdditiveBlending
});
const dustParticles = new THREE.Points(dustGeo, dustMat);
scene.add(dustParticles);

// ============================================================================
// LA MARIPOSA AZUL MORPHO (EL EFECTO MARIPOSA VIVO)
// ============================================================================

const butterflyGroup = new THREE.Group();
butterflyGroup.position.set(-1.2, 2.5, 0.2);

const wingGeo = new THREE.PlaneGeometry(0.32, 0.42);
const wingMat = new THREE.MeshBasicMaterial({
  color: 0x38bdf8,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.95
});

const leftWing = new THREE.Mesh(wingGeo, wingMat);
leftWing.position.x = -0.16;
leftWing.rotation.y = 0.3;
butterflyGroup.add(leftWing);

const rightWing = new THREE.Mesh(wingGeo, wingMat);
rightWing.position.x = 0.16;
rightWing.rotation.y = -0.3;
butterflyGroup.add(rightWing);

const butterflyLight = new THREE.PointLight(0x38bdf8, 1.8, 3.5);
butterflyGroup.add(butterflyLight);
scene.add(butterflyGroup);

// ============================================================================
// AVATAR ESTILIZADO DE MAX CAULFIELD
// ============================================================================

const avatar = new THREE.Group();
avatar.position.set(0, 0, 1.2);
scene.add(avatar);

// Cabeza con textura facial estilizada (pecas y ojos)
const faceTex = createMaxFaceTexture();
const headMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.26, 24, 24),
  new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.7 })
);
headMesh.position.y = 1.62;
headMesh.rotation.y = -Math.PI / 2; // Orientar rostro hacia adelante
headMesh.castShadow = true;
avatar.add(headMesh);

// Cabello castaño icónico de Max (corte bob con flequillo)
const hairMat = new THREE.MeshStandardMaterial({ color: 0x5a3217, roughness: 0.85 });
const hairMain = new THREE.Mesh(new THREE.SphereGeometry(0.29, 20, 20), hairMat);
hairMain.position.set(0, 1.68, -0.06);
hairMain.scale.set(1.06, 1.12, 1.18);
avatar.add(hairMain);

// Flequillo y mechones laterales
const bangL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.26, 0.1), hairMat);
bangL.position.set(-0.2, 1.58, 0.14);
bangL.rotation.z = -0.15;
avatar.add(bangL);

const bangR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.26, 0.1), hairMat);
bangR.position.set(0.2, 1.58, 0.14);
bangR.rotation.z = 0.15;
avatar.add(bangR);

// Torso con sudadera con capucha gris
const hoodieMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.75 });
const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.68, 0.32), hoodieMat);
bodyMesh.position.y = 1.15;
bodyMesh.castShadow = true;
avatar.add(bodyMesh);

// Cuello de sudadera / cordones blancos
const cordMat = new THREE.MeshBasicMaterial({ color: 0xf1f5f9 });
const cord1 = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2), cordMat);
cord1.position.set(-0.08, 1.35, 0.17);
avatar.add(cord1);
const cord2 = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2), cordMat);
cord2.position.set(0.08, 1.35, 0.17);
avatar.add(cord2);

// Bolso bandolera de cuero marrón cruzado
const bagMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.38, 0.42, 0.16),
  new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.6 })
);
bagMesh.position.set(0.22, 1.05, 0);
bagMesh.rotation.z = -0.15;
avatar.add(bagMesh);

// Correa del bolso cruzada
const strap = new THREE.Mesh(
  new THREE.BoxGeometry(0.05, 0.75, 0.34),
  new THREE.MeshStandardMaterial({ color: 0x78350f })
);
strap.position.set(0.02, 1.18, 0);
strap.rotation.z = -0.4;
avatar.add(strap);

// Brazos con mangas de sudadera
const armGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.58);
const leftArm = new THREE.Mesh(armGeo, hoodieMat);
leftArm.position.set(-0.34, 1.15, 0);
avatar.add(leftArm);

const rightArm = new THREE.Mesh(armGeo, hoodieMat);
rightArm.position.set(0.34, 1.15, 0);
avatar.add(rightArm);

// Piernas con pantalones vaqueros azules
const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.8 });
const legCharGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.72);

const leftLeg = new THREE.Mesh(legCharGeo, pantsMat);
leftLeg.position.set(-0.16, 0.46, 0);
leftLeg.castShadow = true;
avatar.add(leftLeg);

const rightLeg = new THREE.Mesh(legCharGeo, pantsMat);
rightLeg.position.set(0.16, 0.46, 0);
rightLeg.castShadow = true;
avatar.add(rightLeg);

// Zapatillas tipo Converse con suela de goma blanca
const shoeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
const soleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc });

const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.28), shoeMat);
shoeL.position.set(-0.16, 0.06, 0.05);
avatar.add(shoeL);
const soleL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.04, 0.29), soleMat);
soleL.position.set(-0.16, 0.02, 0.05);
avatar.add(soleL);

const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.28), shoeMat);
shoeR.position.set(0.16, 0.06, 0.05);
avatar.add(shoeR);
const soleR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.04, 0.29), soleMat);
soleR.position.set(0.16, 0.02, 0.05);
avatar.add(soleR);

// ============================================================================
// CONTROLES DE NAVEGACIÓN Y CÁMARA
// ============================================================================

const keys = { w: false, a: false, s: false, d: false };

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') keys.w = true;
  if (k === 's' || k === 'arrowdown') keys.s = true;
  if (k === 'a' || k === 'arrowleft') keys.a = true;
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
  if (k === 's' || k === 'arrowdown') keys.s = false;
  if (k === 'a' || k === 'arrowleft') keys.a = false;
  if (k === 'd' || k === 'arrowright') keys.d = false;
});

let isDragging = false;
let prevMouseX = 0;
let cameraAngleY = 0;
let cameraDistance = 6.8;

window.addEventListener('mousedown', (e) => {
  if (e.button === 0 && e.target === canvas) {
    isDragging = true;
    prevMouseX = e.clientX;
  }
});

window.addEventListener('mouseup', () => (isDragging = false));

window.addEventListener('mousemove', (e) => {
  if (isDragging) {
    const deltaX = e.clientX - prevMouseX;
    cameraAngleY += deltaX * 0.005;
    prevMouseX = e.clientX;
  }
});

window.addEventListener('wheel', (e) => {
  cameraDistance = Math.max(3.8, Math.min(9.5, cameraDistance + e.deltaY * 0.005));
});

// ============================================================================
// PUNTOS DE INTERACCIÓN ESPACIAL (HOTSPOTS 3D)
// ============================================================================

let activeHotspot = null;

function checkProximity() {
  const avPos = avatar.position;
  const distDesk = avPos.distanceTo(new THREE.Vector3(2.5, 0, -1.8));
  const distButterfly = avPos.distanceTo(butterflyGroup.position);
  const distTurntable = avPos.distanceTo(turntableGroup.position);
  const distWindow = avPos.distanceTo(new THREE.Vector3(-2.8, 0, -4.5));

  if (distDesk < 2.2) {
    activeHotspot = 'desk';
    promptText.innerText = 'Abrir Diario de Decisiones de Max';
    promptElem.classList.add('visible');
  } else if (distButterfly < 2.4) {
    activeHotspot = 'butterfly';
    promptText.innerText = 'Tocar Mariposa / Explorar Efecto Mariposa';
    promptElem.classList.add('visible');
  } else if (distTurntable < 2.0) {
    activeHotspot = 'turntable';
    promptText.innerText = 'Tocar Música Indie (Life is Strange)';
    promptElem.classList.add('visible');
  } else if (distWindow < 2.4) {
    activeHotspot = 'window';
    promptText.innerText = 'Mirar por la Ventana / Cambiar Atmósfera';
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
  playCameraClick();
  playAcousticNote(330);
  journalModal.classList.add('active');
}

function closeJournal() {
  playAcousticNote(220);
  journalModal.classList.remove('active');
}

if (btnCloseJournal) btnCloseJournal.addEventListener('click', closeJournal);

// ============================================================================
// CLIMA Y ESTADOS DEL MUNDO (GOLDEN HOUR VS TORMENTA)
// ============================================================================

let isStormy = false;

function toggleWeather() {
  isStormy = !isStormy;
  setWorldState(isStormy);
}

if (btnWeather) btnWeather.addEventListener('click', toggleWeather);

function setWorldState(storm) {
  playAcousticNote(storm ? 180 : 392);
  if (storm) {
    sunLight.color.setHex(0x38bdf8);
    sunLight.intensity = 1.2;
    hemiLight.color.setHex(0x334155);
    hemiLight.groundColor.setHex(0x0f172a);
    scene.background.setHex(0x0f172a);
    scene.fog.color.setHex(0x0f172a);
    lightShaft.material.color.setHex(0x38bdf8);
    lightShaft.material.opacity = 0.08;
    if (weatherIcon) weatherIcon.innerText = '🌧️';
    if (weatherText) weatherText.innerText = 'Tormenta de Dudas';
  } else {
    sunLight.color.setHex(0xf59e0b);
    sunLight.intensity = 3.8;
    hemiLight.color.setHex(0xffecd6);
    hemiLight.groundColor.setHex(0x422618);
    scene.background.setHex(0x24160e);
    scene.fog.color.setHex(0x382214);
    lightShaft.material.color.setHex(0xf59e0b);
    lightShaft.material.opacity = 0.12;
    if (weatherIcon) weatherIcon.innerText = '☀️';
    if (weatherText) weatherText.innerText = 'Atardecer Dorado';
  }
}

// ============================================================================
// VERIFIABLE CRYPTOGRAPHIC LEDGER ENGINE (SHA-256 HASH CHAIN)
// ============================================================================

const ledger = new EventLedger();
const adapter = new MetaAdapter({ mock: true });

// Ingesta de evidencia multimodal
ledger.append('evidence.ingested', { evidence: MOCK_EVIDENCE_SCREENSHOT });
ledger.append('evidence.ingested', { evidence: MOCK_EVIDENCE_AUDIO });

// Compromisos propuestos con anclas SAM 3.1 y Muse Voice
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

// Detección de conflicto causal
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
      hudChainStatus.innerHTML = `<span style="color:#10b981;font-weight:700;">✓ Validado (${verification.checked} bloques)</span>`;
    } else {
      hudChainStatus.innerHTML = `<span style="color:#ef4444;font-weight:700;">✗ Corrupción detectada</span>`;
    }
  }

  if (ledgerEventsContainer) {
    ledgerEventsContainer.innerHTML = events
      .map(
        (ev) => `
      <div class="event-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <strong style="color:#fbbf24;font-size:12px;">#${ev.seq} · ${ev.type}</strong>
          <span style="color:#94a3b8;font-size:10px;">${ev.timestamp.slice(11, 19)}</span>
        </div>
        <div style="color:#94a3b8;font-size:10px;margin-bottom:3px;">
          prev: <span class="hash-text" style="color:#64748b;">${ev.prevHash.slice(0, 16)}...</span>
        </div>
        <div style="color:#cbd5e1;font-size:10px;">
          seal: <span class="hash-text" style="color:#38bdf8;font-weight:bold;">${ev.hash.slice(0, 24)}...</span>
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
    playCameraClick();
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
    const snapshotPast = ledger.asOf('2026-11-03T10:00:00-03:00');
    setWorldState(false);
    alert(
      `⏪ REWIND TEMPORAL EJECUTADO (asOf: 2026-11-03 10:00)\n\n` +
      `El ledger ha retrocedido en el tiempo de forma inmutable:\n` +
      `• Compromisos activos en ese instante: ${snapshotPast.commitments.length} (sin conflicto)\n` +
      `• El santuario 3D vuelve al estado previo a la decisión.`
    );
  });
}

// BOTONES DE ELECCIÓN EN EL DIARIO
const choiceA = document.getElementById('choice-a');
if (choiceA) {
  choiceA.addEventListener('click', () => {
    ledger.append('commitment.verified', {
      commitmentId: c1.id,
      anchor: c1.anchor,
      verifiedAt: new Date().toISOString(),
    });
    renderLedgerUI();
    setWorldState(true);
    alert(
      `⚡ SENDA A SELLADA EN EL LEDGER\n\n` +
      `Se ha añadido el bloque #${ledger.size} con hash criptográfico SHA-256.\n` +
      `Consecuencia: Tu tiempo colapsa y se desata una tormenta en el santuario 3D.`
    );
    closeJournal();
  });
}

const choiceB = document.getElementById('choice-b');
if (choiceB) {
  choiceB.addEventListener('click', () => {
    ledger.append('commitment.verified', {
      commitmentId: c1.id,
      anchor: c1.anchor,
      verifiedAt: new Date().toISOString(),
    });
    renderLedgerUI();
    setWorldState(false);
    alert(
      `✨ SENDA B SELLADA EN EL LEDGER\n\n` +
      `Se ha añadido el bloque #${ledger.size} con hash criptográfico SHA-256.\n` +
      `Consecuencia: Asistencia protegida, calma mental y luz dorada en el santuario 3D.`
    );
    closeJournal();
  });
}

// ============================================================================
// AUDIO PROCEDURAL INDIE (WEB AUDIO CON ACORDES ACÚSTICOS)
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
  gain.gain.setValueAtTime(0.22, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.6);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 1.6);
}

function playCameraClick() {
  initAudio();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(800, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.08);
}

function toggleAudio() {
  initAudio();
  if (isAudioPlaying) {
    clearInterval(audioTimer);
    isAudioPlaying = false;
    const aText = document.getElementById('audio-text');
    if (aText) aText.innerText = 'Música Indie (Pausada)';
  } else {
    isAudioPlaying = true;
    const aText = document.getElementById('audio-text');
    if (aText) aText.innerText = 'Sonando: Syd Matters · Obstacles';
    // Progresión acústica clásica de Life is Strange
    const chords = [220, 261.63, 329.63, 392.0, 329.63, 261.63, 293.66, 349.23];
    let step = 0;
    playAcousticNote(chords[0]);
    audioTimer = setInterval(() => {
      step = (step + 1) % chords.length;
      playAcousticNote(chords[step]);
    }, 1050);
  }
}

if (btnAudio) btnAudio.addEventListener('click', toggleAudio);

// ============================================================================
// BUCLE DE ANIMACIÓN Y FÍSICA CINEMÁTICA
// ============================================================================

let walkCycle = 0;
const animClock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = animClock.getDelta();
  const time = animClock.getElapsedTime();

  // 1. ROTACIÓN DEL VINILO
  vinylDisc.rotation.y += 0.035;

  // 2. ALETEO SUAVE DE LA MARIPOSA AZUL
  leftWing.rotation.y = Math.sin(time * 16) * 0.75;
  rightWing.rotation.y = -Math.sin(time * 16) * 0.75;
  butterflyGroup.position.y = 2.4 + Math.sin(time * 2.8) * 0.28;
  butterflyGroup.position.x = -1.2 + Math.cos(time * 1.3) * 0.85;
  butterflyGroup.position.z = 0.2 + Math.sin(time * 1.6) * 0.85;

  // 3. MOVIMIENTO DE MOTAS DE POLVO EN EL HAZ DE LUZ
  const dustPos = dustParticles.geometry.attributes.position.array;
  for (let i = 1; i < dustCount * 3; i += 3) {
    dustPos[i] -= 0.003;
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

  if (isMoving && (!journalModal || !journalModal.classList.contains('active'))) {
    moveVector.normalize();
    moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngleY);

    const speed = 3.4 * delta;
    avatar.position.x += moveVector.x * speed;
    avatar.position.z += moveVector.z * speed;

    avatar.position.x = Math.max(-5.2, Math.min(5.2, avatar.position.x));
    avatar.position.z = Math.max(-5.2, Math.min(5.2, avatar.position.z));

    const targetAngle = Math.atan2(moveVector.x, moveVector.z);
    avatar.rotation.y = THREE.MathUtils.lerp(avatar.rotation.y, targetAngle, 0.18);

    // Animación de caminata
    walkCycle += delta * 13;
    leftLeg.rotation.x = Math.sin(walkCycle) * 0.65;
    rightLeg.rotation.x = -Math.sin(walkCycle) * 0.65;
    leftArm.rotation.x = -Math.sin(walkCycle) * 0.5;
    rightArm.rotation.x = Math.sin(walkCycle) * 0.5;
    avatar.position.y = Math.abs(Math.sin(walkCycle)) * 0.06;
  } else {
    // Idle suave
    leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, 0, 0.1);
    rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, 0, 0.1);
    leftArm.rotation.x = Math.sin(time * 2) * 0.06;
    rightArm.rotation.x = -Math.sin(time * 2) * 0.06;
    avatar.position.y = Math.sin(time * 2) * 0.02;
  }

  // 5. CÁMARA TERCERA PERSONA CINEMÁTICA
  const targetCamX = avatar.position.x + Math.sin(cameraAngleY) * cameraDistance;
  const targetCamZ = avatar.position.z + Math.cos(cameraAngleY) * cameraDistance;
  const targetCamY = avatar.position.y + 3.2;

  camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCamX, 0.08);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCamY, 0.08);
  camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCamZ, 0.08);
  camera.lookAt(avatar.position.x, avatar.position.y + 1.25, avatar.position.z);

  // 6. PROXIMIDAD A HOTSPOTS
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
