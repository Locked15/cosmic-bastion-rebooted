import type { StatRow } from '../../dto/views'

export const percent = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0)
export const row = (label: string, value: string | number): StatRow => ({
    label,
    value: String(value),
})
