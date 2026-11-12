"""The shared wizard rig and its clips (#21), run inside Blender.

The tall, robed body type (Gandalf; later Saruman and Radagast). The hobbit's sixteen bones
at a man's proportions, plus four that carry what hangs: the cloak (two, down the back) and
the beard (two). Their swing is baked into the clips, no cloth physics. The right hand holds
a staff: in the rest pose that forearm is already bent forward, so the staff stands upright
on the ground in front of the right foot, and every clip's arm angles are relative to that.

Angle conventions are the hobbit rig's (hobbit_rig.py): degrees about the armature's axes,
Z up, the figure facing -Y.
"""

import math

from mathutils import Vector

import hobbit_rig as base


def joints_for(height=1.75):
    """Joint positions for a wizard `height` metres tall to the top of the head (no hat)."""
    k = height / 1.75
    j = {
        'hips': (0, 0, 0.96), 'spine': (0, 0, 1.10), 'chest': (0, 0.005, 1.27), 'neck': (0, 0.02, 1.47),
        'head': (0, 0.015, 1.53), 'head_top': (0, 0.0, 1.75),
        'shoulder.L': (0.185, 0.02, 1.43), 'elbow.L': (0.215, 0.03, 1.16), 'wrist.L': (0.23, 0.01, 0.92),
        'hand_tip.L': (0.235, 0.0, 0.83),
        'hip.L': (0.09, 0, 0.95), 'knee.L': (0.09, -0.01, 0.51), 'ankle.L': (0.09, 0.01, 0.085),
        'toe.L': (0.095, -0.18, 0.025),
        # the cloak hangs from the shoulders down the back; the beard from the chin
        'cloak': (0, 0.13, 1.40), 'cloak_mid': (0, 0.17, 0.85), 'cloak_hem': (0, 0.21, 0.12),
        'beard': (0, -0.12, 1.47), 'beard_mid': (0, -0.155, 1.22), 'beard_tip': (0, -0.15, 0.93),
    }
    for name in [n for n in j if n.endswith('.L')]:
        x, y, z = j[name]
        j[name[:-2] + '.R'] = (-x, y, z)
    # the staff hand: forearm bent forward, the hand just above the belt
    j['elbow.R'] = (-0.22, 0.03, 1.17)
    j['wrist.R'] = (-0.25, -0.19, 1.05)
    j['hand_tip.R'] = (-0.255, -0.27, 1.03)
    return {n: Vector(p) * k for n, p in j.items()}


BONES = dict(base.BONES)
BONES.update({
    'cloak': ('cloak', 'cloak_mid', 'chest'),
    'cloak_low': ('cloak_mid', 'cloak_hem', 'cloak'),
    'beard': ('beard', 'beard_mid', 'head'),
    'beard_low': ('beard_mid', 'beard_tip', 'beard'),
})


def staff_point(j):
    """Where the staff passes through the right hand (x, y): it stands upright there."""
    w, t = j['wrist.R'], j['hand_tip.R']
    c = w + (t - w) * 0.5
    return Vector((c.x, c.y, 0))


def _staff_arm(pose, swing, elbow, tilt=0.0, out=0.0):
    """The staff arm: the hand turns so the staff leans `tilt` degrees forward, whatever the arm does."""
    base._arm(pose, 'R', swing, elbow, out=out, wrist=-(swing + elbow) - tilt)


def _hangs(pose, p, cloak_back=0.0, cloak_sway=0.0, beard_back=0.0, beard_sway=0.0, phase=0.0):
    """The cloak and beard: lean back (billow) and a small swing that lags the body."""
    s = math.sin(base._tau(p) + phase)
    pose['cloak'] = (cloak_back + cloak_sway * s, 0, 0)
    pose['cloak_low'] = (cloak_back * 0.6 + cloak_sway * 1.4 * math.sin(base._tau(p) + phase - 0.7), 0, 0)
    pose['beard'] = (beard_back + beard_sway * s, 0, beard_sway * 0.5 * s)
    pose['beard_low'] = (beard_sway * 1.2 * math.sin(base._tau(p) + phase - 0.8), 0, 0)
    return pose


def pose_idle(p, j):
    """Standing tall on his staff, a slight stoop, breathing slowly."""
    s = math.sin(base._tau(p))
    pose = {
        'spine': (3, 0, 0), 'chest': (2 + 1.0 * s, 0, 0),
        'neck': (4, 0, 0), 'head': (-4 + 1.5 * math.sin(base._tau(p) + 1), 0, 5 * math.sin(base._tau(p))),
        'hips_loc': (0, 0, -0.002 * s),
    }
    base._leg(pose, 'L', 0, 0, spread=-2)
    base._leg(pose, 'R', 0, 0, spread=2)
    base._arm(pose, 'L', 4 + s, 12, out=5, twist=-6)
    base._arm(pose, 'R', 0, 0)
    return _hangs(pose, p, cloak_sway=0.8, beard_sway=0.6)


def pose_walk(p, j):
    """An old traveller's long stride, the staff swinging forward with each step."""
    pose = base._gait(p, j, amp=22, knee_swing=30, knee_stance=4, lean=6, arm_amp=12, elbow=16, bob=0.0)
    s = math.sin(base._tau(p))
    # the staff arm swings with the left leg, staff tip forward when it plants
    _staff_arm(pose, 6 * s, 4 * max(0.0, s), tilt=3 * s, out=2)
    pose['head'] = (-5, 0, 2 * s)
    c2 = math.sin(base._tau(2 * p))
    pose = _hangs(pose, p, cloak_back=7, cloak_sway=3, beard_back=4, beard_sway=2, phase=0.4)
    pose['cloak_low'] = (6 + 4 * c2, 0, 0)  # flaps twice a cycle, once per step
    return pose


def pose_run(p, j):
    """Hurrying, robes flying, the staff held forward."""
    pose = base._gait(p, j, amp=34, knee_swing=70, knee_stance=12, lean=14, arm_amp=26, elbow=70,
                      bob=0.03, flight=0.015)
    s = math.sin(base._tau(p))
    _staff_arm(pose, 14 + 6 * s, 10, tilt=22, out=3)
    c2 = math.sin(base._tau(2 * p))
    pose = _hangs(pose, p, cloak_back=22, cloak_sway=6, beard_back=14, beard_sway=4, phase=0.4)
    pose['cloak_low'] = (16 + 8 * c2, 0, 0)
    return pose


def pose_talk(p, j):
    """Holding forth: the free hand gestures, the head nods, leaning on the staff."""
    s = math.sin(base._tau(p))
    s2 = math.sin(base._tau(2 * p) + 0.6)
    pose = {
        'spine': (3, 0, 3 * s), 'chest': (1, 0, 4 * s),
        'neck': (3 + 2 * s2, 0, 0), 'head': (-2 + 4 * s2, 2 * s, 7 * s),
    }
    base._leg(pose, 'L', 4, 6, spread=-3)
    base._leg(pose, 'R', 0, 0, spread=3)
    base._arm(pose, 'L', 30 + 14 * s2, 60 + 20 * s, out=14 + 6 * s, twist=-25 * s, wrist=-20 + 15 * s2)
    base._arm(pose, 'R', 2, 0)
    return _hangs(pose, p, cloak_sway=1.2, beard_sway=2.5, phase=0.5)


def pose_hide(p, j):
    """Stooped behind something, peering ahead: knees only a little bent, so the robe hangs."""
    s = math.sin(base._tau(2 * p))
    thigh, knee = 24, 44
    drop, shift = base._crouch_hips(j, thigh, knee)
    pose = {
        'hips_loc': (0, shift, -drop + 0.003 * s),
        'hips': (8, 0, 0),
        'spine': (26, 0, 0), 'chest': (12 + s, 0, 0),
        'neck': (-14, 0, 0), 'head': (-20, 0, 5 * math.sin(base._tau(p))),
    }
    base._leg(pose, 'L', -thigh - 8, knee, toe=-8, spread=-5)
    base._leg(pose, 'R', -thigh - 8, knee, toe=-8, spread=5)
    base._arm(pose, 'L', 34, 50, out=8, twist=-10)
    _staff_arm(pose, 10, 10, tilt=-40, out=4)  # upright, against the 46-degree stoop
    return _hangs(pose, p, cloak_back=-18, cloak_sway=0.5, beard_back=-22)


def pose_fight(p, j):
    """The staff raised high, then brought down before him, and up again."""
    strike = max(0.0, math.sin(base._tau(p))) ** 2
    raised = 1 - strike
    pose = {
        'hips_loc': (0, 0.01, -0.03 - 0.02 * strike),
        'hips': (0, 0, 10),
        'spine': (-4 + 14 * strike, 0, -6), 'chest': (-2 + 6 * strike, 0, -6),
        'neck': (0, 0, 4), 'head': (-6 + 6 * strike, 0, 4),
    }
    base._leg(pose, 'L', -18, 22, spread=-6)
    base._leg(pose, 'R', 16, 14, spread=6)
    # staff arm: up overhead, then down and forward
    _staff_arm(pose, 40 + 85 * raised, 10 * strike, tilt=8 * raised + 55 * strike, out=10)
    base._arm(pose, 'L', 40 + 30 * raised, 30, out=30 * raised + 10, twist=-20)
    return _hangs(pose, p, cloak_back=3 + 5 * strike, cloak_sway=1.5, beard_back=6 * strike, beard_sway=2)


def clips(height, joints):
    """Clip name -> (seconds, pose function)."""
    return {
        'idle': (3.0, pose_idle),
        'walk': (base.gait_seconds(height, base.WALK_PACE, 22, joints), pose_walk),
        'run': (base.gait_seconds(height, base.RUN_PACE, 34, joints) * 1.08, pose_run),
        'talk': (2.4, pose_talk),
        'hide': (2.0, pose_hide),
        'fight': (1.4, pose_fight),
    }
