// Weapons: firing, and stepping the two projectile lists. The world owns
// the lists and the damage hooks; this module owns the ballistics.
import { WEAPONS } from './config.js';

export function weaponDef(id) {
  return WEAPONS[id];
}

// Fire the player's current weapon toward `angle`. Pellets fan out around
// the aim; the rail lance is one piercing shot. Recoil pushes the player.
export function fireWeapon(state, angle) {
  const player = state.player;
  const def = WEAPONS[player.weapon];
  const dmgMul = 1 + player.up.damage * 0.2;
  for (let i = 0; i < def.pellets; i += 1) {
    const spread = def.pellets === 1
      ? (state.random.next() - 0.5) * 2 * def.spread
      : (i / (def.pellets - 1) - 0.5) * 2 * def.spread + (state.random.next() - 0.5) * 0.04;
    const a = angle + spread;
    state.bullets.push({
      x: player.x + Math.cos(angle) * (player.radius + 6),
      y: player.y + Math.sin(angle) * (player.radius + 6),
      vx: Math.cos(a) * def.speed,
      vy: Math.sin(a) * def.speed,
      damage: def.damage * dmgMul,
      pierce: def.pierce,
      size: def.size,
      color: def.color,
      life: 1.1,
      hitSet: null,
    });
  }
  player.vx -= Math.cos(angle) * def.kick;
  player.vy -= Math.sin(angle) * def.kick;
  const rateMul = 1 + player.up.rate * 0.15;
  player.fireTimer = 1 / (def.rate * rateMul);
  if (player.overdrive > 0) player.fireTimer *= 0.5;
  state.audio.shoot(player.weapon);
}

// Move player bullets, test them against enemies, and call hooks.onEnemyHit
// (which applies damage, particles and deaths). A piercing bullet remembers
// which enemies it already struck, in a small Set created on first hit.
export function stepBullets(state, dt, hooks) {
  const bullets = state.bullets;
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.x < -20 || b.x > 1300 || b.y < -20 || b.y > 820;
    if (!dead) {
      for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
        const e = state.enemies[j];
        if (b.hitSet && b.hitSet.has(e)) continue;
        const dx = e.x - b.x;
        const dy = e.y - b.y;
        const rr = e.radius + b.size;
        if (dx * dx + dy * dy < rr * rr) {
          if (b.pierce > 0) {
            if (!b.hitSet) b.hitSet = new Set();
            b.hitSet.add(e);
            b.pierce -= 1;
          } else {
            dead = true;
          }
          hooks.onEnemyHit(e, b.damage, b.x, b.y);
          if (dead) break;
        }
      }
    }
    if (dead) {
      bullets[i] = bullets[bullets.length - 1];
      bullets.pop();
    }
  }
}

// Move enemy bullets and test them against the player (unless dashing).
export function stepEnemyBullets(state, dt, hooks) {
  const list = state.ebullets;
  const player = state.player;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const b = list[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.x < -20 || b.x > 1300 || b.y < -20 || b.y > 820;
    if (!dead && player.invuln <= 0 && player.dashTime <= 0) {
      const dx = player.x - b.x;
      const dy = player.y - b.y;
      const rr = player.radius + b.size;
      if (dx * dx + dy * dy < rr * rr) {
        dead = true;
        hooks.onPlayerHit(b.damage, b.x, b.y);
      }
    }
    if (dead) {
      list[i] = list[list.length - 1];
      list.pop();
    }
  }
}
