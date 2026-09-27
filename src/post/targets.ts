import {
  HalfFloatType,
  type Renderer,
  RGBFormat,
  RGBAFormat,
  UnsignedInt101111Type,
} from 'three/webgpu';

/** HDR colour without alpha, with a half-float fallback where packed HDR is not renderable. */
export function hdrTarget(renderer: Renderer) {
  const packed = renderer.hasFeature('rg11b10ufloat-renderable');
  return {
    depthBuffer: false,
    samples: 0,
    format: packed ? RGBFormat : RGBAFormat,
    type: packed ? UnsignedInt101111Type : HalfFloatType,
  };
}
