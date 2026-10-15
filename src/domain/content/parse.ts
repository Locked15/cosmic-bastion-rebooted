import * as v from 'valibot'

// Content files are data; a mistake in one must fail loudly with the path to the bad value.
export function parseContent<TSchema extends v.GenericSchema>(
    schema: TSchema,
    data: unknown,
    source: string,
): v.InferOutput<TSchema> {
    const result = v.safeParse(schema, data)
    if (result.success) return result.output
    throw new Error(`Invalid content in ${source}:\n${v.summarize(result.issues)}`)
}

// An object with exactly one entry for every key in `keys`.
export function recordOf<const K extends string, TSchema extends v.GenericSchema>(
    keys: readonly K[],
    schema: TSchema,
): v.GenericSchema<unknown, Record<K, v.InferOutput<TSchema>>> {
    return v.strictObject(
        Object.fromEntries(keys.map((key) => [key, schema])) as Record<K, TSchema>,
    ) as unknown as v.GenericSchema<unknown, Record<K, v.InferOutput<TSchema>>>
}

export const count = v.pipe(v.number(), v.integer(), v.minValue(0))
export const positive = v.pipe(v.number(), v.minValue(0))
export const text = v.pipe(v.string(), v.nonEmpty())
export const point = v.strictObject({ x: v.number(), y: v.number() })
export const rect = v.strictObject({
    x: v.number(),
    y: v.number(),
    width: positive,
    height: positive,
})
