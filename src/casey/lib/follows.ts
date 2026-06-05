// Localstorage-backed "follow a team" state. No account, no backend —
// just per-device persistence. Used by the FollowStar toggle, the
// Casey's Schedule STARRED filter, and the per-team visual highlights
// across match cards / bracket / groups.

import { useEffect, useState, useCallback } from 'react';

const KEY = 'casey-tracker-followed-teams-v1';
// Custom event used to sync state across components in the same tab
// without re-reading localStorage. Storage events only fire across
// tabs, not within the same tab.
const SAME_TAB_EVENT = 'casey-follows-changed';

function read(): Set<string> {
  try {
    if (typeof window === 'undefined') return new Set();
    const raw = window.localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function write(set: Set<string>): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(KEY, JSON.stringify([...set]));
    window.dispatchEvent(new CustomEvent(SAME_TAB_EVENT));
  } catch {
    // ignore quota / private-mode errors
  }
}

export interface FollowsApi {
  follows: Set<string>;
  isFollowing: (team: string) => boolean;
  toggle: (team: string) => void;
  clear: () => void;
  count: number;
}

export function useFollows(): FollowsApi {
  const [follows, setFollows] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setFollows(read());
    const sync = () => setFollows(read());
    window.addEventListener('storage', sync);
    window.addEventListener(SAME_TAB_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(SAME_TAB_EVENT, sync);
    };
  }, []);

  const toggle = useCallback((team: string) => {
    if (!team || team === 'TBD') return;
    const next = read();
    if (next.has(team)) next.delete(team);
    else next.add(team);
    write(next);
    setFollows(next);
  }, []);

  const clear = useCallback(() => {
    write(new Set());
    setFollows(new Set());
  }, []);

  const isFollowing = useCallback((team: string) => follows.has(team), [follows]);

  return { follows, isFollowing, toggle, clear, count: follows.size };
}

// Server-safe stub: server components can import without breaking,
// returns "nothing followed" so SSR renders the default state. The
// real state hydrates client-side on mount.
export function ssrFollowsStub(): FollowsApi {
  return {
    follows: new Set(),
    isFollowing: () => false,
    toggle: () => {},
    clear: () => {},
    count: 0,
  };
}
