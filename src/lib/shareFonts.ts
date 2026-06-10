// Builds a self-contained @font-face stylesheet (fonts inlined as base64) for the
// share-card export.
//
// Why this exists: html-to-image renders the card into an isolated <svg> that is
// rasterised in its own context with NO access to the page's Google-loaded Anton/
// Barlow fonts. It also can't read the cross-origin Google Fonts stylesheet's
// cssRules (SecurityError), which is why the export previously ran with
// `skipFonts: true` and fell back to a wide system font — wrecking the layout.
//
// Google's CSS endpoint and gstatic woff2 files both send `Access-Control-Allow-
// Origin: *`, so we can fetch the CSS, fetch each woff2, base64-inline them, and
// hand the result to html-to-image's `fontEmbedCSS` option. The export then
// rasterises with the exact fonts and matches the live preview pixel-for-pixel.

const FONT_CSS_URL =
  'https://fonts.googleapis.com/css2?family=Anton&family=Barlow:wght@400;600;700;800&display=swap';

let cached: Promise<string> | null = null;

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Returns @font-face CSS for Anton + Barlow with every woff2 inlined as a base64
 * data URI. Memoised; a failed attempt is not cached so the next export retries.
 */
export function getShareFontEmbedCss(): Promise<string> {
  if (cached) return cached;
  const run = (async () => {
    const cssText = await fetch(FONT_CSS_URL).then((r) => {
      if (!r.ok) throw new Error(`font css ${r.status}`);
      return r.text();
    });
    const urlRe = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/g;
    const urls = [...new Set([...cssText.matchAll(urlRe)].map((m) => m[1]))];
    const dataUris = new Map<string, string>();
    await Promise.all(
      urls.map(async (u) => {
        const buf = await fetch(u).then((r) => {
          if (!r.ok) throw new Error(`font woff2 ${r.status}`);
          return r.arrayBuffer();
        });
        dataUris.set(u, `data:font/woff2;base64,${arrayBufferToBase64(buf)}`);
      }),
    );
    return cssText.replace(urlRe, (_m, u) => `url(${dataUris.get(u) ?? u})`);
  })();
  cached = run;
  run.catch(() => {
    // Don't cache the rejection — allow a retry on the next export attempt.
    if (cached === run) cached = null;
  });
  return run;
}
