# Design sample: narration at arc scale

These two files are the **worked example** for `docs/DESIGN.md` §4.10 (#88) — an arc telling its
own story over the map of its age. They are not live content:

- **The build does not read `arcs/<id>/` yet.** `scripts/content/build.ts` loads only the `.yaml`
  files directly in `content/arcs/`, so this folder is ignored entirely: nothing here is
  validated, nothing is written to `public/data/`, and `npm run content` neither fails nor warns
  about it. The arc itself is still the flat `content/arcs/the-fall-of-gondolin.yaml`.
- Keep it that way until the build learns the format. Then this folder becomes the arc: the flat
  file moves in as `arc.yaml` (and is deleted), and the files here are checked like an event's.

## What `arc.yaml` would hold

The flat file's three fields, plus what a telling needs:

```yaml
id: the-fall-of-gondolin
title: { en: The Fall of Gondolin, es: La Caída de Gondolin }
summary:
  en: Tuor's coming to the hidden city, his years there, and its betrayal and ruin.
  es: La llegada de Tuor a la ciudad oculta, sus años allí, y su traición y ruina.
status: staged
sources:
  - { book: the-silmarillion, chapter: "Of Turgon and the Building of Gondolin" }
  - { book: the-silmarillion, chapter: "Of Tuor and the Fall of Gondolin" }
beats:
  - { id: treason, label: { en: Maeglin is taken, es: Maeglin es capturado } }
  - { id: assault, label: { en: The host comes over the mountains, es: La hueste cruza las montañas } }
  - { id: tower,   label: { en: Turgon's tower falls, es: Cae la torre de Turgon } }
  - { id: flight,  label: { en: Out by the secret way, es: Salida por el pasadizo } }
  - { id: cleft,   label: { en: The Eagles' Cleft, es: La grieta de las Águilas } }
  - { id: havens,  label: { en: The Havens of Sirion, es: Los Puertos del Sirion } }
```

No `narratedBy`: every event of this arc is in the First Age, so the arc is read by the First
Age's narrator (`the-elder` today).

## What the build has to learn, to accept this folder

1. Read an arc as either `arcs/<id>.yaml` or `arcs/<id>/arc.yaml`, and refuse both at once.
2. `arc.yaml`: the three fields plus `status`, `sources`, `narratedBy` and `beats`; check the
   status against the files present, as it does for an event.
3. `narration.yaml`: exactly an event's, including the `textHash` staleness checks against
   `audio/<lang>.yaml`. Arc narration ids namespace as `arc/<id>`, and an arc id that collides
   with an event id is an error.
4. `staging.yaml`: `map` against `MAP_IDS`; `narration` and `beats` against the ids above;
   `camera` as an event's; `scenes` ids must be events of this arc with `t`s rising in the arc's
   story order; `hosts` (`faction` xor `label` + `color`, `mark` from the closed list, `weight`
   1–5, keyframes with `at` xor `x`/`z`, `action` from the closed list, `t`s rising); `roads`
   journeys must exist and `from` < `to`.
5. Every place the arc's scenes, hosts and roads name needs a `map:` entry for the arc's map.
6. `factions/host-of-angband.yaml` has to exist before this staging is valid. It is deliberately
   not added yet: with no battle naming it, the build would warn about a faction in no battle.
