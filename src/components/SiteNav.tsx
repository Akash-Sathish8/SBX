import { useState } from 'react'
import { Link } from '@tanstack/react-router'

// Shared nav for every page — styled entirely with Tailwind utilities (was a set
// of semantic classes styled by each per-route stylesheet). The look is identical
// on every page: dark bar, 4px brand-yellow underline, Anton wordmark.
export function SiteNav({ active }: { active?: 'home' | 'guide' | 'games' | 'venues' | 'casey' }) {
  const [open, setOpen] = useState(false)
  const link = 'no-underline font-bold text-sm uppercase tracking-[0.5px] max-[760px]:px-7 max-[760px]:py-[13px] max-[760px]:text-[15px]'
  const linkColor = (on: boolean) => (on ? 'text-brand-yellow' : 'text-[#cfcfcf]')
  return (
    <header className="sticky top-0 z-50 bg-ink border-b-4 border-brand-yellow">
      <div className="flex items-center justify-between h-[68px] box-border pl-[max(1.75rem,env(safe-area-inset-left))] pr-[max(1.75rem,env(safe-area-inset-right))]">
        <Link
          to="/"
          aria-label="Snapback home"
          className="font-display text-white text-[28px] tracking-[2px] flex items-center gap-3 no-underline"
        >
          {/* Explicit dimensions: logo.png is 900x900, so without these the logo
              would paint full-screen before styles apply. */}
          <img className="h-[42px] w-[42px] block rounded-lg" src="/img/logo.png" alt="Snapback" width={42} height={42} />
          SNAPBACK
          <span className="font-body font-bold text-[10px] tracking-[1px] text-ink bg-brand-yellow px-[7px] py-[2px] rounded-[3px] whitespace-nowrap">
            WC 2026
          </span>
        </Link>
        <nav
          id="navLinks"
          className={
            'flex gap-7 items-center max-[760px]:absolute max-[760px]:top-[68px] max-[760px]:left-0 max-[760px]:right-0 max-[760px]:bg-ink max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-0 max-[760px]:pt-[6px] max-[760px]:pb-[14px] max-[760px]:border-b-4 max-[760px]:border-brand-yellow ' +
            (open ? 'max-[760px]:flex' : 'max-[760px]:hidden')
          }
        >
          <Link to="/" className={`${link} ${linkColor(active === 'home')}`}>Home</Link>
          <Link to="/guide" className={`${link} ${linkColor(active === 'guide')}`}>Guide</Link>
          <Link to="/games" className={`${link} ${linkColor(active === 'games')}`}>Games</Link>
          <Link to="/venues" className={`${link} ${linkColor(active === 'venues')}`}>Venues</Link>
          <Link to="/casey" className={`${link} ${linkColor(active === 'casey')}`}>Casey Tracker</Link>
        </nav>
        <button
          className="hidden max-[760px]:flex flex-col justify-center items-end gap-[5px] w-11 h-11 bg-transparent border-0 cursor-pointer p-0"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="block w-[26px] h-[3px] bg-white rounded-[2px]" />
          <span className="block w-[26px] h-[3px] bg-white rounded-[2px]" />
          <span className="block w-[26px] h-[3px] bg-white rounded-[2px]" />
        </button>
      </div>
    </header>
  )
}
