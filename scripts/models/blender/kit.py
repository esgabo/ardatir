"""Shared pieces for Ardatir's diorama tiles (kits), run inside headless Blender.

A kit is a whole 14 x 14 tile: walkable ground, a plinth of cut earth, and everything that
stands on it. This module holds what every tile needs — the coordinate map, the palette, the
noise, the painted-terrain meshes, the plinth's strata, and the small decor helpers — so each
tile script (`shire.py`, `bywater.py`) is only its own place.

Coordinates are the site's, in its units (a hobbit is 0.82 tall): x east, z south (towards the
camera), y up; `P(x, y, z)` turns them into Blender's (x, -z, y).

A tile configures the module before building, because the decor helpers need to know where the
ground is:

    kit.HALF, kit.DEPTH = 7.0, 1.9
    kit.ground = base_height          # the walkable ground at (x, z)
    kit.top = top_height              # the highest surface there (ground, or a hill over it)

What the site needs from the finished file, by name (see `src/scene/sets.ts`):
  terrain          the walkable ground (characters stand on it, raycast from above)
  door*            its own object, hinged at its origin, swung open while someone is near
  glow-*           materials that light up at dusk (windows, lamps, a fire)
  fx-smoke*        rising smoke          fx-spray*   spray at the foot of falling water
  fx-fireflies-*   fireflies at dusk     fx-lamp-*   warm point lights at dusk
  fx-fire          one flickering hearth light (matched by exact name)
"""

import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Euler, Matrix

sys.path.insert(0, str(Path(__file__).parent))
import lowpoly as lp  # noqa: E402

lp.reset_scene()

# --- the tile's frame ---------------------------------------------------------------------------

HALF = 7.0           # the tile is 14 x 14
STEP = 0.35          # terrain grid
DEPTH = 1.9          # plinth: how far the cut sides go below the ground
NONE = lambda co: {}  # noqa: E731  (a kit has no bones)


def P(x, y, z):
    from mathutils import Vector
    return Vector((x, -z, y))


def ground(x, z):
    """The walkable ground at (x, z). Each tile replaces this."""
    return 0.0


def top(x, z):
    """The highest surface at (x, z): the ground, or a hill standing on it."""
    return ground(x, z)


# --- materials ------------------------------------------------------------------------------------

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
IRON = lp.material('iron', '#4a4742', roughness=0.5, metallic=0.5)
STONE = lp.material('stone', '#9c968b')
STONE_DARK = lp.material('stone_dark', '#7c776e')
STONE_WARM = lp.material('stone_warm', '#a8957a')
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
WATER_DEEP = lp.material('water_deep', '#3b7fa8', roughness=0.15, metallic=0.1)
FOAM = lp.material('foam', '#e6f3f7', roughness=0.4)
THATCH = lp.material('thatch', '#c2a05c')
THATCH_DARK = lp.material('thatch_dark', '#a2834a')
TILE_ROOF = lp.material('tile_roof', '#8c5f4a')
TILE_ROOF_DARK = lp.material('tile_roof_dark', '#6f4a3a')
PONY = lp.material('pony', '#8a6a4a')
PONY_DARK = lp.material('pony_dark', '#5e4634')
PONY_GREY = lp.material('pony_grey', '#a8a39a')
PONY_BAY = lp.material('pony_bay', '#6e4326')
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
ALE = lp.material('ale', '#c88a2e', roughness=0.3)
GLOW_WINDOW = glow('glow-window', '#ffd38a', 1.0)
GLOW_LAMP = glow('glow-lamp', '#ffc870', 1.5)
GLOW_FIRE = glow('glow-fire', '#ff9a3a', 2.5)
GLOW_FIRE_CORE = glow('glow-fire-core', '#ffe17a', 3.0)
GOLD_GRASS = LEAF_GOLD

# --- noise ----------------------------------------------------------------------------------------


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


def clamp_colour(c, j):
    return tuple(max(0.0, min(1.0, v * (1 + j))) for v in c)


# --- polylines ------------------------------------------------------------------------------------


def polyline_dist(pts, x, z):
    """Distance from (x, z) to a polyline, and how far along it (0..1)."""
    best, along = 1e9, 0.0
    lens = [math.dist(a, b) for a, b in zip(pts, pts[1:])]
    run = 0.0
    for (ax, az), (bx_, bz), L in zip(pts, pts[1:], lens):
        dx, dz = bx_ - ax, bz - az
        t = max(0.0, min(1.0, ((x - ax) * dx + (z - az) * dz) / (L * L)))
        d = math.hypot(x - (ax + dx * t), z - (az + dz * t))
        if d < best:
            best, along = d, (run + L * t)
        run += L
    return best, along / run


def resample(pts, step):
    """Points every `step` along a polyline (its ends included)."""
    out = [pts[0]]
    for (ax, az), (bx_, bz) in zip(pts, pts[1:]):
        n = max(1, round(math.dist((ax, az), (bx_, bz)) / step))
        out += [(ax + (bx_ - ax) * k / n, az + (bz - az) * k / n) for k in range(1, n + 1)]
    return out


def at_along(pts, t):
    """The point a fraction `t` along a polyline."""
    L = [math.dist(a, b) for a, b in zip(pts, pts[1:])]
    s, acc = t * sum(L), 0.0
    for (ax, az), (bx_, bz), l in zip(pts, pts[1:], L):
        if acc + l >= s:
            f = (s - acc) / l
            return ax + (bx_ - ax) * f, az + (bz - az) * f
        acc += l
    return pts[-1]


def in_ellipses(x, z, ellipses):
    for ex, ez, rx, rz in ellipses:
        if ((x - ex) / rx) ** 2 + ((z - ez) / rz) ** 2 < 1:
            return True
    return False


# --- painted meshes (vertex colours) --------------------------------------------------------------


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
TOPSOIL = hexc('#5a3d26')
CLAY = hexc('#9a6a3c')
CLAY_LIGHT = hexc('#b07e4a')
SAND = hexc('#c09a62')
ROCKBAND = hexc('#857e73')
ROCKBAND_DARK = hexc('#6c665e')


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


def terrain(colour, height=None):
    """The walkable ground, one mesh named `terrain`."""
    p = Painted()
    grid_surface(p, -HALF, HALF, -HALF, HALF, height or ground, colour, 1)
    return finish_painted('terrain', p)


def strata(y, surface, seed, x=0.0):
    """The colour of the earth at height y in a cut face whose surface is at `surface`.

    The bands are measured down from the surface, so a tile whose meadow stands high shows the
    same soil, clay, sand and rock as one that sits low.
    """
    d = surface - y
    j = (_hash(x * 7.3 + y * 3.1, y * 5.7, seed) - 0.5) * 0.12
    wob = (noise(x * 1.3, y * 0.5, seed) - 0.5) * 0.25
    if d < 0.07:
        c = GRASS_DEEP
    elif d < 0.32 + wob * 0.5:
        c = TOPSOIL
    elif d < 0.9 - wob:
        c = mix(CLAY, CLAY_LIGHT, smooth(0.35, 0.65, noise(x * 0.7, y * 4.0, seed + 2)))
    elif d < 1.15 - wob:
        c = SAND
    else:
        c = mix(ROCKBAND, ROCKBAND_DARK, smooth(0.3, 0.7, noise(x * 0.9, y * 2.2, seed + 4)))
    return clamp_colour(c, j)


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
            tops = [top(x, z) for x, z in ends]
            bottom = -DEPTH
            for r in range(rows):
                f0, f1 = r / rows, (r + 1) / rows
                y0 = [bottom + (t - bottom) * f0 for t in tops]
                y1 = [bottom + (t - bottom) * f1 for t in tops]
                (xa, za), (xb, zb) = ends
                mid = (y0[0] + y1[1]) / 2
                c = strata(mid, (tops[0] + tops[1]) / 2, 3, xa + za)
                p.quad(P(xa, y0[0], za), P(xb, y0[1], zb), P(xb, y1[1], zb), P(xa, y1[0], za), c)
    p.quad(P(-HALF, -DEPTH, HALF), P(-HALF, -DEPTH, -HALF), P(HALF, -DEPTH, -HALF), P(HALF, -DEPTH, HALF),
           ROCKBAND_DARK)
    return finish_painted('plinth', p)


# --- decor (flat materials) -----------------------------------------------------------------------

parts = []
_into = [parts]


def into(bucket):
    """Collect the next pieces into their own object (a door the site can swing open)."""
    _into.append(bucket)


def out_of():
    _into.pop()


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
        vs = [bm.verts.new(P(x, y, z)) for x, y in (inner[k], outer[k], outer[k + 1], inner[k + 1])]
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


def strip(pts, width, mat, lift=0.015, height=None, wobble=0.15):
    """A continuous ribbon laid on the ground along a polyline: a lane, a path, a stream."""
    h = height or ground
    bm = bmesh.new()
    left, right = [], []
    for k, (x, z) in enumerate(pts):
        a, b = pts[max(0, k - 1)], pts[min(len(pts) - 1, k + 1)]
        dx, dz = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dz) or 1.0
        w = width * (1 + wobble * math.sin(k * 1.3))
        for side, row in ((-1, left), (1, right)):
            px_, pz = x - dz / L * w * side, z + dx / L * w * side
            px_, pz = max(-HALF, min(HALF, px_)), max(-HALF, min(HALF, pz))
            row.append(bm.verts.new(P(px_, h(px_, pz) + lift, pz)))
    for k in range(len(pts) - 1):
        bm.faces.new((left[k], left[k + 1], right[k + 1], right[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
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
    y = top(x, z)
    rnd = lp.seeded(seed)
    if kind == 'poplar':
        cyl((x, y, z), 0.07 * size, 1.0 * size, BARK, sides=6)
        bl((x, y + 1.55 * size, z), (0.38 * size, 1.05 * size, 0.38 * size), LEAF_DARK)
        return
    if kind == 'willow':
        add(lp.cone(P(x, y - 0.05, z), P(x, y + 0.75 * size, z), 0.16 * size, sides=6), BARK)
        for k in range(4):
            a = 1.57 * k + 0.4
            bl((x + math.cos(a) * 0.38 * size, y + 0.95 * size, z + math.sin(a) * 0.38 * size),
               (0.5 * size, 0.3 * size, 0.5 * size), LEAF_GOLD if k % 2 else LEAF_LIGHT)
        for k in range(10):   # trailing withies
            a, d = rnd.uniform(0, 6.28), rnd.uniform(0.45, 0.8) * size
            px_, pz = x + math.cos(a) * d, z + math.sin(a) * d
            add(lp.cone(P(px_, y + 0.95 * size, pz), P(px_ + 0.05, y + rnd.uniform(0.1, 0.4) * size, pz + 0.05),
                        0.045 * size, sides=3), LEAF_GOLD if k % 3 else LEAF_LIGHT)
        return
    trunk_h = 0.85 * size
    add(lp.cone(P(x, y - 0.05, z), P(x, y + trunk_h + 0.3 * size, z), 0.13 * size, sides=6), BARK)
    for k in range(2):  # a couple of boughs
        a = rnd.uniform(0, 6.28)
        add(lp.cone(P(x, y + trunk_h * 0.6, z),
                    P(x + math.cos(a) * 0.45 * size, y + trunk_h * 1.05, z + math.sin(a) * 0.45 * size),
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
        y = top(x, z)
        add(lp.cone(P(x, y, z), P(x, y + 0.16, z), 0.03, sides=3), LEAF_DARK)
        c = colours[k % len(colours)]
        r = rnd.uniform(0.045, 0.07)
        bl((x, y + 0.17, z), (r, r * 0.7, r), FLOWER[c], subdiv=0)


def tufts(n, seed, keep):
    """Scattered blades of grass wherever `keep(x, z)` says they may stand."""
    rnd = lp.seeded(seed)
    for k in range(n):
        x, z = rnd.uniform(-HALF + 0.2, HALF - 0.2), rnd.uniform(-HALF + 0.2, HALF - 0.2)
        if not keep(x, z):
            continue
        y = top(x, z)
        add(lp.cone(P(x, y - 0.02, z), P(x + rnd.uniform(-0.05, 0.05), y + rnd.uniform(0.12, 0.22), z), 0.06, sides=3),
            LEAF_LIGHT if k % 2 else GOLD_GRASS)


def hedge(pts, seed):
    rnd = lp.seeded(seed)
    for (ax, az), (bx_, bz) in zip(pts, pts[1:]):
        L = math.dist((ax, az), (bx_, bz))
        n = max(1, round(L / 0.42))
        for k in range(n):
            t = (k + 0.5) / n
            x, z = ax + (bx_ - ax) * t, az + (bz - az) * t
            y = ground(x, z)
            r = rnd.uniform(0.27, 0.34)
            bl((x, y + r * 0.9, z), (r, r * rnd.uniform(0.95, 1.2), r), HEDGE if k % 3 else LEAF_DARK)


def round_door(cx, cy, z, r, bucket, colour=DOOR, boards=DOOR_DARK, floor=None):
    """A round hobbit door as its own object, so the site can swing it on its west edge."""
    into(bucket)
    disc_z(cx, cy, z, r, colour, sides=20, flat_bottom=floor)
    for k in range(5):
        x = cx - r + (2 * r) * (k + 0.5) / 5
        hh = math.sqrt(max(0.0, r ** 2 - (x - cx) ** 2))
        low = floor if floor is not None else cy - hh
        bx((x, (low + cy + hh) / 2, z + 0.008), (0.012, cy + hh - low - 0.04, 0.01), boards)
    bl((cx, cy, z + 0.04), (0.045, 0.045, 0.03), BRASS)
    low = floor if floor is not None else cy - r
    bx((cx, cy, z - 0.02), (2 * r - 0.04, 2 * r - 0.1, 0.03), boards)
    out_of()
    del low


def hinge_object(name, bucket, at):
    """Join a door's pieces into an object whose origin is its hinge."""
    obj = lp.finish(name, bucket)
    h = P(*at)
    obj.data.transform(Matrix.Translation(-h))
    obj.location = h
    return obj


# --- markers and export -----------------------------------------------------------------------------


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
        export_texcoords=False, export_normals=True, export_materials='EXPORT',
        export_vertex_color='MATERIAL', export_all_vertex_colors=False,
        export_cameras=False, export_lights=False, export_animations=False, export_extras=False,
        export_draco_mesh_compression_enable=False,
    )


def triangles(objects):
    return sum(len(p.vertices) - 2 for o in objects for p in o.data.polygons)
