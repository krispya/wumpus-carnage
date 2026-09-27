import { Group, Mesh, type Object3D, Vector3 } from 'three/webgpu';
import { splitIslands } from '../loading/islands';
import {
  BODY_NODE,
  JOINT_PARENTS,
  JOINTS,
  type Joint,
  jointAt,
  LEAF,
  LEAF_MESH,
  PIVOTS,
} from './content';
import type { WumpusRigDraw } from './traits';

/**
 * Rig the model in place. It is built like a toy, from separate rigid pieces, so each piece of every body mesh
 * moves to a group at the joint it hangs from, and the leaf's node hinges from the head at its stem.
 */
export function rigModel(scene: Object3D): WumpusRigDraw {
  const body = scene.getObjectByName(BODY_NODE)!;
  const joints = {} as Record<Joint, Group>;

  // Each joint sits at its pivot, measured from its parent's pivot when it rides on another joint.
  for (const joint of JOINTS) {
    const group = new Group();
    const parent = JOINT_PARENTS[joint];
    group.name = `wumpus-${joint}`;
    group.position.fromArray(PIVOTS[joint]);

    if (parent === undefined) body.add(group);
    else {
      group.position.sub(new Vector3(...PIVOTS[parent]));
      joints[parent].add(group);
    }

    joints[joint] = group;
  }

  for (const mesh of body.children.filter((child): child is Mesh => child instanceof Mesh)) {
    for (const { geometry, centroid } of splitIslands(mesh.geometry)) {
      const joint = jointAt(centroid.x, centroid.y, centroid.z);
      const piece = new Mesh(geometry, mesh.material);
      piece.name = mesh.name;
      piece.position.fromArray(PIVOTS[joint]).negate();
      joints[joint].add(piece);
    }

    mesh.removeFromParent();
  }

  scene.updateMatrixWorld(true);

  const leafNode = scene.getObjectByName(LEAF_MESH)!.parent!;
  const leaf = new Group();
  leaf.name = 'wumpus-leaf';
  joints.head.add(leaf);
  leaf.position.copy(joints.head.worldToLocal(leafNode.localToWorld(new Vector3(...LEAF.stem))));
  leaf.updateMatrixWorld(true);
  leaf.attach(leafNode);

  return { joints, leaf, neck: joints.head.position.clone() };
}
