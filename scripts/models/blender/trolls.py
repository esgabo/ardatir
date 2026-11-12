"""Bert, Tom and William, the trolls of the Trollshaws: one troll body, three variants, each
living (Roast Mutton, by night) and in stone (The Troll Gold, after the dawn).

    blender --background --python scripts/models/blender/trolls.py -- [--only william]

For each troll writes `assets/characters/<id>/<id>.blend` and the raw exports
`out/models/<id>.glb` and `out/models/<id>-stone.glb`; `npm run model:pack` then compresses
each into assets/ (docs/MODELS.md). The stone ones are linked per event, from staging.

From The Hobbit, chapter 2 (our own designs, not the films'): three very large, coarse
creatures round a fire, quarrelling over their mutton. Huge and hunched, heads thrust forward,
arms hanging to the knee, lumpy grey-green hides, big noses and ears, crude leather and sacking.
Caught by the dawn, they turn to stone where they stand: the stone versions keep the poses
they were arguing in.
"""

import sys
from pathlib import Path

import bpy
from mathutils import Euler, Vector

sys.path.insert(0, str(Path(__file__).parent))
import hobbit_rig as base  # noqa: E402
import lowpoly as lp  # noqa: E402
import troll_rig as rig  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
HEIGHT = 2.8

TROLLS = {
    # William: the cook, a sacking apron, a little fatter
    'william': dict(skin='#7b8766', hair='#3e3a2c', rag='#6b5236', extra='apron', belly=1.15, nose=1.0,
                    stone='reach'),
    # Bert: a crude leather cap, the heaviest brow
    'bert': dict(skin='#867f6a', hair='#2f2a22', rag='#5a4630', extra='cap', belly=1.0, nose=0.95,
                 stone='shout'),
    # Tom: a tattered vest, the biggest nose, shaggy hair
    'tom': dict(skin='#6e7c5a', hair='#4a3f2c', rag='#7a6648', extra='vest', belly=0.95, nose=1.3,
                stone='squat'),
}

TORSO = [  # (z, centre y, half-width, half-depth): a pot belly and a hunched upper back
    (1.00, 0.02, 0.44, 0.36),
    (1.15, 0.00, 0.50, 0.44),
    (1.35, -0.04, 0.56, 0.52),
    (1.55, -0.03, 0.56, 0.50),
    (1.75, 0.03, 0.55, 0.44),
    (1.95, 0.08, 0.56, 0.40),
    (2.12, 0.06, 0.50, 0.36),
    (2.26, -0.06, 0.20, 0.20),
]

TORSO_WEIGHTS = lp.blend_weights([(1.22, 'hips'), (1.45, 'spine'), (1.62, 'spine'), (1.9, 'chest')])


class Troll:
    def __init__(self, tid, spec, stone=False):
        self.id, self.s, self.stone = tid, spec, stone
        self.j = rig.joints_for(HEIGHT)
        if stone:
            rock = lp.material('stone', '#8d8a82', roughness=1.0)
            dark = lp.material('stone_dark', '#6f6c66', roughness=1.0)
            self.skin = self.hair = self.rag = rock
            self.eye = self.mouth = dark
            self.tooth = rock
        else:
            self.skin = lp.material('skin', spec['skin'])
            self.hair = lp.material('hair', spec['hair'])
            self.rag = lp.material('rag', spec['rag'])
            self.eye = lp.material('eye', '#1e1a14', roughness=0.4)
            self.mouth = lp.material('mouth', '#4a2e26')
            self.tooth = lp.material('tooth', '#d8cfb4')
        self.seed = sum(map(ord, tid)) + (100 if stone else 0)

    def rough(self, bm, amount=0.018):
        self.seed += 1
        return lp.jitter(bm, amount, self.seed)

    def torso_at(self, z):
        cy, rx, ry = lp.profile_at(TORSO, z)
        bump = max(0.0, 1 - abs(z - 1.4) / 0.35)
        b = self.s['belly'] - 1
        return cy - 0.08 * b * bump, rx + 0.06 * b * bump, ry + 0.1 * b * bump

    def torso(self):
        rings = []
        for i in range(11):
            z = 1.0 + (2.26 - 1.0) * i / 10
            cy, rx, ry = self.torso_at(z)
            rings.append(((0, cy, z), rx, ry))
        return lp.Part('torso', self.rough(lp.loft(rings, sides=12), 0.025), self.skin, TORSO_WEIGHTS)

    def loincloth(self):
        rings = []
        for i in range(4):
            z = 0.9 + 0.38 * i / 3
            cy, rx, ry = self.torso_at(max(z, 1.0))
            grow = 0.035 + 0.04 * (1 - i / 3)
            rings.append(((0, cy, z), rx + grow, ry + grow))
        bm = self.rough(lp.loft(rings, sides=12, cap_start=False), 0.03)

        def weights(co):
            if co.z >= 1.12:
                return {'hips': 1.0}
            a = min(1.0, (1.12 - co.z) / 0.25) * 0.8
            left = min(1.0, max(0.0, 0.5 + co.x / 0.4))
            return {'hips': 1 - a, 'thigh.L': a * left, 'thigh.R': a * (1 - left)}
        cy, rx, ry = self.torso_at(1.24)
        belt = lp.loft([((0, cy, 1.22), rx + 0.05, ry + 0.05), ((0, cy, 1.27), rx + 0.05, ry + 0.05)], sides=12)
        return [lp.Part('loincloth', bm, self.rag, weights),
                lp.Part('rope', self.rough(belt, 0.01), self.hair, 'hips')]

    def extra(self):
        kind = self.s['extra']
        if kind == 'apron':
            # sacking tied over the belly, hanging over the loincloth
            return [lp.Part('apron', self.shell(0.98, 1.62, -0.95, 0.95, 0.03), self.rag,
                            lp.blend_weights([(1.3, 'hips'), (1.5, 'spine')]))]
        if kind == 'vest':
            # a tattered vest, open over the belly
            return [lp.Part('vest', self.shell(1.5, 2.14, 0.75, 2 * 3.14159 - 0.75, 0.025), self.rag, TORSO_WEIGHTS)]
        return []

    def shell(self, z0, z1, a0, a1, grow):
        """A rough garment hugging the body between two heights and two angles (0 = the front)."""
        rings = []
        for i in range(5):
            z = z0 + (z1 - z0) * i / 4
            cy, rx, ry = self.torso_at(z)
            rings.append(((0, cy, z), rx + grow, ry + grow))
        bm = lp.loft(rings, sides=8, arc=(a0, a1))
        return self.rough(lp.solidify(bm, 0.02), 0.02)

    def head(self):
        hc = Vector((0, -0.27, 2.52))
        nose = self.s['nose']
        parts = [
            lp.Part('skull', self.rough(lp.blob(hc, (0.2, 0.22, 0.2), subdiv=2), 0.015), self.skin, 'head'),
            lp.Part('jaw', self.rough(lp.blob(hc + Vector((0, -0.07, -0.13)), (0.23, 0.18, 0.12), subdiv=1), 0.015),
                    self.skin, 'head'),
            lp.Part('brow', self.rough(lp.box(hc + Vector((0, -0.19, 0.07)), (0.36, 0.1, 0.07)), 0.02), self.skin, 'head'),
            lp.Part('nose', self.rough(lp.blob(hc + Vector((0, -0.26, -0.03)), (0.06 * nose, 0.09 * nose, 0.08 * nose),
                                               subdiv=1), 0.01), self.skin, 'head'),
            lp.Part('mouth', lp.box(hc + Vector((0, -0.245, -0.135)), (0.2, 0.02, 0.025)), self.mouth, 'head'),
        ]
        for sgn in (1, -1):
            parts += [
                lp.Part('eye', lp.blob(hc + Vector((0.085 * sgn, -0.205, 0.025)), (0.022, 0.012, 0.018), subdiv=1),
                        self.eye, 'head'),
                lp.Part('ear', self.rough(lp.blob(hc + Vector((0.205 * sgn, 0.0, 0.0)), (0.045, 0.085, 0.11), subdiv=1,
                                                  rotation=Euler((0, 0, -0.3 * sgn)).to_matrix()), 0.012), self.skin, 'head'),
                lp.Part('tusk', lp.cone(hc + Vector((0.07 * sgn, -0.24, -0.15)), hc + Vector((0.075 * sgn, -0.25, -0.09)),
                                        0.018, sides=5), self.tooth, 'head'),
            ]
        if self.s['extra'] == 'cap':
            parts.append(lp.Part('cap', self.rough(lp.blob(hc + Vector((0, 0.01, 0.1)), (0.22, 0.24, 0.14), subdiv=2), 0.012),
                                 self.rag, 'head'))
        else:
            rnd = lp.seeded(self.seed)
            for i in range(9 if self.s['extra'] == 'vest' else 5):
                d = Vector((rnd.uniform(-0.7, 0.7), rnd.uniform(-0.2, 0.9), rnd.uniform(0.6, 1.0))).normalized()
                p = hc + Vector((d.x * 0.19, d.y * 0.21, d.z * 0.19))
                r = rnd.uniform(0.04, 0.06)
                parts.append(lp.Part('tuft', lp.blob(p, (r, r, r * 0.8), subdiv=1,
                                                     rotation=Euler((rnd.uniform(0, 3), 0, rnd.uniform(0, 3))).to_matrix()),
                                     self.hair, 'head'))
        return parts

    def limbs(self):
        parts = [lp.Part('neck', self.rough(lp.limb((0, 0.03, 2.12), (0, -0.2, 2.42), [0.22, 0.19, 0.17], sides=8)),
                         self.skin, lp.blend_weights([(2.25, 'neck'), (2.36, 'head')]))]
        for s in ('L', 'R'):
            g = lambda n: self.j[f'{n}.{s}']  # noqa: E731
            parts += [
                lp.Part(f'thigh.{s}', self.rough(lp.limb(g('hip') + Vector((0, 0, 0.06)), g('knee'), [0.23, 0.22, 0.18])),
                        self.skin, f'thigh.{s}'),
                lp.Part(f'knee.{s}', self.rough(lp.blob(g('knee'), (0.16, 0.16, 0.16), subdiv=1), 0.012), self.skin, f'shin.{s}'),
                lp.Part(f'shin.{s}', self.rough(lp.limb(g('knee'), g('ankle'), [0.16, 0.17, 0.13])), self.skin, f'shin.{s}'),
                lp.Part(f'shoulder.{s}', self.rough(lp.blob(g('shoulder') + Vector((0, 0, -0.04)), (0.2, 0.2, 0.17), subdiv=2), 0.012),
                        self.skin, lp.blend_weights([(1.95, f'upper_arm.{s}'), (2.12, 'chest')])),
                lp.Part(f'upper_arm.{s}', self.rough(lp.limb(g('shoulder'), g('elbow'), [0.17, 0.16, 0.14])),
                        self.skin, f'upper_arm.{s}'),
                lp.Part(f'elbow.{s}', self.rough(lp.blob(g('elbow'), (0.13, 0.13, 0.13), subdiv=1), 0.01), self.skin, f'forearm.{s}'),
                lp.Part(f'forearm.{s}', self.rough(lp.limb(g('elbow'), g('wrist'), [0.15, 0.16, 0.12])), self.skin, f'forearm.{s}'),
            ]
            # big hands, knuckles and a thumb
            w, tip = g('wrist'), g('hand_tip')
            c = w + (tip - w) * 0.5
            sgn = 1 if w.x > 0 else -1
            parts.append(lp.Part(f'hand.{s}', self.rough(lp.blob(c, (0.105, 0.12, 0.13), subdiv=2), 0.01), self.skin, f'hand.{s}'))
            parts.append(lp.Part(f'knuckles.{s}', self.rough(lp.box(c + Vector((0, -0.06, -0.06)), (0.17, 0.08, 0.08)), 0.01),
                                 self.skin, f'hand.{s}'))
            parts.append(lp.Part(f'thumb.{s}', self.rough(lp.blob(c + Vector((-0.05 * sgn, -0.09, 0.04)), (0.045, 0.05, 0.07), subdiv=1),
                                                          0.008), self.skin, f'hand.{s}'))
            # wide flat feet, toes
            x = g('ankle').x
            out = 0.04 * sgn
            sections = [(0.12, 0.08, 0.13, 0.08), (0.04, 0.1, 0.15, 0.1), (-0.12, 0.07, 0.17, 0.07),
                        (-0.3, 0.05, 0.17, 0.05), (-0.4, 0.045, 0.14, 0.045)]
            rings = [((x + out * max(0.0, -y) / 0.4, y, zc), rw, rh) for y, zc, rw, rh in sections]
            parts.append(lp.Part(f'foot.{s}', self.rough(lp.loft(rings, sides=8, u=Vector((1, 0, 0)), v=Vector((0, 0, 1))), 0.012),
                                 self.skin, f'foot.{s}'))
            for i, dx in enumerate((-0.1, -0.035, 0.03, 0.09)):
                parts.append(lp.Part('toe', lp.blob((x + out + dx * sgn, -0.43 + abs(dx) * 0.3, 0.04), (0.04, 0.045, 0.04), subdiv=1),
                                     self.skin, f'foot.{s}'))
        return parts

    def build(self):
        name = self.id + ('-stone' if self.stone else '')
        parts = [self.torso()] + self.loincloth() + self.extra() + self.head() + self.limbs()
        return lp.finish(name, parts)


def make(tid, spec, stone):
    lp.reset_scene()
    t = Troll(tid, spec, stone)
    name = tid + ('-stone' if stone else '')
    arm = base.build_armature(name, t.j, rig.BONES)
    mesh = t.build()
    base.bind(mesh, arm)
    table = rig.stone_clips(spec['stone']) if stone else rig.clips(HEIGHT, t.j)
    made = base.make_clips(arm, table, t.j)
    tris = sum(len(p.vertices) - 2 for p in mesh.data.polygons)
    out = ROOT / 'out' / 'models' / f'{name}.glb'
    out.parent.mkdir(parents=True, exist_ok=True)
    if not stone:
        blend = ROOT / 'assets' / 'characters' / tid / f'{tid}.blend'
        blend.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True)
    base.export_glb(out, [arm, mesh])
    print(f'{name}: {tris} triangles, {len(arm.data.bones)} bones, clips: ' + ', '.join(f'{n} ({f})' for n, f in made))


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    only = args[args.index('--only') + 1].split(',') if '--only' in args else list(TROLLS)
    for tid in only:
        make(tid, TROLLS[tid], stone=False)
        make(tid, TROLLS[tid], stone=True)


if __name__ == '__main__':
    main()
