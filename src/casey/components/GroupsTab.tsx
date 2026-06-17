
import Flag from './Flag';
import FollowStar from './FollowStar';
import { useFollows } from '@/lib/follows';
import { useQuery } from '@tanstack/react-query';
import { standingsAllQueryOptions } from '@/lib/queries';

export default function GroupsTab() {
  const { isFollowing } = useFollows();
  const q = useQuery(standingsAllQueryOptions());
  // ok:true + [] means "no standings yet" — treat empty like the old failed state.
  const groups = q.data?.ok && Array.isArray(q.data.data) ? q.data.data : null;
  const loading = q.isLoading;
  const failed = !loading && (q.isError || !groups || groups.length === 0);

  return (
    <div className="p-3">
      <div className="font-mono text-[10px] tracking-[0.22em] text-snap-mist mb-3">
        GROUP STAGE · ALL 12 GROUPS
      </div>
      {loading && (
        <div className="font-mono text-[11px] text-snap-mist py-8 text-center">
          loading the tables…
        </div>
      )}
      {!loading && failed && (
        <div className="font-mono text-[11px] text-snap-mist py-6 text-center">
          no standings yet · check back after matchday 1
        </div>
      )}
      {!loading && groups && groups.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {groups.map((g) => (
            <div key={g.letter} className="card-lift border border-snap-ash bg-gradient-to-br from-snap-coal to-snap-coal/70">
              <div className="px-3 py-2 border-b border-snap-ash bg-snap-black flex items-center justify-between">
                <span className="font-display text-[18px] text-snap-chalk">
                  GROUP {g.letter}
                </span>
                <span className="font-mono text-[9px] tracking-[0.18em] text-snap-mist">
                  {g.rows.length} TEAMS
                </span>
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-snap-ash/60">
                    <th className="text-left font-mono text-[9px] tracking-[0.18em] text-snap-mist px-2 py-1">
                      TEAM
                    </th>
                    <th className="text-center font-mono text-[9px] text-snap-mist px-1">GP</th>
                    <th className="text-center font-mono text-[9px] text-snap-mist px-1">W</th>
                    <th className="text-center font-mono text-[9px] text-snap-mist px-1">D</th>
                    <th className="text-center font-mono text-[9px] text-snap-mist px-1">L</th>
                    <th className="text-center font-mono text-[9px] text-snap-mist px-1">GD</th>
                    <th className="text-center font-mono text-[9px] text-snap-yellow px-2">PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r, i) => {
                    const followed = isFollowing(r.team);
                    return (
                    <tr
                      key={r.team}
                      className={`border-b border-snap-ash/40 last:border-b-0 ${
                        followed ? 'bg-snap-yellow/5' : ''
                      }`}
                    >
                      <td className="px-2 py-1.5 font-mono text-[10px] text-snap-chalk">
                        <span className="text-snap-fog mr-1.5">{i + 1}</span>
                        <Flag team={r.team} size={14} className="mr-1.5" />
                        {r.abbr ?? r.team}
                        <FollowStar team={r.team} size={10} className="ml-1" />
                      </td>
                      <td className="text-center font-mono text-[10px] text-snap-chalk px-1">{r.gp}</td>
                      <td className="text-center font-mono text-[10px] text-snap-chalk px-1">{r.w}</td>
                      <td className="text-center font-mono text-[10px] text-snap-chalk px-1">{r.d}</td>
                      <td className="text-center font-mono text-[10px] text-snap-chalk px-1">{r.l}</td>
                      <td className="text-center font-mono text-[10px] text-snap-chalk px-1">
                        {r.gd > 0 ? '+' : ''}
                        {r.gd}
                      </td>
                      <td className="text-center font-mono text-[11px] text-snap-yellow stat-number px-2">
                        {r.pts}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
      <div className="font-mono text-[9px] tracking-[0.18em] text-snap-fog text-right pt-3">
        via ESPN · cached 5 min
      </div>
    </div>
  );
}
