
const SEGMENTS = [
  'ONE GAME · EVERY DAY',
  '34 MATCHES · 13 STADIUMS · 40 DAYS',
  'CASEY @CSETT13',
  'SNAPBACK SPORTS @SNAPBACKSPORTS',
  'WORLD CUP 2026',
  '3 COUNTRIES · USA · MEXICO · CANADA',
];

const TICKER_TEXT = SEGMENTS.join('   ◆   ') + '   ◆   ';

export default function Ticker() {
  return (
    <div className="ticker-strip pointer-events-none">
      <div className="ticker-track">
        <span className="ticker-text">{TICKER_TEXT.repeat(4)}</span>
        <span className="ticker-text" aria-hidden="true">{TICKER_TEXT.repeat(4)}</span>
      </div>
    </div>
  );
}
