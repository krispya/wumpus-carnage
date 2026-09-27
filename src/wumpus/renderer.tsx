import { useLoader } from '@react-three/fiber/webgpu';
import type { Entity } from 'koota';
import { useActions, useQuery } from 'koota/react';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FOREGROUND } from '../black-hole/content';
import { Box3, type Group, type Material, Mesh, MeshStandardMaterial, Vector3 } from 'three/webgpu';
import { withSidecars } from '../loading/gltf';
import { transformActions } from '../transform/actions';
import { wumpusActions } from './actions';
import { EYE_MESH, LEAF_MESH, WUMPUS_HEIGHT } from './content';
import { eyeMaterial, leafMaterial, stretchable } from './materials';
import { rigModel } from './rig';
import { Wumpus } from './traits';

const files = import.meta.glob<string>('../../assets/wumpus/*.{gltf,bin}', {
  query: '?url',
  import: 'default',
  eager: true,
});
const modelUrl = files['../../assets/wumpus/scene.gltf']!;
const sidecars = withSidecars(files);

useLoader.preload(GLTFLoader, modelUrl, sidecars);

export function WumpusRenderer() {
  return useQuery(Wumpus).map((entity) => <WumpusModel key={entity} entity={entity} />);
}

function WumpusModel({ entity }: { readonly entity: Entity }) {
  const { mountTransformView, unmountTransformView } = useActions(transformActions);
  const { mountWumpusRig, unmountWumpusRig } = useActions(wumpusActions);
  const model = useLoader(GLTFLoader, modelUrl, sidecars);
  const root = useRef<Group>(null);

  // Centre the model on its middle so it turns about its belly, size it to stand at its height, grow its leaf, wet
  // its eyes, let every part of it be spaghettified, and rig it.
  const { scene, offset, scale, materials, rig } = useMemo(() => {
    const owned = model.scene.clone();
    const bounds = new Box3().setFromObject(owned);
    const leafMesh = owned.getObjectByName(LEAF_MESH) as Mesh;
    const eyeMesh = owned.getObjectByName(EYE_MESH) as Mesh;
    const made = new Map<Material, Material>();
    leafMesh.material = leafMaterial();
    eyeMesh.material = eyeMaterial(eyeMesh.material as MeshStandardMaterial);

    owned.traverse((object) => {
      if (!(object instanceof Mesh)) return;

      const material = object.material as Material;

      if (material instanceof MeshStandardMaterial && !made.has(material)) {
        made.set(material, stretchable(material));
      }

      object.material = made.get(material) ?? material;
    });

    const rig = rigModel(owned);

    // Every part of it, the rig's pieces too: the tide carries parts far from where they were modelled, so none can
    // be culled by where it began, and it stands in front of the hole's bent light, not in it.
    owned.traverse((object) => {
      if (!(object instanceof Mesh)) return;

      object.frustumCulled = false;
      object.layers.set(FOREGROUND);
    });

    return {
      scene: owned,
      offset: bounds.getCenter(new Vector3()).negate(),
      scale: WUMPUS_HEIGHT / bounds.getSize(new Vector3()).y,
      materials: [leafMesh.material, eyeMesh.material, ...made.values()] as Material[],
      rig,
    };
  }, [model.scene]);

  useEffect(() => () => materials.forEach((material) => material.dispose()), [materials]);

  useLayoutEffect(() => {
    mountWumpusRig(entity, rig);

    return () => unmountWumpusRig(entity);
  }, [entity, rig, mountWumpusRig, unmountWumpusRig]);

  useLayoutEffect(() => {
    mountTransformView(entity, root.current!);

    return () => unmountTransformView(entity);
  }, [entity, mountTransformView, unmountTransformView]);

  return (
    <group ref={root} name="wumpus">
      {/* The model faces its own -z, and the half turn faces it toward the camera. */}
      <group rotation-y={Math.PI} scale={scale}>
        <group position={offset}>
          <primitive object={scene} />
        </group>
      </group>
    </group>
  );
}
