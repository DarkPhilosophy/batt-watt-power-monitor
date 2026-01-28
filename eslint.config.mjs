import globals from 'globals';
import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import prettier from 'eslint-config-prettier';
import pluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import noDecorativeComments from './.scripts/eslint-rules/no-decorative-comments.js';

export default [
    js.configs.recommended,
    jsdoc.configs['flat/recommended'],
    pluginPrettierRecommended,
    prettier,
    {
        ignores: ['node_modules/**', 'dist/**', '.lint-output.txt', '.lint-passed', 'schemas/**'],
    },
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.builtin,
                ...globals.es2021,
                // GJS / GNOME Globals
                ARGV: 'readonly',
                Debugger: 'readonly',
                GIRepositoryGType: 'readonly',
                globalThis: 'readonly',
                global: 'readonly',
                imports: 'readonly',
                Intl: 'readonly',
                log: 'readonly',
                logError: 'readonly',
                print: 'readonly',
                printerr: 'readonly',
                window: 'readonly',
                TextEncoder: 'readonly',
                TextDecoder: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearTimeout: 'readonly',
                clearInterval: 'readonly',
                pkg: 'readonly',
                // Extension specific
                GLib: 'readonly',
                Gio: 'readonly',
                GObject: 'readonly',
                St: 'readonly',
                Rsvg: 'readonly',
                Cairo: 'readonly',
                UPower: 'readonly',
                Clutter: 'readonly',
                Cogl: 'readonly',
                Graphene: 'readonly',
                Meta: 'readonly',
                Shell: 'readonly',
                Main: 'readonly',
            },
        },
        plugins: {
            jsdoc,
            local_rules: {
                rules: {
                    'no-decorative-comments': noDecorativeComments,
                },
            },
        },
        rules: {
            // === FORMATTING & STYLE ===
            // Custom local rule for comment formatting
            'local_rules/no-decorative-comments': 'warn',

            // Delegated to Prettier (via eslint-plugin-prettier)

            // === CODE QUALITY ===
            'no-unused-vars': ['error', {
                'vars': 'all',
                'varsIgnorePattern': '^_',
                'argsIgnorePattern': '^_',
                'caughtErrors': 'all',
                'caughtErrorsIgnorePattern': '^_',
            }],
            'no-implicit-coercion': ['error', { 'allow': ['!!'] }],
            'no-var': 'error',
            'prefer-const': 'error',

            
            // Re-enabling console warn as per previous config, effectively
            'no-console': 'warn',

            // === JSDOC (Relaxed for extensions) ===
            'jsdoc/require-jsdoc': 'warn',
            'jsdoc/require-param': 'warn',
            'jsdoc/require-param-description': 'warn',
            'jsdoc/require-param-name': 'warn',
            'jsdoc/require-param-type': 'warn',
            'jsdoc/check-param-names': 'warn',
            'jsdoc/check-tag-names': 'warn',
            'jsdoc/no-undefined-types': 'off',
            'jsdoc/tag-lines': ['error', 'any', { 'startLines': 1 }],
        },
    },
    // Configuration for Scripts (Node.js)
    {
        files: ['.scripts/**/*.js', '*.js'],
        languageOptions: {
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
            },
        },
        rules: {
            'no-console': 'off',
            'jsdoc/require-jsdoc': 'off',
        },
    },
];
