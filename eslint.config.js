import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
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
];

