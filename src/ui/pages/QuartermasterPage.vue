<script setup lang="ts">
    import { storeToRefs } from 'pinia'
    import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
    import { useRouter } from 'vue-router'
    import { useProfileStore } from '@/stores/profileStore'
    import { useRequisitionStore } from '@/stores/requisitionStore'
    import { useUiStore } from '@/stores/uiStore'
    import KeycapButton from '@/ui/components/KeycapButton.vue'
    import MechanicalCounter from '@/ui/components/MechanicalCounter.vue'
    import RequisitionRow from '@/ui/components/RequisitionRow.vue'
    import ResetLever from '@/ui/components/ResetLever.vue'
    import TerminalScreen from '@/ui/components/TerminalScreen.vue'

    const router = useRouter()
    const requisitions = useRequisitionStore()
    const profiles = useProfileStore()
    const ui = useUiStore()
    const { view, log, flashId } = storeToRefs(requisitions)

    const upgrades = computed(() => view.value.tiers.flatMap((tier) => tier.upgrades))
    const selectedId = ref(upgrades.value[0]?.id ?? null)
    const selected = computed(
        () => upgrades.value.find((upgrade) => upgrade.id === selectedId.value) ?? null,
    )

    onMounted(() => {
        requisitions.refresh()
        window.addEventListener('keydown', onKey)
    })
    onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

    // ↑/↓ move the cursor, Enter approves, Esc leaves the terminal for the ship map.
    function onKey(event: KeyboardEvent) {
        if (ui.confirmRequest) return
        const index = upgrades.value.findIndex((upgrade) => upgrade.id === selectedId.value)
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            const step = event.key === 'ArrowDown' ? 1 : -1
            const next = (index + step + upgrades.value.length) % upgrades.value.length
            selectedId.value = upgrades.value[next]!.id
        } else if (event.key === 'Enter' && selected.value) {
            event.preventDefault()
            approve()
        } else if (event.key === 'Escape' && !ui.confirmRequest) {
            router.push({ name: 'levels' })
        }
    }

    function approve() {
        if (selected.value) requisitions.buy(selected.value.id)
    }
</script>

<template>
    <main class="quartermaster">
        <section class="quartermaster__console" aria-label="Интендантский терминал">
            <header class="quartermaster__plate">
                <span class="quartermaster__rivet" />
                <span>ИНТЕНДАНТСКИЙ ТЕРМИНАЛ ИТ-41</span>
                <span class="quartermaster__plate-sub">СИНОД ТЯГОТЕНИЯ · СТ-БЛК·IV-0417</span>
                <span class="quartermaster__rivet" />
            </header>

            <TerminalScreen
                :title="`> ИНТЕНДАНТСТВО // ОФИЦЕР: ${(profiles.activeName ?? '').toUpperCase()} // ДОПУСК ПОДТВЕРЖДЁН`"
            >
                <div class="quartermaster__listing" role="listbox" aria-label="Наряды">
                    <template v-for="tier in view.tiers" :key="tier.rank">
                        <p class="quartermaster__tier">== {{ tier.title }} ==</p>
                        <RequisitionRow
                            v-for="upgrade in tier.upgrades"
                            :key="upgrade.id"
                            :code="upgrade.form"
                            :name="upgrade.name"
                            :level="upgrade.level"
                            :max-level="upgrade.maxLevel"
                            :current="upgrade.current"
                            :next="upgrade.next"
                            :cost="upgrade.cost"
                            :affordable="upgrade.affordable"
                            :selected="upgrade.id === selectedId"
                            :flash="upgrade.id === flashId"
                            @select="selectedId = upgrade.id"
                        />
                    </template>
                </div>

                <div v-if="selected" class="quartermaster__detail" aria-live="polite">
                    <p>&gt; НАРЯД {{ selected.form }} · {{ selected.name.toUpperCase() }}</p>
                    <p class="quartermaster__description">{{ selected.description }}</p>
                    <p>
                        &gt; ЭФФЕКТ: {{ selected.current }}
                        <template v-if="selected.next">
                            · ПОСЛЕ УТВЕРЖДЕНИЯ: {{ selected.next }} · ЦЕНА:
                            {{ selected.cost }}
                            <span class="requisition-icon" aria-hidden="true" />
                        </template>
                        <template v-else> · НАРЯД ИСПОЛНЕН ПОЛНОСТЬЮ</template>
                    </p>
                </div>

                <div class="quartermaster__log" aria-live="polite">
                    <p v-for="(line, index) in log" :key="index">
                        &gt; {{ line.text }}
                        <template v-if="line.amount !== undefined">
                            {{ line.amount }}
                            <span class="requisition-icon" aria-hidden="true" />
                        </template>
                    </p>
                    <p class="quartermaster__prompt">
                        &gt; ПОЛУЧЕНО {{ view.earned }} · ПОТРАЧЕНО {{ view.spent }}
                        <span class="quartermaster__caret">█</span>
                    </p>
                </div>
            </TerminalScreen>

            <div class="quartermaster__deck">
                <MechanicalCounter :value="view.balance" label="РЕКВИЗИЦИИ НА СЧЁТЕ" />
                <div class="quartermaster__keys">
                    <KeycapButton
                        label="УТВЕРДИТЬ"
                        hint="ENTER"
                        :disabled="!selected?.affordable"
                        @press="approve"
                    />
                    <KeycapButton
                        label="ВЫХОД"
                        hint="ESC"
                        @press="router.push({ name: 'levels' })"
                    />
                </div>
                <ResetLever
                    :refund="view.refund"
                    :percent="view.refundPercent"
                    :disabled="view.spent === 0"
                    @pull="requisitions.reset()"
                />
            </div>
            <p class="quartermaster__hint">↑ ↓ — выбор наряда · ENTER — утвердить · ESC — выход</p>
        </section>
    </main>
</template>

<style scoped lang="scss">
    .quartermaster {
        @include blueprint-grid;

        display: flex;
        justify-content: center;
        height: 100vh;
        padding: $spacing-lg;
        overflow-y: auto;
        outline: none;

        // The terminal housing: brushed metal with a dark frame.
        &__console {
            display: flex;
            flex-direction: column;
            gap: $spacing-sm;
            width: min(1100px, 100%);
            height: fit-content;
            margin: auto 0;
            padding: $spacing-md $spacing-lg;
            border: 2px solid $color-primary;
            border-radius: 6px;
            background:
                repeating-linear-gradient(
                    90deg,
                    rgba(255, 255, 255, 0.015) 0 1px,
                    transparent 1px 3px
                ),
                linear-gradient(#222, #111);
            box-shadow:
                0 0 0 6px $color-metal-dark,
                0 20px 50px rgba(0, 0, 0, 0.9);
        }

        &__plate {
            display: flex;
            align-items: center;
            gap: $spacing-md;
            align-self: center;
            padding: 6px 16px;
            border: 1px solid $color-metal;
            background: linear-gradient($color-metal-light, $color-metal);
            color: $color-bg;
            font-size: 13px;
            font-weight: bold;
            letter-spacing: 3px;
            text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
        }

        &__plate-sub {
            font-size: 10px;
            letter-spacing: 2px;
        }

        &__rivet {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: radial-gradient(circle at 30% 30%, #fff, $color-metal-dark);
        }

        &__tier {
            margin: $spacing-sm 0 2px;
            color: $color-secondary;
            font-size: 12px;
            letter-spacing: 2px;
        }

        &__detail {
            margin-top: $spacing-sm;
            padding-top: $spacing-sm;
            border-top: 1px dashed rgba($color-primary, 0.4);
            font-size: 13px;
            line-height: 1.6;
        }

        &__description {
            color: $color-accent;
        }

        &__log {
            margin-top: $spacing-sm;
            padding-top: $spacing-sm;
            border-top: 1px dashed rgba($color-primary, 0.4);
            color: $color-accent;
            font-size: 12px;
            line-height: 1.6;
        }

        &__prompt {
            color: $color-secondary;
        }

        &__caret {
            animation: quartermaster-caret 1s steps(1) infinite;
        }

        // Control deck under the screen.
        &__deck {
            display: grid;
            grid-template-columns: auto 1fr auto;
            align-items: center;
            gap: $spacing-lg;
            padding: $spacing-sm $spacing-md 0;
            border-top: 2px solid $color-metal-dark;
        }

        &__keys {
            display: flex;
            justify-content: center;
            gap: $spacing-md;
        }

        &__hint {
            color: $color-secondary;
            font-size: 11px;
            text-align: center;
        }
    }

    @keyframes quartermaster-caret {
        50% {
            opacity: 0;
        }
    }
</style>
