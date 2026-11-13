"""The shared dwarf rig and its clips (#21), run inside Blender.

Thorin and the twelve, and later Dáin, Thrór, Thráin, Frerin and Náin: the hobbit's bones at a
dwarf's build (short and broad, thick-limbed, big hands), plus two for the beard, whose swing
is baked into the clips. Gaits are a dwarf's: a short, heavy, rolling stride.

Angle conventions are the hobbit rig's (hobbit_rig.py): degrees about the armature's axes,
Z up, the figure facing -Y.
"""

import math

from mathutils import Vector

import hobbit_rig as base


def joints_for(height=1.35, width=1.0):
    """Joint positions for a dwarf `height` metres to the top of the head; `width` broadens him."""
    k = height / 1.35
    j = {
        'hips': (0, 0, 0.62), 'spine': (0, 0, 0.75), 'chest': (0, 0.005, 0.91), 'neck': (0, 0.015, 1.08),
        'head': (0, 0.01, 1.12), 'head_top': (0, 0.0, 1.35),
        'shoulder.L': (0.2, 0.015, 1.04), 'elbow.L': (0.235, 0.025, 0.84), 'wrist.L': (0.25, 0.005, 0.655),
        'hand_tip.L': (0.255, -0.005, 0.57),
        'hip.L': (0.1, 0, 0.62), 'knee.L': (0.105, -0.01, 0.35), 'ankle.L': (0.105, 0.01, 0.085),
        'toe.L': (0.11, -0.17, 0.025),
        'beard': (0, -0.11, 1.11), 'beard_mid': (0, -0.165, 0.92), 'beard_tip': (0, -0.16, 0.70),
    }
    for name in [n for n in j if n.endswith('.L')]:
        x, y, z = j[name]
        j[name[:-2] + '.R'] = (-x, y, z)
    out = {}
    for n, (x, y, z) in j.items():
        out[n] = Vector((x * width, y, z)) * k
    return out


BONES = dict(base.BONES)
BONES.update({
    'beard': ('beard', 'beard_mid', 'head'),
    'beard_low': ('beard_mid', 'beard_tip', 'beard'),
})


def _beard(pose, p, back=0.0, sway=0.0, phase=0.0):
    s = math.sin(base._tau(p) + phase)
    pose['beard'] = (back + sway * s, 0, sway * 0.4 * s)
    pose['beard_low'] = (back * 0.5 + sway * 1.3 * math.sin(base._tau(p) + phase - 0.8), 0, 0)
    return pose


def pose_idle(p, j):
    """Standing square, thumbs in his belt, breathing; a dwarf waiting with patience, not much."""
    s = math.sin(base._tau(p))
    pose = {
        'spine': (-1, 0, 0), 'chest': (1.2 * s, 0, 0),
        'neck': (0, 0, 0), 'head': (-2 + 1.5 * math.sin(base._tau(p) + 1), 0, 5 * math.sin(base._tau(p))),
        'hips_loc': (0, 0, -0.002 * s),
    }
    base._leg(pose, 'L', 0, 0, spread=-4)
    base._leg(pose, 'R', 0, 0, spread=4)
    base._arm(pose, 'L', 8, 38, out=14, twist=-30, wrist=-10)
    base._arm(pose, 'R', 8, 38, out=14, twist=30, wrist=-10)
    return _beard(pose, p, sway=0.6)


def pose_walk(p, j):
    """A short, heavy stride with a roll of the shoulders."""
    pose = base._gait(p, j, amp=22, knee_swing=30, knee_stance=5, lean=4, arm_amp=16, elbow=20, bob=0.0)
    s = math.sin(base._tau(p))
    pose['spine'] = (4, 3 * s, -5 * s)
    return _beard(pose, p, back=3, sway=2.5, phase=0.4)


def pose_run(p, j):
    pose = base._gait(p, j, amp=34, knee_swing=70, knee_stance=14, lean=12, arm_amp=30, elbow=75,
                      bob=0.025, flight=0.012)
    return _beard(pose, p, back=14, sway=4, phase=0.4)


def pose_talk(p, j):
    pose = base.pose_talk(p, j)
    return _beard(pose, p, sway=2, phase=0.5)


def pose_hide(p, j):
    pose = base.pose_hide(p, j)
    return _beard(pose, p, back=-18, sway=0.5)


def pose_fight(p, j):
    """Feet planted, a heavy overhand blow with the right arm, and back."""
    blow = max(0.0, math.sin(base._tau(p))) ** 2
    raised = 1 - blow
    pose = {
        'hips_loc': (0, 0.01, -0.03 - 0.015 * blow),
        'hips': (0, 0, 14 - 8 * blow),
        'spine': (2 + 14 * blow, 0, -6 - 8 * blow), 'chest': (0 + 6 * blow, 0, -8 - 8 * blow),
        'neck': (-4, 0, 6 + 6 * blow), 'head': (-6 + 4 * blow, 0, 6 + 4 * blow),
    }
    base._leg(pose, 'L', -24, 30, spread=-8)
    base._leg(pose, 'R', 18, 18, spread=8)
    base._arm(pose, 'R', 40 + 100 * raised, 40 * raised + 10, out=12, twist=0, wrist=10 * blow)
    base._arm(pose, 'L', 30 + 10 * raised, 70, out=18, twist=-14)
    return _beard(pose, p, back=8 * blow, sway=2)


def clips(height, joints):
    return {
        'idle': (2.6, pose_idle),
        'walk': (base.gait_seconds(height, base.WALK_PACE, 22, joints), pose_walk),
        'run': (base.gait_seconds(height, base.RUN_PACE, 34, joints) * 1.08, pose_run),
        'talk': (2.0, pose_talk),
        'hide': (2.0, pose_hide),
        'fight': (1.2, pose_fight),
    }
