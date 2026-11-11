# Narration voices: narrators per age, Voice Studio pipeline, audio apart from text

Status: draft for the author's approval · 2026-11-10 · issues #14, #31, #33, #34, #35

## 1. Intent

Every staged event should be heard as well as read, in a voice that fits its moment in the history of the world. The voice should come from a repeatable pipeline: editing a passage should mean one command and a little listening, not an afternoon of manual work. The audience goal is the project's: people are amazed, and feel good learning these stories.

Recordings are produced on the homelab **Voice Studio** (VoiceStudio v0.5.6, OmniVoice engine, LXC 116 at `http://192.168.1.212:3900`). Today the project has the script export (`npm run narration:export`) and stale-recording warnings, but no voices, no generation, no timings and no recordings.

## 2. Decisions made with the author

1. **One narrator per age, not per character or book.** Events are told as *facts of the world's history*, read by that age's narrator: plainly and with weight, never as a children's story. *The Hobbit* and *The Lord of the Rings* share the Third Age narrator. Characters have no voices of their own.
2. **Each narrator fits its age.** Two examples, given as descriptions of the feeling and not as voices to imitate:
   - *Before Time*: a deep, slow, warm, kind elder, as if they were there before anything began.
   - *First Age*: an ageless woman, calm and luminous, with long memory and loss in her voice.
3. **A narrator is defined per age *and* per audio language.** English narrators come first; Spanish can stay empty and ship later.
4. **The audio language is separate from the reading language.** A visitor can read Spanish and hear English. Text and audio ship on their own schedules.
5. **Quality by sampling plus statistics.** At first the author listens to a few random passages per narrator; once those are good, production proceeds. Automatic checks cover every passage, and the author hears only flagged passages plus a small random sample.
6. **Use the Voice Studio box as it is.** It is a throwaway test machine: no backups, no restart on boot, API key only in its `.env`. So everything needed to rebuild a narrator lives in this repo.
7. **Narrator reference samples are committed to the repo.** The published recordings are public on the site anyway, so keeping the samples private would protect nothing. In the repo, anyone with a checkout can re-record. These are voice definitions, not the test audio or placeholder recordings that CLAUDE.md keeps out of the repo.

## 3. Goals, non-goals, anti-goals

**Goals**
- Narrator definitions are in the repo and reproducible.
- One command takes an event (or an age, or "everything changed") from `narration.yaml` to a valid `audio/<lang>.mp3` + `audio/<lang>.yaml`, with exact passage starts.
- Editing one passage re-renders only that passage.
- Automatic checks report every passage and catch the obvious failures: missing or repeated words, bad names, odd pace, clipping or silence.
- The site plays audio in a language chosen separately from the reading language.
- First deliverable: the Before Time and Third Age English narrators. They cover the three staged events (Ainulindalë, Unexpected Party, Roast Mutton).

**Non-goals (for now)**
- Spanish voices. The Castilian vs Latin American choice in #34 stays open.
- Character voices, dialogue casting, emotion engines.
- Turning the Voice Studio box into a dependable node.
- Music, ambience and effects (#27).

**Anti-goals (failure even if it works)**
- A narrator that sounds like, or was made from, a real actor (IP rule: no cloned voices, no film likenesses). Narrators are designed from attributes. If a result reminds us of a specific actor, we move it away.
- Reading Tolkien's text aloud. Narration stays our own words, as today.
- A pipeline only the author can run, or that breaks when the box is rebuilt.
- Narration that drifts out of sync with the animation, so a passage starts before or after its moment.

## 4. Narrators

### 4.1 Definition in content

A narrator is content: `content/narrators/<id>.yaml`, one file per narrator. Ages point to one with `narrator: <id>` in `content/ages/<age>.yaml`. *(My call: narrators have their own ids rather than being keyed by age, so two timeless ages, the Lamps and the Trees, could share the Before Time narrator if the author wants.)*

```yaml
id: the-elder
brief:
  en: A deep, slow, warm, kind elder who was there before anything began. Tells events as history, with weight.
voices:
  en:
    engine: omnivoice           # VoiceStudio engine id
    engineVersion: 0.5.6        # server version the voice was made on
    instruct: "male, elderly, low pitch, british accent"   # the engine's voice-design attributes
    seed: 1234
    speed: 0.9
    params: { num_step: 32, guidance_scale: 2.0 }          # every non-default parameter
    reference: the-elder.en.flac             # next to this file, in content/narrators/ (lossless, ~14 s)
    refText: "Before there was a world, … discord spread around him."   # the exact words of the reference
    referenceHash: sha256:…                  # so we know the reference hasn't changed
    version: 1                  # bump when the voice changes; makes its recordings stale
  # es: (absent: no Spanish recordings for this age yet)
```

The build validates narrators: known ids, every age that has a staged event names a narrator, and `brief.en` is present. A missing `voices.<lang>` is fine. It only means no recordings in that language are expected.

### 4.2 Keeping the voice stable: design once, then clone our own sample

*(My call, after the builder check.)* The `instruct` attributes and `seed` are used **only to make the voice**, during auditions.
- The chosen candidate's rendered sample, about 10–15 s of one audition passage, becomes the narrator's **reference**.
- From then on, every production call clones that reference (`ref_audio` + `ref_text`, or a `kind=clone` profile made from it). It never designs the voice again per call, because per-call design drifts from passage to passage. Cloning our own designed sample is fine under the IP rule, since it is not a real person.
- The **seed in production is only the take**: retrying with a new seed gives a new reading in the same voice. `instruct` and the audition seed stay in the definition as the voice's history.
- `ref_text` (the words the reference says) goes in the definition next to `reference` and `referenceHash`.
- The profile id on the box is a cache and is not stored as truth. The pipeline finds or recreates the clone profile from the reference.
- `version` changes when the voice changes. Recordings made with an older version are reported stale, like a text change.

### 4.3 Choosing a narrator: auditions

For each narrator:
1. Write the brief in words.
2. Render 4–6 candidates that vary attributes and seed, each reading the same 2–3 real passages from that age.
3. The author picks a candidate or steers ("older", "less British").
4. Fix the winner in `content/narrators/`.

Auditions go to `out/auditions/<narrator>/` (gitignored), with a `manifest.json` of the exact request parameters and a simple local listening page.

**Before Time: chosen 2026-11-10.** The author picked **candidate A**, judging it by its *void* passage.
- Parameters: `instruct: "male, elderly, low pitch, british accent"`, `seed: 101`, `speed: 0.9`, OmniVoice on VoiceStudio 0.5.6, server defaults otherwise (`num_step` 16, `guidance_scale` 2.0, denoise on, `effect_preset: broadcast`). It sits close to the box's `feat_03_the_storyteller` archetype.
- Reference: the lossless WAVs of A's *void* (5.9 s) and *discord* (8.4 s) passages, now in `out/auditions/before-time/wav/`, joined (with 0.4 s of silence between them) and committed as `content/narrators/the-elder.en.flac` (14.75 s, sha256 `196acd99…a4bceca54`). *(My call: the reference is void + discord joined, about 14 s, with both sentences as `ref_text`. Void alone is under the 10–15 s cloning wants.)*
  - `A-void.wav` sha256 `c62c135e…f0b48db1fe`
  - `A-discord.wav` sha256 `e2c1bac0…7f97e39f0ee`
- Pronunciation: A said "Eä" as a single "E", so a respelling is needed before the Ainulindalë is recorded. Ilúvatar, Ainur and Melkor were heard correctly.

### 4.4 Pronunciation

`content/pronunciation.yaml`: per language, a name and how to say it (respelling), e.g. `Eä: "EH-ah"`, `Ilúvatar: "ee-LOO-vah-tar"`. *(My call, after the builder check.)* The pipeline **does not use the box's shared lexicon**. It substitutes the respellings into the text it sends, with `pronounce=false`, so the audio never depends on the box's state. A passage's cache key includes the respellings it uses. Checks compare the transcript against the text that was sent, respellings included, and then confirm that each listed name was heard (§5.3). The first list covers the Ainulindalë and the two Hobbit events, and closes the pronunciation part of #34.

## 5. Production pipeline

All scripts are TypeScript under `scripts/narration/`, run with Node 22 like the rest. The box URL and key come from environment variables (`VOICESTUDIO_URL`, `VOICESTUDIO_API_KEY`), documented in `docs/LOCAL.md`, never committed. *(My call: read them from the environment and leave a pointer to fetch the key from Vaultwarden once it's stored there.)* Before each batch the pipeline checks that Ollama is idle (`ollama.lan:11434/api/ps`). The box's iGPU is shared, and running both at once is untested (homelab #347).

### 5.1 Commands

- `npm run narration:render -- [--only <event>] [--age <age>] [--lang en] [--changed]` generates and checks passages and writes a report. Nothing goes into `content/` yet.
- `npm run narration:publish -- [same filters]` assembles passages into `audio/<lang>.mp3` + `.yaml` in the event folder. It refuses events with unresolved flagged passages unless run with `--accept <event>/<passage>`.
- The existing `narration:export` stays as it is, for manual use.

*(The exact command names and flags are the builder's call.)*

### 5.2 Generate one passage at a time

- Each passage is rendered on its own with its age's narrator voice (language, instruct or profile, seed, speed, params). It goes into a local cache, `out/narration-cache/<event>/<lang>/<passage>.<passageHash>.wav` (gitignored).
- A passage is re-rendered only when its text, its narrator version or the pronunciation entries it uses have changed. The cache is disposable: if it's lost, the event re-renders from scratch. With fixed seeds the result should sound the same.
- **Timings:**
  - Publishing joins the passages with a fixed gap between them (default ~0.8 s, adjustable per narrator).
  - It writes `starts` as the exact second each passage's audio begins, and `duration` as the length of the joined file.
  - The output is a mono 128 kbps mp3 with loudness normalised to one target for every narrator.
  
  This closes #33 without forced alignment.
- `audio/<lang>.yaml` gains the data that marks a recording stale:

  ```yaml
  duration: 41.2
  starts: { void: 0.4, theme: 6.1, … }
  textHash: sha256:…                  # as today, whole-event
  narrator: { id: the-elder, version: 1 }
  passages: { void: sha256:…, theme: sha256:… }   # per-passage hash of the text read
  ```

  The build warns about stale passages one by one, so we know exactly which passages to re-render.

### 5.3 Automatic checks (every passage)

| Check | How | Flag when |
|---|---|---|
| Words | Whisper on the box (`/v1/audio/transcriptions`, word timestamps) vs the passage text, normalised | word error rate above a threshold; any word missing at the start or end |
| Names | every pronunciation-list name in the passage appears in the transcript | a name is missing or misheard |
| Pace | words per second vs that narrator's median | outside ±25% |
| Length | duration vs text length | an implausible ratio (cut-off or runaway generation) |
| Audio | peak, loudness, long internal silences | clipping, too quiet, a silence over ~1.5 s |

A flagged passage is retried automatically with a new seed (up to 3 tries). If it still fails, it's flagged for the author. The retry seed is recorded so the take can be reproduced. *(The thresholds are starting points; the builder tunes them on the first real batch.)*

### 5.4 Listening

`render` writes `out/narration/report.html`, a local page with one player per passage. It shows:
- **every flagged passage**, with why it was flagged and what Whisper heard;
- a **random sample** of passed passages, by default 5 per narrator per batch. For a new narrator, its first batches get a bigger sample, about 10, until the author trusts it.

The author listens, then runs `publish`. If a sampled passage is bad, the author marks it in a small `out/narration/rejects.txt` (one `event/passage` per line). The next `render` retries those passages with new seeds. *(The mechanism is the builder's call; the requirement is that rejecting a passage is a single small action and is remembered.)*

## 6. The site: audio language apart from reading language

- **Route:** `?lang=` stays the reading language (text and UI). A new `?audio=` gives the audio language, or `off`. Both go through `src/routes.ts` like all view state.
- **Default when `audio` is absent:**
  - the reading language's recording, if there is one;
  - otherwise the **English recording**, if there is one;
  - otherwise no audio, with the reveal following the staging's pacing as today.
- **Control:** a small audio-language choice in the playback controls, listing only the languages that event has recordings for, plus off.
- **Timing:** the clock follows the recording that is playing. Text in another language appears when that recording's passage starts. Passages share ids across languages, so this needs no extra data. The word-by-word reveal is spread evenly over the passage. Exact sync is not expected across languages.
- **Docs:** update `docs/DESIGN.md` §5 and §6, the decision log, and the decisions table in `CLAUDE.md`.

## 7. Order of work

1. **Before Time narrator** (English): audition, choose, define in `content/narrators/`, then pronunciation list for the Ainulindalë.
2. **Pipeline:** `render` + checks + report + `publish`, with tests for timing assembly and per-passage staleness.
3. **Record the Ainulindalë** in English (part of #35).
4. **Third Age narrator** (English): audition and define it, then record the Unexpected Party and Roast Mutton.
5. **Site:** split audio and reading language (§6).
6. Later: the other ages' narrators, as their events get staged; the Spanish voices once #34's Spanish choice is made.

## 8. Constraints

- The Voice Studio box is LAN only and unstable. Runs must be resumable: the cache means a failed run picks up where it stopped. They must also tolerate slow warm-up, since the first calls after a restart take 20–75 s.
- Output is 24 kHz mono from the engine. No committed test audio or placeholder recordings (CLAUDE.md).
- `public/data/` stays generated. Recordings are copied from the event folders as today.
- The site stays static; no new runtime dependencies on the site.

## 9. Left to the builder

- Command names, flags, report layout, and how retries and rejects are stored.
- Check thresholds and normalisation targets, tuned on the first batch.
- Whether generation uses `/generate` (multipart) or `/v1/audio/speech` (JSON), as long as every parameter in the voice definition is honoured.
- The audio-picker design in the HUD, in keeping with the sidebar's light fantasy look (§3.3).

## 10. My calls, for the author to check

- Narrators have their own ids; ages point to them.
- Voices are designed once at audition, then every production call clones our own designed reference sample. In production the seed only picks the take.
- Pronunciation is applied by rewriting the text we send, not through the box's shared lexicon.
- When the reading language has no recording, the site falls back to English audio rather than silence.
- Recordings record the narrator version, and changing a voice marks its recordings stale.
- The box key is read from environment variables.
