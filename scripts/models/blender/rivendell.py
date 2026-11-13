"""Rivendell: the Last Homely House above the Bruinen, a whole diorama tile (#46), in Blender.

    blender --background --python scripts/models/blender/rivendell.py -- [--out out/models/rivendell.glb] [--blend <path>]

Writes the raw export (default `out/models/rivendell.glb`); `npm run model:pack` compresses it
into `assets/kits/rivendell/last-homely-house.glb`, which an event's staging names as its `set:`.

Our own design, from The Hobbit, chapters 3 and 19: a hidden valley with a lawn open to the
south, where the company gathers. The house stands on a paved shelf along the west, timbered and
stone, with a long veranda and windows that warm as the light goes. North of the lawn the ground
breaks away into the gorge of the Bruinen; beyond the water the valley wall rises, with two falls
coming down a cleft in it, and a slender bridge crossing to a path on the far side. A low carved
balustrade keeps the lawn's edge, a brazier burns where the company stands, and a carved stand
holds the map Elrond reads by moonlight.

The two events on this tile are a midsummer night (the moon-letters) and a May evening (back in
Rivendell), so it is built to be seen in low light: the windows, the lanterns along the veranda
and the brazier are its own light (`glow-*` and the `fx-lamp-*` / `fx-fire` markers), and the
hour of the day is the light preset, not the set.

Everything shared with the other tiles — the coordinate map, the palette, the terrain, the
plinth, the decor helpers — is in `kit.py`; what the site reads by name is listed there.
"""

import math
import sys
from pathlib import Path

import bmesh
import bpy

sys.path.insert(0, str(Path(__file__).parent))
import kit  # noqa: E402
import lowpoly as lp  # noqa: E402
from kit import *  # noqa: E402,F403  (the shared tile pieces: see kit.py)
from kit import _hash  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []

# An elven house wants its own few materials; the rest come from the palette in kit.py.
PALE = lp.material('pale_stone', '#c6b89c')             # dressed stone, warm and light
PALE_DARK = lp.material('pale_stone_dark', '#a2957b')
SLATE = lp.material('slate', '#78818e')                 # shingled roofs
SLATE_DARK = lp.material('slate_dark', '#5f6874')
TIMBER = lp.material('timber', '#8a6340')               # the house's frame
TIMBER_DARK = lp.material('timber_dark', '#6b4a30')
CARVE = lp.material('carve', '#c4a259', roughness=0.4)  # the gold of carved work
BIRCH = lp.material('birch', '#e2ded1')
BIRCH_MARK = lp.material('birch_mark', '#6f6a60')
BIRCH_LEAF = lp.material('birch_leaf', '#8fb455')
COAL = lp.material('coal', '#b8441f')
LINEN = lp.material('linen', '#efe7d4')
PARCHMENT = lp.material('parchment', '#e3d3a8')
FIR = lp.material('fir', '#3b5c3a')
FIR_DARK = lp.material('fir_dark', '#2d4a30')

WATER_Y = -0.55          # the Bruinen's surface, well below the lawn

# The plan. These are the places the staging puts people, so they are named, not scattered.
HOUSE = (-6.9, -4.9, -3.3, 1.3)       # the hall: x0, x1, z0, z1
WING = (-4.9, -4.05, -2.0, 0.4)       # the lower east wing, with the door
PORCH_X = -3.5                        # the veranda's posts, east of the wing
DOOR = (-3.85, -0.45)                 # the front door's hinge: on the face of the wing's east wall
LIP = -3.85                           # the lawn's north edge, where the ground breaks away
RIVER = [(-7.4, -4.95), (-4.0, -5.2), (-0.5, -5.35), (3.2, -5.2), (7.4, -4.9)]
FALLS = (-1.1, 3.1)                   # where the two falls come down the valley wall
BRIDGE_X = 5.3
# The paved way in from the south-east corner, up the lawn to the veranda. Everyone walks it.
PATH = [(7.2, 5.7), (5.2, 4.4), (3.3, 3.1), (1.5, 1.9), (0.2, 0.7), (-1.5, -0.3), (-2.9, -1.0), (-3.7, -0.95)]
STAND = (-0.55, -1.55)                # the carved stand the map is read on
BENCH = (-0.2, 3.1)                   # the bench Bilbo dozes in front of
BRAZIER = (2.4, 0.4)                  # the fire the company stands round

front_door = []                       # the door's pieces: its own object, so the site swings it


# --- the lie of the land ------------------------------------------------------------------------

def path_d(x, z):
    return polyline_dist(PATH, x, z)[0]


def river_d(x, z):
    return polyline_dist(RIVER, x, z)[0]


def shelf_f(x):
    """1 on the house's paved shelf along the west, 0 out on the lawn."""
    return smooth(-3.2, -4.2, x)


def lawn_h(x, z):
    n = noise(x * 0.4, z * 0.4, 5) * 0.6 + noise(x * 1.3, z * 1.3, 11) * 0.25
    return 0.70 + 0.2 * n + 0.03 * z


def base_height(x, z):
    """The walkable ground: a lawn on a shelf, breaking away north into the river's gorge."""
    h = lawn_h(x, z) + 0.45 * shelf_f(x)
    g = smooth(-3.95, -5.05, z)                       # down the near bank to the water
    h = h * (1 - g) + (WATER_Y - 0.4) * g
    b = smooth(-6.05, -6.6, z)                        # and up again onto the far bank
    h = h * (1 - b) + (WATER_Y + 0.45) * b
    h -= 0.05 * (1 - smooth(0.4, 1.1, path_d(x, z)))  # the paved way is worn a little lower
    return h


def cliff_height(x, z):
    """The valley wall at the back, with a cleft at each fall, or 0 in front of it."""
    f = smooth(-6.0, -7.1, z)
    if f <= 0:
        return 0.0
    n = ((noise(x * 0.55, z * 0.55, 21) - 0.5) * 1.3 + (noise(x * 1.4, z * 1.4, 23) - 0.5) * 0.7
         + (noise(x * 2.9, z * 2.9, 27) - 0.5) * 0.3)
    h = (2.15 + n) * f
    for fx in FALLS:
        h *= 1 - 0.3 * (1 - smooth(0.0, 0.9, abs(x - fx)))   # a shallow cleft at each fall
    return max(0.0, h)


def top_height(x, z):
    return base_height(x, z) + cliff_height(x, z)


kit.ground, kit.top = base_height, top_height   # the decor helpers stand things on this tile
kit.DEPTH = 1.55                                # the gorge is deep: keep the cut sides in hand


def house_floor():
    """One level for the whole house, so its walls sit flat on the shelf."""
    return base_height(-5.9, -1.0)


# --- the ground, painted face by face -------------------------------------------------------------

LAWN_C = hexc('#7fae56')
LAWN_DEEP = hexc('#6b9a48')
FLAG_C = hexc('#c3bca9')
SHINGLE_C = hexc('#a9a294')
CLIFF_C = hexc('#ada595')
CLIFF_DARK = hexc('#8d8779')
EARTH_C = hexc('#80674a')


def ground_colour(x, z, seed):
    j = (_hash(x * 3.1, z * 2.7, seed) - 0.5) * 0.06
    c = mix(LAWN_C, LAWN_DEEP, smooth(0.35, 0.8, noise(x * 0.6, z * 0.6, 31)))
    g = smooth(-3.95, -5.05, z)
    c = mix(c, EARTH_C, 0.7 * smooth(0.1, 0.55, g))            # the broken bank
    c = mix(c, CLIFF_C, 0.8 * smooth(0.5, 0.95, g))
    c = mix(c, SHINGLE_C, 0.8 * (1 - smooth(1.0, 2.0, river_d(x, z))))
    c = mix(c, FLAG_C, 0.8 * shelf_f(x))                        # the paved shelf
    c = mix(c, FLAG_C, 0.85 * (1 - smooth(0.45, 1.0, path_d(x, z))))
    if cliff_height(x, z) > 0.05:
        c = mix(CLIFF_C, CLIFF_DARK, smooth(0.3, 0.7, noise(x * 0.9, z * 0.9, 37)))
    return clamp_colour(c, j)


def cliff():
    """The valley wall behind the river, as its own mesh over the ground."""
    p = Painted()
    n = round(2 * HALF / STEP)
    xs = [-HALF + 2 * HALF * i / n for i in range(n + 1)]
    zs = [-HALF + 2 * HALF * j / n for j in range(n + 1)]
    H = [[top_height(x, z) for z in zs] for x in xs]
    for i in range(n):
        for j in range(n):
            if max(cliff_height(xs[i + k], zs[j + m]) for k in (0, 1) for m in (0, 1)) < 0.04:
                continue
            a = P(xs[i], H[i][j], zs[j])
            b = P(xs[i + 1], H[i + 1][j], zs[j])
            c = P(xs[i], H[i][j + 1], zs[j + 1])
            d = P(xs[i + 1], H[i + 1][j + 1], zs[j + 1])
            for k, tri in enumerate(((a, c, b), (b, c, d))):
                cx = sum(q.x for q in tri) / 3
                cz = -sum(q.y for q in tri) / 3
                p.face(list(tri), ground_colour(cx, cz, 41 + k))
    p.bm.normal_update()
    for f in p.bm.faces:        # a wall this steep must still face the sky, not the rock behind it
        if f.normal.z < 0:
            f.normal_flip()
    return finish_painted('cliff', p)


def water_surface():
    """The Bruinen, one sheet across the gorge."""
    p = Painted()
    deep = hexc('#2f6f94')
    shallow = hexc('#5aa6c6')
    n = round(2 * HALF / 0.42)
    for i in range(n):
        for j in range(n):
            xa, xb = -HALF + 2 * HALF * i / n, -HALF + 2 * HALF * (i + 1) / n
            za, zb = -HALF + 2 * HALF * j / n, -HALF + 2 * HALF * (j + 1) / n
            cx, cz = (xa + xb) / 2, (za + zb) / 2
            d = river_d(cx, cz)
            if d > 1.15:
                continue
            y = WATER_Y + 0.02 * math.sin(cx * 2.3 + cz * 1.9)
            c = mix(shallow, deep, 1 - smooth(0.0, 1.15, d))
            p.quad(P(xa, y, zb), P(xb, y, zb), P(xb, y, za), P(xa, y, za),
                   clamp_colour(c, (_hash(cx * 5.1, cz * 4.3, 2) - 0.5) * 0.1))
    return finish_painted('water', p)


def falls():
    """Two falls coming down the valley wall into the Bruinen. Returns where their spray stands."""
    spray = []
    for k, fx in enumerate(FALLS):
        z0, z1 = -6.95, -5.6                 # from the top of the wall to the water
        rows, cols = 10, 4
        bm = bmesh.new()
        grid = []
        for r in range(rows + 1):
            t = r / rows
            z = z0 + (z1 - z0) * t
            y = max(WATER_Y - 0.02, top_height(fx, z) + 0.05)
            w = 0.26 + 0.3 * t
            grid.append([bm.verts.new(P(fx - w + 2 * w * c / cols + (0.03 if (r + c) % 2 else -0.03), y, z))
                         for c in range(cols + 1)])
        for r in range(rows):
            for c in range(cols):
                bm.faces.new((grid[r][c], grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c]))
        bm.normal_update()
        for f in bm.faces:
            if f.normal.z < 0:
                f.normal_flip()
        add(bm, WATER_DEEP)
        for i in range(8):                   # white water breaking over the ledges
            t = 0.1 + 0.1 * i
            z = z0 + (z1 - z0) * t
            y = max(WATER_Y, top_height(fx, z) + 0.08)
            bl((fx - 0.2 + 0.12 * ((i * 3) % 4), y, z), (0.13, 0.05, 0.12), FOAM, subdiv=0)
        for i in range(7):                   # the broken water where it strikes the river
            a = 0.9 * i
            bl((fx + math.cos(a) * 0.5, WATER_Y + 0.03, z1 + 0.25 + math.sin(a) * 0.3),
               (0.22, 0.05, 0.18), FOAM, subdiv=0)
        for i in range(4):                   # wet boulders in the plunge
            a = 1.6 * i
            rock((fx + math.cos(a) * 0.75, WATER_Y - 0.08, z1 + 0.3 + math.sin(a) * 0.4),
                 0.2 + 0.06 * (i % 3), 300 + k * 10 + i, mat=ROCK_DARK, moss=False, squash=0.75)
        spray.append((fx, WATER_Y + 0.12, z1 + 0.3))
    return spray


def firs():
    """Dark firs along the top of the valley wall and the far bank, for the valley's depth."""
    rnd = lp.seeded(91)
    for k in range(40):
        x = rnd.uniform(-HALF + 0.3, HALF - 0.3)
        z = rnd.uniform(-7.0, -6.1)
        if min(abs(x - f) for f in FALLS) < 1.0 or abs(x - BRIDGE_X) < 0.9:
            continue
        y = top_height(x, z)
        if y < WATER_Y + 0.9:
            continue
        size = rnd.uniform(0.7, 1.25)
        add(lp.cone(P(x, y - 0.1, z), P(x, y + 0.3 * size, z), 0.05 * size, sides=5), BARK)
        for j in range(3):                   # three skirts, narrowing upwards
            lo = y + 0.18 * size + 0.42 * j * size
            add(lp.cone(P(x, lo, z), P(x, lo + 0.62 * size, z), (0.34 - 0.08 * j) * size, sides=6),
                FIR if (k + j) % 2 else FIR_DARK)


# --- the Last Homely House ------------------------------------------------------------------------

def roof_ns(x0, x1, z0, z1, eave, ridge, mat, mat_dark, over=0.3):
    """A steep shingled roof whose ridge runs north–south, overhanging all round."""
    xa, xb = x0 - over, x1 + over
    za, zb = z0 - over, z1 + over
    xm = (x0 + x1) / 2
    n = max(2, round((zb - za) / 0.45))
    for j in range(n):
        az = za + (zb - za) * j / n
        bz = za + (zb - za) * (j + 1) / n
        m = mat if j % 2 else mat_dark
        for west in (True, False):
            q = ([P(xa, eave, az), P(xm, ridge, az), P(xm, ridge, bz), P(xa, eave, bz)] if west else
                 [P(xm, ridge, az), P(xb, eave, az), P(xb, eave, bz), P(xm, ridge, bz)])
            bm = bmesh.new()
            bm.faces.new([bm.verts.new(v) for v in q])
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.1)
            add(bm, m)
    for z in (z0, z1):                      # the gable ends, filled in under the slopes
        bm = bmesh.new()
        bm.faces.new([bm.verts.new(v) for v in
                      (P(x0 - 0.02, eave, z), P(xm, ridge, z), P(x1 + 0.02, eave, z))])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.06)
        add(bm, PLASTER)
    nr = max(3, round((zb - za) / 0.3))     # a rolled ridge along the top
    for j in range(nr):
        z = za + (zb - za) * (j + 0.5) / nr
        bl((xm, ridge + 0.03, z), (0.13, 0.07, 0.15), mat_dark if j % 2 else mat, subdiv=0)


def tall_window(x, y, z, face, h=0.85, w=0.3):
    """A narrow window with a rounded head, lit from inside. `face` is 'x' (east) or 'z' (south)."""
    sx, sz = (0.08, w) if face == 'x' else (w, 0.08)
    bx((x, y, z), (sx, h, sz), GLOW_WINDOW)
    bl((x, y + h / 2, z), (sx * 0.6 if face == 'x' else w * 0.5, w * 0.5, w * 0.5 if face == 'x' else sz * 0.6),
       GLOW_WINDOW, subdiv=0)
    t = 0.07
    if face == 'x':
        for dz in (-w / 2 - t / 2, w / 2 + t / 2):
            bx((x - 0.02, y + 0.06, z + dz), (0.1, h + w * 0.7, t), PALE_DARK)
        bx((x - 0.02, y - h / 2 - t / 2, z), (0.1, t, w + 2 * t), PALE_DARK)
    else:
        for dx in (-w / 2 - t / 2, w / 2 + t / 2):
            bx((x + dx, y + 0.06, z - 0.02), (t, h + w * 0.7, 0.1), PALE_DARK)
        bx((x, y - h / 2 - t / 2, z - 0.02), (w + 2 * t, t, 0.1), PALE_DARK)


def carved_post(x, y, z, h, r=0.075):
    """A slender post with a carved head and foot: the veranda, the balustrade, the lamp standards."""
    cyl((x, y, z), r, h, TIMBER, sides=7)
    bl((x, y + 0.03, z), (r * 1.8, 0.06, r * 1.8), PALE_DARK, subdiv=0)
    bl((x, y + h - 0.04, z), (r * 1.25, 0.05, r * 1.25), CARVE, subdiv=0)


def lantern(x, y, z):
    """A hanging lantern: a small warm box in an iron cage. Returns where its light sits."""
    cyl((x, y, z), 0.015, 0.16, IRON, sides=4)
    bx((x, y - 0.1, z), (0.13, 0.17, 0.13), GLOW_LAMP)
    for dx in (-0.075, 0.075):
        for dz in (-0.075, 0.075):
            bx((x + dx, y - 0.1, z + dz), (0.02, 0.19, 0.02), IRON)
    bl((x, y - 0.2, z), (0.06, 0.04, 0.06), IRON, subdiv=0)
    return (x, y - 0.1, z)


def house():
    """The hall, the lower east wing, the veranda along it, and the door into the house."""
    x0, x1, z0, z1 = HOUSE
    wx0, wx1, wz0, wz1 = WING
    y = house_floor()
    lamps = []

    # the shelf the house stands on, in courses, so no wall hangs over the ground
    for k in range(3):
        bx(((x0 + wx1) / 2, y - 0.08 - k * 0.17, (z0 + z1) / 2),
           (wx1 - x0 + 0.34 - k * 0.06, 0.18, z1 - z0 + 0.46 - k * 0.06), PALE if k % 2 else PALE_DARK)

    # --- the hall: a stone ground floor, timber and plaster above, a steep shingled roof
    eave, ridge = y + 1.8, y + 2.9
    walls = ((x0, z0, x0, z1), (x1, z0, x1, z1), (x0, z0, x1, z0), (x0, z1, x1, z1))
    for (ax, az, bx_, bz) in walls:
        cx_, cz_ = (ax + bx_) / 2, (az + bz) / 2
        sx = max(0.2, abs(bx_ - ax)) + 0.2
        sz = max(0.2, abs(bz - az)) + 0.2
        bx((cx_, y + 0.42, cz_), (sx, 0.84, sz), PALE)                      # the stone courses
        bx((cx_, y + 0.86, cz_), (sx + 0.06, 0.1, sz + 0.06), PALE_DARK)    # a moulding over them
        bx((cx_, y + 1.36, cz_), (sx * 0.98, 0.9, sz * 0.98), PLASTER)      # plaster between timbers
    for k in range(6):                                          # the frame showing through
        z = z0 + (z1 - z0) * (k + 0.5) / 6
        for x in (x1 + 0.19, x0 - 0.19):
            bx((x, y + 1.36, z), (0.1, 0.92, 0.1), TIMBER_DARK)
    for k in range(4):                                          # and across the south gable wall
        x = x0 + (x1 - x0) * (k + 0.5) / 4
        bx((x, y + 1.36, z1 + 0.19), (0.1, 0.92, 0.1), TIMBER_DARK)
    for (ax, az, bx_, bz) in walls:                             # a rail across the frame
        cx_, cz_ = (ax + bx_) / 2, (az + bz) / 2
        # the east wall carries the wing, so its rails stay flush instead of running out over it
        pad = 0.04 if ax == bx_ == x1 else 0.22
        bx((cx_, y + 1.36, cz_), (max(0.2, abs(bx_ - ax)) + pad, 0.09, max(0.2, abs(bz - az)) + pad), TIMBER)
        bx((cx_, y + 1.8, cz_), (max(0.2, abs(bx_ - ax)) + pad + 0.04, 0.12,
                                 max(0.2, abs(bz - az)) + pad + 0.04), TIMBER)
    roof_ns(x0, x1, z0, z1, eave, ridge, SLATE, SLATE_DARK)
    for z in (z0 + 0.55, z1 - 0.45):                            # tall windows over the lawn
        tall_window(x1 + 0.25, y + 1.3, z, 'x', h=0.9)
    for z in (z0 + 1.4, z1 - 1.5):
        tall_window(x0 - 0.25, y + 1.3, z, 'x', h=0.8)
    tall_window((x0 + x1) / 2, y + 1.25, z1 + 0.25, 'z', h=0.9, w=0.34)

    # the chimney, at the hall's north gable
    cx_ = (x0 + x1) / 2 - 0.3
    bx((cx_, y + 1.6, z0 + 0.45), (0.42, 3.2, 0.46), PALE)
    bx((cx_, y + 3.2, z0 + 0.45), (0.54, 0.15, 0.58), PALE_DARK)
    smoke = (cx_, y + 3.35, z0 + 0.45)

    # --- the east wing: lower, with the front door in it
    weave, wridge = y + 1.55, y + 2.1
    for (ax, az, bx_, bz) in ((wx0, wz0, wx0, wz1), (wx1, wz0, wx1, wz1), (wx0, wz0, wx1, wz0), (wx0, wz1, wx1, wz1)):
        cx2, cz2 = (ax + bx_) / 2, (az + bz) / 2
        sx = max(0.2, abs(bx_ - ax)) + 0.2
        sz = max(0.2, abs(bz - az)) + 0.2
        bx((cx2, y + 0.45, cz2), (sx, 0.9, sz), PALE)
        bx((cx2, y + 1.18, cz2), (sx * 0.98, 0.58, sz * 0.98), PLASTER)
        bx((cx2, y + 1.52, cz2), (sx + 0.06, 0.1, sz + 0.06), TIMBER)
    for k in range(4):
        z = wz0 + (wz1 - wz0) * (k + 0.5) / 4
        bx((wx1 + 0.19, y + 1.18, z), (0.09, 0.6, 0.09), TIMBER_DARK)
    roof_ns(wx0, wx1, wz0, wz1, weave, wridge, SLATE, SLATE_DARK, over=0.26)
    tall_window(wx1 + 0.25, y + 0.95, wz1 - 0.35, 'x', h=0.7, w=0.26)

    # --- the door, and the dark of the hall behind it
    dx, dz = DOOR
    dw, dh = 0.9, 1.3
    bx((dx - 0.35, y + dh / 2, dz - dw / 2), (0.6, dh + 0.06, dw - 0.04), SOOT)   # the dark hall behind
    for side in (-1, 1):                                        # dressed jambs
        bx((dx - 0.02, y + dh / 2, dz + side * (dw / 2 + 0.14)), (0.26, dh + 0.1, 0.28), PALE_DARK)
    bx((dx - 0.02, y + dh + 0.13, dz - dw / 2), (0.3, 0.22, dw + 0.66), PALE_DARK)
    bl((dx + 0.08, y + dh + 0.13, dz - dw / 2), (0.06, 0.09, 0.24), CARVE, subdiv=0)
    into(front_door)
    bx((dx + 0.04, y + dh / 2, dz - dw / 2), (0.1, dh, dw), TIMBER)     # the leaf, hinged at its north edge
    for k in range(3):
        bx((dx + 0.09, y + 0.24 + k * 0.44, dz - dw / 2), (0.04, 0.09, dw - 0.06), IRON)
    bl((dx + 0.11, y + dh / 2, dz - dw + 0.18), (0.04, 0.06, 0.06), BRASS, subdiv=0)
    out_of()

    # --- the veranda along the wing: posts, a shed roof, lanterns and steps down to the lawn
    bx(((wx1 + PORCH_X) / 2, y + 0.04, (wz0 + wz1) / 2), (PORCH_X - wx1 + 0.2, 0.14, wz1 - wz0 + 0.3), PALE)
    zs = [wz0 + (wz1 - wz0) * k / 3 for k in range(4)]
    for k, z in enumerate(zs):
        carved_post(PORCH_X, y + 0.1, z, 1.5, r=0.065)
        if k % 2 == 0:
            lamps.append(lantern(PORCH_X - 0.24, y + 1.52, z))
    bx((PORCH_X, y + 1.64, (wz0 + wz1) / 2), (0.13, 0.1, wz1 - wz0 + 0.3), TIMBER)   # the outer beam
    n = max(2, round((wz1 - wz0 + 0.3) / 0.42))
    for k in range(n):                                          # the shed roof over the walk
        az = wz0 - 0.15 + (wz1 - wz0 + 0.3) * k / n
        bz = wz0 - 0.15 + (wz1 - wz0 + 0.3) * (k + 1) / n
        bm = bmesh.new()
        bm.faces.new([bm.verts.new(v) for v in (P(wx1, y + 1.98, az), P(PORCH_X + 0.2, y + 1.72, az),
                                                P(PORCH_X + 0.2, y + 1.72, bz), P(wx1, y + 1.98, bz))])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.07)
        add(bm, SLATE if k % 2 else SLATE_DARK)
    for k in range(3):                                          # steps down to the lawn
        bx(((wx1 + PORCH_X) / 2 + 0.08, y + 0.02 - k * 0.13, wz1 + 0.24 + k * 0.26),
           (PORCH_X - wx1 - 0.14, 0.14, 0.3), PALE_DARK)
    return {'smoke': smoke, 'lamps': lamps}


# --- the lawn's edge, the bridge, and the things the company gathers round --------------------------

def balustrade():
    """A low carved rail along the lawn's north edge, above the gorge."""
    x = -3.0
    k = 0
    lamps = []
    while x < 6.7:
        if not (BRIDGE_X - 0.95 < x < BRIDGE_X + 0.95):
            y = base_height(x, LIP)
            if k % 5 == 0:
                carved_post(x, y - 0.05, LIP, 0.78, r=0.085)
                at = lantern(x, y + 0.74, LIP)
                if k % 10 == 0:
                    lamps.append(at)
            else:
                bx((x, y + 0.16, LIP), (0.09, 0.36, 0.09), PALE)
            bx((x + 0.3, y + 0.36, LIP), (0.64, 0.07, 0.13), PALE_DARK)
        x += 0.6
        k += 1
    return lamps


def bridge():
    """The slender span over the Bruinen, and the path climbing away on the far side."""
    z0, z1 = -4.05, -6.3
    y0, y1 = base_height(BRIDGE_X, z0), base_height(BRIDGE_X, z1)
    n = 12
    deck = []
    for i in range(n + 1):
        t = i / n
        deck.append((z0 + (z1 - z0) * t, y0 + (y1 - y0) * t + 0.62 * math.sin(math.pi * t) + 0.12))
    for i in range(n):
        (za, ya), (zb, yb) = deck[i], deck[i + 1]
        bx((BRIDGE_X, (ya + yb) / 2, (za + zb) / 2), (1.05, 0.1, abs(zb - za) + 0.06), PALE)
        for side in (-0.46, 0.46):                       # a continuous low rail either side
            bx((BRIDGE_X + side, (ya + yb) / 2 + 0.3, (za + zb) / 2), (0.06, 0.07, abs(zb - za) + 0.06), PALE)
            if i % 4 == 0:
                bx((BRIDGE_X + side, (ya + yb) / 2 + 0.15, (za + zb) / 2), (0.07, 0.3, 0.07), PALE_DARK)
    for z, yy in ((z0, y0), (z1, y1)):                   # abutments at either end
        bx((BRIDGE_X, yy - 0.2, z), (1.25, 0.6, 0.5), PALE_DARK)
    for i in range(5):                                   # the path away over the far bank
        z = z1 - 0.3 - i * 0.12
        bx((BRIDGE_X, base_height(BRIDGE_X, z) + 0.03, z), (0.9, 0.06, 0.2), PALE_DARK)


def map_stand():
    """The carved stand the map lies open on, in the middle of the gathering."""
    x, z = STAND
    y = base_height(x, z)
    cyl((x, y, z), 0.17, 0.15, PALE_DARK, sides=9)
    cyl((x, y + 0.14, z), 0.1, 0.52, PALE, sides=8)
    bl((x, y + 0.68, z), (0.3, 0.06, 0.26), PALE_DARK)
    bx((x, y + 0.74, z), (0.46, 0.04, 0.34), PARCHMENT, rot=0.25)
    for k in range(3):                                   # runes, as a few flecks of gold
        bx((x - 0.1 + k * 0.1, y + 0.77, z - 0.04 + 0.03 * k), (0.07, 0.01, 0.015), CARVE, rot=0.25)


def bench():
    """A carved stone bench under the birches, with a cushion on it."""
    x, z = BENCH
    y = base_height(x, z)
    bx((x, y + 0.3, z), (1.2, 0.09, 0.36), TIMBER)
    for side in (-0.48, 0.48):
        bx((x + side, y + 0.14, z), (0.14, 0.3, 0.34), PALE)
        bl((x + side, y + 0.34, z), (0.09, 0.05, 0.09), CARVE, subdiv=0)
    bx((x - 0.28, y + 0.37, z), (0.42, 0.08, 0.26), LINEN)
    for k in range(4):                                            # a low open back
        bx((x - 0.45 + k * 0.3, y + 0.46, z - 0.19), (0.07, 0.3, 0.06), TIMBER_DARK)
    bx((x, y + 0.6, z - 0.19), (1.15, 0.07, 0.08), TIMBER)


def brazier():
    """An iron brazier on the lawn: the warm light the company stands in. Returns its fire."""
    x, z = BRAZIER
    y = base_height(x, z)
    for k in range(3):
        a = 2.09 * k
        add(lp.cone(P(x + math.cos(a) * 0.3, y, z + math.sin(a) * 0.3), P(x, y + 0.55, z), 0.04, sides=4), IRON)
    cyl((x, y + 0.5, z), 0.33, 0.18, IRON, sides=11)
    cyl((x, y + 0.66, z), 0.36, 0.05, IRON, sides=11)
    for k in range(6):
        a, d = 1.05 * k, 0.1 + 0.08 * (k % 3)
        bl((x + math.cos(a) * d, y + 0.68, z + math.sin(a) * d), (0.11, 0.05, 0.11), COAL, subdiv=0)
    for k in range(4):
        a, d = 1.57 * k + 0.4, 0.06 + 0.06 * (k % 2)
        add(lp.cone(P(x + math.cos(a) * d, y + 0.68, z + math.sin(a) * d),
                    P(x, y + 0.86 + 0.07 * (k % 3), z), 0.06, sides=4), GLOW_FIRE)
    add(lp.cone(P(x, y + 0.7, z), P(x, y + 0.98, z), 0.05, sides=5), GLOW_FIRE_CORE)
    return (x, y + 0.78, z)


def lamp_standards():
    """Two standing lamps where the way comes up the lawn, so the path reads at night."""
    lamps = []
    for x, z in ((3.6, 3.0), (0.9, -2.8)):
        y = base_height(x, z)
        carved_post(x, y, z, 1.7, r=0.055)
        bx((x + 0.13, y + 1.66, z), (0.3, 0.05, 0.05), IRON)
        lamps.append(lantern(x + 0.25, y + 1.64, z))
    return lamps


# --- the garden ------------------------------------------------------------------------------------

def open_ground(x, z):
    """True where nothing may stand: the way in, the gathering, the house and the gorge."""
    if path_d(x, z) < 1.5 or math.hypot(x - 0.2, z - 0.2) < 3.3:
        return False
    if z < LIP + 0.35:
        return False
    if x < -3.3 and -4.2 < z < 2.2:          # the house and its veranda
        return False
    for px, pz in ((-3.5, -3.0), (-2.2, -1.4), (-4.5, 3.2)):
        if math.dist((x, z), (px, pz)) < 1.3:
            return False
    for px, pz in (BENCH, BRAZIER, STAND):
        if math.dist((x, z), (px, pz)) < 2.0:
            return False
    return True


def birch(x, z, size, seed):
    """A birch: a pale bole marked with dark, the crown light and open."""
    rnd = lp.seeded(seed)
    y = base_height(x, z)
    h = 1.6 * size
    add(lp.cone(P(x, y - 0.05, z), P(x, y + h, z), 0.085 * size, sides=6), BIRCH)
    for k in range(4):
        bx((x, y + 0.35 + 0.33 * k * size, z + 0.082 * size), (0.055 * size, 0.018, 0.015), BIRCH_MARK)
    for k in range(3):
        a = 2.1 * k + rnd.uniform(0, 1)
        add(lp.cone(P(x, y + h * 0.75, z),
                    P(x + math.cos(a) * 0.42 * size, y + h * 1.12, z + math.sin(a) * 0.42 * size),
                    0.04 * size, sides=4), BIRCH)
    for k in range(4):
        a = 1.57 * k + rnd.uniform(0, 0.7)
        d = 0.0 if k == 0 else rnd.uniform(0.25, 0.45) * size
        r = (0.5 if k == 0 else rnd.uniform(0.3, 0.42)) * size
        bl((x + math.cos(a) * d, y + h + 0.26 * size + rnd.uniform(-0.1, 0.2) * size, z + math.sin(a) * d),
           (r, r * 0.72, r), BIRCH_LEAF if k % 2 else LEAF_LIGHT)


def garden():
    """Birches and beeches round the lawn, flower beds along the shelf, grass between."""
    rnd = lp.seeded(13)
    placed = []
    for _ in range(500):
        if len(placed) >= 19:
            break
        x = rnd.uniform(-HALF + 0.6, HALF - 0.6)
        z = rnd.uniform(-HALF + 0.6, HALF - 0.6)
        if not open_ground(x, z) or any(math.dist((x, z), p) < 1.9 for p in placed):
            continue
        placed.append((x, z))
        k = len(placed)
        size = rnd.uniform(0.85, 1.2)
        if k % 3:
            birch(x, z, size, 200 + k)
        else:
            tree(x, z, size=size, kind='oak', seed=200 + k)

    # beds of flowers along the house's shelf and at the lawn's edge
    for k, (cx, cz, rx, rz) in enumerate(((-3.9, 2.3, 0.5, 0.9), (-3.9, -2.2, 0.45, 0.8),
                                          (-2.3, 4.6, 0.9, 0.5), (4.6, 1.2, 0.8, 0.6),
                                          (5.8, -2.3, 0.7, 0.7))):
        flowers(cx, cz, rx, rz, 16, 400 + k,
                ('white', 'yellow', 'blue') if k % 2 else ('white', 'pink', 'purple'))
    hedge([(-3.35, 3.4), (-3.35, 5.4)], 71)
    hedge([(-3.35, -2.0), (-3.35, -3.4)], 73)

    # grass, and a few mossy stones where the lawn meets the gorge
    tufts(150, 7, lambda x, z: z > LIP - 0.1 and x > -3.3 and path_d(x, z) > 0.75)
    for k in range(14):
        x = rnd.uniform(-2.6, 6.4)
        z = LIP + rnd.uniform(-0.35, 0.5)
        if BRIDGE_X - 1.0 < x < BRIDGE_X + 1.0:
            continue
        rock((x, base_height(x, z) + 0.05, z), rnd.uniform(0.18, 0.34), 500 + k, mat=ROCK, squash=0.7)
    for k in range(12):                                  # stones in the gorge, below the rail
        x = rnd.uniform(-6.5, 6.5)
        z = rnd.uniform(-4.4, -4.9)
        rock((x, base_height(x, z) + 0.08, z), rnd.uniform(0.2, 0.42), 520 + k, mat=ROCK_DARK, moss=k % 3 == 0)
    return placed


def paving():
    """The paved way up the lawn, with slabs showing through the grass."""
    strip(resample(PATH, 0.5), 0.5, PALE_DARK, lift=0.02)
    rnd = lp.seeded(57)
    for k in range(22):
        t = (k + 0.5) / 22
        x, z = at_along(PATH, t)
        o = rnd.uniform(-0.3, 0.3)
        bx((x + o, base_height(x + o, z) + 0.035, z + rnd.uniform(-0.2, 0.2)),
           (rnd.uniform(0.26, 0.4), 0.05, rnd.uniform(0.24, 0.36)), PALE_DARK if k % 2 else STONE,
           rot=rnd.uniform(0, 1.5))


# --- build ------------------------------------------------------------------------------------------

def main():
    out = Path(ARGS[ARGS.index('--out') + 1]) if '--out' in ARGS else ROOT / 'out' / 'models' / 'rivendell.glb'
    out.parent.mkdir(parents=True, exist_ok=True)

    objs = [terrain(ground_colour), plinth(), cliff(), water_surface()]
    spray = falls()
    h = house()
    lamps = h['lamps'] + balustrade() + lamp_standards()
    firs()
    bridge()
    map_stand()
    bench()
    fire = brazier()
    garden()
    paving()

    decor = lp.finish('rivendell', kit.parts)
    door = hinge_object('door-house', front_door, (DOOR[0], house_floor(), DOOR[1]))
    objs += [decor, door]
    tris = triangles(objs)

    empties = [empty('fx-fire', fire), empty('fx-smoke-hall', h['smoke'])]
    empties += [empty(f'fx-spray-fall-{k}', at) for k, at in enumerate(spray)]
    empties += [empty(f'fx-lamp-{k}', at) for k, at in enumerate(lamps)]
    empties += [empty(f'fx-fireflies-{k}', at) for k, at in enumerate(
        ((-2.4, 1.1, 4.4), (4.2, 1.1, 2.6), (5.6, 1.1, -1.4), (-1.0, 1.0, 5.6)))]

    print(f'rivendell: {tris} triangles, {len(kit.parts)} parts, {len(empties)} markers')
    blend = Path(ARGS[ARGS.index('--blend') + 1]) if '--blend' in ARGS else None
    if blend:
        bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True)
        print(f'wrote {blend}')
    export(out, objs + empties)
    print(f'wrote {out}')


if __name__ == '__main__':
    main()
