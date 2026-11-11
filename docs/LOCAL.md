# Working locally

Issues labelled `runs:local` need a machine of the author's: interactive Blender, the Voice Studio, real devices. This page says what that machine needs and how to check it, so an agent running there knows what it can call ([#31](https://github.com/esgabo/ardatir/issues/31)). Details of a particular machine (names, addresses, keys) stay out of this public repo.

## What the machine needs

- **Node 22** and the repo cloned (`npm install`, then `npm run dev` at http://localhost:5173).
- **Claude Code** running in the repo, so agents have a shell and Blender.
- **Blender 4.2 or later**, callable as `blender` from the command line (below).
- **ffmpeg**, for recording narration (below).
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

## Recording narration on the Voice Studio

The Voice Studio is **VoiceStudio** (OmniVoice engine) on LXC 116 `voicestudio` on `prox.lan`, at `http://192.168.1.212:3900`. It is LAN only, plain HTTP, and its GPU is the host's AMD 780M iGPU. The homelab notes are in `homelab/docs/nodes/voicestudio-lxc116.md`.

The box is a **test machine**: no backups, and it does not start on boot (`onboot=0`). Everything needed to rebuild a narrator is in this repo (`content/narrators/`), so losing the box costs nothing but time.

### Before a session

1. **Start the box** if prox rebooted: `pct start 116` on prox. `curl http://192.168.1.212:3900/health` should answer `{"status":"ok",…}`.
2. **Install ffmpeg** on the machine that runs the scripts, once: `sudo apt install ffmpeg`. The scripts use it to decode references and encode mp3s; set `FFMPEG` if it lives elsewhere.
3. **The API key** is only in `/opt/voicestudio/.env` on the box (`OMNIVOICE_API_KEY`), not in Vaultwarden yet. Load it into your shell without printing it:

   ```sh
   export VOICESTUDIO_API_KEY=$(ssh -i ~/.ssh/id_ed25519_homelab root@192.168.1.212 "grep -E '^OMNIVOICE_API_KEY=' /opt/voicestudio/.env | cut -d= -f2-")
   ```

   `VOICESTUDIO_URL` defaults to `http://192.168.1.212:3900`. Never commit or paste the key.
4. **Mind the shared GPU.** Ollama (CT 107) uses the same iGPU, and running both at once is untested (homelab #347). `narration:render` checks `ollama.lan:11434/api/ps` first and stops if a model is loaded.
5. **Expect a slow start.** The first calls after the container starts take 20–110 s each. After that, a passage takes about as long to make as it lasts.

### A session

```sh
npm run narration:render -- --only ainulindale --lang en   # render, check, write out/narration/report.html
# listen: every flagged take, plus a random sample (10 per narrator for its first events, then 5)
# reject a take: add "ainulindale/ea" to out/narration/rejects.txt, render again (next seed)
npm run narration:publish -- --only ainulindale --lang en  # audio/en.mp3 + audio/en.yaml in the event folder
npm run content                                            # validate; then look at it with npm run preview
```

Takes are cached in `out/narration-cache/`, so a run that fails halfway resumes where it stopped, and an edited passage re-renders alone. `--changed` limits a run to events whose recording is missing or stale. A flagged take you listened to and like is published with `--accept <event>/<passage>`.

### Narrators

| Age | Narrator | Voice (English) |
|---|---|---|
| Before Time | `the-elder` | audition candidate A: male, elderly, low pitch, British accent; seed 101, speed 0.9; chosen 2026-11-10 |
| Third Age | not chosen yet | needs an audition |

**Auditioning a new narrator** (design §4.3):
1. Write the brief in words, as a character, never as an actor.
2. Render 4–6 candidates on the box. Use `POST /generate` with `instruct` (the engine's attribute vocabulary: gender, age, pitch, accent) and a fixed `seed`, and have each read the same 2–3 real passages from that age. Put them in `out/auditions/<narrator>/` with a `manifest.json` of the exact parameters.
3. The author picks one, or steers ("older", "less British").
4. Join two of the winner's lossless passages, about 14 s, into `content/narrators/<id>.<lang>.flac`. Write `<id>.yaml` with its parameters, `refText` and `referenceHash`, and note the sample's origin in `content/narrators/README.md`.
5. Point the age at it with `narrator: <id>`.

Never use a reference clip of a real person.

## Not set up yet

- A **private `art/` folder** (not in this repo, e.g. on a NAS) for working `.blend` files and reference images. Only finished `.blend` sources beside their `.glb` go in `assets/`.
- **Test devices** for [#30](https://github.com/esgabo/ardatir/issues/30): phones, tablets, browsers.
