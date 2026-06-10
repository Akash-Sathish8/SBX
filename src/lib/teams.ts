// Single source of truth for World Cup team display names, flag emoji, and
// flagcdn ISO codes. Data files keep the official FIFA names; we normalize to
// casual English names for display. Helpers are alias-tolerant — they accept
// either the official spelling or a casual one.

type Team = { display: string; flag: string; code: string }

// Keyed by the official FIFA name used in the data.
const TEAMS: Record<string, Team> = {
  'Mexico': { display: 'Mexico', flag: '🇲🇽', code: 'mx' },
  'South Africa': { display: 'South Africa', flag: '🇿🇦', code: 'za' },
  'Korea Republic': { display: 'South Korea', flag: '🇰🇷', code: 'kr' },
  'Czechia': { display: 'Czech Republic', flag: '🇨🇿', code: 'cz' },
  'Canada': { display: 'Canada', flag: '🇨🇦', code: 'ca' },
  'USA': { display: 'USA', flag: '🇺🇸', code: 'us' },
  'Paraguay': { display: 'Paraguay', flag: '🇵🇾', code: 'py' },
  'Qatar': { display: 'Qatar', flag: '🇶🇦', code: 'qa' },
  'Switzerland': { display: 'Switzerland', flag: '🇨🇭', code: 'ch' },
  'Brazil': { display: 'Brazil', flag: '🇧🇷', code: 'br' },
  'Morocco': { display: 'Morocco', flag: '🇲🇦', code: 'ma' },
  'Haiti': { display: 'Haiti', flag: '🇭🇹', code: 'ht' },
  'Scotland': { display: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', code: 'gb-sct' },
  'Australia': { display: 'Australia', flag: '🇦🇺', code: 'au' },
  'Türkiye': { display: 'Turkey', flag: '🇹🇷', code: 'tr' },
  'Germany': { display: 'Germany', flag: '🇩🇪', code: 'de' },
  'Curaçao': { display: 'Curacao', flag: '🇨🇼', code: 'cw' },
  'Netherlands': { display: 'Netherlands', flag: '🇳🇱', code: 'nl' },
  'Japan': { display: 'Japan', flag: '🇯🇵', code: 'jp' },
  "Côte d'Ivoire": { display: 'Ivory Coast', flag: '🇨🇮', code: 'ci' },
  'Ecuador': { display: 'Ecuador', flag: '🇪🇨', code: 'ec' },
  'Tunisia': { display: 'Tunisia', flag: '🇹🇳', code: 'tn' },
  'Sweden': { display: 'Sweden', flag: '🇸🇪', code: 'se' },
  'Argentina': { display: 'Argentina', flag: '🇦🇷', code: 'ar' },
  'Algeria': { display: 'Algeria', flag: '🇩🇿', code: 'dz' },
  'Spain': { display: 'Spain', flag: '🇪🇸', code: 'es' },
  'Cabo Verde': { display: 'Cape Verde', flag: '🇨🇻', code: 'cv' },
  'France': { display: 'France', flag: '🇫🇷', code: 'fr' },
  'Senegal': { display: 'Senegal', flag: '🇸🇳', code: 'sn' },
  'England': { display: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', code: 'gb-eng' },
  'Croatia': { display: 'Croatia', flag: '🇭🇷', code: 'hr' },
  'Panama': { display: 'Panama', flag: '🇵🇦', code: 'pa' },
  'Ghana': { display: 'Ghana', flag: '🇬🇭', code: 'gh' },
  'Belgium': { display: 'Belgium', flag: '🇧🇪', code: 'be' },
  'IR Iran': { display: 'Iran', flag: '🇮🇷', code: 'ir' },
  'New Zealand': { display: 'New Zealand', flag: '🇳🇿', code: 'nz' },
  'Egypt': { display: 'Egypt', flag: '🇪🇬', code: 'eg' },
  'Uruguay': { display: 'Uruguay', flag: '🇺🇾', code: 'uy' },
  'Colombia': { display: 'Colombia', flag: '🇨🇴', code: 'co' },
  'Portugal': { display: 'Portugal', flag: '🇵🇹', code: 'pt' },
  'Uzbekistan': { display: 'Uzbekistan', flag: '🇺🇿', code: 'uz' },
  'Austria': { display: 'Austria', flag: '🇦🇹', code: 'at' },
  'Jordan': { display: 'Jordan', flag: '🇯🇴', code: 'jo' },
  'Norway': { display: 'Norway', flag: '🇳🇴', code: 'no' },
  'Saudi Arabia': { display: 'Saudi Arabia', flag: '🇸🇦', code: 'sa' },
  'DR Congo': { display: 'DR Congo', flag: '🇨🇩', code: 'cd' },
  'Iraq': { display: 'Iraq', flag: '🇮🇶', code: 'iq' },
  'Bosnia and Herzegovina': { display: 'Bosnia & Herzegovina', flag: '🇧🇦', code: 'ba' },
}

// Casual / variant spellings → official key, so helpers resolve either input.
const ALIASES: Record<string, string> = {
  'South Korea': 'Korea Republic',
  'Iran': 'IR Iran',
  'Turkey': 'Türkiye',
  'Ivory Coast': "Côte d'Ivoire",
  "Cote d'Ivoire": "Côte d'Ivoire",
  'Cape Verde': 'Cabo Verde',
  'Curacao': 'Curaçao',
  'Czech Republic': 'Czechia',
  'United States': 'USA',
  'Bosnia & Herzegovina': 'Bosnia and Herzegovina',
}

function resolve(n: string): Team | undefined {
  if (!n) return undefined
  if (TEAMS[n]) return TEAMS[n]
  const a = ALIASES[n]
  return a ? TEAMS[a] : undefined
}

export const teamName = (n: string) => resolve(n)?.display || n
export const teamFlag = (n: string) => resolve(n)?.flag || '⚽'
export const teamCode = (n: string) => resolve(n)?.code || ''

// "A vs B" → casual "A vs B" (leaves unknown strings, e.g. "TBD", untouched).
export function displayFixture(s: string): string {
  if (!s || s.indexOf(' vs ') === -1) return s
  const [a, b] = s.split(' vs ')
  return teamName(a.trim()) + ' vs ' + teamName(b.trim())
}
