import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  useGetFlashcardSet,
  useDeleteFlashcardSet,
  getGetFlashcardSetQueryKey,
  getListFlashcardSetsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Trash2, Loader2, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { SUBJECT_EMOJIS } from "@/lib/constants";

export default function FlashcardDetail() {
  const { id } = useParams<{ id: string }>();
  const setId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: set, isLoading } = useGetFlashcardSet(setId, {
    query: { enabled: !isNaN(setId), queryKey: getGetFlashcardSetQueryKey(setId) },
  });

  const deleteSet = useDeleteFlashcardSet();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [done, setDone] = useState(false);

  const handleDelete = () => {
    deleteSet.mutate({ id: setId }, {
      onSuccess: () => {
        toast({ title: "Deck deleted" });
        queryClient.invalidateQueries({ queryKey: getListFlashcardSetsQueryKey() });
        setLocation("/flashcards");
      },
    });
  };

  const flip = () => setIsFlipped(f => !f);

  const next = () => {
    if (!set) return;
    if (currentIndex >= set.cards.length - 1) {
      setDone(true);
      return;
    }
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex(i => i + 1), 150);
  };

  const prev = () => {
    if (currentIndex <= 0) return;
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex(i => i - 1), 150);
  };

  const restart = () => {
    setIsFlipped(false);
    setDone(false);
    setCurrentIndex(0);
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!set) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        <p>Deck not found.</p>
        <Link href="/flashcards"><span className="text-primary underline text-sm mt-2 inline-block">Back to Flashcards</span></Link>
      </div>
    );
  }

  const cards = set.cards;
  const currentCard = cards[currentIndex];
  const progress = done ? 100 : ((currentIndex) / Math.max(cards.length, 1)) * 100;

  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto animate-in fade-in duration-300">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/flashcards">
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">{SUBJECT_EMOJIS[set.subject] ?? "📚"}</span>
              <h1 className="font-bold font-serif text-lg leading-tight">{set.topic ?? set.title}</h1>
            </div>
            <p className="text-xs text-muted-foreground ml-7">{set.subject} · {set.level} · {cards.length} cards</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={restart}
            title="Restart from card 1"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this deck?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete "{set.topic ?? set.title}" and all its cards.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* ── Empty deck ──────────────────────────────────────────────────────── */}
      {cards.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-12 bg-card border rounded-2xl">
            <p className="text-muted-foreground">This deck has no cards yet.</p>
            <Link href="/flashcards">
              <span className="text-primary text-sm underline mt-3 inline-block">Back to Flashcards</span>
            </Link>
          </div>
        </div>
      )}

      {/* ── Done state ──────────────────────────────────────────────────────── */}
      {done && (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 pb-12">
          <div className="text-6xl animate-in zoom-in duration-500">🎉</div>
          <div>
            <h2 className="text-2xl font-bold font-serif">You finished the deck!</h2>
            <p className="text-muted-foreground mt-1">
              {cards.length} cards done — {set.topic ?? set.subject} · {set.level}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={restart}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border font-medium text-sm hover:border-primary hover:bg-primary/5 transition-all"
            >
              <RotateCcw className="w-4 h-4" /> Study again
            </button>
            <Link href="/flashcards">
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors">
                Back to decks
              </button>
            </Link>
          </div>
        </div>
      )}

      {/* ── Card session ─────────────────────────────────────────────────────── */}
      {!done && cards.length > 0 && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 pb-8">
          {/* Progress bar */}
          <div className="w-full space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Card {currentIndex + 1} of {cards.length}</span>
              <span>{Math.round(progress)}% done</span>
            </div>
            <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Flip card */}
          <div
            className="w-full cursor-pointer"
            style={{ perspective: "1200px" }}
            onClick={flip}
          >
            <div
              className="relative w-full transition-transform duration-500"
              style={{
                transformStyle: "preserve-3d",
                transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                minHeight: "240px",
              }}
            >
              {/* Front — Question */}
              <div
                className="absolute inset-0 rounded-2xl border-2 bg-card shadow-sm flex flex-col items-center justify-center p-8 text-center"
                style={{ backfaceVisibility: "hidden" }}
              >
                <span className="absolute top-4 left-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Question</span>
                <p className="text-xl font-serif leading-relaxed text-foreground">{currentCard?.question}</p>
                <span className="absolute bottom-4 text-xs text-muted-foreground flex items-center gap-1 opacity-60">
                  <RotateCcw className="w-3 h-3" /> Tap to reveal answer
                </span>
              </div>

              {/* Back — Answer */}
              <div
                className="absolute inset-0 rounded-2xl border-2 border-primary bg-primary shadow-md flex flex-col items-center justify-center p-8 text-center"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                <span className="absolute top-4 left-5 text-[10px] font-bold text-primary-foreground/60 uppercase tracking-widest">Answer</span>
                <p className="text-lg text-primary-foreground leading-relaxed whitespace-pre-wrap">{currentCard?.answer}</p>
                {currentCard?.hint && (
                  <div className="absolute bottom-4 px-4 py-2 bg-black/10 rounded-lg text-xs text-primary-foreground/80 max-w-[85%]">
                    <span className="font-semibold mr-1">Hint:</span>{currentCard.hint}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-3 w-full">
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              disabled={currentIndex === 0}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border font-medium text-sm disabled:opacity-40 hover:border-primary hover:bg-primary/5 transition-all"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              {currentIndex === cards.length - 1 ? "Finish" : "Next"} <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Keyboard hint */}
          <p className="text-xs text-muted-foreground opacity-60">Tap card to flip · Use buttons to navigate</p>
        </div>
      )}
    </div>
  );
}
