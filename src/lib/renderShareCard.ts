// Single source of truth for rasterising the matchday-plan ShareCard to a PNG.
// Both export sites (build.tsx, agenda.tsx) call this, so the export-reliability
// fixes live in ONE place and can't drift apart.
import { toPng } from 'html-to-image'
import { getShareFontEmbedCss } from './shareFonts'

const imgCache = new Map<string, Promise<string>>()

/**
 * Any image URL as a base64 data URI. html-to-image rasterises the card in an
 * isolated <svg> and must inline every <img> itself by fetching it — a best-effort
 * step it silently drops on failure, which is why remote logos/photos vanish from
 * exports. Pre-inlining removes that fetch entirely. Memoised per URL; a failure is
 * not cached so the next export retries.
 */
export function getImageDataUri(url: string): Promise<string> {
  const cached = imgCache.get(url)
  if (cached) return cached
  const run = fetch(url)
    .then((r) => { if (!r.ok) throw new Error('img ' + r.status); return r.blob() })
    .then(
      (b) =>
        new Promise<string>((res, rej) => {
          const fr = new FileReader()
          fr.onload = () => res(fr.result as string)
          fr.onerror = rej
          fr.readAsDataURL(b)
        }),
    )
  imgCache.set(url, run)
  run.catch(() => { if (imgCache.get(url) === run) imgCache.delete(url) })
  return run
}

/** The SnapBack logo as a data URI (kept for callers; now a thin wrapper). */
export function getLogoDataUri(): Promise<string> {
  return getImageDataUri('/img/logo.png')
}

/**
 * Rasterise the offscreen full-size ShareCard node to a PNG Blob. Defaults to
 * the 1080×1920 story frame; pass `size` for other formats (1080×1080 square).
 * Centralises: real-font layout, logo data-URI inlining, image decode-await, font
 * embedding (Anton/Barlow), and pixelRatio:2 supersampling so small type (the round
 * pill, timeline dots, date chip, labels) stays crisp.
 */
export async function renderShareCardBlob(node: HTMLElement, size?: { width?: number; height?: number }): Promise<Blob> {
  // 1. ensure the live node is laid out with the real fonts before capture
  try { await (document as any).fonts?.ready } catch { /* ignore */ }
  // 2. inline EVERY image on the (offscreen) export node to a data URI so
  //    html-to-image has nothing to fetch mid-rasterise (remote team logos / ESPN
  //    CDN otherwise silently drop). Best-effort per image — a failed one keeps its
  //    src and simply may not paint, exactly as before.
  await Promise.all(
    Array.from(node.querySelectorAll('img')).map(async (img) => {
      const el = img as HTMLImageElement
      const src = el.getAttribute('src') || ''
      if (!src || src.startsWith('data:')) return
      try { el.src = await getImageDataUri(src) } catch { /* keep original src */ }
    }),
  )
  // 3. make sure every image is actually decoded before serialisation
  await Promise.all(
    Array.from(node.querySelectorAll('img')).map((i) => (i as HTMLImageElement).decode().catch(() => {})),
  )
  // 4. embed Anton/Barlow so the export matches the preview; skipFonts only if the
  //    embed genuinely fails (offline)
  let fontEmbedCSS: string | undefined
  try { fontEmbedCSS = await getShareFontEmbedCss() } catch { fontEmbedCSS = undefined }
  const url = await toPng(node, {
    pixelRatio: 2,
    width: size?.width ?? 1080,
    height: size?.height ?? 1920,
    ...(fontEmbedCSS ? { fontEmbedCSS } : { skipFonts: true }),
  })
  return await (await fetch(url)).blob()
}
