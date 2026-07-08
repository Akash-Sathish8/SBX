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
    <div className="xnotes">
      <div className="xnotes-head"><img className="xnotes-logo" src="/img/logo.png" alt="" width={18} height={18} /> Snapback expert notes</div>
      <div className="xnotes-grid">
        {groups.map((g) => (
          <div key={g.key} className="xnotes-card">
            <div className="xnotes-sec">{g.label}</div>
            <ul className="xnotes-list">
              {g.items.map((n) => (
                <li key={n.id}>
                  {n.body}
                  {n.sourceUrl ? <a className="xnotes-src" href={n.sourceUrl} target="_blank" rel="noreferrer" aria-label="source">↗</a> : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
