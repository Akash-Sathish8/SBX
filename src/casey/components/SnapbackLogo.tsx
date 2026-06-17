
import { useState } from 'react';

interface Props {
  className?: string;
  size?: number | string;
  withPlate?: boolean;
}

function CapMark({ pixels }: { pixels?: number | string }) {
  const sizeAttrs =
    typeof pixels === 'number'
      ? { width: pixels, height: (pixels * 5) / 8 }
      : typeof pixels === 'string'
      ? { style: { width: pixels, height: 'auto' as const } }
      : {};
  return (
    <svg
      viewBox="0 0 64 40"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...sizeAttrs}
    >
      <g fill="currentColor">
        <path d="M 16 26
                 C 16 12, 24 7, 32 7
                 C 44 7, 52 14, 52 26
                 Z" />
        <ellipse cx="18" cy="28" rx="17" ry="3.2" />
        <rect x="50" y="22" width="6" height="6" rx="1" />
        <circle cx="53" cy="33" r="1.3" />
        <circle cx="48" cy="33" r="1.3" />
        <circle cx="58" cy="33" r="1.3" />
      </g>
    </svg>
  );
}

function PlatedFallback({
  size,
  className,
}: {
  size: number | string;
  className: string;
}) {
  const dimStyle =
    typeof size === 'number'
      ? { width: size, height: size }
      : { width: size, height: size };

  return (
    <span
      className={`relative inline-flex items-center justify-center bg-snap-yellow text-snap-chalk ${className}`}
      style={dimStyle}
      aria-label="Snapback Sports"
    >
      <span
        className="flex items-center justify-center"
        style={{ width: '82%', height: '82%' }}
      >
        <CapMark pixels="100%" />
      </span>
    </span>
  );
}

export default function SnapbackLogo({
  className = '',
  size = 32,
  withPlate = true,
}: Props) {
  const [errored, setErrored] = useState(false);

  if (!withPlate) {
    return (
      <span className={className} aria-label="Snapback Sports">
        <CapMark pixels={size} />
      </span>
    );
  }

  if (errored) {
    return <PlatedFallback size={size} className={className} />;
  }

  const dimStyle =
    typeof size === 'number'
      ? { width: size, height: size }
      : { width: size, height: size };

  return (
    <img
      src="/snapback-logo.jpeg"
      alt="Snapback Sports"
      className={`inline-block object-cover ${className}`}
      style={dimStyle}
      onError={() => setErrored(true)}
    />
  );
}
