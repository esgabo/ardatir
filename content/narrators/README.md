# Narrators

One narrator per age, per audio language. The design is in [`docs/superpowers/specs/2026-11-10-narration-voices-design.md`](../../docs/superpowers/specs/2026-11-10-narration-voices-design.md).

Each narrator gets a `<id>.yaml` definition (format in [`content/README.md`](../README.md)) and, per language, a reference sample `<id>.<lang>.flac`. The sample is our own designed voice, which every recording in that language is cloned from. It is never a real actor's voice.

## the-elder (Before Time)

`the-elder.en.flac` is 14.75 s long, 24 kHz mono, sha256 `196acd99b54d29007d96a73ec553e0563e03a30a0bf8ddcfcbf2daca4bceca54`.

- **Source:** audition candidate A, chosen by the author on 2026-11-10. It was designed on VoiceStudio 0.5.6 with OmniVoice.
- **Settings:** `instruct: "male, elderly, low pitch, british accent"`, `seed: 101`, `speed: 0.9`, server defaults otherwise.
- **Contents:** the *void* passage, then 0.4 s of silence, then the *discord* passage. Its words (`refText`):
  > Before there was a world, there was only Ilúvatar, the One, and the Ainur he had made from his thought. But Melkor, the mightiest of them, wanted more than his part. He wove his own thoughts into the music, and discord spread around him.

`the-elder.es.flac` is 13.39 s long, 24 kHz mono, sha256 `2c7931920e331bf72fde13c84be366f5767afa66ea5b65ca3230f3a52f7186c6`.

- **Source:** Spanish audition candidate E, chosen by the author on 2026-11-11 for its Latin American accent. It was designed on VoiceStudio 0.5.6 with OmniVoice, `language: es`.
- **Settings:** `instruct: "male, elderly, low pitch, american accent"`, `seed: 101`, `speed: 0.9`, server defaults otherwise. OmniVoice has no Spanish accent tags, only English accents and Chinese dialects. With `language: es`, this English tag gave the accent we wanted. Every recording clones the sample, so the tag doesn't matter after this.
- **Contents:** the *void* passage, then 0.4 s of silence, then the *theme* passage, which ends on "su propia voz" and carries the seseo. Its words (`refText`):
  > Antes de que hubiera un mundo, solo existía Ilúvatar, el Único, y los Ainur que había creado de su pensamiento. Les dio un gran tema, y comenzaron a cantarlo juntos, cada uno sumando su propia voz.
