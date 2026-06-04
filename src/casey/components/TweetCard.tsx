
import { blueskyPostUrl, isBlueskyPost } from '@/lib/bluesky';
import type { Tweet } from '@/lib/x';

interface Props {
  tweet: Tweet;
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function renderText(tweet: Tweet, fromBluesky: boolean) {
  let text = tweet.text;
  // Strip trailing media t.co URLs (the same media is rendered below).
  for (const u of tweet.urls) {
    if (u.expandedUrl?.includes('/photo/') || u.expandedUrl?.includes('/video/')) {
      text = text.replace(u.url, '').trim();
    }
  }

  const parts: Array<{ type: 'text' | 'link' | 'mention' | 'hashtag'; value: string; href?: string }> = [];
  const pattern = /(https?:\/\/\S+)|(@\w+)|(#\w+)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push({ type: 'text', value: text.slice(lastIndex, m.index) });
    if (m[1]) {
      const matched = tweet.urls.find((u) => u.url === m![1]);
      parts.push({
        type: 'link',
        value: matched?.displayUrl ?? m[1],
        href: matched?.expandedUrl ?? m[1],
      });
    } else if (m[2]) {
      parts.push({
        type: 'mention',
        value: m[2],
        href: fromBluesky
          ? `https://bsky.app/profile/${m[2].slice(1)}`
          : `https://x.com/${m[2].slice(1)}`,
      });
    } else if (m[3]) {
      parts.push({
        type: 'hashtag',
        value: m[3],
        href: fromBluesky
          ? `https://bsky.app/hashtag/${m[3].slice(1)}`
          : `https://x.com/hashtag/${m[3].slice(1)}`,
      });
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) parts.push({ type: 'text', value: text.slice(lastIndex) });

  return (
    <>
      {parts.map((p, i) => {
        if (p.type === 'text') return <span key={i}>{p.value}</span>;
        return (
          <a
            key={i}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-snap-chalk underline underline-offset-2 hover:text-[#8A6D00]"
            onClick={(e) => e.stopPropagation()}
          >
            {p.value}
          </a>
        );
      })}
    </>
  );
}

export default function TweetCard({ tweet }: Props) {
  const fromBluesky = isBlueskyPost(tweet);
  const tweetUrl = fromBluesky
    ? blueskyPostUrl(tweet)
    : `https://x.com/${tweet.author.username}/status/${tweet.id}`;
  const profileBase = fromBluesky
    ? `https://bsky.app/profile/${tweet.author.username}`
    : `https://x.com/${tweet.author.username}`;
  const hasPhotos = tweet.media.some((m) => m.type === 'photo');
  const hasVideo = tweet.media.some((m) => m.type === 'video' || m.type === 'animated_gif');
  void profileBase; // reserved for future profile-link use

  return (
    <a
      href={tweetUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-snap-ash bg-white p-3 hover:border-snap-chalk transition-colors"
    >
      <div className="flex items-start gap-2.5">
        {tweet.author.profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tweet.author.profileImageUrl.replace('_normal', '_bigger')}
            alt=""
            className="h-10 w-10 rounded-full flex-shrink-0"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-snap-coal flex-shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[13px]">
            <span className="font-bold text-snap-chalk truncate">{tweet.author.name}</span>
            <span className="text-snap-fog truncate">@{tweet.author.username}</span>
            <span className="text-snap-fog">·</span>
            <span className="text-snap-fog flex-shrink-0">{relativeTime(tweet.createdAt)}</span>
            <svg viewBox="0 0 24 24" className="h-4 w-4 ml-auto text-snap-chalk fill-current flex-shrink-0" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </div>
          <div className="mt-1 text-[14px] text-snap-chalk leading-snug whitespace-pre-wrap break-words">
            {renderText(tweet, fromBluesky)}
          </div>

          {tweet.media.length > 0 && (
            <div
              className={`mt-2.5 grid gap-1 overflow-hidden rounded-lg border border-snap-ash ${
                tweet.media.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
              }`}
            >
              {tweet.media.slice(0, 4).map((m) => (
                <div key={m.key} className="relative aspect-video bg-snap-coal">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.url}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  {(m.type === 'video' || m.type === 'animated_gif') && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <div className="h-10 w-10 rounded-full bg-white/90 flex items-center justify-center shadow-md">
                        <svg viewBox="0 0 10 10" className="h-4 w-4 fill-snap-chalk ml-0.5">
                          <path d="M2 1 L9 5 L2 9 Z" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-center gap-4 text-[11px] text-snap-mist">
            {tweet.metrics.replies > 0 && <span>💬 {fmtCount(tweet.metrics.replies)}</span>}
            {tweet.metrics.retweets > 0 && <span>🔁 {fmtCount(tweet.metrics.retweets)}</span>}
            {tweet.metrics.likes > 0 && <span>❤ {fmtCount(tweet.metrics.likes)}</span>}
            {tweet.metrics.impressions > 0 && <span>👁 {fmtCount(tweet.metrics.impressions)}</span>}
          </div>
        </div>
      </div>
    </a>
  );
}
