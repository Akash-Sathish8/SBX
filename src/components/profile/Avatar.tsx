import { initialsFor, presetColor } from './types'

// Renders a user's avatar: an uploaded data: image, a 'preset:N' colored disc, or
// (null) an ink disc — both non-image cases show the username initial. `size` in px.
export function Avatar({ avatar, name, size = 64 }: { avatar: string | null; name: string | null; size?: number }) {
  const style: React.CSSProperties = { width: size, height: size, fontSize: Math.round(size * 0.42) }
  if (avatar && avatar.startsWith('data:image/')) {
    return <img className="pf-avatar" src={avatar} alt="" width={size} height={size} style={{ width: size, height: size }} />
  }
  const bg = presetColor(avatar)
  const dark = bg === '#F7DF02' // yellow preset needs ink text
  return (
    <span className="pf-avatar pf-avatar-init" style={{ ...style, background: bg, color: dark ? '#111' : '#fff' }} aria-hidden="true">
      {initialsFor(name)}
    </span>
  )
}
