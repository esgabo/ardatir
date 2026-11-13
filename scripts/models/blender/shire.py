"""The Shire kit: Bag End under the Hill, a whole diorama tile (#24), built in headless Blender.

    blender --background --python scripts/models/blender/shire.py -- [--out out/models/bag-end.glb] [--blend <path>]

Writes the raw export (default `out/models/bag-end.glb`); `npm run model:pack` compresses it
into `assets/kits/shire/bag-end.glb`, which an event's staging names as its `set:`.

Our own design, from The Hobbit, chapter 1: a hobbit-hole dug into the Hill, a round green door
with a brass knob in the middle, round windows, a tunnel hall with pegs, a parlour with a fire,
a pantry full of food; a garden, a gate and the lane down towards Bywater. The Hill's east side
is cut away like a diorama so the rooms show; the tile itself is a plinth with cut earth sides
(soil, clay, rock), a stream running off its front edge as a little waterfall.

Coordinates are the site's, in its units (a hobbit is 0.82 tall): x east, z south (towards
the camera), y up; `P(x, y, z)` turns them into Blender's (x, -z, y). What the site needs
from the file, by name:
  terrain          the walkable ground (characters stand on it, raycast from above)
  glow-*           materials that light up at dusk (windows, lamps, the fire)
  fx-smoke         chimney top: rising smoke          fx-spray    the foot of the waterfall
  fx-fireflies-*   where fireflies hover at dusk     fx-lamp-*   warm point lights at dusk
  fx-fire          the hearth: a flickering light
"""

import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

sys.path.insert(0, str(Path(__file__).parent))
import lowpoly as lp  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []

lp.reset_scene()

HALF = 7.0           # the tile is 14 x 14
STEP = 0.35          # terrain grid
DEPTH = 1.9          # plinth: how far the cut sides go below the ground
FLOOR = 0.15         # the floor of Bag End (and the lawn terrace in front of it)
CUTX = 0.0           # the Hill is cut away east of this plane
ZF = -0.7            # the Hill's front bank, with the door, faces south along this line
NONE = lambda co: {}  # noqa: E731  (a kit has no bones)


def P(x, y, z):
    return Vector((x, -z, y))


# --- materials ---------------------------------------------------------------------------------

def glow(name, hex_color, strength=1.0):
    """A material that the site lights up at dusk (emissive, scaled by the light preset)."""
    m = lp.material(name, hex_color, roughness=0.6)
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Emission Color'].default_value = (*lp.srgb(hex_color), 1.0)
    bsdf.inputs['Emission Strength'].default_value = strength
    return m


PAINT = lp.material('painted', '#ffffff', roughness=0.95)   # colours come from vertex colours
_attr = PAINT.node_tree.nodes.new('ShaderNodeVertexColor')
_attr.layer_name = 'Color'
PAINT.node_tree.links.new(_attr.outputs['Color'], PAINT.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
WOOD = lp.material('wood', '#7a5233')
WOOD_DARK = lp.material('wood_dark', '#55382a')
WOOD_LIGHT = lp.material('wood_light', '#a87a4e')
PLANK_A = lp.material('plank_a', '#9b6c43')
PLANK_B = lp.material('plank_b', '#8a5e3a')
PLASTER = lp.material('plaster', '#efe2c4')
DOOR = lp.material('door', '#2f7a3e')
DOOR_DARK = lp.material('door_dark', '#24603a')
BRASS = lp.material('brass', '#d4a640', roughness=0.35, metallic=0.7)
STONE = lp.material('stone', '#9c968b')
STONE_DARK = lp.material('stone_dark', '#7c776e')
SOOT = lp.material('soot', '#2a2623')
RUG = lp.material('rug', '#a8402f')
RUG_GOLD = lp.material('rug_gold', '#d9a62e')
CLOTH = lp.material('cloth', '#f2ead8')
CHAIR = lp.material('chair', '#3f6b3a')
LEAF = lp.material('leaf', '#4f7f3a')
LEAF_DARK = lp.material('leaf_dark', '#3d6a31')
LEAF_LIGHT = lp.material('leaf_light', '#6f9c45')
LEAF_GOLD = lp.material('leaf_gold', '#9aa847')
HEDGE = lp.material('hedge', '#3f6e34')
BARK = lp.material('bark', '#5b4632')
ROCK = lp.material('rock', '#8f8a80', roughness=1.0)
ROCK_DARK = lp.material('rock_dark', '#726d65', roughness=1.0)
MOSS = lp.material('moss', '#6d8a3e', roughness=1.0)
WATER = lp.material('water', '#4f9cc4', roughness=0.15, metallic=0.1)
FOAM = lp.material('foam', '#e6f3f7', roughness=0.4)
FLOWER = {c: lp.material(f'flower_{c}', h) for c, h in (
    ('pink', '#e98aa8'), ('yellow', '#f2c94c'), ('white', '#f4f1e8'), ('red', '#d8503c'),
    ('blue', '#7f96e0'), ('orange', '#ee9a3a'), ('purple', '#a77cc9'))}
CAKE = lp.material('cake', '#e9c58f')
ICING = lp.material('icing', '#fbf3ea')
JAM = lp.material('jam', '#b83a3a')
CHEESE = lp.material('cheese', '#f0c64a')
HAM = lp.material('ham', '#c9725a')
APPLE = lp.material('apple', '#c8392f')
BREAD = lp.material('bread', '#c98d4a')
JAR = lp.material('jar', '#b9a35f', roughness=0.3)
POT = lp.material('pot', '#a35a3a')
CABBAGE = lp.material('cabbage', '#8fbf5a')
GLOW_WINDOW = glow('glow-window', '#ffd38a', 1.0)
GLOW_LAMP = glow('glow-lamp', '#ffc870', 1.5)
GLOW_FIRE = glow('glow-fire', '#ff9a3a', 2.5)
GLOW_FIRE_CORE = glow('glow-fire-core', '#ffe17a', 3.0)

# --- noise -------------------------------------------------------------------------------------


def _hash(x, z, seed):
    s = math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453
    return s - math.floor(s)


def noise(x, z, seed=0):
    xi, zi = math.floor(x), math.floor(z)
    xf, zf = x - xi, z - zi
    u, v = xf * xf * (3 - 2 * xf), zf * zf * (3 - 2 * zf)
    a, b = _hash(xi, zi, seed), _hash(xi + 1, zi, seed)
    c, d = _hash(xi, zi + 1, seed), _hash(xi + 1, zi + 1, seed)
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v


def smooth(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def hexc(h):
    return lp.srgb(h)


# --- the plan: lane, stream, path, garden ------------------------------------------------------

def _polyline_dist(pts, x, z):
    """Distance from (x, z) to a polyline, and how far along it (0..1)."""
    best, along, total = 1e9, 0.0, 0.0
    lens = [math.dist(a, b) for a, b in zip(pts, pts[1:])]
    run = 0.0
    for (ax, az), (bx, bz), L in zip(pts, pts[1:], lens):
        dx, dz = bx - ax, bz - az
        t = max(0.0, min(1.0, ((x - ax) * dx + (z - az) * dz) / (L * L)))
        d = math.hypot(x - (ax + dx * t), z - (az + dz * t))
        if d < best:
            best, along = d, (run + L * t)
        run += L
    total = run
    return best, along / total


LANE = [(-0.6, 2.9), (0.6, 3.6), (2.2, 4.1), (3.6, 4.9), (4.8, 5.9), (6.0, 6.6), (7.6, 7.4)]
STREAM = [(-7.6, 4.3), (-6.2, 4.6), (-5.0, 5.3), (-4.0, 5.6), (-3.2, 6.3), (-2.7, 7.6)]
PATH = [(-1.1, ZF + 0.05), (-1.05, 0.4), (-0.85, 1.4), (-0.65, 2.3), (-0.6, 2.95)]
HEDGE_LINE = [(-6.9, 2.95), (-1.0, 2.95)], [(-0.15, 2.95), (0.6, 2.95), (1.6, 2.35), (2.6, 1.1)]
BEDS = [(-2.2, 1.0, 0.75, 0.42), (0.25, 1.15, 0.7, 0.4), (-2.6, 2.25, 0.85, 0.35), (0.55, 2.2, 0.55, 0.32),
        (-4.7, -0.15, 0.9, 0.28)]
VEG = (-4.6, 1.35, 1.0, 0.65)


def resample(pts, step):
    """Points every `step` along a polyline (its ends included)."""
    out = [pts[0]]
    for (ax, az), (bx_, bz) in zip(pts, pts[1:]):
        n = max(1, round(math.dist((ax, az), (bx_, bz)) / step))
        out += [(ax + (bx_ - ax) * k / n, az + (bz - az) * k / n) for k in range(1, n + 1)]
    return out


def lane_d(x, z):
    return _polyline_dist(LANE, x, z)[0]


def stream_d(x, z):
    return _polyline_dist(STREAM, x, z)[0]


def path_d(x, z):
    return _polyline_dist(PATH, x, z)[0]


def in_bed(x, z, beds=BEDS):
    for bx, bz, rx, rz in beds:
        if ((x - bx) / rx) ** 2 + ((z - bz) / rz) ** 2 < 1:
            return True
    return False


def base_height(x, z):
    """The walkable ground, without the Hill: a gentle meadow, falling towards the lane's end."""
    n = noise(x * 0.45, z * 0.45, 2) * 0.7 + noise(x * 1.1, z * 1.1, 5) * 0.3
    h = 0.12 + 0.42 * n - 0.035 * (x + z)
    # a terrace in front of Bag End and under it: the lawn and the floor
    terrace = 1 - smooth(1.6, 3.4, math.hypot(max(0.0, x - CUTX + 0.3) * 0.9, max(0.0, z - 2.6)) if x > -7 else 1)
    under = 1.0 if (x < CUTX + 0.2 and z < ZF + 0.2) else 0.0
    t = max(terrace, under)
    if x < -2.5 and z > ZF + 0.2:  # the west garden rises a little towards the hedge
        t *= 1 - smooth(-2.5, -5.0, x) * 0.6
    h = h + (FLOOR - h) * t
    # the lane is worn a little lower, the stream cuts a channel
    h -= 0.07 * (1 - smooth(0.25, 0.55, lane_d(x, z)))
    h -= 0.26 * (1 - smooth(0.25, 0.7, stream_d(x, z)))
    if under:
        h = FLOOR
    return h


# The rooms behind the cut: (name, x of the back wall, z from, z to, wall height, vault apex at the cut)
ROOMS = [
    ('hall', -2.0, -2.23, ZF - 0.12, 0.95, 1.35),
    ('parlour', -2.8, -4.93, -2.37, 1.05, 1.65),
    ('pantry', -2.0, -6.55, -5.07, 0.9, 1.3),
]
PARTITIONS = [-2.3, -5.0]     # z of the walls between rooms (0.14 thick)
DOOR_C = (-1.1, FLOOR + 0.47)  # centre of the round door in the front bank (x, y)
DOOR_R = 0.47
WINDOWS = [(-2.75, FLOOR + 0.72, 0.27), (-3.75, FLOOR + 0.7, 0.24), (-0.4, FLOOR + 0.78, 0.17)]


def hill_height(x, z):
    """How high the Hill stands above the base ground at (x, z), or 0 off it."""
    if x > CUTX + 1e-6 or z > ZF + 1e-6:
        return 0.0
    dx, dz = (x + 3.0) / 6.4, (z + 4.4) / 4.7
    q = 1 - (dx * dx + dz * dz)
    dome = 3.05 * math.sqrt(q) if q > 0 else 0.0
    # always enough earth over the rooms (and the hall, right up to the front bank)
    over = 0.0
    for _, x0, z0, z1, _, apex in ROOMS:
        ox = max(0.0, (x0 - 0.3) - x)
        oz = max(0.0, z0 - z, z - z1 - 0.2)
        fall = 1 - smooth(0.0, 1.9, math.hypot(ox, oz))
        over = max(over, (apex + 0.55) * fall)
    h = max(dome, over)
    h += (noise(x * 0.9, z * 0.9, 11) - 0.5) * 0.22 * min(1.0, h)
    # soft terraces on the Hill's flanks
    if h > 0.3:
        h = h - 0.08 * math.sin(h * 4.2)
    return max(0.0, h)


def top_height(x, z):
    return base_height(x, z) + hill_height(x, z)


# --- painted meshes (vertex colours) ----------------------------------------------------------

class Painted:
    """A bmesh whose faces each carry a colour (the site multiplies them by a white material)."""

    def __init__(self):
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.color.new('Color')

    def face(self, pts, rgb):
        vs = [self.bm.verts.new(p) for p in pts]
        try:
            f = self.bm.faces.new(vs)
        except ValueError:
            return
        for loop in f.loops:
            loop[self.col] = (*rgb, 1.0)

    def quad(self, a, b, c, d, rgb):
        self.face([a, b, c, d], rgb)


def finish_painted(name, painted):
    bm = painted.bm
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(PAINT)
    for poly in mesh.polygons:
        poly.use_smooth = False
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


GRASS = hexc('#86b05a')
GRASS_DEEP = hexc('#6f9c48')
GRASS_DRY = hexc('#a7b85e')
LAWN = hexc('#8cbf5c')
SOIL = hexc('#6b4a30')
LANE_C = hexc('#c4a878')
LANE_EDGE = hexc('#a99566')
BED = hexc('#5e4029')
BANK = hexc('#7a6a48')


def ground_colour(x, z, seed):
    j = (_hash(x * 3.1, z * 2.7, seed) - 0.5) * 0.07
    n = noise(x * 0.6, z * 0.6, 21)
    c = mix(GRASS_DEEP, GRASS_DRY, smooth(0.35, 0.8, n))
    if math.hypot(x + 1.0, z - 1.2) < 3.0:
        c = mix(LAWN, c, smooth(2.0, 3.0, math.hypot(x + 1.0, z - 1.2)))
    c = mix(c, LANE_EDGE, 0.6 * (1 - smooth(0.25, 0.7, lane_d(x, z))))
    sd = stream_d(x, z)
    if sd < 0.55:
        c = BANK if sd < 0.45 else mix(c, BANK, 0.5)
    return tuple(max(0.0, min(1.0, v * (1 + j))) for v in c)


def grid_surface(painted, x0, x1, z0, z1, height, colour, seed):
    nx, nz = round((x1 - x0) / STEP), round((z1 - z0) / STEP)
    xs = [x0 + (x1 - x0) * i / nx for i in range(nx + 1)]
    zs = [z0 + (z1 - z0) * j / nz for j in range(nz + 1)]
    H = [[height(x, z) for z in zs] for x in xs]
    for i in range(nx):
        for j in range(nz):
            a = P(xs[i], H[i][j], zs[j])
            b = P(xs[i + 1], H[i + 1][j], zs[j])
            c = P(xs[i], H[i][j + 1], zs[j + 1])
            d = P(xs[i + 1], H[i + 1][j + 1], zs[j + 1])
            # alternate the diagonal for a less regular facet pattern
            if (i + j) % 2:
                tris = ((a, c, d), (a, d, b))
            else:
                tris = ((a, c, b), (b, c, d))
            for k, tri in enumerate(tris):
                cx = sum(p.x for p in tri) / 3
                cz = -sum(p.y for p in tri) / 3
                painted.face(list(tri), colour(cx, cz, seed + k))
    return xs, zs, H


def terrain():
    """The walkable ground, one mesh named `terrain`."""
    p = Painted()
    grid_surface(p, -HALF, HALF, -HALF, HALF, base_height, ground_colour, 1)
    return finish_painted('terrain', p)


TOPSOIL = hexc('#5a3d26')
CLAY = hexc('#9a6a3c')
CLAY_LIGHT = hexc('#b07e4a')
SAND = hexc('#c09a62')
ROCKBAND = hexc('#857e73')
ROCKBAND_DARK = hexc('#6c665e')


def strata(y, top, seed, x=0.0):
    """The colour of the earth at height y in a cut face whose surface is at `top`."""
    d = top - y
    j = (_hash(x * 7.3 + y * 3.1, y * 5.7, seed) - 0.5) * 0.12
    wob = (noise(x * 1.3, y * 0.5, seed) - 0.5) * 0.25
    if d < 0.07:
        c = GRASS_DEEP
    elif d < 0.32 + wob * 0.5:
        c = TOPSOIL
    elif y > -0.55 + wob:
        c = mix(CLAY, CLAY_LIGHT, smooth(0.35, 0.65, noise(x * 0.7, y * 4.0, seed + 2)))
    elif y > -0.8 + wob:
        c = SAND
    else:
        c = mix(ROCKBAND, ROCKBAND_DARK, smooth(0.3, 0.7, noise(x * 0.9, y * 2.2, seed + 4)))
    return tuple(max(0.0, min(1.0, v * (1 + j))) for v in c)


def plinth():
    """The cut earth sides of the tile, in layers: soil, clay, sand, rock."""
    p = Painted()
    n = round(2 * HALF / STEP)
    rows = 14
    for side in ('N', 'S', 'W', 'E'):
        for i in range(n):
            a, b = -HALF + 2 * HALF * i / n, -HALF + 2 * HALF * (i + 1) / n
            if side == 'S':
                ends = [(a, HALF), (b, HALF)]
            elif side == 'N':
                ends = [(b, -HALF), (a, -HALF)]
            elif side == 'E':
                ends = [(HALF, b), (HALF, a)]
            else:
                ends = [(-HALF, a), (-HALF, b)]
            tops = [top_height(x, z) for x, z in ends]
            bottom = -DEPTH
            for r in range(rows):
                f0, f1 = r / rows, (r + 1) / rows
                y0 = [bottom + (t - bottom) * f0 for t in tops]
                y1 = [bottom + (t - bottom) * f1 for t in tops]
                (xa, za), (xb, zb) = ends
                mid = (y0[0] + y1[1]) / 2
                c = strata(mid, (tops[0] + tops[1]) / 2, 3, xa + za)
                p.quad(P(xa, y0[0], za), P(xb, y0[1], zb), P(xb, y1[1], zb), P(xa, y1[0], za), c)
    # the bottom
    p.quad(P(-HALF, -DEPTH, HALF), P(-HALF, -DEPTH, -HALF), P(HALF, -DEPTH, -HALF), P(HALF, -DEPTH, HALF),
           ROCKBAND_DARK)
    return finish_painted('plinth', p)


def hill():
    """The Hill's grassy top, its stone-faced front bank (with the door) and its cut east face."""
    p = Painted()

    def hill_colour(x, z, seed):
        h = hill_height(x, z)
        c = ground_colour(x, z, seed)
        if h > 0.05:
            n = noise(x * 0.8, z * 0.8, 31)
            c = mix(GRASS, GRASS_DRY, smooth(0.4, 0.85, n))
            c = mix(c, GRASS_DEEP, smooth(1.2, 2.8, h) * 0.5)
        j = (_hash(x * 4.1, z * 3.3, seed) - 0.5) * 0.08
        return tuple(max(0.0, min(1.0, v * (1 + j))) for v in c)

    # the top: only where the Hill stands
    nx, nz = round((CUTX + HALF) / STEP), round((ZF + HALF) / STEP)
    xs = [-HALF + (CUTX + HALF) * i / nx for i in range(nx + 1)]
    zs = [-HALF + (ZF + HALF) * j / nz for j in range(nz + 1)]
    for i in range(nx):
        for j in range(nz):
            corners = [(xs[i], zs[j]), (xs[i + 1], zs[j]), (xs[i], zs[j + 1]), (xs[i + 1], zs[j + 1])]
            hs = [hill_height(x, z) for x, z in corners]
            if max(hs) < 1e-4:
                continue
            a, b, c, d = (P(x, top_height(x, z), z) for x, z in corners)
            tris = ((a, c, d), (a, d, b)) if (i + j) % 2 else ((a, c, b), (b, c, d))
            for k, tri in enumerate(tris):
                cx = sum(q.x for q in tri) / 3
                cz = -sum(q.y for q in tri) / 3
                p.face(list(tri), hill_colour(cx, cz, 7 + k))

    # the front bank, facing south: dressed stone round the door, rough below the turf
    def front_hole(x, y):
        dx, dy = x - DOOR_C[0], y - DOOR_C[1]
        if y >= FLOOR - 0.01 and (math.hypot(dx, max(0.0, dy)) < DOOR_R):
            return True
        return any(math.hypot(x - wx, y - wy) < wr for wx, wy, wr in WINDOWS)

    stone_cols = [hexc(h) for h in ('#a39a8a', '#948b7c', '#b0a796', '#8a8274', '#9d9483')]
    sub, row_h = 3, 0.13
    for i in range(nx):
        for s in range(sub):
            xa = xs[i] + (xs[i + 1] - xs[i]) * s / sub
            xb = xs[i] + (xs[i + 1] - xs[i]) * (s + 1) / sub
            ta, tb = top_height(xa, ZF), top_height(xb, ZF)
            ba, bb = base_height(xa, ZF + 0.001), base_height(xb, ZF + 0.001)
            if max(ta - ba, tb - bb) < 0.01:
                continue
            y = min(ba, bb) - 0.05
            r = 0
            while y < max(ta, tb):
                y0, y1 = y, y + row_h
                ya0, yb0 = max(y0, ba - 0.05), max(y0, bb - 0.05)
                ya1, yb1 = min(y1, ta), min(y1, tb)
                if ya1 > ya0 + 1e-4 or yb1 > yb0 + 1e-4:
                    cx, cy = (xa + xb) / 2, (y0 + y1) / 2
                    if not front_hole(cx, cy):
                        turf = min(ta, tb) - cy
                        if turf < 0.09:
                            c = GRASS_DEEP
                        elif turf < 0.28:
                            c = TOPSOIL
                        else:
                            c = hexc('#5f574c')   # mortar; the stones sit in front of it
                        p.quad(P(xa, ya0, ZF), P(xb, yb0, ZF), P(xb, max(yb1, yb0), ZF), P(xa, max(ya1, ya0), ZF), c)
                y, r = y1, r + 1

    # the cut, facing east: earth in layers, with the rooms opening into it
    def cut_hole(z, y):
        for _, _, z0, z1, _, apex in ROOMS:
            if z0 < z < z1 and FLOOR - 0.01 < y < FLOOR + apex:
                return True
        return False

    for j in range(nz):
        for s in range(sub):
            za = zs[j] + (zs[j + 1] - zs[j]) * s / sub
            zb = zs[j] + (zs[j + 1] - zs[j]) * (s + 1) / sub
            ta, tb = top_height(CUTX, za), top_height(CUTX, zb)
            ba, bb = base_height(CUTX + 0.001, za), base_height(CUTX + 0.001, zb)
            if max(ta - ba, tb - bb) < 0.01:
                continue
            y = min(ba, bb) - 0.05
            while y < max(ta, tb):
                y0, y1 = y, y + 0.12
                ya0, yb0 = max(y0, ba - 0.05), max(y0, bb - 0.05)
                ya1, yb1 = min(y1, ta), min(y1, tb)
                cz, cy = (za + zb) / 2, (y0 + y1) / 2
                if (ya1 > ya0 + 1e-4 or yb1 > yb0 + 1e-4) and not cut_hole(cz, cy):
                    c = strata(cy - 0.9, (ta + tb) / 2 - 0.9, 13, cz)
                    p.quad(P(CUTX, ya0, zb), P(CUTX, yb0, za), P(CUTX, max(yb1, yb0), za), P(CUTX, max(ya1, ya0), zb), c)
                y = y1
    return finish_painted('hill', p)


# --- decor (flat materials) -------------------------------------------------------------------

parts = []
door_parts = []      # the door is its own object, hinged on its west edge, so the site can open it
_into = [parts]


def add(bm, mat):
    _into[-1].append(lp.Part('p', bm, mat, NONE))


def bx(c, size, mat, taper=1.0, rot=0.0):
    """A box centred at site point c = (x, y, z), size (sx, sy, sz), turned `rot` radians about y."""
    add(lp.box(P(*c), (size[0], size[2], size[1]), taper=taper,
               rotation=Euler((0, 0, rot)).to_matrix() if rot else None), mat)


def bl(c, r, mat, subdiv=1, rot=None):
    add(lp.blob(P(*c), (r[0], r[2], r[1]), subdiv=subdiv, rotation=rot), mat)


def cyl(c, r, h, mat, sides=10, axis='y'):
    """A cylinder standing on c (axis y), or lying along x or z, centred on c."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=sides, radius1=r, radius2=r, depth=h)
    if axis == 'y':
        m = Matrix.Translation(P(c[0], c[1] + h / 2, c[2]))
    elif axis == 'z':
        m = Matrix.Translation(P(*c)) @ Euler((math.pi / 2, 0, 0)).to_matrix().to_4x4()
    else:
        m = Matrix.Translation(P(*c)) @ Euler((0, math.pi / 2, 0)).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    add(bm, mat)


def ring_z(cx, cy, z, r0, r1, mat, depth=0.06, sides=18, start=0.0, end=2 * math.pi):
    """A flat ring (a door or window frame) in the plane z, from radius r0 to r1."""
    bm = bmesh.new()
    n = sides
    outer, inner = [], []
    for k in range(n + 1):
        a = start + (end - start) * k / n
        outer.append((cx + math.cos(a) * r1, cy + math.sin(a) * r1))
        inner.append((cx + math.cos(a) * r0, cy + math.sin(a) * r0))
    for k in range(n):
        for zz in (z,):
            vs = [bm.verts.new(P(x, y, zz)) for x, y in (inner[k], outer[k], outer[k + 1], inner[k + 1])]
            bm.faces.new(vs)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=depth)
    add(bm, mat)


def disc_z(cx, cy, z, r, mat, sides=16, flat_bottom=None):
    bm = bmesh.new()
    pts = []
    for k in range(sides):
        a = 2 * math.pi * k / sides
        x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
        if flat_bottom is not None:
            y = max(y, flat_bottom)
        pts.append(P(x, y, z))
    bm.faces.new([bm.verts.new(q) for q in pts])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    add(bm, mat)


def rock(c, r, seed, mat=ROCK, moss=True, squash=0.7):
    rnd = lp.seeded(seed)
    rot = Euler((rnd.uniform(0, 3), rnd.uniform(0, 3), rnd.uniform(0, 3))).to_matrix()
    bm = lp.blob(P(*c), (r, r * rnd.uniform(0.8, 1.2), r * squash), subdiv=1, rotation=rot)
    lp.jitter(bm, r * 0.18, seed)
    add(bm, mat)
    if moss:
        bl((c[0] + r * 0.1, c[1] + r * squash * 0.8, c[2]), (r * 0.6, r * 0.18, r * 0.55), MOSS)


def tree(x, z, size=1.0, kind='oak', seed=0):
    y = base_height(x, z) if hill_height(x, z) <= 0 else top_height(x, z)
    rnd = lp.seeded(seed)
    if kind == 'poplar':
        cyl((x, y, z), 0.07 * size, 1.0 * size, BARK, sides=6)
        bl((x, y + 1.55 * size, z), (0.38 * size, 1.05 * size, 0.38 * size), LEAF_DARK)
        return
    trunk_h = 0.85 * size
    add(lp.cone(P(x, y - 0.05, z), P(x, y + trunk_h + 0.3 * size, z), 0.13 * size, sides=6), BARK)
    for k in range(2):  # a couple of boughs
        a = rnd.uniform(0, 6.28)
        add(lp.cone(P(x, y + trunk_h * 0.6, z), P(x + math.cos(a) * 0.45 * size, y + trunk_h * 1.05, z + math.sin(a) * 0.45 * size),
                    0.05 * size, sides=5), BARK)
    mats = [LEAF, LEAF_DARK, LEAF_LIGHT] if kind != 'gold' else [LEAF_GOLD, LEAF, LEAF_LIGHT]
    for k in range(5):
        a = rnd.uniform(0, 6.28)
        d = 0.0 if k == 0 else rnd.uniform(0.3, 0.55) * size
        r = (0.62 if k == 0 else rnd.uniform(0.36, 0.48)) * size
        bl((x + math.cos(a) * d, y + trunk_h + 0.45 * size + rnd.uniform(-0.1, 0.25) * size, z + math.sin(a) * d),
           (r, r * 0.85, r), mats[k % len(mats)])
    if kind == 'apple':
        for k in range(9):
            a, e = rnd.uniform(0, 6.28), rnd.uniform(-0.4, 0.9)
            rr = 0.58 * size
            bl((x + math.cos(a) * rr * 0.9, y + trunk_h + 0.45 * size + e * 0.4 * size, z + math.sin(a) * rr * 0.9),
               (0.05, 0.05, 0.05), APPLE, subdiv=0)


def flowers(cx, cz, rx, rz, n, seed, colours):
    rnd = lp.seeded(seed)
    for k in range(n):
        a, d = rnd.uniform(0, 6.28), math.sqrt(rnd.uniform(0, 1))
        x, z = cx + math.cos(a) * rx * d, cz + math.sin(a) * rz * d
        y = base_height(x, z) if hill_height(x, z) <= 0 else top_height(x, z)
        add(lp.cone(P(x, y, z), P(x, y + 0.16, z), 0.03, sides=3), LEAF_DARK)
        c = colours[k % len(colours)]
        r = rnd.uniform(0.045, 0.07)
        bl((x, y + 0.17, z), (r, r * 0.7, r), FLOWER[c], subdiv=0)


def hedge(pts, seed):
    rnd = lp.seeded(seed)
    for (ax, az), (bx_, bz) in zip(pts, pts[1:]):
        L = math.dist((ax, az), (bx_, bz))
        n = max(1, round(L / 0.42))
        for k in range(n):
            t = (k + 0.5) / n
            x, z = ax + (bx_ - ax) * t, az + (bz - az) * t
            y = base_height(x, z)
            r = rnd.uniform(0.27, 0.34)
            bl((x, y + r * 0.9, z), (r, r * rnd.uniform(0.95, 1.2), r), HEDGE if k % 3 else LEAF_DARK)


def interior():
    """Bag End's rooms, open to the cut: floors, walls, vaults, furniture, food."""
    for name, x0, z0, z1, wall, apex in ROOMS:
        # floor boards, running east-west
        nb = max(1, round((z1 - z0) / 0.2))
        for k in range(nb):
            za, zb = z0 + (z1 - z0) * k / nb, z0 + (z1 - z0) * (k + 1) / nb
            bx(((x0 + CUTX) / 2, FLOOR + 0.004, (za + zb) / 2), (CUTX - x0, 0.008, zb - za - 0.012), PLANK_A if k % 2 else PLANK_B)
        # back wall: wainscot below, plaster above, facing east
        bx((x0 - 0.03, FLOOR + 0.2, (z0 + z1) / 2), (0.06, 0.4, z1 - z0), WOOD_DARK)
        bx((x0 - 0.04, FLOOR + 0.4 + (wall - 0.4) / 2, (z0 + z1) / 2), (0.06, wall - 0.4, z1 - z0), PLASTER)
        bx((x0 - 0.0, FLOOR + 0.41, (z0 + z1) / 2), (0.03, 0.03, z1 - z0), WOOD)
        # the vault: a quarter ellipse from the wall top up to the apex at the cut
        bm = bmesh.new()
        segs = 7
        rows = []
        for zz in (z0, z1):
            row = []
            for k in range(segs + 1):
                a = (math.pi / 2) * k / segs
                x = x0 + (CUTX - x0) * math.sin(a)
                y = FLOOR + wall + (apex - wall) * (1 - math.cos(a)) ** 0.8
                row.append(bm.verts.new(P(x, y, zz)))
            rows.append(row)
        for k in range(segs):
            bm.faces.new((rows[0][k], rows[0][k + 1], rows[1][k + 1], rows[1][k]))
        add(lp.solidify(bm, 0.03), PLASTER)
        # ribs: dark beams across the vault
        nr = max(2, round((z1 - z0) / 0.75))
        for k in range(nr + 1):
            zz = z0 + 0.06 + (z1 - z0 - 0.12) * k / nr
            for s in range(segs):
                a0, a1 = (math.pi / 2) * s / segs, (math.pi / 2) * (s + 1) / segs
                p0 = (x0 + (CUTX - x0) * math.sin(a0), FLOOR + wall + (apex - wall) * (1 - math.cos(a0)) ** 0.8 - 0.03)
                p1 = (x0 + (CUTX - x0) * math.sin(a1), FLOOR + wall + (apex - wall) * (1 - math.cos(a1)) ** 0.8 - 0.03)
                c = ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, zz)
                L = math.dist(p0, p1)
                ang = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
                bm2 = lp.box(P(*c), (L + 0.02, 0.07, 0.05))
                bmesh.ops.rotate(bm2, cent=P(*c), matrix=Matrix.Rotation(ang, 3, 'Y').inverted(), verts=bm2.verts)
                add(bm2, WOOD_DARK)
        # the far end wall of each room (its north wall, facing south into it), with an arched doorway
        # into the next room behind; the hall's north wall leads into the parlour, and so on
        zn = z0 - 0.07
        if name != 'pantry':
            gap = (-1.45, -0.75)
            for xa, xb in ((x0 - 0.05, gap[0]), (gap[1], CUTX)):
                bx(((xa + xb) / 2, FLOOR + wall / 2 + 0.05, zn), (xb - xa, wall + 0.1, 0.14), PLASTER)
            bx(((gap[0] + gap[1]) / 2, FLOOR + 0.95 + (wall - 0.85) / 2, zn), (gap[1] - gap[0], wall - 0.85, 0.14), PLASTER)
            ring_z((gap[0] + gap[1]) / 2, FLOOR + 0.78, zn + 0.075, 0.33, 0.4, WOOD, depth=0.04, sides=10, start=0, end=math.pi)
            for xg in gap:
                bx((xg, FLOOR + 0.39, zn + 0.075), (0.07, 0.78, 0.04), WOOD)
            disc_z((gap[0] + gap[1]) / 2, FLOOR + 0.5, zn - 0.06, 0.6, SOOT, sides=10)  # the dark beyond
        else:
            bx(((x0 + CUTX) / 2, FLOOR + wall / 2 + 0.05, zn), (CUTX - x0 + 0.1, wall + 0.1, 0.14), PLASTER)
        # above the wall, fill up to the vault so nothing shows through
        bx(((x0 + CUTX) / 2, FLOOR + wall + (apex - wall) / 2 + 0.05, zn), (CUTX - x0 + 0.1, apex - wall + 0.1, 0.14), PLASTER)

    # --- the hall: pegs, a bench, a runner, a lamp
    for k in range(6):
        z = -0.95 - k * 0.22
        add(lp.cone(P(-1.98, FLOOR + 0.72, z), P(-1.84, FLOOR + 0.76, z), 0.018, sides=4), WOOD_LIGHT)
    for k, (z, m) in enumerate(((-1.17, CHAIR), (-1.61, RUG))):
        bl((-1.9, FLOOR + 0.6, z), (0.07, 0.15, 0.09), m)   # a coat and a scarf on their pegs
    bx((-1.75, FLOOR + 0.2, -1.85), (0.28, 0.06, 0.6), WOOD)
    for dz in (-0.25, 0.25):
        bx((-1.75, FLOOR + 0.09, -1.85 + dz), (0.24, 0.18, 0.05), WOOD_DARK)
    bx((-1.0, FLOOR + 0.012, -1.45), (0.55, 0.012, 1.4), RUG)
    bx((-1.0, FLOOR + 0.014, -1.45), (0.4, 0.012, 1.25), RUG_GOLD)
    bx((-1.0, FLOOR + 0.016, -1.45), (0.32, 0.012, 1.17), RUG)
    cyl((-1.75, FLOOR, -0.95), 0.07, 0.3, BRASS, sides=8)   # an umbrella stand
    add(lp.cone(P(-1.75, FLOOR + 0.2, -0.95), P(-1.72, FLOOR + 0.55, -0.97), 0.015, sides=4), WOOD_DARK)
    hall_lamp = (-0.9, FLOOR + 1.12, -1.5)
    bl(hall_lamp, (0.07, 0.09, 0.07), GLOW_LAMP)
    add(lp.cone(P(*hall_lamp), P(hall_lamp[0], hall_lamp[1] + 0.2, hall_lamp[2]), 0.012, sides=3), WOOD_DARK)

    # --- the parlour: the fire, the table laid for far too many, chairs, a dresser
    fx, fz = -2.8, -3.65
    bx((fx + 0.12, FLOOR + 0.42, fz), (0.26, 0.84, 1.0), STONE)
    bx((fx + 0.27, FLOOR + 0.86, fz), (0.2, 0.06, 1.15), WOOD)          # mantelpiece
    bx((fx + 0.2, FLOOR + 0.29, fz), (0.14, 0.5, 0.6), SOOT)              # the hearth's mouth
    for dz in (-0.12, 0.12):
        cyl((fx + 0.28, FLOOR + 0.06, fz + dz), 0.035, 0.36, BARK, sides=6, axis='z')
    for k, (dz, h, m) in enumerate(((0, 0.34, GLOW_FIRE), (-0.12, 0.24, GLOW_FIRE), (0.12, 0.26, GLOW_FIRE), (0.03, 0.18, GLOW_FIRE_CORE))):
        add(lp.cone(P(fx + 0.29, FLOOR + 0.06, fz + dz), P(fx + 0.3, FLOOR + 0.06 + h, fz + dz * 0.5), 0.07, sides=5), m)
    cyl((fx + 0.3, FLOOR + 0.89, fz - 0.4), 0.05, 0.14, BRASS, sides=6)   # a clock and candlesticks
    for dz in (0.25, 0.45):
        cyl((fx + 0.3, FLOOR + 0.89, fz + dz), 0.02, 0.12, BRASS, sides=5)
        bl((fx + 0.3, FLOOR + 1.04, fz + dz), (0.02, 0.035, 0.02), GLOW_LAMP, subdiv=0)
    # the round table, cloth, food
    tx, tz = -1.15, -3.65
    cyl((tx, FLOOR, tz), 0.07, 0.34, WOOD_DARK, sides=8)
    cyl((tx, FLOOR + 0.34, tz), 0.6, 0.04, WOOD, sides=16)
    cyl((tx, FLOOR + 0.375, tz), 0.62, 0.008, CLOTH, sides=16)
    top = FLOOR + 0.385
    cyl((tx + 0.05, top, tz - 0.05), 0.15, 0.06, CAKE, sides=12)        # a seed-cake, iced
    cyl((tx + 0.05, top + 0.06, tz - 0.05), 0.13, 0.05, CAKE, sides=12)
    cyl((tx + 0.05, top + 0.11, tz - 0.05), 0.135, 0.015, ICING, sides=12)
    bl((tx + 0.05, top + 0.14, tz - 0.05), (0.025, 0.02, 0.025), JAM, subdiv=0)
    rnd = lp.seeded(41)
    for k in range(9):
        a = 2 * math.pi * k / 9
        px_, pz = tx + math.cos(a) * 0.45, tz + math.sin(a) * 0.45
        cyl((px_, top, pz), 0.07, 0.008, CLOTH, sides=8)          # plates
        if k % 2:
            cyl((px_ + 0.06, top, pz + 0.02), 0.03, 0.07, POT if k % 4 == 1 else BRASS, sides=6)   # mugs
        else:
            bl((px_, top + 0.02, pz), (0.04, 0.025, 0.04), [BREAD, CHEESE, APPLE, HAM][k % 4], subdiv=0)
    cyl((tx - 0.22, top, tz + 0.18), 0.075, 0.1, POT, sides=8)          # the teapot
    add(lp.cone(P(tx - 0.15, top + 0.06, tz + 0.18), P(tx - 0.06, top + 0.1, tz + 0.18), 0.015, sides=4), POT)
    for dz in (-0.25, 0.25):
        cyl((tx - 0.25, top, tz + dz), 0.02, 0.1, BRASS, sides=5)
        bl((tx - 0.25, top + 0.12, tz + dz), (0.018, 0.03, 0.018), GLOW_LAMP, subdiv=0)
    # chairs round the table and an armchair by the fire
    for k, a in enumerate((0.4, 2.0, 3.6, 5.2)):
        cx_, cz_ = tx + math.cos(a) * 0.82, tz + math.sin(a) * 0.82
        bx((cx_, FLOOR + 0.2, cz_), (0.26, 0.04, 0.26), WOOD, rot=-a)
        for ox, oz in ((-0.1, -0.1), (0.1, -0.1), (-0.1, 0.1), (0.1, 0.1)):
            ca, sa = math.cos(-a), math.sin(-a)
            bx((cx_ + ox * ca - oz * sa, FLOOR + 0.1, cz_ + ox * sa + oz * ca), (0.035, 0.2, 0.035), WOOD_DARK)
        bx((cx_ + math.cos(a) * 0.12, FLOOR + 0.38, cz_ + math.sin(a) * 0.12), (0.04, 0.34, 0.26), WOOD, rot=-a)
    ax_, az_ = -2.2, -4.45
    bx((ax_, FLOOR + 0.14, az_), (0.42, 0.28, 0.42), CHAIR)
    bx((ax_ - 0.18, FLOOR + 0.38, az_), (0.1, 0.5, 0.44), CHAIR)
    for dz in (-0.2, 0.2):
        bx((ax_, FLOOR + 0.32, az_ + dz), (0.42, 0.12, 0.08), CHAIR)
    add(lp.blob(P(-1.3, FLOOR + 0.01, -3.65), (1.15, 0.85, 0.01), subdiv=2), RUG)   # an oval rug
    add(lp.blob(P(-1.3, FLOOR + 0.013, -3.65), (1.0, 0.72, 0.01), subdiv=2), RUG_GOLD)
    # a dresser of plates against the back wall, a shelf of books
    bx((-2.68, FLOOR + 0.3, -2.75), (0.2, 0.6, 0.6), WOOD)
    bx((-2.72, FLOOR + 0.85, -2.75), (0.1, 0.5, 0.6), WOOD_DARK)
    for k in range(3):
        disc_z(-2.66 + 0.0, FLOOR + 0.78 + 0.0, -2.92 + k * 0.17 + 0.0, 0.06, CLOTH, sides=8)
    bx((-2.7, FLOOR + 0.75, -4.6), (0.14, 0.04, 0.5), WOOD)
    for k in range(7):
        m = [RUG, CHAIR, RUG_GOLD, WOOD_LIGHT, DOOR, POT, CLOTH][k]
        bx((-2.7, FLOOR + 0.84, -4.8 + k * 0.065), (0.12, 0.15 + 0.02 * (k % 3), 0.05), m)
    for lz in (-3.15, -4.2):
        lamp = (-1.2, FLOOR + 1.35, lz)
        bl(lamp, (0.08, 0.1, 0.08), GLOW_LAMP)
        add(lp.cone(P(*lamp), P(lamp[0], lamp[1] + 0.35, lamp[2]), 0.012, sides=3), WOOD_DARK)

    # --- the pantry: shelves of jars, cheeses, loaves; hams hanging; barrels and sacks
    for sy in (0.3, 0.55, 0.8):
        bx((-1.82, FLOOR + sy, -5.8), (0.32, 0.04, 1.4), WOOD)
        rnd = lp.seeded(int(sy * 100))
        z = -6.45
        while z < -5.15:
            kind = rnd.randrange(5)
            if kind == 0:
                cyl((-1.82, FLOOR + sy + 0.02, z), 0.045, 0.11, JAR, sides=6)
            elif kind == 1:
                cyl((-1.82, FLOOR + sy + 0.02, z), 0.08, 0.06, CHEESE, sides=8)
            elif kind == 2:
                bl((-1.82, FLOOR + sy + 0.06, z), (0.08, 0.05, 0.05), BREAD, subdiv=0)
            elif kind == 3:
                for d in (-0.03, 0.03):
                    bl((-1.8, FLOOR + sy + 0.05, z + d), (0.035, 0.035, 0.035), APPLE, subdiv=0)
            else:
                cyl((-1.82, FLOOR + sy + 0.02, z), 0.05, 0.09, POT, sides=6)
            z += 0.15
    for hz in (-5.4, -5.8, -6.2):
        bl((-0.9, FLOOR + 0.95, hz), (0.07, 0.14, 0.07), HAM)
        add(lp.cone(P(-0.9, FLOOR + 1.05, hz), P(-0.9, FLOOR + 1.28, hz), 0.01, sides=3), WOOD_DARK)
    for bz in (-5.35, -5.75):
        cyl((-0.55, FLOOR, bz), 0.15, 0.36, WOOD, sides=10)
        for by in (0.06, 0.3):
            cyl((-0.55, FLOOR + by, bz), 0.155, 0.025, WOOD_DARK, sides=10)
    bl((-0.6, FLOOR + 0.16, -6.3), (0.17, 0.17, 0.15), CAKE)          # a sack of flour
    bl((-1.0, FLOOR + 0.12, -6.35), (0.13, 0.13, 0.12), BREAD)
    pantry_lamp = (-0.9, FLOOR + 1.0, -5.75)
    bl((-1.3, FLOOR + 1.05, -5.6), (0.05, 0.07, 0.05), GLOW_LAMP)
    return {'hall': hall_lamp, 'parlour': (-1.2, FLOOR + 1.3, -3.65), 'pantry': pantry_lamp, 'fire': (fx + 0.4, FLOOR + 0.3, fz)}


def outside():
    """The door, windows, chimney; the garden, hedges, gate, lane, stream, rocks and trees."""
    # the round green door, a little back in its frame, the knob in the middle
    dz = ZF - 0.05
    _into.append(door_parts)
    disc_z(DOOR_C[0], DOOR_C[1], dz, DOOR_R, DOOR, sides=20, flat_bottom=FLOOR)
    for k in range(5):   # boards
        x = DOOR_C[0] - DOOR_R + (2 * DOOR_R) * (k + 0.5) / 5
        hh = math.sqrt(max(0.0, DOOR_R ** 2 - (x - DOOR_C[0]) ** 2))
        bx((x, (FLOOR + DOOR_C[1] + hh) / 2, dz + 0.008), (0.012, DOOR_C[1] + hh - FLOOR - 0.04, 0.01), DOOR_DARK)
    bl((DOOR_C[0], DOOR_C[1], dz + 0.04), (0.045, 0.045, 0.03), BRASS)
    bx((DOOR_C[0], DOOR_C[1], dz - 0.02), (2 * DOOR_R - 0.04, 2 * DOOR_R - 0.1, 0.03), DOOR_DARK)  # its thickness
    _into.pop()
    ring_z(DOOR_C[0], DOOR_C[1], ZF + 0.03, DOOR_R - 0.02, DOOR_R + 0.1, WOOD, depth=0.07, sides=20,
           start=-0.05, end=math.pi + 0.05)
    for sx in (-1, 1):
        bx((DOOR_C[0] + sx * (DOOR_R + 0.04), (FLOOR + DOOR_C[1]) / 2, ZF + 0.03), (0.12, DOOR_C[1] - FLOOR, 0.08), WOOD)
    bx((DOOR_C[0], FLOOR + 0.03, ZF + 0.22), (1.0, 0.06, 0.4), STONE)          # the doorstep
    # the front bank's stones, laid in courses, a half-stone offset every other row
    rnd = lp.seeded(17)
    stones = [STONE, STONE_DARK, ROCK, lp.material('stone_warm', '#a8957a')]
    x_west = -HALF
    for r in range(14):
        y0 = FLOOR - 0.02 + r * 0.155
        x = x_west + (0.16 if r % 2 else 0.0)
        while x < CUTX - 0.05:
            w = rnd.uniform(0.24, 0.36)
            cx_, cy_ = x + w / 2, y0 + 0.075
            x += w + 0.025
            top_here = min(top_height(cx_ - w / 2, ZF), top_height(cx_ + w / 2, ZF))
            if cy_ + 0.075 > top_here - 0.26 or cx_ + w / 2 > CUTX - 0.04 or cx_ - w / 2 < x_west + 0.02:
                continue
            dx, dy = cx_ - DOOR_C[0], cy_ - DOOR_C[1]
            if math.hypot(dx, max(0.0, dy)) < DOOR_R + 0.16 and cy_ > FLOOR - 0.1:
                continue
            if any(math.hypot(cx_ - wx, cy_ - wy) < wr + 0.12 for wx, wy, wr in WINDOWS):
                continue
            bm = lp.box(P(cx_, cy_, ZF + 0.03), (w, 0.06, 0.13))
            lp.jitter(bm, 0.012, r * 100 + int(x * 10))
            add(bm, stones[rnd.randrange(len(stones))])
    # Gandalf's mark is scratched later: no sign on the door
    # round windows: glass that glows at dusk, green frames, boxes of flowers
    for wx, wy, wr in WINDOWS:
        disc_z(wx, wy, ZF - 0.04, wr, GLOW_WINDOW, sides=14)
        ring_z(wx, wy, ZF + 0.02, wr - 0.02, wr + 0.06, DOOR, depth=0.05, sides=14)
        bx((wx, wy, ZF - 0.01), (0.03, wr * 2, 0.02), DOOR_DARK)
        bx((wx, wy, ZF - 0.01), (wr * 2, 0.03, 0.02), DOOR_DARK)
        if wr > 0.2:
            bx((wx, wy - wr - 0.06, ZF + 0.1), (wr * 2.1, 0.1, 0.16), WOOD)
            flowers(wx, ZF + 0.1, wr, 0.05, 7, int(wx * 10), ['red', 'yellow', 'pink'])
    # a lantern by the door, a bench, a boot-scraper
    lx, lz = 0.25, ZF + 0.35
    cyl((lx, base_height(lx, lz), lz), 0.03, 0.85, WOOD_DARK, sides=6)
    bx((lx, base_height(lx, lz) + 0.92, lz), (0.12, 0.14, 0.12), WOOD_DARK)
    bl((lx, base_height(lx, lz) + 0.92, lz), (0.05, 0.06, 0.05), GLOW_LAMP, subdiv=0)
    bx((-2.0, FLOOR + 0.2, ZF + 0.35), (0.7, 0.05, 0.22), WOOD)
    for sx in (-0.28, 0.28):
        bx((-2.0 + sx, FLOOR + 0.1, ZF + 0.35), (0.05, 0.2, 0.2), WOOD_DARK)

    # the chimney, out of the turf above the parlour fire
    chx, chz = -2.7, -3.65
    top = top_height(chx, chz)
    bx((chx, top + 0.15, chz), (0.3, 0.6, 0.3), STONE, taper=0.9)
    bx((chx, top + 0.47, chz), (0.36, 0.08, 0.36), STONE_DARK)
    cyl((chx, top + 0.5, chz), 0.08, 0.14, POT, sides=8)
    smoke = (chx, top + 0.7, chz)

    # the garden path: flat stones from the doorstep to the gate
    rnd = lp.seeded(5)
    t = 0.0
    while t <= 1.0:
        # walk the polyline at t
        L = [math.dist(a, b) for a, b in zip(PATH, PATH[1:])]
        s, acc = t * sum(L), 0.0
        for (ax, az), (bx_, bz), l in zip(PATH, PATH[1:], L):
            if acc + l >= s:
                f = (s - acc) / l
                x, z = ax + (bx_ - ax) * f, az + (bz - az) * f
                break
            acc += l
        for off in (-0.13, 0.13):
            px_, pz = x + off + rnd.uniform(-0.03, 0.03), z + rnd.uniform(-0.04, 0.04)
            add(lp.jitter(lp.blob(P(px_, base_height(px_, pz) + 0.01, pz), (0.13, 0.12, 0.025), subdiv=1), 0.01, int(t * 999)),
                STONE if rnd.random() < 0.6 else STONE_DARK)
        t += 0.075
    # the gate and its posts, in the hedge
    gx, gz = -0.6, 2.95
    for sx in (-0.4, 0.4):
        bx((gx + sx, base_height(gx + sx, gz) + 0.32, gz), (0.1, 0.64, 0.1), WOOD_LIGHT)
        bl((gx + sx, base_height(gx + sx, gz) + 0.67, gz), (0.06, 0.05, 0.06), WOOD_LIGHT, subdiv=0)
    for gy in (0.18, 0.42):
        bx((gx - 0.18, base_height(gx, gz) + gy, gz - 0.08), (0.36, 0.05, 0.03), WOOD_LIGHT, rot=0.6)
    for k in range(4):
        bx((gx - 0.32 + k * 0.1, base_height(gx, gz) + 0.3, gz - 0.12 - k * 0.07), (0.03, 0.4, 0.03), WOOD_LIGHT)
    for line in HEDGE_LINE:
        hedge(line, len(line))
    # flower beds, the vegetable patch, a few cabbages and bean poles
    pal = [['pink', 'white', 'yellow'], ['red', 'orange', 'yellow'], ['blue', 'white', 'purple'], ['pink', 'red'],
           ['yellow', 'orange', 'white']]
    for k, (cx_, cz_, rx, rz) in enumerate(BEDS):
        flowers(cx_, cz_, rx * 0.9, rz * 0.9, int(28 * rx * rz / 0.3) + 6, 20 + k, pal[k % len(pal)])
    vx, vz, vrx, vrz = VEG
    for i in range(4):
        for j in range(3):
            x, z = vx - vrx * 0.6 + i * vrx * 0.4, vz - vrz * 0.5 + j * vrz * 0.5
            bl((x, base_height(x, z) + 0.07, z), (0.11, 0.09, 0.11), CABBAGE if (i + j) % 2 else LEAF_LIGHT)
    for i in range(3):
        x = vx + vrx * 0.75
        z = vz - 0.4 + i * 0.4
        add(lp.cone(P(x, base_height(x, z), z), P(x, base_height(x, z) + 0.7, z), 0.025, sides=3), WOOD_LIGHT)
        bl((x, base_height(x, z) + 0.4, z), (0.07, 0.22, 0.07), LEAF_LIGHT, subdiv=0)
    # flowers and tufts on the Hill and in the meadow
    flowers(-4.5, -2.2, 1.2, 0.6, 18, 61, ['yellow', 'white'])
    flowers(-1.2, -5.2, 0.9, 0.9, 12, 62, ['purple', 'white'])
    flowers(4.0, 1.5, 1.6, 1.0, 22, 63, ['yellow', 'white', 'blue'])
    flowers(2.0, -2.8, 1.2, 0.8, 12, 64, ['white', 'pink'])
    flowers(-5.6, 5.9, 0.7, 0.5, 10, 65, ['blue', 'yellow'])
    rnd = lp.seeded(77)
    for k in range(60):
        x, z = rnd.uniform(-6.8, 6.8), rnd.uniform(-6.8, 6.8)
        if lane_d(x, z) < 0.5 or stream_d(x, z) < 0.6 or path_d(x, z) < 0.4:
            continue
        if CUTX - 0.1 < x < CUTX + 0.6 and z < ZF:
            continue
        y = top_height(x, z)
        add(lp.cone(P(x, y - 0.02, z), P(x + rnd.uniform(-0.05, 0.05), y + rnd.uniform(0.12, 0.22), z), 0.06, sides=3),
            LEAF_LIGHT if k % 2 else GOLD_GRASS)

    # the lane: a worn strip of earth with a paler crown, from the gate towards Bywater
    for width, mat, lift in ((0.36, lp.material('lane', '#b89a6a'), 0.012), (0.2, lp.material('lane_crown', '#c9ae7f'), 0.02)):
        lane = bmesh.new()
        pts = resample(LANE, 0.25)
        left, right = [], []
        for k, (x, z) in enumerate(pts):
            a, b = pts[max(0, k - 1)], pts[min(len(pts) - 1, k + 1)]
            dx, dz = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dz) or 1.0
            w = width * (1 + 0.15 * math.sin(k * 1.3))
            for side, row in ((-1, left), (1, right)):
                px_, pz = x - dz / L * w * side, z + dx / L * w * side
                px_, pz = max(-HALF, min(HALF, px_)), max(-HALF, min(HALF, pz))
                row.append(lane.verts.new(P(px_, base_height(px_, pz) + lift, pz)))
        for k in range(len(pts) - 1):
            lane.faces.new((left[k], left[k + 1], right[k + 1], right[k]))
        bmesh.ops.recalc_face_normals(lane, faces=lane.faces)
        for f in lane.faces:
            if f.normal.z < 0:
                f.normal_flip()
        add(lane, mat)
    for bx0, bz0, rx, rz in BEDS + [VEG]:
        y = base_height(bx0, bz0)
        add(lp.blob(P(bx0, y + 0.0, bz0), (rx, rz, 0.06), subdiv=2), lp.material('bed', '#5e4029'))
        add(lp.blob(P(bx0, y - 0.005, bz0), (rx + 0.06, rz + 0.06, 0.05), subdiv=2), STONE_DARK)

    # the stream: water in its channel, stones, reeds; and over the edge, a waterfall
    water = bmesh.new()
    pts = STREAM
    for (ax, az), (bx_, bz) in zip(pts, pts[1:]):
        L = math.dist((ax, az), (bx_, bz))
        n = max(1, round(L / 0.35))
        nxv, nzv = -(bz - az) / L, (bx_ - ax) / L
        for k in range(n):
            t0, t1 = k / n, (k + 1) / n
            q = []
            for t, side in ((t0, -1), (t1, -1), (t1, 1), (t0, 1)):
                x, z = ax + (bx_ - ax) * t, az + (bz - az) * t
                x, z = x + nxv * 0.42 * side, z + nzv * 0.42 * side
                x, z = max(-HALF, min(HALF, x)), max(-HALF, min(HALF, z))
                q.append(P(x, base_height(ax + (bx_ - ax) * t, az + (bz - az) * t) + 0.17, z))
            water.faces.new([water.verts.new(v) for v in q])
    bmesh.ops.recalc_face_normals(water, faces=water.faces)
    for f in water.faces:
        if f.normal.z < 0:
            f.normal_flip()
    add(water, WATER)
    mouth_x = -2.95
    surf = base_height(mouth_x, HALF - 0.05) + 0.17
    fall = bmesh.new()
    cols = 5
    rows = 8
    grid = []
    for r in range(rows + 1):
        y = surf - (surf + DEPTH + 0.3) * r / rows
        out = 0.05 + 0.25 * (r / rows) ** 0.5
        row = [fall.verts.new(P(mouth_x - 0.38 + 0.76 * c / cols + (0.03 if (r + c) % 2 else -0.03), y, HALF + out))
               for c in range(cols + 1)]
        grid.append(row)
    for r in range(rows):
        for c in range(cols):
            fall.faces.new((grid[r][c], grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c]))
    bmesh.ops.recalc_face_normals(fall, faces=fall.faces)
    add(fall, WATER)
    for k in range(7):   # foam where it tips over, and white streaks
        bl((mouth_x - 0.33 + k * 0.11, surf + 0.01, HALF + 0.02), (0.07, 0.03, 0.06), FOAM, subdiv=0)
    for k in range(5):
        x = mouth_x - 0.3 + k * 0.15
        bx((x, surf - 0.9 - (k % 2) * 0.3, HALF + 0.2 + 0.03), (0.025, 0.7, 0.01), FOAM)
    spray = (mouth_x, -DEPTH - 0.1, HALF + 0.35)
    for k in range(10):
        a = k * 0.9
        rock((STREAM[min(5, k // 2)][0] + math.cos(a) * 0.45, base_height(STREAM[min(5, k // 2)][0], STREAM[min(5, k // 2)][1]) + 0.08,
              min(HALF - 0.1, STREAM[min(5, k // 2)][1] + math.sin(a) * 0.45)), 0.12 + 0.05 * (k % 3), 300 + k, ROCK_DARK, moss=k % 2 == 0)
    for k in range(14):
        a = k * 1.7
        i = k % 5
        x = STREAM[i][0] + 0.5 * math.cos(a)
        z = STREAM[i][1] + 0.5 * math.sin(a)
        if abs(x) > HALF - 0.1 or abs(z) > HALF - 0.1:
            continue
        y = base_height(x, z)
        for d in (-0.04, 0.0, 0.05):
            add(lp.cone(P(x + d, y, z), P(x + d * 2, y + 0.35 + d, z + d), 0.02, sides=3), LEAF_GOLD)

    # rock outcrops breaking through the meadow, and on the Hill's flank
    for k, (x, z, r) in enumerate(((4.8, -4.6, 0.55), (5.4, -4.1, 0.38), (4.3, -4.0, 0.3), (2.6, -6.3, 0.42),
                                    (6.2, 0.4, 0.35), (6.5, 0.9, 0.22), (-6.4, -1.4, 0.4), (-6.0, 6.4, 0.3),
                                    (3.0, 2.1, 0.22), (1.2, -6.6, 0.25), (-5.3, -6.2, 0.5), (6.4, -6.4, 0.45))):
        rock((x, top_height(x, z) + r * 0.25, z), r, 100 + k, ROCK if k % 3 else ROCK_DARK)
    # boulders and roots in the cut sides (south and east, the sides the camera sees)
    for k, (x, y) in enumerate(((-5.5, -0.9), (-0.8, -1.25), (2.3, -0.7), (4.9, -1.4), (6.1, -0.5), (-4.2, -1.55))):
        rock((x, y, HALF + 0.02), 0.22 + 0.06 * (k % 3), 200 + k, ROCK_DARK, moss=False, squash=0.9)
    for k, (z, y) in enumerate(((-5.2, -1.2), (-2.4, -0.8), (0.6, -1.5), (3.4, -1.0), (5.6, -1.35))):
        rock((HALF + 0.02, y, z), 0.24 + 0.05 * (k % 3), 220 + k, ROCK_DARK, moss=False, squash=0.9)
    rnd = lp.seeded(9)
    for k in range(16):
        side = k % 2
        a = rnd.uniform(-6.5, 6.5)
        y0 = top_height(a, HALF) if side == 0 else top_height(HALF, a)
        y0 -= rnd.uniform(0.12, 0.3)
        if side == 0:
            add(lp.cone(P(a, y0, HALF - 0.02), P(a + rnd.uniform(-0.2, 0.2), y0 - rnd.uniform(0.25, 0.5), HALF + 0.06), 0.025, sides=3), BARK)
        else:
            add(lp.cone(P(HALF - 0.02, y0, a), P(HALF + 0.06, y0 - rnd.uniform(0.25, 0.5), a + rnd.uniform(-0.2, 0.2)), 0.025, sides=3), BARK)
    # the cut's own edge: a lip of turf and dangling roots over the rooms
    for k in range(24):
        z = -6.6 + k * 0.25
        if z > ZF:
            break
        y = top_height(CUTX, z)
        bl((CUTX + 0.02, y - 0.02, z), (0.08, 0.06, 0.14), LEAF_DARK, subdiv=0)
        if k % 3 == 1:
            add(lp.cone(P(CUTX + 0.01, y - 0.15, z), P(CUTX + 0.05, y - 0.45, z + 0.05), 0.018, sides=3), BARK)

    # trees: an old oak on the Hill, others round the meadow; an apple tree in the garden
    tree(-4.4, -4.9, 1.35, 'oak', 1)
    tree(-6.2, -6.0, 0.95, 'gold', 2)
    tree(5.6, -5.6, 1.1, 'oak', 3)
    tree(6.2, -2.4, 0.85, 'gold', 4)
    tree(2.2, -5.4, 0.8, 'oak', 5)
    tree(5.9, 3.4, 0.95, 'oak', 6)
    tree(-6.3, 3.3, 1.0, 'poplar', 7)
    tree(-5.6, 0.4, 0.75, 'apple', 8)
    tree(3.6, 6.3, 0.7, 'oak', 9)
    tree(-6.5, 1.9, 0.9, 'poplar', 10)
    # bushes
    for k, (x, z) in enumerate(((1.6, -0.8), (2.6, -1.3), (-6.6, 6.6), (6.6, 5.3), (4.6, -6.6), (1.4, 5.2))):
        bl((x, base_height(x, z) + 0.2, z), (0.32, 0.26, 0.3), LEAF if k % 2 else LEAF_DARK)
    # fence posts along the lane, towards Bywater
    for k in range(6):
        x, z = 3.4 + k * 0.62, 4.15 + k * 0.42
        if abs(x) > HALF - 0.2:
            break
        bx((x + 0.45, base_height(x + 0.45, z - 0.5) + 0.25, z - 0.5), (0.07, 0.5, 0.07), WOOD)
        if k:
            bx((x + 0.14, base_height(x, z - 0.5) + 0.36, z - 0.71), (0.62, 0.04, 0.03), WOOD, rot=-0.6)
    return {'smoke': smoke, 'spray': spray}


GOLD_GRASS = LEAF_GOLD


def empty(name, at):
    o = bpy.data.objects.new(name, None)
    o.location = P(*at)
    bpy.context.collection.objects.link(o)
    return o


def export(path, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
        export_texcoords=False, export_normals=True, export_materials='EXPORT', export_vertex_color='MATERIAL', export_all_vertex_colors=False,
        export_cameras=False, export_lights=False, export_animations=False, export_extras=False,
        export_draco_mesh_compression_enable=False,
    )


def main():
    out = Path(ARGS[ARGS.index('--out') + 1]) if '--out' in ARGS else ROOT / 'out' / 'models' / 'bag-end.glb'
    out.parent.mkdir(parents=True, exist_ok=True)
    objs = [terrain(), plinth(), hill()]
    lamps = interior()
    fx = outside()
    decor = lp.finish('bag-end', parts)
    door = lp.finish('door', door_parts)
    hinge = P(DOOR_C[0] - DOOR_R, FLOOR, ZF - 0.05)
    door.data.transform(Matrix.Translation(-hinge))
    door.location = hinge
    objs += [decor, door]
    tris = sum(len(p.vertices) - 2 for o in objs for p in o.data.polygons)
    empties = [empty('fx-smoke', fx['smoke']), empty('fx-spray', fx['spray']), empty('fx-fire', lamps['fire'])]
    empties += [empty(f'fx-lamp-{k}', lamps[k]) for k in ('hall', 'parlour', 'pantry')]
    empties += [empty('fx-lamp-door', (0.25, base_height(0.25, ZF + 0.35) + 0.92, ZF + 0.35))]
    empties += [empty(f'fx-fireflies-{k}', at) for k, at in enumerate(((-4.0, 0.6, 5.4), (-1.8, 0.6, 1.6), (3.5, 0.7, 2.2), (-3.5, 3.4, -3.0)))]
    print(f'bag-end: {tris} triangles, {len(parts)} parts, {len(empties)} markers')
    blend = Path(ARGS[ARGS.index('--blend') + 1]) if '--blend' in ARGS else None
    if blend:
        bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True)
        print(f'wrote {blend}')
    export(out, objs + empties)
    print(f'wrote {out}')


if __name__ == '__main__':
    main()
