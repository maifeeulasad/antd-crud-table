import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
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
      // A schema-driven table generic over arbitrary record shapes uses
      // `any` at its data boundaries (row indexing, ids, antd rule and
      // valueEnum interop), and interface-typed consumers cannot satisfy
      // Record<string, unknown> constraints. Keep the rule visible as a
      // warning so new accidental `any`s still surface without failing CI.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
)
