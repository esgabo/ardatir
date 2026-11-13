"""Render characters side by side for review, run inside Blender.

    blender --background --python scripts/models/blender/lineup.py -- <out.png> [--spacing=0.62] [--pose] <a.glb> <b.glb> ...

Imports each export in a row, at its own size (so set heights with content `scale` in mind),
and renders the row from the front, a little above, in the diorama's light.
"""

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
out, files = Path(args[0]), args[1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
spacing = float(next((a.split('=')[1] for a in args if a.startswith('--spacing=')), 0.62))
files = [f for f in files if not f.startswith('--')]
for i, f in enumerate(files):
    before = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=f)
    for o in set(scene.objects) - before:
        if o.parent is None:
            o.location.x += (i - (len(files) - 1) / 2) * spacing
# the rest pose, not whichever clip the importer left playing (unless --pose: a model's own first frame)
for o in ([] if '--pose' in args else scene.objects):
    if o.type == 'ARMATURE':
        if o.animation_data:
            o.animation_data.action = None
        for pb in o.pose.bones:
            pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)
scene.frame_set(0)

try:
    scene.render.engine = 'BLENDER_EEVEE'
except TypeError:
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.eevee.taa_render_samples = 16
scene.render.resolution_x = 1800
scene.render.resolution_y = 720
world = bpy.data.worlds.new('review')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.6, 0.62, 1)
scene.world = world
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
sun.data.energy = 3.5
sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))
scene.collection.objects.link(sun)

width = len(files) * spacing
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
cam.data.type = 'ORTHO'
tallest = max((o.matrix_world @ Vector(c)).z for o in scene.objects if o.type == 'MESH' for c in o.bound_box)
cam.data.ortho_scale = max(width * 1.02, tallest * 1.3 * 1800 / 720)
scene.collection.objects.link(cam)
scene.camera = cam
target = Vector((0, 0, tallest * 0.55))
az, el = math.radians(18), math.radians(14)
d = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
cam.location = target + d * 8
cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = str(out)
bpy.ops.render.render(write_still=True)
