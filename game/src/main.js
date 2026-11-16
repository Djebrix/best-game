// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens:
// title, play, shop, paused, game over and victory.
//
// ?seed=N fixes the run. ?shot=start|play|shop|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createWorld, nextWave, step } from './world.js';
import { createRenderer } from './render.js';
import { drawHud, drawOver, drawPaused, drawShop, drawTitle, drawWin, shopRects } from './hud.js';
import { buyUpgrade } from './upgrades.js';
import { stageShot } from './shots.js';

const BEST_KEY = 'voidharvest-best';
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : (Math.random() * 4294967296) >>> 0;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const ctx = canvas.getContext('2d');
const random = createRandom(seed);
const audio = createAudio();
const input = createInput(canvas);
const world = createWorld(random, audio);
const renderer = createRenderer(canvas);

// Read-only handle for automated play-testing (state inspection only).
window.__voidharvest = world;

try {
  world.best = Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
} catch {
  world.best = 0;
}

function saveBest() {
  try {
    window.localStorage.setItem(BEST_KEY, String(world.best));
  } catch {
    // Storage can be off (private windows): the best score then lasts this
    // visit only.
  }
}

let lastScreen = '';
function render() {
  renderer.draw(world);
  if (world.screen === 'play' || world.screen === 'paused') drawHud(ctx, world);
  if (world.screen === 'title') drawTitle(ctx, world);
  if (world.screen === 'paused') drawPaused(ctx);
  if (world.screen === 'shop') {
    drawHud(ctx, world);
    drawShop(ctx, world);
  }
  if (world.screen === 'over') drawOver(ctx, world);
  if (world.screen === 'win') drawWin(ctx, world);
  if (world.screen !== lastScreen) {
    lastScreen = world.screen;
    status.textContent = `VOIDHARVEST: ${world.screen}. Score ${world.score}, wave ${world.wave}.`;
  }
}

// Shop buttons also answer the mouse: click an item to buy it, click the
// wide button (or press Enter) to start the next wave.
canvas.addEventListener('mousedown', (event) => {
  if (world.screen !== 'shop') return;
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  const rects = shopRects(world);
  for (let i = 0; i < rects.items.length; i += 1) {
    const r = rects.items[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      buyUpgrade(world, r.id);
      return;
    }
  }
  const n = rects.next;
  if (x >= n.x && x <= n.x + n.w && y >= n.y && y <= n.y + n.h) nextWave(world);
});

if (shot) {
  stageShot(world, shot);
  world.shake = 0;
  world.flash = 0;
  render();
  render();
  window.__shotReady = true;
} else {
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    acc += elapsed;
    while (acc >= STEP) {
      step(world, input, STEP);
      input.endStep();
      acc -= STEP;
    }
    render();
    saveBest();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
