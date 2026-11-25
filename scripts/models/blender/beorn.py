"""Beorn's house: the hall in its courtyard among the bee-pastures (#48), built in Blender.

    blender --background --python scripts/models/blender/beorn.py -- [--out out/models/beorns-house.glb] [--blend <path>]

Writes the raw export (default `out/models/beorns-house.glb`); `npm run model:pack` compresses it
into `assets/kits/beorn/beorns-house.glb`, which an event's staging names as its `set:`.

Our own design, from The Hobbit, chapter 7. A high thorn hedge with a wide wooden gate; a lane
of flowers in from it; and a long low house of oak logs whose two wings run south to make three
sides of a courtyard, with a wide porch between them. Beyond the hedge on the east are the
bee-pastures, rows of hives as tall as a man standing in clover; west is the paddock where the
ponies are kept. Oaks stand round the whole holding.

Two events play here, both indoors as much as out: the company arrives in pairs and eats at
Beorn's table (ch. 7), and comes back for Yule on the way home. So the hall's roof is its own
object, `cover-roof`, which the staging lifts away like the lid off a doll's house (DESIGN §9.4)
to show the long table, the benches, the hearth in the middle of the floor and the straw beds
along the west end. The hearth is the one fire in the tile (`fx-fire`), with its smoke going up
through the smoke-hole in the ridge.

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

# A holding of oak logs, thatch and clover wants a few materials of its own.
OAK_LOG = lp.material('oak_log', '#8a6238')            # the barked logs the walls are built of
OAK_LOG_DARK = lp.material('oak_log_dark', '#6b4a2a')
OAK_CUT = lp.material('oak_cut', '#c0a070')            # the pale sawn ends of the logs
THORN = lp.material('thorn', '#3a5c2e')                # the hedge: darker and drier than a garden one
THORN_DRY = lp.material('thorn_dry', '#6a6a3a')
STRAW = lp.material('straw', '#d8bc72')                # the hives, and the beds in the hall
STRAW_DARK = lp.material('straw_dark', '#b2954f')
HONEY = lp.material('honey', '#d9962a', roughness=0.25)
CLOVER_LEAF = lp.material('clover_leaf', '#5f9442')
CLOVER_WHITE = lp.material('clover_white', '#f2f0e2')
CLOVER_PINK = lp.material('clover_pink', '#d98fa8')
BEE = lp.material('bee', '#d9a830')
EARTH_FLOOR = lp.material('earth_floor', '#8d7450')
HORN = lp.material('horn', '#e0d2a8', roughness=0.3)   # Beorn's cups and bowls are horn and wood
MILK = lp.material('milk', '#f6f3e6')
MEAD = lp.material('mead', '#c88a2e', roughness=0.3)

# --- the plan ------------------------------------------------------------------------------------

# The hall: a long low house running east and west at the back of the tile.
HALL = (-3.5, 3.5, -5.4, -2.6)           # x from, x to, z from (north), z to (south)
WALL_H = 1.5                             # the log walls: low, because Beorn's roof is huge
RIDGE_H = 2.55                           # the ridge over the hall floor
# The two wings, running south from the hall's ends to make three sides of a court.
WING_W = 1.1
WINGS = ((HALL[0], HALL[0] + WING_W), (HALL[1] - WING_W, HALL[1]))
WING_Z = (HALL[3], 0.3)                  # how far south they run
WING_RIDGE = 1.85
# The courtyard between them, and the porch into the hall.
COURT = (HALL[0] + WING_W, HALL[1] - WING_W, HALL[3], WING_Z[1] + 0.2)
PORCH = (0.0, HALL[3])                   # the middle of the hall's south face
PORCH_OUT = 0.95                         # how far the porch roof reaches into the court
# The hearth in the middle of the hall floor, and the smoke-hole in the ridge over it.
HEARTH = (-2.3, -4.0)
SMOKE_HOLE = (HEARTH[0] - 0.55, HEARTH[0] + 0.55)
# The long table down the hall, east of the hearth; Beorn's own seat at its head.
TABLE = (-0.5, 3.0, -4.3, -3.75)         # x from, x to, z from, z to
BENCH_Z = (TABLE[2] - 0.5, TABLE[3] + 0.5)
BEDS = (-3.2, -1.3, -5.15, -4.6)         # the straw along the hall's north-west corner
# The gate in the thorn hedge, and the lane of flowers in from it.
GATE = (-1.35, 4.15)
LANE = [(-1.35, 4.6), (-1.25, 3.5), (-0.95, 2.4), (-0.6, 1.4), (-0.25, 0.5), (0.0, -0.6), (0.0, -2.1)]
# The hedge: along the south, and up both sides as far as the house.
HEDGE_S = [(-7.0, 4.05), (-4.6, 4.2), (-2.3, 4.15), (-0.4, 4.1), (1.9, 4.0), (4.3, 3.9), (7.0, 3.75)]
HEDGE_W = [(-6.25, 4.15), (-6.4, 1.6), (-6.3, -1.0), (-6.1, -3.4)]
HEDGE_E = [(6.2, 3.85), (6.35, 1.3), (6.25, -1.3), (6.05, -3.6)]
# The bee-pastures, east of the court, and the ponies' paddock west of it.
HIVES = [(4.6, -1.2), (5.4, -0.5), (4.5, 0.5), (5.3, 1.25), (4.65, 2.2), (5.45, 2.95), (4.55, 3.6)]
PADDOCK = (-6.1, -4.3, -1.9, 3.3)        # x from, x to, z from, z to
FLOOR = 0.62                             # the level the whole holding is built on

roof_parts = []        # the hall's roof: its own object, which the staging lifts away
front_parts = []       # and its south wall, which is the one between the scene and the camera
gate_leaf = []         # the gate in the hedge: hinged, so the site can swing it open


# --- the ground ---------------------------------------------------------------------------------

def rect_f(r, soft=0.5):
    """1 inside the rectangle (x0, x1, z0, z1), falling to 0 `soft` outside it."""
    x0, x1, z0, z1 = r

    def f(x, z):
        return (smooth(-soft, soft, x - x0) * smooth(-soft, soft, x1 - x)
                * smooth(-soft, soft, z - z0) * smooth(-soft, soft, z1 - z))
    return f


platform_f = rect_f((HALL[0] - 1.0, HALL[1] + 1.0, HALL[2] - 0.7, WING_Z[1] + 0.8), soft=0.85)
house_f = rect_f(HALL, soft=0.12)
court_f = rect_f(COURT, soft=0.45)


def lane_d(x, z):
    return polyline_dist(LANE, x, z)[0]


def base_height(x, z):
    """A green shelf above the river: level where the house stands, falling away south."""
    n = noise(x * 0.33, z * 0.33, 5) * 0.7 + noise(x * 1.05, z * 1.05, 9) * 0.3
    h = 0.52 + 0.4 * n - 0.055 * z                       # the land falls to the Anduin, off south
    h += 0.42 * smooth(-3.6, -6.8, z)                    # and climbs towards the mountains behind
    f = platform_f(x, z)                                 # the holding is built on the level
    h = h + (FLOOR - h) * f
    h -= 0.045 * (1 - smooth(0.25, 0.85, lane_d(x, z)))  # the lane is trodden a little lower
    h -= 0.02 * court_f(x, z)
    return h


kit.ground, kit.top = base_height, base_height   # nothing stands over the walkable ground here
kit.DEPTH = 1.8


CLOVER_C = hexc('#6f9c4c')
CLOVER_DEEP = hexc('#5d8a42')
MEADOW_C = hexc('#84ad58')
COURT_C = hexc('#9a8560')
LANE_PALE = hexc('#c2a97c')
BOARD_C = hexc('#8c6a42')
BOARD_DARK = hexc('#75562f')
TROD = hexc('#8f8452')


def ground_colour(x, z, seed):
    j = (_hash(x * 3.1, z * 2.7, seed) - 0.5) * 0.055
    n = noise(x * 0.5, z * 0.5, 21)
    c = mix(CLOVER_C, MEADOW_C, smooth(0.35, 0.8, n))
    c = mix(c, CLOVER_DEEP, 0.4 * noise(x * 1.3, z * 1.3, 27))
    # the bee-pastures and the paddock are grazed and trodden rather than deep in clover
    c = mix(c, TROD, 0.55 * rect_f(PADDOCK, 0.7)(x, z))
    c = mix(c, COURT_C, 0.9 * court_f(x, z))                             # the beaten court
    c = mix(c, LANE_PALE, 0.8 * (1 - smooth(0.26, 0.9, lane_d(x, z))))   # the lane in from the gate
    f = house_f(x, z)
    if f > 0.4:                                                          # boards inside the hall
        c = mix(BOARD_C, BOARD_DARK, smooth(0.35, 0.65, noise(x * 4.5, z * 1.1, 31)))
    return clamp_colour(c, j)


# --- the house ----------------------------------------------------------------------------------

def log_wall(x0, x1, z0, z1, height, courses=5, door=None, window=None):
    """A wall of oak logs laid horizontally, with the courses showing, and its sawn ends.

    `door` and `window` are (centre, width) along the wall, left out of the courses that cross
    them, so the hall is not a shut box when the roof comes off.
    """
    horizontal = abs(x1 - x0) > abs(z1 - z0)
    length = max(abs(x1 - x0), abs(z1 - z0))
    thick = 0.22
    for k in range(courses):
        r = height / courses
        y = FLOOR + r * (k + 0.5)
        spans = [(0.0, length)]
        for hole, lo, hi in ((door, 0, int(courses * 0.72)), (window, int(courses * 0.45), int(courses * 0.78))):
            if hole and lo <= k < hi:
                c, w = hole
                spans = [s for part in spans for s in
                         ((part[0], min(part[1], c - w / 2)), (max(part[0], c + w / 2), part[1]))
                         if s[1] - s[0] > 0.05]
        for a, b in spans:
            mid = (a + b) / 2
            if horizontal:
                cx = min(x0, x1) + mid
                cz = (z0 + z1) / 2
                bx((cx, y, cz), (b - a, r * 0.94, thick), OAK_LOG if k % 2 else OAK_LOG_DARK)
            else:
                cz = min(z0, z1) + mid
                cx = (x0 + x1) / 2
                bx((cx, y, cz), (thick, r * 0.94, b - a), OAK_LOG if k % 2 else OAK_LOG_DARK)
    # the corner posts, where the logs are crossed and their ends left pale
    for (cx, cz) in (((x0, z0), (x1, z1)) if horizontal else ((x0, z0), (x1, z1))):
        for k in range(courses):
            y = FLOOR + height / courses * (k + 0.5)
            bx((cx, y, cz), (0.3, height / courses * 0.9, 0.3), OAK_CUT if k % 2 else OAK_LOG_DARK)


def gable(x0, x1, z0, z1, wall, ridge, mat):
    """The triangle of boards between a wall's top and the ridge above it, at each end."""
    for zc in (z0, z1):
        for k in range(4):
            f0, f1 = k / 4, (k + 1) / 4
            y0 = FLOOR + wall + (ridge - wall) * f0
            y1 = FLOOR + wall + (ridge - wall) * f1
            w0 = (x1 - x0) * (1 - f0)
            w1 = (x1 - x0) * (1 - f1)
            bx(((x0 + x1) / 2, (y0 + y1) / 2, zc), ((w0 + w1) / 2, y1 - y0, 0.14), mat)


def smoke_hole():
    """A louvre of boards over the hole in the ridge, so the rain stays out and the smoke gets out."""
    zm = (HALL[2] + HALL[3]) / 2
    hx = (SMOKE_HOLE[0] + SMOKE_HOLE[1]) / 2
    yt = FLOOR + WALL_H + (RIDGE_H - WALL_H) * 0.62
    for side in (-1, 1):
        bx((hx, yt + 0.42, zm + side * 0.34), (SMOKE_HOLE[1] - SMOKE_HOLE[0] + 0.2, 0.1, 0.3), WOOD_DARK)
    for sx in (SMOKE_HOLE[0] + 0.05, SMOKE_HOLE[1] - 0.05):
        for side in (-1, 1):
            bx((sx, yt + 0.21, zm + side * 0.34), (0.08, 0.42, 0.08), WOOD_DARK)


def hall():
    """The long house: log walls, the great thatch roof as its own liftable object, the porch."""
    x0, x1, z0, z1 = HALL
    log_wall(x0, x1, z0, z0, WALL_H)                                   # the north wall, blind
    into(front_parts)                                                  # the south wall: its own
    log_wall(x0, x1, z1, z1, WALL_H, door=(PORCH[0] - x0, 1.15),       # cover, because it stands
             window=(x1 - x0 - 1.1, 0.75))                             # between the hall and the eye
    out_of()
    log_wall(x0, x0, z0, z1, WALL_H, window=(1.35, 0.7))               # the west end, over the beds
    log_wall(x1, x1, z0, z1, WALL_H, window=(1.5, 0.7))                # the east end, over the table
    gable(x0, x1, z0, z1, WALL_H, RIDGE_H, OAK_LOG_DARK)

    into(roof_parts)
    gable_roof(x0, x1, z0, z1, FLOOR + WALL_H, FLOOR + RIDGE_H, THATCH, THATCH_DARK,
               over=0.34, hole=SMOKE_HOLE, gable_mat=OAK_LOG_DARK)
    smoke_hole()
    out_of()

    porch()
    hall_inside()


def porch():
    """The wide porch: four oak posts and a low roof, the way in from the court."""
    px, pz = PORCH
    y = FLOOR
    for sx in (-1.5, -0.62, 0.62, 1.5):
        cyl((px + sx, y, pz + PORCH_OUT - 0.12), 0.11, 1.42, OAK_LOG, sides=7)
        bl((px + sx, y + 1.44, pz + PORCH_OUT - 0.12), (0.16, 0.08, 0.16), OAK_CUT, subdiv=0)
    bx((px, y + 1.5, pz + PORCH_OUT - 0.12), (3.4, 0.16, 0.2), OAK_LOG_DARK)      # the beam
    into(roof_parts)        # the hood goes up with the hall's roof: it is over the way in
    gable_roof(px - 1.75, px + 1.75, pz - 0.1, pz + PORCH_OUT, y + 1.52, y + 1.92,
               THATCH, THATCH_DARK, over=0.2, gable_mat=THATCH_DARK)
    out_of()
    bx((px, y + 0.045, pz + 0.5), (1.7, 0.09, 1.0), WOOD_DARK)                     # the doorstep
    # the door itself: two leaves of oak, standing open against the wall, as they are all summer
    for side in (-1, 1):
        bx((px + side * 0.84, y + 0.62, pz - 0.1), (0.1, 1.2, 0.56), WOOD)
        bx((px + side * 0.84, y + 0.62, pz - 0.1), (0.12, 0.1, 0.5), IRON)
    # a bench by the door, where Beorn sits with his pipe
    bx((px - 2.35, y + 0.22, pz + 0.55), (1.1, 0.12, 0.3), WOOD)
    for sx in (-2.75, -1.95):
        bx((px + sx, y + 0.09, pz + 0.55), (0.1, 0.18, 0.26), WOOD_DARK)


def hall_inside():
    """What the roof hides: the table, the benches, the hearth, the beds and the gear on the walls."""
    y = FLOOR
    # the two rows of posts that carry the ridge, down the length of the hall
    for sx in (-2.3, 2.3):
        for sz in (HALL[2] + 0.75, HALL[3] - 0.75):
            cyl((sx, y, sz), 0.14, RIDGE_H - 0.5, OAK_LOG, sides=7)
    bx((0, y + RIDGE_H - 0.42, HALL[2] + 0.75), (5.0, 0.18, 0.22), OAK_LOG_DARK)
    bx((0, y + RIDGE_H - 0.42, HALL[3] - 0.75), (5.0, 0.18, 0.22), OAK_LOG_DARK)

    hearth()
    table()
    beds()

    # Beorn's gear along the north wall: a great axe, honey jars, a churn, baskets
    bx((-3.0, y + 0.78, HALL[2] + 0.22), (0.14, 1.55, 0.12), WOOD_DARK)        # the axe's haft
    bx((-3.0, y + 1.5, HALL[2] + 0.3), (0.46, 0.3, 0.1), IRON)
    for k in range(5):
        jx = 1.1 + k * 0.33
        cyl((jx, y, HALL[2] + 0.26), 0.12, 0.3, JAR, sides=8)
        bl((jx, y + 0.31, HALL[2] + 0.26), (0.11, 0.05, 0.11), HONEY, subdiv=0)
    cyl((-1.6, y, HALL[2] + 0.3), 0.2, 0.6, WOOD, sides=9)                     # the churn
    cyl((-1.6, y + 0.6, HALL[2] + 0.3), 0.07, 0.5, WOOD_DARK, sides=6)
    for k, (bx_, r) in enumerate(((0.1, 0.26), (0.62, 0.22))):                 # baskets of bread
        cyl((bx_, y, HALL[2] + 0.3), r, 0.2, STRAW_DARK, sides=9)
        bl((bx_, y + 0.22, HALL[2] + 0.3), (r * 0.9, 0.09, r * 0.9), BREAD, subdiv=0)


def hearth():
    """The fire in the middle of the floor, under the smoke-hole: the only light in the tile."""
    hx, hz = HEARTH
    y = FLOOR
    for k in range(10):                                    # a ring of flat stones set in the boards
        a = 6.283 * k / 10 + 0.15
        bl((hx + math.cos(a) * 0.72, y + 0.05, hz + math.sin(a) * 0.72), (0.2, 0.07, 0.2),
           STONE if k % 3 else STONE_DARK, subdiv=0)
    bl((hx, y + 0.015, hz), (0.66, 0.03, 0.66), SOOT, subdiv=1)
    for k in range(5):                                     # logs laid in a star
        a = 6.283 * k / 5 + 0.4
        add(lp.cone(P(hx + math.cos(a) * 0.52, y + 0.06, hz + math.sin(a) * 0.52),
                    P(hx - math.cos(a) * 0.16, y + 0.3, hz - math.sin(a) * 0.16), 0.085, sides=5),
            WOOD_DARK if k % 2 else SOOT)
    for k in range(7):                                     # flame
        a, d = 6.283 * k / 7 + 0.2, 0.1 + 0.16 * (k % 3)
        h = 0.55 + 0.26 * ((k * 5) % 3)
        add(lp.cone(P(hx + math.cos(a) * d, y + 0.08, hz + math.sin(a) * d),
                    P(hx + math.cos(a) * d * 0.2, y + h, hz + math.sin(a) * d * 0.2), 0.15, sides=4),
            GLOW_FIRE)
    add(lp.cone(P(hx, y + 0.1, hz), P(hx, y + 0.95, hz), 0.12, sides=5), GLOW_FIRE_CORE)
    # the chain and the kettle over it, hung from the ridge beam
    cyl((hx + 0.52, y + 1.15, hz), 0.022, 1.3, IRON, sides=5)
    cyl((hx + 0.52, y + 0.5, hz), 0.17, 0.26, SOOT, sides=9)
    return (hx, y + 0.42, hz)


def table():
    """The long table and its benches, laid for supper: Beorn eats off wood and horn."""
    x0, x1, z0, z1 = TABLE
    y = FLOOR
    top_y = y + 0.52
    bx(((x0 + x1) / 2, top_y, (z0 + z1) / 2), (x1 - x0, 0.09, z1 - z0), PLANK_A)
    for sx in (x0 + 0.4, 0.0, x1 - 0.4):                   # trestles
        bx((sx, y + 0.25, (z0 + z1) / 2), (0.16, 0.5, 0.2), WOOD_DARK)
        bx((sx, y + 0.04, (z0 + z1) / 2), (0.3, 0.08, 0.9), WOOD_DARK)
    for bz in BENCH_Z:                                     # a bench down each side
        bx(((x0 + x1) / 2, y + 0.26, bz), (x1 - x0 - 0.3, 0.08, 0.34), PLANK_B)
        for sx in (x0 + 0.5, x1 - 0.5):
            bx((sx, y + 0.11, bz), (0.12, 0.3, 0.3), WOOD_DARK)
    # Beorn's own seat at the head: a block of oak, taller than the benches
    bx((x1 + 0.52, y + 0.3, (z0 + z1) / 2), (0.5, 0.6, 0.6), OAK_LOG)
    bx((x1 + 0.52, y + 0.95, (z0 + z1) / 2 - 0.26), (0.5, 0.7, 0.12), OAK_LOG_DARK)
    # what is on the board: cream, honey, bread, cheese and a great deal of mead
    rnd = lp.seeded(3)
    for k in range(9):
        cx = x0 + 0.42 + k * (x1 - x0 - 0.8) / 8
        cz = (z0 + z1) / 2 + (0.16 if k % 2 else -0.16)
        cyl((cx, top_y + 0.05, cz), 0.075, 0.13, HORN, sides=7)        # the cups
        bl((cx, top_y + 0.185, cz), (0.07, 0.02, 0.07), MEAD if k % 3 else MILK, subdiv=0)
    for k, (dx, mat, r) in enumerate(((-1.7, BREAD, 0.2), (-0.7, CHEESE, 0.17), (0.5, HAM, 0.19),
                                      (1.6, BREAD, 0.18))):
        cx = (x0 + x1) / 2 + dx
        cyl((cx, top_y + 0.05, (z0 + z1) / 2), r + 0.05, 0.035, PLANK_B, sides=9)
        bl((cx, top_y + 0.13, (z0 + z1) / 2), (r, 0.09, r * 0.8), mat, subdiv=0)
    for k in range(2):                                                  # jugs of mead
        cx = (x0 + x1) / 2 + (-1.15 if k else 1.1)
        cyl((cx, top_y + 0.05, (z0 + z1) / 2 + 0.02), 0.11, 0.26, POT, sides=8)
        bx((cx + 0.13, top_y + 0.2, (z0 + z1) / 2 + 0.02), (0.06, 0.12, 0.05), POT)
    bl(((x0 + x1) / 2 + 0.05, top_y + 0.1, (z0 + z1) / 2 - 0.02), (0.22, 0.06, 0.16), HONEY, subdiv=0)
    del rnd


def beds():
    """Straw mattresses and blankets along the west end: where fifteen guests sleep."""
    x0, x1, z0, z1 = BEDS
    y = FLOOR
    n = 4
    for k in range(n):
        cz = z0 + (z1 - z0) * (k + 0.5) / n
        bl(((x0 + x1) / 2, y + 0.1, cz), ((x1 - x0) / 2 - 0.05, 0.1, (z1 - z0) / n / 2 - 0.04),
           STRAW if k % 2 else STRAW_DARK, subdiv=0)
        bl(((x0 + x1) / 2 + 0.25, y + 0.19, cz), ((x1 - x0) / 2 - 0.3, 0.05, (z1 - z0) / n / 2 - 0.06),
           RUG if k % 2 else CLOTH, subdiv=0)


def wings():
    """The two wings running south from the hall: Beorn's stores, stalls and bee-shed."""
    for i, (x0, x1) in enumerate(WINGS):
        z0, z1 = WING_Z
        # three walls each: the court side is left open, so the court reads as a court
        log_wall(x0, x1, z1, z1, WALL_H - 0.18)                      # the south end
        outer = x0 if i == 0 else x1
        inner = x1 if i == 0 else x0
        log_wall(outer, outer, z0, z1, WALL_H - 0.18, window=(1.2, 0.6))
        for k in range(3):                                           # posts along the open side
            cz = z0 + (z1 - z0) * (k + 0.5) / 3
            cyl((inner, FLOOR, cz), 0.1, WALL_H - 0.3, OAK_LOG, sides=6)
        into(roof_parts)
        gable_roof(min(x0, x1) - 0.05, max(x0, x1) + 0.05, z0, z1,
                   FLOOR + WALL_H - 0.18, FLOOR + WING_RIDGE, THATCH, THATCH_DARK,
                   over=0.22, axis='z', gable_mat=OAK_LOG_DARK)
        out_of()
        # what is kept under them: hay on the west, hives and honey on the east
        for k in range(3):
            cz = z0 + (z1 - z0) * (k + 0.4) / 3
            cx = (x0 + x1) / 2
            if i == 0:
                bl((cx, FLOOR + 0.26, cz), (0.44, 0.26, 0.34), STRAW if k % 2 else STRAW_DARK, subdiv=0)
            else:
                cyl((cx, FLOOR, cz), 0.2, 0.34, STRAW_DARK, sides=9)
                bl((cx, FLOOR + 0.36, cz), (0.19, 0.07, 0.19), HONEY, subdiv=0)


# --- the holding: hedge, gate, hives, paddock, oaks ----------------------------------------------

def woodpile():
    """Beorn's chopping block and a stack of split logs in the corner of the court."""
    bxx, bzz = COURT[0] + 0.45, COURT[3] - 0.5
    y = base_height(bxx, bzz)
    cyl((bxx, y, bzz), 0.3, 0.52, OAK_LOG, sides=10)
    bl((bxx, y + 0.53, bzz), (0.29, 0.03, 0.29), OAK_CUT, subdiv=0)
    bx((bxx + 0.02, y + 0.72, bzz), (0.07, 0.42, 0.06), WOOD_DARK, rot=0.25)     # the axe left in it
    bx((bxx + 0.06, y + 0.95, bzz), (0.3, 0.16, 0.07), IRON, rot=0.25)
    for row in range(3):
        for k in range(4):
            lx = bxx + 0.75 + k * 0.17
            cyl((lx, y + row * 0.18, bzz + 0.1), 0.085, 0.8, WOOD if (k + row) % 2 else WOOD_DARK,
                sides=6, axis='z')


def thorn_hedge():
    """The high hedge of thorn round the holding, with the gate left out of it."""
    for pts, seed in ((HEDGE_S, 71), (HEDGE_W, 73), (HEDGE_E, 77)):
        rnd = lp.seeded(seed)
        for (ax, az), (bx_, bz) in zip(pts, pts[1:]):
            L = math.dist((ax, az), (bx_, bz))
            n = max(1, round(L / 0.46))
            for k in range(n):
                t = (k + 0.5) / n
                x, z = ax + (bx_ - ax) * t, az + (bz - az) * t
                if math.dist((x, z), GATE) < 0.95:          # the gateway
                    continue
                y = base_height(x, z)
                r = rnd.uniform(0.34, 0.42)
                bl((x, y + r * 1.25, z), (r, r * 1.3, r * 0.85), THORN if k % 4 else LEAF_DARK)
                if k % 3 == 1:                               # dry spines catching the light on top
                    bl((x + 0.06, y + r * 2.3, z), (r * 0.5, r * 0.3, r * 0.4), THORN_DRY, subdiv=0)


def gate():
    """The wide wooden gate, hinged on its west post so the site can swing it open."""
    gx, gz = GATE
    y = base_height(gx, gz)
    for side in (-1, 1):                                     # the two posts
        cyl((gx + side * 0.95, y, gz), 0.13, 1.45, OAK_LOG, sides=7)
        bl((gx + side * 0.95, y + 1.47, gz), (0.17, 0.09, 0.17), OAK_CUT, subdiv=0)
    into(gate_leaf)
    for k in range(5):                                       # five bars
        bx((gx, y + 0.3 + k * 0.24, gz), (1.76, 0.1, 0.09), WOOD if k % 2 else WOOD_DARK)
    bx((gx, y + 0.78, gz - 0.03), (0.12, 1.1, 0.08), WOOD_DARK)           # an upright
    add(lp.cone(P(gx - 0.8, y + 0.26, gz - 0.05), P(gx + 0.8, y + 1.3, gz - 0.05), 0.05, sides=4), WOOD_DARK)
    out_of()


def bee_pastures():
    """Rows of hives as tall as a man, standing in clover, with the bees over them."""
    for k, (x, z) in enumerate(HIVES):
        y = base_height(x, z)
        bx((x, y + 0.08, z), (0.78, 0.16, 0.78), STONE_DARK)             # the stone it stands on
        for c in range(5):                                               # coiled straw, narrowing
            r = 0.36 - c * 0.055
            cyl((x, y + 0.16 + c * 0.3, z), r, 0.3, STRAW if c % 2 else STRAW_DARK, sides=11)
        bl((x, y + 1.68, z), (0.16, 0.14, 0.16), STRAW_DARK, subdiv=0)   # the cap
        bx((x, y + 0.3, z + 0.34), (0.2, 0.07, 0.08), WOOD_DARK)         # the landing board
        for b in range(3):                                               # bees over the entrance
            a = 2.1 * b + k
            bl((x + math.cos(a) * 0.5, y + 0.9 + 0.2 * (b % 2), z + math.sin(a) * 0.5),
               (0.035, 0.03, 0.035), BEE, subdiv=0)
    clover_patch(5.3, 1.1, 1.4, 2.9, 80, 81)


def clover_patch(cx, cz, rx, rz, n, seed):
    """Clover in flower: a low leaf and a white or pink head, which is what the bees are for."""
    rnd = lp.seeded(seed)
    for k in range(n):
        a, d = rnd.uniform(0, 6.28), math.sqrt(rnd.uniform(0, 1))
        x, z = cx + math.cos(a) * rx * d, cz + math.sin(a) * rz * d
        if abs(x) > HALF - 0.2 or abs(z) > HALF - 0.2 or platform_f(x, z) > 0.3:
            continue
        if any(math.dist((x, z), h) < 0.6 for h in HIVES):
            continue
        y = base_height(x, z)
        bl((x, y + 0.05, z), (0.09, 0.045, 0.085), CLOVER_LEAF, subdiv=0)
        if k % 2:
            bl((x + 0.02, y + 0.115, z), (0.035, 0.038, 0.035),
               CLOVER_PINK if k % 3 else CLOVER_WHITE, subdiv=0)


def paddock():
    """A rail fence west of the court, and the ponies Beorn lends and takes back."""
    x0, x1, z0, z1 = PADDOCK
    posts = [(x0, z0), (x1, z0), (x1, z1), (x0, z1), (x0, z0)]
    for (ax, az), (bx_, bz) in zip(posts, posts[1:]):
        L = math.dist((ax, az), (bx_, bz))
        n = max(1, round(L / 1.15))
        for k in range(n + 1):
            t = k / n
            x, z = ax + (bx_ - ax) * t, az + (bz - az) * t
            y = base_height(x, z)
            cyl((x, y - 0.05, z), 0.065, 0.78, WOOD_DARK, sides=6)
        for rail in (0.34, 0.6):
            for k in range(n):
                t0, t1 = k / n, (k + 1) / n
                xa, za = ax + (bx_ - ax) * t0, az + (bz - az) * t0
                xb, zb = ax + (bx_ - ax) * t1, az + (bz - az) * t1
                ya, yb = base_height(xa, za) + rail, base_height(xb, zb) + rail
                add(lp.cone(P(xa, ya, za), P(xb, yb, zb), 0.035, sides=4), WOOD)
    hay_rack(-5.2, 0.3)
    trough(-5.0, 2.2)


def hay_rack(x, z):
    """A rack of hay against the paddock rail: what the ponies are kept on."""
    y = base_height(x, z)
    for side in (-0.55, 0.55):
        cyl((x + side, y, z), 0.07, 0.8, WOOD_DARK, sides=5)
    for k in range(6):                                       # the slanting bars
        bxx = x - 0.5 + k * 0.2
        add(lp.cone(P(bxx, y + 0.28, z - 0.22), P(bxx, y + 0.8, z + 0.14), 0.03, sides=4), WOOD)
    bl((x, y + 0.5, z - 0.02), (0.52, 0.2, 0.2), STRAW, subdiv=0)
    bl((x + 0.1, y + 0.1, z + 0.3), (0.3, 0.07, 0.2), STRAW_DARK, subdiv=0)


def trough(x, z):
    """A hollowed log of water, standing at the paddock rail."""
    y = base_height(x, z)
    cyl((x, y + 0.17, z), 0.17, 1.1, WOOD_DARK, sides=8, axis='x')
    bx((x, y + 0.3, z), (1.0, 0.04, 0.26), WATER)
    for side in (-0.5, 0.5):
        bx((x + side, y + 0.08, z), (0.14, 0.18, 0.3), WOOD_DARK)


def flower_lane():
    """The lane in from the gate, with the beds of flowers Beorn keeps along it."""
    strip(resample(LANE, 0.45), 0.5, STONE_WARM, lift=0.02)
    for side in (-1, 1):
        for k in range(9):
            t = (k + 0.5) / 9
            x, z = at_along(LANE, t)
            a, b = at_along(LANE, max(0.0, t - 0.05)), at_along(LANE, min(1.0, t + 0.05))
            dx, dz = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dz) or 1.0
            px = x - dz / L * 0.78 * side
            pz = z + dx / L * 0.78 * side
            flowers(px, pz, 0.34, 0.34, 7, 300 + k * 2 + (side > 0),
                    ('white', 'yellow', 'blue') if k % 2 else ('pink', 'white', 'red'))


def oaks():
    """The oaks round the holding: thick behind and at the sides, open where the camera looks in."""
    rnd = lp.seeded(13)
    placed = []
    for _ in range(500):
        if len(placed) >= 30:
            break
        x = rnd.uniform(-HALF + 0.6, HALF - 0.6)
        z = rnd.uniform(-HALF + 0.6, HALF - 0.6)
        if platform_f(x, z) > 0.02 or rect_f(PADDOCK, 0.6)(x, z) > 0.05:
            continue
        if polyline_dist(HEDGE_S, x, z)[0] < 1.1 or polyline_dist(HEDGE_W, x, z)[0] < 1.0:
            continue
        if polyline_dist(HEDGE_E, x, z)[0] < 1.0 or lane_d(x, z) < 1.3:
            continue
        if any(math.dist((x, z), h) < 1.6 for h in HIVES):
            continue
        if -6.5 < x < 6.5 and -3.5 < z < 4.3:   # nothing grows inside the thorn hedge
            continue
        if 4.4 < z < 6.1 and abs(x) < 4.2:      # and the near edge stays open, so the court is seen
            continue
        if any(math.dist((x, z), p) < 1.7 for p in placed):
            continue
        placed.append((x, z))
        tree(x, z, size=rnd.uniform(1.1, 1.65), kind='oak' if len(placed) % 4 else 'gold',
             seed=400 + len(placed))
    return placed


def meadow(trees):
    """Clover, long grass and the odd thistle over everything that is not built on or trodden."""
    clover_patch(-3.4, 5.6, 2.8, 1.0, 70, 91)
    clover_patch(2.6, 5.7, 2.2, 0.9, 45, 93)
    tufts(320, 7, lambda x, z: (platform_f(x, z) < 0.25 and lane_d(x, z) > 0.55
                                and not any(math.dist((x, z), p) < 0.6 for p in trees)))


# --- export ---------------------------------------------------------------------------------------

def main():
    out = (Path(ARGS[ARGS.index('--out') + 1]) if '--out' in ARGS
           else ROOT / 'out' / 'models' / 'beorns-house.glb')
    out.parent.mkdir(parents=True, exist_ok=True)

    objs = [terrain(ground_colour), plinth()]
    hall()
    wings()
    woodpile()
    thorn_hedge()
    gate()
    bee_pastures()
    paddock()
    flower_lane()
    trees = oaks()
    meadow(trees)

    fire = (HEARTH[0], FLOOR + 0.42, HEARTH[1])
    decor = lp.finish('beorns-house', kit.parts)
    roof = lp.finish('cover-roof', roof_parts)
    front = lp.finish('cover-front', front_parts)
    leaf = hinge_object('door-gate', gate_leaf, (GATE[0] - 0.95, base_height(*GATE), GATE[1]))
    objs += [decor, roof, front, leaf]
    tris = triangles(objs)

    empties = [
        empty('fx-fire', fire),
        empty('fx-smoke-hall', (HEARTH[0], FLOOR + RIDGE_H + 0.5, HEARTH[1])),
    ]
    empties += [empty(f'fx-fireflies-{k}', at) for k, at in enumerate(
        ((-3.2, FLOOR + 0.8, 3.4), (3.6, FLOOR + 0.8, 2.4)))]
    empties += [empty('fx-lamp-porch', (PORCH[0] + 1.7, FLOOR + 1.4, PORCH[1] + 0.8))]

    print(f'beorns-house: {tris} triangles, {len(kit.parts)} parts, '
          f'{len(roof_parts)} roof parts, {len(front_parts)} front parts, '
          f'{len(empties)} markers')
    blend = Path(ARGS[ARGS.index('--blend') + 1]) if '--blend' in ARGS else None
    if blend:
        bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True)
        print(f'wrote {blend}')
    export(out, objs + empties)
    print(f'wrote {out}')


if __name__ == '__main__':
    main()
