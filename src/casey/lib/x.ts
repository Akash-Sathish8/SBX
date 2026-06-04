// X (Twitter) API v2 client. Owner-timeline pulls via bearer token.

export interface TweetMedia {
  key: string;
  type: 'photo' | 'video' | 'animated_gif';
  url: string;
}

export interface TweetAuthor {
  id: string;
  username: string;
  name: string;
  profileImageUrl: string | null;
}

export interface Tweet {
  id: string;
  text: string;
  createdAt: string;
  author: TweetAuthor;
  media: TweetMedia[];
  metrics: {
    likes: number;
    replies: number;
    retweets: number;
    quotes: number;
    impressions: number;
  };
  mentions: string[];
  urls: Array<{ url: string; expandedUrl: string; displayUrl: string }>;
  isReply: boolean;
  inReplyToUserId: string | null;
}

interface RawMedia {
  media_key: string;
  type: string;
  url?: string;
  preview_image_url?: string;
}

interface RawUser {
  id: string;
  username: string;
  name: string;
  profile_image_url?: string;
}

interface RawTweet {
  id: string;
  text: string;
  created_at: string;
  author_id?: string;
  in_reply_to_user_id?: string;
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    impression_count?: number;
  };
  attachments?: { media_keys?: string[] };
  entities?: {
    mentions?: Array<{ username: string }>;
    urls?: Array<{ url: string; expanded_url: string; display_url: string }>;
  };
  referenced_tweets?: Array<{ type: string; id: string }>;
}

interface TimelineResponse {
  data?: RawTweet[];
  includes?: {
    users?: RawUser[];
    media?: RawMedia[];
  };
  meta?: {
    result_count?: number;
    newest_id?: string;
    oldest_id?: string;
    next_token?: string;
  };
}

const API_BASE = 'https://api.x.com/2';

function bearer(): string {
  const t = process.env.X_BEARER_TOKEN;
  if (!t) throw new Error('X_BEARER_TOKEN not configured');
  return t;
}

function username(): string {
  return process.env.X_USERNAME || 'csett13';
}

async function xFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${bearer()}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`X API ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

let cachedUserId: string | null = null;
let cachedAuthor: TweetAuthor | null = null;

export async function getCaseyUser(): Promise<TweetAuthor> {
  if (cachedAuthor) return cachedAuthor;
  const data = await xFetch<{ data: RawUser }>(`/users/by/username/${username()}`, {
    'user.fields': 'id,username,name,profile_image_url',
  });
  cachedUserId = data.data.id;
  cachedAuthor = {
    id: data.data.id,
    username: data.data.username,
    name: data.data.name,
    profileImageUrl: data.data.profile_image_url ?? null,
  };
  return cachedAuthor;
}

function normalize(raw: RawTweet, mediaMap: Map<string, TweetMedia>, author: TweetAuthor): Tweet {
  const media: TweetMedia[] = (raw.attachments?.media_keys ?? [])
    .map((k) => mediaMap.get(k))
    .filter((m): m is TweetMedia => !!m);

  return {
    id: raw.id,
    text: raw.text,
    createdAt: raw.created_at,
    author,
    media,
    metrics: {
      likes: raw.public_metrics?.like_count ?? 0,
      replies: raw.public_metrics?.reply_count ?? 0,
      retweets: raw.public_metrics?.retweet_count ?? 0,
      quotes: raw.public_metrics?.quote_count ?? 0,
      impressions: raw.public_metrics?.impression_count ?? 0,
    },
    mentions: (raw.entities?.mentions ?? []).map((m) => m.username),
    urls: (raw.entities?.urls ?? []).map((u) => ({
      url: u.url,
      expandedUrl: u.expanded_url,
      displayUrl: u.display_url,
    })),
    isReply: Boolean(raw.in_reply_to_user_id) || raw.text.startsWith('@'),
    inReplyToUserId: raw.in_reply_to_user_id ?? null,
  };
}

export async function fetchUserTweets(opts: {
  sinceId?: string | null;
  maxResults?: number;
} = {}): Promise<{ tweets: Tweet[]; newestId: string | null }> {
  const author = await getCaseyUser();
  const params: Record<string, string> = {
    max_results: String(opts.maxResults ?? 50),
    'tweet.fields': 'created_at,public_metrics,attachments,entities,in_reply_to_user_id,referenced_tweets',
    expansions: 'attachments.media_keys,author_id',
    'media.fields': 'type,url,preview_image_url',
    'user.fields': 'id,username,name,profile_image_url',
  };
  if (opts.sinceId) params.since_id = opts.sinceId;

  const data = await xFetch<TimelineResponse>(`/users/${author.id}/tweets`, params);

  const mediaMap = new Map<string, TweetMedia>();
  for (const m of data.includes?.media ?? []) {
    const url = m.url ?? m.preview_image_url ?? '';
    if (!url) continue;
    mediaMap.set(m.media_key, {
      key: m.media_key,
      type: (['photo', 'video', 'animated_gif'].includes(m.type) ? m.type : 'photo') as TweetMedia['type'],
      url,
    });
  }

  const tweets = (data.data ?? []).map((raw) => normalize(raw, mediaMap, author));
  return { tweets, newestId: data.meta?.newest_id ?? null };
}
