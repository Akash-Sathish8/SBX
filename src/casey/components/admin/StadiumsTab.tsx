import { useRef, useState } from 'react';
import { resizeImageToDataUrl, estimateDataUrlBytes } from '@/lib/image';
import type { Stadium } from '@/lib/types';
import { inputCls, btnCls, btnDimCls } from './ui';

export function StadiumsTab({
  stadiums,
  post,
}: {
  stadiums: Record<string, Stadium>;
  post: (a: string, p: any) => Promise<boolean>;
}) {
  return (
    <div className="max-w-3xl">
      <div className="font-mono text-[10px] tracking-[0.18em] text-snap-mist mb-3 leading-relaxed">
        Upload a photo from your phone, OR paste a direct image URL.
        <br />
        <span className="text-snap-fog">
          For URLs: must be a direct image link (ends in .jpg/.png/.webp), not
          a Wikipedia article page. Right-click the image on the article and
          choose &quot;Copy image address&quot;.
        </span>
      </div>
      <div className="space-y-2">
        {Object.values(stadiums).map((s) => (
          <StadiumRow key={s.id} stadium={s} post={post} />
        ))}
      </div>
    </div>
  );
}

function StadiumRow({
  stadium,
  post,
}: {
  stadium: Stadium;
  post: (a: string, p: any) => Promise<boolean>;
}) {
  const [url, setUrl] = useState(stadium.heroImage ?? '');
  const [processing, setProcessing] = useState(false);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileErr(null);
    setProcessing(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, {
        maxWidth: 1400,
        maxHeight: 900,
        quality: 0.78,
      });
      const bytes = estimateDataUrlBytes(dataUrl);
      // Vercel function body limit is ~4.5 MB. Bail safely before we
      // hit that, since the server-side error message is opaque.
      if (bytes > 3_000_000) {
        setFileErr(
          `image still ${(bytes / 1024 / 1024).toFixed(1)} MB after resize — try a smaller photo`,
        );
        return;
      }
      setUrl(dataUrl);
    } catch (err) {
      setFileErr((err as Error).message);
    } finally {
      setProcessing(false);
      // Reset so the same file can be picked again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const isUrlLikelyBad =
    url.length > 0 &&
    !url.startsWith('data:') &&
    (/\/wiki\//i.test(url) || /#\/media\//i.test(url));

  return (
    <div className="border border-snap-ash bg-snap-coal p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-[16px] text-snap-chalk truncate">
            {stadium.name}
          </div>
          <div className="font-mono text-[10px] text-snap-mist">
            {stadium.city}
            {stadium.state ? `, ${stadium.state}` : ''} · {stadium.country}
          </div>
        </div>
        {url && (
          <img
            src={url}
            alt=""
            className="h-12 w-20 object-cover border border-snap-ash flex-shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
      </div>

      <div className="mt-2 flex gap-2 flex-wrap">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={processing}
          className={btnDimCls + ' disabled:opacity-50'}
        >
          {processing ? 'PROCESSING…' : '↑ UPLOAD PHOTO'}
        </button>
        <button
          type="button"
          onClick={() => {
            setUrl('');
            setFileErr(null);
          }}
          disabled={!url || processing}
          className={btnDimCls + ' disabled:opacity-30'}
        >
          CLEAR
        </button>
        <button
          type="button"
          className={btnCls}
          disabled={processing}
          onClick={() =>
            post('set-stadium-hero', { stadiumId: stadium.id, heroImage: url || '' })
          }
        >
          SAVE
        </button>
      </div>

      <div className="mt-2 flex gap-2">
        <input
          className={`${inputCls} flex-1 font-mono text-[10px]`}
          value={url.startsWith('data:') ? '[uploaded photo — saved on server]' : url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="…or paste https://upload.wikimedia.org/wikipedia/commons/..."
          readOnly={url.startsWith('data:')}
        />
      </div>

      {isUrlLikelyBad && (
        <div className="mt-2 px-2 py-1 bg-live/10 border-l-2 border-live font-mono text-[10px] text-live leading-relaxed">
          that looks like a wikipedia <strong>article</strong> URL — saving it
          won&apos;t show an image. either upload a photo above, or right-click
          the image on wikipedia and choose &quot;copy image address&quot; to get
          the direct link.
        </div>
      )}

      {fileErr && (
        <div className="mt-2 px-2 py-1 bg-live/10 border-l-2 border-live font-mono text-[10px] text-live">
          {fileErr}
        </div>
      )}
    </div>
  );
}

