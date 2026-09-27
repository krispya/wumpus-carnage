import {
  acos,
  clamp,
  cos,
  cross,
  dot,
  float,
  Fn,
  If,
  length,
  max,
  min,
  mix,
  modelWorldMatrix,
  modelWorldMatrixInverse,
  normalize,
  perspectiveDepthToViewZ,
  positionWorld,
  screenSize,
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
  Matrix4,
  type Node,
  PerspectiveCamera,
  type TextureNode,
  Vector2,
  Vector3,
} from 'three/webgpu';
import { retained } from '../utils';
import { skyAt } from '../void/materials';
import { HOLE, LENS, SHADOW, SPIN_AXIS } from './content';
import { bend, rayTable } from './rays';

/**
 * The camera the backdrop is shot through: the frame's own, copied each frame, but blind to the foreground, so the
 * hole's light is traced through all that lies behind what stands in front of it. Kept across a hot module
 * replacement.
 */
export const backdropCamera = retained('backdrop', () => new PerspectiveCamera());

/**
 * Every uniform the hole publishes, kept across a hot module replacement: the mounted view writes them each frame,
 * and the post pass and the wumpus's materials read them once when their graphs are built, so all must hold the
 * same set.
 */
export const holeUniforms = retained('black-hole', () => ({
  /**
   * The hole: where it is and how wide its horizon is, in the world, or zero while there is none. The axis it spins
   * about and how far it has dragged space round with it, and how close doom feels, which the whole frame answers.
   */
  uHoleCentre: uniform(new Vector3()),
  uHoleRadius: uniform(0),
  uSpinAxis: uniform(new Vector3(...SPIN_AXIS).normalize()),
  uSwirl: uniform(0),
  uDread: uniform(0),
  /**
   * Where the hole's shadow is on screen, as an offset from the middle in the frame's 0..1 coordinates, rows running
   * down, and how wide, as a share of the frame's height.
   */
  uHoleScreen: uniform(new Vector2()),
  uHoleLens: uniform(0),
  /**
   * The camera the frame was shot through, its near and far planes, how fast it is falling into the hole, as a share
   * of light's speed, and whether it has fallen past the horizon.
   */
  uCameraPosition: uniform(new Vector3()),
  uCameraWorld: uniform(new Matrix4()),
  uCameraProjectionInverse: uniform(new Matrix4()),
  uCameraViewProjection: uniform(new Matrix4()),
  uCameraClip: uniform(new Vector2(0.5, 90)),
  uInfall: uniform(0),
  uInside: uniform(0),
  /**
   * The tide on a captured body: the hole's centre and the radius of its shadow, the body's middle, all in the
   * world, how hard the tide stretches it, from 0, untouched, upward, how far it curls it round the hole, and how
   * hard it wrings it about its middle.
   */
  uTideHole: uniform(new Vector3()),
  uTideHorizon: uniform(HOLE.full),
  uTideCentre: uniform(new Vector3()),
  uTide: uniform(0),
  uTideStretch: uniform(1),
  uTideCurl: uniform(0),
  uTideWring: uniform(0),
}));

const {
  uHoleCentre,
  uHoleRadius,
  uSpinAxis,
  uSwirl,
  uDread,
  uHoleScreen,
  uHoleLens,
  uCameraPosition,
  uCameraWorld,
  uCameraProjectionInverse,
  uCameraViewProjection,
  uCameraClip,
  uInfall,
  uInside,
} = holeUniforms;
const { uTideHole, uTideHorizon, uTideCentre, uTide, uTideStretch, uTideCurl, uTideWring } =
  holeUniforms;

/**
 * Whether a hole is bending the frame. While one is, the lens fills whatever the frame's foreground leaves clear
 * with light it has bent.
 */
export const lensing = uHoleRadius.greaterThan(1e-4);

/** Turn `vector` about the unit `axis` by `angle`. */
function turned(vector: Node<'vec3'>, axis: Node<'vec3'>, angle: Node<'float'>): Node<'vec3'> {
  return vector
    .mul(cos(angle))
    .add(cross(axis, vector).mul(sin(angle)))
    .add(axis.mul(dot(axis, vector)).mul(cos(angle).oneMinus()));
}

/** The least of four values. */
function least(
  a: Node<'float'>,
  b: Node<'float'>,
  c: Node<'float'>,
  d: Node<'float'>
): Node<'float'> {
  return a.min(b).min(c.min(d));
}

/**
 * Trace the frame through the hole. There is nothing round it to shine: it is only a hole, and what it does is bend
 * the light of everything behind it. Each pixel's ray is followed back from the camera past it, bent as light is:
 * rays that come too close fall in, leaving its shadow, and the rest escape to show whatever they meet. That is
 * found in the backdrop, the sky and additive effects drawn without the foreground. They leave depth at the far
 * plane, where escaped rays land, dragged round the hole the closer they pass. If a ray leaves the frame, bent
 * wide it meets the sky, and only nudged, about what the frame shows at its edge. What lies beside the hole or
 * nearer is left as it was, drawn over
 * the bent light, to fall into it in its own light. A camera falling in sees the sky swept forward by its own speed,
 * so the hole ahead looks smaller than it is and the whole universe crowds round it in a ring, brighter the faster
 * it falls, and once it has fallen past the horizon there is nothing left to see.
 */
export function throughHole(
  lit: Node<'vec4'>,
  depth: TextureNode,
  backdrop: TextureNode
): Node<'vec3'> {
  const radius = length(uCameraPosition.sub(uHoleCentre)).div(uHoleRadius.max(1e-4));
  const tracedRay = rayTable(radius, uHoleRadius.greaterThan(1e-4).and(uInside.lessThanEqual(0.5)));

  return Fn((builder) => {
    const foreground = lit.toVar();
    const result = foreground.rgb.toVar();

    If(uInside.greaterThan(0.5), () => {
      result.assign(vec3(0));
    }).ElseIf(uHoleRadius.greaterThan(1e-4), () => {
      const ndc = vec2(uv().x.mul(2).sub(1), uv().y.mul(2).sub(1).negate());
      const view = uCameraProjectionInverse.mul(vec4(ndc, 1, 1));
      const looking = normalize(uCameraWorld.mul(vec4(view.xyz.div(view.w), 0)).xyz);
      // Aberration: where the falling camera looks, the light it sees came from further round, away from the hole.
      const falling = normalize(uHoleCentre.sub(uCameraPosition));
      const ahead = dot(looking, falling);
      const came = ahead.sub(uInfall).div(uInfall.mul(ahead).oneMinus());
      const aside = normalize(looking.sub(falling.mul(ahead)).add(vec3(1e-6, 0, 0)));
      const ray = falling.mul(came).add(aside.mul(sqrt(max(came.mul(came).oneMinus(), 0))));
      const boost = uInfall
        .mul(ahead)
        .add(1)
        .div(sqrt(uInfall.mul(uInfall).oneMinus()))
        .pow(2)
        .min(LENS.boost);
      const forward = normalize(uCameraWorld.mul(vec4(0, 0, -1, 0)).xyz);
      const origin = uCameraPosition.sub(uHoleCentre).div(uHoleRadius);
      // Where the camera is along the ray's line from where it passes the hole closest, and how close that is.
      const along = dot(origin, ray);
      const closest = origin.sub(ray.mul(along));
      const passing = length(closest);
      const inward = normalize(closest).negate();
      // How far off the hole is. Whatever is nearer the camera than that is seen straight, whichever way it looks,
      // even with the hole behind it.
      const holeDepth = length(uHoleCentre.sub(uCameraPosition));
      const [beside, behind] = LENS.beside;
      const nearest = holeDepth.add(beside);
      const surface = depth.sample(uv()).x.toVar();

      if ('isWebGPUBackend' in builder.renderer.backend) {
        // A silhouette pixel can miss the body in sample zero. Find its nearest covered depth.
        If(foreground.a.greaterThan(0).and(foreground.a.lessThan(1)), () => {
          const pixel = uv().mul(screenSize);
          for (let sample = 1; sample < 4; sample++) {
            surface.assign(min(surface, depth.load(pixel).level(float(sample)).x));
          }
        });
      }

      const distance = perspectiveDepthToViewZ(surface, uCameraClip.x, uCameraClip.y).negate();
      const keep = smoothstep(nearest, holeDepth.add(behind), distance).oneMinus();
      const past = foreground.a.mul(keep).oneMinus();

      If(past.greaterThan(0.001), () => {
        const axis = normalize(origin);
        const away = ray.toVar();
        const visibility = float(1).toVar();

        If(
          passing.lessThan(LENS.reach).and(radius.lessThanEqual(LENS.reach).or(along.lessThan(0))),
          () => {
            const radial = dot(ray, axis);
            const traced = tracedRay(acos(clamp(radial.negate(), -1, 1))).toVar();
            const tangent = normalize(ray.sub(axis.mul(radial)).add(vec3(1e-8, 0, 0)));
            visibility.assign(traced.z);
            away.assign(normalize(tangent.mul(traced.x).add(axis.mul(traced.y))));
          }
        ).Else(() => {
          away.assign(normalize(ray.add(inward.mul(passing.reciprocal().sub(bend(along, passing))))));
        });

        // A ray that neither escaped nor fell has circled the hole too long to follow, and is lost to it.
        const seen = vec3(0).toVar();

        If(visibility.greaterThan(0.0001), () => {
          const toward = dot(away, forward);
          const drag = uSwirl
            .mul(LENS.drag)
            .div(passing.mul(passing).add(1))
            .mul(smoothstep(LENS.reach, LENS.reach * 0.5, passing));

          // The sky is seen by direction alone, projected from the camera onto the backdrop's far plane.
          const point = uCameraPosition.add(away.mul(uCameraClip.y.div(toward.max(1e-3))));
          const dragged = drag.mul(clamp(uCameraClip.y.sub(holeDepth).div(LENS.dragDepth), 0, 1));
          const clip = uCameraViewProjection.mul(
            vec4(uHoleCentre.add(turned(point.sub(uHoleCentre), axis, dragged)), 1)
          );
          const landing = clip.xy.div(clip.w).mul(vec2(0.5, -0.5)).add(0.5).toVar();

          // The backdrop has no depth-writing surfaces, so an escaped ray meets its far plane directly.
          const target = vec2(0).toVar();
          const met = float(0).toVar();

          If(toward.greaterThan(0.02), () => {
            const at = landing;
            const inside = least(at.x, at.x.oneMinus(), at.y, at.y.oneMinus()).greaterThanEqual(0);

            If(inside, () => {
              target.assign(at);
              met.assign(1);
            });
          });

          const edge = least(target.x, target.x.oneMinus(), target.y, target.y.oneMinus());
          const framed = smoothstep(0, 0.03, edge).mul(met);
          seen.assign(backdrop.sample(target).rgb);

          // Where it left the frame, bent wide round the shadow, the sky is what it meets. Only nudged, about what
          // the frame shows at its edge where it left.
          If(framed.lessThan(0.999), () => {
            const [nudged, wide] = LENS.leaving;
            const beyond = mix(
              backdrop.sample(landing.clamp(0, 1)).rgb,
              skyAt(turned(away, axis, drag)),
              smoothstep(nudged, wide, length(away.sub(ray)))
            );
            seen.assign(mix(beyond, seen, framed));
          });
        });

        // Resolved RGB already includes coverage. Apply it only once, then fill the uncovered part with the lens.
        result.assign(foreground.rgb.mul(keep).add(seen.mul(visibility).mul(past)).mul(boost));
      });
    });

    return result;
  })();
}

/**
 * Grade the frame for doom. It drains of colour and closes in from its edges, as far as dread has come. Round the
 * hole it keeps its colour, bent as it is.
 */
export function dreadGrade(color: Node<'vec3'>): Node<'vec3'> {
  const aspect = vec2(screenSize.x.div(screenSize.y), 1);
  const toHole = uv().sub(0.5).sub(uHoleScreen).mul(aspect).length();
  const centred = uv().sub(0.5).mul(aspect).length();
  const horizon = uHoleLens.max(1e-5);
  const luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  const draining = smoothstep(horizon.mul(2), horizon.mul(8), toHole);
  const drained = mix(color, vec3(luminance), uDread.mul(0.6).mul(draining));
  const closing = smoothstep(0.2, 0.95, centred).mul(uDread.mul(0.7)).oneMinus();

  return drained.mul(closing);
}

/**
 * Spaghettify a body's vertex, in its own space, by the tide of a hole, all of it about the body's middle, which
 * stays where it is. It stretches along the line to the hole, so its near side reaches in and its far side trails out.
 * squeezed across that line as the tide builds. Wrung about that line, its ends turning opposite ways, more the further
 * they are from the middle, and bent round the hole as the hole's spin drags it, its near end swinging on ahead of
 * the middle and its far end falling behind, so it winds in like a noodle. With no tide it is left as it is.
 */
export function tidal(position: Node<'vec3'>): Node<'vec3'> {
  const world = modelWorldMatrix.mul(vec4(position, 1)).xyz;
  const toCentre = uTideCentre.sub(uTideHole);
  const reach = length(toCentre).max(1e-4);
  const axis = toCentre.div(reach);
  const offset = world.sub(uTideHole);
  const fromMiddle = dot(offset, axis).sub(reach);
  const across = offset.sub(axis.mul(fromMiddle.add(reach)));
  const stretch = uTideStretch;
  const reached = max(reach.add(fromMiddle.mul(stretch)), 0);
  // Keep the final strand thick enough to read as its length runs beyond the frame.
  const wrung = turned(
    across.div(uTide.mul(3).add(1).sqrt()),
    axis,
    uTideWring.mul(uTide).mul(fromMiddle)
  );
  const drawn = axis.mul(reached).add(wrung);
  const curl = (nearness: Node<'float'>) => uTideCurl.mul(uTide).div(nearness.mul(nearness).add(0.5));
  const turn = curl(length(drawn).div(uTideHorizon)).sub(curl(reach.div(uTideHorizon)));

  return modelWorldMatrixInverse.mul(vec4(uTideHole.add(turned(drawn, uSpinAxis, turn)), 1)).xyz;
}

/**
 * The light of a body falling into a hole, as it climbs back out: each part of it reddens and dims as it nears the
 * horizon, and is gone to black by the time it reaches it, so the body pours into the dark rather than slipping
 * behind it. With no tide it is left as it is.
 */
export function redshifted(light: Node<'vec4'>): Node<'vec4'> {
  const depth = length(positionWorld.sub(uTideHole)).div(uTideHorizon.div(SHADOW));
  const [gone, clear] = LENS.redshift;
  const escaping = uTide.greaterThan(0).select(smoothstep(gone, clear, depth), float(1));
  const reddened = mix(vec3(1, 0.22, 0.08), vec3(1), escaping.pow(0.6));

  return vec4(light.rgb.mul(reddened).mul(escaping), light.a);
}
