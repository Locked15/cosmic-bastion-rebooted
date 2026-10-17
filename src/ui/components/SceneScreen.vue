<script setup lang="ts">
    // A visual-novel scene: who speaks and where, their lines, then the player's answers.
    // After a choice only the reply is shown. Every scene can be skipped.
    const {
        speaker,
        place,
        lines,
        choices,
        reply = null,
    } = defineProps<{
        speaker: string
        place: string
        lines: string[]
        choices: string[]
        reply?: string | null
    }>()

    defineEmits<{ choose: [index: number]; skip: []; continue: []; later: [] }>()
</script>

<template>
    <article class="scene-screen">
        <header class="scene-screen__header">
            <p class="scene-screen__place">{{ place }}</p>
            <h3 class="scene-screen__speaker">{{ speaker }}</h3>
        </header>
        <div class="scene-screen__lines">
            <p v-for="(line, index) in lines" :key="index" class="scene-screen__line">
                {{ line }}
            </p>
        </div>
        <template v-if="reply === null">
            <ol class="scene-screen__choices">
                <li v-for="(choice, index) in choices" :key="index">
                    <button
                        type="button"
                        class="scene-screen__choice"
                        @click="$emit('choose', index)"
                    >
                        {{ choice }}
                    </button>
                </li>
            </ol>
            <footer class="scene-screen__footer">
                <button type="button" class="scene-screen__link" @click="$emit('later')">
                    ПОЗЖЕ
                </button>
                <button type="button" class="scene-screen__link" @click="$emit('skip')">
                    ПРОПУСТИТЬ СЦЕНУ
                </button>
            </footer>
        </template>
        <template v-else>
            <p class="scene-screen__reply">{{ reply }}</p>
            <footer class="scene-screen__footer">
                <button type="button" class="scene-screen__choice" @click="$emit('continue')">
                    ДАЛЕЕ
                </button>
            </footer>
        </template>
    </article>
</template>

<style scoped lang="scss">
    .scene-screen {
        display: flex;
        flex-direction: column;
        gap: $spacing-md;

        &__header {
            padding-bottom: $spacing-sm;
            border-bottom: 2px solid $color-primary;
        }

        &__place {
            color: $color-secondary;
            font-size: 11px;
            letter-spacing: 2px;
            text-transform: uppercase;
        }

        &__speaker {
            margin-top: $spacing-xs;
            font-size: 18px;
            letter-spacing: 2px;
        }

        &__lines {
            display: flex;
            flex-direction: column;
            gap: $spacing-sm;
            color: $color-accent;
            line-height: 1.7;
        }

        &__reply {
            padding: $spacing-sm $spacing-md;
            border-left: 2px solid $color-accent;
            line-height: 1.7;
        }

        &__choices {
            display: flex;
            flex-direction: column;
            gap: $spacing-sm;
            list-style: none;
        }

        &__choice {
            width: 100%;
            padding: $spacing-sm $spacing-md;
            border: 2px solid $color-primary;
            background-color: transparent;
            color: $color-primary;
            font-family: inherit;
            font-size: 14px;
            text-align: left;
            cursor: pointer;
            transition: all 0.2s;

            &:hover {
                background-color: $color-primary;
                color: $color-bg;
            }
        }

        &__footer {
            display: flex;
            justify-content: space-between;
            gap: $spacing-md;
            padding-top: $spacing-sm;
            border-top: 1px solid $color-border;
        }

        &__link {
            padding: $spacing-xs 0;
            border: none;
            background: none;
            color: $color-secondary;
            font-family: inherit;
            font-size: 12px;
            letter-spacing: 1px;
            cursor: pointer;

            &:hover {
                color: $color-primary;
            }
        }
    }
</style>
