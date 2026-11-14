# Narrators

One narrator per age, per audio language. The design is in [`docs/superpowers/specs/2026-11-10-narration-voices-design.md`](../../docs/superpowers/specs/2026-11-10-narration-voices-design.md).

Each narrator gets a `<id>.yaml` definition (format in [`content/README.md`](../README.md)) and, per language, a reference sample `<id>.<lang>.flac`. The sample is our own designed voice, which every recording in that language is cloned from. It is never a real actor's voice.

## the-elder (Before Time)

`the-elder.en.flac` is 14.75 s long, 24 kHz mono, sha256 `196acd99b54d29007d96a73ec553e0563e03a30a0bf8ddcfcbf2daca4bceca54`.

- **Source:** audition candidate A, chosen by the author on 2026-11-10. It was designed on VoiceStudio 0.5.6 with OmniVoice.
- **Settings:** `instruct: "male, elderly, low pitch, british accent"`, `seed: 101`, `speed: 0.9`, server defaults otherwise.
- **Contents:** the *void* passage, then 0.4 s of silence, then the *discord* passage. Its words (`refText`):
  > Before there was a world, there was only Ilúvatar, the One, and the Ainur he had made from his thought. But Melkor, the mightiest of them, wanted more than his part. He wove his own thoughts into the music, and discord spread around him.

`the-elder.es.flac` is 8.00 s long, 48 kHz mono, sha256 `83f24491116dc4df14a3d83f9ea93bb46cc9aa3b9e50011cbfcb0521e0b88e67`.

- **Source:** Spanish audition candidate K, chosen by the author on 2026-11-12 for its very low pitch and neutral Latin American accent. It was designed on VoiceStudio 0.5.6 with VoxCPM2, from a description alone, `language: es`. It replaces candidate E (OmniVoice, 2026-11-11), which turned out Castilian.
- **Settings:** `seed: 101`, and this description as `instruct`: "An elderly man with a very deep, warm bass voice, very low pitch: a Latin American Spanish narrator with a neutral accent, speaking slowly, solemn and full of quiet wonder, like someone telling a very old legend."
- **Contents:** the *void* passage alone. K's other audition takes changed tone, so only this one is the voice. Its words (`refText`):
  > Antes de que hubiera un mundo, solo existía Ilúvatar, el Único, y los Ainur que había creado de su pensamiento.
- **Recording:** VoxCPM2 clones the sample from its audio and words, with no description, at `guidance_scale: 3` (the default 2.0 let it drift further from the sample). VoxCPM2 runs one engine per run; see `docs/LOCAL.md`.

## the-lady (Third Age)

`the-lady.en.flac` is 15.32 s long, 24 kHz mono, sha256 `47958f6082d452153dddd2ddc0c231413a6afbaece1ad46b32b2e7e48260ecf4`.

- **Source:** audition candidate B, chosen by the author on 2026-11-12. The brief was a calm, middle-aged woman who seems far older than she looks, after the character of Galadriel in the books, never an actress. It was designed on VoiceStudio 0.5.6 with OmniVoice.
- **Settings:** `instruct: "female, middle-aged, moderate pitch, british accent"`, `seed: 101`, `speed: 0.9`, server defaults otherwise.
- **Contents:** the *pity* passage of *Riddles in the Dark* alone. Its words (`refText`):
  > At the way out, Gollum crouched in the passage. Bilbo could have used his sword, but he felt sorry for the wretched, lonely creature and could not do it. He leapt over Gollum and escaped, with a wail of hatred echoing behind him.

`the-lady.es.flac` is 20.8 s long, 48 kHz mono, sha256 `f71bfc2aa1ecc27b92dd3f7c2ebdac26dc4266dc5a56a4c2c03bd9cc7116af4e`.

- **Source:** Spanish audition candidate M, chosen by the author on 2026-11-13. It was designed on VoiceStudio 0.5.6 with VoxCPM2, from a description alone, `language: es`.
- **Settings:** `seed: 101`, and this description as `instruct`: "A middle-aged woman with a calm, low, warm voice: a Latin American Spanish narrator with a neutral accent, speaking slowly and serenely, wise and gentle, like an ancient elf queen telling the history of her world."
- **Contents:** the same *pity* passage alone. M's other audition takes sounded like a different voice, and one said "trancuila" for *tranquila*, so only this take is the voice. Its words (`refText`):
  > Junto a la salida, Gollum estaba agazapado en el pasadizo. Bilbo podría haber usado su espada, pero sintió lástima de aquella criatura desdichada y solitaria, y no fue capaz. Saltó por encima de Gollum y escapó, mientras un grito de odio resonaba a sus espaldas.
- **Recording:** cloned like the-elder's Spanish voice, at `guidance_scale: 3`.
