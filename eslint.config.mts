import tseslint from 'typescript-eslint'
import obsidianmd from 'eslint-plugin-obsidianmd'
import globals from 'globals'
import { defineConfig, globalIgnores } from 'eslint/config'
import type { Linter } from 'eslint'

/**
 * `import.meta.dirname` is Node-only and this file is typed by the default
 * project (tsconfig.json), which has no `node` types, so it resolves to an
 * error type. Assert it once here rather than at each use site.
 */
const tsconfigRootDir = import.meta.dirname as string

/**
 * The options obsidianmd's recommended config gives `rule`, so a fence below can add to them rather
 * than replace them (ESLint replaces rule options rather than merging).
 */
const recommendedOptions = (rule: string): unknown[] => {
  const setting = [...obsidianmd.configs.recommended].reverse().find((c) => c.rules?.[rule])
  const entry = setting?.rules?.[rule]
  return Array.isArray(entry) ? entry.slice(1) : []
}

interface Banned {
  paths: { name: string; message: string }[]
  patterns: { group: string[]; message: string }[]
}

/** Bans imports across a tier boundary, on top of obsidianmd's own restricted imports. */
const fence = ({ paths, patterns }: Banned): Linter.RuleEntry => [
  'error',
  {
    paths: [...recommendedOptions('@typescript-eslint/no-restricted-imports'), ...paths],
    patterns,
  },
]

/** Obsidian's own globals, banned where code must run without Obsidian. */
const NO_OBSIDIAN_GLOBALS: Linter.RuleEntry = [
  'error',
  ...recommendedOptions('no-restricted-globals'),
  ...['activeDocument', 'activeWindow', 'createFragment'].map((name) => ({
    name,
    message: 'Only src/ui/obsidian uses Obsidian globals; reach the document through an element.',
  })),
]

export default defineConfig(
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        activeWindow: 'readonly',
        activeDocument: 'readonly',
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'eslint.config.mts',
            'manifest.json',
            'version-bump.mjs',
            'vitest.config.ts',
          ],
        },
        tsconfigRootDir,
        extraFileExtensions: ['.json'],
      },
    },
  },
  ...obsidianmd.configs.recommended,
  {
    /**
     * obsidianmd's hybrid recommended config enables its typed rules (which
     * call getParserServices()) globally rather than only on TypeScript files. On
     * package.json (parsed with the JSON language) and on *.mjs/config files they
     * crash with "rule which requires type information". Turn the typed rules off
     * everywhere; the block below re-enables them on real TypeScript source where
     * parser services exist.
     */
    rules: {
      'obsidianmd/no-plugin-as-component': 'off',
      'obsidianmd/no-view-references-in-plugin': 'off',
      'obsidianmd/no-unsupported-api': 'off',
      'obsidianmd/prefer-file-manager-trash-file': 'off',
      'obsidianmd/prefer-instanceof': 'off',
      'obsidianmd/no-global-this': 'off',
    },
  },
  {
    files: ['**/*.{ts,cts,mts,tsx,js,cjs,mjs,jsx}'],
    /**
     * Restates obsidianmd's `no-restricted-disable` list (ESLint replaces rule
     * options rather than merging them) so `no-global-this` can still be
     * silenced inline in tests.
     *
     * Patterns are matched with gitignore semantics, so `obsidianmd/*` excludes
     * the `obsidianmd/ui` segment wholesale. The `ui` pair below reopens that
     * segment before restricting its rules individually.
     */
    rules: {
      'eslint-comments/no-restricted-disable': [
        'error',
        'obsidianmd/*',
        '!obsidianmd/ui',
        'obsidianmd/ui/*',
        '!obsidianmd/no-global-this',
        'no-console',
        'no-restricted-globals',
        '@typescript-eslint/no-restricted-imports',
        'no-alert',
        '@typescript-eslint/no-deprecated',
        '@typescript-eslint/no-explicit-any',
        '@microsoft/sdl/no-document-write',
        'no-eval',
        '@microsoft/sdl/no-inner-html',
        'obsidianmd/no-nodejs-modules',
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    rules: {
      'obsidianmd/no-plugin-as-component': 'error',
      'obsidianmd/no-view-references-in-plugin': 'error',
      'obsidianmd/no-unsupported-api': 'error',
      'obsidianmd/prefer-file-manager-trash-file': 'error',
      'obsidianmd/prefer-instanceof': 'error',
      'obsidianmd/no-global-this': 'error',
      'obsidianmd/prefer-window-timers': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },
  {
    /** Pure tiers: the paths say these run without Obsidian, Preact or the vault, and lint holds them to it. */
    files: ['src/domain/**/*.ts', 'src/ui/model/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': fence({
        paths: [
          { name: 'obsidian', message: 'Pure modules never import obsidian.' },
          {
            name: 'preact',
            message: 'Pure modules return data; components in src/ui/components draw it.',
          },
        ],
        patterns: [
          {
            group: ['preact/*', '**/components/*', '**/obsidian/*', '**/vault/*'],
            message: 'Pure modules import only ts-pattern, src/domain and src/ui/model.',
          },
        ],
      }),
      'no-restricted-globals': NO_OBSIDIAN_GLOBALS,
    },
  },
  {
    files: ['src/ui/components/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': fence({
        paths: [
          {
            name: 'obsidian',
            message:
              'Components reach Obsidian through the Host context; only src/ui/obsidian imports it.',
          },
        ],
        patterns: [
          {
            group: ['**/obsidian/*', '**/vault/*'],
            message: 'Components take what they need as props or from the Host context.',
          },
        ],
      }),
      'no-restricted-globals': NO_OBSIDIAN_GLOBALS,
    },
  },
  {
    files: ['src/vault/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': fence({
        paths: [],
        patterns: [{ group: ['**/ui/*'], message: 'The vault tier never imports from src/ui.' }],
      }),
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    /**
     * happy-dom has no Obsidian prototype until `tests/stubs/obsidian-dom.ts` installs it, and that
     * shim and the `obsidian` stub must build elements with `document.createElement` themselves.
     */
    rules: {
      'obsidianmd/prefer-create-el': 'off',
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: false,
        project: './tsconfig.vitest.json',
        tsconfigRootDir,
      },
    },
  },
  {
    /** Reads `styles.css` from disk under Vitest, never inside Obsidian. */
    files: ['tests/ui/styles.test.ts'],
    rules: {
      'obsidianmd/no-nodejs-modules': 'off',
    },
  },
  {
    /** Runs under node during `npm version`, never inside Obsidian. */
    files: ['version-bump.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'obsidianmd/no-nodejs-modules': 'off',
    },
  },
  globalIgnores(['node_modules', 'dist', 'esbuild.config.mjs', 'versions.json', 'main.js']),
)
