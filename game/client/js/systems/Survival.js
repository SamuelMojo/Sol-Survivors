// Survival: the Mars clock and the THREE bars every player watches:
//   FOOD (eat indoors)   AIR (suit air: drains outside; refills indoors once MOXIE works)   HEALTH
// Health goes down from radiation (most in the Reactor Wreck and in space storms), from an empty suit,
// and from starving. At 0 you pass out and wake up in the medbay.
// Also: the MOXIE TIMER (10 real minutes to fix MOXIE or the mission ends), crops growing, space storms
// (solar flares), dust storms, and the night.
//
// 👤 Owner: Game logic & backend. The numbers are in game/rules/survival.js; the REAL ones come from
// story/nasa-data.js. Every player runs their own body; the crew leader's clock, MOXIE timer and crops are
// sent to everyone (see Multiplayer.js).
import { audio } from './Audio.js';
import { TIME, BODY, RADIATION, AIR, REAL_FLARES, LAUNCH, NIGHT_STORMS } from '/game/rules/survival.js';
import { CROPS, GROW_MINUTES, growth } from '/game/rules/farm.js';
import { MINIGAME_TEXT } from '/story/minigames.js';
import { net } from '../net.js';

// Frost Watch (the Botanist's night mini game): the warning comes at 21:00; beds nobody heats freeze at 23:30
const FROST = { start: 21 * 60, end: 23 * 60 + 30, thawBy: 20 * 60 };

/** Minutes since midnight -> 'HH:MM' (e.g. 390 -> '06:30'). */
export const fmtTime = m => { m = Math.floor(m) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

/** The clock, my 3 bars, the MOXIE timer, crops, flares, storms and the night. */
export class Survival {
  /**
   * Start on Sol 1 at 06:00 with full air, 80 food and full health. rnd is the shared seeded random,
   * so every player gets the same flares and storms.
   */
  constructor(world, rnd) {
    const ri = rnd.int, shuffle = rnd.shuffle;
    this.w = world;
    this.sol = 1;
    this.min = TIME.wake;
    // My body: suit air %, food, health, total radiation dose (never goes down; shown at the end),
    // and what hurt me last (for the 'you passed out' message)
    this.me = { suit: 100, food: 80, health: 100, totalDose: 0, hurtBy: 'radiation' };
    this.moxieLeft = AIR.moxieSeconds;                    // real seconds left to fix MOXIE
    this.base = {};                                      // shared base supplies (synced by the leader)
    this.known = {};            // sols with a space weather forecast from Earth
    this.warned = {};

    // Random every game (same on every screen): a space storm (solar flare) EVERY sol, each modelled on a real
    // DONKI flare (Sol 1's comes in the afternoon), and 2 dust storms every night
    const events = shuffle([...REAL_FLARES]);
    this.flares = [...Array(16).keys()].map(i => {
      const sol = i + 1, start = (sol === 1 ? ri(13, 16) : ri(9, 16)) * 60 + (rnd() < 0.5 ? 30 : 0);
      return { sol, start, end: start + RADIATION.flareHours * 60, real: events[i % events.length], dose: 0 };
    });
    // Night dust storms, as [start, end] in 'Mars minutes since Sol 1 began' (so they can cross midnight)
    this.nightStorms = [];
    for (let sol = 1; sol <= 16; sol++) for (const [a, b] of [NIGHT_STORMS.evening, NIGHT_STORMS.late]) {
      const day = (a < TIME.wake ? sol : sol - 1) * 1440, start = day + ri(a, b), len = ri(...NIGHT_STORMS.minutes);
      this.nightStorms.push([start, start + len]);
    }
  }

  /** Is the Sun up? */
  get daylight() { return this.min >= TIME.sunrise && this.min < TIME.sunset; }
  /** Is there a dust storm on this sol? */
  isStorm() { const t = (this.sol - 1) * 1440 + this.min; return this.nightStorms.some(([a, b]) => t >= a && t < b); }
  /** A dust storm starting within the next hour (for the warning), or null. */
  get stormComing() { const t = (this.sol - 1) * 1440 + this.min; return this.nightStorms.find(([a]) => a > t && a - t <= NIGHT_STORMS.warnMinutes) ?? null; }
  /** The solar flare planned for this sol, if any. */
  flareOn(sol = this.sol) { return this.flares.find(f => f.sol === sol); }
  /** The flare happening right now (particles arriving), or null. */
  get flareActive() { const f = this.flareOn(); return f && this.min >= f.start && this.min < f.end ? f : null; }
  /** MOXIE's time left as 'm:ss', e.g. '7:42'. */
  get moxieClock() { const t = Math.max(0, Math.ceil(this.moxieLeft)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; }
  /** Is MOXIE making air (so suits can refill indoors)? */
  get airOn() { return !this.w.equipment.get('moxie').broken; }

  /** How long my suit's air lasts outside, in Mars minutes (the Pilot's lasts longest). */
  get suitMinutes() { return BODY.suitMinutes[this.w.job] ?? 360; }
  /** Can the rocket launch today? */
  get windowOpen() { return this.sol >= LAUNCH.opens && this.sol <= LAUNCH.closes; }
  /** Too late: the launch window has closed. */
  get windowMissed() { return this.sol > LAUNCH.closes; }

  /** Radiation: adds to my lifetime total and hurts my health. */
  addRad(v) { this.me.totalDose += v; this.hurt(v * BODY.radToHealth, 'radiation'); }
  /** Lose health (why: 'radiation', 'air' or 'food', for the message if I pass out). */
  hurt(v, why) { if (v <= 0) return; this.me.health = Math.max(0, this.me.health - v); this.me.hurtBy = why; }
  /** Get health back (sleep, medkit, medbay), up to 100. */
  heal(v) { this.me.health = Math.min(100, this.me.health + v); }

  /**
   * Called every frame with the real seconds since the last frame. The clock pauses while a menu is open
   * (single player only) and while the host has paused. While everyone sleeps, only the leader moves the clock on.
   */
  tick(dtSec) {
    if (this.w.frozen || (this.w.uiOpen && !this.w.multi) || this.w.knockingOut || this.w.ended) return;
    // The MOXIE timer runs in real time while you play (not at night)
    if (!this.airOn && !this.w.sleeping && this.w.moxieTimerOn) this.moxieTimer(dtSec);
    // Asleep in a bunk: my own bars rest, but the leader keeps the clock (and the crops) going for everyone
    if (this.w.sleeping) {
      if (this.w.multi && net.isLeader) { const dm = dtSec * TIME.minutesPerSecond; this.min += dm; this.growCrops(dm); this.newDay(); }
      return;
    }
    let dm = dtSec * TIME.minutesPerSecond;
    while (dm > 0) { const d = Math.min(dm, 1); dm -= d; this.step(d); if ((this.w.uiOpen && !this.w.multi) || this.w.knockingOut || this.w.sleeping) break; }
  }

  /**
   * Advance the game by dm Mars minutes (at most 1 at a time): food, air, radiation, warnings, knock-outs.
   * 'once' shows a warning only once until things get better again.
   */
  step(dm) {
    const w = this.w, me = this.me, base = this.base, inside = !!w.inside;
    const once = (k, t, c = '#ff5f5f') => { if (!this.warned[k]) { this.warned[k] = true; w.toast(t, c); } };
    this.min += dm;

    // FOOD: always drains. At 0 you start losing health.
    me.food = Math.max(0, me.food - BODY.hungerPerMin * dm);
    if (me.food <= 0) { this.hurt(BODY.starvingDamagePerMin * dm, 'food'); once('starve', 'You\'re STARVING! Go inside and eat now!'); }
    else if (me.food < 20) once('hungry', 'You\'re hungry. Go inside to eat.', '#ffd34d');
    if (me.food > 30) this.warned.hungry = this.warned.starve = false;

    // AIR: drains outside. Indoors it only refills once MOXIE is fixed (slowly while MOXIE runs on its battery).
    if (!inside) {
      me.suit = Math.max(0, me.suit - 100 / this.suitMinutes * dm);
      if (me.suit <= 0) { this.hurt(BODY.noAirDamagePerMin * dm, 'air'); once('noair', 'NO AIR! Go inside now!'); }
      else if (me.suit < 25) once('lowair', this.airOn ? 'Air is low! Go into any building.' : 'Air is low! Go inside. Suits can\'t refill until MOXIE is fixed!');
    } else if (this.airOn) {
      const speed = w.equipment.onBattery('moxie') ? AIR.batterySpeed : 1;       // MOXIE on battery: half speed
      if (me.suit < 100) me.suit = Math.min(100, me.suit + BODY.suitRefillPerMin * speed * dm);
      if (me.suit > 30) this.warned.lowair = this.warned.noair = false;
    }

    // DUST STORMS: a warning (like the space storm alarm) an hour before each one, and a message when it hits
    const sc = this.stormComing;
    if (sc && !sc.warned) { sc.warned = true; audio.sfx('alarm'); w.toast('DUST STORM ALARM! A dust storm is coming. You will move very slowly. Get near a building!', '#ffb02e'); }
    const inStorm = this.isStorm();
    if (inStorm && !this.wasStorm) w.toast('The dust storm is here! You move 70% slower.', '#ffb02e');
    if (!inStorm && this.wasStorm) w.toast('The dust storm is over.', '#ffd34d');
    this.wasStorm = inStorm;

    // CROPS grow while the greenhouse lights work (everyone grows them; the leader's sync keeps them the same)
    this.growCrops(dm);

    // RADIATION (hurts health): a little everywhere, a lot in the Reactor Wreck, and a big dose during a flare (a quarter indoors).
    // A flare goes: alarm 30 min before (X-rays arrive first) -> particle storm for a few hours -> over.
    this.addRad(RADIATION.surfacePerSol / 1440 * dm);                    // background (REAL Curiosity average)
    if (!inside && w.zone?.hazard) { this.addRad(BODY.reactorPerMin * dm); once('reactor', 'RADIATION! It hurts your health here. Grab what you need and leave.'); }
    else this.warned.reactor = false;
    const f = this.flareOn();
    if (f) {
      if (this.min >= f.start - RADIATION.alarmMinutes && this.min < f.start && !f.alarm) {
        f.alarm = true;
        audio.sfx('alarm');
        w.toast('SPACE STORM ALARM! A solar flare is coming. GET INSIDE!', '#ff5f5f');
      }
      if (this.min >= f.start && this.min < f.end) {
        if (!f.hit) {
          f.hit = true;
          w.toast(`The space storm is here! Stay inside. (Based on a real flare from ${f.real.date}.)`, '#ff5f5f');
          if (inside) w.taskEvent('shelter');
        }
        // Outside: 5 health a real second. Inside: safe.
        if (!inside) { this.hurt(RADIATION.flareHealthPerMin * dm, 'radiation'); const add = RADIATION.flareDose / (RADIATION.flareHours * 60) * dm; me.totalDose += add; f.dose += add; }
      }
      if (this.min >= f.end && f.hit && !f.done) { f.done = true; w.toast(f.dose > 0 ? 'The space storm is over. Ouch!' : 'The space storm is over. You stayed safe inside!', '#ffd34d'); }
    }
    if (me.health < 25) once('lowhealth', 'Your health is CRITICAL! Get inside, eat, use a medkit (F) or rest in the medbay.');
    else if (me.health > 40) this.warned.lowhealth = false;

    if (this.min >= TIME.lateWarning && !this.warned.late) { this.warned.late = true; w.toast('It\'s late! Go to bed in the hub.', '#ffd34d'); }
    this.frostWatch();

    // Health gone: you pass out
    if (me.health <= 0) return w.knockOut(me.hurtBy);
    this.newDay();
  }

  /**
   * How fast bed i grows compared with normal: half until the Botanist tunes the lights (Light Recipe),
   * double if the bed is fertilized, zero while it's frozen (Frost Watch).
   */
  growRate(i) {
    const w = this.w, p = w.planters[i];
    if (p?.frozen) return 0;
    return (w.lightsOk() ? 1 : 0.5) * (w.fert?.[i] ? 2 : 1);
  }

  /**
   * Crops grow (dm Mars minutes) while the greenhouse lights work. Tells the Botanist when one is ready.
   * Frozen beds thaw in the morning (nothing is lost, they just paused).
   */
  growCrops(dm) {
    const w = this.w;
    const thaw = this.min >= TIME.wake && this.min < FROST.thawBy;
    w.planters.forEach(p => { if (p?.frozen && thaw) delete p.frozen; });
    if (!w.equipment.working('greenhouse_lights')) return;
    w.planters.forEach((p, i) => {
      if (!p || (p.grown ?? 0) >= GROW_MINUTES) return;
      p.grown = Math.min(GROW_MINUTES, (p.grown ?? 0) + dm * this.growRate(i));
      if (p.grown >= GROW_MINUTES && w.job === 'botanist') w.toast(`A ${CROPS[p.seed].name} is ready to pick in the greenhouse!`, '#7bd88f');
    });
  }

  /**
   * Frost Watch, for a human Botanist only (a computer Botanist never gets frost): around 21:00, if a bed has
   * a growing crop, the warning comes. Going into the greenhouse opens the mini game (InteriorScene). Beds
   * that nobody heats by 23:30 freeze: they stop growing until the morning.
   */
  frostWatch() {
    const w = this.w;
    if (w.job !== 'botanist') return;
    const f = w.frost;
    if (!f && this.min >= FROST.start && this.min < FROST.end - 30 && this.frostSol !== this.sol && w.planters.some(p => p && growth(p) < 1)) {
      this.frostSol = this.sol;
      w.frost = { sol: this.sol, until: FROST.end, playing: false };
      audio.sfx('alarm');
      w.toast(MINIGAME_TEXT.frost.warn, '#6cc4ff');
      return;
    }
    if (f && !f.playing && (this.min >= f.until || this.sol !== f.sol)) {
      const n = w.freezeBeds(null);
      w.frost = null;
      if (n) w.toast(MINIGAME_TEXT.frost.froze(n), '#6cc4ff');
    }
  }

  /**
   * The MOXIE timer: dtSec real seconds pass. Warns at 5, 2 and 1 minutes left; at 0 the mission is over.
   */
  moxieTimer(dtSec) {
    const before = this.moxieLeft;
    this.moxieLeft = Math.max(0, this.moxieLeft - dtSec);
    for (const s of [300, 120, 60]) if (before > s && this.moxieLeft <= s) { audio.sfx('alarm'); this.w.toast(`Only ${s / 60} minute${s > 60 ? 's' : ''} left to fix MOXIE!`, '#ff5f5f'); }
    if (this.moxieLeft <= 0 && before > 0) this.w.endGame(false, 'air');
  }

  /** Past midnight: a new sol starts (the clock never stops at night). */
  newDay() {
    if (this.min < 1440) return;
    this.min -= 1440; this.sol++;
    this.warned = {};
    this.w.toast(`It's midnight: Sol ${this.sol} begins. Get some sleep in the hub!`, '#c9ad93');
  }

  /** The shared part of the night (run by the crew leader / solo player): crops grow overnight, the date changes. */
  runNightShared() {
    const w = this.w, R = [];
    const planted = w.planters.filter(Boolean);
    const after = this.min < TIME.wake;                  // already past midnight?
    const nightMinutes = after ? TIME.wake - this.min : 1440 - this.min + TIME.wake;
    if (planted.length && w.equipment.working('greenhouse_lights')) {
      w.planters.forEach((p, i) => { if (p) p.grown = Math.min(GROW_MINUTES, (p.grown ?? 0) + nightMinutes * this.growRate(i)); });
      R.push('Your plants grew overnight!');
    } else if (planted.length) R.push(w.equipment.get('greenhouse_lights').broken ? 'Plants didn\'t grow. The grow lights are broken.' : 'Plants didn\'t grow. The grow lights need power.');
    if (!after) this.sol++;
    this.min = TIME.wake;
    return { lines: R };
  }

  /** My own part of the night: sleep heals you (and refills your air if MOXIE works) but makes you hungrier. */
  runNightPersonal() {
    const me = this.me, R = [];
    me.food = Math.max(Math.min(me.food, BODY.nightFoodFloor), me.food - BODY.nightHunger);   // hungry, but never starving in your sleep
    this.heal(BODY.sleepHeal);
    if (this.airOn) me.suit = 100;
    R.push(`Sleep made you healthier${this.airOn ? ' and filled your air' : ''}. It didn't fill your tummy, so eat breakfast!`);
    R.push(`Food ${Math.round(me.food)} · Air ${Math.round(me.suit)}% · Health ${Math.round(me.health)}`);
    this.warned = {};                                    // a new day: warnings can show again
    return R;
  }

  /** Warnings for the morning report. */
  morningWarnings() {
    const warn = [], me = this.me, w = this.w;
    warn.push('Tonight there will be 2 dust storms. Carry on with care!');
    const f = this.flareOn();
    if (f && this.known[this.sol]) warn.push(`Space storm today at about ${fmtTime(f.start)}. Be inside!`);
    if (me.food < 40) warn.push('You\'re hungry. Eat before you go out.');
    if (!this.airOn) warn.push(`Fix MOXIE! ${this.moxieClock} left.`);
    if (this.sol <= LAUNCH.closes) warn.push(`Fix everything and fly home! The rescue ship leaves after Sol ${LAUNCH.closes} (${LAUNCH.closes - this.sol + 1} sol(s) left).`);
    return warn;
  }

  /** Space weather forecast for the next 3 sols (needs working laser comms). */
  forecast() {
    const lines = [];
    for (let s = this.sol; s <= this.sol + 2; s++) {
      const f = this.flareOn(s);
      if (f && !f.done) lines.push(`Sol ${s}: space storm at about ${fmtTime(f.start)}. Stay inside!`);

    }
    return lines.length ? `Earth weather report: ${lines.join(' ')}` : 'Earth weather report: no storms for 3 sols. Go and explore!';
  }
}
