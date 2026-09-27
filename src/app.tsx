import '@fontsource-variable/geist';
import './styles.css';

import { Canvas, useRenderPipeline } from '@react-three/fiber/webgpu';
import { WorldProvider } from 'koota/react';
import { Suspense } from 'react';
import { convertToTexture, renderOutput, vec4 } from 'three/tsl';
import { NeutralToneMapping } from 'three/webgpu';
import { overBlast } from './battle/materials';
import { BattleRenderer } from './battle/renderer';
import { BattleView } from './battle/traits';
import { dreadGrade, holeUniforms, lensing, throughHole } from './black-hole/materials';
import { BackdropPass, BlastPass, ShotPass } from './black-hole/pass';
import { BlackHoleRenderer } from './black-hole/renderer';
import { overInsert } from './director/materials';
import { ShotRenderer, StartButton } from './director/renderer';
import { FrameLoop } from './frameloop';
import { bloom } from './post/bloom';
import { dither, grain, uCurtain, vignette } from './post/materials';
import { hdrTarget } from './post/targets';
import { SoundRenderer } from './sound/renderer';
import { TransformView } from './transform/traits';
import { CAMERA, FRAME_RATE } from './viewport/content';
import { underSky } from './void/materials';
import { Void } from './void/renderer';
import { world } from './world';
import { WumpusRenderer } from './wumpus/renderer';
import { Wumpus } from './wumpus/traits';

export function App() {
  return (
    <WorldProvider world={world}>
      <Canvas
        camera={{
          far: CAMERA.far,
          fov: CAMERA.fov,
          near: CAMERA.near,
          position: [...CAMERA.position],
        }}
        dpr={[1, matchMedia('(pointer: coarse)').matches ? 1.5 : 2]}
        renderer={{
          toneMapping: NeutralToneMapping,
          toneMappingExposure: 1,
          scheduler: { fps: FRAME_RATE },
        }}
      >
        <Suspense fallback={null}>
          <FrameLoop />
          <Scene />
        </Suspense>
      </Canvas>
      <SoundRenderer />
      <StartButton />
    </WorldProvider>
  );
}

/** The scene: every domain's renderer, composed through the post pass. */
function Scene() {
  return (
    <>
      <ShotRenderer />
      <Void />
      <WumpusRenderer />
      <BattleRenderer />
      <BlackHoleRenderer />
      <Post />
    </>
  );
}

/**
 * Trace the frame through the black hole, bending a backdrop drawn without the wumpus and laying the wumpus back
 * over it, bloom whatever is brighter than white, grade it for doom, vignette it and
 * close the curtain over it, then tone map and encode it, lay the insert over it, and grain and dither it, so both
 * land on the display's steps. The glow blooms from where light lands once bent, so nothing blooms where the hole
 * has swallowed it.
 */
function Post() {
  useRenderPipeline(({ renderPipeline, renderer, scene, camera }) => {
    const shot = new ShotPass(scene, camera, () =>
      Boolean(world.queryFirst(Wumpus, TransformView)?.get(TransformView)?.visible)
    );
    const blast = new BlastPass(scene, camera, () => (world.get(BattleView)?.blasts.count ?? 0) > 0);
    const frame = shot.getTextureNode('output');
    const unbent = overBlast(
      underSky(frame, lensing),
      blast.getTextureNode('output'),
      blast.drawn,
      frame,
      shot.getViewZNode().negate()
    );
    const backdrop = new BackdropPass(scene, hdrTarget(renderer));
    const bent = convertToTexture(
      throughHole(
        vec4(unbent, frame.a),
        shot.getTextureNode('depth'),
        backdrop.getTextureNode('output')
      ),
      null,
      null,
      hdrTarget(renderer)
    );
    const glow = bloom(bent, renderer, () => holeUniforms.uInside.value > 0.5);
    const framed = vec4(dreadGrade(bent.add(glow).rgb).mul(vignette).mul(uCurtain.oneMinus()), 1);
    const shown = overInsert(renderOutput(framed).rgb);
    renderPipeline.outputColorTransform = false;
    renderPipeline.outputNode = vec4(shown.add(grain(shown)).add(dither), 1);
  });

  return null;
}
