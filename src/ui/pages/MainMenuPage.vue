<script setup lang="ts">
    import { useRouter } from 'vue-router'
    import { useCampaignStore } from '@/stores/campaignStore'
    import { useUiStore } from '@/stores/uiStore'
    import AppButton from '@/ui/components/AppButton.vue'
    import ShipSchema from '@/ui/components/ShipSchema.vue'

    const router = useRouter()
    const campaign = useCampaignStore()
    const ui = useUiStore()

    async function resetProgress() {
        if (await ui.confirm('Вы уверены? Это удалит весь ваш прогресс навсегда.')) {
            campaign.reset()
            ui.notify('Прогресс сброшен. Начинаем игру заново!')
        }
    }
</script>

<template>
    <main class="main-menu">
        <div class="main-menu__container">
            <ShipSchema />
            <h1 class="main-menu__title">COSMIC BASTION</h1>
            <p class="main-menu__subtitle">// ПРОТОКОЛ АВАРИЙНОЙ ЗАЩИТЫ //</p>
            <nav class="main-menu__buttons">
                <AppButton @click="router.push({ name: 'levels' })">
                    {{ campaign.hasProgress ? 'ПРОДОЛЖИТЬ' : 'НАЧАТЬ МИССИЮ' }}
                </AppButton>
                <AppButton @click="ui.helpOpen = true">ИНСТРУКЦИИ</AppButton>
                <AppButton @click="ui.openSettings()">НАСТРОЙКИ</AppButton>
                <AppButton variant="secondary" @click="resetProgress">НАЧАТЬ ЗАНОВО</AppButton>
            </nav>
            <div class="main-menu__status">
                <p>СТАТУС: КРИТИЧЕСКИЙ</p>
                <p>УГРОЗА: ВРАЖДЕБНАЯ БИОМАССА</p>
                <p>ЭКИПАЖ: В ОЖИДАНИИ ПРИКАЗОВ</p>
            </div>
        </div>
    </main>
</template>

<style scoped lang="scss">
    .main-menu {
        @include blueprint-grid;

        display: flex;
        align-items: safe center;
        justify-content: center;
        height: 100vh;
        padding: $spacing-lg;
        overflow-y: auto;

        &__container {
            @include corner-frame;

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
