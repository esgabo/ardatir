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

### Letting an agent drive the open Blender (optional)

[MCP for Blender](https://github.com/ahujasid/mcp-for-blender) (MIT) lets an agent inspect the open scene, run Python in it and see the viewport, while you keep working in the same window. It has two parts: an add-on inside Blender that listens on `localhost:9876`, and an MCP server that Claude Code starts. The repo registers the server in `.mcp.json` (Claude Code asks you once to trust it) and limits it in `.claude/settings.json`:

- **Every Blender call asks first** (`ask: mcp__blender`).
- **Outside assets are denied** (`generate_3d`, `search_assets`, `import_asset`): models here are original (IP rules in `CLAUDE.md`). So is `record_trajectory_feedback`, which sends your reactions to the project's dataset.
- **Telemetry off** (`DISABLE_TELEMETRY`) and **safe mode on** (`BLENDER_MCP_SAFE_MODE`): code the agent sends must pass an allowlist (no `os`, `open`, `subprocess`, sockets) before it reaches Blender.

Install it so only this project's Blender has the add-on:

1. **The server**, pinned: `pipx install mcp-for-blender==<version>` (puts `mcp-for-blender` on PATH).
2. **A Blender profile for this project**, so your everyday Blender stays without the add-on. A small launcher, e.g. `blender-ardatir`, runs `BLENDER_USER_RESOURCES=<profile dir> blender "$@"`.
3. **The add-on in that profile**: copy the add-on shipped with the server (`blender_mcp/bundled/addon.py` in its package) to `<profile dir>/scripts/addons/blender_mcp.py`, enable it and save preferences.
4. **No auto-start**: the add-on starts its server whenever Blender opens unless *Auto-Start Server* is off. Turn it off and save the startup file (*File → Defaults → Save Startup File*), so new files start without it. Files saved elsewhere may still have it on.

**Using it:** open Blender with the launcher, press `N` in the viewport, open the **MCP for Blender** tab and click **Start MCP Server**; stop it when you're done. Nothing listens until you do, and headless runs (`--background`) never start it. Upgrading means a new pinned server version *and* its bundled add-on, read before installing.

## Voice Studio

Narration is recorded on the author's Voice Studio. How a local machine calls it will be added here.

## Not set up yet

- A **private `art/` folder** (not in this repo, e.g. on a NAS) for working `.blend` files and reference images. Only finished `.blend` sources beside their `.glb` go in `assets/`.
- **Test devices** for [#30](https://github.com/esgabo/ardatir/issues/30): phones, tablets, browsers.
