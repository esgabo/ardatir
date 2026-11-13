"""Gandalf the Grey, as The Hobbit first shows him: built, rigged, animated and exported.

    blender --background --python scripts/models/blender/gandalf.py -- [--out out/models/gandalf.glb]

Writes the source `assets/characters/gandalf/gandalf.blend` and the raw export (default
`out/models/gandalf.glb`); `npm run model:pack` then compresses it into assets/ (docs/MODELS.md).

Design, from The Hobbit, chapter 1 (our own, not the films'): an old man, tall and lean with a
slight stoop; a tall pointed blue hat; a long grey cloak over a grey robe; a silver scarf, his
long white beard hanging over it below his waist; bushy eyebrows that stick out beyond the brim;
immense black boots; a tall staff. Low-poly and flat-shaded: detail goes to beard, brows and hat.
"""

import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Euler, Vector

sys.path.insert(0, str(Path(__file__).parent))
import hobbit_rig as base  # noqa: E402
import lowpoly as lp  # noqa: E402
import wizard_rig as rig  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
HEIGHT = 1.75  # to the top of the head; the hat adds about a quarter metre

lp.reset_scene()  # before any material: a reset would delete them

SKIN = lp.material('skin', '#dcb69b')
ROBE = lp.material('robe', '#8f939a')
CLOAK = lp.material('cloak', '#656a72')
BELT = lp.material('belt', '#4a4740')
SCARF = lp.material('scarf', '#e2e6ee', roughness=0.3, metallic=0.5)
BEARD = lp.material('beard', '#ebe8e0')
HAT = lp.material('hat', '#3d5f96')
HAT_BAND = lp.material('hat_band', '#2b4570')
BOOT = lp.material('boot', '#23211f', roughness=0.6)
STAFF = lp.material('staff', '#6b4a2e')
EYE = lp.material('eye', '#2b2621', roughness=0.4)

J = rig.joints_for(HEIGHT)

# The robe's cross-sections from the hem up: (z, centre y, half-width, half-depth).
ROBE_PROFILE = [
    (0.07, 0.010, 0.250, 0.215),
    (0.30, 0.010, 0.225, 0.190),
    (0.60, 0.005, 0.195, 0.160),
    (0.90, 0.000, 0.172, 0.135),
    (1.00, 0.000, 0.165, 0.126),
    (1.15, 0.000, 0.176, 0.130),
    (1.30, 0.006, 0.186, 0.130),
    (1.40, 0.016, 0.178, 0.116),
    (1.46, 0.020, 0.075, 0.070),
]


def robe_at(z):
    return lp.profile_at(ROBE_PROFILE, z)


def robe_weights(co):
    """Above the hips the torso bends; below, the skirt follows the legs a little."""
    z = co.z
    if z >= 0.95:
        return lp.blend_weights([(1.0, 'hips'), (1.12, 'spine'), (1.2, 'spine'), (1.32, 'chest')])(co)
    a = min(1.0, (0.95 - z) / 0.85) * 0.85
    left = min(1.0, max(0.0, 0.5 + co.x / 0.16))
    return {'hips': 1 - a, 'thigh.L': a * left, 'thigh.R': a * (1 - left)}


def robe():
    rings = []
    for i in range(16):
        z = 0.07 + (1.46 - 0.07) * i / 15
        cy, rx, ry = robe_at(z)
        rings.append(((0, cy, z), rx, ry))
    return lp.loft(rings, sides=12)


def cloak():
    """An open shell from the shoulders down the back and sides, flaring to the hem."""
    bm = bmesh.new()
    sides, levels = 12, 12
    z_top = 1.445
    grid = []
    for i in range(levels):
        f = i / (levels - 1)            # 0 at the hem, 1 at the shoulders
        a0 = 1.45 - 0.55 * f ** 2       # over the shoulders at the top, behind the arms below
        row = []
        for k in range(sides + 1):
            a = a0 + (2 * math.pi - 2 * a0) * k / sides
            back = (1 - math.cos(a)) / 2
            z_bottom = 0.15 - 0.05 * back
            z = z_bottom + (z_top - z_bottom) * f
            cy, rx, ry = robe_at(min(z, 1.40))
            grow = 0.028 + 0.05 * (1 - f) ** 1.5
            if f > 0.92:
                grow += 0.02                # the cape round the shoulders sits over the sleeves
            row.append(bm.verts.new(Vector((math.sin(a) * (rx + grow), cy - math.cos(a) * (ry + grow), z))))
        grid.append(row)
    for r0, r1 in zip(grid, grid[1:]):
        for k in range(sides):
            bm.faces.new((r0[k], r0[k + 1], r1[k + 1], r1[k]))
    return lp.solidify(bm, 0.008)


CLOAK_WEIGHTS = lp.blend_weights([(0.55, 'cloak_low'), (0.9, 'cloak'), (1.18, 'cloak'), (1.34, 'chest')])


def belt():
    cy, rx, ry = robe_at(1.0)
    rings = [((0, cy, 0.985), rx + 0.006, ry + 0.006), ((0, cy, 1.012), rx + 0.006, ry + 0.006)]
    return lp.loft(rings, sides=12)


def scarf():
    parts = [lp.Part('scarf', lp.limb((0, 0.02, 1.40), (0, 0.02, 1.475), [0.088, 0.08], sides=9),
                     SCARF, lp.blend_weights([(1.42, 'chest'), (1.47, 'neck')]))]
    for sgn in (1, -1):
        top = Vector((0.078 * sgn, -0.105, 1.41))
        parts.append(lp.Part('scarf_end', lp.box(top + Vector((0.006 * sgn, -0.012, -0.12)), (0.05, 0.012, 0.25),
                                                 rotation=Euler((0.1, 0, 0.08 * sgn)).to_matrix()),
                             SCARF, 'chest'))
    return parts


def beard():
    """Long, white, rough-cut, hanging over the scarf to below the belt."""
    sections = [  # (z, centre y, half-width, half-depth)
        (1.56, -0.088, 0.060, 0.040),
        (1.50, -0.118, 0.080, 0.048),
        (1.42, -0.145, 0.088, 0.045),
        (1.30, -0.160, 0.080, 0.036),
        (1.15, -0.168, 0.064, 0.030),
        (1.02, -0.160, 0.040, 0.024),
        (0.93, -0.150, 0.012, 0.010),
    ]
    rings = [((0, y, z), rx, ry) for z, y, rx, ry in sections]
    bm = lp.jitter(lp.loft(rings, sides=7), 0.007, seed=5)
    parts = [lp.Part('beard', bm, BEARD,
                     lp.blend_weights([(1.20, 'beard_low'), (1.36, 'beard'), (1.44, 'beard'), (1.53, 'head')]))]
    for sgn in (1, -1):
        parts.append(lp.Part('moustache', lp.blob((0.032 * sgn, -0.104, 1.555), (0.038, 0.02, 0.016), subdiv=1,
                                                  rotation=Euler((0, 0.35 * sgn, 0)).to_matrix()), BEARD, 'head'))
    return parts


def head():
    hc = Vector((0, 0.0, 1.605))
    parts = [
        lp.Part('skull', lp.blob(hc, (0.08, 0.092, 0.108), subdiv=2), SKIN, 'head'),
        lp.Part('nose', lp.blob(hc + Vector((0, -0.094, -0.022)), (0.017, 0.026, 0.03), subdiv=1,
                                rotation=Euler((0.3, 0, 0)).to_matrix()), SKIN, 'head'),
        # long white hair down the back of the head, under the hat
        lp.Part('hair', lp.jitter(lp.blob(hc + Vector((0, 0.038, -0.06)), (0.092, 0.075, 0.13), subdiv=1), 0.006, 9),
                BEARD, 'head'),
    ]
    for sgn in (1, -1):
        parts += [
            lp.Part('eye', lp.blob(hc + Vector((0.029 * sgn, -0.085, 0.002)), (0.008, 0.005, 0.007), subdiv=1), EYE, 'head'),
            # bushy brows that stick out: chunky, tilted up and outward
            lp.Part('brow', lp.jitter(lp.box(hc + Vector((0.047 * sgn, -0.092, 0.026)), (0.06, 0.03, 0.022),
                                             rotation=Euler((0.1, -0.3 * sgn, 0.25 * sgn)).to_matrix()), 0.004, 3),
                    BEARD, 'head'),
            lp.Part('ear', lp.blob(hc + Vector((0.08 * sgn, 0.005, -0.01)), (0.012, 0.02, 0.032), subdiv=1), SKIN, 'head'),
        ]
    return parts


def hat():
    """A tall pointed blue hat with a broad brim, its tip bent back a little."""
    base_z = 1.668
    brim = lp.loft([((0, 0, base_z - 0.006), 0.21, 0.205), ((0, 0, base_z + 0.006), 0.2, 0.195)], sides=12)
    # the brim's edge droops a touch
    for v in brim.verts:
        r = math.hypot(v.co.x, v.co.y)
        v.co.z -= max(0.0, r - 0.12) * 0.18
    cone = [((0, 0.0, base_z), 0.104, 0.104), ((0, 0.006, base_z + 0.09), 0.084, 0.084),
            ((0, 0.014, base_z + 0.18), 0.06, 0.06), ((0, 0.032, base_z + 0.26), 0.036, 0.036),
            ((0, 0.07, base_z + 0.315), 0.016, 0.016), ((0, 0.11, base_z + 0.33), 0.004, 0.004)]
    band = [((0, 0, base_z + 0.004), 0.107, 0.107), ((0, 0.002, base_z + 0.03), 0.1, 0.1)]
    return [
        lp.Part('brim', brim, HAT, 'head'),
        lp.Part('crown', lp.loft(cone, sides=10), HAT, 'head'),
        lp.Part('band', lp.loft(band, sides=10), HAT_BAND, 'head'),
    ]


def boots():
    parts = []
    for s in ('L', 'R'):
        x = J[f'ankle.{s}'].x
        out = 0.015 * (1 if x > 0 else -1)
        sections = [  # (y, centre z, half-width, half-height)
            (0.07, 0.05, 0.05, 0.05),
            (0.02, 0.07, 0.058, 0.07),
            (-0.06, 0.05, 0.06, 0.05),
            (-0.15, 0.035, 0.058, 0.035),
            (-0.22, 0.03, 0.05, 0.03),
            (-0.245, 0.026, 0.03, 0.022),
        ]
        rings = [((x + out * max(0.0, -y) / 0.245, y, zc), rw, rh) for y, zc, rw, rh in sections]
        parts.append(lp.Part(f'boot.{s}', lp.loft(rings, sides=8, u=Vector((1, 0, 0)), v=Vector((0, 0, 1))),
                             BOOT, f'foot.{s}'))
        parts.append(lp.Part(f'shaft.{s}', lp.limb(J[f'ankle.{s}'] + Vector((0, 0, -0.02)),
                                                   J[f'ankle.{s}'] + Vector((0, 0, 0.13)), [0.058, 0.056], sides=8),
                             BOOT, f'shin.{s}'))
    return parts


def arms():
    parts = []
    for s in ('L', 'R'):
        sh, el, wr, tip = J[f'shoulder.{s}'], J[f'elbow.{s}'], J[f'wrist.{s}'], J[f'hand_tip.{s}']
        parts.append(lp.Part(f'shoulder.{s}', lp.blob(sh + Vector((0, 0.0, -0.01)), (0.058, 0.062, 0.055), subdiv=2),
                             ROBE, lp.blend_weights([(1.36, f'upper_arm.{s}'), (1.44, 'chest')])))
        parts.append(lp.Part(f'upper_arm.{s}', lp.limb(sh, el, [0.054, 0.05, 0.048]), ROBE, f'upper_arm.{s}'))
        parts.append(lp.Part(f'elbow.{s}', lp.blob(el, (0.048, 0.048, 0.048), subdiv=1), ROBE, f'forearm.{s}'))
        d = (wr - el).normalized()
        # wide wizard's sleeves, open at the wrist
        parts.append(lp.Part(f'sleeve.{s}', lp.limb(el, wr + d * 0.01, [0.048, 0.058, 0.074]), ROBE, f'forearm.{s}'))
        c = wr + (tip - wr) * 0.5
        parts.append(lp.Part(f'hand.{s}', lp.blob(c, (0.026, 0.036, 0.046) if s == 'L' else (0.034, 0.042, 0.036),
                                                  subdiv=1), SKIN, f'hand.{s}'))
    return parts


def staff():
    p = rig.staff_point(J)
    gnarl = lp.seeded(21)
    rings = []
    for i in range(9):
        z = 0.0 + 1.82 * i / 8
        r = 0.017 + 0.004 * (i / 8) + gnarl.uniform(-0.002, 0.002)
        rings.append(((p.x + gnarl.uniform(-0.004, 0.004), p.y + gnarl.uniform(-0.004, 0.004), z), r, r))
    parts = [lp.Part('staff', lp.loft(rings, sides=6), STAFF, 'hand.R'),
             lp.Part('staff_head', lp.jitter(lp.blob((p.x, p.y, 1.84), (0.032, 0.03, 0.045), subdiv=1), 0.006, 4),
                     STAFF, 'hand.R')]
    return parts


def build_mesh():
    parts = [
        lp.Part('robe', robe(), ROBE, robe_weights),
        lp.Part('belt', belt(), BELT, lp.blend_weights([(1.0, 'hips'), (1.12, 'spine')])),
        lp.Part('cloak', cloak(), CLOAK, CLOAK_WEIGHTS),
        lp.Part('neck', lp.limb((0, 0.02, 1.42), (0, 0.01, 1.56), [0.05, 0.048], sides=8), SKIN,
                lp.blend_weights([(1.47, 'neck'), (1.53, 'head')])),
    ]
    parts += scarf() + beard() + head() + hat() + boots() + arms() + staff()
    return lp.finish('gandalf', parts)


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = Path(args[args.index('--out') + 1]) if '--out' in args else ROOT / 'out' / 'models' / 'gandalf.glb'
    blend = ROOT / 'assets' / 'characters' / 'gandalf' / 'gandalf.blend'
    out.parent.mkdir(parents=True, exist_ok=True)
    blend.parent.mkdir(parents=True, exist_ok=True)

    arm = base.build_armature('gandalf', J, rig.BONES)
    mesh = build_mesh()
    base.bind(mesh, arm)
    made = base.make_clips(arm, rig.clips(HEIGHT, J), J)
    tris = sum(len(p.vertices) - 2 for p in mesh.data.polygons)
    print(f'gandalf: {tris} triangles, {len(arm.data.bones)} bones, clips: '
          + ', '.join(f'{n} ({f} frames)' for n, f in made))
    bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True)
    base.export_glb(out, [arm, mesh])
    print(f'wrote {blend.relative_to(ROOT)} and {out}')


if __name__ == '__main__':
    main()
