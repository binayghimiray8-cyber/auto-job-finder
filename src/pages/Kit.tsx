/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const FIELDS: [string, string][] = [['full_name', 'Full name'], ['dob', 'Date of birth'], ['email', 'Email'], ['phone', 'Phone'], ['city', 'City'], ['country', 'Country'], ['linkedin', 'LinkedIn'], ['portfolio', 'Portfolio']]
function bookmarklet(p: any) {
  const d = { name: p.full_name, email: p.email, phone: p.phone, city: p.city, country: p.country, linkedin: p.linkedin, website: p.portfolio, dob: p.dob }
  const code = `(()=>{const d=${JSON.stringify(d)};const k={name:/full.?name|your name|^name$/i,email:/e-?mail/i,phone:/phone|mobile|contact number/i,city:/city/i,country:/country/i,linkedin:/linkedin/i,website:/portfolio|website/i,dob:/birth|dob/i};let n=0;document.querySelectorAll('input,textarea').forEach(i=>{if(['hidden','password','file','checkbox','radio'].includes(i.type)||i.value)return;const l=(i.labels&&i.labels[0]?i.labels[0].innerText:'')+' '+(i.name||'')+' '+(i.id||'')+' '+(i.placeholder||'')+' '+(i.getAttribute('aria-label')||'');for(const x in k){if(d[x]&&k[x].test(l)){Object.getOwnPropertyDescriptor(Object.getPrototypeOf(i),'value').set.call(i,d[x]);i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));n++;break}}});alert('Filled '+n+' fields. Review everything, then submit it yourself.')})()`
  return 'javascript:' + encodeURIComponent(code)
}
export default function Kit({ job }: { job: any; userId: string }) {
  const [p, setP] = useState<any>(null)
  const [msg, setMsg] = useState('')
  useEffect(() => { supabase.from('profiles').select('*').maybeSingle().then(r => setP(r.data)) }, [])
  const copy = (t: string) => navigator.clipboard.writeText(t || '').then(() => setMsg('Copied.'))
  async function copyDoc(kind: string) {
    const { data } = await supabase.from('documents').select('content').eq('job_id', job.id).eq('kind', kind).order('created_at', { ascending: false }).limit(1)
    if (!data?.length) return setMsg(`No ${kind === 'cv' ? 'CV' : 'cover letter'} for this job yet.`)
    const d = document.createElement('div'); d.innerHTML = data[0].content; copy(d.innerText)
  }
  if (!p) return null
  return (
    <details className="border border-[#e3e6eb] rounded p-3">
      <summary className="cursor-pointer font-medium">Application kit (autofill)</summary>
      <div className="space-y-2 mt-2">
        <p className="text-xs text-gray-600">Drag this to your bookmarks bar, open the employer's form, click it. It fills only empty text fields it recognizes from your verified profile and never submits.</p>
        <a ref={el => el?.setAttribute('href', bookmarklet(p))} className="btn2 inline-block" onClick={e => e.preventDefault()}>Autofill my details</a>
        <div className="flex flex-wrap gap-1">{FIELDS.filter(([k]) => p[k]).map(([k, l]) => <button key={k} className="btn2" onClick={() => copy(p[k])}>Copy {l}</button>)}</div>
        <div className="flex gap-1"><button className="btn2" onClick={() => copyDoc('cv')}>Copy CV text</button><button className="btn2" onClick={() => copyDoc('cover')}>Copy cover letter</button></div>
        <p className="text-xs">{msg}</p>
      </div>
    </details>
  )
}
