// Workbench recipes: what the Builder can make from scrap at the workshop's workbench.
// Used by the player (InteriorScene.workbench) and by the Builder bot (Bots.js).
//
// 👤 Owner: Game logic & backend.
// GAME RULE: real scrap would need sorting, melting and 3D printing first.
//   make: the item made   n: how many   from: { itemId: count } used up
export const RECIPES = [
  { make: 'pipe', n: 1, from: { scrap: 3 } },
  { make: 'wire', n: 1, from: { scrap: 3 } },
];
