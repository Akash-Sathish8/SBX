// One-off image optimizer for public/ assets (run manually, not in the build —
// repeated runs re-encode already-compressed files and degrade them; originals
// live in git history). Usage:  node scripts/optimize-images.mjs
//
// Each asset is sized + encoded for HOW IT IS ACTUALLY USED:
//   - logo.png        brand mark shown ≤92px (nav 42, share-card 92, touch-icon
//                     180) → 256px lossless PNG (was 900² / 118 KB).
//   - stadium JPGs    venue hero + marquee thumb + OG/social image → 1280px
//                     mozjpeg. They double as og:image, so they stay JPG (social
//                     scrapers don't reliably do WebP) — recompress, don't reformat.
//   - celebration     guide collage background → 1280px mozjpeg.
//   - casey-cutout    ~60px map marker (transparent) → 220px palette PNG.
//   - casey-avatar / snapback-logo → small UI marks, capped + recompressed.
//   - logo192/512     PWA manifest icons → keep required dimensions, recompress.
// A file is only rewritten when the result is actually smaller (no degradation
// of anything already optimal).

import sharp from 'sharp';
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(root, 'public');
const rel = (p) => p.replace(PUBLIC + '/', '');

// Per-use-case rules, first match wins. `width` caps the longest edge for the
// asset's real display size (×~2 for retina); null = keep current dimensions.
const RULES = [
  { test: (p) => p === 'img/logo.png', width: 256, kind: 'png-mark' },
  { test: (p) => p === 'casey-cutout.png', width: 220, kind: 'png-photo' },
  { test: (p) => p === 'snapback-logo.jpeg', width: 256, kind: 'jpeg', q: 82 },
  { test: (p) => p === 'casey-avatar.jpeg', width: 260, kind: 'jpeg', q: 82 },
  { test: (p) => /^logo(192|512)\.png$/.test(p), width: null, kind: 'png-mark' },
  { test: (p) => /^img\/stadiums\/.+\.jpg$/.test(p), width: 1280, kind: 'jpeg', q: 74 },
  { test: (p) => /celebration2?\.jpg$/.test(p), width: 1280, kind: 'jpeg', q: 72 },
  // Fallbacks for anything else.
  { test: (p) => /\.jpe?g$/i.test(p), width: 1600, kind: 'jpeg', q: 75 },
  { test: (p) => /\.png$/i.test(p), width: null, kind: 'png-mark' },
];

async function optimize(path) {
  const r = rel(path);
  const rule = RULES.find((x) => x.test(r));
  if (!rule) return null;

  const input = await readFile(path);
  let pipe = sharp(input, { failOn: 'none' });
  const meta = await pipe.metadata();
  if (rule.width && meta.width && meta.width > rule.width) {
    pipe = pipe.resize({ width: rule.width, withoutEnlargement: true });
  }
  if (rule.kind === 'jpeg') {
    pipe = pipe.jpeg({ quality: rule.q ?? 75, mozjpeg: true, progressive: true });
  } else if (rule.kind === 'png-photo') {
    pipe = pipe.png({ palette: true, quality: 80, effort: 10, compressionLevel: 9 });
  } else {
    pipe = pipe.png({ palette: false, effort: 10, compressionLevel: 9 });
  }

  const out = await pipe.toBuffer();
  const om = await sharp(out).metadata();
  if (out.length < input.length) {
    await writeFile(path, out);
    return { name: r, before: input.length, after: out.length, dim: `${om.width}×${om.height}` };
  }
  return { name: r, before: input.length, after: input.length, skipped: true, dim: `${meta.width}×${meta.height}` };
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const ROOT_FILES = ['casey-cutout.png', 'casey-avatar.jpeg', 'snapback-logo.jpeg', 'logo192.png', 'logo512.png'];
const kb = (n) => (n / 1024).toFixed(0) + 'KB';

const imgFiles = (await walk(join(PUBLIC, 'img'))).filter((p) => /\.(jpe?g|png)$/i.test(p));
const rootFiles = [];
for (const f of ROOT_FILES) {
  try { await stat(join(PUBLIC, f)); rootFiles.push(join(PUBLIC, f)); } catch { /* missing */ }
}

let totalBefore = 0, totalAfter = 0;
for (const path of [...imgFiles, ...rootFiles]) {
  const r = await optimize(path);
  if (!r) continue;
  totalBefore += r.before; totalAfter += r.after;
  console.log(`${r.skipped ? 'skip ' : 'opt  '} ${r.name.padEnd(30)} ${(r.dim || '').padEnd(11)} ${kb(r.before)} -> ${kb(r.after)}`);
}

// WebP siblings for the CSS-referenced collage photos (guide.css pairs each with
// a JPG fallback via image-set). NOT generated for stadium JPGs — those double as
// og:image, and social scrapers don't reliably support WebP.
const WEBP = ['img/celebration.jpg', 'img/celebration2.jpg'];
for (const r of WEBP) {
  const src = join(PUBLIC, r);
  try {
    const buf = await readFile(src);
    const webp = await sharp(buf).webp({ quality: 72 }).toBuffer();
    const out = src.replace(/\.jpe?g$/i, '.webp');
    // Only keep the WebP when it actually beats the JPG — for some busy photos
    // mozjpeg wins, and a larger WebP would be a regression. guide.css only wires
    // image-set() for the ones that win here.
    if (webp.length < buf.length) {
      await writeFile(out, webp);
      console.log(`webp  ${r.padEnd(30)} ${('→ ' + rel(out)).padEnd(24)} ${kb(buf.length)} -> ${kb(webp.length)}`);
    } else {
      console.log(`webp  ${r.padEnd(30)} skip (not smaller: ${kb(webp.length)} ≥ ${kb(buf.length)})`);
    }
  } catch (e) {
    console.log(`webp FAIL ${r}: ${e.message}`);
  }
}

console.log(`\nTotal: ${kb(totalBefore)} -> ${kb(totalAfter)} (${((1 - totalAfter / totalBefore) * 100).toFixed(0)}% smaller)`);
