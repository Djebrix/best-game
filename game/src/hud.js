// The HUD and every screen that is not the arena itself: title, pause,
// the between-wave shop, game over and victory. The shop layout is computed
// once here and shared with main.js so mouse clicks land on the same
// rectangles the player sees.
import { PALETTE, SHOP, VIEW, WEAPONS } from './config.js';
import { shopItems } from './upgrades.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8, 10, 26, 0.88)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PALETTE.cyan;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.globalAlpha = 1;
}

function bar(ctx, x, y, w, h, frac, color, back) {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  ctx.strokeStyle = PALETTE.ink;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.globalAlpha = 1;
}

function centerText(ctx, text, x, y, font, color) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export function drawHud(ctx, state) {
  const player = state.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Health bar, top left.
  ctx.font = 'bold 15px monospace';
  ctx.fillStyle = PALETTE.dim;
  ctx.fillText('HULL', 24, 34);
  bar(ctx, 24, 42, 240, 16, player.hp / player.maxHp, player.hp > 30 ? PALETTE.green : PALETTE.red, '#1a2038');
  ctx.fillStyle = PALETTE.ink;
  ctx.font = 'bold 15px monospace';
  ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, 274, 56);

  // Salvage, score, wave — top center.
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px monospace';
  ctx.fillStyle = PALETTE.amber;
  ctx.fillText(`SALVAGE ${state.salvage}`, VIEW.width / 2, 34);
  ctx.fillStyle = PALETTE.ink;
  ctx.fillText(`SCORE ${state.score}`, VIEW.width / 2, 62);
  ctx.fillStyle = PALETTE.dim;
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`WAVE ${state.wave} / 10   •   HOSTILES ${state.enemies.length + state.spawnQueue.length + state.portals.length}`, VIEW.width / 2, 88);

  // Combo, under the score when it is live (hidden in the shop, where the
  // panel starts just below the header).
  if (state.combo >= 2 && state.screen !== 'shop') {
    ctx.fillStyle = PALETTE.magenta;
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`COMBO x${(1 + Math.min(state.combo, 12) * 0.12).toFixed(1)}  (${state.combo})`, VIEW.width / 2, 114);
  }

  // Weapon + dash, bottom left.
  ctx.textAlign = 'left';
  ctx.font = 'bold 17px monospace';
  ctx.fillStyle = WEAPONS[player.weapon].color;
  ctx.fillText(WEAPONS[player.weapon].name, 24, VIEW.height - 52);
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '15px monospace';
  ctx.fillText(player.overdrive > 0 ? `OVERDRIVE ${player.overdrive.toFixed(1)}s` : 'hold LMB to fire', 24, VIEW.height - 28);
  const dashFrac = 1 - player.dashCooldown / 2.1;
  ctx.fillStyle = PALETTE.dim;
  ctx.fillText('DASH', 24, VIEW.height - 78);
  bar(ctx, 78, VIEW.height - 90, 120, 10, dashFrac, PALETTE.cyan, '#1a2038');

  // Weapon slots, bottom right.
  const slots = ['pulse', 'spread', 'rail'];
  for (let i = 0; i < slots.length; i += 1) {
    const id = slots[i];
    const x = VIEW.width - 300 + i * 96;
    const y = VIEW.height - 64;
    const owned = player.unlocked.has(id);
    ctx.fillStyle = player.weapon === id ? 'rgba(55, 230, 255, 0.25)' : 'rgba(8, 10, 26, 0.7)';
    ctx.fillRect(x, y, 88, 40);
    ctx.strokeStyle = player.weapon === id ? PALETTE.cyan : PALETTE.dim;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, 88, 40);
    ctx.fillStyle = owned ? PALETTE.ink : PALETTE.dim;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(WEAPONS[id].key, x + 44, y + 15);
    ctx.font = '11px monospace';
    ctx.fillText(owned ? WEAPONS[id].name.split(' ')[0] : 'LOCKED', x + 44, y + 31);
  }
  ctx.textAlign = 'left';

  if (state.waveState === 'clear') {
    centerText(ctx, 'WAVE CLEARED — SHOP OPENING…', VIEW.width / 2, 150, 'bold 24px monospace', PALETTE.amber);
  }
  if (state.audio.isMuted()) {
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '14px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('MUTED (M)', VIEW.width - 24, VIEW.height - 24);
    ctx.textAlign = 'left';
  }
}

export function drawTitle(ctx, state) {
  ctx.fillStyle = 'rgba(8, 10, 26, 0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  centerText(ctx, 'VOIDHARVEST', VIEW.width / 2, 220, 'bold 84px monospace', PALETTE.cyan);
  centerText(ctx, 'TOP-DOWN ARENA SURVIVAL  •  10 WAVES  •  ONE HARVESTER', VIEW.width / 2, 282, 'bold 18px monospace', PALETTE.dim);
  centerText(ctx, 'Hold the arena. Harvest their salvage. Spend it between waves.', VIEW.width / 2, 330, '17px monospace', PALETTE.ink);
  const lines = [
    'WASD / ARROWS — move      MOUSE — aim      HOLD LMB — fire',
    '1 / 2 / 3 — switch weapon      SHIFT — dash      B — shop (between waves)',
    'P / ESC — pause      M — mute      R — restart after a run',
  ];
  lines.forEach((line, i) => {
    centerText(ctx, line, VIEW.width / 2, 400 + i * 30, '16px monospace', PALETTE.dim);
  });
  const pulse = 0.6 + 0.4 * Math.sin(state.time * 3);
  ctx.globalAlpha = pulse;
  centerText(ctx, 'CLICK OR PRESS ENTER TO PLAY', VIEW.width / 2, 540, 'bold 24px monospace', PALETTE.amber);
  ctx.globalAlpha = 1;
  if (state.best > 0) {
    centerText(ctx, `BEST SCORE ${state.best}`, VIEW.width / 2, 590, 'bold 18px monospace', PALETTE.ink);
  }
  centerText(ctx, 'Clear wave 10 to win. Lose all hull to lose.', VIEW.width / 2, 640, '15px monospace', PALETTE.dim);
}

export function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(8, 10, 26, 0.7)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  centerText(ctx, 'PAUSED', VIEW.width / 2, 340, 'bold 64px monospace', PALETTE.ink);
  centerText(ctx, 'P / ESC or ENTER to resume', VIEW.width / 2, 420, '18px monospace', PALETTE.dim);
}

// The shop's rectangles, shared with main.js for click handling.
export function shopRects(state) {
  const items = shopItems(state);
  const rects = [];
  const px = VIEW.width / 2 - 380;
  const py = 150;
  for (let i = 0; i < items.length; i += 1) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    rects.push({
      id: items[i].id,
      x: px + col * 390,
      y: py + 52 + row * 96,
      w: 370,
      h: 84,
    });
  }
  return {
    items: rects,
    next: { x: VIEW.width / 2 - 150, y: 640, w: 300, h: 56 },
  };
}

export function drawShop(ctx, state) {
  const items = shopItems(state);
  const rects = shopRects(state);
  ctx.fillStyle = 'rgba(8, 10, 26, 0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  panel(ctx, VIEW.width / 2 - 400, 110, 800, 600);
  centerText(ctx, `WAVE ${state.wave} CLEARED — UPGRADE SHOP`, VIEW.width / 2, 142, 'bold 26px monospace', PALETTE.amber);
  centerText(ctx, `SALVAGE ${state.salvage}   •   press 1-8 to buy, or click an item`, VIEW.width / 2, 176, '16px monospace', PALETTE.dim);
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const r = rects.items[i];
    ctx.fillStyle = item.affordable ? 'rgba(55, 230, 255, 0.12)' : 'rgba(20, 24, 48, 0.9)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = item.affordable ? PALETTE.cyan : PALETTE.dim;
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.ink;
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`${i + 1}. ${item.name}`, r.x + 14, r.y + 24);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '14px monospace';
    ctx.fillText(item.desc, r.x + 14, r.y + 46);
    ctx.fillStyle = item.maxed || item.locked ? PALETTE.green : item.affordable ? PALETTE.amber : PALETTE.red;
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(
      item.maxed ? 'MAX' : item.locked ? 'OWNED' : `${item.cost} ◈`,
      r.x + r.w - 14, r.y + 24,
    );
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '13px monospace';
    ctx.fillText(item.level > 0 && !item.repeat ? `rank ${item.level}` : '', r.x + 14, r.y + 68);
  }
  const n = rects.next;
  ctx.fillStyle = PALETTE.amber;
  ctx.fillRect(n.x, n.y, n.w, n.h);
  centerText(ctx, `START WAVE ${state.wave + 1}  (ENTER)`, VIEW.width / 2, n.y + 30, 'bold 20px monospace', PALETTE.void);
}

export function drawOver(ctx, state) {
  ctx.fillStyle = 'rgba(12, 6, 14, 0.78)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  centerText(ctx, 'SIGNAL LOST', VIEW.width / 2, 280, 'bold 72px monospace', PALETTE.red);
  centerText(ctx, `The void takes another harvester on wave ${state.wave}.`, VIEW.width / 2, 340, '18px monospace', PALETTE.dim);
  centerText(ctx, `SCORE ${state.score}`, VIEW.width / 2, 420, 'bold 30px monospace', PALETTE.ink);
  centerText(ctx, `BEST ${state.best}   •   KILLS ${state.kills}   •   SALVAGE ${state.salvage}`, VIEW.width / 2, 462, '18px monospace', PALETTE.dim);
  const pulse = 0.6 + 0.4 * Math.sin(state.time * 3);
  ctx.globalAlpha = pulse;
  centerText(ctx, 'PRESS R OR ENTER TO HARVEST AGAIN', VIEW.width / 2, 540, 'bold 22px monospace', PALETTE.amber);
  ctx.globalAlpha = 1;
}

export function drawWin(ctx, state) {
  ctx.fillStyle = 'rgba(6, 14, 12, 0.78)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  centerText(ctx, 'SECTOR CLEARED', VIEW.width / 2, 280, 'bold 72px monospace', PALETTE.green);
  centerText(ctx, 'All ten waves are scrap. The harvest is yours.', VIEW.width / 2, 340, '18px monospace', PALETTE.dim);
  centerText(ctx, `SCORE ${state.score}`, VIEW.width / 2, 420, 'bold 30px monospace', PALETTE.ink);
  centerText(ctx, `BEST ${state.best}   •   KILLS ${state.kills}   •   SALVAGE ${state.salvage}`, VIEW.width / 2, 462, '18px monospace', PALETTE.dim);
  const pulse = 0.6 + 0.4 * Math.sin(state.time * 3);
  ctx.globalAlpha = pulse;
  centerText(ctx, 'PRESS R OR ENTER TO PLAY AGAIN', VIEW.width / 2, 540, 'bold 22px monospace', PALETTE.amber);
  ctx.globalAlpha = 1;
}
