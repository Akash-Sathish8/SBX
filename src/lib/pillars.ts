// The four pillars a fan scores a gameday on (1–10). Shared by the /rank ballot,
// the reusable RatePanel, and the log-a-game button so the rubric — labels and the
// "?" tooltip copy — stays single-source. `stadium` is the column key; it reads as
// "Gameday" to fans.
export const PILLARS = [
  {
    key: 'fans',
    label: 'Fans & atmosphere',
    desc: 'The crowd and the energy. Were fans loud, locked in, and did the building have juice from start to finish?',
  },
  {
    key: 'food',
    label: 'Food & concessions',
    desc: 'What you ate and drank: quality, variety, and whether it was worth the concession-stand prices.',
  },
  {
    key: 'unique',
    label: 'Uniqueness',
    desc: "The stuff you can't get anywhere else: traditions, chants, views, and only-here gameday moments.",
  },
  {
    key: 'stadium',
    label: 'Gameday',
    desc: 'Stadium quality, the city around it, and the game you saw.',
  },
] as const

export type PillarKey = (typeof PILLARS)[number]['key']

// The composite fan score: the mean of the four pillars, rounded to 1 decimal.
export const avgPillars = (r: { fans: number; food: number; unique: number; stadium: number }) =>
  Math.round(((r.fans + r.food + r.unique + r.stadium) / 4) * 10) / 10
