import { type Camera, type NodeFrame, type Object3D, PassNode, type Scene } from 'three/webgpu';
import { skyUniforms } from './materials';

/**
 * A pass drawn without the sky, clear wherever the sky shows through, so the sky can be laid behind it once for each
 * pixel. It publishes the camera the sky is looked up through.
 */
export class SkylessPass extends PassNode {
  constructor(
    scene: Object3D,
    camera: Camera,
    name: string,
    options: ConstructorParameters<typeof PassNode>[3] = {}
  ) {
    super(PassNode.COLOR, scene, camera, options);
    this.name = name;
  }

  override updateBefore(frame: NodeFrame): undefined {
    const renderer = frame.renderer!;
    const scene = this.scene as Scene;
    const background = scene.background;
    const backgroundNode = scene.backgroundNode;
    const clearAlpha = renderer.getClearAlpha();
    scene.background = null;
    scene.backgroundNode = null;
    renderer.setClearAlpha(0);

    try {
      super.updateBefore(frame);
    } finally {
      renderer.setClearAlpha(clearAlpha);
      scene.background = background;
      scene.backgroundNode = backgroundNode;
    }

    skyUniforms.uSkyWorld.value.copy(this.camera.matrixWorld);
    skyUniforms.uSkyProjectionInverse.value.copy(this.camera.projectionMatrixInverse);
  }
}
