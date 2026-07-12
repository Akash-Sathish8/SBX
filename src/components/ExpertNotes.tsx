import { useEffect, useState } from 'react'

// Snapback's editorial "expert notes" for a venue/game (curated from transcripts).
// Read-only and honest: renders nothing until real notes exist.
type Note = { id: string; section: string; body: string; sourceUrl?: string }

const LABELS: Record<string, string> = {
  'getting-there': 'Getting there',
  'best-seats': 'Best seats',
  food: 'Food',
  before: 'Before the game',
  atmosphere: 'Atmosphere',
  tips: 'Insider tips',
}
const ORDER = ['getting-there', 'best-seats', 'food', 'before', 'atmosphere', 'tips']

export function ExpertNotes({ scope, targetId }: { scope: 'venue' | 'event'; targetId: string }) {
  const [notes, setNotes] = useState<Note[]>([])
  useEffect(() => {
    if (!targetId) return
    let alive = true
    setNotes([])
    fetch('/api/expert-notes?scope=' + scope + '&targetId=' + encodeURIComponent(targetId))
      .then((r) => r.json())
      .then((j) => { if (alive && j?.ok && Array.isArray(j.data)) setNotes(j.data) })
      .catch(() => {})
    return () => { alive = false }
  }, [scope, targetId])

  if (!notes.length) return null
  const groups = ORDER.map((key) => ({ key, label: LABELS[key] || key, items: notes.filter((n) => n.section === key) })).filter((g) => g.items.length)

  return (
    <div className="mb-[26px] font-sans [line-height:normal]">
      <div className="mb-3 flex items-center gap-2 font-display text-[15px] tracking-[.6px] text-[#111] uppercase"><img className="rounded-[4px]" src="/img/logo.png" alt="" width={18} height={18} /> Snapback expert notes</div>
      <div className="grid grid-cols-1 gap-3 min-[620px]:grid-cols-2">
        {groups.map((g) => (
          <div key={g.key} className="rounded-[4px] border-2 border-ink-soft border-l-[6px] border-l-brand bg-white px-3.5 py-3">
            <div className="mb-1.5 text-[12px] font-extrabold tracking-[.4px] text-[#555] uppercase">{g.label}</div>
            <ul className="m-0 list-none p-0">
              {g.items.map((n) => (
                <li key={n.id} className="relative mt-[7px] pl-4 text-[14px] leading-[1.5] text-[#2c2c2c] first:mt-0 before:absolute before:top-[7px] before:left-0 before:h-1.5 before:w-1.5 before:rotate-45 before:border-[1.5px] before:border-[#111] before:bg-brand before:content-['']">
                  {n.body}
                  {/* `!` — the unlayered global `a { color: inherit }` in styles.css beats layered color utilities */}
                  {n.sourceUrl ? <a className="ml-1.5 text-[12px] text-[#888]! hover:text-[#222]!" href={n.sourceUrl} target="_blank" rel="noreferrer" aria-label="source">↗</a> : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
