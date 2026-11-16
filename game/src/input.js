// Keyboard + mouse, read once per frame. `pressed` is the set of keys that
// went down since the last simulation step, so one press fires one action
// even at 60 Hz. Mouse coordinates are converted into canvas pixels.
export const ACTION = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  dash: ['ShiftLeft', 'ShiftRight'],
  pause: ['KeyP', 'Escape'],
  shop: ['KeyB'],
  mute: ['KeyM'],
  restart: ['KeyR'],
  confirm: ['Enter', 'Space'],
};

export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false };
  let clicked = false;

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    down.add(event.code);
    pressed.add(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    down.delete(event.code);
  });
  window.addEventListener('blur', () => {
    down.clear();
    mouse.down = false;
  });
  canvas.addEventListener('mousemove', canvasPoint);
  canvas.addEventListener('mousedown', (event) => {
    canvasPoint(event);
    if (event.button === 0) {
      mouse.down = true;
      clicked = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function held(codes) {
    for (let i = 0; i < codes.length; i += 1) {
      if (down.has(codes[i])) return true;
    }
    return false;
  }
  function hit(codes) {
    for (let i = 0; i < codes.length; i += 1) {
      if (pressed.has(codes[i])) return true;
    }
    return false;
  }

  return {
    mouse,
    // -1/0/1 movement axes from the held keys.
    axisX() {
      return (held(ACTION.right) ? 1 : 0) - (held(ACTION.left) ? 1 : 0);
    },
    axisY() {
      return (held(ACTION.down) ? 1 : 0) - (held(ACTION.up) ? 1 : 0);
    },
    pressedDash() {
      return hit(ACTION.dash);
    },
    pressedPause() {
      return hit(ACTION.pause);
    },
    pressedShop() {
      return hit(ACTION.shop);
    },
    pressedMute() {
      return hit(ACTION.mute);
    },
    pressedRestart() {
      return hit(ACTION.restart);
    },
    pressedConfirm() {
      return hit(ACTION.confirm);
    },
    // Edge-triggered click: a fast click lands between two frames, so the
    // polled mouse.down alone can miss it entirely.
    pressedClick() {
      return clicked;
    },
    pressedDigit(digit) {
      return hit([`Digit${digit}`]);
    },
    // Called once per simulation step: edge presses are consumed.
    endStep() {
      pressed.clear();
      clicked = false;
    },
  };
}
