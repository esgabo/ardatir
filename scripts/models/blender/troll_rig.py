"""The shared troll rig and its clips (#21), run inside Blender.

Bert, Tom and William: the hobbit's bones at a troll's build: huge, hunched, the head thrust
forward, arms hanging to the knee. Their clips are slow and heavy: a lumbering walk, a
quarrelsome talk with big swings of the arms, a two-handed grab for `fight`.

Angle conventions are the hobbit rig's (hobbit_rig.py): degrees about the armature's axes,
Z up, the figure facing -Y.
"""

import math

from mathutils import Vector

import hobbit_rig as base


def joints_for(height=2.8):
    """Joint positions for a troll `height` metres tall (to the top of his hunched head)."""
    k = height / 2.8
    j = {
        'hips': (0, 0.02, 1.12), 'spine': (0, 0.05, 1.45), 'chest': (0, 0.06, 1.85), 'neck': (0, -0.12, 2.28),
        'head': (0, -0.2, 2.36), 'head_top': (0, -0.24, 2.78),
        'shoulder.L': (0.5, 0.02, 2.12), 'elbow.L': (0.6, 0.02, 1.58), 'wrist.L': (0.64, -0.06, 1.06),
        'hand_tip.L': (0.65, -0.1, 0.78),
        'hip.L': (0.26, 0.02, 1.1), 'knee.L': (0.29, -0.06, 0.6), 'ankle.L': (0.3, 0.02, 0.13),
        'toe.L': (0.32, -0.42, 0.04),
    }
    for name in [n for n in j if n.endswith('.L')]:
        x, y, z = j[name]
        j[name[:-2] + '.R'] = (-x, y, z)
    return {n: Vector(p) * k for n, p in j.items()}


BONES = base.BONES


def pose_idle(p, j):
    """Slumped, heavy breathing, arms swinging a little, the head turning to look about."""
    s = math.sin(base._tau(p))
    pose = {
        'spine': (2 + 1.5 * s, 0, 0), 'chest': (2.5 * s, 0, 0),
        'neck': (0, 0, 0), 'head': (-3 + 2 * math.sin(base._tau(p) + 1), 0, 10 * math.sin(base._tau(p))),
        'hips_loc': (0, 0, -0.01 * s),
    }
    base._leg(pose, 'L', 0, 6, spread=-4)
    base._leg(pose, 'R', 0, 6, spread=4)
    base._arm(pose, 'L', 6 + 3 * s, 16, out=6)
    base._arm(pose, 'R', 6 - 3 * s, 16, out=6)
    return pose


def pose_walk(p, j):
    """A lumbering, rolling stride, the body swaying side to side."""
    pose = base._gait(p, j, amp=19, knee_swing=26, knee_stance=8, lean=8, arm_amp=14, elbow=18, bob=0.0)
    s = math.sin(base._tau(p))
    pose['hips'] = (0, 4 * s, 7 * s)
    pose['spine'] = (8, -3 * s, -5 * s)
    pose['head'] = (-6, 0, 4 * s)
    return pose


def pose_run(p, j):
    pose = base._gait(p, j, amp=30, knee_swing=60, knee_stance=16, lean=18, arm_amp=26, elbow=40,
                      bob=0.05, flight=0.02)
    s = math.sin(base._tau(p))
    pose['hips'] = (0, 5 * s, 8 * s)
    return pose


def pose_talk(p, j):
    """Arguing: a big swing of one arm, a jab of the head, the other fist on the hip."""
    s = math.sin(base._tau(p))
    s2 = math.sin(base._tau(2 * p) + 0.5)
    pose = {
        'spine': (4, 0, 6 * s), 'chest': (2, 0, 6 * s),
        'neck': (4 * s2, 0, 0), 'head': (-4 + 6 * s2, 3 * s, 8 * s),
    }
    base._leg(pose, 'L', -4, 8, spread=-5)
    base._leg(pose, 'R', 6, 10, spread=5)
    base._arm(pose, 'R', 30 + 25 * max(0.0, s), 50 + 20 * s2, out=20 + 10 * s, twist=-20 * s, wrist=-10)
    base._arm(pose, 'L', -6, 70, out=36, twist=-50, wrist=20)
    return pose


def pose_hide(p, j):
    """Squatting low (as low as a troll gets), peering."""
    pose = base.pose_hide(p, j)
    base._arm(pose, 'L', 20, 40, out=16)
    base._arm(pose, 'R', 20, 40, out=16)
    return pose


def pose_fight(p, j):
    """A two-handed grab: arms out and up, then sweeping in together, and back."""
    grab = max(0.0, math.sin(base._tau(p))) ** 2
    reach = 1 - grab
    pose = {
        'hips_loc': (0, 0.02, -0.06 - 0.04 * grab),
        'spine': (10 + 16 * grab, 0, 0), 'chest': (4 + 8 * grab, 0, 0),
        'neck': (-6, 0, 0), 'head': (-10 + 6 * grab, 0, 0),
    }
    base._leg(pose, 'L', -18, 26, spread=-8)
    base._leg(pose, 'R', 12, 18, spread=8)
    for side, sgn in (('L', -1), ('R', 1)):
        base._arm(pose, side, 50 + 30 * reach, 30 + 30 * grab, out=45 * reach + 8, twist=sgn * 30 * grab)
    return pose


def clips(height, joints):
    return {
        'idle': (3.2, pose_idle),
        'walk': (base.gait_seconds(height, base.WALK_PACE, 19, joints), pose_walk),
        'run': (base.gait_seconds(height, base.RUN_PACE, 30, joints) * 1.08, pose_run),
        'talk': (2.6, pose_talk),
        'hide': (2.4, pose_hide),
        'fight': (1.6, pose_fight),
    }


# Caught by the dawn, turned to stone mid-quarrel: one pose each, held (a two-frame `idle`).
def stone_pose(kind):
    def pose(p, j):
        out = {}
        if kind == 'reach':        # William: bending forward, both hands out for a dwarf
            out = {'hips_loc': (0, 0.02, -0.05), 'spine': (18, 0, 0), 'chest': (8, 0, 0), 'head': (-14, 0, 0)}
            base._leg(out, 'L', -16, 22, spread=-6)
            base._leg(out, 'R', 10, 14, spread=6)
            base._arm(out, 'L', 62, 30, out=14, twist=20)
            base._arm(out, 'R', 62, 30, out=14, twist=-20)
        elif kind == 'shout':      # Bert: turned to shout at the others, a fist raised
            out = {'spine': (4, 0, 18), 'chest': (0, 0, 10), 'neck': (-6, 0, 10), 'head': (-12, 4, 12)}
            base._leg(out, 'L', -6, 8, spread=-6)
            base._leg(out, 'R', 6, 8, spread=6)
            base._arm(out, 'R', 100, 70, out=20, twist=-10)
            base._arm(out, 'L', -4, 70, out=36, twist=-50, wrist=20)
        else:                      # Tom: squatting, a stick in the fire, looking up at the light
            drop, shift = base._crouch_hips(j, 50, 90)
            out = {'hips_loc': (0, shift, -drop), 'spine': (14, 0, -6), 'chest': (4, 0, 0), 'neck': (-14, 0, 0),
                   'head': (-24, 0, -10)}
            base._leg(out, 'L', -50, 90, spread=-12)
            base._leg(out, 'R', -50, 90, spread=12)
            base._arm(out, 'R', 50, 30, out=10)
            base._arm(out, 'L', 34, 70, out=20, twist=-20)
        return out
    return pose


def stone_clips(kind):
    return {'idle': (2 / base.FPS, stone_pose(kind))}
