import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, configured } from './lib/supabase'
import Login from './pages/Login'
import Profile from './pages/Profile'
import Dashboard from './pages/Dashboard'
import Jobs from './pages/Jobs'
import Docs from './pages/Docs'
import Applications from './pages/Applications'
import Assistant from './pages/Assistant'
import Updates from './pages/Updates'
import Settings from './pages/Settings'

const pages = ['Dashboard', 'Jobs', 'CVs', 'Applications', 'Updates', 'Assistant', 'Profile', 'Settings'] as const
type Page = typeof pages[number]

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [page, setPage] = useState<Page>('Dashboard')
  const [unread, setUnread] = useState(0)
  const nav = (p: string) => { const f = pages.find(x => x.toLowerCase() === p.toLowerCase()); if (f) setPage(f) }
  const refresh = useCallback(async () => {
    const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('read', false)
    setUnread(count || 0)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => { if (session) refresh() }, [session, page, refresh])

  if (!configured) return <p className="p-6">Add your Supabase URL and anon key to a .env file (see .env.example), then restart.</p>
  if (!ready) return <p className="p-6">Loading…</p>
  if (!session) return <Login />
  const uid = session.user.id

  return (
    <div className="min-h-screen md:flex">
      <nav className="bg-white border-b md:border-b-0 md:border-r border-[#e3e6eb] md:w-56 p-3 flex md:flex-col gap-1 overflow-x-auto">
        <b className="hidden md:block px-3 py-2">Job Assistant</b>
        {pages.map(n => (
          <button key={n} onClick={() => setPage(n)} className={`text-left px-3 py-2 rounded-md text-sm whitespace-nowrap ${page === n ? 'bg-[#e8f0fc] text-[#1f57ad]' : ''}`}>{n}{n === 'Updates' && unread > 0 ? ` (${unread})` : ''}</button>
        ))}
        <button className="btn2 md:mt-auto" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </nav>
      <main className="flex-1 p-4 md:p-8 max-w-5xl">
        {page === 'Dashboard' ? <Dashboard name={(session.user.email || '').split('@')[0]} />
          : page === 'Jobs' ? <Jobs userId={uid} />
          : page === 'CVs' ? <Docs userId={uid} />
          : page === 'Applications' ? <Applications />
          : page === 'Updates' ? <Updates onChange={refresh} />
          : page === 'Assistant' ? <Assistant nav={nav} />
          : page === 'Settings' ? <Settings userId={uid} />
          : <Profile userId={uid} />}
      </main>
    </div>
  )
}
