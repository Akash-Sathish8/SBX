import { useState, useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { collectionBySlug, COLLECTIONS } from '../lib/collections'
import EXPERIENCES_DATA from '../../data/experiences.json'
import type { Experience, League } from '../lib/data-types'

const ALL: Experience[] = EXPERIENCES_DATA as Experience[]
const LEAGUES: League[] = ['NFL', 'MLB', 'NBA', 'NHL', 'CFB', 'CBB']

export const Route = createFileRoute('/rankings')({
  validateSearch: (s: Record<string, unknown>) => ({
    league: (s.league as string) ?? '',
    q: (s.q as string) ?? '',
    collection: typeof s.collection === 'string' && collectionBySlug(s.collection) ? s.collection : '',
  }),
  head: () => ({ meta: [{ title: 'Snapback Field Guide — Rankings' }] }),
  component: RankingsPage,
})

function ScoreBar({ value, max = 10 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-[6px] bg-[#e8e8e8] rounded-full overflow-hidden">
        <div className="h-full bg-brand-yellow rounded-full" style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span className="font-body font-bold text-[12px] text-ink w-[26px] text-right">{value.toFixed(1)}</span>
    </div>
  )
}

function RankingsPage() {
  const { league, q, collection } = Route.useSearch()
  const col = collection ? collectionBySlug(collection) : undefined
  const [localQ, setLocalQ] = useState(q)

  const filtered = useMemo(() => {
    const base = col ? col.pick(ALL) : ALL
    let list = league ? base.filter(e => e.league === league) : base
    const term = localQ.trim().toLowerCase()
    if (term) {
      list = list.filter(e =>
        e.venue_name.toLowerCase().includes(term) ||
        e.exp_name.toLowerCase().includes(term) ||
        e.league.toLowerCase().includes(term),
      )
    }
    return list.sort((a, b) => a.rank - b.rank)
  }, [league, localQ, col])

  return (
    <>
      <SiteNav active="rankings" />

      {/* Header */}
      <section className="bg-[#222] text-white pt-[44px] pb-[38px] relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center opacity-10" style={{ backgroundImage: "url('/img/celebration2.jpg')" }} aria-hidden="true" />
        <div className="container relative z-[1] max-w-[1180px] mx-auto px-[28px]">
          <div className="inline-flex items-center gap-[9px] font-bold text-[12px] tracking-[1.4px] uppercase text-ink bg-brand-yellow px-[13px] py-[6px] rounded-[3px] shadow-[4px_4px_0_#000] mb-[14px]">
            Expert-rated · {ALL.length} US experiences
          </div>
          <h1 className="font-display uppercase text-white tracking-[1px] leading-none text-[clamp(44px,6.4vw,84px)]">
            Top ranked <span className="bg-brand-yellow text-ink px-[10px] shadow-[5px_5px_0_#000] inline-block">in America</span>
          </h1>
          <p className="text-[#d6d6d6] text-[16px] mt-[14px] leading-[1.5] max-w-[540px]">
            Every US sports experience scored on fans, food, uniqueness, and the stadium. Been to one?{' '}
            <Link to="/rank" className="text-brand-yellow font-bold underline">Log a game →</Link>
          </p>

          {col ? (
            <div className="mt-4 inline-flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full">
              <span className="font-body text-[13px] text-white">Collection: <b>{col.title}</b></span>
              <Link
                to="/rankings"
                search={{ league, q: localQ, collection: '' }}
                className="text-[#bbb] hover:text-white font-bold text-[14px] no-underline [transition:color_.1s]"
                aria-label="Clear collection"
              >
                ✕
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section className="py-[46px] bg-[#f4f4f4]">
        <div className="container max-w-[1180px] mx-auto px-[28px]">

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-5 items-center">
            <input
              type="search"
              placeholder="Search experiences..."
              value={localQ}
              onChange={e => setLocalQ(e.target.value)}
              className="border-[3px] border-[#222] rounded-[6px] shadow-[4px_4px_0_#222] px-4 py-2.5 font-body text-[14px] bg-white outline-none w-[240px] focus:shadow-[6px_6px_0_#222] [transition:box-shadow_.1s]"
            />
            {[{ label: 'All', value: '' }, ...LEAGUES.map(l => ({ label: l, value: l }))].map(opt => (
              <Link
                key={opt.value}
                to="/rankings"
                search={{ league: opt.value, q: localQ, collection }}
                className={`inline-flex items-center border-[3px] border-[#222] rounded-[6px] shadow-[4px_4px_0_#222] px-[12px] py-[6px] font-body font-bold text-[12px] uppercase tracking-[0.4px] no-underline [transition:transform_.1s,box-shadow_.1s,background_.12s] hover:-translate-x-px hover:-translate-y-px ${opt.value === league ? 'bg-brand-yellow text-ink' : 'bg-white text-ink'}`}
              >
                {opt.label}
              </Link>
            ))}
          </div>

          {/* Collection chips */}
          <div className="flex gap-3 mb-6 flex-wrap">
            {COLLECTIONS.map(c => (
              <Link
                key={c.slug}
                to="/rankings"
                search={{ league, q: localQ, collection: collection === c.slug ? '' : c.slug }}
                className={`inline-flex items-center gap-1 border-[2px] border-[#999] rounded-full px-[12px] py-[4px] font-body text-[12px] no-underline [transition:background_.1s] hover:border-ink ${collection === c.slug ? 'bg-ink text-white border-ink' : 'bg-white text-[#444]'}`}
              >
                {c.title}
              </Link>
            ))}
          </div>

          <div className="text-[#666] font-body text-[13px] mb-4">{filtered.length} experience{filtered.length !== 1 ? 's' : ''}</div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white border-[3px] border-[#222] shadow-[4px_4px_0_#222] rounded-[8px] overflow-hidden">
              <thead>
                <tr className="bg-ink text-white text-left">
                  <th className="font-display text-[11px] tracking-[1px] uppercase px-4 py-3 w-[52px]">#</th>
                  <th className="font-display text-[11px] tracking-[1px] uppercase px-4 py-3">Experience</th>
                  <th className="font-display text-[11px] tracking-[1px] uppercase px-4 py-3 hidden md:table-cell">League</th>
                  <th className="font-display text-[11px] tracking-[1px] uppercase px-4 py-3 hidden lg:table-cell w-[120px]">Fans</th>
                  <th className="font-display text-[11px] tracking-[1px] uppercase px-4 py-3 hidden lg:table-cell w-[120px]">Food</th>
                  <th className="font-display text-[11px] tracking-[1px] uppercase px-4 py-3 hidden lg:table-cell w-[120px]">Unique</th>
                  <th className="font-display text-[11px] tracking-[1px] uppercase px-4 py-3 hidden lg:table-cell w-[120px]">Stadium</th>
                  <th className="font-display text-[11px] tracking-[1px] uppercase px-4 py-3 w-[70px] text-center">Score</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr
                    key={e.id}
                    className={`border-t border-[#e8e8e8] [transition:background_.1s] hover:bg-[#fffde0] ${i % 2 === 0 ? '' : 'bg-[#fafafa]'}`}
                  >
                    <td className="px-4 py-3 font-display text-[20px] text-[#bbb]">{e.rank}</td>
                    <td className="px-4 py-3">
                      <Link to="/venue/$id" params={{ id: e.venue_id }} className="no-underline flex items-center gap-3">
                        {e.image ? (
                          <img src={e.image} alt={e.venue_name} className="w-[48px] h-[36px] object-cover rounded shrink-0 hidden sm:block" loading="lazy" />
                        ) : (
                          <div className="w-[48px] h-[36px] bg-[#e8e8e8] rounded shrink-0 hidden sm:block" />
                        )}
                        <div>
                          <div className="font-body font-bold text-[14px] text-ink hover:text-brand-yellow [transition:color_.1s]">{e.exp_name}</div>
                          <div className="font-body text-[12px] text-[#666]">{e.venue_name}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="inline-block bg-[#f0f0f0] text-[#444] font-body font-bold text-[11px] px-2 py-1 rounded uppercase tracking-[0.5px]">{e.league}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell"><ScoreBar value={e.fans} /></td>
                    <td className="px-4 py-3 hidden lg:table-cell"><ScoreBar value={e.food} /></td>
                    <td className="px-4 py-3 hidden lg:table-cell"><ScoreBar value={e.unique} /></td>
                    <td className="px-4 py-3 hidden lg:table-cell"><ScoreBar value={e.stadium} /></td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-display text-[22px] text-ink">{e.final.toFixed(1)}</span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center font-body text-[14px] text-[#999]">
                      No experiences match your filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <footer className="bg-black text-[#888] py-[40px] text-[13px]">
        <div className="container max-w-[1180px] mx-auto px-[28px] flex items-center justify-between flex-wrap gap-4">
          <span>© 2025 Snapback Sports — Expert Rankings</span>
          <div className="flex gap-5">
            <Link to="/rank" className="text-brand-yellow font-bold no-underline">Log a game →</Link>
            <Link to="/" className="text-[#666] no-underline hover:text-brand-yellow">← Home</Link>
          </div>
        </div>
      </footer>
    </>
  )
}
