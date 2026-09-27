import '@fontsource-variable/geist';
import './styles.css';

import { Canvas, useRenderPipeline } from '@react-three/fiber/webgpu';
import { WorldProvider } from 'koota/react';
import { Suspense } from 'react';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { convertToTexture, renderOutput, vec4 } from 'three/tsl';
import { NeutralToneMapping } from 'three/webgpu';
import { BattleRenderer } from './battle/renderer';
import { dreadGrade, throughHole } from './black-hole/materials';
import { BackdropPass, ShotPass } from './black-hole/pass';
import { BlackHoleRenderer } from './black-hole/renderer';
import { overInsert } from './director/materials';
import { ShotRenderer, StartButton } from './director/renderer';
import { FrameLoop } from './frameloop';
import { BLOOM, dither, grain, uCurtain, vignette } from './post/materials';
import { SoundRenderer } from './sound/renderer';
import { CAMERA } from './viewport/content';
import { Void } from './void/renderer';
import { world } from './world';
import { WumpusRenderer } from './wumpus/renderer';

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
        renderer={{ toneMapping: NeutralToneMapping, toneMappingExposure: 1 }}
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
  useRenderPipeline(({ renderPipeline, scene, camera }) => {
    const shot = new ShotPass(scene, camera);
    const backdrop = new BackdropPass(scene);
    const bent = convertToTexture(
      throughHole(
        shot.getTextureNode('output'),
        shot.getTextureNode('depth'),
        backdrop.getTextureNode('output')
      ),
      null,
      null,
      { depthBuffer: false }
    );
    const glow = bloom(bent, BLOOM.strength, BLOOM.radius, BLOOM.threshold);
    // Half the frame's resolution carries a glow. Any less and thin lasers alias into dashes under it.
    glow.setResolutionScale(0.5);
    const framed = vec4(dreadGrade(bent.add(glow).rgb).mul(vignette).mul(uCurtain.oneMinus()), 1);
    const shown = overInsert(renderOutput(framed).rgb);
    renderPipeline.outputColorTransform = false;
    renderPipeline.outputNode = vec4(shown.add(grain(shown)).add(dither), 1);
  });

  return null;
}
