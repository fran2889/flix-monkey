import js from '@eslint/js';
import headers from 'eslint-plugin-headers';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import eslintPluginUnusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';

const commonRules = {
    'prefer-const': 'error',
    'no-var': 'error',
    eqeqeq: 'error',
    'no-console': ['error', { allow: ['debug', 'info', 'warn', 'error', 'log'] }],
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-duplicate-imports': 'error',
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',
    'unused-imports/no-unused-imports': 'error',
};

const userscriptGlobals = {
    GM_xmlhttpRequest: 'readonly',
    GM_getValue: 'readonly',
    GM_setValue: 'readonly',
    GM_deleteValue: 'readonly',
    GM_listValues: 'readonly',
    GM_registerMenuCommand: 'readonly',
    GM_config: 'readonly',
};

export default [
    js.configs.recommended,
    // 1. Base configuration and rules for all JS files
    {
        files: ['**/*.{js,cjs}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
        },
        plugins: {
            'simple-import-sort': simpleImportSort,
            'unused-imports': eslintPluginUnusedImports,
        },
        rules: commonRules,
    },
    // 2. Browser & WebExtension globals (src, tests)
    {
        files: ['src/**/*.js', 'tests/**/*.{js,cjs}'],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.webextensions,
                ...userscriptGlobals,
                chrome: 'readonly',
            },
        },
    },
    // 3. Vitest globals (tests)
    {
        files: ['tests/**/*.{js,cjs}'],
        languageOptions: {
            globals: {
                ...globals.vitest,
            },
        },
    },
    // 4. Node.js globals (scripts, configs, tests)
    {
        files: ['scripts/**/*.js', '*.config.js', '*.config.cjs', 'tests/**/*.{js,cjs}'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
    // 5. License header enforcement - src and tests only (isolated block)
    // metadata.js is a comment-only template file (no AST tokens). The plugin
    // cannot detect its existing header and would insert duplicates on --fix.
    {
        files: ['{src,tests}/**/*.{js,cjs}'],
        ignores: ['src/targets/userscript/metadata.js'],
        plugins: { headers },
        rules: {
            'headers/header-format': [
                'error',
                {
                    source: 'file',
                    path: 'LICENSE_HEADER.template',
                    patterns: {
                        year: {
                            pattern: '20\\d{2}(?:-\\d{4})?',
                            defaultValue: new Date().getFullYear().toString(),
                        },
                    },
                },
            ],
        },
    },
];
