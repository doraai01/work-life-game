// Tiny physics helpers for the balance game
// Pure functions for easy testing in browser

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function toDeg(rad) { return (rad * 180) / Math.PI; }
export function toRad(deg) { return (deg * Math.PI) / 180; }

// Step the angular physics with a damped spring and external torque.
// Params
// - angle, angVel: current radians / rad/s
// - torque: external rad/s^2 (input + events)
// - dtSec: seconds
// - phys: { stiffness, damping, maxAngleRad, kFactorWork }
export function stepPhysics(angle, angVel, torque, dtSec, phys) {
  let k = phys.stiffness;
  const c = phys.damping;
  // Payday-like effect: when angle > 0 (work side down), reduce stiffness
  if (phys.kFactorWork && angle > 0) {
    k *= phys.kFactorWork;
  }
  const angAcc = -k * angle - c * angVel + torque;
  const newAngVel = angVel + angAcc * dtSec;
  const newAngle = clamp(angle + newAngVel * dtSec, -phys.maxAngleRad, phys.maxAngleRad);
  return { angle: newAngle, angVel: newAngVel };
}

// Compute score increment for this frame based on angle.
// rules: { scoreWindowDeg, scoreRate }
export function scoreIncrement(angleRad, rules, dtSec) {
  const absDeg = Math.abs(toDeg(angleRad));
  return absDeg <= rules.scoreWindowDeg ? rules.scoreRate * dtSec : 0;
}

