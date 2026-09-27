import { trait } from 'koota';
import { quat, vec3, type Quat, type Vec3 } from 'math';
import type { Object3D } from 'three/webgpu';

/** Where an entity is in the world. Systems write it; views only copy it out. */
export const Transform = trait({
  position: (): Vec3 => vec3.create(),
  rotation: (): Quat => quat.create(),
  scale: 1,
});

/**
 * A springy displacement from where a body is, which a knock kicks and which settles back to nothing. It moves only
 * what is shown, never the body itself, so however many knocks land the body keeps its course.
 */
export const Offset = trait({
  position: (): Vec3 => vec3.create(),
  velocity: (): Vec3 => vec3.create(),
});

/** The scene object that displays an entity's transform, mounted by the entity's renderer. */
export const TransformView = trait((): Object3D | undefined => undefined);
