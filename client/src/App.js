import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Mic,
  Send,
  CheckCircle2,
  MapPin,
  Languages,
  Briefcase,
  Star,
  ArrowLeft,
  Sparkles,
  Phone,
  Video,
  MoreVertical,
} from "lucide-react";

const API_BASE = "http://localhost:5050";

// ---------- MOCK JOB LISTINGS (fake "Apna.co" data) ----------
const JOB_LISTINGS = [
  {
    job_id: "J1",
    title: "Full-time Cook",
    employer: "Sharma Family",
    area: "Andheri West, Mumbai",
    salary: "₹14,000–16,000/mo",
    languages: ["Hindi", "Marathi"],
    skills_required: ["cooking", "north indian", "south indian"],
    min_experience: 3,
  },
  {
    job_id: "J2",
    title: "Cook + Light Housekeeping",
    employer: "Mehta Residence",
    area: "Bandra, Mumbai",
    salary: "₹18,000–20,000/mo",
    languages: ["Hindi", "English"],
    skills_required: ["cooking", "cleaning", "gujarati cuisine"],
    min_experience: 5,
  },
  {
    job_id: "J3",
    title: "Elder Care + Cooking",
    employer: "Kapoor Household",
    area: "Powai, Mumbai",
    salary: "₹16,000–19,000/mo",
    languages: ["Hindi"],
    skills_required: ["cooking", "elder care"],
    min_experience: 2,
  },
  {
    job_id: "J4",
    title: "Part-time Cleaning",
    employer: "Iyer Apartment",
    area: "Chembur, Mumbai",
    salary: "₹6,000–8,000/mo",
    languages: ["Tamil", "Hindi"],
    skills_required: ["cleaning"],
    min_experience: 0,
  },
];

const SAMPLE_VOICE_NOTES = [
  "Namaste, main Kamla bol rahi hoon. Main 11 saal se Mumbai mein khaana banane ka kaam karti hoon.",
  "Main do families ke ghar mein kaam karti hoon, dono full-time households hain.",
  "Mujhe North Indian aur South Indian dono cuisine banana aata hai, aur thoda Gujarati bhi.",
  "Main Hindi aur thodi Marathi bol leti hoon.",
  "Main Andheri ya Bandra ke aas paas kaam dhoond rahi hoon, subah 8 baje se sham 5 baje tak.",
  "Sharma ji ke ghar mein 6 saal kaam kiya tha, woh reference de sakte hain.",
];

// ---------- helpers ----------
function tryParseProfileJson(text) {
  const trimmed = text.trim();
  const cleaned = trimmed
    .replace(/^```json/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();
  try {
    const obj = JSON.parse(cleaned);
    if (obj && typeof obj === "object" && "skills" in obj && "profile_summary" in obj) {
      return obj;
    }
  } catch (e) {
    // not JSON yet, that's fine — still a normal conversational reply
  }
  return null;
}

function scoreJobs(profile, jobs) {
  const profSkills = (profile.skills || []).map((s) => s.toLowerCase());
  const profSpecial = (profile.special_skills || []).map((s) => s.toLowerCase());
  const allProfSkills = [...profSkills, ...profSpecial];
  const profLangs = (profile.languages || []).map((l) => l.toLowerCase());
  const profArea = (profile.preferred_area || "").toLowerCase();
  const profExp = profile.experience_years || 0;

  return jobs
    .map((job) => {
      let score = 0;
      const reasons = [];

      const skillHits = job.skills_required.filter((s) =>
        allProfSkills.some((ps) => ps.includes(s.toLowerCase()) || s.toLowerCase().includes(ps))
      );
      const skillFrac = skillHits.length / job.skills_required.length;
      score += Math.round(skillFrac * 40);
      if (skillHits.length > 0) reasons.push(`Matches ${skillHits.join(", ")}`);

      const areaMatch =
        profArea &&
        (job.area.toLowerCase().includes(profArea) || profArea.includes(job.area.toLowerCase().split(",")[0]));
      score += areaMatch ? 25 : 10;
      reasons.push(areaMatch ? `Close to ${profile.preferred_area}` : `In ${job.area.split(",")[0]}`);

      const langHits = job.languages.filter((l) => profLangs.some((pl) => pl.includes(l.toLowerCase())));
      score += Math.round((langHits.length / job.languages.length) * 20);
      if (langHits.length > 0) reasons.push(`Speaks ${langHits.join(", ")}`);

      score += profExp >= job.min_experience ? 15 : Math.round((profExp / Math.max(job.min_experience, 1)) * 15);
      if (profExp >= job.min_experience) reasons.push(`${profExp}+ yrs experience`);

      score = Math.max(0, Math.min(100, score));

      return {
        ...job,
        match_score: score,
        match_reasons: reasons.slice(0, 2),
        recommended: score >= 60,
      };
    })
    .filter((j) => j.match_score >= 50)
    .sort((a, b) => b.match_score - a.match_score);
}

// ---------- backend calls ----------
async function callSkillChat(messages) {
  const resp = await fetch(`${API_BASE}/api/skill-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${resp.status}`);
  }
  const data = await resp.json();
  return data.reply;
}

async function callRoleplayChat(messages, workerName, profile) {
  const resp = await fetch(`${API_BASE}/api/roleplay-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, workerName, profile }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${resp.status}`);
  }
  const data = await resp.json();
  return data.reply;
}

// ---------- UI bits ----------
function PhoneShell({ children }) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 420,
        margin: "0 auto",
        background: "#0b141a",
        borderRadius: 28,
        padding: 10,
        boxShadow: "0 30px 60px -20px rgba(0,0,0,0.5)",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          overflow: "hidden",
          height: 700,
          display: "flex",
          flexDirection: "column",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ChatHeader({ onShowCard, hasProfile }) {
  return (
    <div
      style={{
        background: "#075E54",
        color: "#fff",
        padding: "14px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexShrink: 0,
        position: "relative",
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          background: "linear-gradient(135deg,#E8814C,#C2664B)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: 15,
        }}
      >
        RD
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 16, lineHeight: 1.1 }}>RozgarDidi</div>
        <div style={{ fontSize: 12, opacity: 0.85 }}>online</div>
      </div>
      <Video size={19} style={{ opacity: 0.9 }} />
      <Phone size={17} style={{ opacity: 0.9 }} />
      <MoreVertical size={18} style={{ opacity: 0.9 }} />
      {hasProfile && (
        <button
          onClick={onShowCard}
          style={{
            position: "absolute",
            bottom: -34,
            right: 14,
            background: "#E8C547",
            color: "#3a2a10",
            border: "none",
            borderRadius: 16,
            padding: "5px 12px",
            fontSize: 12,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 5,
            boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
            cursor: "pointer",
          }}
        >
          <Sparkles size={13} /> View Skill Card
        </button>
      )}
    </div>
  );
}

function Bubble({ role, text }) {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 8 }}>
      <div
        style={{
          maxWidth: "78%",
          background: isUser ? "#DCF8C6" : "#fff",
          color: "#111",
          padding: "8px 10px",
          borderRadius: 9,
          fontSize: 14.5,
          lineHeight: 1.4,
          boxShadow: "0 1px 1px rgba(0,0,0,0.08)",
          whiteSpace: "pre-wrap",
        }}
      >
        {text}
        <div style={{ fontSize: 10.5, color: "#8a8a8a", textAlign: "right", marginTop: 3 }}>
          {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          {isUser && <span style={{ color: "#4fc3f7", marginLeft: 4 }}>✓✓</span>}
        </div>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 8 }}>
      <div
        style={{
          background: "#fff",
          padding: "10px 14px",
          borderRadius: 9,
          boxShadow: "0 1px 1px rgba(0,0,0,0.08)",
          display: "flex",
          gap: 4,
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#999",
              display: "inline-block",
              animation: `rd-bounce 1.2s ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div
      style={{
        background: "#FEE2E2",
        color: "#991B1B",
        fontSize: 12.5,
        padding: "8px 12px",
        margin: "0 10px 8px",
        borderRadius: 8,
      }}
    >
      ⚠️ {message}
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("chat"); // chat | card | jobs | roleplay
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Namaste! 🙏 Main RozgarDidi hoon. Main aapki skills jaanke ek profile banane mein madad karungi, jisse aapko achhi naukri mil sake. Sabse pehle bataiye — aap kis tarah ka kaam karti hain? Khaana banana, safai, bachon ki dekhbhaal, ya kuch aur?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [voiceIdx, setVoiceIdx] = useState(0);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  const [rpMessages, setRpMessages] = useState([]);
  const [rpInput, setRpInput] = useState("");
  const [rpLoading, setRpLoading] = useState(false);
  const [rpStarted, setRpStarted] = useState(false);
  const [rpError, setRpError] = useState("");

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, screen, rpMessages, rpLoading]);

  const sendMessage = useCallback(
    async (textOverride) => {
      const text = (textOverride ?? input).trim();
      if (!text || loading) return;
      setError("");
      const newMessages = [...messages, { role: "user", content: text }];
      setMessages(newMessages);
      setInput("");
      setLoading(true);
      try {
        const reply = await callSkillChat(newMessages);
        const parsed = tryParseProfileJson(reply);
        if (parsed) {
          setProfile(parsed);
          setMessages([
            ...newMessages,
            {
              role: "assistant",
              content: "Bahut badhiya! Maine aapki profile bana di hai. 🎉 Upar 'View Skill Card' dabaiye dekhne ke liye!",
            },
          ]);
        } else {
          setMessages([...newMessages, { role: "assistant", content: reply }]);
        }
      } catch (e) {
        setError(e.message || "Something went wrong talking to the server.");
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages]
  );

  const playVoiceNote = () => {
    if (loading) return;
    const note = SAMPLE_VOICE_NOTES[voiceIdx % SAMPLE_VOICE_NOTES.length];
    setVoiceIdx((i) => i + 1);
    sendMessage(note);
  };

  const startRoleplay = async () => {
    setScreen("roleplay");
    if (rpStarted) return;
    setRpStarted(true);
    setRpLoading(true);
    setRpError("");
    const kickoff = [{ role: "user", content: "Namaste, main taiyaar hoon practice interview ke liye." }];
    try {
      const reply = await callRoleplayChat(kickoff, profile?.name || "Kamla", profile);
      setRpMessages([
        {
          role: "assistant",
          content:
            "Theek hai! Hum ab ek practice interview karenge. Main employer ki tarah sawaal puchhungi. Daro mat — yeh sirf practice hai! 😊",
        },
        { role: "assistant", content: reply },
      ]);
    } catch (e) {
      setRpError(e.message || "Could not start roleplay.");
    } finally {
      setRpLoading(false);
    }
  };

  const sendRoleplayMessage = async (textOverride) => {
    const text = (textOverride ?? rpInput).trim();
    if (!text || rpLoading) return;
    setRpError("");
    const newMsgs = [...rpMessages, { role: "user", content: text }];
    setRpMessages(newMsgs);
    setRpInput("");
    setRpLoading(true);
    try {
      const reply = await callRoleplayChat(newMsgs, profile?.name || "Kamla", profile);
      setRpMessages([...newMsgs, { role: "assistant", content: reply }]);
    } catch (e) {
      setRpError(e.message || "Could not send message.");
    } finally {
      setRpLoading(false);
    }
  };

  const jobMatches = profile ? scoreJobs(profile, JOB_LISTINGS) : [];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#ECE5DD",
        padding: "24px 12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      <style>{`
        @keyframes rd-bounce { 0%,60%,100% { transform: translateY(0); opacity: .5 } 30% { transform: translateY(-4px); opacity: 1 } }
        @keyframes rd-card-in { 0% { opacity: 0; transform: rotateY(-12deg) scale(.92) translateY(20px); } 100% { opacity: 1; transform: rotateY(0) scale(1) translateY(0); } }
        @keyframes rd-shine { 0% { transform: translateX(-120%) rotate(8deg); } 100% { transform: translateX(220%) rotate(8deg); } }
        @keyframes rd-fade-up { 0% { opacity: 0; transform: translateY(14px); } 100% { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>

      <div style={{ textAlign: "center", color: "#3a3a3a" }}>
        <div style={{ fontSize: 13, letterSpacing: 1, fontWeight: 700, color: "#C2664B", textTransform: "uppercase" }}>
          RozgarDidi — Live Prototype
        </div>
        <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>
          Simulated WhatsApp · Real Gemini API · Mocked job board
        </div>
      </div>

      {screen === "chat" && (
        <PhoneShell>
          <ChatHeader onShowCard={() => setScreen("card")} hasProfile={!!profile} />
          <ErrorBanner message={error} />
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "14px 10px", background: "#ECE5DD" }}>
            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} text={m.content} />
            ))}
            {loading && <TypingBubble />}
          </div>
          <div style={{ padding: "8px 10px", background: "#F0F0F0", display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Type a message (or tap mic to simulate a voice note)"
              style={{ flex: 1, border: "none", outline: "none", borderRadius: 20, padding: "10px 14px", fontSize: 14, background: "#fff" }}
            />
            {input.trim() ? (
              <button
                onClick={() => sendMessage()}
                style={{
                  background: "#075E54",
                  border: "none",
                  borderRadius: "50%",
                  width: 38,
                  height: 38,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <Send size={16} />
              </button>
            ) : (
              <button
                onClick={playVoiceNote}
                title="Simulate a Hindi voice note"
                style={{
                  background: "#075E54",
                  border: "none",
                  borderRadius: "50%",
                  width: 38,
                  height: 38,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <Mic size={16} />
              </button>
            )}
          </div>
        </PhoneShell>
      )}

      {screen === "card" && profile && (
        <div style={{ width: "100%", maxWidth: 420 }}>
          <BackBar label="Back to chat" onClick={() => setScreen("chat")} />
          <SkillCard profile={profile} />
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <ActionButton onClick={() => setScreen("jobs")} label="See Job Matches" icon={<Briefcase size={15} />} primary />
            <ActionButton onClick={startRoleplay} label="Practice Interview" icon={<Sparkles size={15} />} />
          </div>
        </div>
      )}

      {screen === "jobs" && profile && (
        <div style={{ width: "100%", maxWidth: 420 }}>
          <BackBar label="Back to skill card" onClick={() => setScreen("card")} />
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 19, color: "#222" }}>Job Matches</div>
            <div style={{ fontSize: 13, color: "#777" }}>Scored against {profile.name || "this worker"}'s profile</div>
          </div>
          {jobMatches.map((job, i) => (
            <JobMatchCard key={job.job_id} job={job} index={i} />
          ))}
          <ActionButton onClick={startRoleplay} label="Practice Interview for Top Match" icon={<Sparkles size={15} />} primary fullWidth />
        </div>
      )}

      {screen === "roleplay" && (
        <PhoneShell>
          <div style={{ background: "#075E54", color: "#fff", padding: "14px 14px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <ArrowLeft size={18} style={{ cursor: "pointer" }} onClick={() => setScreen("card")} />
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#8a8a8a,#5a5a5a)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              🧑‍💼
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Mock Interviewer</div>
              <div style={{ fontSize: 11.5, opacity: 0.85 }}>Practice mode</div>
            </div>
          </div>
          <ErrorBanner message={rpError} />
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "14px 10px", background: "#ECE5DD" }}>
            {rpMessages.map((m, i) => (
              <Bubble key={i} role={m.role} text={m.content} />
            ))}
            {rpLoading && <TypingBubble />}
          </div>
          <div style={{ padding: "8px 10px", background: "#F0F0F0", display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <input
              value={rpInput}
              onChange={(e) => setRpInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendRoleplayMessage()}
              placeholder="Type your answer..."
              style={{ flex: 1, border: "none", outline: "none", borderRadius: 20, padding: "10px 14px", fontSize: 14, background: "#fff" }}
            />
            <button
              onClick={() => sendRoleplayMessage()}
              style={{
                background: "#075E54",
                border: "none",
                borderRadius: "50%",
                width: 38,
                height: 38,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </PhoneShell>
      )}

      <div style={{ fontSize: 11.5, color: "#999", maxWidth: 420, textAlign: "center", marginTop: 4 }}>
        Demo notes: tap the mic to simulate a Hindi voice note (6 pre-scripted lines cycle through). Gemini conducts the
        real assessment conversation and emits the JSON profile live. Job board + STT/WhatsApp transport are mocked for
        this prototype.
      </div>
    </div>
  );
}

function BackBar({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "none",
        border: "none",
        color: "#075E54",
        fontWeight: 600,
        fontSize: 13,
        marginBottom: 10,
        cursor: "pointer",
        padding: 0,
      }}
    >
      <ArrowLeft size={15} /> {label}
    </button>
  );
}

function ActionButton({ onClick, label, icon, primary, fullWidth }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: fullWidth ? "1 1 100%" : 1,
        marginTop: fullWidth ? 12 : 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        padding: "11px 14px",
        borderRadius: 12,
        border: primary ? "none" : "1.5px solid #C2664B",
        background: primary ? "linear-gradient(135deg,#E8814C,#C2664B)" : "#fff",
        color: primary ? "#fff" : "#C2664B",
        fontWeight: 700,
        fontSize: 13.5,
        cursor: "pointer",
        boxShadow: primary ? "0 6px 14px -4px rgba(194,102,75,0.5)" : "none",
      }}
    >
      {icon} {label}
    </button>
  );
}

function SkillCard({ profile }) {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 20,
        padding: 22,
        background: "linear-gradient(160deg,#1f1410 0%,#2e1b12 55%,#3a2114 100%)",
        color: "#F7EFE2",
        overflow: "hidden",
        animation: "rd-card-in 0.7s cubic-bezier(.2,.8,.2,1) both",
        boxShadow: "0 24px 50px -18px rgba(60,20,10,0.55)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 60,
          height: "220%",
          background: "linear-gradient(75deg, transparent, rgba(255,255,255,0.16), transparent)",
          animation: "rd-shine 1.4s 0.5s ease-out 1",
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 1.5, color: "#E8C547", fontWeight: 700, textTransform: "uppercase" }}>
            Verified Skill Profile
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, fontFamily: "Georgia, serif" }}>
            {profile.name || "Worker Profile"}
          </div>
        </div>
        <CheckCircle2 size={26} color="#E8C547" />
      </div>

      <div style={{ fontSize: 13.5, color: "#E7D9C4", marginTop: 10, lineHeight: 1.5 }}>{profile.profile_summary}</div>

      <div style={{ display: "flex", gap: 18, marginTop: 18 }}>
        <Stat label="Experience" value={`${profile.experience_years || 0} yrs`} />
        <Stat label="Languages" value={(profile.languages || []).join(", ") || "—"} />
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, color: "#E8C547", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
          Core Skills
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {(profile.skills || []).map((s, i) => (
            <Tag key={i} text={s} />
          ))}
          {(profile.special_skills || []).map((s, i) => (
            <Tag key={"sp" + i} text={s} accent />
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 16, fontSize: 12.5, color: "#cbb89a" }}>
        <MapPin size={13} /> {profile.preferred_area || "Area not specified"}
      </div>

      <div
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: "1px solid rgba(247,239,226,0.15)",
          fontSize: 10.5,
          color: "#a8957a",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>RozgarDidi · AI-verified profile</span>
        <span>Generated just now</span>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#a8957a", textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
      <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Tag({ text, accent }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "4px 10px",
        borderRadius: 999,
        background: accent ? "rgba(232,197,71,0.18)" : "rgba(247,239,226,0.1)",
        color: accent ? "#E8C547" : "#F2E8D8",
        border: accent ? "1px solid rgba(232,197,71,0.4)" : "1px solid rgba(247,239,226,0.18)",
        fontWeight: 600,
      }}
    >
      {text}
    </span>
  );
}

function JobMatchCard({ job, index }) {
  const color = job.match_score >= 80 ? "#1d8a4c" : job.match_score >= 60 ? "#C2664B" : "#9a9a9a";
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        boxShadow: "0 6px 18px -10px rgba(0,0,0,0.25)",
        border: "1px solid #eee",
        animation: `rd-fade-up 0.5s ${index * 0.1}s both`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#222" }}>{job.title}</div>
          <div style={{ fontSize: 12.5, color: "#888" }}>{job.employer}</div>
        </div>
        <div
          style={{
            background: color,
            color: "#fff",
            borderRadius: 999,
            padding: "3px 10px",
            fontSize: 12.5,
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          {job.match_score}% match
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 12.5, color: "#666" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <MapPin size={12} /> {job.area.split(",")[0]}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Languages size={12} /> {job.languages.join("/")}
        </span>
      </div>
      <div style={{ marginTop: 8, fontSize: 13.5, fontWeight: 700, color: "#1d8a4c" }}>{job.salary}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {job.match_reasons.map((r, i) => (
          <span
            key={i}
            style={{
              fontSize: 11,
              color: "#C2664B",
              background: "#FBEDE6",
              borderRadius: 6,
              padding: "2px 7px",
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <Star size={10} /> {r}
          </span>
        ))}
      </div>
    </div>
  );
}
