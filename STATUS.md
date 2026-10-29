# Glyph site status (Oct 29 2026)
- Live: https://glyph-site-production.up.railway.app
- Repo: https://github.com/benjee-inc/glyph (main, auto-deploys on push)
- Railway: project glyph 694d294f-9871-4d75-8b55-07f922406e74, service glyph-site 641a0865-cf70-467b-9169-5431715c3598, env production 6a179364-c142-4d88-878c-3a5f0508a20c
- Build: Dockerfile (caddy:2-alpine) on $PORT
- Waitlist: STUB. Saves email in the browser (localStorage) and opens a mailto to fantasticfauna@mail.grokbot.com. Nothing is stored server-side. Swap in Formspree/Tally when there is a Glyph email.
