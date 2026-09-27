import { trait } from 'koota';
import { vec2, vec3, type Vec2, type Vec3 } from 'math';
import { simplex3d } from 'math/noise';
import { mulberry32 } from 'math/random';
import type { Object3D, Vector3 } from 'three/webgpu';
import type { Joint } from './content';

/** Marks the entities drawn as the wumpus. */
export const Wumpus = trait();

/**
 * How the wumpus holds itself this frame: each joint's turn from its rest pose, in radians about the model's own
 * x, y and z. How far the head has sunk into the shoulders, from 0 to 1. How far the torso has breathed in, as its
 * height over its rest height. How shut its eyes are, from 0, open, to 1, shut, and how wide, as a multiple of
 * their rest size, and the leaf's turn about its stem.
 */
export const Pose = trait({
  head: (): Vec3 => vec3.create(),
  leftArm: (): Vec3 => vec3.create(),
  rightArm: (): Vec3 => vec3.create(),
  leftLeg: (): Vec3 => vec3.create(),
  rightLeg: (): Vec3 => vec3.create(),
  duck: 0,
  breath: 1,
  lids: 0,
  wide: 1,
  leaf: (): Vec3 => vec3.create(),
});

/**
 * When the eyes blink: seconds until the next blink is due. Seconds into the current blink, or -1 between blinks,
 * seconds since the last blink ended. Whether another follows this one. The head's turn last frame, to feel for a
 * glance. How much more often than usual it blinks, and the random sequence the intervals are drawn from.
 */
export const Blinking = trait({
  wait: 0,
  since: -1,
  idle: 0,
  again: false,
  turn: 0,
  pace: 1,
  random: (): mulberry32.Mulberry32 => mulberry32.create(0),
});

/**
 * The floating performance's playback. Energy scales how far each part strays from the floating posture, from
 * 0, holding still, through 1, the default. Tempo scales its clock, which runs on its own so that changing the
 * tempo never jumps the performance.
 */
export const Floating = trait({
  energy: 1,
  tempo: 1,
  clock: 0,
  noise: (): simplex3d.Simplex3DGenerator => simplex3d.create(0),
});

/**
 * The leaf's spring: its turn and turning speed about its stem, and the head's turn last frame, which the spring
 * has yet to read before its first frame.
 */
export const LeafSway = trait({
  angle: (): Vec3 => vec3.create(),
  velocity: (): Vec3 => vec3.create(),
  head: (): Vec3 => vec3.create(),
  primed: false,
});

/**
 * How frightened the wumpus is. `level` is its standing terror, from 0, calm, to 1, cowering. `startle` is the
 * fright of the last near miss, which spikes and fades, and `jolt` is the recoil it throws the body into, on a
 * spring. A flinch is due in `flinchIn` seconds, or never at -1, at `flinchStrength`, from `flinchFrom` in the world.
 * `glance` is where the head looks, as a turn and a nod, heading for `target` until a new glance in `nextGlance`
 * seconds.
 */
export const Fear = trait({
  level: 0.85,
  startle: 0,
  jolt: 0,
  joltSpeed: 0,
  flinchIn: -1,
  flinchStrength: 0,
  flinchFrom: (): Vec3 => vec3.create(),
  glance: (): Vec2 => vec2.create(),
  glanceSpeed: (): Vec2 => vec2.create(),
  target: (): Vec2 => vec2.create(),
  nextGlance: 0,
  random: (): mulberry32.Mulberry32 => mulberry32.create(0),
});

export interface WumpusRigDraw {
  joints: Record<Joint, Object3D>;
  leaf: Object3D;
  /** Where the head joint rests, before the breath lifts it. */
  neck: Vector3;
}

/** The mounted model's joints. */
export const WumpusRig = trait((): WumpusRigDraw | undefined => undefined);
