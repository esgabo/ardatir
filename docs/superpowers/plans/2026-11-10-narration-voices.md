# Narration Voices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each age a narrator defined in content, record narration on the homelab Voice Studio one passage at a time, check every passage automatically, publish exact-timed recordings, and let the site play audio in a language apart from the reading language.

**Architecture:** There are three parts, each shippable on its own.
- **A. Content (Tasks 1–3):** narrators, pronunciation and per-passage hashes, all validated by `scripts/content/build.ts`.
- **B. Pipeline (Tasks 4–8):** `scripts/narration/` gets pure modules for WAV, checks and assembly, a thin Voice Studio client, and two commands, `narration:render` and `narration:publish`. Task 9 records the Ainulindalë.
- **C. Site (Tasks 10–11):** choosing the audio language and the `?audio=` route, then the docs.

The pure modules carry the logic and the tests. The network client and `ffmpeg` sit behind small interfaces that tests replace with fakes.

**Tech Stack:** Node 22 (TypeScript run directly by `node`, as `scripts/content/cli.ts` is), vitest, `yaml`, plain DOM + TypeScript on the site. `ffmpeg` must be on PATH for publishing: install it with `apt install ffmpeg` if it's missing. VoiceStudio 0.5.6 with the OmniVoice engine, at `VOICESTUDIO_URL`.

**Spec:** `docs/superpowers/specs/2026-11-10-narration-voices-design.md`. Read it first. Section numbers below (§) refer to it.

## Global Constraints

- One narrator per age per audio language; ages point to narrators with `narrator: <id>` (§4.1).
- Narrators are designed voices, cloned only from our own reference sample in `content/narrators/<id>.<lang>.flac`. Never a real actor's voice, and no reference clips of anyone (CLAUDE.md IP rules).
- In production, every call clones the reference (`ref_audio` + `ref_text`). The seed only picks the take; a retry changes the seed, never the voice (§4.2).
- Pronunciation is applied by rewriting the text sent, with `pronounce=false`. The box's shared `/pronunciation` lexicon is never used (§4.4).
- Box access comes from env `VOICESTUDIO_URL` (required, no default) and `VOICESTUDIO_API_KEY`; where to find them is in the author's homelab notes. Never commit or log the key.
- Gap between passages defaults to 0.8 s and can be overridden per narrator voice (`gap`). Output is mono mp3 at 128 kbps, loudness normalised to −16 LUFS for every narrator (my call within §5.2).
- Checks (§5.3) start at: word error rate > 0.10 flags; pace outside ±25% of the narrator's median words/s; internal silence > 1.5 s; peak ≥ −0.1 dBFS (clipping); duration/char ratio outside 0.04–0.12 s per char. Up to 3 retries with a new seed.
- Listening sample: 5 random passed passages per narrator per batch; 10 while a narrator has fewer than 3 published events (§5.4).
- `out/` is gitignored and holds every cache, report and audition. No test audio or placeholder recordings are committed (CLAUDE.md).
- `public/data/` is never edited; recordings keep being copied from event folders by the build.
- Every text is `LocalizedText`; new interface strings get `en` and `es` in `src/i18n.ts`.
- Story state stays a pure function of `t`; the playhead runs in seconds of the *playing* recording (CLAUDE.md, "Rules the code depends on").

## Review Focus

1. **Box down or slow mid-batch.** The first calls after a restart take 20–75 s, and the box may not start on its own. Expect a timeout per call of at least 120 s, and a re-run of `render` that resumes from the cache without redoing finished passages. Test: Task 7, `resumes after a failed call`.
2. **Reading language without a recording, or `?audio=` naming a language the event lacks.** This must fall back to English audio, then to silence. It must never break playback, and never show a picker listing a missing language. Test: Task 10, `pickAudio` cases.
3. **A passage edited after publishing.** The build must name *that* passage as stale, and `render --changed` must redo only it. Test: Task 3 `per-passage stale warning`, and Task 7 `re-renders only the changed passage`.
4. **A name in the pronunciation list inside a longer word or with different case** ("Eärendil" vs "Eä"). Only whole-word, case-sensitive matches should be respelled. Test: Task 2, `does not respell inside a longer word`.
5. **The reference sample replaced without updating its hash.** The build errors, so a different voice can't slip in silently. Test: Task 1, `reference hash mismatch`.

---

## Part A: content

### Task 1: Narrators in content

**Files:**
- Create: `content/narrators/the-elder.yaml`
- Modify: `content/ages/before-time.yaml` (add `narrator: the-elder`)
- Modify: `src/data/types.ts` (`Age.narrator?`, new `Narrator`, `NarratorVoice`)
- Modify: `scripts/content/build.ts` (load `content/narrators/*.yaml` before ages; add `'narrator'` to the age keys; validate)
- Modify: `tests/fixtures/valid/content/` (add `narrators/the-voice.yaml` + `narrators/the-voice.en.flac`, a few bytes of dummy data, and `narrator: the-voice` on `ages/before-time.yaml`)
- Test: `tests/build.test.ts`

**Interfaces:**
- Produces, in `src/data/types.ts`:
  ```ts
  export interface NarratorVoice {
    engine: string; engineVersion: string; instruct: string; seed: number; speed: number;
    params?: Record<string, number | string | boolean>;
    reference: string;      // file name next to the yaml, e.g. "the-elder.en.flac"
    referenceHash: string;  // "sha256:" + 64 hex
    refText: string;
    gap?: number;           // seconds between passages, default 0.8
    version: number;        // integer ≥ 1
  }
  export interface Narrator { id: string; brief: LocalizedText; voices: Partial<Record<Lang, NarratorVoice>> }
  // Age gains: narrator?: string
  ```
- Produces: `BuildResult.narrators: Narrator[]` (export the field; the pipeline reads it).

- [ ] **Step 1: Write the failing tests** in `tests/build.test.ts`, in a `describe('narrators')`, using `buildWith`:
  - `the fixture's narrator loads`: `r.narrators.map(n => n.id)` equals `['the-voice']`; `r.index.ages.find(a => a.id === 'before-time')!.narrator === 'the-voice'`.
  - `unknown narrator on an age`: replace `narrator: the-voice` with `narrator: nobody` → an error containing `narrator: unknown narrator "nobody"`.
  - `missing reference file`: remove `narrators/the-voice.en.flac` → an error containing `reference: no file "the-voice.en.flac"`.
  - `reference hash mismatch`: write different bytes to the flac → an error containing `referenceHash: does not match`.
  - `voice without refText`: remove the `refText` line → an error containing `refText`.
  - `staged event in an age with no narrator`: remove `narrator:` from `ages/third-age.yaml` (the fixture's staged party lives there; add `narrator: the-voice` to it in the fixture first) → a **warning** containing `has staged events but no narrator`.
- [ ] **Step 2: Run** `npx vitest run tests/build.test.ts -t narrators`. Expected: FAIL (no `narrators` on the result).
- [ ] **Step 3: Implement.** In `buildContent`, load and validate narrators with the existing helpers (`readYaml`, `keys`, `id`, `text`). Hash the reference with `createHash('sha256')` over the file bytes. Add `narrator` to the age keys and check that it is known. After the events are built, warn for each age that has a `staged`/`animated` event but no narrator. Add `narrators` to `BuildResult`.
- [ ] **Step 4: Write `content/narrators/the-elder.yaml`** from `content/narrators/README.md`:
  - `brief.en` from spec §4.1, plus an `es` translation.
  - `voices.en`: `engine: omnivoice`, `engineVersion: 0.5.6`, `instruct: "male, elderly, low pitch, british accent"`, `seed: 101`, `speed: 0.9`, `reference: the-elder.en.flac`.
  - `referenceHash: sha256:196acd99b54d29007d96a73ec553e0563e03a30a0bf8ddcfcbf2daca4bceca54`, `refText` (from the README), `version: 1`.
  
  Add `narrator: the-elder` to `content/ages/before-time.yaml`.
- [ ] **Step 5: Run** `npm test && npm run content`. Expected: all pass, `✓ content is valid`, plus one warning for third-age having staged events but no narrator. That's expected until the Third Age narrator is chosen. In `the real content › is valid, with no warnings`, allow exactly that warning, with a comment naming this plan.
- [ ] **Step 6: Commit** `git commit -m "Narrators in content: the-elder for Before Time (#34)"`.

### Task 2: Pronunciation list and respelling

**Files:**
- Create: `content/pronunciation.yaml`
- Create: `scripts/narration/pronounce.ts`
- Modify: `scripts/content/build.ts` (validate the file if present; expose `BuildResult.pronunciation`)
- Test: `tests/pronounce.test.ts`, `tests/build.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Lexicon = Partial<Record<Lang, Record<string, string>>>;   // name → respelling
  export function respell(text: string, lang: Lang, lex: Lexicon): { text: string; used: string[] };
  ```
  `used` lists the names replaced, sorted and unique. It is part of the render cache key in Task 7.
- Produces: `BuildResult.pronunciation: Lexicon`.

- [ ] **Step 1: Write the failing tests** in `tests/pronounce.test.ts`:
  - `respells a whole word`: `respell('one word, Eä. Let it be.', 'en', { en: { 'Eä': 'EH-ah' } })` → `{ text: 'one word, EH-ah. Let it be.', used: ['Eä'] }`.
  - `does not respell inside a longer word`: `'Eärendil sailed'` with the same lexicon → text unchanged, `used: []`.
  - `is case-sensitive`: `'eä'` is unchanged.
  - `uses only the passage language`: with only `es` entries, an `en` call returns the text unchanged.
  - `longest name first`: lexicon `{ 'Thráin': 'A', 'Thráin II': 'B' }` on `'Thráin II'` → `'B'`.
- [ ] **Step 2: Run** `npx vitest run tests/pronounce.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `respell`.** Use word boundaries that understand Unicode letters: `(?<!\p{L})NAME(?!\p{L})` with the `u` flag, the name regex-escaped, names sorted longest first.
- [ ] **Step 4: Build validation test** in `tests/build.test.ts`: writing `pronunciation.yaml` with `en: { Eä: 5 }` → an error containing `pronunciation.en.Eä: must be text`. Implement it: optional file, top-level keys must be in `LANGS`, values must be strings.
- [ ] **Step 5: Write `content/pronunciation.yaml`** with English entries for every unusual name in the Ainulindalë, the Unexpected Party and Roast Mutton: Ilúvatar, Ainur, Melkor, Eä, Arda, plus the dwarf names and the trolls' names from those scripts. Use simple English respellings, e.g. `Eä: "AY-ah"`. Mark each `# unheard` until Task 9 confirms it.
- [ ] **Step 6: Run** `npm test && npm run content`. Expected: pass.
- [ ] **Step 7: Commit** `git commit -m "Pronunciation list and respelling for narration (#34)"`.

### Task 3: Per-passage hashes and narrator version on recordings

**Files:**
- Modify: `scripts/narration/text.ts` (add `passageHash`)
- Modify: `scripts/content/build.ts:459-500` (read `narrator` and `passages` from `audio/<lang>.yaml`)
- Modify: `content/README.md` ("Recordings": the new fields)
- Test: `tests/narration.test.ts`, `tests/build.test.ts`

**Interfaces:**
- Produces: `export function passageHash(p: Passage, lang: Lang): string`. This is `sha256:` plus 16 hex digits of SHA-256 over `` `${p.id}\t${passageText(p, lang)}\n` ``, the same line format `narrationHash` uses.
- Produces the `audio/<lang>.yaml` format, all optional for old files:
  ```yaml
  narrator: { id: the-elder, version: 1 }
  passages: { void: sha256:…, theme: sha256:… }
  ```

- [ ] **Step 1: Write the failing tests.**
  - `tests/narration.test.ts`: `passageHash` matches `TEXT_HASH`, ignores whitespace, and changes with the words or the id.
  - `tests/build.test.ts`, with the fixture party given a recording (`audio/en.yaml` + a dummy `audio/en.mp3`, written in the case):
    - `per-passage stale warning`: `passages` holds the correct hash for one passage and a wrong hash for the other → a warning that names only the wrong passage id, containing `stale passage "<id>"`.
    - `narrator version stale`: `narrator: { id: the-voice, version: 0 }` while the narrator is at version 1 → a warning containing `recorded with the-voice v0, now v1`.
    - `narrator of another age`: `narrator.id` differs from the age's narrator → a warning containing `the age's narrator is`.
- [ ] **Step 2: Run** `npx vitest run tests/narration.test.ts tests/build.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `passageHash`, then the three checks in the recordings loop. Keep the existing `textHash` checks unchanged.
- [ ] **Step 4: Document** the two fields in `content/README.md`, "Recordings".
- [ ] **Step 5: Run** `npm test && npm run content`. Expected: pass.
- [ ] **Step 6: Commit** `git commit -m "Recordings name their narrator and hash each passage (#33)"`.

## Part B: pipeline

### Task 4: WAV and audio statistics (pure)

**Files:**
- Create: `scripts/narration/wav.ts`
- Test: `tests/wav.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Pcm { sampleRate: number; samples: Int16Array }   // mono
  export function parseWav(buf: Buffer): Pcm;                         // PCM s16le mono only; throws otherwise
  export function encodeWav(pcm: Pcm): Buffer;
  export function joinWithGaps(clips: Pcm[], gapSeconds: number): { pcm: Pcm; starts: number[]; duration: number };
  export interface AudioStats { duration: number; peakDb: number; rmsDb: number; longestInnerSilence: number; leadSilence: number }
  export function audioStats(pcm: Pcm, silenceDb?: number /* default -45 */): AudioStats;
  ```
  The first passage starts after one `gap` of lead-in, so `starts[0] = gapSeconds`. `starts[i]` is the second clip `i` begins, rounded to 3 decimals. `longestInnerSilence` ignores leading and trailing silence.

- [ ] **Step 1: Write the failing tests** with synthetic PCM built in the test (sine bursts and zeros, 24 kHz):
  - `parseWav(encodeWav(x))` round-trips.
  - `joinWithGaps` of clips 1.0 s and 2.0 s with gap 0.8 → `starts` `[0.8, 2.6]`, duration `4.4` (lead gap + clip + gap + clip, no trailing gap).
  - `audioStats`: a full-scale square wave → `peakDb ≈ 0`; a clip with 2 s of zeros in the middle → `longestInnerSilence ≈ 2`; leading zeros don't count as inner silence.
  - `parseWav` of a stereo header throws `mono`.
- [ ] **Step 2: Run** `npx vitest run tests/wav.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Read the RIFF chunks, walking them rather than assuming 44 bytes. Silence is detected over 20 ms windows of RMS.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "WAV joining and audio statistics for narration (#33)"`.

### Task 5: Passage checks (pure)

**Files:**
- Create: `scripts/narration/checks.ts`
- Test: `tests/checks.test.ts`

**Interfaces:**
- Consumes: `AudioStats` (Task 4).
- Produces:
  ```ts
  export interface CheckInput { sent: string; transcript: string; names: string[]; stats: AudioStats; medianWps?: number }
  export type Flag = { kind: 'words' | 'edges' | 'name' | 'pace' | 'length' | 'clipping' | 'silence' | 'quiet'; detail: string };
  export function normalizeWords(s: string): string[];       // lowercase, strip accents and punctuation
  export function wordErrorRate(ref: string[], hyp: string[]): number;
  export function checkPassage(c: CheckInput): Flag[];        // [] means passed
  export const LIMITS: { wer: 0.10; pace: 0.25; silence: 1.5; clipDb: -0.1; quietDb: -35; secPerChar: [0.04, 0.12] };
  ```
  `names` holds the pronunciation names in the passage's **original** text. A name passes if its normalised form, or its respelling's, appears in the transcript. `edges` flags a missing first or last reference word. Words per second are measured as reference words ÷ (duration − lead silence).

- [ ] **Step 1: Write the failing tests:**
  - an exact transcript → `[]`;
  - "and the world was real" missing at the end → `edges` + `words`;
  - `normalizeWords('Ilúvatar, the One')` → `['iluvatar','the','one']`;
  - a name missing from the transcript → `name`;
  - with `medianWps: 2.6` and a passage read at 3.6 wps → `pace`;
  - `peakDb: 0` → `clipping`; `longestInnerSilence: 2` → `silence`;
  - a 10-character text that lasted 5 s → `length`.
  
  The real case from the audition: candidate A said "And then he spoke one word, E, let it be" for a passage with `Eä`. With `names: ['Eä']` and no respelling, it must flag `name`.
- [ ] **Step 2: Run** `npx vitest run tests/checks.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Word error rate is the Levenshtein distance over words ÷ the reference length.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Automatic checks for narration passages (#33)"`.

### Task 6: Voice Studio client

**Files:**
- Create: `scripts/narration/voicestudio.ts`
- Test: `tests/voicestudio.test.ts` (a fake `fetch`; no network)

**Interfaces:**
- Produces:
  ```ts
  export interface SynthRequest { text: string; lang: Lang; voice: NarratorVoice; referenceWav: Buffer; seed: number }
  export interface Transcript { text: string }
  export interface VoiceStudio {
    synthesize(r: SynthRequest): Promise<Buffer>;   // WAV bytes
    transcribe(wav: Buffer, lang: Lang): Promise<Transcript>;
    version(): Promise<string>;                     // GET /health → .version
  }
  export function voiceStudio(opts?: { url?: string; key?: string; fetch?: typeof fetch; timeoutMs?: number }): VoiceStudio;
  ```
  - `synthesize` sends `POST /generate` as multipart with these fields: `text`, `language`, `ref_audio` (the reference as a file part), `ref_text`, `seed`, `speed`, `pronounce=false`, plus every entry of `voice.params`.
  - `transcribe` sends `POST /v1/audio/transcriptions` as multipart (`file`, `language`).
  - `Authorization: Bearer <key>` goes on every request when a key is set. The default timeout is 180 s.
  - The reference goes in as a WAV: decode the flac once per run with `ffmpeg -i ref.flac -f wav -`, in Task 7.

- [ ] **Step 1: Write the failing tests** with a recording fake `fetch`:
  - `synthesize` posts to `<url>/generate` with `pronounce=false`, `seed`, `speed: 0.9`, `ref_text`, and a file part;
  - it sends the bearer header when given a key, and omits it otherwise;
  - an error message never contains the key (fake a 500 response);
  - a non-200 throws with the status and the first 200 characters of the body.
- [ ] **Step 2: Run** `npx vitest run tests/voicestudio.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** with global `fetch`, `FormData` and `Blob`, using `AbortSignal.timeout`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Smoke test against the box** (manual, needs `VOICESTUDIO_API_KEY`): a short script call that synthesizes "Let it be." with the-elder and writes `out/smoke.wav`. Expected: a valid WAV of about 1–2 s. Don't commit it.
- [ ] **Step 6: Commit** `git commit -m "Voice Studio client for narration (#31)"`.

### Task 7: `narration:render`

**Files:**
- Create: `scripts/narration/render.ts` (the logic, exported for tests)
- Create: `scripts/narration/render-cli.ts` (argument parsing, real client, ffmpeg reference decode)
- Create: `scripts/narration/report.ts` (writes `out/narration/report.html`)
- Modify: `package.json` (`"narration:render": "node scripts/narration/render-cli.ts"`)
- Test: `tests/render.test.ts`

**Interfaces:**
- Consumes: `buildContent` (`narrators`, `pronunciation`, the index's ages), `respell`, `passageHash`, `parseWav`, `audioStats`, `checkPassage`, `VoiceStudio`.
- Produces:
  ```ts
  export interface RenderOptions { only?: string[]; age?: string[]; lang: Lang[]; changed: boolean; cacheDir: string; rejects: Set<string> /* "event/passage" */ }
  export interface Take { event: string; lang: Lang; passage: string; file: string; seed: number; tries: number; flags: Flag[]; transcript: string; stats: AudioStats }
  export function cacheKey(passageHash: string, narrator: { id: string; version: number }, used: string[], lex: Lexicon, lang: Lang): string; // 12 hex
  export async function render(content: BuildResult, vs: VoiceStudio, referenceWav: (n: Narrator, lang: Lang) => Buffer, o: RenderOptions): Promise<Take[]>;
  ```
  - Each take is cached at `out/narration-cache/<event>/<lang>/<passage>.<cacheKey>.wav`, with a `.json` next to it holding the `Take` minus `file`.
  - A take with its `.json` already present is reused and never re-requested, unless its `event/passage` is in `rejects`.
  - Seeds: try 1 uses `voice.seed`; retry k uses `voice.seed + 1000·k`. A rejected passage starts at the next unused retry seed.
  - `medianWps` for each narrator is computed over that narrator's passed takes in the cache, recomputed per run. Pace is skipped until a narrator has 5 takes.
  - Events are those whose age has a narrator with a voice in that language. `--changed` keeps only events whose recording is missing, or has a stale `passages`, `textHash` or narrator version.

- [ ] **Step 1: Write the failing tests**, with a fake `VoiceStudio` that returns generated sine WAVs and echoes the sent text as its transcript. Use a temp `cacheDir` and the fixture content (Task 1–3 fixture plus a narrator on third-age):
  - `renders every passage once`: two passages → 2 synth calls, 2 takes, all flags `[]`.
  - `respells before sending`: with lexicon `{ en: { Bilbo: 'BIL-bo' } }`, the fake sees `BIL-bo` in the text.
  - `re-renders only the changed passage`: run, then change one passage's English in the fixture copy and run again → 1 synth call.
  - `retries a flagged take with a new seed`: the fake transcript drops the last word on its first call only → 2 calls; the take has `seed = voice.seed + 1000` and `tries = 2`.
  - `gives up after 3 retries`: always drops words → 4 calls; the take is flagged with `tries = 4`.
  - `resumes after a failed call`: the fake throws on passage 2 → `render` rejects; on the next run the fake succeeds and sees exactly 1 call, for passage 2.
  - `reject re-renders a passed take`: `rejects` holds the passage → 1 call with a new seed.
  - `skips ages without a narrator voice in that language`: `lang: ['es']` → 0 calls.
- [ ] **Step 2: Run** `npx vitest run tests/render.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `render`** to pass the tests. Process passages one after another; the box has one GPU, so no parallel calls.
- [ ] **Step 4: Implement `report.ts`**: `writeReport(takes: Take[], outFile: string, sample: (narratorId: string) => number)`.
  - A static page in the style of `out/auditions/before-time/index.html`: an `<audio>` per take, with relative paths into the cache.
  - First every flagged take, with its flags and what was heard; then the random sample per narrator, using the sizes from Global Constraints.
  - At the top, a summary: rendered, reused, retried, flagged.
  - Footer: how to reject, by adding `event/passage` lines to `out/narration/rejects.txt` and running render again.
- [ ] **Step 5: Implement `render-cli.ts`.**
  - Flags: `--only`, `--age`, `--lang`, `--changed`, as `export.ts` parses them.
  - Check that `version()` equals each narrator voice's `engineVersion`; if not, warn.
  - Decode references with `ffmpeg`.
  - Read `out/narration/rejects.txt`, then write the report and print its path.
- [ ] **Step 6: Run** `npm test`. Expected: PASS.
- [ ] **Step 7: Commit** `git commit -m "narration:render: passage by passage on the Voice Studio, checked, with a listening report (#33)"`.

### Task 8: `narration:publish`

**Files:**
- Create: `scripts/narration/publish.ts` (logic) and `scripts/narration/publish-cli.ts`
- Modify: `package.json` (`"narration:publish": "node scripts/narration/publish-cli.ts"`)
- Test: `tests/publish.test.ts`

**Interfaces:**
- Consumes: the cached takes from Task 7 (read from the cache `.json` files), `joinWithGaps`, `encodeWav`, `passageHash`, `narrationHash`.
- Produces:
  ```ts
  export type Encoder = (wav: Buffer, outMp3: string) => Promise<void>;   // real: ffmpeg loudnorm I=-16, 128k mono
  export interface PublishResult { event: string; lang: Lang; duration: number; starts: Record<string, number>; written: boolean; blockedBy: string[] }
  export async function publish(content: BuildResult, o: { only?: string[]; age?: string[]; lang: Lang[]; accept: Set<string>; cacheDir: string }, encode: Encoder): Promise<PublishResult[]>;
  ```
  It writes `content/events/<age>/<folder>/audio/<lang>.mp3` and `<lang>.yaml`, the yaml holding `duration`, `starts`, `textHash`, `narrator: { id, version }` and `passages`. The duration is the joined WAV's length. Loudness normalisation must not change the length; if ffmpeg reports a different duration, fail. An event is blocked (`written: false`) when any passage has no current take, or a flagged take not in `accept`.

- [ ] **Step 1: Write the failing tests**, with a fake encoder that copies bytes and a temp copy of the fixture:
  - `writes timings that land each passage`: clips 1.0 s and 2.0 s, gap 0.8 → yaml `starts` `{ a: 0.8, b: 2.6 }`, `duration: 4.4`.
  - `the content build accepts what publish wrote`: after publishing, `buildContent(fixtureCopy)` has no errors and no stale warnings.
  - `blocked by a flagged take`: `written: false`, `blockedBy: ['the-party/b']`; with `accept` holding it, it writes.
  - `blocked by a missing take`.
  - `uses the narrator's gap`: `gap: 1.2` on the voice → `starts.a === 1.2`.
- [ ] **Step 2: Run** `npx vitest run tests/publish.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `publish`, then the CLI with the real ffmpeg encoder: `ffmpeg -y -f wav -i - -af loudnorm=I=-16:TP=-1.5:LRA=11 -ac 1 -ar 24000 -b:a 128k <out>`. Run `ffprobe` afterwards to check the duration within 0.05 s.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "narration:publish: assemble checked passages into a timed recording (#33)"`.

### Task 9: Record the Ainulindalë in English (with the author)

No new code. This is the first real batch, and it tunes the thresholds.

- [ ] **Step 1: Check the respelling of Eä.** Render only the `ea` passage with two or three candidate respellings (edit `content/pronunciation.yaml` between runs). The author listens and picks one. Remove the `# unheard` marks for names the author confirmed.
- [ ] **Step 2:** `npm run narration:render -- --only ainulindale --lang en`. Expected: 9 takes and a report path.
- [ ] **Step 3: The author listens** to the report: every flagged take plus the sample of 10. Reject takes as needed, and repeat Step 2 until the author is satisfied.
- [ ] **Step 4: Tune `LIMITS`** if the batch showed false flags. Every change gets a test case in `tests/checks.test.ts` built from the real numbers.
- [ ] **Step 5:** `npm run narration:publish -- --only ainulindale --lang en`, then `npm run content`. Expected: `✓ content is valid`, no stale warnings.
- [ ] **Step 6: Look at it.** Run `npm run preview` and play `#/event/ainulindale`. Each passage should begin as its moment arrives: screenshot at `?t=0.25`, `0.48`, `0.72`, `0.97` (CLAUDE.md, "Checking work").
- [ ] **Step 7: Commit** `audio/en.mp3`, `audio/en.yaml` and the pronunciation and limit changes: `git commit -m "Ainulindalë narration in English (#35)"`.

## Part C: site and docs

### Task 10: Audio language apart from reading language

**Files:**
- Create: `src/audioChoice.ts` (pure)
- Modify: `src/routes.ts` (an `audio` param on the event route and in `eventHref`)
- Modify: `src/eventClock.ts` (the constructor takes the audio language, `Lang | null`)
- Modify: `src/narration.ts` (the constructor takes the audio language)
- Modify: `src/main.ts`:
  - `state.audio`, parsed from the route
  - lines 173–174: build the clock and narration from `pickAudio`
  - line 442: show the picker
  - keep `?audio=` in `history.replaceState`
- Modify: `src/i18n.ts` (strings `audioLanguage`, `audioOff`, `audio_en`, `audio_es`)
- Modify: `index.html` (the picker element next to `muteBtn`), `src/style.css` (or wherever the HUD styles live)
- Test: `tests/audioChoice.test.ts`, `tests/routes.test.ts` (create it if missing)

**Interfaces:**
- Produces:
  ```ts
  // audio: what the visitor asked for (?audio=), undefined = "as reading language"
  export function pickAudio(available: Lang[], reading: Lang, asked?: Lang | 'off'): Lang | null;
  ```
  The rules, in order:
  1. `asked === 'off'` → `null`.
  2. `asked` is available → `asked`.
  3. `reading` is available → `reading`.
  4. `'en'` is available → `'en'`.
  5. Otherwise `null`.
- Route: `{ kind: 'event'; …; audio?: string }`. `eventHref(id, lang, { t?, follow?, audio? })` writes `audio` only when it is given. In-site links don't carry it: the choice is a view setting, kept only in the current URL.
- `new EventClock(event, audioLang: Lang | null)` and `new Narration(event, audioLang: Lang | null, clock)`. With `null`, the clock uses the staging duration, as it does today when a language has no recording.

- [ ] **Step 1: Write the failing tests:**
  - `pickAudio(['en'], 'es')` → `'en'`;
  - `pickAudio(['en','es'], 'es')` → `'es'`;
  - `pickAudio(['en','es'], 'es', 'en')` → `'en'`;
  - `pickAudio(['en'], 'es', 'es')` → `'en'` (asked for a language the event lacks);
  - `pickAudio([], 'en')` → `null`;
  - `pickAudio(['en'], 'en', 'off')` → `null`;
  - `parseRoute('#/event/ainulindale?lang=es&audio=en')` has `audio: 'en'`;
  - `eventHref('x', 'es', { audio: 'en' })` is `'#/event/x?audio=en&lang=es'`;
  - `tests/eventClock.test.ts`: `new EventClock(ev, null)` has `duration === ev.durationSeconds`.
- [ ] **Step 2: Run** `npx vitest run tests/audioChoice.test.ts tests/routes.test.ts tests/eventClock.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `pickAudio`, the route param, and the constructor changes. Update existing callers: pass `pickAudio(...)` wherever `state.lang` went in before.
- [ ] **Step 4: Add the picker in `main.ts`.**
  - A small `<select>` (or a cycle button like the language toggle) listing `event.audio` languages by `ui('audio_<lang>')`, plus `ui('audioOff')`. Hide it when the event has no recordings.
  - Changing it rebuilds the clock and narration and keeps the playhead at the same `t`: convert with `secondsAt` on the new clock. Then call `replaceState` with `audio`.
  - The text keeps following `state.lang`. Merge the mute button into the picker as the `off` choice, or keep it, whichever is simpler in the HUD.
- [ ] **Step 5: Run** `npm test && npm run build`. Expected: pass.
- [ ] **Step 6: Look at it.** Run `npm run preview` and open `#/event/ainulindale?lang=es`. Expected: English audio plays, Spanish text follows it passage by passage, the picker shows English and off, and switching to off keeps `t`. Take screenshots with Playwright (`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`).
- [ ] **Step 7: Commit** `git commit -m "Hear one language, read another: ?audio= and an audio picker (#14)"`.

### Task 11: Docs

**Files:**
- Modify: `docs/DESIGN.md`:
  - §5: narrators per age; generation passage by passage; checks; render and publish
  - §6: audio language apart from reading language, with the fallback order
  - §11: decision log rows dated 2026-11-10
- Modify: `CLAUDE.md`:
  - Decisions table: narrator per age, not per book or character; audio language apart from text; reference samples in the repo
  - Setup: `narration:render` and `narration:publish`
  - Architecture: the new `scripts/narration/*` files and `src/audioChoice.ts`
- Modify: `content/README.md` (a "Narrators" section and a "Pronunciation" section)
- Create: `docs/LOCAL.md`, the Voice Studio part of #31:
  - the env vars (`VOICESTUDIO_URL`, `VOICESTUDIO_API_KEY`); where to find them is in the author's homelab notes
  - the slow warm-up, and starting the box first
  - installing `ffmpeg`
  - the narrator chosen for Before Time, and how to audition a new one (§4.3)

- [ ] **Step 1:** Write the changes above, in the docs' existing voice: short, plain, the why next to each decision.
- [ ] **Step 2: Run** `npm run build && npm test`. Expected: pass.
- [ ] **Step 3: Commit** `git commit -m "Docs: narrators, the Voice Studio pipeline, audio apart from text"`.

---

## Not in this plan (needs the author first)

- **Third Age narrator:** an audition like Before Time's (§4.3), then the same steps as Task 9 for the Unexpected Party and Roast Mutton. It clears the warning Task 1 allows.
- **Spanish narrators:** after #34's choice between Castilian and Latin American Spanish.
