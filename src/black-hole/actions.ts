import { createActions, type Entity } from 'koota';
import { vec3, type Vec3 } from 'math';
import { Spin, Tether, Velocity } from '../motion/traits';
import { Transform } from '../transform/traits';
import { CAPTURE } from './content';
import { BlackHole, BlackHoleView, Captured, Swallowed, type BlackHoleDraw } from './traits';

export const blackHoleActions = createActions((world) => ({
  /** A hole forms at `at`. */
  openHole: (at: Vec3) => {
    world.spawn(BlackHole, Transform({ position: vec3.clone(at) }));
  },
  /** The hole swallowed something: it gulps. */
  feedHole: () => {
    world.query(BlackHole).updateEach(([hole]) => {
      hole.fedAt = hole.age;
    });
  },
  /**
   * The hole takes hold of a body. It is no longer held by any tether, the way it was flying is handed to the hole
   * to brake, and it spins faster as it goes; from here the hole alone decides where it is.
   */
  captureBody: (entity: Entity) => {
    const hole = world.queryFirst(BlackHole, Transform);

    if (hole === undefined || entity.has(Captured)) return;

    const centre = hole.get(Transform)!.position;
    const position = entity.get(Transform)!.position;
    const from = vec3.subtract(vec3.create(), position, centre);
    const drift = vec3.clone(entity.get(Velocity) ?? vec3.create());

    entity.remove(Tether, Velocity);
    entity.add(Captured({ centre: vec3.clone(centre), from, drift }));

    const spin = entity.get(Spin);

    if (spin !== undefined) {
      entity.set(Spin, {
        ...spin,
        momentum: vec3.scale(vec3.create(), spin.momentum, CAPTURE.spinUp),
      });
    }
  },
  /** The hole has taken all of a body. */
  swallowBody: (entity: Entity) => {
    entity.remove(Captured);
    entity.add(Swallowed);
  },
  clearHoles: () => {
    world.query(BlackHole).forEach((entity) => entity.destroy());
  },
  mountBlackHoleView: (view: BlackHoleDraw) => {
    world.add(BlackHoleView(view));
  },
  unmountBlackHoleView: () => {
    world.remove(BlackHoleView);
  },
}));
