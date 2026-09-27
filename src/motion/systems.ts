import type { World } from 'koota';
import { quat, vec3 } from 'math';
import { Time } from '../time/traits';
import { Transform } from '../transform/traits';
import { Spin, Tether, Velocity } from './traits';

/** Accelerate each tethered body back toward its anchor. */
export function pullTethers(world: World): void {
  const { delta } = world.get(Time)!;

  world.query(Tether, Velocity, Transform).updateEach(([tether, velocity, transform]) => {
    for (let axis = 0; axis < 3; axis++) {
      velocity[axis]! -=
        tether.stiffness[axis]! * (transform.position[axis]! - tether.anchor[axis]!) * delta;
    }
  });
}

/** Coast each body along its velocity. */
export function moveBodies(world: World): void {
  const { delta } = world.get(Time)!;

  world.query(Velocity, Transform).updateEach(([velocity, transform]) => {
    vec3.scaleAndAdd(transform.position, transform.position, velocity, delta);
  });
}

const inverse = quat.create();
const local = vec3.create();
const axis = vec3.create();
const step = quat.create();

/**
 * Turn each spinning body through this frame's angle. Its angular velocity comes from its fixed momentum, carried
 * into the body's own frame, divided by the inertia about each of its axes, and carried back out.
 */
export function tumbleBodies(world: World): void {
  const { delta } = world.get(Time)!;

  world.query(Spin, Transform).updateEach(([spin, transform]) => {
    const { rotation } = transform;
    quat.conjugate(inverse, rotation);
    vec3.transformQuat(local, spin.momentum, inverse);
    vec3.divide(local, local, spin.inertia);
    vec3.transformQuat(spin.velocity, local, rotation);

    const speed = vec3.length(spin.velocity);

    if (speed === 0) return;

    vec3.scale(axis, spin.velocity, 1 / speed);
    quat.setAxisAngle(step, axis, speed * delta);
    quat.multiply(rotation, step, rotation);
    quat.normalize(rotation, rotation);
  });
}
