// <Flag /> renders an official country flag from flagcdn.com (free,
// no auth, CDN-cached). Works on every device — replaces the Unicode
// emoji flags that were falling back to "MX" / "US" letter pairs on
// Windows and some Android builds.
//
// Pass one of:
//   - team       e.g. "USA", "Ivory Coast"  (looks up the ISO code)
//   - countryCode  e.g. "us", "gb-eng"  (used directly)
//   - countryName  e.g. "United States"  (resolves to a team-name
//                  alias if known, otherwise treated as alt text only)

import { flagCodeForTeam, flagCodeForCountryCode, flagUrl } from '@/lib/flags';

interface Props {
  team?: string;
  countryCode?: string;
  countryName?: string;
  size?: number; // height in px; width auto
  className?: string;
  rounded?: boolean;
  title?: string;
}

export default function Flag({
  team,
  countryCode,
  countryName,
  size = 16,
  className = '',
  rounded = true,
  title,
}: Props) {
  const code =
    (countryCode && flagCodeForCountryCode(countryCode)) ||
    (team && flagCodeForTeam(team)) ||
    (countryName && flagCodeForTeam(countryName)) ||
    null;

  const label = team || countryName || code || 'flag';

  if (!code) {
    // Fallback dot matches the prior emoji fallback for TBD knockouts.
    return (
      <span
        className={`inline-block text-snap-fog align-middle ${className}`}
        style={{ width: size, height: size, lineHeight: `${size}px`, textAlign: 'center' }}
        aria-hidden="true"
      >
        ·
      </span>
    );
  }

  return (
    <img
      src={flagUrl(code)}
      alt={label}
      title={title ?? label}
      width={Math.round(size * 1.5)}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`inline-block align-middle object-cover ${rounded ? 'rounded-[2px]' : ''} ${className}`}
      style={{
        height: size,
        width: 'auto',
        // Subtle 1px border keeps light flags (Japan, Korea, white-heavy)
        // visible against the dark map / drawer backgrounds.
        boxShadow: '0 0 0 1px rgba(255,255,255,0.08)',
      }}
    />
  );
}
