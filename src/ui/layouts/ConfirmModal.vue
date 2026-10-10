<script setup lang="ts">
    import { storeToRefs } from 'pinia'
    import { useUiStore } from '@/stores/uiStore'
    import AppButton from '@/ui/components/AppButton.vue'

    const ui = useUiStore()
    const { confirmRequest } = storeToRefs(ui)
</script>

<template>
    <div v-if="confirmRequest" class="modal" @click.self="ui.resolveConfirm(false)">
        <div class="modal__box">
            <h3 class="modal__title">ПОДТВЕРЖДЕНИЕ</h3>
            <p class="modal__text">{{ confirmRequest.message }}</p>
            <div class="confirm-modal__actions">
                <AppButton @click="ui.resolveConfirm(true)">ДА</AppButton>
                <AppButton variant="secondary" @click="ui.resolveConfirm(false)">ОТМЕНА</AppButton>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
    .confirm-modal__actions {
        display: flex;
        gap: 10px;
    }
</style>
