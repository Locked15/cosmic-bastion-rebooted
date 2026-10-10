import { Level } from '../model/Level'
export function createLevel3(): Level {
    const level = new Level(
        'level_3',
        'СЕКТОР C-9: УМНАЯ УГРОЗА',
        'Существа адаптируются. Требуется новая тактика.',
        'story',
    )

    level.width = 1600
    level.height = 900
    level.corridorHeight = 550
    level.livingQuartersY = 550

    level.basePath = [
        { x: 100, y: 240 },
        { x: 200, y: 160 },
        { x: 320, y: 260 },
        { x: 430, y: 150 },
        { x: 540, y: 270 },
        { x: 650, y: 160 },
        { x: 760, y: 280 },
        { x: 870, y: 170 },
        { x: 990, y: 280 },
        { x: 1100, y: 180 },
        { x: 1220, y: 290 },
        { x: 1330, y: 200 },
        { x: 1430, y: 310 },
        { x: 1500, y: 360 },
        { x: 1500, y: 600 },
    ]

    level.corridors = [{ x: 80, y: 150, width: 1450, height: 250 }]

    level.spawnPoints = [{ x: 100, y: 250 }]
    level.exitPoints = [{ x: 1500, y: 600 }]

    level.floorBreaches = [
        { x: 450, y: 450, width: 120, height: 50, closed: false, canBeClosed: true },
        { x: 850, y: 450, width: 120, height: 50, closed: false, canBeClosed: true },
        { x: 1250, y: 450, width: 120, height: 50, closed: false, canBeClosed: true },
    ]

    level.towerSlots = [
        { x: 180, y: 180, type: 'cannon' },
        { x: 320, y: 150, type: 'laser' },
        { x: 460, y: 180, type: 'rocket' },
        { x: 600, y: 200, type: 'machinegun' },
        { x: 740, y: 230, type: 'shock' },
        { x: 880, y: 250, type: 'cannon' },
        { x: 1020, y: 280, type: 'laser' },
        { x: 1160, y: 300, type: 'rocket' },
    ]

    level.barricadeSlots = [
        { x: 250, y: 220, width: 60, height: 50 },
        { x: 390, y: 220, width: 60, height: 50 },
        { x: 530, y: 270, width: 60, height: 50 },
        { x: 670, y: 270, width: 60, height: 50 },
        { x: 810, y: 320, width: 60, height: 50 },
        { x: 950, y: 320, width: 60, height: 50 },
        { x: 1090, y: 370, width: 60, height: 50 },
        { x: 1230, y: 370, width: 60, height: 50 },
        { x: 450, y: 450, width: 120, height: 50 },
        { x: 850, y: 450, width: 120, height: 50 },
        { x: 1250, y: 450, width: 120, height: 50 },
    ]

    level.totalWaves = 6
    level.startingMiners = 18
    level.startingMilitary = 10
    level.startingResources = 350
    level.waveDifficulty = 1.0

    level.objectives = [
        { id: 'survive', text: 'Пережить все волны', completed: false },
        { id: 'upgrade_tower', text: 'Улучшить башню до 3 уровня', completed: false },
        { id: 'max_towers', text: 'Иметь минимум 6 активных башен', completed: false },
    ]

    level.events = [
        {
            wave: 0,
            trigger: 'start',
            dialog: {
                title: 'DR. SILVA',
                text: 'Капитан, сканеры показывают странную активность. Существа... меняются. Учатся.',
                choices: [{ text: 'Понял. Будем готовы.', effect: null }],
                timed: false,
            },
        },
        {
            wave: 1,
            trigger: 'start',
            dialog: {
                title: 'ВЫБОР: ТЕХНОЛОГИЯ',
                text: 'Инженеры разработали два прототипа. Что выбрать?',
                choices: [
                    {
                        text: 'Улучшенные снаряды (+урон башням)',
                        effect: { type: 'buffDamage', value: 1.3 },
                    },
                    {
                        text: 'Укрепленные баррикады (+прочность)',
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
                title: 'СОСЕДНИЙ СЕКТОР',
                text: 'Сектор D-4 запрашивает подкрепление. Можем отправить людей или ресурсы.',
                choices: [
                    {
                        text: 'Отправить 3 военных (получить 100 ресурсов)',
                        effect: { type: 'removeMilitary', count: 3, resources: 100 },
                    },
                    {
                        text: 'Отправить 120 ресурсов (получить 4 военных)',
                        effect: { type: 'resources', value: -120, military: 4 },
                    },
                    { text: 'Отказать', effect: null },
                ],
                timed: true,
                timeLimit: 20,
            },
        },
        {
            wave: 3,
            trigger: 'start',
            dialog: {
                title: 'ПРЕДУПРЕЖДЕНИЕ',
                text: 'Следующая волна содержит существ с особыми способностями!',
                choices: [
                    {
                        text: 'Усилить оборону (+120 ресурсов)',
                        effect: { type: 'resources', value: 120 },
                    },
                    {
                        text: 'Подготовить людей (+4 военных)',
                        effect: { type: 'addMilitary', count: 4 },
                    },
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
                text: 'Враги адаптируются быстрее! Нужны срочные меры!',
                choices: [
                    {
                        text: 'Активировать резервы (+150 ресурсов, +3 военных)',
                        effect: { type: 'emergency', resources: 150, military: 3 },
                    },
                    {
                        text: 'Перегрузить башни (+60% урон)',
                        effect: { type: 'buffDamage', value: 1.6 },
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
                title: 'ПОСЛЕДНЯЯ ВОЛНА',
                text: 'Это решающий момент. Дать всё что есть?',
                choices: [
                    {
                        text: 'Да! Максимальная мощь! (+200 ресурсов)',
                        effect: { type: 'resources', value: 200 },
                    },
                    { text: 'Сохранить резервы', effect: null },
                ],
                timed: false,
            },
        },
    ]

    return level
}
