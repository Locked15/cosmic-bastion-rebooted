<script setup lang="ts">
    import { ref } from 'vue'

    // The furnace lever: burns every requisition form for a partial refund.
    const {
        refund,
        percent,
        disabled = false,
    } = defineProps<{
        refund: number
        percent: number
        disabled?: boolean
    }>()

    const emit = defineEmits<{ pull: [] }>()
    const pulled = ref(false)

    function pull() {
        if (disabled || pulled.value) return
        pulled.value = true
        // The handle travels down before the request goes out, then springs back.
        setTimeout(() => {
            emit('pull')
            pulled.value = false
        }, 350)
    }
</script>

<template>
    <div class="reset-lever" :class="{ 'reset-lever--disabled': disabled }">
        <div class="reset-lever__plate">
            <span class="reset-lever__rivet" />
            <span class="reset-lever__rivet" />
            <span class="reset-lever__rivet" />
            <span class="reset-lever__rivet" />
            <p class="reset-lever__title">ПЕЧЬ НАРЯДОВ</p>
            <button
                type="button"
                class="reset-lever__slot"
                :disabled="disabled"
                :aria-label="`Сжечь все наряды, вернуть ${refund} реквизиций`"
                @click="pull"
            >
                <span
                    class="reset-lever__handle"
                    :class="{ 'reset-lever__handle--pulled': pulled }"
                />
            </button>
            <p class="reset-lever__note">
                ВОЗВРАТ {{ percent }}% · <strong>{{ refund }}</strong>
                <span class="requisition-icon" aria-hidden="true" />
            </p>
        </div>
    </div>
</template>

<style scoped lang="scss">
    .reset-lever {
        padding: 8px;
        // Hazard stripes around the plate.
        background: repeating-linear-gradient(-45deg, $color-accent 0 10px, $color-bg 10px 20px);

        &--disabled {
            filter: grayscale(1) brightness(0.6);
        }

        &__plate {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: $spacing-sm;
            padding: $spacing-md;
            background: linear-gradient(145deg, $color-metal, $color-metal-dark);
            box-shadow: inset 0 0 0 1px rgba($color-metal-light, 0.4);
        }

        &__rivet {
            position: absolute;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: radial-gradient(circle at 30% 30%, $color-metal-light, $color-metal-dark);

            &:nth-child(1) {
                top: 6px;
                left: 6px;
            }

            &:nth-child(2) {
                top: 6px;
                right: 6px;
            }

            &:nth-child(3) {
                bottom: 6px;
                left: 6px;
            }

            &:nth-child(4) {
                right: 6px;
                bottom: 6px;
            }
        }

        &__title,
        &__note {
            color: $color-bg;
            font-size: 11px;
            font-weight: bold;
            letter-spacing: 2px;
            text-shadow: 0 1px 0 rgba($color-metal-light, 0.6);
        }

        &__slot {
            position: relative;
            width: 28px;
            height: 76px;
            padding: 0;
            border: none;
            border-radius: 14px;
            background: linear-gradient(90deg, #050505, $color-metal-dark, #050505);
            box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.9);
            cursor: pointer;

            &:disabled {
                cursor: not-allowed;
            }

            &:focus-visible {
                outline: 2px solid $color-primary;
            }
        }

        &__handle {
            position: absolute;
            top: 4px;
            left: 50%;
            width: 38px;
            height: 22px;
            border-radius: 6px;
            background: linear-gradient(transparent, rgba(0, 0, 0, 0.5)), $color-danger;
            box-shadow: 0 3px 4px rgba(0, 0, 0, 0.8);
            transform: translateX(-50%);
            transition: top 0.3s cubic-bezier(0.5, 0, 0.7, 1);

            &--pulled {
                top: 50px;
            }
        }
    }
</style>
