import {
  type Camera,
  Layers,
  type NodeBuilder,
  type NodeFrame,
  type Object3D,
  PassNode,
} from 'three/webgpu';
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
  private empty = false;
  private readonly hasForeground: () => boolean;

  constructor(scene: Object3D, camera: Camera, hasForeground: () => boolean) {
    super(scene, camera, 'shot', { samples: 4, storeMultisampledColorBuffer: false });
    this.hasForeground = hasForeground;
  }

  override updateBefore(frame: NodeFrame): undefined {
    if (this.warmed && holeUniforms.uInside.value > 0.5) return;

    this.transparent = holeUniforms.uHoleRadius.value <= 1e-4;
    const empty = !this.transparent && !this.hasForeground();
    // Clear the vanished foreground once, then reuse its empty colour and depth throughout the fall.
    if (empty && this.empty) return;
    super.updateBefore(frame);
    this.empty = empty;
    this.warmed = true;
  }
}

/**
 * Blasts are drawn at half resolution before lensing. The lens samples their cached fields directly once the hole
 * opens, so this rests, and says whether it drew them this frame.
 */
export class BlastPass extends SkylessPass {
  readonly drawn = uniform(0);
  private readonly hasBlasts: () => boolean;

  constructor(scene: Object3D, camera: Camera, hasBlasts: () => boolean) {
    super(scene, camera, 'blast', { samples: 0, depthBuffer: false });
    this.hasBlasts = hasBlasts;
    const layers = new Layers();
    layers.set(BLAST_LAYER);
    this.setLayers(layers);
    this.setResolutionScale(0.5);
  }

  override updateBefore(frame: NodeFrame): undefined {
    const lensing = holeUniforms.uHoleRadius.value > 1e-4;
    const draw = !lensing && this.hasBlasts();
    this.drawn.value = draw ? 1 : 0;

    if (draw) super.updateBefore(frame);
  }
}

/** Render the lens's source once to warm it up, then only while escaped rays can see it. */
export class BackdropPass extends PassNode {
  private warmed = false;

  constructor(scene: Object3D, options: ConstructorParameters<typeof PassNode>[3] = {}) {
    super(PassNode.COLOR, scene, backdropCamera, { ...options, samples: 0, depthBuffer: false });
    this.name = 'black-hole-backdrop';
    this.setResolutionScale(0.5);
  }

  override setup(builder: NodeBuilder) {
    const output = super.setup(builder);
    // PassNode defaults to the renderer's output type, even when its target has an explicit type.
    if (this.options.type !== undefined) this.renderTarget.texture.type = this.options.type;
    return output;
  }

  override updateBefore(frame: NodeFrame): undefined {
    const { uHoleRadius, uInside } = holeUniforms;

    if (this.warmed && (uHoleRadius.value <= 1e-4 || uInside.value > 0.5)) return;

    super.updateBefore(frame);
    this.warmed = true;
  }
}
