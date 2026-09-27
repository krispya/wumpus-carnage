# wumpus-carnage

This project was generated with create-krispya

## Project Architecture

An animatic of the wumpus in a war it cannot win, painted in the palette of a hand-drawn space short: deep indigo
space, cobalt nebula, amber and ice-blue stars, lasers in gold, ice, crimson, and violet, and fire. It opens on a
still wide, composed on thirds, looking in on the system from far outside it: its star eclipsed by a dark world and
seen as through an ND filter, light beams fanning out through the dust, the battle a crossfire between, a meme-reel
insert slammed on for a beat, and a capital ship going up in a giant explosion. Then one unbroken move, after the
moment in Gravity an astronaut is torn loose: a frenzy on the wumpus, flailing in terror as the blast flings it
away, the frame rolling with its tumble so the fire whirls round it; a snap to a dead stop on the fire's heart as it
collapses into a pinprick of black; a long hold as the hole grows to fill the view and drags the wumpus back; then
the camera is taken too, outruns the wumpus to hang looking back as it bears down, stretching, lets it whip past,
and rides beside it as it slows at the horizon, wrung and stretched and reddening, until it is gone. The camera
pulls back to take in the hole, holds on it a beat, and is sucked in, harder and harder, through the horizon into
black and silence, and it all plays again. The hole is ray traced in the post pass: a bare Schwarzschild hole with
no disk, bending the whole frame round its shadow and dragging it round with its spin. It is rendered with WebGPU
and loops. The app is data oriented: all state lives in [Koota](https://github.com/pmndrs/koota) traits, systems are
plain functions over the world, and React only mounts scene objects and registers them with the world as views.

- `src/index.tsx` is the entry point, and `src/app.tsx` composes the canvas, the scene, and the post pass
- `src/world.ts` creates the world, and `src/frameloop.ts` runs its systems each frame: the simulation, then the views
- Each domain folder holds its `traits`, `systems`, `actions`, authored `content`, `materials`, and `renderer`
  - `time`: the bounded frame clock
  - `sequence`: a declarative script of timed and event cues
  - `director`: the animatic's script, its locked-off wide, the one-shot that rides with the wumpus into the hole,
    the meme insert laid over the frame, and the curtain
  - `transform`: where entities are, springy knocks, and the scene objects that show them
  - `viewport`: the camera, and the frame's shape
  - `motion`: zero-g coasting, slack tethers, and torque-free tumbling
  - `wumpus`: the model's rig, its floating performance, its terror and flinches, blinks, and leaf
  - `battle`: laser bolts, beams, close calls, flares, capital-ship fire in the far reaches, and the giant explosion,
    its light, burning debris, and remnant, drawn as instanced glows
  - `black-hole`: the hole, the light it bends, traced through a backdrop drawn without the wumpus, the dread it
    brings, and the capture, tide, and redshift that spaghettify the wumpus and swallow it
  - `sound`: recorded shots layered with synths, heard from wherever the camera is; the end scored as in Gravity,
    with the wumpus's racing heart in its ears, the swish of its tumble, its body straining and creaking, a rise that
    climbs with its tumble, space tearing, its last scream caught and held at the horizon; and the mixer that plays
    them
  - `void` and `post`: the painted sky, with its stars, nebula, and the eclipsed star and its light beams, the
    lighting, and bloom, vignette, grain, and dither
- `assets/` holds source models, sounds, and the insert's image, which Vite fingerprints on build

## Libraries

The following libraries are used - checkout the linked docs to learn more

- [Vite](https://vitejs.dev/) - Next generation frontend tooling
- [React Three Fiber](https://github.com/pmndrs/react-three-fiber) and [Three.js](https://threejs.org/) - WebGPU rendering
- [Koota](https://github.com/pmndrs/koota) - Entity component system state
- [math](https://github.com/pmndrs/math) - Vectors, quaternions, and noise

## Tools

- [Oxlint](https://oxc.rs/docs/guide/usage/linter) - A fast linter for JavaScript and TypeScript
- [Prettier](https://prettier.io/) - Opinionated code formatter

## Development Commands

- `pnpm install` to install the dependencies
- `pnpm run dev` to run the development server and preview the app with live updates
- `pnpm run build` to build the app into the `dist` folder
- `pnpm run test` to run the tests

The battle rages until "no wumpus no" is pressed, which starts the animatic, sound and all. M mutes it, and Space
starts it or plays it again from the top.

## Credits

This work is based on "[Wumpus](https://sketchfab.com/3d-models/wumpus-6f78088e749345358a3854b8fc98403d)" by
[酷樂家族](https://sketchfab.com/HomelineDoki.tw) licensed under
[CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/). The model's leaf material and rig are procedural additions.

Laser, impact, explosion, and thruster recordings are from [Sci-Fi Sounds](https://kenney.nl/assets/sci-fi-sounds),
and cloth and creak recordings from [RPG Audio](https://kenney.nl/assets/rpg-audio), both by
[Kenney](https://www.kenney.nl), released under [CC0](http://creativecommons.org/publicdomain/zero/1.0/).
