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
