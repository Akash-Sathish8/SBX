function googleSearch(q: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

export function liveScoreSearch(homeTeam: string, awayTeam: string, date: string): string {
  if (homeTeam === 'TBD' || awayTeam === 'TBD') {
    return googleSearch(`World Cup 2026 ${date} match score`);
  }
  return googleSearch(`${homeTeam} vs ${awayTeam} World Cup 2026 score`);
}

export function groupStandingsSearch(stage: string): string {
  const groupMatch = stage.match(/Group\s+([A-L])/i);
  if (groupMatch) {
    return googleSearch(`World Cup 2026 Group ${groupMatch[1]} standings`);
  }
  if (/round|quarter|semi|final|3rd/i.test(stage)) {
    return googleSearch(`World Cup 2026 ${stage} bracket`);
  }
  return googleSearch('World Cup 2026 standings');
}

export function fifaTournamentUrl(): string {
  return 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026';
}
