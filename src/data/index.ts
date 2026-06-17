// Typed accessors for the build-time-static datasets. Assigning the imported JSON
// to its interface (rather than `as Game[]`, which asserts nothing) makes a drift
// between the data and the type a COMPILE error HERE — one place — instead of a
// silent `undefined` across the five routes that read it.
import type { FanIntel, Game } from '../lib/data-types'
import gamesJson from './games-index.json'
import fanIntelJson from './fanintel.json'

export const GAMES: Game[] = gamesJson
export const FAN_INTEL: FanIntel = fanIntelJson as FanIntel
