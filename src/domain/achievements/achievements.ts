// Facts about a finished or running level that achievements are judged on.
export interface AchievementFacts {
    killed: number
    activeTowers: number
    military: number
    gathered: number
    personnelLost: number
    victory: boolean
}

export interface AchievementDefinition {
    id: string
    title: string
    description: string
    earned: (facts: AchievementFacts) => boolean
}

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
    {
        id: 'firstBlood',
        title: 'Первая кровь',
        description: 'Уничтожить первого врага',
        earned: (facts) => facts.killed >= 1,
    },
    {
        id: 'builder',
        title: 'Строитель',
        description: 'Иметь 5 активных башен',
        earned: (facts) => facts.activeTowers >= 5,
    },
    {
        id: 'survivor',
        title: 'Выживший',
        description: 'Пройти уровень без потерь',
        earned: (facts) => facts.victory && facts.personnelLost === 0,
    },
    {
        id: 'economist',
        title: 'Экономист',
        description: 'Собрать 1000 ресурсов за уровень',
        earned: (facts) => facts.gathered >= 1000,
    },
    {
        id: 'general',
        title: 'Генерал',
        description: 'Иметь 20+ военных одновременно',
        earned: (facts) => facts.military >= 20,
    },
]

// Achievements earned by `facts` that are not in `unlocked` yet.
export function newAchievements(
    facts: AchievementFacts,
    unlocked: ReadonlySet<string>,
): AchievementDefinition[] {
    return ACHIEVEMENTS.filter(
        (achievement) => !unlocked.has(achievement.id) && achievement.earned(facts),
    )
}
