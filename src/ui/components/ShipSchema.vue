<template>
    <div class="ship-schema">
        <div class="ship-schema__outline">
            <div class="ship-schema__layer ship-schema__layer--outer">ВНЕШНИЙ СЛОЙ [ПОВРЕЖДЁН]</div>
            <div class="ship-schema__layer ship-schema__layer--living">ЖИЛОЙ СЛОЙ</div>
            <div class="ship-schema__layer ship-schema__layer--technical">ТЕХНИЧЕСКИЙ СЛОЙ</div>
        </div>
    </div>
</template>

<style scoped lang="scss">
    .ship-schema {
        margin-bottom: $spacing-lg;
        padding: $spacing-md;
        border: 1px solid $color-border;

        &__outline {
            position: relative;
            width: 300px;
            height: 400px;
            margin: 0 auto;
            border: 2px solid $color-secondary;
            clip-path: polygon(
                30% 0%,
                70% 0%,
                85% 10%,
                90% 25%,
                95% 50%,
                90% 75%,
                85% 90%,
                70% 100%,
                30% 100%,
                15% 90%,
                10% 75%,
                5% 50%,
                10% 25%,
                15% 10%
            );
            animation: ship-pulse 3s ease-in-out infinite;
        }

        &__layer {
            position: absolute;
            width: 100%;
            padding: $spacing-sm;
            border-top: 1px dashed $color-secondary;
            background-color: rgba(255, 255, 255, 0.05);
            font-size: 10px;
            text-align: center;

            &--outer {
                top: 0;
                border: 1px solid $color-danger;
                color: $color-danger;
            }

            &--living {
                top: 33.3%;
                color: $color-accent;
            }

            &--technical {
                top: 66.6%;
                color: $color-primary;
            }
        }
    }

    @keyframes ship-pulse {
        0%,
        100% {
            opacity: 0.7;
        }

        50% {
            opacity: 1;
        }
    }
</style>
