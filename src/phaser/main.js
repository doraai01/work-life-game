import { stepPhysics, scoreIncrement, toRad } from '../logic/physics.js';

// Minimal Phaser 3 skeleton for Balance Your Life!
// - Uses Phaser.Graphics for drawing
// - Reuses physics helpers from src/logic/physics.js

const PHYS = { stiffness: 3.5, damping: 1.8, maxAngleDeg: 30 };
const RULES = { loseDeg: 25, scoreWindowDeg: 5, scoreRate: 50 };

class BalanceScene extends Phaser.Scene {
  constructor() { super('Balance'); }

  init() {
    this.state = {
      angle: 0,
      angVel: 0,
      last: 0,
      timeLeft: 60,
      score: 0,
      input: { active: false, dir: 0, start: 0 },
    };
  }

  create() {
    const { width, height } = this.scale;
    this.g = this.add.graphics();
    this.hudLeft = this.add.text(16, 12, '', { fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', fontSize: 14, color: '#ffffff' });
    this.hudCenter = this.add.text(width/2, 12, '', { fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', fontSize: 14, color: '#ffffff' }).setOrigin(0.5, 0);
    this.hudRight = this.add.text(width-16, 12, '', { fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', fontSize: 14, color: '#ffffff' }).setOrigin(1,0);

    this.lifeLabel = this.add.text(0, 0, 'LIFE', { fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', fontSize: 16, color: '#c8dcff', fontStyle: 'bold' }).setOrigin(0.5);
    this.workLabel = this.add.text(0, 0, 'WORK', { fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', fontSize: 16, color: '#ffd0d0', fontStyle: 'bold' }).setOrigin(0.5);

    // Input: pointer
    this.input.on('pointerdown', (p) => {
      const dir = p.x < this.scale.width / 2 ? -1 : +1;
      this.state.input = { active: true, dir, start: this.time.now };
    });
    this.input.on('pointerup', () => { this.state.input.active = false; this.state.input.dir = 0; });

    // Resize handling
    this.scale.on('resize', (size) => {
      this.hudCenter.setPosition(size.width/2, 12);
      this.hudRight.setPosition(size.width-16, 12);
    });
  }

  update(time, delta) {
    const dtSec = Math.min(50, delta) / 1000;
    const maxRad = toRad(PHYS.maxAngleDeg);

    // Input torque (press/hold ramps up)
    let torque = 0;
    if (this.state.input.active) {
      const held = (time - this.state.input.start) / 1000;
      const base = 7.0, ramp = 8.0, maxT = 18.0;
      const mag = Math.min(base + ramp * held, maxT);
      torque = this.state.input.dir * mag;
    }

    // Physics step
    const next = stepPhysics(this.state.angle, this.state.angVel, torque, dtSec, {
      stiffness: PHYS.stiffness,
      damping: PHYS.damping,
      maxAngleRad: maxRad,
      kFactorWork: 1.0,
    });
    this.state.angle = next.angle;
    this.state.angVel = next.angVel;

    // Scoring / timer / lose
    this.state.timeLeft = Math.max(0, this.state.timeLeft - dtSec);
    this.state.score += scoreIncrement(this.state.angle, { scoreWindowDeg: RULES.scoreWindowDeg, scoreRate: RULES.scoreRate }, dtSec);
    const absDeg = Math.abs(this.state.angle * 180 / Math.PI);
    const lose = absDeg >= RULES.loseDeg;
    const win = this.state.timeLeft <= 0;

    // Render
    this.renderScene(absDeg);

    // HUD
    this.hudLeft.setText(`BALANCE: ${ (this.state.angle * 180 / Math.PI).toFixed(1) }°`);
    this.hudCenter.setText(`SCORE: ${Math.floor(this.state.score)}`);
    this.hudRight.setText(`TIMER: ${Math.ceil(this.state.timeLeft)}s`);

    if (lose || win) {
      this.scene.pause();
      const msg = lose ? 'ゲームオーバー' : 'クリア！';
      const text = this.add.text(this.scale.width/2, this.scale.height/2, `${msg}\nSCORE: ${Math.floor(this.state.score)}\nタップで再スタート`, {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        fontSize: 20,
        color: '#ffffff',
        align: 'center'
      }).setOrigin(0.5);
      this.input.once('pointerdown', () => { text.destroy(); this.scene.restart(); });
    }
  }

  renderScene(absDeg) {
    const g = this.g;
    const w = this.scale.width;
    const h = this.scale.height;
    g.clear();

    // Background gradient approximation
    const tint = Math.min(0.22, absDeg / PHYS.maxAngleDeg * 0.22);
    const color = this.state.angle > 0 ? 0xff5050 : 0x78aaff;
    g.fillStyle(0x121826, 1);
    g.fillRect(0,0,w,h);
    if (tint > 0.001) {
      g.fillStyle(color, tint);
      g.fillRect(0,0,w,h);
    }

    const cx = w/2;
    const cy = h/2;
    const widthUsed = Math.min(w, 640);
    const arm = widthUsed * 0.35;

    // Base
    g.lineStyle(2, 0xffffff, 0.4);
    g.beginPath();
    g.moveTo(cx - widthUsed * 0.25, cy + 60);
    g.lineTo(cx + widthUsed * 0.25, cy + 60);
    g.strokePath();

    // Beam
    const cos = Math.cos(this.state.angle), sin = Math.sin(this.state.angle);
    g.lineStyle(4, 0xffffff, 0.88);
    g.beginPath();
    g.moveTo(cx - arm * cos, cy - arm * sin);
    g.lineTo(cx + arm * cos, cy + arm * sin);
    g.strokePath();

    // Chains
    const hang = 36;
    const leftAnchor = { x: cx - arm * cos, y: cy - arm * sin };
    const rightAnchor = { x: cx + arm * cos, y: cy + arm * sin };
    g.lineStyle(1.5, 0xffffff, 0.5);
    g.beginPath();
    g.moveTo(leftAnchor.x, leftAnchor.y);
    g.lineTo(leftAnchor.x, leftAnchor.y + hang);
    g.moveTo(rightAnchor.x, rightAnchor.y);
    g.lineTo(rightAnchor.x, rightAnchor.y + hang);
    g.strokePath();

    // Pans
    const panW = 86, panH = 12;
    g.fillStyle(0x78aaff, 0.9);
    g.fillRoundedRect(leftAnchor.x - panW/2, leftAnchor.y + hang, panW, panH, 6);
    g.fillStyle(0xff7878, 0.9);
    g.fillRoundedRect(rightAnchor.x - panW/2, rightAnchor.y + hang, panW, panH, 6);

    // Labels near pans
    this.lifeLabel.setPosition(leftAnchor.x, leftAnchor.y + hang - 12);
    this.workLabel.setPosition(rightAnchor.x, rightAnchor.y + hang - 12);
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'phaser-root',
  backgroundColor: '#0a0a0a',
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH, width: '100%', height: '100%' },
  scene: [BalanceScene],
});

