# Content

Everything Ardatir shows comes from here: one YAML file per thing, linked by id. Run `npm run content` to validate it; `npm run dev` revalidates on every save. The design behind it is in [`docs/DESIGN.md`](../docs/DESIGN.md) §4.

```
ages/          the ages and their place on the shared time axis
characters/    one file per character
places/        one file per place
arcs/          named periods that group events (The War of the Ring)
journeys/      dated paths of characters between places
factions/      (later) sides in battles
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
```

`home` is for characters who don't travel: Tom Bombadil stays in his own country (save his trip to Maggot's in a hobbit rhyme). Between their first and last events (honest ranges), when no journey of theirs covers the moment, the time cursor shows them *in their own country* at that place, in a quiet "At home" group. It must be a known place id. Travellers don't need it: their journeys say where they are.
