import BloomNode from 'three/addons/tsl/display/BloomNode.js';
import { type Node, type NodeFrame, type Renderer, type RenderTarget } from 'three/webgpu';
import { BLOOM } from './materials';
import { hdrTarget } from './targets';

/** Keep Three's Gaussian bloom and target reuse, storing only its nonnegative HDR colour. */
class ColorBloom extends BloomNode {
  // Three does not expose target options through BloomNode's constructor.
  declare _renderTargetBright: RenderTarget;
  declare _renderTargetsHorizontal: RenderTarget[];
  declare _renderTargetsVertical: RenderTarget[];

  private dark = false;
  private readonly isDark: () => boolean;

  constructor(input: Node, renderer: Renderer, isDark: () => boolean) {
    super(input, BLOOM.strength, BLOOM.radius, BLOOM.threshold);
    this.isDark = isDark;
    const { format, type } = hdrTarget(renderer);
    for (const target of [
      this._renderTargetBright,
      ...this._renderTargetsHorizontal,
      ...this._renderTargetsVertical,
    ]) {
      target.texture.format = format;
      target.texture.type = type;
    }
    // Half resolution keeps thin lasers from aliasing into dashes.
    this.setResolutionScale(0.5);
  }

  override updateBefore(frame: NodeFrame): undefined {
    const dark = this.isDark();
    // Render the first black frame to clear the glow, then leave the twelve passes idle until light returns.
    if (dark && this.dark) return;
    super.updateBefore(frame);
    this.dark = dark;
  }
}

export function bloom(input: Node, renderer: Renderer, isDark: () => boolean) {
  return new ColorBloom(input, renderer, isDark);
}
