import { Level } from '../model/Level'
export function createLevel4(): Level {
    const level = new Level(
        'level_4',
        'СЕКТОР D-1: МАССОВАЯ АТАКА',
        'Огромные силы врага. Это испытание на прочность.',
        'normal',
    )

    level.width = 1800
    level.height = 1000
    level.corridorHeight = 600
    level.livingQuartersY = 600

    level.basePath = [
        { x: 120, y: 260 },
        { x: 240, y: 170 },
        { x: 360, y: 280 },
        { x: 480, y: 180 },
        { x: 600, y: 300 },
        { x: 720, y: 190 },
        { x: 840, y: 310 },
        { x: 960, y: 200 },
        { x: 1080, y: 320 },
        { x: 1200, y: 210 },
        { x: 1320, y: 330 },
        { x: 1440, y: 220 },
        { x: 1560, y: 340 },
        { x: 1700, y: 400 },
        { x: 1700, y: 650 },
    ]

    level.corridors = [{ x: 80, y: 200, width: 1650, height: 250 }]

    level.spawnPoints = [{ x: 100, y: 300 }]
    level.exitPoints = [{ x: 1700, y: 650 }]

    level.floorBreaches = [
        { x: 510, y: 220, width: 60, height: 40, closed: false, canBeClosed: true },
        { x: 990, y: 240, width: 60, height: 40, closed: false, canBeClosed: true },
        { x: 1350, y: 255, width: 60, height: 40, closed: false, canBeClosed: true },
    ]

    level.towerSlots = [
        { x: 200, y: 260, type: 'cannon' },
        { x: 260, y: 255, type: 'laser' },
        { x: 475, y: 250, type: 'rocket' },
        { x: 600, y: 230, type: 'machinegun' },
        { x: 740, y: 280, type: 'shock' },
        { x: 895, y: 325, type: 'cannon' },
        { x: 1020, y: 330, type: 'laser' },
        { x: 1160, y: 350, type: 'rocket' },
        { x: 1300, y: 380, type: 'machinegun' },
        { x: 1440, y: 400, type: 'shock' },
    ]

    level.barricadeSlots = [
        { x: 250, y: 270, width: 70, height: 60 },
        { x: 390, y: 270, width: 70, height: 60 },
        { x: 530, y: 320, width: 70, height: 60 },
        { x: 670, y: 320, width: 70, height: 60 },
        { x: 810, y: 370, width: 70, height: 60 },
        { x: 950, y: 370, width: 70, height: 60 },
        { x: 1090, y: 420, width: 70, height: 60 },
        { x: 1230, y: 420, width: 70, height: 60 },
        { x: 1370, y: 470, width: 70, height: 60 },
        { x: 500, y: 500, width: 150, height: 60 },
        { x: 900, y: 500, width: 150, height: 60 },
        { x: 1300, y: 500, width: 150, height: 60 },
    ]

    level.totalWaves = 7
    level.startingMiners = 22
    level.startingMilitary = 12
    level.startingResources = 400
    level.waveDifficulty = 1.2

    level.objectives = [
        { id: 'survive', text: 'Пережить все волны', completed: false },
        { id: 'max_towers', text: 'Иметь минимум 8 активных башен', completed: false },
        { id: 'save_reactor', text: 'Защитить реактор', completed: false },
    ]

    level.events = [
        {
            wave: 1,
            trigger: 'start',
            dialog: {
                title: 'РАЗВЕДКА',
                text: 'Волны становятся сильнее. Нужна стратегия!',
                choices: [
                    {
                        text: 'Фокус на урон (+100 ресурсов)',
                        effect: { type: 'resources', value: 100 },
                    },
                    {
                        text: 'Фокус на защиту (+5 военных)',
                        effect: { type: 'addMilitary', count: 5 },
                    },
                ],
                timed: true,
                timeLimit: 15,
            },
        },
        {
            wave: 2,
            trigger: 'start',
            dialog: {
                title: 'НАХОДКА',
                text: 'Нашли склад с припасами! Что взять?',
                choices: [
                    {
                        text: 'Технические части (+150 ресурсов)',
                        effect: { type: 'resources', value: 150 },
                    },
                    { text: 'Медикаменты (+6 шахтёров)', effect: { type: 'addMiners', count: 6 } },
                ],
                timed: true,
                timeLimit: 18,
            },
        },
        {
            wave: 3,
            trigger: 'start',
            dialog: {
                title: 'АНОМАЛИЯ',
                text: 'Сканеры зафиксировали мощную энергию. Существа мутируют!',
                choices: [
                    {
                        text: 'Экстренная подготовка (+120 ресурсов, +3 военных)',
                        effect: { type: 'emergency', resources: 120, military: 3 },
                    },
                    { text: 'Наблюдать и ждать', effect: null },
                ],
                timed: true,
                timeLimit: 12,
            },
        },
        {
            wave: 4,
            trigger: 'start',
            dialog: {
                title: 'КРИТИЧЕСКАЯ СИТУАЦИЯ',
                text: 'Половина пути! Нужны силы для финального рывка!',
                choices: [
                    {
                        text: 'Все на оборону! (+200 ресурсов)',
                        effect: { type: 'resources', value: 200 },
                    },
                    {
                        text: 'Мобилизация! (+6 военных)',
                        effect: { type: 'addMilitary', count: 6 },
                    },
                ],
                timed: true,
                timeLimit: 15,
            },
        },
        {
            wave: 5,
            trigger: 'start',
            dialog: {
                title: 'ИНЖЕНЕР ПЕТРОВ',
                text: 'Оборудование перегружено! Риск поломки!',
                choices: [
                    {
                        text: 'Ремонтировать оборудование (+80 ресурсов)',
                        effect: { type: 'resources', value: 80 },
                    },
                    { text: 'Продолжить на максимальной мощности', effect: null },
                ],
                timed: true,
                timeLimit: 12,
            },
        },
        {
            wave: 6,
            trigger: 'start',
            dialog: {
                title: 'ПОСЛЕДНИЙ БОЙ',
                text: 'Финальная волна! Это наш шанс!',
                choices: [
                    {
                        text: 'Максимальная огневая мощь! (+250 ресурсов)',
                        effect: { type: 'resources', value: 250 },
                    },
                    { text: 'Доверимся построенной обороне', effect: null },
                ],
                timed: false,
            },
        },
    ]

    return level
}
