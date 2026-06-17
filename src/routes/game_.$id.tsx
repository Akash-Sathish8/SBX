import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { teamName, teamFlag, teamCode } from '../lib/teams'
import { gameDetailQueryOptions, sanitizeId } from '../lib/queries'
import { absUrl, socialMeta } from '../lib/site'
import { cap, splitSentences } from '../lib/text'
// Build-time-static shared data — bundled so the page server-renders (SEO).
import { GAMES as GAMES_INDEX, FAN_INTEL } from '../data'
import type { Game } from '../lib/data-types'

export const Route = createFileRoute('/game_/$id')({
  // Per-match SEO metadata, rendered server-side from the bundled fixture index.
  head: ({ params }) => {
    const g = GAMES_INDEX.find((x) => x.id === params.id)
    const matchup = g && !g.tbd ? `${teamName(g.home)} vs ${teamName(g.away)}` : g?.round ?? 'Match'
    const where = g ? `${g.venueName}${g.city ? ', ' + g.city : ''}` : ''
    const title = g
      ? `${matchup} — ${g.round}${where ? ' · ' + where : ''} | World Cup 2026 | Snapback`
      : 'World Cup 2026 Match | Snapback'
    const description = g
      ? `${matchup} at ${where}${g.date ? ' on ' + g.date : ''}. Match guide: tickets, getting there, fan intel and supporter marches for FIFA World Cup 2026.`
      : 'FIFA World Cup 2026 match guide: tickets, venue, fan intel.'
    const image = absUrl(g ? `/img/stadiums/${g.venue}.jpg` : '/img/logo.png')
    return {
      links: [
        { rel: 'canonical', href: absUrl(`/game/${params.id}`) },
      ],
      meta: socialMeta({ title, description, image, type: 'article' }),
    }
  },
  component: GamePage,
})

// A march belongs on THIS match's page if it names one of the two teams,
// or if it's a general "every match day" item for the venue.
function marchRelevant(m: any, g: any) {
  if (m.venue !== g.venue) return false
  const hay = ((m.title || '') + ' ' + (m.note || '') + ' ' + (m.when || '')).toLowerCase()
  const teams = [g.home, g.away, teamName(g.home), teamName(g.away)].filter(Boolean).map((s: string) => s.toLowerCase())
  if (teams.some((t: string) => t && hay.indexOf(t) > -1)) return true
  return /every match day|all matches|each match day|match day/.test(hay) && !/match:/.test(hay)
}
const BADGE_LABEL: Record<string, string> = { verified: 'Verified', reported: 'Reported', unverified: 'Unverified' }
const BADGE_VARIANT: Record<string, string> = {
  verified: 'bg-[#e3f6e8] text-[#1f9d4d] border border-[#1f9d4d]',
  reported: 'bg-[#fff7cc] text-[#8a7400] border border-[#caa800]',
  unverified: 'bg-[#eee] text-[#555] border border-[#8a8a8a]',
}
const Badge = ({ k }: { k?: string }) =>
  k && BADGE_LABEL[k] ? (
    <span
      className={
        'inline-block text-[10px] font-extrabold uppercase tracking-[0.4px] px-[7px] py-[2px] rounded-[4px] align-middle whitespace-nowrap ' +
        (BADGE_VARIANT[k] || '')
      }
    >
      {BADGE_LABEL[k]}
    </span>
  ) : null

function Sources({ list }: { list?: any[] }) {
  if (!list || !list.length) return null
  return (
    <div className="fi-src mt-[16px] text-[12px] text-[#888] leading-[1.6]">Sources: {list.map((s: any, i: number) => (
      <span key={i}>{i ? ' · ' : ''}<a href={s.url} target="_blank" rel="noopener" className="text-[#1b6fd6] font-semibold">{s.label}</a></span>
    ))}</div>
  )
}

function GamePage() {
  const { id: rawId } = Route.useParams()
  const id = sanitizeId(rawId)
  // Fixture + fan-intel come from the bundled static data (synchronous → SSR).
  const g = GAMES_INDEX.find((x) => x.id === id) || null
  const fi = FAN_INTEL
  const intel = g && fi.venues ? fi.venues[g.venue] ?? null : null
  const marches = g && fi.marches ? fi.marches.filter((m: any) => marchRelevant(m, g)) : []
  // Optional per-game preview JSON loads client-side (supplementary content).
  const detailQ = useQuery({ ...gameDetailQueryOptions(id), enabled: Boolean(g?.hasDetail) })
  const detail = detailQ.data ?? null

  useEffect(() => {
    if (g) document.title = 'Snapback — ' + (g.tbd ? g.round : teamName(g.home) + ' vs ' + teamName(g.away))
  }, [g])

  return (
    <>
      <SiteNav active="games" />
      <main id="app">{renderBody()}</main>
      <footer>
        <div className="container max-w-[1180px] mx-auto px-[28px]">© 2026 Snapback Sports — World Cup Games. <Link to="/games">← All games</Link></div>
      </footer>
    </>
  )

  function renderBody() {
    if (!id) return <div className="loadwrap py-[80px] text-center text-[#6b6b6b] font-bold uppercase tracking-[1px]">No game selected. <Link to="/games" style={{ color: '#222', textDecoration: 'underline' }}>Back to games →</Link></div>
    if (!g) return <div className="loadwrap py-[80px] text-center text-[#6b6b6b] font-bold uppercase tracking-[1px]">Couldn't find this game. <Link to="/games" style={{ color: '#222', textDecoration: 'underline' }}>Back to games →</Link></div>
    return <GameContent g={g} intel={intel} marches={marches} detail={detail} />
  }
}

function GameContent({ g, intel, marches, detail }: { g: Game; intel: any; marches: any[]; detail: any }) {
  const pre = (detail && detail.preview) || null
  return (
    <>
      {/* HERO */}
      <section className="ghero relative bg-[#222] text-white pt-[clamp(30px,5vw,52px)] pb-[clamp(30px,5vw,46px)] overflow-hidden before:content-[''] before:absolute before:inset-0 before:z-[1] before:[background:radial-gradient(120%_120%_at_50%_0%,rgba(20,20,16,.34)_0%,rgba(20,20,16,.72)_55%,rgba(20,20,16,.9)_100%)]">
        {!g.tbd && teamCode(g.home) && teamCode(g.away) ? (
          <div className="flagbg absolute inset-0 z-0" aria-hidden>
            <div className="fhalf left absolute top-0 bottom-0 w-[62%] bg-cover bg-center opacity-30 [filter:saturate(1.05)] left-0 [-webkit-mask-image:linear-gradient(to_right,#000_42%,transparent_95%)] [mask-image:linear-gradient(to_right,#000_42%,transparent_95%)]" style={{ backgroundImage: `url(https://flagcdn.com/${teamCode(g.home)}.svg)` }} />
            <div className="fhalf right absolute top-0 bottom-0 w-[62%] bg-cover bg-center opacity-30 [filter:saturate(1.05)] right-0 [-webkit-mask-image:linear-gradient(to_left,#000_42%,transparent_95%)] [mask-image:linear-gradient(to_left,#000_42%,transparent_95%)]" style={{ backgroundImage: `url(https://flagcdn.com/${teamCode(g.away)}.svg)` }} />
          </div>
        ) : null}
        <div className="container max-w-[1180px] mx-auto px-[28px] relative z-[2] text-center">
          <div className="ground inline-block font-extrabold text-[12px] tracking-[1.4px] uppercase text-ink bg-brand-yellow px-[13px] py-[6px] rounded-[5px] mb-[clamp(16px,3vw,24px)]">{g.round}</div>
          {g.tbd ? (
            <div className="gmatch grid grid-cols-[1fr_auto_1fr] items-center gap-[clamp(12px,3.5vw,40px)] max-w-[880px] mx-auto max-[560px]:grid-cols-[1fr] max-[560px]:gap-[10px] max-[560px]:max-w-[340px]"><span className="gname tbd col-[1/-1] text-[#9a9a9a] font-display uppercase text-[clamp(28px,5vw,52px)] tracking-[0.5px] leading-[1.02] [text-wrap:balance] max-[560px]:text-[clamp(30px,9vw,40px)]">To be confirmed</span></div>
          ) : (
            <div className="gmatch grid grid-cols-[1fr_auto_1fr] items-center gap-[clamp(12px,3.5vw,40px)] max-w-[880px] mx-auto max-[560px]:grid-cols-[1fr] max-[560px]:gap-[10px] max-[560px]:max-w-[340px]">
              <div className="gteam home flex flex-col items-center gap-[clamp(8px,1.6vw,14px)] min-w-0"><span className="gflag text-[clamp(46px,8.5vw,84px)] leading-none [filter:drop-shadow(0_5px_12px_rgba(0,0,0,0.45))] max-[560px]:text-[clamp(48px,15vw,64px)]">{teamFlag(g.home)}</span><span className="gname font-display uppercase text-white text-[clamp(23px,4.4vw,50px)] tracking-[0.5px] leading-[1.02] [text-wrap:balance] max-[560px]:text-[clamp(26px,8vw,34px)]">{teamName(g.home)}</span></div>
              <span className="gvs flex-none font-display text-ink bg-brand-yellow w-[clamp(40px,6vw,58px)] h-[clamp(40px,6vw,58px)] rounded-full flex items-center justify-center text-[clamp(14px,2vw,21px)] tracking-[0.5px] shadow-[0_6px_18px_rgba(0,0,0,0.35)] max-[560px]:my-[2px] max-[560px]:mx-auto">vs</span>
              <div className="gteam away flex flex-col items-center gap-[clamp(8px,1.6vw,14px)] min-w-0"><span className="gflag text-[clamp(46px,8.5vw,84px)] leading-none [filter:drop-shadow(0_5px_12px_rgba(0,0,0,0.45))] max-[560px]:text-[clamp(48px,15vw,64px)]">{teamFlag(g.away)}</span><span className="gname font-display uppercase text-white text-[clamp(23px,4.4vw,50px)] tracking-[0.5px] leading-[1.02] [text-wrap:balance] max-[560px]:text-[clamp(26px,8vw,34px)]">{teamName(g.away)}</span></div>
            </div>
          )}
          <div className="gmeta mt-[clamp(16px,3vw,22px)] text-[#dcdcdc] font-semibold text-[15px] tracking-[0.3px]">
            {g.date}{g.ko ? ' · ' + g.ko : ''} ·{' '}
            <Link to="/venue/$id" params={{ id: g.venue }} className="glink text-brand-yellow font-bold border-b border-b-[rgba(247,223,2,0.45)] hover:border-b-brand-yellow">{g.venueName}</Link>
            {g.city ? ', ' + g.city : ''}
          </div>
          {g.tbd ? <div className="gunverified mt-[14px] inline-block text-[12px] font-bold uppercase tracking-[0.6px] text-ink bg-[#ffd1d1] px-[11px] py-[5px] rounded-[5px]">Opponents set once the group stage finishes</div> : null}
        </div>
      </section>

      {/* MATCH PREVIEW (only where researched) */}
      {pre && (pre.summary || (pre.storylines && pre.storylines.length)) ? (
        <section className="block tint py-[clamp(34px,5vw,52px)] bg-[#f7f6f2]"><div className="container max-w-[1180px] mx-auto px-[28px]">
          <div className="eyebrow inline-flex items-center gap-[9px] font-extrabold text-[12.5px] tracking-[1.2px] uppercase text-black mb-[11px]">The matchup</div>
          <h2 className="shead font-display text-[clamp(28px,3.6vw,40px)] text-[#222] tracking-[0.5px] mb-[20px] [&:has(+.ssub)]:mb-[7px]">Match preview</h2>
          {pre.summary ? <ul className="fi-points lg list-none m-0 p-0 diamond-bullets">{splitSentences(pre.summary).map((p, i) => <li key={i} className="relative pl-[18px] text-[15.5px] leading-[1.5] text-[#2c2c2c] mt-[9px]">{cap(p)}</li>)}</ul> : null}
          <div className="teamcards grid grid-cols-2 gap-[16px] mt-[20px] max-[760px]:grid-cols-[1fr]">
            <div className="teamcard bg-white border border-[#ececec] rounded-[14px] px-[20px] py-[18px] shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
              <div className="tchead flex items-center gap-[11px] font-display uppercase text-[20px] text-ink tracking-[0.4px] mb-[12px]"><span className="gflag sm text-[26px] filter-none">{teamFlag(g.home)}</span>{teamName(g.home)}</div>
              {pre.homeForm ? <div className="tcrow mt-[10px]"><span className="tclab block text-[11px] font-extrabold uppercase tracking-[0.6px] text-[#9a9a9a] mb-[3px]">Form</span><span className="tcval text-[14px] leading-[1.5] text-[#333]">{pre.homeForm}</span></div> : null}
              {pre.homeKey ? <div className="tcrow mt-[10px]"><span className="tclab block text-[11px] font-extrabold uppercase tracking-[0.6px] text-[#9a9a9a] mb-[3px]">Key player</span><span className="tcval text-[14px] leading-[1.5] text-[#333]">{pre.homeKey}</span></div> : null}
            </div>
            <div className="teamcard bg-white border border-[#ececec] rounded-[14px] px-[20px] py-[18px] shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
              <div className="tchead flex items-center gap-[11px] font-display uppercase text-[20px] text-ink tracking-[0.4px] mb-[12px]"><span className="gflag sm text-[26px] filter-none">{teamFlag(g.away)}</span>{teamName(g.away)}</div>
              {pre.awayForm ? <div className="tcrow mt-[10px]"><span className="tclab block text-[11px] font-extrabold uppercase tracking-[0.6px] text-[#9a9a9a] mb-[3px]">Form</span><span className="tcval text-[14px] leading-[1.5] text-[#333]">{pre.awayForm}</span></div> : null}
              {pre.awayKey ? <div className="tcrow mt-[10px]"><span className="tclab block text-[11px] font-extrabold uppercase tracking-[0.6px] text-[#9a9a9a] mb-[3px]">Key player</span><span className="tcval text-[14px] leading-[1.5] text-[#333]">{pre.awayKey}</span></div> : null}
            </div>
          </div>
          {pre.storylines && pre.storylines.length ? (
            <>
              <h3 className="font-display text-[22px] text-[#222] tracking-[0.5px] mt-[30px] mb-[14px] flex items-center gap-[10px] before:content-[''] before:w-[18px] before:h-[3px] before:bg-brand-yellow">Storylines</h3>
              <ul className="storylines list-none m-0 p-0 diamond-bullets [--db-size:9px] [--db-top:7px]">{pre.storylines.map((s: string, i: number) => <li key={i} className="relative pl-[20px] text-[15px] leading-[1.55] text-[#333] mt-[10px]">{s}</li>)}</ul>
            </>
          ) : null}
          {pre.h2h ? <div className="gnotes mt-[22px] grid gap-[10px]"><div className="gnote flex gap-[14px] items-start bg-white border border-[#eee] rounded-[11px] px-[16px] py-[13px] shadow-[0_6px_18px_rgba(0,0,0,0.04)]"><span className="gnlab basis-[120px] grow-0 shrink-0 text-[11px] font-extrabold uppercase tracking-[0.6px] text-ink bg-brand-yellow rounded-[6px] px-[9px] py-[5px] text-center max-[760px]:basis-[96px]">Head to head</span><span className="gntx text-[14px] leading-[1.55] text-[#333]">{pre.h2h}</span></div></div> : null}
        </div></section>
      ) : null}

      {/* FAN INTEL — how to do THIS match, audited & sourced */}
      {intel ? (
        <section className="block py-[clamp(34px,5vw,52px)] bg-white"><div className="container max-w-[1180px] mx-auto px-[28px]">
          <div className="eyebrow inline-flex items-center gap-[9px] font-extrabold text-[12.5px] tracking-[1.2px] uppercase text-black mb-[11px]">Fan intel · audited &amp; sourced</div>
          <h2 className="shead font-display text-[clamp(28px,3.6vw,40px)] text-[#222] tracking-[0.5px] mb-[20px] [&:has(+.ssub)]:mb-[7px]">Going to {g.tbd ? 'this match' : teamName(g.home) + ' v ' + teamName(g.away)}</h2>
          <div className="fi-legend flex flex-wrap items-center gap-[6px] text-[12px] text-[#777] font-semibold mb-[16px]">
            <Badge k="verified" /> official / multiple sources &nbsp;
            <Badge k="reported" /> single or travel-media &nbsp;
            <Badge k="unverified" /> unconfirmed
          </div>
          <div className="fi-meta text-[14px] text-[#444] font-semibold mb-[18px]">
            {intel.wcName ? <>FIFA venue name: <b>{intel.wcName}</b> · </> : null}
            Capacity {intel.capacity?.text} <Badge k={intel.capacity?.badge} />
          </div>
          <div className="fi-rows grid grid-cols-2 gap-[14px] max-[760px]:grid-cols-[1fr]">
            {(intel.fields || []).filter((f: any) => f.label !== 'Matches').map((f: any, i: number) => (
              <div key={i} className="fi-row bg-white border border-[#ececec] rounded-[12px] px-[16px] py-[14px] shadow-[0_8px_22px_rgba(0,0,0,0.05)]">
                <div className="fi-l text-[11.5px] font-extrabold uppercase tracking-[0.6px] text-ink mb-[6px] flex items-center gap-[8px]">{f.label} <Badge k={f.badge} /></div>
                {f.points && f.points.length
                  ? <ul className="fi-points list-none m-0 p-0 diamond-bullets">{f.points.map((p: string, j: number) => <li key={j} className="relative pl-[18px] text-[14.5px] leading-[1.5] text-[#2c2c2c] mt-[7px] first:mt-0">{cap(p)}</li>)}</ul>
                  : <div className="fi-t text-[14.5px] leading-[1.55] text-[#2c2c2c]">{f.text}</div>}
              </div>
            ))}
          </div>
          <Sources list={intel.sources} />
        </div></section>
      ) : null}

      {/* SUPPORTER MARCHES */}
      {marches && marches.length ? (
        <section className="block tint py-[clamp(34px,5vw,52px)] bg-[#f7f6f2]"><div className="container max-w-[1180px] mx-auto px-[28px]">
          <div className="eyebrow inline-flex items-center gap-[9px] font-extrabold text-[12.5px] tracking-[1.2px] uppercase text-black mb-[11px]">Get there together</div>
          <h2 className="shead font-display text-[clamp(28px,3.6vw,40px)] text-[#222] tracking-[0.5px] mb-[20px] [&:has(+.ssub)]:mb-[7px]">Supporter marches &amp; fan walks</h2>
          <div className="ssub text-[#6b6b6b] font-semibold text-[14px] uppercase tracking-[0.5px] m-0 mb-[22px]">Where fan groups meet and walk in together. Specifics firm up 1–2 weeks before each match.</div>
          <div className="march-grid grid grid-cols-2 gap-[16px] max-[760px]:grid-cols-[1fr]">
            {marches.map((m: any, i: number) => (
              <div key={i} className={'march-card bg-white border border-[#ececec] border-l-[6px] rounded-[12px] px-[17px] py-[15px] shadow-[0_8px_22px_rgba(0,0,0,0.06)] [&_.fi-src]:mt-[10px] [&_.fi-src]:pt-[9px] [&_.fi-src]:border-t [&_.fi-src]:border-[#f0f0f0] ' + (m.badge === 'unverified' ? 'u border-l-[#8a8a8a]' : 'border-l-brand-yellow')}>
                <div className="mc-h flex items-center gap-[8px] flex-wrap font-extrabold text-[15px] text-ink leading-[1.3]"><span className="mc-flag text-[19px]">{m.flag}</span>{m.title} <Badge k={m.badge} /></div>
                {m.when ? <div className="mc-when text-[13px] font-bold text-[#1b6fd6] mt-[8px]">{m.when}</div> : null}
                {m.points && m.points.length
                  ? <ul className="fi-points mc-points list-none m-0 p-0 mt-[9px] diamond-bullets">{m.points.map((p: string, j: number) => <li key={j} className="relative pl-[18px] text-[14.5px] leading-[1.5] text-[#2c2c2c] mt-[7px] first:mt-0">{cap(p)}</li>)}</ul>
                  : <>
                      {m.route ? <div className="mc-route text-[14px] text-[#222] mt-[3px] leading-[1.45]">{m.route}</div> : null}
                      {m.note ? <div className="mc-note text-[13px] text-[#555] mt-[7px] leading-[1.5]">{m.note}</div> : null}
                    </>}
                <Sources list={m.sources} />
              </div>
            ))}
          </div>
        </div></section>
      ) : null}

      {/* BUILD MATCH GUIDE CTA → dedicated builder flow */}
      {!g.tbd ? (
        <section className="block tint py-[clamp(34px,5vw,52px)] bg-[#f7f6f2]"><div className="container max-w-[1180px] mx-auto px-[28px]">
          <div className="eyebrow inline-flex items-center gap-[9px] font-extrabold text-[12.5px] tracking-[1.2px] uppercase text-black mb-[11px]">Make it yours</div>
          <h2 className="shead font-display text-[clamp(28px,3.6vw,40px)] text-[#222] tracking-[0.5px] mb-[20px] [&:has(+.ssub)]:mb-[7px]">Your match guide</h2>
          <div className="ssub text-[#6b6b6b] font-semibold text-[14px] uppercase tracking-[0.5px] m-0 mb-[22px]">A shareable card of your matchday plan</div>
          <Link to="/build" search={{ game: g.id, mode: 'matchup' }} className="guidecta inline-block mt-[24px] font-display uppercase tracking-[0.6px] text-[15px] text-ink bg-brand-yellow rounded-[8px] px-[20px] py-[13px] shadow-[0_8px_22px_rgba(0,0,0,0.1)] hover:[filter:brightness(0.96)]">Build Match Guide →</Link>
        </div></section>
      ) : null}

      {/* CTA */}
      <section className="block endband py-[clamp(34px,5vw,52px)] bg-[#222]"><div className="container max-w-[1180px] mx-auto px-[28px] text-center">
        <Link to="/venue/$id" params={{ id: g.venue }} className="guidecta lg inline-block mt-0 font-display uppercase tracking-[0.6px] text-[16px] text-ink bg-brand-yellow rounded-[8px] px-[24px] py-[15px] shadow-[0_10px_26px_rgba(0,0,0,0.35)] hover:[filter:brightness(0.96)]">Plan the full matchday at {g.venueName} →</Link>
      </div></section>
    </>
  )
}
