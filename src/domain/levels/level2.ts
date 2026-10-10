import { Level } from '../model/Level'
export function createLevel2(): Level {
    const level = new Level(
        'level_2',
        'СЕКТОР B-3: ДВОЙНАЯ УГРОЗА',
        'Враги атакуют с двух направлений. Требуется координация.',
        'normal',
    )

    level.width = 1400
    level.height = 800
    level.corridorHeight = 500
    level.livingQuartersY = 500

    level.basePath = [
        { x: 60, y: 180 },
        { x: 150, y: 120 },
        { x: 240, y: 230 },
        { x: 330, y: 140 },
        { x: 430, y: 250 },
        { x: 520, y: 150 },
        { x: 620, y: 260 },
        { x: 710, y: 160 },
        { x: 820, y: 270 },
        { x: 920, y: 170 },
        { x: 1020, y: 260 },
        { x: 1120, y: 190 },
        { x: 1220, y: 280 },
        { x: 1300, y: 210 },
        { x: 1300, y: 550 },
    ]

    level.alternativePaths = [
        [
            { x: 60, y: 340 },
            { x: 160, y: 410 },
            { x: 260, y: 300 },
            { x: 360, y: 390 },
            { x: 460, y: 310 },
            { x: 560, y: 400 },
            { x: 660, y: 320 },
            { x: 760, y: 410 },
            { x: 870, y: 330 },
            { x: 980, y: 420 },
            { x: 1100, y: 360 },
            { x: 1220, y: 430 },
            { x: 1300, y: 360 },
            { x: 1300, y: 550 },
        ],
    ]

    level.corridors = [
        { x: 30, y: 100, width: 1300, height: 150 },
        { x: 30, y: 250, width: 1300, height: 150 },
    ]

    level.spawnPoints = [
        { x: 50, y: 200 },
        { x: 50, y: 350 },
    ]

    level.exitPoints = [{ x: 1300, y: 550 }]

    level.floorBreaches = [
        { x: 445, y: 180, width: 60, height: 40, closed: false, canBeClosed: true },
        { x: 940, y: 195, width: 60, height: 40, closed: false, canBeClosed: true },
    ]

    level.towerSlots = [
        { x: 140, y: 185, type: 'cannon' },
        { x: 275, y: 125, type: 'machinegun' },
        { x: 450, y: 130, type: 'rocket' },
        { x: 600, y: 150, type: 'cannon' },
        { x: 195, y: 300, type: 'machinegun' },
        { x: 350, y: 275, type: 'laser' },
        { x: 510, y: 290, type: 'rocket' },
    ]

    level.barricadeSlots = [
        { x: 220, y: 180, width: 50, height: 50 },
        { x: 370, y: 180, width: 50, height: 50 },
        { x: 520, y: 230, width: 50, height: 50 },
        { x: 670, y: 230, width: 50, height: 50 },
        { x: 180, y: 330, width: 50, height: 50 },
        { x: 330, y: 330, width: 50, height: 50 },
        { x: 480, y: 380, width: 50, height: 50 },
        { x: 400, y: 450, width: 100, height: 40 },
        { x: 900, y: 450, width: 100, height: 40 },
    ]

    level.totalWaves = 5
    level.startingMiners = 15
    level.startingMilitary = 8
    level.startingResources = 300
    level.waveDifficulty = 0.8

    level.objectives = [
        { id: 'survive', text: 'Пережить все волны', completed: false },
        { id: 'close_breach', text: 'Закрыть проломы', completed: false },
        { id: 'upgrade_tower', text: 'Улучшить башню до 2 уровня', completed: false },
    ]

    level.events = [
        {
            wave: 1,
            trigger: 'start',
            dialog: {
                title: 'ТАКТИЧЕСКИЙ ОФИЦЕР',
                text: 'Вторая волна идёт по двум путям! Как распределим силы?',
                choices: [
                    {
                        text: 'Построить больше башен на верхнем пути (+50 ресурсов)',
                        effect: { type: 'resources', value: 50 },
                    },
                    {
                        text: 'Усилить нижний путь (+3 военных)',
                        effect: { type: 'addMilitary', count: 3 },
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
                title: 'МЕДИЦИНСКИЙ ОТСЕК',
                text: 'Группа раненых просит эвакуации через наш сектор. Это рискованно, но они могут помочь.',
                choices: [
                    {
                        text: 'Принять их (+4 шахтёра, +2 военных)',
                        effect: { type: 'addPersonnel', miners: 4, military: 2 },
                    },
                    { text: 'Отказать (сохранить безопасность)', effect: null },
                ],
                timed: true,
                timeLimit: 20,
            },
        },
        {
            wave: 3,
            trigger: 'start',
            dialog: {
                title: 'РАЗВЕДКА',
                text: 'Сканеры показывают крупных существ в следующей волне. Подготовиться?',
                choices: [
                    {
                        text: 'Экстренное улучшение башен (+80 ресурсов)',
                        effect: { type: 'resources', value: 80 },
                    },
                    {
                        text: 'Укрепить позиции (+3 военных)',
                        effect: { type: 'addMilitary', count: 3 },
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
                title: 'ИНЖЕНЕР ПЕТРОВ',
                text: 'Обнаружены аномалии в поведении врагов. Они адаптируются к нашим атакам!',
                choices: [
                    {
                        text: 'Разработать новую тактику (+100 ресурсов)',
                        effect: { type: 'resources', value: 100 },
                    },
                    {
                        text: 'Увеличить численность (+4 военных)',
                        effect: { type: 'addMilitary', count: 4 },
                    },
                ],
                timed: true,
                timeLimit: 15,
            },
        },
    ]

    return level
}
