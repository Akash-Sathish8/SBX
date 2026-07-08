import { useEffect, useLayoutEffect } from 'react'

// Run before paint on the client (prevents a 1-frame flash of a stale page's
// CSS); fall back to useEffect during SSR to avoid the layout-effect warning.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * Per-route CSS hygiene.
 *
 * This app loads each page's CSS as its own <link>, injected via the route's
 * `head.links`. TanStack does NOT remove a route's links when you navigate away
 * client-side, so the stylesheets ACCUMULATE — every page you visit leaves its
 * CSS applied, and later pages get overridden by earlier ones — a page whose CSS
 * carries broad global resets or utility classes can wreck the layout of whatever
 * page you open next.
 *
 * Each route tags its page-specific CSS links with `data-page-css="<id>"` and
 * renders <PageCssGuard id="<id>" />. On mount / navigation this DISABLES any
 * page CSS that doesn't belong to the active route (and re-enables the active
 * route's), so only the current page's styles apply.
 *
 * We toggle `media` rather than removing the <link>: TanStack tracks the head
 * links it injected, so removing one desyncs its state and the stylesheet is
 * never re-created when you navigate back to that route. Disabling via `media`
 * keeps the element in the DOM (TanStack stays in sync) while neutralising it.
 * Global styles (styles.css, fonts) are untagged and left alone.
 */
export function PageCssGuard({ id }: { id: string }) {
  useIsoLayoutEffect(() => {
    const links = Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[data-page-css]'))
    // A stylesheet may belong to MULTIPLE routes (space-separated ids) when it's
    // shared across them — e.g. game.css is used by both /game and /build. Because
    // TanStack dedupes head <link>s by href, the surviving link must carry every
    // route id that uses it, and we match if the active route id is in that list.
    const belongs = (l: HTMLLinkElement) => (l.getAttribute('data-page-css') || '').split(/\s+/).includes(id)
    const mine = links.filter(belongs)
    const others = links.filter((l) => !belongs(l))
    // Enable this route's CSS immediately.
    mine.forEach((l) => { l.media = 'all' })
    const disableOthers = () => others.forEach((l) => { l.media = 'not all' })
    // Disable the previous route's CSS only once THIS route's CSS has actually
    // loaded — otherwise client-side navigation shows a frame with no page CSS at
    // all (the flash of unstyled content). If it's already loaded (preloaded),
    // swap immediately; otherwise wait for the stylesheet to load.
    const pending = mine.filter((l) => !l.sheet)
    if (pending.length === 0) { disableOthers(); return }
    let done = false
    const maybeFinish = () => {
      // Only retire the old page's CSS once EVERY pending sheet has actually
      // arrived. Never disable on a timer or an error: a stale page's styles
      // beat a completely unstyled page (the full-screen-logo FOUC).
      if (!done && pending.every((l) => l.sheet)) { done = true; disableOthers() }
    }
    const onError = (e: Event) => {
      // One retry per link for flaky connections (tunnels, cellular). If it
      // fails again, the previous page's CSS simply stays active.
      const l = e.target as HTMLLinkElement
      if (!l.dataset.cssRetried) { l.dataset.cssRetried = '1'; const href = l.href; l.href = ''; l.href = href }
    }
    pending.forEach((l) => {
      l.addEventListener('load', maybeFinish)
      l.addEventListener('error', onError)
    })
    // Poll as a safety net for load events that raced the listener attach.
    const iv = setInterval(maybeFinish, 250)
    return () => {
      clearInterval(iv)
      pending.forEach((l) => { l.removeEventListener('load', maybeFinish); l.removeEventListener('error', onError) })
    }
  })
  return null
}
