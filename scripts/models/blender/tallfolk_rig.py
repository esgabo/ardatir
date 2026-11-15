"""The shared tall-folk rig and its clips (#21), run inside Blender.

The elf-and-man body type: Elrond, the Elvenking and the wood-elves, Bard, the Master and the
Lake-town folk, and Beorn in his man shape (scaled up). The hobbit's sixteen bones at a tall
figure's proportions, plus four that carry what hangs: a cloak (two, down the back) and long
hair (two). Their swing is baked into the clips, no cloth physics. A character with short hair
or no cloak simply weighs no vertices on those bones.

What makes this body type its own: long legs and an upright carriage. Where a hobbit bustles
and a wizard leans on his staff, these walk from the hips with a level head and little arm
swing, and keep still when they stand. The fighting clip is a sword stroke, not a jab.

Angle conventions are the hobbit rig's (hobbit_rig.py): degrees about the armature's axes,
Z up, the figure facing -Y.
"""

import math

from mathutils import Vector

import hobbit_rig as base


def joints_for(height=1.85):
    """Joint positions for a tall figure `height` metres to the top of the head.

    Proportions are a touch longer in the leg than a man's average (the legs are 49% of the
    height): it reads as grace at this scale, and the same skeleton serves the Men of
    Lake-town without looking wrong.
    """
    k = height / 1.85
    j = {
        'hips': (0, 0, 1.00), 'spine': (0, 0, 1.16), 'chest': (0, 0.004, 1.34),
        'neck': (0, 0.012, 1.56), 'head': (0, 0.008, 1.62), 'head_top': (0, 0, 1.85),
        'shoulder.L': (0.205, 0.012, 1.52), 'elbow.L': (0.235, 0.022, 1.22),
        'wrist.L': (0.25, 0.006, 0.95), 'hand_tip.L': (0.255, -0.004, 0.855),
        'hip.L': (0.095, 0, 0.99), 'knee.L': (0.095, -0.012, 0.535), 'ankle.L': (0.095, 0.012, 0.085),
        'toe.L': (0.10, -0.195, 0.026),
        # the cloak hangs from between the shoulders; the hair from the back of the head
        'cloak': (0, 0.10, 1.50), 'cloak_mid': (0, 0.14, 0.90), 'cloak_hem': (0, 0.17, 0.14),
        'hair': (0, 0.072, 1.62), 'hair_mid': (0, 0.10, 1.44), 'hair_tip': (0, 0.105, 1.24),
    }
    for name in [n for n in j if n.endswith('.L')]:
        x, y, z = j[name]
        j[name[:-2] + '.R'] = (-x, y, z)
    return {n: Vector(p) * k for n, p in j.items()}


BONES = dict(base.BONES)
BONES.update({
    'cloak': ('cloak', 'cloak_mid', 'chest'),
    'cloak_low': ('cloak_mid', 'cloak_hem', 'cloak'),
    'hair': ('hair', 'hair_mid', 'head'),
    'hair_low': ('hair_mid', 'hair_tip', 'hair'),
})


def _hangs(pose, p, cloak_back=0.0, cloak_sway=0.0, hair_back=0.0, hair_sway=0.0,
           phase=0.0, flaps=1, plumb=0.6):
    """The cloak and hair: lean back (billow), sway a little, and lag the body.

    `plumb` is how much of the body's forward lean the cloak undoes so it falls straight down
    (the hair follows the head instead, so it only needs the neck's share).
    """
    lean = sum(pose.get(b, (0, 0, 0))[0] for b in ('hips', 'spine', 'chest'))
    s = math.sin(base._tau(flaps * p) + phase)
    pose['cloak'] = (cloak_back - lean * plumb + cloak_sway * s, 0, 0)
    pose['cloak_low'] = (cloak_back * 0.55 + cloak_sway * 1.4 * math.sin(base._tau(flaps * p) + phase - 0.6), 0, 0)
    head_lean = lean + sum(pose.get(b, (0, 0, 0))[0] for b in ('neck', 'head'))
    pose['hair'] = (hair_back - head_lean * 0.35 + hair_sway * s, 0, hair_sway * 0.6 * s)
    pose['hair_low'] = (hair_back * 0.6 + hair_sway * 1.3 * math.sin(base._tau(flaps * p) + phase - 0.8), 0, 0)
    return pose


def pose_idle(p, j):
    """Standing straight and still: the weight even, hands loose at the sides, a slow breath.

    Deliberately quieter than the hobbit's idle. The stillness is the characterisation.
    """
    s = math.sin(base._tau(p))
    pose = {
        'spine': (-1 + 0.5 * s, 0, 0), 'chest': (0.8 * s, 0, 0),
        'neck': (-1, 0, 0), 'head': (1 + 1.0 * math.sin(base._tau(p) + 1.1), 0, 2.5 * math.sin(base._tau(p))),
        'hips_loc': (0, 0, -0.0015 * s),
    }
    base._leg(pose, 'L', 0, 1, spread=-1.5)
    base._leg(pose, 'R', 0, 1, spread=1.5)
    base._arm(pose, 'L', 2 + 0.6 * s, 10, out=3.5, twist=-8)
    base._arm(pose, 'R', 2 + 0.6 * s, 10, out=3.5, twist=8)
    return _hangs(pose, p, cloak_sway=0.6, hair_sway=0.5)


def pose_walk(p, j):
    """A long, level stride from the hips: little bob, little arm swing, the head steady."""
    pose = base._gait(p, j, amp=19, knee_swing=26, knee_stance=3, lean=2, arm_amp=9, elbow=11, bob=0.0)
    s = math.sin(base._tau(p))
    pose['head'] = (0, 0, 1.5 * s)          # overrides the gait's nod: the head stays level
    pose['chest'] = (0, 0, -3 * s)
    return _hangs(pose, p, cloak_back=6, cloak_sway=2.4, hair_back=3, hair_sway=1.6,
                  phase=0.4, flaps=2)


def pose_run(p, j):
    """A long loping run, cloak and hair streaming behind."""
    pose = base._gait(p, j, amp=33, knee_swing=68, knee_stance=10, lean=11, arm_amp=24, elbow=68,
                      bob=0.026, flight=0.016)
    pose['head'] = (-5, 0, 2 * math.sin(base._tau(p)))
    return _hangs(pose, p, cloak_back=24, cloak_sway=6, hair_back=16, hair_sway=4,
                  phase=0.4, flaps=2, plumb=0.3)


def pose_talk(p, j):
    """Measured speech: one hand opens outward and settles, the head inclines slowly."""
    s = math.sin(base._tau(p))
    s2 = math.sin(base._tau(2 * p) + 0.5)
    pose = {
        'spine': (-1, 0, 2.5 * s), 'chest': (0, 0, 3 * s),
        'neck': (1 * s2, 0, 0), 'head': (2 + 2.5 * s2, 1.5 * s, 5 * s),
    }
    base._leg(pose, 'L', 2, 4, spread=-2.5)
    base._leg(pose, 'R', 0, 1, spread=2.5)
    # a small gesture, kept close: a wide one swings the sleeve out past a shoulder cape
    base._arm(pose, 'L', 16 + 9 * s2, 42 + 12 * s, out=8 + 4 * s, twist=-18 * s, wrist=-12 + 10 * s2)
    base._arm(pose, 'R', 3, 12, out=4, twist=8)
    return _hangs(pose, p, cloak_sway=1.0, hair_sway=1.4, phase=0.5)


def pose_hide(p, j):
    """Not a crouch but a watchfulness: drawn back behind cover, stooped, listening.

    The knees bend only a little. Most of these folk wear something floor-length, and a skirt
    weighted to the thighs swings out with them: fold deeply and the robe lies on the ground in
    front of the figure like a plank. The stoop does the hiding instead.
    """
    s = math.sin(base._tau(2 * p))
    thigh, knee = 26, 48
    drop, shift = base._crouch_hips(j, thigh, knee)
    pose = {
        'hips_loc': (0, shift, -drop + 0.0025 * s),
        'hips': (8, 0, 0),
        'spine': (28, 0, 0), 'chest': (14 + s, 0, 0),
        'neck': (-16, 0, 0), 'head': (-22, 0, 5 * math.sin(base._tau(p))),
    }
    base._leg(pose, 'L', -thigh - 8, knee, toe=-8, spread=-5)
    base._leg(pose, 'R', -thigh - 8, knee, toe=-8, spread=5)
    base._arm(pose, 'L', 32, 58, out=7, twist=-12, wrist=8)
    base._arm(pose, 'R', 28, 54, out=7, twist=12, wrist=8)
    return _hangs(pose, p, cloak_back=-18, cloak_sway=0.4, hair_back=-12, plumb=0.0)


def pose_fight(p, j):
    """A sword stroke: drawn back over the shoulder, swept down across the body, recovered.

    The right hand leads; both hands stay on the hilt through the stroke, so a character with a
    sword can weigh it on `hand.R` and it will travel the whole arc.
    """
    stroke = max(0.0, math.sin(base._tau(p))) ** 2   # 0 drawn back, 1 at the end of the cut
    ready = 1 - stroke
    pose = {
        'hips_loc': (0, 0.012, -0.03 - 0.015 * stroke),
        'hips': (0, 0, 16 - 20 * stroke),
        'spine': (2 + 10 * stroke, 0, -10 + 14 * stroke),
        'chest': (0 + 4 * stroke, 0, -12 + 16 * stroke),
        'neck': (-2, 0, 6 - 6 * stroke), 'head': (-4 + 4 * stroke, 0, 7 - 8 * stroke),
    }
    base._leg(pose, 'L', -22, 28, spread=-5)
    base._leg(pose, 'R', 16, 16, spread=5)
    # the sword arm: up and back at the ready, down and across at the end of the cut
    base._arm(pose, 'R', 110 * ready - 10 * stroke, 55 * ready + 8 * stroke,
              out=28 * ready + 6, twist=-15 * ready, wrist=-30 * ready + 20 * stroke)
    base._arm(pose, 'L', 70 * ready + 10 * stroke, 70 * ready + 40 * stroke,
              out=18 * ready + 10, twist=-20)
    return _hangs(pose, p, cloak_back=4 + 8 * stroke, cloak_sway=1.5, hair_back=5 * stroke, hair_sway=2)


def clips(height, joints):
    """Clip name -> (seconds, pose function)."""
    return {
        'idle': (3.6, pose_idle),         # long and slow: these folk are still
        'walk': (base.gait_seconds(height, base.WALK_PACE, 19, joints), pose_walk),
        'run': (base.gait_seconds(height, base.RUN_PACE, 33, joints) * 1.06, pose_run),
        'talk': (2.6, pose_talk),
        'hide': (2.2, pose_hide),
        'fight': (1.3, pose_fight),
    }
