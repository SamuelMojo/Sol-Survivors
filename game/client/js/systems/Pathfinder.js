// A* pathfinding on the map's 16px tile grid, so computer crewmates walk around rocks and buildings.
//
// 👤 Owner: Game logic & backend. Used by systems/Bots.js. A* looks for the shortest path by always trying the most
// promising tile next (distance walked so far + straight-line guess to the goal).
/** Finds walking routes around obstacles on the tile grid. */
export class Pathfinder {
  /** Build a grid of blocked tiles from the map's obstacle layer and the solid zones (buildings, machines...). */
  constructor(obstacles, solids, mapW, mapH, tile = 16) {
    this.T = tile; this.W = Math.ceil(mapW / tile); this.H = Math.ceil(mapH / tile);
    this.block = new Uint8Array(this.W * this.H);
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      const t = obstacles.getTileAt(x, y);
      if (t && t.collides) this.block[y * this.W + x] = 1;
    }
    for (const z of solids) {         // building footprints, equipment, chest...
      const b = z.body;
      const x0 = Math.floor(b.x / tile), y0 = Math.floor(b.y / tile);
      const x1 = Math.floor((b.x + b.width - 1) / tile), y1 = Math.floor((b.y + b.height - 1) / tile);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < this.W && y < this.H) this.block[y * this.W + x] = 1;
    }
  }

  /** Is tile (tx, ty) inside the map and walkable? */
  free(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.W && ty < this.H && !this.block[ty * this.W + tx]; }

  /** Nearest walkable tile to a pixel position. */
  nearestFree(px, py) {
    const tx = Math.floor(px / this.T), ty = Math.floor(py / this.T);
    for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++)
      if (this.free(tx + dx, ty + dy)) return [tx + dx, ty + dy];
    return [tx, ty];
  }

  /** Path from pixel a to pixel b: an array of pixel waypoints (tile centres), or null. */
  find(ax, ay, bx, by, maxNodes = 6000) {
    const [sx, sy] = this.nearestFree(ax, ay), [gx, gy] = this.nearestFree(bx, by);
    const W = this.W, key = (x, y) => y * W + x, h = (x, y) => Math.abs(x - gx) + Math.abs(y - gy);
    // g = distance walked to each tile, came = which tile we came from (to rebuild the path at the end)
    const g = new Map([[key(sx, sy), 0]]), came = new Map();
    const open = [[h(sx, sy), sx, sy]];               // small binary heap on f
    const push = n => { open.push(n); let i = open.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (open[p][0] <= open[i][0]) break; [open[p], open[i]] = [open[i], open[p]]; i = p; } };
    const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === i) break; [open[m], open[i]] = [open[i], open[m]]; i = m; } } return top; };
    // Keep taking the most promising tile until we reach the goal (or give up after maxNodes tiles)
    const closed = new Set();
    let n = 0;
    while (open.length && n++ < maxNodes) {
      const [, x, y] = pop(), k = key(x, y);
      if (closed.has(k)) continue;
      if (x === gx && y === gy) {
        const path = []; let c = k;
        while (c !== undefined) { path.push([(c % W) * this.T + this.T / 2, Math.floor(c / W) * this.T + this.T / 2]); c = came.get(c); }
        path.reverse(); path.push([bx, by]);
        return path;
      }
      closed.add(k);
      // Try the 8 neighbours (diagonals cost 1.414, like real distance)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!this.free(nx, ny) || (dx && dy && (!this.free(x + dx, y) || !this.free(x, y + dy)))) continue;   // no corner cutting
        const nk = key(nx, ny), ng = g.get(k) + (dx && dy ? 1.414 : 1);
        if (ng < (g.get(nk) ?? Infinity)) { g.set(nk, ng); came.set(nk, k); push([ng + h(nx, ny), nx, ny]); }
      }
    }
    return null;
  }
}
