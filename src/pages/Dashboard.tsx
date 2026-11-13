/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { speak } from '../lib/voice'
import { STATUSES } from './Applications'

export default function Dashboard({ name }: { name: string }) {
  const [d, setD] = useState<{ jobs: any[]; docs: any[]; apps: any[] } | null>(null)
  useEffect(() => {
    Promise.all([supabase.from('jobs').select('id,title,company,match_score,foreign_label,deadline,created_at'), supabase.from('documents').select('kind'), supabase.from('applications').select('status')])
      .then(([j, c, a]) => setD({ jobs: j.data || [], docs: c.data || [], apps: a.data || [] }))
  }, [])
  if (!d) return <p>Loading…</p>
  const today = new Date().toISOString().slice(0, 10), in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)
  const best = d.jobs.filter(j => (j.match_score ?? 0) >= 70).length
  const cnt = (s: string) => d.apps.filter(a => a.status === s).length
  const soon = d.jobs.filter(j => j.deadline && j.deadline >= today && j.deadline <= in7)
  const stats: [string, number][] = [
    ['Jobs saved', d.jobs.length], ['Matching (40%+)', d.jobs.filter(j => (j.match_score ?? 0) >= 40).length], ['Best matches', best],
    ['Foreign-friendly', d.jobs.filter(j => ['Open to foreign applicants', 'Expatriates accepted'].includes(j.foreign_label)).length],
    ['Need confirmation', d.jobs.filter(j => ['Foreign eligibility unknown', 'Employer confirmation required'].includes(j.foreign_label)).length],
    ['CVs', d.docs.filter(x => x.kind === 'cv').length], ['Cover letters', d.docs.filter(x => x.kind === 'cover').length],
    ['Applied', cnt('Applied')], ['Pending', cnt('Pending')], ['Interviews', cnt('Interview')], ['Selected', cnt('Selected')], ['Rejected', cnt('Rejected')],
  ]
  const hr = new Date().getHours()
  const hello = `${hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'}${name ? ', ' + name : ''}. You have ${d.jobs.length} saved jobs, ${best} best matches, and ${soon.length} deadlines in the next 7 days.`
  const max = Math.max(1, ...STATUSES.map(cnt))
  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#e3e6eb] rounded-lg p-4 flex justify-between gap-3 items-center"><p className="text-sm">{hello}</p><button className="btn2 shrink-0" onClick={() => speak(hello)}>Read aloud</button></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{stats.map(([l, n]) => <div key={l} className="bg-white border border-[#e3e6eb] rounded-lg p-3"><div className="text-2xl font-semibold">{n}</div><div className="text-xs text-gray-600">{l}</div></div>)}</div>
      <div className="bg-white border border-[#e3e6eb] rounded-lg p-4 space-y-1"><b className="text-sm">Applications by status</b>
        {STATUSES.map(s => <div key={s} className="flex items-center gap-2 text-xs"><span className="w-24">{s}</span><div className="h-3 bg-[#2f6fd6] rounded" style={{ width: `${(cnt(s) / max) * 60}%`, minWidth: cnt(s) ? 6 : 0 }} /><span>{cnt(s)}</span></div>)}</div>
      <div className="bg-white border border-[#e3e6eb] rounded-lg p-4 text-sm"><b>Deadlines in 7 days</b>{soon.length === 0 ? <p className="text-gray-600">None.</p> : <ul className="list-disc ml-5">{soon.map(j => <li key={j.id}>{j.title}, {j.company}: {j.deadline}</li>)}</ul>}</div>
    </div>
  )
}
