<script setup lang="ts">
    import type { CrewMemberView } from '@/application/dto/views'
    import AppButton from '@/ui/components/AppButton.vue'
    import StatItem from '@/ui/components/StatItem.vue'

    // The selected cabin's personnel file, and the wardroom's actions.
    const {
        member,
        pending,
        scenesEnabled = true,
    } = defineProps<{
        member: CrewMemberView | null
        // Conversations waiting at the common table.
        pending: number
        scenesEnabled?: boolean
    }>()

    defineEmits<{ talk: [id: string]; table: []; back: [] }>()

    const PIPS = 10
    const affection = (value: number) => Math.max(0, Math.min(PIPS, value))
</script>

<template>
    <aside class="cabin-info">
        <h3 class="cabin-info__title">{{ member?.name ?? 'ВЫБЕРИТЕ КАЮТУ' }}</h3>
        <div class="cabin-info__details">
            <template v-if="member">
                <p class="cabin-info__role">{{ member.cabin.code }} · {{ member.role }}</p>
                <p v-if="!member.present" class="cabin-info__absent">
                    Нет на связи. Каюта опечатана до возвращения хозяина.
                </p>
                <div v-else class="cabin-info__file">
                    <StatItem label="Отношение" :value="member.standing" />
                    <StatItem
                        v-if="member.affection !== null"
                        label="Привязанность"
                        :value="`${'♥'.repeat(affection(member.affection))}${'·'.repeat(PIPS - affection(member.affection))}`"
                    />
                    <p v-if="member.partner" class="cabin-info__partner">
                        Человек, к которому вы вернётесь.
                    </p>
                    <p class="cabin-info__pending">
                        {{
                            member.pendingScenes
                                ? `Ждёт разговора: ${member.pendingScenes}`
                                : 'Новых разговоров нет.'
                        }}
                    </p>
                </div>
            </template>
            <p v-else class="cabin-info__hint">
                Каюты экипажа вокруг общего стола. Выберите каюту, чтобы открыть личное дело.
            </p>
            <p v-if="!scenesEnabled" class="cabin-info__hint">
                Сцены с экипажем отключены в настройках.
            </p>
        </div>
        <div class="cabin-info__actions">
            <AppButton
                v-if="member"
                :disabled="!member.present || !member.pendingScenes"
                @click="member && $emit('talk', member.id)"
            >
                ПОГОВОРИТЬ
            </AppButton>
            <AppButton :disabled="!pending" @click="$emit('table')">
                ОБЩИЙ СТОЛ · РАЗГОВОРОВ: {{ pending }}
            </AppButton>
            <AppButton variant="secondary" @click="$emit('back')">К СХЕМЕ КОРАБЛЯ</AppButton>
        </div>
    </aside>
</template>

<style scoped lang="scss">
    .cabin-info {
        display: flex;
        flex-direction: column;
        min-height: 0;
        padding: $spacing-lg;
        border: 2px solid $color-primary;

        &__title {
            margin-bottom: $spacing-md;
            padding-bottom: $spacing-sm;
            border-bottom: 1px solid $color-border;
        }

        &__details {
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
        }

        &__role {
            margin-bottom: $spacing-md;
            font-size: 12px;
        }

        &__file {
            padding: $spacing-sm;
            border-left: 2px solid $color-secondary;
        }

        &__absent,
        &__hint {
            margin-bottom: $spacing-md;
            color: $color-secondary;
            font-size: 13px;
        }

        &__partner {
            margin-top: $spacing-sm;
            color: $color-accent;
            font-size: 13px;
        }

        &__pending {
            margin-top: $spacing-md;
            font-size: 13px;
        }

        &__actions {
            flex: none;
            padding-top: $spacing-sm;
            border-top: 1px solid $color-border;
        }
    }
</style>
