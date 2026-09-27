import { type Camera, type NodeFrame, type Object3D, PassNode } from 'three/webgpu';
import { backdropCamera, holeUniforms } from './materials';

/** Keep the scene ready for replay, but stop rendering it while the horizon hides it completely. */
export class ShotPass extends PassNode {
  private warmed = false;

  constructor(scene: Object3D, camera: Camera) {
    super(PassNode.COLOR, scene, camera, { samples: 4 });
    this.name = 'shot';
  }

  override updateBefore(frame: NodeFrame): undefined {
    if (this.warmed && holeUniforms.uInside.value > 0.5) return;

    super.updateBefore(frame);
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
