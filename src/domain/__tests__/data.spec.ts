import { describe, it, expect } from 'vitest'
import { TOWER_CATALOG, createTower, Tower, BARRICADE_CATALOG, Barricade } from '../index'
import type { TowerType, BarricadeType } from '../index'

describe('catalogs', () => {
    it('describes and constructs all five positioned tower types', () => {
        expect(Object.keys(TOWER_CATALOG)).toHaveLength(5)
        for (const type of Object.keys(TOWER_CATALOG) as TowerType[]) {
            const data = TOWER_CATALOG[type]
            expect(data.name.length).toBeGreaterThan(0)
            expect(data.description.length).toBeGreaterThan(0)
            expect(data.cost).toBeGreaterThan(0)
            expect(data.upgradeCosts).toHaveLength(3)
            expect(Object.keys(data.benefits)).toHaveLength(3)
            const tower = createTower(type, 123, 234, type)
            expect(tower).toBeInstanceOf(Tower)
            expect(tower.x).toBe(123)
            expect(tower.y).toBe(234)
            expect(tower.active).toBe(true)
        }
    })
    it('constructs every barricade with positive health', () => {
        expect(Object.keys(BARRICADE_CATALOG)).toHaveLength(3)
        for (const type of Object.keys(BARRICADE_CATALOG) as BarricadeType[]) {
            const barricade = new Barricade(type, 123, 234, 40, 20, type)
            expect(barricade).toBeInstanceOf(Barricade)
            expect(barricade.maxHealth).toBeGreaterThan(0)
            expect(BARRICADE_CATALOG[type].upgradeCosts).toHaveLength(3)
        }
    })
})
