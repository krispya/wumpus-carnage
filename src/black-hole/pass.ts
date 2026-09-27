import { type Camera, Layers, type NodeFrame, type Object3D, PassNode } from 'three/webgpu';
import { uniform } from 'three/tsl';
import { BLAST_LAYER } from '../battle/content';
import { SkylessPass } from '../void/pass';
import { backdropCamera, holeUniforms } from './materials';

/**
 * The frame, multisampled and drawn without the sky, which is laid behind it after. Its colour samples are resolved
 * and let go, but its multisampled depth is kept for the lens. While the hole bends the frame it draws only the opaque
 * foreground, since the backdrop supplies the additive effects, and it stops once the horizon hides everything.
 */
export class ShotPass extends SkylessPass {
  private warmed = false;

  constructor(scene: Object3D, camera: Camera) {
    super(scene, camera, 'shot', { samples: 4, storeMultisampledColorBuffer: false });
  }

  override updateBefore(frame: NodeFrame): undefined {
    if (this.warmed && holeUniforms.uInside.value > 0.5) return;

    this.transparent = holeUniforms.uHoleRadius.value <= 1e-4;
    super.updateBefore(frame);
    this.warmed = true;
  }
}

/**
 * The blasts, drawn apart at half the frame's resolution, since they are soft fire that fills it. While the hole
 * bends the frame the backdrop carries them instead, so this rests, and says whether it drew them this frame.
 */
export class BlastPass extends SkylessPass {
  readonly drawn = uniform(0);

  constructor(scene: Object3D, camera: Camera) {
    super(scene, camera, 'blast');
    const layers = new Layers();
    layers.set(BLAST_LAYER);
    this.setLayers(layers);
    this.setResolutionScale(0.5);
  }

  override updateBefore(frame: NodeFrame): undefined {
    const lensing = holeUniforms.uHoleRadius.value > 1e-4;
    this.drawn.value = lensing ? 0 : 1;

    if (!lensing) super.updateBefore(frame);
  }
}

/** Render the lens's source once to warm it up, then only while escaped rays can see it. */
export class BackdropPass extends PassNode {
  private warmed = false;

  constructor(scene: Object3D) {
    super(PassNode.COLOR, scene, backdropCamera, { samples: 0, depthBuffer: false });
    this.name = 'black-hole-backdrop';
    this.setResolutionScale(0.5);
  }

  override updateBefore(frame: NodeFrame): undefined {
    const { uHoleRadius, uInside } = holeUniforms;

    if (this.warmed && (uHoleRadius.value <= 1e-4 || uInside.value > 0.5)) return;

    super.updateBefore(frame);
    this.warmed = true;
  }
}
