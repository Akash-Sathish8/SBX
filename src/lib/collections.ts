// Editorial collections for deep-link explore surfaces (?collection= param).
// Each collection is pure filter/sort on real experiences.json data — no invented claims.
import type { Experience } from './data-types'

export interface Collection {
  slug: string
  title: string
  sub: (exps: Experience[]) => string
  pick: (exps: Experience[]) => Experience[]
}

export const COLLECTIONS: Collection[] = [
  {
    slug: 'top-10',
    title: 'Top 10 in America',
    sub: (exps) => {
      const top = exps.find(e => e.rank === 1)
      return top ? `Ten highest-rated · #1 ${top.exp_name}` : 'Ten highest-rated'
    },
    pick: (exps) => exps.filter(e => e.rank <= 10),
  },
  {
    slug: 'historic-ballparks',
    title: 'Historic Ballparks',
    sub: (exps) => `${exps.filter(e => e.league === 'MLB').length} classic MLB venues`,
    pick: (exps) => exps.filter(e => e.league === 'MLB'),
  },
  {
    slug: 'top-cfb',
    title: 'Top College Football',
    sub: (exps) => `${exps.filter(e => e.league === 'CFB').length} CFB experiences`,
    pick: (exps) => exps.filter(e => e.league === 'CFB'),
  },
  {
    slug: 'best-arenas',
    title: 'Best Arenas',
    sub: () => 'NBA + CBB combined',
    pick: (exps) => exps.filter(e => ['NBA', 'CBB'].includes(e.league)),
  },
]

export function collectionBySlug(slug: string): Collection | undefined {
  return COLLECTIONS.find(c => c.slug === slug)
}
