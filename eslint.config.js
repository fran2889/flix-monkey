import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,
    // Legacy single-file userscript — script context, GM_* globals
    {
        files: ['FlixMonkey.user.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script',
            globals: {
                ...globals.browser,
                GM_xmlhttpRequest: 'readonly',
                GM_getValue: 'readonly',
                GM_setValue: 'readonly',
                GM_registerMenuCommand: 'readonly',
                GM_config: 'readonly',
            },
        },
        rules: {
            'prefer-const': 'error',
            'no-var': 'error',
            eqeqeq: 'error',
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        },
    },
    // src/ modules — ES module context
    {
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.webextensions,
                // Userscript entry only — these are globals injected by the userscript manager
                GM_xmlhttpRequest: 'readonly',
                GM_getValue: 'readonly',
                GM_setValue: 'readonly',
                GM_registerMenuCommand: 'readonly',
                GM_config: 'readonly',
                chrome: 'readonly', // For Chrome service worker
            },
        },
        rules: {
            'prefer-const': 'error',
            'no-var': 'error',
            eqeqeq: 'error',
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        },
    },
];

