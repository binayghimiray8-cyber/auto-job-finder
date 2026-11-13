import { supabase } from './supabase'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ai(action: string, payload: object): Promise<any> {
  const { data, error } = await supabase.functions.invoke('ai', { body: { action, ...payload } })
  if (error) throw new Error('AI service unavailable: ' + error.message)
  if (data?.error) throw new Error(data.error)
  return data
}
