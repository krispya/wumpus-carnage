import {
  abs,
  cos,
  fwidth,
  Fn,
  sin,
  cameraPosition,
  cameraProjectionMatrix,
  cross,
  exp,
  instancedBufferAttribute,
  length,
  max,
  mix,
  normalize,
  positionGeometry,
  positionView,
  positionWorld,
  select,
  screenSize,
  smoothstep,
  uv,
  vec3,
  vec4,
} from 'three/tsl';
import {
  CustomBlending,
  BackSide,
  DoubleSide,
  type InstancedBufferAttribute,
  MeshBasicNodeMaterial,
  type Node,
  OneFactor,
  type TextureNode,
  ZeroFactor,
} from 'three/webgpu';
import { BOLT_CORE, SMALLEST } from './content';
import { plasmaLight } from './plasma';

/** How many world units one pixel of the frame spans at `point`, from how far it is from the camera. */
function pixelAt(point: Node<'vec3'>): Node<'float'> {
  return length(cameraPosition.sub(point))
    .mul(2)
    .div(screenSize.y.mul(cameraProjectionMatrix.mul(vec4(0, 1, 0, 0)).y));
}

/** Glowing light, added over whatever is behind it, never hiding it and never sorted. */
function glowMaterial(name: string): MeshBasicNodeMaterial {
  // Light adds to the frame's colour but never to how much of it is covered, so the sky laid behind the frame shows
  // through the glow in full. Premultiplying opacity lets the RGB-only backdrop receive the same light.
  const material = new MeshBasicNodeMaterial({
    blending: CustomBlending,
    blendSrc: OneFactor,
    premultipliedAlpha: true,
    blendDst: OneFactor,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneFactor,
    depthWrite: false,
    side: DoubleSide,
    transparent: true,
    // Billboard effects need both sides in a single draw.
    forceSinglePass: true,
  });
  material.name = name;

  return material;
}

/**
 * Laser bolts. Each is a strip stretched from its tail to its head and turned about its length to face the camera.
 * Across it, a core of the bolt's colour burning toward white sits inside a glow of it. Along it, a streaking bolt brightens
 * from its tail to its head, and both ends taper. Seen from far off a bolt is drawn no thinner than a few pixels,
 * and dims as it is widened, so the distant battle glitters rather than vanishing.
 */
export function boltMaterial(
  startAttribute: InstancedBufferAttribute,
  endAttribute: InstancedBufferAttribute,
  shapeAttribute: InstancedBufferAttribute,
  colorAttribute: InstancedBufferAttribute
): MeshBasicNodeMaterial {
  const material = glowMaterial('battle-bolts');
  // Explicit dirty ranges let the main and backdrop passes share each upload.
  const start = instancedBufferAttribute<'vec3'>(startAttribute, 'vec3');
  const end = instancedBufferAttribute<'vec3'>(endAttribute, 'vec3');
  const shape = instancedBufferAttribute<'vec3'>(shapeAttribute, 'vec3');
  const tint = instancedBufferAttribute<'vec3'>(colorAttribute, 'vec3');

  const centre = mix(start, end, positionGeometry.x.add(0.5));
  const side = normalize(cross(end.sub(start), cameraPosition.sub(centre)));
  const width = max(shape.x, pixelAt(centre).mul(SMALLEST.bolt));
  const thinned = shape.x.div(width).sqrt();
  material.positionNode = centre.add(side.mul(positionGeometry.y.mul(width)));

  const along = uv().x;
  const across = abs(uv().y.mul(2).sub(1));
  const core = exp(across.div(0.16).pow(2).negate());
  const glow = exp(across.mul(5).negate()).mul(0.55);
  const taper = smoothstep(0, 0.06, along).mul(smoothstep(0, 0.06, along.oneMinus()));
  const trail = mix(shape.z, 1, along).pow(1.5);
  material.colorNode = tint
    .mul(glow)
    .add(mix(tint, vec3(1), BOLT_CORE).mul(core))
    .mul(shape.y.mul(taper).mul(trail).mul(thinned));

  return material;
}

/**
 * Camera-facing flares and rotating fragments with hot angular edges. Distant flares and fragments stay a few
 * pixels across, dimmer as they are widened.
 */
export function flareMaterial(
  centreAttribute: InstancedBufferAttribute,
  colorAttribute: InstancedBufferAttribute,
  shapeAttribute: InstancedBufferAttribute
): MeshBasicNodeMaterial {
  const material = glowMaterial('battle-flares');
  const centre = instancedBufferAttribute<'vec4'>(centreAttribute, 'vec4');
  const glow = instancedBufferAttribute<'vec4'>(colorAttribute, 'vec4');
  const shape = instancedBufferAttribute<'vec2'>(shapeAttribute, 'vec2');

  const toCamera = normalize(cameraPosition.sub(centre.xyz));
  const right = normalize(cross(vec3(0, 1, 0), toCamera));
  const up = cross(toCamera, right);
  const turnedRight = right.mul(cos(shape.x)).add(up.mul(sin(shape.x)));
  const turnedUp = up.mul(cos(shape.x)).sub(right.mul(sin(shape.x)));
  const radius = max(centre.w, pixelAt(centre.xyz).mul(SMALLEST.flare));
  const size = radius.mul(2);
  material.positionNode = centre.xyz
    .add(turnedRight.mul(positionGeometry.x.mul(size)))
    .add(turnedUp.mul(positionGeometry.y.mul(size)));

  material.colorNode = Fn(() => {
    const attenuation = glow.a.mul(centre.w.div(radius)).toVar();
    const distance = length(uv().sub(0.5).mul(2)).toVar();
    const core = exp(distance.mul(distance).mul(-18));
    const halo = exp(distance.mul(-4.5))
      .mul(0.45)
      .mul(smoothstep(0.6, 1, distance).oneMinus())
      .toVar();
    const flare = mix(glow.rgb, vec3(1), core.mul(0.7)).mul(core.add(halo)).mul(attenuation);

    // Angular hot edges and an uneven face make the fragments read as wreckage rather than round sparks.
    const at = uv().sub(0.5).mul(2);
    const edge = max(abs(at.x).mul(1.7).add(at.y.mul(0.32)), abs(at.y).mul(1.1).sub(at.x.mul(0.25)));
    const aa = fwidth(edge).max(0.015).toVar();
    const solid = smoothstep(aa.negate(), aa, edge.sub(0.78)).oneMinus();
    const rim = exp(abs(edge.sub(0.68)).mul(-22));
    const facet = smoothstep(-0.12, 0.12, at.x.add(at.y.mul(0.35)));
    const fragment = glow.rgb
      .mul(facet.mul(0.4).add(0.16))
      .add(vec3(1, 0.8, 0.45).mul(rim))
      .mul(solid)
      .add(glow.rgb.mul(halo).mul(0.15))
      .mul(attenuation);
    return select(shape.y.greaterThan(0.5), fragment, flare);
  })();

  return material;
}

/** Fire and torn plasma projected onto a shell, so the camera can turn through it without exposing a flat card. */
export function blastMaterial(
  centreAttribute: InstancedBufferAttribute,
  stateAttribute: InstancedBufferAttribute
): MeshBasicNodeMaterial {
  const material = glowMaterial('battle-blasts');
  const centre = instancedBufferAttribute<'vec4'>(centreAttribute, 'vec4');
  const state = instancedBufferAttribute<'vec3'>(stateAttribute, 'vec3');

  const reach = 1.35;
  // The far side covers the effect both outside and inside, with only one surface shaded per pixel.
  material.side = BackSide;
  material.positionNode = centre.xyz.add(positionGeometry.mul(centre.w.mul(reach)));

  material.colorNode = plasmaLight(
    cameraPosition,
    normalize(positionWorld.sub(cameraPosition)),
    centre,
    state
  );

  // Its light adds up, and how far off it is, which is kept as it is, tells the frame what stands in front of it.
  material.premultipliedAlpha = false;
  material.blendSrcAlpha = OneFactor;
  material.blendDstAlpha = ZeroFactor;
  material.opacityNode = positionView.z.negate();

  return material;
}

/**
 * Lay blasts, drawn apart at a lower resolution, over the frame's `color`, if they were `drawn` this frame. `blast`
 * holds their light and how far off they are, and `frame` how much of each pixel the frame covers. A blast's light
 * shows wherever what the frame shows lies beyond it, `distance` ahead of the camera, and where something stands in
 * front of it, only past that thing's edges.
 */
export function overBlast(
  color: Node<'vec3'>,
  blast: TextureNode,
  drawn: Node<'float'>,
  frame: TextureNode,
  distance: Node<'float'>
): Node<'vec3'> {
  const behind = blast.a.greaterThan(distance);

  return color.add(blast.rgb.mul(select(behind, frame.a.oneMinus(), 1)).mul(drawn));
}
