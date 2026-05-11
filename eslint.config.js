import js from '@eslint/js';
import globals from 'globals';
import headers from 'eslint-plugin-headers';

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
    {
        files: ['src/**/*.js', 'tests/**/*.js', 'scripts/**/*.js', '*.config.js'],
        plugins: { headers },
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
            'headers/header-format': [
                'error',
                {
                    source: 'file',
                    path: 'LICENSE_HEADER.template',
                    variables: {
                        year: new Date().getFullYear().toString(),
                    },
                },
            ],
            'prefer-const': 'error',
            'no-var': 'error',
            eqeqeq: 'error',
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        },
    },
];

