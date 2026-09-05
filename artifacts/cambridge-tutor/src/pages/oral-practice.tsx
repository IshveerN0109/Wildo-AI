import { useEffect, useMemo, useRef, useState } from "react";
import { useEvaluateOralPractice, type OralPracticeCriterion, type OralPracticeEvaluateInputVoice, type OralPracticeEvaluation } from "@workspace/api-client-react";
import { useVoiceRecorder } from "@workspace/integrations-openai-ai-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStudent } from "@/contexts/StudentContext";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleHelp,
  Clock3,
  Headphones,
  Loader2,
  Mic,
  Pause,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Square,
  Volume2,
} from "lucide-react";

type PracticeState = "setup" | "recording" | "evaluating" | "evaluated" | "mic-error";
type Duration = 60 | 90 | 120;

const VOICES: { value: OralPracticeEvaluateInputVoice; label: string; detail: string }[] = [
  { value: "alloy", label: "Alex", detail: "measured and neutral" },
  { value: "echo", label: "Elliot", detail: "clear and precise" },
  { value: "fable", label: "Frances", detail: "warm and articulate" },
  { value: "onyx", label: "Oliver", detail: "low and composed" },
  { value: "nova", label: "Nora", detail: "bright and focused" },
  { value: "shimmer", label: "Sienna", detail: "calm and encouraging" },
];

const SYLLABUS_OPTIONS = [
  { code: "0500", label: "0500 · First Language English", detail: "Component 4 · 40 marks" },
  { code: "0510", label: "0510 · English as a Second Language", detail: "Paper 3 Speaking · 40 marks" },
];

const TOPICS: Record<string, { label: string; question: string }[]> = {
  English: [
    { label: "A memorable experience", question: "Describe a memorable experience that changed the way you see something. Explain why it stayed with you." },
    { label: "Technology and communication", question: "How has technology changed the way young people communicate? Give reasons and examples for your view." },
    { label: "The value of reading", question: "Do you think reading is still important for young people? Discuss your opinion and support it with examples." },
  ],
  "English Language": [
    { label: "A memorable experience", question: "Describe a memorable experience that changed the way you see something. Explain why it stayed with you." },
    { label: "Technology and communication", question: "How has technology changed the way young people communicate? Give reasons and examples for your view." },
    { label: "The value of reading", question: "Do you think reading is still important for young people? Discuss your opinion and support it with examples." },
  ],
  "First Language English": [
    { label: "A memorable experience", question: "Describe a memorable experience that changed the way you see something. Explain why it stayed with you." },
    { label: "Technology and communication", question: "How has technology changed the way young people communicate? Give reasons and examples for your view." },
    { label: "The value of reading", question: "Do you think reading is still important for young people? Discuss your opinion and support it with examples." },
  ],
};

const DEFAULT_TOPICS = [
  { label: "A personal perspective", question: "Talk about an experience or idea that has shaped your perspective. Explain your answer with clear examples." },
  { label: "A current issue", question: "Choose a current issue that matters to young people. Explain your view and consider another perspective." },
  { label: "A future decision", question: "What is one decision young people may face in the future? Discuss the factors they should consider." },
];

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(new Error("The recording could not be read."));
    reader.readAsDataURL(blob);
  });
}

function scorePercent(value: number, max: number) {
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function ScoreRow({ criterion }: { criterion: OralPracticeCriterion }) {
  return (
    <div className="space-y-2" data-testid={`score-${criterion.id}`}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-foreground/80">{criterion.label}</span>
        <span className="font-semibold tabular-nums text-foreground">{criterion.marks}<span className="text-muted-foreground">/{criterion.maxMarks}</span></span>
      </div>
      <Progress value={scorePercent(criterion.marks, criterion.maxMarks)} className="h-1.5 bg-secondary [&>div]:bg-primary" />
      <p className="text-xs text-muted-foreground">{criterion.assessmentObjective} · {criterion.examinerComment}</p>
    </div>
  );
}

function SetupSkeleton() {
  return (
    <div className="animate-pulse space-y-6" data-testid="loading-oral-practice">
      <div className="h-4 w-32 rounded bg-secondary" />
      <div className="h-10 w-3/4 rounded bg-secondary" />
      <div className="h-5 w-1/2 rounded bg-secondary" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-32 rounded-2xl bg-secondary" />
        <div className="h-32 rounded-2xl bg-secondary" />
      </div>
    </div>
  );
}

export default function OralPractice() {
  const { level, subjects } = useStudent();
  const recorder = useVoiceRecorder();
  const evaluate = useEvaluateOralPractice();
  const englishSubject = subjects.find((item) => /english language|first language english|^english$/i.test(item)) ?? "English Language";
  const englishSubjects = subjects.filter((item) => /english/i.test(item));
  const [state, setState] = useState<PracticeState>("setup");
  const [subject, setSubject] = useState(englishSubject);
  const [syllabusCode, setSyllabusCode] = useState("");
  const [topicIndex, setTopicIndex] = useState(0);
  const [questionOverride, setQuestionOverride] = useState<string | null>(null);
  const [duration, setDuration] = useState<Duration>(90);
  const [voice, setVoice] = useState<OralPracticeEvaluateInputVoice>("nova");
  const [elapsed, setElapsed] = useState(0);
  const [evaluation, setEvaluation] = useState<OralPracticeEvaluation | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [playing, setPlaying] = useState(false);
  const submissionStarted = useRef(false);

  const topics = useMemo(() => TOPICS[subject] ?? DEFAULT_TOPICS, [subject]);
  const selectedTopic = topics[topicIndex] ?? topics[0];
  const currentQuestion = questionOverride ?? selectedTopic.question;
  const isSupported = typeof window !== "undefined" && "MediaRecorder" in window && !!navigator.mediaDevices?.getUserMedia;
  const isSyllabusCodeValid = /^\d{4}$/.test(syllabusCode.trim());
  const selectedSyllabus = SYLLABUS_OPTIONS.find((item) => item.code === syllabusCode.trim());

  useEffect(() => {
    if (!/english/i.test(subject) || (subjects.length && !subjects.includes(subject))) setSubject(englishSubject);
  }, [englishSubject, subject, subjects]);

  useEffect(() => {
    setTopicIndex(0);
    setQuestionOverride(null);
  }, [subject]);

  useEffect(() => {
    if (state !== "recording") return;
    const timer = window.setInterval(() => {
      setElapsed((current) => Math.min(current + 1, duration));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state, duration]);

  useEffect(() => {
    if (state === "recording" && elapsed >= duration) void stopAndEvaluate();
  }, [elapsed, duration, state]);

  async function stopAndEvaluate() {
    if (state !== "recording" || submissionStarted.current) return;
    submissionStarted.current = true;
    setState("evaluating");
    try {
      const blob = await recorder.stopRecording();
      if (!blob.size) throw new Error("No audio was captured. Please try recording again.");
      const audioBase64 = await blobToBase64(blob);
      const audioFormat = blob.type.includes("mp4") || blob.type.includes("aac") ? "mp4" : "webm";
      evaluate.mutate(
        {
          data: {
            subject,
            level: level ?? "O Level",
            syllabusCode: syllabusCode.trim(),
            question: currentQuestion,
            audioBase64,
            audioFormat,
            voice,
          },
        },
        {
          onSuccess: (result) => {
            setEvaluation(result);
            setState("evaluated");
          },
          onError: (error) => {
            setErrorMessage(error instanceof Error ? error.message : "The examiner could not evaluate this recording.");
            setState("mic-error");
          },
        },
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The recording could not be submitted.");
      setState("mic-error");
    }
  }

  async function startRecording() {
    setErrorMessage("");
    setEvaluation(null);
    setElapsed(0);
    submissionStarted.current = false;
    if (!isSupported) {
      setErrorMessage("This browser does not support microphone recording. Try the latest Chrome, Edge, Firefox, or Safari.");
      setState("mic-error");
      return;
    }
    try {
      await recorder.startRecording();
      setState("recording");
    } catch {
      setErrorMessage("Microphone access was not granted. Check your browser's site permissions, then try again.");
      setState("mic-error");
    }
  }

  function restart() {
    setState("setup");
    setEvaluation(null);
    setElapsed(0);
    setQuestionOverride(null);
    setErrorMessage("");
    setPlaying(false);
  }

  function continueWithQuestion() {
    if (!evaluation?.nextQuestion) return;
    setState("setup");
    setEvaluation(null);
    setElapsed(0);
    setQuestionOverride(evaluation.nextQuestion);
  }

  function playExaminerAudio() {
    if (!evaluation?.audioResponseBase64 || !evaluation.audioMimeType) return;
    const audio = new Audio(`data:${evaluation.audioMimeType};base64,${evaluation.audioResponseBase64}`);
    setPlaying(true);
    audio.onended = () => setPlaying(false);
    audio.onerror = () => setPlaying(false);
    void audio.play().catch(() => setPlaying(false));
  }

  if (!level) return <SetupSkeleton />;

  return (
    <div className="min-h-full space-y-6 pb-8" data-testid="page-oral-practice">
      <header className="relative overflow-hidden rounded-2xl border border-primary/15 bg-primary px-5 py-6 text-primary-foreground shadow-sm md:px-8 md:py-8">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border border-primary-foreground/10" />
        <div className="absolute -right-4 -top-8 h-40 w-40 rounded-full border border-primary-foreground/10" />
        <div className="relative max-w-2xl">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">
            <Mic className="h-4 w-4" />
            Cambridge speaking room
          </div>
          <h1 className="max-w-xl text-3xl font-bold leading-tight md:text-4xl">Oral English practice</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-primary-foreground/75 md:text-base">
            Speak your answer aloud. Wildo will listen like a Cambridge examiner and give you a clear next step.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-primary-foreground/65">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Formative practice only</span>
            <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> Timed response</span>
            <span className="inline-flex items-center gap-1.5"><Headphones className="h-3.5 w-3.5" /> Examiner audio</span>
          </div>
        </div>
      </header>

      {state === "setup" && (
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]" data-testid="state-setup">
          <div className="rounded-2xl border bg-card p-5 shadow-sm md:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">01 · Prepare</p>
                <h2 className="mt-2 text-xl font-bold">Set the room</h2>
                <p className="mt-1 text-sm text-muted-foreground">Choose a prompt that gives you something worth saying.</p>
              </div>
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">{level}</span>
            </div>
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium">
                  Subject
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger data-testid="select-subject" className="bg-background"><SelectValue placeholder="Choose a subject" /></SelectTrigger>
                    <SelectContent>
                      {(englishSubjects.length ? englishSubjects : [englishSubject]).map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Exact Cambridge syllabus code
                  <input
                    value={syllabusCode}
                    onChange={(event) => setSyllabusCode(event.target.value.replace(/\D/g, "").slice(0, 4))}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="e.g. 0500"
                    data-testid="input-syllabus-code"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <span className="block text-xs font-normal text-muted-foreground">Confirm the four-digit code on your Cambridge entry or syllabus document.</span>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Examiner voice
                  <Select value={voice} onValueChange={(value) => setVoice(value as OralPracticeEvaluateInputVoice)}>
                    <SelectTrigger data-testid="select-voice" className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>{VOICES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label} — {item.detail}</SelectItem>)}</SelectContent>
                  </Select>
                </label>
              </div>
              <div className="rounded-xl border border-primary/15 bg-primary/5 p-4" data-testid="syllabus-profile">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Assessment profile</p>
                    {selectedSyllabus ? (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {selectedSyllabus.label} · {selectedSyllabus.detail}. Wildo will use this syllabus’s configured objectives and mark allocation.
                      </p>
                    ) : isSyllabusCodeValid ? (
                      <p className="mt-1 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                        Syllabus {syllabusCode} is accepted as your confirmed code, but no approved oral mark scheme is configured. The report will not invent marks.
                      </p>
                    ) : (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Choose a configured profile below, or enter your exact four-digit code. Practice cannot start until the code is confirmed.
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SYLLABUS_OPTIONS.map((option) => (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() => setSyllabusCode(option.code)}
                      className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${syllabusCode === option.code ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/50"}`}
                      data-testid={`button-syllabus-${option.code}`}
                    >
                      <span className="block font-semibold">{option.code}</span>
                      <span className={syllabusCode === option.code ? "text-primary-foreground/75" : "text-muted-foreground"}>{option.detail}</span>
                    </button>
                  ))}
                </div>
              </div>
              <label className="space-y-2 text-sm font-medium">
                Cambridge-style topic
                <Select value={String(topicIndex)} onValueChange={(value) => { setTopicIndex(Number(value)); setQuestionOverride(null); }}>
                  <SelectTrigger data-testid="select-topic" className="h-auto min-h-10 bg-background py-2 text-left"><SelectValue /></SelectTrigger>
                  <SelectContent>{topics.map((item, index) => <SelectItem key={item.label} value={String(index)}>{item.label}</SelectItem>)}</SelectContent>
                </Select>
                <span className="block rounded-lg bg-muted/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">{currentQuestion}</span>
              </label>
              <div className="space-y-2">
                <span className="text-sm font-medium">Response time</span>
                <div className="grid grid-cols-3 gap-2">
                  {[60, 90, 120].map((value) => (
                    <button key={value} type="button" data-testid={`button-duration-${value}`} onClick={() => setDuration(value as Duration)} className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${duration === value ? "border-primary bg-primary text-primary-foreground" : "bg-background text-foreground/75 hover:border-primary/50"}`}>
                      {value}s
                    </button>
                  ))}
                </div>
              </div>
              <Button type="button" onClick={startRecording} disabled={!isSyllabusCodeValid} data-testid="button-start-recording" className="w-full sm:w-auto">
                <Mic className="h-4 w-4" /> Enter speaking room
              </Button>
              {!isSyllabusCodeValid && <p className="text-xs text-muted-foreground">Enter and confirm your exact four-digit Cambridge syllabus code to continue.</p>}
            </div>
          </div>
          <aside className="rounded-2xl border border-primary/15 bg-accent/40 p-5 md:p-7">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><CircleHelp className="h-5 w-5" /></div>
            <h2 className="mt-5 text-xl font-bold">A better answer starts slowly</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Take a breath, answer the question directly, then develop your ideas. You do not need to sound perfect — aim to sound clear.</p>
            <div className="mt-6 space-y-3 border-t border-primary/10 pt-5 text-sm">
              {["Answer the whole question", "Give a specific example", "Link your ideas with reasons"].map((tip, index) => (
                <div key={tip} className="flex items-center gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span><span>{tip}</span></div>
              ))}
            </div>
          </aside>
        </section>
      )}

      {state === "recording" && (
        <section className="mx-auto w-full max-w-3xl rounded-2xl border bg-card p-6 shadow-sm md:p-10" data-testid="state-recording">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">02 · Respond</p><h2 className="mt-2 text-2xl font-bold">The examiner is listening</h2></div>
            <span className="flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive"><span className="h-2 w-2 animate-pulse rounded-full bg-destructive" /> Recording</span>
          </div>
          <div className="my-10 text-center">
            <div className="relative mx-auto flex h-36 w-36 items-center justify-center rounded-full border-8 border-primary/10 bg-primary/5">
              <div className="absolute inset-2 rounded-full border border-primary/20" />
              <span className="font-mono text-3xl font-semibold tabular-nums text-primary" data-testid="text-recording-timer">{formatTime(elapsed)}</span>
            </div>
            <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-foreground/80">{currentQuestion}</p>
          </div>
          <Progress value={(elapsed / duration) * 100} className="h-2 bg-secondary [&>div]:bg-destructive" data-testid="progress-recording" />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>Speak naturally</span><span>{formatTime(duration)} maximum</span></div>
          <div className="mt-8 flex justify-center">
            <Button type="button" variant="destructive" onClick={stopAndEvaluate} data-testid="button-stop-recording"><Square className="h-4 w-4 fill-current" /> Stop and submit</Button>
          </div>
        </section>
      )}

      {state === "evaluating" && (
        <section className="mx-auto w-full max-w-2xl rounded-2xl border bg-card p-8 text-center shadow-sm md:p-12" data-testid="state-evaluating">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Loader2 className="h-7 w-7 animate-spin" /></div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.15em] text-primary">03 · Examiner review</p>
          <h2 className="mt-3 text-2xl font-bold">Listening back to your answer</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">Wildo is transcribing your response and checking it against Cambridge speaking criteria. This can take a moment.</p>
          <div className="mx-auto mt-7 max-w-xs space-y-2"><div className="h-2 animate-pulse rounded-full bg-secondary" /><div className="h-2 w-4/5 animate-pulse rounded-full bg-secondary" /></div>
        </section>
      )}

      {state === "mic-error" && (
        <section className="mx-auto w-full max-w-2xl rounded-2xl border border-destructive/25 bg-destructive/5 p-6 shadow-sm md:p-9" data-testid="state-microphone-error">
          <div className="flex items-start gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive"><AlertTriangle className="h-5 w-5" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-destructive">Microphone unavailable</p><h2 className="mt-2 text-xl font-bold">We could not hear that recording</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground" data-testid="text-microphone-error">{errorMessage}</p><p className="mt-4 text-sm text-foreground/80">Allow microphone access in your browser's address-bar settings, close other apps using the microphone, then try again.</p></div></div>
          <div className="mt-7 flex flex-wrap gap-3"><Button type="button" onClick={restart} data-testid="button-try-recording-again"><RotateCcw className="h-4 w-4" /> Try again</Button><Button type="button" variant="outline" onClick={() => { setState("setup"); setErrorMessage(""); }} data-testid="button-back-to-setup">Back to setup</Button></div>
        </section>
      )}

      {state === "evaluated" && evaluation && (
        <section className="space-y-5" data-testid="state-evaluated">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">04 · Review</p><h2 className="mt-2 text-2xl font-bold">Your examiner report</h2><p className="mt-1 text-sm text-muted-foreground">A formative speaking-skills grade for this practice attempt.</p></div>
            <Button type="button" variant="outline" onClick={restart} data-testid="button-restart-practice"><RotateCcw className="h-4 w-4" /> New practice</Button>
          </div>
          <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-5">
              <div className="rounded-2xl border bg-primary p-6 text-primary-foreground shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary-foreground/60">Overall · {evaluation.verification.syllabusCode}</p><p className="mt-3 text-6xl font-bold tabular-nums" data-testid="text-overall-score">{evaluation.score.overall ?? "—"}{evaluation.score.maxTotalMarks !== null && <span className="text-2xl text-primary-foreground/60">/{evaluation.score.maxTotalMarks}</span>}</p></div><Sparkles className="h-5 w-5 text-primary-foreground/60" /></div><p className="mt-4 text-sm leading-relaxed text-primary-foreground/75">{evaluation.score.examinerComment}</p><span className="mt-5 inline-flex rounded-full bg-primary-foreground/10 px-3 py-1.5 text-xs font-medium">{evaluation.score.maxTotalMarks === null ? "No mark awarded · profile unavailable" : "Formative practice · not an official Cambridge mark"}</span></div>
              <div className="rounded-2xl border bg-card p-5 shadow-sm md:p-6"><div className="mb-5 flex items-center justify-between"><h3 className="font-bold">Syllabus criteria</h3><span className="text-xs text-muted-foreground">{evaluation.score.maxTotalMarks === null ? "Not scored" : `${evaluation.score.maxTotalMarks} marks total`}</span></div>{evaluation.score.criteria.length ? <div className="space-y-5">{evaluation.score.criteria.map((criterion) => <ScoreRow key={criterion.id} criterion={criterion} />)}</div> : <p className="text-sm leading-relaxed text-muted-foreground">No configured criteria are available for this syllabus code, so Wildo has not invented a mark allocation.</p>}</div>
            </div>
            <div className="space-y-5">
              <div className="rounded-2xl border bg-card p-5 shadow-sm md:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">What you said</h3><span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">Transcript</span></div><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground/80" data-testid="text-transcript">{evaluation.transcript}</p></div>
              <div className="rounded-2xl border bg-card p-5 shadow-sm md:p-6"><div className="flex items-center justify-between gap-3"><h3 className="font-bold">Examiner response</h3><Button type="button" size="sm" variant="outline" onClick={playExaminerAudio} disabled={playing || !evaluation.audioResponseBase64} data-testid="button-play-examiner-audio">{playing ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}{playing ? "Playing" : "Play audio"}</Button></div><p className="mt-4 text-sm leading-7 text-foreground/80" data-testid="text-examiner-reply">{evaluation.examinerReply}</p></div>
              <div className="grid gap-5 sm:grid-cols-2"><div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5"><h3 className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300"><Check className="h-4 w-4" /> Strengths</h3><ul className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/75">{evaluation.score.strengths.map((item) => <li key={item} className="flex gap-2"><span className="text-emerald-600">•</span>{item}</li>)}</ul></div><div className="rounded-2xl border border-primary/15 bg-accent/35 p-5"><h3 className="font-bold text-primary">Next focus</h3><ul className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/75">{evaluation.score.improvements.map((item) => <li key={item} className="flex gap-2"><span className="text-primary">→</span>{item}</li>)}</ul></div></div>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5 md:p-6"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" /><div><h3 className="font-bold">Cambridge alignment check</h3><p className="mt-1 text-sm leading-relaxed text-foreground/75">{evaluation.verification.markSchemeNote}</p><p className="mt-2 text-xs text-muted-foreground">Syllabus reference: {evaluation.verification.syllabusReference} · {evaluation.verification.component ?? "Oral component unavailable"} · Confidence: {evaluation.verification.confidence}</p>{evaluation.verification.markSchemeReference && <p className="mt-2 text-xs text-muted-foreground">Configured mark-scheme reference: {evaluation.verification.markSchemeReference}</p>}<div className="mt-3"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Assessment objectives</p><ul className="mt-1 space-y-1 text-xs leading-relaxed text-foreground/75">{evaluation.verification.assessmentObjectives.map((objective) => <li key={objective}>• {objective}</li>)}</ul></div></div></div></div>
          {evaluation.nextQuestion && <div className="flex flex-col justify-between gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center md:p-6"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">Continue the conversation</p><p className="mt-2 font-semibold">{evaluation.nextQuestion}</p></div><Button type="button" onClick={continueWithQuestion} data-testid="button-continue-next-question">Answer next question <ArrowRight className="h-4 w-4" /></Button></div>}
        </section>
      )}
    </div>
  );
}