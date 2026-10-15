<script setup lang="ts">
    import { onMounted } from 'vue'
    import { useRouter } from 'vue-router'
    import { useCampaignStore } from '@/stores/campaignStore'
    import { useProfileStore } from '@/stores/profileStore'
    import { useUiStore } from '@/stores/uiStore'
    import AppButton from '@/ui/components/AppButton.vue'
    import ShipSchema from '@/ui/components/ShipSchema.vue'

    const router = useRouter()
    const campaign = useCampaignStore()
    const profiles = useProfileStore()
    const ui = useUiStore()

    // The report line follows story progress made since the menu was last shown.
    onMounted(() => profiles.refresh())
</script>

<template>
    <main class="main-menu">
        <header v-if="profiles.activeName" class="main-menu__report" aria-live="polite">
            <p class="main-menu__briefing">{{ profiles.briefing }}</p>
            <p class="main-menu__identity">
                Если это не Вы,
                <button type="button" class="main-menu__security" @click="profiles.open()">
                    вызовите службу безопасности</button
                >.
            </p>
        </header>
        <div class="main-menu__container">
            <ShipSchema />
            <h1 class="main-menu__title">COSMIC BASTION</h1>
            <p class="main-menu__subtitle">// ПРОТОКОЛ АВАРИЙНОЙ ЗАЩИТЫ //</p>
            <nav class="main-menu__buttons">
                <AppButton :disabled="profiles.required" @click="router.push({ name: 'levels' })">
                    {{ campaign.hasProgress ? 'ПРОДОЛЖИТЬ' : 'НАЧАТЬ МИССИЮ' }}
                </AppButton>
                <AppButton @click="ui.helpOpen = true">ИНСТРУКЦИИ</AppButton>
                <AppButton @click="ui.achievementsOpen = true">ДОСТИЖЕНИЯ</AppButton>
                <AppButton @click="ui.openSettings()">НАСТРОЙКИ</AppButton>
            </nav>
            <div class="main-menu__status">
                <p>СТАТУС: КРИТИЧЕСКИЙ</p>
                <p>УГРОЗА: СОНМ</p>
                <p>ЭКИПАЖ: В ОЖИДАНИИ ПРИКАЗОВ</p>
            </div>
        </div>
    </main>
</template>

<style scoped lang="scss">
    .main-menu {
        @include blueprint-grid;

        display: flex;
        flex-direction: column;
        align-items: center;
        gap: $spacing-lg;
        height: 100vh;
        padding: $spacing-lg;
        overflow-y: auto;

        &__report {
            @include pop-in(report-pop, 0.96);

            align-self: stretch;
            padding: $spacing-sm $spacing-md;
            border: 1px solid $color-border;
            border-left: 4px solid $color-danger;
            background-color: rgba($color-bg, 0.95);
        }

        &__briefing {
            font-size: 18px;
            font-weight: bold;
            letter-spacing: 2px;
            text-transform: uppercase;
        }

        &__identity {
            margin-top: $spacing-xs;
            color: $color-secondary;
            font-size: 13px;
        }

        &__security {
            padding: 0;
            border: none;
            background: none;
            color: $color-primary;
            font: inherit;
            text-decoration: underline dashed;
            text-underline-offset: 3px;
            cursor: pointer;

            &:hover,
            &:focus-visible {
                color: $color-danger;
                outline: none;
            }
        }

        &__container {
            @include corner-frame;

            margin: auto 0;
            max-width: 800px;
            padding: $spacing-lg;
            border: 2px solid $color-primary;
            background-color: rgba(10, 10, 10, 0.95);
            text-align: center;
        }

        &__title {
            margin-bottom: $spacing-sm;
            font-size: 48px;
            letter-spacing: 8px;
            text-shadow: 0 0 10px $color-primary;
            animation: title-flicker 2s infinite;
        }

        &__subtitle {
            margin-bottom: $spacing-lg;
            color: $color-secondary;
            font-size: 14px;
            letter-spacing: 2px;
        }

        &__buttons {
            margin: $spacing-lg 0;
        }

        &__status {
            margin-top: $spacing-lg;
            padding-top: $spacing-md;
            border-top: 1px solid $color-border;
            color: $color-secondary;
            font-size: 12px;
        }
    }

    @keyframes title-flicker {
        0%,
        98%,
        100% {
            opacity: 1;
        }

        99% {
            opacity: 0.8;
        }
    }
</style>
