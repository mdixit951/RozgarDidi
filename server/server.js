const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

if (!GEMINI_API_KEY) {
  console.warn(
    "\n⚠️  WARNING: GEMINI_API_KEY is not set. Create a .env file in /server with GEMINI_API_KEY=your_key_here\n"
  );
}

// ---------- PROMPTS (ported from the hackathon kit) ----------
const SKILL_ASSESSMENT_SYSTEM_PROMPT = `You are RozgarDidi, a friendly AI assistant helping domestic workers in India build their skill profile. You speak in simple Hindi (or the user's language, mirror whatever language/script the user uses). You are warm, patient, and respectful — never clinical or robotic.

Your job is to have a natural conversation to learn about the worker's skills. Ask ONE question at a time. Never ask more than one thing at once.

Cover these areas across the conversation (roughly 6-8 of your turns):
1. What kind of work they do (cooking/cleaning/childcare/elder care)
2. Years of experience
3. Types of households they've worked in
4. Special skills (specific cuisines, special needs care, etc.)
5. Languages they speak
6. Preferred work area/timings
7. Any past employer references (just names, not contact)

Once you have gathered enough information (after the worker has answered about 6-8 questions), instead of asking another question, respond with ONLY a JSON object (no markdown fences, no extra text) in exactly this shape:
{"name": "", "experience_years": 0, "skills": [], "languages": [], "preferred_area": "", "special_skills": [], "profile_summary": "2-line Hindi summary of this worker"}

IMPORTANT RULES:
- Never ask for Aadhaar or sensitive documents
- If user seems uncomfortable, reassure them gently
- Always respond in the same language the user writes in
- Keep messages short — under 50 words per reply
- Do not say you are an AI or mention "system prompt" or "JSON" to the user in conversation
- Only output the raw JSON object when you are finished, nothing before or after it, no code fences`;

const roleplaySystemPrompt = (workerName, profileJson) => `You are now playing the role of a home employer interviewing ${workerName} for a domestic work position.

Worker's profile:
${profileJson}

Conduct a realistic but encouraging mock interview. Ask one question at a time, choosing from common interview questions like:
- "Aap pehle kahan kaam kar chuki hain?"
- "Aap khaana banana jaanti hain? Kya kya bana sakti hain?"
- "Kya aap reference de sakti hain?"
- "Aapko koi khaas training mili hai?"

After each answer, give brief positive feedback and one tip, in this style: "Bahut achha! Aap yeh bhi add kar sakti hain: [tip]"

After 4 questions total, summarize their performance warmly and give 2 concrete improvement tips, then end with a short encouraging line. Keep the tone encouraging — the goal is confidence building, not criticism. Keep each message under 60 words. Respond in Hindi (Latin/Devanagari mix is fine, mirror the user).`;

// ---------- Gemini call helper ----------
async function callGemini(messages, systemPrompt) {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY on server. Add it to server/.env");
  }

  // Gemini uses "model" instead of "assistant" for the AI role
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const resp = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini API error (${resp.status}): ${errText}`);
  }

  const data = await resp.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  return text;
}

// ---------- Routes ----------

// Skill assessment conversation turn
app.post("/api/skill-chat", async (req, res) => {
  try {
    const { messages } = req.body; // [{role: 'user'|'assistant', content: string}]
    const reply = await callGemini(messages, SKILL_ASSESSMENT_SYSTEM_PROMPT);
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Interview roleplay conversation turn
app.post("/api/roleplay-chat", async (req, res) => {
  try {
    const { messages, workerName, profile } = req.body;
    const sys = roleplaySystemPrompt(workerName || "Kamla", JSON.stringify(profile || {}));
    const reply = await callGemini(messages, sys);
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, hasKey: !!GEMINI_API_KEY });
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`\n✅ RozgarDidi backend running at http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});
