import { createActions, type Entity } from 'koota';
import type { Object3D } from 'three/webgpu';
import { TransformView } from './traits';

export const transformActions = createActions(() => ({
  mountTransformView: (entity: Entity, object: Object3D) => {
    entity.add(TransformView(object));
  },
  unmountTransformView: (entity: Entity) => {
    entity.remove(TransformView);
  },
}));
