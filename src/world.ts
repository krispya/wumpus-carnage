import { createWorld } from 'koota';
import { actions } from './actions';
import { Dread } from './black-hole/traits';
import { Curtain, Framing, Insert, Shot, Show } from './director/traits';
import { Timeline } from './sequence/traits';
import { Time } from './time/traits';
import { Viewport } from './viewport/traits';

/** The application shares one initialized world across its domains. */
export const world = createWorld(
  Time,
  Viewport,
  Timeline,
  Curtain,
  Dread,
  Shot,
  Framing,
  Insert,
  Show
);
actions(world).initializeScene();
