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
npm run graph      # the stories content/ knows but doesn't tell yet → out/graph.md
npm test           # vitest: calendar, best guesses, event clock, armies, content validation (tests/)
npm run narration:export   # narration scripts for the Voice Studio → out/narration/ (--only <event>, --lang es, --changed)
npm run narration:render   # render passages on the Voice Studio, check them, write out/narration/report.html (--only, --age, --lang, --changed)
npm run narration:publish  # join checked takes into audio/<lang>.mp3 + .yaml (--accept <event>/<passage> for a flagged take you listened to)
npm run model:pack -- <export.glb> characters/<id>/<id>.glb   # meshopt-compress a Blender export into assets/ (docs/MODELS.md)
```

Requires Node 22. Recording narration also needs `ffmpeg` and the homelab Voice Studio. What a machine needs for `runs:local` issues (Blender, the Voice Studio, devices) is in [`docs/LOCAL.md`](docs/LOCAL.md). Deployed to GitHub Pages by `.github/workflows/deploy.yml` on pushes to `main`.

## Decisions (and why)

| Decision | Why |
|---|---|
| **Static site**, no backend | Free hosting, nothing to maintain. Anything needing a server (accounts, comments) is out of scope for now. |
| **Plain Vite + TypeScript + three.js, no UI framework** | Kept simple on purpose. Don't add React/Svelte/Astro without asking. |
| **Three zoom levels**: cosmos → world → event diorama | The cosmos (Arda floating in its shells, per the *Ambarkanta*) is the front door; the Ainulindalë is the first event. |
| **Low-poly faceted diorama style** | Faceted terrain with cut earth sides; characters and trees slightly higher-poly than terrain. |
| **Film-like proportions, simplified faces** for characters | Low-poly with enough detail to look good; no enlarged heads; faces kept simple, expression through posture and animation. Relative heights come from `Character.scale`. |
| **Characters modelled in Blender, exported as glTF**, with shared rigs per body type | The look the project needs can't come from code primitives. Today's figures and terrain are placeholders (`docs/DESIGN.md` §9). |
| **Models in `assets/`, meshopt-compressed `.glb`, within a size budget; no Git LFS** (`assets/characters/<id>/<id>.glb`, `.blend` beside it, never deployed; `model:` on characters, per-event on tracks) | GitHub Pages doesn't serve LFS, so models live in git and must stay small (characters ≤ 300 kB, kits ≤ 800 kB, props ≤ 100 kB: `MODEL_BUDGETS` in `scripts/content/models.ts`). Meshopt over Draco: a smaller decoder. The placeholder figure stays while loading or without a model. Export settings and conventions in [`docs/MODELS.md`](docs/MODELS.md). Decided 2026-11-09 (#20). |
| **Start with *The Hobbit*** for event dioramas | First book to cover end to end. |
| **English default, Spanish second** | Every content text is `LocalizedText` (`{ en, es? }`); `en` is required. |
| **Narration = our own script**, shown on screen in sync with the animation and optional audio | Every event works muted; a recording is a layer on top. |
| **One narrator per age** (and per audio language), not per book or character; events read as history | We tell the history of the whole world, not each book's intent: *The Hobbit* and *The Lord of the Rings* share the Third Age narrator. A voice is designed once at audition, then cloned from our own reference sample, committed in `content/narrators/` so any checkout can re-record (published recordings are public anyway). See `docs/DESIGN.md` §5. Decided 2026-11-10. |
| **Recordings come from the pipeline**: rendered passage by passage on the homelab Voice Studio, checked automatically, spot-listened, published with exact starts | Hearing every second of every event can't scale; statistics plus a sample can. Passage by passage gives exact timings and re-renders only what changed. Decided 2026-11-10. |
| **The audio language is apart from the reading language** (`?audio=`) | Text and voices ship on their own schedules: read Spanish, hear English until the Spanish narrator exists. Decided 2026-11-10. |
| **Non-commercial fan project** | No ads, merchandise or paywalls. See IP rules below. |
| **Content in `content/` as YAML, one file per thing, linked by id** | Clean diffs, no conflicts, scales to hundreds of events. Lists like "a character's events" are derived by the build, never written by hand. |
| **Translations inline** (`en:` and `es:` side by side) | Gaps are obvious and the build counts them. |
| **Small, single-scene events grouped into arcs** | The cross-views only work if events are small. "Battle of the Pelennor Fields" is an event; "The War of the Ring" is an arc. |
| **Content separate from staging** | `event.yaml` + `narration.yaml` say what happened; `staging.yaml` says how it's animated. Writing and animating are separate jobs. |
| **Status pipeline**: outline → scripted → staged → animated | Lets the phases overlap; the build checks each event has the files its status claims. |
| **One shared time axis** with date precision; typed links; journeys for whereabouts | Powers the time cursor ("what's happening now") and character lanes ("where their lives cross"). |
| **Time cursor is the first platform feature**, then character lanes | Decided 2026-11-08. |
| **A covered place lifts its cover away** (`reveal` in `staging.yaml`, `cover-<name>` objects in the kit), rising and fading together like the lid off a doll's house | Measuring the sight lines into Bag End showed the blocker was the Hill itself — three metres of turf over the rooms — not the architecture under it. Building indoor places open would cost them their silhouette, and a hobbit-hole without its hill is not a hobbit-hole, so the diorama opens instead: the turf and the vaults lift, the front bank with its round door and the cut earth face stay. The author says when, never the camera, for the same reason the framing is authored. See `docs/DESIGN.md` §9.4. Decided 2026-11-17 (#28). |
| **The author frames each beat** (`camera` in `staging.yaml`: where the view looks and how much ground it holds, eased between keys), rather than the stage fitting itself to the figures | One fixed wide shot of the whole tile made interiors unwatchable, so scenes migrated outdoors to be seen: the Unexpected Party queued up the garden path while Bag End's dressed rooms stood empty. An automatic fit would make the shot a consequence of the blocking; framing first lets the blocking serve the shot. The visitor's own pan and zoom survive as an offset from it. See `docs/DESIGN.md` §9.3. Decided 2026-11-16 (#28). |
| **Where a figure stands is the staging's word**: a keyframe's `y` says how high above the walkable ground they are (a log, a bench, a doorstep), and two figures in one spot is a build warning, never a push-apart at render time | A kit's `terrain` is one height per (x, z) and is the right thing to raycast — low-poly, one mesh, and it can't put a character on a table top by accident — but it runs underneath everything the kit builds on it, so a figure placed at a seat was buried in it. Separating figures at render time would make a figure's place depend on the other figures rather than on `t`, which is what scrubbing and deep links rest on; composition is the author's. There is no sitting pose yet, so a seat is a place to stand beside. See `docs/DESIGN.md` §9.2. Decided 2026-11-15 (#81). |
| **The world's sound is synthesized, never sampled**: a place's ambience is a pure function of the place and the hour (`src/sound/scape.ts`, the same `Light.lamps` that lights the windows), footsteps come free from the gait, and everything else the story does is authored at a `t` in `staging.yaml`'s `sound`, from a closed vocabulary | Original by construction, like the maps and the models: no licence to track, no credits list to keep true, and nothing in a repository that cannot use Git LFS. A few shapes of noise and filter, the way the terrain is a few flat faces. Deciding the sound once per place means every staged event in it is heard without authoring, and two events in one place agree. A place nobody has listened for is silent, as an ungraded place is `plain`: the cosmos makes no sound, because what the Music sounds like is a decision somebody should make on purpose. No music yet. See `docs/DESIGN.md` §9.5. Decided 2026-11-25 (#27). |
| **The render look is graded light, not post-processing** (`scene/grade.ts`): a place tints the sun, sky, background and haze; a soft second light comes up as the sun goes down so a night scene can be seen; haze tints toward the background, never a bright sky; contact shadows under figures; one `quality` setting turns the shadow map, pixel ratio and effect counts down together (`?quality=`) | A post pass is a second render of the frame, its own chunk and the first thing to fail on a phone, and it can drift out of step with the shadows. Graded light costs nothing and stays a pure function of `t` and the place. A dark field is what makes a diorama read as a made object, so the background takes only a third of a place's tint. See `docs/DESIGN.md` §9.1. Decided 2026-11-15 (#76). |
| **Navigation is a collapsible left sidebar** (icon rail + panel: Ages, Time, Stories, Lives, Books, Places), not dropdowns | Keeps the 3D stage clear while making every way in visible. Fantasy look kept light: a few small ornaments, no textures. See `docs/DESIGN.md` §3.3. Decided 2026-11-09. |
| **"Likely at the same time" is a labelled, explained guess**: never for two scenes sharing a character (unless linked `concurrent`/`crossing`); otherwise best guesses within ±3 / ±15 / ±45 days for day / month / season (the vaguer of the two); never for a year or vaguer | Story order already says which of a character's scenes comes first; a fixed window was too loose for vague dates (the secret door "during" Lake-town, #2). Gap-to-anchors was hard to explain, exact-only made "likely" vanish. Every guess records why it landed there (`atReason`) and the site says so in words. See `docs/DESIGN.md` §4.4.1. Decided 2026-11-09. |
| **Factions are one file per side** (`content/factions/`: name, banner colour, kind, summary, leaders), reused across battles; a battle's `sides` are groups of allied factions; staging places `armies` (faction, size, keyframes) as blocks of small figures in the faction's colour | Pages and the time cursor can say who fought whom, battles are findable by faction, and a diorama can show hosts without giving every soldier a track. Named characters keep their own tracks and lead them. One being who comes alone (Beorn) is a character, a host (the Eagles) a faction. See `docs/DESIGN.md` §2 (battles) and §4.9. Decided 2026-11-09 (#18). |
| **The time cursor is a page at a readable moment** (`#/time/third-age/3019-03-15`, `…/3019`, `…/before-time`): the ages as log-width segments (timeless ones apart, before the axis) and a finer scale down to a day; likely / possibly by `nearnessDuring`; whereabouts from journeys by company, honest first | Ages differ a hundredfold in length, so each needs room; a moment is said exactly as precisely as it was picked; "somewhere between" when the sources allow several stops, with our guess labelled. See `docs/DESIGN.md` §3.1. Decided 2026-11-09. |
| **What is foretold is its own timeless age, after the Fourth Age** (`content/ages/foretold.yaml`, `foretold: true`): the Dagor Dagorath and the Second Music, never on the dated axis; every event in it cites its `source` and may name who foretold it (`foretoldBy`); marked as prophecy wherever it appears (a *Foretold* badge, *Foretold by Mandos, not told as history. Source: …* on its page, a dashed segment after the axis) | Prophecy must never read as history. The flag lives on the age so no event can forget it. We tell the fuller version from *The History of Middle-earth* (the 1937 *Quenta Silmarillion*, *The Lost Road*), one scene per event, so its strongest moments can each be animated. See `docs/DESIGN.md` §4.8. Decided 2026-11-09 (#57). |
| **Wonder and learning** (#29): a first visit to the front door opens with a short guided opening over the Ainulindalë (`#/start`), then three ways in (a story, a moment, a life); skippable at once, shown once per visitor (localStorage), reopened from the sidebar's *Start here*. Hard names carry `pronounce: { en, es }` in the *AR-da* style; the stage has *About this scene*; event pages point to the book and chapter | A newcomer needs a door and a hand, not a control panel; nothing else appears unasked. Respellings per language, because English and Spanish readers sound letters differently. See `docs/DESIGN.md` §3.5. Decided 2026-11-09. |
| **Places carry map coordinates** (`map: { on, x, z }`, optional `radius`; `docs/MAP.md`): four maps with their origin at a landmark the books measure from (Bree, the gates of Angband, Tirion, Armenelos), ground plane x/z, +x east, +z south, one unit ten miles; a place on no frame we draw says `map: nowhere` | The world view was blocked on one missing field. Coastlines change and Beleriand sinks, so one frame can't hold every age. Origins at measured-from landmarks make a new place hand-authorable: nearly every distance in the texts is quoted from Bree or from Angband. Ten miles per unit means a whole number is already as precise as the sources. **The published maps are never shipped, traced or scanned**: relative position is fact and only the drawing is anyone's, so we author numbers read off them as reference and our own geometry replaces the look later at the same coordinates. Decided 2026-11-26 (#88). |
| **An arc can tell its own story over the map** (`arcs/<id>/` with `arc.yaml` + `narration.yaml` + `staging.yaml`): `hosts` (a body of people as a `mark`, weighted 1–5, never a troop count) and `roads` (a journey painted along its waypoints); scenes pinned from their places; no `light`, `sound` or `reveal` at map scale, and arcs stay off the time axis | The world level was a floor to cross, not a place with anything to say, while a map-scale overview — how a war moved across a country — is by definition not one scene and so cannot be an event. Giving it to the arc makes the three zoom levels three scales of storytelling on the event machinery unchanged (one clock, passages at `t`, the authored camera). A weight rather than a count because we don't know how many orcs came over the mountains. An arc's `t` is narration time, not history: one passage covers four centuries and the next one night. A journey drawn as a road makes an untold leg read as a stretch of road with nothing on it. See `docs/DESIGN.md` §4.10. Decided 2026-11-26 (#88). |
| **A family tree is drawn from one authored edge, `parents`** (0–2 ids, order meaningless; `spouse` for couples, `kin` narrowed to a closed list for what descent can't say: fostering, an asserted descent across people we don't hold); siblings, cousins, uncles, generation depth and houses are **derived by the build, never authored**; birth and death come from an event's `born:`/`died:` or from the character, and must agree where both exist | `kin` recorded the derived relation instead of the primitive one, so nothing could place a cousin in a generation. A list rather than `father:`/`mother:` because characters have no gender field on purpose — Spanish takes gender from the relation word — and because "the sources never name her" and "we haven't written her file" must not be the same empty key. One layout with generation rows and no time axis: immortals break a time axis (Galadriel is contemporary with her great-great-nephews) and the lanes already own time. **Silence is silence**: no `died` draws no end, so an elf is never shown as dead, and `fate` says in one sentence a life that ended in something other than death. Appendix C's facts are readable as reference; its layout is not reproduced, down to the `=` between spouses. See `docs/DESIGN.md` §3.6 and §4.11. Decided 2026-11-26 (#89). |

## Architecture

```
content/             THE SOURCE OF TRUTH (YAML); see content/README.md
  ages/ characters/ places/ arcs/ journeys/ factions/ narrators/   pronunciation.yaml   (factions: sides in battles)
  places/<id>.yaml     `map:` coordinates on one of four maps: docs/MAP.md
  arcs/<id>.yaml       an arc that only groups scenes; it promotes to a folder the day it tells
  arcs/<id>/           an arc that tells its own story over the map: arc.yaml + narration.yaml + staging.yaml (+ audio/) (docs/DESIGN.md §4.10)
  events/<age>/<sort-key>-<id>/  event.yaml, narration.yaml, staging.yaml, audio/<lang>.{mp3,yaml}
assets/              models: characters/<id>/<id>.glb (+ .blend source), kits/<kit>/, props/<id>/; see docs/MODELS.md
scripts/content/
  build.ts           load + validate content/, place on the time axis, reverse links, lookups, character lanes
  arcs.ts            arcs: a flat grouping or a folder that tells over the map — `map`, `camera`, `scenes`, `hosts`, `roads`, the status against the files, every place on the arc's map (read and checked for build.ts)
  factions.ts        factions, a battle's `sides` and its staging `armies` (read and checked for build.ts); byFaction
  kin.ts             parentage: `parents`, `spouse`, `betrothed`, `twin`, the closed `kin` list, `born`/`died`/`fate`/`house` (read and checked for build.ts); derives children, siblings, half-siblings, generation depth and the houses into `index.family` (#89)
  models.ts          `model:` paths: exists, loadable .glb, MODEL_BUDGETS per asset type; copies into public/data/models/
  graph.ts           `npm run graph`: the content as a graph — untold journey legs, a life's scenes left unjoined, two parties in one place, lives in pieces, threads let go; an authoring report to out/graph.md, no site weight (#88)
scripts/models/
  pack.ts            `npm run model:pack`: gltfpack (meshopt) a Blender export into assets/, with the budget
  make-test-model.ts writes the fixture's test model (tests/fixtures/valid/assets/): tests only, never real content
  blender/           models built by script in headless Blender: lowpoly.py (parts), hobbit_rig.py, wizard_rig.py, dwarf_rig.py, troll_rig.py, tallfolk_rig.py (rigs and clips per body type), bilbo.py, gandalf.py, elrond.py, dwarves.py (the thirteen), trolls.py (living and stone), kit.py (what every tile shares: terrain, plinth, palette, roofs, decor helpers), shire.py (Bag End's tile), bywater.py (Bywater and the Green Dragon) trollshaws.py (the trolls' fire in the wood), beorn.py (the hall in its courtyard among the bee-pastures) and rivendell.py (the Last Homely House above the Bruinen), turnaround.py and lineup.py (review renders)
  cli.ts             `npm run content`
tests/               `npm test` (vitest); fixtures/valid/content/ is a tiny valid content tree
scripts/narration/
  export.ts          `npm run narration:export`: scripts per event and language for the Voice Studio
  text.ts            a passage's text per language; `textHash` and `passageHash` that mark a recording stale
  render.ts, render-cli.ts   `npm run narration:render`: passages on the Voice Studio, cached, checked, retried
  publish.ts, publish-cli.ts `npm run narration:publish`: checked takes → audio/<lang>.mp3 + .yaml
  voicestudio.ts     the Voice Studio client (clone a narrator's reference, transcribe)
  checks.ts          the automatic checks on a take: words, names, pace, length, clipping, silence (pure)
  wav.ts             WAV in/out, joining with gaps, audio statistics (pure)
  pronounce.ts       respelling names from content/pronunciation.yaml (pure)
  report.ts, ffmpeg.ts       the listening page; ffmpeg for the CLIs only
vite.config.ts       runs the content build on start (fails `npm run build` on errors) and on change in dev
public/data/         GENERATED (gitignored): index.json, events/<id>.json, arcs/<id>.json, scripts/<id>.json (an arc's is scripts/arc/<id>.json), audio/<id>/<lang>.mp3 (an arc's is audio/arc/<id>/<lang>.mp3), models/<path>.glb
src/
  data/types.ts      the compiled data model the site loads (EventSummary, EventDetail, ContentIndex)
  data/calendar.ts   the shared time axis: dates → spans, precision, overlaps (used by build and site)
  chronicle.ts       loads index.json at startup and each event's detail when opened
  eventClock.ts      ONE clock for animation, narration text and audio
  narration.ts       plays the optional recording, following the clock
  sound/scape.ts     what a place sounds like at an hour: the ambience layers, by place and `Light.lamps`: pure, tested
  sound/cues.ts      the one-shots between two moments: footsteps off the gait, and the staging's own `sound` keys: pure, tested
  sound/engine.ts    the sound itself: noise, filters and envelopes in the Web Audio API (its own chunk, no recordings)
  audioChoice.ts     which recording plays: asked for (?audio=), else the reading language, else English
  i18n.ts            languages, fallbacks, interface strings
  timeline.ts        samples character tracks (pose, thought, height stood at) at time t; cross-fades, heading and gait pace between poses; `crowding`, the build's check for two figures in one spot: pure, tested
  scene/stage.ts     the Stage interface every zoom level implements
  scene/cosmos.ts    the cosmos stage: picks the event's animation; the Ainulindalë
  scene/cosmosWorld.ts   what every cosmos event shares: the Void, Arda's shells, stars, lights, camera
  scene/cosmosLamps.ts   the Spring of Arda: the two Lamps, Almaren, their fall (its own chunk)
  scene/cosmosTrees.ts, cosmosSunMoon.ts, cosmosBeleriand.ts, cosmosRound.ts   the Two Trees, the first Moon and Sun, Beleriand drowned, the world made round (each its own chunk)
  scene/cosmosLands.ts   what those four share: the map on the slab by age, the bendable Slab, forests, the Two Trees
  scene/cosmosForetold.ts   what is foretold shares (DESIGN §4.8): the dream register, the round world as a Globe that breaks and is made again, the Silmarils
  scene/cosmosLightsOut.ts, cosmosJewels.ts, cosmosRekindled.ts, cosmosLevelled.ts, cosmosSecondMusic.ts   the Sun and Moon destroyed, the Silmarils recovered, the Trees rekindled, the Pelóri levelled, the Second Music (each its own chunk)
  scene/dioramaStage.ts, diorama.ts, figure.ts   event dioramas (figure.ts: the placeholder, swapped for a model by useModel)
  scene/models.ts    glTF models: GLTFLoader + meshopt, cached per URL, scaled to Character.scale, clips set from t (its own chunk)
  scene/modelClips.ts   which clip plays for a pose, and its time at t: pure, tested
  scene/sets.ts      an event's set (staging `set`, a kit): the tile from Blender, glowing lamps, doors that open, smoke, spray, fireflies
  scene/reveal.ts    how far each of a set's covers has lifted at t (staging `reveal`): pure, tested
  scene/framing.ts   how a scene is framed at t (staging `camera`): where the view looks, how much ground it holds; the app glides onto it, keeping the visitor's pan and zoom: pure, tested
  scene/lighting.ts  the light at t (staging `light`): presets dawn to night, blended between keys; each carries its sun, sky, haze and the soft second light that keeps a night scene readable: pure, tested
  scene/grade.ts     the grade of a place (Shire warm, Mirkwood oppressive, Lake-town grey): applied to the light, not the pixels: pure, tested
  scene/quality.ts   how much render this device gets: shadow map, pixel ratio, effect counts; `?quality=`: pure, tested
  scene/contact.ts   the soft dark disc under each figure: what tells the eye the scale (lifted just clear of a kit's lawn and paving)
  scene/armies.ts    a battle's armies: instanced blocks of small figures in their faction's colour, banners (pure in t)
  sidebar.ts         the collapsible sidebar: rail + panel views built from the index
  reader.ts          an event's page, for events that can't be watched yet (DESIGN §3.4)
  lanes.ts           character lanes: lives side by side, crossings, kin suggestions (DESIGN §3.2)
  laneRows.ts        the lanes as rows (story order, legs, gaps), search ranking, initials: pure, tested
  kinGraph.ts        the parentage graph: siblings, half-siblings, ancestors, descendants, cousins, uncles, generation depth, the nearest common ancestor, the houses: pure, tested
  timeCursor.ts      the time cursor page: the ages, the finer scale, likely / possibly, where everyone is (DESIGN §3.1)
  moment.ts          a moment: readable URL path ⇄ date and precision, its span, an event's moment: pure, tested
  timeAxis.ts        the control as data: age segments, scales and ticks, picking, keyboard steps: pure, tested
  whereabouts.ts     where everyone is at a moment, from journeys, grouped by company; `home` for those who stay: pure, tested
  moments.ts         the "moments to visit" shortcuts
  routes.ts          parse the URL, build every in-site href
  format.ts          honest dates in words (labels only; the math is in calendar.ts)
  sides.ts           a battle's sides in words, with banner-colour chips (pages, event card, time cursor, search)
  related.ts         an event's links and what overlaps it, likely vs possibly (Meanwhile, event pages)
  placement.ts       a best guess in words: how an event is placed (from atReason), why another is "likely"
  foretold.ts        what is foretold (DESIGN §4.8): is an event prophecy, its badge, "Foretold by …, not told as history. Source: …"
  opening.ts         the first visit's opening over the cosmos (#/start): its steps in t, remembered per visitor (DESIGN §3.5)
  learn.ts           learning on demand: how to say a name (sayHint), "Read this in …" (bookPointer), the stage's "About this scene"
  books.ts           chapter titles in each language (The Hobbit by number, the rest by English title), "Read this in …": pure, tested
  data/pronounce.ts  `pronounce` respellings: their form (checked by the build) and syllables for display: pure, tested
  dom.ts, icons.ts   a tiny element builder; inline stroke SVG icons
  main.ts            app shell: routing, pages vs stage, playback loop, panels, breadcrumb, zoom switch, Meanwhile
```

### Rules the code depends on

- **The light, the haze and the grade are pure too.** `lightAt(keys, t)` gives the hour, `graded(light, gradeFor(place))` gives the place; the stage only copies the result onto the lights, the fog and the background. Nothing in either may read the wall clock, and neither may touch `lamps` or `fireflies`, which are story state.
- **Everything visible is a pure function of the event time `t` (0 → 1).** That is what makes scrubbing and deep links work. `ambient` seconds may only drive idle motion (shimmer, drift, bobbing), never story state.
- **The playhead runs in seconds of narration; `t` is derived** via `EventClock.tAt`. Seeking converts back with `secondsAt`. Never advance `t` directly.
- **Narration timing:** `staging.yaml` gives each passage's `t` (where it belongs in the animation); `audio/<lang>.yaml` gives the second it starts in that recording, keyed by passage id. The build turns both into ordered arrays, and the clock stretches the animation between those points.
- **Recordings carry a `textHash`** of the words they read (`audio/<lang>.yaml`); the build warns when `narration.yaml` no longer matches. Editing a recorded passage means re-recording it.
- **The URL is the state**: `#/event/<id>?t=&follow=&lang=&audio=` (a staged event's stage, any other event's page; `audio` is the recording heard, apart from `lang`, the text read), `#/lives?with=a,b` (character lanes), `#/time/<age>/<date>?zoom=&from=` (the time cursor; `<date>` is `3019`, `3019-03`, `3019-03-15`, `3019-midyear`, `2941-summer`, or an axis position). New view state that matters should be added to the route (`src/routes.ts`); in-site links are plain hrefs from there.
- **Models play from `t` too.** A glTF's clips are driven by an `AnimationMixer` whose clip weights and times are *set* from `t` (`clipLayers` in `scene/modelClips.ts`; cross-fades from `actionMix`, gait pace from `strideSeconds`, in `timeline.ts`) and applied with `update(0)`; never let a mixer run free on the wall clock. A figure's heading is `headingAt(track, t)`, never the last frame's rotation. `scene/models.ts` is loaded with a dynamic `import()` only when an event has a model.
- **The author frames the shot, and the app never takes the view away.** `camera` in `staging.yaml` says where the view looks and how much ground it holds at `t` (`framingAt`, pure); `main.ts` applies it as a *change* from the shot applied last frame, so a visitor's pan and zoom survive as an offset and a fresh deep link still lands on the composed view. A stage never moves its own camera. An event with no `camera` keeps the old fixed wide shot. See `docs/DESIGN.md` §9.3.
- **A covered place opens because the staging says so.** A kit names what can be lifted (`cover-<name>` objects); `reveal` in `staging.yaml` says how far each has lifted at `t` (`revealAt`, pure), and `sets.ts` raises it and fades it together. The build checks every name against the `cover-*` objects the kit's `.glb` actually has, so a typo is an error and not a scene that silently stays shut. Never make a reveal follow the camera. See `docs/DESIGN.md` §9.4.
- **A figure stands where the staging puts it, and nowhere else.** `groundHeight` gives the kit's walkable `terrain` under (x, z); a keyframe's `y` adds whatever the author says they are standing *on* (a log, a bench, a doorstep). Nothing pushes figures apart at render time: that would make a figure's place depend on the other figures instead of on `t`, so two figures in one spot is a build warning (`crowding` in `src/timeline.ts`) and the author moves the keyframe. See `docs/DESIGN.md` §9.2.
- **The sound is built, not played back.** A place's ambience is `heard(scapeFor(place), light)` and runs on the audio clock, as shimmer runs on `ambient`; everything the story does — a footstep, a knock — is a `Cue` decided purely from the pair of moments it falls between, so a scrub cannot double one and a deep link cannot miss one. A stage reports what is heard (`Stage.sound`) and makes no noise itself, exactly as it moves no camera. Nothing is fetched and no audio clock starts until somebody presses play unmuted.
- **A family tree is derived, never authored.** `parents` is the only descent edge in `content/`; children, siblings, half-siblings, ancestors, descendants, cousins, uncles, generation depth and the houses are computed in `src/kinGraph.ts` (pure) and derived into `index.family` by `scripts/content/kin.ts`, exactly as `byCharacter` and `lanes` are. If a relation can be computed from parentage it is not a field, and the build errors on a `kin` word outside the closed list (`KIN_WORDS`), naming its replacement. `spouse`, `betrothed` and `twin` are symmetric: written once, reversed by the build and marked `reverse: true`. A birth or death comes from the event that declares it (`born:`/`died:` on `event.yaml`, at the event's honest range) or from the character's own `born:`/`died:`; where both exist they must agree, and no `died` means no end — nothing infers one. See `docs/DESIGN.md` §3.6 and §4.11.
- **An arc that tells runs on the event machinery, unchanged.** `arcs/<id>/` is read like an event's folder (`arc.yaml` + `narration.yaml` + `staging.yaml` + `audio/`), through the same four-word status pipeline, the same `narration.yaml` shape and the same `textHash` discipline, so the recording pipeline sees no difference; its narration lives in its own namespace (`arc/<id>`), and an arc id that collides with an event id is an error. Everything visible is a pure function of `t` and the clock is the one clock, as for an event — but an arc's `t` is **narration time, not history**: nothing of a telling reaches the time axis or the lanes. At map scale there is no `light`, `sound`, `reveal`, `set` or `tracks` (a country has no hour and a map no lid); a body of people is a `hosts` mark with a `weight` of 1–5, never a count, and a place named by `scenes`, `hosts` or `roads` must carry coordinates for the map the arc names (`scripts/content/arcs.ts`, docs/DESIGN.md §4.10).
- **New zoom levels or event kinds** implement `Stage` (`scene/stage.ts`) and are picked in `main.ts`'s `buildStage`, loaded there with a dynamic `import()` so each stage is its own chunk. Don't import a stage statically.
- **New languages:** add the code to `LANGS` in `data/types.ts`, then the interface strings in `i18n.ts`. Missing content falls back to English.
- **Never edit `public/data/`**: it is rebuilt from `content/` every time.
- **Date math lives in `src/data/calendar.ts` only.** Spans are widened by precision (a `year` date covers the whole year): that's the honest range.
- **Story order is the folder sort key** (age, then key), never the dates. Keys are numeric `YYYY-MM-DD-n`, seasons written as a month (summer `07`, autumn `09`).
- **`at` is a best guess, not a date.** The build places vague events between exact-dated anchors in their characters' lanes, in story order, never before what they follow or are caused by (`estimatePositions`, `estimateWaypoints` in `scripts/content/build.ts`). Each guess records why it landed there (`atReason`: kind, anchors, lane, window). The site may use it to place and to say "likely", but states only the honest range and explains the placement in words (`src/placement.ts`). "Likely" vs "possibly" is decided only by `nearness` / `nearnessAt` / `nearnessDuring` in `calendar.ts` (DESIGN §4.4.1).
- **Links are written once.** The build adds the reverse (`enabled-by` ↔ `enables`, `caused-by` ↔ `causes`; `concurrent` and `crossing` are symmetric) and marks it `reverse: true`.

## Writing content

See [`content/README.md`](content/README.md) for the file formats and a template.

- **One event = one scene.** If it has several places or several days of distinct action, split it and group the pieces with an arc.
- **Link what time can't show**: `enabled-by` / `caused-by` for consequences, `concurrent` for parallel action elsewhere. Don't link events just because they're close in time; the time cursor finds those.
- **Every event gets `when` with an honest `precision`.** Only timeless ages (before the world, and what is foretold after it) have none. When unsure of a season, claim only the year and add a comment saying why. A strong text cue may justify more ("just before June" → May), with the cue in a comment.
- **Name the folder by story order**, then check the build's ordering warnings.
- **Battles list their `sides`** (groups of allied factions, `content/factions/`). A host under one banner is a faction; one being who comes alone (Beorn) is a character. Armies in `staging.yaml` take keyframes like tracks, but an army keyframe's `action` is what it does on the way there.
- **Journeys follow who travels together.** Split them where companions part (Gandalf leaves the dwarves at Mirkwood).
- **Our own words only.** Summaries, thoughts and narration are original paraphrase. No reading Tolkien's text aloud, and quotations at most a few words, rarely. When an in-character line drifts close to the book's wording, rephrase it.
- **Names follow published translations** in each language (Bilbo Bolsón, Bolsón Cerrado, Thorin Escudo de Roble, Guillermo). When you can't confirm a Spanish term against the published edition, use your best guess and add it, with every file that uses it, to the checklist in issue [#51](https://github.com/esgabo/ardatir/issues/51).
- **Cite, don't quote:** `source: { book, chapter }` is for checking accuracy.
- **Narration passages** are short (one to three sentences) and placed at the animation moment they describe. Keep the beat markers (`beats`) aligned with them.
- **Every text needs `en`**; add `es` alongside it when writing new content.
- **Hard names get `pronounce: { en, es }`** (characters, places, ages; events whose title is a name): `ee-LOO-va-tar` / `i-LÚ-va-tar`, syllables joined by hyphens, the stressed one in capitals, one per word. Each language respells for its own readers.
- **A chapter cited by name** needs its Spanish title in `src/books.ts` (a test checks); The Hobbit's chapters are cited by number.

## IP rules (fan project)

- Maps, models, terrain and art are **original**. Published maps (Christopher Tolkien's, Pauline Baynes') may be looked at as reference, never traced, scanned or used as layers.
- **No imagery or likenesses** from the films or series (Jackson, Rings of Power), including character designs.
- Reference images shared during design (e.g. fan art of Arda's cosmology) are inspiration only, never assets.
- **No cloned voices** of real actors in narration.
- Keep the disclaimer in the site footer and README.

## Checking work

- `npm run content` must show `✓ content is valid`, and `npm run build` must pass (it typechecks, then fails on content errors) with no chunk over its budget (`chunkBudgets` in `vite.config.ts`: 500 kB, three.js 600 kB).
- `npm test` must pass; the deploy workflow runs it before building. New validation rules get a broken case in `tests/build.test.ts` (each one a small change to the fixture in `tests/fixtures/valid/content/`), and date math gets a case in `tests/calendar.test.ts`.
- After adding content, check the warnings too: missing Spanish, characters in no event, events outside their journey's dates, a sort key that contradicts the dates, a best guess that lands before what it follows.
- For visual changes, look at the result: run `npm run preview` and screenshot key moments with Playwright (on a fresh profile a visit to `#/` shows the opening; `#/start` reopens it), e.g. `#/event/ainulindale?t=0.25`, `?t=0.48`, `?t=0.72`, `?t=0.97`, and `#/event/roast-mutton?t=0.45&follow=bilbo&lang=es`. Headless Chromium needs `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` for WebGL.
- Sound can't be heard in a headless browser: check it by counting what the Web Audio graph actually built (how many sources and oscillators a few seconds of playback creates, the master gain, that nothing at all is created before play or while muted), and by the pure tests.
- When touching `eventClock.ts`, check that a recording with uneven `starts` still lands each passage on its `t`, and that the playhead reaches `t = 1` at the recording's `duration` (`tests/eventClock.test.ts` covers both).
- Don't commit test audio or placeholder recordings.

## Open questions

- Which legs of a long journey earn a diorama of their own? Answered in part by §4.10: inside an arc's telling a journey is a painted road with the legs we have told marked on it, and each of those is a diorama — so what is left is an authoring choice per journey (Moria probably, a week of walking probably not), not a design question.
- The world view (middle zoom level) isn't built yet. Places now carry coordinates (`docs/MAP.md`), so what remains is the map geometry itself, drawn by us.
- Family trees: the houses of elves, men, dwarves and hobbits (#89). `kin` records relationships rather than parentage, so it can't lay out a tree as it stands.
