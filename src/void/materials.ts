import {
  abs,
  atan,
  clamp,
  cos,
  dot,
  exp,
  float,
  floor,
  Fn,
  fract,
  fwidth,
  If,
  length,
  max,
  min,
  mix,
  mx_cell_noise_float,
  mx_fractal_noise_float,
  mx_noise_float,
  normalize,
  positionLocal,
  pow,
  select,
  sin,
  smoothstep,
  step,
  time,
  vec2,
  vec3,
} from 'three/tsl';
import { Color, type Node, Vector3 } from 'three/webgpu';
import { BEAMS, ECLIPSE, NEBULA, SKY, STARS, SUN } from './content';

/** A colour as linear light, from its sRGB hex. */
function rgb(hex: string) {
  const { r, g, b } = new Color(hex);

  return vec3(r, g, b);
}

type Direction = readonly [number, number, number];

/** A unit vector, as a node. */
function unit(direction: Direction) {
  const { x, y, z } = new Vector3(...direction).normalize();

  return vec3(x, y, z);
}

const star = new Vector3(...SUN.direction).normalize();
const starEast = new Vector3(0, 1, 0).cross(star).normalize();
const starNorth = star.clone().cross(starEast);
/** Toward the sliver of the star left showing, from the middle of the dark world, in the star's frame. */
const sliver = [Math.cos(ECLIPSE.angle), Math.sin(ECLIPSE.angle)] as const;
/** The dark world's middle, in radians off the star, in the star's frame. */
const eclipser = sliver.map(
  (part) => -part * (ECLIPSE.radius + SUN.radius * (1 - 2 * ECLIPSE.showing))
) as unknown as readonly [number, number];

/**
 * The star along `direction`, and the dark world crossing it: what burns behind the world, which is the star, its
 * glow, and the beams fanning out from the sliver of it left showing, cut by the world's shadow. The world itself,
 * dark, its air lit in a thin ring of fire nearest the sliver. How much of the sky the world covers, and the glow
 * of its air just past its edge. Angles are measured flat across the sky round the star, which they barely leave.
 */
function eclipseAt(direction: Node<'vec3'>) {
  const facing = step(0, dot(direction, vec3(star.x, star.y, star.z)));
  const at = vec2(
    dot(direction, vec3(starEast.x, starEast.y, starEast.z)),
    dot(direction, vec3(starNorth.x, starNorth.y, starNorth.z))
  );
  const off = length(at);

  // The world: where it covers the sky, and how near each part of its edge is to the sliver.
  const fromWorld = at.sub(vec2(...eclipser));
  const out = length(fromWorld).div(ECLIPSE.radius);
  const edge = fwidth(out).max(1e-4);
  const cover = smoothstep(edge.add(1), edge.oneMinus(), out).mul(facing);
  const sunward = max(dot(normalize(fromWorld), vec2(...sliver)), 0);

  // The star: a hard disc burning far past white, a warm glow, and a ring of blue, through the filter.
  const sharp = fwidth(off).max(1e-5);
  const disc = smoothstep(sharp.add(SUN.radius), sharp.negate().add(SUN.radius), off);
  const glow = rgb(SUN.glow)
    .mul(
      exp(off.div(SUN.radius * 2.5).negate())
        .mul(1.2)
        .add(exp(off.div(SUN.radius * 12).negate()).mul(0.25))
    )
    .add(rgb(SUN.halo).mul(exp(off.div(SUN.radius * 5).negate()).mul(0.35)));
  const burning = rgb(SUN.color).mul(disc.mul(SUN.burn)).add(glow).mul(SUN.filter);

  // The beams fan out from the sliver: streaks round it, fading with distance, shimmering as the dust drifts, and
  // dark where the line back to the sliver crosses the world. Far from the star they have faded to nothing, and are
  // not worked out at all.
  const beams = Fn(() => {
    const light = vec3(0).toVar();

    If(facing.greaterThan(0.5).and(off.lessThan(BEAMS.reach * 3)), () => {
      const root = vec2(sliver[0] * SUN.radius, sliver[1] * SUN.radius);
      const ray = at.sub(root);
      const reach = length(ray);
      const angle = atan(ray.y, ray.x);
      const drift = time.mul(BEAMS.drift);
      const round = (count: number, shift: number) =>
        mx_noise_float(vec3(cos(angle).mul(count), sin(angle).mul(count), drift.add(shift)))
          .mul(0.5)
          .add(0.5);
      const streaks = round(BEAMS.count, 0)
        .pow(5)
        .add(
          round(BEAMS.count * 0.3, 4)
            .pow(3)
            .mul(0.25)
        );
      const toWorld = vec2(...eclipser).sub(root);
      const along = clamp(dot(toWorld, ray).div(dot(ray, ray).max(1e-8)), 0, 1);
      const lit = smoothstep(0.95, 1.2, length(toWorld.sub(ray.mul(along))).div(ECLIPSE.radius));
      const dust = smoothstep(-0.4, 0.6, mx_fractal_noise_float(direction.mul(7), 3, 2, 0.5))
        .mul(0.9)
        .add(0.35);
      light.assign(
        rgb(BEAMS.color).mul(
          streaks
            .mul(exp(reach.div(BEAMS.reach).negate()))
            .mul(lit)
            .mul(dust)
            .mul(BEAMS.strength)
        )
      );
    });

    return light;
  })();

  // The world, seen from its night side: dark, faintly banded, its air catching the star in a thin ring of fire
  // nearest the sliver and a cold glow the rest of the way round.
  const bands = Fn(() => {
    const shade = float(0).toVar();

    If(cover.greaterThan(0), () => {
      shade.assign(
        smoothstep(0.2, 0.8, mx_noise_float(vec3(fromWorld.y.mul(90), fromWorld.x.mul(8), 0)))
      );
    });

    return shade;
  })();
  const rimLight = rgb(ECLIPSE.rim)
    .mul(sunward.pow(3).mul(2.5))
    .add(rgb(ECLIPSE.air).mul(0.12))
    .mul(exp(out.oneMinus().max(0).mul(-40)));
  const world = mix(rgb(ECLIPSE.night), rgb(ECLIPSE.bands), bands.mul(0.5)).add(rimLight);
  const halo = rgb(ECLIPSE.rim)
    .mul(sunward.pow(2).mul(1.6))
    .add(rgb(ECLIPSE.air).mul(0.1))
    .mul(exp(out.sub(1).max(0).mul(-16)))
    .mul(step(1, out))
    .mul(facing);

  return { behind: burning.add(beams).mul(facing), world, cover, halo };
}

/**
 * Deep space seen along `direction`, a unit vector in the world: stars scattered across it, a band of dusty cloud
 * over dark dust along the bottom, and the system's star, far off, eclipsed by a dark world and throwing beams
 * through the dust. Anything can look
 * up the sky this way, such as a ray a black hole has bent.
 */
export function skyAt(direction: Node<'vec3'>) {
  // The nebula. Its height above its edge is roughened by noise into cloud, lit most along the edge, and cut sharply
  // below it, where the dust begins.
  const [nx, ny, nz] = NEBULA.normal;
  const normalLength = Math.hypot(nx, ny, nz);
  const roughness = mx_fractal_noise_float(direction.mul(NEBULA.warpScale), 4, 2, 0.5);
  const height = dot(direction, vec3(nx / normalLength, ny / normalLength, nz / normalLength)).add(
    roughness.mul(NEBULA.warp)
  );
  const smoke = smoothstep(
    -0.4,
    0.5,
    mx_fractal_noise_float(direction.mul(NEBULA.smokeScale).add(roughness), 5, 2, 0.55)
  );
  const stretch = smoothstep(
    -0.6,
    0.3,
    mx_fractal_noise_float(direction.mul(NEBULA.stretchScale), 2)
  );
  const rim = exp(max(height, 0).div(NEBULA.rim).negate());
  const cloud = smoothstep(-0.02, 0.006, height)
    .mul(smoothstep(0, NEBULA.depth, height).oneMinus())
    .mul(smoke)
    .mul(stretch)
    .mul(rim.mul(0.6).add(0.4));
  const dust = smoothstep(-0.06, 0, height).oneMinus();
  const billow = mx_fractal_noise_float(
    direction.mul(NEBULA.haze.scale).add(roughness.mul(0.5)),
    4,
    2,
    0.5
  );
  const haze = smoothstep(-0.15, 0.6, billow)
    .mul(exp(abs(height).div(NEBULA.haze.reach).negate()))
    .mul(NEBULA.haze.strength);

  // The stars' cube: the face each direction looks through, and where on that face it lands.
  const extent = abs(direction);
  const alongX = extent.x.greaterThanEqual(extent.y).and(extent.x.greaterThanEqual(extent.z));
  const alongY = extent.y.greaterThanEqual(extent.z);
  const face = select(
    alongX,
    select(direction.x.greaterThan(0), float(0), float(1)),
    select(
      alongY,
      select(direction.y.greaterThan(0), float(2), float(3)),
      select(direction.z.greaterThan(0), float(4), float(5))
    )
  );
  const onFace = select(
    alongX,
    direction.yz.div(direction.x),
    select(alongY, direction.xz.div(direction.y), direction.xy.div(direction.z))
  );

  /** Patches of sky with more stars in them, and fewer between. */
  const clustering = smoothstep(-0.4, 0.5, mx_fractal_noise_float(direction.mul(3), 2))
    .mul(1.6)
    .add(0.2);
  /** Near the nebula's edge, where warm stars gather. */
  const nearNebula = smoothstep(0.15, 0, abs(height.sub(0.03))).mul(STARS.nebulaWarmth);

  const tints = {
    blue: rgb(STARS.colors.blue),
    pale: rgb(STARS.colors.pale),
    cream: rgb(STARS.colors.cream),
    orange: rgb(STARS.colors.orange),
    ember: rgb(STARS.colors.ember),
  };

  /** A star's colour from two of its random draws: mostly blue, often ember, now and then cream. */
  function tint(pick: Node<'float'>, shade: Node<'float'>) {
    const warm = nearNebula.add(STARS.warm);

    return select(
      pick.lessThan(warm),
      mix(tints.orange, tints.ember, shade),
      select(pick.lessThan(warm.add(STARS.cream)), tints.cream, mix(tints.blue, tints.pale, shade))
    );
  }

  /** One layer of stars: each cell's star, if it has one, drawn as a sharp core with an optional soft halo. */
  function starLayer(layer: (typeof STARS.layers)[number], index: number) {
    const grid = onFace.mul(layer.cells);
    const cell = floor(grid);
    const draw = (k: number) => mx_cell_noise_float(vec3(cell, face.add(6 * (index * 8 + k))));
    const present = step(draw(0), clustering.mul(layer.density));
    const centre = mix(vec2(STARS.margin), vec2(1 - STARS.margin), vec2(draw(1), draw(2)));
    const offset = length(fract(grid).sub(centre));
    // Cells to a pixel, from how fast the grid moves across the screen. It jumps where faces meet, so it is capped.
    const pixel = min(length(fwidth(grid)).mul(0.7), layer.cells * 0.004);
    const distance = offset.div(pixel);
    const brightness = pow(draw(3), layer.falloff);
    const radius = mix(layer.size[0], layer.size[1], brightness);
    const core = exp(distance.div(radius).pow(2).negate());
    const halo = exp(distance.div(radius.mul(3)).negate())
      .mul(layer.halo)
      .mul(smoothstep(STARS.margin * 0.5, STARS.margin, offset).oneMinus());

    return tint(draw(4), draw(5)).mul(
      core
        .add(halo)
        .mul(mix(layer.dim, 1, brightness))
        .mul(present)
    );
  }

  const [fine, bright] = STARS.layers.map(starLayer);
  const stars = fine!.add(bright!).mul(dust.mul(NEBULA.shade).oneMinus());
  // Where the cloud gathers thickest it is cobalt. Where it thins, indigo, and near the star it glows with its light.
  const cloudColor = mix(
    rgb(NEBULA.thin),
    rgb(NEBULA.thick),
    smoothstep(0.25, 0.75, smoke.mul(stretch))
  );
  const starlit = rgb(BEAMS.color).mul(
    exp(
      dot(direction, unit(SUN.direction))
        .oneMinus()
        .div((BEAMS.warmth * BEAMS.warmth) / 2)
        .negate()
    ).mul(BEAMS.glow)
  );
  const hazeColor = mix(rgb(NEBULA.thin), rgb(NEBULA.thick), smoothstep(0.1, 0.7, billow));
  const space = rgb(SKY)
    .add(hazeColor.mul(haze))
    .add(cloudColor.add(starlit).mul(cloud.mul(NEBULA.strength)))
    .add(stars);

  const eclipse = eclipseAt(direction);

  return mix(space.add(eclipse.behind), eclipse.world, eclipse.cover).add(eclipse.halo);
}

/**
 * The empty space behind everything, looked at along each background pixel's direction in the world. The sky belongs
 * to directions rather than the screen, so it holds still while the camera turns.
 */
export const voidBackground = skyAt(normalize(positionLocal));
