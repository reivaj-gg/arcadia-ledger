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
// ARCADIA 3D · THE LIVING SANCTUARY (CINEMATIC PHYSICS & INTERACTION ENGINE)
// ============================================================================

const canvas = document.getElementById('webgl-canvas');
const worldHotspotPrompt = document.getElementById('world-hotspot-prompt');
const hotspotActionText = document.getElementById('hotspot-action-text');
const introspectionBox = document.getElementById('introspection-box');
const rewindOverlay = document.getElementById('rewind-fx-overlay');

const journalModal = document.getElementById('journal-modal');
const btnCloseJournal = document.getElementById('btn-close-journal');
const btnWeather = document.getElementById('btn-weather');
const weatherIcon = document.getElementById('weather-icon');
const weatherText = document.getElementById('weather-text');
const btnAudio = document.getElementById('btn-audio');
const btnToggleLedger = document.getElementById('btn-toggle-ledger');
const btnCloseLedger = document.getElementById('btn-close-ledger');
const btnQuickRewind = document.getElementById('btn-quick-rewind');
const ledgerDrawer = document.getElementById('ledger-drawer');
const ledgerEventsContainer = document.getElementById('ledger-events-container');
const hudLedgerCount = document.getElementById('hud-ledger-count');
const hudChainStatus = document.getElementById('hud-chain-status');
const btnRewind = document.getElementById('btn-rewind');

// Interacción & Posturas Cinematográficas
const actionExitHint = document.getElementById('action-exit-hint');
const actionExitIcon = document.getElementById('action-exit-icon');
const actionExitText = document.getElementById('action-exit-text');
const btnToggleView = document.getElementById('btn-toggle-view');

// Modal de Onboarding & Misión
const onboardingModal = document.getElementById('onboarding-modal');
const btnOnboarding = document.getElementById('btn-onboarding');
const btnCloseOnboarding = document.getElementById('btn-close-onboarding');
const btnStartGame = document.getElementById('btn-start-game');

// Modal de Tocadiscos & Carga de Música Personalizada
const musicModal = document.getElementById('music-modal');
const btnMusicManager = document.getElementById('btn-music-manager');
const btnCloseMusic = document.getElementById('btn-close-music');
const btnBrowseMusic = document.getElementById('btn-browse-music');
const customMusicFile = document.getElementById('custom-music-file');
const customAudioPlayer = document.getElementById('custom-audio-player');
const loadedFileName = document.getElementById('loaded-file-name');
const musicBtnLabel = document.getElementById('music-btn-label');

// RENDERER
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;

// SCENE & ATMOSPHERE · LIFE IS STRANGE GOLDEN HOUR SANCTUARY
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfbf6ee);
scene.fog = new THREE.FogExp2(0xf7ede2, 0.007);

// CAMERA
const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 4.2, 7.2);

// LIGHTS · AMBIENTE CÁLIDO LIFE IS STRANGE
const hemiLight = new THREE.HemisphereLight(0xfff6ea, 0x8a5b3a, 1.85);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xf59e0b, 4.5);
sunLight.position.set(-6.5, 6.5, -4.5);

// Luz de relleno cálida interior para que las paredes y detalles luzcan acogedores
const roomFillLight = new THREE.PointLight(0xfff1e0, 1.4, 16, 1.2);
roomFillLight.position.set(0, 3.8, 0);
scene.add(roomFillLight);
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

const deskLampLight = new THREE.PointLight(0xffa726, 2.4, 6.0, 1.2);
deskLampLight.position.set(2.8, 2.3, -2.4);
deskLampLight.castShadow = true;
deskLampLight.shadow.bias = -0.0008;
scene.add(deskLampLight);

const bedFillLight = new THREE.PointLight(0xfcd34d, 1.2, 7.0, 1.5);
bedFillLight.position.set(-3.6, 2.8, -2.8);
scene.add(bedFillLight);

// ============================================================================
// PROCEDURAL CANVAS TEXTURES
// ============================================================================

function createWoodFloorTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8a5833';
  ctx.fillRect(0, 0, 1024, 1024);

  const plankHeight = 128;
  for (let y = 0; y < 1024; y += plankHeight) {
    const tone = Math.sin(y * 0.1) * 15;
    ctx.fillStyle = `rgb(${110 + tone}, ${71 + tone * 0.7}, ${42 + tone * 0.4})`;
    ctx.fillRect(0, y, 1024, plankHeight);

    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = 'rgba(40, 22, 12, 0.08)';
      ctx.fillRect(Math.random() * 1024, y, Math.random() * 20 + 5, plankHeight);
    }

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

function createWallTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  // Estuco / yeso cálido color crema suave estilo cómic
  ctx.fillStyle = '#f5efe4';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 6000; i++) {
    const v = Math.random() * 20 - 10;
    ctx.fillStyle = `rgba(${200 + v}, ${190 + v}, ${170 + v}, 0.15)`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }

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

function createNavajoRugTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#993d28';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = '#f3e8d2';
  ctx.lineWidth = 8;
  ctx.strokeRect(20, 20, 472, 472);

  ctx.strokeStyle = '#2d3748';
  ctx.lineWidth = 6;
  ctx.strokeRect(36, 36, 440, 440);

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

  return new THREE.CanvasTexture(c);
}

function createBlanketTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#831843';
  ctx.fillRect(0, 0, 512, 512);

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

function createPolaroidTexture(caption, type) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 320;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#faf8f5';
  ctx.fillRect(0, 0, 256, 320);

  const imgY = 16;
  const imgX = 16;
  const imgW = 224;
  const imgH = 224;

  if (type === 'lighthouse') {
    const grad = ctx.createLinearGradient(0, imgY, 0, imgY + imgH);
    grad.addColorStop(0, '#f97316');
    grad.addColorStop(0.5, '#facc15');
    grad.addColorStop(1, '#0284c7');
    ctx.fillStyle = grad;
    ctx.fillRect(imgX, imgY, imgW, imgH);

    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(imgX, imgY + 160, imgW, 64);
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(imgX, imgY + 224);
    ctx.lineTo(imgX + 110, imgY + 140);
    ctx.lineTo(imgX + 160, imgY + 224);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(imgX + 70, imgY + 95, 14, 50);
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(imgX + 77, imgY + 95, 12, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'chat') {
    ctx.fillStyle = '#0b141a';
    ctx.fillRect(imgX, imgY, imgW, imgH);
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

  ctx.fillStyle = '#3d2e1f';
  ctx.font = '18px "Patrick Hand", cursive, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(caption, 128, 285);

  return new THREE.CanvasTexture(c);
}

function createCorkboardTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#bc8a5f';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8000; i++) {
    const v = Math.random() * 30 - 15;
    ctx.fillStyle = `rgb(${188 + v}, ${138 + v}, ${95 + v})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
  }

  ctx.fillStyle = '#fef08a';
  ctx.fillRect(60, 60, 110, 110);
  ctx.fillStyle = '#713f12';
  ctx.font = '14px sans-serif';
  ctx.fillText('Entrega Mariana', 70, 95);
  ctx.fillText('Jueves 4 PM', 70, 120);

  ctx.fillStyle = '#bae6fd';
  ctx.fillRect(320, 80, 120, 110);
  ctx.fillStyle = '#0c4a6e';
  ctx.fillText('Clase Cálculo', 330, 115);
  ctx.fillText('Jueves 3 PM', 330, 140);

  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(115, 70, 6, 0, Math.PI * 2);
  ctx.arc(380, 90, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(115, 70);
  ctx.bezierCurveTo(240, 160, 260, 30, 380, 90);
  ctx.stroke();

  ctx.fillStyle = '#fee2e2';
  ctx.fillRect(200, 120, 110, 30);
  ctx.strokeStyle = '#ef4444';
  ctx.strokeRect(200, 120, 110, 30);
  ctx.fillStyle = '#b91c1c';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('! CONFLICT !', 215, 140);

  return new THREE.CanvasTexture(c);
}

function createJavierFaceTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  // Piel cálida oliva/trigueña (Javier Quilumba) con sombreado suave
  ctx.fillStyle = '#dfb896';
  ctx.fillRect(0, 0, 512, 512);

  // Rubor / tono cálido natural en pómulos (centrado en la cara)
  ctx.fillStyle = 'rgba(196, 115, 85, 0.25)';
  ctx.beginPath();
  ctx.arc(195, 275, 34, 0, Math.PI * 2);
  ctx.arc(317, 275, 34, 0, Math.PI * 2);
  ctx.fill();

  // Ojos expresivos estilo cómic Life is Strange (proporción frontal perfecta)
  [[205, 225], [307, 225]].forEach(([x, y]) => {
    // Esclerótica blanca limpia con contorno
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();

    // Iris café espresso / castaño oscuro
    ctx.fillStyle = '#2c1810';
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fill();

    // Pupila tinta negra
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();

    // Brillo / catchlight blanco brillante
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - 5, y - 5, 5, 0, Math.PI * 2);
    ctx.fill();

    // Contorno de tinta cómic del párpado
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(x, y - 2, 23, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();

    // Pliegue párpado superior
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y - 10, 18, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  });

  // Cejas estilizadas oscuras, definidas y con personalidad (Javier)
  ctx.strokeStyle = '#18181b';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(175, 192);
  ctx.quadraticCurveTo(205, 178, 235, 190);
  ctx.moveTo(277, 190);
  ctx.quadraticCurveTo(307, 178, 337, 192);
  ctx.stroke();

  // Sombra y contorno de nariz estilo cómic
  ctx.strokeStyle = '#854d0e';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(254, 218);
  ctx.lineTo(252, 256);
  ctx.lineTo(264, 260);
  ctx.stroke();

  // Sonrisa confiada y sutil de desarrollador indie
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.arc(256, 292, 22, 0.15, Math.PI - 0.15);
  ctx.stroke();

  // Línea sutil bajo el mentón
  ctx.strokeStyle = 'rgba(69, 26, 3, 0.3)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(256, 335, 14, 0.2, Math.PI - 0.2);
  ctx.stroke();

  return new THREE.CanvasTexture(c);
}

function createMaxFaceTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#fde2cc';
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = 'rgba(244, 114, 182, 0.25)';
  ctx.beginPath();
  ctx.arc(60, 145, 30, 0, Math.PI * 2);
  ctx.arc(196, 145, 30, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#b45309';
  const freckles = [
    [70, 135], [85, 140], [100, 145], [115, 143], [140, 143],
    [155, 145], [170, 140], [185, 135], [128, 138], [110, 152], [145, 152]
  ];
  freckles.forEach(([x, y]) => {
    ctx.fillRect(x, y, 3, 3);
  });

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

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - 3, y - 3, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y - 2, 17, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  });

  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(55, 85);
  ctx.quadraticCurveTo(75, 80, 95, 88);
  ctx.moveTo(160, 88);
  ctx.quadraticCurveTo(180, 80, 200, 85);
  ctx.stroke();

  ctx.strokeStyle = '#9a3412';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(128, 170, 14, 0.2, Math.PI - 0.2);
  ctx.stroke();

  return new THREE.CanvasTexture(c);
}

function createPosterTexture(title, band) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 360;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#1c1917';
  ctx.fillRect(0, 0, 256, 360);

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
  ctx.fillText('ARCADIA MUSIC FESTIVAL · 2026', 128, 325);

  return new THREE.CanvasTexture(c);
}


function createArmchairFabricTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#7a1872';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 9000; i++) {
    const v = (Math.random() - 0.5) * 24;
    ctx.fillStyle = `rgba(${122 + v}, ${24 + v * 0.4}, ${114 + v * 0.9}, 0.12)`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, 'rgba(217, 70, 239, 0.12)');
  grad.addColorStop(0.5, 'rgba(112, 26, 117, 0.25)');
  grad.addColorStop(1, 'rgba(74, 4, 78, 0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function createArmchairSkirtTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#701a75';
  ctx.fillRect(0, 0, 512, 256);

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.fillStyle = '#f472b6';

  for (let x = 64; x < 512; x += 128) {
    ctx.beginPath();
    ctx.arc(x, 160, 48, Math.PI, 0, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, 175, 28, Math.PI, 0, false);
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.stroke();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(x, 90, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, 20);
  ctx.lineTo(512, 20);
  ctx.moveTo(0, 240);
  ctx.lineTo(512, 240);
  ctx.stroke();

  return new THREE.CanvasTexture(c);
}

function createIvyLeavesTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 512);

  ctx.strokeStyle = '#365314';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(128, 0);
  ctx.bezierCurveTo(150, 150, 100, 300, 135, 512);
  ctx.stroke();

  const leafNodes = [
    { x: 120, y: 40, r: 24, a: -0.4, col: '#15803d' },
    { x: 145, y: 90, r: 28, a: 0.5, col: '#16a34a' },
    { x: 110, y: 150, r: 32, a: -0.6, col: '#14532d' },
    { x: 140, y: 210, r: 30, a: 0.3, col: '#22c55e' },
    { x: 115, y: 280, r: 28, a: -0.5, col: '#15803d' },
    { x: 135, y: 350, r: 26, a: 0.4, col: '#166534' },
    { x: 125, y: 420, r: 22, a: -0.3, col: '#16a34a' },
    { x: 130, y: 480, r: 18, a: 0.2, col: '#4ade80' }
  ];

  leafNodes.forEach(leaf => {
    ctx.save();
    ctx.translate(leaf.x, leaf.y);
    ctx.rotate(leaf.a);
    ctx.fillStyle = leaf.col;
    ctx.beginPath();
    ctx.moveTo(0, -leaf.r);
    ctx.bezierCurveTo(leaf.r * 0.9, -leaf.r * 0.5, leaf.r * 0.8, leaf.r * 0.6, 0, leaf.r);
    ctx.bezierCurveTo(-leaf.r * 0.8, leaf.r * 0.6, -leaf.r * 0.9, -leaf.r * 0.5, 0, -leaf.r);
    ctx.fill();

    ctx.strokeStyle = '#86efac';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -leaf.r * 0.7);
    ctx.lineTo(0, leaf.r * 0.8);
    ctx.stroke();
    ctx.restore();
  });

  return new THREE.CanvasTexture(c);
}

function createWallPolaroidsTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 384;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 384);

  const photos = [
    { x: 40, y: 30, w: 90, h: 110, rot: -0.06, title: 'Pacific Crest', hue: '#38bdf8' },
    { x: 155, y: 20, w: 95, h: 115, rot: 0.04, title: 'Blackwell Quad', hue: '#f59e0b' },
    { x: 275, y: 35, w: 90, h: 110, rot: -0.03, title: 'Faro 2024', hue: '#ec4899' },
    { x: 390, y: 25, w: 95, h: 115, rot: 0.05, title: 'Two Whales', hue: '#10b981' },
    { x: 90, y: 180, w: 100, h: 120, rot: 0.05, title: 'Vortex Night', hue: '#8b5cf6' },
    { x: 220, y: 190, w: 95, h: 115, rot: -0.04, title: 'Mariana Chat', hue: '#ef4444' },
    { x: 345, y: 175, w: 100, h: 120, rot: 0.03, title: 'Max & Chloe', hue: '#06b6d4' }
  ];

  photos.forEach(p => {
    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
    ctx.rotate(p.rot);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(-p.w / 2 + 4, -p.h / 2 + 4, p.w, p.h);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.fillStyle = p.hue;
    ctx.fillRect(-p.w / 2 + 7, -p.h / 2 + 7, p.w - 14, p.h - 28);
    ctx.fillStyle = 'rgba(254, 240, 138, 0.75)';
    ctx.fillRect(-22, -p.h / 2 - 8, 44, 16);
    ctx.restore();
  });

  return new THREE.CanvasTexture(c);
}

function createNotebookPagesTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 360;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#faf5ea';
  ctx.fillRect(0, 0, 512, 360);

  const spineGrad = ctx.createLinearGradient(230, 0, 282, 0);
  spineGrad.addColorStop(0, 'rgba(0,0,0,0)');
  spineGrad.addColorStop(0.5, 'rgba(0,0,0,0.25)');
  spineGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = spineGrad;
  ctx.fillRect(230, 0, 52, 360);

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
  ctx.lineWidth = 1;
  for (let y = 40; y < 340; y += 22) {
    ctx.beginPath();
    ctx.moveTo(30, y);
    ctx.lineTo(235, y);
    ctx.moveTo(275, y);
    ctx.lineTo(485, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 15px "Patrick Hand", cursive, sans-serif';
  ctx.fillText('Arcadia Spatial Ledger', 45, 60);

  ctx.font = '12px "Patrick Hand", cursive, sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText('Valid Time: [2026-11-04 15:00 - 17:00]', 45, 105);
  ctx.fillText('Mariana gig vs Calculus clash detected!', 45, 127);
  ctx.fillText('SHA-256 seal: e3b0c44298fc1c14...', 45, 149);

  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(290, 180);
  ctx.lineTo(470, 180);
  ctx.stroke();

  ctx.strokeStyle = '#3b82f6';
  ctx.beginPath();
  ctx.moveTo(330, 180);
  ctx.bezierCurveTo(370, 120, 420, 110, 465, 115);
  ctx.stroke();

  ctx.strokeStyle = '#d97706';
  ctx.beginPath();
  ctx.moveTo(330, 180);
  ctx.bezierCurveTo(370, 240, 420, 250, 465, 245);
  ctx.stroke();

  ctx.fillStyle = '#b91c1c';
  ctx.fillText('CONFIRMED CONFLICT (IoU 99.6%)', 290, 290);

  return new THREE.CanvasTexture(c);
}

function createSunPatchTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 512);

  const grad = ctx.createRadialGradient(256, 256, 30, 256, 256, 250);
  grad.addColorStop(0, 'rgba(251, 191, 36, 0.7)');
  grad.addColorStop(0.4, 'rgba(245, 158, 11, 0.45)');
  grad.addColorStop(0.8, 'rgba(217, 119, 6, 0.15)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fillRect(240, 0, 32, 512);
  ctx.fillRect(0, 240, 512, 32);

  return new THREE.CanvasTexture(c);
}

function createVintageLuggageStickersTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 384;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2f3e46';
  ctx.fillRect(0, 0, 512, 384);

  ctx.fillStyle = '#d97706';
  ctx.fillRect(0, 0, 48, 48);
  ctx.fillRect(464, 0, 48, 48);
  ctx.fillRect(0, 336, 48, 48);
  ctx.fillRect(464, 336, 48, 48);

  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(280, 80, 140, 85);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(280, 80); ctx.lineTo(420, 165);
  ctx.moveTo(420, 80); ctx.lineTo(280, 165);
  ctx.stroke();
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(280, 80); ctx.lineTo(420, 165);
  ctx.moveTo(420, 80); ctx.lineTo(280, 165);
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.moveTo(350, 80); ctx.lineTo(350, 165);
  ctx.moveTo(280, 122); ctx.lineTo(420, 122);
  ctx.stroke();
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(350, 80); ctx.lineTo(350, 165);
  ctx.moveTo(280, 122); ctx.lineTo(420, 122);
  ctx.stroke();

  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(140, 140, 50, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('ARCADIA PACIFIC', 95, 145);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(80, 240, 140, 50);
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 4;
  ctx.strokeRect(80, 240, 140, 50);
  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('PAR AVION', 105, 272);

  return new THREE.CanvasTexture(c);
}

// ============================================================================
// CONSTRUCCIÓN DEL SANTUARIO 3D
// ============================================================================

const roomGroup = new THREE.Group();
scene.add(roomGroup);

// Piso
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

// Alfombra
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

// Paredes
const wallTex = createWallTexture();
const wallMat = new THREE.MeshStandardMaterial({
  map: wallTex,
  color: 0xffffff,
  roughness: 0.82,
  metalness: 0.02
});

const northWall = new THREE.Mesh(new THREE.BoxGeometry(13, 6.5, 0.4), wallMat);
northWall.position.set(0, 3.25, -6.5);
northWall.receiveShadow = true;
roomGroup.add(northWall);

const westWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6.5, 13), wallMat);
westWall.position.set(-6.5, 3.25, 0);
westWall.receiveShadow = true;
roomGroup.add(westWall);

const eastWall = westWall.clone();
eastWall.position.set(6.5, 3.25, 0);
roomGroup.add(eastWall);

// Rodapiés
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

// Ventana panorámica
const windowGroup = new THREE.Group();
windowGroup.position.set(-2.8, 3.4, -6.3);

const winFrameMat = new THREE.MeshStandardMaterial({ color: 0x4a2e1b, roughness: 0.6 });
const winFrame = new THREE.Mesh(new THREE.BoxGeometry(3.6, 4.4, 0.3), winFrameMat);
windowGroup.add(winFrame);

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

const curtainMat = new THREE.MeshStandardMaterial({ color: 0xf5eedb, roughness: 0.9, side: THREE.DoubleSide });
const leftCurtain = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 4.2, 16, 1, false, 0, Math.PI), curtainMat);
leftCurtain.position.set(-1.8, 0, 0.15);
leftCurtain.rotation.y = Math.PI / 2;
windowGroup.add(leftCurtain);

const rightCurtain = leftCurtain.clone();
rightCurtain.position.set(1.8, 0, 0.15);
windowGroup.add(rightCurtain);

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
bctx.fillStyle = '#0f172a';
bctx.fillRect(400, 220, 18, 90);
bctx.fillStyle = '#fef08a';
bctx.beginPath();
bctx.arc(409, 215, 16, 0, Math.PI * 2);
bctx.fill();

const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(8, 7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(backdropCanvas) }));
backdrop.position.set(0, 0, -2.5);
windowGroup.add(backdrop);

roomGroup.add(windowGroup);

// Haz de luz volumétrico multicapa & proyección solar en el suelo
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

const lightShaftOuter = new THREE.Mesh(
  new THREE.ConeGeometry(3.6, 9.8, 32, 1, true),
  new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.07,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
lightShaftOuter.position.set(-1.8, 1.8, -2.2);
lightShaftOuter.rotation.x = 0.9;
lightShaftOuter.rotation.z = -0.4;
scene.add(lightShaftOuter);

const lightShaftCore = new THREE.Mesh(
  new THREE.ConeGeometry(1.2, 8.0, 24, 1, true),
  new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
lightShaftCore.position.set(-1.8, 1.8, -2.2);
lightShaftCore.rotation.x = 0.9;
lightShaftCore.rotation.z = -0.4;
scene.add(lightShaftCore);

const floorSunPatch = new THREE.Mesh(
  new THREE.PlaneGeometry(6.2, 5.0),
  new THREE.MeshBasicMaterial({
    map: createSunPatchTexture(),
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
floorSunPatch.rotation.x = -Math.PI / 2;
floorSunPatch.position.set(0.6, 0.02, -0.6);
roomGroup.add(floorSunPatch);

// Cama de Max
const bedGroup = new THREE.Group();
bedGroup.position.set(-4.5, 0, -3.2);

const bedWoodMat = new THREE.MeshStandardMaterial({ color: 0x543621, roughness: 0.5 });
const bedBase = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.45, 4.4), bedWoodMat);
bedBase.position.y = 0.35;
bedBase.castShadow = true;
bedBase.receiveShadow = true;
bedGroup.add(bedBase);

const headboard = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 0.15), bedWoodMat);
headboard.position.set(0, 1.3, -2.15);
headboard.castShadow = true;
bedGroup.add(headboard);

const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.38, 4.1), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 }));
mattress.position.set(0, 0.65, 0.05);
mattress.castShadow = true;
bedGroup.add(mattress);

const blanket = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.18, 2.6), new THREE.MeshStandardMaterial({ map: createBlanketTexture(), roughness: 0.85 }));
blanket.position.set(0, 0.8, 0.7);
blanket.castShadow = true;
bedGroup.add(blanket);

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

// Guitarra Acústica
const guitarGroup = new THREE.Group();
guitarGroup.position.set(-5.8, 0, -1.2);
guitarGroup.rotation.y = 0.6;
guitarGroup.rotation.z = -0.15;

const guitarWoodMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.4 });
const guitarBody1 = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.16, 24), guitarWoodMat);
guitarBody1.rotation.x = Math.PI / 2;
guitarBody1.position.y = 0.5;
guitarGroup.add(guitarBody1);

const guitarBody2 = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.16, 24), guitarWoodMat);
guitarBody2.rotation.x = Math.PI / 2;
guitarBody2.position.y = 0.9;
guitarGroup.add(guitarBody2);

const soundhole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.18, 16), new THREE.MeshBasicMaterial({ color: 0x111111 }));
soundhole.rotation.x = Math.PI / 2;
soundhole.position.set(0, 0.85, 0.01);
guitarGroup.add(soundhole);

const neckMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
const neck = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.85, 0.08), neckMat);
neck.position.set(0, 1.45, 0);
guitarGroup.add(neck);

const headstock = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.07), neckMat);
headstock.position.set(0, 1.95, 0);
guitarGroup.add(headstock);

roomGroup.add(guitarGroup);

// Luces de hada
const fairyLightsGroup = new THREE.Group();
const fairyLightMat = new THREE.MeshStandardMaterial({
  color: 0xfef08a,
  emissive: 0xf59e0b,
  emissiveIntensity: 2.8,
  roughness: 0.2
});
const fairyBulbGeo = new THREE.SphereGeometry(0.06, 12, 12);

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

const fairyGlow1 = new THREE.PointLight(0xf59e0b, 1.5, 4.0);
fairyGlow1.position.set(-5.9, 3.8, -4.2);
fairyLightsGroup.add(fairyGlow1);

const fairyGlow2 = new THREE.PointLight(0xf59e0b, 1.5, 4.0);
fairyGlow2.position.set(-5.9, 3.8, -1.8);
fairyLightsGroup.add(fairyGlow2);

roomGroup.add(fairyLightsGroup);

// Tendedero de Polaroids
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

  const peg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.04), new THREE.MeshStandardMaterial({ color: 0x854d0e }));
  peg.position.set(0.02, 0.4, p.z);
  polaroidGallery.add(peg);
});

roomGroup.add(polaroidGallery);

// Tablón de corcho con hilo rojo
const corkboardGroup = new THREE.Group();
corkboardGroup.position.set(0.8, 3.6, -6.28);

const corkFrameMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.6 });
const corkFrame = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.0, 0.08), corkFrameMat);
corkboardGroup.add(corkFrame);

const corkSurface = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.8), new THREE.MeshStandardMaterial({ map: createCorkboardTexture(), roughness: 0.95 }));
corkSurface.position.z = 0.05;
corkboardGroup.add(corkSurface);

roomGroup.add(corkboardGroup);

// Pósters
const posterGroup = new THREE.Group();
posterGroup.position.set(6.28, 3.4, 0);

const p1 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.7), new THREE.MeshStandardMaterial({ map: createPosterTexture('VORTEX CLUB · OCTOBER', 'SYD MATTERS'), roughness: 0.4 }));
p1.rotation.y = -Math.PI / 2;
p1.position.z = -1.5;
posterGroup.add(p1);

const p2 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.7), new THREE.MeshStandardMaterial({ map: createPosterTexture('FALL FESTIVAL CONCERT', 'JOSÉ GONZÁLEZ'), roughness: 0.4 }));
p2.rotation.y = -Math.PI / 2;
p2.position.z = 1.5;
posterGroup.add(p2);

roomGroup.add(posterGroup);

// Mesa de Trabajo en L
const deskGroup = new THREE.Group();
deskGroup.position.set(2.8, 0, -2.5);

const deskTopMat = new THREE.MeshStandardMaterial({ color: 0x5a3922, roughness: 0.45 });
const deskTop = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 1.9), deskTopMat);
deskTop.position.y = 1.45;
deskTop.castShadow = true;
deskTop.receiveShadow = true;
deskGroup.add(deskTop);

// Ala en L de la mesa hacia la pared este
const deskExtension = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.16, 2.2), deskTopMat);
deskExtension.position.set(1.4, 1.45, 1.35);
deskExtension.castShadow = true;
deskExtension.receiveShadow = true;
deskGroup.add(deskExtension);

const drawerBox = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.25, 1.6), deskTopMat);
drawerBox.position.set(-1.25, 0.72, 0);
drawerBox.castShadow = true;
deskGroup.add(drawerBox);

for (let d = 0; d < 3; d++) {
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.03, 0.04), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8 }));
  handle.position.set(-1.25, 1.1 - d * 0.35, 0.82);
  deskGroup.add(handle);
}

const legMat = new THREE.MeshStandardMaterial({ color: 0x1f1b18 });
[[1.6, -0.75], [1.6, 0.75], [2.1, 2.2]].forEach(([x, z]) => {
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.45), legMat);
  leg.position.set(x, 0.72, z);
  leg.castShadow = true;
  deskGroup.add(leg);
});

// Torre PC gamer/desktop debajo de la mesa con LED de encendido
const pcTowerMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.3 });
const pcTower = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.68, 0.75), pcTowerMat);
pcTower.position.set(0.15, 0.36, 0.15);
pcTower.castShadow = true;
deskGroup.add(pcTower);

const pcLed = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
pcLed.position.set(0.15, 0.62, 0.53);
deskGroup.add(pcLed);

const pcDrive = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.02), new THREE.MeshBasicMaterial({ color: 0x0f172a }));
pcDrive.position.set(0.15, 0.52, 0.53);
deskGroup.add(pcDrive);

// Papelera metálica con hojas arrugadas
const binMat = new THREE.MeshStandardMaterial({ color: 0x64748b, wireframe: true });
const wasteBin = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.48, 12), binMat);
wasteBin.position.set(1.9, 0.24, 0.6);
deskGroup.add(wasteBin);

// Cactus y suculentas en macetas de terracota
const potMat = new THREE.MeshStandardMaterial({ color: 0xc25e36, roughness: 0.7 });
const cactusMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.8 });
[-0.85, 1.35].forEach((px) => {
  const cPot = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.14, 12), potMat);
  cPot.position.set(px, 1.60, -0.4);
  deskGroup.add(cPot);

  const cactusBody = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), cactusMat);
  cactusBody.position.set(px, 1.72, -0.4);
  cactusBody.scale.set(0.8, 1.3, 0.8);
  deskGroup.add(cactusBody);
});

// Laptop
const laptopBase = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.02, 0.52), new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 }));
laptopBase.position.set(0.65, 1.54, 0);
laptopBase.castShadow = true;
deskGroup.add(laptopBase);

const laptopScreen = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.48, 0.02), new THREE.MeshBasicMaterial({ color: 0x0284c7 }));
laptopScreen.position.set(0.65, 1.78, -0.26);
laptopScreen.rotation.x = 0.22;
deskGroup.add(laptopScreen);

// Lámpara de escritorio vintage de latón dorado
const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.05), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8 }));
lampBase.position.set(1.4, 1.55, -0.6);
deskGroup.add(lampBase);

const lampArm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.85 }));
lampArm1.position.set(1.4, 1.80, -0.6);
lampArm1.rotation.z = -0.25;
deskGroup.add(lampArm1);

const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.36, 16), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.7, roughness: 0.3 }));
lampShade.position.set(1.3, 2.15, -0.6);
lampShade.rotation.x = 0.55;
deskGroup.add(lampShade);

// Cuaderno abierto con diagramas de ledger bitemporal
const diaryGeo = new THREE.BoxGeometry(0.72, 0.04, 0.54);
const diaryMat = new THREE.MeshStandardMaterial({ map: createNotebookPagesTexture(), roughness: 0.85 });
const diaryMesh = new THREE.Mesh(diaryGeo, diaryMat);
diaryMesh.position.set(-0.35, 1.56, 0.15);
diaryMesh.rotation.y = 0.12;
diaryMesh.castShadow = true;
deskGroup.add(diaryMesh);

const cameraBody = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.35), new THREE.MeshStandardMaterial({ color: 0x18181b }));
cameraBody.position.set(-0.25, 1.65, -0.55);
cameraBody.rotation.y = -0.3;
deskGroup.add(cameraBody);

const cameraLens = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 16), new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.9 }));
cameraLens.rotation.x = Math.PI / 2;
cameraLens.position.set(-0.25, 1.65, -0.36);
deskGroup.add(cameraLens);

const mugMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.24), new THREE.MeshStandardMaterial({ color: 0xfef08a }));
mugMesh.position.set(1.3, 1.65, 0.25);
deskGroup.add(mugMesh);

// Pilas de libros en el ala derecha de la mesa
[0.85, 1.25].forEach((bz, idx) => {
  const bookStack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.26, 0.38), new THREE.MeshStandardMaterial({ color: idx === 0 ? 0x1e3a8a : 0x991b1b, roughness: 0.6 }));
  bookStack.position.set(1.8, 1.66, bz);
  deskGroup.add(bookStack);
});

roomGroup.add(deskGroup);

// Silla de oficina ergonómica tapizada en verde oliva con base de 5 ruedas
const chairGroup = new THREE.Group();
chairGroup.position.set(2.8, 0, -1.2);
chairGroup.rotation.y = Math.PI;

const chairFabricMat = new THREE.MeshStandardMaterial({ color: 0x2e4d3a, roughness: 0.85 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.1 });

const ergoSeat = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.12, 0.82), chairFabricMat);
ergoSeat.position.y = 0.86;
ergoSeat.castShadow = true;
chairGroup.add(ergoSeat);

const ergoBack = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.82, 0.08), chairFabricMat);
ergoBack.position.set(0, 1.36, -0.38);
ergoBack.rotation.x = -0.08;
ergoBack.castShadow = true;
chairGroup.add(ergoBack);

const chromeShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.65, 16), chromeMat);
chromeShaft.position.y = 0.48;
chairGroup.add(chromeShaft);

for (let p = 0; p < 5; p++) {
  const angle = (p / 5) * Math.PI * 2;
  const prong = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.06), legMat);
  prong.position.set(Math.cos(angle) * 0.22, 0.16, Math.sin(angle) * 0.22);
  prong.rotation.y = -angle;
  chairGroup.add(prong);

  const caster = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), legMat);
  caster.position.set(Math.cos(angle) * 0.42, 0.04, Math.sin(angle) * 0.42);
  chairGroup.add(caster);
}
roomGroup.add(chairGroup);

// Repisa flotante sobre el escritorio con collage de polaroids
const floatingShelfGroup = new THREE.Group();
floatingShelfGroup.position.set(2.8, 3.8, -6.28);

const shelfBoard = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.08, 0.52), deskTopMat);
shelfBoard.position.z = 0.26;
shelfBoard.castShadow = true;
floatingShelfGroup.add(shelfBoard);

const bracketMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
[-1.1, 1.1].forEach(bx => {
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.48), bracketMat);
  bracket.position.set(bx, -0.21, 0.24);
  floatingShelfGroup.add(bracket);
});

const bottleMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.1, transparent: true, opacity: 0.85 });
const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.38, 16), bottleMat);
bottle.position.set(-0.6, 0.23, 0.24);
floatingShelfGroup.add(bottle);

const bust = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35 }));
bust.position.set(0.1, 0.18, 0.24);
bust.scale.set(0.8, 1.4, 0.8);
floatingShelfGroup.add(bust);

const polaroidWallMat = new THREE.MeshStandardMaterial({
  map: createWallPolaroidsTexture(),
  transparent: true,
  roughness: 0.4,
  side: THREE.DoubleSide
});
const polaroidWall = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), polaroidWallMat);
polaroidWall.position.set(0, -1.1, 0.03);
floatingShelfGroup.add(polaroidWall);

roomGroup.add(floatingShelfGroup);

// Tocadiscos
const turntableGroup = new THREE.Group();
turntableGroup.position.set(-5.2, 0, 1.4);

const ttStand = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 1.3), new THREE.MeshStandardMaterial({ color: 0x3d271d }));
ttStand.position.y = 0.65;
ttStand.castShadow = true;
turntableGroup.add(ttStand);

const grilleMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.7), new THREE.MeshStandardMaterial({ color: 0x78563a, roughness: 0.9 }));
grilleMesh.position.set(0, 0.6, 0.66);
turntableGroup.add(grilleMesh);

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

const tonearm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9 }));
tonearm.rotation.z = Math.PI / 2;
tonearm.rotation.y = 0.4;
tonearm.position.set(0.3, 1.36, 0.15);
turntableGroup.add(tonearm);

roomGroup.add(turntableGroup);

// Planta
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
// BIBLIOTECA UNIVERSITARIA CON HIEDRA INGLESA Y BAÚL VINTAGE
// ============================================================================
const bookshelfGroup = new THREE.Group();
bookshelfGroup.position.set(-5.4, 0, 3.8);

const shelfOakMat = new THREE.MeshStandardMaterial({ color: 0x4a2e1b, roughness: 0.45 });
const bSideL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 4.9, 0.08), shelfOakMat);
bSideL.position.set(0, 2.45, -1.15);
bSideL.castShadow = true;
bookshelfGroup.add(bSideL);

const bSideR = new THREE.Mesh(new THREE.BoxGeometry(0.55, 4.9, 0.08), shelfOakMat);
bSideR.position.set(0, 2.45, 1.15);
bSideR.castShadow = true;
bookshelfGroup.add(bSideR);

const bTop = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 2.42), shelfOakMat);
bTop.position.set(0, 4.9, 0);
bTop.castShadow = true;
bookshelfGroup.add(bTop);

const bBase = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 2.42), shelfOakMat);
bBase.position.set(0, 0.11, 0);
bookshelfGroup.add(bBase);

const bBack = new THREE.Mesh(new THREE.BoxGeometry(0.04, 4.8, 2.36), shelfOakMat);
bBack.position.set(-0.26, 2.45, 0);
bookshelfGroup.add(bBack);

const shelfHeights = [1.1, 2.1, 3.1, 4.0];
shelfHeights.forEach(sy => {
  const shelfBoard = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 2.3), shelfOakMat);
  shelfBoard.position.set(0, sy, 0);
  shelfBoard.receiveShadow = true;
  bookshelfGroup.add(shelfBoard);
});

const boxMat = new THREE.MeshStandardMaterial({ color: 0xc4a482, roughness: 0.8 });
[-0.55, 0.55].forEach(bx => {
  const archBox = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.55, 0.85), boxMat);
  archBox.position.set(0, 4.35, bx);
  archBox.castShadow = true;
  bookshelfGroup.add(archBox);

  const handleSlot = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.22), new THREE.MeshBasicMaterial({ color: 0x3d271d }));
  handleSlot.position.set(0.01, 4.45, bx);
  bookshelfGroup.add(handleSlot);
});

const ivyMat = new THREE.MeshStandardMaterial({
  map: createIvyLeavesTexture(),
  transparent: true,
  side: THREE.DoubleSide,
  roughness: 0.4
});

[-0.75, -0.45, -0.15].forEach((vx, idx) => {
  const vineMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.6), ivyMat);
  vineMesh.position.set(0.28, 2.7 - idx * 0.15, vx);
  vineMesh.rotation.y = Math.PI / 2 + (idx - 1) * 0.15;
  vineMesh.rotation.z = (idx - 1) * 0.08;
  bookshelfGroup.add(vineMesh);
});

const skullMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35 });
const skullCranium = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), skullMat);
skullCranium.position.set(0.08, 3.34, 0.55);
skullCranium.scale.set(1.0, 1.15, 1.25);
skullCranium.castShadow = true;
bookshelfGroup.add(skullCranium);

const skullJaw = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.16), skullMat);
skullJaw.position.set(0.08, 3.20, 0.62);
bookshelfGroup.add(skullJaw);

const bookColors = [0x991b1b, 0x1e3a8a, 0x166534, 0xd97706, 0x581c87, 0x0f766e, 0x334155, 0x78350f];
for (let sIdx = 0; sIdx < 3; sIdx++) {
  const sy = shelfHeights[sIdx] + 0.04;
  let currZ = -0.95;
  let bookCount = 0;
  while (currZ < 0.95 && bookCount < 14) {
    const bW = 0.05 + Math.random() * 0.04;
    const bH = 0.55 + Math.random() * 0.28;
    const bD = 0.36 + Math.random() * 0.08;
    const col = bookColors[(sIdx * 5 + bookCount) % bookColors.length];
    const bookMesh = new THREE.Mesh(new THREE.BoxGeometry(bD, bH, bW), new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 }));
    bookMesh.position.set(0.02, sy + bH / 2, currZ + bW / 2);
    bookMesh.castShadow = true;
    bookshelfGroup.add(bookMesh);
    currZ += bW + 0.015;
    bookCount++;
  }
}

const greenBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.65), new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.5 }));
greenBox.position.set(0.04, 1.35, 0.45);
bookshelfGroup.add(greenBox);

const brassLabel = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.22), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8 }));
brassLabel.position.set(0.05, 1.35, 0.45);
bookshelfGroup.add(brassLabel);

const trunkMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.85, 0.82, 1.15),
  new THREE.MeshStandardMaterial({ map: createVintageLuggageStickersTexture(), roughness: 0.6 })
);
trunkMesh.position.set(0.12, 0.41, 1.85);
trunkMesh.castShadow = true;
bookshelfGroup.add(trunkMesh);

roomGroup.add(bookshelfGroup);

// ============================================================================
// SILLÓN VINTAGE DE TERCIOPELO MORADO CON RESPALDO OREJERO Y FALDA BORDADA
// ============================================================================
const armchairGroup = new THREE.Group();
armchairGroup.position.set(-3.4, 0, 2.3);
armchairGroup.rotation.y = 0.58;

const velvetMat = new THREE.MeshStandardMaterial({
  map: createArmchairFabricTexture(),
  color: 0xffffff,
  roughness: 0.85,
  metalness: 0.04
});
const woodLegMat = new THREE.MeshStandardMaterial({ color: 0x241208, roughness: 0.4 });

const seatCushion = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.32, 1.1), velvetMat);
seatCushion.position.y = 0.68;
seatCushion.castShadow = true;
armchairGroup.add(seatCushion);

const chairBackRest = new THREE.Mesh(new THREE.BoxGeometry(1.12, 1.45, 0.28), velvetMat);
chairBackRest.position.set(0, 1.42, -0.42);
chairBackRest.rotation.x = -0.12;
chairBackRest.castShadow = true;
armchairGroup.add(chairBackRest);

[-0.52, 0.52].forEach((wx, i) => {
  const wingMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.72, 0.48), velvetMat);
  wingMesh.position.set(wx, 1.72, -0.32);
  wingMesh.rotation.y = (i === 0 ? 0.3 : -0.3);
  armchairGroup.add(wingMesh);
});

[-0.58, 0.58].forEach(ax => {
  const armRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.05, 16), velvetMat);
  armRoll.rotation.x = Math.PI / 2;
  armRoll.position.set(ax, 0.92, 0);
  armRoll.castShadow = true;
  armchairGroup.add(armRoll);

  const armPillar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.45, 1.05), velvetMat);
  armPillar.position.set(ax, 0.65, 0);
  armchairGroup.add(armPillar);
});

const skirtGeo = new THREE.PlaneGeometry(1.15, 0.38);
const skirtMat = new THREE.MeshStandardMaterial({
  map: createArmchairSkirtTexture(),
  side: THREE.DoubleSide,
  roughness: 0.7
});
const skirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
skirtMesh.position.set(0, 0.34, 0.56);
armchairGroup.add(skirtMesh);

const legPositions = [
  [-0.48, 0.22, 0.45],
  [0.48, 0.22, 0.45],
  [-0.48, 0.22, -0.45],
  [0.48, 0.22, -0.45]
];
legPositions.forEach(([lx, ly, lz]) => {
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.025, 0.44, 12), woodLegMat);
  leg.position.set(lx, ly, lz);
  leg.castShadow = true;
  armchairGroup.add(leg);
});

const pillowGoldMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 });
const throwPillow = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.18), pillowGoldMat);
throwPillow.position.set(-0.25, 0.98, -0.22);
throwPillow.rotation.set(0.2, 0.3, 0.15);
throwPillow.castShadow = true;
armchairGroup.add(throwPillow);

roomGroup.add(armchairGroup);


// Partículas de polvo
const dustCount = 450;
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

// Mariposa Azul Morpho
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

// Partículas de notas musicales flotantes para la guitarra
const musicalNotesGroup = new THREE.Group();
scene.add(musicalNotesGroup);

function createNoteTexture(char = '♪') {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 72px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 14;
  ctx.fillText(char, 64, 64);
  return new THREE.CanvasTexture(c);
}

const noteTex1 = createNoteTexture('♪');
const noteTex2 = createNoteTexture('♫');
const activeNotes = [];

function spawnMusicNote() {
  const isSecond = Math.random() > 0.5;
  const mat = new THREE.SpriteMaterial({
    map: isSecond ? noteTex2 : noteTex1,
    color: 0xfffbeb,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.35, 0.35, 0.35);
  sprite.position.set(-5.6 + (Math.random() - 0.5) * 0.3, 1.3, -1.2 + (Math.random() - 0.5) * 0.3);
  musicalNotesGroup.add(sprite);
  activeNotes.push({
    sprite,
    vy: 0.012 + Math.random() * 0.01,
    vx: (Math.random() - 0.5) * 0.006,
    life: 1.0,
    wobble: Math.random() * Math.PI * 2
  });
}

// ============================================================================
// AVATAR DE JAVIER QUILUMBA (ESTILO CÓMIC LIFE IS STRANGE · ARTICULADO)
// ============================================================================

const avatar = new THREE.Group();
avatar.position.set(0, 0, 1.2);
scene.add(avatar);

// Estados de acción y posturas cinematográficas
let avatarActionState = 'standing'; // 'standing' | 'sitting_armchair' | 'lying_bed' | 'playing_guitar'
let isFirstPerson = false;

function setActionState(state) {
  avatarActionState = state;
  if (!actionExitHint) return;

  if (state === 'sitting_armchair') {
    if (actionExitIcon) actionExitIcon.innerText = '🛋️';
    if (actionExitText) actionExitText.innerText = 'Descansando en el sillón vintage · Presiona [W][A][S][D] o [Espacio] para levantarte';
    actionExitHint.classList.add('visible');
  } else if (state === 'lying_bed') {
    if (actionExitIcon) actionExitIcon.innerText = '🛏️';
    if (actionExitText) actionExitText.innerText = 'Recostado en la cama · Presiona [W][A][S][D] o [Espacio] para levantarte';
    actionExitHint.classList.add('visible');
  } else if (state === 'playing_guitar') {
    if (actionExitIcon) actionExitIcon.innerText = '🎸';
    if (actionExitText) actionExitText.innerText = 'Tocando la guitarra acústica · Presiona [W][A][S][D] o [Espacio] para levantarte';
    actionExitHint.classList.add('visible');
  } else {
    actionExitHint.classList.remove('visible');
  }
}

function exitActionState() {
  if (avatarActionState === 'standing') return;
  const prevState = avatarActionState;
  avatarActionState = 'standing';
  isFirstPerson = false;
  headGroup.visible = true;

  // Reposicionar al avatar de pie con seguridad fuera de los colisionadores
  if (prevState === 'sitting_armchair') {
    avatar.position.set(-2.3, 0, 2.3);
    avatar.rotation.set(0, -Math.PI / 2, 0);
  } else if (prevState === 'lying_bed') {
    avatar.position.set(-2.8, 0, -3.2);
    avatar.rotation.set(0, 0, 0);
  } else if (prevState === 'playing_guitar') {
    avatar.position.set(-4.8, 0, -1.2);
  }

  hipsGroup.position.set(0, 0.72, 0);
  leftLegPivot.rotation.set(0, 0, 0);
  rightLegPivot.rotation.set(0, 0, 0);
  leftArmPivot.rotation.set(0, 0, 0);
  rightArmPivot.rotation.set(0, 0, 0);
  upperBodyGroup.rotation.set(0, 0, 0);

  if (actionExitHint) actionExitHint.classList.remove('visible');
  exitCinematicFocus();
}

function togglePerspective() {
  if (avatarActionState === 'standing') {
    cameraDistance = cameraDistance > 4.5 ? 3.4 : 6.5;
    return;
  }
  isFirstPerson = !isFirstPerson;
  headGroup.visible = !isFirstPerson;
  if (btnToggleView) {
    btnToggleView.innerText = isFirstPerson ? '[V] Cambiar a 3ª Persona' : '[V] Cambiar a 1ª Persona';
  }
}
if (btnToggleView) btnToggleView.addEventListener('click', togglePerspective);

// Caderas (base articulada para piernas de Javier)
const hipsGroup = new THREE.Group();
hipsGroup.position.set(0, 0.72, 0);
avatar.add(hipsGroup);

const jeansMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.85 });
const shoeMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 });
const soleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
const legGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.68, 16);

// Pierna izquierda articulada
const leftLegPivot = new THREE.Group();
leftLegPivot.position.set(-0.16, 0, 0);
hipsGroup.add(leftLegPivot);

const leftLegMesh = new THREE.Mesh(legGeo, jeansMat);
leftLegMesh.position.y = -0.34;
leftLegMesh.castShadow = true;
leftLegPivot.add(leftLegMesh);

const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.28), shoeMat);
shoeL.position.set(0, -0.68, 0.05);
leftLegPivot.add(shoeL);

const soleL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.04, 0.29), soleMat);
soleL.position.set(0, -0.74, 0.05);
leftLegPivot.add(soleL);

// Pierna derecha articulada
const rightLegPivot = new THREE.Group();
rightLegPivot.position.set(0.16, 0, 0);
hipsGroup.add(rightLegPivot);

const rightLegMesh = new THREE.Mesh(legGeo, jeansMat);
rightLegMesh.position.y = -0.34;
rightLegMesh.castShadow = true;
rightLegPivot.add(rightLegMesh);

const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.28), shoeMat);
shoeR.position.set(0, -0.68, 0.05);
rightLegPivot.add(shoeR);

const soleR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.04, 0.29), soleMat);
soleR.position.set(0, -0.74, 0.05);
rightLegPivot.add(soleR);

// Torso / Cuerpo Superior de Javier (Chaqueta Tech Azul Marino + Camiseta Gris)
const upperBodyGroup = new THREE.Group();
upperBodyGroup.position.set(0, 0.72, 0);
avatar.add(upperBodyGroup);

const jacketMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75 });
const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.68, 0.34), jacketMat);
bodyMesh.position.y = 0.42;
bodyMesh.castShadow = true;
upperBodyGroup.add(bodyMesh);

// Cuello de camiseta interior gris/blanca que asoma
const innerCollarMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 });
const innerCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.08, 16), innerCollarMat);
innerCollar.position.set(0, 0.76, 0);
upperBodyGroup.add(innerCollar);

// Cremallera metálica frontal estilizada
const zipMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
const zipper = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.62, 0.02), zipMat);
zipper.position.set(0, 0.42, 0.18);
upperBodyGroup.add(zipper);

// Bolso bandolera de cuero vintage de desarrollador (Javier)
const bagMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.38, 0.44, 0.16),
  new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.65 })
);
bagMesh.position.set(0.24, 0.33, 0);
bagMesh.rotation.z = -0.15;
upperBodyGroup.add(bagMesh);

const strap = new THREE.Mesh(
  new THREE.BoxGeometry(0.05, 0.75, 0.36),
  new THREE.MeshStandardMaterial({ color: 0x451a03 })
);
strap.position.set(0.02, 0.46, 0);
strap.rotation.z = -0.4;
upperBodyGroup.add(strap);

// Brazos articulados
const armGeo = new THREE.CylinderGeometry(0.075, 0.07, 0.54, 16);
const handMat = new THREE.MeshStandardMaterial({ color: 0xdfb896, roughness: 0.75 });
const handGeo = new THREE.SphereGeometry(0.055, 12, 12);

const leftArmPivot = new THREE.Group();
leftArmPivot.position.set(-0.35, 0.68, 0);
upperBodyGroup.add(leftArmPivot);

const leftArmMesh = new THREE.Mesh(armGeo, jacketMat);
leftArmMesh.position.y = -0.27;
leftArmPivot.add(leftArmMesh);

const leftHand = new THREE.Mesh(handGeo, handMat);
leftHand.position.y = -0.54;
leftArmPivot.add(leftHand);

const rightArmPivot = new THREE.Group();
rightArmPivot.position.set(0.35, 0.68, 0);
upperBodyGroup.add(rightArmPivot);

const rightArmMesh = new THREE.Mesh(armGeo, jacketMat);
rightArmMesh.position.y = -0.27;
rightArmPivot.add(rightArmMesh);

const rightHand = new THREE.Mesh(handGeo, handMat);
rightHand.position.y = -0.54;
rightArmPivot.add(rightHand);

// Cabeza y Cabello Estilizado de Javier Quilumba
const headGroup = new THREE.Group();
headGroup.position.set(0, 0.82, 0);
upperBodyGroup.add(headGroup);

const faceTex = createJavierFaceTexture();
// Cabeza con textura expresiva de Javier Quilumba orientada al frente (+Z)
const headMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.26, 24, 24),
  new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.68 })
);
headMesh.position.set(0, 0.12, 0);
headMesh.rotation.y = -Math.PI / 2; // Centra la textura (u=0.5) exactamente al frente (+Z)
headMesh.castShadow = true;
headGroup.add(headMesh);

// Cabello estilizado desarrollador (Javier Quilumba): Nuca, laterales y tupé sin tapar la cara
const hairMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85 });

// Casquete posterior y nuca (detrás de la cabeza)
const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.255, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMat);
hairBack.position.set(0, 0.16, -0.06);
hairBack.rotation.x = -0.35;
headGroup.add(hairBack);

// Tupé superior / quiff moderno con volumen cómic (sobre la frente sin tapar los ojos)
const hairQuiff = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.24), hairMat);
hairQuiff.position.set(0, 0.34, 0.06);
hairQuiff.rotation.x = -0.28;
headGroup.add(hairQuiff);

// Mechón delantero con estilo
const hairFringe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.12), hairMat);
hairFringe.position.set(0.04, 0.28, 0.18);
hairFringe.rotation.z = -0.12;
hairFringe.rotation.x = -0.15;
headGroup.add(hairFringe);

// Patillas perfiladas
const sideburnL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.1), hairMat);
sideburnL.position.set(-0.25, 0.08, -0.02);
headGroup.add(sideburnL);

const sideburnR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.1), hairMat);
sideburnR.position.set(0.25, 0.08, -0.02);
headGroup.add(sideburnR);

// ============================================================================
// SISTEMA DE FÍSICAS: COLISIONADORES SÓLIDOS & DESLIZAMIENTO
// ============================================================================

// Cajas de colisión AABB ajustadas con precisión
const colliders = [
  // Cama
  { minX: -6.0, maxX: -3.0, minZ: -5.6, maxZ: -0.9 },
  // Mesa de escritorio en L y silla
  { minX: 0.8, maxX: 5.6, minZ: -3.8, maxZ: 0.8 },
  // Mueble tocadiscos
  { minX: -6.2, maxX: -4.2, minZ: 0.6, maxZ: 2.2 },
  // Estantería de libros, hiedra y baúl vintage
  { minX: -6.4, maxX: -3.8, minZ: 2.6, maxZ: 5.4 },
  // Sillón vintage de terciopelo morado
  { minX: -4.2, maxX: -2.4, minZ: 1.4, maxZ: 3.2 },
  // Maceta con planta
  { minX: 4.5, maxX: 6.0, minZ: 2.4, maxZ: 4.0 },
  // Guitarra
  { minX: -6.4, maxX: -5.0, minZ: -1.8, maxZ: -0.6 }
];

function checkCollision(x, z, radius = 0.32) {
  // Límites perimetrales de la habitación
  if (x - radius < -6.0 || x + radius > 6.0 || z - radius < -6.0 || z + radius > 5.8) {
    return true;
  }
  // Muebles interiores
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (
      x + radius > c.minX &&
      x - radius < c.maxX &&
      z + radius > c.minZ &&
      z - radius < c.maxZ
    ) {
      return true;
    }
  }
  return false;
}

// Suavizado angular para no dar giros bruscos de 360 grados
function lerpAngle(current, target, factor) {
  let diff = (target - current) % (Math.PI * 2);
  if (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > Math.PI) diff -= Math.PI * 2;
  return current + diff * factor;
}

// ============================================================================
// CONTROLES, RAYCASTING Y CÁMARA CINEMÁTICA CON ENFOQUE DINÁMICO
// ============================================================================

const keys = { w: false, a: false, s: false, d: false, shift: false };

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') keys.w = true;
  if (k === 's' || k === 'arrowdown') keys.s = true;
  if (k === 'a' || k === 'arrowleft') keys.a = true;
  if (k === 'd' || k === 'arrowright') keys.d = true;
  if (e.key === 'Shift') keys.shift = true;

  // Si el personaje está sentado/acostado y presiona movimiento o espacio, levantarse
  if ((k === 'w' || k === 's' || k === 'a' || k === 'd' || k === ' ' || e.code === 'Space') && avatarActionState !== 'standing') {
    exitActionState();
  }

  if (k === 'e') {
    handleInteraction();
  }
  if (k === 'r') {
    executeRewind();
  }
  if (k === 'v') {
    togglePerspective();
  }
  if (k === 'h' || k === 'o') {
    toggleOnboardingModal();
  }
  if (k === 'm') {
    toggleMusicModal();
  }
  if (e.key === 'Escape') {
    closeJournal();
    closeOnboardingModal();
    closeMusicModal();
    exitActionState();
    exitCinematicFocus();
  }
});

window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') keys.w = false;
  if (k === 's' || k === 'arrowdown') keys.s = false;
  if (k === 'a' || k === 'arrowleft') keys.a = false;
  if (k === 'd' || k === 'arrowright') keys.d = false;
  if (e.key === 'Shift') keys.shift = false;
});

let isDragging = false;
let clickStartX = 0;
let clickStartY = 0;
let prevMouseX = 0;
let prevMouseY = 0;
let cameraAngleY = -0.15;
let cameraPitch = 0.22; // Inclinación vertical
let cameraDistance = 5.2;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('mousedown', (e) => {
  if (e.button === 0 && e.target === canvas) {
    isDragging = true;
    clickStartX = e.clientX;
    clickStartY = e.clientY;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;
    exitCinematicFocus();
  }
});

window.addEventListener('mouseup', (e) => {
  if (isDragging) {
    isDragging = false;
    // Si fue un click estático (no arrastre), probar interactuar directamente con el objeto clicado
    const dragDist = Math.hypot(e.clientX - clickStartX, e.clientY - clickStartY);
    if (dragDist < 6 && e.target === canvas) {
      handleRaycastClick(e.clientX, e.clientY);
    }
  }
});

window.addEventListener('mousemove', (e) => {
  if (isDragging) {
    const deltaX = e.clientX - prevMouseX;
    const deltaY = e.clientY - prevMouseY;
    cameraAngleY += deltaX * 0.005;
    cameraPitch = Math.max(0.12, Math.min(1.05, cameraPitch + deltaY * 0.003));
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;
  } else if (e.target === canvas) {
    // Cambio sutil de cursor al sobrevolar objetos interactivos
    checkHoverCursor(e.clientX, e.clientY);
  }
});

window.addEventListener('wheel', (e) => {
  cameraDistance = Math.max(3.2, Math.min(8.5, cameraDistance + e.deltaY * 0.004));
});

// Click en el marcador flotante HUD para interactuar
if (worldHotspotPrompt) {
  worldHotspotPrompt.addEventListener('click', () => {
    handleInteraction();
  });
}

function handleRaycastClick(clientX, clientY) {
  mouse.x = (clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const targets = [
    { obj: deskGroup, id: 'desk' },
    { obj: corkboardGroup, id: 'corkboard' },
    { obj: guitarGroup, id: 'guitar' },
    { obj: bedGroup, id: 'bed' },
    { obj: turntableGroup, id: 'turntable' },
    { obj: butterflyGroup, id: 'butterfly' },
    { obj: windowGroup, id: 'window' },
    { obj: bookshelfGroup, id: 'bookshelf' },
    { obj: armchairGroup, id: 'armchair' }
  ];

  for (let i = 0; i < targets.length; i++) {
    const hits = raycaster.intersectObject(targets[i].obj, true);
    if (hits.length > 0) {
      const match = hotspots.find((h) => h.id === targets[i].id);
      if (match) {
        activeHotspot = match;
        handleInteraction();
      }
      break;
    }
  }
}

function checkHoverCursor(clientX, clientY) {
  mouse.x = (clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const testObjects = [deskGroup, corkboardGroup, guitarGroup, bedGroup, turntableGroup, butterflyGroup, windowGroup, bookshelfGroup, armchairGroup];
  let hasHit = false;
  for (let i = 0; i < testObjects.length; i++) {
    if (raycaster.intersectObject(testObjects[i], true).length > 0) {
      hasHit = true;
      break;
    }
  }
  canvas.style.cursor = hasHit ? 'pointer' : 'default';
}

// ============================================================================
// PUNTOS DE INTERACCIÓN ESPACIAL (HOTSPOTS 3D CON ENFOQUE CINEMÁTICO)
// ============================================================================

const hotspots = [
  {
    id: 'desk',
    pos: new THREE.Vector3(2.5, 1.6, -1.8),
    label: 'Abrir Cuaderno de Decisiones',
    camPos: new THREE.Vector3(1.5, 2.2, -0.6),
    camLook: new THREE.Vector3(2.8, 1.4, -2.4),
    thought: '"El ledger no miente: la entrega para Mariana choca exactamente con mi clase de cálculo."'
  },
  {
    id: 'corkboard',
    pos: new THREE.Vector3(0.8, 2.4, -4.5),
    label: 'Inspeccionar Tablón de Evidencias',
    camPos: new THREE.Vector3(0.8, 3.3, -4.0),
    camLook: new THREE.Vector3(0.8, 3.6, -6.3),
    thought: '"El hilo rojo une la captura con la nota de voz. Dos pruebas irrefutables, un conflicto temporal sellado con SHA-256."'
  },
  {
    id: 'guitar',
    pos: new THREE.Vector3(-5.6, 1.2, -1.2),
    label: 'Tocar Guitarra ("Obstacles")',
    camPos: new THREE.Vector3(-4.0, 1.8, -0.2),
    camLook: new THREE.Vector3(-5.8, 1.1, -1.2),
    thought: '"Cada acorde me hace sentir que el tiempo se detiene... pero las consecuencias siguen ahí."'
  },
  {
    id: 'bed',
    pos: new THREE.Vector3(-4.2, 1.2, -3.0),
    label: 'Recostarse y Reflexionar',
    camPos: new THREE.Vector3(-2.2, 2.1, -1.8),
    camLook: new THREE.Vector3(-4.5, 1.0, -3.2),
    thought: '"Arcadia Bay se ve tan tranquila... pero las decisiones que tomamos tienen un peso real."'
  },
  {
    id: 'turntable',
    pos: new THREE.Vector3(-5.0, 1.5, 1.4),
    label: 'Encender Tocadiscos ("Obstacles")',
    camPos: new THREE.Vector3(-3.6, 2.2, 2.2),
    camLook: new THREE.Vector3(-5.2, 1.3, 1.4),
    thought: '"La música analógica siempre me ayuda a poner en orden mis pensamientos."'
  },
  {
    id: 'window',
    pos: new THREE.Vector3(-2.8, 2.5, -5.5),
    label: 'Mirar el Faro / Cambiar Clima',
    camPos: new THREE.Vector3(-2.8, 2.6, -3.6),
    camLook: new THREE.Vector3(-2.8, 3.2, -6.5),
    thought: '"La luz dorada sobre el faro... el tiempo siempre parece detenerse en esta ventana."'
  },
  {
    id: 'butterfly',
    pos: new THREE.Vector3(-1.2, 2.4, 0.2),
    label: 'Explorar Efecto Mariposa',
    camPos: new THREE.Vector3(-0.4, 2.2, 1.4),
    camLook: new THREE.Vector3(-1.2, 2.4, 0.2),
    thought: '"\'This action will have consequences...\' El aleteo de una mariposa cambia todo."'
  },
  {
    id: 'bookshelf',
    pos: new THREE.Vector3(-4.8, 2.0, 3.8),
    label: 'Examinar Biblioteca y Archivos',
    camPos: new THREE.Vector3(-2.8, 2.3, 3.8),
    camLook: new THREE.Vector3(-5.5, 2.1, 3.8),
    thought: '"Entre libros de arte y archivos viejos... cada memoria es una evidencia que el tiempo no borra."'
  },
  {
    id: 'armchair',
    pos: new THREE.Vector3(-3.4, 1.2, 2.3),
    label: 'Descansar en el Sillón Vintage',
    camPos: new THREE.Vector3(-1.8, 1.8, 3.2),
    camLook: new THREE.Vector3(-3.4, 1.2, 2.3),
    thought: '"El terciopelo morado de este viejo sillón... el rincón perfecto para pensar con calma antes de que una decisión selle el futuro."'
  }
];

let activeHotspot = null;
let cinematicFocus = null;
let thoughtTimeout = null;

function showThought(text) {
  if (!introspectionBox) return;
  clearTimeout(thoughtTimeout);
  introspectionBox.innerText = text;
  introspectionBox.classList.add('visible');
  thoughtTimeout = setTimeout(() => {
    introspectionBox.classList.remove('visible');
  }, 5200);
}

function updateHotspotsProximity() {
  const avPos = avatar.position;
  let nearest = null;
  let minDist = 2.6;

  for (let i = 0; i < hotspots.length; i++) {
    const h = hotspots[i];
    const d = avPos.distanceTo(new THREE.Vector3(h.pos.x, avPos.y, h.pos.z));
    if (d < minDist) {
      minDist = d;
      nearest = h;
    }
  }

  activeHotspot = nearest;

  if (activeHotspot && !cinematicFocus) {
    const screenPos = activeHotspot.pos.clone().project(camera);
    const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(screenPos.y * 0.5) + 0.5) * window.innerHeight;

    if (screenPos.z < 1.0) {
      worldHotspotPrompt.style.left = `${x}px`;
      worldHotspotPrompt.style.top = `${y}px`;
      hotspotActionText.innerText = activeHotspot.label;
      worldHotspotPrompt.classList.add('visible');
    } else {
      worldHotspotPrompt.classList.remove('visible');
    }
  } else {
    worldHotspotPrompt.classList.remove('visible');
  }
}

function handleInteraction() {
  if (!activeHotspot) return;

  playCameraClick();
  showThought(activeHotspot.thought);

  if (activeHotspot.id === 'desk') {
    cinematicFocus = activeHotspot;
    openJournal();
  } else if (activeHotspot.id === 'corkboard') {
    cinematicFocus = activeHotspot;
    if (btnToggleLedger && ledgerDrawer) {
      ledgerDrawer.classList.add('active');
    }
  } else if (activeHotspot.id === 'guitar') {
    setActionState('playing_guitar');
    cinematicFocus = activeHotspot;
    playAcousticChords();
  } else if (activeHotspot.id === 'bed') {
    setActionState('lying_bed');
    cinematicFocus = activeHotspot;
    playAcousticNote(293.66);
  } else if (activeHotspot.id === 'turntable') {
    openMusicModal();
  } else if (activeHotspot.id === 'window') {
    cinematicFocus = activeHotspot;
    toggleWeather();
  } else if (activeHotspot.id === 'butterfly') {
    cinematicFocus = activeHotspot;
    openJournal();
  } else if (activeHotspot.id === 'bookshelf') {
    cinematicFocus = activeHotspot;
    playAcousticNote(349.23);
    if (btnToggleLedger && ledgerDrawer) {
      ledgerDrawer.classList.add('active');
    }
  } else if (activeHotspot.id === 'armchair') {
    setActionState('sitting_armchair');
    cinematicFocus = activeHotspot;
    playAcousticChords();
  }
}

function exitCinematicFocus() {
  cinematicFocus = null;
  if (introspectionBox) introspectionBox.classList.remove('visible');
}

function openJournal() {
  playCameraClick();
  playAcousticNote(330);
  journalModal.classList.add('active');
}

function closeJournal() {
  playAcousticNote(220);
  journalModal.classList.remove('active');
  exitCinematicFocus();
}

if (btnCloseJournal) btnCloseJournal.addEventListener('click', closeJournal);

// ============================================================================
// CLIMA Y ESTADOS DEL MUNDO (DORADO · TORMENTA · CREPÚSCULO)
// ============================================================================

let weatherMode = 0; // 0: Atardecer Dorado, 1: Tormenta de Dudas, 2: Crepúsculo de Arcadia

function toggleWeather() {
  weatherMode = (weatherMode + 1) % 3;
  setWorldState(weatherMode);
}

if (btnWeather) btnWeather.addEventListener('click', toggleWeather);

function setWorldState(mode) {
  if (mode === 1) {
    // Tormenta de Dudas
    sunLight.color.setHex(0x38bdf8);
    sunLight.intensity = 1.2;
    hemiLight.color.setHex(0x334155);
    hemiLight.groundColor.setHex(0x0f172a);
    scene.background.setHex(0x0f172a);
    scene.fog.color.setHex(0x0f172a);
    lightShaft.material.color.setHex(0x38bdf8);
    lightShaft.material.opacity = 0.08;
    if (typeof lightShaftOuter !== 'undefined') {
      lightShaftOuter.material.color.setHex(0x38bdf8);
      lightShaftOuter.material.opacity = 0.05;
    }
    if (typeof lightShaftCore !== 'undefined') {
      lightShaftCore.material.color.setHex(0x93c5fd);
      lightShaftCore.material.opacity = 0.12;
    }
    if (typeof floorSunPatch !== 'undefined') {
      floorSunPatch.material.color.setHex(0x38bdf8);
      floorSunPatch.material.opacity = 0.18;
    }
    if (weatherIcon) weatherIcon.innerText = '🌧️';
    if (weatherText) weatherText.innerText = 'Tormenta de Dudas';
    playAcousticNote(180);
  } else if (mode === 2) {
    // Crepúsculo de Arcadia
    sunLight.color.setHex(0x818cf8);
    sunLight.intensity = 1.6;
    hemiLight.color.setHex(0x1e1b4b);
    hemiLight.groundColor.setHex(0x090514);
    scene.background.setHex(0x130e24);
    scene.fog.color.setHex(0x130e24);
    lightShaft.material.color.setHex(0xa855f7);
    lightShaft.material.opacity = 0.15;
    if (typeof lightShaftOuter !== 'undefined') {
      lightShaftOuter.material.color.setHex(0xa855f7);
      lightShaftOuter.material.opacity = 0.08;
    }
    if (typeof lightShaftCore !== 'undefined') {
      lightShaftCore.material.color.setHex(0xe9d5ff);
      lightShaftCore.material.opacity = 0.20;
    }
    if (typeof floorSunPatch !== 'undefined') {
      floorSunPatch.material.color.setHex(0xa855f7);
      floorSunPatch.material.opacity = 0.28;
    }
    if (weatherIcon) weatherIcon.innerText = '🌙';
    if (weatherText) weatherText.innerText = 'Crepúsculo de Arcadia';
    playAcousticNote(260);
  } else {
    // Atardecer Dorado
    sunLight.color.setHex(0xf59e0b);
    sunLight.intensity = 3.8;
    hemiLight.color.setHex(0xffecd6);
    hemiLight.groundColor.setHex(0x422618);
    scene.background.setHex(0x24160e);
    scene.fog.color.setHex(0x382214);
    lightShaft.material.color.setHex(0xf59e0b);
    lightShaft.material.opacity = 0.12;
    if (typeof lightShaftOuter !== 'undefined') {
      lightShaftOuter.material.color.setHex(0xf59e0b);
      lightShaftOuter.material.opacity = 0.07;
    }
    if (typeof lightShaftCore !== 'undefined') {
      lightShaftCore.material.color.setHex(0xfef08a);
      lightShaftCore.material.opacity = 0.18;
    }
    if (typeof floorSunPatch !== 'undefined') {
      floorSunPatch.material.color.setHex(0xfbbf24);
      floorSunPatch.material.opacity = 0.42;
    }
    if (weatherIcon) weatherIcon.innerText = '☀️';
    if (weatherText) weatherText.innerText = 'Atardecer Dorado';
    playAcousticNote(392);
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

// Rewind con búfer histórico y rebobinado físico del avatar
const historyBuffer = [];
let isRewinding = false;

function executeRewind() {
  if (isRewinding || historyBuffer.length < 5) return;
  isRewinding = true;
  playRewindSound();
  if (rewindOverlay) {
    rewindOverlay.classList.add('active');
  }
  showThought('⏪ El tiempo se dobla hacia atrás... antes de que existiera el conflicto.');

  const rewindInterval = setInterval(() => {
    if (historyBuffer.length > 0) {
      const past = historyBuffer.pop();
      avatar.position.x = past.x;
      avatar.position.y = past.y;
      avatar.position.z = past.z;
      avatar.rotation.y = past.rotY;

      // Movimiento inverso de extremidades al rebobinar
      walkCycle -= 0.35;
      leftLegPivot.rotation.x = Math.sin(walkCycle) * 0.65;
      rightLegPivot.rotation.x = -Math.sin(walkCycle) * 0.65;
      leftArmPivot.rotation.x = -Math.sin(walkCycle) * 0.5;
      rightArmPivot.rotation.x = Math.sin(walkCycle) * 0.5;
    } else {
      clearInterval(rewindInterval);
      isRewinding = false;
      if (rewindOverlay) rewindOverlay.classList.remove('active');
      setWorldState(0);
      showThought('✨ Tiempo restablecido. El santuario ha vuelto a su equilibrio.');
    }
  }, 18);
}

if (btnRewind) btnRewind.addEventListener('click', executeRewind);
if (btnQuickRewind) btnQuickRewind.addEventListener('click', executeRewind);

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
    setWorldState(1); // Tormenta
    showThought('⚡ Senda A sellada: Tu tiempo colapsa y una tormenta se cierne sobre Arcadia.');
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
    setWorldState(0); // Atardecer Dorado
    showThought('✨ Senda B sellada: Asistencia protegida. El atardecer dorado permanece.');
    closeJournal();
  });
}

// ============================================================================
// AUDIO SINTETIZADO INDIE (WEB AUDIO CON FOLEY, AGUJA Y PISADAS)
// ============================================================================

let audioCtx = null;
let isAudioPlaying = false;
let audioTimer = null;
let tonearmTargetY = 0.1; // 0.1 reposo, 0.45 tocando el vinilo
let currentAcousticProgression = 0;

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

// Progresiones de acordes acústicos Indie Folk (Syd Matters, José González)
const acousticChordsList = [
  // 0: Syd Matters · Obstacles (Re Mayor 7 / La / Sim / Sol)
  [
    [146.83, 220.0, 293.66, 369.99, 440.0],
    [220.0, 277.18, 329.63, 440.0, 554.37],
    [123.47, 185.0, 246.94, 293.66, 369.99],
    [98.0, 146.83, 196.0, 246.94, 293.66]
  ],
  // 1: Atardecer en Arcadia (Lam / Do / Sol / Re)
  [
    [110.0, 164.81, 220.0, 261.63, 329.63],
    [130.81, 196.0, 261.63, 329.63, 392.0],
    [98.0, 146.83, 196.0, 246.94, 293.66],
    [146.83, 220.0, 293.66, 369.99, 440.0]
  ],
  // 2: Lluvia en la Ventana (Fa maj7 / Mi m7 / Rem7 / Do maj7)
  [
    [174.61, 220.0, 261.63, 329.63, 349.23],
    [164.81, 196.0, 246.94, 329.63, 392.0],
    [146.83, 174.61, 220.0, 261.63, 293.66],
    [130.81, 164.81, 196.0, 246.94, 261.63]
  ]
];

function playAcousticNote(freq = 220) {
  initAudio();
  if (!audioCtx) return;

  // Síntesis de cuerda pulsada con armónico fundamental y cuerpo acústico
  const now = audioCtx.currentTime;
  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  osc1.type = 'triangle';
  osc1.frequency.setValueAtTime(freq, now);

  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(freq * 2.01, now); // Armónico sutil

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1800, now);
  filter.frequency.exponentialRampToValueAtTime(320, now + 1.8);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.24, now + 0.015); // Ataque de púa
  gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2); // Resonancia acústica

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 2.2);
  osc2.stop(now + 2.2);
}

function playAcousticChords() {
  const notes = [146.83, 220.0, 293.66, 369.99, 440.0];
  notes.forEach((n, idx) => {
    setTimeout(() => {
      playAcousticNote(n);
      spawnMusicNote();
    }, idx * 110);
  });
}

function playVinylCrackle() {
  initAudio();
  if (!audioCtx) return;
  const bufferSize = Math.floor(audioCtx.sampleRate * 0.12);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.05;
    if (Math.random() < 0.004) data[i] += (Math.random() - 0.5) * 0.8;
  }
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
  noise.connect(gain);
  gain.connect(audioCtx.destination);
  noise.start();
}

function playFootstep(isRug = false) {
  initAudio();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = isRug ? 'sine' : 'triangle';
  osc.frequency.setValueAtTime(isRug ? 85 : 130, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(32, audioCtx.currentTime + 0.06);
  gain.gain.setValueAtTime(isRug ? 0.06 : 0.09, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.06);
}

function playCameraClick() {
  initAudio();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(800, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.14, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.08);
}

function playRewindSound() {
  initAudio();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(120, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1400, audioCtx.currentTime + 0.8);
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.9);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.9);
}

function toggleAudio() {
  initAudio();
  if (customAudioPlayer && !customAudioPlayer.paused) {
    customAudioPlayer.pause();
    isAudioPlaying = false;
    tonearmTargetY = 0.1;
    const aText = document.getElementById('audio-text');
    if (aText) aText.innerText = 'Música (Pausada)';
    return;
  }

  if (isAudioPlaying) {
    clearInterval(audioTimer);
    isAudioPlaying = false;
    tonearmTargetY = 0.1; // Retirar aguja
    const aText = document.getElementById('audio-text');
    if (aText) aText.innerText = 'Música Indie (Pausada)';
  } else {
    isAudioPlaying = true;
    tonearmTargetY = 0.45; // Colocar aguja sobre el disco
    playVinylCrackle();

    const trackNames = ['Syd Matters · Obstacles', 'Atardecer en Arcadia', 'Lluvia en la Ventana'];
    const currentName = trackNames[currentAcousticProgression] || 'Indie Folk Acústico';

    const aText = document.getElementById('audio-text');
    if (aText) aText.innerText = `Sonando: ${currentName}`;

    const chordsSeq = acousticChordsList[currentAcousticProgression] || acousticChordsList[0];
    let chordIdx = 0;

    function playChordArpeggio(chord) {
      chord.forEach((freq, i) => {
        setTimeout(() => {
          if (isAudioPlaying) {
            playAcousticNote(freq);
            spawnMusicNote();
          }
        }, i * 120);
      });
    }

    playChordArpeggio(chordsSeq[0]);
    audioTimer = setInterval(() => {
      chordIdx = (chordIdx + 1) % chordsSeq.length;
      playVinylCrackle();
      playChordArpeggio(chordsSeq[chordIdx]);
    }, 2400);
  }
}

if (btnAudio) btnAudio.addEventListener('click', toggleAudio);

// ============================================================================
// MANEJADORES DE MODALES: ONBOARDING / GUÍA Y REPRODUCTOR DE MÚSICA
// ============================================================================

function openOnboardingModal() {
  playCameraClick();
  if (onboardingModal) onboardingModal.classList.add('active');
}

function closeOnboardingModal() {
  playAcousticNote(330);
  if (onboardingModal) onboardingModal.classList.remove('active');
}

function toggleOnboardingModal() {
  if (!onboardingModal) return;
  if (onboardingModal.classList.contains('active')) closeOnboardingModal();
  else openOnboardingModal();
}

if (btnOnboarding) btnOnboarding.addEventListener('click', openOnboardingModal);
if (btnCloseOnboarding) btnCloseOnboarding.addEventListener('click', closeOnboardingModal);
if (btnStartGame) btnStartGame.addEventListener('click', closeOnboardingModal);

function openMusicModal() {
  playCameraClick();
  if (musicModal) musicModal.classList.add('active');
}

function closeMusicModal() {
  playAcousticNote(293.66);
  if (musicModal) musicModal.classList.remove('active');
}

function toggleMusicModal() {
  if (!musicModal) return;
  if (musicModal.classList.contains('active')) closeMusicModal();
  else openMusicModal();
}

if (btnMusicManager) btnMusicManager.addEventListener('click', openMusicModal);
if (btnCloseMusic) btnCloseMusic.addEventListener('click', closeMusicModal);

if (btnBrowseMusic && customMusicFile) {
  btnBrowseMusic.addEventListener('click', () => {
    customMusicFile.click();
  });
}

if (customMusicFile && customAudioPlayer) {
  customMusicFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (isAudioPlaying) {
      clearInterval(audioTimer);
      isAudioPlaying = false;
    }

    const objectUrl = URL.createObjectURL(file);
    customAudioPlayer.src = objectUrl;
    customAudioPlayer.play().then(() => {
      isAudioPlaying = true;
      tonearmTargetY = 0.45;
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      if (loadedFileName) loadedFileName.innerText = `▶ ${cleanName}`;
      if (musicBtnLabel) musicBtnLabel.innerText = `🎵 ${cleanName.substring(0, 14)}`;
      const audioHud = document.getElementById('audio-text');
      if (audioHud) audioHud.innerText = `Sonando: ${cleanName}`;
      showThought(`"Puse '${cleanName}' en el tocadiscos... la música perfecta para concentrarme."`);
    }).catch(err => {
      console.warn('Playback error', err);
    });
  });
}

// Opciones predefinidas de música
const musicOptions = document.querySelectorAll('.music-option');
musicOptions.forEach(opt => {
  opt.addEventListener('click', () => {
    musicOptions.forEach(o => o.classList.remove('active'));
    opt.classList.add('active');
    const track = opt.dataset.track;

    if (customAudioPlayer && !customAudioPlayer.paused) {
      customAudioPlayer.pause();
    }

    if (track === 'obstacles') {
      currentAcousticProgression = 0;
      if (!isAudioPlaying) toggleAudio();
      else showThought('"Syd Matters · Obstacles... el himno nostálgico de Arcadia."');
    } else if (track === 'golden') {
      currentAcousticProgression = 1;
      if (!isAudioPlaying) toggleAudio();
      else showThought('"Atardecer en Arcadia... acordes cálidos de reflexión."');
    } else if (track === 'rain') {
      currentAcousticProgression = 2;
      if (!isAudioPlaying) toggleAudio();
      else showThought('"Lluvia en la Ventana... la melancolía del tiempo detenido."');
    }
  });
});

// ============================================================================
// BUCLE DE ANIMACIÓN Y MOTOR DE FÍSICAS (INERCIA, DESLIZAMIENTO & RIGGING)
// ============================================================================

const velocity = new THREE.Vector3();
let walkCycle = 0;
let lastFootstepCycle = 0;
const animClock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = animClock.getDelta();
  const time = animClock.getElapsedTime();

  // 1. ROTACIÓN DEL VINILO Y BRAZO DEL TOCADISCOS
  vinylDisc.rotation.y += isAudioPlaying ? 0.055 : 0.02;
  tonearm.rotation.y = THREE.MathUtils.lerp(tonearm.rotation.y, tonearmTargetY, 0.04);

  // 2. ALETEO SUAVE DE LA MARIPOSA AZUL
  leftWing.rotation.y = Math.sin(time * 16) * 0.75;
  rightWing.rotation.y = -Math.sin(time * 16) * 0.75;
  butterflyGroup.position.y = 2.4 + Math.sin(time * 2.8) * 0.28;
  butterflyGroup.position.x = -1.2 + Math.cos(time * 1.3) * 0.85;
  butterflyGroup.position.z = 0.2 + Math.sin(time * 1.6) * 0.85;

  // 3. MOVIMIENTO DE MOTAS DE POLVO EN LOS RAYOS DE SOL
  const dustPos = dustParticles.geometry.attributes.position.array;
  for (let i = 1; i < dustCount * 3; i += 3) {
    dustPos[i] -= 0.003;
    if (dustPos[i] < 0.2) dustPos[i] = 4.8;
  }
  dustParticles.geometry.attributes.position.needsUpdate = true;

  // 4. ACTUALIZACIÓN DE NOTAS MUSICALES FLOTANTES
  for (let i = activeNotes.length - 1; i >= 0; i--) {
    const n = activeNotes[i];
    n.sprite.position.y += n.vy;
    n.sprite.position.x += n.vx + Math.sin(time * 3 + n.wobble) * 0.002;
    n.life -= delta * 0.65;
    n.sprite.material.opacity = Math.max(0, n.life);
    if (n.life <= 0) {
      musicalNotesGroup.remove(n.sprite);
      n.sprite.geometry.dispose();
      n.sprite.material.dispose();
      activeNotes.splice(i, 1);
    }
  }

  // 5. REGISTRAR HISTORIAL DE MOVIMIENTO PARA EL REWIND
  if (!isRewinding) {
    historyBuffer.push({
      x: avatar.position.x,
      y: avatar.position.y,
      z: avatar.position.z,
      rotY: avatar.rotation.y
    });
    if (historyBuffer.length > 240) historyBuffer.shift();
  }

  // 6. MOVIMIENTO FÍSICO DEL AVATAR CON INERCIA, SPRINT Y COLISIONES
  const inputVector = new THREE.Vector3();
  if (keys.w) inputVector.z -= 1;
  if (keys.s) inputVector.z += 1;
  if (keys.a) inputVector.x -= 1;
  if (keys.d) inputVector.x += 1;

  const isInputActive =
    inputVector.lengthSq() > 0 &&
    !isRewinding &&
    (!journalModal || !journalModal.classList.contains('active'));

  if (isInputActive) {
    exitCinematicFocus();
    inputVector.normalize();
    inputVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngleY);

    const maxSpeed = keys.shift ? 5.2 : 3.4;
    const accel = 22.0 * delta;
    velocity.x = THREE.MathUtils.lerp(velocity.x, inputVector.x * maxSpeed, accel);
    velocity.z = THREE.MathUtils.lerp(velocity.z, inputVector.z * maxSpeed, accel);

    // Rotación suave del avatar en la dirección del movimiento
    const targetAngle = Math.atan2(inputVector.x, inputVector.z);
    avatar.rotation.y = lerpAngle(avatar.rotation.y, targetAngle, 0.24);

    // Inclinación corporal (banking) al virar
    avatar.rotation.z = THREE.MathUtils.lerp(avatar.rotation.z, (keys.a ? 0.08 : keys.d ? -0.08 : 0), 0.12);
  } else if (!isRewinding) {
    velocity.x = THREE.MathUtils.lerp(velocity.x, 0, 16.0 * delta);
    velocity.z = THREE.MathUtils.lerp(velocity.z, 0, 16.0 * delta);
    avatar.rotation.z = THREE.MathUtils.lerp(avatar.rotation.z, 0, 0.16);
  }

  const currentSpeed = velocity.length();

  // Resolución de colisiones con deslizamiento de superficie
  if (currentSpeed > 0.01 && !isRewinding) {
    const nextX = avatar.position.x + velocity.x * delta;
    const nextZ = avatar.position.z + velocity.z * delta;

    if (!checkCollision(nextX, avatar.position.z)) {
      avatar.position.x = nextX;
    } else {
      velocity.x = 0;
    }

    if (!checkCollision(avatar.position.x, nextZ)) {
      avatar.position.z = nextZ;
    } else {
      velocity.z = 0;
    }

    // Animación de extremidades con articulaciones anatómicas reales
    const strideFactor = keys.shift ? 4.6 : 3.2;
    walkCycle += delta * (currentSpeed * strideFactor);

    const swingAmp = keys.shift ? 0.88 : 0.65;
    leftLegPivot.rotation.x = Math.sin(walkCycle) * swingAmp;
    rightLegPivot.rotation.x = -Math.sin(walkCycle) * swingAmp;

    leftArmPivot.rotation.x = -Math.sin(walkCycle) * (swingAmp * 0.8);
    rightArmPivot.rotation.x = Math.sin(walkCycle) * (swingAmp * 0.8);
    leftArmPivot.rotation.z = 0.08;
    rightArmPivot.rotation.z = -0.08;

    // Torso sway e inclinación de carrera
    upperBodyGroup.rotation.x = THREE.MathUtils.lerp(upperBodyGroup.rotation.x, keys.shift ? 0.14 : 0.02, 0.1);
    upperBodyGroup.rotation.y = Math.sin(walkCycle) * 0.08;

    // Rebote vertical rítmico del cuerpo
    hipsGroup.position.y = 0.72 + Math.abs(Math.sin(walkCycle * 2)) * (keys.shift ? 0.06 : 0.04);
    headGroup.rotation.y = 0 - upperBodyGroup.rotation.y * 0.5;

    // Pisadas sonoras sincronizadas al toque del pie
    const footstepPhase = Math.sin(walkCycle);
    if ((footstepPhase > 0.88 && lastFootstepCycle <= 0.88) || (footstepPhase < -0.88 && lastFootstepCycle >= -0.88)) {
      const isOverRug = Math.abs(avatar.position.x - 0.2) < 1.8 && Math.abs(avatar.position.z - 0.4) < 1.4;
      playFootstep(isOverRug);
    }
    lastFootstepCycle = footstepPhase;
  } else if (!isRewinding) {
    if (avatarActionState === 'sitting_armchair') {
      // POSTURA REALISTA: SENTADO EN EL SILLÓN VINTAGE
      avatar.position.lerp(new THREE.Vector3(-3.4, 0.05, 2.3), 0.14);
      avatar.rotation.y = lerpAngle(avatar.rotation.y, 0.82, 0.14);

      hipsGroup.position.set(0, 0.44, 0);
      leftLegPivot.rotation.x = THREE.MathUtils.lerp(leftLegPivot.rotation.x, -Math.PI / 2.1, 0.16);
      rightLegPivot.rotation.x = THREE.MathUtils.lerp(rightLegPivot.rotation.x, -Math.PI / 2.1, 0.16);

      // Brazos relajados sobre los reposabrazos del sillón
      leftArmPivot.rotation.x = THREE.MathUtils.lerp(leftArmPivot.rotation.x, -0.32, 0.14);
      leftArmPivot.rotation.z = THREE.MathUtils.lerp(leftArmPivot.rotation.z, 0.22, 0.14);
      rightArmPivot.rotation.x = THREE.MathUtils.lerp(rightArmPivot.rotation.x, -0.32, 0.14);
      rightArmPivot.rotation.z = THREE.MathUtils.lerp(rightArmPivot.rotation.z, -0.22, 0.14);

      upperBodyGroup.rotation.x = THREE.MathUtils.lerp(upperBodyGroup.rotation.x, 0.08, 0.14);
      upperBodyGroup.position.y = 0.72 + Math.sin(time * 1.8) * 0.008;
      headGroup.rotation.y = 0 + Math.sin(time * 0.6) * 0.04;
    } else if (avatarActionState === 'lying_bed') {
      // POSTURA REALISTA: RECOSTADO EN LA CAMA
      avatar.position.lerp(new THREE.Vector3(-4.5, 0.58, -3.2), 0.14);
      avatar.rotation.x = THREE.MathUtils.lerp(avatar.rotation.x, -Math.PI / 2, 0.14);
      avatar.rotation.y = THREE.MathUtils.lerp(avatar.rotation.y, 0, 0.14);
      avatar.rotation.z = THREE.MathUtils.lerp(avatar.rotation.z, 0, 0.14);

      hipsGroup.position.set(0, 0.72, 0);
      leftLegPivot.rotation.x = THREE.MathUtils.lerp(leftLegPivot.rotation.x, 0, 0.14);
      rightLegPivot.rotation.x = THREE.MathUtils.lerp(rightLegPivot.rotation.x, 0, 0.14);
      leftArmPivot.rotation.x = THREE.MathUtils.lerp(leftArmPivot.rotation.x, 0, 0.14);
      rightArmPivot.rotation.x = THREE.MathUtils.lerp(rightArmPivot.rotation.x, 0, 0.14);

      upperBodyGroup.rotation.x = 0;
      upperBodyGroup.position.y = 0.72 + Math.sin(time * 1.5) * 0.006;
      headGroup.rotation.y = 0;
    } else if (avatarActionState === 'playing_guitar') {
      // POSTURA REALISTA: TOCANDO GUITARRA
      avatar.position.lerp(new THREE.Vector3(-5.0, 0, -1.2), 0.14);
      avatar.rotation.y = lerpAngle(avatar.rotation.y, 1.2, 0.14);

      hipsGroup.position.set(0, 0.72, 0);
      leftLegPivot.rotation.x = THREE.MathUtils.lerp(leftLegPivot.rotation.x, 0, 0.14);
      rightLegPivot.rotation.x = THREE.MathUtils.lerp(rightLegPivot.rotation.x, 0, 0.14);

      // Brazo izquierdo sostiene el mástil, brazo derecho rasguea rítmicamente
      leftArmPivot.rotation.x = THREE.MathUtils.lerp(leftArmPivot.rotation.x, -0.65, 0.16);
      leftArmPivot.rotation.z = THREE.MathUtils.lerp(leftArmPivot.rotation.z, 0.35, 0.16);

      rightArmPivot.rotation.x = -0.45 + Math.sin(time * 5.0) * 0.22;
      rightArmPivot.rotation.z = -0.25;

      upperBodyGroup.rotation.x = THREE.MathUtils.lerp(upperBodyGroup.rotation.x, 0.05, 0.14);
      upperBodyGroup.position.y = 0.72 + Math.sin(time * 5.0) * 0.01;
      headGroup.rotation.y = 0 + 0.15;
    } else {
      // MODO REPOSO (IDLE DE PIE) CON RESPIRACIÓN ORGÁNICA
      leftLegPivot.rotation.x = THREE.MathUtils.lerp(leftLegPivot.rotation.x, 0, 0.14);
      rightLegPivot.rotation.x = THREE.MathUtils.lerp(rightLegPivot.rotation.x, 0, 0.14);
      leftArmPivot.rotation.x = THREE.MathUtils.lerp(leftArmPivot.rotation.x, 0, 0.14);
      rightArmPivot.rotation.x = THREE.MathUtils.lerp(rightArmPivot.rotation.x, 0, 0.14);

      upperBodyGroup.rotation.x = THREE.MathUtils.lerp(upperBodyGroup.rotation.x, 0, 0.14);
      upperBodyGroup.rotation.y = THREE.MathUtils.lerp(upperBodyGroup.rotation.y, 0, 0.1);

      // Respiración natural en reposo
      upperBodyGroup.position.y = 0.72 + Math.sin(time * 2.2) * 0.015;
      leftArmPivot.rotation.z = 0.06 + Math.sin(time * 2.2) * 0.02;
      rightArmPivot.rotation.z = -0.06 - Math.sin(time * 2.2) * 0.02;
      headGroup.rotation.y = 0 + Math.sin(time * 0.8) * 0.05;
    }
  }

  // 7. CÁMARA CINEMÁTICA CON ENFOQUE DINÁMICO Y LÍMITES DE PARED
  let targetCamX, targetCamY, targetCamZ, lookTargetX, lookTargetY, lookTargetZ;

  if (isFirstPerson && avatarActionState !== 'standing') {
    // MODO PRIMERA PERSONA (POV DEL PROTAGONISTA)
    if (avatarActionState === 'sitting_armchair') {
      // Mirar hacia el centro cálido de la habitación: escritorio, ventana y haz de sol
      targetCamX = avatar.position.x;
      targetCamY = avatar.position.y + 1.05;
      targetCamZ = avatar.position.z + 0.2;
      lookTargetX = 0.5;
      lookTargetY = 1.6;
      lookTargetZ = -1.5;
    } else if (avatarActionState === 'lying_bed') {
      // Mirar hacia la ventana y las partículas de sol desde la almohada
      targetCamX = avatar.position.x;
      targetCamY = avatar.position.y + 0.52;
      targetCamZ = avatar.position.z - 0.15;
      lookTargetX = -2.5;
      lookTargetY = 2.4;
      lookTargetZ = -4.5;
    } else {
      targetCamX = avatar.position.x;
      targetCamY = avatar.position.y + 1.25;
      targetCamZ = avatar.position.z;
      lookTargetX = avatar.position.x + Math.sin(avatar.rotation.y) * 4;
      lookTargetY = avatar.position.y + 1.2;
      lookTargetZ = avatar.position.z + Math.cos(avatar.rotation.y) * 4;
    }
  } else if (cinematicFocus) {
    targetCamX = cinematicFocus.camPos.x;
    targetCamY = cinematicFocus.camPos.y;
    targetCamZ = cinematicFocus.camPos.z;

    lookTargetX = cinematicFocus.camLook.x;
    lookTargetY = cinematicFocus.camLook.y;
    lookTargetZ = cinematicFocus.camLook.z;
  } else {
    const horizontalDist = cameraDistance * Math.cos(cameraPitch);
    targetCamX = avatar.position.x + Math.sin(cameraAngleY) * horizontalDist;
    targetCamZ = avatar.position.z + Math.cos(cameraAngleY) * horizontalDist;
    targetCamY = avatar.position.y + 1.2 + cameraDistance * Math.sin(cameraPitch);

    // Evitar que la cámara traspase los muros de la habitación
    targetCamX = Math.max(-5.2, Math.min(5.2, targetCamX));
    targetCamZ = Math.max(-5.2, Math.min(6.2, targetCamZ));
    targetCamY = Math.max(1.6, Math.min(5.4, targetCamY));

    lookTargetX = avatar.position.x;
    lookTargetY = avatar.position.y + 1.25;
    lookTargetZ = avatar.position.z;
  }

  camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCamX, 0.09);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCamY, 0.09);
  camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCamZ, 0.09);

  const desiredLook = new THREE.Vector3(lookTargetX, lookTargetY, lookTargetZ);
  camera.lookAt(desiredLook);

  // 8. PROXIMIDAD A HOTSPOTS Y MARCADORES EN PANTALLA
  updateHotspotsProximity();

  renderer.render(scene, camera);
}

animate();

// RESIZE HANDLER
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
