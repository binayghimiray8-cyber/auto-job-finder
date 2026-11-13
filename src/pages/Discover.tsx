/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Discover({ onDone }: { onDone: () => void }) {
  const [src, setSrc] = useState<any[]>([])
  const [f, setF] = useState({ name: '', url: '' })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const load = async () => setSrc((await supabase.from('job_sources').select('*').order('created_at')).data || [])
  useEffect(() => { load() }, [])
  async function add() {
    try { new URL(f.url) } catch { return setMsg('Enter a full feed URL starting with https://') }
    const { error } = await supabase.from('job_sources').insert({ name: f.name || f.url, url: f.url })
    if (error) return setMsg(error.message); setF({ name: '', url: '' }); load()
  }
  async function search() {
    setBusy(true); setMsg('')
    const { data, error } = await supabase.functions.invoke('discover')
    setMsg(error || data?.error ? 'Search failed: ' + (data?.error || error?.message) : `Search finished. ${data.added} new jobs added.`)
    setBusy(false); load(); onDone()
  }
  return (
    <details className="bg-white border border-[#e3e6eb] rounded-lg p-4">
      <summary className="cursor-pointer font-medium">Automatic job discovery ({src.length} sources)</summary>
      <div className="space-y-2 mt-3 text-sm">
        <p className="text-gray-600">Add RSS or Atom feed links from employer career pages or job sites that publish them. Sites without a feed, or that block automated access, are skipped and never bypassed.</p>
        {src.map(s => (
          <div key={s.id} className="flex justify-between gap-2 border border-[#e3e6eb] rounded p-2">
            <div><b>{s.name}</b><div className="text-xs text-gray-500 break-all">{s.url}</div><div className="text-xs">{s.last_status ? `${s.last_status} (${s.last_run?.slice(0, 10)})` : 'Not searched yet'}</div></div>
            <button className="btn2 self-start" onClick={async () => { await supabase.from('job_sources').delete().eq('id', s.id); load() }}>Remove</button>
          </div>
        ))}
        <div className="grid sm:grid-cols-3 gap-2"><input className="inp" placeholder="Name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /><input className="inp sm:col-span-2" placeholder="Feed URL" value={f.url} onChange={e => setF({ ...f, url: e.target.value })} /></div>
        <div className="flex gap-2 items-center"><button className="btn2" onClick={add}>Add source</button><button className="btn" disabled={busy || !src.length} onClick={search}>{busy ? 'Searching…' : 'Search now'}</button><span>{msg}</span></div>
      </div>
    </details>
  )
}
