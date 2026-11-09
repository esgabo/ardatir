# Ardatir: guidance for working in this repo

Ardatir (*a watch over Arda*, AR-da-teer) is a static website that animates the events of Tolkien's world as low-poly isometric dioramas. Visitors travel through space and time: they begin in the Void with the Ainulindalë, zoom into the ages, and into single events, each told by synchronized narration. Cross-views show what else is happening at the same moment, and how characters' lives cross.

The work runs in three phases: **content** (all events, characters, places, journeys and scripts as data in `content/`), then the **platform** (the site, HUD, navigation, cross-views; the time cursor first), then **event production** (terrain, staging, animation, sound, one event at a time).

**The goal: people should be amazed, and feel good learning these stories.** Prefer beauty, warmth, clarity and accuracy over adding features.

The full design is in [`docs/DESIGN.md`](docs/DESIGN.md). Read it before changing how navigation, the timeline or narration work, and keep it up to date when those decisions change.

## Setup

```sh
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + static build into dist/
npm run preview    # serve dist/ at http://localhost:4173
npm run content    # validate content/ and write public/data/ (dev and build also do this)
npm test           # vitest: calendar, best guesses, event clock, content validation (tests/)
npm run narration:export   # narration scripts for the Voice Studio → out/narration/ (--only <event>, --lang es, --changed)
```

Requires Node 22. Deployed to GitHub Pages by `.github/workflows/deploy.yml` on pushes to `main`.

## Decisions (and why)

| Decision | Why |
|---|---|
| **Static site**, no backend | Free hosting, nothing to maintain. Anything needing a server (accounts, comments) is out of scope for now. |
| **Plain Vite + TypeScript + three.js, no UI framework** | Kept simple on purpose. Don't add React/Svelte/Astro without asking. |
| **Three zoom levels**: cosmos → world → event diorama | The cosmos (Arda floating in its shells, per the *Ambarkanta*) is the front door; the Ainulindalë is the first event. |
| **Low-poly faceted diorama style** | Faceted terrain with cut earth sides; characters and trees slightly higher-poly than terrain. |
| **Film-like proportions, simplified faces** for characters | Low-poly with enough detail to look good; no enlarged heads; faces kept simple, expression through posture and animation. Relative heights come from `Character.scale`. |
| **Characters modelled in Blender, exported as glTF**, with shared rigs per body type | The look the project needs can't come from code primitives. Today's figures and terrain are placeholders (`docs/DESIGN.md` §9). |
| **Start with *The Hobbit*** for event dioramas | First book to cover end to end. |
| **English default, Spanish second** | Every content text is `LocalizedText` (`{ en, es? }`); `en` is required. |
| **Narration = our own script**, shown on screen in sync with the animation and optional audio | Audio files are provided per event and language; how they are produced is outside this project (the author uses a Voice Studio in a homelab). |
| **Non-commercial fan project** | No ads, merchandise or paywalls. See IP rules below. |
| **Content in `content/` as YAML, one file per thing, linked by id** | Clean diffs, no conflicts, scales to hundreds of events. Lists like "a character's events" are derived by the build, never written by hand. |
| **Translations inline** (`en:` and `es:` side by side) | Gaps are obvious and the build counts them. |
| **Small, single-scene events grouped into arcs** | The cross-views only work if events are small. "Battle of the Pelennor Fields" is an event; "The War of the Ring" is an arc. |
| **Content separate from staging** | `event.yaml` + `narration.yaml` say what happened; `staging.yaml` says how it's animated. Writing and animating are separate jobs. |
| **Status pipeline**: outline → scripted → staged → animated | Lets the phases overlap; the build checks each event has the files its status claims. |
| **One shared time axis** with date precision; typed links; journeys for whereabouts | Powers the time cursor ("what's happening now") and character lanes ("where their lives cross"). |
| **Time cursor is the first platform feature**, then character lanes | Decided 2026-11-08. |
| **Navigation is a collapsible left sidebar** (icon rail + panel: Ages, Stories, Lives, Books, Places), not dropdowns | Keeps the 3D stage clear while making every way in visible. Fantasy look kept light: a few small ornaments, no textures. See `docs/DESIGN.md` §3.3. Decided 2026-11-09. |
| **"Likely at the same time" is a labelled, explained guess**: never for two scenes sharing a character (unless linked `concurrent`/`crossing`); otherwise best guesses within ±3 / ±15 / ±45 days for day / month / season (the vaguer of the two); never for a year or vaguer | Story order already says which of a character's scenes comes first; a fixed window was too loose for vague dates (the secret door "during" Lake-town, #2). Gap-to-anchors was hard to explain, exact-only made "likely" vanish. Every guess records why it landed there (`atReason`) and the site says so in words. See `docs/DESIGN.md` §4.4.1. Decided 2026-11-09. |

## Architecture

```
content/             THE SOURCE OF TRUTH (YAML); see content/README.md
  ages/ characters/ places/ arcs/ journeys/ factions/
  events/<age>/<sort-key>-<id>/  event.yaml, narration.yaml, staging.yaml, audio/<lang>.{mp3,yaml}
scripts/content/
  build.ts           load + validate content/, place on the time axis, reverse links, lookups, character lanes
  cli.ts             `npm run content`
tests/               `npm test` (vitest); fixtures/valid/content/ is a tiny valid content tree
scripts/narration/
  export.ts          `npm run narration:export`: scripts per event and language for the Voice Studio
  text.ts            a passage's text per language and the `textHash` that marks a recording stale
vite.config.ts       runs the content build on start (fails `npm run build` on errors) and on change in dev
public/data/         GENERATED (gitignored): index.json, events/<id>.json, scripts/<id>.json, audio/<id>/<lang>.mp3
src/
  data/types.ts      the compiled data model the site loads (EventSummary, EventDetail, ContentIndex)
  data/calendar.ts   the shared time axis: dates → spans, precision, overlaps (used by build and site)
  chronicle.ts       loads index.json at startup and each event's detail when opened
  eventClock.ts      ONE clock for animation, narration text and audio
  narration.ts       plays the optional recording, following the clock
  i18n.ts            languages, fallbacks, interface strings
  timeline.ts        samples character tracks (pose, thought) at time t
  scene/stage.ts     the Stage interface every zoom level implements
  scene/cosmos.ts    the Ainulindalë and Arda with its shells
  scene/dioramaStage.ts, diorama.ts, figure.ts   event dioramas
  sidebar.ts         the collapsible sidebar: rail + panel views built from the index
  reader.ts          an event's page, for events that can't be watched yet (DESIGN §3.4)
  lanes.ts           character lanes: lives side by side, crossings, kin suggestions (DESIGN §3.2)
  laneRows.ts        the lanes as rows (story order, legs, gaps), search ranking, initials: pure, tested
  routes.ts          parse the URL, build every in-site href
  format.ts          honest dates in words (labels only; the math is in calendar.ts)
  related.ts         an event's links and what overlaps it, likely vs possibly (Meanwhile, event pages)
  placement.ts       a best guess in words: how an event is placed (from atReason), why another is "likely"
  dom.ts, icons.ts   a tiny element builder; inline stroke SVG icons
  main.ts            app shell: routing, pages vs stage, playback loop, panels, breadcrumb, zoom switch, Meanwhile
```

### Rules the code depends on

- **Everything visible is a pure function of the event time `t` (0 → 1).** That is what makes scrubbing and deep links work. `ambient` seconds may only drive idle motion (shimmer, drift, bobbing), never story state.
- **The playhead runs in seconds of narration; `t` is derived** via `EventClock.tAt`. Seeking converts back with `secondsAt`. Never advance `t` directly.
- **Narration timing:** `staging.yaml` gives each passage's `t` (where it belongs in the animation); `audio/<lang>.yaml` gives the second it starts in that recording, keyed by passage id. The build turns both into ordered arrays, and the clock stretches the animation between those points.
- **Recordings carry a `textHash`** of the words they read (`audio/<lang>.yaml`); the build warns when `narration.yaml` no longer matches. Editing a recorded passage means re-recording it.
- **The URL is the state**: `#/event/<id>?t=&follow=&lang=` (a staged event's stage, any other event's page), `#/lives?with=a,b` (character lanes). New view state that matters should be added to the route (`src/routes.ts`); in-site links are plain hrefs from there.
- **New zoom levels or event kinds** implement `Stage` (`scene/stage.ts`) and are picked in `main.ts`'s `buildStage`, loaded there with a dynamic `import()` so each stage is its own chunk. Don't import a stage statically.
- **New languages:** add the code to `LANGS` in `data/types.ts`, then the interface strings in `i18n.ts`. Missing content falls back to English.
- **Never edit `public/data/`**: it is rebuilt from `content/` every time.
- **Date math lives in `src/data/calendar.ts` only.** Spans are widened by precision (a `year` date covers the whole year): that's the honest range.
- **Story order is the folder sort key** (age, then key), never the dates. Keys are numeric `YYYY-MM-DD-n`, seasons written as a month (summer `07`, autumn `09`).
- **`at` is a best guess, not a date.** The build places vague events between exact-dated anchors in their characters' lanes, in story order, never before what they follow or are caused by (`estimatePositions`, `estimateWaypoints` in `scripts/content/build.ts`). Each guess records why it landed there (`atReason`: kind, anchors, lane, window). The site may use it to place and to say "likely", but states only the honest range and explains the placement in words (`src/placement.ts`). "Likely" vs "possibly" is decided only by `nearness` / `nearnessAt` in `calendar.ts` (DESIGN §4.4.1).
- **Links are written once.** The build adds the reverse (`enabled-by` ↔ `enables`, `caused-by` ↔ `causes`; `concurrent` and `crossing` are symmetric) and marks it `reverse: true`.

## Writing content

See [`content/README.md`](content/README.md) for the file formats and a template.

- **One event = one scene.** If it has several places or several days of distinct action, split it and group the pieces with an arc.
- **Link what time can't show**: `enabled-by` / `caused-by` for consequences, `concurrent` for parallel action elsewhere. Don't link events just because they're close in time; the time cursor finds those.
- **Every event gets `when` with an honest `precision`.** Only timeless ages (before the world) have none. When unsure of a season, claim only the year and add a comment saying why. A strong text cue may justify more ("just before June" → May), with the cue in a comment.
- **Name the folder by story order**, then check the build's ordering warnings.
- **Journeys follow who travels together.** Split them where companions part (Gandalf leaves the dwarves at Mirkwood).
- **Our own words only.** Summaries, thoughts and narration are original paraphrase. No reading Tolkien's text aloud, and quotations at most a few words, rarely. When an in-character line drifts close to the book's wording, rephrase it.
- **Names follow published translations** in each language (Bilbo Bolsón, Bolsón Cerrado, Thorin Escudo de Roble, Guillermo). When you can't confirm a Spanish term against the published edition, use your best guess and add it, with every file that uses it, to the checklist in issue [#51](https://github.com/esgabo/ardatir/issues/51).
- **Cite, don't quote:** `source: { book, chapter }` is for checking accuracy.
- **Narration passages** are short (one to three sentences) and placed at the animation moment they describe. Keep the beat markers (`beats`) aligned with them.
- **Every text needs `en`**; add `es` alongside it when writing new content.

## IP rules (fan project)

- Maps, models, terrain and art are **original**. Published maps (Christopher Tolkien's, Pauline Baynes') may be looked at as reference, never traced, scanned or used as layers.
- **No imagery or likenesses** from the films or series (Jackson, Rings of Power), including character designs.
- Reference images shared during design (e.g. fan art of Arda's cosmology) are inspiration only, never assets.
- **No cloned voices** of real actors in narration.
- Keep the disclaimer in the site footer and README.

## Checking work

- `npm run content` must show `✓ content is valid`, and `npm run build` must pass (it typechecks, then fails on content errors).
- `npm test` must pass; the deploy workflow runs it before building. New validation rules get a broken case in `tests/build.test.ts` (each one a small change to the fixture in `tests/fixtures/valid/content/`), and date math gets a case in `tests/calendar.test.ts`.
- After adding content, check the warnings too: missing Spanish, characters in no event, events outside their journey's dates, a sort key that contradicts the dates, a best guess that lands before what it follows.
- For visual changes, look at the result: run `npm run preview` and screenshot key moments with Playwright, e.g. `#/event/ainulindale?t=0.25`, `?t=0.48`, `?t=0.72`, `?t=0.97`, and `#/event/roast-mutton?t=0.45&follow=bilbo&lang=es`. Headless Chromium needs `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` for WebGL.
- When touching `eventClock.ts`, check that a recording with uneven `starts` still lands each passage on its `t`, and that the playhead reaches `t = 1` at the recording's `duration` (`tests/eventClock.test.ts` covers both).
- Don't commit test audio or placeholder recordings.

## Open questions

- Do long journeys (Frodo's road to Mordor) play only on the world map as a moving path, or do some legs get their own dioramas?
- The world view (middle zoom level) isn't built yet; places have no map coordinates until the original world map exists.
- Factions format, to be defined with the first staged battle.
