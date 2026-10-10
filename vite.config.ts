import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
    plugins: [vue()],
    css: {
        preprocessorOptions: {
            scss: {
                // Tokens and mixins are available in every <style lang="scss"> block.
                additionalData: `@use "@/styles/tokens" as *;\n@use "@/styles/mixins" as *;\n`,
            },
        },
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
})
