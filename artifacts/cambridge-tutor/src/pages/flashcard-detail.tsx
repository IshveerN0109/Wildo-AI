import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { 
  useGetFlashcardSet,
  useDeleteFlashcardSet,
  getGetFlashcardSetQueryKey,
  getListFlashcardSetsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

export default function FlashcardDetail() {
  const { id } = useParams<{ id: string }>();
  const setId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: set, isLoading } = useGetFlashcardSet(setId, {
    query: { enabled: !isNaN(setId), queryKey: getGetFlashcardSetQueryKey(setId) }
  });

  const deleteSet = useDeleteFlashcardSet();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const handleDelete = () => {
    deleteSet.mutate({ id: setId }, {
      onSuccess: () => {
        toast({ title: "Flashcard set deleted" });
        queryClient.invalidateQueries({ queryKey: getListFlashcardSetsQueryKey() });
        setLocation("/flashcards");
      }
    });
  };

  const nextCard = () => {
    if (!set || currentIndex >= set.cards.length - 1) return;
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex(prev => prev + 1), 150); // slight delay to allow flip animation reset
  };

  const prevCard = () => {
    if (currentIndex <= 0) return;
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex(prev => prev - 1), 150);
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!set) {
    return <div>Flashcard set not found</div>;
  }

  const currentCard = set.cards[currentIndex];
  const progress = ((currentIndex + 1) / (set.cards.length || 1)) * 100;

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/flashcards">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold font-serif leading-tight">{set.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                {set.subject}
              </span>
              <span className="text-xs text-muted-foreground">{set.level}</span>
            </div>
          </div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
              <Trash2 className="w-4 h-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this deck?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the flashcard set and all its cards.
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

      <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full px-4 pb-12">
        {set.cards.length === 0 ? (
          <div className="text-center p-12 bg-card border rounded-xl w-full">
            <p className="text-muted-foreground">This deck is empty.</p>
          </div>
        ) : (
          <div className="w-full space-y-8 flex flex-col items-center">
            
            <div className="w-full max-w-md bg-secondary h-1.5 rounded-full overflow-hidden">
              <div className="bg-primary h-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
            </div>

            <div className="w-full text-center text-sm font-medium text-muted-foreground">
              Card {currentIndex + 1} of {set.cards.length}
            </div>

            {/* Flashcard Component */}
            <div 
              className="w-full aspect-[4/3] perspective-1000 cursor-pointer group" 
              onClick={handleFlip}
            >
              <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                {/* Front */}
                <Card className="absolute inset-0 backface-hidden bg-card border-2 shadow-sm flex flex-col items-center justify-center p-8 text-center group-hover:border-primary/50 transition-colors">
                  <span className="absolute top-4 left-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Question</span>
                  <h2 className="text-2xl font-serif leading-relaxed text-foreground">{currentCard.question}</h2>
                  <div className="absolute bottom-4 text-xs text-muted-foreground flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" /> Click to flip
                  </div>
                </Card>
                
                {/* Back */}
                <Card className="absolute inset-0 backface-hidden bg-primary text-primary-foreground border-2 border-primary shadow-md flex flex-col items-center justify-center p-8 text-center rotate-y-180">
                  <span className="absolute top-4 left-4 text-xs font-semibold text-primary-foreground/70 uppercase tracking-wider">Answer</span>
                  <div className="text-xl leading-relaxed whitespace-pre-wrap">{currentCard.answer}</div>
                  
                  {currentCard.hint && (
                    <div className="absolute bottom-12 mt-4 px-4 py-2 bg-black/10 rounded-md text-sm text-primary-foreground/90 max-w-[80%]">
                      <span className="font-semibold mr-1">Hint:</span> {currentCard.hint}
                    </div>
                  )}
                </Card>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4 pt-4">
              <Button 
                variant="outline" 
                size="lg" 
                onClick={(e) => { e.stopPropagation(); prevCard(); }} 
                disabled={currentIndex === 0}
                className="w-24"
              >
                <ChevronLeft className="w-5 h-5 mr-1" /> Prev
              </Button>
              <Button 
                size="lg" 
                onClick={(e) => { e.stopPropagation(); nextCard(); }} 
                disabled={currentIndex === set.cards.length - 1}
                className="w-24"
              >
                Next <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
