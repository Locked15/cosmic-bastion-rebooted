<script setup lang="ts">
    import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
    import { useProfileStore } from '@/stores/profileStore'
    import type { DifficultyId } from '@/application'
    import AppButton from '@/ui/components/AppButton.vue'
    import ProfileSlot from '@/ui/components/ProfileSlot.vue'
    import RankCard from '@/ui/components/RankCard.vue'

    const profiles = useProfileStore()
    const name = ref('')
    // The terminal suggests the standard rank.
    const rank = ref<DifficultyId>(profiles.defaultRank)
    // Personal relationships on duty: romance is off unless the officer accepts them.
    const romance = ref<'no' | 'yes'>('no')
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
        rank.value = profiles.defaultRank
        romance.value = 'no'
        creating.value = true
    }

    async function submit() {
        if (await profiles.create(name.value, rank.value, romance.value === 'yes')) {
            name.value = ''
            romance.value = 'no'
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
                    :rank="profile?.rank"
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
                <div class="profiles-modal__terminal" aria-hidden="true">
                    <span>ТЕРМИНАЛ КАДРОВОЙ СЛУЖБЫ · «ТЯЖЕСТЬ ОБЕТА» · КП-41</span>
                    <span class="profiles-modal__led">● СВЯЗЬ</span>
                </div>
                <p class="profiles-modal__prompt">&gt; Добро пожаловать, офицер.</p>
                <p class="profiles-modal__prompt">
                    &gt; Назовите звание и представьтесь.<span class="profiles-modal__cursor"
                        >_</span
                    >
                </p>

                <p id="profile-rank" class="profiles-modal__label">ЗВАНИЕ:</p>
                <div class="profiles-modal__ranks" role="radiogroup" aria-labelledby="profile-rank">
                    <RankCard
                        v-for="option in profiles.ranks"
                        :key="option.id"
                        :label="option.label"
                        :description="option.description"
                        :effects="option.effects"
                        :stripes="option.insignia.stripes"
                        :stars="option.insignia.stars"
                        :general="option.insignia.general"
                        :selected="rank === option.id"
                        @select="rank = option.id"
                    />
                </div>
                <p class="profiles-modal__warning">
                    Звание вносится в личное дело навсегда. Сменить его можно только новым личным
                    делом.
                </p>

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
                <label class="profiles-modal__label" for="profile-romance">
                    ВЫ ПРИЕМЛЕТЕ ЛИЧНЫЕ ОТНОШЕНИЯ НА СЛУЖБЕ?
                </label>
                <select id="profile-romance" v-model="romance" class="profiles-modal__input">
                    <option value="no">Нет. Только служба</option>
                    <option value="yes">Да</option>
                </select>
                <p class="profiles-modal__hint">
                    Касается только романтических линий. Репутация у экипажа учитывается всегда.
                </p>
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
            max-width: 100%;
        }

        &__box:has(.profiles-modal__form) {
            width: 920px;
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

        &__terminal {
            display: flex;
            justify-content: space-between;
            gap: $spacing-sm;
            margin: (-$spacing-md) (-$spacing-md) $spacing-md;
            padding: $spacing-xs $spacing-md;
            border-bottom: 1px solid $color-primary;
            background-color: rgba($color-primary, 0.08);
            color: $color-secondary;
            font-size: 10px;
            letter-spacing: 2px;
        }

        &__led {
            color: $color-success;
        }

        &__prompt {
            color: $color-primary;
            font-size: 14px;
            line-height: 1.6;
        }

        &__cursor {
            animation: profiles-modal-blink 1s steps(1) infinite;
        }

        &__ranks {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: $spacing-sm;
            margin-bottom: $spacing-sm;

            @media (max-width: 760px) {
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }
        }

        &__warning {
            margin-bottom: $spacing-md;
            color: $color-danger;
            font-size: 11px;
            letter-spacing: 1px;
        }

        &__label {
            display: block;
            margin-top: $spacing-md;
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

        &__hint {
            margin-top: $spacing-xs;
            color: $color-secondary;
            font-size: 11px;
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

    @keyframes profiles-modal-blink {
        50% {
            opacity: 0;
        }
    }
</style>
