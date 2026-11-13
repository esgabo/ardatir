# Asset plan: The Hobbit

Every model *The Hobbit*'s events need, with body type and shared rig, the events that use it, priority, status, who produces each step, and the issue that tracks it. This is the plan for [#36](https://github.com/esgabo/ardatir/issues/36). Today everything on screen is a placeholder (`docs/DESIGN.md` §9), so every asset starts at `brief`.

Generated from `content/events/third-age/*/event.yaml` (and `content/characters/`): an event belongs to *The Hobbit* when it carries the `hobbit` tag. That gives **33 events**. Six of them are backstory or parallel events from the appendices and other books (the Ring, Smaug's coming, Azanulbizar, Thráin, the White Council, Bree), kept because they share places and characters with the main story; they come last. Characters come from each event's `characters` list. Creatures, props and crowds that are not content characters are read from the event summaries and comments; where an event does not clearly say a prop is there, it is marked `(?)` and should be confirmed when that event is scripted.

Style and budgets are in `docs/DESIGN.md` §9; designs come from Tolkien's descriptions, never from the films or series. Pipeline: [#20](https://github.com/esgabo/ardatir/issues/20). Rigs and clips: [#21](https://github.com/esgabo/ardatir/issues/21).

## Summary

| Type | Assets |
|---|---|
| Characters | 31 |
| Creatures | 13 |
| Props | 19 |
| Environments (kits) | 17 |
| **Total** | **80** |

21 of them have no issue yet (see "Gaps" at the end).

## How to read the tables

**Status** moves `brief` → `blockout` → `model` → `rigged` → `animated` → `done`.

**Machine.** The `runs:*` label of the linked issue says where the Blender work happens; the rest is always cloud.

| Step | Machine |
|---|---|
| `brief` (this plan and the issue text) | cloud |
| `blockout`, `model` | the issue's label: **local** (Blender node) or **either** ([#24](https://github.com/esgabo/ardatir/issues/24), [#45](https://github.com/esgabo/ardatir/issues/45)) |
| `rigged`, `animated` (rigs and clips, [#21](https://github.com/esgabo/ardatir/issues/21)) | local |
| export to glTF, link from `content/characters/*.yaml` or staging, size check ([#20](https://github.com/esgabo/ardatir/issues/20)) | cloud |
| playback driven by the event clock ([#22](https://github.com/esgabo/ardatir/issues/22)) | cloud |
| light, mood, weather ([#26](https://github.com/esgabo/ardatir/issues/26)) and sound ([#27](https://github.com/esgabo/ardatir/issues/27)) | local |
| `done`: appears in its events and is reviewed against the art direction (`docs/DESIGN.md` §9; `docs/ART.md` once [#19](https://github.com/esgabo/ardatir/issues/19) lands) | cloud |

**Priority** follows the suggested order: P0 what the Unexpected Party needs, P1 Roast Mutton, P2 to P5 the journey in story order, P6 backstory. An asset takes the priority of the first event that needs it. `(?)` after an event means likely but not stated in the event text. `company` is Thorin and the twelve dwarves' shared set of events: `unexpected-party`, `bilbo-runs-to-the-green-dragon`, `roast-mutton`, `captured-in-goblin-town`, `rescued-by-the-eagles`, `guests-of-beorn`, `gandalf-leaves-the-company`, `spiders-of-mirkwood`, `prisoners-of-the-elvenking`, `barrels-out-of-bond`, `welcome-at-lake-town`, `the-secret-door`, `not-at-home`, `the-gathering-of-the-clouds`, `battle-of-five-armies`.

| Priority | Stage | Events |
|---|---|---|
| P0 | The Unexpected Party ([#28](https://github.com/esgabo/ardatir/issues/28)) | `unexpected-party` |
| P1 | Roast Mutton, then Bilbo runs to the Green Dragon | `roast-mutton`, `bilbo-runs-to-the-green-dragon` |
| P2 | Rivendell and the Misty Mountains | `elrond-reads-the-moon-letters`, `captured-in-goblin-town`, `riddles-in-the-dark`, `rescued-by-the-eagles` |
| P3 | Beorn and Mirkwood | `guests-of-beorn`, `gandalf-leaves-the-company`, `spiders-of-mirkwood`, `prisoners-of-the-elvenking`, `barrels-out-of-bond` |
| P4 | Lake-town and the Mountain | `welcome-at-lake-town`, `the-secret-door`, `bilbo-meets-smaug`, `not-at-home`, `death-of-smaug`, `after-the-fire`, `the-gathering-of-the-clouds`, `the-arkenstone`, `battle-of-five-armies`, `thorins-farewell`, `thorin-is-laid-to-rest` |
| P5 | The way home | `yule-at-beorns`, `return-to-rivendell`, `the-troll-gold`, `the-auction-at-bag-end` |
| P6 | Backstory and parallel events | `meeting-in-bree`, `smeagol-takes-the-ring`, `smaug-comes-to-erebor`, `battle-of-azanulbizar`, `gandalf-finds-thrain`, `white-council-drives-out-sauron` |

## Shared rigs

Reuse first: build each body once, make variants by scale, colour, hair, clothes and props. Rig list is from [#21](https://github.com/esgabo/ardatir/issues/21); the last four rows are not there yet.

| Rig | Used by | Issue |
|---|---|---|
| hobbit | Bilbo (two looks), Déagol, young Sméagol | [#21](https://github.com/esgabo/ardatir/issues/21) |
| dwarf | Thorin, the twelve dwarves, Dáin, Thrór, Thráin, Frerin, Náin | [#21](https://github.com/esgabo/ardatir/issues/21) |
| tall-folk (man/elf) | Elrond, the Elvenking, wood-elf guards, Bard, the Master, townsfolk, Beorn (scaled up) | [#21](https://github.com/esgabo/ardatir/issues/21) |
| wizard (tall, robed) | Gandalf, Saruman | [#21](https://github.com/esgabo/ardatir/issues/21) |
| troll | Bert, Tom, William | [#21](https://github.com/esgabo/ardatir/issues/21) |
| eagle | the Lord of the Eagles and the eagles | [#21](https://github.com/esgabo/ardatir/issues/21) (later) |
| dragon | Smaug | [#21](https://github.com/esgabo/ardatir/issues/21) (later) |
| spider | Mirkwood spiders | [#21](https://github.com/esgabo/ardatir/issues/21) (later) |
| Gollum (own) | Gollum | [#39](https://github.com/esgabo/ardatir/issues/39) |
| goblin | goblins, the Great Goblin, Bolg, Azog | **missing from [#21](https://github.com/esgabo/ardatir/issues/21)** |
| quadruped | wargs, Beorn's bear, ponies | **missing from [#21](https://github.com/esgabo/ardatir/issues/21)** (only "horse" listed) |
| small bird | the thrush, Roäc the raven | **missing from [#21](https://github.com/esgabo/ardatir/issues/21)** |

Clips needed beyond the base set, from the events: `sit` and `eat` (the party, Beorn's table, Lake-town feast), `carry` (barrels), `fall` (battle), `hide` (Bilbo), plus a song-by-the-fire pose set for the dwarves.

## Events

| # | Event id | Priority | Place | Characters in content | Creatures and props needed |
|---|---|---|---|---|---|
| 1 | `smeagol-takes-the-ring` | P6 | gladden-fields | Déagol, Gollum | `the-ring` |
| 2 | `smaug-comes-to-erebor` | P6 | erebor | Smaug, Thrór, Thráin, Thorin Oakenshield | `smaug` |
| 3 | `battle-of-azanulbizar` | P6 | azanulbizar | Thráin, Thorin Oakenshield, Frerin, Náin, Dáin Ironfoot, Azog | `azog` |
| 4 | `gandalf-finds-thrain` | P6 | dol-guldur | Gandalf, Thráin | `thrors-map`, `thrors-key` |
| 5 | `meeting-in-bree` | P6 | prancing-pony | Gandalf, Thorin Oakenshield | - |
| 6 | `unexpected-party` | P0 | bag-end | the 13 dwarves, Bilbo Baggins, Gandalf | `thrors-map` (?), `thrors-key` (?), `bilbos-pipe`, `dwarf-instruments`, `bag-end-tea-set` |
| 7 | `bilbo-runs-to-the-green-dragon` | P1 | green-dragon | the 13 dwarves, Bilbo Baggins | `bag-end-tea-set`, `thorins-note` |
| 8 | `roast-mutton` | P1 | trollshaws | the 13 dwarves, Bilbo Baggins, Gandalf, William, Bert, Tom | `troll`, `troll-camp-props` |
| 9 | `elrond-reads-the-moon-letters` | P2 | rivendell | Elrond, Thorin Oakenshield, Bilbo Baggins, Gandalf | `thrors-map` |
| 10 | `captured-in-goblin-town` | P2 | goblin-town | the 13 dwarves, Bilbo Baggins, Gandalf, The Great Goblin | `great-goblin`, `goblins`, `orcrist` (?), `glamdring` (?) |
| 11 | `riddles-in-the-dark` | P2 | gollums-lake | Bilbo Baggins, Gollum | `gollum`, `sting` (?), `the-ring`, `gollums-boat` |
| 12 | `rescued-by-the-eagles` | P2 | eagles-eyrie | the 13 dwarves, Bilbo Baggins, Gandalf, The Lord of the Eagles | `goblins`, `wargs`, `eagles` |
| 13 | `guests-of-beorn` | P3 | beorns-house | the 13 dwarves, Beorn, Gandalf, Bilbo Baggins | `beorn-bear`, `ponies` |
| 14 | `gandalf-leaves-the-company` | P3 | forest-gate | the 13 dwarves, Gandalf, Bilbo Baggins | - |
| 15 | `spiders-of-mirkwood` | P3 | mirkwood | Bilbo Baggins, Balin, Dwalin, Fíli, Kíli, Dori, Nori, Ori, Óin, Glóin, Bifur, Bofur, Bombur | `spiders`, `sting`, `the-ring` |
| 16 | `prisoners-of-the-elvenking` | P3 | elvenking-halls | the 13 dwarves, The Elvenking, Bilbo Baggins | `the-ring`, `barrels` (?) |
| 17 | `barrels-out-of-bond` | P3 | elvenking-halls | the 13 dwarves, Bilbo Baggins | `barrels` |
| 18 | `welcome-at-lake-town` | P4 | lake-town | the 13 dwarves, Bilbo Baggins, The Master of Lake-town | `barrels` |
| 19 | `white-council-drives-out-sauron` | P6 | dol-guldur | Gandalf, Saruman | - |
| 20 | `the-secret-door` | P4 | erebor | the 13 dwarves, Bilbo Baggins | `thrush`, `thrors-map` (?), `thrors-key`, `treasure` (?) |
| 21 | `bilbo-meets-smaug` | P4 | erebor | Bilbo Baggins, Smaug | `smaug`, `the-ring` (?), `arkenstone` (?), `smaugs-cup`, `treasure` |
| 22 | `not-at-home` | P4 | erebor | the 13 dwarves, Bilbo Baggins | `arkenstone`, `mithril-coat`, `treasure` |
| 23 | `death-of-smaug` | P4 | lake-town | Smaug, Bard the Bowman, The Master of Lake-town | `smaug`, `thrush`, `black-arrow` |
| 24 | `after-the-fire` | P4 | lake-town | Bard the Bowman, The Master of Lake-town, The Elvenking | `wood-elf-guard` (host) |
| 25 | `the-gathering-of-the-clouds` | P4 | erebor | the 13 dwarves, Bilbo Baggins, Roäc, Bard the Bowman | `thrush`, `roac`, `wood-elf-guard` (host) |
| 26 | `the-arkenstone` | P4 | dale | Bilbo Baggins, Bard the Bowman, The Elvenking, Gandalf | `arkenstone` |
| 27 | `battle-of-five-armies` | P4 | erebor | the 13 dwarves, Dáin Ironfoot, Bard the Bowman, The Elvenking, Gandalf, Bilbo Baggins, Bolg, Beorn, The Lord of the Eagles | `goblins`, `bolg`, `wargs`, `eagles`, `beorn-bear`, `orcrist` (?), `glamdring` (?), `the-ring` (?) |
| 28 | `thorins-farewell` | P4 | dale | Thorin Oakenshield, Bilbo Baggins, Gandalf | - |
| 29 | `thorin-is-laid-to-rest` | P4 | erebor | Bard the Bowman, The Elvenking, Dáin Ironfoot | `orcrist`, `arkenstone`, `treasure` (?) |
| 30 | `yule-at-beorns` | P5 | beorns-house | Bilbo Baggins, Gandalf, Beorn | - |
| 31 | `return-to-rivendell` | P5 | rivendell | Bilbo Baggins, Gandalf, Elrond | - |
| 32 | `the-troll-gold` | P5 | trollshaws | Bilbo Baggins, Gandalf | `troll`, `treasure` |
| 33 | `the-auction-at-bag-end` | P5 | bag-end | Bilbo Baggins, Gandalf | `auction-lots` |

## Characters

| Asset | Name | Body / rig | Events | Priority | Status | Machine | Issue | Notes |
|---|---|---|---|---|---|---|---|---|
| `bilbo` | Bilbo Baggins | hobbit | `company` + `elrond-reads-the-moon-letters`, `riddles-in-the-dark`, `bilbo-meets-smaug`, `the-arkenstone`, `thorins-farewell`, `yule-at-beorns`, `return-to-rivendell`, `the-troll-gold`, `the-auction-at-bag-end` | P0 | animated | local | [#23](https://github.com/esgabo/ardatir/issues/23) | Two looks, both built by `scripts/models/blender/bilbo.py` on the hobbit rig with the six base clips: home (waistcoat, green coat, bare hairy feet) for the party, the Green Dragon and the auction; travelling (`bilbo-travel.glb`: shirt sleeves and waistcoat under Dwalin's too-big dark-green hood and cloak, ch. 2) on every journey event from `roast-mutton` to `the-troll-gold`. Sting is a prop (`sting`, #45). |
| `gandalf` | Gandalf | wizard | `gandalf-finds-thrain`, `meeting-in-bree`, `unexpected-party`, `roast-mutton`, `elrond-reads-the-moon-letters`, `captured-in-goblin-town`, `rescued-by-the-eagles`, `guests-of-beorn`, `gandalf-leaves-the-company`, `white-council-drives-out-sauron`, `the-arkenstone`, `battle-of-five-armies`, `thorins-farewell`, `yule-at-beorns`, `return-to-rivendell`, `the-troll-gold`, `the-auction-at-bag-end` | P0 | animated | local | [#23](https://github.com/esgabo/ardatir/issues/23) | Tall pointed blue hat, grey cloak, silver scarf, staff. Robe motion baked. Built by `scripts/models/blender/gandalf.py` on the wizard rig (cloak and beard bones, staff in the right hand), with the six base clips. |
| `thorin` | Thorin Oakenshield | dwarf | `smaug-comes-to-erebor`, `battle-of-azanulbizar`, `meeting-in-bree`, `unexpected-party`, `bilbo-runs-to-the-green-dragon`, `roast-mutton`, `elrond-reads-the-moon-letters`, `captured-in-goblin-town`, `rescued-by-the-eagles`, `guests-of-beorn`, `gandalf-leaves-the-company`, `prisoners-of-the-elvenking`, `barrels-out-of-bond`, `welcome-at-lake-town`, `the-secret-door`, `not-at-home`, `the-gathering-of-the-clouds`, `battle-of-five-armies`, `thorins-farewell` | P0 | animated | local | [#23](https://github.com/esgabo/ardatir/issues/23) | Variant: travelling hood and armed; in Smaug-era events young Thorin (no beard of age). Built by `scripts/models/blender/dwarves.py` (shared dwarf body, hood colour from ch. 1) on the dwarf rig, with the six base clips. |
| `balin` | Balin | dwarf | `company` | P0 | animated | local | [#23](https://github.com/esgabo/ardatir/issues/23) | Dwarf body variant: hood colour from ch. 1, build, beard. Built by `scripts/models/blender/dwarves.py` (shared dwarf body, hood colour from ch. 1) on the dwarf rig, with the six base clips. |
| `dwalin` | Dwalin | dwarf | `company` | P0 | animated | local | [#23](https://github.com/esgabo/ardatir/issues/23) | Dwarf body variant: hood colour from ch. 1, build, beard. Built by `scripts/models/blender/dwarves.py` (shared dwarf body, hood colour from ch. 1) on the dwarf rig, with the six base clips. |
| `fili` | Fíli | dwarf | `company` | P0 | animated | local | [#23](https://github.com/esgabo/ardatir/issues/23) | Dwarf body variant: hood colour from ch. 1, build, beard. Built by `scripts/models/blender/dwarves.py` (shared dwarf body, hood colour from ch. 1) on the dwarf rig, with the six base clips. |
| `kili` | Kíli | dwarf | `company` | P0 | animated | local | [#23](https://github.com/esgabo/ardatir/issues/23) | Dwarf body variant: hood colour from ch. 1, build, beard. Built by `scripts/models/blender/dwarves.py` (shared dwarf body, hood colour from ch. 1) on the dwarf rig, with the six base clips. |
| `dori` | Dori | dwarf | `company` | P0 | animated | local | [#23](https://github.com/esgabo/ardatir/issues/23) | Dwarf body variant: hood colour from ch. 1, build, beard. Built by `scripts/models/blender/dwarves.py` (shared dwarf body, hood colour from ch. 1) on the dwarf rig, with the six base clips. |
| `nori` | Nori | dwarf | `company` | P0 | animated | local | [#23](https://github.com/esgabo/ardatir/issues/23) | Dwarf body variant: hood colour from ch. 1, build, beard. Built by `scripts/models/blender/dwarves.py` (shared dwarf body, hood colour from ch. 1) on the dwarf rig, with the six base clips. |
| `ori` | Ori | dwarf | `company` | P0 | animated | local | [#23](https://github.com/esgabo/ardatir/issues/23) | Dwarf body variant: hood colour from ch. 1, build, beard. Built by `scripts/models/blender/dwarves.py` (shared dwarf body, hood colour from ch. 1) on the dwarf rig, with the six base clips. |
| `oin` | Óin | dwarf | `company` | P0 | animated | local | [#23](https://github.com/esgabo/ardatir/issues/23) | Dwarf body variant: hood colour from ch. 1, build, beard. Built by `scripts/models/blender/dwarves.py` (shared dwarf body, hood colour from ch. 1) on the dwarf rig, with the six base clips. |
| `gloin` | Glóin | dwarf | `company` | P0 | animated | local | [#23](https://github.com/esgabo/ardatir/issues/23) | Dwarf body variant: hood colour from ch. 1, build, beard. Built by `scripts/models/blender/dwarves.py` (shared dwarf body, hood colour from ch. 1) on the dwarf rig, with the six base clips. |
| `bifur` | Bifur | dwarf | `company` | P0 | animated | local | [#23](https://github.com/esgabo/ardatir/issues/23) | Dwarf body variant: hood colour from ch. 1, build, beard. Built by `scripts/models/blender/dwarves.py` (shared dwarf body, hood colour from ch. 1) on the dwarf rig, with the six base clips. |
| `bofur` | Bofur | dwarf | `company` | P0 | animated | local | [#23](https://github.com/esgabo/ardatir/issues/23) | Dwarf body variant: hood colour from ch. 1, build, beard. Built by `scripts/models/blender/dwarves.py` (shared dwarf body, hood colour from ch. 1) on the dwarf rig, with the six base clips. |
| `bombur` | Bombur | dwarf | `company` | P0 | animated | local | [#23](https://github.com/esgabo/ardatir/issues/23) | Dwarf body variant: hood colour from ch. 1, build, beard. Built by `scripts/models/blender/dwarves.py` (shared dwarf body, hood colour from ch. 1) on the dwarf rig, with the six base clips. |
| `elrond` | Elrond | tall-folk (elf) | `elrond-reads-the-moon-letters`, `return-to-rivendell` | P2 | brief | local | [#37](https://github.com/esgabo/ardatir/issues/37) | Wise, dark-haired, Rivendell robes. |
| `thranduil` | Thranduil, the Elvenking | tall-folk (elf) | `prisoners-of-the-elvenking`, `after-the-fire`, `the-arkenstone`, `battle-of-five-armies`, `thorin-is-laid-to-rest` | P3 | brief | local | [#37](https://github.com/esgabo/ardatir/issues/37) | Crown of leaves and berries (autumn), per the book. |
| `wood-elf-guard` | Wood-elf guard (and elf host) | tall-folk (elf) | `prisoners-of-the-elvenking`, `barrels-out-of-bond`, `battle-of-five-armies`, `the-arkenstone` (?) | P3 | brief | local | [#37](https://github.com/esgabo/ardatir/issues/37) | Generic guard with bow, a few variants; reused as the elven host in the battle. Not a content character. |
| `beorn-man` | Beorn (man) | tall-folk (man, scaled up) | `guests-of-beorn`, `battle-of-five-armies`, `yule-at-beorns` | P3 | brief | local | [#40](https://github.com/esgabo/ardatir/issues/40) | Huge, black hair and beard; content scale 2.2. |
| `dain` | Dáin | dwarf | `battle-of-azanulbizar`, `battle-of-five-armies`, `thorin-is-laid-to-rest` | P4 | brief | local (no issue yet) | **none** | Iron Hills lord, armoured; young Dáin at Azanulbizar. |
| `bard` | Bard | tall-folk (man) | `death-of-smaug`, `after-the-fire`, `the-gathering-of-the-clouds`, `the-arkenstone`, `battle-of-five-armies`, `thorin-is-laid-to-rest` | P4 | brief | local | [#38](https://github.com/esgabo/ardatir/issues/38) | Grim-faced archer; his bow comes with him (arrow is a separate prop). |
| `the-master` | The Master of Lake-town | tall-folk (man) | `welcome-at-lake-town`, `death-of-smaug`, `after-the-fire` | P4 | brief | local | [#38](https://github.com/esgabo/ardatir/issues/38) | Comfortable, well-fed official. |
| `lake-townsfolk` | Lake-town townsfolk (2-3 variants) | tall-folk (man) | `welcome-at-lake-town`, `death-of-smaug`, `battle-of-five-armies` | P4 | brief | local | [#38](https://github.com/esgabo/ardatir/issues/38) | Feasting crowd, fleeing crowd, men of the host. Not content characters. |
| `thror` | Thrór | dwarf | `smaug-comes-to-erebor` | P6 | brief | local (no issue yet) | **none** | Old king, golden look; backstory only. |
| `thrain` | Thráin | dwarf | `smaug-comes-to-erebor`, `battle-of-azanulbizar`, `gandalf-finds-thrain` | P6 | brief | local (no issue yet) | **none** | Two ages: fleeing king; broken prisoner in Dol Guldur. |
| `frerin` | Frerin | dwarf | `battle-of-azanulbizar` | P6 | brief | local (no issue yet) | **none** | Azanulbizar only; could be a recoloured Thráin or a crowd dwarf. |
| `nain` | Náin | dwarf | `battle-of-azanulbizar` | P6 | brief | local (no issue yet) | **none** | Azanulbizar only; could be a recoloured crowd dwarf. |
| `saruman` | Saruman | wizard | `white-council-drives-out-sauron` | P6 | brief | local (no issue yet) | **none** | Wizard body, white robes; White Council only. |
| `deagol` | Déagol | hobbit | `smeagol-takes-the-ring` | P6 | brief | local (no issue yet) | **none** | River-folk hobbit variant, fishing. |
| `smeagol` | Sméagol (before the Ring) | hobbit | `smeagol-takes-the-ring` | P6 | brief | local | [#39](https://github.com/esgabo/ardatir/issues/39) | The young hobbit form of content character `gollum`. [#39](https://github.com/esgabo/ardatir/issues/39) lists the event but only describes Gollum. |

## Creatures

| Asset | Name | Body / rig | Events | Priority | Status | Machine | Issue | Notes |
|---|---|---|---|---|---|---|---|---|
| `troll` | Trolls: Bert, Tom, William | troll (one body, 3 variants) | `roast-mutton`, `the-troll-gold` | P1 | animated | local | [#23](https://github.com/esgabo/ardatir/issues/23) | Living (night) and stone (dawn onwards) versions; the stone ones stay as scenery in the-troll-gold. Built by `scripts/models/blender/trolls.py` on the troll rig: `<id>.glb` with the six base clips, `<id>-stone.glb` holding the pose each was caught in, linked per track in the-troll-gold's staging. Turning to stone during roast-mutton itself is a render state ([#26](https://github.com/esgabo/ardatir/issues/26)). |
| `gollum` | Gollum | own rig (small, four-limbed) | `riddles-in-the-dark` | P2 | brief | local | [#39](https://github.com/esgabo/ardatir/issues/39) | Pale, thin, large eyes, long hands and feet. Boat is a prop below. One content character, two models: young Sméagol (`smeagol`, row above) for `smeagol-takes-the-ring`, Gollum for the rest. |
| `great-goblin` | The Great Goblin | goblin (new rig, or dwarf rig variant) | `captured-in-goblin-town` | P2 | brief | local | [#41](https://github.com/esgabo/ardatir/issues/41) | Large; keep the proportions rule. |
| `goblins` | Goblins (rank and file, few variants) | goblin | `captured-in-goblin-town`, `rescued-by-the-eagles`, `battle-of-five-armies` | P2 | brief | local | [#41](https://github.com/esgabo/ardatir/issues/41) | Crowd units: keep cheap. |
| `wargs` | Wargs | quadruped (wolf) | `rescued-by-the-eagles`, `battle-of-five-armies` | P2 | brief | local | [#41](https://github.com/esgabo/ardatir/issues/41) | Big grey wolves, crowd units. |
| `eagles` | Lord of the Eagles and eagles | eagle (own rig) | `rescued-by-the-eagles`, `battle-of-five-armies` | P2 | brief | local | [#42](https://github.com/esgabo/ardatir/issues/42) | Flying and perching; big enough to carry a dwarf. |
| `beorn-bear` | Beorn (bear) | quadruped (bear) | `guests-of-beorn`, `battle-of-five-armies` | P3 | brief | local | [#40](https://github.com/esgabo/ardatir/issues/40) | Shares colours and bulk with the man so the change reads. |
| `spiders` | Giant spiders of Mirkwood (with webs, cocoons) | spider (own rig) | `spiders-of-mirkwood` | P3 | brief | local | [#43](https://github.com/esgabo/ardatir/issues/43) | Unsettling, not gruesome. |
| `ponies` | Company ponies | quadruped (pony/horse) | `guests-of-beorn` | P3 | brief | local (no issue yet) | **none** | Named in guests-of-beorn summary only; low priority. |
| `bolg` | Bolg | goblin (larger chief) | `battle-of-five-armies` | P4 | brief | local | [#41](https://github.com/esgabo/ardatir/issues/41) | Larger goblin chief. |
| `smaug` | Smaug | dragon (own rig) | `smaug-comes-to-erebor`, `bilbo-meets-smaug`, `death-of-smaug` | P4 | brief | local | [#44](https://github.com/esgabo/ardatir/issues/44) | Red-gold, jewelled belly with the bare patch; sleeping, talking, flying; fire effect via [#26](https://github.com/esgabo/ardatir/issues/26). |
| `thrush` | The old thrush | small bird (2-3 clips) | `the-secret-door`, `death-of-smaug`, `the-gathering-of-the-clouds` | P4 | brief | local (no issue yet) | **none** | Knocks on the stone; tells Bard; fetches Roäc. |
| `roac` | Roäc, son of Carc | small bird (raven; shares the thrush's rig) | `the-gathering-of-the-clouds` | P4 | brief | local (no issue yet) | **none** | Ancient, grey, a large raven; a content character (`content/characters/roac.yaml`). |
| `azog` | Azog | goblin (larger chief) | `battle-of-azanulbizar` | P6 | brief | local (no issue yet) | **none** | Backstory (Azanulbizar); recolour of Bolg. |

## Props

| Asset | Name | Body / rig | Events | Priority | Status | Machine | Issue | Notes |
|---|---|---|---|---|---|---|---|---|
| `bilbos-pipe` | Bilbo's pipe | - | `unexpected-party` | P0 | brief | either | [#45](https://github.com/esgabo/ardatir/issues/45) | Named in the first narration passage. |
| `dwarf-instruments` | Dwarf instruments and tools (viol, flute, harp, drum) | - | `unexpected-party` | P0 | brief | local | [#23](https://github.com/esgabo/ardatir/issues/23) | For the song by the fire ([#28](https://github.com/esgabo/ardatir/issues/28)); part of the dwarf variants in [#23](https://github.com/esgabo/ardatir/issues/23), or here. |
| `bag-end-tea-set` | Bag End feast set (plates, mugs, food, tea) | - | `unexpected-party`, `bilbo-runs-to-the-green-dragon` | P0 | brief | local (no issue yet) | **none** | Not in any issue; belongs with the Shire kit. Second event shows the same table after the party. |
| `troll-camp-props` | Troll cooking set: spit, mutton, pot, the talking purse | - | `roast-mutton` | P1 | brief | local (no issue yet) | **none** | Not in [#45](https://github.com/esgabo/ardatir/issues/45)'s list; the purse that cries out is in the narration. |
| `thorins-note` | Thorin's note | - | `bilbo-runs-to-the-green-dragon` | P1 | brief | local (no issue yet) | **none** | Left on the mantelpiece; tiny. |
| `glamdring` | Glamdring | - | `captured-in-goblin-town` (?), `battle-of-five-armies` (?) | P2 | brief | either | [#45](https://github.com/esgabo/ardatir/issues/45) | Gandalf's sword; Gandalf slays the Great Goblin in captured-in-goblin-town. |
| `the-ring` | The Ring | - | `smeagol-takes-the-ring`, `riddles-in-the-dark`, `spiders-of-mirkwood`, `prisoners-of-the-elvenking`, `bilbo-meets-smaug` (?), `battle-of-five-armies` (?) | P2 | brief | either | [#45](https://github.com/esgabo/ardatir/issues/45) | Plain gold ring. Bilbo's invisibility is a render state, not a model (see [#26](https://github.com/esgabo/ardatir/issues/26)). |
| `thrors-map` | Thror's map (with hidden moon-letters) | - | `elrond-reads-the-moon-letters`, `gandalf-finds-thrain`, `unexpected-party` (?), `the-secret-door` (?) | P2 | brief | either | [#45](https://github.com/esgabo/ardatir/issues/45) | Needs a "runes revealed" state for the moon-letters moment. |
| `gollums-boat` | Gollum's boat | - | `riddles-in-the-dark` | P2 | brief | local | [#39](https://github.com/esgabo/ardatir/issues/39) | Small boat, paddled; mentioned in [#39](https://github.com/esgabo/ardatir/issues/39). |
| `sting` | Sting | - | `spiders-of-mirkwood`, `riddles-in-the-dark` (?) | P3 | brief | either | [#45](https://github.com/esgabo/ardatir/issues/45) | Small elvish blade (named in the spiders event); carried from the troll hoard on. |
| `barrels` | Barrels | - | `barrels-out-of-bond`, `welcome-at-lake-town`, `prisoners-of-the-elvenking` (?) | P3 | brief | either | [#45](https://github.com/esgabo/ardatir/issues/45) | Open and closed, floating; a few variants. |
| `orcrist` | Orcrist | - | `thorin-is-laid-to-rest`, `captured-in-goblin-town` (?), `battle-of-five-armies` (?) | P4 | brief | either | [#45](https://github.com/esgabo/ardatir/issues/45) | Thorin's sword; set on his tomb by the Elvenking. |
| `arkenstone` | The Arkenstone | - | `not-at-home`, `the-arkenstone`, `thorin-is-laid-to-rest` | P4 | brief | either | [#45](https://github.com/esgabo/ardatir/issues/45) | White light; glow handled with lighting ([#26](https://github.com/esgabo/ardatir/issues/26)). |
| `thrors-key` | Thror's key | - | `gandalf-finds-thrain`, `the-secret-door`, `unexpected-party` (?) | P4 | brief | either | [#45](https://github.com/esgabo/ardatir/issues/45) | Small, ornate dwarf key. |
| `mithril-coat` | Bilbo's mithril coat | - | `not-at-home`, `battle-of-five-armies` (?) | P4 | brief | either | **none** | Small silver mail shirt; Bilbo's model variant once he wears it. |
| `black-arrow` | The black arrow | - | `death-of-smaug` | P4 | brief | either | [#45](https://github.com/esgabo/ardatir/issues/45) | Bard's last arrow, with bow from [#38](https://github.com/esgabo/ardatir/issues/38). |
| `smaugs-cup` | Smaug's cup | - | `bilbo-meets-smaug` | P4 | brief | local (no issue yet) | **none** | The stolen cup, from the treasure hoard. |
| `treasure` | Gold and treasure kit (coins, chests, cups) | - | `the-troll-gold`, `bilbo-meets-smaug`, `the-secret-door` (?), `thorin-is-laid-to-rest` (?) | P4 | brief | local | [#49](https://github.com/esgabo/ardatir/issues/49) | Troll hoard (small chests) and the Mountain hoard (heaps); instanced pieces. |
| `auction-lots` | Auction lots (furniture, notice, spoons) | - | `the-auction-at-bag-end` | P5 | brief | local (no issue yet) | **none** | Bilbo buys back his own chairs and tables. |

## Environments

One kit per issue; the Events column lists the events set in each place. Terrain per event is [#25](https://github.com/esgabo/ardatir/issues/25); light and mood [#26](https://github.com/esgabo/ardatir/issues/26); sound [#27](https://github.com/esgabo/ardatir/issues/27).

| Asset | Name | Body / rig | Events | Priority | Status | Machine | Issue | Notes |
|---|---|---|---|---|---|---|---|---|
| `shire-kit` | Shire kit: Bag End hill with cut-away interior, lane, Bywater, the Green Dragon | kit | `unexpected-party`, `bilbo-runs-to-the-green-dragon`, `the-auction-at-bag-end` | P0 | brief | either | [#24](https://github.com/esgabo/ardatir/issues/24) | Bag End is both the party (cut-away hall, pantry, parlour) and the auction (exterior). |
| `trollshaws` | The Trollshaws: wooded slope, fire, troll hole | kit | `roast-mutton`, `the-troll-gold` | P1 | brief | local | [#46](https://github.com/esgabo/ardatir/issues/46) | Dawn light is [#26](https://github.com/esgabo/ardatir/issues/26). |
| `rivendell` | Rivendell: Last Homely House, river, bridge, moonlit terrace | kit | `elrond-reads-the-moon-letters`, `return-to-rivendell` | P2 | brief | local | [#46](https://github.com/esgabo/ardatir/issues/46) | Moon-letters needs a crescent moon. |
| `goblin-town` | Goblin-town caves (cut-away) | kit | `captured-in-goblin-town` | P2 | brief | local | [#47](https://github.com/esgabo/ardatir/issues/47) | Cut-away diorama view of caves. |
| `gollums-lake` | Gollum's lake and island | kit | `riddles-in-the-dark` | P2 | brief | local | [#47](https://github.com/esgabo/ardatir/issues/47) | Cold black lake, island. |
| `eyrie` | The eagles' eyrie (and the burning-fir glade) | kit | `rescued-by-the-eagles` | P2 | brief | local | [#47](https://github.com/esgabo/ardatir/issues/47) | Burning firs belong to rescued-by-the-eagles. |
| `beorns-house` | Beorn's house and bee-pastures | kit | `guests-of-beorn`, `yule-at-beorns` | P3 | brief | local | [#48](https://github.com/esgabo/ardatir/issues/48) | Same hall hosts the Yule feast. |
| `forest-gate` | The forest gate (arch of trees) | kit | `gandalf-leaves-the-company` | P3 | brief | local | [#48](https://github.com/esgabo/ardatir/issues/48) | Gandalf leaves them here. |
| `mirkwood` | Mirkwood (dark forest, webs) | kit | `spiders-of-mirkwood` | P3 | brief | local | [#48](https://github.com/esgabo/ardatir/issues/48) | Spider webs shared with [#43](https://github.com/esgabo/ardatir/issues/43). |
| `elvenking-halls` | The Elvenking's halls and water-gate | kit | `prisoners-of-the-elvenking`, `barrels-out-of-bond` | P3 | brief | local | [#48](https://github.com/esgabo/ardatir/issues/48) | Cave-halls, cellars, river water-gate for the barrels. |
| `lake-town` | Lake-town (Esgaroth) on piles | kit | `welcome-at-lake-town`, `death-of-smaug` | P4 | brief | local | [#49](https://github.com/esgabo/ardatir/issues/49) | Feast hall, burning houses. |
| `dale` | Dale (ruins, camp, battle valley) | kit | `the-arkenstone`, `thorins-farewell` | P4 | brief | local | [#49](https://github.com/esgabo/ardatir/issues/49) | Also the camp tent for Thorin's farewell. |
| `erebor` | The Lonely Mountain: gate, secret door ledge, treasure hall, tomb | kit | `smaug-comes-to-erebor`, `the-secret-door`, `bilbo-meets-smaug`, `battle-of-five-armies`, `thorin-is-laid-to-rest` | P4 | brief | local | [#49](https://github.com/esgabo/ardatir/issues/49) | Battle event is placed at erebor in content. |
| `prancing-pony` | The Prancing Pony (Bree inn) | kit | `meeting-in-bree` | P6 | brief | local (no issue yet) | **none** | Could reuse Green Dragon inn pieces. |
| `gladden-fields` | Gladden Fields (river, reeds) | kit | `smeagol-takes-the-ring` | P6 | brief | local (no issue yet) | **none** | Small river-bank diorama. |
| `azanulbizar` | Azanulbizar (Dimrill Dale before the gates of Moria) | kit | `battle-of-azanulbizar` | P6 | brief | local (no issue yet) | **none** | Battle valley with the gates. |
| `dol-guldur` | Dol Guldur (fortress, dungeon) | kit | `gandalf-finds-thrain`, `white-council-drives-out-sauron` | P6 | brief | local (no issue yet) | **none** | Two events: Thráin in the dungeon and the White Council attack. |

## Cross-cutting issues

Not assets, but the assets depend on them.

| Issue | What | Machine |
|---|---|---|
| [#20](https://github.com/esgabo/ardatir/issues/20) | Blender to glTF pipeline, loader, size check | either |
| [#21](https://github.com/esgabo/ardatir/issues/21) | Shared rigs and clip sets | local |
| [#22](https://github.com/esgabo/ardatir/issues/22) | Playback driven by the event clock | cloud |
| [#25](https://github.com/esgabo/ardatir/issues/25) | Per-event terrain and dioramas | either |
| [#26](https://github.com/esgabo/ardatir/issues/26) | Light, mood, time of day | local |
| [#27](https://github.com/esgabo/ardatir/issues/27) | Sound | local |
| [#28](https://github.com/esgabo/ardatir/issues/28) | Quality target: the Unexpected Party | local |

## Gaps

Assets the content needs that no issue covers yet. Natural homes: extra dwarves with [#23](https://github.com/esgabo/ardatir/issues/23), Shire props with [#24](https://github.com/esgabo/ardatir/issues/24), Bree, Gladden Fields, Azanulbizar and Dol Guldur in a new environment issue.

- `dain` (Dáin): battle-of-azanulbizar, battle-of-five-armies, thorin-is-laid-to-rest
- `thror` (Thrór): smaug-comes-to-erebor
- `thrain` (Thráin): smaug-comes-to-erebor, battle-of-azanulbizar, gandalf-finds-thrain
- `frerin` (Frerin): battle-of-azanulbizar
- `nain` (Náin): battle-of-azanulbizar
- `saruman` (Saruman): white-council-drives-out-sauron
- `deagol` (Déagol): smeagol-takes-the-ring
- `azog` (Azog): battle-of-azanulbizar
- `ponies` (Company ponies): guests-of-beorn
- `thrush` (The old thrush): the-secret-door, death-of-smaug, the-gathering-of-the-clouds
- `roac` (Roäc, son of Carc): the-gathering-of-the-clouds
- `mithril-coat` (Bilbo's mithril coat): not-at-home
- `troll-camp-props` (Troll cooking set: spit, mutton, pot, the talking purse): roast-mutton
- `bag-end-tea-set` (Bag End feast set (plates, mugs, food, tea)): unexpected-party, bilbo-runs-to-the-green-dragon
- `thorins-note` (Thorin's note): bilbo-runs-to-the-green-dragon
- `smaugs-cup` (Smaug's cup): bilbo-meets-smaug
- `auction-lots` (Auction lots (furniture, notice, spoons)): the-auction-at-bag-end
- `prancing-pony` (The Prancing Pony (Bree inn)): meeting-in-bree
- `gladden-fields` (Gladden Fields (river, reeds)): smeagol-takes-the-ring
- `azanulbizar` (Azanulbizar (Dimrill Dale before the gates of Moria)): battle-of-azanulbizar
- `dol-guldur` (Dol Guldur (fortress, dungeon)): gandalf-finds-thrain, white-council-drives-out-sauron

Content notes:

- [#36](https://github.com/esgabo/ardatir/issues/36) says The Hobbit has 29 events; the `hobbit` tag gives 30. The extra one is probably `smeagol-takes-the-ring` (also tagged `lord-of-the-rings`, sourced from the Fellowship), which [#39](https://github.com/esgabo/ardatir/issues/39) does list.
- Fixed in [#53](https://github.com/esgabo/ardatir/issues/53): Thorin and Bilbo added to `thorin-is-laid-to-rest`; Elrond, Galadriel and Círdan to `white-council-drives-out-sauron`; the three stone trolls to `the-troll-gold`; `battle-of-five-armies` moved from `erebor` to `dale`; the `gollum` summary now covers both forms.
- `gollum` is one content character but needs two models: young Sméagol for the Ring event and the creature for the riddles (per-event model override, [#20](https://github.com/esgabo/ardatir/issues/20)).
- `battle-of-dale`, `battle-of-pelargir` and `battle-of-the-pelennor-fields` are not *The Hobbit* and are left out (Dale, Dáin and Gandalf are reused there later).

Also: the rig gaps above (goblin, quadruped, small bird), and [#23](https://github.com/esgabo/ardatir/issues/23) and [#45](https://github.com/esgabo/ardatir/issues/45) only partly cover the props the Unexpected Party needs.
