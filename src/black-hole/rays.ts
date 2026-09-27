import {
  asin,
  Break,
  clamp,
  cos,
  cross,
  dot,
  float,
  floor,
  Fn,
  If,
  length,
  Loop,
  min,
  mix,
  normalize,
  rtt,
  select,
  sin,
  smoothstep,
  sqrt,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { FloatType, NearestFilter, type Node } from 'three/webgpu';
import { LENS } from './content';

/**
 * How much a ray passing a hole `impact` horizon radii from it at its closest has been bent toward it by the time it
 * is `along` horizon radii past that point, in radians, counted from the middle of its passing: it runs from minus
 * the reciprocal of `impact` far before to plus it far after, twice that in all, as light passing a mass bends.
 */
export function bend(along: Node<'float'>, impact: Node<'float'>): Node<'float'> {
  const square = impact.mul(impact);

  return along
    .mul(along.mul(along).mul(2).add(square.mul(3)))
    .div(impact.mul(2).mul(square.add(along.mul(along)).pow(1.5)));
}

/** Maximum angle from the inward radial direction that needs numerical tracing. */
function traceAngle(distance: Node<'float'>): Node<'float'> {
  return select(
    distance.greaterThan(LENS.reach),
    asin(clamp(float(LENS.reach).div(distance), 0, 1)),
    float(Math.PI)
  );
}

/** Trace one plane through a spherical hole, shared by every screen ray at the same angle. */
export function rayTable(distance: Node<'float'>, active: Node<'bool'>) {
  const limit = traceAngle(distance);
  const traced = Fn(() => {
    const result = vec4(0).toVar();
    If(active, () => {
      const angle = uv().x.mul(8192).sub(0.5).div(8191).mul(limit);
      const origin = vec3(0, 0, distance);
      const ray = vec3(sin(angle), 0, cos(angle).negate());
      const along = dot(origin, ray);
      const closest = origin.sub(ray.mul(along));
      const passing = length(closest);
      const inward = normalize(closest).negate();
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
            v.assign(normalize(ray.add(inward.mul(bend(entry, passing).sub(bend(along, passing))))));
          });

          // Radial acceleration conserves angular momentum throughout the trace.
          const angular = cross(p, v).toVar();
          const momentum = dot(angular, angular).mul(-1.5).toVar();
          const incoming = dot(p, v).lessThan(0);
          const lowest = float(1e3).toVar();

          Loop(LENS.steps, () => {
            const square = dot(p, p).toVar();
            const radius = sqrt(square).toVar();
            lowest.assign(min(lowest, radius));

            If(radius.lessThan(1), () => {
              Break();
            });

            If(radius.greaterThan(reach).and(dot(p, v).greaterThan(0)), () => {
              escaped.assign(1);
              Break();
            });

            const step = clamp(radius.mul(0.09), 0.03, 2);
            v.addAssign(p.mul(momentum.div(square.mul(square).mul(radius))).mul(step));
            p.addAssign(v.mul(step));
          });

          periapsis.assign(select(incoming, lowest, float(1e3)));

          // What little it would still gather on the way out is added whole too, so rays let go a step apart
          // still leave together, and lasers bent round the hole stay straight-edged.
          const going = normalize(v);
          const out = dot(p, going);
          const impact = length(cross(p, going)).max(1e-4);
          const outward = normalize(p.sub(going.mul(out))).negate();
          away.assign(normalize(going.add(outward.mul(impact.reciprocal().sub(bend(out, impact))))));
        }
      ).Else(() => {
        // Further out the ray runs so nearly straight that it is bent whole where it passes the hole closest,
        // by all it gathers from the camera on out: little, but never nothing, so even a pinprick bends the frame.
        escaped.assign(1);
        p.assign(select(along.lessThan(0), closest, origin));
        away.assign(normalize(ray.add(inward.mul(passing.reciprocal().sub(bend(along, passing))))));
      });

      If(escaped.greaterThan(0.5), () => {
        const visible = smoothstep(1.5, 1.5 + LENS.skim, periapsis);
        // Weight direction by visibility so captured neighbours cannot pull an escaping ray off course.
        result.assign(vec4(away.x.mul(visible), away.z.mul(visible), visible, 1));
      });
    });
    return result;
  })();
  // Float precision keeps stars stable. Explicit interpolation also works without float texture filtering.
  const table = rtt(traced, 8192, 1, {
    type: FloatType,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    depthBuffer: false,
  });
  table.name = 'black-hole-rays';
  return (angle: Node<'float'>): Node<'vec3'> => {
    const index = clamp(angle.div(limit), 0, 1).mul(8191);
    const lower = floor(index);
    return mix(
      table.load(vec2(lower, 0)).rgb,
      table.load(vec2(min(lower.add(1), 8191), 0)).rgb,
      index.sub(lower)
    );
  };
}
