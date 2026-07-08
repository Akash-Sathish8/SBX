// Single source of truth for rasterising the matchday-plan ShareCard to a PNG.
// Both export sites (build.tsx, agenda.tsx) call this, so the export-reliability
// fixes live in ONE place and can't drift apart.
import { toPng } from 'html-to-image'
import { getShareFontEmbedCss } from './shareFonts'

let logoCache: Promise<string> | null = null

/**
 * The SnapBack logo as a base64 data URI. html-to-image rasterises the card in an
 * isolated <svg> and must inline every <img> itself by fetching it — a best-effort
 * step it silently drops on failure, which is why the logo vanished from exports.
 * Pre-inlining it as a data URI removes that fetch entirely. Memoised; a failure is
 * not cached so the next export retries.
 */
export function getLogoDataUri(): Promise<string> {
  if (logoCache) return logoCache
  const run = fetch('/img/logo.png')
    .then((r) => { if (!r.ok) throw new Error('logo ' + r.status); return r.blob() })
    .then(
      (b) =>
        new Promise<string>((res, rej) => {
          const fr = new FileReader()
          fr.onload = () => res(fr.result as string)
          fr.onerror = rej
          fr.readAsDataURL(b)
        }),
    )
  logoCache = run
  run.catch(() => { if (logoCache === run) logoCache = null })
  return run
}

/**
 * Rasterise the offscreen full-size ShareCard node (1080×1920) to a PNG Blob.
 * Centralises: real-font layout, logo data-URI inlining, image decode-await, font
 * embedding (Anton/Barlow), and pixelRatio:2 supersampling so small type (the round
 * pill, timeline dots, date chip, labels) stays crisp.
 */
export async function renderShareCardBlob(node: HTMLElement): Promise<Blob> {
  // 1. ensure the live node is laid out with the real fonts before capture
  try { await (document as any).fonts?.ready } catch { /* ignore */ }
  // 2. swap the logo on the (offscreen) export node to a data URI so html-to-image
  //    has nothing to fetch
  try {
    const logo = node.querySelector('img.sc-cap') as HTMLImageElement | null
    if (logo) logo.src = await getLogoDataUri()
  } catch { /* logo stays a path; .sc-cap background keeps it from painting blank */ }
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
    width: 1080,
    height: 1920,
    ...(fontEmbedCSS ? { fontEmbedCSS } : { skipFonts: true }),
  })
  return await (await fetch(url)).blob()
}
