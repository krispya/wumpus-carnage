import {
  abs,
  cameraPosition,
  cameraProjectionMatrix,
  cross,
  exp,
  instancedBufferAttribute,
  mx_fractal_noise_float,
  length,
  max,
  mix,
  normalize,
  positionGeometry,
  screenSize,
  smoothstep,
  uv,
  vec3,
  vec4,
} from 'three/tsl';
import {
  AdditiveBlending,
  DoubleSide,
  type InstancedBufferAttribute,
  MeshBasicNodeMaterial,
  type Node,
} from 'three/webgpu';
import { BLAST, BOLT_CORE, SMALLEST } from './content';

/** How many world units one pixel of the frame spans at `point`, from how far it is from the camera. */
function pixelAt(point: Node<'vec3'>): Node<'float'> {
  return length(cameraPosition.sub(point))
    .mul(2)
    .div(screenSize.y.mul(cameraProjectionMatrix.mul(vec4(0, 1, 0, 0)).y));
}

/** Glowing light, added over whatever is behind it, never hiding it and never sorted. */
function glowMaterial(name: string): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    transparent: true,
    // Each effect is a flat quad, so drawing its two sides separately adds no visible surface.
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
 * Flares: a camera-facing disc with a white-hot centre inside a halo of its colour, fading out before its edge. Like
 * a bolt, a distant flare is drawn no smaller than a few pixels, dimmer for it.
 */
export function flareMaterial(
  centreAttribute: InstancedBufferAttribute,
  colorAttribute: InstancedBufferAttribute
): MeshBasicNodeMaterial {
  const material = glowMaterial('battle-flares');
  const centre = instancedBufferAttribute<'vec4'>(centreAttribute, 'vec4');
  const glow = instancedBufferAttribute<'vec4'>(colorAttribute, 'vec4');

  const toCamera = normalize(cameraPosition.sub(centre.xyz));
  const right = normalize(cross(vec3(0, 1, 0), toCamera));
  const up = cross(toCamera, right);
  const radius = max(centre.w, pixelAt(centre.xyz).mul(SMALLEST.flare));
  const size = radius.mul(2);
  material.positionNode = centre.xyz
    .add(right.mul(positionGeometry.x.mul(size)))
    .add(up.mul(positionGeometry.y.mul(size)));

  const distance = length(uv().sub(0.5).mul(2));
  const core = exp(distance.mul(distance).mul(-18));
  const halo = exp(distance.mul(-4.5))
    .mul(0.45)
    .mul(smoothstep(0.6, 1, distance).oneMinus());
  material.colorNode = mix(glow.rgb, vec3(1), core.mul(0.7))
    .mul(core.add(halo))
    .mul(glow.a.mul(centre.w.div(radius)));

  return material;
}

/**
 * The giant explosion, a camera-facing disc painted as it burns. A blinding flash at its heart dies in a moment.
 * its fireball billows out fast and then slower, boiling with turbulence and cooling from white through marigold
 * and ember to ash. A thin shockwave races out ahead of it and fades, and a dusty remnant, teal where it thins and
 * ochre where it gathers, glows on long after, until it fades away.
 */
export function blastMaterial(
  centreAttribute: InstancedBufferAttribute,
  stateAttribute: InstancedBufferAttribute
): MeshBasicNodeMaterial {
  const material = glowMaterial('battle-blasts');
  const centre = instancedBufferAttribute<'vec4'>(centreAttribute, 'vec4');
  const state = instancedBufferAttribute<'vec3'>(stateAttribute, 'vec3');
  const color = (name: keyof typeof BLAST.colors) => vec3(...BLAST.colors[name]);

  const toCamera = normalize(cameraPosition.sub(centre.xyz));
  const right = normalize(cross(vec3(0, 1, 0), toCamera));
  const up = cross(toCamera, right);
  const reach = 1.35;
  const size = centre.w.mul(reach * 2);
  material.positionNode = centre.xyz
    .add(right.mul(positionGeometry.x.mul(size)))
    .add(up.mul(positionGeometry.y.mul(size)));

  // Across the disc in fireball radii, and how long it has burned.
  const at = uv()
    .sub(0.5)
    .mul(reach * 2);
  const out = length(at);
  const age = state.x;
  const boil = mx_fractal_noise_float(vec3(at.mul(2.4), age.mul(0.12).add(state.y)), 5, 2, 0.55);
  const billow = abs(
    mx_fractal_noise_float(vec3(at.mul(1.3), age.mul(0.08).add(state.y.add(3))), 3, 2, 0.5)
  );
  const drift = mx_fractal_noise_float(
    vec3(at.mul(1.1), age.mul(0.03).add(state.y.add(9))),
    3,
    2,
    0.5
  );

  // The fireball, lumpy at its edge, hottest at its heart, cooling as a whole as it burns on.
  const grown = exp(age.mul(-1.1)).oneMinus().mul(0.85).add(0.05);
  const heat = exp(age.mul(-0.12));
  const reached = out.add(billow.mul(0.45).mul(grown)).add(boil.mul(0.12).mul(grown));
  const body = smoothstep(grown, grown.mul(0.2), reached);
  const inside = reached.div(grown).oneMinus().max(0).sqrt();
  const glow = heat.mul(inside.mul(0.8).add(0.3)).mul(boil.mul(0.5).add(0.85));
  const fire = mix(
    color('ash'),
    mix(
      color('ember'),
      mix(color('fire'), color('core'), smoothstep(0.35, 0.8, glow)),
      smoothstep(0.08, 0.3, glow)
    ),
    smoothstep(0.02, 0.12, glow)
  )
    .mul(body)
    .mul(glow.mul(2).add(0.25));
  const flash = color('core').mul(
    exp(out.mul(out).mul(-5))
      .mul(exp(age.mul(-4.5)))
      .mul(30)
  );
  const wave = exp(age.mul(-0.75)).oneMinus().mul(1.25);
  const ring = color('ring')
    .mul(
      exp(out.sub(wave).div(0.05).pow(2).negate()).add(
        exp(out.sub(wave).div(0.18).pow(2).negate()).mul(0.25)
      )
    )
    .mul(exp(age.mul(-0.9)).mul(2.5))
    .mul(boil.mul(0.3).add(0.85));
  const remnant = mix(color('teal'), color('ochre'), smoothstep(-0.1, 0.5, drift))
    .mul(smoothstep(1.1, 0.1, out.add(drift.mul(0.55)).add(billow.mul(0.4))))
    .mul(smoothstep(4, 14, age))
    .mul(drift.mul(0.5).add(0.9))
    .mul(state.z)
    .mul(1.1);
  const edge = smoothstep(reach, reach * 0.85, out);
  material.colorNode = fire.add(flash).add(ring).add(remnant).mul(edge);

  return material;
}
