import { useThree } from '@react-three/fiber/webgpu';
import { useActions, useTrait, useWorld } from 'koota/react';
import { useLayoutEffect } from 'react';
import type { PerspectiveCamera } from 'three/webgpu';
import { directorActions } from './actions';
import { Show } from './traits';

/** Hand the camera to the director, which frames every shot from here. */
export function ShotRenderer() {
  const { mountShotView, unmountShotView } = useActions(directorActions);
  const camera = useThree((state) => state.camera);

  useLayoutEffect(() => {
    mountShotView(camera as PerspectiveCamera);

    return unmountShotView;
  }, [camera, mountShotView, unmountShotView]);

  return null;
}

/** Over the battle, until the animatic starts, the button that starts it. */
export function StartButton() {
  const show = useTrait(useWorld(), Show);
  const { startScene } = useActions(directorActions);

  return (
    <button
      type="button"
      className="start"
      data-hidden={show?.started ? '' : undefined}
      onClick={startScene}
    >
      no wumpus no
    </button>
  );
}
