
import { useEffect, useState } from 'react';
import Flag from './Flag';
import { groupStandingsSearch } from '@/lib/external-links';

interface Props {
  group: string;
  onClose: () => void;
}

interface Row {
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

interface Data {
  name: string;
  letter: string;
  rows: Row[];
}

export default function StandingsModal({ group, onClose }: Props) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/standings?group=${encodeURIComponent(group)}`, {
          cache: 'no-store',
        });
        const json = await res.json();
        if (cancelled) return;
        if (json?.ok && json.data?.rows?.length) {
          setData(json.data);
        } else {
          setFailed(true);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [group]);

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 p-4">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-md border border-snap-ash bg-snap-coal max-h-[90vh] overflow-y-auto no-scrollbar"
        style={{ animation: 'welcome-pop 280ms cubic-bezier(0.2,0.9,0.2,1)' }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-snap-ash p-4">
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] text-snap-yellow">
              STANDINGS
            </div>
            <h3 className="font-display text-[28px] leading-none mt-1 text-snap-chalk">
              GROUP {group.toUpperCase()}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center border border-snap-ash text-snap-mist hover:text-snap-yellow hover:border-snap-yellow transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          {loading && (
            <div className="font-mono text-[11px] text-snap-mist py-8 text-center">
              loading the table…
            </div>
          )}
          {failed && !loading && (
            <div className="font-mono text-[11px] text-snap-mist py-6 text-center">
              no table yet · matchday 1 hasn&apos;t happened.
              <div className="mt-2">
                <a
                  href={groupStandingsSearch(`Group ${group}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-snap-yellow underline underline-offset-2"
                >
                  Open in Google ↗
                </a>
              </div>
            </div>
          )}
          {data && !loading && (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-snap-ash">
                  <th className="text-left font-mono text-[9px] tracking-[0.18em] text-snap-mist pb-2">
                    TEAM
                  </th>
                  <Th>P</Th>
                  <Th>W</Th>
                  <Th>D</Th>
                  <Th>L</Th>
                  <Th>GD</Th>
                  <Th highlight>PTS</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr
                    key={r.team}
                    className="border-b border-snap-ash/60 last:border-b-0"
                  >
                    <td className="py-2 font-mono text-[11px] text-snap-chalk">
                      <span className="text-snap-fog mr-1.5">{i + 1}</span>
                      <Flag team={r.team} size={14} className="mr-1.5" />
                      {r.abbr ?? r.team}
                    </td>
                    <Td>{r.gp}</Td>
                    <Td>{r.w}</Td>
                    <Td>{r.d}</Td>
                    <Td>{r.l}</Td>
                    <Td>
                      {r.gd > 0 ? '+' : ''}
                      {r.gd}
                    </Td>
                    <Td highlight>{r.pts}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t border-snap-ash px-4 py-2 font-mono text-[9px] tracking-[0.18em] text-snap-fog text-right">
          via ESPN · cached 5 min
        </div>
      </div>
    </div>
  );
}

function Th({ children, highlight = false }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <th
      className={`text-center font-mono text-[9px] tracking-[0.18em] pb-2 px-1 ${
        highlight ? 'text-snap-yellow' : 'text-snap-mist'
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, highlight = false }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <td
      className={`py-2 text-center font-mono text-[11px] px-1 ${
        highlight ? 'text-snap-yellow stat-number' : 'text-snap-chalk'
      }`}
    >
      {children}
    </td>
  );
}
