// The upgrade shop between waves. Each item has a rank; buying it spends
// salvage and applies its effect at once. Weapon unlocks also switch the
// player to the new weapon.
import { SHOP, WEAPONS } from './config.js';

export function shopItems(state) {
  return SHOP.map((item) => {
    const level = state.player.up[item.id] || 0;
    const cost = Math.round(item.base * Math.pow(item.growth, level));
    const maxed = level >= item.max;
    const locked = item.weapon && level >= 1;
    return { ...item, level, cost, maxed, locked, affordable: !maxed && !locked && state.salvage >= cost };
  });
}

export function buyUpgrade(state, itemId) {
  const item = SHOP.find((entry) => entry.id === itemId);
  if (!item) return false;
  const player = state.player;
  const level = player.up[item.id] || 0;
  if (level >= item.max) return false;
  const cost = Math.round(item.base * Math.pow(item.growth, level));
  if (state.salvage < cost) {
    state.audio.denied();
    return false;
  }
  state.salvage -= cost;
  player.up[item.id] = level + 1;
  if (item.weapon) {
    player.weapon = item.weapon;
    player.unlocked.add(item.weapon);
  } else if (item.id === 'hull') {
    player.maxHp += 25;
    player.hp = Math.min(player.maxHp, player.hp + 25);
  } else if (item.id === 'repair') {
    player.hp = Math.min(player.maxHp, player.hp + 40);
  }
  state.audio.buy();
  return true;
}

// Multipliers derived from the player's upgrade ranks.
export function damageMul(player) {
  return 1 + player.up.damage * 0.2;
}
export function rateMul(player) {
  return 1 + player.up.rate * 0.15;
}
export function speedMul(player) {
  return 1 + player.up.speed * 0.1;
}
export function magnetRadius(player) {
  return player.magnet * (1 + player.up.magnet * 0.5);
}
export function weaponName(id) {
  return WEAPONS[id].name;
}
