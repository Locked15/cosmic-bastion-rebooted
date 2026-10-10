<template>
    <svg class="ship-map-frame" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path class="ship-map-frame__hull" d="M50 2 L92 24 L96 72 L76 98 H24 L4 72 L8 24 Z" />
        <path class="ship-map-frame__route" d="M50 14 L26 38 L50 64 L74 38 L50 14 M50 64 V88" />
        <path class="ship-map-frame__bulkhead" d="M8 25 H92 M4 52 H96 M8 77 H92" />
    </svg>
</template>

<style scoped lang="scss">
    .ship-map-frame {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        fill: none;

        &__hull {
            stroke: $color-secondary;
            stroke-width: 0.3;
        }

        &__route {
            stroke: $color-primary;
            stroke-width: 0.2;
            stroke-dasharray: 1 1;
        }

        &__bulkhead {
            stroke: $color-border;
            stroke-width: 0.15;
        }
    }
</style>
