import { createActions } from 'koota';
import { battleActions } from './battle/actions';
import { blackHoleActions } from './black-hole/actions';
import { directorActions } from './director/actions';
import { sequenceActions } from './sequence/actions';
import { soundActions } from './sound/actions';
import { transformActions } from './transform/actions';
import { viewportActions } from './viewport/actions';
import { wumpusActions } from './wumpus/actions';

/** Domain commands share one action set for application composition and input. */
export const actions = createActions((world) => ({
  ...battleActions(world),
  ...blackHoleActions(world),
  ...directorActions(world),
  ...sequenceActions(world),
  ...soundActions(world),
  ...transformActions(world),
  ...viewportActions(world),
  ...wumpusActions(world),
}));
