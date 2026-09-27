import {
  abs,
  color,
  float,
  fract,
  fwidth,
  max,
  min,
  mix,
  mx_noise_float,
  normalGeometry,
  output,
  positionGeometry,
  positionLocal,
  remapClamp,
  smoothstep,
  vec4,
} from 'three/tsl';
import {
  DoubleSide,
  type MeshStandardMaterial,
  SRGBColorSpace,
  MeshPhysicalNodeMaterial,
  MeshSSSNodeMaterial,
  MeshStandardNodeMaterial,
} from 'three/webgpu';
import { redshifted, tidal } from '../black-hole/materials';
import { LEAF, REPAINT } from './content';

/**
 * A living leaf in place of the model's glossy lime one. The veins are drawn from the leaf's own shape: a midrib
 * down its middle and lateral veins sweeping from it toward the tip. The top is waxy and the underside is pale and
 * matte. Light behind the leaf shines through the blade but not through the thicker veins, which show dark
 * against it, the way a leaf held up to the sun does. However hard the fire lights it, it never blooms.
 */
export function leafMaterial(): MeshSSSNodeMaterial {
  const material = new MeshSSSNodeMaterial({ side: DoubleSide });
  material.name = 'wumpus-leaf';
  material.positionNode = tidal(positionLocal);
  const peak = max(max(output.r, output.g), output.b).max(1e-4);
  material.outputNode = redshifted(
    vec4(output.rgb.mul(min(peak, LEAF.brightest).div(peak)), output.a)
  );

  const x = positionGeometry.x;
  const across = abs(positionGeometry.z);
  const along = remapClamp(x, LEAF.base, LEAF.tip, 0, 1);
  const inside = smoothstep(LEAF.margin * 0.55, LEAF.margin, across).oneMinus();

  // The midrib is thickest at the stem and thins out toward the tip.
  const midrib = smoothstep(0.012, along.oneMinus().mul(0.035).add(0.012), across).oneMinus();
  // Lateral veins leave the midrib angled toward the tip and curve further forward as they near the margin. Each is
  // antialiased to its width on screen, and fades before the margin.
  const sweep = x.sub(across.mul(1.2)).sub(across.mul(across).mul(1.1)).mul(LEAF.veinsPerUnit);
  const gap = min(fract(sweep), fract(sweep).oneMinus());
  const lateral = smoothstep(0.03, fwidth(sweep).add(0.09), gap).oneMinus().mul(inside).mul(0.4);
  const veins = max(midrib, lateral);

  // Broad patches of variation, so the blade is not one flat green.
  const mottle = mx_noise_float(positionGeometry.mul(2.5)).mul(0.12).add(1);
  const blade = mix(
    color(LEAF.deep),
    color(LEAF.blade),
    inside.mul(0.7).add(along.oneMinus().mul(0.3))
  );
  const top = mix(blade.mul(mottle), color(LEAF.vein), veins.mul(0.6));
  const under = mix(color(LEAF.under).mul(mottle), color(LEAF.vein), veins.mul(0.2));
  const upward = smoothstep(-0.3, 0.3, normalGeometry.y);

  material.colorNode = mix(under, top, upward);
  material.roughnessNode = mix(float(0.75), float(0.5), upward).add(veins.mul(0.1));
  material.metalnessNode = float(0);
  // The waxy cuticle: a broad, soft sheet of highlight over the top, none underneath.
  material.clearcoatNode = upward.mul(0.5);
  material.clearcoatRoughnessNode = float(0.45);

  material.thicknessColorNode = color(LEAF.glow).mul(veins.mul(0.75).oneMinus());
  material.thicknessDistortionNode = float(0.3);
  material.thicknessAmbientNode = float(0);
  material.thicknessAttenuationNode = float(0.5);
  material.thicknessPowerNode = float(3);
  material.thicknessScaleNode = float(LEAF.through);

  return material;
}

/**
 * Wet, glossy eyes in place of the model's matte ones: the same dark colour under a clear coat that catches a
 * sharp glint of the key light, which is what makes an eye look alive, and what a blink hides for a moment.
 */
export function eyeMaterial(original: MeshStandardMaterial): MeshPhysicalNodeMaterial {
  const material = new MeshPhysicalNodeMaterial({
    color: original.color,
    side: original.side,
    roughness: 0.3,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
  });
  material.name = 'wumpus-eye';
  material.positionNode = tidal(positionLocal);
  material.outputNode = redshifted(output);

  return material;
}

/**
 * One of the model's own materials, repainted into the frame's palette and able to be spaghettified: its body, its
 * snout, and the black shells that outline them all stretch with the tide together, and redden and dim into the
 * hole together.
 */
export function stretchable(original: MeshStandardMaterial): MeshStandardNodeMaterial {
  const hsl = original.color.getHSL({ h: 0, s: 0, l: 0 }, SRGBColorSpace);
  const material = new MeshStandardNodeMaterial({
    color: original.color
      .clone()
      .setHSL(hsl.h, hsl.s * REPAINT.saturation, hsl.l * REPAINT.lightness, SRGBColorSpace),
    roughness: original.roughness,
    metalness: original.metalness,
    side: original.side,
  });
  material.name = `wumpus-${original.name}`;
  material.positionNode = tidal(positionLocal);
  material.outputNode = redshifted(output);

  return material;
}
