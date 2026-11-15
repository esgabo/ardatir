# Voice Studio + MusicGen on this laptop (Ubuntu, NVIDIA)

A transfer kit on the `claude/music-laptop-kit` branch, not meant to be merged. On the laptop:

```sh
git clone -b claude/music-laptop-kit https://github.com/esgabo/ardatir.git ~/ardatir-kit
cd ~/ardatir-kit/tools/music-kit && claude
```

Then paste everything below the line as the first message.

---

Set up two GPU services on this Ubuntu laptop (NVIDIA): **VoiceStudio** (text-to-speech, for Ardatir's narration) and **MusicGen-melody** (for Ardatir's background music). Then generate music takes for comparison. This folder (`tools/music-kit/` in the Ardatir repo, branch `claude/music-laptop-kit`) holds everything you need; `reference/` holds the working setup from the homelab test box, which was AMD (ROCm) and has to be adapted to NVIDIA (CUDA).

**First, make the melody guides:** the audio isn't committed, so run `python3 guides.py` here (it needs `numpy`; install it in a venv if missing). That writes `guide-theme.wav` and `guide-discord.wav`. Never commit audio or takes: `.gitignore` here already keeps them out, and nothing from this session should be pushed.

## Context

Ardatir is a free, non-commercial fan site that animates Tolkien's history as low-poly dioramas, with narration and, now, background music. Decisions so far:

- **No film or series music**, and no Artlist (its licence excludes apps and standalone files). The music is our own.
- **Our own synthesized draft** exists: `creation.py` composes and renders the "creation" theme (the Music of the Ainur motif, then Melkor's discord, resolved into the theme). It's numpy-only, from scratch, no samples.
- **MusicGen-melody comparison:** MusicGen takes our notes (`guide-theme.wav` 30 s, `guide-discord.wav` 16 s, made by `guides.py`) and a mood description, and writes its own arrangement over them. `musicgen.sh` sends them and saves the takes.
- **Why this laptop:** the homelab box (AMD Radeon 780M iGPU) produced 2 of 6 takes, then MusicGen hung the GPU (two driver resets), even with VoiceStudio stopped. It was also slow: about 10 min per 30 s take. VoiceStudio's own images are CUDA upstream, so NVIDIA is its native home.

## Rules

- **Ask me before** any `sudo` install, before anything that changes the system's NVIDIA driver, and before deleting anything you didn't create.
- **Never print, paste or commit an API key.** Generate keys into `.env` files (mode 600) and load them without echoing.
- **One GPU program at a time** unless `nvidia-smi` shows room for both: check free VRAM before starting the second service, and stop one if needed. If the GPU errors (Xid in `dmesg`, CUDA "unspecified launch failure", out of memory), stop and report; don't retry in a loop.
- Downloads are large, about 40 GB in all: the VoiceStudio image (~17 GB), its models (~15 GB), and MusicGen's weights (~3.8 GB). Check free disk first and tell me the numbers.

## Steps

1. **Survey:** run `nvidia-smi` (GPU model, driver, CUDA version, VRAM), and check free RAM and disk, Docker, and the NVIDIA Container Toolkit. Report, and stop here if the GPU has less than 8 GB of VRAM (MusicGen-melody 1.5B plus VoxCPM2 won't both fit, and even one may be tight).
2. **Docker with GPU:** if missing, install Docker Engine (with the compose plugin) and `nvidia-container-toolkit`, then confirm with `docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi` (ask me before the sudo steps).
3. **VoiceStudio** in `~/voicestudio` (see `reference/voicestudio/`):
   - **Image:** upstream `ghcr.io/debpalash/voicestudio:stable` is already a CUDA image, so don't swap torch the way the AMD `Dockerfile` did. The only thing to keep from that Dockerfile is the VoxCPM2 layer: a thin Dockerfile `FROM ghcr.io/debpalash/voicestudio:stable` that runs `pip install voxcpm==2.0.3`. Pin the existing torch and numpy versions so pip can't replace them, the same idea as `voxcpm2-constraints.txt` but with the image's own CUDA versions (read them with `pip freeze` inside the image).
   - **compose.yml:** one service on port 3900 with `deploy.resources.reservations.devices` for the NVIDIA GPU. Use the same environment as the reference (`OMNIVOICE_SERVER_MODE=1`, `OMNIVOICE_ANALYTICS_DISABLED=1`, `HF_HOME` on a mounted `./hf`, a data dir on `./data`) and `restart: unless-stopped`.
   - **API key:** `.env` with a new `OMNIVOICE_API_KEY` that you generate yourself (mode 600).
   - **Test:**
     1. `GET /health` answers ok.
     2. An OmniVoice `POST /generate` with `text`, `language=en`, `instruct="male, elderly, low pitch, British accent"`, `seed=101` returns a WAV.
     3. A `engine=voxcpm2` request with Spanish text returns a WAV.
     4. Restart the container between the two engines (on the homelab box, loading VoxCPM2 into a process that had run OmniVoice blew up its memory).
     5. Note the cold and warm timings, and the peak VRAM per engine.
4. **MusicGen** in `~/musicgen` (see `reference/musicgen/`):
   - **Code:** reuse `server.py` as is. It has the same API as before: `GET /health`; `POST /generate` with `description`, `melody` (WAV), `duration` (≤ 30), `seed`, `top_k`, `cfg_coef`; it returns a 32 kHz WAV; Bearer `MUSICGEN_API_KEY`.
   - **Dockerfile:** `FROM ghcr.io/debpalash/voicestudio:stable` (its CUDA torch, demucs and transformers are reused). Install `audiocraft==1.3.0` with `--no-deps` plus `flashy hydra-core hydra_colorlog encodec`, pinned so pip can't replace torch. Real `xformers` isn't needed: keep the stub from `reference/musicgen/xformers_stub/`, since audiocraft's default attention is torch SDPA. Drop the ROCm bits (`/dev/kfd`, `group_add`, miopen volumes, `TORCH_COMPILE_DISABLE` is optional).
   - **compose.yml:** port 3910, the NVIDIA GPU, `./data` for the weights cache (`HF_HOME`, `TORCH_HOME`, `AUDIOCRAFT_CACHE_DIR` under `/data`), `ulimits.core: 0`, and its own `.env` with a new `MUSICGEN_API_KEY`.
   - **Test:** a 10 s generation without a melody, cold and then warm. Note the timings and peak VRAM.
5. **Takes:**
   1. With VoiceStudio stopped, unless VRAM clearly allows both, run in this folder: `set -a; . ~/musicgen/.env; set +a; MUSICGEN_URL=http://127.0.0.1:3910 ./musicgen.sh 1 2 3`. That's six takes in `takes/`: theme 30 s and discord 16 s, seeds 1–3.
   2. If they come fast (under about 2 min each), also run seeds 4–6.
   3. Note each take's time.
   4. Never change the descriptions in `musicgen.sh` to name a composer or a film.
6. **Finish:**
   - Leave VoiceStudio running and MusicGen stopped (`docker compose down`).
   - Write `REPORT.md` in this folder (not committed) with: the GPU, versions, timings, peak VRAM, which takes exist, how to start and stop each service, the laptop's LAN address and ports, and where each key lives. Name the file holding each key; never write the key itself.
   - Tell me how to point the Ardatir checkout at this VoiceStudio: `VOICESTUDIO_URL=http://<laptop-ip>:3900` and `VOICESTUDIO_API_KEY` from `~/voicestudio/.env`, as in Ardatir's `docs/LOCAL.md`.
