// The rover works from the start and needs no fuel. Only the Pilot can drive it, but it has 3 seats,
// so the rest of the crew can ride along as passengers (E to hop in, E to hop out).
//   Pictures: levels/art/rover-sheet.png, 6 frames: side x2, driving down x2, driving up x2 (the 2 frames turn the wheels).
//   A little helmet is drawn on each seat someone is sitting in, and dust puffs fly up behind it while it moves.
//
// 👤 Owner: Game logic & backend. Who may drive is checked in WorldScene (the 'rover' claim makes sure only one person drives).
const ROVER_SPEED = 160;   // about twice running speed
const SEATS = 3;           // driver + 2 passengers

// Where the 3 seats are, in pixels from the rover's position, for each view (side is facing right)
const SEAT_POS = {
  side: [[6, -14], [0, -14], [-6, -14]],      // driver at the front
  down: [[-6, -14], [0, -14], [6, -14]],
  up:   [[6, -14], [0, -14], [-6, -14]],
};
const FIRST_FRAME = { side: 0, down: 2, up: 4 };

/** The rover vehicle: a physics sprite the Pilot drives around the map, with seats for passengers. */
export class Rover {
  /** Place the rover at its spot from the map (object named 'rover'). It bumps into rocks and buildings. */
  constructor(scene, spot, obstacles, solids) {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(spot.x, spot.y, 'rover-sheet', 0).setOrigin(0.5, 0.85).setDepth(spot.y);
    this.sprite.body.setSize(24, 8).setOffset(4, 12);
    this.sprite.setImmovable(true).setCollideWorldBounds(true);
    scene.physics.add.collider(this.sprite, obstacles);
    scene.physics.add.collider(this.sprite, solids);
    this.driving = false;       // am I driving?
    this.stuck = false;         // half buried in sand at the start (see setStuck and the Unstick mini game)
    this.view = 'side';         // which picture: 'side', 'down' or 'up'
    this.wheel = 0;             // which wheel frame (0/1)
    this.rolled = 0;            // pixels moved since the wheels last turned
    this.last = { x: spot.x, y: spot.y };
    this.dustAt = 0;
    this.helmets = scene.add.graphics();
  }

  /** Rover position (pixels). */
  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }   // (and y)

  /** How many seats are free, given how many people are in it. */
  static freeSeats(inside) { return SEATS - inside; }

  /** Little tween: the astronaut steps to the rover and climbs in, then disappears. */
  climbIn(player, then) {
    player.body.enable = false;
    this.scene.tweens.killTweensOf(player);
    this.scene.tweens.add({ targets: player, x: this.x, y: this.y - 6, scaleX: 0.6, scaleY: 0.6, alpha: 0.3, duration: 220, onComplete: () => {
      // Only hide the astronaut if they're still in the rover (getting straight back out mustn't leave them invisible)
      player.setScale(1).setAlpha(1).setVisible(!this.scene.inRover);
      then?.();
    } });
    this.scene.cameras.main.startFollow(this.sprite, true, 0.2, 0.2);
  }

  /** Little tween: the astronaut hops out to (x, y). */
  climbOut(player, x, y) {
    this.scene.tweens.killTweensOf(player);                 // stop a 'climb in' that hasn't finished yet
    player.setPosition(this.x, this.y - 6).setVisible(true).setScale(0.6).setAlpha(0.3);
    this.scene.tweens.add({ targets: player, x, y, scaleX: 1, scaleY: 1, alpha: 1, duration: 220, ease: 'Back.easeOut', onComplete: () => { player.setVisible(true).setAlpha(1).setScale(1); player.body.enable = true; } });
    this.scene.cameras.main.startFollow(player, true, 0.2, 0.2);
  }

  /** A free spot beside the rover to get out to (not in a rock and not inside a building). */
  exitSpot(obstacles) {
    const w = this.scene, spots = [[0, 12], [-20, 2], [20, 2], [0, -14], [0, 24], [-30, 10], [30, 10]];
    const free = spots.find(([dx, dy]) => !(w.blockedAt?.(this.x + dx, this.y + dy) ?? obstacles.getTileAtWorldXY(this.x + dx, this.y + dy)?.collides));
    if (free) return [this.x + free[0], this.y + free[1]];
    const s = w.freeSpotAround?.(this.x, this.y);
    return s ? [s.x, s.y] : [this.x, this.y + 12];
  }

  /** Get in as the driver: hide the astronaut and make the camera follow the rover. */
  enter(player) {
    this.driving = true;
    this.sprite.setImmovable(false);
    this.climbIn(player);
  }

  /** Get out of the driver's seat, beside the rover (on whichever side is clear). */
  exit(player, obstacles) {
    this.driving = false;
    this.sprite.setVelocity(0, 0).setImmovable(true);
    this.climbOut(player, ...this.exitSpot(obstacles));
  }

  /** Move in direction (dx, dy), each -1..1, and pick the picture that matches the direction. */
  drive(dx, dy) {
    const s = ROVER_SPEED;
    this.sprite.setVelocity(dx * s, dy * s);
    if (dx || dy) this.face(Math.abs(dx) >= Math.abs(dy) ? 'side' : dy > 0 ? 'down' : 'up', dx ? dx < 0 : this.sprite.flipX);
    this.sprite.setDepth(this.sprite.y);
  }

  /** Point the rover: view 'side' / 'down' / 'up', and flip (facing left). Also used for other players' rover. */
  face(view, flip) {
    this.view = view;
    this.sprite.setFlipX(view === 'side' && !!flip);
    this.sprite.setFrame(FIRST_FRAME[view] + this.wheel);
  }

  /**
   * Every frame (for my rover AND one someone else drives): turn the wheels and kick up dust when it moves,
   * and draw a helmet on each seat in use. riders: job colours of everyone inside, driver first.
   */
  update(time, riders) {
    const sp = this.sprite;
    // Someone else drives: glide towards their latest position (updates arrive 10 times a second)
    if (!this.driving && this.target) {
      sp.setPosition(sp.x + (this.target.x - sp.x) * 0.35, sp.y + (this.target.y - sp.y) * 0.35).setDepth(sp.y);
      if (Math.hypot(this.target.x - sp.x, this.target.y - sp.y) > 200) sp.setPosition(this.target.x, this.target.y);   // too far behind: jump
    }
    const moved = Math.hypot(sp.x - this.last.x, sp.y - this.last.y);
    this.last = { x: sp.x, y: sp.y };
    if (moved > 0.2) {
      this.rolled += moved;
      if (this.rolled > 6) { this.rolled = 0; this.wheel ^= 1; sp.setFrame(FIRST_FRAME[this.view] + this.wheel); }
      if (time - this.dustAt > 70) { this.dustAt = time; this.dust(); }
    }
    const g = this.helmets; g.clear().setDepth(sp.depth + 1);
    if (this.inGarage) return;
    riders.slice(0, SEATS).forEach((col, i) => {
      let [hx, hy] = SEAT_POS[this.view][i];
      if (sp.flipX) hx = -hx;
      g.fillStyle(0xf4efe6).fillCircle(sp.x + hx + 0.5, sp.y + hy, 3);              // helmet
      g.fillStyle(col).fillRect(sp.x + hx - 2, sp.y + hy - 1, 5, 2);                // visor, in the job colour
    });
  }

  /**
   * Park the rover inside the garage (hidden; it's drawn inside the Garage room instead) or bring it out.
   * door: the garage door, where it comes out.
   */
  setInGarage(inside, door) {
    this.inGarage = inside;
    this.target = null;
    this.sprite.setVisible(!inside); this.sprite.body.enable = !inside;
    if (door) this.sprite.setPosition(door.x, door.y + 16);
    this.face('down', false);
    if (inside) this.helmets.clear();
  }

  /**
   * Stuck in the sand (the start of the game when a person is the Pilot): parked at (x, y), half buried in a
   * sand mound, until the Pilot wins the Unstick mini game. Nobody can drive or ride it while it's stuck.
   */
  setStuck(on, x, y) {
    this.stuck = !!on;
    this.target = null;
    if (on) {
      this.sprite.setVisible(true); this.sprite.body.enable = true;
      if (x != null) this.sprite.setPosition(x, y).setDepth(y);
      this.face('side', false);
      this.sand ??= this.scene.add.graphics();
      const g = this.sand, sx = this.sprite.x, sy = this.sprite.y;
      g.clear().setDepth(sy + 1);
      g.fillStyle(0xc9764a).fillEllipse(sx, sy + 2, 44, 16).fillStyle(0xd68a5c).fillEllipse(sx - 6, sy - 1, 26, 8);   // the mound over the wheels
      g.fillStyle(0xa95e36).fillEllipse(sx + 12, sy + 4, 14, 5);
      for (let i = 0; i < 10; i++) g.fillStyle(0xe09a6c).fillRect(sx - 20 + (i * 37) % 40, sy - 4 + (i * 13) % 10, 1, 1);
    } else { this.sand?.clear(); }
  }

  /** Put the rover exactly at (x, y), facing view/flip (the driver got out, or a rejoin snapshot). */
  park(x, y, view = this.view, flip = this.sprite.flipX) {
    this.target = null;
    this.sprite.setPosition(x, y).setDepth(y);
    this.face(view, flip);
  }

  /** One puff of Mars dust behind the rover that drifts up and fades. */
  dust() {
    const sp = this.sprite, back = this.view === 'side' ? [sp.flipX ? 14 : -14, 0] : this.view === 'down' ? [0, -10] : [0, 4];
    const p = this.scene.add.circle(sp.x + back[0] + (Math.random() - 0.5) * 6, sp.y + back[1] + 2, 2 + Math.random() * 2, 0xc8783c, 0.7).setDepth(sp.depth - 1);
    this.scene.tweens.add({ targets: p, y: p.y - 6, scale: 2, alpha: 0, duration: 500, onComplete: () => p.destroy() });
  }
}
