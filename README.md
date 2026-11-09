# Ardatir

*A watch over Arda* (AR-da-teer).

An isometric, animated journey through the events of Tolkien's world. Travel through space and time: begin in the Void as the Ainur sing the world into being, then zoom down into the ages, and into single events played out as low-poly dioramas.

- **Three zoom levels:** the cosmos (Arda floating inside its airs and seas), the world of each age, and the event dioramas.
- **Timeline scrubbing:** drag to any moment. Every moment has its own shareable URL.
- **Characters:** click one to see who they are and what they're thinking right now.
- **Narration:** each event is told in passages that appear word by word in step with the animation and, when a recording exists, the voice.
- **Cross-views:** pick a moment and see everything else happening then; follow characters' lives side by side and see where they cross.
- **English and Spanish.**

See [`docs/DESIGN.md`](docs/DESIGN.md) for the full design.

## Develop

```sh
npm install
npm run dev       # http://localhost:5173
npm run build     # static site in dist/
npm run preview   # serve dist/
npm run content   # validate content/
```

Plain Vite + TypeScript + three.js, no framework. The output is a static site.

```
content/       all events, characters, places, journeys and scripts (YAML); see content/README.md
scripts/       the content build: validates content/ and writes public/data/
src/
  data/        the compiled data model and the shared time axis
  scene/       cosmos.ts (Ainulindalë, Arda), dioramaStage.ts (events), figures, terrain
  i18n.ts      languages and interface strings
  eventClock.ts one clock for animation, narration text and audio
  narration.ts optional narration recording, following the clock
  main.ts      app shell: routing, timeline, panels
```

### Adding content

Everything lives in `content/`, one YAML file per event, character, place or journey. [`content/README.md`](content/README.md) has the formats and a template. Write summaries, thoughts and narration **in your own words**. Run `npm run content` to validate.

## Disclaimer

Ardatir is a non-commercial fan project. It is not affiliated with, endorsed by, or connected to the Tolkien Estate, the Tolkien Trust, Middle-earth Enterprises, or any film or television studio. *The Hobbit*, *The Lord of the Rings*, *The Silmarillion* and the names, places and events of Tolkien's works belong to their respective rights holders.

All text here is original summary, all maps, models and art are original, and no imagery from the films or series is used.

## License

The code and original art are MIT-licensed (see [LICENSE](LICENSE)). This license covers only this project's own work, not Tolkien's.
