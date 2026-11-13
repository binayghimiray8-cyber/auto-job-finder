# Private Maldives Job Assistant
## Setup
1. Create a Supabase project. In the SQL Editor run supabase/schema.sql, then supabase/schema2.sql.
2. Authentication > Providers > Email: turn OFF "Allow new users to sign up". Add your own user under Authentication > Users.
3. Copy .env.example to .env (project URL + anon key only).
4. Gemini key stays on the server: install the Supabase CLI, then
   supabase login; supabase link --project-ref YOUR_REF
   supabase secrets set GEMINI_API_KEY=your_key   (optional: GEMINI_MODEL=model-name)
   supabase functions deploy ai
5. npm install, npm run dev
## Notes
- Jobs are added by pasting the employer's post text (AI extracts fields). Nothing is invented; unknown fields stay unknown.
- PDF: use Download PDF, then choose "Save as PDF" in the print dialog.
- Applications are never submitted by the app. You set statuses yourself.
- Voice uses browser speech (microphone + text-to-speech). Gemini Live streaming is not included.
## Added in v2
- Run supabase/schema3.sql. Deploy: supabase functions deploy discover; supabase functions deploy live-token
- Optional secrets: GEMINI_LIVE_MODEL, GEMINI_VOICE (check Google's current Live model and voice names; defaults may need updating).
- Jobs > Automatic job discovery: add RSS/Atom feed URLs you find on employer or job sites, then Search now.
- Assistant > Talk to assistant: Gemini Live voice (needs HTTPS or localhost and microphone permission). It reads your updates first, and can run tasks via tools; data changes ask you to confirm on screen.
- Application kit: bookmarklet fills empty text fields on the employer's form; it never submits.
