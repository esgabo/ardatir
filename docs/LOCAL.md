# Working locally: the homelab parts

Some work needs the author's machine and homelab, not the cloud workspace (issues labelled `runs:local`). This file covers recording narration. Blender and device testing are still to be written (#31).

## Recording narration on the Voice Studio

The Voice Studio is a **VoiceStudio** server (OmniVoice engine, plus VoxCPM2 for voices OmniVoice can't design, such as Latin American Spanish) on the author's private network. This repo never names its host, address or logins: the scripts read them from environment variables, and where to find the values is in the author's homelab notes.

| Variable | What it is |
|---|---|
| `VOICESTUDIO_URL` | The server's base URL, e.g. `http://<host>:<port>`. Required: the scripts stop with an error without it. |
| `VOICESTUDIO_API_KEY` | Its API key, sent as a bearer token. Never commit, paste or print it. |
| `FFMPEG` | Optional. The path to `ffmpeg`, if it isn't on `PATH`. |

The box is a **test machine**: no backups, and it may not start on its own. Everything needed to rebuild a narrator is in this repo (`content/narrators/`), so losing the box costs nothing but time.

### Before a session

1. **Set `VOICESTUDIO_URL`**, and start the box if it is down (how is in the homelab notes). `curl "$VOICESTUDIO_URL/health"` should answer `{"status":"ok",…}`.
2. **Install ffmpeg** on the machine that runs the scripts, once: `sudo apt install ffmpeg`. The scripts use it to decode references and encode mp3s; set `FFMPEG` if it lives elsewhere.
3. **Set `VOICESTUDIO_API_KEY`**, loading it into your shell without printing it; where the key lives is in the homelab notes. Never commit or paste the key.
4. **Expect a slow start.** The first calls after the container starts take 20–110 s each. After that, an OmniVoice passage takes about as long to make as it lasts.
5. **One engine per run.** A narrator voice names its engine (`engine:` in its yaml). The server holds one engine at a time, and loading VoxCPM2 into a process that already ran OmniVoice has run the box out of memory and frozen it. So `narration:render` refuses a run that needs both: render each language with `--lang`, and **restart the Voice Studio before a VoxCPM2 run** (how is in the homelab notes). VoxCPM2's first call then takes about 5 minutes (loading and warming up), and each passage after that 1–3 minutes. It speaks at 48 kHz; publish encodes every recording at 24 kHz.

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

| Age | Narrator | Voice (English) | Voice (Spanish) |
|---|---|---|---|
| Before Time | `the-elder` | audition candidate A (OmniVoice): male, elderly, low pitch, British accent; seed 101, speed 0.9; chosen 2026-11-10 | audition candidate K (VoxCPM2): very deep, warm bass, neutral Latin American accent; seed 101, cloned at `guidance_scale: 3`; chosen 2026-11-12 |
| Third Age | not chosen yet | needs an audition | needs an audition |

**Auditioning a new narrator** (design §4.3):
1. Write the brief in words, as a character, never as an actor.
2. Render 4–6 candidates on the box. Use `POST /generate` with `instruct` (the engine's attribute vocabulary: gender, age, pitch, accent) and a fixed `seed`, and have each read the same 2–3 real passages from that age. Put them in `out/auditions/<narrator>/` with a `manifest.json` of the exact parameters.
3. The author picks one, or steers ("older", "less British").
4. Join two of the winner's lossless passages, about 14 s, into `content/narrators/<id>.<lang>.flac`. Write `<id>.yaml` with its parameters, `refText` and `referenceHash`, and note the sample's origin in `content/narrators/README.md`.
5. Point the age at it with `narrator: <id>`.

Never use a reference clip of a real person.
