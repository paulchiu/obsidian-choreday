import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    /** `obsidian` ships types only; DOM tests get a stub of the runtime parts `src/ui` uses. */
    alias: {
      obsidian: decodeURIComponent(new URL('./tests/stubs/obsidian.ts', import.meta.url).pathname),
    },
  },
  /** Vite 8 transforms with Oxc; its `esbuild` option is deprecated. */
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    /**
     * West of UTC, a Date at UTC midnight falls on the previous local day, so tests catch date code
     * that reads local fields where it should read UTC ones. UTC and AEST would hide that.
     */
    env: { TZ: 'America/Los_Angeles' },
  },
})
