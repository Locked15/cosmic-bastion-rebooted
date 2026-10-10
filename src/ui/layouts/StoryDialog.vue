<script setup lang="ts">
    import { storeToRefs } from 'pinia'
    import { useGameStore } from '@/stores/gameStore'
    import ChoiceButton from '@/ui/components/ChoiceButton.vue'

    const game = useGameStore()
    const { snapshot } = storeToRefs(game)
</script>

<template>
    <div v-if="snapshot?.dialog" class="modal story-dialog">
        <div class="modal__box">
            <h3 class="modal__title">{{ snapshot.dialog.title }}</h3>
            <p class="modal__text">{{ snapshot.dialog.text }}</p>
            <div class="story-dialog__choices">
                <ChoiceButton
                    v-for="(choice, index) in snapshot.dialog.choices"
                    :key="index"
                    :text="choice.text"
                    :hint="choice.hint"
                    :disabled="choice.disabled"
                    @choose="game.chooseDialog(index)"
                />
            </div>
            <div
                v-if="snapshot.dialog.secondsLeft !== null"
                class="modal__footer story-dialog__timer"
            >
                Время на решение: {{ snapshot.dialog.secondsLeft }}с
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
    .story-dialog {
        // The game keeps running slowed down behind the dialog, so dim lighter.
        background-color: rgba(0, 0, 0, 0.55);

        &__choices {
            display: flex;
            flex-direction: column;
            gap: $spacing-sm;
        }

        &__timer {
            color: $color-danger;
            font-weight: bold;
            text-align: center;
        }
    }
</style>
