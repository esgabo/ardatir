# Narrators

One narrator per age, per audio language. The design is in [`docs/superpowers/specs/2026-11-10-narration-voices-design.md`](../../docs/superpowers/specs/2026-11-10-narration-voices-design.md).

Each narrator gets a `<id>.yaml` definition (not written yet; the narration pipeline adds the format) and, per language, a reference sample `<id>.<lang>.flac`. The sample is our own designed voice, which every recording in that language is cloned from. It is never a real actor's voice.

## the-elder (Before Time)

`the-elder.en.flac` is 14.75 s long, 24 kHz mono, sha256 `196acd99b54d29007d96a73ec553e0563e03a30a0bf8ddcfcbf2daca4bceca54`.

- **Source:** audition candidate A, chosen by the author on 2026-11-10. It was designed on VoiceStudio 0.5.6 with OmniVoice.
- **Settings:** `instruct: "male, elderly, low pitch, british accent"`, `seed: 101`, `speed: 0.9`, server defaults otherwise.
- **Contents:** the *void* passage, then 0.4 s of silence, then the *discord* passage. Its words (`refText`):
  > Before there was a world, there was only Ilúvatar, the One, and the Ainur he had made from his thought. But Melkor, the mightiest of them, wanted more than his part. He wove his own thoughts into the music, and discord spread around him.
