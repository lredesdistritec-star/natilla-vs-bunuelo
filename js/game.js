// ========================================================
// PEGA AQUÍ LA URL DE TU GOOGLE APPS SCRIPT (/exec)
const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbxhndxicZInzU-H8fpp04fCA3kqmlbSLB3Aaliu-BOXznrTvkCl8C7GD5yxENCSVgpX/exec";
// ========================================================

// Precarga de personajes oficiales
const imgNatilla = new Image();
imgNatilla.src = 'assets/natilla.png';
const imgBunuelo = new Image();
imgBunuelo.src = 'assets/bunuelo.png';

let selectedFighter = 'natilla';
let playerName = '';
let playerSede = '';
let currentTab = 'asesores';
let cachedRankingData = null;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Estado global del torneo (3 Stages)
let currentStage = 1;
let stageScores = [0, 0, 0];
let totalHits = 0;
let bestMaxCombo = 1;

// Estado de partida activa (cada stage dura 55s con 4 rounds)
let gameRunning = false;
let score = 0;
let combo = 1;
let maxCombo = 1;
let hits = 0;
let timeLeft = 55;
let currentRound = 1;
let timerInterval = null;
let spawnTimer = 0;
let shakeTime = 0;
let enemyHurtTime = 0;
let playerAttackTime = 0;
let playerHurtTime = 0;
let roundBannerTimer = 0;
let roundBannerText = '';

const lanes = [70, 200, 330];
const laneIcons = ['⚡', '🔥', '📱'];
const hitZoneY = 305;

// Variables Stage 1 (Ritmo)
let notes = [];

// Variables Stage 2 (Choque de Poderes)
let beamPos = 0.5; // 0 = Rival gana choque, 1 = Jugador gana choque
let clashCharge = 0;
let clashSurgeCount = 0;

// Variables Stage 3 (Atrapa y Esquiva)
let catcherLane = 1;
let fallingItems = [];

let particles = [];
let floatingTexts = [];

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, type = 'sine', duration = 0.1) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.11, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function selectFighter(fighter, el) {
  selectedFighter = fighter;
  document.querySelectorAll('.fighter-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  playTone(520, 'triangle', 0.08);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function triggerRoundBanner(text) {
  roundBannerText = text;
  roundBannerTimer = 65;
  playTone(780, 'square', 0.18);
}

function getAccumulatedScore() {
  return stageScores.reduce((acc, v) => acc + v, 0) + (gameRunning ? score : 0);
}

function startTournament() {
  const nameInput = document.getElementById('player-name').value.trim();
  if (!nameInput) {
    alert('Escribe tu nombre y apellido para registrar tu récord.');
    return;
  }
  playerName = nameInput;
  playerSede = document.getElementById('player-sede').value;

  currentStage = 1;
  stageScores = [0, 0, 0];
  totalHits = 0;
  bestMaxCombo = 1;

  startStage(1);
}

function startNextStage() {
  startStage(currentStage + 1);
}

function startStage(stageNum) {
  currentStage = stageNum;
  score = 0;
  combo = 1;
  maxCombo = 1;
  hits = 0;
  timeLeft = 55;
  currentRound = 1;
  spawnTimer = 0;

  notes = [];
  fallingItems = [];
  particles = [];
  floatingTexts = [];
  beamPos = 0.5;
  clashCharge = 0;
  clashSurgeCount = 0;
  catcherLane = 1;
  gameRunning = true;

  // Configurar controles e indicadores según Stage
  const badge = document.getElementById('hud-stage-badge');
  const controls3 = document.getElementById('controls-3lane');
  const controlsClash = document.getElementById('controls-clash');

  if (currentStage === 1) {
    badge.textContent = 'STAGE 1/3 • RITMO';
    controls3.classList.remove('hidden');
    controlsClash.classList.add('hidden');
    document.getElementById('lbl-btn-0').textContent = 'IZQ (A)';
    document.getElementById('lbl-btn-1').textContent = 'CENTRO (S)';
    document.getElementById('lbl-btn-2').textContent = 'DER (D)';
  } else if (currentStage === 2) {
    badge.textContent = 'STAGE 2/3 • CHOQUE';
    controls3.classList.add('hidden');
    controlsClash.classList.remove('hidden');
  } else {
    badge.textContent = 'STAGE 3/3 • LLUVIA';
    controls3.classList.remove('hidden');
    controlsClash.classList.add('hidden');
    document.getElementById('lbl-btn-0').textContent = 'CARRIL 1 (A)';
    document.getElementById('lbl-btn-1').textContent = 'CARRIL 2 (S)';
    document.getElementById('lbl-btn-2').textContent = 'CARRIL 3 (D)';
  }

  document.getElementById('hud-time').textContent = '55s';
  updateRoundUI(1);
  updateHUD();
  showScreen('game-screen');

  const introNames = {
    1: 'STAGE 1: ¡GOLPES DE RITMO!',
    2: 'STAGE 2: ¡CHOQUE DE PODERES!',
    3: 'STAGE 3: ¡ATRAPA Y ESQUIVA!'
  };
  triggerRoundBanner(introNames[currentStage]);

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById('hud-time').textContent = timeLeft + 's';

    if (timeLeft === 40 && currentRound === 1) {
      currentRound = 2;
      updateRoundUI(2);
      triggerRoundBanner('ROUND 2: ¡CONTRAATAQUE x1.5!');
    } else if (timeLeft === 26 && currentRound === 2) {
      currentRound = 3;
      updateRoundUI(3);
      triggerRoundBanner('ROUND 3: ¡MODO FURIA x2!');
    } else if (timeLeft === 14 && currentRound === 3) {
      currentRound = 4;
      updateRoundUI(4);
      triggerRoundBanner('⚡ ROUND 4: ¡SOBRECARGA x3! ⚡');
    }

    if (timeLeft <= 0) {
      finishStage();
    }
  }, 1000);

  requestAnimationFrame(gameLoop);
}

function updateRoundUI(round) {
  const pill = document.getElementById('hud-round');
  if (round === 1) {
    pill.textContent = 'ROUND 1';
    pill.className = 'round-pill';
  } else if (round === 2) {
    pill.textContent = 'ROUND 2 (x1.5)';
    pill.className = 'round-pill';
  } else if (round === 3) {
    pill.textContent = '🔥 FURIA (x2)';
    pill.className = 'round-pill furia';
  } else {
    pill.textContent = '⚡ EXTREM (x3)';
    pill.className = 'round-pill furia';
  }
}

function updateHUD() {
  document.getElementById('hud-score').textContent = score.toLocaleString();
  document.getElementById('hud-combo').textContent = 'x' + combo;
  document.getElementById('hud-total-score').textContent =
    'Acumulado: ' + getAccumulatedScore().toLocaleString();
}

// ========================================================
// MECÁNICA STAGE 1: RITMO Y PRECISIÓN
// ========================================================
function spawnStage1Wave() {
  if (currentRound === 1) {
    const lane = Math.floor(Math.random() * 3);
    notes.push({ lane, y: 102, speed: 3.9, icon: laneIcons[lane], isGold: false, hit: false });
  } else if (currentRound === 2) {
    const lane = Math.floor(Math.random() * 3);
    const isGold = Math.random() < 0.25;
    notes.push({
      lane,
      y: 102,
      speed: 5.1,
      icon: isGold ? '👑' : laneIcons[lane],
      isGold,
      hit: false
    });
  } else if (currentRound === 3) {
    const lane1 = Math.floor(Math.random() * 3);
    notes.push({ lane: lane1, y: 102, speed: 5.7, icon: '👑', isGold: true, hit: false });

    if (Math.random() < 0.45) {
      const lane2 = (lane1 + 1 + Math.floor(Math.random() * 2)) % 3;
      notes.push({ lane: lane2, y: 102, speed: 5.7, icon: laneIcons[lane2], isGold: false, hit: false });
    }
  } else {
    const lane1 = Math.floor(Math.random() * 3);
    notes.push({ lane: lane1, y: 102, speed: 6.4, icon: '💎', isGold: true, hit: false });

    if (Math.random() < 0.65) {
      const lane2 = (lane1 + 1 + Math.floor(Math.random() * 2)) % 3;
      notes.push({ lane: lane2, y: 102, speed: 6.4, icon: '👑', isGold: true, hit: false });
    }
  }
}

function handleStage1Lane(lane) {
  let targetIndex = -1;
  let minDist = 999;

  notes.forEach((n, idx) => {
    if (n.lane === lane && !n.hit) {
      const dist = Math.abs(n.y - hitZoneY);
      if (dist < minDist) {
        minDist = dist;
        targetIndex = idx;
      }
    }
  });

  if (targetIndex !== -1 && minDist <= 46) {
    const note = notes[targetIndex];
    note.hit = true;
    const isPerfect = minDist <= 20;

    const roundMult = currentRound === 1 ? 1 : (currentRound === 2 ? 1.5 : (currentRound === 3 ? 2 : 3));
    const goldBonus = note.isGold ? 50 : 0;
    const basePts = (isPerfect ? 140 : 100) + goldBonus;
    const points = Math.round(basePts * roundMult * combo);

    score += points;
    hits++;
    combo = Math.min(combo + 1, 8);
    if (combo > maxCombo) maxCombo = combo;

    playerAttackTime = 10;
    enemyHurtTime = 12;
    shakeTime = isPerfect ? 8 : 4;

    const burstColor = note.isGold ? '#ffd000' : '#5ce619';
    spawnParticles(lanes[lane], hitZoneY, burstColor, 14);
    spawnParticles(275, 52, burstColor, 10);
    addFloatingText(isPerfect ? `¡CRÍTICO! +${points}` : `+${points}`, lanes[lane], hitZoneY - 24, burstColor);
    playTone(isPerfect ? 880 : 620, 'triangle', 0.08);
  } else {
    combo = 1;
    playerHurtTime = 10;
    score = Math.max(0, score - 30);
    addFloatingText('¡FALLO! -30', lanes[lane], hitZoneY - 20, '#ff3b3b');
    playTone(155, 'sawtooth', 0.11);
  }

  updateHUD();
}

// ========================================================
// MECÁNICA STAGE 2: CHOQUE DE PODERES (TAP BATTLE)
// ========================================================
function triggerClash() {
  if (!gameRunning || currentStage !== 2) return;

  const btn = document.getElementById('btn-clash');
  btn.classList.add('pressed');
  setTimeout(() => btn.classList.remove('pressed'), 80);

  // Fuerza base del jugador ligeramente más exigente y con resistencia progresiva según dominio
  const basePush = currentRound === 1 ? 0.040 : (currentRound === 2 ? 0.036 : (currentRound === 3 ? 0.033 : 0.030));
  const resistanceFactor = beamPos > 0.72 ? 0.80 : (beamPos < 0.30 ? 1.15 : 1.0);
  const pushPower = basePush * resistanceFactor;
  beamPos = Math.min(1, beamPos + pushPower);
  clashCharge += 18;
  hits++;
  playerAttackTime = 6;

  const clashX = 72 + beamPos * 256;
  spawnParticles(clashX, 215, currentRound >= 3 ? '#ffd000' : '#5ce619', 7);

  const roundMult = currentRound === 1 ? 1 : (currentRound === 2 ? 1.5 : (currentRound === 3 ? 2 : 3));

  if (beamPos >= 0.94) {
    // Explosión de poder sobre el rival
    clashSurgeCount++;
    combo = Math.min(8, 1 + clashSurgeCount);
    if (combo > maxCombo) maxCombo = combo;

    const bonus = Math.round(450 * roundMult * combo);
    score += bonus;
    enemyHurtTime = 18;
    shakeTime = 12;
    beamPos = 0.48;
    spawnParticles(320, 215, '#ffd000', 24);
    addFloatingText(`💥 ¡IMPACTO TOTAL! +${bonus}`, 200, 165, '#ffd000');
    playTone(920, 'square', 0.15);
  } else {
    const tapPts = Math.round(28 * roundMult * combo);
    score += tapPts;
    if (hits % 6 === 0) {
      addFloatingText(`+${tapPts}`, clashX, 185, '#5ce619');
    }
    playTone(420 + beamPos * 320, 'triangle', 0.05);
  }

  updateHUD();
}

// ========================================================
// MECÁNICA STAGE 3: ATRAPA Y ESQUIVA (LLUVIA DE BONOS)
// ========================================================
function spawnStage3Wave() {
  const lane = Math.floor(Math.random() * 3);
  const rand = Math.random();
  let type = 'good';
  let icon = laneIcons[lane];

  const bombProb = currentRound === 1 ? 0.18 : (currentRound === 2 ? 0.24 : (currentRound === 3 ? 0.28 : 0.32));
  const goldProb = currentRound >= 3 ? 0.35 : 0.20;

  if (rand < bombProb) {
    type = 'bomb';
    icon = '💣';
  } else if (rand < bombProb + goldProb) {
    type = 'gold';
    icon = currentRound === 4 ? '💎' : '👑';
  }

  const speed = currentRound === 1 ? 4.1 : (currentRound === 2 ? 5.2 : (currentRound === 3 ? 6.0 : 6.8));
  fallingItems.push({ lane, y: 102, speed, icon, type, collected: false });

  if (currentRound >= 3 && Math.random() < 0.45) {
    const lane2 = (lane + 1 + Math.floor(Math.random() * 2)) % 3;
    const isBomb2 = type !== 'bomb' && Math.random() < 0.35;
    fallingItems.push({
      lane: lane2,
      y: 102,
      speed,
      icon: isBomb2 ? '💣' : '👑',
      type: isBomb2 ? 'bomb' : 'gold',
      collected: false
    });
  }
}

function handleStage3Lane(lane) {
  catcherLane = lane;
  playTone(480, 'sine', 0.05);
}

// ========================================================
// ROUTER DE CONTROLES (BOTONES Y TECLADO)
// ========================================================
function triggerLane(lane) {
  if (!gameRunning) return;

  const btn = document.getElementById('btn-' + lane);
  if (btn) {
    btn.classList.add('pressed');
    setTimeout(() => btn.classList.remove('pressed'), 95);
  }

  if (currentStage === 1) {
    handleStage1Lane(lane);
  } else if (currentStage === 3) {
    handleStage3Lane(lane);
  }
}

window.addEventListener('keydown', (e) => {
  if (!gameRunning) return;

  if (currentStage === 2) {
    if (e.code === 'Space' || e.key === 'a' || e.key === 'A' || e.key === 's' || e.key === 'S' || e.key === 'd' || e.key === 'D' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      triggerClash();
    }
    return;
  }

  if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') triggerLane(0);
  if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') triggerLane(1);
  if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') triggerLane(2);
});

// ========================================================
// EFECTOS VISUALES Y BUCLE PRINCIPAL
// ========================================================
function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 7.5,
      vy: (Math.random() - 0.5) * 7.5,
      life: 20,
      color
    });
  }
}

function addFloatingText(text, x, y, color) {
  floatingTexts.push({ text, x, y, color, life: 26 });
}

function drawFighterSprite(img, centerX, centerY, size, flipX, isHurt) {
  if (!img.complete) return;
  ctx.save();
  ctx.translate(centerX, centerY);
  if (flipX) ctx.scale(-1, 1);
  if (isHurt && Math.floor(Date.now() / 50) % 2 === 0) {
    ctx.filter = 'brightness(1.8) sepia(1) hue-rotate(-50deg) saturate(5)';
  }
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
}

function gameLoop() {
  if (!gameRunning) return;

  ctx.save();
  if (shakeTime > 0) {
    ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
    shakeTime--;
  }

  ctx.fillStyle = '#070d09';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Luz de arena
  const glowColor = currentRound === 4
    ? 'rgba(255, 65, 54, 0.35)'
    : (currentRound === 3 ? 'rgba(255, 208, 0, 0.28)' : 'rgba(92, 230, 25, 0.30)');
  const grad = ctx.createRadialGradient(200, 50, 10, 200, 50, 205);
  grad.addColorStop(0, glowColor);
  grad.addColorStop(1, 'rgba(7, 13, 9, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, 130);

  // Encabezado del ring (Luchadores VS)
  const pOffsetX = playerAttackTime > 0 ? 22 : 0;
  const eOffsetX = enemyHurtTime > 0 ? 12 : 0;
  if (playerAttackTime > 0) playerAttackTime--;
  if (enemyHurtTime > 0) enemyHurtTime--;
  if (playerHurtTime > 0) playerHurtTime--;

  const playerImg = selectedFighter === 'natilla' ? imgNatilla : imgBunuelo;
  const enemyImg = selectedFighter === 'natilla' ? imgBunuelo : imgNatilla;
  const playerFlip = selectedFighter === 'bunuelo';
  const enemyFlip = selectedFighter === 'bunuelo';

  drawFighterSprite(playerImg, 118 + pOffsetX, 50, 74, playerFlip, playerHurtTime > 0);
  drawFighterSprite(enemyImg, 282 + eOffsetX, 50, 74, enemyFlip, enemyHurtTime > 0);

  ctx.textAlign = 'center';
  ctx.font = '900 18px Arial';
  ctx.fillStyle = currentRound >= 3 ? '#ffd000' : '#5ce619';
  ctx.fillText('VS', 200, 56);

  ctx.strokeStyle = '#1f3a28';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(15, 96);
  ctx.lineTo(385, 96);
  ctx.stroke();

  // Render específico de cada Stage
  if (currentStage === 1) {
    renderStage1();
  } else if (currentStage === 2) {
    renderStage2(playerImg, enemyImg, playerFlip, enemyFlip);
  } else {
    renderStage3(playerImg, playerFlip);
  }

  // Partículas
  particles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 4, 4);
  });
  particles = particles.filter(p => p.life > 0);

  // Textos flotantes
  floatingTexts.forEach((ft) => {
    ft.y -= 1.2;
    ft.life--;
    ctx.font = 'bold 13px Arial';
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
  });
  floatingTexts = floatingTexts.filter(ft => ft.life > 0);

  // Banner de Round / Stage
  if (roundBannerTimer > 0) {
    roundBannerTimer--;
    ctx.fillStyle = 'rgba(5, 8, 6, 0.90)';
    ctx.fillRect(18, 160, 364, 44);
    ctx.strokeStyle = currentRound >= 3 ? '#ffd000' : '#5ce619';
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 160, 364, 44);
    ctx.font = 'bold 15px Arial';
    ctx.fillStyle = currentRound >= 3 ? '#ffd000' : '#5ce619';
    ctx.fillText(roundBannerText, 200, 188);
  }

  ctx.restore();
  requestAnimationFrame(gameLoop);
}

function renderStage1() {
  lanes.forEach((x) => {
    ctx.strokeStyle = 'rgba(92, 230, 25, 0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 98);
    ctx.lineTo(x, hitZoneY);
    ctx.stroke();

    ctx.strokeStyle = currentRound >= 3 ? '#ffd000' : '#5ce619';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, hitZoneY, 24, 0, Math.PI * 2);
    ctx.stroke();
  });

  spawnTimer++;
  const spawnInterval = currentRound === 1 ? 38 : (currentRound === 2 ? 31 : (currentRound === 3 ? 27 : 24));
  if (spawnTimer >= spawnInterval) {
    spawnStage1Wave();
    spawnTimer = 0;
  }

  notes.forEach((n) => {
    if (n.hit) return;
    n.y += n.speed;

    ctx.fillStyle = n.isGold ? '#2b2407' : '#132619';
    ctx.beginPath();
    ctx.arc(lanes[n.lane], n.y, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = n.isGold ? '#ffd000' : '#5ce619';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '21px Arial';
    ctx.fillText(n.icon, lanes[n.lane], n.y + 7);

    if (n.y > hitZoneY + 42) {
      n.hit = true;
      combo = 1;
      updateHUD();
    }
  });

  notes = notes.filter(n => !n.hit);
}

function renderStage2(playerImg, enemyImg, playerFlip, enemyFlip) {
  // Empuje constante del rival según el Round
  // Empuje constante y contra-presión de la CPU por Round (a 60 FPS)
  const baseEnemyPush = currentRound === 1 ? 0.0034 : (currentRound === 2 ? 0.0049 : (currentRound === 3 ? 0.0064 : 0.0079));
  // Cuando el jugador lleva ventaja (>65%), la CPU resiste un poco más para exigir remate
  const counterPressure = beamPos > 0.65 ? 1.18 : (beamPos < 0.28 ? 0.85 : 1.0);
  const enemyPush = baseEnemyPush * counterPressure;
  beamPos = Math.max(0.05, beamPos - enemyPush);

  if (beamPos <= 0.07) {
    // Rival rompe defensa
    combo = 1;
    clashSurgeCount = 0;
    playerHurtTime = 14;
    shakeTime = 8;
    beamPos = 0.42;
    score = Math.max(0, score - 120);
    addFloatingText('¡RIVAL EMPUJA! -120', 200, 165, '#ff3b3b');
    playTone(150, 'sawtooth', 0.14);
    updateHUD();
  }

  // Barra superior de dominio
  ctx.fillStyle = '#111e16';
  ctx.fillRect(30, 118, 340, 18);
  ctx.strokeStyle = '#2d5239';
  ctx.lineWidth = 2;
  ctx.strokeRect(30, 118, 340, 18);

  const playerBarW = 336 * beamPos;
  ctx.fillStyle = '#5ce619';
  ctx.fillRect(32, 120, playerBarW, 14);
  ctx.fillStyle = '#ff3b3b';
  ctx.fillRect(32 + playerBarW, 120, 336 - playerBarW, 14);

  ctx.font = 'bold 11px Arial';
  ctx.fillStyle = '#9eb3a4';
  ctx.fillText('¡TOCA RÁPIDO PARA EMPUJAR EL RAYO HASTA EL RIVAL!', 200, 152);

  // Duelo de rayos en la arena inferior
  const clashX = 72 + beamPos * 256;

  // Rayo Jugador (Verde Neón)
  ctx.strokeStyle = '#5ce619';
  ctx.lineWidth = 12 + Math.sin(Date.now() * 0.03) * 3;
  ctx.beginPath();
  ctx.moveTo(68, 235);
  ctx.lineTo(clashX, 235);
  ctx.stroke();

  // Rayo Rival (Rojo / Dorado)
  ctx.strokeStyle = currentRound >= 3 ? '#ffd000' : '#ff3b3b';
  ctx.lineWidth = 12 + Math.cos(Date.now() * 0.03) * 3;
  ctx.beginPath();
  ctx.moveTo(332, 235);
  ctx.lineTo(clashX, 235);
  ctx.stroke();

  // Esfera de choque central
  const orbRadius = 22 + Math.sin(Date.now() * 0.04) * 4;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(clashX, 235, orbRadius * 0.55, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = currentRound >= 3 ? '#ffd000' : '#5ce619';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(clashX, 235, orbRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Avatares en duelo abajo
  drawFighterSprite(playerImg, 54, 235, 86, playerFlip, playerHurtTime > 0);
  drawFighterSprite(enemyImg, 346, 235, 86, enemyFlip, enemyHurtTime > 0);

  ctx.font = 'bold 12px Arial';
  ctx.fillStyle = '#ffd000';
  ctx.fillText(`DOMINIO: ${Math.round(beamPos * 100)}%`, 200, 315);
}

function renderStage3(playerImg, playerFlip) {
  // Guías de carriles
  lanes.forEach((x, idx) => {
    ctx.strokeStyle = idx === catcherLane ? 'rgba(92, 230, 25, 0.35)' : 'rgba(92, 230, 25, 0.10)';
    ctx.lineWidth = idx === catcherLane ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(x, 98);
    ctx.lineTo(x, 330);
    ctx.stroke();
  });

  // Plataforma / personaje atrapador abajo
  const cx = lanes[catcherLane];
  ctx.fillStyle = 'rgba(92, 230, 25, 0.2)';
  ctx.beginPath();
  ctx.ellipse(cx, 334, 34, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  drawFighterSprite(playerImg, cx, 304, 68, playerFlip, playerHurtTime > 0);

  spawnTimer++;
  const spawnInterval = currentRound === 1 ? 34 : (currentRound === 2 ? 28 : (currentRound === 3 ? 23 : 19));
  if (spawnTimer >= spawnInterval) {
    spawnStage3Wave();
    spawnTimer = 0;
  }

  fallingItems.forEach((item) => {
    if (item.collected) return;
    item.y += item.speed;

    ctx.fillStyle = item.type === 'bomb' ? '#2b0909' : (item.type === 'gold' ? '#2b2407' : '#132619');
    ctx.beginPath();
    ctx.arc(lanes[item.lane], item.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = item.type === 'bomb' ? '#ff3b3b' : (item.type === 'gold' ? '#ffd000' : '#5ce619');
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '20px Arial';
    ctx.fillText(item.icon, lanes[item.lane], item.y + 7);

    // Colisión con el personaje en su carril
    if (item.lane === catcherLane && Math.abs(item.y - 300) <= 32) {
      item.collected = true;
      const roundMult = currentRound === 1 ? 1 : (currentRound === 2 ? 1.5 : (currentRound === 3 ? 2 : 3));

      if (item.type === 'bomb') {
        combo = 1;
        playerHurtTime = 14;
        shakeTime = 9;
        score = Math.max(0, score - 150);
        spawnParticles(cx, 295, '#ff3b3b', 16);
        addFloatingText('💥 ¡BOMBA! -150', cx, 265, '#ff3b3b');
        playTone(140, 'sawtooth', 0.16);
      } else {
        const basePts = item.type === 'gold' ? 160 : 100;
        const pts = Math.round(basePts * roundMult * combo);
        score += pts;
        hits++;
        combo = Math.min(combo + 1, 8);
        if (combo > maxCombo) maxCombo = combo;

        const color = item.type === 'gold' ? '#ffd000' : '#5ce619';
        spawnParticles(cx, 295, color, 12);
        addFloatingText(`+${pts}`, cx, 265, color);
        playTone(item.type === 'gold' ? 860 : 620, 'triangle', 0.08);
      }
      updateHUD();
    } else if (item.y > 350) {
      item.collected = true;
    }
  });

  fallingItems = fallingItems.filter(i => !i.collected);
}

// ========================================================
// TRANSICIÓN ENTRE STAGES Y CIERRE DE TORNEO
// ========================================================
function finishStage() {
  gameRunning = false;
  clearInterval(timerInterval);
  playTone(540, 'triangle', 0.25);

  stageScores[currentStage - 1] = score;
  totalHits += hits;
  if (maxCombo > bestMaxCombo) bestMaxCombo = maxCombo;

  const totalNow = getAccumulatedScore();

  if (currentStage < 3) {
    document.getElementById('inter-badge').textContent = `STAGE ${currentStage} DE 3 COMPLETADO`;
    document.getElementById('inter-avatar-img').src =
      selectedFighter === 'natilla' ? 'assets/natilla.png' : 'assets/bunuelo.png';
    document.getElementById('inter-stage-pts').textContent = score.toLocaleString() + ' pts';
    document.getElementById('inter-total-pts').textContent = totalNow.toLocaleString() + ' pts';

    if (currentStage === 1) {
      document.getElementById('inter-title').textContent = '¡Gran primer round en el ring!';
      document.getElementById('next-stage-desc').innerHTML =
        'Sigue <strong>Stage 2: Choque de Poderes</strong>. Toca rápido el botón central (o Barra Espaciadora) para empujar el rayo de energía hacia tu rival.';
      document.getElementById('btn-next-stage').textContent = '¡Comenzar Stage 2 (55s)!';
    } else {
      document.getElementById('inter-title').textContent = '¡Poder desatado!';
      document.getElementById('next-stage-desc').innerHTML =
        'Último reto: <strong>Stage 3: Atrapa y Esquiva</strong>. Muévete entre los 3 carriles para recoger bonos 👑💎 y esquivar las bombas 💣.';
      document.getElementById('btn-next-stage').textContent = '¡Comenzar Stage Final 3 (55s)!';
    }

    showScreen('intermission-screen');
  } else {
    endTournament();
  }
}

async function endTournament() {
  const finalTotal = getAccumulatedScore();

  document.getElementById('end-avatar-img').src =
    selectedFighter === 'natilla' ? 'assets/natilla.png' : 'assets/bunuelo.png';
  document.getElementById('final-score').textContent = finalTotal.toLocaleString() + ' pts';
  document.getElementById('stage-breakdown').innerHTML = `
    <span>S1: ${stageScores[0].toLocaleString()}</span>
    <span>S2: ${stageScores[1].toLocaleString()}</span>
    <span>S3: ${stageScores[2].toLocaleString()}</span>
  `;
  document.getElementById('final-stats').textContent =
    `${playerName} (${playerSede}) • ${totalHits} aciertos • Combo máx x${bestMaxCombo}`;
  document.getElementById('sync-status').textContent = GOOGLE_SHEETS_URL
    ? 'Sincronizando récord acumulado con el ranking en vivo...'
    : 'Modo demo local (pega tu URL de Google Sheets para ranking global)';

  showScreen('end-screen');

  await saveScore({
    name: playerName,
    sede: playerSede,
    team: selectedFighter === 'natilla' ? 'Natilla' : 'Buñuelo',
    score: finalTotal
  });
}

function resetToMenu() {
  loadRankings();
  showScreen('start-screen');
}

function switchTab(tab, el) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  if (cachedRankingData) renderRankingLists(cachedRankingData);
}

function getFallbackData() {
  const local = JSON.parse(localStorage.getItem('distritec_versus_v2')) || [
    { name: 'Laura Gómez', sede: 'Líderes', team: 'Natilla', score: 18450, tries: 2 },
    { name: 'Andrés Morales', sede: 'Redes Principal', team: 'Buñuelo', score: 16900, tries: 3 },
    { name: 'Valentina Ríos', sede: 'Administrativos', team: 'Natilla', score: 15200, tries: 1 }
  ];
  let natilla = 0, bunuelo = 0;
  const sedesMap = {};
  local.forEach(i => {
    if (i.team === 'Natilla') natilla += i.score;
    else bunuelo += i.score;
    sedesMap[i.sede] = (sedesMap[i.sede] || 0) + i.score;
  });
  const sedes = Object.keys(sedesMap).map(sede => ({ sede, score: sedesMap[sede] })).sort((a, b) => b.score - a.score);
  return { top10: local.slice(0, 10), teams: { natilla, bunuelo }, sedes };
}

async function saveScore(entry) {
  let local = JSON.parse(localStorage.getItem('distritec_versus_v2')) || [];
  const existing = local.find(i => i.name.toLowerCase() === entry.name.toLowerCase() && i.sede === entry.sede);
  if (existing) {
    existing.tries = (existing.tries || 1) + 1;
    if (entry.score > existing.score) {
      existing.score = entry.score;
      existing.team = entry.team;
    }
  } else {
    local.push({ ...entry, tries: 1 });
  }
  local.sort((a, b) => b.score - a.score);
  localStorage.setItem('distritec_versus_v2', JSON.stringify(local));

  if (GOOGLE_SHEETS_URL) {
    try {
      const res = await fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(entry)
      });
      const data = await res.json();
      cachedRankingData = data;
      renderRankingLists(data);
      document.getElementById('sync-status').textContent = '✅ Récord acumulado actualizado en vivo';
      return;
    } catch (err) {
      document.getElementById('sync-status').textContent = '⚠️ Guardado localmente (sin conexión al servidor)';
    }
  }

  const fallback = getFallbackData();
  cachedRankingData = fallback;
  renderRankingLists(fallback);
}

async function loadRankings() {
  if (GOOGLE_SHEETS_URL) {
    try {
      const res = await fetch(GOOGLE_SHEETS_URL);
      const data = await res.json();
      cachedRankingData = data;
      renderRankingLists(data);
      return;
    } catch (err) {
      console.warn('Usando datos locales');
    }
  }
  const fallback = getFallbackData();
  cachedRankingData = fallback;
  renderRankingLists(fallback);
}

function renderRankingLists(data) {
  const natillaTxt = `🍮 Natilla: ${data.teams.natilla.toLocaleString()}`;
  const bunueloTxt = `Buñuelo: ${data.teams.bunuelo.toLocaleString()} 🥯`;
  document.getElementById('team-natilla-pts').textContent = natillaTxt;
  document.getElementById('team-bunuelo-pts').textContent = bunueloTxt;
  document.getElementById('team-natilla-pts-end').textContent = natillaTxt;
  document.getElementById('team-bunuelo-pts-end').textContent = bunueloTxt;

  const asesoresHtml = data.top10.map((item, idx) => `
    <div class="rank-row">
      <div class="rank-pos">#${idx + 1}</div>
      <div class="rank-info">
        <strong>${item.team === 'Natilla' ? '🍮' : '🥯'} ${item.name}</strong>
        <span class="rank-sede">${item.sede} • ${item.tries || 1} intento(s)</span>
      </div>
      <div class="rank-score">${item.score.toLocaleString()} pts</div>
    </div>
  `).join('');

  const sedesHtml = data.sedes.map((item, idx) => `
    <div class="rank-row">
      <div class="rank-pos">#${idx + 1}</div>
      <div class="rank-info">
        <strong>🏢 ${item.sede}</strong>
        <span class="rank-sede">Puntaje acumulado del equipo</span>
      </div>
      <div class="rank-score">${item.score.toLocaleString()} pts</div>
    </div>
  `).join('');

  document.getElementById('ranking-list-start').innerHTML =
    currentTab === 'asesores' ? asesoresHtml : sedesHtml;
  document.getElementById('ranking-list-end').innerHTML = asesoresHtml;
}

loadRankings();
