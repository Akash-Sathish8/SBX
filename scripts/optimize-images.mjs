// One-off image optimizer for public/ assets (run manually, not in the build —
// repeated runs re-encode already-compressed files and degrade them; originals
// live in git history). Usage:  node scripts/optimize-images.mjs
//
// JPEGs  -> capped at 1600px wide, re-encoded with mozjpeg (progressive).
// Photos PNGs (casey-cutout) -> palette-quantized PNG (big win, visually fine).
// Logos/icon PNGs -> lossless recompress only (preserve brand fidelity).
// Each file is only rewritten if the result is actually smaller.

import sharp from 'sharp';
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, basename } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(root, 'public');

const MAX_JPEG_WIDTH = 1600;
const JPEG_QUALITY = 75;

// PNGs that are photographic (safe to quantize) vs brand marks (lossless only).
const QUANTIZE_PNG = new Set(['casey-cutout.png']);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

async function optimize(path) {
  const ext = extname(path).toLowerCase();
  const name = basename(path);
  const input = await readFile(path);
  let pipeline = sharp(input, { failOn: 'none' });

  if (ext === '.jpg' || ext === '.jpeg') {
    const meta = await pipeline.metadata();
    if (meta.width && meta.width > MAX_JPEG_WIDTH) {
      pipeline = pipeline.resize({ width: MAX_JPEG_WIDTH, withoutEnlargement: true });
    }
    pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true, progressive: true });
  } else if (ext === '.png') {
    pipeline = QUANTIZE_PNG.has(name)
      ? pipeline.png({ palette: true, quality: 80, effort: 10, compressionLevel: 9 })
      : pipeline.png({ palette: false, effort: 10, compressionLevel: 9 });
  } else {
    return null; // leave svg/ico/webp/etc. alone
  }

  const out = await pipeline.toBuffer();
  if (out.length < input.length) {
    await writeFile(path, out);
    return { name: path.replace(PUBLIC + '/', ''), before: input.length, after: out.length };
  }
  return { name: path.replace(PUBLIC + '/', ''), before: input.length, after: input.length, skipped: true };
}

const ROOT_FILES = [
  'casey-cutout.png',
  'casey-avatar.jpeg',
  'snapback-logo.jpeg',
  'logo192.png',
  'logo512.png',
];

const kb = (n) => (n / 1024).toFixed(0) + 'KB';

const imgFiles = (await walk(join(PUBLIC, 'img'))).filter((p) =>
  /\.(jpe?g|png)$/i.test(p),
);
const rootFiles = [];
for (const f of ROOT_FILES) {
  try {
    await stat(join(PUBLIC, f));
    rootFiles.push(join(PUBLIC, f));
  } catch {
    /* missing — skip */
  }
}

let totalBefore = 0;
let totalAfter = 0;
for (const path of [...imgFiles, ...rootFiles]) {
  const r = await optimize(path);
  if (!r) continue;
  totalBefore += r.before;
  totalAfter += r.after;
  console.log(
    `${r.skipped ? 'skip ' : 'opt  '} ${r.name.padEnd(34)} ${kb(r.before)} -> ${kb(r.after)}`,
  );
}
console.log(
  `\nTotal: ${kb(totalBefore)} -> ${kb(totalAfter)} (${(
    (1 - totalAfter / totalBefore) *
    100
  ).toFixed(0)}% smaller)`,
);
