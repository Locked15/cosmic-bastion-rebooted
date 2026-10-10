<script setup lang="ts">
    import { storeToRefs } from 'pinia'
    import { computed } from 'vue'
    import { useAchievementsStore } from '@/stores/achievementsStore'
    import { useUiStore } from '@/stores/uiStore'
    import AchievementItem from '@/ui/components/AchievementItem.vue'
    import AppButton from '@/ui/components/AppButton.vue'

    const ui = useUiStore()
    const { achievements } = storeToRefs(useAchievementsStore())
    const unlocked = computed(() => achievements.value.filter((item) => item.unlocked).length)
</script>

<template>
    <div v-if="ui.achievementsOpen" class="modal" @click.self="ui.achievementsOpen = false">
        <div class="modal__box">
            <h3 class="modal__title">// ДОСТИЖЕНИЯ {{ unlocked }}/{{ achievements.length }} //</h3>
            <AchievementItem
                v-for="item in achievements"
                :key="item.id"
                :title="item.title"
                :description="item.description"
                :unlocked="item.unlocked"
            />
            <div class="modal__footer">
                <AppButton @click="ui.achievementsOpen = false">ЗАКРЫТЬ</AppButton>
            </div>
        </div>
    </div>
</template>
