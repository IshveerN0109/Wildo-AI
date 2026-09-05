import { useState, useEffect, useRef } from "react";
import { useGenerateQuiz, useCompleteQuiz, useGetQuizHistory } from "@workspace/api-client-react";
import type { QuizQuestion } from "@workspace/api-client-react";
import { useStudent } from "@/contexts/StudentContext";
import { CHAPTER_SUGGESTIONS, SUBJECT_EMOJIS } from "@/lib/constants";
import { ChevronRight, Trophy, RotateCcw, Clock, Zap, Target, BarChart2, CheckCircle2, XCircle } from "lucide-react";

type Difficulty = "easy" | "medium" | "hard";
type Phase = "setup" | "loading" | "quiz" | "results";

const DIFFICULTY_CONFIG = {
  easy:   { label: "Easy",   seconds: 10, color: "text-emerald-500", bg: "bg-emerald-500", border: "border-emerald-400", ring: "ring-emerald-400", desc: "10 sec · Recall & knowledge" },
  medium: { label: "Medium", seconds: 20, color: "text-amber-500",   bg: "bg-amber-500",   border: "border-amber-400",   ring: "ring-amber-400",   desc: "20 sec · Application & analysis" },
  hard:   { label: "Hard",   seconds: 30, color: "text-rose-500",    bg: "bg-rose-500",    border: "border-rose-400",    ring: "ring-rose-400",    desc: "30 sec · Evaluation & synthesis" },
};

export default function Quiz() {
  const { level, subjects } = useStudent();

  // ── Setup state ──────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("setup");
  const [subject, setSubject] = useState(subjects[0] ?? "");
  const [topic, setTopic]     = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [customTopic, setCustomTopic] = useState("");

  // ── Quiz state ───────────────────────────────────────────────────────────
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [timePerQuestion, setTimePerQuestion] = useState(20);
  const [currentQ, setCurrentQ]   = useState(0);
  const [selected, setSelected]   = useState<number | null>(null);
  const [answered, setAnswered]   = useState(false);
  const [timeLeft, setTimeLeft]   = useState(20);
  const [scores, setScores]       = useState<boolean[]>([]);
  const [quizMeta, setQuizMeta]   = useState({ subject: "", level: "", topic: "", difficulty: "" });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateQuiz = useGenerateQuiz();
  const completeQuiz = useCompleteQuiz();
  const { data: history } = useGetQuizHistory();

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "quiz" || answered) return;
    setTimeLeft(timePerQuestion);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          handleTimeout();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, currentQ, answered]);

  function handleTimeout() {
    setAnswered(true);
    setScores(s => [...s, false]);
  }

  function handleSelect(idx: number) {
    if (answered) return;
    clearInterval(timerRef.current!);
    setSelected(idx);
    setAnswered(true);
    setScores(s => [...s, idx === questions[currentQ].correctIndex]);
  }

  function handleNext() {
    if (currentQ >= questions.length - 1) {
      finishQuiz();
    } else {
      setCurrentQ(q => q + 1);
      setSelected(null);
      setAnswered(false);
    }
  }

  function finishQuiz() {
    const score = scores.filter(Boolean).length + (selected === questions[currentQ]?.correctIndex ? 1 : 0);
    completeQuiz.mutate({
      data: {
        subject: quizMeta.subject,
        level: quizMeta.level,
        topic: quizMeta.topic,
        difficulty: quizMeta.difficulty,
        score,
        totalQuestions: questions.length,
        timePerQuestion,
      },
    });
    setPhase("results");
  }

  function startQuiz(topicToUse: string) {
    if (!topicToUse.trim() || !level) return;
    setPhase("loading");
    generateQuiz.mutate(
      { data: { subject, level, topic: topicToUse.trim(), difficulty } },
      {
        onSuccess: (data) => {
          setQuestions(data.questions);
          setTimePerQuestion(data.timePerQuestion);
          setQuizMeta({ subject, level, topic: topicToUse.trim(), difficulty });
          setCurrentQ(0);
          setSelected(null);
          setAnswered(false);
          setScores([]);
          setPhase("quiz");
        },
        onError: () => setPhase("setup"),
      }
    );
  }

  function restart() {
    setPhase("setup");
    setQuestions([]);
    setScores([]);
    setSelected(null);
    setAnswered(false);
    setCurrentQ(0);
    setCustomTopic("");
    setTopic("");
  }

  const cfg = DIFFICULTY_CONFIG[difficulty];

  // ── SETUP SCREEN ─────────────────────────────────────────────────────────
  if (phase === "setup") {
    const suggestions = CHAPTER_SUGGESTIONS[subject] ?? [];
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
        <div>
          <h1 className="text-3xl font-bold font-serif">Timed Quiz</h1>
          <p className="text-muted-foreground mt-1">Cambridge {level} · AI-generated, timed by difficulty</p>
        </div>

        {/* Difficulty */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Difficulty</p>
          <div className="grid grid-cols-3 gap-3">
            {(["easy", "medium", "hard"] as Difficulty[]).map(d => {
              const c = DIFFICULTY_CONFIG[d];
              return (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${difficulty === d ? `${c.border} bg-card shadow-sm` : "border-border hover:border-muted-foreground/40"}`}
                >
                  <div className={`text-base font-bold ${c.color}`}>{c.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{c.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Subject */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subject</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {subjects.map(s => (
              <button
                key={s}
                onClick={() => { setSubject(s); setTopic(""); setCustomTopic(""); }}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-left transition-all ${subject === s ? "border-primary bg-primary/5 font-medium" : "hover:border-muted-foreground/40"}`}
              >
                <span>{SUBJECT_EMOJIS[s] ?? "📚"}</span>
                <span className="truncate">{s}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Topic */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Topic / Chapter</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map(ch => (
              <button
                key={ch}
                onClick={() => { setTopic(ch); setCustomTopic(""); }}
                className={`px-3 py-1.5 rounded-full border text-sm transition-all ${topic === ch ? "border-primary bg-primary/10 text-primary font-medium" : "hover:border-primary/50"}`}
              >
                {ch}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              placeholder="Or type a specific topic…"
              value={customTopic}
              onChange={e => { setCustomTopic(e.target.value); setTopic(""); }}
              onKeyDown={e => { if (e.key === "Enter" && customTopic.trim()) startQuiz(customTopic); }}
              className="flex-1 text-sm rounded-lg border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Start */}
        <button
          onClick={() => startQuiz(customTopic || topic)}
          disabled={!topic && !customTopic.trim()}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-base transition-all disabled:opacity-40 ${cfg.bg} text-white hover:opacity-90`}
        >
          <Zap className="w-5 h-5" />
          Start {cfg.label} Quiz
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Recent history */}
        {history && history.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent scores</p>
            <div className="space-y-2">
              {history.slice(0, 5).map(h => {
                const pct = Math.round((h.score / h.totalQuestions) * 100);
                return (
                  <div key={h.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl border bg-card text-sm">
                    <div>
                      <span className="font-medium">{h.topic}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{h.subject} · {h.difficulty}</span>
                    </div>
                    <div className={`font-bold ${pct >= 80 ? "text-emerald-500" : pct >= 50 ? "text-amber-500" : "text-rose-500"}`}>
                      {h.score}/{h.totalQuestions}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── LOADING SCREEN ───────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
          <Zap className="w-8 h-8 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-lg">Generating your quiz…</p>
          <p className="text-muted-foreground text-sm mt-1">Creating 5 Cambridge-style {difficulty} questions on {topic || customTopic}</p>
        </div>
      </div>
    );
  }

  // ── QUIZ SCREEN ──────────────────────────────────────────────────────────
  if (phase === "quiz") {
    const q = questions[currentQ];
    if (!q) return null;
    const timerPct = (timeLeft / timePerQuestion) * 100;
    const timerColor = timerPct > 50 ? cfg.bg : timerPct > 25 ? "bg-amber-500" : "bg-rose-500";

    return (
      <div className="max-w-2xl mx-auto flex flex-col gap-5 animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Q{currentQ + 1}</span> of {questions.length}
            <span className="mx-2">·</span>{quizMeta.topic}
          </div>
          <div className={`flex items-center gap-1.5 font-bold text-lg tabular-nums ${timeLeft <= 5 ? "text-rose-500 animate-pulse" : cfg.color}`}>
            <Clock className="w-4 h-4" />
            {timeLeft}s
          </div>
        </div>

        {/* Timer bar */}
        <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 linear ${timerColor}`}
            style={{ width: `${timerPct}%` }}
          />
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i < currentQ
                  ? scores[i] ? "bg-emerald-500" : "bg-rose-400"
                  : i === currentQ
                    ? cfg.bg
                    : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Question */}
        <div className="bg-card border rounded-2xl p-6">
          <p className="text-lg font-serif leading-relaxed">{q.question}</p>
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 gap-2.5">
          {q.options.map((opt, i) => {
            const isCorrect  = i === q.correctIndex;
            const isSelected = i === selected;
            let cls = "w-full text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition-all ";
            if (!answered) {
              cls += "hover:border-primary hover:bg-primary/5 cursor-pointer";
            } else if (isCorrect) {
              cls += "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300";
            } else if (isSelected) {
              cls += "border-rose-400 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300";
            } else {
              cls += "opacity-50";
            }
            return (
              <button key={i} onClick={() => handleSelect(i)} className={cls} disabled={answered}>
                <div className="flex items-center gap-3">
                  {answered && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                  {answered && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-rose-500 shrink-0" />}
                  {(!answered || (!isCorrect && !isSelected)) && <span className={`w-4 h-4 shrink-0 ${answered ? "" : ""}`} />}
                  <span>{opt}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Explanation + Next */}
        {answered && (
          <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-200">
            <div className="px-4 py-3 rounded-xl bg-muted/50 border text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Explanation: </span>
              {q.explanation}
            </div>
            {timeLeft === 0 && selected === null && (
              <p className="text-xs text-rose-500 font-medium text-center">⏱ Time's up! Moving on…</p>
            )}
            <button
              onClick={handleNext}
              className={`w-full py-3 rounded-xl font-semibold text-white transition-opacity hover:opacity-90 ${cfg.bg}`}
            >
              {currentQ >= questions.length - 1 ? "See Results" : "Next Question →"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── RESULTS SCREEN ───────────────────────────────────────────────────────
  if (phase === "results") {
    const totalCorrect = scores.filter(Boolean).length;
    const pct = Math.round((totalCorrect / questions.length) * 100);
    const emoji = pct === 100 ? "🏆" : pct >= 80 ? "🎉" : pct >= 60 ? "👍" : pct >= 40 ? "📚" : "💪";
    const message = pct === 100 ? "Perfect score!" : pct >= 80 ? "Excellent work!" : pct >= 60 ? "Good effort!" : pct >= 40 ? "Keep revising!" : "Don't give up!";

    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
        {/* Score hero */}
        <div className="text-center py-8 border rounded-2xl bg-card">
          <div className="text-5xl mb-3">{emoji}</div>
          <div className={`text-5xl font-bold tabular-nums ${pct >= 80 ? "text-emerald-500" : pct >= 50 ? "text-amber-500" : "text-rose-500"}`}>
            {pct}%
          </div>
          <p className="text-lg font-semibold mt-1">{message}</p>
          <p className="text-muted-foreground text-sm mt-1">
            {totalCorrect} / {questions.length} correct · {quizMeta.topic} · {quizMeta.difficulty}
          </p>
        </div>

        {/* Per-question breakdown */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Question review</p>
          {questions.map((q, i) => (
            <div key={i} className={`flex gap-3 p-3.5 rounded-xl border text-sm ${scores[i] ? "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-rose-200 bg-rose-50/50 dark:bg-rose-950/20"}`}>
              <div className="shrink-0 mt-0.5">
                {scores[i]
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  : <XCircle className="w-4 h-4 text-rose-500" />}
              </div>
              <div>
                <p className="font-medium leading-snug">{q.question}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ {q.options[q.correctIndex]}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{q.explanation}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pb-4">
          <button
            onClick={restart}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border font-medium text-sm hover:border-primary hover:bg-primary/5 transition-all"
          >
            <RotateCcw className="w-4 h-4" /> Try another quiz
          </button>
          <button
            onClick={() => { restart(); setDifficulty(difficulty); setSubject(quizMeta.subject); setTopic(quizMeta.topic); startQuiz(quizMeta.topic); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white font-medium text-sm hover:opacity-90 transition-all ${cfg.bg}`}
          >
            <RotateCcw className="w-4 h-4" /> Retry same topic
          </button>
        </div>
      </div>
    );
  }

  return null;
}
