import { trait } from 'koota';
import { vec3, type Vec3 } from 'math';
import { mulberry32 } from 'math/random';
import type { InstancedBufferAttribute, InstancedMesh, PointLight } from 'three/webgpu';

/**
 * A laser shot. It flies from `from` along its heading, lighting the stretch of its path between its head, which
 * has travelled `travelled` units, and its tail, `length` units behind. A beam's length outruns its path, so once
 * its head arrives it lights all of it until it fades. A shot that impacts bursts into a flare where its path ends.
 */
export const Bolt = trait({
  from: (): Vec3 => vec3.create(),
  heading: (): Vec3 => vec3.create(),
  span: 0,
  travelled: 0,
  speed: 0,
  length: 0,
  width: 0.1,
  energy: 1,
  color: (): Vec3 => vec3.create(),
  age: 0,
  life: 1,
  beam: false,
  impact: false,
});

/** The black-hole gun's shell, flying from `from` to `to` over `flight` seconds, `age` seconds in, now at `position`. */
export const Shell = trait({
  from: (): Vec3 => vec3.create(),
  to: (): Vec3 => vec3.create(),
  position: (): Vec3 => vec3.create(),
  flight: 1,
  age: 0,
});

/** The giant explosion, `age` seconds after it went up, its fire's turbulence drawn from `seed`. */
export const Blast = trait({ position: (): Vec3 => vec3.create(), age: 0, seed: 0 });

/**
 * A burst of light where something was hit, flashing up and burning out over its life, or a burning fragment
 * drifting along `velocity`.
 */
export const Flare = trait({
  position: (): Vec3 => vec3.create(),
  velocity: (): Vec3 => vec3.create(),
  color: (): Vec3 => vec3.create(),
  radius: 0.5,
  fragment: false,
  spin: 0,
  energy: 1,
  age: 0,
  life: 1,
});

/**
 * The battle's pace: how hot it runs, as a multiple of every firing rate. The seconds until the next distant shot,
 * near shot, close call, distant flare, and shot and flare in the far reaches, and the random sequence every shot is
 * drawn from.
 */
export const Battle = trait({
  heat: 1,
  far: 0,
  near: 0,
  close: 0,
  flare: 0,
  vast: 0,
  vastFlare: 0,
  random: (): mulberry32.Mulberry32 => mulberry32.create(0),
});

export interface BattleDraw {
  bolts: InstancedMesh;
  /** Each bolt's lit stretch, from tail to head, its width, energy, and tail brightness, and its colour. */
  boltStart: InstancedBufferAttribute;
  boltEnd: InstancedBufferAttribute;
  boltShape: InstancedBufferAttribute;
  boltColor: InstancedBufferAttribute;
  flares: InstancedMesh;
  /** Each flare's centre and radius, and its colour and energy. */
  flareCentre: InstancedBufferAttribute;
  flareColor: InstancedBufferAttribute;
  /** Rotation and whether the flare is an angular piece of wreckage. */
  flareShape: InstancedBufferAttribute;
  blasts: InstancedMesh;
  /** Each blast's centre and radius, and its age, seed, and how much of its remnant is left. */
  blastCentre: InstancedBufferAttribute;
  blastState: InstancedBufferAttribute;
  /** The light a blast's fire throws on everything round it. */
  glow: PointLight;
}

/** The mounted meshes the battle is drawn with. */
export const BattleView = trait((): BattleDraw | undefined => undefined);
