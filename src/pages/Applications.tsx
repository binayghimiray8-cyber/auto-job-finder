/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { notify } from '../lib/notify'

export const STATUSES = ['Not Applied', 'Prepared', 'Applied', 'Pending', 'Interview', 'Selected', 'Rejected', 'No Response']

export default function Applications() {
  const [rows, setRows] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const load = async () => { const { data } = await supabase.from('applications').select('*').order('created_at', { ascending: false }); setRows(data || []) }
  useEffect(() => { load() }, [])
  const edit = (id: string, k: string, v: string) => setRows(r => r.map(x => (x.id === id ? { ...x, [k]: v } : x)))
  async function save(a: any) {
    const applied_at = a.status === 'Applied' && !a.applied_at ? new Date().toISOString().slice(0, 10) : a.applied_at || null
    const { error } = await supabase.from('applications').update({ status: a.status, applied_at, interview_at: a.interview_at || null, notes: a.notes, response: a.response }).eq('id', a.id)
    if (!error && (['Interview', 'Selected', 'Rejected'].includes(a.status) || a.response)) await notify('status', `${a.title}: ${a.status}`, a.response || a.company || '', a.id + a.status + (a.response || '').slice(0, 30))
    setMsg(error ? error.message : 'Saved.'); load()
  }
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Applications</h1>
      <p className="text-sm text-gray-600">Statuses are set by you. This app never submits an application or marks one as sent on its own.</p>
      {msg && <p className="text-sm">{msg}</p>}
      {rows.length === 0 && <p className="text-sm text-gray-600">No applications yet. Use "Prepare application" on a job.</p>}
      {rows.map(a => (
        <div key={a.id} className="bg-white border border-[#e3e6eb] rounded-lg p-4 grid sm:grid-cols-2 gap-2 text-sm">
          <div className="sm:col-span-2 flex justify-between"><b>{a.title} · {a.company}</b>{a.url && <a className="text-[#2f6fd6]" href={a.url} target="_blank" rel="noreferrer">Application page</a>}</div>
          <label>Status<select className="inp mt-1" value={a.status} onChange={e => edit(a.id, 'status', e.target.value)}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></label>
          <label>Applied on<input className="inp mt-1" type="date" value={a.applied_at || ''} onChange={e => edit(a.id, 'applied_at', e.target.value)} /></label>
          <label>Interview date<input className="inp mt-1" type="date" value={a.interview_at || ''} onChange={e => edit(a.id, 'interview_at', e.target.value)} /></label>
          <label>Employer response<input className="inp mt-1" value={a.response || ''} onChange={e => edit(a.id, 'response', e.target.value)} /></label>
          <label className="sm:col-span-2">Notes<input className="inp mt-1" value={a.notes || ''} onChange={e => edit(a.id, 'notes', e.target.value)} /></label>
          <button className="btn justify-self-start" onClick={() => save(a)}>Save</button>
        </div>
      ))}
    </div>
  )
}
