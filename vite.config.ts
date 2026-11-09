import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { buildContent, describe, writeContent } from './scripts/content/build.ts';

const contentDir = path.resolve(__dirname, 'content');
const publicDir = path.resolve(__dirname, 'public');

/** Builds content/ into public/data/ on start, and again whenever content changes in dev. */
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
      server.watcher.add(contentDir);
      const onChange = (file: string) => {
        if (!file.startsWith(contentDir)) return;
        run();
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', onChange).on('change', onChange).on('unlink', onChange);
    },
  };
}

// Relative base so the build works on GitHub Pages (/ardatir/) or any other static host.
export default defineConfig({
  base: './',
  plugins: [ardatirContent()],
  build: {
    rollupOptions: {
      output: {
        // three.js changes far less often than the site: its own chunk stays cached between deploys.
        manualChunks: (id) => (id.includes('/node_modules/three/build/') ? 'three' : undefined),
      },
    },
  },
});
