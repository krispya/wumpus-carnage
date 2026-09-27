import {
  Break,
  clamp,
  cos,
  cross,
  dot,
  float,
  Fn,
  If,
  length,
  Loop,
  max,
  min,
  mix,
  modelWorldMatrix,
  modelWorldMatrixInverse,
  normalize,
  perspectiveDepthToViewZ,
  positionWorld,
  screenSize,
  select,
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
   * The hole: where it is and how wide its horizon is, in the world, or zero while there is none; the axis it spins
   * about and how far it has dragged space round with it; and how close doom feels, which the whole frame answers.
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
const { uTideHole, uTideHorizon, uTideCentre, uTide, uTideCurl, uTideWring } = holeUniforms;

/** Turn `vector` about the unit `axis` by `angle`. */
function turned(vector: Node<'vec3'>, axis: Node<'vec3'>, angle: Node<'float'>): Node<'vec3'> {
  return vector
    .mul(cos(angle))
    .add(cross(axis, vector).mul(sin(angle)))
    .add(axis.mul(dot(axis, vector)).mul(cos(angle).oneMinus()));
}

/**
 * How much a ray passing a hole `impact` horizon radii from it at its closest has been bent toward it by the time it
 * is `along` horizon radii past that point, in radians, counted from the middle of its passing: it runs from minus
 * the reciprocal of `impact` far before to plus it far after, twice that in all, as light passing a mass bends.
 */
function bend(along: Node<'float'>, impact: Node<'float'>): Node<'float'> {
  const square = impact.mul(impact);

  return along
    .mul(along.mul(along).mul(2).add(square.mul(3)))
    .div(impact.mul(2).mul(square.add(along.mul(along)).pow(1.5)));
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
 * found in the backdrop, the frame drawn again without what stands in front of the hole, so nothing there hides what
 * a ray was heading for: the bent ray is followed out until it passes behind what the backdrop shows where it has
 * got to, dragged round the hole the closer it passes; if it leaves the frame, bent wide it meets the sky, and only
 * nudged, about what the frame shows at its edge. What lies beside the hole or nearer is left as it was, drawn over
 * the bent light, to fall into it in its own light. A camera falling in sees the sky swept forward by its own speed,
 * so the hole ahead looks smaller than it is and the whole universe crowds round it in a ring, brighter the faster
 * it falls; and once it has fallen past the horizon there is nothing left to see.
 */
export function throughHole(
  lit: TextureNode,
  depth: TextureNode,
  backdrop: TextureNode,
  backdropDepth: TextureNode
): Node<'vec3'> {
  /** How far ahead of the camera the scene lies at `at` on screen, in the frame and in the backdrop. */
  const distanceAt = (at: Node<'vec2'>) =>
    perspectiveDepthToViewZ(depth.sample(at).x, uCameraClip.x, uCameraClip.y).negate();
  const behindAt = (at: Node<'vec2'>) =>
    perspectiveDepthToViewZ(backdropDepth.sample(at).x, uCameraClip.x, uCameraClip.y).negate();

  return Fn(() => {
    const result = lit.sample(uv()).rgb.toVar();

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
      const past = smoothstep(nearest, holeDepth.add(behind), distanceAt(uv()));

      If(past.greaterThan(0.001), () => {
        const reach = float(LENS.reach);
        const p = origin.toVar();
        const away = ray.toVar();
        const escaped = float(0).toVar();
        // How close the ray came to the hole before it turned back out, if it came in at all.
        const periapsis = float(1e3).toVar();

        If(
          passing.lessThan(reach).and(length(origin).lessThanEqual(reach).or(along.lessThan(0))),
          () => {
            // Near the hole the ray is followed step by step. Out to the edge of its reach it runs nearly straight,
            // bent only by what it gathers on the way in, which is added whole.
            const v = ray.toVar();

            If(length(origin).greaterThan(reach), () => {
              const entry = sqrt(reach.mul(reach).sub(passing.mul(passing))).negate();
              p.assign(closest.add(ray.mul(entry)));
              v.assign(
                normalize(ray.add(inward.mul(bend(entry, passing).sub(bend(along, passing)))))
              );
            });

            const momentum = dot(cross(p, v), cross(p, v));
            const incoming = dot(p, v).lessThan(0);
            const lowest = float(1e3).toVar();

            Loop(LENS.steps, () => {
              const radius = length(p);
              lowest.assign(min(lowest, radius));

              If(radius.lessThan(1), () => {
                Break();
              });

              If(radius.greaterThan(reach).and(dot(p, v).greaterThan(0)), () => {
                escaped.assign(1);
                Break();
              });

              const step = clamp(radius.mul(0.09), 0.03, 2);
              v.addAssign(p.mul(momentum.mul(-1.5).div(radius.pow(5))).mul(step));
              p.addAssign(v.mul(step));
            });

            periapsis.assign(select(incoming, lowest, float(1e3)));

            // What little it would still gather on the way out is added whole too, so rays let go a step apart
            // still leave together, and lasers bent round the hole stay straight-edged.
            const going = normalize(v);
            const out = dot(p, going);
            const impact = length(cross(p, going)).max(1e-4);
            const outward = normalize(p.sub(going.mul(out))).negate();
            away.assign(
              normalize(going.add(outward.mul(impact.reciprocal().sub(bend(out, impact)))))
            );
          }
        ).Else(() => {
          // Further out the ray runs so nearly straight that it is bent whole where it passes the hole closest,
          // by all it gathers from the camera on out: little, but never nothing, so even a pinprick bends the frame.
          escaped.assign(1);
          p.assign(select(along.lessThan(0), closest, origin));
          away.assign(normalize(ray.add(inward.mul(passing.reciprocal().sub(bend(along, passing))))));
        });

        // A ray that neither escaped nor fell has circled the hole too long to follow, and is lost to it.
        const seen = vec3(0).toVar();

        If(escaped.greaterThan(0.5), () => {
          const exit = uHoleCentre.add(p.mul(uHoleRadius));
          const toward = dot(away, forward);
          const axis = normalize(origin);
          const drag = uSwirl
            .mul(LENS.drag)
            .div(passing.mul(passing).add(1))
            .mul(smoothstep(LENS.reach, LENS.reach * 0.5, passing));

          /**
           * Where the escaped ray lands on screen once it is `distance` ahead of the camera. It is dragged round
           * the hole the more the further past it it is. The sky is seen by its direction alone, so toward the far
           * plane the ray is taken as leaving from the camera.
           */
          const landing = (distance: Node<'float'>) => {
            const from = mix(
              exit,
              uCameraPosition,
              smoothstep(uCameraClip.y.mul(0.4), uCameraClip.y, distance)
            );
            const point = from.add(
              away.mul(distance.sub(dot(from.sub(uCameraPosition), forward)).div(toward.max(1e-3)))
            );
            const dragged = drag.mul(clamp(distance.sub(holeDepth).div(LENS.dragDepth), 0, 1));
            const clip = uCameraViewProjection.mul(
              vec4(uHoleCentre.add(turned(point.sub(uHoleCentre), axis, dragged)), 1)
            );

            return clip.xy.div(clip.w).mul(vec2(0.5, -0.5)).add(0.5);
          };

          // Follow it out from beside the hole, deeper and deeper, until it passes behind whatever the backdrop shows
          // where it has got to: that is what it meets. Where it is outside the frame the frame cannot say.
          const target = vec2(0).toVar();
          const met = float(0).toVar();
          const last = nearest.toVar();

          If(toward.greaterThan(0.02), () => {
            Loop(LENS.depths, ({ i }) => {
              const share = float(i).add(1).div(LENS.depths);
              const distance = mix(nearest, uCameraClip.y, share.mul(share));
              const at = landing(distance);
              const inside = least(at.x, at.x.oneMinus(), at.y, at.y.oneMinus()).greaterThanEqual(0);
              const surface = behindAt(at.clamp(0, 1));

              If(
                inside
                  .and(surface.greaterThan(max(last.sub(0.5), nearest)))
                  .and(surface.lessThan(distance.add(0.01))),
                () => {
                  target.assign(at);
                  met.assign(1);
                  Break();
                }
              );

              last.assign(distance);
            });
          });

          const edge = least(target.x, target.x.oneMinus(), target.y, target.y.oneMinus());
          const framed = smoothstep(0, 0.03, edge).mul(met);
          seen.assign(backdrop.sample(target).rgb);

          // Where it left the frame, bent wide round the shadow, the sky is what it meets; only nudged, about what
          // the frame shows at its edge where it left.
          If(framed.lessThan(0.999), () => {
            const [nudged, wide] = LENS.leaving;
            const beyond = mix(
              backdrop.sample(landing(uCameraClip.y).clamp(0, 1)).rgb,
              skyAt(turned(away, axis, drag)),
              smoothstep(nudged, wide, length(away.sub(ray)))
            );
            seen.assign(mix(beyond, seen, framed));
          });
        });

        // Light that has skimmed the photon sphere, circling the hole before it turned back out, is bent too wildly
        // to follow from pixel to pixel, and would sparkle; it is let fade, so the shadow's edge is clean.
        const skimmed = smoothstep(1.5, 1.5 + LENS.skim, periapsis);
        result.assign(mix(result, seen.mul(skimmed), past).mul(boost));
      });
    });

    return result;
  })();
}

/**
 * Grade the frame for doom. It drains of colour and closes in from its edges, as far as dread has come; round the
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
 * stays where it is: stretched along the line to the hole, so its near side reaches in and its far side trails out;
 * squeezed across that line to keep its bulk; wrung about that line, its ends turning opposite ways, more the further
 * they are from the middle; and bent round the hole as the hole's spin drags it, its near end swinging on ahead of
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
  const stretch = uTide.mul(3).add(1);
  const reached = max(reach.add(fromMiddle.mul(stretch)), 0);
  const wrung = turned(across.div(stretch.sqrt()), axis, uTideWring.mul(uTide).mul(fromMiddle));
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
