/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ai } from '../lib/ai'
import { clean } from '../lib/doc'
import Discover from './Discover'
import Kit from './Kit'

export const CATS = ['IT', 'Hotel', 'Cleaning', 'Restaurant', 'Technical', 'Other']
const LABELS = ['Open to foreign applicants', 'Expatriates accepted', 'Maldivian citizens only', 'Foreign eligibility unknown', 'Employer confirmation required']
const today = () => new Date().toISOString().slice(0, 10)
const group = (s: number | null) => (s == null ? 'Not scored' : s >= 70 ? 'Best match' : s >= 40 ? 'Possible' : 'Not suitable')
const expired = (j: any) => j.deadline && j.deadline < today()

export default function Jobs({ userId }: { userId: string }) {
  const [jobs, setJobs] = useState<any[]>([])
  const [sel, setSel] = useState<any>(null)
  const [f, setF] = useState({ q: '', cat: '', label: '', group: '', sort: 'score' })
  const [add, setAdd] = useState({ text: '', url: '', source: '' })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState('')
  const [photo, setPhoto] = useState(true)

  async function load() {
    const { data, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false })
    if (error) return setMsg(error.message)
    setJobs(data || []); setSel((s: any) => (s ? (data || []).find((j: any) => j.id === s.id) || null : null))
  }
  useEffect(() => { load() }, [])
  async function run(name: string, fn: () => Promise<string | void>) {
    setBusy(name); setMsg('')
    try { const m = await fn(); if (m) setMsg(m) } catch (e) { setMsg((e as Error).message) }
    setBusy('')
  }
  async function profile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (!data || !data.full_name) throw new Error('Complete your profile first.')
    delete data.photo_path; return data
  }
  const addJob = () => run('add', async () => {
    if (add.text.trim().length < 30) return 'Paste the full job post text.'
    const j = await ai('parse_job', { text: add.text })
    if (!j.title) return 'No job title found in that text.'
    if (jobs.find(x => (add.url && x.url === add.url) || (x.title === j.title && x.company === j.company))) return 'This job is already saved.'
    const { error } = await supabase.from('jobs').insert({
      user_id: userId, title: j.title, company: j.company, location: j.location, salary: j.salary,
      category: CATS.includes(j.category) ? j.category : 'Other',
      foreign_label: LABELS.includes(j.foreign_label) ? j.foreign_label : 'Foreign eligibility unknown',
      deadline: j.deadline || null, description: j.description || add.text, url: add.url || null,
      source: add.source || 'Pasted by me', retrieved_at: new Date().toISOString(),
    })
    if (error) throw error
    setAdd({ text: '', url: '', source: '' }); await load()
    return 'Job saved. Check the details yourself, especially foreign-worker eligibility.'
  })
  const match = (j: any) => run('match', async () => {
    const r = await ai('match', { job: j, profile: await profile() })
    const { error } = await supabase.from('jobs').update({ match_score: r.score, match_why: r.why, match_missing: r.missing, match_note: r.eligibility_note }).eq('id', j.id)
    if (error) throw error; await load()
  })
  const gen = (j: any, kind: 'cv' | 'cover') => run(kind, async () => {
    const r = await ai(kind, { job: j, profile: await profile() })
    const { error } = await supabase.from('documents').insert({ user_id: userId, job_id: j.id, kind, title: `${kind === 'cv' ? 'CV' : 'Cover letter'}: ${j.title}${j.company ? ' at ' + j.company : ''}`, content: clean(r.html), with_photo: kind === 'cv' && photo })
    if (error) throw error
    return 'Saved. Open the CVs tab to edit or download it.'
  })
  const prepare = (j: any) => run('prep', async () => {
    const { data: ex } = await supabase.from('applications').select('id').eq('job_id', j.id)
    if (ex?.length) return 'Already in Applications.'
    const { data: docs } = await supabase.from('documents').select('id,kind').eq('job_id', j.id).order('created_at', { ascending: false })
    const { error } = await supabase.from('applications').insert({ user_id: userId, job_id: j.id, company: j.company, title: j.title, url: j.url, status: 'Prepared', cv_id: docs?.find(d => d.kind === 'cv')?.id, cover_id: docs?.find(d => d.kind === 'cover')?.id })
    if (error) throw error
    return 'Added to Applications as Prepared. Nothing has been submitted.'
  })
  const remove = (j: any) => run('del', async () => { await supabase.from('jobs').delete().eq('id', j.id); setSel(null); await load() })

  const list = jobs
    .filter(j => (!f.q || (j.title + ' ' + (j.company || '')).toLowerCase().includes(f.q.toLowerCase())) && (!f.cat || j.category === f.cat) && (!f.label || j.foreign_label === f.label) && (!f.group || group(j.match_score) === f.group))
    .sort((a, b) => (f.sort === 'score' ? (b.match_score ?? -1) - (a.match_score ?? -1) : f.sort === 'deadline' ? (a.deadline || '9').localeCompare(b.deadline || '9') : 0))
  const warn = (j: any) => ['Foreign eligibility unknown', 'Employer confirmation required', 'Maldivian citizens only'].includes(j.foreign_label)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Jobs</h1>
      <details className="bg-white border border-[#e3e6eb] rounded-lg p-4">
        <summary className="cursor-pointer font-medium">Add a job</summary>
        <div className="space-y-2 mt-3">
          <textarea className="inp" rows={6} placeholder="Paste the full job post text from the employer's page" value={add.text} onChange={e => setAdd({ ...add, text: e.target.value })} />
          <div className="grid sm:grid-cols-2 gap-2">
            <input className="inp" placeholder="Official application link" value={add.url} onChange={e => setAdd({ ...add, url: e.target.value })} />
            <input className="inp" placeholder="Source (e.g. company career page)" value={add.source} onChange={e => setAdd({ ...add, source: e.target.value })} />
          </div>
          <button className="btn" disabled={!!busy} onClick={addJob}>{busy === 'add' ? 'Reading…' : 'Save job'}</button>
        </div>
      </details>
      <Discover onDone={load} />
      <div className="grid sm:grid-cols-5 gap-2">
        <input className="inp" placeholder="Search" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} />
        <select className="inp" value={f.cat} onChange={e => setF({ ...f, cat: e.target.value })}><option value="">All categories</option>{CATS.map(c => <option key={c}>{c}</option>)}</select>
        <select className="inp" value={f.label} onChange={e => setF({ ...f, label: e.target.value })}><option value="">Any foreign eligibility</option>{LABELS.map(c => <option key={c}>{c}</option>)}</select>
        <select className="inp" value={f.group} onChange={e => setF({ ...f, group: e.target.value })}><option value="">All matches</option>{['Best match', 'Possible', 'Not suitable', 'Not scored'].map(c => <option key={c}>{c}</option>)}</select>
        <select className="inp" value={f.sort} onChange={e => setF({ ...f, sort: e.target.value })}><option value="score">Sort: match</option><option value="deadline">Sort: deadline</option><option value="new">Sort: newest</option></select>
      </div>
      {msg && <p className="text-sm bg-[#e8f0fc] rounded p-2">{msg}</p>}
      {list.length === 0 && <p className="text-sm text-gray-600">No jobs yet. Add one above.</p>}
      <div className="grid md:grid-cols-2 gap-3 items-start">
        <div className="space-y-2">
          {list.map(j => (
            <button key={j.id} onClick={() => setSel(j)} className={`w-full text-left bg-white border rounded-lg p-3 ${sel?.id === j.id ? 'border-[#2f6fd6]' : 'border-[#e3e6eb]'}`}>
              <div className="flex justify-between gap-2"><b className="text-sm">{j.title}</b><span className="text-sm">{j.match_score == null ? '' : j.match_score + '%'}</span></div>
              <div className="text-xs text-gray-600">{j.company || 'Unknown employer'} · {j.location || 'Location not stated'} · {j.category}</div>
              <div className="text-xs mt-1">{group(j.match_score)} {expired(j) && <span className="text-red-700">· Expired</span>}</div>
              <div className={`text-xs ${warn(j) ? 'text-amber-700' : 'text-green-700'}`}>{j.foreign_label}</div>
            </button>
          ))}
        </div>
        {sel && (
          <div className="bg-white border border-[#e3e6eb] rounded-lg p-4 space-y-3 text-sm">
            <h2 className="font-semibold text-base">{sel.title}</h2>
            <p>{sel.company || 'Unknown employer'} · {sel.location || 'Location not stated'}<br />Salary: {sel.salary || 'Not stated'} · Deadline: {sel.deadline || 'Not stated'}{expired(sel) && ' (expired)'}<br />Source: {sel.source} (retrieved {sel.retrieved_at?.slice(0, 10)})</p>
            {warn(sel) && <p className="text-amber-800 bg-amber-50 rounded p-2">Foreign eligibility is not confirmed. Contact the employer about work permit and visa sponsorship before applying.</p>}
            <p className="whitespace-pre-wrap max-h-48 overflow-auto text-gray-700">{sel.description}</p>
            {sel.match_score != null && (
              <div><b>Why you match</b><ul className="list-disc ml-5">{(sel.match_why || []).map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
                <b>Missing</b><ul className="list-disc ml-5">{(sel.match_missing || []).map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
                {sel.match_note && <p>Eligibility: {sel.match_note}</p>}</div>
            )}
            <label className="flex gap-2 items-center"><input type="checkbox" checked={photo} onChange={e => setPhoto(e.target.checked)} />Include my photo in the CV</label>
            <div className="flex flex-wrap gap-2">
              <button className="btn2" disabled={!!busy} onClick={() => match(sel)}>{busy === 'match' ? 'Checking…' : 'Check match'}</button>
              <button className="btn2" disabled={!!busy} onClick={() => gen(sel, 'cv')}>{busy === 'cv' ? 'Writing…' : 'Generate CV'}</button>
              <button className="btn2" disabled={!!busy} onClick={() => gen(sel, 'cover')}>{busy === 'cover' ? 'Writing…' : 'Cover letter'}</button>
              <button className="btn2" disabled={!!busy} onClick={() => prepare(sel)}>Prepare application</button>
              {sel.url && <a className="btn" href={sel.url} target="_blank" rel="noreferrer">Open application page</a>}
              <button className="btn2" onClick={() => confirm('Delete this job?') && remove(sel)}>Delete</button>
            </div>
            <Kit job={sel} userId={userId} />
          </div>
        )}
      </div>
    </div>
  )
}
