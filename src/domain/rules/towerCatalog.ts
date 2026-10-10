export type TowerType = 'cannon' | 'rocket' | 'machinegun' | 'laser' | 'shock'
export interface TowerCatalogEntry {
    name: string
    description: string
    cost: number
    upgradeCosts: [number, number, number]
    benefits: Record<1 | 2 | 3, { name: string; description: string }>
}
export const TOWER_MAX_LEVEL = 3
export const TOWER_CATALOG: Record<TowerType, TowerCatalogEntry> = {
    cannon: {
        name: 'Пушка',
        description: 'Средний урон и скорость',
        cost: 50,
        upgradeCosts: [75, 100, 150],
        benefits: {
            1: { name: 'Усиленные снаряды', description: 'Урон увеличен до 25 ед.' },
            2: {
                name: 'Быстрая перезарядка',
                description: 'Интервал между залпами снижен до 40 кадров',
            },
            3: { name: 'Залповый режим', description: 'Одновременно поражает до 3 целей' },
        },
    },
    rocket: {
        name: 'Ракетница',
        description: 'Урон по площади',
        cost: 80,
        upgradeCosts: [100, 150, 200],
        benefits: {
            1: { name: 'Осколочные боеголовки', description: 'Урон увеличен до 30 ед.' },
            2: {
                name: 'Усиленные ускорители',
                description: 'Дальность до 150, радиус взрыва до 60 ед.',
            },
            3: { name: 'Шоковая волна', description: 'Отбрасывает поражённых врагов' },
        },
    },
    machinegun: {
        name: 'Пулемёт',
        description: 'Высокая скорострельность',
        cost: 60,
        upgradeCosts: [80, 120, 180],
        benefits: {
            1: { name: 'Синхронные приводы', description: 'Скорострельность повышена на 33%' },
            2: { name: 'Укреплённый калибр', description: 'Урон увеличен до 10 ед.' },
            3: { name: 'Подавляющий огонь', description: 'Замедляет поражённых врагов' },
        },
    },
    laser: {
        name: 'Лазер',
        description: 'Луч на 1 с, перезарядка 5 с',
        cost: 100,
        upgradeCosts: [120, 180, 250],
        benefits: {
            1: { name: 'Фокусировка луча', description: 'Дальность увеличена до 180 ед.' },
            2: { name: 'Охлаждение ядра', description: 'Перезарядка снижена до 4 с' },
            3: {
                name: 'Пробивной импульс',
                description: 'Луч на всю карту по сильнейшему врагу, перезарядка 8 с',
            },
        },
    },
    shock: {
        name: 'Электрошок',
        description: 'Урон всем врагам',
        cost: 120,
        upgradeCosts: [150, 200, 300],
        benefits: {
            1: { name: 'Усиленный разряд', description: 'Урон увеличен до 5 ед.' },
            2: { name: 'Грозовой конденсатор', description: 'Интервал разрядов снижен до 1 с' },
            3: {
                name: 'Импульсное оглушение',
                description: 'Каждые 10 с оглушает группы от 3 врагов на 7 с',
            },
        },
    },
}
