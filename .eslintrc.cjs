/**
 * ESLint config (legacy v8 .eslintrc format — keeps the toolchain simple while
 * astro-eslint-parser still ships best with v8). Move to flat config once
 * eslint-plugin-astro stabilises on it.
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  plugins: ['@typescript-eslint', 'jsx-a11y'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:astro/recommended',
    'plugin:jsx-a11y/recommended',
    'prettier',
  ],
  rules: {
    'no-console': ['error', { allow: ['warn', 'error'] }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/consistent-type-imports': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
  },
  overrides: [
    {
      files: ['*.astro'],
      parser: 'astro-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser',
        extraFileExtensions: ['.astro'],
      },
      rules: {
        // Astro components handle their own slot/aria semantics inside frontmatter;
        // a11y plugin is too noisy for component-internal markup. Pages get the full sweep.
        'jsx-a11y/heading-has-content': 'off',
      },
    },
    {
      files: ['*.cjs', '*.config.js', '*.config.mjs'],
      env: { node: true },
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
    {
      files: ['scripts/**/*.{ts,js,mjs,cjs}'],
      rules: {
        'no-console': 'off',
      },
    },
    {
      files: ['src/lib/**/*.ts'],
      rules: {
        // Content layer logs build-time warnings about missing tldr / quiz parse errors.
        'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
      },
    },
  ],
  ignorePatterns: ['dist/', '.astro/', 'node_modules/', 'coverage/', 'public/pagefind/', '*.d.ts'],
};
