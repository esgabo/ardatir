"""Thorin and the twelve dwarves of his company: one dwarf body, thirteen variants.

    blender --background --python scripts/models/blender/dwarves.py -- [--only thorin,balin]

For each dwarf writes `assets/characters/<id>/<id>.blend` and the raw export
`out/models/<id>.glb`; `npm run model:pack` then compresses each into assets/ (docs/MODELS.md).

From The Hobbit, chapter 1 (our own designs, not the films'): every dwarf comes hooded, and
the book gives the hoods' colours as they arrive at Bag End: Dwalin dark green; Balin scarlet;
Fíli and Kíli blue; then Dori, Nori, Ori, Óin and Glóin two purple, a grey, a brown and a white
(we read them in that order); Bifur and Bofur yellow and Bombur pale green; Thorin sky blue
with a long silver tassel. The book names few beards: Balin's white, Dwalin's blue and tucked
into a golden belt, Fíli and Kíli's yellow. Every other beard, tunic and build is our call:
Bombur very stout, Dori broad and strong, Fíli and Kíli young with shorter beards.
"""

import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Euler, Vector

sys.path.insert(0, str(Path(__file__).parent))
import dwarf_rig as rig  # noqa: E402
import hobbit_rig as base  # noqa: E402
import lowpoly as lp  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
HEIGHT = 1.35

# id: hood, tunic, trousers, belt, beard colour, beard style, beard length (tip z), width, belly
DWARVES = {
    'thorin': dict(hood='#79aee0', tunic='#2e3f5c', trousers='#3a3530', belt='#d2a640', beard='#3b3634',
                   style='long', tip=0.74, width=1.04, belly=0.1, tassel='#d8dce4'),
    'balin': dict(hood='#b8322a', tunic='#6b4a32', trousers='#4a3a2c', belt='#5a3e26', beard='#ece8e0',
                  style='long', tip=0.70, width=1.0, belly=0.45),
    'dwalin': dict(hood='#2f5a34', tunic='#5a4a3a', trousers='#3a3a34', belt='#d4a640', beard='#4466a8',
                   style='tucked', tip=0.62, width=1.06, belly=0.15),
    'fili': dict(hood='#3f63a8', tunic='#6a5636', trousers='#3e3a34', belt='#c9ccd2', beard='#d8b04a',
                 style='short', tip=0.93, width=0.97, belly=0.0),
    'kili': dict(hood='#3f63a8', tunic='#4a5a6a', trousers='#3a3632', belt='#c9ccd2', beard='#c79c3c',
                 style='short', tip=0.97, width=0.96, belly=0.0),
    'dori': dict(hood='#6b3f7a', tunic='#5a4a52', trousers='#3a3436', belt='#6a4a2a', beard='#7a6a5a',
                 style='long', tip=0.72, width=1.12, belly=0.3),
    'nori': dict(hood='#7d4a8e', tunic='#4a4a5a', trousers='#343238', belt='#5a3e26', beard='#8a5a3a',
                 style='braided', tip=0.80, width=1.0, belly=0.15),
    'ori': dict(hood='#8a8c90', tunic='#6a6a4a', trousers='#44403a', belt='#5a3e26', beard='#6a4a32',
                style='short', tip=0.90, width=0.95, belly=0.05),
    'oin': dict(hood='#6a4a2e', tunic='#4a5a4a', trousers='#3a3832', belt='#5a3e26', beard='#a09a92',
                style='forked', tip=0.74, width=1.0, belly=0.3),
    'gloin': dict(hood='#e6e2d8', tunic='#8a3a3a', trousers='#3c3430', belt='#6a4a2a', beard='#9a4a26',
                  style='long', tip=0.72, width=1.03, belly=0.35),
    'bifur': dict(hood='#d8b830', tunic='#5a6a5a', trousers='#3a3a32', belt='#5a3e26', beard='#3a2a22',
                  style='bushy', tip=0.88, width=1.0, belly=0.2),
    'bofur': dict(hood='#e0c040', tunic='#7a5a2a', trousers='#3e362c', belt='#5a3e26', beard='#5a3a22',
                  style='forked', tip=0.78, width=1.0, belly=0.2),
    'bombur': dict(hood='#a8c890', tunic='#8a6a4a', trousers='#4a3e30', belt='#5a3e26', beard='#b07a3a',
                   style='long', tip=0.72, width=1.18, belly=1.7),
}

# The tunic's cross-sections from the hem up: (z, centre y, half-width, half-depth), before
# each dwarf's width and belly.
TUNIC = [
    (0.40, 0.000, 0.178, 0.140),
    (0.50, 0.000, 0.180, 0.142),
    (0.62, -0.010, 0.182, 0.150),
    (0.72, -0.020, 0.188, 0.158),
    (0.84, -0.015, 0.198, 0.150),
    (0.96, 0.000, 0.208, 0.132),
    (1.04, 0.010, 0.190, 0.112),
    (1.09, 0.015, 0.075, 0.070),
]


class Dwarf:
    def __init__(self, did, spec):
        self.id = did
        self.s = spec
        self.j = rig.joints_for(HEIGHT, spec['width'])
        m = lambda n, c, **k: lp.material(n, c, **k)  # noqa: E731
        self.skin = m('skin', '#d9a988')
        self.hood = m('hood', spec['hood'])
        self.tunic = m('tunic', spec['tunic'])
        self.trousers = m('trousers', spec['trousers'])
        metal = spec['belt'] in ('#d2a640', '#d4a640', '#c9ccd2')
        self.belt = m('belt', spec['belt'], roughness=0.35 if metal else 0.8, metallic=0.7 if metal else 0.0)
        self.buckle = m('buckle', '#c9a24a', roughness=0.35, metallic=0.7)
        self.beard = m('beard', spec['beard'])
        self.boot = m('boot', '#4a3424')
        self.leather = m('leather', '#5e4330')
        self.eye = m('eye', '#2b2018', roughness=0.4)

    # the tunic's shape at height z, with this dwarf's width and belly
    def torso_at(self, z):
        cy, rx, ry = lp.profile_at(TUNIC, z)
        bump = max(0.0, 1 - abs(z - 0.73) / 0.16)
        b = self.s['belly']
        return cy - 0.035 * b * bump, rx * self.s['width'] + 0.02 * b * bump, ry + 0.05 * b * bump

    def front_y(self, z):
        cy, rx, ry = self.torso_at(z)
        return cy - ry

    def tunic_weights(self, co):
        z = co.z
        if z >= 0.62:
            return lp.blend_weights([(0.66, 'hips'), (0.78, 'spine'), (0.84, 'spine'), (0.96, 'chest')])(co)
        a = min(1.0, (0.62 - z) / 0.27) * 0.8
        left = min(1.0, max(0.0, 0.5 + co.x / 0.18))
        return {'hips': 1 - a, 'thigh.L': a * left, 'thigh.R': a * (1 - left)}

    def tunic_part(self):
        rings = []
        for i in range(12):
            z = 0.40 + (1.09 - 0.40) * i / 11
            cy, rx, ry = self.torso_at(z)
            rings.append(((0, cy, z), rx, ry))
        return lp.Part('tunic', lp.loft(rings, sides=12), self.tunic, self.tunic_weights)

    def belt_parts(self):
        cy, rx, ry = self.torso_at(0.62)
        rings = [((0, cy, 0.60), rx + 0.008, ry + 0.008), ((0, cy, 0.645), rx + 0.008, ry + 0.008)]
        w = lp.blend_weights([(0.62, 'hips'), (0.7, 'spine')])
        return [lp.Part('belt', lp.loft(rings, sides=12), self.belt, w),
                lp.Part('buckle', lp.box((0, cy - ry - 0.012, 0.6225), (0.055, 0.012, 0.05)), self.buckle, w)]

    def cape(self):
        """A short hooded cape over the shoulders, open a little at the front."""
        bm = bmesh.new()
        sides, levels = 18, 6
        grid = []
        for i in range(levels):
            f = i / (levels - 1)
            row = []
            gap = 0.62 - 0.4 * f   # a V at the front, wider at the hem
            for k in range(sides + 1):
                a = gap + (2 * math.pi - 2 * gap) * k / sides
                back = (1 - math.cos(a)) / 2
                z_bottom = 0.86 - 0.05 * back
                z = z_bottom + (1.075 - z_bottom) * f
                cy, rx, ry = self.torso_at(min(z, 1.045))
                grow = 0.022 + 0.05 * (1 - f) ** 1.5
                row.append(bm.verts.new(Vector((math.sin(a) * (rx + grow), cy - math.cos(a) * (ry + grow * 1.3), z))))
            grid.append(row)
        for r0, r1 in zip(grid, grid[1:]):
            for k in range(sides):
                bm.faces.new((r0[k], r0[k + 1], r1[k + 1], r1[k]))
        lp.solidify(bm, 0.009)

        def weights(co):
            # the cape's sides ride on the shoulders, so the arms carry them a little
            side = 'L' if co.x > 0 else 'R'
            a = max(0.0, min(1.0, (abs(co.x) - 0.12) / 0.1)) * max(0.0, min(1.0, (1.02 - co.z) / 0.12)) * 0.6
            return {'chest': 1 - a, f'upper_arm.{side}': a}
        return lp.Part('cape', bm, self.hood, weights)

    def hood_parts(self, hc):
        """The hood round the head, open for the face, its point falling back."""
        centre = hc + Vector((0, 0.02, 0.005))
        bm = lp.blob(centre, (0.124, 0.134, 0.138), subdiv=2)
        doomed = []
        for v in bm.verts:
            d = (v.co - centre).normalized()
            if (d.y < -0.5 and -0.75 < d.z < 0.42) or d.z < -0.78:
                doomed.append(v)
        bmesh.ops.delete(bm, geom=doomed, context='VERTS')
        lp.solidify(bm, 0.01)
        parts = [lp.Part('hood', bm, self.hood, 'head'),
                 lp.Part('hood_point', lp.cone(hc + Vector((0, 0.075, 0.06)), hc + Vector((0, 0.2, 0.03)), 0.065, sides=7),
                         self.hood, 'head')]
        if 'tassel' in self.s:
            silver = lp.material('tassel', self.s['tassel'], roughness=0.3, metallic=0.6)
            tip = hc + Vector((0, 0.195, 0.03))
            parts += [lp.Part('tassel_cord', lp.limb(tip, tip + Vector((0, 0.04, -0.16)), [0.008, 0.007], sides=5),
                              silver, 'head'),
                      lp.Part('tassel', lp.cone(tip + Vector((0, 0.04, -0.15)), tip + Vector((0, 0.045, -0.24)), 0.022, sides=6),
                              silver, 'head')]
        return parts

    def face(self, hc):
        parts = [
            lp.Part('skull', lp.blob(hc, (0.088, 0.096, 0.105), subdiv=2), self.skin, 'head'),
            lp.Part('nose', lp.blob(hc + Vector((0, -0.098, -0.02)), (0.024, 0.026, 0.03), subdiv=1), self.skin, 'head'),
        ]
        for sgn in (1, -1):
            parts += [
                lp.Part('eye', lp.blob(hc + Vector((0.032 * sgn, -0.086, 0.008)), (0.009, 0.006, 0.008), subdiv=1),
                        self.eye, 'head'),
                lp.Part('brow', lp.jitter(lp.box(hc + Vector((0.035 * sgn, -0.092, 0.03)), (0.045, 0.022, 0.018),
                                                 rotation=Euler((0.1, -0.12 * sgn, 0.1 * sgn)).to_matrix()), 0.003, 6),
                        self.beard, 'head'),
                lp.Part('moustache', lp.blob(hc + Vector((0.034 * sgn, -0.104, -0.045)), (0.04, 0.022, 0.02), subdiv=1,
                                             rotation=Euler((0, 0.4 * sgn, 0)).to_matrix()), self.beard, 'head'),
            ]
        return parts

    def beard_parts(self, hc):
        style, tip = self.s['style'], self.s['tip']
        top = hc.z - 0.03

        def section(z, rx, ry):
            # hug the face at the top, then the chest and belly further down
            if z > 1.06:
                y = -0.075 - (top - z) * 0.5
            else:
                y = self.front_y(z) - ry * 0.55
            return ((0, y, z), rx, ry)

        def strand(x_off, z0, z1, r0, r1, n=6, seed=1):
            rings = []
            for i in range(n):
                f = i / (n - 1)
                z = z0 + (z1 - z0) * f
                (cx, cy, cz), rx, ry = section(z, r0 + (r1 - r0) * f, (r0 + (r1 - r0) * f) * 0.5)
                rings.append(((x_off * f ** 0.7, cy, cz), rx, ry))
            return lp.jitter(lp.loft(rings, sides=7), 0.006, seed)

        weights = lp.blend_weights([(0.9, 'beard_low'), (1.0, 'beard'), (1.06, 'beard'), (1.12, 'head')])
        if style == 'tucked':
            # into the belt: the lower part rides on the body instead of swinging
            weights = lp.blend_weights([(0.7, 'spine'), (0.82, 'beard'), (1.06, 'beard'), (1.12, 'head')])
        upper_end = 0.98 if style in ('forked',) else tip
        rings = []
        widths = {'bushy': 1.25, 'short': 0.9}.get(style, 1.0)
        n = 9
        for i in range(n):
            f = i / (n - 1)
            z = top + (upper_end - top) * f
            if style == 'tucked':
                rx = (0.085 + 0.04 * math.sin(min(1.0, f * 1.6) * math.pi / 2)) * widths
            else:
                rx = (0.07 + 0.05 * math.sin(min(1.0, f * 2.2) * math.pi / 2)) * widths * (1 - f ** 1.6 * (0.85 if style != 'forked' else 0.2))
            ry = max(0.012, rx * 0.45)
            rings.append(section(z, rx, ry))
        parts = [lp.Part('beard', lp.jitter(lp.loft(rings, sides=8), 0.007, sum(map(ord, self.id))), self.beard, weights)]
        if style == 'forked':
            for sgn in (1, -1):
                parts.append(lp.Part('fork', strand(0.05 * sgn, 1.0, tip, 0.05, 0.012, seed=3 + sgn), self.beard, weights))
        if style == 'braided':
            for sgn in (1, -1):
                parts.append(lp.Part('braid', strand(0.03 * sgn, tip + 0.06, tip - 0.1, 0.022, 0.012, n=5, seed=8 + sgn),
                                     self.beard, weights))
        return parts

    def legs(self):
        parts = []
        for s in ('L', 'R'):
            hip, knee, ankle = self.j[f'hip.{s}'], self.j[f'knee.{s}'], self.j[f'ankle.{s}']
            parts.append(lp.Part(f'thigh.{s}', lp.limb(hip + Vector((0, 0, 0.02)), knee, [0.08, 0.078, 0.066]),
                                 self.trousers, f'thigh.{s}'))
            parts.append(lp.Part(f'knee.{s}', lp.blob(knee, (0.062, 0.062, 0.062), subdiv=1), self.trousers, f'shin.{s}'))
            parts.append(lp.Part(f'shin.{s}', lp.limb(knee, ankle, [0.06, 0.056]), self.trousers, f'shin.{s}'))
            # heavy boots: a wide cuffed shaft and a broad foot
            parts.append(lp.Part(f'shaft.{s}', lp.limb(ankle + Vector((0, 0, -0.03)), ankle + Vector((0, 0, 0.17)),
                                                       [0.07, 0.072, 0.08], sides=8), self.boot, f'shin.{s}'))
            x = ankle.x
            out = 0.015 * (1 if x > 0 else -1)
            sections = [(0.07, 0.05, 0.058, 0.05), (0.02, 0.065, 0.068, 0.065), (-0.06, 0.05, 0.07, 0.05),
                        (-0.14, 0.035, 0.066, 0.035), (-0.19, 0.03, 0.055, 0.03), (-0.21, 0.026, 0.035, 0.022)]
            rings = [((x + out * max(0.0, -y) / 0.21, y, zc), rw, rh) for y, zc, rw, rh in sections]
            parts.append(lp.Part(f'boot.{s}', lp.loft(rings, sides=8, u=Vector((1, 0, 0)), v=Vector((0, 0, 1))),
                                 self.boot, f'foot.{s}'))
        return parts

    def arms(self):
        parts = []
        for s in ('L', 'R'):
            sh, el, wr, tip = (self.j[f'{n}.{s}'] for n in ('shoulder', 'elbow', 'wrist', 'hand_tip'))
            d = (wr - el).normalized()
            parts += [
                lp.Part(f'shoulder.{s}', lp.blob(sh + Vector((0, 0.0, -0.01)), (0.07, 0.072, 0.065), subdiv=2),
                        self.tunic, lp.blend_weights([(0.97, f'upper_arm.{s}'), (1.04, 'chest')])),
                lp.Part(f'upper_arm.{s}', lp.limb(sh, el, [0.068, 0.064, 0.058]), self.tunic, f'upper_arm.{s}'),
                lp.Part(f'elbow.{s}', lp.blob(el, (0.056, 0.056, 0.056), subdiv=1), self.tunic, f'forearm.{s}'),
                lp.Part(f'forearm.{s}', lp.limb(el, wr, [0.056, 0.054, 0.05]), self.tunic, f'forearm.{s}'),
                lp.Part(f'bracer.{s}', lp.limb(wr - d * 0.07, wr + d * 0.005, [0.058, 0.055], sides=8),
                        self.leather, f'forearm.{s}'),
                lp.Part(f'hand.{s}', lp.blob(wr + (tip - wr) * 0.5, (0.034, 0.044, 0.05), subdiv=1), self.skin, f'hand.{s}'),
            ]
        return parts

    def build(self):
        hc = Vector((0, -0.005, 1.225))
        parts = [self.tunic_part()] + self.belt_parts() + [self.cape()]
        parts.append(lp.Part('neck', lp.limb((0, 0.015, 1.05), (0, 0.01, 1.16), [0.06, 0.058], sides=8), self.skin,
                             lp.blend_weights([(1.08, 'neck'), (1.13, 'head')])))
        parts += self.face(hc) + self.hood_parts(hc) + self.beard_parts(hc) + self.legs() + self.arms()
        return lp.finish(self.id, parts)


def make(did, spec):
    lp.reset_scene()
    d = Dwarf(did, spec)
    arm = base.build_armature(did, d.j, rig.BONES)
    mesh = d.build()
    base.bind(mesh, arm)
    made = base.make_clips(arm, rig.clips(HEIGHT, d.j), d.j)
    tris = sum(len(p.vertices) - 2 for p in mesh.data.polygons)
    blend = ROOT / 'assets' / 'characters' / did / f'{did}.blend'
    out = ROOT / 'out' / 'models' / f'{did}.glb'
    blend.parent.mkdir(parents=True, exist_ok=True)
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True)
    base.export_glb(out, [arm, mesh])
    print(f'{did}: {tris} triangles, {len(arm.data.bones)} bones, clips: ' + ', '.join(f'{n} ({f})' for n, f in made))


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    only = args[args.index('--only') + 1].split(',') if '--only' in args else list(DWARVES)
    for did in only:
        make(did, DWARVES[did])


if __name__ == '__main__':
    main()
