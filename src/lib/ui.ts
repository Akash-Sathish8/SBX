// Shared section-chrome class strings — the "block / container / eyebrow / shead"
// scaffolding that nearly every content route used to redeclare locally (the
// `container` gutter was copy-pasted across ~12 files). Import these instead of
// re-typing them; layer per-surface tweaks with cn(). Genuinely divergent variants
// (e.g. venue's muted `text-ink-soft` shead, team's badge-style eyebrow) stay local.
export const container = 'mx-auto px-[clamp(28px,4vw,72px)]'
export const containerWide = 'mx-auto w-full px-[clamp(28px,4vw,72px)]'
export const block = 'bg-white py-[clamp(34px,5vw,52px)]'
export const eyebrow = 'mb-[11px] inline-flex items-center gap-[9px] text-[12.5px] font-extrabold uppercase tracking-[1.2px] text-black'
export const shead = 'mb-[5px] font-display text-[clamp(28px,3.6vw,40px)] leading-none tracking-[.5px] text-[#141410]'
