"""The shared hobbit rig and its clips (#21), run inside Blender.

One skeleton for every hobbit (Bilbo, Déagol, young Sméagol): sixteen bones, placed from a
character's joints, and the base clip set the diorama plays (docs/MODELS.md, "Clips"):
idle, walk, run, talk, hide, fight. Every clip is made from a pose function of the cycle's
phase (0 -> 1), keyed on every frame, so it loops exactly and stays in place (no root motion).

Angles are degrees about the armature's own axes (Z up, the figure facing -Y):
  rx > 0  tips an upward bone (spine, head) forward, and swings a downward bone (leg, arm)
          backward; a foot (pointing forward) turns its toes down
  ry      rolls sideways: rx/ry/rz are applied in that order
  rz > 0  turns towards the figure's left (+X)
"""

import math

import bpy
from mathutils import Euler, Vector

FPS = 30

# Walk and run are made at the gait pace the site expects (GAIT_PACE in src/scene/modelClips.ts):
# 0.8 and 2.0 figure heights per second. A hobbit's short legs take quick steps to get there.
WALK_PACE = 0.8
RUN_PACE = 2.0


def joints_for(height=1.05):
    """Joint positions for a hobbit of `height` metres (Bilbo's proportions, scaled)."""
    k = height / 1.05
    j = {
        'hips': (0, 0, 0.47), 'spine': (0, 0, 0.56), 'chest': (0, 0, 0.68), 'neck': (0, 0, 0.79),
        'head': (0, 0, 0.845), 'head_top': (0, 0, 1.02),
        'shoulder.L': (0.145, 0, 0.755), 'elbow.L': (0.17, 0.005, 0.60), 'wrist.L': (0.185, -0.005, 0.475),
        'hand_tip.L': (0.19, -0.01, 0.40),
        'hip.L': (0.065, 0, 0.47), 'knee.L': (0.065, -0.005, 0.27), 'ankle.L': (0.065, 0.005, 0.065),
        'toe.L': (0.07, -0.135, 0.02),
    }
    for name in [n for n in j if n.endswith('.L')]:
        x, y, z = j[name]
        j[name[:-2] + '.R'] = (-x, y, z)
    return {n: Vector(p) * k for n, p in j.items()}


# bone: (head joint, tail joint, parent)
BONES = {
    'hips': ('hips', 'spine', None),
    'spine': ('spine', 'chest', 'hips'),
    'chest': ('chest', 'neck', 'spine'),
    'neck': ('neck', 'head', 'chest'),
    'head': ('head', 'head_top', 'neck'),
}
for _s in ('L', 'R'):
    BONES.update({
        f'upper_arm.{_s}': (f'shoulder.{_s}', f'elbow.{_s}', 'chest'),
        f'forearm.{_s}': (f'elbow.{_s}', f'wrist.{_s}', f'upper_arm.{_s}'),
        f'hand.{_s}': (f'wrist.{_s}', f'hand_tip.{_s}', f'forearm.{_s}'),
        f'thigh.{_s}': (f'hip.{_s}', f'knee.{_s}', 'hips'),
        f'shin.{_s}': (f'knee.{_s}', f'ankle.{_s}', f'thigh.{_s}'),
        f'foot.{_s}': (f'ankle.{_s}', f'toe.{_s}', f'shin.{_s}'),
    })


def build_armature(name, joints):
    """The armature object, in edit mode only while bones are placed."""
    data = bpy.data.armatures.new(name + '-rig')
    arm = bpy.data.objects.new(name + '-rig', data)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for bone, (h, t, parent) in BONES.items():
        eb = data.edit_bones.new(bone)
        eb.head = joints[h]
        eb.tail = joints[t]
        eb.roll = 0
        if parent:
            eb.parent = data.edit_bones[parent]
            eb.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def bind(mesh_obj, arm):
    """Skin the mesh to the armature with the vertex groups it already has."""
    mesh_obj.parent = arm
    mod = mesh_obj.modifiers.new('rig', 'ARMATURE')
    mod.object = arm


# --- poses -------------------------------------------------------------------------------

def _apply(arm, pose):
    """Set every pose bone from a pose dict: bone -> (rx, ry, rz) degrees; 'hips_loc' -> (x, y, z) m."""
    for pb in arm.pose.bones:
        rest = pb.bone.matrix_local.to_3x3()
        rx, ry, rz = pose.get(pb.name, (0, 0, 0))
        r = Euler((math.radians(rx), math.radians(ry), math.radians(rz)), 'XYZ').to_matrix()
        local = rest.inverted() @ r @ rest
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = local.to_quaternion()
        if pb.name == 'hips':
            pb.location = rest.inverted() @ Vector(pose.get('hips_loc', (0, 0, 0)))
        else:
            pb.location = (0, 0, 0)


def _flat_foot(thigh, shin, toe=0.0):
    """The foot's own angle that keeps it at `toe` degrees from flat, given the leg above it."""
    return -(thigh + shin) + toe


def _leg(pose, side, thigh, knee, toe=0.0, spread=0.0):
    pose[f'thigh.{side}'] = (thigh, spread, 0)
    pose[f'shin.{side}'] = (knee, 0, 0)
    pose[f'foot.{side}'] = (_flat_foot(thigh, knee, toe), 0, 0)


def _arm(pose, side, swing, elbow, out=0.0, twist=0.0, wrist=0.0):
    """Arm forward by `swing` degrees, elbow bent forward by `elbow`, `out` away from the body."""
    sign = -1 if side == 'L' else 1
    pose[f'upper_arm.{side}'] = (-swing, sign * out, twist)
    pose[f'forearm.{side}'] = (-elbow, 0, 0)
    pose[f'hand.{side}'] = (-wrist, 0, 0)


def _tau(p):
    return 2 * math.pi * p


def leg_length(joints):
    return (joints['hip.L'] - joints['knee.L']).length + (joints['knee.L'] - joints['ankle.L']).length


def pose_idle(p, j):
    """Standing at ease, hands folded on a comfortable middle, breathing."""
    s = math.sin(_tau(p))
    pose = {
        'spine': (-1.5, 0, 0), 'chest': (1.2 * s, 0, 0),
        'neck': (0, 0, 0), 'head': (-2 + 1.5 * math.sin(_tau(p) + 1), 0, 4 * math.sin(_tau(p) * 1)),
        'hips_loc': (0, 0, -0.002 * s),
    }
    _leg(pose, 'L', 0, 0, spread=-2)
    _leg(pose, 'R', 0, 0, spread=2)
    _arm(pose, 'L', 24 + s, 72, out=6, twist=-42, wrist=10)
    _arm(pose, 'R', 24 + s, 72, out=6, twist=42, wrist=10)
    return pose


def _gait(p, j, amp, knee_swing, knee_stance, lean, arm_amp, elbow, bob, flight=0.0):
    s, c = math.sin(_tau(p)), math.cos(_tau(p))
    pose = {}
    for side, ph in (('L', 0.0), ('R', 0.5)):
        ss = math.sin(_tau(p + ph))
        cc = math.cos(_tau(p + ph))
        thigh = -amp * ss                       # forward at ss = 1
        knee = knee_stance + knee_swing * max(0.0, cc) ** 1.5   # bent most mid-swing
        toe = -12 * ss if ss > 0 else 14 * -ss  # heel strike toes up, push-off toes down
        _leg(pose, side, thigh, knee, toe=toe if abs(cc) < 0.9 else toe * 0.3)
        # arms swing against the legs
        _arm(pose, side, -arm_amp * ss, elbow + 0.25 * elbow * max(0.0, -ss), out=5)
    ll = leg_length(j)
    drop = ll * (1 - math.cos(math.radians(amp))) * 0.8
    pose['hips_loc'] = (0, 0, -drop * 0.5 + drop * 0.5 * math.cos(_tau(2 * p)) - bob + flight * abs(math.cos(_tau(2 * p))))
    pose['hips'] = (0, 0, 5 * s)
    pose['spine'] = (lean, 0, -3 * s)
    pose['chest'] = (0, 0, -4 * s)
    pose['head'] = (-lean * 0.6, 0, 2 * s)
    return pose


def pose_walk(p, j):
    return _gait(p, j, amp=21, knee_swing=32, knee_stance=4, lean=3, arm_amp=14, elbow=14, bob=0.0)


def pose_run(p, j):
    return _gait(p, j, amp=36, knee_swing=75, knee_stance=14, lean=12, arm_amp=32, elbow=80,
                 bob=0.02, flight=0.012)


def pose_talk(p, j):
    """Talking with one hand: a nod, a gesture, the other hand on the waistcoat."""
    s = math.sin(_tau(p))
    s2 = math.sin(_tau(2 * p) + 0.6)
    pose = {
        'spine': (-1, 0, 3 * s), 'chest': (0, 0, 4 * s),
        'neck': (2 * s2, 0, 0), 'head': (3 * s2, 2 * s, 6 * s),
    }
    _leg(pose, 'L', 0, 0, spread=-3)
    _leg(pose, 'R', 4, 6, spread=3)
    _arm(pose, 'L', 24, 72, out=6, twist=-42, wrist=10)
    _arm(pose, 'R', 28 + 10 * s2, 70 + 15 * s, out=12 + 4 * s, twist=-20 * s, wrist=-15 + 10 * s2)
    return pose


def _crouch_hips(j, thigh_fwd, knee):
    a = math.radians(thigh_fwd)
    b = math.radians(knee - thigh_fwd)  # the shin's angle back from vertical
    l1 = (j['hip.L'] - j['knee.L']).length
    l2 = (j['knee.L'] - j['ankle.L']).length
    drop = (l1 + l2) - (l1 * math.cos(a) + l2 * math.cos(b))
    shift = l1 * math.sin(a) - l2 * math.sin(b)  # how far forward the ankle ends up
    return drop, shift


def pose_hide(p, j):
    """Crouched low, small and still, peering ahead, breathing quickly."""
    s = math.sin(_tau(2 * p))
    drop, shift = _crouch_hips(j, 62, 112)
    pose = {
        'hips_loc': (0, shift, -drop + 0.002 * s),
        'hips': (10, 0, 0),
        'spine': (22, 0, 0), 'chest': (10 + s, 0, 0),
        'neck': (-14, 0, 0), 'head': (-16, 0, 6 * math.sin(_tau(p))),
    }
    # thigh angles are relative to the hips, tipped 10 degrees; the feet make up for it too
    _leg(pose, 'L', -62 - 10, 112, toe=-10, spread=-6)
    _leg(pose, 'R', -62 - 10, 112, toe=-10, spread=6)
    _arm(pose, 'L', 30, 70, out=8, twist=-10, wrist=10)
    _arm(pose, 'R', 30, 70, out=8, twist=10, wrist=10)
    return pose


def pose_fight(p, j):
    """Braced, then a quick jab forward with the right hand, and back."""
    jab = max(0.0, math.sin(_tau(p))) ** 2
    s = math.sin(_tau(p))
    pose = {
        'hips_loc': (0, 0.01, -0.035 - 0.01 * jab),
        'hips': (0, 0, 18 - 8 * jab),
        'spine': (8 + 6 * jab, 0, -6 - 10 * jab), 'chest': (2, 0, -8 - 10 * jab),
        'neck': (-4, 0, 6 + 8 * jab), 'head': (-6, 0, 6 + 6 * jab),
    }
    _leg(pose, 'L', -26, 34, spread=-6)
    _leg(pose, 'R', 18, 20, spread=6)
    _arm(pose, 'R', 35 + 50 * jab, 85 - 70 * jab, out=10, twist=0, wrist=10 * jab)
    _arm(pose, 'L', 30 + 4 * s, 80, out=14, twist=-10)
    return pose


def gait_seconds(height, pace, amp_deg, joints):
    """How long one cycle (two steps) takes for the feet to keep up at `pace` heights per second."""
    stride = 2 * leg_length(joints) * math.sin(math.radians(amp_deg))  # one step, front foot to back
    return 2 * stride / (pace * height)


def clips(height, joints):
    """Clip name -> (seconds, pose function)."""
    return {
        'idle': (2.4, pose_idle),
        'walk': (gait_seconds(height, WALK_PACE, 21, joints), pose_walk),
        'run': (gait_seconds(height, RUN_PACE, 36, joints) * 1.08, pose_run),
        'talk': (2.0, pose_talk),
        'hide': (2.0, pose_hide),
        'fight': (1.2, pose_fight),
    }


def make_clips(arm, height, joints):
    """One action per clip, keyed on every frame from its pose function, looping exactly."""
    arm.animation_data_create()
    made = []
    for name, (seconds, fn) in clips(height, joints).items():
        frames = max(2, round(seconds * FPS))
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        arm.animation_data.action = action
        for f in range(frames + 1):
            _apply(arm, fn(f / frames, joints))
            for pb in arm.pose.bones:
                pb.keyframe_insert('rotation_quaternion', frame=f)
                if pb.name == 'hips':
                    pb.keyframe_insert('location', frame=f)
        track = arm.animation_data.nla_tracks.new()
        track.name = name
        strip = track.strips.new(name, 0, action)
        strip.name = name
        track.mute = True
        made.append((name, frames))
    arm.animation_data.action = None
    _apply(arm, {})
    return made


def export_glb(path, objects):
    """Export the character as glTF binary with the settings in docs/MODELS.md."""
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format='GLB',
        use_selection=True,
        export_extras=False,
        export_yup=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False,
        export_skins=True,
        export_all_influences=False,
        export_def_bones=True,
        export_rest_position_armature=True,
        export_animations=True,
        export_animation_mode='ACTIONS',
        export_force_sampling=True,
        export_frame_step=1,
        export_optimize_animation_size=True,
        export_draco_mesh_compression_enable=False,
    )
