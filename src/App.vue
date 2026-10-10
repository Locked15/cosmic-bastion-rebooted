<script setup lang="ts">
    import { storeToRefs } from 'pinia'
    import { watchEffect } from 'vue'
    import { RouterView } from 'vue-router'
    import { useSettingsStore } from '@/stores/settingsStore'
    import AchievementsModal from '@/ui/layouts/AchievementsModal.vue'
    import ConfirmModal from '@/ui/layouts/ConfirmModal.vue'
    import HelpModal from '@/ui/layouts/HelpModal.vue'
    import SettingsModal from '@/ui/layouts/SettingsModal.vue'
    import ToastStack from '@/ui/layouts/ToastStack.vue'

    const { settings } = storeToRefs(useSettingsStore())

    watchEffect(() => {
        document.body.style.setProperty('--brightness', String(settings.value.brightness / 100))
    })
</script>

<template>
    <RouterView />
    <SettingsModal />
    <HelpModal />
    <AchievementsModal />
    <ConfirmModal />
    <ToastStack />
</template>
