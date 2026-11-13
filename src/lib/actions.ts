/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from './supabase'
import { ai } from './ai'
import { clean } from './doc'
import { STATUSES } from '../pages/Applications'
import { notify } from './notify'

const S = { type: 'STRING' }
const obj = (properties: any, required: string[] = []) => ({ type: 'OBJECT', properties, required })
export const TOOLS = [
  { name: 'list_jobs', description: 'List saved jobs. group: best, foreign, it or all.', parameters: obj({ group: S, limit: { type: 'NUMBER' } }) },
  { name: 'get_updates', description: 'Unread notifications and current application statuses.' },
  { name: 'find_new_jobs', description: 'Search the job feeds the user configured for new vacancies.' },
  { name: 'check_match', description: 'Score one saved job against the profile.', parameters: obj({ job_id: S }, ['job_id']) },
  { name: 'generate_cv', description: 'Create a tailored CV for a saved job.', parameters: obj({ job_id: S }, ['job_id']) },
  { name: 'generate_cover_letter', description: 'Create a cover letter for a saved job.', parameters: obj({ job_id: S }, ['job_id']) },
  { name: 'prepare_application', description: 'Add a job to Applications as Prepared. Does not submit anything.', parameters: obj({ job_id: S }, ['job_id']) },
  { name: 'update_application_status', description: 'Change an application status after the user confirms on screen.', parameters: obj({ application_id: S, status: S }, ['application_id', 'status']) },
  { name: 'open_page', description: 'Open a page: Dashboard, Jobs, CVs, Applications, Updates, Profile.', parameters: obj({ page: S }, ['page']) },
  { name: 'open_application_page', description: "Open a job's official application page after the user confirms.", parameters: obj({ job_id: S }, ['job_id']) },
]

export async function runTool(name: string, a: any, nav: (p: string) => void): Promise<any> {
  const job = async () => { const { data } = await supabase.from('jobs').select('*').eq('id', a.job_id).maybeSingle(); if (!data) throw new Error('Job not found. Call list_jobs for valid ids.'); return data }
  const prof = async () => { const { data } = await supabase.from('profiles').select('*').maybeSingle(); if (!data?.full_name) throw new Error('Profile incomplete. Ask the user to complete it.'); delete data.photo_path; return data }
  if (name === 'list_jobs') {
    let q = supabase.from('jobs').select('id,title,company,location,category,foreign_label,deadline,match_score').order('match_score', { ascending: false, nullsFirst: false }).limit(a.limit || 8)
    if (a.group === 'best') q = q.gte('match_score', 70)
    if (a.group === 'foreign') q = q.in('foreign_label', ['Open to foreign applicants', 'Expatriates accepted'])
    if (a.group === 'it') q = q.eq('category', 'IT')
    return (await q).data
  }
  if (name === 'get_updates') return { unread: (await supabase.from('notifications').select('title,body').eq('read', false).limit(10)).data, applications: (await supabase.from('applications').select('id,title,company,status,interview_at,response')).data }
  if (name === 'find_new_jobs') { const { data, error } = await supabase.functions.invoke('discover'); if (error || data?.error) throw new Error(data?.error || error?.message); return data }
  if (name === 'check_match') {
    const j = await job(), r = await ai('match', { job: j, profile: await prof() })
    await supabase.from('jobs').update({ match_score: r.score, match_why: r.why, match_missing: r.missing, match_note: r.eligibility_note }).eq('id', j.id); return r
  }
  if (name === 'generate_cv' || name === 'generate_cover_letter') {
    const j = await job(), kind = name === 'generate_cv' ? 'cv' : 'cover', r = await ai(kind, { job: j, profile: await prof() })
    const { error } = await supabase.from('documents').insert({ job_id: j.id, kind, title: `${kind === 'cv' ? 'CV' : 'Cover letter'}: ${j.title}`, content: clean(r.html), with_photo: kind === 'cv' })
    if (error) throw error; return { saved: true, note: 'Saved in the CVs page for review. The user must review and edit it.' }
  }
  if (name === 'prepare_application') {
    const j = await job(); if ((await supabase.from('applications').select('id').eq('job_id', j.id)).data?.length) return { note: 'Already prepared.' }
    const { error } = await supabase.from('applications').insert({ job_id: j.id, company: j.company, title: j.title, url: j.url, status: 'Prepared' }); if (error) throw error
    return { prepared: true, submitted: false }
  }
  if (name === 'update_application_status') {
    if (!STATUSES.includes(a.status)) throw new Error('Invalid status. Valid: ' + STATUSES.join(', '))
    const { data: ap } = await supabase.from('applications').select('title,company').eq('id', a.application_id).maybeSingle(); if (!ap) throw new Error('Application not found.')
    if (!confirm(`Set "${ap.title}" (${ap.company}) to ${a.status}?`)) return { cancelled: true }
    const { error } = await supabase.from('applications').update({ status: a.status }).eq('id', a.application_id); if (error) throw error
    await notify('status', `${ap.title}: ${a.status}`, ap.company || '', a.application_id + a.status); return { updated: true }
  }
  if (name === 'open_page') { nav(a.page); return { opened: a.page } }
  if (name === 'open_application_page') {
    const j = await job(); if (!j.url) return { error: 'No application link saved for this job.' }
    if (!confirm('Open the application page for ' + j.title + '?')) return { cancelled: true }
    window.open(j.url, '_blank', 'noopener'); return { opened: j.url }
  }
  throw new Error('Unknown tool')
}
