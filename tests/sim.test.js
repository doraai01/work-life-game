import { stepPhysics, toDeg } from '../src/logic/physics.js';

const results = document.getElementById('results');
function log(ok, msg) {
  const li = document.createElement('li');
  li.className = ok ? 'ok' : 'ng';
  li.textContent = (ok ? '✔ ' : '✖ ') + msg;
  results.appendChild(li);
}

// Simulate the "invitation" event torque ramp and ensure it doesn't instantly cause a loss.
try {
  const phys = { stiffness: 3.5, damping: 1.8, maxAngleRad: (30 * Math.PI) / 180, kFactorWork: 1.0 };
  const targetBias = -4; // invitation (after further balancing tweaks)
  const lerpRate = 3;    // per-second ramp used in main.js
  const dt = 0.016;

  let angle = 0, angVel = 0, bias = 0;
  let maxAbsDeg = 0;
  let t = 0;
  while (t < 0.3) { // simulate 300ms after event starts
    // ramp bias
    bias += (targetBias - bias) * Math.min(1, lerpRate * dt);
    const next = stepPhysics(angle, angVel, bias, dt, phys);
    angle = next.angle;
    angVel = next.angVel;
    const absDeg = Math.abs(toDeg(angle));
    if (absDeg > maxAbsDeg) maxAbsDeg = absDeg;
    t += dt;
  }
  log(maxAbsDeg < 25, `招待イベント直後(300ms)に±25°を超えない: max=${maxAbsDeg.toFixed(1)}°`);
} catch (e) {
  log(false, 'シミュレーション中に例外: ' + (e && e.message ? e.message : e));
}
