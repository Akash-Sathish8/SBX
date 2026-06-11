export interface ShareMatchOpts {
  matchNumber: number;
  matchName: string;
  stadium: string;
}

export async function shareMatch({
  matchNumber,
  matchName,
  stadium,
}: ShareMatchOpts): Promise<'shared' | 'copied' | 'failed'> {
  const shareUrl = `${window.location.origin}/casey/match/${matchNumber}`;
  const text = `Watching ${matchName} at ${stadium} with Casey · @snapbacksports`;

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Casey Tracker', text, url: shareUrl });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'failed';
    }
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(shareUrl);
      return 'copied';
    } catch {
      return 'failed';
    }
  }

  return 'failed';
}

export async function shareTracker(): Promise<'shared' | 'copied' | 'failed'> {
  const shareUrl = window.location.origin;
  const text =
    'Casey is at every 2026 World Cup match · 34 games · 40 days · @snapbacksports';

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Casey Tracker', text, url: shareUrl });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'failed';
    }
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(shareUrl);
      return 'copied';
    } catch {
      return 'failed';
    }
  }

  return 'failed';
}
