import js from '@eslint/js';
import globals from 'globals';
import headers from 'eslint-plugin-headers';

const commonRules = {
    'prefer-const': 'error',
    'no-var': 'error',
    eqeqeq: 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
};

const userscriptGlobals = {
    GM_xmlhttpRequest: 'readonly',
    GM_getValue: 'readonly',
    GM_setValue: 'readonly',
    GM_registerMenuCommand: 'readonly',
    GM_config: 'readonly',
};

export default [
    js.configs.recommended,
    // 1. Base configuration and rules for all JS files
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
        },
        rules: commonRules,
    },
    // 2. Legacy userscript (script context)
    {
        files: ['FlixMonkey.user.js'],
        languageOptions: {
            sourceType: 'script',
        },
    },
    // 3. Browser & WebExtension globals (src, tests, userscript)
    {
        files: ['src/**/*.js', 'tests/**/*.js', 'FlixMonkey.user.js'],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.webextensions,
                ...userscriptGlobals,
                chrome: 'readonly',
            },
        },
    },
    // 4. Vitest globals (tests)
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.vitest,
            },
        },
    },
    // 5. Node.js globals (scripts, configs, tests)
    {
        files: ['scripts/**/*.js', '*.config.js', 'tests/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
    // 6. License header enforcement - src and tests only (isolated block)
    {
        files: ['{src,tests}/**/*.js'],
        plugins: { headers },
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
        },
    },
];
