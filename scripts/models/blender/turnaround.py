"""Render a character's turnaround and clip poses for review, run inside Blender.

    blender --background assets/characters/bilbo/bilbo.blend --python scripts/models/blender/turnaround.py -- <out dir> [clip:frame ...]

Writes <out dir>/view-<angle>.png at rest (front, three-quarter, side, back, and from above
like the diorama camera), then <out dir>/<clip>-<frame>.png for each clip:frame asked for.
"""

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
out = Path(args[0])
out.mkdir(parents=True, exist_ok=True)
poses = args[1:]

scene = bpy.context.scene
arm = next(o for o in scene.objects if o.type == 'ARMATURE')
mesh = next(o for o in scene.objects if o.type == 'MESH')
height = max((mesh.matrix_world @ Vector(c)).z for c in mesh.bound_box)

try:
    scene.render.engine = 'BLENDER_EEVEE'
except TypeError:
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.eevee.taa_render_samples = 16
scene.render.resolution_x = 640
scene.render.resolution_y = 800
scene.render.film_transparent = False
world = bpy.data.worlds.new('review')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.6, 0.62, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
scene.world = world

sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
sun.data.energy = 3.5
sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))
scene.collection.objects.link(sun)

ground = bpy.data.meshes.new('ground')
ground.from_pydata([(-2, -2, 0), (2, -2, 0), (2, 2, 0), (-2, 2, 0)], [], [(0, 1, 2, 3)])
g = bpy.data.objects.new('ground', ground)
mat = bpy.data.materials.new('ground')
mat.use_nodes = True
mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.25, 0.32, 0.18, 1)
ground.materials.append(mat)
scene.collection.objects.link(g)

cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
cam.data.type = 'ORTHO'
cam.data.ortho_scale = height * 1.25
scene.collection.objects.link(cam)
scene.camera = cam


def look(azimuth_deg, elevation_deg):
    """Point the camera at the figure's middle from an azimuth (0 = in front) and elevation."""
    target = Vector((0, 0, height * 0.5))
    az, el = math.radians(azimuth_deg), math.radians(elevation_deg)
    d = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    cam.location = target + d * 5
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()


def render(path):
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


arm.animation_data_create()
arm.animation_data.action = None
for name, az, el in [('front', 0, 5), ('three-quarter', 35, 12), ('side', 90, 5), ('back', 180, 8), ('diorama', 40, 35)]:
    look(az, el)
    render(out / f'view-{name}.png')

for spec in poses:
    clip, frame = spec.split(':')
    arm.animation_data.action = bpy.data.actions[clip]
    scene.frame_set(int(frame))
    look(35, 12)
    render(out / f'{clip}-{frame}.png')
