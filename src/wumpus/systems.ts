import { createAdded, type World } from 'koota';
import { clamp, lerp, quat, remapClamp, vec3, type Quat, type Vec2, type Vec3 } from 'math';
import { simplex3d } from 'math/noise';
import { mulberry32, random } from 'math/random';
import { easing } from 'math/time';
import { Bolt, Flare } from '../battle/traits';
import { Captured } from '../black-hole/traits';
import { Tether, Velocity } from '../motion/traits';
import { Time } from '../time/traits';
import { Offset, Transform } from '../transform/traits';
import { BLINK, FEAR, FLOAT_PERFORMANCE, LEAF_SWAY } from './content';
import { Blinking, Fear, Floating, LeafSway, Pose, WumpusRig } from './traits';

const TAU = Math.PI * 2;

/**
 * Hold the floating posture and wander from it. Every part mixes a slow wave, which gives the float its rhythm,
 * with noise, which keeps any cycle from reading as a loop. This is the pose's first layer, so it sets every part
 * of it that the layers after it add to.
 */
export function performFloating(world: World): void {
  const { delta } = world.get(Time)!;
  const { arms, legs, head, breath } = FLOAT_PERFORMANCE;

  world.query(Floating, Pose).updateEach(([floating, pose]) => {
    floating.clock += delta * floating.tempo;

    const { clock, energy, noise } = floating;
    const wave = (rate: number, phase: number) => Math.sin(TAU * rate * clock + phase);
    // Space noise channels far enough apart that neighbouring movements do not echo.
    const wander = (channel: number, rate: number) =>
      simplex3d.sample(noise, clock * rate, channel * 7.31, 0);

    // The arms float up and forward from their hang. Each keeps its own clock, so they never mirror.
    const rightLift =
      arms.lift + energy * (arms.wave * wave(arms.waveRate, 0) + 0.1 * wander(0, 0.2));
    const leftLift =
      arms.lift + energy * (arms.wave * wave(arms.waveRate * 0.83, 2.2) + 0.1 * wander(1, 0.2));
    pose.rightArm[0] = arms.reach + energy * arms.swing * wave(arms.swingRate, 1.3);
    pose.rightArm[1] = 0;
    pose.rightArm[2] = rightLift;
    pose.leftArm[0] = arms.reach + energy * arms.swing * wave(arms.swingRate * 1.17, 4.1);
    pose.leftArm[1] = 0;
    pose.leftArm[2] = -leftLift;

    // The legs paddle out of step, and splay a little on their own slower waves.
    const kick = legs.kick * wave(legs.kickRate, 0);
    pose.rightLeg[0] = legs.bend + energy * (kick + 0.08 * wander(2, 0.3));
    pose.rightLeg[1] = 0;
    pose.rightLeg[2] = legs.splay + energy * legs.splayWave * wave(0.07, 0.5);
    pose.leftLeg[0] = legs.bend + energy * (-0.9 * kick + 0.08 * wander(3, 0.3));
    pose.leftLeg[1] = 0;
    pose.leftLeg[2] = -(legs.splay + energy * legs.splayWave * wave(0.083, 2));

    // The head glances around, nodding and tilting as it goes.
    pose.head[0] = energy * head.nod * wander(4, head.glanceRate);
    pose.head[1] = energy * head.turn * wander(5, head.glanceRate);
    pose.head[2] = energy * head.tilt * wave(head.tiltRate, 0.8);

    pose.breath = 1 + breath.depth * wave(breath.rate, 0);
    pose.duck = 0;
    pose.lids = 0;
    pose.wide = 1;
  });
}

const firedBolts = createAdded();
const burstFlares = createAdded();
const toward = vec3.create();
const closest = vec3.create();
const local = vec3.create();
const inverse = quat.create();

/**
 * Turn a glance toward a point in the world, as far as the head can turn, and hold it there a while. The model faces
 * its own -z inside the wumpus, turned half about to face the camera, so the point is carried into that frame.
 */
function look(
  fear: { target: Vec2; nextGlance: number },
  rotation: Quat,
  from: Vec3,
  point: Vec3,
  hold: number
): void {
  vec3.subtract(toward, point, from);
  quat.conjugate(inverse, rotation);
  vec3.transformQuat(local, toward, inverse);

  const [x, y, z] = [-local[0], local[1], -local[2]];
  fear.target[0] = clamp(Math.atan2(-x, -z), -FEAR.glance.turn, FEAR.glance.turn);
  fear.target[1] = clamp(Math.atan2(y, Math.hypot(x, z)), -FEAR.glance.nod, FEAR.glance.nod);
  fear.nextGlance = hold;
}

/**
 * Watch every shot as it is fired and every flash as it bursts. A shot that will pass near draws a glance toward it
 * at once, and one that will pass close enough schedules a flinch for the moment it goes by, the strongest and
 * soonest winning. A bright flash startles a little, and sometimes draws a glance.
 */
export function senseThreats(world: World): void {
  const shots = world.query(firedBolts(Bolt));
  const flashes = world.query(burstFlares(Flare));

  if (shots.length === 0 && flashes.length === 0) return;

  world.query(Fear, Transform).updateEach(([fear, transform]) => {
    const { position, rotation } = transform;

    // An added entity may already be gone by the time it is sensed, as a shot that burst on impact is.
    for (const entity of shots) {
      const bolt = entity.get(Bolt);

      if (bolt === undefined) continue;

      vec3.subtract(toward, position, bolt.from);
      const along = clamp(vec3.dot(toward, bolt.heading), 0, bolt.span);
      vec3.scaleAndAdd(closest, bolt.from, bolt.heading, along);
      const miss = vec3.distance(closest, position);

      if (miss > FEAR.glance.reach) continue;

      look(fear, rotation, position, closest, FEAR.glance.hold);

      if (miss > FEAR.flinch.range) continue;

      const strength = 1 - miss / FEAR.flinch.range;

      if (fear.flinchIn < 0 || strength > fear.flinchStrength) {
        fear.flinchIn = Math.max((along - bolt.travelled) / bolt.speed, 0);
        fear.flinchStrength = strength;
        vec3.copy(fear.flinchFrom, closest);
      }
    }

    for (const entity of flashes) {
      const flare = entity.get(Flare);

      if (flare === undefined || flare.energy < 3.5) continue;

      fear.startle = Math.max(fear.startle, FEAR.flinch.flash);

      if (mulberry32.sample(fear.random) < 0.3) look(fear, rotation, position, flare.position, 0.6);
    }
  });
}

/** Step a damped spring toward its target, in small enough steps to stay stable through a long frame. */
function spring(
  state: { value: number; speed: number },
  target: number,
  stiffness: number,
  damping: number,
  delta: number
): void {
  const steps = Math.ceil(delta * 240);
  const step = delta / steps;

  for (let index = 0; index < steps; index++) {
    state.speed += (stiffness * (target - state.value) - damping * state.speed) * step;
    state.value += state.speed * step;
  }
}

const away = vec3.create();
const swing = { value: 0, speed: 0 };

/** Carry each of a pose's joint turns part of the way to a cowering one. */
function blend(turn: Vec3, toward: readonly number[], amount: number): void {
  for (let axis = 0; axis < 3; axis++) turn[axis] = lerp(turn[axis]!, toward[axis]!, amount);
}

/**
 * Lay terror over the float. The standing fear pulls the pose toward the cower, and a fresh fright pulls it all the
 * way. The gaze darts from glance to glance instead of wandering. A due flinch jolts the body, squeezes the eyes,
 * and knocks it aside, and a tremble, a pant, and wide, restless eyes run under everything. Flung loose, or caught
 * by a hole, it panics.
 */
export function performFear(world: World): void {
  const { delta, elapsed } = world.get(Time)!;

  if (delta === 0) return;

  const { cower, tremble, pant, glance, flinch, jolt } = FEAR;

  world
    .query(Fear, Pose, Blinking, Transform, Offset)
    .updateEach(([fear, pose, blinking, transform, offset], entity) => {
      const draw = () => mulberry32.sample(fear.random);
      const captured = entity.get(Captured);

      // Once a hole has hold of it, it can look at nothing else.
      if (captured !== undefined)
        look(fear, transform.rotation, transform.position, captured.centre, 1);

      if (fear.flinchIn >= 0 && (fear.flinchIn -= delta) < 0) {
        const strength = fear.flinchStrength;
        fear.startle = Math.max(fear.startle, strength);
        fear.joltSpeed += strength * jolt.kick;
        vec3.normalize(away, vec3.subtract(away, transform.position, fear.flinchFrom));
        vec3.scaleAndAdd(offset.velocity, offset.velocity, away, strength * flinch.shove);

        fear.flinchIn = -1;
        fear.flinchStrength = 0;
      }

      fear.startle *= Math.exp(-flinch.decay * delta);

      const recoil = { value: fear.jolt, speed: fear.joltSpeed };
      spring(recoil, 0, jolt.stiffness, jolt.damping, delta);
      fear.jolt = recoil.value;
      fear.joltSpeed = recoil.speed;

      // A held glance gives way to a new one somewhere else, snapped to and overshot a touch.
      if ((fear.nextGlance -= delta) <= 0) {
        fear.target[0] = (draw() * 2 - 1) * glance.turn;
        fear.target[1] = (draw() * 2 - 1) * glance.nod;
        fear.nextGlance = random.float(draw, glance.interval[0], glance.interval[1]);
      }

      for (let axis = 0; axis < 2; axis++) {
        swing.value = fear.glance[axis]!;
        swing.speed = fear.glanceSpeed[axis]!;
        spring(swing, fear.target[axis]!, glance.stiffness, glance.damping, delta);
        fear.glance[axis] = swing.value;
        fear.glanceSpeed[axis] = swing.speed;
      }

      const thrown = entity.has(Velocity) && !entity.has(Tether);
      const panic =
        captured === undefined ? (thrown ? 1 : 0) : Math.min(captured.age / FEAR.panic.onset, 1);
      const terror = Math.max(fear.level, panic);
      const cowering = terror + (1 - terror) * fear.startle;
      const flung = Math.max(fear.jolt, 0);
      blend(pose.head, cower.head, cowering);
      blend(pose.rightArm, cower.rightArm, cowering);
      blend(pose.leftArm, cower.leftArm, cowering);
      blend(pose.rightLeg, cower.rightLeg, cowering);
      blend(pose.leftLeg, cower.leftLeg, cowering);
      pose.head[1] = lerp(pose.head[1]!, fear.glance[0]!, terror);
      pose.head[0]! += fear.glance[1]! * terror + jolt.head * fear.jolt;
      pose.rightArm[0]! += jolt.arms * fear.jolt;
      pose.leftArm[0]! += jolt.arms * fear.jolt;
      pose.duck = cower.duck * cowering + jolt.duck * flung;

      // Panic thrashes the limbs as though it could swim away, and lifts the head to stare at the hole.
      if (panic > 0) {
        const { arms, legs, duck } = FEAR.panic;
        const flail = (rate: number, phase: number) => Math.sin(TAU * rate * elapsed + phase);
        pose.rightArm[0] = lerp(
          pose.rightArm[0]!,
          arms.reach + arms.swing * flail(arms.rates[0], 0),
          panic
        );
        pose.rightArm[2] = lerp(
          pose.rightArm[2]!,
          arms.lift + arms.flap * flail(arms.rates[1], 1),
          panic
        );
        pose.leftArm[0] = lerp(
          pose.leftArm[0]!,
          arms.reach + arms.swing * flail(arms.rates[2], 2.3),
          panic
        );
        pose.leftArm[2] = lerp(
          pose.leftArm[2]!,
          -(arms.lift + arms.flap * flail(arms.rates[3], 3.1)),
          panic
        );
        pose.rightLeg[0] = lerp(
          pose.rightLeg[0]!,
          legs.bend + legs.kick * flail(legs.rate, 0.5),
          panic
        );
        pose.leftLeg[0] = lerp(
          pose.leftLeg[0]!,
          legs.bend + legs.kick * flail(legs.rate, 0.5 + Math.PI),
          panic
        );
        pose.duck = lerp(pose.duck, duck, panic);
      }

      // The tremble never quite repeats: two shakes a little apart in rate, each part on its own phase.
      const shake = tremble.amount * (terror + fear.startle);
      const tremor = (phase: number) =>
        0.6 * Math.sin(TAU * tremble.rate * elapsed + phase) +
        0.4 * Math.sin(TAU * tremble.rate * 1.37 * elapsed + phase * 2.1);
      pose.head[2]! += shake * tremor(0);
      pose.head[0]! += shake * 0.6 * tremor(1.3);
      pose.rightArm[2]! += shake * 1.5 * tremor(2.1);
      pose.leftArm[2]! += shake * 1.5 * tremor(3.7);
      pose.rightLeg[0]! += shake * tremor(4.2);
      pose.leftLeg[0]! += shake * tremor(5.9);

      pose.breath =
        lerp(pose.breath, 1 + pant.depth * Math.sin(TAU * pant.rate * elapsed), terror) -
        jolt.squash * flung;
      pose.wide = 1 + FEAR.wide * terror + FEAR.panic.wide * panic;
      pose.lids = Math.max(
        pose.lids,
        remapClamp(fear.startle, flinch.squeeze, flinch.squeeze + 0.2, 0, 1)
      );
      blinking.pace = 1 + (FEAR.blinkPace - 1) * terror;
    });
}

/** How shut the eyes are, `time` seconds into a blink. */
function lidsAt(time: number): number {
  const { close, hold, open } = BLINK;

  if (time < close) return easing.cubicIn(time / close);
  if (time < close + hold) return 1;

  return 1 - easing.cubicOut(Math.min((time - close - hold) / open, 1));
}

/** Start each blink when it is due or when the head glances, play it through, and dip the head with it. */
export function blinkEyes(world: World): void {
  const { delta } = world.get(Time)!;

  if (delta === 0) return;

  const { close, hold, open, interval, double, doubleGap, glance, rest, nod } = BLINK;

  world.query(Blinking, Pose).updateEach(([blinking, pose]) => {
    const draw = () => mulberry32.sample(blinking.random);
    const turning = Math.abs(pose.head[1]! - blinking.turn) / delta;
    blinking.turn = pose.head[1]!;
    blinking.wait -= delta;

    if (blinking.since < 0) {
      blinking.idle += delta;

      if (blinking.wait <= 0 || (turning > glance && blinking.idle > rest)) {
        // A blink after a rest may be the first of two. The second never is.
        blinking.again = blinking.idle > rest && draw() < double;
        blinking.since = 0;
        blinking.wait = random.float(draw, interval[0], interval[1]) / blinking.pace;
      }
    }

    if (blinking.since >= 0) {
      blinking.since += delta;

      if (blinking.since >= close + hold + open) {
        blinking.since = -1;
        blinking.idle = 0;

        if (blinking.again) blinking.wait = doubleGap;
      }
    }

    const lids = blinking.since < 0 ? 0 : lidsAt(blinking.since);
    pose.lids = Math.max(pose.lids, lids);
    pose.head[0]! -= nod * lids;
  });
}

/** Swing each leaf against its head's turning, on a loose spring. Its tip only ever lifts off the head. */
export function swayLeaves(world: World): void {
  const { delta } = world.get(Time)!;

  if (delta === 0) return;

  const { rest, lag, reach, stiffness, damping } = LEAF_SWAY;

  world.query(Pose, LeafSway).updateEach(([pose, sway]) => {
    const { angle, velocity, head } = sway;

    // The head has no last frame to turn from until the spring has seen it once.
    if (!sway.primed) {
      vec3.copy(head, pose.head);
      sway.primed = true;
    }

    for (let axis = 0; axis < 3; axis++) {
      const trail = (lag[axis]! * (pose.head[axis]! - head[axis]!)) / delta;
      const target = rest[axis]! - clamp(trail, -reach[axis]!, reach[axis]!);
      velocity[axis]! += (stiffness * (target - angle[axis]!) - damping * velocity[axis]!) * delta;
      angle[axis]! += velocity[axis]! * delta;
      head[axis] = pose.head[axis]!;
      pose.leaf[axis] = angle[axis]!;
    }

    pose.leaf[2] = Math.max(pose.leaf[2]!, 0);
  });
}

/**
 * Turn the mounted joints to the pose, stretching the torso as it breathes, lifting the head with it or sinking it
 * into the shoulders, and opening, widening, and shutting the eyes.
 */
export function syncWumpusRig(world: World): void {
  world.query(Pose, WumpusRig).readEach(([pose, rig]) => {
    const { joints, leaf, neck } = rig!;
    const girth = 1 / Math.sqrt(pose.breath);

    joints.torso.scale.set(girth, pose.breath, girth);
    joints.head.position.set(
      neck.x,
      neck.y + (pose.breath - 1) * 0.54 - FEAR.duckDepth * pose.duck,
      neck.z
    );
    joints.head.rotation.fromArray(pose.head);
    joints.leftEye.scale.set(
      pose.wide * (1 + BLINK.spread * pose.lids),
      pose.wide * (1 - BLINK.shut * pose.lids),
      pose.wide
    );
    joints.rightEye.scale.copy(joints.leftEye.scale);
    joints.leftArm.rotation.fromArray(pose.leftArm);
    joints.rightArm.rotation.fromArray(pose.rightArm);
    joints.leftLeg.rotation.fromArray(pose.leftLeg);
    joints.rightLeg.rotation.fromArray(pose.rightLeg);
    leaf.rotation.fromArray(pose.leaf);
  });
}
