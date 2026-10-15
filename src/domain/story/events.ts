import * as v from 'valibot'
import data from '@/content/events/refugees.json'
import { count, parseContent, text } from '../content/parse'
import type { EventEffect, LevelEvent, StoryChoice } from '../levels/schema'

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

const option = v.strictObject({ text, consequence: text })
const template = parseContent(
    v.strictObject({
        wave: count,
        delay: count,
        timeLimit: v.pipe(v.number(), v.minValue(7), v.maxValue(15)),
        title: text,
        // {miners} and {military} become counted phrases ("6 шахтёров").
        text,
        accept: v.strictObject({ ...option.entries, cost: count }),
        // The redirected group is smaller by the given numbers when it reaches the next sector.
        redirect: v.strictObject({
            ...option.entries,
            cost: count,
            minersLost: count,
            militaryLost: count,
        }),
        refuse: option,
    }),
    data,
    'content/events/refugees.json',
)

function fill(pattern: string, values: { miners: number; military: number; cost?: number }) {
    return pattern
        .split('{miners}')
        .join(minersText(values.miners))
        .split('{military}')
        .join(militaryText(values.military))
        .split('{cost}')
        .join(String(values.cost ?? 0))
}

// The refugees event from the brief, built from its template in content/events.
export function refugeeEvent(miners = 6, military = 3, from = 1): LevelEvent {
    const { accept, redirect, refuse } = template
    const fewerMiners = Math.max(0, miners - redirect.minersLost)
    const fewerMilitary = Math.max(0, military - redirect.militaryLost)
    return {
        id: 'refugees',
        wave: template.wave,
        trigger: 'delay',
        delay: template.delay,
        dialog: {
            kind: 'full',
            title: template.title,
            text: fill(template.text, { miners, military }),
            timed: true,
            timeLimit: template.timeLimit,
            choices: [
                {
                    text: accept.text,
                    cost: { resources: accept.cost },
                    consequence: fill(accept.consequence, { miners, military, cost: accept.cost }),
                    effect: { type: 'addPersonnel', miners, military },
                },
                {
                    text: redirect.text,
                    cost: { resources: redirect.cost },
                    consequence: fill(redirect.consequence, {
                        miners: fewerMiners,
                        military: fewerMilitary,
                        cost: redirect.cost,
                    }),
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
                { text: refuse.text, consequence: refuse.consequence, effect: null },
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
