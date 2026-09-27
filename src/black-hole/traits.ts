import { trait } from 'koota';
import { vec3, type Vec3 } from 'math';
import type { PerspectiveCamera } from 'three/webgpu';

/**
 * A black hole, `age` seconds since it formed. What the rest of the scene reads: how wide its shadow is, in world
 * units. How far it has grown from a pinprick, 0 to 1. How hard it pulls, 0 to 1, a little over while it gulps. How
 * far it has dragged space round with it, in radians. The age at which it last swallowed something.
 */
export const BlackHole = trait({
  age: 0,
  horizon: 0,
  presence: 0,
  pull: 0,
  swirl: 0,
  fedAt: Number.NEGATIVE_INFINITY,
});

/** How close doom feels, from 0, a battle like any other, to 1, the end. The whole scene answers it. */
export const Dread = trait({ level: 0 });

/**
 * A body being drawn into a hole at `centre`: where it was, as an offset from the centre, when it was caught, and
 * how fast it was flying. Seconds since then, and how hard the tide is stretching it now.
 */
export const Captured = trait({
  centre: (): Vec3 => vec3.create(),
  from: (): Vec3 => vec3.create(),
  drift: (): Vec3 => vec3.create(),
  age: 0,
  tide: 0,
  /** Length multiplier shared by the deformation and camera framing. */
  stretch: 1,
});

/** Marks a body the hole has swallowed. */
export const Swallowed = trait();

export interface BlackHoleDraw {
  camera: PerspectiveCamera;
}

/** The camera the hole is seen through. */
export const BlackHoleView = trait((): BlackHoleDraw | undefined => undefined);
