import { trait } from 'koota';
import { vec3, type Vec3 } from 'math';

/** How fast a body coasts, in world units per second. Nothing slows it: in zero g, only a pull changes it. */
export const Velocity = trait((): Vec3 => vec3.create());

/**
 * A slack line back to an anchor, pulling harder the further the body strays along each axis. It has no damping, so
 * instead of settling a coasting body swings through the anchor in slow loops that keep it in the frame.
 */
export const Tether = trait({
  anchor: (): Vec3 => vec3.create(),
  /** Pull per unit of distance along each axis, per second squared. */
  stiffness: (): Vec3 => vec3.create(),
});

/**
 * A free body's spin. Its angular momentum stays fixed in the world, since nothing twists it, but the axis it
 * turns about moves through the body as the body turns, because it is harder to turn about some of its axes than
 * others. That is the slow wobble of anything tumbling in orbit.
 */
export const Spin = trait({
  /** Angular momentum in world space, per unit of mass. */
  momentum: (): Vec3 => vec3.create(),
  /** Resistance to turning about each of the body's own axes, per unit of mass. */
  inertia: (): Vec3 => vec3.fromValues(1, 1, 1),
  /** The angular velocity this frame, in radians per second in world space, derived from the two above. */
  velocity: (): Vec3 => vec3.create(),
});
