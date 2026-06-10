export function zonedTimeToUtc(localIso: string, tz: string): Date {
  const match = localIso.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/,
  );
  if (!match) {
    return new Date(localIso);
  }
  const [, y, mo, d, h, mi, s] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = s ? Number(s) : 0;

  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetMs = getZoneOffsetMs(asUtc, tz);
  return new Date(asUtc - offsetMs);
}

function getZoneOffsetMs(utcMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  let hour = get('hour');
  if (hour === 24) hour = 0;
  const asIfUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    hour,
    get('minute'),
    get('second'),
  );
  return asIfUtc - utcMs;
}

export function formatInTimezone(
  date: Date,
  tz: string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    ...opts,
  });
  return fmt.format(date);
}
