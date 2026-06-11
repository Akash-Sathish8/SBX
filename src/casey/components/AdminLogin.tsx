
import { useState } from 'react';

export default function AdminLogin({ onAuthed }: { onAuthed: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Login failed');
        setLoading(false);
        return;
      }
      onAuthed();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <main className="absolute inset-0 flex items-center justify-center bg-snap-black p-6">
      <div className="w-full max-w-sm border border-snap-ash bg-snap-coal p-6">
        <h1 className="font-display text-[44px] leading-none text-snap-yellow">ADMIN</h1>
        <div className="font-mono text-[10px] tracking-[0.18em] text-snap-mist mt-1">
          CASEY TRACKER · CONTROL PANEL
        </div>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-snap-black border border-snap-ash px-3 py-2 font-mono text-sm text-snap-chalk focus:outline-none focus:border-snap-yellow"
          />
          {error && (
            <div className="border border-live/40 bg-live/10 px-3 py-2 font-mono text-[11px] text-live">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-snap-yellow text-snap-black font-mono text-sm tracking-[0.2em] py-2.5 hover:bg-snap-yellowDim transition-colors disabled:opacity-50"
          >
            {loading ? 'AUTHENTICATING…' : 'ENTER'}
          </button>
        </form>

        <a
          href="/"
          className="mt-6 block font-mono text-[10px] tracking-[0.18em] text-snap-mist hover:text-snap-yellow text-center"
        >
          ← BACK TO TRACKER
        </a>
      </div>
    </main>
  );
}
