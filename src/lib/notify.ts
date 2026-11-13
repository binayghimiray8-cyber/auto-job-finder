import { supabase } from './supabase'
export const KINDS: [string, string][] = [['new_jobs', 'New matching or discovered jobs'], ['new_it', 'New IT jobs'], ['new_foreign', 'Jobs accepting foreign workers'], ['deadline', 'Approaching deadlines'], ['status', 'Employer responses and application status']]
export const prefOn = (k: string) => localStorage.getItem('np_' + k) !== '0'
export const setPref = (k: string, v: boolean) => localStorage.setItem('np_' + k, v ? '1' : '0')
export async function notify(kind: string, title: string, body: string, ref: string) {
  await supabase.from('notifications').upsert({ kind, title, body, ref }, { onConflict: 'user_id,kind,ref', ignoreDuplicates: true })
}
export async function checkDeadlines() {
  const t = new Date().toISOString().slice(0, 10), e = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10)
  const { data } = await supabase.from('jobs').select('id,title,company,deadline').gte('deadline', t).lte('deadline', e)
  for (const j of data || []) await notify('deadline', `Deadline soon: ${j.title}`, `${j.company || 'Employer'} closes on ${j.deadline}`, j.id)
}
