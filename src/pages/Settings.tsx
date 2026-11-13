import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ai } from '../lib/ai'

const DEFAULT_MODEL = 'gemini-3.6-flash'

export default function Settings({ userId }: { userId: string }) {
  const [hint, setHint] = useState<string | null>(null)
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [key, setKey] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('user_settings').select('key_hint,gemini_model').eq('user_id', userId).maybeSingle()
    setHint(data?.key_hint ?? null)
    if (data?.gemini_model) setModel(data.gemini_model)
  }, [userId])
  useEffect(() => { load() }, [load])

  async function test() {
    setMsg({ ok: true, text: 'Testing your key…' })
    try { await ai('ping', {}); setMsg({ ok: true, text: 'Your Gemini key works. AI features are ready.' }) }
    catch (e) { setMsg({ ok: false, text: 'Saved, but the test failed: ' + (e as Error).message }) }
  }

  async function save() {
    const k = key.trim()
    if (!k && !hint) return setMsg({ ok: false, text: 'Paste your Gemini API key first.' })
    setBusy(true); setMsg(null)
    const row: Record<string, unknown> = { user_id: userId, gemini_model: model.trim() || DEFAULT_MODEL, updated_at: new Date().toISOString() }
    if (k) { row.gemini_api_key = k; row.key_hint = k.slice(-4) }
    const { error } = await supabase.from('user_settings').upsert(row, { onConflict: 'user_id' })
    if (error) { setBusy(false); return setMsg({ ok: false, text: 'Could not save: ' + error.message }) }
    setKey(''); await load(); await test(); setBusy(false)
  }

  async function remove() {
    if (!confirm('Remove your saved Gemini key?')) return
    setBusy(true)
    const { error } = await supabase.from('user_settings').delete().eq('user_id', userId)
    setBusy(false)
    if (error) return setMsg({ ok: false, text: 'Could not remove: ' + error.message })
    setHint(null); setModel(DEFAULT_MODEL); setMsg({ ok: true, text: 'Key removed.' })
  }

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-xl font-semibold">Settings</h1>
      <section className="bg-white border border-[#e3e6eb] rounded-lg p-4 space-y-3">
        <h2 className="font-medium">Gemini API key</h2>
        <p className="text-sm text-[#5b6472]">
          Needed for AI matching, CV and cover letters, and the assistant. Get a free key at{' '}
          <a className="underline text-[#1f57ad]" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>.
          Your key is stored privately in your own Supabase database and is never shown again after saving.
        </p>
        {hint && <p className="text-sm">Saved key: <b>••••••••{hint}</b></p>}
        <div className="flex gap-2">
          <input className="inp" type={show ? 'text' : 'password'} autoComplete="off" spellCheck={false}
            placeholder={hint ? 'Paste a new key to replace it' : 'Paste your Gemini API key (starts with AIza…)'}
            value={key} onChange={e => setKey(e.target.value)} />
          <button type="button" className="btn2" onClick={() => setShow(s => !s)}>{show ? 'Hide' : 'Show'}</button>
        </div>
        <label className="block text-sm">Model
          <input className="inp mt-1" value={model} onChange={e => setModel(e.target.value)} placeholder={DEFAULT_MODEL} />
        </label>
        <p className="text-xs text-[#5b6472]">If you see a "model not found" error, enter a current model name from Google AI Studio.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save and test'}</button>
          {hint && <button className="btn2" disabled={busy} onClick={test}>Test again</button>}
          {hint && <button className="btn2 text-red-700" disabled={busy} onClick={remove}>Remove key</button>}
        </div>
        {msg && <p className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</p>}
      </section>
    </div>
  )
}
