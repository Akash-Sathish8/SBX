
import { useEffect, useState } from 'react';
import SnapbackLogo from './SnapbackLogo';

const STORAGE_KEY = 'casey-tracker-onboarded-v1';

export default function WelcomeCard({ forceOpen, onClose }: { forceOpen?: boolean; onClose?: () => void }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (forceOpen) {
      setShow(true);
      return;
    }
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setShow(true);
    } catch {
      // private mode etc.
    }
  }, [forceOpen]);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    setShow(false);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div
        className="relative w-full max-w-md border border-snap-ash bg-snap-coal p-6 sm:p-7 max-h-[92vh] overflow-y-auto no-scrollbar"
        style={{ animation: 'welcome-pop 320ms cubic-bezier(0.2,0.9,0.2,1)' }}
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-3 right-3 flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center border border-snap-ash text-snap-mist hover:text-snap-yellow hover:border-snap-yellow transition-colors"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="flex items-center gap-3">
          <SnapbackLogo size={44} className="flex-shrink-0" />
          <div className="leading-none">
            <div className="font-display text-[28px]">CASEY TRACKER</div>
            <div className="font-mono text-[9px] text-snap-yellow tracking-[0.22em] mt-1.5">
              ONE GAME · EVERY DAY
            </div>
          </div>
        </div>

        <p className="font-body text-[14px] text-snap-chalk leading-relaxed mt-5">
          Snapback's sending Casey to{' '}
          <span className="text-snap-yellow font-medium">every single World Cup match.</span>
        </p>
        <p className="font-body text-[14px] text-snap-mist leading-relaxed mt-2.5">
          34 games. 40 days. 13 stadiums. He's gonna be cooked.
        </p>
        <p className="font-body text-[13px] text-snap-mist leading-relaxed mt-2.5">
          Track him here — match by match, flight by flight. Vlogs drop daily on YouTube.
        </p>

        <div className="mt-5 grid grid-cols-3 divide-x divide-snap-ash border border-snap-ash">
          <div className="px-3 py-2 text-center">
            <div className="stat-number text-snap-yellow text-[20px]">34</div>
            <div className="font-mono text-[8px] tracking-[0.18em] text-snap-mist mt-0.5">MATCHES</div>
          </div>
          <div className="px-3 py-2 text-center">
            <div className="stat-number text-snap-yellow text-[20px]">13</div>
            <div className="font-mono text-[8px] tracking-[0.18em] text-snap-mist mt-0.5">STADIUMS</div>
          </div>
          <div className="px-3 py-2 text-center">
            <div className="stat-number text-snap-yellow text-[20px]">40</div>
            <div className="font-mono text-[8px] tracking-[0.18em] text-snap-mist mt-0.5">DAYS</div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] tracking-[0.18em]">
          <a
            href="https://x.com/csett13"
            target="_blank"
            rel="noopener noreferrer"
            className="text-snap-mist hover:text-snap-yellow transition-colors"
          >
            CASEY @CSETT13 ↗
          </a>
          <a
            href="https://x.com/snapbacksports"
            target="_blank"
            rel="noopener noreferrer"
            className="text-snap-mist hover:text-snap-yellow transition-colors"
          >
            @SNAPBACKSPORTS ↗
          </a>
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="mt-6 w-full bg-snap-yellow text-snap-black font-mono text-sm tracking-[0.22em] py-3 hover:bg-snap-yellowDim transition-colors"
        >
          LET&apos;S GO →
        </button>
      </div>
    </div>
  );
}
