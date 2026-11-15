// Inventory logic: bags, the crew chest, stacking, adding and removing items.
// An inventory is an array of slots; each slot is null or { id, n }.
// The same item stacks in one slot up to its stack limit (see game/rules/items.js).
//
// 👤 Owner: Game logic & backend.
import { ITEMS } from './items.js';

export const BAG_SIZE = 10;       // slots in each astronaut's bag (the hotbar)
export const CHEST_SIZE = 30;     // slots in the crew storage chest

/** A new, empty inventory with this many slots. */
export const createInventory = (size = BAG_SIZE) => new Array(size).fill(null);

/** Add n of an item. Fills existing stacks first, then empty slots. Returns how many did NOT fit. */
export function addItem(inv, id, n = 1) {
  const max = ITEMS[id]?.stack ?? 1;
  for (const s of inv) {
    if (n <= 0) break;
    if (s && s.id === id && s.n < max) { const put = Math.min(max - s.n, n); s.n += put; n -= put; }
  }
  for (let i = 0; i < inv.length && n > 0; i++) {
    if (!inv[i]) { const put = Math.min(max, n); inv[i] = { id, n: put }; n -= put; }
  }
  return n;
}

/** How many of an item would fit right now. */
export function roomFor(inv, id) {
  const max = ITEMS[id]?.stack ?? 1;
  return inv.reduce((r, s) => r + (!s ? max : s.id === id ? max - s.n : 0), 0);
}

/** Remove n from one slot. Returns { id, n } actually removed, or null. */
export function takeFromSlot(inv, slot, n = 1) {
  const s = inv[slot];
  if (!s) return null;
  const k = Math.min(n, s.n);
  s.n -= k;
  if (s.n <= 0) inv[slot] = null;
  return { id: s.id, n: k };
}

/** Remove n of an item from anywhere in the inventory. Returns true if there were enough. */
export function removeItem(inv, id, n = 1) {
  if (countItem(inv, id) < n) return false;
  for (let i = inv.length - 1; i >= 0 && n > 0; i--) {
    const s = inv[i];
    if (s && s.id === id) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (!s.n) inv[i] = null; }
  }
  return true;
}

/** How many of an item are in the inventory, across all slots. */
export const countItem = (inv, id) => inv.reduce((t, s) => t + (s && s.id === id ? s.n : 0), 0);

/** Move a whole stack (or n of it) from one inventory slot into another inventory. Returns how many moved. */
export function moveStack(from, slot, to, n = Infinity) {
  const s = from[slot];
  if (!s) return 0;
  const want = Math.min(n, s.n);
  const left = addItem(to, s.id, want);
  const moved = want - left;
  takeFromSlot(from, slot, moved);
  return moved;
}

/** True if every slot holds a full stack. */
export const isFull = inv => inv.every(s => s && s.n >= (ITEMS[s.id]?.stack ?? 1));
