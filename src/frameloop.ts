import { useFrame } from '@react-three/fiber/webgpu';
import { useWorld } from 'koota/react';
import {
  advanceBolts,
  ageBlasts,
  ageFlares,
  flyShells,
  syncBattleView,
  wageBattle,
} from './battle/systems';
import { advanceHoles, drawIn, measureDread, syncBlackHoleView } from './black-hole/systems';
import { useReplayKey } from './director/hooks';
import {
  ageInsert,
  drawCurtain,
  frameShot,
  syncCurtainView,
  syncInsertView,
  syncShotView,
} from './director/systems';
import { advanceSequence } from './sequence/systems';
import { moveBodies, pullTethers, tumbleBodies } from './motion/systems';
import { listenForSounds, playSounds } from './sound/systems';
import { updateTime } from './time/systems';
import { useViewport } from './viewport/hooks';
import { FRAME_RATE } from './viewport/content';
import { settleOffsets, syncTransformViews } from './transform/systems';
import {
  blinkEyes,
  performFear,
  performFloating,
  senseThreats,
  swayLeaves,
  syncWumpusRig,
} from './wumpus/systems';

/** The world's systems, in order: the simulation first, then the views that show it, before the frame renders. */
export function FrameLoop() {
  const world = useWorld();
  useViewport(world);
  useReplayKey(world);

  useFrame(
    (_, delta) => {
      updateTime(world, delta);
      advanceSequence(world);
      wageBattle(world);
      flyShells(world);
      advanceBolts(world);
      ageFlares(world);
      ageBlasts(world);
      pullTethers(world);
      moveBodies(world);
      tumbleBodies(world);
      measureDread(world);
      advanceHoles(world);
      drawIn(world);
      performFloating(world);
      senseThreats(world);
      performFear(world);
      settleOffsets(world);
      blinkEyes(world);
      swayLeaves(world);
      drawCurtain(world);
      ageInsert(world);
      frameShot(world);
      listenForSounds(world);
    },
    { id: 'simulation', phase: 'physics', fps: FRAME_RATE }
  );

  useFrame(
    () => {
      syncTransformViews(world);
      syncWumpusRig(world);
      syncBattleView(world);
      syncShotView(world);
      syncBlackHoleView(world);
      syncCurtainView(world);
      syncInsertView(world);
      playSounds(world);
    },
    { id: 'views', phase: 'update', fps: FRAME_RATE }
  );

  return null;
}
