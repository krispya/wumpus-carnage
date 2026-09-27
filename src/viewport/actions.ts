import { createActions } from 'koota';
import { Viewport } from './traits';

export const viewportActions = createActions((world) => ({
  setViewport: (aspect: number) => {
    world.set(Viewport, { aspect });
  },
}));
