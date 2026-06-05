
import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}

export default function CountUp({
  value,
  duration = 800,
  format = (n) => n.toLocaleString(),
  className = '',
}: Props) {
  const [displayed, setDisplayed] = useState(value);
  const rafRef = useRef<number | null>(null);
  const fromRef = useRef(value);

  useEffect(() => {
    if (value === displayed) return;
    fromRef.current = displayed;
    const start = performance.now();
    const delta = value - fromRef.current;

    const tick = (t: number) => {
      const elapsed = t - start;
      const k = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      const current = Math.round(fromRef.current + delta * eased);
      setDisplayed(current);
      if (k < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <span className={className}>{format(displayed)}</span>;
}
