// VOIDHARVEST — every number the game balances on lives here, so tuning
// never means hunting through the simulation.
export const STEP = 1 / 60;
export const VIEW = { width: 1280, height: 800 };

export const PALETTE = {
  void: '#0b0e1e',
  void2: '#10142a',
  grid: '#1a2044',
  ink: '#e8f4ff',
  dim: '#8fa3c8',
  cyan: '#37e6ff',
  magenta: '#ff3d8a',
  amber: '#ffc44d',
  green: '#4dff9d',
  orange: '#ff8a3d',
  red: '#ff4d5e',
  violet: '#b78cff',
  white: '#ffffff',
};

// The player: a harvester ship. Speed is px/s; dash is a short burst.
export const PLAYER = {
  radius: 16,
  speed: 300,
  hp: 100,
  dashSpeed: 980,
  dashTime: 0.14,
  dashCooldown: 2.1,
  dashInvuln: 0.3,
  magnet: 90,
  contactGrace: 0.45,
};

// Weapons. damage is per projectile; rate is shots per second; spread is
// the half-angle in radians; pierce counts how many extra bodies a shot
// passes through; kick is the recoil applied to the player.
export const WEAPONS = {
  pulse: {
    id: 'pulse', name: 'PULSE BLASTER', key: '1', color: PALETTE.cyan,
    damage: 14, rate: 7.5, speed: 760, spread: 0.035, pellets: 1, pierce: 0,
    kick: 26, size: 5, unlockCost: 0,
  },
  spread: {
    id: 'spread', name: 'SHARD SPREAD', key: '2', color: PALETTE.amber,
    damage: 9, rate: 3.4, speed: 660, spread: 0.42, pellets: 5, pierce: 0,
    kick: 60, size: 5, unlockCost: 150,
  },
  rail: {
    id: 'rail', name: 'RAIL LANCE', key: '3', color: PALETTE.magenta,
    damage: 60, rate: 1.15, speed: 1500, spread: 0.008, pellets: 1, pierce: 99,
    kick: 150, size: 6, unlockCost: 280,
  },
};

// Enemy kinds. hp and speed scale with the wave (see waveScale). score is
// the base score before the combo multiplier.
export const ENEMIES = {
  chaser: {
    id: 'chaser', name: 'Darter', color: PALETTE.magenta, radius: 15,
    hp: 22, speed: 148, score: 100, damage: 10, salvage: 2,
  },
  shooter: {
    id: 'shooter', name: 'Spitter', color: PALETTE.orange, radius: 16,
    hp: 30, speed: 104, score: 150, damage: 8, salvage: 3,
    range: 340, fireRate: 0.85, bulletSpeed: 250,
  },
  splitter: {
    id: 'splitter', name: 'Hexling', color: PALETTE.green, radius: 21,
    hp: 46, speed: 96, score: 150, damage: 12, salvage: 3, children: 2,
  },
  mini: {
    id: 'mini', name: 'Mote', color: PALETTE.green, radius: 9,
    hp: 10, speed: 205, score: 50, damage: 6, salvage: 1,
  },
  brute: {
    id: 'brute', name: 'Bulwark', color: PALETTE.red, radius: 30,
    hp: 210, speed: 62, score: 400, damage: 22, salvage: 8,
  },
};

// How a wave is built. count grows, the mix widens, and hp/speed scale.
export function waveComp(wave) {
  const total = 6 + wave * 3;
  const mix = { chaser: total };
  if (wave >= 2) mix.shooter = Math.floor(total * 0.22);
  if (wave >= 3) mix.splitter = Math.floor(total * 0.18);
  if (wave >= 4) mix.brute = Math.floor(total * 0.12);
  const sum = mix.chaser + (mix.shooter || 0) + (mix.splitter || 0) + (mix.brute || 0);
  mix.chaser = total - (sum - mix.chaser);
  return {
    total,
    mix,
    hpScale: 1 + (wave - 1) * 0.13,
    speedScale: 1 + Math.min(0.45, (wave - 1) * 0.045),
  };
}

export const WIN_WAVE = 10;
export const COMBO_WINDOW = 3.0;
export const COMBO_STEP = 0.12;
export const COMBO_CAP = 12;

// The shop, opened between waves. cost(level) is the price of the next rank.
export const SHOP = [
  { id: 'damage', name: 'OVERCHARGE ROUNDS', desc: '+20% weapon damage', base: 80, growth: 1.6, max: 5 },
  { id: 'rate', name: 'RAPID CYCLER', desc: '+15% fire rate', base: 80, growth: 1.6, max: 5 },
  { id: 'speed', name: 'ION THRUSTERS', desc: '+10% move speed', base: 60, growth: 1.5, max: 5 },
  { id: 'hull', name: 'REINFORCED HULL', desc: '+25 max HP and heal 25', base: 70, growth: 1.5, max: 5 },
  { id: 'magnet', name: 'SALVAGE TRACTOR', desc: '+50% pickup radius', base: 50, growth: 1.5, max: 4 },
  { id: 'spread', name: 'UNLOCK: SHARD SPREAD', desc: '5-pellet scatter gun (key 2)', base: 150, growth: 1, max: 1, weapon: 'spread' },
  { id: 'rail', name: 'UNLOCK: RAIL LANCE', desc: 'Piercing heavy lance (key 3)', base: 280, growth: 1, max: 1, weapon: 'rail' },
  { id: 'repair', name: 'FIELD REPAIR', desc: 'Restore 40 HP now', base: 40, growth: 1, max: 99, repeat: true },
];
