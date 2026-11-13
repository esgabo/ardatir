"""The Shire kit: Bywater and the Green Dragon, a whole diorama tile (#24), built in Blender.

    blender --background --python scripts/models/blender/bywater.py -- [--out out/models/green-dragon.glb] [--blend <path>]

Writes the raw export (default `out/models/green-dragon.glb`); `npm run model:pack` compresses
it into `assets/kits/shire/green-dragon.glb`, which an event's staging names as its `set:`.

Our own design, from The Hobbit, chapter 2 and The Lord of the Rings: the lane comes down off
the Hill past the last hobbit-holes — Bag End's own round green door at its head — and runs east
to the inn at Bywater, a timbered hobbit-sized house under thatch with a painted sign hanging
over the road. Below the lane the Water spreads into Bywater Pool, with the mill and its wheel
on the near bank. The tile is a plinth with cut earth sides, the stream falling off its east
edge. Bilbo's dash from his own door to the waiting ponies crosses it corner to corner.

Everything shared with the other tiles — the coordinate map, the palette, the terrain, the
plinth, the decor helpers — is in `kit.py`; what the site reads by name is listed there.
"""

import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Euler, Matrix

sys.path.insert(0, str(Path(__file__).parent))
import kit  # noqa: E402
import lowpoly as lp  # noqa: E402
from kit import *  # noqa: E402,F403  (the shared tile pieces: see kit.py)
from kit import _hash  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []

FURROW = lp.material('furrow', '#6b4a30')
FURROW_LIGHT = lp.material('furrow_light', '#7d593a')

FLOOR = 0.28         # the level of the doorstep, the lane's shoulder and the inn's yard
WATER_Y = -0.22      # the surface of the Water, below the meadow

door_parts = []      # Bag End's door: its own object, so the site can swing it open

# --- the plan: the lane, the Water, the banks ---------------------------------------------------

# The lane: in at the north-west corner off the Hill, east past the inn, out at the east edge.
LANE = [(-7.6, -0.9), (-5.9, -0.35), (-4.2, 0.15), (-2.3, 0.8), (-0.4, 1.7),
        (1.5, 2.6), (3.7, 2.95), (5.6, 2.8), (7.6, 2.35)]
# Bag End's garden path, from its doorstep down to the gate on the lane.
PATH = [(-5.5, -1.75), (-5.42, -1.2), (-5.3, -0.6), (-5.18, -0.1)]
# The Water: in from the west, spread into the Pool, out over the east edge.
STREAM = [(-7.6, 4.55), (-5.6, 4.75), (-3.6, 5.2), (-1.4, 5.65), (1.2, 5.75),
         (3.4, 5.45), (5.4, 5.0), (7.6, 4.6)]
POOL = (0.1, 5.35, 3.5, 1.3)      # the Pool itself: an ellipse (x, z, rx, rz)
# A brook off the Hill, under the lane's little bridge, down into the Pool.
BROOK = [(-2.9, -7.6), (-2.6, -4.6), (-2.3, -2.4), (-2.05, -0.2), (-1.85, 1.9), (-1.6, 3.6), (-1.4, 4.9)]
BRIDGE = (0.0, 0.0)               # where the lane crosses the brook: found below
HEDGES = ([(-7.4, 1.35), (-5.2, 1.8), (-3.2, 2.4)],
          [(-0.3, 3.0), (1.9, 3.3), (4.0, 3.35)],
          [(0.9, -3.8), (3.2, -4.1), (5.5, -3.9)])

# The banks the hobbit-holes are dug into: (x from, x to, z of the front, how high).
BANKS = [(-7.8, -3.5, -1.85, 1.75),     # Bag End's own, at the lane's head
         (-2.9, -1.0, -2.35, 1.2),      # a neighbour's, across the brook
         (5.7, 7.8, -2.55, 1.45)]       # the last hole before the fields
# Round doors in those banks: (x, y above the ground at its foot, radius, bank index)
HOLE_DOORS = [(-5.5, 0.47, 0.47, 0), (-2.0, 0.40, 0.40, 1), (6.6, 0.42, 0.42, 2)]
HOLE_WINDOWS = [(-6.5, 0.70, 0.26, 0), (-4.3, 0.66, 0.23, 0), (-2.8, 0.60, 0.20, 1),
                (-1.2, 0.58, 0.18, 1), (5.9, 0.62, 0.20, 2)]

# The inn: its walls, and the yard in front of it.
INN = (0.9, 5.5, -3.4, 0.1)       # x from, x to, z from (back), z to (its front wall)
INN_WALL = 1.18                   # the ground floor's height above FLOOR
INN_UPPER = 0.82                  # the storey over it
INN_EAVE = FLOOR + INN_WALL + INN_UPPER
INN_RIDGE = INN_EAVE + 1.15
INN_DOOR = (2.25, 0.52)           # the front door: centre x, width
MILL = (-5.0, 3.15)               # the mill house on the Water's near bank

# Flat places, where things are built and characters stand: (x0, x1, z0, z1, feather, height)
PADS = [(-7.4, -3.3, -2.3, 0.45, 1.1, FLOOR),    # Bag End's doorstep and its garden
        (0.5, 5.9, -3.6, 2.4, 1.2, FLOOR),       # the inn and the yard where the ponies wait
        (1.2, 5.6, -6.7, -4.3, 1.4, 0.95)]       # the ploughed field behind it, levelled


def crossing(a, b, step=0.03):
    """The point on polyline `a` that comes nearest polyline `b`."""
    best, at = 1e9, a[0]
    pts = resample(a, step)
    for x, z in pts:
        d = polyline_dist(b, x, z)[0]
        if d < best:
            best, at = d, (x, z)
    return at


def lane_d(x, z):
    return polyline_dist(LANE, x, z)[0]


def path_d(x, z):
    return polyline_dist(PATH, x, z)[0]


def brook_d(x, z):
    return polyline_dist(BROOK, x, z)[0]


def water_d(x, z):
    """How far outside the Water's channel and the Pool (0 inside)."""
    d = polyline_dist(STREAM, x, z)[0] - 0.62
    px, pz, rx, rz = POOL
    e = math.hypot((x - px) / rx, (z - pz) / rz)
    return min(max(0.0, d), max(0.0, (e - 1.0) * 1.3))


BRIDGE = crossing(BROOK, LANE)


def pad(x, z):
    """The level ground is made to here and how strongly, for the places things are built."""
    best, level = 0.0, FLOOR
    for x0, x1, z0, z1, feather, y in PADS:
        out = max(x0 - x, x - x1, z0 - z, z - z1, 0.0)
        f = 1 - smooth(0.0, feather, out)
        if f > best:
            best, level = f, y
    return best, level


def base_height(x, z):
    """The walkable ground: a shoulder of the Hill falling south to the Water."""
    n = noise(x * 0.42, z * 0.42, 2) * 0.7 + noise(x * 1.05, z * 1.05, 5) * 0.3
    h = 0.34 + 0.34 * n - 0.075 * z
    f, level = pad(x, z)
    h = h + (level - h) * f
    h -= 0.07 * (1 - smooth(0.22, 0.55, lane_d(x, z)))          # the lane is worn a little lower
    # the brook's channel, except where the lane crosses it on its bridge
    cut = (1 - smooth(0.2, 0.6, brook_d(x, z))) * smooth(0.35, 1.1, math.dist((x, z), BRIDGE))
    h -= 0.3 * cut
    # the Water: the bank drops to the bed of the Pool
    h -= (0.3 + 0.42 * (1 - smooth(0.0, 2.2, water_d(x, z)))) * (1 - smooth(0.0, 1.4, water_d(x, z)))
    return h


def bank_height(x, z):
    """How high the hobbit-holes' banks stand above the ground, or 0 off them."""
    h = 0.0
    for x0, x1, zf, hh in BANKS:
        if z > zf:
            continue
        fx = smooth(0.0, 1.0, x - x0) * smooth(0.0, 1.0, x1 - x)
        fz = smooth(0.0, 0.85, zf - z)
        n = (noise(x * 0.75, z * 0.75, 13) - 0.5) * 0.34
        h = max(h, (hh + n) * fx * fz)
    return max(0.0, h)


def top_height(x, z):
    return base_height(x, z) + bank_height(x, z)


kit.ground, kit.top = base_height, top_height   # the decor helpers stand things on this tile
kit.DEPTH = 1.45                                # this meadow stands high: a shallower plinth


def bank_foot(i):
    """The ground at the foot of bank `i`'s front, where its door sits."""
    x0, x1, zf, _ = BANKS[i]
    return base_height((max(x0, -HALF) + min(x1, HALF)) / 2, zf + 0.02)


# --- the ground, the banks and the water, painted face by face ----------------------------------

GRASS_WET = hexc('#78a84e')
YARD = hexc('#b49b74')
SAND_BANK = hexc('#c3ac80')
MUD = hexc('#8a7450')


def ground_colour(x, z, seed):
    j = (_hash(x * 3.1, z * 2.7, seed) - 0.5) * 0.07
    n = noise(x * 0.6, z * 0.6, 21)
    c = mix(GRASS_DEEP, GRASS_DRY, smooth(0.35, 0.8, n))
    if z > 3.2:                                   # the meadow by the Water stays green
        c = mix(c, GRASS_WET, smooth(3.2, 4.4, z))
    c = mix(c, LANE_EDGE, 0.6 * (1 - smooth(0.25, 0.75, lane_d(x, z))))
    wd = water_d(x, z)
    if wd < 0.9:                                  # a shore of wet sand and mud
        c = mix(c, SAND_BANK if (x + z) % 1.3 < 0.8 else MUD, 1 - smooth(0.1, 0.9, wd))
    if brook_d(x, z) < 0.45 and math.dist((x, z), BRIDGE) > 0.7:
        c = mix(c, MUD, 0.7)
    # the yard in front of the inn is beaten earth
    yard = (1 - smooth(0.0, 0.8, max(0.6 - x, x - 5.8, 0.1 - z, z - 2.3, 0.0)))
    c = mix(c, YARD, yard * 0.85)
    return clamp_colour(c, j)


def bank_colour(x, z, seed):
    h = bank_height(x, z)
    c = ground_colour(x, z, seed)
    if h > 0.05:
        n = noise(x * 0.8, z * 0.8, 31)
        c = mix(GRASS, GRASS_DRY, smooth(0.4, 0.85, n))
        c = mix(c, GRASS_DEEP, smooth(0.8, 2.0, h) * 0.5)
    return clamp_colour(c, (_hash(x * 4.1, z * 3.3, seed) - 0.5) * 0.08)


def banks():
    """The grassy banks over the hobbit-holes, and their fronts with the doors and windows."""
    p = Painted()
    nx, nz = round(2 * HALF / STEP), round(2 * HALF / STEP)
    xs = [-HALF + 2 * HALF * i / nx for i in range(nx + 1)]
    zs = [-HALF + 2 * HALF * j / nz for j in range(nz + 1)]
    for i in range(nx):
        for j in range(nz):
            corners = [(xs[i], zs[j]), (xs[i + 1], zs[j]), (xs[i], zs[j + 1]), (xs[i + 1], zs[j + 1])]
            if max(bank_height(x, z) for x, z in corners) < 1e-4:
                continue
            a, b, c, d = (P(x, top_height(x, z), z) for x, z in corners)
            tris = ((a, c, d), (a, d, b)) if (i + j) % 2 else ((a, c, b), (b, c, d))
            for k, tri in enumerate(tris):
                cx = sum(q.x for q in tri) / 3
                cz = -sum(q.y for q in tri) / 3
                p.face(list(tri), bank_colour(cx, cz, 7 + k))

    # each bank's front: a face of turf over earth, with stone laid round the doors
    stone_cols = [hexc(h) for h in ('#a39a8a', '#948b7c', '#b0a796', '#8a8274', '#9d9483')]
    for bi, (x0, x1, zf, _) in enumerate(BANKS):
        foot = bank_foot(bi)
        doors = [(dx, foot + dy, dr) for dx, dy, dr, b in HOLE_DOORS if b == bi]
        wins = [(wx, foot + wy, wr) for wx, wy, wr, b in HOLE_WINDOWS if b == bi]

        def hole(x, y):
            if any(math.hypot(x - dx, max(0.0, y - dy)) < dr and y >= foot - 0.01 for dx, dy, dr in doors):
                return True
            return any(math.hypot(x - wx, y - wy) < wr for wx, wy, wr in wins)

        xa0, xb1 = max(x0, -HALF), min(x1, HALF)
        n = max(1, round((xb1 - xa0) / 0.12))
        for i in range(n):
            xa = xa0 + (xb1 - xa0) * i / n
            xb = xa0 + (xb1 - xa0) * (i + 1) / n
            ta, tb = top_height(xa, zf), top_height(xb, zf)
            ba, bb = base_height(xa, zf + 0.002), base_height(xb, zf + 0.002)
            if max(ta - ba, tb - bb) < 0.02:
                continue
            y = min(ba, bb) - 0.06
            r = 0
            while y < max(ta, tb):
                y0, y1 = y, y + 0.12
                ya0, yb0 = max(y0, ba - 0.06), max(y0, bb - 0.06)
                ya1, yb1 = min(y1, ta), min(y1, tb)
                cx, cy = (xa + xb) / 2, (y0 + y1) / 2
                if (ya1 > ya0 + 1e-4 or yb1 > yb0 + 1e-4) and not hole(cx, cy):
                    turf = min(ta, tb) - cy
                    near_door = any(math.hypot(cx - dx, cy - dy) < dr + 0.75 for dx, dy, dr in doors)
                    if turf < 0.1:
                        c = GRASS_DEEP
                    elif turf < 0.3:
                        c = TOPSOIL
                    elif near_door:
                        c = stone_cols[(r * 3 + i) % len(stone_cols)]
                    else:
                        c = strata(cy - 0.2, min(ta, tb) - 0.2, 13, cx)
                    p.quad(P(xa, ya0, zf), P(xb, yb0, zf), P(xb, max(yb1, yb0), zf), P(xa, max(ya1, ya0), zf), c)
                y, r = y1, r + 1
    return finish_painted('banks', p)


def water_surface():
    """The Water: the channel and the Pool as one sheet, and the fall off the east edge."""
    p = Painted()
    deep = hexc('#3c7fa6')
    shallow = hexc('#67b2cf')
    nx = round(2 * HALF / 0.45)
    nz = round(2 * HALF / 0.45)
    for i in range(nx):
        for j in range(nz):
            xa, xb = -HALF + 2 * HALF * i / nx, -HALF + 2 * HALF * (i + 1) / nx
            za, zb = -HALF + 2 * HALF * j / nz, -HALF + 2 * HALF * (j + 1) / nz
            cx, cz = (xa + xb) / 2, (za + zb) / 2
            if water_d(cx, cz) > 0.02:
                continue
            d = 1 - smooth(0.0, 1.6, water_d(cx, cz) + 0.3)
            y = WATER_Y + 0.02 * math.sin(cx * 2.1 + cz * 1.7)
            c = mix(shallow, deep, d)
            p.quad(P(xa, y, zb), P(xb, y, zb), P(xb, y, za), P(xa, y, za),
                   clamp_colour(c, (_hash(cx * 5.1, cz * 4.3, 2) - 0.5) * 0.1))
    return finish_painted('water', p)


# --- Bywater: the holes, the inn, the mill, the green -------------------------------------------

def hobbit_holes():
    """The round doors and windows in the banks; Bag End's own opens."""
    for bi, (dx, dy, dr, b) in ((i, d) for i, d in enumerate(HOLE_DOORS)):
        x0, x1, zf, _ = BANKS[b]
        foot = bank_foot(b)
        cy = foot + dy
        if b == 0:   # Bag End: its own object, hinged on its west edge
            round_door(dx, cy, zf - 0.05, dr, door_parts, floor=foot)
        else:
            into(kit.parts)
            round_door(dx, cy, zf - 0.05, dr, kit.parts,
                       colour=DOOR if b == 1 else lp.material('door_blue', '#3a5f8a'), floor=foot)
            out_of()
        ring_z(dx, cy, zf + 0.03, dr - 0.02, dr + 0.09, WOOD, depth=0.07, sides=20, start=-0.05, end=math.pi + 0.05)
        for sx in (-1, 1):
            bx((dx + sx * (dr + 0.035), (foot + cy) / 2, zf + 0.03), (0.11, cy - foot, 0.08), WOOD)
        bx((dx, foot + 0.03, zf + 0.2), (dr * 2.0, 0.06, 0.36), STONE)        # the doorstep
        del bi, x0, x1
    for wx, wy, wr, b in HOLE_WINDOWS:
        _, _, zf, _ = BANKS[b]
        cy = bank_foot(b) + wy
        disc_z(wx, cy, zf - 0.04, wr, GLOW_WINDOW, sides=14)
        ring_z(wx, cy, zf + 0.02, wr - 0.02, wr + 0.06, DOOR, depth=0.05, sides=14)
        bx((wx, cy, zf - 0.01), (0.03, wr * 2, 0.02), DOOR_DARK)
        bx((wx, cy, zf - 0.01), (wr * 2, 0.03, 0.02), DOOR_DARK)
        if wr > 0.2:
            bx((wx, cy - wr - 0.06, zf + 0.1), (wr * 2.1, 0.1, 0.16), WOOD)
            flowers(wx, zf + 0.1, wr, 0.05, 6, int(wx * 10) + 400, ['red', 'yellow', 'pink'])
    # chimneys out of the turf over each hole
    smokes = []
    for b, (cx, cz) in enumerate(((-5.2, -3.1), (-1.9, -3.6), (6.5, -3.9))):
        y = top_height(cx, cz)
        bx((cx, y + 0.14, cz), (0.26, 0.55, 0.26), STONE, taper=0.9)
        bx((cx, y + 0.43, cz), (0.32, 0.07, 0.32), STONE_DARK)
        cyl((cx, y + 0.46, cz), 0.07, 0.12, POT, sides=8)
        smokes.append((cx, y + 0.64, cz))
        del b
    return smokes


def timber_panel(x0, x1, y0, y1, z, brace=True, seed=0):
    """A plaster panel in a dark timber frame, facing +z (the inn's walls)."""
    bx(((x0 + x1) / 2, (y0 + y1) / 2, z), (x1 - x0, y1 - y0, 0.07), PLASTER)
    t = 0.075
    for y in (y0, y1):
        bx(((x0 + x1) / 2, y, z - 0.035), (x1 - x0 + t, t, 0.05), WOOD_DARK)
    for x in (x0, x1):
        bx((x, (y0 + y1) / 2, z - 0.035), (t, y1 - y0, 0.05), WOOD_DARK)
    if brace and x1 - x0 > 0.45 and y1 - y0 > 0.45:
        # a corner-to-corner brace: tilted in the wall's own plane, not yawed out of it
        L = math.hypot(x1 - x0, y1 - y0)
        a = math.atan2(y1 - y0, x1 - x0) * (1 if seed % 2 else -1)
        c = ((x0 + x1) / 2, (y0 + y1) / 2, z - 0.03)
        bm = lp.box(P(*c), (L, 0.05, 0.07))
        bmesh.ops.rotate(bm, cent=P(*c), matrix=Matrix.Rotation(a, 3, 'Y').inverted(), verts=bm.verts)
        add(bm, WOOD_DARK)


def gable_roof(x0, x1, z0, z1, eave, ridge, mat, mat_dark, over=0.26):
    """A thatched gable roof, ridge running east-west, overhanging all round."""
    xa, xb = x0 - over, x1 + over
    za, zb = z0 - over, z1 + over
    zm = (z0 + z1) / 2
    n = max(2, round((xb - xa) / 0.5))
    for i in range(n):
        ax = xa + (xb - xa) * i / n
        bx_ = xa + (xb - xa) * (i + 1) / n
        m = mat if i % 2 else mat_dark
        for zs, ze in ((za, zm), (zm, zb)):
            bm = bmesh.new()
            q = [P(ax, eave, zs), P(bx_, eave, zs), P(bx_, ridge, zm), P(ax, ridge, zm)] if ze == zm else \
                [P(ax, ridge, zm), P(bx_, ridge, zm), P(bx_, eave, ze), P(ax, eave, ze)]
            vs = [bm.verts.new(v) for v in q]
            bm.faces.new(vs)
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.12)
            add(bm, m)
    # the gable ends, filled in under the slopes
    for x in (x0, x1):
        bm = bmesh.new()
        vs = [bm.verts.new(v) for v in (P(x, eave, z0 - 0.02), P(x, ridge, zm), P(x, eave, z1 + 0.02))]
        bm.faces.new(vs)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.06)
        add(bm, PLASTER)
    # a rolled ridge along the top, and a thick rolled edge at each eave
    nr = max(3, round((xb - xa) / 0.28))
    for i in range(nr):
        x = xa + (xb - xa) * (i + 0.5) / nr
        bl((x, ridge + 0.02, zm), (0.15, 0.07, 0.14), mat_dark if i % 2 else mat, subdiv=0)
        for ze in (za, zb):
            bl((x, eave - 0.03, ze), (0.15, 0.09, 0.1), mat_dark if i % 2 else mat, subdiv=0)
    ne = max(2, round((zb - za) / 0.3))
    for i in range(ne):     # and down the gable verges
        z = za + (zb - za) * (i + 0.5) / ne
        f = 1 - abs(z - zm) / max(1e-6, zm - za)
        for xe in (xa, xb):
            bl((xe, eave + (ridge - eave) * f - 0.02, z), (0.1, 0.08, 0.14), mat if i % 2 else mat_dark, subdiv=0)


def dragon_sign(x, z, y):
    """The inn's sign: a green dragon painted on a board, hung from an iron arm over the lane."""
    cyl((x, base_height(x, z), z), 0.055, y, WOOD_DARK, sides=8)
    bx((x + 0.38, base_height(x, z) + y - 0.04, z), (0.8, 0.06, 0.06), IRON)
    bx((x + 0.1, base_height(x, z) + y - 0.2, z), (0.36, 0.04, 0.04), IRON, rot=0.78)
    sy = base_height(x, z) + y - 0.1
    sx = x + 0.72
    for dy in (0.0, -0.02):
        cyl((sx, sy + dy, z), 0.012, 0.14, IRON, sides=4)
    board_y = sy - 0.42
    bx((sx, board_y, z), (0.78, 0.6, 0.05), WOOD_DARK)
    bx((sx, board_y, z - 0.035), (0.68, 0.5, 0.02), CAKE)
    bx((sx, board_y, z + 0.035), (0.68, 0.5, 0.02), CAKE)
    # the dragon, painted on both faces: a coiled green body, a wing, a tail, one red eye
    green = lp.material('dragon_green', '#2f8a46')
    green_dark = lp.material('dragon_green_dark', '#1f6a36')
    red = lp.material('dragon_eye', '#c8392f')
    for face, zz in ((1, z - 0.05), (-1, z + 0.05)):
        # the body: a worm curling from the lower left up to the head on the right
        body = ((-0.2, -0.14, 0.055), (-0.1, -0.16, 0.07), (0.0, -0.12, 0.075),
                (0.08, -0.03, 0.07), (0.12, 0.06, 0.06), (0.19, 0.11, 0.05))
        for k, (ox, oy, r) in enumerate(body):
            bl((sx + ox * face, board_y + oy, zz), (r, r, 0.014), green if k % 2 else green_dark, subdiv=0)
        add(lp.cone(P(sx - 0.18 * face, board_y - 0.13, zz), P(sx - 0.3 * face, board_y + 0.04, zz),
                    0.045, sides=3), green_dark)       # the tail, flicked up
        for k, (ax_, ay_, bx_, by_) in enumerate((((-0.02), 0.0, -0.1, 0.19), (0.04, 0.02, 0.06, 0.21))):
            add(lp.cone(P(sx + ax_ * face, board_y + ay_, zz), P(sx + bx_ * face, board_y + by_, zz),
                        0.1 - k * 0.03, sides=3), green if k else green_dark)   # two wings
        bl((sx + 0.25 * face, board_y + 0.13, zz), (0.07, 0.05, 0.014), green, subdiv=0)      # the head
        add(lp.cone(P(sx + 0.28 * face, board_y + 0.11, zz), P(sx + 0.4 * face, board_y + 0.09, zz),
                    0.035, sides=3), green_dark)       # the snout
        bl((sx + 0.25 * face, board_y + 0.15, zz), (0.022, 0.018, 0.016), red, subdiv=0)      # one red eye
        for s in (-1, 1):
            add(lp.cone(P(sx + 0.23 * face, board_y + 0.16, zz), P(sx + (0.26 + 0.03 * s) * face, board_y + 0.25, zz),
                        0.016, sides=3), green_dark)   # two little horns
        for k in range(4):   # a crest down the back
            t = k / 3
            cx_, cy_ = -0.08 + 0.26 * t, -0.1 + 0.2 * t
            add(lp.cone(P(sx + cx_ * face, board_y + cy_, zz), P(sx + (cx_ - 0.02) * face, board_y + cy_ + 0.06, zz),
                        0.022, sides=3), green_dark)
    return sx, sy - 0.02, z


def green_dragon():
    """The inn: timbered walls under thatch, glowing windows, a porch, a sign, chimneys."""
    x0, x1, z0, z1 = INN
    y0 = FLOOR
    y1 = y0 + INN_WALL
    y2 = y1 + INN_UPPER
    dx, dw = INN_DOOR
    big_win = (3.75, y0 + 0.72, 0.42, 0.34)      # the taproom's window: x, y, half width, half height
    small_win = (1.35, y0 + 0.74, 0.26, 0.26)

    # --- the ground floor, front wall: panels either side of the door and the windows
    def front_panels():
        edges = sorted([(x0, dx - dw / 2 - 0.08), (dx + dw / 2 + 0.08, big_win[0] - big_win[2] - 0.1),
                        (big_win[0] + big_win[2] + 0.1, x1)])
        for k, (a, b) in enumerate(edges):
            if b - a > 0.08:
                timber_panel(a, b, y0, y1, z1, seed=k)
        # over the door and the windows
        timber_panel(dx - dw / 2 - 0.08, dx + dw / 2 + 0.08, y0 + 1.0, y1, z1, brace=False)
        for wx, wy, wr, wh in (big_win, small_win):
            timber_panel(wx - wr - 0.1, wx + wr + 0.1, wy + wh + 0.08, y1, z1, brace=False)
            timber_panel(wx - wr - 0.1, wx + wr + 0.1, y0, wy - wh - 0.08, z1, brace=False)
        # the small window sits inside the west panel, so cut its panel out of that run
    front_panels()
    # the door: a dark reveal set back into the wall, the green leaf standing in front of it
    bx((dx, y0 + 0.5, z1 - 0.12), (dw + 0.1, 1.0, 0.06), SOOT)
    bx((dx, y0 + 0.47, z1 - 0.03), (dw, 0.94, 0.05), DOOR)
    disc_z(dx, y0 + 0.94, z1 - 0.005, dw / 2, DOOR, sides=14, flat_bottom=y0 + 0.94)
    for k in range(3):
        bx((dx - dw / 2 + dw * (k + 0.5) / 3, y0 + 0.5, z1 + 0.005), (0.016, 0.9, 0.012), DOOR_DARK)
    bl((dx + dw / 2 - 0.1, y0 + 0.5, z1 + 0.01), (0.035, 0.035, 0.03), BRASS)
    ring_z(dx, y0 + 0.94, z1 + 0.02, dw / 2 - 0.01, dw / 2 + 0.07, WOOD, depth=0.06, sides=14, start=0, end=math.pi)
    for sx in (-1, 1):
        bx((dx + sx * (dw / 2 + 0.03), y0 + 0.47, z1 + 0.02), (0.08, 0.94, 0.06), WOOD)
    bx((dx, y0 + 0.03, z1 + 0.16), (dw + 0.5, 0.06, 0.3), STONE)              # the threshold

    # the windows: small panes that glow
    lamps = []
    for wx, wy, wr, wh in (big_win, small_win):
        bx((wx, wy, z1 - 0.04), (wr * 2, wh * 2, 0.03), GLOW_WINDOW)
        bx((wx, wy, z1 + 0.02), (wr * 2 + 0.1, 0.06, 0.06), WOOD_DARK)
        bx((wx, wy + wh, z1 + 0.02), (wr * 2 + 0.14, 0.07, 0.07), WOOD_DARK)
        bx((wx, wy - wh, z1 + 0.02), (wr * 2 + 0.14, 0.07, 0.07), WOOD_DARK)
        for sx in (-1, 1):
            bx((wx + sx * wr, wy, z1 + 0.02), (0.06, wh * 2, 0.06), WOOD_DARK)
        for k in range(3):
            bx((wx - wr + wr * 2 * (k + 1) / 4, wy, z1 + 0.01), (0.03, wh * 2, 0.04), WOOD_DARK)
        lamps.append((wx, wy, z1 - 0.3))

    # --- the jettied upper storey, a little proud of the wall
    jut = 0.14
    bx(((x0 + x1) / 2, y1 + 0.06, z1 + jut / 2), (x1 - x0 + 0.1, 0.12, jut + 0.1), WOOD_DARK)
    for k in range(5):
        px_ = x0 + (x1 - x0) * (k + 0.5) / 5
        add(lp.cone(P(px_, y1 + 0.02, z1 + jut), P(px_, y1 - 0.26, z1 - 0.02), 0.05, sides=4), WOOD_DARK)
    upper_wins = [(1.5, 0.2), (2.6, 0.18), (3.8, 0.2), (4.9, 0.18)]
    runs, prev = [], x0
    for wx, wr in upper_wins:
        runs.append((prev, wx - wr - 0.1))
        prev = wx + wr + 0.1
    runs.append((prev, x1))
    for k, (a, b) in enumerate(runs):
        if b - a > 0.08:
            timber_panel(a, b, y1 + 0.12, y2, z1 + jut, seed=k + 1)
    for wx, wr in upper_wins:
        timber_panel(wx - wr - 0.1, wx + wr + 0.1, y1 + 0.12, y1 + 0.4, z1 + jut, brace=False)
        timber_panel(wx - wr - 0.1, wx + wr + 0.1, y1 + 0.4 + wr * 2 + 0.08, y2, z1 + jut, brace=False)
        bx((wx, y1 + 0.42 + wr, z1 + jut - 0.04), (wr * 2, wr * 2, 0.03), GLOW_WINDOW)
        bx((wx, y1 + 0.42 + wr, z1 + jut + 0.02), (wr * 2 + 0.1, 0.05, 0.05), WOOD_DARK)
        bx((wx, y1 + 0.42 + wr, z1 + jut + 0.01), (0.03, wr * 2, 0.04), WOOD_DARK)
        lamps.append((wx, y1 + 0.42 + wr, z1 + jut - 0.25))

    # --- the sides and the back: plain plaster between posts
    bx(((x0 + x1) / 2, y0 + (y2 - y0) / 2, z0), (x1 - x0, y2 - y0, 0.1), PLASTER)
    for x in (x0, x1):
        sx = 0.055 if x > (x0 + x1) / 2 else -0.055
        bx((x, y0 + (y2 - y0) / 2, (z0 + z1) / 2), (0.1, y2 - y0, z1 - z0), PLASTER)
        for yy in (y0 + 0.04, y1 + 0.06, y2 - 0.05):      # sill, mid rail, wall plate
            bx((x + sx, yy, (z0 + z1) / 2), (0.04, 0.1, z1 - z0), WOOD_DARK)
        for k in range(4):                                 # posts between them
            zz = z0 + (z1 - z0) * (k + 0.5) / 4
            bx((x + sx, y0 + (y2 - y0) / 2, zz), (0.04, y2 - y0, 0.09), WOOD_DARK)
    bx(((x0 + x1) / 2, y0 - 0.06, (z0 + z1) / 2), (x1 - x0 + 0.1, 0.14, z1 - z0 + 0.1), STONE_DARK)   # a plinth course

    gable_roof(x0 - 0.05, x1 + 0.05, z0 - 0.05, z1 + jut, y2, INN_RIDGE, THATCH, THATCH_DARK)

    # --- chimneys, one over the taproom hearth
    smokes = []
    for cx in (1.25, 4.9):
        bx((cx, INN_RIDGE - 0.35, (z0 + z1) / 2 - 0.3), (0.34, 1.4, 0.34), STONE, taper=0.92)
        bx((cx, INN_RIDGE + 0.4, (z0 + z1) / 2 - 0.3), (0.42, 0.1, 0.42), STONE_DARK)
        for k in range(2):
            cyl((cx - 0.08 + k * 0.16, INN_RIDGE + 0.44, (z0 + z1) / 2 - 0.3), 0.055, 0.14, POT, sides=6)
        smokes.append((cx, INN_RIDGE + 0.62, (z0 + z1) / 2 - 0.3))

    # --- the porch over the door: a little thatched hood on two posts
    porch_z = z1 + 0.44
    for sx in (-1, 1):
        px_ = dx + sx * 0.46
        gy = base_height(px_, porch_z)
        cyl((px_, gy, porch_z), 0.05, y0 + 1.12 - gy, WOOD_DARK, sides=6)
        add(lp.cone(P(px_, y0 + 0.95, porch_z), P(px_ + sx * -0.16, y0 + 1.1, z1 + 0.06), 0.035, sides=4), WOOD_DARK)
    bx((dx, y0 + 1.14, porch_z), (1.06, 0.06, 0.07), WOOD_DARK)
    for k in range(4):
        zz = z1 + 0.04 + 0.13 * k
        bx((dx, y0 + 1.28 - 0.05 * k, zz), (1.1 - 0.03 * k, 0.09, 0.15), THATCH if k % 2 else THATCH_DARK)
    # a lantern beside the door
    lan = (dx - 0.72, y0 + 1.0, z1 + 0.12)
    bx(lan, (0.13, 0.16, 0.13), WOOD_DARK)
    bl(lan, (0.055, 0.07, 0.055), GLOW_LAMP, subdiv=0)
    lamps.append(lan)

    sign = dragon_sign(0.05, 1.55, 1.95)
    return {'smokes': smokes, 'lamps': lamps, 'sign': sign,
            'fire': (big_win[0], y0 + 0.42, z1 - 0.55)}


def pony(x, z, facing=0.0, coat=PONY, seed=0, grazing=False):
    """A shaggy little pony, about 0.72 at the withers; a hobbit stands 0.82."""
    rnd = lp.seeded(seed)
    y = base_height(x, z)
    ca, sa = math.cos(facing), math.sin(facing)
    turn = Euler((0, 0, -facing)).to_matrix()     # site heading -> Blender's z rotation

    def at(fx, fz):
        return (x + fx * ca - fz * sa, z + fx * sa + fz * ca)

    back = y + 0.5
    bl((x, back, z), (0.36, 0.2, 0.21), coat, rot=turn)
    rx, rz = at(-0.2, 0)
    bl((rx, back + 0.02, rz), (0.2, 0.19, 0.2), coat, subdiv=0, rot=turn)    # the quarters
    for fx, fz in ((0.22, 0.13), (0.22, -0.13), (-0.2, 0.13), (-0.2, -0.13)):
        lx, lz = at(fx, fz)
        cyl((lx, y, lz), 0.038, 0.42, coat, sides=5)
        cyl((lx, y, lz), 0.044, 0.07, PONY_DARK, sides=5)      # a dark hoof
    # the neck and the head: up and watching, or down in the grass
    nx_, nz_ = at(0.26, 0)
    if grazing:
        hx, hz = at(0.46, 0)
        hy = y + 0.19
        add(lp.cone(P(nx_, back + 0.08, nz_), P(hx, hy + 0.08, hz), 0.11, sides=5), coat)
    else:
        hx, hz = at(0.4, 0)
        hy = back + 0.26
        add(lp.cone(P(nx_, back + 0.04, nz_), P(hx, hy, hz), 0.11, sides=5), coat)
    bl((hx, hy, hz), (0.15, 0.11, 0.1), coat, subdiv=0, rot=turn)
    mx, mz = at(0.55, 0) if not grazing else at(0.59, 0)
    bl((mx, hy - 0.02, mz), (0.08, 0.07, 0.07), PONY_DARK, subdiv=0, rot=turn)
    for s_ in (-1, 1):
        ax_, az_ = at(0.34, 0.05 * s_)
        add(lp.cone(P(ax_, hy + 0.06, az_), P(ax_, hy + 0.15, az_), 0.024, sides=3), coat)
    for k in range(4):          # the mane, down the crest
        t = k / 3
        mnx, mnz = (nx_ + (hx - nx_) * t, nz_ + (hz - nz_) * t)
        bl((mnx, (back + 0.12) + (hy + 0.06 - back - 0.12) * t, mnz), (0.05, 0.06, 0.05), PONY_DARK, subdiv=0)
    tx, tz = at(-0.36, 0)
    add(lp.cone(P(tx, back + 0.1, tz), P(tx - 0.07 * ca, y + 0.14, tz - 0.07 * sa), 0.055, sides=4), PONY_DARK)
    if rnd.random() < 0.7:      # a blanket and a pack on most of them: they are going on a journey
        bl((x, back + 0.17, z), (0.21, 0.05, 0.19), RUG if seed % 2 else CHAIR, subdiv=0, rot=turn)
        px_, pz_ = at(-0.08, 0)
        bl((px_, back + 0.25, pz_), (0.14, 0.09, 0.12), CAKE if seed % 3 else BREAD, subdiv=0, rot=turn)


def yard():
    """The inn's yard: the ponies waiting at the rail, a trough, barrels, tables and benches."""
    # the hitching rail: the ponies stand north of it, heads over the bar, looking down the lane
    rail_z = 1.8
    for k in range(5):
        px_ = 0.8 + k * 0.72
        cyl((px_, base_height(px_, rail_z), rail_z), 0.055, 0.6, WOOD, sides=6)
    bx((0.8 + 2 * 0.72, base_height(2.24, rail_z) + 0.55, rail_z), (3.0, 0.07, 0.07), WOOD)
    coats = [PONY, PONY_BAY, PONY_GREY, PONY_DARK, PONY, PONY_BAY, PONY_GREY, PONY_BAY]
    for k in range(5):
        px_ = 0.95 + k * 0.66
        pony(px_, rail_z - 0.5, facing=math.pi / 2, coat=coats[k], seed=50 + k, grazing=k % 3 == 1)
    # a water trough at the rail's east end, with two more ponies drinking
    tx, tz = 4.8, 1.6
    bx((tx, base_height(tx, tz) + 0.13, tz), (0.8, 0.26, 0.3), WOOD)
    bx((tx, base_height(tx, tz) + 0.22, tz), (0.72, 0.08, 0.22), WATER_DEEP)
    for sx in (-0.36, 0.36):
        bx((tx + sx, base_height(tx, tz) + 0.1, tz), (0.07, 0.2, 0.32), WOOD_DARK)
    for k, (px_, pz_, f) in enumerate(((4.5, 0.95, 1.9), (5.5, 1.1, 1.3))):
        pony(px_, pz_, facing=f, coat=coats[5 + k], seed=70 + k, grazing=True)
    # barrels and a crate against the inn's west gable, out of the way
    for k, (px_, pz_) in enumerate(((0.55, -1.1), (0.55, -0.68), (0.8, -0.9))):
        y = base_height(px_, pz_) + (0.34 if k == 2 else 0.0)
        cyl((px_, y, pz_), 0.17, 0.4, WOOD, sides=10)
        for by in (0.07, 0.33):
            cyl((px_, y + by, pz_), 0.175, 0.03, IRON, sides=10)
    bx((0.62, base_height(0.62, -0.2) + 0.12, -0.2), (0.4, 0.24, 0.3), WOOD_LIGHT)
    # two trestle tables with benches under the windows, mugs left standing on them
    for k, (tx_, tz_, rot) in enumerate(((1.2, 0.75, 0.1), (4.4, 0.7, -0.2))):
        y = base_height(tx_, tz_)
        bx((tx_, y + 0.4, tz_), (1.2, 0.06, 0.46), WOOD_LIGHT, rot=rot)
        for sx in (-0.5, 0.5):
            bx((tx_ + sx * 1.0, y + 0.2, tz_), (0.08, 0.4, 0.4), WOOD_DARK, rot=rot)
        for sz in (-0.42, 0.42):
            bx((tx_, y + 0.22, tz_ + sz), (1.1, 0.05, 0.2), WOOD, rot=rot)
            for sx in (-0.42, 0.42):
                bx((tx_ + sx * 0.95, y + 0.11, tz_ + sz), (0.07, 0.22, 0.16), WOOD_DARK)
        rnd = lp.seeded(90 + k)
        for m in range(3):
            mx = tx_ - 0.35 + m * 0.35 + rnd.uniform(-0.04, 0.04)
            mz = tz_ + rnd.uniform(-0.12, 0.12)
            cyl((mx, y + 0.43, mz), 0.045, 0.11, POT if m % 2 else BRASS, sides=6)
            cyl((mx, y + 0.52, mz), 0.04, 0.012, ALE, sides=6)
    # a mounting block by the rail, for short legs and tall ponies
    for k in range(3):
        bx((0.45, base_height(0.45, 1.3) + 0.06 + k * 0.11, 1.3 + k * 0.1),
           (0.5 - k * 0.08, 0.12, 0.3 - k * 0.07), STONE)


def mill():
    """The mill on the Water's near bank, its wheel turning in the stream."""
    mx, mz = MILL
    y = base_height(mx, mz)
    w, d, h = 1.9, 1.5, 1.25
    # a stone pier down to the water, so the house stands on something
    for k in range(4):
        bx((mx, y - 0.08 - k * 0.2, mz + 0.26 + k * 0.05), (w - 0.1 - 0.04 * k, 0.24, d * 0.6 + 0.08 * k),
           STONE_DARK if k % 2 else STONE)
    bx((mx, y + h / 2, mz), (w, h, d), PLASTER)
    for k in range(3):
        bx((mx - w / 2 + w * (k + 0.5) / 3, y + h / 2, mz + d / 2), (0.08, h, 0.06), WOOD_DARK)
    bx((mx, y + 0.1, mz), (w + 0.1, 0.2, d + 0.1), STONE_DARK)
    bx((mx, y + 0.62, mz + d / 2 + 0.02), (0.34, 0.34, 0.04), GLOW_WINDOW)
    bx((mx, y + 0.62, mz + d / 2 + 0.05), (0.38, 0.05, 0.05), WOOD_DARK)
    gable_roof(mx - w / 2, mx + w / 2, mz - d / 2, mz + d / 2, y + h, y + h + 0.72,
               TILE_ROOF, TILE_ROOF_DARK, over=0.18)
    bx((mx - 0.6, y + h + 0.5, mz - 0.3), (0.26, 0.8, 0.26), STONE, taper=0.9)
    # the wheel, on the south gable, dipping into the Water
    wx, wz = mx + w / 2 + 0.24, mz + 0.72
    wy = y + 0.46
    r = 0.62
    for s in (-0.12, 0.12):
        bm = bmesh.new()
        ring = []
        for k in range(14):
            a = 2 * math.pi * k / 14
            ring.append(bm.verts.new(P(wx + math.cos(a) * r, wy + math.sin(a) * r, wz + s)))
        inner = []
        for k in range(14):
            a = 2 * math.pi * k / 14
            inner.append(bm.verts.new(P(wx + math.cos(a) * (r - 0.09), wy + math.sin(a) * (r - 0.09), wz + s)))
        for k in range(14):
            bm.faces.new((inner[k], ring[k], ring[(k + 1) % 14], inner[(k + 1) % 14]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.05)
        add(bm, WOOD_DARK)
    for k in range(14):       # the paddles
        a = 2 * math.pi * k / 14
        px_ = wx + math.cos(a) * (r - 0.05)
        py_ = wy + math.sin(a) * (r - 0.05)
        bx((px_, py_, wz), (0.1, 0.16, 0.3), WOOD_LIGHT if k % 2 else WOOD, rot=-a)
    for k in range(6):        # the spokes
        a = math.pi * k / 3
        bx((wx, wy, wz), (r * 1.7, 0.05, 0.05), WOOD, rot=a)
    cyl((wx, wy, wz - 0.3), 0.07, 0.6, IRON, sides=8, axis='z')
    # the sluice bringing water to it, and the foam where it falls
    bx((wx - 0.5, wy + r - 0.08, wz), (1.0, 0.1, 0.34), WOOD_DARK)
    for k in range(5):
        bx((wx + 0.02, wy + r - 0.3 - k * 0.14, wz), (0.1, 0.16, 0.26), FOAM)
    for k in range(7):
        bl((wx + 0.06 * math.sin(k), WATER_Y + 0.04, wz + 0.3 - k * 0.1), (0.12, 0.05, 0.1), FOAM, subdiv=0)
    return (wx, WATER_Y - 0.05, wz)


def brook():
    """The brook off the Hill, in two runs so the lane's bridge spans it."""
    pts = resample(BROOK, 0.4)
    for lo, hi in ((-HALF, BRIDGE[1] - 0.55), (BRIDGE[1] + 0.55, POOL[1])):
        run = [q for q in pts if lo <= q[1] <= hi]
        if len(run) < 2:
            continue
        strip(run, 0.13, WATER, lift=0.13, wobble=0.2)
        for k, (qx, qz) in enumerate(run):
            if k % 3:
                continue
            rock((qx + 0.26 * (1 if k % 2 else -1), base_height(qx, qz) - 0.06, qz), 0.1, 800 + k,
                 ROCK_DARK, moss=k % 4 == 0, squash=0.8)
        for k in range(0, len(run), 2):
            qx, qz = run[k]
            bl((qx + 0.3, base_height(qx, qz) + 0.05, qz), (0.16, 0.12, 0.14), LEAF_DARK if k % 3 else HEDGE,
               subdiv=0)


def bridge():
    """The lane's little stone bridge over the brook."""
    bxc, bzc = BRIDGE
    y = base_height(bxc, bzc)
    for sz in (-0.38, 0.38):   # low parapets, a hobbit's hand-height
        for k in range(5):
            px_ = bxc - 0.5 + k * 0.25
            bx((px_, y + 0.22 + 0.02 * math.sin(k), bzc + sz), (0.25, 0.24, 0.13),
               STONE if k % 2 else STONE_WARM)
        bx((bxc, y + 0.36, bzc + sz), (1.3, 0.06, 0.17), STONE_DARK)
    # the deck the lane runs over, its abutments, and the dark of the arch between them
    bx((bxc, y + 0.05, bzc), (1.3, 0.1, 0.96), STONE_WARM)
    for sz in (-0.52, 0.52):
        bx((bxc, y - 0.14, bzc + sz), (1.3, 0.42, 0.2), STONE_DARK)
    bx((bxc, y - 0.2, bzc), (0.8, 0.36, 0.86), SOOT)
    for sx in (-0.72, 0.72):
        rock((bxc + sx, y - 0.14, bzc + 0.48), 0.19, 600 + int(sx * 10), ROCK_DARK)


def the_green():
    """Between the lane and the Water: willows, reeds, a bench, geese, a jetty."""
    for x, z, s, k in ((-6.2, 3.3, 1.05, 'willow'), (-1.1, 3.9, 0.95, 'willow'), (3.0, 4.2, 1.0, 'willow'),
                       (6.3, 3.6, 0.85, 'willow')):
        tree(x, z, s, k, seed=int(x * 7) + 30)
    for x, z, s, k in ((-6.6, -4.4, 1.2, 'oak'), (-0.2, -5.6, 1.0, 'oak'), (3.6, -5.2, 0.9, 'gold'),
                       (6.6, -6.2, 1.05, 'oak'), (-4.0, -6.4, 0.9, 'poplar'), (-3.3, -5.3, 0.8, 'poplar'),
                       (7.0, -0.3, 0.8, 'apple'), (-7.0, -2.9, 0.75, 'apple')):
        tree(x, z, s, k, seed=int(x * 11) + 60)
    # reeds and lilies round the Pool
    rnd = lp.seeded(123)
    for k in range(70):
        a = rnd.uniform(0, 6.28)
        px_, pz_ = POOL[0] + math.cos(a) * POOL[2] * rnd.uniform(0.85, 1.12), \
            POOL[1] + math.sin(a) * POOL[3] * rnd.uniform(0.85, 1.12)
        if abs(px_) > HALF - 0.15 or abs(pz_) > HALF - 0.15:
            continue
        y = max(base_height(px_, pz_), WATER_Y - 0.02)
        for d in (-0.04, 0.0, 0.05):
            add(lp.cone(P(px_ + d, y, pz_), P(px_ + d * 2, y + 0.3 + d, pz_ + d), 0.02, sides=3),
                LEAF_GOLD if k % 3 else LEAF_LIGHT)
    for k in range(14):
        a = k * 1.7
        px_ = POOL[0] + math.cos(a) * POOL[2] * 0.6
        pz_ = POOL[1] + math.sin(a) * POOL[3] * 0.5
        bl((px_, WATER_Y + 0.015, pz_), (0.14, 0.012, 0.12), LEAF_DARK, subdiv=0)
        if k % 3 == 0:
            bl((px_ + 0.04, WATER_Y + 0.04, pz_), (0.04, 0.03, 0.04), FLOWER['white'], subdiv=0)
    # stones and a jetty at the water's edge
    for k in range(9):
        px_ = -6.5 + k * 1.6
        pz_ = POOL[1] - POOL[3] * 1.05 + 0.2 * math.sin(k)
        rock((px_, base_height(px_, pz_) + 0.06, pz_), 0.18 + 0.05 * (k % 3), 700 + k, ROCK_DARK, moss=k % 2 == 0)
    jx, jz = 1.9, 4.5
    for k in range(4):
        pz_ = jz + k * 0.3
        for sx in (-0.28, 0.28):
            cyl((jx + sx, WATER_Y - 0.35, pz_), 0.045, 0.6, WOOD_DARK, sides=5)
        bx((jx, WATER_Y + 0.2, pz_), (0.72, 0.05, 0.26), PLANK_A if k % 2 else PLANK_B)
    # three geese on the green
    for k, (gx, gz, face) in enumerate(((-3.5, 3.15, 1), (-3.05, 3.5, -1), (-3.7, 3.7, 1))):
        y = base_height(gx, gz)
        bl((gx, y + 0.11, gz), (0.09, 0.07, 0.07), CLOTH, subdiv=0)
        add(lp.cone(P(gx + 0.05 * face, y + 0.13, gz), P(gx + 0.09 * face, y + 0.23, gz), 0.024, sides=4), CLOTH)
        bl((gx + 0.1 * face, y + 0.24, gz), (0.035, 0.028, 0.028), CLOTH, subdiv=0)
        add(lp.cone(P(gx + 0.12 * face, y + 0.24, gz), P(gx + 0.17 * face, y + 0.235, gz), 0.014, sides=3),
            FLOWER['orange'])
        for s in (-1, 1):
            cyl((gx - 0.02 * face, y, gz + 0.03 * s), 0.012, 0.06, FLOWER['orange'], sides=4)
        del k
    # a bench under the willow by the lane
    bxs, bzs = -1.6, 2.9
    y = base_height(bxs, bzs)
    bx((bxs, y + 0.26, bzs), (0.9, 0.06, 0.28), WOOD_LIGHT)
    for sx in (-0.36, 0.36):
        bx((bxs + sx, y + 0.13, bzs), (0.07, 0.26, 0.24), WOOD_DARK)
    bx((bxs, y + 0.44, bzs - 0.12), (0.9, 0.3, 0.05), WOOD_LIGHT)


def sheep(x, z, facing=0.0, seed=0, grazing=False):
    """A Shire sheep: a woolly blob on four short legs."""
    y = base_height(x, z)
    ca, sa = math.cos(facing), math.sin(facing)
    wool = lp.material('wool', '#efe9dc')
    face = lp.material('sheep_face', '#4a4440')
    bl((x, y + 0.3, z), (0.26, 0.19, 0.17), wool)
    bl((x + 0.1 * ca, y + 0.36, z + 0.1 * sa), (0.16, 0.13, 0.13), wool, subdiv=0)
    for fx, fz in ((0.13, 0.09), (0.13, -0.09), (-0.13, 0.09), (-0.13, -0.09)):
        lx, lz = x + fx * ca - fz * sa, z + fx * sa + fz * ca
        cyl((lx, y, lz), 0.026, 0.2, face, sides=4)
    hy = y + (0.18 if grazing else 0.36)
    hx, hz = x + 0.27 * ca, z + 0.27 * sa
    bl((hx, hy, hz), (0.09, 0.08, 0.07), face, subdiv=0)
    for sd in (-1, 1):
        add(lp.cone(P(hx - 0.03 * ca, hy + 0.04, hz - 0.03 * sa),
                    P(hx - 0.05 * ca - 0.06 * sa * sd, hy + 0.01, hz - 0.05 * sa + 0.06 * ca * sd),
                    0.022, sides=3), face)
    del seed


def village_green():
    """What else lives between the lane and the Water: sheep, a well, gardens, washing."""
    for k, (x, z, f, g) in enumerate(((-4.6, 1.9, 0.4, True), (-3.9, 2.4, 2.1, True), (-4.9, 2.8, 1.2, False),
                                      (-6.2, 2.5, 2.8, True))):
        sheep(x, z, facing=f, seed=k, grazing=g)
    # the village well, by the lane
    wx, wz = -0.9, 0.55
    y = base_height(wx, wz)
    for k in range(10):
        a = 2 * math.pi * k / 10
        bx((wx + math.cos(a) * 0.36, y + 0.21, wz + math.sin(a) * 0.36), (0.26, 0.42, 0.18),
           STONE if k % 2 else STONE_WARM, rot=-a)
    cyl((wx, y + 0.3, wz), 0.3, 0.04, WATER_DEEP, sides=10)
    for sx in (-0.33, 0.33):
        cyl((wx + sx, y + 0.4, wz), 0.045, 0.56, WOOD, sides=6)
    bx((wx, y + 0.95, wz), (0.78, 0.06, 0.06), WOOD_DARK)
    gable_roof(wx - 0.3, wx + 0.3, wz - 0.26, wz + 0.26, y + 0.97, y + 1.18,
               THATCH, THATCH_DARK, over=0.1)
    cyl((wx, y + 0.86, wz), 0.055, 0.56, WOOD, sides=8, axis='x')   # the windlass
    add(lp.cone(P(wx + 0.3, y + 0.86, wz), P(wx + 0.42, y + 0.78, wz), 0.03, sides=4), IRON)
    cyl((wx + 0.42, y + 0.72, wz), 0.02, 0.1, WOOD_DARK, sides=5)
    bx((wx - 0.04, y + 0.68, wz), (0.015, 0.3, 0.015), WOOD_DARK)   # the rope
    cyl((wx - 0.04, y + 0.5, wz), 0.085, 0.16, WOOD, sides=8)       # the bucket
    cyl((wx - 0.04, y + 0.62, wz), 0.09, 0.025, IRON, sides=8)
    # a neighbour's kitchen garden, under the second hole
    for i in range(4):
        for j in range(3):
            x, z = -2.9 + i * 0.4, -1.5 + j * 0.42
            bl((x, base_height(x, z) + 0.08, z), (0.12, 0.1, 0.12), CABBAGE if (i + j) % 2 else LEAF_LIGHT, subdiv=0)
    for i in range(3):
        x, z = -1.3, -1.5 + i * 0.42
        add(lp.cone(P(x, base_height(x, z), z), P(x, base_height(x, z) + 0.66, z), 0.025, sides=3), WOOD_LIGHT)
        bl((x, base_height(x, z) + 0.4, z), (0.07, 0.2, 0.07), LEAF_LIGHT, subdiv=0)
    # washing hung out between two poles beside Bag End's garden
    ax_, az_ = -6.9, 0.6
    b_x, b_z = -4.6, 0.95
    for px_, pz_ in ((ax_, az_), (b_x, b_z)):
        cyl((px_, base_height(px_, pz_), pz_), 0.04, 0.95, WOOD, sides=5)
    for k in range(6):
        t = (k + 0.5) / 6
        x, z = ax_ + (b_x - ax_) * t, az_ + (b_z - az_) * t
        y = base_height(x, z) + 0.9 - 0.06 * math.sin(math.pi * t)
        bx((x, y - 0.14, z), (0.22, 0.28, 0.02), [CLOTH, RUG, DOOR, CLOTH, RUG_GOLD, CHAIR][k])
    bx(((ax_ + b_x) / 2, base_height((ax_ + b_x) / 2, (az_ + b_z) / 2) + 0.88, (az_ + b_z) / 2),
       (b_x - ax_, 0.02, 0.02), WOOD_DARK)
    # a stack of firewood against the neighbour's bank
    for r in range(3):
        for k in range(6):
            bx((-0.75 + k * 0.1, base_height(-0.75, -1.9) + 0.07 + r * 0.13, -1.9),
               (0.09, 0.12, 0.44), BARK if (k + r) % 2 else WOOD_DARK)


def fields():
    """Behind the inn: a kitchen garden, a haystack, furrowed fields and fences."""
    # furrows in the field north-east of the inn
    for k in range(8):
        z = -6.4 + k * 0.36
        x0, x1 = 1.4, 5.4
        for s in range(8):
            px_ = x0 + (x1 - x0) * (s + 0.5) / 8
            y = base_height(px_, z)
            bx((px_, y + 0.015, z), ((x1 - x0) / 8, 0.05, 0.2),
               FURROW if k % 2 else FURROW_LIGHT)
    for k in range(18):
        rnd = lp.seeded(300 + k)
        px_ = 1.6 + rnd.uniform(0, 3.6)
        pz_ = -6.4 + rnd.uniform(0, 2.2)
        bl((px_, base_height(px_, pz_) + 0.08, pz_), (0.12, 0.1, 0.12), CABBAGE if k % 2 else LEAF_LIGHT, subdiv=0)
    # a haystack
    hx, hz = -0.3, -4.6
    y = base_height(hx, hz)
    bl((hx, y + 0.42, hz), (0.78, 0.45, 0.72), THATCH)
    add(lp.cone(P(hx, y + 0.72, hz), P(hx, y + 1.42, hz), 0.6, sides=7), THATCH_DARK)
    bl((hx + 0.9, y + 0.2, hz + 0.3), (0.3, 0.22, 0.28), THATCH, subdiv=0)
    add(lp.cone(P(hx + 1.0, y, hz + 0.6), P(hx + 1.15, y + 0.9, hz + 0.75), 0.03, sides=4), WOOD)   # a pitchfork
    for s in (-1, 0, 1):
        add(lp.cone(P(hx + 1.15, y + 0.85, hz + 0.75), P(hx + 1.15 + s * 0.06, y + 1.05, hz + 0.75), 0.015, sides=3), IRON)
    # a cart by the field gate
    cx, cz = 0.4, -4.6
    y = base_height(cx, cz)
    bx((cx, y + 0.38, cz), (1.1, 0.14, 0.58), PLANK_A)
    for sz in (-0.3, 0.3):
        bx((cx, y + 0.5, cz + sz), (1.05, 0.22, 0.05), PLANK_B)
    for sz in (-0.34, 0.34):
        for k in range(10):
            a = 2 * math.pi * k / 10
            bx((cx - 0.3 + math.cos(a) * 0.28, y + 0.3 + math.sin(a) * 0.28, cz + sz), (0.12, 0.08, 0.06), WOOD_DARK, rot=-a)
        cyl((cx - 0.3, y + 0.3, cz + sz), 0.07, 0.08, WOOD, sides=8, axis='z')
    for sz in (-0.22, 0.22):
        add(lp.cone(P(cx + 0.5, y + 0.34, cz + sz), P(cx + 1.2, y + 0.26, cz + sz), 0.04, sides=4), WOOD)
    # fences along the fields and the lane
    for line in (((0.6, -3.9), (5.8, -4.2)), ((6.2, 0.6), (6.3, -2.9))):
        (ax, az), (b_x, b_z) = line
        n = max(2, round(math.dist((ax, az), (b_x, b_z)) / 0.75))
        for k in range(n + 1):
            t = k / n
            px_, pz_ = ax + (b_x - ax) * t, az + (b_z - az) * t
            bx((px_, base_height(px_, pz_) + 0.28, pz_), (0.07, 0.56, 0.07), WOOD)
            if k:
                qx = ax + (b_x - ax) * (t - 0.5 / n)
                qz = az + (b_z - az) * (t - 0.5 / n)
                ang = math.atan2(b_z - az, b_x - ax)
                for gy in (0.2, 0.42):
                    bx((qx, base_height(qx, qz) + gy, qz),
                       (math.dist((ax, az), (b_x, b_z)) / n + 0.04, 0.05, 0.04), WOOD, rot=-ang)
    for line in HEDGES:
        hedge(line, len(line) + 5)


def ground_cover():
    """The lane itself, the garden path, flowers, tufts and rocks."""
    for width, colour, lift in ((0.42, '#b89a6a', 0.012), (0.24, '#c9ae7f', 0.02)):
        strip(resample(LANE, 0.25), width, lp.material(f'lane_{int(width * 100)}', colour), lift=lift)
    # Bag End's garden path: flat stones to the gate
    rnd = lp.seeded(5)
    t = 0.0
    while t <= 1.0:
        x, z = at_along(PATH, t)
        for off in (-0.12, 0.12):
            px_, pz_ = x + off + rnd.uniform(-0.03, 0.03), z + rnd.uniform(-0.04, 0.04)
            add(lp.jitter(lp.blob(P(px_, base_height(px_, pz_) + 0.01, pz_), (0.12, 0.11, 0.025), subdiv=1),
                          0.01, int(t * 999)), STONE if rnd.random() < 0.6 else STONE_DARK)
        t += 0.1
    # the garden gate on the lane
    gx, gz = -5.15, -0.05
    for sx in (-0.38, 0.38):
        bx((gx + sx, base_height(gx + sx, gz) + 0.3, gz), (0.09, 0.6, 0.09), WOOD_LIGHT)
        bl((gx + sx, base_height(gx + sx, gz) + 0.63, gz), (0.055, 0.045, 0.055), WOOD_LIGHT, subdiv=0)
    for k in range(4):
        bx((gx - 0.3 + k * 0.1, base_height(gx, gz) + 0.28, gz - 0.1 - k * 0.06), (0.03, 0.38, 0.03), WOOD_LIGHT)
    # Bag End's little garden, in front of its door
    for k, (cx, cz, rx, rz) in enumerate(((-6.3, -1.3, 0.7, 0.32), (-4.5, -1.25, 0.6, 0.3),
                                          (-6.0, -0.5, 0.55, 0.28), (-4.2, -0.45, 0.5, 0.26))):
        y = base_height(cx, cz)
        add(lp.blob(P(cx, y, cz), (rx, rz, 0.06), subdiv=2), lp.material('bed', '#5e4029'))
        flowers(cx, cz, rx * 0.85, rz * 0.85, int(26 * rx * rz / 0.25) + 5, 20 + k,
                [['pink', 'white', 'yellow'], ['red', 'orange'], ['blue', 'white', 'purple'], ['yellow', 'pink']][k])
    flowers(-2.6, 2.4, 1.3, 0.7, 20, 61, ['yellow', 'white'])
    flowers(2.0, 3.6, 1.4, 0.8, 22, 62, ['white', 'pink', 'yellow'])
    flowers(5.6, 4.2, 1.1, 0.7, 16, 63, ['blue', 'white'])
    flowers(-6.6, 5.6, 0.9, 0.7, 14, 64, ['purple', 'yellow'])

    def open_ground(x, z):
        if lane_d(x, z) < 0.55 or path_d(x, z) < 0.4 or water_d(x, z) < 0.5:
            return False
        if brook_d(x, z) < 0.5 or bank_height(x, z) > 0.02:
            return False
        if 0.3 < x < 6.1 and -3.8 < z < 2.5:      # the inn and its yard are swept
            return False
        return True

    tufts(90, 77, open_ground)
    for k, (x, z, r) in enumerate(((-6.9, 1.9, 0.4), (-0.6, -1.9, 0.3), (2.4, -1.6, 0.26), (6.8, -4.3, 0.45),
                                   (-5.0, 2.6, 0.32), (4.6, 6.4, 0.38), (-2.4, 6.5, 0.3), (6.9, 6.3, 0.42))):
        rock((x, top_height(x, z) + r * 0.25, z), r, 100 + k, ROCK if k % 3 else ROCK_DARK)
    # boulders and roots in the cut sides the camera sees
    for k, (x, y) in enumerate(((-5.3, -0.9), (-1.4, -1.25), (1.9, -0.7), (4.4, -1.4), (6.3, -0.5))):
        rock((x, y, HALF + 0.02), 0.22 + 0.06 * (k % 3), 200 + k, ROCK_DARK, moss=False, squash=0.9)
    for k, (z, y) in enumerate(((-5.0, -1.2), (-2.0, -0.8), (1.2, -1.5), (3.8, -1.0), (6.0, -1.35))):
        rock((HALF + 0.02, y, z), 0.24 + 0.05 * (k % 3), 220 + k, ROCK_DARK, moss=False, squash=0.9)
    rnd = lp.seeded(9)
    for k in range(14):
        side = k % 2
        a = rnd.uniform(-6.5, 6.5)
        y0 = (top_height(a, HALF) if side == 0 else top_height(HALF, a)) - rnd.uniform(0.12, 0.3)
        if side == 0:
            add(lp.cone(P(a, y0, HALF - 0.02), P(a + rnd.uniform(-0.2, 0.2), y0 - rnd.uniform(0.25, 0.5), HALF + 0.06),
                        0.025, sides=3), BARK)
        else:
            add(lp.cone(P(HALF - 0.02, y0, a), P(HALF + 0.06, y0 - rnd.uniform(0.25, 0.5), a + rnd.uniform(-0.2, 0.2)),
                        0.025, sides=3), BARK)
    for k, (x, z) in enumerate(((-3.9, 1.6), (-3.4, 2.1), (4.9, -0.1), (6.5, 2.9), (0.4, 6.4), (-6.8, 0.6))):
        bl((x, base_height(x, z) + 0.2, z), (0.32, 0.26, 0.3), LEAF if k % 2 else LEAF_DARK)


def waterfall():
    """Where the Water goes over the tile's east edge."""
    mouth_z = 4.6
    surf = WATER_Y
    fall = bmesh.new()
    cols, rows = 5, 8
    grid = []
    for r in range(rows + 1):
        y = surf - (surf + DEPTH + 0.3) * r / rows
        out = 0.05 + 0.25 * (r / rows) ** 0.5
        row = [fall.verts.new(P(HALF + out, y, mouth_z - 0.45 + 0.9 * c / cols + (0.03 if (r + c) % 2 else -0.03)))
               for c in range(cols + 1)]
        grid.append(row)
    for r in range(rows):
        for c in range(cols):
            fall.faces.new((grid[r][c], grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c]))
    bmesh.ops.recalc_face_normals(fall, faces=fall.faces)
    add(fall, WATER_DEEP)
    for k in range(7):
        bl((HALF + 0.02, surf + 0.01, mouth_z - 0.4 + k * 0.13), (0.06, 0.03, 0.07), FOAM, subdiv=0)
    for k in range(5):
        z = mouth_z - 0.35 + k * 0.17
        bx((HALF + 0.23, surf - 0.9 - (k % 2) * 0.3, z), (0.01, 0.7, 0.025), FOAM)
    return (HALF + 0.38, -DEPTH - 0.1, mouth_z)


# --- build --------------------------------------------------------------------------------------

def main():
    out = Path(ARGS[ARGS.index('--out') + 1]) if '--out' in ARGS else ROOT / 'out' / 'models' / 'green-dragon.glb'
    out.parent.mkdir(parents=True, exist_ok=True)

    objs = [terrain(ground_colour), plinth(), banks(), water_surface()]
    hole_smokes = hobbit_holes()
    inn = green_dragon()
    yard()
    wheel = mill()
    brook()
    bridge()
    the_green()
    village_green()
    fields()
    ground_cover()
    spray = waterfall()

    decor = lp.finish('bywater', kit.parts)
    door = hinge_object('door', door_parts,
                        (HOLE_DOORS[0][0] - HOLE_DOORS[0][2], bank_foot(0), BANKS[0][2] - 0.05))
    objs += [decor, door]
    tris = triangles(objs)

    empties = [empty('fx-fire', inn['fire']), empty('fx-spray-fall', spray), empty('fx-spray-wheel', wheel)]
    empties += [empty('fx-smoke-inn', inn['smokes'][0])]
    empties += [empty(f'fx-smoke-hole-{k}', at) for k, at in enumerate(hole_smokes[:2])]
    empties += [empty(f'fx-lamp-inn-{k}', at) for k, at in enumerate(inn['lamps'])]
    empties += [empty('fx-lamp-sign', inn['sign'])]
    empties += [empty(f'fx-lamp-hole-{k}', (wx, bank_foot(b) + wy, BANKS[b][2] - 0.3))
                for k, (wx, wy, wr, b) in enumerate(HOLE_WINDOWS) if wr > 0.2]
    empties += [empty(f'fx-fireflies-{k}', at) for k, at in enumerate(
        ((-3.4, 0.5, 3.6), (1.6, 0.5, 3.9), (5.4, 0.5, 4.2), (-6.0, 0.6, -0.9), (3.0, 0.7, 1.4)))]

    print(f'green-dragon: {tris} triangles, {len(kit.parts)} parts, {len(empties)} markers')
    blend = Path(ARGS[ARGS.index('--blend') + 1]) if '--blend' in ARGS else None
    if blend:
        bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True)
        print(f'wrote {blend}')
    export(out, objs + empties)
    print(f'wrote {out}')


if __name__ == '__main__':
    main()
