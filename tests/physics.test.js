import { stepPhysics, scoreIncrement, toRad } from '../src/logic/physics.js';

const results = document.getElementById('results');
function log(ok, msg) {
  const li = document.createElement('li');
  li.className = ok ? 'ok' : 'ng';
  li.textContent = (ok ? '✔ ' : '✖ ') + msg;
  results.appendChild(li);
}

function approxEqual(a, b, eps = 1e-6) { return Math.abs(a - b) <= eps; }

try {
  // Test 1: Zero state remains stable without torque
  {
    const phys = { stiffness: 3.5, damping: 1.8, maxAngleRad: toRad(30), kFactorWork: 1.0 };
    const s1 = stepPhysics(0, 0, 0, 1 / 60, phys);
    log(approxEqual(s1.angle, 0) && approxEqual(s1.angVel, 0), '角度0/トルク0では静止を維持');
  }

  // Test 2: Positive torque increases angular velocity (work側に傾く)
  {
    const phys = { stiffness: 3.5, damping: 1.8, maxAngleRad: toRad(30), kFactorWork: 1.0 };
    const s1 = stepPhysics(0, 0, +10, 0.016, phys);
    log(s1.angVel > 0 && s1.angle > 0, '正トルクで右(ワーク側)に回転が始まる');
  }

  // Test 3: Scoring within ±5° adds points
  {
    const rules = { scoreWindowDeg: 5, scoreRate: 50 };
    const gained = scoreIncrement(0, rules, 1.0);
    log(approxEqual(gained, 50), '±5°内で1秒=50点が加算される');
  }

  // Test 4: Outside safe window yields 0
  {
    const rules = { scoreWindowDeg: 5, scoreRate: 50 };
    const gained = scoreIncrement(toRad(10), rules, 1.0);
    log(approxEqual(gained, 0), '±5°外ではスコアは増えない');
  }
} catch (e) {
  log(false, 'テスト中に例外: ' + (e && e.message ? e.message : e));
}

