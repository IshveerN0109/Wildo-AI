import { useState, useRef, useEffect } from "react";
import { GraduationCap, BookOpen, ChevronRight, RotateCcw, Send, Loader2, BookMarked, ShieldCheck, ShieldAlert } from "lucide-react";
import { useStudent } from "@/contexts/StudentContext";
import { O_LEVEL_SUBJECTS, A_LEVEL_SUBJECTS, SUBJECT_EMOJIS } from "@/lib/constants";

interface Verification {
  syllabusRef: string | null;
  markSchemePoints: string[];
  confidence: "high" | "medium" | "low";
  examinerNote: string | null;
}

function VerificationBadge({ v, loading }: { v: Verification | null; loading: boolean }) {
  if (loading) return (
    <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
      <Loader2 className="w-3 h-3 animate-spin" />
      <span>Checking Cambridge syllabus &amp; mark scheme…</span>
    </div>
  );
  if (!v) return null;
  const isLow = v.confidence === "low";
  return (
    <div className={`mt-3 rounded-lg border px-3 py-2 text-xs space-y-1 ${isLow ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30" : "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30"}`}>
      <div className="flex items-center gap-1.5 font-medium flex-wrap">
        {isLow
          ? <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          : <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
        <span className={isLow ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}>
          {isLow ? "Uncertain — verify with official Cambridge materials" : `Verified · ${v.confidence} confidence`}
        </span>
        {v.syllabusRef && <span className="ml-auto font-normal text-muted-foreground">{v.syllabusRef}</span>}
      </div>
      {isLow && (
        <p className="text-amber-600 dark:text-amber-400">
          Wildo isn't fully certain about the exact mark scheme here. Cross-check at <a href="https://cambridgeinternational.org" target="_blank" rel="noreferrer" className="underline">cambridgeinternational.org</a>.
        </p>
      )}
      {v.examinerNote && <p className="text-muted-foreground italic">📋 Examiner note: {v.examinerNote}</p>}
    </div>
  );
}

type RevisionMode = "whole-book" | "chapter";

interface Message {
  role: "assistant" | "user";
  content: string;
  verification?: Verification | null;
  verifying?: boolean;
}

const CHAPTER_SUGGESTIONS: Record<string, string[]> = {
  "Mathematics": ["Algebra", "Geometry", "Trigonometry", "Calculus", "Statistics & Probability", "Vectors", "Functions"],
  "Physics": ["Mechanics", "Waves", "Electricity & Magnetism", "Thermal Physics", "Atomic Physics", "Optics"],
  "Chemistry": ["Atomic Structure", "Bonding", "Energetics", "Kinetics", "Equilibrium", "Organic Chemistry", "Electrochemistry"],
  "Biology": ["Cell Biology", "Genetics & Inheritance", "Ecology", "Respiration & Photosynthesis", "Human Physiology", "Evolution"],
  "Economics": ["Supply & Demand", "Market Structures", "Macroeconomics", "International Trade", "Monetary Policy", "Development Economics"],
  "Business Studies": ["Business Organisation", "Marketing", "Finance", "Human Resources", "Operations Management"],
  "Computer Science": ["Data Representation", "Algorithms", "Programming", "Databases", "Networks", "Security"],
  "History": ["Causes of WWI", "Interwar Period", "WWII", "Cold War", "Decolonisation"],
  "Geography": ["Plate Tectonics", "Rivers", "Coasts", "Population", "Development", "Climate Change"],
  "Accounting": ["Financial Statements", "Ratio Analysis", "Cash Flow", "Budgeting", "Cost Accounting"],
};

function getChapters(subject: string): string[] {
  return CHAPTER_SUGGESTIONS[subject] ?? ["Chapter 1", "Chapter 2", "Chapter 3", "Chapter 4", "Chapter 5"];
}

export default function Revision() {
  const { level } = useStudent();
  const subjects = level === "O Level" ? O_LEVEL_SUBJECTS : A_LEVEL_SUBJECTS;

  const [step, setStep] = useState<"pick-subject" | "pick-mode" | "pick-chapter" | "session">("pick-subject");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [revisionMode, setRevisionMode] = useState<RevisionMode | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function reset() {
    setStep("pick-subject");
    setSelectedSubject("");
    setRevisionMode(null);
    setSelectedChapter("");
    setMessages([]);
    setInput("");
    setSessionStarted(false);
  }

  async function startSession(subject: string, mode: RevisionMode, chapter?: string) {
    setSessionStarted(true);
    setStep("session");

    const scope = mode === "whole-book"
      ? `the full ${level} ${subject} syllabus`
      : `the "${chapter}" chapter/topic of ${level} ${subject}`;

    const systemPrompt = `You are an expert Cambridge ${level} ${subject} tutor. 
You are running a structured revision session covering ${scope}.

Start with a brief overview of what will be covered, then go through key concepts, definitions, worked examples, and common exam questions. 
Use clear headers, bullet points, and step-by-step explanations. 
After each section, invite the student to ask questions or move on.
Use Cambridge command words (Describe, Explain, Analyse, Evaluate, etc.) and exam-style language throughout.
Be encouraging and thorough.`;

    const welcome: Message = {
      role: "assistant",
      content: `# ${mode === "whole-book" ? "Full Subject Revision" : `Chapter Revision: ${chapter}`}\n**${level} ${subject}**\n\nStarting your revision session... Let me prepare a structured overview for you.`,
    };
    setMessages([welcome]);

    await streamMessage(
      [{ role: "user", content: `Please start a structured revision session for ${scope}. Begin with an overview, then cover the key topics one by one.` }],
      systemPrompt,
    );
  }

  async function streamMessage(newMessages: { role: string; content: string }[], systemOverride?: string) {
    const subject = selectedSubject;
    const scope = revisionMode === "whole-book"
      ? `the full ${level} ${subject} syllabus`
      : `the "${selectedChapter}" chapter/topic of ${level} ${subject}`;

    const system = systemOverride ?? `You are an expert Cambridge ${level} ${subject} tutor helping with a structured revision session covering ${scope}. Be concise, exam-focused, and use Cambridge command words.`;

    setIsStreaming(true);
    const assistantPlaceholder: Message = { role: "assistant", content: "", verifying: true, verification: null };
    setMessages(prev => [...prev, assistantPlaceholder]);

    try {
      const response = await fetch("/api/openai/revision-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, system, subject, level }),
        credentials: "include",
      });

      if (!response.ok || !response.body) throw new Error("Stream failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "verification") {
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { ...updated[updated.length - 1], verification: parsed as Verification, verifying: false };
                  return updated;
                });
                continue;
              }
              if (parsed.done) break;
              const delta = parsed.content ?? "";
              accumulated += delta;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], content: accumulated };
                return updated;
              });
            } catch {}
          }
        }
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: "Sorry, something went wrong. Please try again.", verifying: false };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  async function sendMessage() {
    if (!input.trim() || isStreaming) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    setInput("");
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    await streamMessage(updatedHistory.map(m => ({ role: m.role, content: m.content })));
  }

  function renderContent(text: string) {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      if (line.startsWith("# ")) return <h2 key={i} className="text-xl font-bold font-serif text-foreground mt-4 mb-2">{line.slice(2)}</h2>;
      if (line.startsWith("## ")) return <h3 key={i} className="text-lg font-semibold font-serif text-foreground mt-3 mb-1">{line.slice(3)}</h3>;
      if (line.startsWith("### ")) return <h4 key={i} className="text-base font-semibold text-foreground mt-2 mb-1">{line.slice(4)}</h4>;
      if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold text-foreground">{line.slice(2, -2)}</p>;
      if (line.startsWith("- ") || line.startsWith("• ")) return <li key={i} className="ml-4 text-foreground/90 list-disc">{line.slice(2)}</li>;
      if (line.trim() === "") return <div key={i} className="h-2" />;
      return <p key={i} className="text-foreground/90 leading-relaxed">{line}</p>;
    });
  }

  if (step === "pick-subject") {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <GraduationCap className="w-7 h-7 text-primary" />
            <h1 className="text-3xl font-bold font-serif">Revision Mode</h1>
          </div>
          <p className="text-muted-foreground">Structured AI-guided revision sessions. Choose a subject to begin.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {subjects.map((subject) => (
            <button
              key={subject}
              onClick={() => { setSelectedSubject(subject); setStep("pick-mode"); }}
              className="group p-4 text-left rounded-xl border bg-card hover:border-primary hover:bg-primary/5 transition-all"
            >
              <span className="text-2xl mb-2 block">{SUBJECT_EMOJIS[subject] ?? "📚"}</span>
              <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{subject}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === "pick-mode") {
    return (
      <div className="max-w-2xl mx-auto">
        <button onClick={() => setStep("pick-subject")} className="mb-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to subjects
        </button>
        <div className="mb-8">
          <span className="text-3xl">{SUBJECT_EMOJIS[selectedSubject] ?? "📚"}</span>
          <h2 className="text-2xl font-bold font-serif mt-2">{selectedSubject}</h2>
          <p className="text-muted-foreground mt-1">How would you like to revise?</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => { setRevisionMode("whole-book"); startSession(selectedSubject, "whole-book"); }}
            className="group p-6 text-left rounded-xl border-2 bg-card hover:border-primary hover:bg-primary/5 transition-all"
          >
            <BookOpen className="w-8 h-8 text-primary mb-3" />
            <h3 className="font-semibold text-lg mb-1">Full Subject Revision</h3>
            <p className="text-sm text-muted-foreground">Cover the entire {level} {selectedSubject} syllabus from start to finish.</p>
            <div className="mt-4 flex items-center gap-1 text-primary font-medium text-sm">
              Start full revision <ChevronRight className="w-4 h-4" />
            </div>
          </button>

          <button
            onClick={() => { setRevisionMode("chapter"); setStep("pick-chapter"); }}
            className="group p-6 text-left rounded-xl border-2 bg-card hover:border-primary hover:bg-primary/5 transition-all"
          >
            <BookMarked className="w-8 h-8 text-primary mb-3" />
            <h3 className="font-semibold text-lg mb-1">Chapter / Topic</h3>
            <p className="text-sm text-muted-foreground">Focus on a specific chapter or topic for targeted revision.</p>
            <div className="mt-4 flex items-center gap-1 text-primary font-medium text-sm">
              Choose chapter <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (step === "pick-chapter") {
    const chapters = getChapters(selectedSubject);
    return (
      <div className="max-w-2xl mx-auto">
        <button onClick={() => setStep("pick-mode")} className="mb-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back
        </button>
        <div className="mb-8">
          <h2 className="text-2xl font-bold font-serif">{selectedSubject}</h2>
          <p className="text-muted-foreground mt-1">Choose a chapter or topic to revise</p>
        </div>

        <div className="space-y-2 mb-6">
          {chapters.map((chapter) => (
            <button
              key={chapter}
              onClick={() => { setSelectedChapter(chapter); startSession(selectedSubject, "chapter", chapter); }}
              className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center justify-between group ${selectedChapter === chapter ? "border-primary bg-primary/5" : "bg-card hover:border-primary/50 hover:bg-primary/5"}`}
            >
              <span className="font-medium">{chapter}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          ))}
        </div>

        <div className="border rounded-lg p-4 bg-muted/30">
          <p className="text-sm text-muted-foreground mb-2 font-medium">Or type a custom topic:</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={selectedChapter}
              onChange={e => setSelectedChapter(e.target.value)}
              placeholder="e.g. Organic Reactions, Integration by Parts..."
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              onKeyDown={e => { if (e.key === "Enter" && selectedChapter.trim()) startSession(selectedSubject, "chapter", selectedChapter.trim()); }}
            />
            <button
              onClick={() => selectedChapter.trim() && startSession(selectedSubject, "chapter", selectedChapter.trim())}
              disabled={!selectedChapter.trim()}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              Start
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            <h2 className="font-bold font-serif text-lg">
              {revisionMode === "whole-book" ? `${selectedSubject} — Full Revision` : `${selectedSubject}: ${selectedChapter}`}
            </h2>
          </div>
          <p className="text-xs text-muted-foreground ml-7">{level}</p>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border rounded-md px-3 py-1.5 hover:border-primary transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          New session
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" ? (
              <div className="max-w-[90%] bg-card border rounded-xl px-5 py-4 shadow-sm">
                {msg.content ? (
                  <div className="space-y-1">{renderContent(msg.content)}</div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Preparing revision content...</span>
                  </div>
                )}
                <VerificationBadge v={msg.verification ?? null} loading={msg.verifying ?? false} />
              </div>
            ) : (
              <div className="max-w-[80%] bg-primary text-primary-foreground rounded-xl px-4 py-3 text-sm">
                {msg.content}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 flex gap-2 border-t pt-4">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Ask a question or request more detail..."
          disabled={isStreaming}
          className="flex-1 rounded-lg border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || isStreaming}
          className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
