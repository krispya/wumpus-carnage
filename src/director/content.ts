import { vec3, type Vec3 } from 'math';
import thumbsUp from '../../assets/insert/wumpus-thumbs-up.jpeg';
import { SUN } from '../void/content';
import { WUMPUS_FLOAT } from '../wumpus/content';

/**
 * A locked-off shot: what it frames, where the camera stands and what it looks at, relative to where that was at the
 * cut, its lens, in degrees of vertical field, and its roll, in radians.
 */
export interface Still {
  kind: 'still';
  anchor: 'world' | 'wumpus';
  position: Vec3;
  target: Vec3;
  fov: number;
  roll: number;
}

/** The flight: one unbroken move with the wumpus, worked out as it plays from `FLIGHT_SHOT`. */
export interface Flight {
  kind: 'flight';
}

export type ShotName = 'system' | 'flight';

const up = vec3.fromValues(0, 1, 0);

/**
 * How the blast flings the wumpus: from `distance` units off it when it goes up, the shockwave throws it `delay`
 * seconds later along `direction` at `speed` units a second, tumbling hard with `momentum`, per unit of mass.
 */
export const EJECTION = {
  direction: [-1, 0.15, 0.35] as const,
  speed: 12,
  momentum: vec3.fromValues(1.2, 1.6, 2.4),
  distance: 90,
  delay: 0.3,
};

/** The frame the wumpus flies in: along the way it is flung, across it, and up. */
export const FLIGHT = (() => {
  const along = vec3.normalize(vec3.create(), vec3.fromValues(...EJECTION.direction));
  const across = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), along, up));
  const lifted = vec3.cross(vec3.create(), across, along);

  return { along, across, lifted };
})();

/** How the wumpus flies once flung. */
export const EJECTED = vec3.scale(vec3.create(), FLIGHT.along, EJECTION.speed);

/** Where the capital ship goes up: behind the wumpus, straight back along the way the blast flings it. */
export const BLAST_AT = vec3.scaleAndAdd(
  vec3.create(),
  vec3.fromValues(...WUMPUS_FLOAT.start),
  FLIGHT.along,
  -EJECTION.distance
);

/** `toward` turned `right` and `high` radians across a frame looking along it. */
function turnedFrom(toward: Vec3, right: number, high: number): Vec3 {
  const across = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), toward, up));
  const lifted = vec3.cross(vec3.create(), across, toward);
  const turned = vec3.scaleAndAdd(vec3.create(), toward, across, Math.tan(right));
  vec3.scaleAndAdd(turned, turned, lifted, Math.tan(high));

  return vec3.normalize(turned, turned);
}

/** A point `distance` units back from `from`, away from `toward`, so what lies that way is straight past it. */
function before(toward: Vec3, from: Vec3, distance: number): Vec3 {
  return vec3.scaleAndAdd(vec3.create(), from, toward, -distance);
}

/**
 * The wide, composed on thirds: the eclipsed star sits on the upper right third and the blast on the lower left
 * one, with the dust running under the blast. Recompose the camera for the frame's aspect so both subjects stay
 * visible in portrait. The camera stands far enough back from the blast that it fills a good part of its third.
 */
const WIDE = { fov: 46, aspect: 16 / 9, distance: 700 };
const thirdHigh = Math.atan(Math.tan((WIDE.fov * Math.PI) / 360) / 3);
let lastOpening: { aspect: number; shot: Still } | undefined;

export function openingShot(aspect: number): Still {
  if (lastOpening?.aspect === aspect) return lastOpening.shot;

  // Keep some of the wide's diagonal spread in portrait while bringing the star back inside the frame.
  const framingAspect = WIDE.aspect + (Math.min(aspect, WIDE.aspect) - WIDE.aspect) * 0.8;
  const thirdAcross = Math.atan((Math.tan((WIDE.fov * Math.PI) / 360) * framingAspect) / 3);
  const wideAim = turnedFrom(
    vec3.normalize(vec3.create(), vec3.fromValues(...SUN.direction)),
    -thirdAcross,
    -thirdHigh
  );
  const systemFrom = before(turnedFrom(wideAim, -thirdAcross, -thirdHigh), BLAST_AT, WIDE.distance);

  const shot: Still = {
    kind: 'still',
    anchor: 'world',
    position: systemFrom,
    target: vec3.scaleAndAdd(vec3.create(), systemFrom, wideAim, 1000),
    fov: WIDE.fov,
    roll: 0,
  };

  lastOpening = { aspect, shot };

  return shot;
}

/**
 * Every shot.
 *
 * - `system`: locked off, looking in toward the system's star from far outside the battle: a dark world eclipsing
 *   it, a sliver of it burning round the world's edge, light beams fanning out through the dust, the battle a
 *   glitter of fire between, and a capital ship going up in a giant explosion.
 * - `flight`: one unbroken move with the wumpus, after the moment in Gravity an astronaut is torn loose: see
 *   `FLIGHT_SHOT`.
 */
export const SHOTS: Record<ShotName, Still | Flight> = {
  system: openingShot(WIDE.aspect),
  flight: { kind: 'flight' },
};

/**
 * The flight, after the moment in Gravity an astronaut is torn loose, in seconds from the cut, world units, degrees
 * of lens, and radians.
 *
 * - `frenzy`: out of control: a medium close-up, about `distance` ahead of the wumpus and looking back past it into
 *   the fireball, lurching up to `swing` radians round it and `surge` of the way in and out, shaking by `shake`,
 *   and rolling `lock` of the way with its tumble, so the wumpus holds nearly still in the frame while the fire and
 *   the debris and the stars whirl round it, with dutch swings of up to `roll` besides.
 * - `settle`: in `seconds`, it lets go and snaps to a dead stop, level, overshooting a little, `ahead` units further
 *   along the wumpus's flight, `across` to the side and `up`, looking back `focus` of the way from the wumpus to
 *   the blast just as the hole opens in it: the hole is the centre of interest, and the wumpus sits in the
 *   foreground, off on a third.
 * - `fixate`: room to breathe: it holds there as the hole grows from a pinprick and brakes the wumpus, which drifts
 *   in close and is yanked back, tumbling away toward the hole, the lens tightening on it to `fov` over `seconds`.
 * - `plunge`: from `BEATS.taken` the hole takes the camera too, faster than the wumpus: over `seconds` it is dragged
 *   in along the line from where it stood, past the wumpus, swinging up to `aside` radians round the hole, until it
 *   hangs `hover` radii of the full-grown horizon from the middle, looking back, turned onto the wumpus over `turn`
 *   seconds, as it bears down, stretching, the lens keeping `frame` units across the wumpus in frame, however far
 *   off, no narrower than `narrowest` and no wider than `fov`, the frame rolling up to `roll`, shaking by `shake`.
 *   The wumpus whips past it, and over its next `pass` units the camera swings round to `chase` it.
 * - `chase`: beside the wumpus, `side` units off and `back` units up the line from the hole, its middle dead centre
 *   through a `fov` lens, as it slows at the horizon, wrung and stretched and reddening. The tracking shots pull
 *   further back as needed to fit its body and tidal stretch inside the viewport.
 * - `back`: once it is gone, the camera pulls back over `seconds` to `reach` radii of the full-grown horizon from the
 *   hole, or further to frame its lensing ring, turning onto it and levelling, the lens widening to `fov`, and
 *   holds on it for `look` seconds.
 * - `suck`: then the hole sucks the camera in, faster and faster, its distance closing as `e` to the minus `rate`
 *   times a third of the cube of the seconds gone, growing to its full intensity over `build` seconds: shaking by
 *   `shake` of its distance, rolling up to `roll` further, the lens stretching to `fov`, and the sky sweeping forward
 *   as it races in.
 */
export const FLIGHT_SHOT = {
  frenzy: {
    seconds: 3,
    distance: 6.5,
    swing: 0.75,
    surge: 0.25,
    lock: 0.85,
    shake: 0.16,
    fov: 40,
    roll: 0.4,
  },
  settle: { seconds: 0.8, ahead: 27, across: 4.5, up: 2.4, focus: 0.8, fov: 32 },
  fixate: { fov: 22, seconds: 4.7 },
  plunge: {
    seconds: 2.5,
    hover: 2.2,
    aside: 0.3,
    turn: 0.6,
    pass: 8,
    frame: 10,
    narrowest: 14,
    fov: 76,
    roll: 0.5,
    shake: 0.004,
  },
  chase: { side: 9, back: 3.5, fov: 46 },
  back: { seconds: 0.9, reach: 9, look: 1.1, fov: 60 },
  suck: { build: 1.6, rate: 1.4, shake: 0.02, roll: 1.1, fov: 92 },
};

/** The opening, in order, and how many seconds each shot holds before the cut to the next. Then the flight. */
export const OPENING: readonly { shot: ShotName; seconds: number }[] = [
  { shot: 'system', seconds: 4.3 },
];

/**
 * The animatic's beats, in seconds. `detonate` seconds into the wide the capital ship goes up, and its shockwave
 * flings the wumpus away. After the opening the camera cuts to the flight, the battle burned down to `after` of its
 * fury. At `birth`, the blast's heart collapses into a hole and the battle falls to `hush`. At `capture` the
 * hole takes hold of the wumpus, and at `taken` it takes the camera too. Once the camera is through the horizon the
 * dark and the silence hold for `hold` seconds before it all plays again.
 */
export const BEATS = {
  detonate: 2.2,
  after: 0.3,
  birth: 3,
  hush: 0.05,
  capture: 3.2,
  taken: 8.5,
  hold: 2.4,
};

/**
 * How fast the camera, riding in, can fall past the hole's still onlookers, as a share of light's speed, which
 * sweeps the sky forward round the hole ahead.
 */
export const INFALL = 0.96;

/**
 * The insert, as in a meme reel: `lead` seconds before the capital ship goes up, the image `src` slams onto the
 * frame, `height` of it tall, punching in from `punch` larger over `snap` seconds. It holds for `hold` seconds and
 * fades over `fade`, the blast going up behind it as it does.
 */
export const INSERT = {
  src: thumbsUp,
  lead: 0.9,
  height: 0.84,
  punch: 0.16,
  snap: 0.2,
  hold: 0.5,
  fade: 0.6,
};
