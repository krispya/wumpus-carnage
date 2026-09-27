import type { World } from 'koota';
import { useEffect } from 'react';
import { directorActions } from './actions';

/** Space starts the animatic, or plays it again from the top. */
export function useReplayKey(world: World): void {
  useEffect(() => {
    const replay = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;

      event.preventDefault();
      directorActions(world).startScene();
    };

    window.addEventListener('keydown', replay);

    return () => window.removeEventListener('keydown', replay);
  }, [world]);
}
