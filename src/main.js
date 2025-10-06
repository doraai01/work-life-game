// Balance Your Life! — base scaffold (step 1)
// - Canvas setup
// - Resize handling
// - requestAnimationFrame loop

import { stepPhysics, scoreIncrement } from './logic/physics.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Device pixel ratio aware resize
function resize() {
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  const w = Math.floor(window.innerWidth);
  const h = Math.floor(window.innerHeight);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener('resize', resize, { passive: true });
resize();

// Physics params (tunable)
const PHYS = {
  stiffness: 3.5, // restoring strength toward 0 (rad/s^2 per rad)
  damping: 1.8,   // friction (rad/s per rad/s)
  maxAngleDeg: 30,
};
const RULES = {
  loseDeg: 25,   // game over if |angle| >= 25°
  scoreWindowDeg: 5, // score when |angle| <= 5°
  scoreRate: 50, // points per second inside window
  cautionDeg: 20, // warning band starts here
  loseHoldSec: 0.5, // must exceed threshold this long to lose
};
// Prevent events from overlapping
const EVENT_SEPARATION_SEC = 0.5;

// Difficulty presets
const DIFFICULTIES = {
  easy: {
    label: 'EASY',
    inputScale: 1.1,
    rampScale: 1.0,
    physStiffScale: 1.0,
    physDampScale: 1.1,
    eventIntervalScale: 1.25,
    eventDurationScale: 0.9,
    eventTorqueScale: 0.8,
    noiseAmp: 0.0,
    noiseFreq: 1.2,
    scoreRateScale: 1.0,
  },
  normal: {
    label: 'NORMAL',
    inputScale: 1.0,
    rampScale: 1.0,
    physStiffScale: 1.0,
    physDampScale: 1.0,
    eventIntervalScale: 1.0,
    eventDurationScale: 1.0,
    eventTorqueScale: 1.0,
    noiseAmp: 0.0,
    noiseFreq: 1.2,
    scoreRateScale: 1.0,
  },
  hard: {
    label: 'HARD',
    inputScale: 0.85,
    rampScale: 0.9,
    physStiffScale: 0.95,
    physDampScale: 0.9,
    eventIntervalScale: 0.75,
    eventDurationScale: 1.1,
    eventTorqueScale: 1.25,
    noiseAmp: 2.0, // small periodic disturbance torque
    noiseFreq: 1.6,
    scoreRateScale: 1.2,
  },
};

const DEFAULT_DIFFICULTY = {
  label: 'NORMAL',
  inputScale: 1.0,
  rampScale: 1.0,
  physStiffScale: 1.0,
  physDampScale: 1.0,
  eventIntervalScale: 1.0,
  eventDurationScale: 1.0,
  eventTorqueScale: 1.0,
  noiseAmp: 0.0,
  noiseFreq: 1.2,
  scoreRateScale: 1.0,
};

function resolveDifficulty(key) {
  const d = DIFFICULTIES[key];
  return Object.assign({}, DEFAULT_DIFFICULTY, d || {});
}

// Random events configuration
const EVENT_SPECS = {
  overtime: {
    label: '急な残業',
    detail: 'ワーク側が一時的に重くなる（右に傾きやすい）',
    duration: 3, interval: [10, 15], torqueBias: +4
  },
  invitation: {
    label: '友達からの誘い',
    detail: 'ライフ側が一時的に重くなる（左に傾きやすい）',
    duration: 3, interval: [10, 15], torqueBias: -4
  },
  payday: {
    label: '給料日',
    detail: 'ワーク側が安定（右の傾きが戻りやすい）',
    duration: 5, interval: [20, 30], kFactorWork: 0.6
  },
  mindfulness: {
    label: 'マインドフルネス休憩',
    detail: '深呼吸でリセット（バランスを中央へ）',
    duration: 0, interval: [15, 25], immediateReset: true
  },
  deep_focus: {
    label: '深い集中',
    detail: '減衰が上がり揺れにくい',
    duration: 5, interval: [25, 35], dampingFactor: 1.3
  },
  coffee_break: {
    label: 'コーヒーブレイク',
    detail: '入力が少し強く効く',
    duration: 4, interval: [20, 30], inputScaleFactor: 1.15, rampScaleFactor: 1.15
  },
  social_media: {
    label: 'SNSの誘惑',
    detail: '入力が弱くなり操作しづらい',
    duration: 4, interval: [15, 25], inputScaleFactor: 0.85
  },
  deadline: {
    label: '締切迫る',
    detail: '全体の反応が鋭くなる（剛性アップ）',
    duration: 5, interval: [30, 45], kGlobal: 1.15
  },
  family_event: {
    label: '家族の用事',
    detail: 'ライフ側へ軽く引っ張られる',
    duration: 3, interval: [20, 30], torqueBias: -3
  },
  bonus_time: {
    label: 'ボーナスタイム',
    detail: 'スコア倍率アップ＋安全域が少し広がる',
    duration: 4, interval: [25, 40], scoreRateFactor: 1.5, scoreWindowDelta: 2
  },
  brain_fog: {
    label: '体調不良気味',
    detail: '減衰が下がり揺れやすい',
    duration: 3, interval: [20, 30], dampingFactor: 0.85
  },
  random_gust: {
    label: '急な来客対応',
    detail: '周囲が騒がしく外乱が増える',
    duration: 3, interval: [15, 25], noiseAmpBonus: 1.2
  },
};

// Basic game state
const state = {
  angle: 0,           // radians (+ right down)
  angVel: 0,          // rad/s
  inputTorque: 0,     // external torque from player/events (rad/s^2)
  lastTime: performance.now(),
  // HUD/gameplay (endless mode)
  score: 0,           // accumulated points
  best: 0,
  elapsedSec: 0,
  mode: 'menu',       // 'menu' | 'playing' | 'gameover'
  // Events runtime state
  events: {
    overtime: { active: false, until: 0, next: 0 },
    invitation: { active: false, until: 0, next: 0 },
    payday: { active: false, until: 0, next: 0 },
    mindfulness: { active: false, until: 0, next: 0 },
  },
  torqueBias: 0,      // current bias from events
  torqueBiasTarget: 0,
  torqueBiasCurrent: 0,
  kFactorWork: 1.0,   // stiffness factor when angle > 0 (work side)
  // Event-driven multipliers
  kGlobal: 1.0,
  dampingFactor: 1.0,
  inputScaleFactor: 1.0,
  rampScaleFactor: 1.0,
  scoreRateFactor: 1.0,
  scoreWindowDelta: 0,
  noiseAmpBonus: 0,
  eventMessage: '',
  eventMessageUntil: 0,
  eventMessageFrom: 0,
  eventDetail: '',
  // Effects
  scorePops: [],      // {x,y,vy,alpha,text}
  scorePopTimer: 0,
  shakeUntil: 0,
  flashUntil: 0,
  flashColor: '#ffffff',
  particles: [],      // score particles
  // Pan springs (for subtle vertical bobbing)
  pan: { init: false, leftY: 0, leftV: 0, rightY: 0, rightV: 0 },
  // Gauge glow when scoring
  gaugeGlowUntil: 0,
  // Difficulty
  difficultyKey: 'normal',
  difficulty: resolveDifficulty('normal'),
  noisePhase: Math.random() * Math.PI * 2,
};

// Simple UI overlay
const overlay = document.getElementById('overlay');

function setOverlay(html, visible = true) {
  overlay.innerHTML = html;
  overlay.style.opacity = visible ? '1' : '0';
  overlay.style.pointerEvents = visible ? 'auto' : 'none';
}

function startGame(difficultyKey = state.difficultyKey) {
  // apply difficulty
  state.difficultyKey = difficultyKey;
  state.difficulty = resolveDifficulty(difficultyKey);
  state.mode = 'playing';
  state.angle = 0;
  state.angVel = 0;
  state.score = 0;
  state.elapsedSec = 0;
  state.warnCooldownUntil = 0;
  // reset events schedule
  const nowSec = performance.now() / 1000;
  for (const key of Object.keys(state.events)) {
    const spec = EVENT_SPECS[key];
    const [a, b] = spec.interval;
    const scale = getEventIntervalScale();
    state.events[key] = { active: false, until: 0, next: nowSec + randIn(a * scale, b * scale) };
  }
  state.torqueBias = 0;
  state.kFactorWork = 1.0;
  state.kGlobal = 1.0;
  state.dampingFactor = 1.0;
  state.inputScaleFactor = 1.0;
  state.rampScaleFactor = 1.0;
  state.scoreRateFactor = 1.0;
  state.scoreWindowDelta = 0;
  state.noiseAmpBonus = 0;
  state.eventMessage = '';
  state.eventMessageUntil = 0;
  state.eventMessageFrom = 0;
  state.scorePops = [];
  state.scorePopTimer = 0;
  state.shakeUntil = 0;
  state.flashUntil = 0;
  state.pan = { init: false, leftY: 0, leftV: 0, rightY: 0, rightV: 0 };
  state.gaugeGlowUntil = 0;
  state.noisePhase = Math.random() * Math.PI * 2;
  // Reset event torque smoothing and lose timer
  state.torqueBias = 0;
  state.torqueBiasTarget = 0;
  state.torqueBiasCurrent = 0;
  state._loseAt = null;
  // Reset input latch
  inputState.active = false;
  inputState.dir = 0;
  inputState.start = 0;
  setOverlay('', false);
  if (audio.ready) sfxStart();
}

function showMenu() {
  state.mode = 'menu';
  setOverlay(`
    <div style="text-align:center; padding:24px; background:rgba(0,0,0,0.35); border-radius:12px;">
      <h1 style="margin:0 0 12px; font: 700 24px system-ui">Balance Your Life!</h1>
      <p style="margin:0 10px 16px; opacity:0.85; max-width:520px;">画面の左（LIFE）/右（WORK）を長押ししてバランスを取ろう。難易度を選んでスタート！</p>
      <div style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap; margin-bottom:12px;">
        <button id="easyBtn" style="padding:10px 16px; font:600 16px system-ui;">EASY</button>
        <button id="normalBtn" style="padding:10px 16px; font:600 16px system-ui;">NORMAL</button>
        <button id="hardBtn" style="padding:10px 16px; font:600 16px system-ui;">HARD</button>
      </div>
      <small style="opacity:0.8; display:block;">EASY: イベント少なめ・揺れ小 / HARD: イベント多め・揺れ大・操作弱め</small>
    </div>
  `, true);
  document.getElementById('easyBtn')?.addEventListener('click', () => startGame('easy'));
  document.getElementById('normalBtn')?.addEventListener('click', () => startGame('normal'));
  document.getElementById('hardBtn')?.addEventListener('click', () => startGame('hard'));
  // Unlock audio after first user gesture on overlay
  overlay.addEventListener('pointerdown', () => {
    ensureAudio();
    if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
  }, { once: true, passive: true });
}

function showGameOver(win) {
  state.mode = 'gameover';
  const score = Math.floor(state.score);
  const best = Math.max(loadBestScore(), score);
  saveBestScore(best);
  state.best = best;
  if (audio.ready) sfxGameOver();
  vibrate(60);
  setOverlay(`
    <div style="text-align:center; padding:24px; background:rgba(0,0,0,0.35); border-radius:12px; max-width:520px;">
      <h2 style="margin:0 0 8px; font: 700 22px system-ui;">${win ? 'クリア！' : 'ゲームオーバー'}</h2>
      <p style="margin:0 0 8px;">SCORE: <b>${score}</b></p>
      <p style="margin:0 0 16px;">BEST: <b>${best}</b></p>
      <div style="display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-bottom:12px;">
        <button id="retryBtn" style="padding:10px 16px; font:600 16px system-ui;">もう一度</button>
      </div>
      <div style="margin-top:8px;">
        <div style="opacity:0.85; font:600 12px system-ui; margin-bottom:6px;">スコアを共有する</div>
        <div style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap;">
          <button id="shareX" style="padding:8px 12px; font:600 14px system-ui;">Xに投稿</button>
          <button id="shareThreads" style="padding:8px 12px; font:600 14px system-ui;">Threadsに投稿</button>
          <button id="shareLINE" style="padding:8px 12px; font:600 14px system-ui;">LINEで送る</button>
        </div>
      </div>
    </div>
  `, true);
  document.getElementById('retryBtn')?.addEventListener('click', () => startGame());

  // Share handlers
  const pageUrl = location.href;
  const text = `あなたのバランス力は ${score} 点！`;
  function shareToX() {
    const u = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(pageUrl);
    window.open(u, '_blank', 'noopener');
  }
  function shareToLINE() {
    // LINE text share: use text + url
    const u = 'https://line.me/R/msg/text/?' + encodeURIComponent(text + ' ' + pageUrl);
    window.open(u, '_blank', 'noopener');
  }
  function shareToThreads() {
    // Use Threads web intent for挙動の統一（新規タブを開く）
    const u = 'https://www.threads.net/intent/post?text=' + encodeURIComponent(text + '\n' + pageUrl);
    window.open(u, '_blank', 'noopener');
  }
  document.getElementById('shareX')?.addEventListener('click', shareToX);
  document.getElementById('shareLINE')?.addEventListener('click', shareToLINE);
  document.getElementById('shareThreads')?.addEventListener('click', shareToThreads);
}

// Persistence (best score)
const BEST_KEY = 'balance_best_score';
function loadBestScore() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}
function saveBestScore(n) {
  try { localStorage.setItem(BEST_KEY, String(n)); } catch {}
}
state.best = loadBestScore();

function randIn(min, max) { return min + Math.random() * (max - min); }

function getEventIntervalScale() {
  // Base scale from difficulty
  const base = state.difficulty.eventIntervalScale || 1.0;
  // Dynamic scale: as elapsed time approaches 60s, make intervals shorter (more frequent)
  // Clamp so it never gets smaller than 0.6x of original
  const t = Math.min(1, state.elapsedSec / 60);
  const dyn = 1 - 0.4 * t; // 1.0 -> 0.6 over 60s
  return base * Math.max(0.6, dyn);
}

function anyEventActive() {
  for (const key of Object.keys(state.events)) {
    if (state.events[key].active) return true;
  }
  return false;
}

function activeEventsUntilMax() {
  let m = 0;
  for (const key of Object.keys(state.events)) {
    const st = state.events[key];
    if (st.active && st.until > m) m = st.until;
  }
  return m;
}

function postponeOtherEvents(blockUntil, exceptKey) {
  for (const k of Object.keys(state.events)) {
    if (k === exceptKey) continue;
    const e = state.events[k];
    const jitter = randIn(0.1, 0.4);
    e.next = Math.max(e.next, blockUntil + EVENT_SEPARATION_SEC + jitter);
  }
}

function triggerEvent(key, nowSec) {
  const spec = EVENT_SPECS[key];
  const st = state.events[key];
  if (!spec) return;
  // Apply effects
  if (spec.immediateReset) {
    state.angle = 0;
    state.angVel = 0;
    state.eventMessage = `${spec.label}`;
    state.eventDetail = spec.detail || '';
    state.eventMessageFrom = nowSec;
    state.eventMessageUntil = nowSec + 1.5;
    state.flashColor = '#ffffff';
    state.flashUntil = nowSec + 0.25;
    if (audio.ready) sfxMindfulness();
    vibrate(20);
    // schedule next
    const [a, b] = spec.interval;
    const scale = getEventIntervalScale();
    st.next = nowSec + randIn(a * scale, b * scale);
    // prevent immediate overlap with other events
    postponeOtherEvents(nowSec + 0.3, key);
    return;
  }
  st.active = true;
  st.until = nowSec + spec.duration * state.difficulty.eventDurationScale;
  if (spec.torqueBias) {
    state.torqueBiasTarget += spec.torqueBias * state.difficulty.eventTorqueScale;
  }
  if (spec.kFactorWork) {
    state.kFactorWork = Math.min(state.kFactorWork, spec.kFactorWork);
  }
  // Multipliers (additive around 1.0)
  if (spec.kGlobal) state.kGlobal += (spec.kGlobal - 1);
  if (spec.dampingFactor) state.dampingFactor += (spec.dampingFactor - 1);
  if (spec.inputScaleFactor) state.inputScaleFactor += (spec.inputScaleFactor - 1);
  if (spec.rampScaleFactor) state.rampScaleFactor += (spec.rampScaleFactor - 1);
  if (spec.scoreRateFactor) state.scoreRateFactor += (spec.scoreRateFactor - 1);
  if (spec.scoreWindowDelta) state.scoreWindowDelta += spec.scoreWindowDelta;
  if (spec.noiseAmpBonus) state.noiseAmpBonus += spec.noiseAmpBonus;
  state.eventMessage = `${spec.label}！`;
  state.eventDetail = spec.detail || '';
  state.eventMessageFrom = nowSec;
  state.eventMessageUntil = nowSec + spec.duration;
  // visual effects
  if (key === 'overtime' || key === 'invitation') {
    state.shakeUntil = Math.max(state.shakeUntil, nowSec + 0.25);
  }
  if (key === 'payday') {
    state.flashColor = '#9be7a4';
    state.flashUntil = nowSec + 0.2;
  }
  if (audio.ready) {
    if (key === 'overtime') sfxEventOvertime();
    else if (key === 'invitation') sfxEventInvitation();
    else if (key === 'payday') sfxEventPayday();
  }
  vibrate(15);
  // schedule next occurrence
  const [a, b] = spec.interval;
  const scale = getEventIntervalScale();
  st.next = nowSec + randIn(a * scale, b * scale);
  // push other events to after this one finishes
  postponeOtherEvents(st.until, key);
}

function clearEvent(key) {
  const spec = EVENT_SPECS[key];
  const st = state.events[key];
  if (!st.active) return;
  st.active = false;
  if (spec && spec.torqueBias) {
    state.torqueBiasTarget -= spec.torqueBias * state.difficulty.eventTorqueScale;
  }
  if (spec && spec.kFactorWork) {
    state.kFactorWork = 1.0; // reset to default
  }
  if (spec && spec.kGlobal) state.kGlobal -= (spec.kGlobal - 1);
  if (spec && spec.dampingFactor) state.dampingFactor -= (spec.dampingFactor - 1);
  if (spec && spec.inputScaleFactor) state.inputScaleFactor -= (spec.inputScaleFactor - 1);
  if (spec && spec.rampScaleFactor) state.rampScaleFactor -= (spec.rampScaleFactor - 1);
  if (spec && spec.scoreRateFactor) state.scoreRateFactor -= (spec.scoreRateFactor - 1);
  if (spec && spec.scoreWindowDelta) state.scoreWindowDelta -= spec.scoreWindowDelta;
  if (spec && spec.noiseAmpBonus) state.noiseAmpBonus -= spec.noiseAmpBonus;
}

// Input handling (press/hold strengthens effect)
const INPUT = {
  baseTorque: 7.0,   // rad/s^2
  rampTorque: 8.0,   // additional over time
  maxTorque: 18.0,   // cap
};

const inputState = {
  active: false,
  dir: 0,          // +1 => WORK(右に傾く), -1 => LIFE(左に傾く)
  start: 0,
};

function pointerSideFromX(x) {
  // 左半分で LIFE(-1)、右半分で WORK(+1)
  return x < canvas.clientWidth / 2 ? -1 : +1;
}

function onPointerDown(e) {
  if (!e.isPrimary) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const dir = pointerSideFromX(x);
  inputState.active = true;
  inputState.dir = dir;
  inputState.start = performance.now();
  // 画面のスクロールや選択を防止
  e.preventDefault();
}

function onPointerUp(e) {
  if (!e.isPrimary) return;
  inputState.active = false;
  inputState.dir = 0;
}

canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
window.addEventListener('pointerup', onPointerUp, { passive: true });
window.addEventListener('pointercancel', onPointerUp, { passive: true });
// 右クリックは使用しないため、特別な処理は不要

// Keyboard fallback (desktop): Left = LIFE, Right = WORK
const keyDirs = new Map([
  ['ArrowLeft', -1], ['a', -1], ['A', -1],
  ['ArrowRight', +1], ['d', +1], ['D', +1], ['l', +1], ['L', +1],
]);
function onKeyDown(e) {
  if (!keyDirs.has(e.key)) return;
  e.preventDefault();
  inputState.active = true;
  inputState.dir = keyDirs.get(e.key);
  if (!inputState.start) inputState.start = performance.now();
}
function onKeyUp(e) {
  if (!keyDirs.has(e.key)) return;
  e.preventDefault();
  inputState.active = false;
  inputState.dir = 0;
}
window.addEventListener('keydown', onKeyDown, { passive: false });
window.addEventListener('keyup', onKeyUp, { passive: false });

// --- Audio (optional) ---
const audio = {
  ctx: null,
  ready: false,
};

function ensureAudio() {
  if (audio.ready) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  audio.ctx = new AC();
  audio.ready = true;
}

// Light haptics on supported devices
function vibrate(pattern) {
  if (navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch {}
  }
}

function tone(freq = 440, duration = 0.2, type = 'sine', gain = 0.02) {
  if (!audio.ready) return;
  const ctx = audio.ctx;
  const now = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(gain, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  o.connect(g).connect(ctx.destination);
  o.start(now);
  o.stop(now + duration + 0.02);
}

function sfxStart() {
  tone(880, 0.12, 'sine', 0.04);
  setTimeout(() => tone(1320, 0.12, 'sine', 0.03), 90);
}
function sfxWarn() { tone(360, 0.08, 'sawtooth', 0.025); vibrate(10); }
function sfxGameOver() {
  tone(220, 0.3, 'triangle', 0.05);
  setTimeout(() => tone(165, 0.4, 'sine', 0.035), 120);
}
function sfxScore() { tone(1400, 0.06, 'sine', 0.018); }
function sfxEventOvertime() { tone(240, 0.18, 'sawtooth', 0.03); }
function sfxEventInvitation() { tone(880, 0.08, 'sine', 0.02); setTimeout(()=>tone(1100,0.08,'sine',0.018),70); }
function sfxEventPayday() { tone(1320, 0.1, 'triangle', 0.03); setTimeout(()=>tone(1760,0.12,'triangle',0.025),90); }
function sfxMindfulness() { tone(990, 0.12, 'sine', 0.02); setTimeout(()=>tone(660,0.14,'sine',0.018),100); }

function spawnParticles(x, y) {
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 120; // px/s
    state.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 60,
      r: 1.6 + Math.random() * 1.6,
      life: 0.6 + Math.random() * 0.4,
      maxLife: 1.0,
      alpha: 1,
      color: Math.random() < 0.5 ? '#ffe08a' : '#ffd1a9',
    });
  }
}

function drawBackground(t, width, height, angleRad, flashAlpha = 0, flashColor = '#ffffff') {
  // Soft vertical gradient that subtly shifts over time
  const g = ctx.createLinearGradient(0, 0, 0, height);
  const phase = (Math.sin(t * 0.0003) + 1) * 0.5; // 0..1
  const c1 = `hsl(${200 + 20 * phase}, 40%, 12%)`;
  const c2 = `hsl(${260 + 20 * phase}, 50%, 18%)`;
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  // Angle-based warning tint: blue when LIFE side down, red when WORK side down
  const maxRad = (PHYS.maxAngleDeg * Math.PI) / 180;
  const bias = clamp(angleRad / maxRad, -1, 1); // -1..1
  const intensity = Math.min(0.22, Math.abs(bias) * 0.22);
  if (intensity > 0.001) {
    ctx.save();
    ctx.globalAlpha = intensity;
    ctx.fillStyle = bias > 0 ? '#ff5050' : '#78aaff';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // Flash overlay (event-triggered)
  if (flashAlpha > 0.001) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.5, flashAlpha);
    ctx.fillStyle = flashColor;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

function drawScale(cx, cy, width, angleRad, t, panYLeft, panYRight, hang) {
  // Base, pivot, beam, and hanging pans with floating labels
  ctx.save();
  ctx.translate(cx, cy);

  // Base
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-width * 0.25, 60);
  ctx.lineTo(width * 0.25, 60);
  ctx.stroke();

  // Pivot
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();

  // Beam rotation
  ctx.save();
  ctx.rotate(angleRad);
  ctx.strokeStyle = 'rgba(255,255,255,0.88)';
  ctx.lineWidth = 4;
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(-width * 0.35, 0);
  ctx.lineTo(width * 0.35, 0);
  ctx.stroke();
  ctx.restore(); // end beam rotation

  // Compute world anchor points (beam ends)
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const arm = width * 0.35;
  const leftAnchor = { x: -arm * cos, y: -arm * sin };
  const rightAnchor = { x: arm * cos, y: arm * sin };

  // Hang lines and level pans (not rotated)
  const panW = 86;
  const panH = 12;

  // Chains
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(leftAnchor.x, leftAnchor.y);
  ctx.lineTo(leftAnchor.x, leftAnchor.y + hang);
  ctx.moveTo(rightAnchor.x, rightAnchor.y);
  ctx.lineTo(rightAnchor.x, rightAnchor.y + hang);
  ctx.stroke();

  // Rounded rect helper
  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, h/2, w/2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  // Pans with subtle shadow (use spring-based Y positions)
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = 'rgba(120,170,255,0.9)'; // LIFE (left)
  roundRect(leftAnchor.x - panW / 2, panYLeft, panW, panH, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,120,120,0.9)'; // WORK (right)
  roundRect(rightAnchor.x - panW / 2, panYRight, panW, panH, 6);
  ctx.fill();

  // Floating labels with slight bob
  const bob = 3 * Math.sin(t * 0.004);
  ctx.fillStyle = 'rgba(200,220,255,0.98)';
  ctx.font = '700 16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LIFE', leftAnchor.x, panYLeft - 10 + bob);
  ctx.fillStyle = 'rgba(255,200,200,0.98)';
  ctx.fillText('WORK', rightAnchor.x, panYRight - 10 - bob);

  ctx.restore(); // end local
}

function drawHUD(angleDeg, width, { score, best }) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '500 14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`BALANCE: ${angleDeg.toFixed(1)}°`, 16, 28);

  ctx.textAlign = 'center';
  ctx.fillText(`SCORE: ${Math.floor(score)}`, width / 2, 28);
  // Difficulty label on second line (right)
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '600 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.fillText(`MODE: ${state.difficulty.label}`, width - 16, 28);
  ctx.fillText(`BEST: ${Math.floor(best || 0)}`, width - 16, 44);
  ctx.restore();
}

function drawGauge(angleDeg, width, glowAlpha = 0) {
  // 中央上部のバランスゲージ（-30°〜+30°、安全域±5°）
  const cx = width / 2;
  const y = 60; // HUDの少し下
  const w = Math.min(360, Math.floor(width * 0.8));
  const h = 8;
  const max = PHYS.maxAngleDeg;
  const safe = Math.max(1, RULES.scoreWindowDeg + (state.scoreWindowDelta || 0));

  // トラック
  ctx.save();
  ctx.translate(cx - w / 2, y);
  // base
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(0, 0, w, h);
  // blue-neutral-red gradient overlay
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0.0, 'rgba(120,170,255,0.25)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
  grad.addColorStop(1.0, 'rgba(255,120,120,0.25)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 安全域
  const safeStart = ((-safe + max) / (2 * max)) * w;
  const safeWidth = (2 * safe / (2 * max)) * w;
  ctx.fillStyle = 'rgba(120, 200, 160, 0.35)';
  ctx.fillRect(safeStart, 0, safeWidth, h);
  // 警告域（±caution〜±lose）
  const caution = RULES.cautionDeg;
  if (caution < max) {
    const warnLeftStart = ((-max + max) / (2 * max)) * w; // 0
    const warnLeftEnd = ((-caution + max) / (2 * max)) * w;
    const warnRightStart = ((caution + max) / (2 * max)) * w;
    const warnRightEnd = ((max + max) / (2 * max)) * w; // w
    ctx.fillStyle = 'rgba(255, 170, 80, 0.20)';
    ctx.fillRect(0, 0, warnLeftEnd, h);
    ctx.fillRect(warnRightStart, 0, w - warnRightStart, h);
  }
  if (glowAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.9, glowAlpha);
    ctx.shadowColor = 'rgba(120, 200, 160, 0.9)';
    ctx.shadowBlur = 16;
    ctx.fillStyle = 'rgba(120, 200, 160, 0.5)';
    ctx.fillRect(safeStart, -2, safeWidth, h + 4);
    ctx.restore();
  }

  // 目盛り
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  const ticks = [-30, -15, 0, 15, 30];
  ticks.forEach(t => {
    const x = ((t + max) / (2 * max)) * w;
    ctx.beginPath();
    ctx.moveTo(x, -6);
    ctx.lineTo(x, h + 6);
    ctx.stroke();
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '600 10px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(t), x, h + 18);
    ctx.restore();
  });

  // 針
  const clamped = clamp(angleDeg, -max, max);
  const px = ((clamped + max) / (2 * max)) * w;
  // glow if in safe zone
  if (Math.abs(clamped) <= safe) {
    ctx.save();
    ctx.shadowColor = 'rgba(120, 200, 160, 0.8)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.moveTo(px, h + 10);
    ctx.lineTo(px - 6, h + 0);
    ctx.lineTo(px + 6, h + 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.moveTo(px, h + 10);
  ctx.lineTo(px - 6, h + 0);
  ctx.lineTo(px + 6, h + 0);
  ctx.closePath();
  ctx.fill();
  // angle label
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '600 11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${clamped.toFixed(1)}°`, px, -10);
  ctx.restore();
  ctx.restore();
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function frame(now) {
  const dt = Math.min(50, now - state.lastTime); // ms cap
  state.lastTime = now;
  const dtSec = dt / 1000;
  const nowSec = now / 1000;

  // Physics integration (simple damped spring + external torque)
  // Update torque from input (press/hold ramps up)
  let torque = 0;
  const inputEnabled = state.mode === 'playing';
  if (inputEnabled && inputState.active) {
    const held = (now - inputState.start) / 1000; // seconds
    const mag = Math.min(
      (INPUT.baseTorque * state.difficulty.inputScale * state.inputScaleFactor) +
      (INPUT.rampTorque * state.difficulty.rampScale * state.rampScaleFactor) * held,
      INPUT.maxTorque * state.difficulty.inputScale * state.inputScaleFactor
    );
    torque = inputState.dir * mag;
  }
  // Smooth ramp event bias torque towards target
  const lerpRate = 3; // per second (slower ramp to avoid spikes)
  const diff = state.torqueBiasTarget - state.torqueBiasCurrent;
  state.torqueBiasCurrent += diff * Math.min(1, lerpRate * dtSec);
  // Scale event torque when already tilted near lose threshold
  const absDegTilt = Math.abs((state.angle * 180) / Math.PI);
  let torqueFactor = 1;
  if (absDegTilt > RULES.cautionDeg) {
    const span = Math.max(1, RULES.loseDeg - RULES.cautionDeg);
    torqueFactor = Math.max(0.2, 1 - (absDegTilt - RULES.cautionDeg) / span);
  }
  torque += state.torqueBiasCurrent * torqueFactor;
  // Add difficulty noise torque
  if (state.mode === 'playing') {
    const amp = (state.difficulty.noiseAmp || 0) + (state.noiseAmpBonus || 0);
    if (amp > 0) {
      const ns = amp * Math.sin(nowSec * state.difficulty.noiseFreq + state.noisePhase);
      torque += ns;
    }
  }
  // Clamp total torque to avoid unrealistic spikes
  const MAX_TORQUE = 14;
  torque = clamp(torque, -MAX_TORQUE, MAX_TORQUE);
  state.inputTorque = torque;
  // Physics step via pure function (apply difficulty scales)
  const maxRad = (PHYS.maxAngleDeg * Math.PI) / 180;
  const physStiff = PHYS.stiffness * state.difficulty.physStiffScale * state.kGlobal;
  const physDamp = PHYS.damping * state.difficulty.physDampScale * state.dampingFactor;
  const next = stepPhysics(
    state.angle,
    state.angVel,
    torque,
    dtSec,
    { stiffness: physStiff, damping: physDamp, maxAngleRad: maxRad, kFactorWork: state.kFactorWork }
  );
  state.angle = next.angle;
  state.angVel = next.angVel;

  // Game state updates
  if (state.mode === 'playing') {
    state.elapsedSec += dtSec;
    // スコア加算（±5°の安全域）
    const effWindow = Math.max(1, RULES.scoreWindowDeg + (state.scoreWindowDelta || 0));
    const effRate = RULES.scoreRate * (state.difficulty.scoreRateScale || 1) * (state.scoreRateFactor || 1);
    const inc = scoreIncrement(state.angle, { scoreWindowDeg: effWindow, scoreRate: effRate }, dtSec);
    state.score += inc;
    // スコアポップ: 一定間隔で+値を表示
    if (inc > 0) {
      state.scorePopTimer += dtSec;
      if (state.scorePopTimer >= 0.5) {
        state.scorePopTimer -= 0.5;
        const text = `+${Math.round(effRate * 0.5)}`;
        state.scorePops.push({
          x: canvas.clientWidth / 2,
          y: 100,
          vy: -24, // px/s upward
          alpha: 1,
          text,
        });
        // パーティクル生成
        spawnParticles(canvas.clientWidth / 2, 100);
        if (audio.ready) sfxScore();
      }
      // ゲージのハイライトを軽く延長
      state.gaugeGlowUntil = Math.max(state.gaugeGlowUntil, now / 1000 + 0.2);
    } else {
      state.scorePopTimer = 0;
    }
    // Warning beep near threshold
    if (audio.ready) {
      const warnDeg = RULES.loseDeg - 3;
      const nowSecWarn = now / 1000;
      const absDeg = Math.abs((state.angle * 180) / Math.PI);
      if (absDeg >= warnDeg && nowSecWarn > (state.warnCooldownUntil || 0)) {
        sfxWarn();
        state.warnCooldownUntil = nowSecWarn + 1.2;
      }
    }
    // Lose if exceeded threshold for a short hold time
    const absDeg2 = Math.abs((state.angle * 180) / Math.PI);
    if (absDeg2 >= RULES.loseDeg) {
      state._loseAt = state._loseAt || now;
      if ((now - state._loseAt) / 1000 >= RULES.loseHoldSec) {
        showGameOver(false);
      }
    } else {
      state._loseAt = null;
    }

    // Update events timers (no overlap)
    // 1) clear expired
    for (const key of Object.keys(state.events)) {
      const st = state.events[key];
      if (st.active && nowSec >= st.until) {
        clearEvent(key);
      }
    }
    // 2) trigger at most one new event, postpone others if something is active
    const hasActive = anyEventActive();
    const activeUntil = activeEventsUntilMax();
    let triggered = false;
    for (const key of Object.keys(state.events)) {
      const st = state.events[key];
      if (!st.active && nowSec >= st.next) {
        if (hasActive || triggered) {
          // defer this event to after active one ends
          const jitter = randIn(0.1, 0.4);
          st.next = Math.max(st.next, activeUntil + EVENT_SEPARATION_SEC + jitter);
        } else {
          triggerEvent(key, nowSec);
          triggered = true;
        }
      }
    }
  }

  // Compute effects
  const flashAlpha = state.flashUntil > nowSec ? (state.flashUntil - nowSec) / 0.25 : 0;
  // Clear / background with angle-based tint and flash
  drawBackground(now, canvas.clientWidth, canvas.clientHeight, state.angle, flashAlpha, state.flashColor);

  // Center coordinates
  // Screen shake
  let shakeX = 0, shakeY = 0;
  if (state.shakeUntil > nowSec) {
    const left = state.shakeUntil - nowSec; // seconds
    const amp = Math.min(1, left / 0.25) * 4; // px
    shakeX = (Math.random() * 2 - 1) * amp;
    shakeY = (Math.random() * 2 - 1) * amp;
  }
  const cx = canvas.clientWidth / 2 + shakeX;
  const cy = canvas.clientHeight / 2 + shakeY;
  const widthUsed = Math.min(canvas.clientWidth, 640);

  // Pan springs update (follows anchor Y with a small spring)
  const arm = widthUsed * 0.35;
  const sin = Math.sin(state.angle);
  const leftTargetY = (-arm * sin) + 36;  // anchorY + hang
  const rightTargetY = (arm * sin) + 36;
  if (!state.pan.init) {
    state.pan.init = true;
    state.pan.leftY = leftTargetY;
    state.pan.rightY = rightTargetY;
    state.pan.leftV = 0;
    state.pan.rightV = 0;
  } else {
    const kp = 40; // spring stiffness
    const kd = 6;  // damping
    // left
    let ay = -kp * (state.pan.leftY - leftTargetY) - kd * state.pan.leftV;
    state.pan.leftV += ay * dtSec;
    state.pan.leftY += state.pan.leftV * dtSec;
    // right
    ay = -kp * (state.pan.rightY - rightTargetY) - kd * state.pan.rightV;
    state.pan.rightV += ay * dtSec;
    state.pan.rightY += state.pan.rightV * dtSec;
  }

  // Draw scale with current angle and springy pans
  drawScale(cx, cy, widthUsed, state.angle, now, state.pan.leftY, state.pan.rightY, 36);

  // HUD
  const angleDeg = (state.angle * 180) / Math.PI;
  drawHUD(angleDeg, canvas.clientWidth, state);
  const glowAlpha = state.gaugeGlowUntil > nowSec ? Math.min(1, (state.gaugeGlowUntil - nowSec) / 0.2) : 0;
  drawGauge(angleDeg, canvas.clientWidth, glowAlpha);
  // Event message (top center)
  if (state.eventMessage && nowSec <= state.eventMessageUntil) {
    const total = state.eventMessageUntil - state.eventMessageFrom;
    const remain = Math.max(0, state.eventMessageUntil - nowSec);
    const alpha = total > 0 ? (remain < 0.5 ? remain / 0.5 : 1) : 1;
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${(0.95 * alpha).toFixed(3)})`;
    ctx.font = '700 16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`EVENT: ${state.eventMessage}`, canvas.clientWidth / 2, 86);
    if (state.eventDetail) {
      ctx.font = '600 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillStyle = `rgba(255,255,255,${(0.85 * alpha).toFixed(3)})`;
      ctx.fillText(state.eventDetail, canvas.clientWidth / 2, 104);
    }
    ctx.restore();
  }

  // Score popups
  if (state.scorePops.length) {
    for (let i = state.scorePops.length - 1; i >= 0; i--) {
      const p = state.scorePops[i];
      p.y += p.vy * dtSec;
      p.alpha -= 0.8 * dtSec;
      if (p.alpha <= 0) { state.scorePops.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
      ctx.fillStyle = '#ffe08a';
      ctx.font = '700 16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 6;
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    }
  }

  // Particles
  if (state.particles.length) {
    ctx.save();
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const q = state.particles[i];
      q.vx *= 0.99;
      q.vy += 12 * dtSec; // gravity
      q.x += q.vx * dtSec;
      q.y += q.vy * dtSec;
      q.life -= dtSec;
      if (q.life <= 0) { state.particles.splice(i, 1); continue; }
      const a = Math.max(0, Math.min(1, q.life / q.maxLife)) * q.alpha;
      ctx.globalAlpha = a;
      ctx.fillStyle = q.color;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// Start at menu
showMenu();

// Offline機能は無効化：Service Worker登録は行わない
