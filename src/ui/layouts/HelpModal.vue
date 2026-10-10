<script setup lang="ts">
    import { useUiStore } from '@/stores/uiStore'
    import AppButton from '@/ui/components/AppButton.vue'

    const ui = useUiStore()

    const sections: { title: string; tone?: 'warning' | 'danger'; lines: string[] }[] = [
        {
            title: 'ЦЕЛЬ',
            lines: ['Защитить экипаж разбившегося корабля от волн враждебных существ.'],
        },
        {
            title: 'ПЕРСОНАЛ',
            lines: [
                'Шахтёры (⚒) добывают ресурсы: 0.5 в секунду на человека.',
                'Военные (⚔) строят и улучшают оборону; чем их больше, тем быстрее.',
                'Переобучение: укажите количество и нажмите «ПЕРЕВЕСТИ».',
            ],
        },
        {
            title: 'СТРОИТЕЛЬСТВО',
            lines: [
                'Выберите башню или баррикаду справа.',
                'Башни ставятся на подсвеченные слоты, баррикады — на путь врагов.',
                'Наведите курсор на объект, чтобы улучшить или демонтировать его.',
                'Демонтаж возвращает 50% стоимости.',
            ],
        },
        {
            title: 'ПОРАЖЕНИЕ',
            tone: 'danger',
            lines: ['Гибель всего персонала или 10 прорвавшихся врагов.'],
        },
        {
            title: 'УПРАВЛЕНИЕ',
            lines: [
                'ЛКМ — выбор / строительство',
                'ESC — отмена / пауза',
                'ПРОБЕЛ — начать волну',
                'V — переключить вид',
                'U — улучшить выделенное',
            ],
        },
    ]
</script>

<template>
    <div v-if="ui.helpOpen" class="modal" @click.self="ui.helpOpen = false">
        <div class="modal__box help-modal">
            <h3 class="modal__title">// ИНСТРУКЦИИ COSMIC BASTION //</h3>
            <section v-for="section in sections" :key="section.title" class="help-modal__section">
                <h4
                    class="help-modal__heading"
                    :class="section.tone && `help-modal__heading--${section.tone}`"
                >
                    {{ section.title }}:
                </h4>
                <p v-for="line in section.lines" :key="line" class="help-modal__line">
                    • {{ line }}
                </p>
            </section>
            <AppButton @click="ui.helpOpen = false">ПОНЯТНО</AppButton>
        </div>
    </div>
</template>

<style scoped lang="scss">
    .help-modal {
        max-width: 700px;

        &__section {
            margin-top: 15px;
        }

        &__heading {
            padding-left: 10px;
            border-left: 3px solid $color-success;
            color: $color-success;

            &--danger {
                border-left-color: $color-danger;
                color: $color-danger;
            }
        }

        &__line {
            margin-left: 15px;
            line-height: 1.8;
        }
    }
</style>
