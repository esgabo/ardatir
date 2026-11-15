"""Elrond, master of Rivendell: built, rigged, animated and exported.

    blender --background --python scripts/models/blender/elrond.py -- [--out out/models/elrond.glb]

Writes the source `assets/characters/elrond/elrond.blend` and the raw export (default
`out/models/elrond.glb`); `npm run model:pack` then compresses it into assets/ (docs/MODELS.md).

Design, ours alone, from what Tolkien says of him (The Hobbit ch. 3; the Council of Elrond):
a face neither old nor young, carrying the memory of glad and sorrowful things alike; hair dark
as twilight, worn long and loose; a thin circlet of silver on it; grey eyes; beardless, as
elves are; as strong as a warrior and as kind as summer, which here means an upright, unhurried
bearing rather than a stoop. He wears a pale under-robe and a long twilight-blue mantle open at
the front, trimmed in silver, belted at the waist. Nothing from the films or series.

Low-poly and flat-shaded: the detail goes to the hair, the mantle's fall and the circlet.
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
import tallfolk_rig as rig  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
HEIGHT = 1.95  # to the top of the head; `scale: 1.9` in content keeps the relative heights

lp.reset_scene()  # before any material: a reset would delete them

SKIN = lp.material('skin', '#e3c2a6')
ROBE = lp.material('robe', '#b9bcc8')          # the pale under-robe
MANTLE = lp.material('mantle', '#4a4a72')      # twilight blue, near his colour in content
MANTLE_IN = lp.material('mantle_in', '#38384f')  # its darker lining, seen at the opening
TRIM = lp.material('trim', '#cdd3de', roughness=0.35, metallic=0.45)
BELT = lp.material('belt', '#3c3a52')
HAIR = lp.material('hair', '#2e2b33')
SILVER = lp.material('silver', '#d4dae6', roughness=0.25, metallic=0.7)
BOOT = lp.material('boot', '#4b3f39', roughness=0.7)
EYE = lp.material('eye', '#5b6470', roughness=0.4)

J = rig.joints_for(HEIGHT)

# The under-robe's cross-sections from the hem up: (z, centre y, half-width, half-depth).
ROBE_PROFILE = [
    (0.055, 0.012, 0.250, 0.212),
    (0.35, 0.010, 0.228, 0.190),
    (0.70, 0.006, 0.198, 0.162),
    (1.00, 0.002, 0.176, 0.138),
    (1.08, 0.000, 0.168, 0.129),   # the waist, just above the hips
    (1.25, 0.000, 0.180, 0.133),
    (1.42, 0.006, 0.190, 0.133),
    (1.55, 0.016, 0.178, 0.116),
    (1.62, 0.020, 0.072, 0.068),
]

HIPS_Z = J['hips'].z


def robe_at(z):
    return lp.profile_at(ROBE_PROFILE, z)


def robe_weights(co):
    """Above the hips the torso bends; below, the skirt follows the legs a little."""
    z = co.z
    if z >= HIPS_Z - 0.02:
        return lp.blend_weights([(HIPS_Z, 'hips'), (HIPS_Z + 0.16, 'spine'),
                                 (HIPS_Z + 0.26, 'spine'), (HIPS_Z + 0.40, 'chest')])(co)
    a = min(1.0, (HIPS_Z - 0.02 - z) / 0.92) * 0.85
    left = min(1.0, max(0.0, 0.5 + co.x / 0.16))
    return {'hips': 1 - a, 'thigh.L': a * left, 'thigh.R': a * (1 - left)}


def robe():
    rings = []
    for i in range(16):
        z = 0.055 + (1.62 - 0.055) * i / 15
        cy, rx, ry = robe_at(z)
        rings.append(((0, cy, z), rx, ry))
    return lp.loft(rings, sides=12)


# --- the mantle: a long over-robe, open down the front, trimmed in silver -------------------

MANTLE_HEM = 0.10
NECK_BASE = 1.645                       # where the mantle meets the neck, front and back
SHOULDER_SPAN = 0.205 * HEIGHT / 1.85   # half the shoulder width, from the rig's joints
MANTLE_TOP = NECK_BASE


def _mantle_top(a):
    """How high the mantle's edge reaches at angle `a` round the body.

    It follows the shoulder line rather than a level ring: highest either side of the neck,
    sloping down and outward to the point of the shoulder. A level top edge reads as a stiff
    collar standing up round the head, which is what it looked like the first time.
    """
    return NECK_BASE - 0.045 * abs(math.sin(a)) ** 1.3


def _mantle_grid(bm, grow_extra=0.0):
    """Rows of vertices from hem to shoulders; the front opening widens as it falls."""
    sides, levels = 13, 13
    grid = []
    for i in range(levels):
        f = i / (levels - 1)                 # 0 at the hem, 1 over the shoulders
        gap = 0.62 - 0.38 * f ** 1.6         # half the opening, in radians: narrow up at the clasp
        row = []
        for k in range(sides + 1):
            a = gap + (2 * math.pi - 2 * gap) * k / sides
            back = (1 - math.cos(a)) / 2     # 0 at the front opening, 1 down the spine
            z_bottom = MANTLE_HEM - 0.045 * back
            z = z_bottom + (_mantle_top(a) - z_bottom) * f
            cy, rx, ry = robe_at(min(z, 1.55))
            grow = 0.022 + 0.055 * (1 - f) ** 1.5 + grow_extra
            px = math.sin(a) * (rx + grow)
            py = cy - math.cos(a) * (ry + grow)
            if f > 0.80:
                # The shoulder cape, widening *outward only* over the last few rows: growing the
                # ring's depth as well turns the whole upper body into a barrel.
                t = ((f - 0.80) / 0.20) ** 1.4
                # Only just wide enough to cover the shoulder. Wider than the arm and the cape
                # becomes a flat flap the sleeve swings out in front of when he gestures.
                want = (SHOULDER_SPAN + 0.022 + grow_extra) * math.sin(a)
                px += (want - px) * t * abs(math.sin(a))
            row.append(bm.verts.new(Vector((px, py, z))))
        grid.append(row)
    return grid, sides


def mantle():
    bm = bmesh.new()
    grid, sides = _mantle_grid(bm)
    for r0, r1 in zip(grid, grid[1:]):
        for k in range(sides):
            bm.faces.new((r0[k], r0[k + 1], r1[k + 1], r1[k]))
    return lp.solidify(bm, 0.009)


def mantle_trim():
    """A silver band down each front edge of the mantle, and one along its hem."""
    parts = []
    bm = bmesh.new()
    grid, sides = _mantle_grid(bm, grow_extra=0.004)
    edges = []
    for row in grid:                      # the two front edges, bottom to top
        edges.append((row[0].co.copy(), row[-1].co.copy()))
    bm.free()
    for which in (0, 1):
        pts = [e[which] for e in edges]
        rings = [((p.x, p.y, p.z), 0.012, 0.012) for p in pts]
        parts.append(lp.Part(f'trim_edge.{which}', lp.loft(rings, sides=5),
                             TRIM, MANTLE_WEIGHTS))
    hem = []
    for k in range(sides + 1):
        a = 0.62 + (2 * math.pi - 2 * 0.62) * k / sides
        back = (1 - math.cos(a)) / 2
        cy, rx, ry = robe_at(MANTLE_HEM)
        grow = 0.022 + 0.055 + 0.004
        hem.append(Vector((math.sin(a) * (rx + grow), cy - math.cos(a) * (ry + grow),
                           MANTLE_HEM - 0.045 * back)))
    parts.append(lp.Part('trim_hem', lp.loft([((p.x, p.y, p.z), 0.011, 0.011) for p in hem], sides=5),
                         TRIM, 'cloak_low'))
    return parts


MANTLE_WEIGHTS = lp.blend_weights([(0.55, 'cloak_low'), (0.95, 'cloak'), (1.30, 'cloak'), (1.50, 'chest')])


def mantle_lining():
    """A darker panel just inside the opening, so the mantle reads as a garment, not a shell."""
    parts = []
    for sgn in (1, -1):
        rings = []
        for i in range(6):
            f = i / 5
            z = MANTLE_HEM + 0.06 + (MANTLE_TOP - MANTLE_HEM - 0.12) * f
            cy, rx, ry = robe_at(min(z, 1.55))
            gap = 0.62 - 0.38 * f ** 1.6
            grow = 0.012 + 0.03 * (1 - f) ** 1.5
            rings.append((((math.sin(gap) * (rx + grow)) * sgn, cy - math.cos(gap) * (ry + grow), z),
                          0.014, 0.010))
        parts.append(lp.Part(f'mantle_lining.{sgn}', lp.loft(rings, sides=5), MANTLE_IN, MANTLE_WEIGHTS))
    return parts


def clasp():
    """A small silver clasp where the mantle closes at the breast."""
    cy, rx, ry = robe_at(1.50)
    return [lp.Part('clasp', lp.blob((0, cy - ry - 0.045, 1.50), (0.026, 0.016, 0.020), subdiv=1),
                    SILVER, 'chest')]


def belt():
    cy, rx, ry = robe_at(1.08)
    rings = [((0, cy, 1.062), rx + 0.007, ry + 0.007), ((0, cy, 1.098), rx + 0.007, ry + 0.007)]
    parts = [lp.Part('belt', lp.loft(rings, sides=12), BELT,
                     lp.blend_weights([(HIPS_Z, 'hips'), (HIPS_Z + 0.14, 'spine')]))]
    parts.append(lp.Part('buckle', lp.box((0, cy - ry - 0.012, 1.08), (0.05, 0.016, 0.042)),
                         SILVER, 'hips'))
    return parts


# --- head and hair --------------------------------------------------------------------------

HC = Vector((0, 0.004, 1.800))   # the skull's centre


def head():
    parts = [
        lp.Part('skull', lp.blob(HC, (0.077, 0.088, 0.104), subdiv=2), SKIN, 'head'),
        # a short jaw, kept well behind the nose: any more depth here and the profile goes snouty
        lp.Part('jaw', lp.blob(HC + Vector((0, 0.004, -0.066)), (0.050, 0.056, 0.042), subdiv=1),
                SKIN, 'head'),
        lp.Part('nose', lp.blob(HC + Vector((0, -0.090, -0.012)), (0.014, 0.024, 0.030), subdiv=1,
                                rotation=Euler((0.26, 0, 0)).to_matrix()), SKIN, 'head'),
    ]
    for sgn in (1, -1):
        parts += [
            lp.Part('eye', lp.blob(HC + Vector((0.028 * sgn, -0.080, 0.006)), (0.009, 0.005, 0.0075),
                                   subdiv=1), EYE, 'head'),
            # fine brows, level: nothing bushy about him
            lp.Part('brow', lp.box(HC + Vector((0.032 * sgn, -0.082, 0.030)), (0.042, 0.012, 0.009),
                                   rotation=Euler((0, -0.12 * sgn, 0.08 * sgn)).to_matrix()),
                    HAIR, 'head'),
            # an elf's ear: swept back and up to a point
            lp.Part('ear', lp.blob(HC + Vector((0.076 * sgn, 0.006, 0.000)), (0.011, 0.019, 0.030),
                                   subdiv=1), SKIN, 'head'),
            lp.Part('ear_tip', lp.cone(HC + Vector((0.078 * sgn, 0.010, 0.020)),
                                       HC + Vector((0.086 * sgn, 0.030, 0.062)), 0.011, sides=5),
                    SKIN, 'head'),
        ]
    return parts


def hair():
    """Long and loose: a cap over the skull, then a mass falling to the middle of the back."""
    cap = lp.jitter(lp.blob(HC + Vector((0, 0.020, 0.012)), (0.088, 0.098, 0.106), subdiv=2), 0.004, 17)
    # cut the cap away from the face so it reads as a hairline, not a helmet
    for v in cap.verts:
        if v.co.y < HC.y - 0.052 and v.co.z < HC.z + 0.052:
            v.co.y = HC.y - 0.052
    parts = [lp.Part('hair_cap', cap, HAIR, 'head')]

    sections = [  # (z, centre y, half-width, half-depth) down the back of the head and neck
        (1.845, 0.045, 0.092, 0.080),
        (1.760, 0.062, 0.100, 0.072),
        (1.680, 0.076, 0.098, 0.058),
        (1.580, 0.082, 0.092, 0.048),
        (1.470, 0.086, 0.082, 0.040),
        (1.360, 0.088, 0.066, 0.032),
        (1.265, 0.088, 0.044, 0.024),
    ]
    rings = [((0, y, z), rx, ry) for z, y, rx, ry in sections]
    fall = lp.jitter(lp.loft(rings, sides=8), 0.006, seed=23)
    parts.append(lp.Part('hair_fall', fall, HAIR,
                         lp.blend_weights([(1.30, 'hair_low'), (1.46, 'hair'),
                                           (1.60, 'hair'), (1.72, 'head')])))
    # two strands forward over the shoulders, the way long hair actually sits
    for sgn in (1, -1):
        strand = [
            ((0.072 * sgn, -0.018, 1.795), 0.022, 0.022),
            ((0.085 * sgn, -0.030, 1.700), 0.019, 0.018),
            ((0.088 * sgn, -0.032, 1.605), 0.015, 0.014),
            ((0.086 * sgn, -0.028, 1.520), 0.009, 0.009),
        ]
        parts.append(lp.Part(f'hair_strand.{sgn}', lp.jitter(lp.loft(strand, sides=6), 0.004, 29 + sgn),
                             HAIR, lp.blend_weights([(1.52, 'chest'), (1.66, 'head')])))
    return parts


def circlet():
    """A thin silver band round the brow, rising to a point at the front."""
    rings = []
    for i in range(2):
        z = 1.858 + 0.011 * i
        rings.append(((0, HC.y + 0.016, z), 0.090 - 0.004 * i, 0.100 - 0.004 * i))
    band = lp.loft(rings, sides=14)
    # the front of the band lifts into a small peak
    for v in band.verts:
        if v.co.y < HC.y - 0.055:
            v.co.z += 0.016 * (1 - min(1.0, abs(v.co.x) / 0.05))
    return [lp.Part('circlet', band, SILVER, 'head'),
            lp.Part('circlet_stone', lp.blob((0, HC.y - 0.098, 1.880), (0.010, 0.008, 0.012), subdiv=1),
                    SILVER, 'head')]


# --- arms, hands, feet ----------------------------------------------------------------------

def arms():
    parts = []
    for s in ('L', 'R'):
        sh, el, wr, tip = J[f'shoulder.{s}'], J[f'elbow.{s}'], J[f'wrist.{s}'], J[f'hand_tip.{s}']
        # the shoulder sits just inside the mantle's cape: a soft joint, not a pad on top of it
        # kept low and flat so its top stays under the mantle's shoulder edge: any higher and it
        # shows as a pale pad sitting on top of the garment
        parts.append(lp.Part(f'shoulder.{s}', lp.blob(sh + Vector((-0.008 * (1 if s == 'L' else -1), 0, -0.040)),
                                                      (0.050, 0.056, 0.040), subdiv=2), ROBE,
                             lp.blend_weights([(sh.z - 0.10, f'upper_arm.{s}'), (sh.z + 0.02, 'chest')])))
        parts.append(lp.Part(f'upper_arm.{s}', lp.limb(sh, el, [0.060, 0.055, 0.051]), ROBE, f'upper_arm.{s}'))
        parts.append(lp.Part(f'elbow.{s}', lp.blob(el, (0.050, 0.050, 0.050), subdiv=1), ROBE, f'forearm.{s}'))
        d = (wr - el).normalized()
        # a fitted sleeve, flaring only a little at the cuff: he is not robed like a wizard
        parts.append(lp.Part(f'sleeve.{s}', lp.limb(el, wr + d * 0.012, [0.050, 0.048, 0.055]),
                             ROBE, f'forearm.{s}'))
        parts.append(lp.Part(f'cuff.{s}', lp.limb(wr + d * 0.004, wr + d * 0.03, [0.056, 0.054], sides=8),
                             TRIM, f'forearm.{s}'))
        c = wr + (tip - wr) * 0.52
        parts.append(lp.Part(f'hand.{s}', lp.blob(c, (0.028, 0.038, 0.050), subdiv=1), SKIN, f'hand.{s}'))
    return parts


def boots():
    parts = []
    for s in ('L', 'R'):
        ankle = J[f'ankle.{s}']
        x = ankle.x
        out = 0.012 * (1 if x > 0 else -1)
        sections = [  # (y, centre z, half-width, half-height)
            (0.075, 0.046, 0.044, 0.046),
            (0.02, 0.062, 0.051, 0.062),
            (-0.06, 0.046, 0.053, 0.046),
            (-0.14, 0.032, 0.050, 0.032),
            (-0.20, 0.028, 0.042, 0.027),
            (-0.225, 0.024, 0.024, 0.018),
        ]
        rings = [((x + out * max(0.0, -y) / 0.225, y, zc), rw, rh) for y, zc, rw, rh in sections]
        parts.append(lp.Part(f'boot.{s}', lp.loft(rings, sides=8, u=Vector((1, 0, 0)), v=Vector((0, 0, 1))),
                             BOOT, f'foot.{s}'))
        parts.append(lp.Part(f'shaft.{s}', lp.limb(ankle + Vector((0, 0, -0.02)),
                                                   ankle + Vector((0, 0, 0.11)), [0.051, 0.048], sides=8),
                             BOOT, f'shin.{s}'))
    return parts


def build_mesh():
    parts = [
        lp.Part('robe', robe(), ROBE, robe_weights),
        lp.Part('mantle', mantle(), MANTLE, MANTLE_WEIGHTS),
        lp.Part('neck', lp.limb((0, 0.018, 1.585), (0, 0.010, 1.730), [0.048, 0.046], sides=8), SKIN,
                lp.blend_weights([(J['neck'].z, 'neck'), (J['head'].z, 'head')])),
    ]
    parts += mantle_lining() + mantle_trim() + clasp() + belt()
    parts += head() + hair() + circlet() + arms() + boots()
    return lp.finish('elrond', parts)


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = Path(args[args.index('--out') + 1]) if '--out' in args else ROOT / 'out' / 'models' / 'elrond.glb'
    blend = ROOT / 'assets' / 'characters' / 'elrond' / 'elrond.blend'
    out.parent.mkdir(parents=True, exist_ok=True)
    blend.parent.mkdir(parents=True, exist_ok=True)

    arm = base.build_armature('elrond', J, rig.BONES)
    mesh = build_mesh()
    base.bind(mesh, arm)
    made = base.make_clips(arm, rig.clips(HEIGHT, J), J)
    tris = sum(len(p.vertices) - 2 for p in mesh.data.polygons)
    print(f'elrond: {tris} triangles, {len(arm.data.bones)} bones, clips: '
          + ', '.join(f'{n} ({f} frames)' for n, f in made))
    bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True)
    base.export_glb(out, [arm, mesh])
    print(f'wrote {blend.relative_to(ROOT)} and {out}')


if __name__ == '__main__':
    main()
