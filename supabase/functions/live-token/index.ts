// Issues a short-lived one-use token so the browser can talk to Gemini Live without ever seeing your API key.
// Uses the key saved in the website Settings page (or GEMINI_API_KEY secret). Optional secrets, GEMINI_LIVE_MODEL, GEMINI_VOICE (optional; check Google's current model and voice names).
import { createClient } from 'npm:@supabase/supabase-js@2'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const reply = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } })
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return reply({ error: 'Not signed in' }, 401)
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: st } = await admin.from('user_settings').select('gemini_api_key').eq('user_id', user.id).maybeSingle()
    const KEY = st?.gemini_api_key || Deno.env.get('GEMINI_API_KEY') || ''
    if (!KEY) return reply({ error: 'No Gemini key yet. Open Settings in the menu and paste your Gemini API key.' }, 400)
    const r = await fetch('https://generativelanguage.googleapis.com/v1alpha/auth_tokens', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify({ uses: 1, expireTime: new Date(Date.now() + 30 * 60e3).toISOString(), newSessionExpireTime: new Date(Date.now() + 60e3).toISOString() }),
    })
    const j = await r.json()
    if (!r.ok) return reply({ error: j.error?.message || 'Could not create a voice token' }, 500)
    return reply({ token: j.name, model: Deno.env.get('GEMINI_LIVE_MODEL') || 'gemini-3.8-live', voice: Deno.env.get('GEMINI_VOICE') || 'Aoede' })
  } catch (e) { return reply({ error: (e as Error).message }, 500) }
})
