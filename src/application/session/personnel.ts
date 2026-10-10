import { Conversion, Person, type Level, type PersonType, type Random } from '@/domain'

const SPEED: Record<PersonType, number> = { miner: 1.1, military: 1.5 }

// Head counts, their figures in the living quarters and retraining in progress.
export class Personnel {
    miners: number
    military: number
    people: Person[] = []
    conversions: Conversion[] = []

    constructor(
        private readonly level: Level,
        private readonly rng: Random,
        miners: number,
        military: number,
    ) {
        this.miners = 0
        this.military = 0
        this.add('miner', miners)
        this.add('military', military)
    }

    get total(): number {
        return this.miners + this.military
    }

    count(type: PersonType): number {
        return type === 'miner' ? this.miners : this.military
    }

    add(type: PersonType, count: number): void {
        for (let i = 0; i < count; i++) {
            if (type === 'military') this.military++
            else this.miners++
            this.people.push(this.createPerson(type))
        }
    }

    remove(type: PersonType, count: number): number {
        const removed = Math.min(count, this.count(type))
        if (type === 'military') this.military -= removed
        else this.miners -= removed
        for (let i = 0; i < removed; i++) {
            const index = this.people.findIndex((person) => person.alive && person.type === type)
            if (index !== -1) this.people.splice(index, 1)
        }
        return removed
    }

    // A person was killed in the living quarters.
    kill(person: Person): void {
        person.alive = false
        if (person.type === 'miner') this.miners = Math.max(0, this.miners - 1)
        else this.military = Math.max(0, this.military - 1)
    }

    startConversion(from: PersonType, to: PersonType, count: number): string | null {
        if (from === to || count <= 0) return 'Неверный перевод'
        if (this.count(from) < count) {
            return from === 'miner' ? 'Недостаточно шахтёров!' : 'Недостаточно военных!'
        }
        if (from === 'miner') this.miners -= count
        else this.military -= count
        this.conversions.push(new Conversion(from, to, count, this.rng.id('conversion')))
        return null
    }

    // People currently being retrained (not available for work or defence).
    get inTransit(): number {
        return this.conversions.reduce((sum, conversion) => sum + conversion.count, 0)
    }

    updateConversions(dt: number): void {
        for (const conversion of this.conversions) {
            if (!conversion.update(dt)) continue
            if (conversion.toType === 'military') this.military += conversion.count
            else this.miners += conversion.count
            const candidates = this.people.filter(
                (person) => person.alive && person.type === conversion.fromType,
            )
            for (const person of candidates.slice(0, conversion.count)) {
                person.type = conversion.toType
                person.baseSpeed = SPEED[conversion.toType]
                person.speed = person.baseSpeed
            }
        }
        this.conversions = this.conversions.filter((conversion) => !conversion.completed)
    }

    removeDead(): void {
        this.people = this.people.filter((person) => person.alive)
    }

    private createPerson(type: PersonType): Person {
        const { width, livingQuartersY } = this.level
        if (type === 'military') {
            const soldiers = this.people.filter((person) => person.type === 'military').length
            return new Person(type, 50 + soldiers * 30, livingQuartersY + 50, this.rng.id('person'))
        }
        return new Person(
            type,
            100 + this.rng.next() * (width - 200),
            livingQuartersY + 100 + this.rng.next() * 200,
            this.rng.id('person'),
        )
    }
}
