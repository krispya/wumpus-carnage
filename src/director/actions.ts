import { createActions } from 'koota';
import { vec3 } from 'math';
import { battleActions } from '../battle/actions';
import { blackHoleActions } from '../black-hole/actions';
import { CAPTURE } from '../black-hole/content';
import { Dread } from '../black-hole/traits';
import { sequenceActions } from '../sequence/actions';
import type { Cue } from '../sequence/traits';
import { soundActions } from '../sound/actions';
import { IMPLODE_LEAD, LEVELS, PLUNGE_FROM, WILHELM_LEAD } from '../sound/content';
import { Transform } from '../transform/traits';
import { CAMERA } from '../viewport/content';
import { wumpusActions } from '../wumpus/actions';
import { Wumpus } from '../wumpus/traits';
import type { PerspectiveCamera } from 'three/webgpu';
import {
  BEATS,
  BLAST_AT,
  EJECTED,
  EJECTION,
  FLIGHT_SHOT,
  INSERT,
  OPENING,
  SHOTS,
  type ShotName,
} from './content';
import { Curtain, Framing, Insert, Shot, ShotView, Show } from './traits';

/** Stages the scene: which actors are in it, and the order its beats play in. */
export const directorActions = createActions((world) => {
  const battle = battleActions(world);
  const hole = blackHoleActions(world);

  /** Cut to a shot, locking it off on wherever what it frames is now. */
  function cutTo(shot: ShotName): void {
    const plan = SHOTS[shot];
    const framed =
      plan.kind === 'flight' || plan.anchor === 'wumpus'
        ? world.queryFirst(Wumpus, Transform)?.get(Transform)?.position
        : undefined;
    world.set(Framing, {
      shot,
      anchor: vec3.clone(framed ?? vec3.create()),
      age: 0,
      turn: 0,
      lost: false,
      through: false,
    });
  }

  /** The animatic, beat by beat. */
  function script(): Cue[] {
    // The opening cuts from shot to shot, and then to the flight.
    const opening: Cue[] = [];
    let begun = 0;

    for (const { shot, seconds } of OPENING) {
      opening.push({ at: begun, run: () => cutTo(shot) });
      begun += seconds;
    }

    return [
      ...opening,
      {
        // A beat before it all goes wrong, the insert slams on.
        at: BEATS.detonate - INSERT.lead,
        run: () => world.set(Insert, { showing: true, age: 0 }),
      },
      {
        // A capital ship goes up. The boom reaches the camera as a deep rumble through the void, a beat late.
        at: BEATS.detonate,
        run: () => {
          battle.detonate(BLAST_AT);
          soundActions(world).cueSound('detonation', {
            gain: LEVELS.detonation,
            delay: 0.35,
            attack: 0.15,
            tone: 0.35,
            space: 0.5,
            expanse: 1,
          });
        },
      },
      {
        // Its shockwave flings the wumpus away, tumbling, with burning fragments of the ship all round it.
        at: BEATS.detonate + EJECTION.delay,
        run: () => {
          const at = world.queryFirst(Wumpus, Transform)?.get(Transform)?.position;
          wumpusActions(world).ejectWumpus(EJECTED, EJECTION.momentum);

          if (at !== undefined) battle.scatterDebris(at, EJECTED);
        },
      },
      {
        at: begun,
        run: () => {
          cutTo('flight');
          battle.setBattleHeat(BEATS.after);
        },
      },
      {
        // The blast's heart collapsing swells in ahead of the moment the hole opens, so it strikes just as it does.
        at: begun + BEATS.birth - IMPLODE_LEAD,
        run: () =>
          soundActions(world).cueSound('implode', {
            gain: LEVELS.implode,
            space: 0.4,
            expanse: 0.6,
          }),
      },
      {
        at: begun + BEATS.birth,
        run: () => {
          hole.openHole(BLAST_AT);
          battle.setBattleHeat(BEATS.hush);
        },
      },
      {
        at: begun + BEATS.capture,
        run: () => world.query(Wumpus).forEach((entity) => hole.captureBody(entity)),
      },
      {
        // The wumpus screams its last as it sinks into the horizon, and the scream rings on into the void.
        at: begun + BEATS.capture + CAPTURE.duration - WILHELM_LEAD,
        run: () =>
          soundActions(world).cueSound('wilhelm', {
            gain: LEVELS.wilhelm,
            space: 0.4,
            expanse: 0.8,
          }),
      },
      {
        // As the hole sucks the camera in, the plunge roars in near its height, climbing all the way to the horizon.
        at:
          begun + BEATS.capture + CAPTURE.duration + FLIGHT_SHOT.back.seconds + FLIGHT_SHOT.back.look,
        run: () =>
          soundActions(world).cueSound('plunge', {
            gain: LEVELS.plunge,
            space: 0.2,
            offset: PLUNGE_FROM,
            attack: 0.08,
          }),
      },
      { on: 'swallowed', run: () => hole.feedHole() },
      {
        // Past the horizon there is nothing to see or hear.
        on: 'fell-in',
        run: () => {
          world.set(Curtain, { level: 1, target: 1 });
          soundActions(world).silenceSound(true);
        },
      },
      { on: 'fell-in', after: BEATS.hold, run: () => directorActions(world).replayScene() },
    ];
  }

  return {
    /** Set the scene on the wide, the battle raging, and wait to be started. */
    initializeScene: () => {
      soundActions(world).initializeSound();
      battle.initializeBattle();
      wumpusActions(world).spawnWumpus();
    },
    /** Start the animatic, from the top. Once started it plays again and again. */
    startScene: () => {
      world.set(Show, { started: true });
      directorActions(world).replayScene();
    },
    /**
     * Play the animatic again from the top: the hole and the shell gone, a fresh wumpus, the camera back at its rest
     * and on the opening shot, the dread lifted, the sound back, and the curtain opening.
     */
    replayScene: () => {
      hole.clearHoles();
      battle.clearShells();
      battle.clearBlasts();
      battle.setBattleHeat(1);
      world.query(Wumpus).forEach((entity) => entity.destroy());
      wumpusActions(world).spawnWumpus();
      world.set(Shot, {
        position: vec3.fromValues(...CAMERA.position),
        target: vec3.create(),
        roll: 0,
        fov: CAMERA.fov,
        speed: 0,
      });
      cutTo(OPENING[0]!.shot);
      world.set(Insert, { showing: false, age: 0 });
      world.set(Dread, { level: 0 });
      soundActions(world).silenceSound(false);
      world.set(Curtain, { ...world.get(Curtain)!, target: 0 });
      sequenceActions(world).loadSequence(script());
    },
    mountShotView: (camera: PerspectiveCamera) => {
      world.add(ShotView(camera));
    },
    unmountShotView: () => {
      world.remove(ShotView);
    },
  };
});
