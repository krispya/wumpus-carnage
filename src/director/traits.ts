import { trait } from 'koota';
import { vec3, type Vec3 } from 'math';
import type { PerspectiveCamera } from 'three/webgpu';
import type { ShotName } from './content';

/** Whether the animatic has been started. Until it is, the battle rages behind the button that starts it. */
export const Show = trait({ started: false });

/** How far the curtain over the frame is closed, from 0, open, to 1, black, and where it is heading. */
export const Curtain = trait({ level: 1, target: 0 });

/**
 * Where the camera is and what it looks at, in the world, how far it is rolled about that, in radians, its lens, in
 * degrees, and how fast it is falling, as a share of light's speed.
 */
export const Shot = trait({
  position: (): Vec3 => vec3.fromValues(0, 0, 16),
  target: (): Vec3 => vec3.create(),
  roll: 0,
  fov: 35,
  speed: 0,
});

/**
 * The shot the camera is on, where what it frames was when it cut there, in the world, how many seconds into the
 * shot it is, how far it has rolled with what it frames, in radians, whether what it follows is gone, and where the
 * camera was and what it looked at when it went, and whether the camera has fallen through a hole's horizon.
 */
export const Framing = trait({
  shot: 'system' as ShotName,
  anchor: (): Vec3 => vec3.create(),
  age: 0,
  turn: 0,
  lost: false,
  lostFrom: (): Vec3 => vec3.create(),
  lostAim: (): Vec3 => vec3.create(),
  through: false,
});

/** Whether the insert is on screen, and for how many seconds it has been. */
export const Insert = trait({ showing: false, age: 0 });

/** The camera the animatic is shot through. */
export const ShotView = trait((): PerspectiveCamera | undefined => undefined);
