/**
 * .eslintrc.cjs
 * 
 * ESLint enforcement for "SERVER IS THE SOURCE OF TRUTH".
 * Forbids direct client storage access (localStorage, sessionStorage, indexedDB, document.cookie)
 * outside the designated wrappers (src/lib/uiPreferences.ts and src/lib/displayCache.ts).
 */

module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  plugins: ['@typescript-eslint'],
  rules: {
    // 1. Forbid global storage identifiers
    'no-restricted-globals': [
      'warn',
      {
        name: 'localStorage',
        message: 'Direct access to localStorage is forbidden. Use Supabase for business data, or src/lib/uiPreferences.ts for whitelisted UI settings.'
      },
      {
        name: 'sessionStorage',
        message: 'Direct access to sessionStorage is forbidden. Server (Supabase) is the source of truth.'
      },
      {
        name: 'indexedDB',
        message: 'Direct access to indexedDB is forbidden. Use src/lib/displayCache.ts (max 24h display-only cache).'
      }
    ],

    // 2. Forbid property access window.localStorage, window.sessionStorage, window.indexedDB, document.cookie
    'no-restricted-properties': [
      'warn',
      {
        object: 'window',
        property: 'localStorage',
        message: 'Direct access to window.localStorage is forbidden. Use src/lib/uiPreferences.ts.'
      },
      {
        object: 'window',
        property: 'sessionStorage',
        message: 'Direct access to window.sessionStorage is forbidden. Server is the source of truth.'
      },
      {
        object: 'window',
        property: 'indexedDB',
        message: 'Direct access to window.indexedDB is forbidden. Use src/lib/displayCache.ts.'
      },
      {
        object: 'document',
        property: 'cookie',
        message: 'Direct access to document.cookie is forbidden.'
      }
    ],

    // 3. Forbid zustand persist and redux-persist imports outside authorized wrappers
    'no-restricted-syntax': [
      'warn',
      {
        selector: "ImportDeclaration[source.value=/.*(zustand\\/middleware|redux-persist).*/]",
        message: 'Persisted client stores (zustand persist, redux-persist) are forbidden as a source of truth.'
      }
    ]
  },
  overrides: [
    {
      // Allow storage wrappers to access native storage
      files: [
        'src/lib/uiPreferences.ts',
        'src/lib/displayCache.ts',
        'lib/uiPreferences.ts',
        'lib/displayCache.ts'
      ],
      rules: {
        'no-restricted-globals': 'off',
        'no-restricted-properties': 'off'
      }
    },
    {
      // Allow test files
      files: [
        '**/*.test.{ts,tsx,js,jsx}',
        '**/*.spec.{ts,tsx,js,jsx}',
        'tests/**/*',
        'scripts/**/*'
      ],
      rules: {
        'no-restricted-globals': 'off',
        'no-restricted-properties': 'off',
        'no-restricted-syntax': 'off'
      }
    }
  ]
};

