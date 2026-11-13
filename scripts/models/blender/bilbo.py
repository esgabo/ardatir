"""Bilbo Baggins at home (the Unexpected Party look): built, rigged, animated and exported.

    blender --background --python scripts/models/blender/bilbo.py -- [--out out/models/bilbo.glb]

Writes the source `assets/characters/bilbo/bilbo.blend` and the raw export (default
`out/models/bilbo.glb`); `npm run model:pack` then compresses it into assets/ (docs/MODELS.md).

Design, from The Hobbit, chapter 1 (our own, not the films'): a small, comfortable adult with
a round middle; brown curly hair; a simple, good-natured face; bright colours (hobbits favour
green and yellow): a mustard waistcoat with brass buttons, a green coat with short tails, a
white shirt, brown knee breeches; no shoes, big leathery feet with brown curly hair on top.
Low-poly and flat-shaded: detail only where it carries character (curls, feet, buttons, tails).
"""

import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

sys.path.insert(0, str(Path(__file__).parent))
import hobbit_rig as rig  # noqa: E402
import lowpoly as lp  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
HEIGHT = 1.05
HEAD_SCALE = 0.9

lp.reset_scene()  # before any material: a reset would delete them

# Colours (flat; sRGB hex)
SKIN = lp.material('skin', '#e2b48f')
HAIR = lp.material('hair', '#6b4527')
SHIRT = lp.material('shirt', '#efe8d8')
WAISTCOAT = lp.material('waistcoat', '#d9a62e')
BRASS = lp.material('brass', '#c99a3c', roughness=0.35, metallic=0.7)
COAT = lp.material('coat', '#3f6b3a')
BREECHES = lp.material('breeches', '#7a5a3a')
EYE = lp.material('eye', '#2b2018', roughness=0.4)
MOUTH = lp.material('mouth', '#a8664f')

J = rig.joints_for(HEIGHT)

# The torso's cross-sections from the hips up: (z, centre y, half-width, half-depth).
# Centre y goes negative (forward) round the middle: a comfortable belly.
TORSO = [
    (0.40, 0.000, 0.100, 0.082),
    (0.45, -0.004, 0.112, 0.094),
    (0.50, -0.012, 0.121, 0.110),
    (0.56, -0.024, 0.127, 0.126),
    (0.62, -0.024, 0.127, 0.123),
    (0.68, -0.014, 0.125, 0.104),
    (0.735, -0.004, 0.127, 0.090),
    (0.775, 0.004, 0.110, 0.076),
    (0.80, 0.006, 0.060, 0.050),
]


def torso_at(z):
    """(centre y, half-width, half-depth) at height z, between the TORSO sections."""
    if z <= TORSO[0][0]:
        return TORSO[0][1:]
    for a, b in zip(TORSO, TORSO[1:]):
        if z <= b[0]:
            f = (z - a[0]) / (b[0] - a[0])
            return tuple(a[i] + (b[i] - a[i]) * f for i in (1, 2, 3))
    return TORSO[-1][1:]


TORSO_WEIGHTS = lp.blend_weights([(0.52, 'hips'), (0.60, 'spine'), (0.66, 'spine'), (0.73, 'chest')])


def body_rings(z0, z1, grow=0.0, levels=6):
    rings = []
    for i in range(levels):
        z = z0 + (z1 - z0) * i / (levels - 1)
        cy, rx, ry = torso_at(z)
        rings.append(((0, cy, z), rx + grow, ry + grow))
    return rings


limb = lp.limb


def coat_shell():
    """The coat: an open shell round the torso, cut away at the front, with tails at the back."""
    bm = bmesh.new()
    sides, levels = 14, 9
    z_top = 0.785
    grid = []
    for i in range(levels):
        f = i / (levels - 1)
        row = []
        # the front opening: narrow lapels at the top, a wide cutaway over the belly
        gap = 0.55 + 0.85 * (1 - f) ** 1.6
        for k in range(sides + 1):
            a = gap + (2 * math.pi - 2 * gap) * k / sides
            back = (1 - math.cos(a)) / 2          # 0 at the front, 1 at the back
            z_bottom = 0.56 - 0.15 * back ** 1.5  # tails hang lower behind
            z = z_bottom + (z_top - z_bottom) * f
            cy, rx, ry = torso_at(max(z, 0.5))
            flare = 0.012 + max(0.0, 0.5 - z) * 0.25
            p = Vector((math.sin(a) * (rx + flare), cy - math.cos(a) * (ry + flare), z))
            row.append(bm.verts.new(p))
        grid.append(row)
    for r0, r1 in zip(grid, grid[1:]):
        for k in range(sides):
            bm.faces.new((r0[k], r0[k + 1], r1[k + 1], r1[k]))
    return lp.solidify(bm, 0.007)


def collar():
    rings = [((0, 0.012, 0.775), 0.072, 0.062), ((0, 0.018, 0.835), 0.07, 0.058)]
    shell = lp.loft(rings, sides=8, arc=(1.2, 2 * math.pi - 1.2))
    return lp.solidify(shell, 0.006)


def waistcoat():
    levels = 7
    rings = body_rings(0.50, 0.772, levels=levels)

    def arc(i):
        # a V neck in the top rings, closed below
        f = i / (levels - 1)
        gap = 0.0 if f < 0.55 else 0.6 * ((f - 0.55) / 0.45)
        return (gap, 2 * math.pi - gap)
    return lp.loft(rings, sides=12, arc=arc)


def buttons():
    out = []
    for z in (0.54, 0.585, 0.63, 0.675, 0.715):
        cy, rx, ry = torso_at(z)
        out.append(lp.blob((0, cy - ry - 0.002, z), (0.008, 0.005, 0.008), subdiv=1))
    return out


def foot(side):
    """A big bare hobbit foot along -Y, flat underneath, toes and curly hair on top."""
    x = J[f'ankle.{side}'].x
    out = 0.012 * (1 if x > 0 else -1)   # toes point slightly outward
    sections = [  # (y, centre z, half-width, half-height)
        (0.045, 0.034, 0.036, 0.034),
        (0.015, 0.046, 0.044, 0.046),
        (-0.04, 0.040, 0.052, 0.040),
        (-0.095, 0.029, 0.060, 0.029),
        (-0.14, 0.022, 0.058, 0.022),
        (-0.165, 0.016, 0.046, 0.016),
    ]
    rings = []
    for y, zc, rw, rh in sections:
        t = max(0.0, -y) / 0.165
        rings.append(((x + out * t, y, zc), rw, rh))
    parts = [lp.Part(f'foot.{side}', lp.loft(rings, sides=8, u=Vector((1, 0, 0)), v=Vector((0, 0, 1))),
                     SKIN, f'foot.{side}')]
    # toes: a row of little rounded bumps
    sgn = 1 if x > 0 else -1
    for i, (dx, r) in enumerate([(-0.034, 0.017), (-0.012, 0.015), (0.008, 0.014), (0.026, 0.013), (0.041, 0.012)]):
        tx = x + out + dx * sgn
        ty = -0.168 + abs(dx) * 0.35
        parts.append(lp.Part(f'toe{i}.{side}', lp.blob((tx, ty, r * 0.9), (r, r * 1.1, r * 0.95), subdiv=1),
                             SKIN, f'foot.{side}'))
    # brown curly hair on top of the foot
    rnd = lp.seeded(7 if side == 'L' else 11)
    for i in range(14):
        fy = -0.0 - 0.11 * i / 13
        sec = next(s for s in sections if s[0] <= fy + 0.03)
        fx = x + out * (-fy / 0.165) + rnd.uniform(-0.6, 0.6) * sec[2] * 0.6
        fz = sec[1] + sec[3] * 0.8
        r = rnd.uniform(0.014, 0.019)
        parts.append(lp.Part(f'foothair{i}.{side}', lp.blob((fx, fy, fz), (r, r, r * 0.8), subdiv=1,
                                                            rotation=Euler((rnd.uniform(0, 3), 0, rnd.uniform(0, 3))).to_matrix()),
                             HAIR, f'foot.{side}'))
    return parts


def hand(side):
    w, tip = J[f'wrist.{side}'], J[f'hand_tip.{side}']
    c = w + (tip - w) * 0.55
    sgn = 1 if w.x > 0 else -1
    parts = [
        lp.Part(f'palm.{side}', lp.blob(c, (0.020, 0.030, 0.042), subdiv=1), SKIN, f'hand.{side}'),
        lp.Part(f'thumb.{side}', lp.blob(c + Vector((-0.012 * sgn, -0.022, 0.012)), (0.011, 0.012, 0.02), subdiv=1),
                SKIN, f'hand.{side}'),
    ]
    return parts


def head():
    hc = Vector((0, -0.004, 0.928))
    parts = [
        lp.Part('skull', lp.blob(hc, (0.077, 0.084, 0.094), subdiv=2), SKIN, 'head'),
        lp.Part('cheeks', lp.blob(hc + Vector((0, -0.028, -0.042)), (0.066, 0.058, 0.05), subdiv=1), SKIN, 'head'),
        lp.Part('nose', lp.blob(hc + Vector((0, -0.088, -0.012)), (0.016, 0.02, 0.019), subdiv=1), SKIN, 'head'),
        lp.Part('mouth', lp.box(hc + Vector((0, -0.08, -0.05)), (0.026, 0.006, 0.006)), MOUTH, 'head'),
    ]
    for sgn in (1, -1):
        parts += [
            lp.Part('eye', lp.blob(hc + Vector((0.029 * sgn, -0.078, 0.004)), (0.009, 0.006, 0.009), subdiv=1), EYE, 'head'),
            lp.Part('brow', lp.box(hc + Vector((0.03 * sgn, -0.08, 0.022)), (0.03, 0.012, 0.009),
                                   rotation=Euler((0, 0.12 * sgn, 0)).to_matrix()), HAIR, 'head'),
            lp.Part('ear', lp.blob(hc + Vector((0.078 * sgn, 0.004, 0.0)), (0.012, 0.02, 0.028), subdiv=1), SKIN, 'head'),
            # only slightly pointed
            lp.Part('ear_tip', lp.cone(hc + Vector((0.08 * sgn, 0.008, 0.016)), hc + Vector((0.09 * sgn, 0.016, 0.046)),
                                       0.01, sides=4), SKIN, 'head'),
        ]
    # chunky faceted curls over the crown, the back and the sides, leaving the face clear
    rnd = lp.seeded(3)
    n = 90
    golden = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        z = 1 - 2 * (i + 0.5) / n
        r = math.sqrt(1 - z * z)
        a = golden * i
        d = Vector((math.cos(a) * r, math.sin(a) * r, z))
        if d.z < -0.15:
            continue                        # nothing under the jaw
        if d.y < -0.25 and d.z < 0.42:
            continue                        # the face
        if abs(d.x) > 0.7 and d.z < 0.15 and d.y > -0.2:
            continue                        # the ears show through
        if d.z < 0.05 and d.y < 0.1:
            continue                        # cheeks and jaw stay bare
        p = hc + Vector((d.x * 0.082, d.y * 0.09, d.z * 0.098)) + d * 0.008
        size = rnd.uniform(0.024, 0.032)
        rot = Euler((rnd.uniform(0, 3), rnd.uniform(0, 3), rnd.uniform(0, 3))).to_matrix()
        parts.append(lp.Part(f'curl{i}', lp.blob(p, (size, size, size * 0.85), subdiv=1, rotation=rot), HAIR, 'head'))
    # film-like proportions: a head about a sixth of his height, not a toy's
    pivot = Matrix.Translation((0, 0, 0.85))
    shrink = pivot @ Matrix.Scale(HEAD_SCALE, 4) @ pivot.inverted()
    for p in parts:
        bmesh.ops.transform(p.bm, matrix=shrink, verts=p.bm.verts)
    return parts


def build_mesh():
    parts = []
    # breeches: seat and thighs, to just below the knee
    parts.append(lp.Part('seat', lp.loft(body_rings(0.415, 0.525, grow=-0.004, levels=4), sides=12),
                         BREECHES, lp.blend_weights([(0.5, 'hips'), (0.56, 'spine')])))
    for s in ('L', 'R'):
        hip, knee, ankle = J[f'hip.{s}'], J[f'knee.{s}'], J[f'ankle.{s}']
        top = hip + Vector((0, -0.005, 0.03))
        parts.append(lp.Part(f'thigh.{s}', limb(top, knee + Vector((0, 0, -0.012)), [0.058, 0.06, 0.054, 0.047]),
                             BREECHES, f'thigh.{s}'))
        parts.append(lp.Part(f'cuff.{s}', limb(knee + Vector((0, 0, 0.002)), knee + Vector((0, 0, -0.022)), [0.048, 0.048]),
                             BREECHES, f'shin.{s}'))
        parts.append(lp.Part(f'shin.{s}', limb(knee, ankle + Vector((0, 0, -0.01)), [0.04, 0.045, 0.038, 0.033]),
                             SKIN, f'shin.{s}'))
        parts += foot(s)
    # shirt (seen at the neck and the V of the waistcoat), waistcoat, buttons, coat
    parts.append(lp.Part('shirt', lp.loft(body_rings(0.66, 0.80, grow=-0.006, levels=4), sides=12), SHIRT, TORSO_WEIGHTS))
    parts.append(lp.Part('shirt_collar', limb((0, 0.004, 0.775), (0, 0.006, 0.81), [0.052, 0.047], sides=9),
                         SHIRT, lp.blend_weights([(0.78, 'chest'), (0.81, 'neck')])))
    parts.append(lp.Part('waistcoat', waistcoat(), WAISTCOAT, TORSO_WEIGHTS))
    parts += [lp.Part('button', bm, BRASS, TORSO_WEIGHTS) for bm in buttons()]
    parts.append(lp.Part('coat', coat_shell(), COAT, lp.blend_weights([(0.5, 'hips'), (0.58, 'spine'), (0.66, 'spine'), (0.73, 'chest')])))
    parts.append(lp.Part('coat_collar', collar(), COAT, lp.blend_weights([(0.79, 'chest'), (0.83, 'neck')])))
    # sleeves, shirt cuffs, hands
    for s in ('L', 'R'):
        sh, el, wr = J[f'shoulder.{s}'], J[f'elbow.{s}'], J[f'wrist.{s}']
        parts.append(lp.Part(f'shoulder.{s}', lp.blob(sh + Vector((0, 0.004, -0.004)), (0.038, 0.042, 0.036), subdiv=2),
                             COAT, lp.blend_weights([(0.72, f'upper_arm.{s}'), (0.78, 'chest')])))
        parts.append(lp.Part(f'upper_arm.{s}', limb(sh, el, [0.042, 0.04, 0.036]), COAT, f'upper_arm.{s}'))
        parts.append(lp.Part(f'elbow.{s}', lp.blob(el, (0.036, 0.036, 0.036), subdiv=1), COAT, f'forearm.{s}'))
        parts.append(lp.Part(f'forearm.{s}', limb(el, wr + (wr - el).normalized() * 0.006, [0.035, 0.034, 0.038]),
                             COAT, f'forearm.{s}'))
        parts.append(lp.Part(f'shirt_cuff.{s}', limb(wr - (wr - el).normalized() * 0.002, wr + (wr - el).normalized() * 0.016,
                                                      [0.03, 0.028]), SHIRT, f'forearm.{s}'))
        parts += hand(s)
    # neck and head
    parts.append(lp.Part('neck', limb((0, 0.006, 0.77), (0, 0.0, 0.87), [0.041, 0.04, 0.042], sides=8),
                         SKIN, lp.blend_weights([(0.8, 'neck'), (0.86, 'head')])))
    parts += head()
    return lp.finish('bilbo', parts)


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = Path(args[args.index('--out') + 1]) if '--out' in args else ROOT / 'out' / 'models' / 'bilbo.glb'
    blend = ROOT / 'assets' / 'characters' / 'bilbo' / 'bilbo.blend'
    out.parent.mkdir(parents=True, exist_ok=True)
    blend.parent.mkdir(parents=True, exist_ok=True)

    arm = rig.build_armature('bilbo', J)
    mesh = build_mesh()
    rig.bind(mesh, arm)
    made = rig.make_clips(arm, rig.clips(HEIGHT, J), J)
    tris = sum(len(p.vertices) - 2 for p in mesh.data.polygons)
    print(f'bilbo: {tris} triangles, {len(arm.data.bones)} bones, clips: '
          + ', '.join(f'{n} ({f} frames)' for n, f in made))
    bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True)
    rig.export_glb(out, [arm, mesh])
    print(f'wrote {blend.relative_to(ROOT)} and {out}')


if __name__ == '__main__':
    main()
