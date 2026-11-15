// Contact shadows: a soft dark disc under each figure, on the ground.
//
// The sun's shadow map says where a figure's shadow falls; it is not good at saying where the
// figure *touches*, which at this scale is what tells the eye how big everything is. A hobbit
// whose feet have no darkness under them floats over the tile however correct the long shadow
// behind him is. These discs cost four triangles each and one shared texture, so they stay on at
// every quality — on `low`, with the shadow map gone, they are the only thing holding anyone down.
//
// They are not ambient occlusion and they do not pretend to be: a screen-space AO pass would be
// a second render of the frame and the first thing to fail on a phone. This is the cheap half of
// the job, which happens to be the half that matters most here.

import * as THREE from 'three';

export interface Spot {
  x: number;
  y: number;
  z: number;
  /** Roughly how wide the figure is on the ground. */
  radius: number;
}

export interface ContactShadows {
  group: THREE.Group;
  /** `strength` 0 to 1: how dark the ground goes under a figure in this light. */
  update(spots: readonly Spot[], strength: number): void;
  dispose(): void;
}

/** A soft round blot, darkest in the middle, fading to nothing at the rim. */
function discTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.4, 'rgba(0,0,0,0.78)');
    g.addColorStop(0.75, 'rgba(0,0,0,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return new THREE.CanvasTexture(canvas);
}

/**
 * How far above the ground the discs sit.
 *
 * Higher than it looks like it should be, and for a reason worth knowing: `groundHeight` reports
 * the height of the kit's `terrain` mesh, which is what characters stand on, but a kit also draws
 * its lawn, paving and path as separate meshes a little above that. A disc lifted by a hair is
 * buried under them and never appears at all. This clears the ones the Shire, Trollshaws and
 * Rivendell kits build; the cost is that the disc reads very slightly up-slope of the feet.
 *
 * The real fix is for a kit's walkable `terrain` and its visible ground to be the same surface,
 * which would also stop characters standing a little sunk into the lawn.
 */
const LIFT = 0.22;

export function createContactShadows(): ContactShadows {
  const group = new THREE.Group();
  group.name = 'contact-shadows';
  const texture = discTexture();
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, depthWrite: false, opacity: 0, color: '#000000',
  });
  const discs: THREE.Mesh[] = [];

  return {
    group,
    update(spots, strength) {
      material.opacity = Math.min(1, Math.max(0, strength));
      group.visible = material.opacity > 0.01;
      while (discs.length < spots.length) {
        const disc = new THREE.Mesh(geometry, material);
        disc.rotation.x = -Math.PI / 2;
        disc.renderOrder = 1; // after the ground, so it blends onto what is already there
        discs.push(disc);
        group.add(disc);
      }
      discs.forEach((disc, i) => {
        const spot = spots[i];
        disc.visible = !!spot;
        if (!spot) return;
        disc.position.set(spot.x, spot.y + LIFT, spot.z);
        disc.scale.setScalar(spot.radius * 2);
      });
    },
    dispose() {
      group.removeFromParent();
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
