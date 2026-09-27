import {
  abs,
  acos,
  atan,
  clamp,
  cos,
  dot,
  exp,
  fwidth,
  length,
  mix,
  mx_fractal_noise_float,
  normalize,
  rtt,
  sin,
  smoothstep,
  sqrt,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {
  HalfFloatType,
  RepeatWrapping,
  RGFormat,
  Vector3,
  Vector4,
  type Node,
  type NodeFrame,
} from 'three/webgpu';
import { retained } from '../utils';
import { BLAST } from './content';

/** The sequence's blast, shared with the lens even when it lies outside the source camera's view. */
export const plasmaUniforms = retained('plasma', () => ({
  centre: uniform(new Vector4()),
  state: uniform(new Vector3()),
}));

/** Coarse boiling and fine torn folds, anchored to a sphere in world space. */
function plasmaFields(flow: Node<'vec3'>, age: Node<'float'>, seed: Node<'float'>): Node<'vec2'> {
  const boil = mx_fractal_noise_float(
    flow.mul(3.2).add(vec3(0, 0, age.mul(0.3).add(seed))),
    3,
    2,
    0.5
  );
  const detail = mx_fractal_noise_float(
    flow
      .mul(26)
      .sub(normalize(flow).mul(age.mul(0.7)))
      .add(vec3(0, 0, age.mul(0.42).add(seed))),
    3,
    2,
    0.5
  );
  return vec2(boil, detail);
}

/** A single shell intersection gives the blast depth without marching through a volume. */
export function plasmaLight(
  origin: Node<'vec3'>,
  ray: Node<'vec3'>,
  centre: Node<'vec4'>,
  state: Node<'vec3'>,
  sampleFields = plasmaFields
): Node<'vec3'> {
  const color = (name: keyof typeof BLAST.colors) => vec3(...BLAST.colors[name]);
  const age = state.x;
  const grown = exp(age.mul(-1.8)).oneMinus().mul(0.9).add(0.035);
  const local = origin.sub(centre.xyz).div(centre.w);
  const along = dot(local, ray);
  const impact = dot(local, local).sub(along.mul(along)).max(0);
  const out = sqrt(impact);
  // One analytic intersection anchors the noise in space as the view crosses the fireball.
  const halfChord = sqrt(grown.mul(grown).sub(impact).max(0));
  const exit = along.negate().add(halfChord);
  const thickness = exit.sub(along.negate().sub(halfChord).max(0)).max(0);
  const flow = local.add(ray.mul(exit)).div(grown);
  const angle = atan(flow.y, flow.x.add(1e-5));
  const fields = sampleFields(flow, age, state.y);
  const boil = fields.x;
  const detail = fields.y;
  const lobes = sin(angle.mul(7).add(state.y))
    .mul(0.075)
    .add(sin(angle.mul(13).sub(state.y)).mul(0.035));
  const front = out.div(grown).add(boil.mul(0.28)).add(lobes);
  const body = smoothstep(1.08, 0.72, front);
  const breaking = smoothstep(1.4, 5.5, age);
  const fold = boil.add(detail.mul(0.65));
  const folds = exp(
    abs(fold)
      .div(
        length(fwidth(flow))
          .mul(16)
          .max(1 / 15)
      )
      .negate()
  );
  const torn = smoothstep(-0.16, 0.22, detail.add(boil.mul(0.5)));
  const surface = smoothstep(-0.38, 0.32, boil.add(detail.mul(1.4))).pow(1.4);
  const fuel = mix(surface.mul(1.5), folds.mul(torn).mul(2.8), breaking);
  const heat = exp(age.mul(-0.12));
  const hot = heat
    .mul(surface.mul(0.45).add(folds.mul(0.35)).add(0.1))
    .mul(front.mul(-0.35).add(1).max(0));
  const fire = mix(color('ember'), color('fire'), smoothstep(0.08, 0.5, hot))
    .add(
      color('core')
        .mul(smoothstep(0.45, 0.95, hot))
        .mul(2.5)
    )
    .mul(body)
    .mul(smoothstep(0, 0.3, thickness))
    .mul(fuel)
    .mul(heat.mul(3.8))
    .mul(state.z);
  const flash = color('core').mul(
    exp(out.mul(out).mul(-8))
      .mul(exp(age.mul(-7)))
      .mul(40)
  );
  const wave = exp(age.mul(-2.6)).oneMinus().mul(1.28);
  const ring = color('ring')
    .mul(
      exp(out.sub(wave).div(0.018).pow(2).negate()).add(
        exp(out.sub(wave).div(0.065).pow(2).negate()).mul(0.25)
      )
    )
    .mul(exp(age.mul(-2.4)))
    .mul(6);
  const edge = smoothstep(1.35, 1.35 * 0.88, out);
  return fire.add(flash).add(ring).mul(edge);
}

/** Cache both noise fields over every direction, so a turning lens never reaches an image boundary. */
export function plasmaAround(tracing: () => boolean) {
  const { centre, state } = plasmaUniforms;
  const longitude = uv()
    .x.sub(0.5)
    .mul(2 * Math.PI);
  const latitude = uv().y.mul(Math.PI);
  const direction = vec3(
    sin(latitude).mul(cos(longitude)),
    cos(latitude),
    sin(latitude).mul(sin(longitude))
  );
  const fields = rtt(vec4(plasmaFields(direction, state.x, state.y), 0, 1), 512, 256, {
    type: HalfFloatType,
    format: RGFormat,
    depthBuffer: false,
  });
  fields.name = 'plasma-fields';
  fields.value.wrapS = RepeatWrapping;
  const update = fields.updateBefore.bind(fields);
  fields.updateBefore = (frame: NodeFrame) =>
    tracing() && centre.value.w > 0 ? update(frame) : undefined;

  return (origin: Node<'vec3'>, ray: Node<'vec3'>) =>
    plasmaLight(origin, ray, centre, state, (flow) => {
      const direction = normalize(flow);
      const at = vec2(
        atan(direction.z, direction.x)
          .div(2 * Math.PI)
          .add(0.5),
        acos(clamp(direction.y, -1, 1)).div(Math.PI)
      );
      return fields.sample(at).rg;
    });
}
