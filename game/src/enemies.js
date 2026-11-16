// Enemy kinds and their movement. Each enemy is a plain object in
// state.enemies; the world owns the array and the deaths, this module owns
// how each kind moves and, for shooters, when it fires.
import { ENEMIES, VIEW, waveComp } from './config.js';

export function spawnEnemy(kindId, x, y, wave, random) {
  const def = ENEMIES[kindId];
  const scale = waveComp(wave);
  return {
    kind: kindId,
    x, y,
    vx: 0, vy: 0,
    radius: def.radius,
    hp: Math.round(def.hp * scale.hpScale),
    maxHp: Math.round(def.hp * scale.hpScale),
    speed: def.speed * scale.speedScale * random.range(0.9, 1.1),
    score: def.score,
    damage: def.damage,
    salvage: def.salvage,
    fireTimer: random.range(0.6, 1.8),
    wobble: random.angle(),
    strafeDir: random.pick([-1, 1]),
    flash: 0,
  };
}

// Pick a spawn point just inside a random edge of the arena.
export function spawnPoint(random) {
  const edge = random.int(0, 3);
  const m = 46;
  if (edge === 0) return { x: random.range(m, VIEW.width - m), y: m };
  if (edge === 1) return { x: random.range(m, VIEW.width - m), y: VIEW.height - m };
  if (edge === 2) return { x: m, y: random.range(m, VIEW.height - m) };
  return { x: VIEW.width - m, y: random.range(m, VIEW.height - m) };
}

export function updateEnemy(enemy, player, dt, time, random, fireBullet) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  enemy.flash = Math.max(0, enemy.flash - dt * 6);

  if (enemy.kind === 'shooter') {
    // Keep a firing distance: close in when far, back off when too near,
    // and strafe sideways so the player cannot sit on one line.
    const want = ENEMIES.shooter.range;
    const radial = dist > want + 40 ? 1 : dist < want - 60 ? -0.8 : 0;
    const px = -ny * enemy.strafeDir;
    const py = nx * enemy.strafeDir;
    enemy.vx = (nx * radial + px * 0.7) * enemy.speed;
    enemy.vy = (ny * radial + py * 0.7) * enemy.speed;
    if (Math.abs(Math.sin(time * 0.4 + enemy.wobble)) < 0.02) enemy.strafeDir *= -1;
    enemy.fireTimer -= dt;
    if (enemy.fireTimer <= 0 && dist < ENEMIES.shooter.range + 120) {
      enemy.fireTimer = 1 / ENEMIES.shooter.fireRate + random.range(0, 0.4);
      fireBullet(enemy.x, enemy.y, Math.atan2(dy, dx), ENEMIES.shooter.bulletSpeed, enemy.damage);
    }
  } else {
    // Chasers, minis, splitters and brutes all hunt the player, each with
    // its own wobble so the pack does not move as one blob.
    const wob = Math.sin(time * 2.2 + enemy.wobble) * 0.35;
    const wx = nx * Math.cos(wob) - ny * Math.sin(wob);
    const wy = nx * Math.sin(wob) + ny * Math.cos(wob);
    enemy.vx = wx * enemy.speed;
    enemy.vy = wy * enemy.speed;
  }

  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  enemy.x = Math.max(enemy.radius, Math.min(VIEW.width - enemy.radius, enemy.x));
  enemy.y = Math.max(enemy.radius, Math.min(VIEW.height - enemy.radius, enemy.y));
}

// Light separation so enemies do not stack on one point. Counts are small
// (a wave never holds more than ~40 alive), so the pair loop is cheap.
export function separateEnemies(enemies) {
  for (let i = 0; i < enemies.length; i += 1) {
    const a = enemies[i];
    for (let j = i + 1; j < enemies.length; j += 1) {
      const b = enemies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = a.radius + b.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0.01 && d2 < min * min) {
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
      }
    }
  }
}
