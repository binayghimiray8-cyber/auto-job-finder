/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { KINDS, prefOn, setPref, checkDeadlines } from '../lib/notify'

export default function Updates({ onChange }: { onChange: () => void }) {
  const [rows, setRows] = useState<any[]>([])
  const [, tick] = useState(0)
  const load = async () => { await checkDeadlines(); setRows((await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(60)).data || []); onChange() }
  useEffect(() => { load() }, [])
  const shown = rows.filter(r => prefOn(r.kind))
  return (
    <div className="space-y-3">
      <div className="flex justify-between"><h1 className="text-xl font-semibold">Updates</h1><button className="btn2" onClick={async () => { await supabase.from('notifications').update({ read: true }).eq('read', false); load() }}>Mark all read</button></div>
      <p className="text-sm text-gray-600">Replies from employers are not detected automatically. When you get one, record it in Applications and it appears here.</p>
      {shown.length === 0 && <p className="text-sm text-gray-600">No updates.</p>}
      {shown.map(r => (
        <div key={r.id} className={`bg-white border rounded-lg p-3 text-sm ${r.read ? 'border-[#e3e6eb]' : 'border-[#2f6fd6]'}`}><b>{r.title}</b><div className="text-gray-600">{r.body}</div><div className="text-xs text-gray-400">{r.created_at.slice(0, 10)}</div></div>
      ))}
      <details className="bg-white border border-[#e3e6eb] rounded-lg p-4 text-sm"><summary className="cursor-pointer font-medium">Notification preferences</summary>
        {KINDS.map(([k, l]) => <label key={k} className="flex gap-2 mt-2"><input type="checkbox" defaultChecked={prefOn(k)} onChange={e => { setPref(k, e.target.checked); tick(x => x + 1) }} />{l}</label>)}
      </details>
    </div>
  )
}
