"""The Trollshaws: the trolls' fire in the wood, a whole diorama tile (#46), built in Blender.

    blender --background --python scripts/models/blender/trollshaws.py -- [--out out/models/trolls-camp.glb] [--blend <path>]

Writes the raw export (default `out/models/trolls-camp.glb`); `npm run model:pack` compresses it
into `assets/kits/trollshaws/trolls-camp.glb`, which an event's staging names as its `set:`.

Our own design, from The Hobbit, chapter 2: a wet night in the hills east of the Last Bridge.
The road comes through the wood from the west; off it, in a clearing among oaks and beeches, a
great fire burns, with the trolls' supper on a spit, a cask, a heap of sacks and the mutton bones
they have been grumbling over. A rock face at the back of the clearing holds the heavy door of
their cave. Everything is sodden: puddles stand in the mud and the bracken is beaten flat.

The event plays from night to dawn, so this tile is built for the dark: the fire is the only
light in it (`glow-fire*` and the `fx-fire` marker), and when the sun comes up over the eastern
trees it is the light preset that does it, not the set. The trolls turning to stone is their
track's `becomes` model, not anything here.

Everything shared with the other tiles — the coordinate map, the palette, the terrain, the
plinth, the decor helpers — is in `kit.py`; what the site reads by name is listed there.
"""

import math
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).parent))
import kit  # noqa: E402
import lowpoly as lp  # noqa: E402
from kit import *  # noqa: E402,F403  (the shared tile pieces: see kit.py)
from kit import _hash  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []

# A wet wood at night wants its own few materials; the rest come from the palette in kit.py.
BEECH = lp.material('beech', '#9d9080')                 # smooth pale bark
BEECH_LEAF = lp.material('beech_leaf', '#6e8c42')
LITTER = lp.material('litter', '#9a7a4c')               # last year's leaves underfoot
BRACKEN = lp.material('bracken', '#7f8a46')
BRACKEN_DRY = lp.material('bracken_dry', '#a89457')
EMBER = lp.material('ember', '#b8441f')
CHAR = lp.material('char', '#231e1b')
MUTTON = lp.material('mutton', '#b2653f')
MUTTON_CHAR = lp.material('mutton_char', '#6d3c24')
BONE = lp.material('bone', '#ded2b4')
SACK = lp.material('sack', '#8e7a53')
SACK_DARK = lp.material('sack_dark', '#6f5e3f')
PUDDLE = lp.material('puddle', '#4a5a62', roughness=0.12, metallic=0.2)
CAVE_DARK = lp.material('cave_dark', '#1d1714')
MUD = lp.material('mud', '#8a7050')
MUD_LIP = lp.material('mud_lip', '#7a6244')

FIRE = (0.2, 0.5)        # the heart of the clearing: everything is placed around it
CAVE = (4.5, -3.05)      # the door into the hill, standing in the crag's south face

cave_door = []           # the cave's door: its own object, so the site can swing it open

# --- the plan: the road, the clearing, the rock -------------------------------------------------

# The road through the wood: in from the west, past the south of the clearing, out at the east.
ROAD = [(-7.6, 4.3), (-5.4, 4.05), (-3.2, 4.2), (-1.0, 4.5), (1.4, 4.75), (3.8, 4.6), (5.8, 4.2), (7.6, 3.9)]
# The trodden way the trolls (and then Bilbo) take from the road up to the fire.
WAY = [(-1.2, 4.45), (-1.0, 3.5), (-0.7, 2.6), (-0.4, 1.7), (-0.1, 1.0)]
# The clearing: inside this ellipse the trees stop and the ground is beaten bare.
CLEARING = (FIRE[0], FIRE[1] + 0.3, 3.5, 3.0)
# The rock face the cave is dug into: (x from, x to, z of its foot, how high).
CRAG = (1.9, 7.4, -3.2, 1.9)

# Where the trolls sit, and what else stands in the clearing. These are the places the staging
# puts characters, so they are named rather than scattered.
SEATS = [(-1.75, -0.55), (1.95, -0.85), (0.45, 2.3)]
SPIT = (-0.95, 1.35)
CASK = (2.5, 1.65)
SACKS = (1.5, 2.65)
LOG = [(-3.4, 2.05), (-2.2, 2.6)]        # the fallen trunk Bilbo watches from behind


def road_d(x, z):
    return polyline_dist(ROAD, x, z)[0]


def way_d(x, z):
    return polyline_dist(WAY, x, z)[0]


def clearing_f(x, z):
    """1 in the open clearing, falling to 0 under the trees."""
    cx, cz, rx, rz = CLEARING
    return 1 - smooth(0.85, 1.15, math.hypot((x - cx) / rx, (z - cz) / rz))


def crag_height(x, z):
    """How high the rock face stands above the ground, or 0 away from it."""
    x0, x1, zf, hh = CRAG
    if z > zf:
        return 0.0
    fx = smooth(0.0, 1.2, x - x0) * smooth(0.0, 1.0, x1 - x)
    fz = smooth(0.0, 1.0, zf - z)
    n = (noise(x * 0.7, z * 0.7, 17) - 0.5) * 1.0 + (noise(x * 1.9, z * 1.9, 19) - 0.5) * 0.45
    # the cave mouth is cut back into the face
    mouth = 1 - 0.55 * (1 - smooth(0.0, 1.5, math.dist((x, z), CAVE)))
    return max(0.0, (hh + n) * fx * fz * mouth)


def base_height(x, z):
    """The walkable ground: a dell in hill country, rising north to the crag."""
    n = noise(x * 0.38, z * 0.38, 3) * 0.7 + noise(x * 1.1, z * 1.1, 8) * 0.3
    h = 0.55 + 0.5 * n - 0.1 * z          # the hills fall away south towards the road
    h -= 0.42 * clearing_f(x, z)          # the clearing sits in a hollow
    h -= 0.09 * (1 - smooth(0.3, 0.9, road_d(x, z)))     # the road is worn lower
    h -= 0.05 * (1 - smooth(0.2, 0.6, way_d(x, z)))
    h += 0.5 * smooth(-3.0, -6.5, z) * smooth(0.0, 3.0, abs(x) - 1.0)   # the ground climbs at the back
    return h


def top_height(x, z):
    return base_height(x, z) + crag_height(x, z)


kit.ground, kit.top = base_height, top_height   # the decor helpers stand things on this tile
kit.DEPTH = 1.75


def fire_ground():
    return base_height(*FIRE)


# --- the ground, painted face by face -----------------------------------------------------------

MOSS_C = hexc('#6f8f44')
LEAF_C = hexc('#9c7c4e')
LEAF_WET = hexc('#846340')
MUD_C = hexc('#8a7050')
ASH_C = hexc('#9a938a')
ROCK_C = hexc('#938c82')
ROCK_WET = hexc('#7b756c')


def ground_colour(x, z, seed):
    j = (_hash(x * 3.3, z * 2.9, seed) - 0.5) * 0.06
    n = noise(x * 0.55, z * 0.55, 23)
    c = mix(LEAF_C, MOSS_C, smooth(0.4, 0.85, n))          # leaf litter and moss under the trees
    c = mix(c, LEAF_WET, 0.35 * noise(x * 1.4, z * 1.4, 29))
    f = clearing_f(x, z)
    c = mix(c, MUD_C, 0.8 * f)                             # beaten mud where the trolls tramp
    c = mix(c, MUD_C, 0.7 * (1 - smooth(0.3, 0.95, road_d(x, z))))
    c = mix(c, MUD_C, 0.5 * (1 - smooth(0.2, 0.6, way_d(x, z))))
    d = math.dist((x, z), FIRE)
    c = mix(c, ASH_C, 0.75 * (1 - smooth(0.9, 2.1, d)))    # ash spread round the fire
    if crag_height(x, z) > 0.05:
        c = mix(ROCK_C, ROCK_WET, smooth(0.35, 0.75, noise(x * 0.9, z * 0.9, 37)))
    return clamp_colour(c, j)


def crag():
    """The rock face at the back of the clearing, with the cave mouth cut into it."""
    p = Painted()
    n = round(2 * HALF / STEP)
    xs = [-HALF + 2 * HALF * i / n for i in range(n + 1)]
    zs = [-HALF + 2 * HALF * j / n for j in range(n + 1)]
    H = [[top_height(x, z) for z in zs] for x in xs]
    for i in range(n):
        for j in range(n):
            if max(crag_height(xs[i + k], zs[j + m]) for k in (0, 1) for m in (0, 1)) < 0.04:
                continue
            a = P(xs[i], H[i][j], zs[j])
            b = P(xs[i + 1], H[i + 1][j], zs[j])
            c = P(xs[i], H[i][j + 1], zs[j + 1])
            d = P(xs[i + 1], H[i + 1][j + 1], zs[j + 1])
            for k, tri in enumerate(((a, c, b), (b, c, d))):
                cx = sum(q.x for q in tri) / 3
                cz = -sum(q.y for q in tri) / 3
                p.face(list(tri), ground_colour(cx, cz, 41 + k))
    return finish_painted('crag', p)


# --- the fire and what stands round it ----------------------------------------------------------

def campfire():
    """The great fire: a ring of stones, burnt logs, flame and embers. Returns where the light sits."""
    x, z = FIRE
    y = fire_ground()
    for k in range(11):                     # the ring of stones, blackened on the inside
        a = 6.283 * k / 11 + 0.2
        rock((x + math.cos(a) * 1.15, y + 0.04, z + math.sin(a) * 1.15), 0.24, 60 + k,
             mat=ROCK_DARK if k % 3 else SOOT, moss=False, squash=0.8)
    for k in range(7):                      # logs laid across one another
        a = 6.283 * k / 7 + 0.6
        add(lp.cone(P(x + math.cos(a) * 0.95, y + 0.05, z + math.sin(a) * 0.95),
                    P(x - math.cos(a) * 0.34, y + 0.42, z - math.sin(a) * 0.34), 0.1, sides=5),
            CHAR if k % 2 else WOOD_DARK)
    for k in range(9):                      # embers in the heart
        a, d = 6.283 * k / 9, 0.1 + 0.26 * (k % 3)
        bl((x + math.cos(a) * d, y + 0.09, z + math.sin(a) * d), (0.14, 0.06, 0.14), EMBER, subdiv=0)
    for k in range(9):                      # flame, leaning in towards the core
        a, d = 6.283 * k / 9 + 0.3, 0.14 + 0.2 * (k % 3)
        h = 0.8 + 0.34 * ((k * 7) % 3)
        add(lp.cone(P(x + math.cos(a) * d, y + 0.08, z + math.sin(a) * d),
                    P(x + math.cos(a) * d * 0.25, y + h, z + math.sin(a) * d * 0.25), 0.19, sides=4),
            GLOW_FIRE)
    add(lp.cone(P(x, y + 0.1, z), P(x, y + 1.35, z), 0.15, sides=5), GLOW_FIRE_CORE)
    bl((x, y + 0.02, z), (1.0, 0.02, 1.0), EMBER, subdiv=1)      # the ash lit from above
    return (x, y + 0.55, z)


def spit():
    """The trolls' supper: two forked uprights, a bar across, mutton on it."""
    x, z = SPIT
    y = base_height(x, z)
    for side in (-1, 1):
        px = x + side * 0.62
        cyl((px, y, z), 0.045, 0.72, WOOD_DARK, sides=5)
        for fork in (-1, 1):
            add(lp.cone(P(px, y + 0.6, z), P(px + fork * 0.1, y + 0.82, z), 0.035, sides=4), WOOD_DARK)
    cyl((x, y + 0.76, z), 0.03, 1.5, IRON, sides=6, axis='x')
    for k in range(3):                      # joints turning over the fire
        bl((x - 0.42 + k * 0.42, y + 0.68, z), (0.16, 0.14, 0.15), MUTTON if k != 1 else MUTTON_CHAR)
    for k in range(3):                      # bones thrown down
        a = 1.4 * k + 0.3
        bx((x + math.cos(a) * 0.95, y + 0.03, z + math.sin(a) * 0.95), (0.19, 0.04, 0.05), BONE, rot=a)


def camp_things():
    """The cask, the pot, the sacks, and the rubbish of a long supper."""
    x, z = CASK
    y = base_height(x, z)
    cyl((x, y + 0.26, z), 0.26, 0.6, WOOD, sides=10, axis='x')     # the cask on its side
    for side in (-0.22, 0.22):
        cyl((x + side, y + 0.26, z), 0.275, 0.04, IRON, sides=10, axis='x')
    bx((x - 0.05, y + 0.03, z + 0.4), (0.3, 0.06, 0.22), WOOD_DARK)   # a chock to stop it rolling

    px, pz = FIRE[0] + 1.25, FIRE[1] - 0.15                        # the black pot by the fire
    py = base_height(px, pz)
    cyl((px, py + 0.02, pz), 0.24, 0.3, SOOT, sides=10)
    cyl((px, py + 0.33, pz), 0.26, 0.04, SOOT, sides=10)
    add(lp.cone(P(px - 0.26, py + 0.3, pz), P(px, py + 0.52, pz), 0.025, sides=4), IRON)
    add(lp.cone(P(px, py + 0.52, pz), P(px + 0.26, py + 0.3, pz), 0.025, sides=4), IRON)

    sx, sz = SACKS                                                  # the heap of sacks
    for k, (dx, dz, r) in enumerate(((0, 0, 0.3), (0.42, 0.1, 0.26), (0.2, -0.38, 0.24), (-0.3, 0.3, 0.22))):
        bx_, bz_ = sx + dx, sz + dz
        by = base_height(bx_, bz_)
        bl((bx_, by + r * 0.8, bz_), (r, r * 0.85, r * 0.82), SACK if k % 2 else SACK_DARK)
        bl((bx_ + 0.04, by + r * 1.6, bz_), (r * 0.3, r * 0.3, r * 0.3), SACK_DARK, subdiv=0)


def seats():
    """Stumps and boulders the trolls sit on, worn flat on top."""
    for k, (x, z) in enumerate(SEATS):
        y = base_height(x, z)
        if k == 2:
            rock((x, y + 0.16, z), 0.58, 70 + k, mat=ROCK_DARK, moss=False, squash=0.52)
        else:
            cyl((x, y - 0.05, z), 0.42 + 0.04 * k, 0.5, BARK, sides=9)
            bl((x, y + 0.45, z), (0.4 + 0.04 * k, 0.05, 0.4 + 0.04 * k), WOOD_LIGHT, subdiv=0)


def fallen_log():
    """The trunk across the clearing's edge, which is what Bilbo has to creep behind."""
    (ax, az), (bx_, bz) = LOG
    ay, by = base_height(ax, az) + 0.26, base_height(bx_, bz) + 0.24
    add(lp.cone(P(ax, ay, az), P(bx_, by, bz), 0.27, sides=8), BARK)
    add(lp.cone(P(bx_, by, bz), P(bx_ + 0.5, by - 0.1, bz + 0.3), 0.2, sides=6), WOOD_DARK)
    for k in range(4):                      # broken boughs and moss on the windward side
        t = 0.2 + 0.2 * k
        mx, mz = ax + (bx_ - ax) * t, az + (bz - az) * t
        my = ay + (by - ay) * t
        bl((mx, my + 0.2, mz), (0.22, 0.08, 0.2), MOSS)
    add(lp.cone(P(ax - 0.2, ay - 0.05, az - 0.1), P(ax - 0.75, ay + 0.35, az - 0.5), 0.07, sides=4), BARK)


def cave():
    """The door in the rock face, as its own object so the site can swing it open."""
    x, z = CAVE
    y = base_height(x, z)
    w, h = 0.95, 1.5
    # the mouth: a dark recess behind the door
    bx((x, y + h / 2, z - 0.42), (w + 0.5, h + 0.2, 0.8), CAVE_DARK)
    for side in (-1, 1):                    # the jambs, blocks of dressed stone
        for k in range(4):
            bx((x + side * (w / 2 + 0.17), y + 0.22 + k * 0.42, z - 0.02),
               (0.3, 0.38, 0.4), STONE if (k + side) % 2 else STONE_DARK)
    bx((x, y + h + 0.16, z - 0.02), (w + 0.78, 0.3, 0.44), STONE_DARK)   # the lintel
    into(cave_door)
    bx((x + w / 2, y + h / 2, z + 0.06), (w, h, 0.12), WOOD_DARK)        # the leaf, hinged at its west edge
    for k in range(3):
        bx((x + w / 2, y + 0.3 + k * 0.52, z + 0.14), (w - 0.06, 0.1, 0.05), IRON)
    bl((x + w - 0.16, y + h / 2, z + 0.16), (0.07, 0.07, 0.05), IRON, subdiv=0)
    out_of()
    for k in range(5):                      # rubble at the foot of the face
        a = 1.1 * k
        rock((x + math.cos(a) * 1.5, y + 0.05, z + 0.55 + math.sin(a) * 0.35), 0.24 + 0.05 * (k % 3),
             80 + k, mat=ROCK_DARK, squash=0.75)
    scree()


def scree():
    """Blocks fallen from the face, and the ones still perched on its crest."""
    rnd = lp.seeded(91)
    x0, x1, zf, _ = CRAG
    for k in range(16):
        bx_ = rnd.uniform(max(x0, -HALF + 0.4), min(x1, HALF - 0.4))
        if abs(bx_ - CAVE[0]) < 1.1:
            continue
        if k % 2:                            # at the foot, on the clearing side
            bz = zf + rnd.uniform(0.1, 0.9)
            r = rnd.uniform(0.2, 0.45)
            rock((bx_, base_height(bx_, bz) + r * 0.3, bz), r, 140 + k, mat=ROCK if k % 3 else ROCK_DARK)
        else:                                # perched on the face itself
            bz = zf - rnd.uniform(0.6, 2.4)
            r = rnd.uniform(0.25, 0.5)
            rock((bx_, top_height(bx_, bz) + r * 0.25, bz), r, 140 + k, mat=ROCK_DARK, moss=False)


# --- the wood, the road and the wet ground ------------------------------------------------------

def wood():
    """Oaks and beeches round the clearing: thick at the back, thin where the camera looks in."""
    rnd = lp.seeded(11)
    placed = []
    for _ in range(420):
        if len(placed) >= 38:
            break
        x = rnd.uniform(-HALF + 0.5, HALF - 0.5)
        z = rnd.uniform(-HALF + 0.5, HALF - 0.5)
        if clearing_f(x, z) > 0.05 or crag_height(x, z) > 0.2:
            continue
        if math.dist((x, z), CAVE) < 2.4 or (z < CRAG[2] + 1.0 and CRAG[0] < x < CRAG[1]):
            continue       # keep the rock face and its door clear
        if road_d(x, z) < 1.0 or way_d(x, z) < 0.8:
            continue
        if z > 4.6 and abs(x) < 5.4:        # keep the near edge open, so the fire can be seen
            continue
        if any(math.dist((x, z), p) < 1.5 for p in placed):
            continue
        placed.append((x, z))
        k = len(placed)
        size = rnd.uniform(0.95, 1.5)
        if k % 3 == 2:
            beech(x, z, size, 100 + k)
        else:
            tree(x, z, size=size, kind='oak', seed=100 + k)
    return placed


def beech(x, z, size, seed):
    """A beech: a tall straight bole of pale bark, the crown held high and flat."""
    rnd = lp.seeded(seed)
    y = base_height(x, z)
    h = 1.5 * size
    add(lp.cone(P(x, y - 0.05, z), P(x, y + h, z), 0.12 * size, sides=6), BEECH)
    for k in range(3):                      # boughs forking near the top
        a = 2.1 * k + rnd.uniform(0, 1)
        add(lp.cone(P(x, y + h * 0.8, z), P(x + math.cos(a) * 0.5 * size, y + h * 1.15, z + math.sin(a) * 0.5 * size),
                    0.05 * size, sides=4), BEECH)
    for k in range(4):
        a = 1.57 * k + rnd.uniform(0, 0.8)
        d = 0.0 if k == 0 else rnd.uniform(0.3, 0.5) * size
        r = (0.66 if k == 0 else rnd.uniform(0.4, 0.52)) * size
        bl((x + math.cos(a) * d, y + h + 0.3 * size + rnd.uniform(-0.1, 0.2) * size, z + math.sin(a) * d),
           (r, r * 0.62, r), BEECH_LEAF if k % 2 else LEAF_DARK)


def undergrowth(trees):
    """Bracken, brambles and saplings between the trunks; nothing in the trolls' way."""
    rnd = lp.seeded(27)
    for k in range(90):
        x, z = rnd.uniform(-HALF + 0.3, HALF - 0.3), rnd.uniform(-HALF + 0.3, HALF - 0.3)
        if clearing_f(x, z) > 0.35 or road_d(x, z) < 0.85 or way_d(x, z) < 0.6:
            continue
        if crag_height(x, z) > 0.3 or any(math.dist((x, z), p) < 0.55 for p in trees):
            continue
        y = base_height(x, z)
        # beaten down by the rain: a low spreading clump, not a spray of spikes
        for f in range(3):
            a = 2.1 * f + rnd.uniform(0, 1)
            d = rnd.uniform(0.14, 0.3)
            bl((x + math.cos(a) * d, y + 0.1, z + math.sin(a) * d),
               (0.26, 0.09, 0.22), BRACKEN if (k + f) % 3 else BRACKEN_DRY, subdiv=0)


def puddles():
    """Standing water in the ruts: it has been raining for days."""
    for k, (x, z, rx, rz) in enumerate((
        (-1.9, 4.35, 0.62, 0.3), (2.6, 4.55, 0.5, 0.26), (-4.6, 4.1, 0.44, 0.24),
        (-0.55, 2.35, 0.36, 0.28), (1.15, 0.05, 0.3, 0.22), (5.3, 3.95, 0.42, 0.22),
    )):
        y = base_height(x, z)
        bl((x, y - 0.01, z), (rx, 0.03, rz), PUDDLE, subdiv=1)
        bl((x, y - 0.02, z), (rx + 0.08, 0.02, rz + 0.07), MUD_LIP, subdiv=0)


def leaf_litter():
    """Fallen leaves and twigs, and the grass that gets through: the floor of a wood."""
    tufts(260, 5, lambda x, z: clearing_f(x, z) < 0.5 and road_d(x, z) > 0.8 and crag_height(x, z) < 0.2)
    rnd = lp.seeded(33)
    for k in range(120):
        x, z = rnd.uniform(-HALF + 0.3, HALF - 0.3), rnd.uniform(-HALF + 0.3, HALF - 0.3)
        if crag_height(x, z) > 0.25:
            continue
        y = base_height(x, z)
        if clearing_f(x, z) > 0.5 and rnd.random() < 0.6:
            continue
        bl((x, y + 0.012, z), (rnd.uniform(0.1, 0.2), 0.012, rnd.uniform(0.09, 0.18)),
           LITTER if k % 2 else BRACKEN_DRY, subdiv=0)
    for k in range(16):                     # fallen boughs
        x, z = rnd.uniform(-HALF + 1, HALF - 1), rnd.uniform(-HALF + 1, HALF - 1)
        if clearing_f(x, z) > 0.3 or road_d(x, z) < 0.9 or crag_height(x, z) > 0.2:
            continue
        a = rnd.uniform(0, 6.28)
        L = rnd.uniform(0.5, 1.1)
        y = base_height(x, z)
        add(lp.cone(P(x, y + 0.07, z), P(x + math.cos(a) * L, base_height(x, z) + 0.05, z + math.sin(a) * L),
                    0.06, sides=4), BARK)


def ways():
    """The road through the wood, and the trodden way up to the fire."""
    strip(resample(ROAD, 0.5), 0.95, MUD, lift=0.02)
    strip(resample(WAY, 0.4), 0.42, MUD, lift=0.022)
    rnd = lp.seeded(47)
    for k in range(26):                     # stones turned up in the road
        t = (k + 0.5) / 26
        x, z = at_along(ROAD, t)
        o = rnd.uniform(-0.45, 0.45)
        rock((x + o, base_height(x + o, z) + 0.02, z + rnd.uniform(-0.35, 0.35)), 0.1 + 0.05 * (k % 3),
             120 + k, mat=ROCK_DARK, moss=False, squash=0.6)


def main():
    out = Path(ARGS[ARGS.index('--out') + 1]) if '--out' in ARGS else ROOT / 'out' / 'models' / 'trolls-camp.glb'
    out.parent.mkdir(parents=True, exist_ok=True)

    objs = [terrain(ground_colour), plinth(), crag()]
    fire = campfire()
    spit()
    camp_things()
    seats()
    fallen_log()
    cave()
    trees = wood()
    undergrowth(trees)
    ways()
    puddles()
    leaf_litter()

    decor = lp.finish('trollshaws', kit.parts)
    door = hinge_object('door-cave', cave_door, (CAVE[0], base_height(*CAVE), CAVE[1] + 0.06))
    objs += [decor, door]
    tris = triangles(objs)

    empties = [empty('fx-fire', fire), empty('fx-smoke-fire', (fire[0], fire[1] + 0.5, fire[2]))]
    empties += [empty(f'fx-fireflies-{k}', at) for k, at in enumerate(
        ((-4.8, 0.9, 1.2), (4.6, 0.9, 1.9)))]

    print(f'trolls-camp: {tris} triangles, {len(kit.parts)} parts, {len(empties)} markers')
    blend = Path(ARGS[ARGS.index('--blend') + 1]) if '--blend' in ARGS else None
    if blend:
        bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True)
        print(f'wrote {blend}')
    export(out, objs + empties)
    print(f'wrote {out}')


if __name__ == '__main__':
    main()
