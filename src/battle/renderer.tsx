import { useActions } from 'koota/react';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import { InstancedBufferAttribute, InstancedMesh, PlaneGeometry, PointLight } from 'three/webgpu';
import { battleActions } from './actions';
import { BLAST, BLAST_CAPACITY, BOLT_CAPACITY, FLARE_CAPACITY } from './content';
import { blastMaterial, boltMaterial, flareMaterial } from './materials';
import type { BattleDraw } from './traits';

/** An empty per-instance buffer, rewritten every frame. */
function buffer(capacity: number, size: number): InstancedBufferAttribute {
  return new InstancedBufferAttribute(new Float32Array(capacity * size), size);
}

/**
 * Every shot in one draw, every flare in another, and the blasts in a third. Each instance places itself from the
 * buffers the battle writes, so the meshes never move and are never culled.
 */
function createBattleDraw(): BattleDraw {
  const quad = new PlaneGeometry(1, 1);
  const boltStart = buffer(BOLT_CAPACITY, 3);
  const boltEnd = buffer(BOLT_CAPACITY, 3);
  const boltShape = buffer(BOLT_CAPACITY, 3);
  const boltColor = buffer(BOLT_CAPACITY, 3);
  const flareCentre = buffer(FLARE_CAPACITY, 4);
  const flareColor = buffer(FLARE_CAPACITY, 4);
  const bolts = new InstancedMesh(
    quad,
    boltMaterial(boltStart, boltEnd, boltShape, boltColor),
    BOLT_CAPACITY
  );
  const flares = new InstancedMesh(quad, flareMaterial(flareCentre, flareColor), FLARE_CAPACITY);
  const blastCentre = buffer(BLAST_CAPACITY, 4);
  const blastState = buffer(BLAST_CAPACITY, 3);
  const blasts = new InstancedMesh(quad, blastMaterial(blastCentre, blastState), BLAST_CAPACITY);

  for (const mesh of [bolts, flares, blasts]) {
    mesh.count = 0;
    mesh.frustumCulled = false;
  }

  bolts.name = 'battle-bolts';
  flares.name = 'battle-flares';
  blasts.name = 'battle-blasts';
  // A blast's light reaches as far as anything it matters to, undimmed by distance.
  const glow = new PointLight(BLAST.light.color, 0, 0, 0);
  glow.name = 'battle-blast-light';

  return {
    bolts,
    boltStart,
    boltEnd,
    boltShape,
    boltColor,
    flares,
    flareCentre,
    flareColor,
    blasts,
    blastCentre,
    blastState,
    glow,
  };
}

export function BattleRenderer() {
  const { mountBattleView, unmountBattleView } = useActions(battleActions);
  const view = useMemo(createBattleDraw, []);

  useLayoutEffect(() => {
    mountBattleView(view);

    return unmountBattleView;
  }, [view, mountBattleView, unmountBattleView]);

  useEffect(
    () => () => {
      view.bolts.geometry.dispose();
      view.bolts.dispose();
      view.flares.dispose();
      view.blasts.dispose();
    },
    [view]
  );

  return (
    <>
      <primitive object={view.bolts} />
      <primitive object={view.flares} />
      <primitive object={view.blasts} />
      <primitive object={view.glow} />
    </>
  );
}
