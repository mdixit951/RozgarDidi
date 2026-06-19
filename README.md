# RozgarDidi — Local Hackathon Prototype

Runs entirely on your laptop. Real Gemini API calls (free tier), simulated
WhatsApp UI, mocked job board. No billing required.

## Folder structure
```
rozgardidi-local/
  server/      <- Express backend (holds your Gemini key, proxies API calls)
  client/      <- React frontend (the WhatsApp-style demo UI)
```

## 1. Set up the backend

```bash
cd server
npm install
```

Your API key is already in `server/.env` (created for you). If you ever need
to replace it, open `server/.env` and edit:
```
GEMINI_API_KEY=your_key_here
```

Start the backend:
```bash
npm start
```

You should see:
```
✅ RozgarDidi backend running at http://localhost:5050
```

Leave this terminal window open and running.

## 2. Set up the frontend (in a NEW terminal window)

```bash
cd client
npm install
npm start
```

This should automatically open `http://localhost:3000` in your browser. If not,
open it manually.

## 3. Demo it

1. Tap the 🎤 mic icon in the chat (don't type — just tap) to send a
   pre-scripted Hindi "voice note." Tap it again for the next line each time.
2. Watch Gemini reply in real time (typing dots show while it's thinking).
3. After ~6 exchanges, a gold "View Skill Card" button appears top-right of
   the chat header — tap it.
4. From the skill card screen: tap "See Job Matches" to see the scoring logic
   run against 4 mocked job listings, or "Practice Interview" to start the
   roleplay simulator (also real Gemini calls).

## Troubleshooting

**"⚠️ Could not send message" / network error in the browser**
→ Make sure the backend terminal is still running and shows no errors.
→ Check `http://localhost:5050/api/health` directly in your browser — it
  should return `{"ok":true,"hasKey":true}`. If `hasKey` is false, your
  `.env` file isn't being read — make sure it's in `server/.env` exactly.

**"Gemini API error (400)" or similar in the backend terminal**
→ Your API key may be malformed or revoked. Go back to
  https://aistudio.google.com → Get API key, and generate a fresh one, then
  paste it into `server/.env` replacing the old value. Restart the backend
  (`Ctrl+C` then `npm start` again).

**"Gemini API error (429)"**
→ You've hit the free-tier rate limit (requests per minute). Wait ~60
  seconds and try again. This is unlikely during a normal demo pace.

**Port already in use**
→ Something else is using port 5050 or 3000. Change `PORT=5050` in
  `server/.env` to e.g. `5051`, and also update `API_BASE` at the top of
  `client/src/App.js` to match.

## What's real vs. mocked

| Layer | Status |
|---|---|
| Skill Assessment Agent | Real, live Gemini API calls |
| Interview Roleplay | Real, live Gemini API calls |
| Job Match Scoring | Real logic (skills 40 / location 25 / language 20 / experience 15) |
| WhatsApp transport | Simulated UI — swapping in real WhatsApp Cloud API is a separate backend webhook |
| Voice/STT (Sarvam AI) | Faked via pre-scripted text "voice notes" — see `SAMPLE_VOICE_NOTES` in `client/src/App.js` |
| Job listings (Apna.co) | Mocked array — see `JOB_LISTINGS` in `client/src/App.js` |

## Security note

Your real API key lives only in `server/.env`, which is gitignored — it
never gets sent to the browser or committed to version control. The
backend is the only thing that talks to Google's servers with the key
attached.

**Recommended:** after the hackathon, revoke this key in AI Studio and
generate a fresh one for any future project, since it was shared in a
chat conversation during setup.
