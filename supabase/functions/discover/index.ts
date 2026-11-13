// Reads RSS/Atom feeds YOU add in the app. It never bypasses logins, CAPTCHAs or blocks; blocked sources are reported as such.
import { createClient } from 'npm:@supabase/supabase-js@2'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const tag = (x: string, t: string) => { const m = x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, 'i')); return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '' }
const strip = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;|&gt;/g, ' ').replace(/\s+/g, ' ').trim()
const cat = (t: string) => /\b(it|computer|web|developer|software|network|data entry|system|digital)\b/i.test(t) ? 'IT' : /receptionist|front office|guest|reservation|cashier|storekeeper/i.test(t) ? 'Hotel' : /housekeep|cleaner|room attendant|laundry/i.test(t) ? 'Cleaning' : /waiter|kitchen|steward|restaurant|food/i.test(t) ? 'Restaurant' : /electrician|maintenance|technician/i.test(t) ? 'Technical' : 'Other'
const label = (t: string) => /maldivians? only|only maldivians?|maldivian nationals? only/i.test(t) ? 'Maldivian citizens only' : /expatriates? (are )?(accepted|welcome)|foreign(ers| applicants| nationals)? (are )?(accepted|welcome)/i.test(t) ? 'Expatriates accepted' : 'Foreign eligibility unknown'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const reply = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } })
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return reply({ error: 'Not signed in' }, 401)
    const { data: sources } = await sb.from('job_sources').select('*')
    const { data: have } = await sb.from('jobs').select('url')
    const seen = new Set((have || []).map((j: any) => j.url))
    const report: any[] = []; let total = 0, it = 0, foreign = 0
    for (const s of sources || []) {
      let status = '', added = 0
      try {
        const r = await fetch(s.url, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'PersonalJobAssistant/1.0' } })
        const x = await r.text()
        if (!r.ok) status = `Source refused access (HTTP ${r.status}). Skipped.`
        else if (!/<item[\s>]|<entry[\s>]/i.test(x)) status = 'Not an RSS or Atom feed. Skipped.'
        else {
          const items = x.split(/<item[\s>]|<entry[\s>]/i).slice(1, 31)
          for (const it0 of items) {
            const title = strip(tag(it0, 'title')); const link = tag(it0, 'link') || (it0.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? '')
            if (!title || !link || seen.has(link)) continue
            const desc = strip(tag(it0, 'description') || tag(it0, 'summary') || tag(it0, 'content')).slice(0, 6000)
            const c = cat(title + ' ' + desc), l = label(desc)
            const { error } = await sb.from('jobs').insert({ title, description: desc, url: link, source: s.name || s.url, category: c, foreign_label: l, retrieved_at: new Date().toISOString() })
            if (!error) { seen.add(link); added++; total++; if (c === 'IT') it++; if (l === 'Expatriates accepted') foreign++ }
          }
          status = `OK, ${added} new`
        }
      } catch (e) { status = 'Could not fetch: ' + (e as Error).message }
      await sb.from('job_sources').update({ last_run: new Date().toISOString(), last_status: status }).eq('id', s.id)
      report.push({ source: s.name || s.url, status })
    }
    const day = new Date().toISOString().slice(0, 10)
    const n = (kind: string, title: string, body: string) => sb.from('notifications').upsert({ kind, title, body, ref: day }, { onConflict: 'user_id,kind,ref', ignoreDuplicates: true })
    if (total) await n('new_jobs', `${total} new jobs found`, 'Open Jobs to review them. Eligibility and match are not yet checked.')
    if (it) await n('new_it', `${it} new IT jobs`, 'Found in your job sources.')
    if (foreign) await n('new_foreign', `${foreign} jobs say expatriates are accepted`, 'Verify with the employer.')
    return reply({ added: total, report })
  } catch (e) { return reply({ error: (e as Error).message }, 500) }
})
