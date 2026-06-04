// Bluesky public search client. Uses the unauthenticated
// public.api.bsky.app endpoint — no auth, no API key, generous rate
// limits, returns posts about a search term across all of Bluesky.
//
// Returned posts are normalized to the existing Tweet shape (from
// lib/x.ts) so the rest of the pipeline (tagger, KV storage, UI
// components) doesn't need to know the source.

import type { Tweet } from './x';

const PUBLIC_BASE = 'https://public.api.bsky.app';

interface BskyImage {
  fullsize?: string;
  thumb?: string;
  alt?: string;
}

interface BskyEmbed {
  $type?: string;
  images?: BskyImage[];
  media?: { images?: BskyImage[] };
  external?: { uri: string; title?: string; description?: string; thumb?: string };
}

interface BskyAuthor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

interface BskyRecord {
  text?: string;
  createdAt?: string;
  reply?: unknown;
  facets?: Array<{ features?: Array<{ $type?: string; uri?: string; tag?: string; did?: string }> }>;
}

interface BskyPost {
  uri: string;
  cid: string;
  author: BskyAuthor;
  record: BskyRecord;
  indexedAt: string;
  embed?: BskyEmbed;
  replyCount?: number;
  repostCount?: number;
  likeCount?: number;
  quoteCount?: number;
}

interface SearchResponse {
  posts?: BskyPost[];
  cursor?: string;
}

function postUriToWebUrl(uri: string, handle: string): string {
  // at://did:plc:.../app.bsky.feed.post/<rkey> → https://bsky.app/profile/<handle>/post/<rkey>
  const rkey = uri.split('/').pop() ?? uri;
  return `https://bsky.app/profile/${handle}/post/${rkey}`;
}

function extractMentions(record: BskyRecord): string[] {
  const out = new Set<string>();
  for (const f of record.facets ?? []) {
    for (const feat of f.features ?? []) {
      if (feat.$type?.includes('mention') && feat.did) out.add(feat.did);
    }
  }
  return Array.from(out);
}

function extractImages(embed?: BskyEmbed): { key: string; type: 'photo'; url: string }[] {
  const imgs: BskyImage[] | undefined = embed?.images ?? embed?.media?.images;
  if (!imgs) return [];
  return imgs
    .map((i, idx) => {
      const url = i.fullsize || i.thumb;
      if (!url) return null;
      return { key: `bsky-${idx}-${url.slice(-12)}`, type: 'photo' as const, url };
    })
    .filter((m): m is { key: string; type: 'photo'; url: string } => m !== null);
}

function extractExternalUrls(
  embed: BskyEmbed | undefined,
  record: BskyRecord,
): Tweet['urls'] {
  const urls: Tweet['urls'] = [];
  if (embed?.external?.uri) {
    urls.push({
      url: embed.external.uri,
      expandedUrl: embed.external.uri,
      displayUrl: embed.external.title ?? embed.external.uri,
    });
  }
  for (const f of record.facets ?? []) {
    for (const feat of f.features ?? []) {
      if (feat.$type?.includes('link') && feat.uri) {
        urls.push({ url: feat.uri, expandedUrl: feat.uri, displayUrl: feat.uri });
      }
    }
  }
  return urls;
}

export function normalizeBlueskyPost(post: BskyPost): Tweet {
  const createdAt = post.record.createdAt || post.indexedAt;
  return {
    id: `bsky:${post.uri}`,
    text: post.record.text ?? '',
    createdAt,
    author: {
      id: post.author.did,
      username: post.author.handle,
      name: post.author.displayName || post.author.handle,
      profileImageUrl: post.author.avatar ?? null,
    },
    media: extractImages(post.embed),
    metrics: {
      likes: post.likeCount ?? 0,
      replies: post.replyCount ?? 0,
      retweets: post.repostCount ?? 0,
      quotes: post.quoteCount ?? 0,
      impressions: 0,
    },
    mentions: extractMentions(post.record),
    urls: extractExternalUrls(post.embed, post.record),
    isReply: Boolean(post.record.reply),
    inReplyToUserId: null,
  };
}

export async function searchBlueskyPosts(
  query: string,
  options: { limit?: number; sort?: 'top' | 'latest'; since?: string } = {},
): Promise<Tweet[]> {
  const limit = Math.min(100, Math.max(1, options.limit ?? 25));
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  if (options.sort) params.set('sort', options.sort);
  if (options.since) params.set('since', options.since);

  const url = `${PUBLIC_BASE}/xrpc/app.bsky.feed.searchPosts?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'casey-tracker/1.1' },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`bluesky search failed ${res.status}: ${await res.text().catch(() => '')}`);
  }
  const data: SearchResponse = await res.json();
  const posts = data.posts ?? [];
  return posts.map(normalizeBlueskyPost);
}

// Public URL of a Bluesky post (used for "open original" links in the UI).
export function blueskyPostUrl(t: Tweet): string {
  // t.id format: "bsky:at://did:plc:.../app.bsky.feed.post/<rkey>"
  if (!t.id.startsWith('bsky:')) return '';
  const uri = t.id.slice('bsky:'.length);
  return postUriToWebUrl(uri, t.author.username);
}

// Heuristic: identify whether a Tweet came from Bluesky vs the X API. The
// existing TweetCard rendering uses x.com profile URLs by default, so we
// branch on this to swap link targets.
export function isBlueskyPost(t: Tweet): boolean {
  return t.id.startsWith('bsky:');
}
