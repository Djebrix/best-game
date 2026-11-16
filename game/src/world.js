// VOIDHARVEST — the simulation. One state object holds everything; step()
// advances it by one fixed 1/60 s tick. Rendering never touches this file's
// logic, and this file never draws anything.
import {
  COMBO_CAP, COMBO_STEP, COMBO_WINDOW, ENEMIES, PALETTE, PLAYER,
  STEP, VIEW, WIN_WAVE, waveComp,
} from './config.js';
import { separateEnemies, spawnEnemy, spawnPoint, updateEnemy } from './enemies.js';
import { fireWeapon, stepBullets, stepEnemyBullets } from './weapons.js';
import { buyUpgrade } from './upgrades.js';

const MAX_PARTICLES = 420;
const MAX_FLOATERS = 48;

export function createWorld(random, audio) {
  const state = {
    random,
    audio,
    screen: 'title',
    time: 0,
    wave: 0,
    waveState: 'idle',
    score: 0,
    salvage: 0,
    combo: 0,
    comboTimer: 0,
    kills: 0,
    best: 0,
    shake: 0,
    flash: 0,
    intermission: 0,
    spawnQueue: [],
    spawnTimer: 0,
    player: null,
    enemies: [],
    bullets: [],
    ebullets: [],
    particles: [],
    floaters: [],
    pickups: [],
    portals: [],
  };
  resetPlayer(state);
  return state;
}

function resetPlayer(state) {
  state.player = {
    x: VIEW.width / 2,
    y: VIEW.height / 2,
    vx: 0, vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hp: PLAYER.hp,
    maxHp: PLAYER.hp,
    speed: PLAYER.speed,
    magnet: PLAYER.magnet,
    weapon: 'pulse',
    unlocked: new Set(['pulse']),
    up: { damage: 0, rate: 0, speed: 0, hull: 0, magnet: 0 },
    fireTimer: 0,
    dashTime: 0,
    dashCooldown: 0,
    dashDirX: 0,
    dashDirY: 0,
    invuln: 0,
    overdrive: 0,
    contactTimer: 0,
  };
}

export function startRun(state) {
  state.screen = 'play';
  state.time = 0;
  state.wave = 0;
  state.score = 0;
  state.salvage = 0;
  state.combo = 0;
  state.comboTimer = 0;
  state.kills = 0;
  state.shake = 0;
  state.flash = 0;
  state.enemies.length = 0;
  state.bullets.length = 0;
  state.ebullets.length = 0;
  state.particles.length = 0;
  state.floaters.length = 0;
  state.pickups.length = 0;
  state.portals.length = 0;
  resetPlayer(state);
  startWave(state, 1);
}

export function startWave(state, wave) {
  state.screen = 'play';
  state.wave = wave;
  state.waveState = 'spawning';
  const comp = waveComp(wave);
  const queue = [];
  for (const [kind, count] of Object.entries(comp.mix)) {
    for (let i = 0; i < count; i += 1) queue.push(kind);
  }
  // Shuffle the queue so the wave arrives as a mix, not kind by kind.
  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(state.random.next() * (i + 1));
    const tmp = queue[i];
    queue[i] = queue[j];
    queue[j] = tmp;
  }
  state.spawnQueue = queue;
  state.spawnTimer = 0.6;
  state.audio.wave();
}

export function nextWave(state) {
  startWave(state, state.wave + 1);
}

// ---- effects (pooled, no per-frame allocation) ----

export function burst(state, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    if (state.particles.length >= MAX_PARTICLES) return;
    const a = state.random.angle();
    const s = state.random.range(speed * 0.3, speed);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: state.random.range(0.25, 0.6),
      maxLife: 0.6,
      size: state.random.range(2, 4.5),
      color,
    });
  }
}

export function floater(state, x, y, text, color) {
  if (state.floaters.length >= MAX_FLOATERS) state.floaters.shift();
  state.floaters.push({ x, y, text, color, life: 0.8, maxLife: 0.8 });
}

function addShake(state, amount) {
  state.shake = Math.min(14, state.shake + amount);
}

// ---- damage ----

function comboMul(state) {
  return 1 + Math.min(state.combo, COMBO_CAP) * COMBO_STEP;
}

function damageEnemy(state, enemy, damage, x, y) {
  enemy.hp -= damage;
  enemy.flash = 1;
  floater(state, x, y - enemy.radius, String(Math.round(damage)), PALETTE.ink);
  burst(state, x, y, ENEMIES[enemy.kind].color, 3, 160);
  state.audio.hit();
  if (enemy.hp <= 0) killEnemy(state, enemy);
}

function killEnemy(state, enemy) {
  const index = state.enemies.indexOf(enemy);
  if (index !== -1) {
    state.enemies[index] = state.enemies[state.enemies.length - 1];
    state.enemies.pop();
  }
  state.kills += 1;
  state.combo += 1;
  state.comboTimer = COMBO_WINDOW;
  const gained = Math.round(enemy.score * comboMul(state));
  state.score += gained;
  floater(state, enemy.x, enemy.y - enemy.radius - 12, `+${gained}`, PALETTE.amber);
  burst(state, enemy.x, enemy.y, ENEMIES[enemy.kind].color, 18, 320);
  burst(state, enemy.x, enemy.y, PALETTE.white, 6, 200);
  addShake(state, enemy.kind === 'brute' ? 7 : 3);
  state.audio.kill();
  // Splitters burst into minis; everything drops salvage shards.
  if (enemy.kind === 'splitter') {
    for (let i = 0; i < ENEMIES.splitter.children; i += 1) {
      const mini = spawnEnemy('mini', enemy.x + state.random.range(-14, 14), enemy.y + state.random.range(-14, 14), state.wave, state.random);
      state.enemies.push(mini);
    }
  }
  for (let i = 0; i < enemy.salvage; i += 1) {
    state.pickups.push({
      kind: 'salvage', value: 5,
      x: enemy.x + state.random.range(-18, 18),
      y: enemy.y + state.random.range(-18, 18),
      vx: state.random.range(-40, 40), vy: state.random.range(-40, 40),
      life: 14,
    });
  }
  const roll = state.random.next();
  if (roll < 0.09) {
    state.pickups.push({ kind: 'health', value: 20, x: enemy.x, y: enemy.y, vx: 0, vy: 0, life: 12 });
  } else if (roll < 0.14) {
    state.pickups.push({ kind: 'overdrive', value: 8, x: enemy.x, y: enemy.y, vx: 0, vy: 0, life: 12 });
  }
}

function damagePlayer(state, damage, x, y) {
  const player = state.player;
  if (player.invuln > 0 || player.dashTime > 0 || state.screen !== 'play') return;
  player.hp -= damage;
  player.invuln = 0.7;
  player.contactTimer = PLAYER.contactGrace;
  state.combo = 0;
  state.comboTimer = 0;
  state.flash = 0.55;
  addShake(state, 9);
  burst(state, x, y, PALETTE.red, 14, 260);
  state.audio.hurt();
  if (player.hp <= 0) {
    player.hp = 0;
    state.screen = 'over';
    state.best = Math.max(state.best, state.score);
    burst(state, player.x, player.y, PALETTE.cyan, 40, 420);
    state.audio.gameOver();
  }
}

// ---- the step ----

export function step(state, input, dt) {
  state.time += dt;
  state.shake = Math.max(0, state.shake - dt * 26);
  state.flash = Math.max(0, state.flash - dt * 1.6);

  if (state.screen === 'title') {
    if (input.pressedConfirm() || input.pressedClick()) {
      state.audio.unlock();
      startRun(state);
    }
    updateFx(state, dt);
    return;
  }
  if (state.screen === 'over' || state.screen === 'win') {
    if (input.pressedRestart() || input.pressedConfirm()) {
      state.audio.unlock();
      startRun(state);
    }
    updateFx(state, dt);
    return;
  }
  if (state.screen === 'paused') {
    if (input.pressedPause() || input.pressedConfirm()) state.screen = 'play';
    return;
  }
  if (state.screen === 'shop') {
    if (input.pressedDigit(1)) buyUpgrade(state, 'damage');
    if (input.pressedDigit(2)) buyUpgrade(state, 'rate');
    if (input.pressedDigit(3)) buyUpgrade(state, 'speed');
    if (input.pressedDigit(4)) buyUpgrade(state, 'hull');
    if (input.pressedDigit(5)) buyUpgrade(state, 'magnet');
    if (input.pressedDigit(6)) buyUpgrade(state, 'spread');
    if (input.pressedDigit(7)) buyUpgrade(state, 'rail');
    if (input.pressedDigit(8)) buyUpgrade(state, 'repair');
    if (input.pressedConfirm()) nextWave(state);
    updateFx(state, dt);
    return;
  }

  // --- play ---
  const player = state.player;
  if (input.pressedPause()) {
    state.screen = 'paused';
    return;
  }
  if (input.pressedMute()) state.audio.setMuted(!state.audio.isMuted());

  // Movement: accelerate toward the held direction; dash overrides.
  const ax = input.axisX();
  const ay = input.axisY();
  const mag = Math.hypot(ax, ay) || 1;
  const speedMul = 1 + player.up.speed * 0.1;
  if (player.dashTime > 0) {
    player.dashTime -= dt;
    player.vx = player.dashDirX * PLAYER.dashSpeed;
    player.vy = player.dashDirY * PLAYER.dashSpeed;
  } else {
    const targetVx = (ax / mag) * player.speed * speedMul * (ax !== 0 || ay !== 0 ? 1 : 0);
    const targetVy = (ay / mag) * player.speed * speedMul * (ax !== 0 || ay !== 0 ? 1 : 0);
    const accel = 1 - Math.exp(-14 * dt);
    player.vx += (targetVx - player.vx) * accel;
    player.vy += (targetVy - player.vy) * accel;
  }
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.x = Math.max(player.radius, Math.min(VIEW.width - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(VIEW.height - player.radius, player.y));
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.invuln = Math.max(0, player.invuln - dt);
  player.contactTimer = Math.max(0, player.contactTimer - dt);
  player.overdrive = Math.max(0, player.overdrive - dt);
  player.fireTimer = Math.max(0, player.fireTimer - dt);

  if (input.pressedDash() && player.dashCooldown <= 0 && (ax !== 0 || ay !== 0)) {
    player.dashTime = PLAYER.dashTime;
    player.dashCooldown = PLAYER.dashCooldown;
    player.dashDirX = ax / mag;
    player.dashDirY = ay / mag;
    player.invuln = Math.max(player.invuln, PLAYER.dashInvuln);
    burst(state, player.x, player.y, PALETTE.cyan, 10, 200);
    state.audio.dash();
  }

  // Aim at the mouse; hold fire to shoot.
  player.angle = Math.atan2(input.mouse.y - player.y, input.mouse.x - player.x);
  if (input.mouse.down && player.fireTimer <= 0) fireWeapon(state, player.angle);
  if (input.pressedDigit(1) && player.unlocked.has('pulse')) player.weapon = 'pulse';
  if (input.pressedDigit(2) && player.unlocked.has('spread')) player.weapon = 'spread';
  if (input.pressedDigit(3) && player.unlocked.has('rail')) player.weapon = 'rail';

  // Spawn trickle: portals telegraph, then the enemy steps out.
  if (state.waveState === 'spawning') {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.spawnQueue.length > 0) {
      const kind = state.spawnQueue.pop();
      const point = spawnPoint(state.random);
      state.portals.push({ x: point.x, y: point.y, kind, timer: 0.8 });
      state.spawnTimer = Math.max(0.28, 0.75 - state.wave * 0.04);
    }
    if (state.spawnQueue.length === 0 && state.portals.length === 0) state.waveState = 'fighting';
  }
  for (let i = state.portals.length - 1; i >= 0; i -= 1) {
    const portal = state.portals[i];
    portal.timer -= dt;
    if (portal.timer <= 0) {
      state.enemies.push(spawnEnemy(portal.kind, portal.x, portal.y, state.wave, state.random));
      burst(state, portal.x, portal.y, ENEMIES[portal.kind].color, 8, 180);
      state.portals.splice(i, 1);
    }
  }

  // Enemies act, then separate, then projectiles fly.
  for (let i = 0; i < state.enemies.length; i += 1) {
    updateEnemy(state.enemies[i], player, dt, state.time, state.random, (x, y, angle, speed, damage) => {
      state.ebullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage, size: 5, life: 3 });
    });
  }
  separateEnemies(state.enemies);
  stepBullets(state, dt, {
    onEnemyHit: (enemy, damage, x, y) => damageEnemy(state, enemy, damage, x, y),
  });
  stepEnemyBullets(state, dt, {
    onPlayerHit: (damage, x, y) => damagePlayer(state, damage, x, y),
  });

  // Contact damage, with a short grace so one touch is not a blender.
  if (player.contactTimer <= 0) {
    for (let i = 0; i < state.enemies.length; i += 1) {
      const e = state.enemies[i];
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const rr = player.radius + e.radius;
      if (dx * dx + dy * dy < rr * rr) {
        damagePlayer(state, e.damage, e.x, e.y);
        const d = Math.hypot(dx, dy) || 1;
        e.x -= (dx / d) * 26;
        e.y -= (dy / d) * 26;
        break;
      }
    }
  }

  // Pickups: drift, get pulled by the magnet, get collected.
  const magnetR = player.magnet * (1 + player.up.magnet * 0.5);
  for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
    const p = state.pickups[i];
    p.life -= dt;
    const dx = player.x - p.x;
    const dy = player.y - p.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < magnetR) {
      const pull = 900 * (1 - dist / magnetR) + 120;
      p.vx += (dx / dist) * pull * dt;
      p.vy += (dy / dist) * pull * dt;
    }
    p.vx *= Math.exp(-2.5 * dt);
    p.vy *= Math.exp(-2.5 * dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    let gone = p.life <= 0;
    if (dist < player.radius + 14) {
      gone = true;
      if (p.kind === 'salvage') {
        state.salvage += p.value;
        state.audio.pickup();
      } else if (p.kind === 'health') {
        player.hp = Math.min(player.maxHp, player.hp + p.value);
        floater(state, player.x, player.y - 26, `+${p.value} HP`, PALETTE.green);
        state.audio.pickup();
      } else if (p.kind === 'overdrive') {
        player.overdrive = p.value;
        floater(state, player.x, player.y - 26, 'OVERDRIVE!', PALETTE.amber);
        state.audio.pickup();
      }
      burst(state, p.x, p.y, p.kind === 'salvage' ? PALETTE.amber : PALETTE.green, 6, 140);
    }
    if (gone) {
      state.pickups[i] = state.pickups[state.pickups.length - 1];
      state.pickups.pop();
    }
  }

  // Combo decays when the player stops killing.
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 0;
  }

  // Wave clear: bonus, then the shop — or the victory screen on wave 10.
  if (state.waveState === 'fighting' && state.enemies.length === 0 && state.portals.length === 0) {
    const bonus = 250 * state.wave;
    state.score += bonus;
    floater(state, player.x, player.y - 40, `WAVE CLEAR +${bonus}`, PALETTE.amber);
    if (state.wave >= WIN_WAVE) {
      state.screen = 'win';
      state.best = Math.max(state.best, state.score);
      state.audio.victory();
    } else {
      state.waveState = 'clear';
      state.intermission = 2.2;
    }
  }
  if (state.waveState === 'clear') {
    state.intermission -= dt;
    if (state.intermission <= 0) state.screen = 'shop';
  }

  updateFx(state, dt);
}

function updateFx(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.exp(-3 * dt);
    p.vy *= Math.exp(-3 * dt);
    p.life -= dt;
    if (p.life <= 0) {
      state.particles[i] = state.particles[state.particles.length - 1];
      state.particles.pop();
    }
  }
  for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
    const f = state.floaters[i];
    f.y -= 42 * dt;
    f.life -= dt;
    if (f.life <= 0) state.floaters.splice(i, 1);
  }
}
