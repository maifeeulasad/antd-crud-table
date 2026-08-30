import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'dist-site', 'coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // The public API is generic over the record type, so nothing needs
      // `any`: ids are `T[K]`, columns bind `dataIndex` to `keyof T`, and the
      // field registry uses `unknown` at its genuinely dynamic boundary,
      // which forces narrowing rather than waiving it. An error, not a
      // warning - a warning is how 49 of them accumulated.
      '@typescript-eslint/no-explicit-any': 'error',
      // A leading underscore marks a binding that is deliberately unused.
      // Overridable base-class methods must keep their full parameter list
      // for subclass overrides to remain type-compatible, even where the
      // base implementation ignores them.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
)
