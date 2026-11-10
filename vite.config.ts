import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { buildContent, describe, writeContent } from './scripts/content/build.ts';

// ARDATIR_CONTENT builds another content tree, e.g. the test fixture with the test model:
//   ARDATIR_CONTENT=tests/fixtures/valid/content npx vite build --outDir /tmp/fixture-site
// Its models come from the assets/ folder beside it.
const contentDir = path.resolve(__dirname, process.env.ARDATIR_CONTENT ?? 'content');
const assetsDir = path.join(path.dirname(contentDir), 'assets'); // models (docs/MODELS.md)
const publicDir = path.resolve(__dirname, 'public');

/** Builds content/ into public/data/ on start, and again whenever content or a model changes in dev. */
function ardatirContent(): Plugin {
  let isBuild = false;
  const run = () => {
    const result = buildContent(contentDir);
    console.log(describe(result));
    if (result.errors.length) {
      if (isBuild) throw new Error('content has errors; see above');
      return; // in dev, keep serving the last good data
    }
    writeContent(result, publicDir);
  };
  return {
    name: 'ardatir-content',
    configResolved(config) { isBuild = config.command === 'build'; },
    buildStart() { run(); },
    configureServer(server) {
      server.watcher.add([contentDir, assetsDir]);
      const onChange = (file: string) => {
        if (!file.startsWith(contentDir) && !file.startsWith(assetsDir)) return;
        run();
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', onChange).on('change', onChange).on('unlink', onChange);
    },
  };
}

/**
 * Size budgets per chunk, minified, in kB (Vite's own warning counts the same way). three.js is
 * one module, so everything any part of the site uses from it lands in its chunk: the glTF
 * loader needs its animation system, skinned meshes and loaders, about 55 kB more, which is why
 * it alone gets 600. Every chunk of our own stays under Vite's usual 500.
 */
const CHUNK_BUDGETS: Record<string, number> = { three: 600 };
const CHUNK_BUDGET = 500;

function chunkBudgets(): Plugin {
  return {
    name: 'ardatir-chunk-budgets',
    apply: 'build',
    generateBundle(_, bundle) {
      for (const c of Object.values(bundle)) {
        if (c.type !== 'chunk') continue;
        const kb = Buffer.byteLength(c.code) / 1000, max = CHUNK_BUDGETS[c.name] ?? CHUNK_BUDGET;
        if (kb > max) this.warn(`chunk "${c.name}" is ${kb.toFixed(0)} kB, over its ${max} kB budget (vite.config.ts): split it with a dynamic import()`);
      }
    },
  };
}

// Relative base so the build works on GitHub Pages (/ardatir/) or any other static host.
export default defineConfig({
  base: './',
  plugins: [ardatirContent(), chunkBudgets()],
  build: {
    // Vite's single warning limit, raised to the largest budget; chunkBudgets() checks each chunk.
    chunkSizeWarningLimit: Math.max(CHUNK_BUDGET, ...Object.values(CHUNK_BUDGETS)),
    rollupOptions: {
      output: {
        // three.js changes far less often than the site: its own chunk stays cached between deploys.
        manualChunks: (id) => (id.includes('/node_modules/three/build/') ? 'three' : undefined),
      },
    },
  },
});
