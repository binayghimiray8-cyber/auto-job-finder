/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { clean, printDoc } from '../lib/doc'

export default function Docs({ userId }: { userId: string }) {
  const [docs, setDocs] = useState<any[]>([])
  const [sel, setSel] = useState<any>(null)
  const [msg, setMsg] = useState('')
  const ed = useRef<HTMLDivElement>(null)
  const load = async () => { const { data } = await supabase.from('documents').select('*').order('created_at', { ascending: false }); setDocs(data || []) }
  useEffect(() => { load() }, [])
  async function save() {
    const html = clean(ed.current!.innerHTML)
    const { error } = await supabase.from('documents').update({ content: html }).eq('id', sel.id)
    setMsg(error ? error.message : 'Saved.'); load()
  }
  async function pdf() {
    let url: string | null = null
    if (sel.kind === 'cv' && sel.with_photo) {
      const { data: p } = await supabase.from('profiles').select('photo_path').eq('id', userId).maybeSingle()
      if (p?.photo_path) url = (await supabase.storage.from('profile-photos').createSignedUrl(p.photo_path, 600)).data?.signedUrl ?? null
      else setMsg('No profile photo found; creating the CV without one.')
    }
    printDoc(clean(ed.current!.innerHTML), url, sel.title)
  }
  async function del() { await supabase.from('documents').delete().eq('id', sel.id); setSel(null); load() }
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">CVs and cover letters</h1>
      {docs.length === 0 && <p className="text-sm text-gray-600">Nothing yet. Generate a CV or cover letter from a job.</p>}
      <div className="grid md:grid-cols-3 gap-3 items-start">
        <div className="space-y-2">{docs.map(d => (
          <button key={d.id} onClick={() => { setSel(d); setMsg('') }} className={`w-full text-left bg-white border rounded-lg p-3 text-sm ${sel?.id === d.id ? 'border-[#2f6fd6]' : 'border-[#e3e6eb]'}`}>{d.title}<div className="text-xs text-gray-500">{d.created_at.slice(0, 10)}</div></button>
        ))}</div>
        {sel && (
          <div className="md:col-span-2 bg-white border border-[#e3e6eb] rounded-lg p-4 space-y-3">
            <div ref={ed} key={sel.id} contentEditable suppressContentEditableWarning className="border border-[#e3e6eb] rounded p-4 min-h-64 text-sm leading-relaxed [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:font-semibold [&_h2]:border-b [&_h2]:mt-3 [&_ul]:list-disc [&_ul]:ml-5" dangerouslySetInnerHTML={{ __html: clean(sel.content) }} />
            <div className="flex flex-wrap gap-2 items-center">
              <button className="btn" onClick={save}>Save edits</button>
              <button className="btn2" onClick={pdf}>Download PDF</button>
              <button className="btn2" onClick={() => navigator.clipboard.writeText(ed.current!.innerText).then(() => setMsg('Copied.'))}>Copy text</button>
              <button className="btn2" onClick={() => confirm('Delete?') && del()}>Delete</button>
              <span className="text-sm text-gray-600">{msg}</span>
            </div>
            <p className="text-xs text-gray-500">Edit directly in the box. To regenerate, create a new one from the job. Review everything for accuracy before sending.</p>
          </div>
        )}
      </div>
    </div>
  )
}
