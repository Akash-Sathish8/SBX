// Editorial collections for the explore surfaces. STRICT rule: a collection may
// only group/filter/sort REAL experiences.json entries — titles are editorial
// voice, but every subtitle number/name is computed from the data, and no
// external factual claims (records, decibels, attendance) are ever added.
import type { Experience } from './experiences'

export interface Collection {
  slug: string
  title: string
  sub: (exps: Experience[]) => string
  pick: (exps: Experience[]) => Experience[]
  image: (exps: Experience[]) => string | undefined
}

export const COLLECTIONS: Collection[] = [
  {
    slug: 'top-10',
    title: 'The Top 10 in America',
    sub: (exps) => {
      const top = exps.find((e) => e.rank === 1)
      return top ? `Our ten highest-rated experiences · #1 ${top.name}` : 'Our ten highest-rated experiences'
    },
    pick: (exps) => exps.filter((e) => e.rank <= 10),
    image: (exps) => exps.filter((e) => e.rank <= 10).find((e) => e.image)?.image,
  },
]

export const collectionBySlug = (slug: string): Collection | undefined =>
  COLLECTIONS.find((c) => c.slug === slug)
