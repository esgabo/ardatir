# The maps: place coordinates

Every place in `content/places/` says where it is, so the world view (the middle zoom level,
`docs/DESIGN.md` §3) can put a place, a journey and an army somewhere, and so a route can be
drawn between two of them. This file is the whole scheme. It lives apart from `DESIGN.md`
because it is a reference an author reaches for while writing a place file, not a decision to
read once.

**We author numbers, never a drawing.** Relative position is fact — Hobbiton west of Bree,
Weathertop on the Road between Bree and the Ford, Gondolin encircled east of Sirion — and the
IP rules (`CLAUDE.md`) allow reading that off a published map as reference. No map image is
fetched, traced, scanned, layered or committed. Our own low-poly coastlines and mountains can
then be drawn, redrawn and replaced *at the same coordinates*, because the coordinates were
never the picture.

## The maps

Coastlines change, so one frame cannot hold the whole history. There are four maps, each with
its own origin and its own frame:

| `on` | Covers | Origin (0, 0) |
|---|---|---|
| `middle-earth` | Middle-earth from the end of the First Age on: the Second, Third and Fourth Ages | **Bree**, at the Prancing Pony |
| `beleriand` | the drowned north-west of the First Age | the **gates of Angband** |
| `aman` | the Undying Lands: Valinor, the Pelóri, Eldamar | **Tirion** upon Túna |
| `numenor` | the island, in the Second Age | **Armenelos**, at the foot of the Meneltarma |

`middle-earth` is the default when `on` is left out, since most places are on it.

Beleriand sinks at the end of the First Age, so its places share no frame with later
Middle-earth: a place on both ranges gets **one entry per map**, not an averaged compromise.
Only `ered-luin` (the Blue Mountains) needs that today — Beleriand's eastern wall and the
Shire's western one are the same range seen from two sides of a changed coast.

Each origin is a landmark chosen because everything near it is measured from it in the books:
nearly every distance in *The Hobbit* and *The Lord of the Rings* is told as so many miles
along the Road from Bree, and nearly every First Age position as so far from Angband.

## Axes and units

The ground plane is **x / z**, because y is up everywhere in the codebase (three.js, and
`staging.yaml`'s keyframes).

- **+x is east**, −x west.
- **+z is south**, −z north.
- **one unit is ten miles.**

So a place is `{ x: 12, z: -2 }` for *120 miles east of Bree and 20 miles north of it*. Looked
at from above with north up, x runs right and z runs down the screen, the way a map is read.

Ten miles to the unit was chosen so a whole number is already as precise as the sources are:
nobody knows where Weathertop is to the mile. Write **integers** for anything at country scale,
and **one decimal** (one mile) only inside a region, where it means something — Bag End sits a
little up the Hill from Bywater, so they are `-12.2` and `-11.8`, not the same point.

Spans, for a sense of the numbers: Middle-earth runs about x −40 (the Grey Havens) to +75
(Erebor) and z −13 (Erebor) to +105 (Umbar). Beleriand runs about x −24 to +38 and z −1 to +48.
Nothing we draw reaches ±500, and the build rejects an `x` or `z` past that as a typo.

## Writing a place's coordinates

A point:

```yaml
map: { on: middle-earth, x: 12, z: -2 }   # about 120 miles east of Bree, north of the Road
```

A **region** — a land or a forest rather than a spot — adds `radius`, how far it reaches from
that centre, in the same units:

```yaml
map: { on: middle-earth, x: -14, z: -1, radius: 7 }   # the Shire, Far Downs to the Brandywine
```

`radius` is one honest number, not a shape: it says *the Shire is about 140 miles across and
centred here*, which is all a label, a glow or a hit area needs. A region is deliberately not
drawn as a polygon, because we do not know its outline to that precision and inventing one
would be inventing geography.

A place on **more than one map** gives a list:

```yaml
map:
  - { on: middle-earth, x: -33, z: 0, radius: 15 }
  - { on: beleriand, x: 38, z: 26, radius: 18 }
```

A place that belongs to **no map we draw** says so, with a comment saying why:

```yaml
map: nowhere   # in the Walls of the World, not in Arda at all
```

That is not the same as leaving `map:` out. `nowhere` is a decision; a missing `map:` is an
omission, and the build warns about one at a place where a scripted or staged event happens.
Five places are `nowhere` today: `almaren` and `cuivienen` (before or beyond every mapped
coast), `utumno` (only ever "the far north"), `helcaraxe` (the ice *between* Aman and
Middle-earth, so in neither frame) and `door-of-night` (outside the world).

**Two places that are one place take the same coordinates.** `minas-ithil` and `minas-morgul`,
`orodruin` and `mount-doom`, `eregion` and `hollin`, `dorthonion` and `taur-nu-fuin` are the
same ground under two names at two times, and saying so with equal numbers is more honest than
nudging them apart.

### How to place a new one by hand

1. **Find the nearest place that already has coordinates** — ideally the one the sources measure
   from. Read its `x`/`z`.
2. **Say in miles which way and how far** the new place lies from it, from the texts: *Lake-town
   is about 30 miles down the Long Lake from the Forest River's mouth.*
3. **Divide by ten, add to the neighbour.** East adds to `x`, south adds to `z`.
4. If it is a land rather than a spot, give it a `radius`: half its width, in units.
5. Put the reasoning in a `#` comment on the line. Every place has one; they are what makes
   the next correction cheap.
6. `npm run content`. Nothing checks whether geography is *right* — only an author can — so the
   comment is the check.

Where the sources give no distance, claim less: a region with a wide `radius` says *somewhere
around here* far more honestly than a point does.

## What the build does with it

`scripts/content/build.ts` parses `map:` into `Place.map`, an array of
`{ on, x, z, radius? }` (`PlacePoint` in `src/data/types.ts`), one entry per map, carried into
`public/data/index.json`. A stage drawing one map picks its entry:

```ts
const here = place.map?.find((p) => p.on === 'middle-earth');
```

Errors: an unknown `on`, a missing or non-numeric `x`/`z`, a non-positive `radius`, a value
past ±500, the same map twice, or a `map:` that is neither a mapping, a list of mappings, nor
the word `nowhere`. An unknown field inside an entry is a warning, like everywhere else.

Warning: a place with no `map:` at all where a `scripted` or later event happens — the world
view would have nowhere to put that event.

## Confidence

The coordinates were authored in one pass and are **relative geography, not surveying**. The
places whose position is a judgment call rather than a reading are listed in
[issue #88](https://github.com/esgabo/ardatir/issues/88), grouped confident / approximate /
guessed, for an author to check against the texts. Correcting one is editing one number in one
file; nothing else moves, which is the point of keeping the coordinates separate from the
drawing.
