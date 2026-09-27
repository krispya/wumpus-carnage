import { type NodeFrame, type Object3D, PassNode } from 'three/webgpu';
import { backdropCamera, holeUniforms } from './materials';

/** Render the lens's source once to warm it up, then only while escaped rays can see it. */
export class BackdropPass extends PassNode {
  private warmed = false;

  constructor(scene: Object3D) {
    super(PassNode.COLOR, scene, backdropCamera, { samples: 0 });
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
