import { Button } from '@/components/ui/button'

// Inline nudge shown on /rank after a signed-out fan adds a ranking. The cadence
// (first add, then every few) is owned by rank.tsx; this is just the card.
// Self-contained Tailwind (was the .sbx-sp-* block in styles/auth.css).
const card = 'mb-[22px] flex flex-wrap items-center justify-between gap-[16px] rounded-[12px] border-[3px] border-[#111] bg-[#1d1d1f] px-[20px] py-[16px] text-white shadow-[6px_6px_0_0_#F7DF02] max-[520px]:flex-col max-[520px]:items-stretch'
const copy = 'flex min-w-[200px] flex-1 flex-col gap-[3px]'
const actions = 'flex items-center gap-[10px] max-[520px]:justify-between'
const goCls = 'h-auto rounded-[9px] px-[18px] py-[11px] text-[13px] tracking-[.5px] whitespace-nowrap'
const laterCls = 'h-auto p-[8px] text-[13px] font-bold text-[#a9a9ad] hover:bg-transparent hover:text-white'

export function SaveRankingsPrompt({ onCreate, onDismiss }: { onCreate: () => void; onDismiss: () => void }) {
  return (
    <div className={card} role="status">
      <div className={copy}>
        <strong className="font-display text-[18px] uppercase tracking-[.6px]">Save your rankings</strong>
        <span className="font-sans text-[13.5px] font-medium text-[#c9c9cc]">Create a free account so your rankings follow you to any device.</span>
      </div>
      <div className={actions}>
        <Button variant="brand" className={goCls} onClick={onCreate}>Create account</Button>
        <Button variant="ghost" className={laterCls} onClick={onDismiss}>Maybe later</Button>
      </div>
    </div>
  )
}
