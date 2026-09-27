import { type Camera, type NodeFrame, type Object3D, PassNode, type Scene } from 'three/webgpu';
import { backdropCamera, holeUniforms } from './materials';

/** During lensing, draw only the opaque foreground. The backdrop supplies the sky and additive effects. */
export class ShotPass extends PassNode {
  private warmed = false;

  constructor(scene: Scene, camera: Camera) {
    // Keep resolved color and multisampled depth for lensing, discarding the unused color samples.
    super(PassNode.COLOR, scene, camera, { samples: 4, storeMultisampledColorBuffer: false });
    this.name = 'shot';
  }

  override updateBefore(frame: NodeFrame): undefined {
    if (this.warmed && holeUniforms.uInside.value > 0.5) return;

    const scene = this.scene as Scene;
    const background = scene.background;
    const backgroundNode = scene.backgroundNode;
    const renderer = frame.renderer!;
    const clearAlpha = renderer.getClearAlpha();
    const lensing = holeUniforms.uHoleRadius.value > 1e-4;
    this.transparent = !lensing;

    try {
      if (lensing) {
        scene.background = null;
        scene.backgroundNode = null;
        // Resolved alpha carries the foreground's MSAA coverage into the lensing composite.
        renderer.setClearAlpha(0);
      }

      super.updateBefore(frame);
    } finally {
      scene.background = background;
      scene.backgroundNode = backgroundNode;
      renderer.setClearAlpha(clearAlpha);
    }

    this.warmed = true;
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
