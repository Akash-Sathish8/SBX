import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { AVATAR_PRESETS } from './types'
import { Avatar } from './Avatar'
import type { ProfileData } from './types'
import type { VenueIndex } from './useVenues'
import { notchButton } from './ui'

// Resize a picked image to a 128x128 cover-cropped square and return a webp data
// URL (~5-15KB) so it fits comfortably in the users.avatar column. No blob store
// needed; falls back to jpeg if the browser can't encode webp.
function resizeToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const S = 128
      const canvas = document.createElement('canvas')
      canvas.width = S; canvas.height = S
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('no canvas')); return }
      const scale = Math.max(S / img.width, S / img.height)
      const w = img.width * scale, h = img.height * scale
      ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h)
      let out = canvas.toDataURL('image/webp', 0.8)
      if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/jpeg', 0.82)
      resolve(out)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')) }
    img.src = url
  })
}

const flabel = 'flex items-center justify-between text-[12px] font-extrabold uppercase tracking-[.5px] text-[#111]'
const fcount = 'font-bold text-[#6b6b6b]'
const field = 'flex flex-col gap-[9px]'
const fieldInput = 'h-auto w-full rounded-[7px] border-2 border-[#111] bg-white px-[12px] py-[9px] font-sans text-[14px] shadow-none focus-visible:ring-0 md:text-[14px]'

export function EditProfileModal({ data, venues, onClose, onSaved }: {
  data: ProfileData
  venues: VenueIndex
  onClose: () => void
  onSaved: (p: { displayName: string | null; bio: string | null; avatar: string | null; favorites: string[] }) => void
}) {
  const [displayName, setDisplayName] = useState(data.displayName ?? '')
  const [bio, setBio] = useState(data.bio ?? '')
  const [avatar, setAvatar] = useState<string | null>(data.avatar ?? null)
  const [favorites, setFavorites] = useState<string[]>(data.favorites ?? [])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    const all = [...venues.byId.values()]
    const list = q ? all.filter((v) => v.name.toLowerCase().includes(q)) : all
    return list.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 24)
  }, [search, venues])

  const toggleFav = (id: string) => {
    setFavorites((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 4 ? cur : [...cur, id]))
  }

  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setErr(null)
    try {
      const dataUrl = await resizeToDataUrl(file)
      if (dataUrl.length > 50_000) { setErr('That image is too detailed. Try a simpler one.'); return }
      setAvatar(dataUrl)
    } catch {
      setErr('Could not read that image.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const save = async () => {
    if (busy) return
    setBusy(true); setErr(null)
    try {
      const r = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim(), bio: bio.trim(), avatar, favorites }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok && j?.ok) {
        onSaved({ displayName: j.profile.displayName ?? null, bio: j.profile.bio ?? null, avatar: j.profile.avatar ?? null, favorites: j.profile.favorites ?? [] })
        onClose()
      } else {
        setErr(j?.error || 'Could not save your profile.')
      }
    } catch {
      setErr('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[50] bg-black/55"
        className="top-[34px] z-[50] flex max-h-[calc(100dvh-68px)] w-[calc(100%-32px)] max-w-[520px] translate-y-0 flex-col gap-0 overflow-hidden rounded-[10px] border-[3px] border-[#111] bg-white p-0 shadow-[8px_8px_0_#000] sm:max-w-[520px]"
      >
        <div className="flex shrink-0 items-center justify-between border-b-[3px] border-[#111] px-[20px] py-[16px]">
          <DialogTitle className="font-display text-[20px] uppercase tracking-[1px] text-[#222]">Edit profile</DialogTitle>
          <DialogClose asChild>
            <button className="cursor-pointer border-0 bg-none text-[26px] leading-none text-[#111]" aria-label="Close">×</button>
          </DialogClose>
        </div>

        <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-[20px] py-[18px]">
          {/* Avatar */}
          <div className={field}>
            <Label className={flabel}>Avatar</Label>
            <div className="flex items-center gap-[14px]">
              <Avatar avatar={avatar} name={data.username} size={64} />
              <div className="flex flex-wrap gap-[8px]">
                <Button variant="brand" className={notchButton({ size: 'mini' })} onClick={() => fileRef.current?.click()}>Upload</Button>
                {avatar ? <Button variant="brand" className={notchButton({ size: 'mini', tone: 'ghost' })} onClick={() => setAvatar(null)}>Remove</Button> : null}
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickFile} />
              </div>
            </div>
            <div className="flex flex-wrap gap-[8px]">
              {AVATAR_PRESETS.map((c, i) => (
                <button
                  key={i}
                  className={cn('h-[30px] w-[30px] cursor-pointer rounded-full border-2 border-[#111] p-0', avatar === `preset:${i}` && 'outline-[3px] outline-offset-2 outline-[#111]')}
                  style={{ background: c }}
                  aria-label={`Preset ${i + 1}`}
                  onClick={() => setAvatar(`preset:${i}`)}
                />
              ))}
            </div>
          </div>

          {/* Display name */}
          <div className={field}>
            <Label className={flabel}>Display name <span className={fcount}>{displayName.length}/40</span></Label>
            <Input className={fieldInput} maxLength={40} placeholder="The name shown on your profile (e.g. Jack Settleman)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>

          {/* Bio */}
          <div className={field}>
            <Label className={flabel}>Bio <span className={fcount}>{bio.length}/280</span></Label>
            <Textarea className={cn(fieldInput, 'resize-y')} rows={3} maxLength={280} placeholder="Season-ticket holder. Ballpark hunter. Tell people what you’re about." value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>

          {/* Favorites */}
          <div className={field}>
            <Label className={flabel}>Favorite venues <span className={fcount}>{favorites.length}/4</span></Label>
            {favorites.length ? (
              <div className="flex flex-wrap gap-[8px]">
                {favorites.map((id) => (
                  <button key={id} className="cursor-pointer rounded-[20px] border-2 border-[#111] bg-brand px-[11px] py-[4px] text-[12px] font-extrabold" onClick={() => toggleFav(id)}>
                    {venues.byId.get(id)?.name ?? id} <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            ) : null}
            <Input className={fieldInput} placeholder="Search venues to pin…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="max-h-[190px] overflow-auto rounded-[7px] border-2 border-[#eee]">
              {matches.map((v) => {
                const on = favorites.includes(v.id)
                const full = favorites.length >= 4 && !on
                return (
                  <button key={v.id} className={cn('flex w-full cursor-pointer items-center justify-between gap-[10px] border-0 border-b border-[#f0f0f0] bg-white px-[12px] py-[9px] text-left font-sans hover:bg-[#fafafa] disabled:opacity-40', on && 'bg-[#fffbe0]')} disabled={full} onClick={() => toggleFav(v.id)}>
                    <span className="text-[14px] font-bold text-[#222]">{v.name}</span>
                    <span className="text-[12px] text-[#6b6b6b]">{v.city ?? ''}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {err ? <div className="text-[13px] font-bold text-[#c0392b]">{err}</div> : null}
        </div>

        <div className="flex shrink-0 justify-end gap-[10px] border-t-[3px] border-[#111] px-[20px] py-[16px]">
          <Button variant="brand" className={notchButton({ size: 'mini', tone: 'ghost' })} onClick={onClose}>Cancel</Button>
          <Button variant="brand" className={notchButton()} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save profile'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
