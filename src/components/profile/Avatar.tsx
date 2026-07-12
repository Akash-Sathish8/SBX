import { cn } from '@/lib/utils'
import { initialsFor, presetColor } from './types'

// Renders a user's avatar: an uploaded data: image, a 'preset:N' colored disc, or
// (null) an ink disc — both non-image cases show the username initial. `size` in px.
// `className` lets callers tweak chrome (the feed uses a thinner border).
const base = 'inline-flex flex-[0_0_auto] items-center justify-center rounded-full border-[3px] border-black object-cover font-display shadow-[4px_4px_0_rgba(0,0,0,.35)]'

export function Avatar({ avatar, name, size = 64, className }: { avatar: string | null; name: string | null; size?: number; className?: string }) {
  const style: React.CSSProperties = { width: size, height: size, fontSize: Math.round(size * 0.42) }
  if (avatar && avatar.startsWith('data:image/')) {
    return <img className={cn(base, className)} src={avatar} alt="" width={size} height={size} style={{ width: size, height: size }} />
  }
  const bg = presetColor(avatar)
  const dark = bg === '#F7DF02' // yellow preset needs ink text
  return (
    <span className={cn(base, 'leading-none', className)} style={{ ...style, background: bg, color: dark ? '#111' : '#fff' }} aria-hidden="true">
      {initialsFor(name)}
    </span>
  )
}
