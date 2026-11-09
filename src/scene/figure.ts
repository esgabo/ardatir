import * as THREE from 'three';
import type { Character } from '../data/types';

/**
 * Placeholder low-poly figure with film-like proportions (small head, long body),
 * until real rigged glTF models replace it.
 */
export function createFigure(character: Character): THREE.Group {
  const s = character.scale ?? 1;
  const mat = new THREE.MeshStandardMaterial({ color: character.color, flatShading: true, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: '#e0b48f', flatShading: true });

  const fig = new THREE.Group();
  fig.name = character.id;
  fig.userData.characterId = character.id;

  const bodyH = 0.42 * s;
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.09 * s, 0.24 * s, 6), mat);
  legs.position.y = 0.12 * s;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.13 * s, bodyH, 6), mat);
  body.position.y = 0.24 * s + bodyH / 2;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075 * s, 0), skin);
  head.position.y = 0.24 * s + bodyH + 0.08 * s;
  fig.add(legs, body, head);

  // Selection ring, hidden until the character is picked.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.22 * s, 0.28 * s, 24),
    new THREE.MeshBasicMaterial({ color: '#ffd76a', side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.visible = false;
  ring.name = 'selection';
  fig.add(ring);

  fig.traverse((o) => { if (o instanceof THREE.Mesh && o !== ring) o.castShadow = true; });
  return fig;
}

export function setSelected(fig: THREE.Object3D, on: boolean): void {
  const ring = fig.getObjectByName('selection');
  if (ring) ring.visible = on;
}
