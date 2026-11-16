// Everything the player sees of the arena: the void, the portals, the
// pickups, the enemies, the player, the bullets, the particles and the
// floating damage numbers. Screens and the HUD live in hud.js.
import { ENEMIES, PALETTE, VIEW } from './config.js';
import { createRandom } from './random.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  // Fixed starfield, seeded once so it never flickers between frames.
  const stars = [];
  const starRandom = createRandom(1337);
  for (let i = 0; i < 110; i += 1) {
    stars.push({
      x: starRandom.range(0, VIEW.width),
      y: starRandom.range(0, VIEW.height),
      r: starRandom.range(0.6, 2.2),
      tw: starRandom.range(0, Math.PI * 2),
    });
  }

  function drawBackground(time) {
    const grad = ctx.createRadialGradient(
      VIEW.width / 2, VIEW.height / 2, 120,
      VIEW.width / 2, VIEW.height / 2, 900,
    );
    grad.addColorStop(0, PALETTE.void2);
    grad.addColorStop(1, PALETTE.void);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.strokeStyle = PALETTE.grid;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 64; x < VIEW.width; x += 64) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, VIEW.height);
    }
    for (let y = 64; y < VIEW.height; y += 64) {
      ctx.moveTo(0, y);
      ctx.lineTo(VIEW.width, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    for (let i = 0; i < stars.length; i += 1) {
      const s = stars[i];
      ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(time * 1.4 + s.tw));
      ctx.fillStyle = PALETTE.ink;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Arena border.
    ctx.strokeStyle = PALETTE.cyan;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, VIEW.width - 12, VIEW.height - 12);
    ctx.globalAlpha = 1;
  }

  function drawShape(kind, x, y, radius, color, angle, flash) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = flash > 0 ? PALETTE.white : color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (kind === 'chaser' || kind === 'mini') {
      ctx.moveTo(radius, 0);
      ctx.lineTo(-radius * 0.8, radius * 0.7);
      ctx.lineTo(-radius * 0.4, 0);
      ctx.lineTo(-radius * 0.8, -radius * 0.7);
    } else if (kind === 'shooter') {
      ctx.moveTo(radius, 0);
      ctx.lineTo(0, radius * 0.8);
      ctx.lineTo(-radius, 0);
      ctx.lineTo(0, -radius * 0.8);
    } else if (kind === 'splitter') {
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        if (i === 0) ctx.moveTo(Math.cos(a) * radius, Math.sin(a) * radius);
        else ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
      }
    } else if (kind === 'brute') {
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        if (i === 0) ctx.moveTo(Math.cos(a) * radius, Math.sin(a) * radius);
        else ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.stroke();
    ctx.restore();
  }

  function draw(state) {
    const player = state.player;
    ctx.save();
    if (state.shake > 0.2) {
      ctx.translate(
        (state.random.next() - 0.5) * state.shake,
        (state.random.next() - 0.5) * state.shake,
      );
    }
    drawBackground(state.time);

    // Spawn portals telegraph where the next enemy will appear.
    for (let i = 0; i < state.portals.length; i += 1) {
      const p = state.portals[i];
      const pulse = 0.5 + 0.5 * Math.sin(state.time * 14);
      ctx.strokeStyle = ENEMIES[p.kind].color;
      ctx.globalAlpha = 0.35 + 0.45 * pulse;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10 + (0.8 - p.timer) * 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Pickups.
    for (let i = 0; i < state.pickups.length; i += 1) {
      const p = state.pickups[i];
      const blink = p.life < 3 ? (Math.sin(state.time * 10) > 0 ? 1 : 0.3) : 1;
      ctx.globalAlpha = blink;
      if (p.kind === 'salvage') {
        ctx.fillStyle = PALETTE.amber;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(state.time * 2 + i);
        ctx.fillRect(-4, -4, 8, 8);
        ctx.restore();
      } else if (p.kind === 'health') {
        ctx.fillStyle = PALETTE.green;
        ctx.fillRect(p.x - 8, p.y - 3, 16, 6);
        ctx.fillRect(p.x - 3, p.y - 8, 6, 16);
      } else {
        ctx.fillStyle = PALETTE.amber;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.void;
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('2x', p.x, p.y + 0.5);
      }
      ctx.globalAlpha = 1;
    }

    // Enemies, each facing the player, with an HP arc when hurt.
    for (let i = 0; i < state.enemies.length; i += 1) {
      const e = state.enemies[i];
      const angle = Math.atan2(player.y - e.y, player.x - e.x);
      drawShape(e.kind, e.x, e.y, e.radius, ENEMIES[e.kind].color, angle, e.flash);
      if (e.hp < e.maxHp) {
        ctx.strokeStyle = PALETTE.ink;
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 6, -Math.PI / 2, -Math.PI / 2 + (e.hp / e.maxHp) * Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // Enemy bullets.
    for (let i = 0; i < state.ebullets.length; i += 1) {
      const b = state.ebullets[i];
      ctx.fillStyle = PALETTE.orange;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.white;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }

    // The player: a cyan dart, blinking while invulnerable. Never drawn on
    // the title screen (the ship would sit under the controls text) or after
    // the run ends.
    if (state.screen !== 'over' && state.screen !== 'title') {
      const blink = player.invuln > 0 && Math.sin(state.time * 30) > 0;
      ctx.globalAlpha = blink ? 0.35 : 1;
      drawShape('chaser', player.x, player.y, player.radius, PALETTE.cyan, player.angle, 0);
      ctx.fillStyle = PALETTE.white;
      ctx.beginPath();
      ctx.arc(player.x + Math.cos(player.angle) * 6, player.y + Math.sin(player.angle) * 6, 3.5, 0, Math.PI * 2);
      ctx.fill();
      if (player.dashCooldown > 0) {
        ctx.strokeStyle = PALETTE.cyan;
        ctx.globalAlpha = 0.5 * (1 - player.dashCooldown / 2.1);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Player bullets.
    for (let i = 0; i < state.bullets.length; i += 1) {
      const b = state.bullets[i];
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(b.x - b.vx * 0.012, b.y - b.vy * 0.012, b.size * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Particles.
    for (let i = 0; i < state.particles.length; i += 1) {
      const p = state.particles[i];
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Damage numbers.
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < state.floaters.length; i += 1) {
      const f = state.floaters[i];
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // Red hurt flash over everything.
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255, 40, 70, ${state.flash * 0.28})`;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
    ctx.restore();
  }

  return { draw };
}
