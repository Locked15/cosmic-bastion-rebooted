<script setup lang="ts">
    // One save slot: an officer's file, or an empty slot that can be filled.
    const {
        index,
        name = null,
        rank = '',
        progress = '',
        lastPlayed = '',
        active = false,
        disabled = false,
    } = defineProps<{
        index: number
        name?: string | null
        rank?: string
        progress?: string
        lastPlayed?: string
        active?: boolean
        disabled?: boolean
    }>()

    defineEmits<{ select: []; remove: []; create: [] }>()
</script>

<template>
    <article
        class="profile-slot"
        :class="{ 'profile-slot--active': active, 'profile-slot--empty': !name }"
    >
        <header class="profile-slot__header">
            <span>ЛИЧНОЕ ДЕЛО №{{ index }}</span>
            <span v-if="active" class="profile-slot__badge">НА ДЕЖУРСТВЕ</span>
        </header>
        <template v-if="name">
            <p class="profile-slot__rank">{{ rank }}</p>
            <p class="profile-slot__name">{{ name }}</p>
            <p class="profile-slot__meta">{{ progress }}</p>
            <p class="profile-slot__meta">Последний вход: {{ lastPlayed }}</p>
            <div class="profile-slot__actions">
                <button
                    type="button"
                    class="button button--small"
                    :disabled="disabled || active"
                    @click="$emit('select')"
                >
                    {{ active ? 'АКТИВЕН' : 'ВОЙТИ' }}
                </button>
                <button
                    type="button"
                    class="button button--small button--secondary profile-slot__remove"
                    :disabled="disabled"
                    :aria-label="`Удалить профиль ${name}`"
                    @click="$emit('remove')"
                >
                    УДАЛИТЬ
                </button>
            </div>
        </template>
        <template v-else>
            <p class="profile-slot__meta">Ячейка свободна</p>
            <div class="profile-slot__actions">
                <button
                    type="button"
                    class="button button--small"
                    :disabled="disabled"
                    @click="$emit('create')"
                >
                    НОВЫЙ ПРОФИЛЬ
                </button>
            </div>
        </template>
    </article>
</template>

<style scoped lang="scss">
    .profile-slot {
        padding: $spacing-md;
        border: 1px solid $color-border;
        background-color: rgba($color-primary, 0.02);

        &--active {
            border-color: $color-primary;
            box-shadow: 0 0 12px rgba($color-primary, 0.2);
        }

        &--empty {
            border-style: dashed;
        }

        &__header {
            display: flex;
            justify-content: space-between;
            gap: $spacing-sm;
            margin-bottom: $spacing-sm;
            color: $color-secondary;
            font-size: 11px;
            letter-spacing: 2px;
        }

        &__badge {
            color: $color-success;
        }

        &__rank {
            color: $color-secondary;
            font-size: 11px;
            letter-spacing: 2px;
            text-transform: uppercase;
        }

        &__name {
            margin-bottom: $spacing-xs;
            font-size: 18px;
            font-weight: bold;
            letter-spacing: 1px;
            overflow-wrap: anywhere;
        }

        &__meta {
            color: $color-accent;
            font-size: 12px;
            line-height: 1.6;
        }

        &__actions {
            display: flex;
            gap: $spacing-sm;
            margin-top: $spacing-sm;

            .button {
                flex: 1;
                margin: 0;
            }
        }

        &__remove:not(:disabled):hover {
            border-color: $color-danger;
            color: $color-danger;
        }
    }
</style>
