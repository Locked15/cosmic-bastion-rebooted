export type BarricadeType = 'wall' | 'filter' | 'shield'
export interface BarricadeCatalogEntry {
    name: string
    description: string
    cost: number
    upgradeCosts: [number, number, number]
    benefits: Record<1 | 2 | 3, { name: string; description: string }>
}
export const BARRICADE_MAX_LEVEL = 3
export const BARRICADE_SIZE = 40
export const BARRICADE_CATALOG: Record<BarricadeType, BarricadeCatalogEntry> = {
    wall: {
        name: 'Стена',
        description: 'Блокирует путь',
        cost: 30,
        upgradeCosts: [50, 80, 120],
        benefits: {
            1: {
                name: 'Усиленная обшивка',
                description: 'Прочность увеличена, враги задерживаются дольше',
            },
            2: {
                name: 'Самопочинка',
                description: 'Баррикада постепенно восстанавливает прочность',
            },
            3: {
                name: 'Отбрасывающий барьер',
                description: 'Сильный толчок и урон по врагу при контакте',
            },
        },
    },
    filter: {
        name: 'Фильтр',
        description: 'Пропускает слабых врагов',
        cost: 40,
        upgradeCosts: [60, 100, 150],
        benefits: {
            1: {
                name: 'Коррозийные решётки',
                description: 'Сильнее замедляет врагов и наносит им урон',
            },
            2: {
                name: 'Автоочистка',
                description: 'Фильтр регенерирует и сохраняет высокое замедление',
            },
            3: {
                name: 'Интеллектуальный пропуск',
                description: 'Слабые враги проходят медленно, сильные почти останавливаются',
            },
        },
    },
    shield: {
        name: 'Щит',
        description: 'Очень прочный барьер',
        cost: 80,
        upgradeCosts: [100, 150, 250],
        benefits: {
            1: {
                name: 'Статический регенератор',
                description: 'Барьер быстро восстанавливается после атак',
            },
            2: {
                name: 'Усиленная матрица',
                description: 'Увеличена прочность и сопротивление урону',
            },
            3: {
                name: 'Силовое поле',
                description: 'Ограничивает количество врагов, которые могут атаковать одновременно',
            },
        },
    },
}
