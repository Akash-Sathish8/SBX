
import { useEffect, useState } from 'react';
import TweetCard from './TweetCard';
import type { Tweet } from '@/lib/x';

interface Props {
  matchNumber: number;
}

export default function MatchTweets({ matchNumber }: Props) {
  const [tweets, setTweets] = useState<Tweet[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/tweets/${matchNumber}`, { cache: 'no-store' });
        const json = await res.json();
        if (cancelled) return;
        if (json?.ok) setTweets(json.tweets ?? []);
        else setFailed(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matchNumber]);

  const count = tweets?.length ?? 0;

  return (
    <div>
      <div className="font-body text-[10px] font-bold tracking-[0.14em] text-snap-mist uppercase mb-2">
        {tweets === null ? 'loading buzz…' : `${count} ${count === 1 ? 'post' : 'posts'} · bluesky`}
      </div>
      <div className="space-y-2">
        {tweets === null && !failed && (
          <div className="rounded-lg border border-dashed border-snap-ash bg-snap-coal p-3 font-body text-[12px] text-snap-mist text-center">
            loading…
          </div>
        )}
        {failed && (
          <div className="rounded-lg border border-dashed border-snap-ash bg-snap-coal p-3 font-body text-[12px] text-snap-mist text-center">
            couldn&apos;t load posts
          </div>
        )}
        {tweets && tweets.length === 0 && (
          <div className="rounded-lg border border-dashed border-snap-ash bg-snap-coal p-3 font-body text-[12px] text-snap-mist text-center">
            no posts tagged to this match yet
          </div>
        )}
        {tweets?.map((t) => <TweetCard key={t.id} tweet={t} />)}
      </div>
    </div>
  );
}
