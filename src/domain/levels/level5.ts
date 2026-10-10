import { Level } from '../model/Level'
export function createLevel5(): Level {
    const level = new Level(
        'level_5',
        'ЦЕНТРАЛЬНЫЙ РЕАКТОР: РЕШАЮЩАЯ БИТВА',
        'Главное существо-улей у реактора. Последний бой.',
        'story',
    )

    level.width = 2000
    level.height = 1100
    level.corridorHeight = 700
    level.livingQuartersY = 700

    level.basePath = [
        { x: 120, y: 320 },
        { x: 240, y: 220 },
        { x: 360, y: 340 },
        { x: 480, y: 230 },
        { x: 600, y: 360 },
        { x: 720, y: 240 },
        { x: 840, y: 370 },
        { x: 960, y: 250 },
        { x: 1080, y: 380 },
        { x: 1200, y: 260 },
        { x: 1320, y: 390 },
        { x: 1440, y: 270 },
        { x: 1560, y: 400 },
        { x: 1680, y: 280 },
        { x: 1800, y: 420 },
        { x: 1900, y: 500 },
        { x: 1900, y: 750 },
    ]

    level.corridors = [{ x: 80, y: 250, width: 1850, height: 250 }]

    level.spawnPoints = [{ x: 100, y: 350 }]
    level.exitPoints = [{ x: 1900, y: 750 }]

    level.floorBreaches = [
        { x: 600, y: 600, width: 180, height: 70, closed: false, canBeClosed: true },
        { x: 1100, y: 600, width: 180, height: 70, closed: false, canBeClosed: true },
        { x: 1600, y: 600, width: 180, height: 70, closed: false, canBeClosed: true },
    ]

    level.towerSlots = [
        { x: 180, y: 280, type: 'cannon' },
        { x: 320, y: 250, type: 'laser' },
        { x: 460, y: 280, type: 'rocket' },
        { x: 600, y: 300, type: 'machinegun' },
        { x: 740, y: 330, type: 'shock' },
        { x: 880, y: 350, type: 'cannon' },
        { x: 1020, y: 380, type: 'laser' },
        { x: 1160, y: 400, type: 'rocket' },
        { x: 1300, y: 430, type: 'machinegun' },
        { x: 1440, y: 450, type: 'shock' },
        { x: 1580, y: 480, type: 'cannon' },
        { x: 1720, y: 500, type: 'laser' },
    ]

    level.barricadeSlots = [
        { x: 250, y: 320, width: 80, height: 70 },
        { x: 390, y: 320, width: 80, height: 70 },
        { x: 530, y: 370, width: 80, height: 70 },
        { x: 670, y: 370, width: 80, height: 70 },
        { x: 810, y: 420, width: 80, height: 70 },
        { x: 950, y: 420, width: 80, height: 70 },
        { x: 1090, y: 470, width: 80, height: 70 },
        { x: 1230, y: 470, width: 80, height: 70 },
        { x: 1370, y: 520, width: 80, height: 70 },
        { x: 1510, y: 520, width: 80, height: 70 },
        { x: 1650, y: 570, width: 80, height: 70 },
        { x: 600, y: 600, width: 180, height: 70 },
        { x: 1100, y: 600, width: 180, height: 70 },
        { x: 1600, y: 600, width: 180, height: 70 },
    ]

    level.totalWaves = 5
    level.startingMiners = 25
    level.startingMilitary = 15
    level.startingResources = 500
    level.waveDifficulty = 1.5

    level.objectives = [
        { id: 'survive', text: 'Победить главное существо', completed: false },
        { id: 'save_reactor', text: 'Защитить реактор', completed: false },
        { id: 'no_personnel_loss', text: 'Потерять не более 5 человек', completed: false },
    ]

    level.events = [
        {
            wave: 0,
            trigger: 'start',
            dialog: {
                title: 'КАПИТАН НА МОСТИКЕ',
                text: 'Это оно. Главное существо у реактора. Если потеряем его - потеряем всё. Готовы?',
                choices: [{ text: 'Мы готовы к бою!', effect: null }],
                timed: false,
            },
        },
        {
            wave: 1,
            trigger: 'start',
            dialog: {
                title: 'УСИЛЕНИЕ',
                text: 'Все системы корабля в вашем распоряжении!',
                choices: [
                    {
                        text: 'Энергия в оружие! (+250 ресурсов)',
                        effect: { type: 'resources', value: 250 },
                    },
                    {
                        text: 'Энергия в щиты! (+60% прочность баррикад)',
                        effect: { type: 'buffBarricades', value: 1.6 },
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
                title: 'КРИТИЧЕСКИЙ МОМЕНТ',
                text: 'Существа адаптируются быстрее! Нужно действовать!',
                choices: [
                    {
                        text: 'Активировать резервы (+200 ресурсов, +6 военных)',
                        effect: { type: 'emergency', resources: 200, military: 6 },
                    },
                    {
                        text: 'Перегрузить башни (+70% урон)',
                        effect: { type: 'buffDamage', value: 1.7 },
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
                title: 'ПОСЛЕДНИЙ ШАНС',
                text: 'Босс идёт! Можем активировать экспериментальное оружие реактора. Уничтожит 60% врагов, но потребует 7 военных.',
                choices: [
                    {
                        text: 'Активировать! (-7 военных, убить 60% врагов)',
                        effect: { type: 'superWeapon', military: -7, killPercent: 0.6 },
                    },
                    { text: 'Нет, сражаться обычными силами', effect: null },
                ],
                timed: true,
                timeLimit: 20,
            },
        },
        {
            wave: 4,
            trigger: 'start',
            dialog: {
                title: 'ФИНАЛЬНАЯ АТАКА',
                text: 'Это последний момент! Всё или ничего!',
                choices: [
                    {
                        text: 'ВСЁ НА МАКСИМУМ! (+300 ресурсов)',
                        effect: { type: 'resources', value: 300 },
                    },
                    { text: 'Сохранить силы для защиты', effect: null },
                ],
                timed: false,
            },
        },
    ]

    return level
}
