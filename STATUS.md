# Glyph site status
- 2026-10-29 v2 "film" redesign: hero is the caption-free product film (assets/film.mp4, re-composed from the torus render with captions/labels stripped) with HTML lower-thirds synced to the timeline. Stills are frames from the same film. Copy rewritten with OpenAI gpt-4.1 (two rounds), see openai_deslop.json; light human curation for facts.
- 2026-10-29 v5: waitlist is real. Node/Express server (server.js) serves the static site and POST /api/waitlist, which saves emails to Railway Postgres (table `waitlist`, unique on lower(email)). GET /api/health checks the DB. No mailto.
- Live: https://getglyph.up.railway.app (push to main redeploys).
