# Models: from Blender to the diorama

How a character (or a kit, or a prop) gets from a `.blend` file into an event's diorama. The art direction is in [`DESIGN.md`](DESIGN.md) §9, the list of what *The Hobbit* needs in [`ASSETS.md`](ASSETS.md). Pipeline issue: [#20](https://github.com/esgabo/ardatir/issues/20); clip playback: [#22](https://github.com/esgabo/ardatir/issues/22).

## Folder layout

```
assets/                          sources and exports, next to content/ (never served as a folder)
  characters/<id>/
    <id>.glb                     the export the site loads (meshopt-compressed, within budget)
    <id>.blend                   optional Blender source; never copied to the site
    <id>-<variant>.glb           another model of the same character, for a per-event override
  kits/<kit>/                    reusable pieces for a place: kits/shire/, kits/rivendell/
    <kit>.glb                    (or several files: hobbit-hole.glb, hedges.glb)
  props/<id>/<id>.glb            single things a scene needs: props/barrel/barrel.glb
```

- One asset per folder, named by its id (kebab-case, like content ids). A character's folder is named after its content id (`characters/bilbo/`).
- Only the `.glb` files that content points to are copied into the site (`public/data/models/<same path>`). Everything else in `assets/` stays in the repository only.
- **No Git LFS.** GitHub Pages doesn't serve LFS files, so every file here is a plain git file. Keep `.blend` sources under 20 MB (the build warns above that); purge unused data before committing (*File → Clean Up → Purge Unused Data*). Blender's backups (`.blend1`) are gitignored.
- Shared rigs and clip sets per body type ([#21](https://github.com/esgabo/ardatir/issues/21)) live in the Blender files; each character's export carries its own copy of the rig and the clips it needs, so one `.glb` is all the site loads per character.

## From Blender to the site

1. **Model** in Blender following the conventions below.
2. **Export** with the settings below to any folder outside the repository (say `~/exports/bilbo.glb`).
3. **Pack** it into `assets/` with meshopt compression and a budget check:
   ```sh
   npm run model:pack -- ~/exports/bilbo.glb characters/bilbo/bilbo.glb
   ```
   It prints the size before and after, the budget, and the clips it found. (It runs [gltfpack](https://meshoptimizer.org/gltf/) with `-cc -kn -km`: meshopt compression, quantized geometry, named nodes and materials kept, animations resampled at 30 Hz.)
4. **Link** it from content: `model: characters/bilbo/bilbo.glb` in `content/characters/bilbo.yaml` (see [Linking](#linking-from-content)).
5. **Check**: `npm run content` (no errors or warnings), then `npm run dev` and open a staged event with the character, e.g. `#/event/unexpected-party`.

## Models built by script

A character can also be built entirely in code, in headless Blender: low-poly parts, the shared rig for its body type, its clips, then the export with the settings below. Changing a colour or a proportion means editing the script and running it again. Scripts live in `scripts/models/blender/`:

- `lowpoly.py`: faceted parts (lofted tubes, ellipsoids, boxes, cones, open shells), flat-colour materials, and joining them into one flat-shaded mesh with each part's bone weights.
- `hobbit_rig.py`: the hobbit rig (#21): sixteen bones placed from a character's joints, and the base clips (`idle`, `walk`, `run`, `talk`, `hide`, `fight`), each a pose function of the cycle's phase, keyed on every frame so it loops exactly. Walk and run are timed for `GAIT_PACE`.
- `bilbo.py`: Bilbo at home. It writes `assets/characters/bilbo/bilbo.blend` and the raw export `out/models/bilbo.glb`.
- `turnaround.py`: review renders of a `.blend` (front, three-quarter, side, back, the diorama's angle, and any `clip:frame`).

```sh
blender --background --python scripts/models/blender/bilbo.py
npm run model:pack -- out/models/bilbo.glb characters/bilbo/bilbo.glb
blender --background assets/characters/bilbo/bilbo.blend --python scripts/models/blender/turnaround.py -- /tmp/bilbo walk:5 hide:15
```

## Blender export settings

*File → Export → glTF 2.0 (.glb/.gltf)* (names as in Blender 4.x; older versions group them slightly differently). Save them as an operator preset ("Ardatir") so every export matches.

| Section | Setting | Value |
|---|---|---|
| Format | Format | **glTF Binary (.glb)** |
| Include | Limit to | **Selected Objects** (or *Active Collection*): one asset per file, no cameras or lights |
| Include | Custom Properties | off |
| Transform | +Y Up | **on** (glTF is Y-up; Blender converts from Z-up) |
| Data → Mesh | Apply Modifiers | **on** |
| Data → Mesh | UVs, Normals | on; Vertex Colors on if the materials use them |
| Data → Mesh | Tangents | off |
| Data → Material | Materials | Export; Images: *Automatic* (or *None* for flat colours) |
| Data → Shape Keys | | only if the model uses them |
| Data → Armature | Use Rest Position | on; *Export Deformation Bones Only* on |
| Data → Skinning | | on, *Include All Bone Influences* off (4 per vertex) |
| Data → Compression | Draco | **off** (the site decodes meshopt, not Draco; `model:pack` compresses) |
| Animation | Mode | **Actions** |
| Animation | Export all Armature Actions | on (every clip, not only the active one) |
| Animation | Sampling | on, rate 1 |
| Animation | Optimize Animation Size | on |

Before exporting:

- **Apply transforms** on every object (*Object → Apply → All Transforms*), so rotation 0, scale 1. The armature too, before skinning.
- **One scene per asset**, one root (the armature for a character, or an empty).
- **Flat shading** for the faceted look: *Shade Flat* (or split normals via *Auto Smooth* at a low angle for hard edges).

## Conventions

- **Size**: model at real height in metres (Bilbo about 1.05 m, Gandalf about 1.75 m). The site scales every character to the same unit height and multiplies by `Character.scale` in content, so `scale` stays the single source of relative heights; real sizes just keep Blender sane.
- **Origin** between the feet, on the ground (z = 0 in Blender). The site puts the lowest point of the model on the terrain.
- **Facing**: the character looks toward **−Y in Blender** (towards you in *Front* view, Numpad 1). With *+Y Up* that becomes glTF's +Z, which is "forward" in the diorama.
- **Materials**: flat colours (base colour, roughness) wherever possible; one small shared texture atlas at most. No transparency unless needed (hair cards are not the look).
- **Clips** (one action each, looping): `idle`, `walk`, `run`, `talk`, `hide`, `fight`, named exactly so. The diorama plays the clip for the pose sampled at `t` in the event's `staging.yaml` (`action:` of the keyframes; a figure moving between keyframes walks or runs). A missing clip falls back: `run` → `walk` → `idle`; `talk`, `hide`, `fight` → `idle`. With no clips at all, the figure keeps the placeholder's motion (bobbing on the move, crouching to hide). The build warns about any other clip name; more clips (gesture, sit) can be added here when staging gets a way to ask for them.
- **Walk and run cycles** loop seamlessly (first and last frame match) and stay in place (no root motion): the site moves the figure along its track. Make them at a natural pace: a walk covering about 0.8 of the figure's height per second, a run about 2 (`GAIT_PACE` in `src/scene/modelClips.ts`). A figure moving faster or slower on its track plays the cycle faster or slower to match, between half and two and a half times the clip's pace, so feet keep up with the ground.
- **Playback** (#22): when an action changes, the old clip fades into the new one over a quarter of a second of event time (`FADE_SECONDS`, `actionMix` in `src/timeline.ts`); a figure turns to face each new direction of travel over about a third of a second, the short way round, and keeps facing it while it stands (`headingAt`). All of it is worked out from the keyframes and `t` alone, so a scrub or a deep link lands on the same pose and heading. The selection ring stays under the model, and a selected (followed) character is kept in view: when they walk toward the edge, the camera glides after them.

## Budgets

Bytes on disk after `npm run model:pack`, per file, set in one place (`MODEL_BUDGETS` in `scripts/content/models.ts`):

| Type (`assets/<type>/`) | Budget | What it covers |
|---|---|---|
| `characters` | **300 kB** | one rigged character with its clips |
| `kits` | **800 kB** | one kit file of reusable pieces for a place |
| `props` | **100 kB** | one small thing |

The build rejects a model over its budget. Most of a character's size is its clips: keep them short (1–2 s loops) and the bone count modest. If an asset really needs more, raise its type's budget in that one file, with a comment saying why.

## Linking from content

A character's usual model, in `content/characters/<id>.yaml`:

```yaml
model: characters/bilbo/bilbo.glb    # a path under assets/
```

An event's own model for a character, in that event's `staging.yaml` (young Sméagol and Gollum are one character with two models; Bilbo in a barrel):

```yaml
tracks:
  - characterId: bilbo
    model: characters/bilbo/bilbo-barrel.glb
    keyframes: [...]
```

Without either, the character is drawn as the placeholder figure.

## What the build checks

`npm run content` (and `dev`, `build`) checks every `model:`:

- a `.glb` path under `assets/`, lowercase, of a known type (`characters/` for characters and tracks);
- the file exists (**error** otherwise);
- it is within its type's budget (**error**);
- it is a binary glTF 2.0 file, without Draco or KTX2 textures, which the site can't decode (**error**);
- it is meshopt-compressed, has one scene, and its clips are ones the diorama plays (**warnings**).

It copies each model once into `public/data/models/`, and warns about any `.blend` in `assets/` over 20 MB.

## How the site plays it

- `src/scene/models.ts` (its own chunk, loaded only when an event has a model): `GLTFLoader` with the meshopt decoder, one load per URL shared by every figure, a clone per figure (skeletons too), scaled to `0.82 × Character.scale` units, the height of the placeholder.
- `src/scene/dioramaStage.ts` draws the placeholder at once and swaps in the model when it arrives; if it fails to load, the placeholder stays (with a console warning).
- Clips are driven by an `AnimationMixer` whose weights and times are **set** from `t` each frame (`clipLayers` in `src/scene/modelClips.ts`: the event's seconds at `t`, or for walk and run the ground-paced `strideSeconds`, wrapped to the clip; two layers during a cross-fade), never advanced by the wall clock, so scrubbing and deep links show exactly the same frame.

## The test model

`tests/fixtures/valid/assets/characters/test-figure/test-figure.glb` is a tiny cloaked figure with `idle`, `walk` and `talk` clips, made in code by `node scripts/models/make-test-model.ts` (three.js's `GLTFExporter`, then the same packing as `model:pack`). Only the test fixture uses it (the fixture's Gandalf): it tests the loader, the budget and the missing-model errors end to end (`tests/build.test.ts`, `tests/models.test.ts`). Never link it from real content. To see it in a browser:

```sh
ARDATIR_CONTENT=tests/fixtures/valid/content npx vite build --outDir /tmp/fixture-site --emptyOutDir
npx vite preview --outDir /tmp/fixture-site       # then #/event/the-party?t=0.2
npm run content                                    # put the real content back in public/data/
```
