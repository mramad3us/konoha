import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __GAME_VERSION__: JSON.stringify('test') },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
