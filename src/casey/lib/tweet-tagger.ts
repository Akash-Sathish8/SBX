import type { ItineraryMatch, Stadium } from './types';
import type { Tweet } from './x';
import { zonedTimeToUtc } from './time';

// Map team display name → other strings that mean the same team in tweets.
const TEAM_NICKNAMES: Record<string, string[]> = {
  USA: ['usa', 'united states', 'usmnt', '🇺🇸'],
  Mexico: ['mexico', 'méxico', 'el tri', 'eltri', '🇲🇽'],
  Canada: ['canada', 'canmnt', '🇨🇦'],
  Brazil: ['brazil', 'brasil', 'seleção', 'selecao', 'canarinho', '🇧🇷'],
  Argentina: ['argentina', 'la albiceleste', 'albiceleste', '🇦🇷'],
  France: ['france', 'les bleus', 'lesbleus', '🇫🇷'],
  England: ['england', 'three lions', 'threelions', '🏴󠁧󠁢󠁥󠁮󠁧󠁿'],
  Germany: ['germany', 'die mannschaft', 'mannschaft', '🇩🇪'],
  Spain: ['spain', 'españa', 'la roja', 'laroja', '🇪🇸'],
  Portugal: ['portugal', '🇵🇹'],
  Italy: ['italy', 'italia', 'azzurri', '🇮🇹'],
  Netherlands: ['netherlands', 'holland', 'oranje', '🇳🇱'],
  Belgium: ['belgium', 'red devils', '🇧🇪'],
  Croatia: ['croatia', 'vatreni', '🇭🇷'],
  Japan: ['japan', 'samurai blue', '🇯🇵'],
  Korea: ['korea', 'south korea', 'taegeuk', '🇰🇷'],
  Senegal: ['senegal', 'teranga lions', '🇸🇳'],
  Morocco: ['morocco', 'atlas lions', '🇲🇦'],
  Norway: ['norway', '🇳🇴'],
  'South Africa': ['south africa', 'bafana', '🇿🇦'],
  Uruguay: ['uruguay', 'la celeste', 'celeste', '🇺🇾'],
  Colombia: ['colombia', 'los cafeteros', '🇨🇴'],
  Ecuador: ['ecuador', 'la tri', '🇪🇨'],
  Paraguay: ['paraguay', '🇵🇾'],
  Switzerland: ['switzerland', 'swiss', '🇨🇭'],
  Austria: ['austria', '🇦🇹'],
  Denmark: ['denmark', '🇩🇰'],
  Poland: ['poland', '🇵🇱'],
};

function teamMatches(text: string, team: string): boolean {
  const lower = team.toLowerCase();
  if (text.includes(lower)) return true;
  const nicks = TEAM_NICKNAMES[team] ?? [];
  return nicks.some((n) => text.includes(n));
}

export interface TagResult {
  matchNumbers: number[];
  confidence: number;
  signals: string[];
}

const TIME_2H = 0.4;
const TIME_6H = 0.25;
const TIME_12H = 0.1;
const TIME_24H = 0.04;

const TEAM_HIT = 0.35;
const STADIUM_HIT = 0.3;
const CITY_HIT = 0.15;
const COUNTRY_HIT = 0.05;

const THRESHOLD = 0.4;

export function tagTweet(
  tweet: Tweet,
  itinerary: ItineraryMatch[],
  stadiums: Record<string, Stadium>,
): TagResult {
  // Skip replies to other users — they're conversation noise.
  if (tweet.isReply && !tweet.text.toLowerCase().match(/world cup|wc26|wc 26/)) {
    return { matchNumbers: [], confidence: 0, signals: [] };
  }

  const text = tweet.text.toLowerCase();
  const tweetTimeMs = new Date(tweet.createdAt).getTime();

  type Cand = { matchNumber: number; score: number; signals: string[] };
  const candidates: Cand[] = [];

  for (const m of itinerary) {
    let kickoffMs: number;
    try {
      kickoffMs = zonedTimeToUtc(m.kickoffLocal, m.kickoffTZ).getTime();
    } catch {
      continue;
    }

    const hoursDelta = Math.abs(tweetTimeMs - kickoffMs) / 3_600_000;
    let score = 0;
    const signals: string[] = [];

    if (hoursDelta <= 2) { score += TIME_2H; signals.push('within-2h'); }
    else if (hoursDelta <= 6) { score += TIME_6H; signals.push('within-6h'); }
    else if (hoursDelta <= 12) { score += TIME_12H; signals.push('within-12h'); }
    else if (hoursDelta <= 24) { score += TIME_24H; signals.push('within-24h'); }

    if (teamMatches(text, m.homeTeam)) { score += TEAM_HIT; signals.push(`home:${m.homeTeam}`); }
    if (teamMatches(text, m.awayTeam)) { score += TEAM_HIT; signals.push(`away:${m.awayTeam}`); }

    const stadium = stadiums[m.stadiumId];
    if (stadium) {
      const stadiumName = stadium.name.toLowerCase();
      const cityName = stadium.city.toLowerCase();
      if (text.includes(stadiumName)) { score += STADIUM_HIT; signals.push(`stadium:${stadium.name}`); }
      if (text.includes(cityName)) { score += CITY_HIT; signals.push(`city:${stadium.city}`); }
      if (stadium.countryName && text.includes(stadium.countryName.toLowerCase())) {
        score += COUNTRY_HIT;
        signals.push(`country:${stadium.countryName}`);
      }
    }

    if (score > 0) candidates.push({ matchNumber: m.matchNumber, score: Math.min(1, score), signals });
  }

  const matches = candidates
    .filter((c) => c.score >= THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  if (matches.length === 0) return { matchNumbers: [], confidence: 0, signals: [] };

  return {
    matchNumbers: matches.map((c) => c.matchNumber),
    confidence: matches[0].score,
    signals: matches.flatMap((c) => c.signals),
  };
}
