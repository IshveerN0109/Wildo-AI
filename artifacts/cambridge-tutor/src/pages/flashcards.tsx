import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListFlashcardSets, getListFlashcardSetsQueryKey, useGenerateFlashcardSet } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, ChevronRight, Plus, X, Layers } from "lucide-react";
import { SUBJECT_EMOJIS, CHAPTER_SUGGESTIONS } from "@/lib/constants";
import { useStudent } from "@/contexts/StudentContext";
import { useToast } from "@/hooks/use-toast";
import { getQuotaErrorMessage } from "@/lib/quota-error";

export default function Flashcards() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { level, subjects } = useStudent();
  const { toast } = useToast();

  const { data: sets, isLoading } = useListFlashcardSets();
  const generateSet = useGenerateFlashcardSet();

  // Which subject's "add chapter" panel is open
  const [addingFor, setAddingFor] = useState<string | null>(null);
  // Custom topic text
  const [customTopic, setCustomTopic] = useState("");
  // Which subject picker is open (for new subject when no decks exist)
  const [pickingSubject, setPickingSubject] = useState(false);
  const [pendingSubject, setPendingSubject] = useState("");

  const levelSets = sets?.filter(s => !s.level || s.level === level) ?? [];

  // Group by subject — this is the real data the student has actually used
  const grouped: Record<string, typeof levelSets> = {};
  for (const set of levelSets) {
    if (!grouped[set.subject]) grouped[set.subject] = [];
    grouped[set.subject].push(set);
  }
  const subjectsWithDecks = Object.keys(grouped).sort();

  function handleGenerate(subject: string, topic: string) {
    if (!topic.trim() || !level) return;
    generateSet.mutate(
      { data: { subject, level, topic: topic.trim(), count: 10 } },
      {
        onSuccess: (newSet) => {
          setAddingFor(null);
          setCustomTopic("");
          setPendingSubject("");
          setPickingSubject(false);
          queryClient.invalidateQueries({ queryKey: getListFlashcardSetsQueryKey() });
          setLocation(`/flashcards/${newSet.id}`);
        },
        onError: (err) => {
          const quotaMessage = getQuotaErrorMessage(err);
          toast({
            title: quotaMessage ? "Monthly limit reached" : "Couldn't generate flashcards",
            description: quotaMessage ?? "Something went wrong. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  }

  const suggestionsFor = (subject: string) =>
    CHAPTER_SUGGESTIONS[subject] ?? ["Chapter 1", "Chapter 2", "Chapter 3", "Chapter 4"];

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
        {[1, 2].map(i => (
          <div key={i} className="h-36 bg-muted animate-pulse rounded-xl border" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-3xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-3xl font-bold font-serif text-foreground">Flashcards</h1>
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-primary/10 text-primary">{level}</span>
        </div>
        <p className="text-muted-foreground text-sm">Your personal revision decks — organised by subject and chapter.</p>
      </div>

      {/* ── Subjects with real data ──────────────────────────────────────────── */}
      {subjectsWithDecks.length > 0 && (
        <div className="space-y-4">
          {subjectsWithDecks.map(subject => {
            const subjectSets = grouped[subject];
            const totalCards = subjectSets.reduce((n, s) => n + (s.cardCount ?? 0), 0);
            const isOpen = addingFor === subject;

            return (
              <div key={subject} className="border rounded-2xl bg-card overflow-hidden">
                {/* Subject header */}
                <div className="flex items-center justify-between px-5 py-4 border-b bg-muted/30">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{SUBJECT_EMOJIS[subject] ?? "📚"}</span>
                    <div>
                      <h2 className="font-semibold text-base leading-tight">{subject}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {subjectSets.length} chapter{subjectSets.length !== 1 ? "s" : ""} · {totalCards} cards total
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setAddingFor(isOpen ? null : subject); setCustomTopic(""); }}
                    className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-all ${
                      isOpen
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 text-primary hover:bg-primary/20"
                    }`}
                  >
                    {isOpen ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Add chapter</>}
                  </button>
                </div>

                {/* Chapter chips — real data */}
                <div className="px-5 py-3 flex flex-wrap gap-2">
                  {subjectSets.map(set => (
                    <Link key={set.id} href={`/flashcards/${set.id}`}>
                      <div className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-background hover:border-primary hover:bg-primary/5 transition-all cursor-pointer">
                        <Layers className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-sm font-medium">{set.topic ?? set.title}</span>
                        <span className="text-xs text-muted-foreground ml-0.5">({set.cardCount})</span>
                        <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Add chapter panel */}
                {isOpen && (
                  <div className="border-t px-5 py-4 bg-muted/20 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pick a chapter to generate cards for:</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestionsFor(subject).map(ch => (
                        <button
                          key={ch}
                          onClick={() => handleGenerate(subject, ch)}
                          disabled={generateSet.isPending}
                          className="px-3 py-1.5 rounded-full border text-sm bg-background hover:border-primary hover:bg-primary/5 hover:text-primary transition-all disabled:opacity-50"
                        >
                          {generateSet.isPending ? "Generating…" : ch}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Or type a custom topic…"
                        value={customTopic}
                        onChange={e => setCustomTopic(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && customTopic.trim()) handleGenerate(subject, customTopic); }}
                        className="flex-1 text-sm rounded-lg border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                        disabled={generateSet.isPending}
                      />
                      <button
                        onClick={() => handleGenerate(subject, customTopic)}
                        disabled={!customTopic.trim() || generateSet.isPending}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {generateSet.isPending ? "Generating…" : "Generate"}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">AI will create 10 Cambridge {level} flashcards for that chapter.</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Start your first deck ─────────────────────────────────────────────── */}
      {subjectsWithDecks.length === 0 && !pickingSubject && (
        <div className="text-center py-20 border-2 border-dashed rounded-2xl bg-card">
          <div className="text-4xl mb-4">🃏</div>
          <h3 className="text-lg font-semibold font-serif">No flashcard decks yet</h3>
          <p className="text-muted-foreground mt-1 mb-6 text-sm">Pick a subject and chapter — AI generates 10 Cambridge-style cards in seconds.</p>
          <button
            onClick={() => setPickingSubject(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            <Sparkles className="w-4 h-4" /> Create my first deck
          </button>
        </div>
      )}

      {/* ── Subject picker (first deck flow) ──────────────────────────────────── */}
      {(subjectsWithDecks.length === 0 && pickingSubject) || (subjectsWithDecks.length > 0 && pickingSubject) ? (
        pickingSubject && subjectsWithDecks.length === 0 && (
          <div className="border rounded-2xl bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-muted/30">
              <h2 className="font-semibold">Choose a subject</h2>
              <button onClick={() => setPickingSubject(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            {!pendingSubject ? (
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {subjects.map(s => (
                  <button
                    key={s}
                    onClick={() => setPendingSubject(s)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-left hover:border-primary hover:bg-primary/5 transition-all"
                  >
                    <span>{SUBJECT_EMOJIS[s] ?? "📚"}</span>
                    <span className="font-medium truncate">{s}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-5 py-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <button onClick={() => setPendingSubject("")} className="text-xs text-muted-foreground hover:text-foreground">← Back</button>
                  <span className="text-sm font-semibold">{SUBJECT_EMOJIS[pendingSubject] ?? "📚"} {pendingSubject}</span>
                </div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pick a chapter:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestionsFor(pendingSubject).map(ch => (
                    <button
                      key={ch}
                      onClick={() => handleGenerate(pendingSubject, ch)}
                      disabled={generateSet.isPending}
                      className="px-3 py-1.5 rounded-full border text-sm bg-background hover:border-primary hover:bg-primary/5 hover:text-primary transition-all disabled:opacity-50"
                    >
                      {generateSet.isPending ? "Generating…" : ch}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Or type a custom topic…"
                    value={customTopic}
                    onChange={e => setCustomTopic(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && customTopic.trim()) handleGenerate(pendingSubject, customTopic); }}
                    className="flex-1 text-sm rounded-lg border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={generateSet.isPending}
                  />
                  <button
                    onClick={() => handleGenerate(pendingSubject, customTopic)}
                    disabled={!customTopic.trim() || generateSet.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {generateSet.isPending ? "Generating…" : "Generate"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      ) : null}

      {/* ── Add deck for a new subject ─────────────────────────────────────────── */}
      {subjectsWithDecks.length > 0 && (
        <div>
          {!pickingSubject ? (
            <button
              onClick={() => setPickingSubject(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-sm text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
            >
              <Plus className="w-4 h-4" /> Add a new subject
            </button>
          ) : (
            <div className="border rounded-2xl bg-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b bg-muted/30">
                <h2 className="font-semibold">Choose a subject</h2>
                <button onClick={() => { setPickingSubject(false); setPendingSubject(""); setCustomTopic(""); }} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {!pendingSubject ? (
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {subjects.filter(s => !grouped[s]).map(s => (
                    <button
                      key={s}
                      onClick={() => setPendingSubject(s)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-left hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      <span>{SUBJECT_EMOJIS[s] ?? "📚"}</span>
                      <span className="font-medium truncate">{s}</span>
                    </button>
                  ))}
                  {subjects.filter(s => !grouped[s]).length === 0 && (
                    <p className="col-span-3 text-sm text-muted-foreground text-center py-4">You have decks for all your subjects already.</p>
                  )}
                </div>
              ) : (
                <div className="px-5 py-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <button onClick={() => setPendingSubject("")} className="text-xs text-muted-foreground hover:text-foreground">← Back</button>
                    <span className="text-sm font-semibold">{SUBJECT_EMOJIS[pendingSubject] ?? "📚"} {pendingSubject}</span>
                  </div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pick a chapter:</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestionsFor(pendingSubject).map(ch => (
                      <button
                        key={ch}
                        onClick={() => handleGenerate(pendingSubject, ch)}
                        disabled={generateSet.isPending}
                        className="px-3 py-1.5 rounded-full border text-sm bg-background hover:border-primary hover:bg-primary/5 hover:text-primary transition-all disabled:opacity-50"
                      >
                        {generateSet.isPending ? "Generating…" : ch}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Or type a custom topic…"
                      value={customTopic}
                      onChange={e => setCustomTopic(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && customTopic.trim()) handleGenerate(pendingSubject, customTopic); }}
                      className="flex-1 text-sm rounded-lg border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                      disabled={generateSet.isPending}
                    />
                    <button
                      onClick={() => handleGenerate(pendingSubject, customTopic)}
                      disabled={!customTopic.trim() || generateSet.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {generateSet.isPending ? "Generating…" : "Generate"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
