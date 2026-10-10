import type { EventEffect, LevelEvent, StoryChoice } from '../model/Level'

export function choiceEffect(choice: StoryChoice): EventEffect | null {
    return choice.cost
        ? { type: 'transaction', cost: choice.cost, effects: choice.effect ? [choice.effect] : [] }
        : choice.effect
}

function people(count: number, forms: [string, string, string]): string {
    const last = count % 10
    const teen = count % 100 >= 11 && count % 100 <= 14
    const noun = teen
        ? forms[2]
        : last === 1
          ? forms[0]
          : last >= 2 && last <= 4
            ? forms[1]
            : forms[2]
    return `${count} ${noun}`
}

const minersText = (count: number) => people(count, ['шахтёр', 'шахтёра', 'шахтёров'])
const militaryText = (count: number) => people(count, ['военный', 'военных', 'военных'])

export function refugeeEvent(miners = 6, military = 3, from = 1): LevelEvent {
    const fewerMiners = Math.max(0, miners - 2)
    const fewerMilitary = Math.max(0, military - 1)
    return {
        id: 'refugees',
        wave: 2,
        trigger: 'delay',
        delay: 180,
        dialog: {
            kind: 'full',
            title: 'БЕЖЕНЦЫ ИЗ СОСЕДНЕГО ОТСЕКА',
            text: `У шлюза ждут ${minersText(miners)} и ${militaryText(military)}. Поможем им?`,
            timed: true,
            timeLimit: 12,
            choices: [
                {
                    text: 'Принять',
                    cost: { resources: 80 },
                    consequence: `Приняты ${minersText(miners)} и ${militaryText(military)}. Потрачено 80 ресурсов.`,
                    effect: { type: 'addPersonnel', miners, military },
                },
                {
                    text: 'Перенаправить',
                    cost: { resources: 30 },
                    consequence: `В следующем выбранном секторе встретятся ${minersText(fewerMiners)} и ${militaryText(fewerMilitary)}. Потрачено 30 ресурсов.`,
                    effect: {
                        type: 'transaction',
                        cost: {},
                        effects: [
                            {
                                type: 'flag',
                                name: 'refugees_pending',
                                value: fewerMiners + fewerMilitary > 0 ? 1 : 0,
                            },
                            { type: 'flag', name: 'refugees_miners', value: fewerMiners },
                            { type: 'flag', name: 'refugees_military', value: fewerMilitary },
                            { type: 'flag', name: 'refugees_from', value: from },
                        ],
                    },
                },
                {
                    text: 'Отказать',
                    consequence: 'Группа покинула шлюз. Ресурсы и персонал не изменились.',
                    effect: null,
                },
            ],
        },
    }
}

export function costText(choice: StoryChoice): string {
    const cost = choice.cost ?? {}
    const parts: string[] = []
    const resources =
        (cost.resources ?? 0) +
        (choice.effect?.type === 'resources' ? Math.max(0, -choice.effect.value) : 0)
    const military =
        (cost.military ?? 0) +
        (choice.effect?.type === 'removeMilitary'
            ? choice.effect.count
            : choice.effect?.type === 'superWeapon'
              ? Math.max(0, -choice.effect.military)
              : 0)
    const miners =
        (cost.miners ?? 0) + (choice.effect?.type === 'convert' ? choice.effect.count : 0)
    if (resources) parts.push(`${resources} ресурсов`)
    if (miners) parts.push(`${miners} шахтёров`)
    if (military) parts.push(`${military} военных`)
    return parts.length ? `Стоимость: ${parts.join(', ')}` : 'Без затрат'
}
