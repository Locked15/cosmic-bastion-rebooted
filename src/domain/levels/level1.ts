import { Level } from '../model/Level'
export function createLevel1(): Level {
    const level = new Level(
        'level_1',
        'СЕКТОР A-7: ПЕРВЫЙ КОНТАКТ',
        'Первая волна существ приближается. Активируйте оборону.',
        'story',
    )

    level.width = 1200
    level.height = 700
    level.corridorHeight = 450
    level.livingQuartersY = 450

    level.basePath = [
        { x: 40, y: 240 },
        { x: 150, y: 180 },
        { x: 230, y: 300 },
        { x: 320, y: 190 },
        { x: 420, y: 310 },
        { x: 520, y: 200 },
        { x: 620, y: 320 },
        { x: 720, y: 210 },
        { x: 820, y: 330 },
        { x: 930, y: 220 },
        { x: 1030, y: 310 },
        { x: 1100, y: 260 },
        { x: 1100, y: 500 },
    ]

    level.corridors = [{ x: 30, y: 150, width: 1100, height: 200 }]

    level.spawnPoints = [{ x: 50, y: 250 }]
    level.exitPoints = [{ x: 1100, y: 500 }]

    level.floorBreaches = [
        { x: 350, y: 400, width: 120, height: 40, closed: false, canBeClosed: true },
        { x: 750, y: 400, width: 120, height: 40, closed: false, canBeClosed: true },
    ]

    level.towerSlots = [
        { x: 150, y: 180, type: 'cannon' },
        { x: 300, y: 150, type: 'machinegun' },
        { x: 450, y: 180, type: 'cannon' },
        { x: 600, y: 200, type: 'rocket' },
        { x: 800, y: 250, type: 'machinegun' },
    ]

    level.barricadeSlots = [
        { x: 250, y: 220, width: 50, height: 50 },
        { x: 400, y: 220, width: 50, height: 50 },
        { x: 550, y: 270, width: 50, height: 50 },
        { x: 700, y: 270, width: 50, height: 50 },
        { x: 350, y: 400, width: 120, height: 40 },
        { x: 750, y: 400, width: 120, height: 40 },
    ]

    level.totalWaves = 4
    level.startingMiners = 12
    level.startingMilitary = 6
    level.startingResources = 250
    level.waveDifficulty = 0.7

    level.objectives = [
        { id: 'survive', text: 'Пережить все волны', completed: false },
        { id: 'repair_tower', text: 'Починить хотя бы одну башню', completed: false },
        { id: 'close_breach', text: 'Закрыть хотя бы один пролом', completed: false },
    ]

    level.events = [
        {
            wave: 0,
            trigger: 'start',
            dialog: {
                title: 'КОМАНДИР МАРКУС',
                text: 'Капитан, неизвестные существа приближаются к сектору A-7. Системы повреждены. Активируйте орудия!',
                choices: [{ text: 'Начать ремонт систем', effect: null }],
                timed: false,
            },
        },
        {
            wave: 1,
            trigger: 'start',
            dialog: {
                title: 'ИНЖЕНЕР CHEN',
                text: 'Обнаружены проломы в полу. Существа могут провалиться прямо к нашим людям. Закрыть баррикадами?',
                choices: [
                    {
                        text: 'Да, выделить ресурсы (+40 ресурсов)',
                        effect: { type: 'resources', value: 40 },
                    },
                    { text: 'Нет, справимся сами', effect: null },
                ],
                timed: true,
                timeLimit: 15,
            },
        },
        {
            wave: 2,
            trigger: 'start',
            dialog: {
                title: 'СКАНЕР УГРОЗ',
                text: 'Следующая волна будет усилена. Нужна дополнительная огневая мощь или больше людей для защиты?',
                choices: [
                    {
                        text: 'Переобучить 3 шахтёров в военные',
                        effect: { type: 'convert', count: 3 },
                    },
                    {
                        text: 'Получить 60 дополнительных ресурсов',
                        effect: { type: 'resources', value: 60 },
                    },
                ],
                timed: true,
                timeLimit: 12,
            },
        },
        {
            wave: 3,
            trigger: 'start',
            dialog: {
                title: 'ТАКТИЧЕСКИЙ ОФИЦЕР',
                text: 'Последняя волна! У нас есть шанс, но нужно принять решение!',
                choices: [
                    {
                        text: 'Усилить оборону (+100 ресурсов)',
                        effect: { type: 'resources', value: 100 },
                    },
                    {
                        text: 'Подготовить людей (+3 военных)',
                        effect: { type: 'addMilitary', count: 3 },
                    },
                ],
                timed: false,
            },
        },
    ]

    return level
}
