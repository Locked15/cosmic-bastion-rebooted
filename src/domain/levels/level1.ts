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

    level.towerSlots = [
        { x: 205, y: 175, type: 'cannon' },
        { x: 270, y: 175, type: 'machinegun' },
        { x: 450, y: 180, type: 'cannon' },
        { x: 600, y: 200, type: 'rocket' },
        { x: 810, y: 240, type: 'machinegun' },
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
        {
            id: 'survive',
            text: 'Пережить все волны',
            completed: false,
        },
        {
            id: 'repair_tower',
            text: 'Починить хотя бы одну башню',
            completed: false,
        },
        {
            id: 'build_barricade',
            text: 'Построить хотя бы одну баррикаду',
            completed: false,
        },
        {
            id: 'save_engineer',
            text: 'Эвакуировать инженера Чена',
            completed: false,
        },
    ]

    level.events = [
        {
            wave: 0,
            trigger: 'start',
            dialog: {
                kind: 'unknown',
                title: 'КОМАНДИР МАРКУС',
                text: 'Капитан, неизвестные существа приближаются к сектору A-7. Системы повреждены. Активируйте орудия!',
                choices: [
                    {
                        text: 'Начать ремонт систем',
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
                title: 'ИНЖЕНЕР CHEN',
                text: 'Существа идут по коридору прямо к жилому отсеку. Перекрыть проход баррикадами?',
                choices: [
                    {
                        text: 'Выделить резервы',
                        effect: {
                            type: 'resources',
                            value: 40,
                        },
                        consequence: 'Получено 40 ресурсов на баррикады.',
                    },
                    {
                        text: 'Справимся своими силами',
                        effect: null,
                        consequence: 'Решение принято. Состояние сектора не изменилось.',
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
                kind: 'full',
                title: 'ЭКСПЕРИМЕНТАЛЬНЫЙ ЛАЗЕР',
                text: 'Инженеры могут восстановить прототип раньше срока.',
                choices: [
                    {
                        text: 'Восстановить прототип',
                        effect: {
                            type: 'unlockTower',
                            tower: 'laser',
                        },
                        consequence:
                            'Лазер открыт для следующих миссий раньше срока. Потрачено 100 ресурсов.',
                        cost: {
                            resources: 100,
                        },
                    },
                    {
                        text: 'Сохранить ресурсы',
                        effect: null,
                        consequence: 'Решение принято. Состояние сектора не изменилось.',
                    },
                ],
                timed: true,
                timeLimit: 12,
            },
        },
        {
            wave: 2,
            trigger: 'delay',
            delay: 180,
            dialog: {
                kind: 'full',
                title: 'БЕЖЕНЦЫ ИЗ СОСЕДНЕГО ОТСЕКА',
                text: 'У шлюза ждут 6 шахтёров и 3 военных. Поможем им?',
                choices: [
                    {
                        text: 'Принять',
                        effect: {
                            type: 'addPersonnel',
                            miners: 6,
                            military: 3,
                        },
                        consequence: 'Приняты 6 шахтёров и 3 военных. Потрачено 80 ресурсов.',
                        cost: {
                            resources: 80,
                        },
                    },
                    {
                        text: 'Перенаправить',
                        effect: {
                            type: 'transaction',
                            cost: {},
                            effects: [
                                {
                                    type: 'flag',
                                    name: 'refugees_pending',
                                    value: 1,
                                },
                                {
                                    type: 'flag',
                                    name: 'refugees_miners',
                                    value: 4,
                                },
                                {
                                    type: 'flag',
                                    name: 'refugees_military',
                                    value: 2,
                                },
                                {
                                    type: 'flag',
                                    name: 'refugees_from',
                                    value: 1,
                                },
                            ],
                        },
                        consequence:
                            'В следующем выбранном секторе встретятся 4 шахтёра и 2 военных. Потрачено 30 ресурсов.',
                        cost: {
                            resources: 30,
                        },
                    },
                    {
                        text: 'Отказать',
                        effect: null,
                        consequence: 'Группа покинула шлюз. Ресурсы и персонал не изменились.',
                    },
                ],
                timed: true,
                timeLimit: 12,
            },
            id: 'refugees',
        },
        {
            wave: 3,
            trigger: 'start',
            dialog: {
                kind: 'full',
                title: 'ЭВАКУАЦИЯ ИНЖЕНЕРА',
                text: 'Чен застрял в ремонтном шлюзе. Его знания нужны кораблю.',
                choices: [
                    {
                        text: 'Отправить транспорт',
                        effect: {
                            type: 'transaction',
                            cost: {},
                            effects: [
                                {
                                    type: 'flag',
                                    name: 'engineer_saved',
                                    value: 1,
                                },
                                {
                                    type: 'flag',
                                    name: 'supply_cache',
                                    value: 100,
                                },
                            ],
                        },
                        consequence:
                            'Чен спасён. В следующих секторах доступен запас 100 ресурсов. Сюжет продолжится даже при потере отсека.',
                        cost: {
                            resources: 60,
                        },
                    },
                    {
                        text: 'Удерживать позиции',
                        effect: null,
                        consequence: 'Чен остался в шлюзе. Сюжетная задача не выполнена.',
                    },
                ],
                timed: true,
                timeLimit: 7,
            },
        },
        {
            wave: 3,
            trigger: 'delay',
            delay: 240,
            dialog: {
                kind: 'unknown',
                title: 'НЕИЗВЕСТНЫЙ СИГНАЛ',
                text: 'Поступает зашифрованный запрос на доступ к архиву.',
                choices: [
                    {
                        text: 'Открыть канал',
                        effect: {
                            type: 'flag',
                            name: 'archive_signal',
                            value: 1,
                        },
                        consequence: 'Архив ответил на сигнал.',
                    },
                    {
                        text: 'Отклонить',
                        effect: null,
                        consequence: 'Решение принято. Состояние сектора не изменилось.',
                    },
                ],
                timed: true,
                timeLimit: 10,
            },
        },
    ]

    return level
}
