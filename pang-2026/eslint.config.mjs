/**
 * PANG — ESLint v9 flat config.
 *
 * The Next.js preset + a minimal set of our own. Strict TypeScript
 * rules come from tsc itself (noUncheckedIndexedAccess,
 * exactOptionalPropertyTypes); ESLint handles style-and-bug guards
 * that the compiler can't.
 */

import nextPlugin from "eslint-config-next";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  ...nextPlugin,
  {
    ignores: [
      ".next/**",
      "out/**",
      "node_modules/**",
      "public/sw.js", // hand-authored worker; CSP forbids imports
      // Playwright artifacts: bundled UI trace viewer + minified
      // fixtures. Not source we author; lint rules don't apply.
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    rules: {
      // Doctrine: no emojis in source. `check-strings.ts` handles
      // string literals; this catches anything the AST-literal rule
      // can see. Heavier TS-specific rules (consistent-type-imports,
      // etc.) land with the test-runner iteration when the
      // `@typescript-eslint` plugin is introduced deliberately.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/u]",
          message: "no emojis in source (PANG doctrine)",
        },
      ],
    },
  },
];

export default config;
