import * as v from 'valibot'
import data from '@/content/music.json'
import { parseContent, text } from '../content/parse'

const trackId = v.pipe(v.string(), v.regex(/^[a-z0-9-]+$/, 'Track ids are kebab-case'))

const trackSchema = v.strictObject({
    title: text,
    author: text,
    // Where the original recording comes from (for the credits).
    source: v.pipe(v.string(), v.url()),
    // File in public/audio/music.
    file: v.pipe(v.string(), v.regex(/^[a-z0-9-]+\.webm$/)),
})

const soundtrackSchema = v.pipe(
    v.strictObject({
        // Attribution line required by the tracks' license.
        credit: text,
        licenseUrl: v.pipe(v.string(), v.url()),
        // Plays on the menu, the ship map and anywhere outside a level.
        menu: trackId,
        tracks: v.record(trackId, trackSchema),
    }),
    v.check((soundtrack) => soundtrack.menu in soundtrack.tracks, 'The menu track must exist'),
)

export const SOUNDTRACK = parseContent(soundtrackSchema, data, 'content/music.json')

export interface MusicTrack {
    id: string
    title: string
    author: string
    file: string
}

export function musicTrack(id: string): MusicTrack | null {
    const track = SOUNDTRACK.tracks[id]
    return track ? { id, title: track.title, author: track.author, file: track.file } : null
}

export function menuTrack(): MusicTrack {
    return musicTrack(SOUNDTRACK.menu)!
}

export const MUSIC_TRACK_IDS: readonly string[] = Object.keys(SOUNDTRACK.tracks)
