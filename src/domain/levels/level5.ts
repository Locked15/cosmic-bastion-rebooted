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
        { x: 630, y: 280, width: 60, height: 40, closed: false, canBeClosed: true },
        { x: 1110, y: 300, width: 60, height: 40, closed: false, canBeClosed: true },
        { x: 1710, y: 330, width: 60, height: 40, closed: false, canBeClosed: true },
    ]

    level.towerSlots = [
        { x: 210, y: 310, type: 'cannon' },
        { x: 270, y: 320, type: 'laser' },
        { x: 475, y: 300, type: 'rocket' },
        { x: 600, y: 285, type: 'machinegun' },
        { x: 735, y: 330, type: 'shock' },
        { x: 905, y: 375, type: 'cannon' },
        { x: 1015, y: 385, type: 'laser' },
        { x: 1160, y: 400, type: 'rocket' },
        { x: 1300, y: 435, type: 'machinegun' },
        { x: 1440, y: 450, type: 'shock' },
        { x: 1580, y: 475, type: 'cannon' },
        { x: 1720, y: 475, type: 'laser' },
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
        {
            id: 'survive',
            text: 'Победить главное существо',
            completed: false,
        },
        {
            id: 'save_reactor',
            text: 'Не допустить ни одного прорыва в жилой отсек',
            completed: false,
            target: 0,
        },
        {
            id: 'no_personnel_loss',
            text: 'Потерять не более 5 человек',
            completed: false,
            target: 5,
        },
        {
            id: 'save_archive',
            text: 'Передать архив корабля спасательному судну',
            completed: false,
            keyObjective: true,
        },
    ]

    level.events = [
        {
            wave: 0,
            trigger: 'start',
            dialog: {
                kind: 'unknown',
                title: 'КАПИТАН НА МОСТИКЕ',
                text: 'Главное существо у реактора. Судьба корабля решится здесь.',
                choices: [
                    {
                        text: 'Мы готовы к бою!',
                        effect: null,
                        consequence: 'Решение принято. Состояние сектора не изменилось.',
                    },
                ],
                timed: false,
            },
        },
        {
            wave: 1,
            trigger: 'start',
            dialog: {
                kind: 'full',
                title: 'УСИЛЕНИЕ',
                text: 'Все системы корабля в вашем распоряжении!',
                choices: [
                    {
                        text: 'Энергия в оружие',
                        effect: {
                            type: 'resources',
                            value: 250,
                        },
                        consequence: 'Получено 250 ресурсов.',
                    },
                    {
                        text: 'Энергия в щиты',
                        effect: {
                            type: 'buffBarricades',
                            value: 1.6,
                        },
                        consequence: 'Прочность всех баррикад увеличена на 60%.',
                    },
                ],
                timed: true,
                timeLimit: 15,
            },
        },
        {
            wave: 2,
            trigger: 'delay',
            delay: 120,
            dialog: {
                kind: 'partial',
                title: 'КРИТИЧЕСКИЙ МОМЕНТ',
                text: 'Существа адаптируются быстрее. Нужно действовать.',
                choices: [
                    {
                        text: 'Активировать резервы',
                        effect: {
                            type: 'emergency',
                            resources: 200,
                            military: 6,
                        },
                        consequence: 'Получено 200 ресурсов и 6 военных.',
                    },
                    {
                        text: 'Перегрузить башни',
                        effect: {
                            type: 'buffDamage',
                            value: 1.7,
                        },
                        consequence: 'Урон башен увеличен на 70%.',
                    },
                ],
                timed: true,
                timeLimit: 7,
            },
        },
        {
            wave: 3,
            trigger: 'delay',
            delay: 60,
            dialog: {
                kind: 'full',
                title: 'СПАСЕНИЕ АРХИВА',
                text: 'Спасательное судно готово принять архив и координаты выживших.',
                choices: [
                    {
                        text: 'Передать архив',
                        effect: {
                            type: 'flag',
                            name: 'archive_saved',
                            value: 1,
                        },
                        consequence: 'Архив сохранён. Сюжет завершится даже при потере реактора.',
                        cost: {
                            resources: 100,
                        },
                    },
                    {
                        text: 'Оставить архив на корабле',
                        effect: null,
                        consequence: 'Решение принято. Состояние сектора не изменилось.',
                    },
                ],
                timed: true,
                timeLimit: 10,
            },
        },
        {
            wave: 3,
            trigger: 'start',
            dialog: {
                kind: 'full',
                title: 'ПОСЛЕДНИЙ ШАНС',
                text: 'Экспериментальное оружие реактора требует военный расчёт.',
                choices: [
                    {
                        text: 'Активировать оружие',
                        effect: {
                            type: 'superWeapon',
                            military: -7,
                            killPercent: 0.6,
                        },
                        consequence: '7 военных отданы расчёту. Уничтожено 60% активных врагов.',
                    },
                    {
                        text: 'Сражаться обычными силами',
                        effect: null,
                        consequence: 'Решение принято. Состояние сектора не изменилось.',
                    },
                ],
                timed: true,
                timeLimit: 7,
            },
        },
        {
            wave: 4,
            trigger: 'start',
            dialog: {
                kind: 'full',
                title: 'ФИНАЛЬНАЯ АТАКА',
                text: 'Всё или ничего. Последний резерв доступен.',
                choices: [
                    {
                        text: 'Задействовать резерв',
                        effect: {
                            type: 'resources',
                            value: 300,
                        },
                        consequence: 'Получено 300 ресурсов.',
                    },
                    {
                        text: 'Сохранить силы',
                        effect: null,
                        consequence: 'Решение принято. Состояние сектора не изменилось.',
                    },
                ],
                timed: true,
                timeLimit: 15,
            },
        },
    ]

    return level
}
