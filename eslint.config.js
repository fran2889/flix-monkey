import js from '@eslint/js';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import headers from 'eslint-plugin-headers';
import jsdoc from 'eslint-plugin-jsdoc';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import eslintPluginUnusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';

const commonRules = {
    'prefer-const': 'error',
    'no-var': 'error',
    eqeqeq: 'error',
    'no-console': ['error', { allow: ['debug', 'info', 'warn', 'error', 'log'] }],
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    complexity: ['error', 16],
    'default-param-last': 'error',
    'no-nested-ternary': 'error',
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
    // 1. Base configuration for JS files
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
    // 2. TypeScript files - same base rules plus TypeScript parser
    {
        files: ['**/*.ts'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parser: typescriptParser,
        },
        plugins: {
            '@typescript-eslint': typescriptPlugin,
            'simple-import-sort': simpleImportSort,
            'unused-imports': eslintPluginUnusedImports,
        },
        rules: {
            ...commonRules,
            // TypeScript specific rules
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-non-null-assertion': 'warn',
        },
    },
    // 2.5. Disable non-null-assertion warnings in test files
    {
        files: ['tests/**/*.ts'],
        rules: {
            '@typescript-eslint/no-non-null-assertion': 'off',
        },
    },
    // 3. Production code must document intentional no-op functions.
    {
        files: ['src/**/*.js', 'src/**/*.ts', 'scripts/**/*.js'],
        rules: {
            'no-empty-function': 'error',
        },
    },
    // 4. Browser & WebExtension globals (src, tests)
    {
        files: ['src/**/*.js', 'src/**/*.ts', 'tests/**/*.{js,cjs,ts}'],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.webextensions,
                ...userscriptGlobals,
                chrome: 'readonly',
            },
        },
    },
    // 5. Vitest globals (tests)
    {
        files: ['tests/**/*.{js,cjs,ts}'],
        languageOptions: {
            globals: {
                ...globals.vitest,
            },
        },
    },
    // 6. Node.js globals (scripts, configs, tests)
    {
        files: ['scripts/**/*.js', '*.config.js', '*.config.cjs', 'tests/**/*.{js,cjs,ts}'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
    // 7. JSDoc validation for exported functions
    {
        files: ['src/**/*.js', 'src/**/*.ts'],
        plugins: { jsdoc },
        rules: {
            'jsdoc/require-jsdoc': [
                'error',
                {
                    require: {
                        MethodDefinition: true,
                        ClassDeclaration: true,
                    },
                    contexts: ['export'],
                    publicOnly: true,
                },
            ],
            'jsdoc/require-description': ['error', { contexts: ['export'] }],
            'jsdoc/require-param': ['error', { contexts: ['export'] }],
            'jsdoc/require-returns': ['error', { contexts: ['export'] }],
            'jsdoc/check-types': 'error',
            'jsdoc/no-undefined-types': 'error',
        },
    },
    // 8. License header enforcement - src and tests only (isolated block)
    // metadata.js is a comment-only template file (no AST tokens). The plugin
    // cannot detect its existing header and would insert duplicates on --fix.
    {
        files: ['{src,tests}/**/*.{js,cjs,ts}'],
        ignores: ['src/targets/userscript/metadata.ts'],
        plugins: { headers },
        rules: {
            'headers/header-format': [
                'error',
                {
                    source: 'file',
                    path: 'LICENSE_HEADER.template',
                    patterns: {
                        year: {
                            pattern: String.raw`20\d{2}(?:-\d{4})?`,
                            defaultValue: new Date().getFullYear().toString(),
                        },
                    },
                },
            ],
        },
    },
];
