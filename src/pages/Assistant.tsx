/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ai } from '../lib/ai'
import { Live } from '../lib/live'
import { TOOLS, runTool } from '../lib/actions'

type Msg = { role: 'user' | 'assistant'; text: string }
export default function Assistant({ nav }: { nav: (p: string) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState('off')
  const [muted, setMuted] = useState(false)
  const [err, setErr] = useState('')
  const live = useRef<Live | null>(null)
  const save = (role: string, text: string) => { setMsgs(m => [...m, { role: role as Msg['role'], text }]); supabase.from('conversations').insert({ role, text }).then(() => {}) }
  useEffect(() => {
    supabase.from('conversations').select('role,text').order('created_at', { ascending: false }).limit(40).then(r => setMsgs((r.data || []).reverse() as Msg[]))
    return () => live.current?.stop()
  }, [])

  async function context() {
    const [n, a, j, p] = await Promise.all([
      supabase.from('notifications').select('id,title,body').eq('read', false).limit(10),
      supabase.from('applications').select('id,title,company,status,interview_at,response'),
      supabase.from('jobs').select('id,title,company,match_score,foreign_label,deadline').limit(60),
      supabase.from('profiles').select('full_name,skills,languages,city,country,education,experience,projects').maybeSingle()])
    return { n, a, j, p }
  }
  async function startLive() {
    setErr('')
    try {
      const c = await context()
      const system = `You are the user's private job-search voice assistant for Maldives jobs. Speak English in a warm, brief, professional tone. Use ONLY the DATA and tool results; never invent jobs, salaries, eligibility, qualifications or application results. Remember which job is being discussed and resolve follow-ups like "this job". Use tools to do tasks. Before changing data or opening pages, say what you will do; the app asks the user to confirm. Never claim an application was submitted. Applications are submitted only by the user.\nDATA: ${JSON.stringify({ profile: c.p.data, unread_updates: c.n.data, applications: c.a.data, jobs: c.j.data })}`
      const opening = `Greet me by name in one sentence, then tell me my unread updates (new jobs, deadlines, employer responses, status changes) from DATA. If there are none, say so. Then ask what I'd like to do.`
      live.current = new Live({ system, opening, tools: TOOLS, onState: s => setState(s), onText: (r, t) => save(r, t), onTool: (n, a) => runTool(n, a, nav) })
      await live.current.start()
      if (c.n.data?.length) await supabase.from('notifications').update({ read: true }).in('id', c.n.data.map((x: any) => x.id))
    } catch (e) { setState('off'); setErr((e as Error).message + ' (Check microphone permission and that live-token is deployed.)') }
  }
  function stopLive() { live.current?.stop(); setState('off') }
  async function send(text: string) {
    if (!text.trim() || busy) return
    const history = msgs.slice(-10); save('user', text); setInput(''); setBusy(true)
    try { const c = await context(); const r = await ai('chat', { message: text, history, data: { jobs: c.j.data, applications: c.a.data, profile: c.p.data, updates: c.n.data } }); save('assistant', r.text) }
    catch (e) { setMsgs(m => [...m, { role: 'assistant', text: 'AI unavailable: ' + (e as Error).message + '. The rest of the app still works.' }]) }
    setBusy(false)
  }
  const on = state === 'live' || state === 'connecting'
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Assistant</h1>
      <div className="flex flex-wrap gap-2 items-center">
        <button className="btn" onClick={on ? stopLive : startLive}>{on ? 'End voice chat' : 'Talk to assistant'}</button>
        {on && <button className="btn2" onClick={() => { const m = !muted; setMuted(m); if (live.current) live.current.muted = m }}>{muted ? 'Unmute microphone' : 'Mute microphone'}</button>}
        <button className="btn2" onClick={async () => { await supabase.from('conversations').delete().neq('role', ''); setMsgs([]) }}>Clear history</button>
        <span className="text-sm text-gray-600">{state === 'connecting' ? 'Connecting…' : state === 'live' ? 'Listening' : state === 'error' ? 'Voice error' : ''}</span>
      </div>
      {err && <p className="text-sm text-red-700">{err} Text chat below still works.</p>}
      <div className="bg-white border border-[#e3e6eb] rounded-lg p-3 min-h-64 space-y-2 text-sm">
        {msgs.length === 0 && <p className="text-gray-500">Press "Talk to assistant" to hear your updates, or type below.</p>}
        {msgs.map((m, i) => <p key={i} className={m.role === 'user' ? 'text-right' : ''}><span className={`inline-block rounded-lg px-3 py-2 ${m.role === 'user' ? 'bg-[#e8f0fc]' : 'bg-[#f1f3f6]'}`}>{m.text}</span></p>)}
        {busy && <p className="text-gray-500">Thinking…</p>}
      </div>
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); send(input) }}><input className="inp" placeholder="Type to the assistant" value={input} onChange={e => setInput(e.target.value)} /><button className="btn">Send</button></form>
    </div>
  )
}
