<script setup lang="ts">
    import { storeToRefs } from 'pinia'
    import { watch, watchEffect } from 'vue'
    import { RouterView, useRoute } from 'vue-router'
    import { useMusicStore } from '@/stores/musicStore'
    import { useSettingsStore } from '@/stores/settingsStore'
    import AchievementsModal from '@/ui/layouts/AchievementsModal.vue'
    import ConfirmModal from '@/ui/layouts/ConfirmModal.vue'
    import HelpModal from '@/ui/layouts/HelpModal.vue'
    import ProfilesModal from '@/ui/layouts/ProfilesModal.vue'
    import SettingsModal from '@/ui/layouts/SettingsModal.vue'
    import ToastStack from '@/ui/layouts/ToastStack.vue'

    const { settings } = storeToRefs(useSettingsStore())

    watchEffect(() => {
        document.body.style.setProperty('--brightness', String(settings.value.brightness / 100))
    })

    // Each level has its own track; the menu and the ship map share the main theme.
    const route = useRoute()
    const music = useMusicStore()
    watch(
        () => (route.name === 'game' ? String(route.params.levelId) : null),
        (levelId) => music.playFor(levelId),
        { immediate: true },
    )
</script>

<template>
    <RouterView />
    <SettingsModal />
    <HelpModal />
    <AchievementsModal />
    <ProfilesModal />
    <ConfirmModal />
    <ToastStack />
</template>
