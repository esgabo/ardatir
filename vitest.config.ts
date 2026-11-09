// Tests for the content build, the calendar and the event clock (`npm test`).
// A separate config so tests don't run vite.config.ts's content plugin (which writes public/data/).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
