import { useState } from 'react'
import { Link } from '@tanstack/react-router'

// Shared nav for every page. The DOM is identical across pages; each page injects
// its own CSS (per-route <link>), so the nav renders with that page's exact styling.
// The Join CTA carries BOTH `btn-navcta` (home page CSS) and `navcta` (subpage CSS);
// only the class defined by the active page's stylesheet has any effect.
export function SiteNav({ active }: { active?: 'home' | 'guide' | 'games' | 'venues' | 'casey' }) {
  const [open, setOpen] = useState(false)
  return (
    <header className="nav">
      <div className="nav-in">
        <Link className="logo" to="/" aria-label="Snapback home">
          {/* Explicit dimensions: logo.png is 900x900, so without these the logo
              paints full-screen during any gap in the per-route CSS swap. */}
          <img className="logo-img" src="/img/logo.png" alt="Snapback" width={42} height={42} />
          SNAPBACK<span className="wc">WC 2026</span>
        </Link>
        <nav className={'nav-links' + (open ? ' open' : '')} id="navLinks">
          <Link to="/" className={active === 'home' ? 'active' : undefined}>Home</Link>
          <Link to="/guide" className={active === 'guide' ? 'active' : undefined}>Guide</Link>
          <Link to="/games" className={active === 'games' ? 'active' : undefined}>Games</Link>
          <Link to="/venues" className={active === 'venues' ? 'active' : undefined}>Venues</Link>
          <Link to="/casey" className={active === 'casey' ? 'active' : undefined}>Casey Tracker</Link>
        </nav>
        <button
          className={'hamburger' + (open ? ' open' : '')}
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span></span><span></span><span></span>
        </button>
      </div>
    </header>
  )
}
