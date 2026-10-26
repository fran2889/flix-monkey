import js from '@eslint/js';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import { globalIgnores } from 'eslint/config';
import headers from 'eslint-plugin-headers';
import jsdoc from 'eslint-plugin-jsdoc';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import sonarjs from 'eslint-plugin-sonarjs';
import eslintPluginUnusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';

const commonRules = {
    'prefer-const': 'error',
    'no-var': 'error',
    eqeqeq: 'error',
    'no-console': ['error', { allow: ['debug', 'info', 'warn', 'error', 'log'] }],
    complexity: ['error', 10],
    'sonarjs/cognitive-complexity': ['error', 10],
    'default-param-last': 'error',
    'no-nested-ternary': 'error',
    'no-duplicate-imports': ['error', { allowSeparateTypeImports: true }],
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',
    'unused-imports/no-unused-imports': 'error',
};

const javascriptRules = {
    ...commonRules,
    'max-params': ['error', 4],
};

// The `export` keyword is the module boundary: anything a caller can import is
// part of a contract, regardless of where the file lives. Examined nodes are
// inline export declarations, because local `export { ... }` lists are rejected
// below where the rule cannot see the exported declaration. Concrete accessors
// are excluded because they only restate a field. Abstract members use their own
// TSAbstractMethodDefinition contexts.
const nonPrivateMethod =
    'MethodDefinition:not([kind="get"]):not([kind="set"]):not([key.type="PrivateIdentifier"]):not([accessibility="private"])';

const describedMethod = `${nonPrivateMethod}:not([kind="constructor"])`;

const exportedClassBodies = [
    'ExportNamedDeclaration > ClassDeclaration > ClassBody',
    'ExportDefaultDeclaration > ClassDeclaration > ClassBody',
    'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ClassExpression > ClassBody',
    'ExportDefaultDeclaration > ClassExpression > ClassBody',
];

const exportedClassMembers = method => exportedClassBodies.map(body => `${body} > ${method}`);

// Public function-valued fields are methods to a caller. Their value node
// carries the signature, while the JSDoc block sits above the field.
const exportedFunctionFields = exportedClassBodies.flatMap(body => [
    `${body} > PropertyDefinition:not([key.type="PrivateIdentifier"]):not([accessibility="private"]) > ArrowFunctionExpression`,
    `${body} > PropertyDefinition:not([key.type="PrivateIdentifier"]):not([accessibility="private"]) > FunctionExpression`,
]);

const exportedObjectMembers = [
    'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ObjectExpression > Property:not([kind="get"]):not([kind="set"]) > FunctionExpression',
    'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ObjectExpression > Property:not([kind="get"]):not([kind="set"]) > ArrowFunctionExpression',
    'ExportDefaultDeclaration > ObjectExpression > Property:not([kind="get"]):not([kind="set"]) > FunctionExpression',
    'ExportDefaultDeclaration > ObjectExpression > Property:not([kind="get"]):not([kind="set"]) > ArrowFunctionExpression',
];

const apiContexts = method => [
    'ExportNamedDeclaration > FunctionDeclaration',
    'ExportDefaultDeclaration > FunctionDeclaration',
    'ExportNamedDeclaration > ClassDeclaration',
    'ExportDefaultDeclaration > ClassDeclaration',
    ...exportedClassMembers(method),
    ...exportedFunctionFields,
    ...exportedObjectMembers,
    ...exportedClassBodies.map(body => `${body} > TSAbstractMethodDefinition`),
    'ExportNamedDeclaration > TSInterfaceDeclaration',
    'ExportDefaultDeclaration > TSInterfaceDeclaration',
    'ExportNamedDeclaration > TSInterfaceDeclaration > TSInterfaceBody > TSMethodSignature',
    'ExportDefaultDeclaration > TSInterfaceDeclaration > TSInterfaceBody > TSMethodSignature',
    'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression',
    'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > FunctionExpression',
    'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ClassExpression',
    'ExportDefaultDeclaration > ArrowFunctionExpression',
    'ExportDefaultDeclaration > FunctionExpression',
    'ExportDefaultDeclaration > ClassExpression',
];

const exportedContexts = apiContexts(nonPrivateMethod);

// Constructors carry their contract in @param tags; a separate description would
// only restate the class name.
const describedContexts = apiContexts(describedMethod);

const typescriptRules = {
    ...commonRules,
    // TypeScript-specific strict rules
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/explicit-module-boundary-types': 'off', // Too many false positives for internal modules
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/prefer-readonly': 'error',
    '@typescript-eslint/return-await': 'error',
    '@typescript-eslint/promise-function-async': 'error',
    '@typescript-eslint/prefer-string-starts-ends-with': 'error',
    '@typescript-eslint/no-shadow': 'error',
    '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
    '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'separate-type-imports' }],
    '@typescript-eslint/no-import-type-side-effects': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/ban-ts-comment': 'error',
    '@typescript-eslint/no-unused-vars': 'off',
    'unused-imports/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-unused-vars': 'off',
    '@typescript-eslint/max-params': ['error', { max: 4 }],
    // TypeScript already checks undefined identifiers.
    'no-undef': 'off',
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
    globalIgnores(['dist/**', 'coverage/**']),
    {
        linterOptions: {
            reportUnusedDisableDirectives: 'error',
            reportUnusedInlineConfigs: 'error',
        },
    },
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
            sonarjs,
            'unused-imports': eslintPluginUnusedImports,
        },
        rules: javascriptRules,
    },
    // 2. TypeScript files - strict TypeScript rules
    {
        files: ['**/*.ts'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parser: typescriptParser,
            parserOptions: {
                project: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: {
            '@typescript-eslint': typescriptPlugin,
            'simple-import-sort': simpleImportSort,
            sonarjs,
            'unused-imports': eslintPluginUnusedImports,
        },
        rules: typescriptRules,
    },
    // 2.5. Relax some rules in test files (non-null-assertion for mocks, type assertions, promise-returning)
    {
        files: ['tests/**/*.ts'],
        rules: {
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-unnecessary-type-assertion': 'off',
            '@typescript-eslint/promise-function-async': 'off',
            '@typescript-eslint/prefer-readonly': 'off',
        },
    },
    // 2.6. Cache migrations will be replaced by a cache schema version.
    {
        files: ['src/core/migrations.ts'],
        plugins: { sonarjs },
        rules: { complexity: 'off', 'sonarjs/cognitive-complexity': 'off' },
    },
    // 3. Production code must document intentional no-op functions.
    {
        files: ['src/**/*.ts', 'scripts/**/*.js'],
        rules: {
            'no-empty-function': 'error',
        },
    },
    // 3.5. Application code logs through Logger; raw console is limited to platform bootstrap.
    {
        files: ['src/**/*.ts'],
        ignores: [
            'src/core/logger.ts',
            'src/targets/chrome/service-worker.ts',
            'src/targets/firefox/background.ts',
            'src/targets/extension/content.ts',
        ],
        rules: {
            'no-console': 'error',
        },
    },
    {
        files: ['src/**/*.ts'],
        rules: {
            'no-restricted-syntax': [
                'error',
                {
                    selector: 'TSAsExpression > TSNeverKeyword',
                    message: 'Do not assert to never; fix the underlying type instead.',
                },
                {
                    selector: 'ExportNamedDeclaration[declaration=null][source=null][exportKind="value"]',
                    message:
                        'Export declarations at their declaration site; local value `export { ... }` lists hide the declaration from the JSDoc rule.',
                },
            ],
        },
    },
    // 4. Browser & WebExtension globals (src, tests)
    {
        files: ['src/**/*.ts', 'tests/**/*.ts'],
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
        files: ['tests/**/*.ts'],
        languageOptions: {
            globals: {
                ...globals.vitest,
            },
        },
    },
    // 6. Node.js globals (scripts, configs, tests)
    {
        files: ['scripts/**/*.{js,ts}', '*.config.js', '*.config.cjs', '*.config.ts', 'tests/**/*.ts'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
    // 7. JSDoc validation for the exported API surface
    {
        files: ['src/**/*.ts'],
        plugins: { jsdoc },
        rules: {
            'jsdoc/require-jsdoc': [
                'error',
                {
                    require: {
                        FunctionDeclaration: false,
                        MethodDefinition: false,
                        ClassDeclaration: false,
                    },
                    contexts: exportedContexts,
                },
            ],
            'jsdoc/require-description': ['error', { contexts: describedContexts }],
            'jsdoc/require-param': ['error', { contexts: exportedContexts, checkDestructured: false }],
            'jsdoc/require-param-description': 'error',
            'jsdoc/require-returns': ['error', { contexts: describedContexts }],
            'jsdoc/require-returns-description': 'error',
            'jsdoc/no-types': 'error',
            'jsdoc/check-types': 'error',
            'jsdoc/no-undefined-types': 'error',
        },
    },
    // 8. License header enforcement - src, tests, and scripts (isolated block)
    // metadata.ts is a comment-only template file (no AST tokens). The plugin
    // cannot detect its existing header and would insert duplicates on --fix.
    {
        files: ['{src,tests}/**/*.ts', 'scripts/**/*.{js,ts}'],
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
