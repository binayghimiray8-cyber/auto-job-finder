import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Entry = Record<string, string>
const FIELDS: [string, string, string?][] = [
  ['full_name', 'Full name'], ['dob', 'Date of birth', 'date'], ['email', 'Email', 'email'], ['phone', 'Phone'],
  ['country', 'Current country'], ['city', 'Current city'], ['gpa', 'GPA or results'],
  ['skills', 'Skills (comma separated)'], ['languages', 'Languages'], ['portfolio', 'Portfolio website'],
  ['linkedin', 'LinkedIn profile'], ['other_info', 'Other information'],
]
const LISTS: Record<string, [string, [string, string][]]> = {
  education: ['Education', [['institution', 'Institution'], ['degree', 'Degree'], ['year', 'Year'], ['results', 'Results']]],
  experience: ['Work experience', [['employer', 'Employer'], ['role', 'Role'], ['period', 'Period'], ['details', 'Details']]],
  certificates: ['Certificates', [['name', 'Name'], ['issuer', 'Issuer'], ['year', 'Year']]],
  projects: ['Projects', [['name', 'Name'], ['link', 'Link'], ['description', 'Description']]],
}

function age(dob: string) {
  if (!dob) return ''
  const d = new Date(dob), n = new Date()
  let a = n.getFullYear() - d.getFullYear()
  if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--
  return String(a)
}

// Center-crop to 3:4 without stretching, then resize.
async function cropPortrait(file: File): Promise<Blob> {
  const img = await createImageBitmap(file)
  const ratio = 3 / 4
  let sw = img.width, sh = img.height
  if (sw / sh > ratio) sw = sh * ratio; else sh = sw / ratio
  const c = document.createElement('canvas'); c.width = 600; c.height = 800
  c.getContext('2d')!.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, 600, 800)
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('crop failed'))), 'image/jpeg', 0.9))
}

export default function Profile({ userId }: { userId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [p, setP] = useState<any>({ education: [], experience: [], certificates: [], projects: [] })
  const [photoUrl, setPhotoUrl] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function sign(path: string | null) {
    if (!path) return setPhotoUrl('')
    const { data } = await supabase.storage.from('profile-photos').createSignedUrl(path, 3600)
    setPhotoUrl(data?.signedUrl ?? '')
  }
  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle().then(({ data, error }) => {
      if (error) setMsg('Could not load profile: ' + error.message)
      else if (data) { setP((o: object) => ({ ...o, ...data })); sign(data.photo_path) }
    })
  }, [userId])

  const set = (k: string, v: string) => setP((o: object) => ({ ...o, [k]: v }))
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const setEntry = (l: string, i: number, f: string, v: string) =>
    setP((o: any) => ({ ...o, [l]: o[l].map((e: Entry, j: number) => (j === i ? { ...e, [f]: v } : e)) }))
  const addEntry = (l: string) => setP((o: any) => ({ ...o, [l]: [...o[l], {}] }))
  const delEntry = (l: string, i: number) => setP((o: any) => ({ ...o, [l]: o[l].filter((_: Entry, j: number) => j !== i) }))

  const done = FIELDS.filter(([k]) => p[k]).length + Object.keys(LISTS).filter(l => p[l]?.length).length + (p.photo_path ? 1 : 0)
  const pct = Math.round((done / (FIELDS.length + Object.keys(LISTS).length + 1)) * 100)

  async function save() {
    setBusy(true); setMsg('')
    const row = { ...p, id: userId, dob: p.dob || null, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('profiles').upsert(row)
    setMsg(error ? 'Save failed: ' + error.message : 'Profile saved.')
    setBusy(false)
  }
  async function upload(f?: File) {
    if (!f) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return setMsg('Use a JPG, PNG or WebP image.')
    if (f.size > 5 * 1024 * 1024) return setMsg('Photo must be under 5 MB.')
    setBusy(true)
    try {
      const path = `${userId}/photo.jpg`
      const { error } = await supabase.storage.from('profile-photos').upload(path, await cropPortrait(f), { upsert: true, contentType: 'image/jpeg' })
      if (error) throw error
      set('photo_path', path)
      await supabase.from('profiles').upsert({ id: userId, photo_path: path })
      await sign(path); setMsg('Photo updated.')
    } catch (e) { setMsg('Upload failed: ' + (e as Error).message) }
    setBusy(false)
  }
  async function removePhoto() {
    if (!p.photo_path) return
    await supabase.storage.from('profile-photos').remove([p.photo_path])
    await supabase.from('profiles').upsert({ id: userId, photo_path: null })
    set('photo_path', ''); setPhotoUrl(''); setMsg('Photo removed.')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-xl font-semibold">Profile</h1><span className="text-sm text-gray-600">{pct}% complete</span></div>
      <section className="bg-white border border-[#e3e6eb] rounded-lg p-4 flex gap-4 items-center">
        <div className="w-24 h-32 bg-[#eef0f3] rounded overflow-hidden grid place-items-center text-xs text-gray-500">
          {photoUrl ? <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" /> : 'No photo'}
        </div>
        <div className="space-y-2">
          <label className="btn2 inline-block cursor-pointer">Upload photo<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => upload(e.target.files?.[0])} /></label>
          {photoUrl && <button className="btn2 block" onClick={removePhoto}>Remove photo</button>}
          <p className="text-xs text-gray-500">Cropped to portrait without stretching. Stored privately.</p>
        </div>
      </section>
      <section className="bg-white border border-[#e3e6eb] rounded-lg p-4 grid sm:grid-cols-2 gap-3">
        {FIELDS.map(([k, label, type]) => (
          <label key={k} className="text-sm">{label}
            <input className="inp mt-1" type={type || 'text'} value={p[k] || ''} onChange={e => set(k, e.target.value)} />
          </label>
        ))}
        <label className="text-sm">Age<input className="inp mt-1 bg-gray-50" value={age(p.dob)} readOnly /></label>
      </section>
      {Object.entries(LISTS).map(([l, [title, fields]]) => (
        <section key={l} className="bg-white border border-[#e3e6eb] rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center"><h2 className="font-medium">{title}</h2><button className="btn2" onClick={() => addEntry(l)}>Add</button></div>
          {p[l].length === 0 && <p className="text-sm text-gray-500">No entries yet.</p>}
          {p[l].map((e: Entry, i: number) => (
            <div key={i} className="border border-[#e3e6eb] rounded-md p-3 grid sm:grid-cols-2 gap-2">
              {fields.map(([f, label]) => <input key={f} className="inp" placeholder={label} value={e[f] || ''} onChange={ev => setEntry(l, i, f, ev.target.value)} />)}
              <button className="btn2 sm:col-span-2 justify-self-start" onClick={() => delEntry(l, i)}>Delete entry</button>
            </div>
          ))}
        </section>
      ))}
      <div className="flex items-center gap-3"><button className="btn" disabled={busy} onClick={save}>Save profile</button><span className="text-sm text-gray-600">{msg}</span></div>
    </div>
  )
}
