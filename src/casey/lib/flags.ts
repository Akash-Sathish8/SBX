// Official country flag images, served from flagcdn.com (free public CDN,
// no auth, no rate limit). Replaces the Unicode emoji flags that were
// rendering as text initials ("US", "MX") on non-Apple devices and not
// rendering at all on Windows.
//
// flagcdn URLs use ISO 3166-1 alpha-2 codes (us, mx, ca, etc.) and a
// handful of officially supported subdivision codes for the home nations
// of the UK (gb-eng, gb-sct, gb-wls, gb-nir).

const TEAM_TO_CODE: Record<string, string> = {
  // CONCACAF
  Mexico: 'mx',
  USA: 'us',
  Canada: 'ca',
  Haiti: 'ht',
  Curacao: 'cw',
  // CONMEBOL
  Brazil: 'br',
  Argentina: 'ar',
  Uruguay: 'uy',
  Paraguay: 'py',
  Colombia: 'co',
  Ecuador: 'ec',
  // UEFA
  France: 'fr',
  Germany: 'de',
  Spain: 'es',
  Portugal: 'pt',
  England: 'gb-eng',
  Scotland: 'gb-sct',
  Wales: 'gb-wls',
  Italy: 'it',
  Netherlands: 'nl',
  Belgium: 'be',
  Croatia: 'hr',
  Switzerland: 'ch',
  Austria: 'at',
  Norway: 'no',
  Sweden: 'se',
  Denmark: 'dk',
  Poland: 'pl',
  // CAF
  'South Africa': 'za',
  Morocco: 'ma',
  Senegal: 'sn',
  'Ivory Coast': 'ci',
  Ghana: 'gh',
  Algeria: 'dz',
  Tunisia: 'tn',
  Egypt: 'eg',
  Nigeria: 'ng',
  Cameroon: 'cm',
  'Cape Verde': 'cv',
  // AFC
  Japan: 'jp',
  Korea: 'kr',
  'South Korea': 'kr',
  'Saudi Arabia': 'sa',
  Qatar: 'qa',
  Iran: 'ir',
  Iraq: 'iq',
  Australia: 'au',
  // OFC
  'New Zealand': 'nz',
};

// ESPN often returns alternate display names. Normalize before lookup so a
// 'United States' or "Côte d'Ivoire" resolves correctly.
const ALIASES: Record<string, string> = {
  'United States': 'USA',
  "Côte d'Ivoire": 'Ivory Coast',
  'Cote dIvoire': 'Ivory Coast',
  México: 'Mexico',
  Brasil: 'Brazil',
  España: 'Spain',
  Italia: 'Italy',
  Holland: 'Netherlands',
};

function normalize(team: string): string {
  return ALIASES[team] ?? team;
}

// ISO 3166-1 alpha-2 (lowercase) -> readable team name. Used when we
// have a stadium's `country` code instead of a team name.
const CODE_TO_TEAM: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [team, code] of Object.entries(TEAM_TO_CODE)) {
    if (!out[code]) out[code] = team;
  }
  return out;
})();

export function flagCodeForTeam(team: string): string | null {
  if (!team || team === 'TBD') return null;
  const norm = normalize(team);
  return TEAM_TO_CODE[norm] ?? null;
}

export function flagCodeForCountryCode(code: string): string | null {
  if (!code) return null;
  return code.toLowerCase();
}

export function teamNameForCode(code: string): string | null {
  return CODE_TO_TEAM[code.toLowerCase()] ?? null;
}

// flagcdn URL builder. Default svg for crisp rendering at any size; opt
// into a fixed-height png by passing { height }.
export function flagUrl(code: string, opts: { height?: number } = {}): string {
  const c = code.toLowerCase();
  if (opts.height) {
    const allowed = [20, 24, 40, 60, 80, 120, 160, 240];
    const h = allowed.reduce((best, cur) =>
      Math.abs(cur - opts.height!) < Math.abs(best - opts.height!) ? cur : best,
    );
    return `https://flagcdn.com/h${h}/${c}.png`;
  }
  return `https://flagcdn.com/${c}.svg`;
}

// Backward-compat shim — emoji fallback for any code path still calling
// flagFor() that we haven't migrated yet. New code should use <Flag/>.
const EMOJI: Record<string, string> = {
  Mexico: '🇲🇽',
  'South Africa': '🇿🇦',
  USA: '🇺🇸',
  Paraguay: '🇵🇾',
  Brazil: '🇧🇷',
  Morocco: '🇲🇦',
  'Ivory Coast': '🇨🇮',
  Ecuador: '🇪🇨',
  'Saudi Arabia': '🇸🇦',
  Uruguay: '🇺🇾',
  France: '🇫🇷',
  Senegal: '🇸🇳',
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  Croatia: '🇭🇷',
  Canada: '🇨🇦',
  Qatar: '🇶🇦',
  Australia: '🇦🇺',
  Netherlands: '🇳🇱',
  Sweden: '🇸🇪',
  'Cape Verde': '🇨🇻',
  Norway: '🇳🇴',
  Ghana: '🇬🇭',
  Haiti: '🇭🇹',
  Curacao: '🇨🇼',
  Algeria: '🇩🇿',
  Austria: '🇦🇹',
};

export function flagFor(team: string): string {
  if (!team || team === 'TBD') return '·';
  return EMOJI[normalize(team)] ?? '·';
}
