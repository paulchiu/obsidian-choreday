import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    /** `obsidian` ships types only; DOM tests get a stub of the runtime parts `src/ui` uses. */
    alias: {
      obsidian: decodeURIComponent(new URL('./tests/stubs/obsidian.ts', import.meta.url).pathname),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    /**
     * West of UTC, a Date at UTC midnight falls on the previous local day, so tests catch date code
     * that reads local fields where it should read UTC ones. UTC and AEST would hide that.
     */
    env: { TZ: 'America/Los_Angeles' },
  },
})
