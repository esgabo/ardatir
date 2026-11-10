# Working locally

Issues labelled `runs:local` need a machine of the author's: interactive Blender, the Voice Studio, real devices. This page says what that machine needs and how to check it, so an agent running there knows what it can call ([#31](https://github.com/esgabo/ardatir/issues/31)). Details of a particular machine (names, addresses, keys) stay out of this public repo.

## What the machine needs

- **Node 22** and the repo cloned (`npm install`, then `npm run dev` at http://localhost:5173).
- **Claude Code** running in the repo, so agents have a shell and Blender.
- **Blender 4.2 or later**, callable as `blender` from the command line (below).
- A GPU helps the interactive viewport but isn't needed: Blender renders headless on the CPU with both Cycles and EEVEE, which is enough for low-poly work and scripted exports.

## Blender

Use an official release from [blender.org](https://www.blender.org/download/); distribution packages are often too old (Debian 12 ships 3.4). A user install needs no root:

```sh
# unpack the release (check it against its .sha256 first), then put it on PATH
tar -xJf blender-<version>-linux-x64.tar.xz -C ~/.local/opt
ln -sfn ~/.local/opt/blender-<version>-linux-x64/blender ~/.local/bin/blender
blender --version
```

To upgrade, unpack a newer release the same way and repoint the symlink.

Agents drive it headless:

```sh
blender --background --python script.py -- <args after the double dash>
blender --background scene.blend --python export.py
```

**Check it works:** render a small test scene (a few primitives, a sun, a camera) with Cycles and EEVEE, and export it as `.glb`. Then run the export through `npm run model:pack` (or `pack` in `scripts/models/pack.ts`, writing outside `assets/` for a test). Export settings and conventions are in [`MODELS.md`](MODELS.md).

*Optional, not set up yet:* an add-on that lets an agent drive the open Blender and see viewport screenshots.

## Voice Studio

Narration is recorded on the author's Voice Studio. How a local machine calls it will be added here.

## Not set up yet

- A **private `art/` folder** (not in this repo, e.g. on a NAS) for working `.blend` files and reference images. Only finished `.blend` sources beside their `.glb` go in `assets/`.
- **Test devices** for [#30](https://github.com/esgabo/ardatir/issues/30): phones, tablets, browsers.
