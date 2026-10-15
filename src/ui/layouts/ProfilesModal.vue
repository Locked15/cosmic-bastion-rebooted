<script setup lang="ts">
    import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
    import { useProfileStore } from '@/stores/profileStore'
    import AppButton from '@/ui/components/AppButton.vue'
    import ProfileSlot from '@/ui/components/ProfileSlot.vue'

    const profiles = useProfileStore()
    const name = ref('')
    const creating = ref(false)
    const input = useTemplateRef<HTMLInputElement>('name-input')

    // With no profiles at all the dialog opens straight on registration.
    const showForm = computed(() => creating.value || profiles.profiles.length === 0)
    const slots = computed(() =>
        Array.from(
            { length: profiles.maxProfiles },
            (_, index) => profiles.profiles[index] ?? null,
        ),
    )

    watch(
        () => [profiles.dialogOpen, showForm.value] as const,
        async ([open, form]) => {
            if (!open) creating.value = false
            if (open && form) {
                await nextTick()
                input.value?.focus()
            }
        },
        { immediate: true },
    )

    function startCreating() {
        name.value = ''
        creating.value = true
    }

    async function submit() {
        if (await profiles.create(name.value)) {
            name.value = ''
            creating.value = false
        }
    }
</script>

<template>
    <div
        v-if="profiles.dialogOpen"
        class="modal profiles-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profiles-modal-title"
        @click.self="profiles.close()"
        @keydown.esc="profiles.close()"
    >
        <div class="modal__box profiles-modal__box">
            <h3 id="profiles-modal-title" class="modal__title">
                {{
                    profiles.profiles.length === 0
                        ? '// РЕГИСТРАЦИЯ ОФИЦЕРА //'
                        : '// СЛУЖБА БЕЗОПАСНОСТИ //'
                }}
            </h3>
            <p class="profiles-modal__intro">
                {{
                    profiles.profiles.length === 0
                        ? 'Личных дел на борту не найдено. Назовите себя, офицер.'
                        : profiles.required
                          ? 'Личность не подтверждена. Выберите личное дело или заведите новое.'
                          : `Идентификация офицера. На борту хранится не более ${profiles.maxProfiles} личных дел.`
                }}
            </p>

            <div v-if="profiles.profiles.length" class="profiles-modal__slots">
                <ProfileSlot
                    v-for="(profile, index) in slots"
                    :key="profile?.id ?? `empty-${index}`"
                    :index="index + 1"
                    :name="profile?.name ?? null"
                    :progress="profile?.progress"
                    :last-played="profile?.lastPlayed"
                    :active="profile?.active"
                    :disabled="profiles.busy"
                    @select="profile && profiles.select(profile.id)"
                    @remove="profile && profiles.remove(profile.id)"
                    @create="startCreating"
                />
            </div>

            <form v-if="showForm" class="profiles-modal__form" @submit.prevent="submit">
                <label class="profiles-modal__label" for="profile-name">ИМЯ ОФИЦЕРА:</label>
                <input
                    id="profile-name"
                    ref="name-input"
                    v-model="name"
                    class="profiles-modal__input"
                    type="text"
                    autocomplete="off"
                    :maxlength="profiles.nameMaxLength"
                    placeholder="Позывной или фамилия"
                />
                <p v-if="profiles.hasLegacySaves" class="profiles-modal__note">
                    Найден прежний прогресс. Он будет перенесён в это личное дело.
                </p>
                <div class="profiles-modal__form-actions">
                    <AppButton
                        v-if="profiles.profiles.length"
                        variant="secondary"
                        @click="creating = false"
                    >
                        ОТМЕНА
                    </AppButton>
                    <button type="submit" class="button" :disabled="profiles.busy || !name.trim()">
                        ЗАРЕГИСТРИРОВАТЬ
                    </button>
                </div>
            </form>

            <div v-if="!profiles.required" class="modal__footer">
                <AppButton variant="secondary" @click="profiles.close()">ЗАКРЫТЬ</AppButton>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
    .profiles-modal {
        &__box {
            width: 600px;
        }

        &__intro {
            margin-bottom: $spacing-md;
            color: $color-accent;
            font-size: 13px;
            line-height: 1.6;
            text-align: center;
        }

        &__slots {
            display: grid;
            gap: $spacing-sm;
        }

        &__form {
            margin-top: $spacing-md;
            padding: $spacing-md;
            border: 1px solid $color-primary;
        }

        &__label {
            display: block;
            margin-bottom: $spacing-sm;
            color: $color-secondary;
            font-size: 12px;
            letter-spacing: 2px;
        }

        &__input {
            width: 100%;
            padding: $spacing-sm $spacing-md;
            border: 2px solid $color-border;
            background-color: $color-bg;
            color: $color-primary;
            font-family: $font-main;
            font-size: 16px;
            letter-spacing: 1px;

            &:focus {
                border-color: $color-primary;
                outline: none;
            }
        }

        &__note {
            margin-top: $spacing-sm;
            color: $color-success;
            font-size: 12px;
        }

        &__form-actions {
            display: flex;
            gap: $spacing-sm;
            margin-top: $spacing-md;

            .button {
                flex: 1;
                margin: 0;
            }
        }
    }
</style>
