"""Low-poly building blocks for Ardatir's characters, run inside Blender (docs/MODELS.md).

Every part is a small faceted mesh with one flat-colour material and vertex groups that say
which bones move it. `finish` joins the parts into one flat-shaded mesh. Blender is Z-up;
characters face -Y and stand on z = 0, at their real height in metres.
"""

import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector


def reset_scene():
    """An empty scene in metres, 30 frames per second."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.render.fps = 30
    return scene


_materials = {}


def material(name, color, roughness=0.85, metallic=0.0):
    """A flat colour (hex string), shared by name."""
    if name in _materials:
        return _materials[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    rgb = srgb(color)
    bsdf.inputs['Base Color'].default_value = (*rgb, 1.0)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    mat.diffuse_color = (*rgb, 1.0)
    _materials[name] = mat
    return mat


def srgb(hex_color):
    """'#c9a46a' to linear RGB, as Blender's colour inputs expect."""
    h = hex_color.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


class Part:
    """One piece of a character: a bmesh, its material, and how bones weigh on it."""

    def __init__(self, name, bm, mat, weights):
        self.name = name
        self.bm = bm
        self.mat = mat
        # weights: a bone name, or a function (Vector) -> {bone: weight}
        self.weights = weights


def _weights_for(weights, co):
    if isinstance(weights, str):
        return {weights: 1.0}
    return weights(co)


def loft(rings, sides=8, cap_start=True, cap_end=True, u=Vector((1, 0, 0)), v=Vector((0, 1, 0)),
         phase=None, arc=None):
    """A faceted tube through rings of (centre, radius_u, radius_v).

    `u` and `v` span each ring's plane. `arc` (start, end) in radians, measured from -v
    towards +u, makes an open shell instead of a closed tube (a coat open at the front);
    it may be a function of the ring index. Returns a bmesh.
    """
    bm = bmesh.new()
    if phase is None:
        phase = math.pi / sides
    loops = []
    for i, (c, ru, rv) in enumerate(rings):
        c = Vector(c)
        ring = []
        if arc is None:
            angles = [phase + 2 * math.pi * k / sides for k in range(sides)]
        else:
            a0, a1 = arc(i) if callable(arc) else arc
            angles = [a0 + (a1 - a0) * k / sides for k in range(sides + 1)]
        for a in angles:
            # angle 0 points to -v (the front, for a vertical loft), increasing towards +u
            p = c + u * (ru * math.sin(a)) - v * (rv * math.cos(a))
            ring.append(bm.verts.new(p))
        loops.append(ring)
    n = len(loops[0])
    closed = arc is None
    for a, b in zip(loops, loops[1:]):
        for k in range(n if closed else n - 1):
            k2 = (k + 1) % n
            bm.faces.new((a[k], a[k2], b[k2], b[k]))
    if closed:
        if cap_start:
            bm.faces.new(list(reversed(loops[0])))
        if cap_end:
            bm.faces.new(loops[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def limb(a, b, radii, sides=7):
    """A tube from point a to point b, with radii along it (one per ring)."""
    a, b = Vector(a), Vector(b)
    axis = (b - a).normalized()
    u = Vector((1, 0, 0)) if abs(axis.x) < 0.9 else Vector((0, 1, 0))
    u = (u - axis * u.dot(axis)).normalized()
    v = axis.cross(u)
    n = len(radii)
    rings = [(a + (b - a) * (i / (n - 1)), r, r) for i, r in enumerate(radii)]
    return loft(rings, sides=sides, u=u, v=v)


def profile_at(profile, z):
    """Interpolate a list of (z, *values) sections at height z (clamped at the ends)."""
    if z <= profile[0][0]:
        return tuple(profile[0][1:])
    for a, b in zip(profile, profile[1:]):
        if z <= b[0]:
            f = (z - a[0]) / (b[0] - a[0])
            return tuple(x + (y - x) * f for x, y in zip(a[1:], b[1:]))
    return tuple(profile[-1][1:])


def jitter(bm, amount, seed):
    """Nudge every vertex a little, for rough natural forms (beards, rock)."""
    rnd = random.Random(seed)
    for v in bm.verts:
        v.co += Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * amount
    return bm


def blob(center, radii, subdiv=1, rotation=None):
    """A faceted ellipsoid (an icosphere, squashed)."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    m = Matrix.Diagonal((*radii, 1.0))
    if rotation is not None:
        m = rotation.to_4x4() @ m
    m = Matrix.Translation(Vector(center)) @ m
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    return bm


def box(center, size, taper=1.0, rotation=None):
    """A box, optionally narrower at its top (+z) by `taper`."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for vert in bm.verts:
        if vert.co.z > 0:
            vert.co.x *= taper
            vert.co.y *= taper
    m = Matrix.Diagonal((*size, 1.0))
    if rotation is not None:
        m = rotation.to_4x4() @ m
    m = Matrix.Translation(Vector(center)) @ m
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    return bm


def cone(base, tip, radius, sides=5):
    """A small faceted cone from `base` to `tip` (ear tips, hair tufts)."""
    base, tip = Vector(base), Vector(tip)
    axis = (tip - base).normalized()
    u = axis.orthogonal().normalized()
    v = axis.cross(u)
    bm = bmesh.new()
    ring = [bm.verts.new(base + (u * math.cos(a) + v * math.sin(a)) * radius)
            for a in (2 * math.pi * k / sides for k in range(sides))]
    t = bm.verts.new(tip)
    for k in range(sides):
        bm.faces.new((ring[k], ring[(k + 1) % sides], t))
    bm.faces.new(list(reversed(ring)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def solidify(bm, thickness):
    """Give an open shell some thickness, outward."""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    geom = bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=thickness)
    del geom
    return bm


def mirror_x(bm):
    """A copy of a bmesh mirrored to the other side (x -> -x)."""
    out = bm.copy()
    bmesh.ops.scale(out, vec=(-1, 1, 1), verts=out.verts)
    bmesh.ops.reverse_faces(out, faces=out.faces)
    return out


def seeded(seed):
    return random.Random(seed)


def finish(name, parts):
    """Join parts into one flat-shaded mesh object with materials and vertex groups."""
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    mats = []
    for p in parts:
        if p.mat.name not in [m.name for m in mats]:
            mats.append(p.mat)
    for m in mats:
        mesh.materials.append(m)

    joined = bmesh.new()
    deform = joined.verts.layers.deform.verify()
    group_names = []
    for p in parts:
        mat_index = [m.name for m in mats].index(p.mat.name)
        vmap = {}
        for vert in p.bm.verts:
            nv = joined.verts.new(vert.co)
            for bone, w in _weights_for(p.weights, vert.co).items():
                if w <= 0:
                    continue
                if bone not in group_names:
                    group_names.append(bone)
                nv[deform][group_names.index(bone)] = w
            vmap[vert] = nv
        for face in p.bm.faces:
            try:
                nf = joined.faces.new([vmap[v] for v in face.verts])
            except ValueError:
                continue  # a duplicate face from overlapping pieces: skip it
            nf.material_index = mat_index
            nf.smooth = False
        p.bm.free()
    joined.to_mesh(mesh)
    joined.free()
    for g in group_names:
        obj.vertex_groups.new(name=g)
    mesh.update()
    return obj


def blend_weights(bands):
    """Weights that move smoothly between bones along z.

    `bands` is a list of (z, bone) from the bottom up: below the first z the first bone has
    it all, between two bands the weight blends linearly.
    """
    def weights(co):
        z = co.z
        if z <= bands[0][0]:
            return {bands[0][1]: 1.0}
        for (z0, b0), (z1, b1) in zip(bands, bands[1:]):
            if z <= z1:
                f = (z - z0) / (z1 - z0)
                if b0 == b1:
                    return {b0: 1.0}
                return {b0: 1 - f, b1: f}
        return {bands[-1][1]: 1.0}
    return weights
