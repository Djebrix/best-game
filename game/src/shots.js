// The screenshot scenes behind ?shot=start|play|shop|end. Each one plays the
// real rules forward from a fresh world with a seeded RNG, steered by a
// simple autopilot, so the frame is what a short game really looks like and
// the same seed always gives the same frame.
import { STEP } from './config.js';
import { startRun, step } from './world.js';

// A stand-in for the real input: the pilot looks at the world each step and
// decides where to move, where to aim and whether to fire.
function makePilot(state, mode) {
  const pilot = {
    mouse: { x: state.player.x, y: state.player.y - 100, down: false },
    ax: 0,
    ay: 0,
    axisX() {
      return pilot.ax;
    },
    axisY() {
      return pilot.ay;
    },
    pressedDash() {
      return false;
    },
    pressedPause() {
      return false;
    },
    pressedShop() {
      return false;
    },
    pressedMute() {
      return false;
    },
    pressedRestart() {
      return false;
    },
    pressedConfirm() {
      // The endgame pilot advances past the shop so the run continues
      // until the passive player is finally overwhelmed. It never answers
      // on the game-over screen, or the run would restart itself.
      return mode === 'endgame' && state.screen === 'shop';
    },
    pressedDigit() {
      return false;
    },
    endStep() {},
    // Recompute the pilot's move/aim/fire from the current world.
    update() {
      const player = state.player;
      // Endgame: fight properly for the first 25 s, then stop fighting.
      const passive = mode === 'passive' || (mode === 'endgame' && state.time >= 25);
      if (passive || state.enemies.length === 0) {
        pilot.ax = 0;
        pilot.ay = 0;
        pilot.mouse.down = false;
        pilot.mouse.x = player.x;
        pilot.mouse.y = player.y - 100;
        return;
      }
      let nearest = null;
      let nearestD = Infinity;
      for (let i = 0; i < state.enemies.length; i += 1) {
        const e = state.enemies[i];
        const d = Math.hypot(e.x - player.x, e.y - player.y);
        if (d < nearestD) {
          nearestD = d;
          nearest = e;
        }
      }
      pilot.mouse.x = nearest.x;
      pilot.mouse.y = nearest.y;
      pilot.mouse.down = nearestD < 640;
      // Kite: back away when the nearest enemy is close, drift toward the
      // middle otherwise, and strafe sideways so shots keep coming in.
      let mx = 0;
      let my = 0;
      if (nearestD < 170) {
        mx = (player.x - nearest.x) / nearestD;
        my = (player.y - nearest.y) / nearestD;
      } else {
        mx = (640 - player.x) / 640;
        my = (400 - player.y) / 400;
      }
      // When nothing is pressing, sweep up the nearest salvage instead of
      // idling — the harvest loop is the point of the game.
      if (nearestD > 260 && state.pickups.length > 0) {
        let best = null;
        let bestD = 340;
        for (let i = 0; i < state.pickups.length; i += 1) {
          const p = state.pickups[i];
          if (p.kind !== 'salvage') continue;
          const d = Math.hypot(p.x - player.x, p.y - player.y);
          if (d < bestD) {
            bestD = d;
            best = p;
          }
        }
        if (best) {
          mx = (best.x - player.x) / bestD;
          my = (best.y - player.y) / bestD;
        }
      }
      const side = Math.sin(state.time * 1.7) > 0 ? 1 : -1;
      mx += (-(nearest.y - player.y) / nearestD) * 0.5 * side;
      my += ((nearest.x - player.x) / nearestD) * 0.5 * side;
      const m = Math.hypot(mx, my) || 1;
      pilot.ax = Math.abs(mx / m) > 0.25 ? Math.sign(mx / m) : 0;
      pilot.ay = Math.abs(my / m) > 0.25 ? Math.sign(my / m) : 0;
    },
  };
  return pilot;
}

function runSteps(state, pilot, maxSeconds, stopWhen) {
  const maxSteps = Math.floor(maxSeconds / STEP);
  for (let i = 0; i < maxSteps; i += 1) {
    pilot.update();
    step(state, pilot, STEP);
    pilot.endStep();
    if (stopWhen(state)) return true;
  }
  return false;
}

export function stageShot(state, shot) {
  if (shot === 'start') {
    // The fresh title screen is the shot.
    return;
  }
  if (shot === 'play') {
    // Freeze the frame mid-wave: run a fixed slice of the first wave and
    // take it while the fight is still on. The wave clears fast, so retry
    // shorter when an attempt overshoots into the shop.
    for (const seconds of [6.5, 5, 4]) {
      startRun(state);
      const pilot = makePilot(state, 'active');
      runSteps(state, pilot, seconds, () => false);
      if (state.screen === 'play' && state.enemies.length >= 2) return;
    }
    return;
  }
  if (shot === 'shop') {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      startRun(state);
      const pilot = makePilot(state, 'active');
      const reached = runSteps(state, pilot, 300, (s) => s.screen === 'shop');
      if (reached) return;
    }
    return;
  }
  if (shot === 'end') {
    // Play properly for a while first, then stop fighting: the game-over
    // screen should show a run that got somewhere, not a 0-score death.
    // The endgame pilot advances past the shop on its own, so the passive
    // phase eventually meets a wave it cannot survive.
    startRun(state);
    const pilot = makePilot(state, 'endgame');
    runSteps(state, pilot, 300, (s) => s.screen === 'over');
    return;
  }
}
