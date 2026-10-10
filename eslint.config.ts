import type { Linter } from 'eslint'
import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginPlaywright from 'eslint-plugin-playwright'
import pluginVitest from '@vitest/eslint-plugin'
import skipFormatting from 'eslint-config-prettier/flat'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

type RestrictedPattern = { group: string[]; message: string }

function restrictImports(
    name: string,
    files: string[],
    patterns: RestrictedPattern[],
): Linter.Config {
    return {
        name,
        files,
        ignores: ['**/__tests__/**'],
        rules: { 'no-restricted-imports': ['error', { patterns }] },
    }
}

export default defineConfigWithVueTs(
    {
        name: 'app/files-to-lint',
        files: ['**/*.{vue,ts,mts,tsx}'],
    },

    globalIgnores([
        '**/dist/**',
        '**/dist-ssr/**',
        '**/coverage/**',
        'playwright-report/**',
        'test-results/**',
    ]),

    ...pluginVue.configs['flat/essential'],
    vueTsConfigs.recommended,

    {
        ...pluginPlaywright.configs['flat/recommended'],
        files: ['e2e/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    },

    {
        ...pluginVitest.configs.recommended,
        files: ['src/**/__tests__/*', 'src/**/*.spec.ts'],
    },

    // Clean Architecture: dependencies point inward only.
    restrictImports(
        'app/layer-domain',
        ['src/domain/**/*.ts'],
        [
            {
                group: ['@/application*', '@/infrastructure*', '@/stores*', '@/ui*'],
                message: 'Domain is the innermost layer.',
            },
            { group: ['vue', 'pinia', 'vue-router'], message: 'Domain must stay framework-free.' },
        ],
    ),
    restrictImports(
        'app/layer-application',
        ['src/application/**/*.ts'],
        [
            {
                group: ['@/infrastructure*', '@/stores*', '@/ui*'],
                message: 'Application depends on domain only; use ports.',
            },
            {
                group: ['vue', 'pinia', 'vue-router'],
                message: 'Application must stay framework-free.',
            },
        ],
    ),
    restrictImports(
        'app/layer-infrastructure',
        ['src/infrastructure/**/*.ts'],
        [
            {
                group: ['@/stores*', '@/ui*', 'vue', 'pinia', 'vue-router'],
                message: 'Adapters must not know the UI.',
            },
        ],
    ),
    // Components are atomic: no custom child components and no store access.
    restrictImports(
        'app/ui-components',
        ['src/ui/components/**/*.vue'],
        [
            {
                group: ['**/*.vue'],
                message: 'A component cannot contain other components; build a layout instead.',
            },
            {
                group: ['@/stores*'],
                message: 'Components get data via props; layouts and pages talk to stores.',
            },
        ],
    ),
    restrictImports(
        'app/ui-layouts',
        ['src/ui/layouts/**/*.vue'],
        [{ group: ['@/ui/pages*'], message: 'Layouts cannot contain pages.' }],
    ),

    skipFormatting,
)
