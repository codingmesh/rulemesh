'use strict';

module.exports = require('eslint-config-sukka').sukka({
  ignores: [
    '**/*.conf',
    '**/*.txt'
  ],
  js: {
    disableNoConsoleInCLI: ['Build/**']
  },
  node: true,
  ts: true,
  yaml: false
}, {
  rules: {
    'sukka/unicorn/filename-case': 'off',
    'sukka/prefer-foxts-noop': 'off'
  }
}, {
  files: ['./Mock/**/*'],
  rules: {
    'sukka/unicorn/filename-case': 'off'
  }
}, {
  files: ['./Build/native-routing.ts', './Build/acceptance.ts', './Build/sync-sources.ts'],
  rules: {
    '@stylistic/no-confusing-arrow': 'off',
    '@typescript-eslint/array-type': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    '@typescript-eslint/no-unnecessary-type-conversion': 'off',
    'n/prefer-global/buffer': 'off',
    'n/prefer-global/process': 'off',
    'no-await-in-loop': 'off',
    'no-promise-executor-return': 'off',
    'no-return-assign': 'off',
    'preserve-caught-error': 'off',
    'promise/param-names': 'off',
    'regexp/prefer-w': 'off',
    'regexp/no-unused-capturing-group': 'off',
    'sukka/avoid-string-starts-with-single-char': 'off',
    'sukka/prefer-foxts-error-util': 'off',
    'sukka/prefer-foxts-wait': 'off',
    'sukka/unicorn/consistent-function-scoping': 'off',
    'sukka/unicorn/no-nested-ternary': 'off',
    'sukka/unicorn/no-useless-coercion': 'off',
    'sukka/unicorn/number-literal-case': 'off',
    'unused-imports/no-unused-vars': 'off',
    'vibe-proof/prefer-hoisted-regex': 'off',
    'vibe-proof/prefer-indexed-array-loop': 'off'
  }
});
