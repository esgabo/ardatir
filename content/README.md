# Content

Everything Ardatir shows comes from here: one YAML file per thing, linked by id. Run `npm run content` to validate it; `npm run dev` revalidates on every save. The design behind it is in [`docs/DESIGN.md`](../docs/DESIGN.md) §4.

```
ages/          the ages and their place on the shared time axis
characters/    one file per character
places/        one file per place
arcs/          named periods that group events (The War of the Ring)
journeys/      dated paths of characters between places
factions/      one file per side in battles (the Elves of Mirkwood)
events/<age>/<sort-key>-<id>/
  event.yaml       facts (every event)
  narration.yaml   the script (from status: scripted)
  staging.yaml     the animation (from status: staged)
  audio/<lang>.mp3 + audio/<lang>.yaml   a narration recording and its timing (optional)
```

Ids are kebab-case (`battle-of-the-pelennor-fields`) and match the file name. Every text is `{ en, es }`; English is required.

## Writing a new event

1. Make a folder under `events/<age>/`, named `<sort-key>-<id>`. **The sort key is the story order**: events are ordered by it, not by their dates. Use `YYYY-MM-DD-n`, as precise as you like, with a season written as a month (spring `03`, summer `07`, autumn `09`, winter `12`) and `-1`, `-2`… for events in the same stretch: `2941-07-1-captured-in-goblin-town`, `2941-07-2-riddles-in-the-dark`. First Age years get four digits: `0495-…`. Days outside the months sort under the month they sit beside: `2-yule` (first day of the year) as `01`, `1-yule` (last day of the year) as `12`, and the Lithe days (`1-lithe`, `midyear`, `overlithe`, `2-lithe`) as `06`, so Midsummer's Eve is `2941-06-…`.
2. Add `event.yaml` with `status: outline`. Start from this:

```yaml
id: battle-of-the-pelennor-fields
age: third-age
when:
  start: { age: third-age, year: 3019, month: 3, day: 15 }
  # end: { ... }          # for events that last
  precision: day          # day | month | season | year | decade | approximate
place: pelennor-fields
characters: [ theoden, eowyn, merry, witch-king ]
arcs: [ the-war-of-the-ring ]
journeys: []              # journeys this event is a stop on
sides:                    # battles only: groups of allied factions, each against the others
  - [ riders-of-rohan, men-of-gondor ]
  - [ host-of-mordor, haradrim ]
tags: [ lord-of-the-rings, battle ]
status: outline           # outline | scripted | staged | animated
source: { book: the-return-of-the-king, chapter: The Battle of the Pelennor Fields }
title: { en: The Battle of the Pelennor Fields, es: La batalla de los Campos del Pelennor }
summary:
  en: In our own words, two or three sentences.
  es: En nuestras palabras, dos o tres frases.
links:                    # only what time alone can't show; the build adds the reverse
  - to: battle-of-pelargir
    type: enabled-by      # caused-by | enabled-by | concurrent | crossing (+ causes, enables)
    note: { en: Why they connect., es: Por qué se conectan. }
beats:                    # named turning points; their times go in staging.yaml
  - { id: dawn, label: { en: Dawn, es: Amanecer } }
```

3. Any new character, place, arc or journey it mentions gets its own file. The build tells you which ids it doesn't know.

### Dates, honestly

- Fill only what the sources say. A season goes in `season:` (not a month); a known day needs its month.
- Days outside the months (Shire Reckoning, *The Return of the King* Appendix D) are named with `day:` and no month: `2-yule` (first day of the year), `1-lithe`, `midyear` (Mid-year's Day), `overlithe` (leap years only: every fourth year, except the last of a century), `2-lithe` (between months 6 and 7), and `1-yule` (last day of the year). Midsummer's Eve is `{ age: third-age, year: 2941, day: 1-lithe }` with `precision: day`. Summer includes the Lithe days; winter includes Yule.
- `precision` must match: `day` needs a day, `month` a month, `season` a season.
- Unsure? Claim less (`year`) and leave a `#` comment saying why.
- Events in a timeless age (before the world) have no `when`.

### What is foretold

Prophecy, not history (the Last Battle, the Second Music), goes in `events/foretold/`: the age `foretold` is timeless, comes after the Fourth Age, and has `foretold: true`, so the site marks every event in it as foretold (docs/DESIGN.md §4.8). Such an event has no `when`, **must have a `source`** (its page says where the prophecy comes from), and may say who foretells it:

```yaml
age: foretold
source: { book: the-lost-road, chapter: "Quenta Silmarillion" }
foretoldBy: mandos        # a character id; only in a foretold age; leave it out when the source names no one
```

Add a comment saying which version you tell and where the others differ. Links to history work as usual (`caused-by` the curse on Húrin's house).

### A note for readers: `note`

When the sources disagree or say nothing, and a scene had to choose, say so where visitors will see it, in our own words. Any event may have a `note`; it appears first in *About this scene* and under the summary on the event's page. Keep the details for the YAML comment.

```yaml
note:
  en: Tolkien never said what shape the world takes after the end, so this scene shows ...
  es: Tolkien nunca dijo qué forma tiene el mundo después del fin, así que esta escena muestra ...
```

## Writing the script: `narration.yaml`

Passages in order, one to three sentences each, in our own words. Set `status: scripted`.

```yaml
- id: fire
  en: Cold, wet and lost in the hills, the company spotted a light among the trees.
  es: Con frío, empapados y perdidos entre las colinas, vieron una luz entre los árboles.
- id: trolls
  en: ...
  es: ...
```

## Staging: `staging.yaml`

Where everything falls in the animation (`t` from 0 to 1), and the character tracks. Set `status: staged`.

```yaml
stage: diorama            # cosmos | diorama
duration: 24              # seconds, when there is no recording
narration: { fire: 0, trolls: 0.25 }       # every passage id, rising
beats: { dawn: 0.9 }                       # every beat id from event.yaml
tracks:
  - characterId: bilbo
    keyframes:
      - { t: 0, x: -4, z: 3, action: walk, thought: { en: ..., es: ... } }
```

A track may give the character this event's own model, `model: characters/bilbo/bilbo-barrel.glb` (next to `characterId`), instead of their usual one (`docs/MODELS.md`).

The tile runs about -7 to 7 on both axes. A figure whose position is off the tile (say `x: 11, z: 11`) is not drawn: off the tile = offstage. Use it to wait out the scenes before an entrance. A figure moving between two `hide` keyframes stays hidden (it is not shown walking).

## Recordings: `audio/<lang>.mp3` + `audio/<lang>.yaml`

Produced outside this project (the Voice Studio). The words must match `narration.yaml` exactly. The timing file says how long the recording is, the second each passage starts, and which text was read; the animation stretches to match.

```yaml
duration: 31.5
starts: { fire: 0.4, trolls: 7.2 }
textHash: sha256:758a7a017a977923   # the text this recording reads
```

**Getting the script to record:** `npm run narration:export` writes, for every event with a `narration.yaml` and every language:

- `out/narration/<event>/<lang>.txt`: the words to read, one paragraph per passage, in order;
- `out/narration/<event>/<lang>.json`: `{ event, lang, title, textHash, passages: [{ id, text }] }`, plus `fallback: [ids]` when some passages have no text in that language and use the English.

`out/` is generated and gitignored. Options: `--only <event>` (event id, repeatable), `--lang es` (repeatable), `--changed` (only what needs recording: no recording yet, a stale one, or one without a `textHash`). For example: `npm run narration:export -- --changed --lang es`.

**`textHash`** is `sha256:` followed by the first 16 hex digits of SHA-256 over one line per passage, in order: `<id>`, a tab, the passage's text in that language (English where it is missing), a newline; whitespace in the text is collapsed first, so re-wrapping the YAML doesn't change it. Copy it from the exported `.json` into `audio/<lang>.yaml` when the recording comes back. The build then warns **stale recording** when a passage's words, ids or order change after recording, and warns when a recording has no `textHash`. The code is in `scripts/narration/text.ts`.

## Journeys

```yaml
id: tuors-road-to-gondolin
title: { en: Tuor's Road to Gondolin, es: El camino de Tuor a Gondolin }
characters: [ tuor, voronwe ]
waypoints:                # in order; at least two
  - { place: ivrin,    date: { age: first-age, year: 495, season: winter }, precision: season }
  - { place: gondolin, date: { age: first-age, year: 496 }, precision: year }
```

A stay known only within bounds takes an optional `end`, like an event's `when.end`: the waypoint covers from the start of `date` to the end of `end`, and its best guess stays inside that range. Use it instead of inventing a date:

```yaml
  - { place: dol-guldur, date: { age: third-age, year: 2941, season: summer }, end: { age: third-age, year: 2941, season: autumn }, precision: season }
```

`end` has the same precision as `date` unless `endPrecision` gives its own, for a stay whose end is known better (or worse) than its start. The company reaches Rivendell some time in June and is still there on Midsummer's Eve:

```yaml
  - { place: rivendell, date: { age: third-age, year: 2941, month: 6 }, end: { age: third-age, year: 2941, day: 1-lithe }, precision: month, endPrecision: day }
```

`endPrecision` must match `end` the way `precision` matches `date`, and `end` must not finish before `date` does (narrow the date instead).

An event on a journey is matched to the waypoint at its place whose range it overlaps, and that waypoint takes the event's best guess. The build warns when an event at one of the journey's places overlaps none of the waypoints there: widen the waypoint (often with an `end`) or check the dates.

## Characters

```yaml
id: tuor
name: { en: Tuor, es: Tuor }        # use published translations
kind: man                            # hobbit, elf, man, dwarf, wizard, ...
summary: { en: ..., es: ... }
color: "#3a6a8a"                     # placeholder for staging
scale: 1.85                          # height relative to a hobbit
kin:
  - { id: turin, as: cousin }
home: old-forest                     # optional: a place they stay in (see below)
model: characters/tuor/tuor.glb      # optional: their glTF model, a path under assets/ (docs/MODELS.md)
```

`model` points to an export in `assets/characters/`; the build checks that it exists and fits the budget (300 kB), and copies it into the site. Without one, the diorama draws the placeholder figure in `color`, `scale` tall.
### How to say a name: `pronounce`

Characters, places and ages with a hard name (and events whose title is one, like the Ainulindalë) may say how to pronounce it, for readers of each language:

```yaml
pronounce: { en: ee-LOO-va-tar, es: i-LÚ-va-tar }
```

Write it in the *AR-da* style: syllables joined by hyphens, the **stressed syllable in capitals**, exactly one per word, words separated by spaces (`KIR-ith OON-gol`); letters only. Each language respells for its own readers: Spanish writes *th* as *z* (`ZIN-gol`), *h* as *j* (`JÚ-rin`), a hard *g* before *e*/*i* as *gu* (`e-RE-gui-on`), *w* as *u* (`MAN-ue`). Stress follows Tolkien's rules for the Elvish tongues (*The Return of the King*, Appendix E: the second-last syllable when it is long, else the one before it). The site shows it as a small hint after the name; the build refuses a respelling without exactly one stressed syllable per word.

`home` is for characters who don't travel: Tom Bombadil stays in his own country (save his trip to Maggot's in a hobbit rhyme). Between their first and last events (honest ranges), when no journey of theirs covers the moment, the time cursor shows them *in their own country* at that place, in a quiet "At home" group. It must be a known place id. Travellers don't need it: their journeys say where they are.

## Factions: sides in battles

One file per side, `factions/<id>.yaml`, reused across battles (the Dwarves of the Iron Hills fight at Azanulbizar and at the Five Armies):

```yaml
id: elves-of-mirkwood
name: { en: Elves of Mirkwood, es: Elfos del Bosque Negro }   # plural, as a host is named
color: "#2f7a5c"           # banner colour: chips on pages, the army and its banner on a diorama
kind: elf                  # a character kind (elf, man, dwarf, goblin, orc, wolf, eagle...): shapes the army's figures
summary: { en: ..., es: ... }
leaders: [ thranduil ]     # optional, character ids, in any battle
```

**What is a faction?** A host that fights as one body under its own banner. One being who comes alone, like Beorn at the Five Armies, is a character with his own track, not a faction. A small named band whose members all have tracks (Thorin's company) can still be a faction, so the sides are said in full, but needs no army in staging.

**A battle lists its sides** in `event.yaml`: a list of at least two groups of allied faction ids, each group against the others. List who fought together in the end: at the Five Armies, dwarves, elves and men are on one side, though they nearly fought each other first.

```yaml
sides:
  - [ thorins-company, dwarves-of-the-iron-hills, elves-of-mirkwood, men-of-lake-town, eagles-of-the-misty-mountains ]
  - [ goblins-of-the-misty-mountains, wargs ]
```

The build checks every id, that no faction is on two sides, and that leaders are known characters; it warns about a faction in no battle. Pages and the time cursor say the sides in words (*Men of Dale and Dwarves of Erebor against Easterlings*), and the sidebar's search finds a faction's battles (`index.byFaction`).

**Armies** in `staging.yaml` place each faction's host on the diorama as a block of small figures in its colour, with a banner; named characters keep their own tracks and lead them:

```yaml
armies:
  - faction: goblins-of-the-misty-mountains   # must be on one of the event's sides
    size: large                               # small | medium | large: how many figures
    keyframes:
      - { t: 0, x: -13, z: -13 }              # off the tile = offstage
      - { t: 0.2, x: -5.4, z: -5.6, action: run }
      - { t: 0.62, x: -2.9, z: -3.6, action: fight }
```

An army's keyframes give its centre. **Its `action` says what it does on the way to that keyframe**: `walk` or `run` there, or wait (`idle`, the default) or `fight` where it stands, so `{ t: 0.62, action: fight }` after an arrival means it fights from the moment it arrives. The block faces the way it last marched (before it first moves, the way it will), and wheels round when it turns. Figures past the tile's edge are not drawn, so a host marches on and off. Wolves run in packs and eagles fly over the field, by `kind`.
