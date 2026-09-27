import { createActions, type Entity } from 'koota';
import { vec3, type Vec3 } from 'math';
import { simplex3d } from 'math/noise';
import { mulberry32 } from 'math/random';
import { Spin, Tether, Velocity } from '../motion/traits';
import { Offset, Transform } from '../transform/traits';
import { BLINK, FEAR, FLOAT_PERFORMANCE, LEAF_SWAY, WUMPUS_FLOAT } from './content';
import {
  Blinking,
  Fear,
  Floating,
  LeafSway,
  Pose,
  Wumpus,
  WumpusRig,
  type WumpusRigDraw,
} from './traits';

export const wumpusActions = createActions((world) => ({
  spawnWumpus: () => {
    const { start, velocity, stiffness, inertia, momentum } = WUMPUS_FLOAT;

    return world.spawn(
      Wumpus,
      Transform({ position: [...start] }),
      Offset,
      Velocity([...velocity]),
      Tether({ stiffness: [...stiffness] }),
      Spin({ momentum: [...momentum], inertia: [...inertia] }),
      Pose({ leaf: [...LEAF_SWAY.rest] }),
      Floating({ noise: simplex3d.create(FLOAT_PERFORMANCE.seed) }),
      LeafSway({ angle: [...LEAF_SWAY.rest] }),
      Blinking({ wait: BLINK.interval[0], random: mulberry32.create(BLINK.seed) }),
      Fear({ level: FEAR.level, random: mulberry32.create(FEAR.seed) })
    );
  },
  mountWumpusRig: (entity: Entity, rig: WumpusRigDraw) => {
    entity.add(WumpusRig(rig));
  },
  unmountWumpusRig: (entity: Entity) => {
    entity.remove(WumpusRig);
  },
  /**
   * The wumpus is flung away by a blast: cut loose from its tether, it flies off along `velocity` and tumbles with
   * `momentum`, and nothing slows it.
   */
  ejectWumpus: (velocity: Vec3, momentum: Vec3) => {
    world.query(Wumpus).forEach((entity) => {
      entity.remove(Tether);
      entity.set(Velocity, vec3.clone(velocity));
      entity.set(Spin, { ...entity.get(Spin)!, momentum: vec3.clone(momentum) });

      // It is terrified: the blast jolts it and squeezes its eyes shut, and it flails as it tumbles away.
      const fear = entity.get(Fear)!;
      entity.set(Fear, { ...fear, startle: 1, joltSpeed: fear.joltSpeed + FEAR.jolt.kick });
    });
  },
  /** How frightened the wumpus is at rest, from 0, calm, to 1, cowering. */
  setFear: (level: number) => {
    world.query(Fear).updateEach(([fear]) => {
      fear.level = level;
    });
  },
}));
