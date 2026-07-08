import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useAuth } from './auth/AuthProvider'

// Shared nav for every page (the FIELD GUIDE home included). A hamburger menu
// on all widths, explore-first: Explore (home), This Weekend, Rankings,
// Following (auth-gated), You, and a sign-in/out control. /venues /games /teams
// are one tap away via the home tiles; demoted pages (/guide /agenda
// /conferences /build) stay reachable by URL only. Styled by the global
// nav.css (.sbxnav*). `active` is accepted for back-compat with existing
// callers; highlighting is driven by the router.
export function SiteNav(_props: { active?: string } = {}) {
  const [open, setOpen] = useState(false)
  const { user, openAuth, logout } = useAuth()
  const close = () => setOpen(false)

  return (
    <header className="sbxnav">
      <div className="sbxnav-in">
        <Link to="/" className="sbxnav-brand" aria-label="Snapback home">
          <img className="sbxnav-logo" src="/img/logo.png" alt="" width={42} height={42} />
          SNAPBACK
        </Link>
        <button
          className={'sbxnav-burger' + (open ? ' open' : '')}
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span></span><span></span><span></span>
        </button>
      </div>

      {open ? <button className="sbxnav-scrim" aria-label="Close menu" onClick={close} /> : null}

      <nav className={'sbxnav-menu' + (open ? ' open' : '')}>
        <Link to="/" activeOptions={{ exact: true }} activeProps={{ className: 'on' }} onClick={close}>Explore</Link>
        <Link to="/weekend" activeProps={{ className: 'on' }} onClick={close}>This Weekend</Link>
        <Link to="/rankings" activeProps={{ className: 'on' }} onClick={close}>Rankings</Link>
        {user ? <Link to="/feed" activeProps={{ className: 'on' }} onClick={close}>Following</Link> : null}
        <Link to="/profile" activeProps={{ className: 'on' }} onClick={close}>You</Link>
        <span className="sbxnav-sep" />
        {user ? (
          <button className="sbxnav-auth" onClick={() => { logout(); close() }}>
            Sign out<img className="sbxnav-authlogo" src="/img/logo.png" alt="" width={22} height={22} />
          </button>
        ) : (
          <button className="sbxnav-auth" onClick={() => { openAuth('signin'); close() }}>
            Sign in<img className="sbxnav-authlogo" src="/img/logo.png" alt="" width={22} height={22} />
          </button>
        )}
      </nav>
    </header>
  )
}
