import type { World } from 'koota';
import { Time } from '../time/traits';
import { KNOCK } from './content';
import { Offset, Transform, TransformView } from './traits';

/** Spring each knocked body's offset back home, in small enough steps to stay stable through a long frame. */
export function settleOffsets(world: World): void {
  const { delta } = world.get(Time)!;
  const steps = Math.ceil(delta * 240);
  const step = delta / steps;

  world.query(Offset).updateEach(([offset]) => {
    const { position, velocity } = offset;

    for (let index = 0; index < steps; index++) {
      for (let axis = 0; axis < 3; axis++) {
        velocity[axis]! +=
          (-KNOCK.stiffness * position[axis]! - KNOCK.damping * velocity[axis]!) * step;
        position[axis]! += velocity[axis]! * step;
      }
    }
  });
}

/** Copy each entity's transform onto the scene object that displays it, displaced by its offset if it has one. */
export function syncTransformViews(world: World): void {
  world.query(Transform, TransformView).readEach(([transform, view]) => {
    view!.position.fromArray(transform.position);
    view!.quaternion.fromArray(transform.rotation);
    view!.scale.setScalar(transform.scale);
  });

  world.query(Offset, TransformView).readEach(([offset, view]) => {
    view!.position.x += offset.position[0];
    view!.position.y += offset.position[1];
    view!.position.z += offset.position[2];
  });
}
