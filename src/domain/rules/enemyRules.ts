export type EnemySize = 'small' | 'medium' | 'large'
export type EnemyKind = 'simple' | 'ability' | 'miniboss' | 'boss'
export type EnemyAbility =
    | 'split'
    | 'accelerate'
    | 'teleport'
    | 'adaptation'
    | 'sabotage'
    | 'absorb'
    | 'weakImmunity'
    | 'dodge'
    | 'confuse'
    | 'blind'
    | 'destroy'
    | 'spawn'
export interface EnemyStats {
    maxHealth: number
    speed: number
    damage: number
    reward: number
    mass: number
}
export const ENEMY_BASE_STATS: Record<EnemySize, EnemyStats> = {
    small: {
        maxHealth: 30,
        speed: 2.0,
        damage: 1,
        reward: 5,
        mass: 1,
    },
    medium: {
        maxHealth: 60,
        speed: 1.5,
        damage: 2,
        reward: 10,
        mass: 2,
    },
    large: {
        maxHealth: 150,
        speed: 0.8,
        damage: 5,
        reward: 25,
        mass: 5,
    },
}
export const ENEMY_KIND_MODIFIERS: Record<
    EnemyKind,
    { health: number; reward: number; mass: number }
> = {
    simple: { health: 1, reward: 1, mass: 1 },
    ability: { health: 1.5, reward: 1.5, mass: 1 },
    miniboss: { health: 2.5, reward: 3, mass: 2 },
    boss: { health: 12, reward: 10, mass: 5 },
}
export const ABILITY_DESCRIPTIONS: Record<EnemyAbility, string> = {
    split: 'РАССЕИВАНИЕ: При смерти создаёт малых врагов',
    accelerate: 'УСКОРЕНИЕ: Постоянно увеличивает скорость',
    teleport: 'ТЕЛЕПОРТАЦИЯ: Перелетает через башню',
    adaptation: 'АДАПТАЦИЯ: Уязвим только для одной башни',
    sabotage: 'САБОТАЖ: Отключает случайную башню',
    absorb: 'ПОГЛОЩЕНИЕ: Восстанавливает здоровье, убивая врагов',
    weakImmunity: 'ИММУНИТЕТ: Игнорирует урон ниже 0.5% от макс. здоровья',
    dodge: 'УКЛОНЕНИЕ: Уворачивается от снарядов',
    confuse: 'ЗАМЕШАТЕЛЬСТВО: Башни атакуют других врагов',
    blind: 'ОСЛЕПЛЕНИЕ: Башни стреляют по последней позиции',
    destroy: 'УНИЧТОЖЕНИЕ: Может полностью уничтожить башню',
    spawn: 'ГЕНЕРАЦИЯ: Создаёт других врагов',
}
