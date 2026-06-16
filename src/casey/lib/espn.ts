const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';
const ESPN_STANDINGS = 'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings';

// Keyed by the team names used in our fixture data (FIFA spelling); candidates are
// the variants ESPN may return. Matching is lenient substring (both directions),
// so a short distinctive token (e.g. 'Bosnia') is enough to bridge naming gaps.
const TEAM_ALIASES: Record<string, string[]> = {
  USA: ['USA', 'United States'],
  Mexico: ['Mexico', 'México'],
  'Korea Republic': ['Korea Republic', 'South Korea', 'Korea'],
  Czechia: ['Czechia', 'Czech Republic'],
  'Bosnia and Herzegovina': ['Bosnia and Herzegovina', 'Bosnia-Herzegovina', 'Bosnia & Herzegovina', 'Bosnia'],
  'Türkiye': ['Türkiye', 'Turkey', 'Turkiye'],
  'IR Iran': ['IR Iran', 'Iran'],
  "Côte d'Ivoire": ["Côte d'Ivoire", 'Ivory Coast', "Cote d'Ivoire"],
  'Ivory Coast': ['Ivory Coast', "Côte d'Ivoire", 'Cote dIvoire'],
  'Cabo Verde': ['Cabo Verde', 'Cape Verde'],
  'DR Congo': ['DR Congo', 'Congo DR', 'Democratic Republic of the Congo'],
  'South Africa': ['South Africa'],
  'Curaçao': ['Curaçao', 'Curacao'],
  Curacao: ['Curacao', 'Curaçao'],
};

function teamMatchesName(itineraryName: string, espnDisplay: string): boolean {
  const candidates = TEAM_ALIASES[itineraryName] ?? [itineraryName];
  const target = espnDisplay.toLowerCase();
  return candidates.some(
    (c) => target.includes(c.toLowerCase()) || c.toLowerCase().includes(target),
  );
}

export interface MatchScore {
  home: { name: string; abbr?: string; score: number | null };
  away: { name: string; abbr?: string; score: number | null };
  status: 'pre' | 'in' | 'post' | 'unknown';
  detail: string;
  completed: boolean;
}

// Two-layer cache for ESPN GETs:
//   L1 — in-memory map (per worker isolate), so several matches sharing a date
//        don't each re-hit even the edge cache within one isolate.
//   L2 — Cloudflare's edge cache via `cf.cacheTtl`, keyed by the ESPN URL and
//        shared across every route + every isolate in a colo. Since /today,
//        /live-today and /match-score all request the same `scoreboard?dates=`
//        URL, they dedupe against one cached ESPN response — this is the real
//        ESPN-egress collapse under load. (`cf` isn't in lib.dom's RequestInit.)
const _jsonCache = new Map<string, { t: number; data: any }>();

type CfRequestInit = RequestInit & {
  cf?: { cacheEverything?: boolean; cacheTtl?: number };
};

async function fetchJson(url: string, revalidateSec: number): Promise<any | null> {
  const now = Date.now();
  const hit = _jsonCache.get(url);
  if (hit && now - hit.t < revalidateSec * 1000) return hit.data;
  try {
    const res = await fetch(url, {
      cf: { cacheEverything: true, cacheTtl: revalidateSec },
    } as CfRequestInit);
    if (!res.ok) return null;
    const data = await res.json();
    _jsonCache.set(url, { t: now, data });
    return data;
  } catch {
    return null;
  }
}

export async function getMatchScore(
  date: string,
  homeTeam: string,
  awayTeam: string,
): Promise<MatchScore | null> {
  const ymd = date.replace(/-/g, '');
  const data = await fetchJson(`${ESPN_BASE}/scoreboard?dates=${ymd}`, 45);
  if (!data?.events?.length) return null;

  for (const ev of data.events) {
    const comp = ev.competitions?.[0];
    if (!comp) continue;
    const competitors = comp.competitors ?? [];
    if (competitors.length !== 2) continue;
    const names = competitors.map((c: any) => c?.team?.displayName ?? '');
    const matchesHome = names.some((n: string) => teamMatchesName(homeTeam, n));
    const matchesAway = names.some((n: string) => teamMatchesName(awayTeam, n));
    if (!matchesHome || !matchesAway) continue;

    const home = competitors.find((c: any) => c.homeAway === 'home') ?? competitors[0];
    const away = competitors.find((c: any) => c.homeAway === 'away') ?? competitors[1];
    const stateRaw = ev.status?.type?.state as string | undefined;
    const state: MatchScore['status'] =
      stateRaw === 'pre' || stateRaw === 'in' || stateRaw === 'post'
        ? (stateRaw as 'pre' | 'in' | 'post')
        : 'unknown';

    return {
      home: {
        name: home.team?.displayName ?? homeTeam,
        abbr: home.team?.abbreviation,
        score: home.score !== undefined && home.score !== '' ? Number(home.score) : null,
      },
      away: {
        name: away.team?.displayName ?? awayTeam,
        abbr: away.team?.abbreviation,
        score: away.score !== undefined && away.score !== '' ? Number(away.score) : null,
      },
      status: state,
      detail: ev.status?.type?.shortDetail ?? ev.status?.type?.detail ?? '',
      completed: Boolean(ev.status?.type?.completed),
    };
  }
  return null;
}

export interface StandingsRow {
  team: string;
  abbr?: string;
  gp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
}

export interface GroupStandings {
  name: string;
  letter: string;
  rows: StandingsRow[];
}

function statValue(stats: any[], names: string[]): number {
  for (const n of names) {
    const s = stats.find((x: any) => x.name === n || x.abbreviation === n);
    if (s?.value !== undefined) return Number(s.value);
  }
  return 0;
}

function parseGroupEntries(group: any): GroupStandings | null {
  const entries = group.standings?.entries ?? [];
  if (!entries.length) return null;
  const name: string = group.name ?? group.abbreviation ?? '';
  const letterMatch = name.match(/Group\s+([A-L])/i);
  const letter = letterMatch ? letterMatch[1].toUpperCase() : name.toUpperCase().slice(-1);
  const rows: StandingsRow[] = entries.map((e: any) => {
    const stats = e.stats ?? [];
    return {
      team: e.team?.displayName ?? e.team?.shortDisplayName ?? '?',
      abbr: e.team?.abbreviation,
      gp: statValue(stats, ['gamesPlayed', 'GP']),
      w: statValue(stats, ['wins', 'W']),
      d: statValue(stats, ['ties', 'draws', 'D', 'T']),
      l: statValue(stats, ['losses', 'L']),
      gf: statValue(stats, ['pointsFor', 'goalsFor', 'GF']),
      ga: statValue(stats, ['pointsAgainst', 'goalsAgainst', 'GA']),
      gd: statValue(stats, ['pointDifferential', 'goalDifference', 'GD']),
      pts: statValue(stats, ['points', 'PTS']),
    };
  });
  return { name: name || `Group ${letter}`, letter, rows };
}

export async function getAllGroupStandings(): Promise<GroupStandings[]> {
  const data = await fetchJson(ESPN_STANDINGS, 300);
  if (!data?.children?.length) return [];
  const groups: GroupStandings[] = [];
  for (const c of data.children) {
    const parsed = parseGroupEntries(c);
    if (parsed) groups.push(parsed);
  }
  groups.sort((a, b) => a.letter.localeCompare(b.letter));
  return groups;
}

export async function getGroupStandings(letter: string): Promise<GroupStandings | null> {
  const all = await getAllGroupStandings();
  return all.find((g) => g.letter === letter.toUpperCase()) ?? null;
}

export interface ScoreboardEvent {
  id: string;
  date: string;
  name: string;
  shortName: string;
  stage?: string;
  venue?: string;
  city?: string;
  home: { name: string; abbr?: string; score: number | null };
  away: { name: string; abbr?: string; score: number | null };
  status: 'pre' | 'in' | 'post' | 'unknown';
  detail: string;
  completed: boolean;
}

function parseEvent(ev: any): ScoreboardEvent | null {
  const comp = ev?.competitions?.[0];
  if (!comp) return null;
  const competitors = comp.competitors ?? [];
  if (competitors.length !== 2) return null;
  const home = competitors.find((c: any) => c.homeAway === 'home') ?? competitors[0];
  const away = competitors.find((c: any) => c.homeAway === 'away') ?? competitors[1];
  const stateRaw = ev.status?.type?.state as string | undefined;
  const state: ScoreboardEvent['status'] =
    stateRaw === 'pre' || stateRaw === 'in' || stateRaw === 'post'
      ? (stateRaw as 'pre' | 'in' | 'post')
      : 'unknown';
  return {
    id: String(ev.id ?? ''),
    date: ev.date ?? '',
    name: ev.name ?? '',
    shortName: ev.shortName ?? '',
    stage: ev.season?.slug ?? comp.notes?.[0]?.headline,
    venue: comp.venue?.fullName,
    city: comp.venue?.address?.city,
    home: {
      name: home.team?.displayName ?? '',
      abbr: home.team?.abbreviation,
      score: home.score !== undefined && home.score !== '' ? Number(home.score) : null,
    },
    away: {
      name: away.team?.displayName ?? '',
      abbr: away.team?.abbreviation,
      score: away.score !== undefined && away.score !== '' ? Number(away.score) : null,
    },
    status: state,
    detail: ev.status?.type?.shortDetail ?? ev.status?.type?.detail ?? '',
    completed: Boolean(ev.status?.type?.completed),
  };
}

export async function getEventsForDate(date: string): Promise<ScoreboardEvent[]> {
  const ymd = date.replace(/-/g, '');
  const data = await fetchJson(`${ESPN_BASE}/scoreboard?dates=${ymd}`, 45);
  if (!data?.events?.length) return [];
  return data.events.map(parseEvent).filter((e: ScoreboardEvent | null): e is ScoreboardEvent => e !== null);
}

export async function getEventsForDateRange(
  startDate: string,
  endDate: string,
): Promise<ScoreboardEvent[]> {
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  const dates: string[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 24 * 60 * 60 * 1000) {
    dates.push(new Date(t).toISOString().slice(0, 10));
  }
  const all = await Promise.all(dates.map((d) => getEventsForDate(d)));
  return all.flat();
}
