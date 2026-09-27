import type { World } from 'koota';
import { clamp, lerp, vec3, type Vec3 } from 'math';
import { easing } from 'math/time';
import { CAPTURE, HOLE, SHADOW } from '../black-hole/content';
import { BlackHole, Swallowed } from '../black-hole/traits';
import { uCurtain } from '../post/materials';
import { Spin } from '../motion/traits';
import { sequenceActions } from '../sequence/actions';
import { Time } from '../time/traits';
import { Transform } from '../transform/traits';
import { Viewport } from '../viewport/traits';
import { Wumpus } from '../wumpus/traits';
import {
  BEATS,
  BLAST_AT,
  CURTAIN_SECONDS,
  EJECTED,
  FLIGHT,
  FLIGHT_SHOT,
  INFALL,
  INSERT,
  SHOTS,
  openingShot,
} from './content';
import { insertUniforms } from './materials';
import { Curtain, Framing, Insert, Shot, ShotView } from './traits';

/** Move the curtain toward where it is heading, at a steady pace. */
export function drawCurtain(world: World): void {
  const curtain = world.get(Curtain)!;
  const step = world.get(Time)!.delta / CURTAIN_SECONDS;

  if (curtain.level === curtain.target) return;

  const level =
    curtain.level < curtain.target
      ? Math.min(curtain.level + step, curtain.target)
      : Math.max(curtain.level - step, curtain.target);
  world.set(Curtain, { ...curtain, level });
}

/** Publish the curtain to the post pass. */
export function syncCurtainView(world: World): void {
  uCurtain.value = world.get(Curtain)!.level;
}

/** Age the insert while it is on screen, and take it off once it has faded. */
export function ageInsert(world: World): void {
  const insert = world.get(Insert)!;

  if (!insert.showing) return;

  const age = insert.age + world.get(Time)!.delta;
  world.set(Insert, { showing: age < INSERT.hold + INSERT.fade, age });
}

/** Publish the insert to the post pass: slammed on, punching in to rest, holding, and fading. */
export function syncInsertView(world: World): void {
  const { showing, age } = world.get(Insert)!;
  const landing = easing.cubicOut(clamp(age / INSERT.snap, 0, 1));
  insertUniforms.uInsert.value = showing ? 1 - clamp((age - INSERT.hold) / INSERT.fade, 0, 1) : 0;
  insertUniforms.uInsertScale.value = 1 + INSERT.punch * (1 - landing);
}

/**
 * Frame the shot. On a still the camera holds perfectly still on what it framed at the cut; on the flight it plays
 * out the flight's move, rolling with the wumpus's tumble while it is caught up in it. Once the camera passes a
 * hole's horizon the scene hears so.
 */
export function frameShot(world: World): void {
  const framing = world.get(Framing)!;
  const { delta } = world.get(Time)!;
  const age = framing.age + delta;
  const aspect = world.get(Viewport)!.aspect;
  const plan = framing.shot === 'system' ? openingShot(aspect) : SHOTS[framing.shot];
  const shot = world.get(Shot)!;

  if (plan.kind === 'still') {
    vec3.add(shot.position, framing.anchor, plan.position);
    vec3.add(shot.target, framing.anchor, plan.target);
    world.set(Shot, { ...shot, roll: plan.roll, fov: plan.fov, speed: 0 });
    world.set(Framing, { ...framing, age });

    return;
  }

  const turn = framing.turn + (age < FLIGHT_SHOT.frenzy.seconds ? turnedInSight(world, delta) : 0);

  // The moment the wumpus is gone, remember where the camera was and what it looked at, to move on from there.
  const lost = framing.lost || world.queryFirst(Wumpus, Swallowed) !== undefined;

  if (lost && !framing.lost) {
    vec3.copy(framing.lostFrom, shot.position);
    vec3.copy(framing.lostAim, shot.target);
  }

  flightShot(world, framing, age, turn);

  const hole = world.queryFirst(BlackHole, Transform);
  const radius = (hole?.get(BlackHole)?.horizon ?? 0) / SHADOW;
  const distance =
    hole === undefined ? Infinity : vec3.distance(shot.position, hole.get(Transform)!.position);
  const through = framing.through || distance < radius;
  world.set(Framing, { ...framing, age, turn, lost, through });

  if (through && !framing.through) sequenceActions(world).triggerSequence('fell-in');
}

const sight = vec3.create();

/**
 * How far the wumpus turned over `delta` seconds about the axis the camera rolls round, back from what it looks at to
 * it, in radians: how far the camera must roll to turn with it.
 */
function turnedInSight(world: World, delta: number): number {
  const spin = world.queryFirst(Wumpus, Spin)?.get(Spin);

  if (spin === undefined) return 0;

  const { position, target } = world.get(Shot)!;
  vec3.normalize(sight, vec3.subtract(sight, position, target));

  return vec3.dot(spin.velocity, sight) * delta;
}

/** A snappy arrival: past where it is going, a little, and back to rest there. */
function overshoot(t: number): number {
  const pull = 1.4;

  return 1 + (pull + 1) * (t - 1) ** 3 + pull * (t - 1) ** 2;
}

/** A camera's shake at `time`: a few sines at odd rates, so it never quite repeats, each -1 to 1 or so. */
function jitter(time: number, seed: number): number {
  return (
    (Math.sin(time * 13.7 + seed) +
      0.6 * Math.sin(time * 23.3 + seed * 2.1) +
      0.3 * Math.sin(time * 41.9)) /
    1.9
  );
}

const toward = vec3.create();
const past = vec3.create();

/** A point as far from `from` as `near` is, looking `share` of the way from `near` toward `far`. */
function between(out: Vec3, from: Vec3, near: Vec3, far: Vec3, share: number): Vec3 {
  const reach = vec3.distance(from, near);
  vec3.normalize(toward, vec3.subtract(toward, near, from));
  vec3.normalize(past, vec3.subtract(past, far, from));
  vec3.normalize(toward, vec3.lerp(toward, toward, past, share));

  return vec3.scaleAndAdd(out, from, toward, reach);
}

const offset = vec3.create();
const frenzyAt = vec3.create();
const stand = vec3.create();
const aim = vec3.create();
const inward = vec3.create();
const leadAt = vec3.create();
const outward = vec3.create();
const beside = vec3.create();
const chaseAt = vec3.create();

/**
 * The flight, after the moment in Gravity an astronaut is torn loose: a frenzy right on the wumpus, the fireball
 * behind it, the frame rolling with its tumble so the fire whirls round it; a snap to a dead stop ahead of it,
 * level, looking back at it and the blast; a fixation on it as the hole yanks it away, the lens tightening; and the
 * plunge, dragged past it to watch it stretch, then beside it as it is wrung apart; and once it is gone, a pull
 * back to take in the hole, a beat on it, and the camera sucked in, harder and harder.
 */
function flightShot(
  world: World,
  { anchor, lostFrom, lostAim }: { anchor: Vec3; lostFrom: Vec3; lostAim: Vec3 },
  age: number,
  turn: number
): void {
  const { frenzy, settle, fixate, plunge, chase, back, suck } = FLIGHT_SHOT;
  const portrait = clamp((1.1 - world.get(Viewport)!.aspect) / 0.45, 0, 1);
  const { elapsed } = world.get(Time)!;
  const shot = world.get(Shot)!;
  const wumpus = world.queryFirst(Wumpus, Transform);
  const at = wumpus?.get(Transform)?.position ?? anchor;
  const found = world.queryFirst(BlackHole, Transform);
  const hole = found?.get(Transform)?.position ?? BLAST_AT;

  // The frenzy: ahead of the wumpus, looking back past it into the fire, lurching round it and in and out, shaking,
  // and rolling with it.
  const yaw = (frenzy.swing * (Math.sin(age * 1.9) + 0.45 * Math.sin(age * 4.3 + 2))) / 1.45;
  const pitch = (frenzy.swing * 0.6 * (Math.sin(age * 2.7 + 1) + 0.4 * Math.sin(age * 5.1))) / 1.4;
  vec3.scale(offset, FLIGHT.along, Math.cos(yaw) * Math.cos(pitch));
  vec3.scaleAndAdd(offset, offset, FLIGHT.across, Math.sin(yaw) * Math.cos(pitch));
  vec3.scaleAndAdd(offset, offset, FLIGHT.lifted, Math.sin(pitch));
  vec3.scaleAndAdd(frenzyAt, at, offset, frenzy.distance * (1 + frenzy.surge * Math.sin(age * 3.1)));
  vec3.set(offset, jitter(elapsed, 1), jitter(elapsed, 2), jitter(elapsed, 3));
  vec3.scaleAndAdd(frenzyAt, frenzyAt, offset, frenzy.shake);
  const frenzyRoll =
    frenzy.lock * turn + frenzy.roll * Math.sin(age * 2.1) + frenzy.shake * jitter(elapsed, 4);
  const level = Math.round(frenzyRoll / (2 * Math.PI)) * 2 * Math.PI;

  // Where it stops dead: ahead of where the wumpus will be when it does, and off to the side, looking back at the
  // hole in the blast, the wumpus in the foreground, closing on it as the hole pulls it away.
  vec3.scaleAndAdd(stand, anchor, EJECTED, frenzy.seconds);
  vec3.scaleAndAdd(stand, stand, FLIGHT.along, settle.ahead);
  vec3.scaleAndAdd(stand, stand, FLIGHT.across, settle.across);
  vec3.scaleAndAdd(stand, stand, FLIGHT.lifted, settle.up);
  between(aim, stand, at, hole, lerp(settle.focus, 1, portrait));
  const fixing = clamp((age - frenzy.seconds - settle.seconds) / fixate.seconds, 0, 1);
  const fixedFov = lerp(settle.fov, fixate.fov, easing.sineInOut(fixing));

  const settling = clamp((age - frenzy.seconds) / settle.seconds, 0, 1);
  const snapped = settling === 0 ? 0 : overshoot(settling);
  vec3.lerp(shot.position, frenzyAt, stand, snapped);
  vec3.lerp(shot.target, at, aim, snapped);
  let roll = lerp(frenzyRoll, level, snapped);
  let fov = lerp(frenzy.fov, fixedFov, Math.min(snapped, 1));
  let speed = 0;

  // The plunge: the hole takes the camera faster than the wumpus, past it, to hang `hover` radii out, looking back
  // as it bears down, stretching; it whips past, and the camera latches on beside it, its middle dead centre, as it
  // is wrung apart at the horizon.
  if (found !== undefined && age > BEATS.taken) {
    const radius = found.get(BlackHole)!.horizon / SHADOW;
    const start = vec3.distance(stand, hole);
    const hover = (plunge.hover * HOLE.full) / SHADOW;
    const falling = clamp((age - BEATS.taken) / plunge.seconds, 0, 1);
    const leading = start * (hover / start) ** (falling ** 1.6);
    const nearness = 1 - clamp((leading - radius) / (start - radius), 0, 1);
    vec3.normalize(inward, vec3.subtract(inward, stand, hole));
    vec3.scaleAndAdd(inward, inward, FLIGHT.across, plunge.aside * nearness);
    vec3.scaleAndAdd(leadAt, hole, vec3.normalize(inward, inward), leading);
    const eased = nearness ** 2;

    if (wumpus?.has(Swallowed) === false) {
      // Once it hangs there, ahead of the wumpus, the wumpus whips past it, and it swings round to chase it.
      const past = falling < 1 ? 0 : (leading - vec3.distance(at, hole)) / plunge.pass;
      const latch = easing.sineInOut(clamp(past, 0, 1));
      vec3.normalize(outward, vec3.subtract(outward, at, hole));
      vec3.scaleAndAdd(beside, FLIGHT.across, outward, -vec3.dot(FLIGHT.across, outward));
      vec3.scaleAndAdd(chaseAt, at, outward, chase.back);
      vec3.scaleAndAdd(chaseAt, chaseAt, vec3.normalize(beside, beside), chase.side);
      vec3.lerp(shot.position, leadAt, chaseAt, latch);
      const turning = easing.sineInOut(clamp((age - BEATS.taken) / plunge.turn, 0, 1));
      vec3.lerp(shot.target, aim, at, turning);
      const shake =
        plunge.shake * Math.min(leading, start * 0.3) * Math.min(falling * 4, 1) * (1 - latch);
      shot.target[0] += shake * jitter(elapsed, 5);
      shot.target[1] += shake * jitter(elapsed, 6);
      // Looking back, the lens keeps the wumpus the same size however far off it is, the world widening round it.
      const keeping = (360 / Math.PI) * Math.atan(plunge.frame / (2 * vec3.distance(leadAt, at)));
      fov = lerp(
        lerp(fixedFov, clamp(keeping, plunge.narrowest, plunge.fov), turning),
        chase.fov,
        latch
      );
      roll = level + plunge.roll * Math.max(eased, latch);
    } else {
      // Gone. The camera pulls back to take in the hole that took it, turning onto it and levelling, holds on it a
      // beat, and is sucked in, faster and faster, shaking and rolling and stretching harder and harder.
      const since = Math.max(age - BEATS.capture - CAPTURE.duration, 0);
      const pulling = easing.cubicOut(clamp(since / back.seconds, 0, 1));
      const sucking = Math.max(since - back.seconds - back.look, 0);
      const intensity = clamp(sucking / suck.build, 0, 1) ** 2;
      const reach = lerp(vec3.distance(lostFrom, hole), (back.reach * HOLE.full) / SHADOW, pulling);
      const distance = reach * Math.exp((-suck.rate * sucking ** 3) / 3);
      vec3.normalize(outward, vec3.subtract(outward, lostFrom, hole));
      vec3.scaleAndAdd(shot.position, hole, outward, distance);
      vec3.lerp(shot.target, lostAim, hole, easing.sineInOut(clamp(since / back.seconds, 0, 1)));
      const shake = suck.shake * distance * intensity;
      shot.target[0] += shake * jitter(elapsed, 7);
      shot.target[1] += shake * jitter(elapsed, 8);
      shot.target[2] += shake * jitter(elapsed, 9);
      fov = lerp(lerp(chase.fov, back.fov, pulling), suck.fov, intensity);
      roll = lerp(level + plunge.roll, level, pulling) + suck.roll * intensity;
      // Falling freely from far off, it moves past the hole's still onlookers at the root of the horizon's share of
      // its distance, as a share of light's speed.
      speed = Math.min(Math.sqrt(radius / distance), INFALL) * intensity;
    }
  }

  world.set(Shot, { ...shot, roll, fov, speed });
}

/** Point the camera along the shot. */
export function syncShotView(world: World): void {
  const camera = world.get(ShotView);

  if (camera === undefined) return;

  const { position, target, roll, fov } = world.get(Shot)!;
  camera.position.fromArray(position);
  camera.lookAt(target[0], target[1], target[2]);
  camera.rotateZ(roll);

  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}
