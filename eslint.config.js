// Gemeinsame ESLint-Konfiguration (Flat Config).
// Pakete ohne eigene eslint.config.js nutzen automatisch diese Datei.
// apps/web und apps/mobile bekommen eigene Configs (Next.js bzw. Expo)
// und können diese hier importieren und erweitern.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    '**/coverage/',
    '**/.next/',
    '**/.expo/',
    'supabase/functions/',
    '**/database.types.ts',
  ]),
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // packages/shared läuft in Expo (Hermes), im Browser und in Node.
    // Deshalb keine DOM- oder Node-spezifischen APIs.
    files: ['packages/shared/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'packages/shared muss plattformneutral bleiben.' },
        { name: 'document', message: 'packages/shared muss plattformneutral bleiben.' },
        { name: 'navigator', message: 'packages/shared muss plattformneutral bleiben.' },
        { name: 'localStorage', message: 'packages/shared muss plattformneutral bleiben.' },
        { name: 'process', message: 'packages/shared muss plattformneutral bleiben.' },
        { name: 'Buffer', message: 'packages/shared muss plattformneutral bleiben.' },
        { name: 'require', message: 'packages/shared muss plattformneutral bleiben.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['node:*'], message: 'packages/shared muss plattformneutral bleiben.' },
            {
              group: ['react', 'react-native', 'react-dom', 'next', 'next/*', 'expo', 'expo-*'],
              message: 'packages/shared darf keine UI-Frameworks importieren.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
