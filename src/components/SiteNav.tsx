import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useAuth } from './auth/AuthProvider'

// Shared nav for every page (the FIELD GUIDE home included). A hamburger menu
// on all widths, explore-first: Explore (home), This Weekend, Rankings,
// Following (auth-gated), You, and a sign-in/out control. /venues /games /teams
// are one tap away via the home tiles; demoted pages (/guide /agenda
// /conferences /build) stay reachable by URL only. Self-contained Tailwind (was
// the global nav.css). `active` is accepted for back-compat with existing
// callers; highlighting is driven by the router.
//
// Anchor colors carry `!` because SiteNav renders on routes whose legacy page
// CSS (still an unlayered `a{color:inherit}`) hasn't converted yet — the bang
// keeps the nav readable there; it's harmless once every page is Tailwind.
const item =
  'flex w-full cursor-pointer items-center rounded-[8px] px-[16px] py-[13px] text-left font-sans text-[15px] font-bold uppercase tracking-[.5px] no-underline hover:bg-[#2e2e2e]'
const menuLink = item + ' !text-[#e7e7e7] hover:!text-[#F7DF02]'

export function SiteNav(_props: { active?: string } = {}) {
  const [open, setOpen] = useState(false)
  const { user, openAuth, logout } = useAuth()
  const close = () => setOpen(false)
  // .sbxnav-burger span — animate the `transform` property (v4 rotate/translate
  // utils touch a different property the legacy transition didn't animate).
  const bar = 'block h-[3px] w-[26px] rounded-[2px] bg-white [transition:transform_.2s,opacity_.2s]'

  return (
    <header className="sticky top-0 z-[200] border-b-[4px] border-[#F7DF02] bg-[#222]">
      <div className="flex h-[68px] items-center justify-between px-[24px]">
        <Link to="/" className="flex items-center gap-[12px] font-display text-[28px] tracking-[2px] !text-white no-underline" aria-label="Snapback home">
          <img className="h-[42px]! w-[42px] rounded-[8px] shadow-[3px_3px_0_0_#000]" src="/img/logo.png" alt="" width={42} height={42} />
          SNAPBACK
        </Link>
        <button
          className="flex h-[46px] w-[46px] cursor-pointer flex-col justify-center gap-[5px] border-0 bg-transparent p-0"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span className={bar + (open ? ' [transform:translateY(8px)_rotate(45deg)]' : '')} />
          <span className={bar + (open ? ' opacity-0' : '')} />
          <span className={bar + (open ? ' [transform:translateY(-8px)_rotate(-45deg)]' : '')} />
        </button>
      </div>

      {open ? <button className="fixed inset-[68px_0_0] z-[190] cursor-default border-0 bg-black/45" aria-label="Close menu" onClick={close} /> : null}

      <nav className={'absolute top-[68px] right-0 z-[200] min-w-[248px] flex-col rounded-[0_0_0_12px] border-[3px] border-t-0 border-[#F7DF02] bg-[#222] p-[8px] shadow-[-6px_8px_0_0_rgba(0,0,0,.3)] max-[560px]:fixed max-[560px]:right-0 max-[560px]:left-0 max-[560px]:min-w-0 max-[560px]:rounded-none max-[560px]:border-r-0 max-[560px]:border-l-0 ' + (open ? 'flex' : 'hidden')}>
        <Link to="/" activeOptions={{ exact: true }} className={menuLink} activeProps={{ className: '!text-[#F7DF02]' }} onClick={close}>Explore</Link>
        <Link to="/weekend" className={menuLink} activeProps={{ className: '!text-[#F7DF02]' }} onClick={close}>This Weekend</Link>
        <Link to="/rankings" className={menuLink} activeProps={{ className: '!text-[#F7DF02]' }} onClick={close}>Rankings</Link>
        {user ? <Link to="/feed" className={menuLink} activeProps={{ className: '!text-[#F7DF02]' }} onClick={close}>Following</Link> : null}
        <Link to="/profile" className={menuLink} activeProps={{ className: '!text-[#F7DF02]' }} onClick={close}>You</Link>
        <span className="mx-[8px] my-[6px] h-[2px] border-0 bg-[#353535]" />
        {user ? (
          <button className={item + ' mt-[2px] border-0 bg-transparent text-white'} onClick={() => { logout(); close() }}>
            Sign out<img className="ml-auto h-[22px]! w-[22px] flex-[0_0_auto] rounded-[6px]" src="/img/logo.png" alt="" width={22} height={22} />
          </button>
        ) : (
          <button className={item + ' mt-[2px] border-0 bg-transparent text-white'} onClick={() => { openAuth('signin'); close() }}>
            Sign in<img className="ml-auto h-[22px]! w-[22px] flex-[0_0_auto] rounded-[6px]" src="/img/logo.png" alt="" width={22} height={22} />
          </button>
        )}
      </nav>
    </header>
  )
}
