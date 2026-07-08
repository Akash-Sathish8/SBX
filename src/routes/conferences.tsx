import { useState, useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import CONFERENCES_DATA from '../../data/conferences.json'
import type { Conference } from '../lib/data-types'

const CONFERENCES = CONFERENCES_DATA as Conference[]

export const Route = createFileRoute('/conferences')({
  validateSearch: (s: Record<string, unknown>) => ({
    sport: (s.sport as string) ?? 'CFB',
  }),
  head: () => ({ meta: [{ title: 'Snapback — Conferences' }] }),
  component: ConferencesPage,
})

function ConferencesPage() {
  const { sport } = Route.useSearch()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return CONFERENCES
      .filter(c => c.sport === sport)
      .filter(c =>
        !term ||
        c.name.toLowerCase().includes(term) ||
        c.members.some(m => m.name.toLowerCase().includes(term))
      )
  }, [sport, search])

  const totalSchools = useMemo(() =>
    filtered.reduce((n, c) => n + c.members.length, 0),
    [filtered]
  )

  return (
    <>
      <SiteNav active="conferences" />

      <section className="grid-overlay bg-[#222] text-white pt-[44px] pb-[38px] relative overflow-hidden">
        <div className="container relative z-[1] max-w-[1180px] mx-auto px-[28px]">
          <div className="eyebrow inline-flex items-center gap-[9px] font-bold text-[13px] tracking-[1.4px] uppercase text-ink bg-brand-yellow px-[13px] py-[6px] rounded-[3px] shadow-[4px_4px_0_#000] mb-[14px]">
            {totalSchools} schools · {filtered.length} conferences
          </div>
          <h1 className="font-display uppercase text-white tracking-[1px] leading-none text-[clamp(44px,6.4vw,84px)]">
            <span className="hl bg-brand-yellow text-ink px-[10px] shadow-[5px_5px_0_#000] inline-block">Conferences</span>
          </h1>

          <div className="flex gap-3 mt-6">
            {(['CFB', 'CBB'] as const).map(s => (
              <Link
                key={s}
                to="/conferences"
                search={{ sport: s }}
                className={`inline-flex items-center border-[3px] border-[#222] rounded-[6px] shadow-[4px_4px_0_#222] px-[14px] py-[8px] font-body font-bold text-[13px] uppercase tracking-[0.4px] no-underline [transition:transform_.1s,box-shadow_.1s,background_.12s] hover:-translate-x-px hover:-translate-y-px ${s === sport ? 'bg-brand-yellow text-ink' : 'bg-white text-ink'}`}
              >
                {s === 'CFB' ? 'Football' : 'Basketball'}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-[46px] bg-[#f4f4f4]">
        <div className="container max-w-[1180px] mx-auto px-[28px]">
          <div className="mb-6">
            <input
              type="search"
              placeholder="Search conferences or schools..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full max-w-[400px] border-[3px] border-[#222] rounded-[6px] shadow-[4px_4px_0_#222] px-4 py-3 font-body text-[15px] bg-white outline-none focus:shadow-[6px_6px_0_#222] [transition:box-shadow_.1s]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(conf => (
              <div
                key={conf.id}
                className="bg-white border-[3px] border-[#222] shadow-[4px_4px_0_#222] rounded-[8px] overflow-hidden"
              >
                <div className="bg-ink text-white px-5 py-4 flex items-center justify-between">
                  <div>
                    <div className="font-display text-[16px] uppercase tracking-[1px]">{conf.name}</div>
                    <div className="font-body text-[11px] text-[#999] mt-0.5">{conf.members.length} schools</div>
                  </div>
                  <span className="font-body font-bold text-[11px] text-ink bg-brand-yellow px-[8px] py-[4px] rounded-[3px]">
                    {conf.abbr}
                  </span>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-1">
                    {conf.members
                      .filter(m => !search.trim() || m.name.toLowerCase().includes(search.toLowerCase()))
                      .map(m => (
                        <Link
                          key={m.id}
                          to="/team/$id"
                          params={{ id: m.id }}
                          className="font-body text-[12px] text-[#444] hover:text-ink no-underline hover:underline truncate py-0.5"
                        >
                          {m.name}
                        </Link>
                      ))
                    }
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="text-[#666] font-body text-[16px]">No conferences match "{search}"</p>
          )}
        </div>
      </section>

      <footer className="bg-black text-[#888] py-[40px] text-[13px]">
        <div className="container max-w-[1180px] mx-auto px-[28px]">
          © 2025 Snapback Sports — Field Guide. <Link to="/" className="text-brand-yellow font-bold">← Home</Link>
        </div>
      </footer>
    </>
  )
}
