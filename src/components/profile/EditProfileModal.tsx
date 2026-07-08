import { useMemo, useRef, useState } from 'react'
import { AVATAR_PRESETS } from './types'
import { Avatar } from './Avatar'
import type { ProfileData } from './types'
import type { VenueIndex } from './useVenues'

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
      if (dataUrl.length > 50_000) { setErr('That image is too detailed — try a simpler one.'); return }
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
    <div className="pf-modal-scrim" onClick={onClose}>
      <div className="pf-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Edit profile">
        <div className="pf-modal-head">
          <h2>Edit profile</h2>
          <button className="pf-modal-x" aria-label="Close" onClick={onClose}>×</button>
        </div>

        <div className="pf-modal-body">
          {/* Avatar */}
          <div className="pf-field">
            <label className="pf-flabel">Avatar</label>
            <div className="pf-avatar-edit">
              <Avatar avatar={avatar} name={data.username} size={64} />
              <div className="pf-avatar-actions">
                <button className="pf-mini-btn" onClick={() => fileRef.current?.click()}>Upload</button>
                {avatar ? <button className="pf-mini-btn ghost" onClick={() => setAvatar(null)}>Remove</button> : null}
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickFile} />
              </div>
            </div>
            <div className="pf-presets">
              {AVATAR_PRESETS.map((c, i) => (
                <button
                  key={i}
                  className={'pf-preset' + (avatar === `preset:${i}` ? ' on' : '')}
                  style={{ background: c }}
                  aria-label={`Preset ${i + 1}`}
                  onClick={() => setAvatar(`preset:${i}`)}
                />
              ))}
            </div>
          </div>

          {/* Display name */}
          <div className="pf-field">
            <label className="pf-flabel">Display name <span className="pf-fcount">{displayName.length}/40</span></label>
            <input className="pf-search" maxLength={40} placeholder="The name shown on your profile (e.g. Jack Settleman)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>

          {/* Bio */}
          <div className="pf-field">
            <label className="pf-flabel">Bio <span className="pf-fcount">{bio.length}/280</span></label>
            <textarea className="pf-bio" rows={3} maxLength={280} placeholder="Season-ticket holder. Ballpark hunter. Tell people what you’re about." value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>

          {/* Favorites */}
          <div className="pf-field">
            <label className="pf-flabel">Favorite venues <span className="pf-fcount">{favorites.length}/4</span></label>
            {favorites.length ? (
              <div className="pf-fav-chips">
                {favorites.map((id) => (
                  <button key={id} className="pf-fav-chip" onClick={() => toggleFav(id)}>
                    {venues.byId.get(id)?.name ?? id} <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            ) : null}
            <input className="pf-search" placeholder="Search venues to pin…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="pf-picker">
              {matches.map((v) => {
                const on = favorites.includes(v.id)
                const full = favorites.length >= 4 && !on
                return (
                  <button key={v.id} className={'pf-pick' + (on ? ' on' : '')} disabled={full} onClick={() => toggleFav(v.id)}>
                    <span className="pf-pick-name">{v.name}</span>
                    <span className="pf-pick-city">{v.city ?? ''}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {err ? <div className="pf-err">{err}</div> : null}
        </div>

        <div className="pf-modal-foot">
          <button className="pf-mini-btn ghost" onClick={onClose}>Cancel</button>
          <button className="pf-save" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save profile'}</button>
        </div>
      </div>
    </div>
  )
}
