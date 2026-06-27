import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListFlashcardSets, getListFlashcardSetsQueryKey, useCreateFlashcardSet, useGenerateFlashcardSet } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Library, Plus, Sparkles, Layers } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SUBJECT_EMOJIS } from "@/lib/constants";
import { useStudent } from "@/contexts/StudentContext";
import { format } from "date-fns";

export default function Flashcards() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { level, subjects } = useStudent();

  const { data: sets, isLoading } = useListFlashcardSets();

  const createSet = useCreateFlashcardSet();
  const generateSet = useGenerateFlashcardSet();

  const [createOpen, setCreateOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newTopic, setNewTopic] = useState("");

  const levelSets = sets?.filter(s => !s.level || s.level === level);

  const handleCreate = () => {
    if (!newTitle || !newSubject || !level) return;
    createSet.mutate({ data: { title: newTitle, subject: newSubject, level } }, {
      onSuccess: (set) => {
        setCreateOpen(false);
        setNewTitle(""); setNewSubject("");
        queryClient.invalidateQueries({ queryKey: getListFlashcardSetsQueryKey() });
        setLocation(`/flashcards/${set.id}`);
      }
    });
  };

  const handleGenerate = () => {
    if (!newSubject || !newTopic || !level) return;
    generateSet.mutate({ data: { subject: newSubject, level, topic: newTopic, count: 10 } }, {
      onSuccess: (set) => {
        setGenerateOpen(false);
        setNewTopic(""); setNewSubject("");
        queryClient.invalidateQueries({ queryKey: getListFlashcardSetsQueryKey() });
        setLocation(`/flashcards/${set.id}`);
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold font-serif text-foreground">Flashcards</h1>
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-primary/10 text-primary">{level}</span>
          </div>
          <p className="text-muted-foreground">Active recall decks for Cambridge {level}.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary"><Sparkles className="w-4 h-4 mr-2" /> Generate Deck</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Flashcard Deck</DialogTitle>
                <DialogDescription>
                  AI will create 10 exam-style flashcards for your Cambridge {level} topic — definitions, key terms, and concept checks.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Select value={newSubject} onValueChange={setNewSubject}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map(s => (
                      <SelectItem key={s} value={s}>{SUBJECT_EMOJIS[s] ?? "📚"} {s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input placeholder="Topic (e.g. Kinematics, Cell Division)" value={newTopic} onChange={e => setNewTopic(e.target.value)} />
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                  ✦ Cards will be styled like Cambridge exam questions — with hints to help you recall without just memorising answers.
                </p>
              </div>
              <DialogFooter>
                <Button onClick={handleGenerate} disabled={!newSubject || !newTopic || generateSet.isPending}>
                  {generateSet.isPending ? "Generating..." : "Generate 10 Cards"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> New Deck</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Empty Deck</DialogTitle>
                <DialogDescription>Create a blank {level} flashcard deck to add cards to later.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input placeholder="Deck Title" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                <Select value={newSubject} onValueChange={setNewSubject}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map(s => (
                      <SelectItem key={s} value={s}>{SUBJECT_EMOJIS[s] ?? "📚"} {s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={!newTitle || !newSubject || createSet.isPending}>
                  {createSet.isPending ? "Creating..." : "Create Deck"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-xl border" />)}
        </div>
      ) : levelSets?.length === 0 ? (
        <div className="text-center py-24 border rounded-xl bg-card">
          <Library className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium">No flashcard decks yet</h3>
          <p className="text-muted-foreground mt-1 mb-6">Generate your first {level} deck with AI — pick a subject and topic to start.</p>
          <Button variant="secondary" onClick={() => setGenerateOpen(true)}>
            <Sparkles className="w-4 h-4 mr-2" /> Generate a Deck
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {levelSets?.map(set => (
            <Link key={set.id} href={`/flashcards/${set.id}`}>
              <Card className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all h-full group">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-base line-clamp-2 leading-snug group-hover:text-primary transition-colors">{set.title}</CardTitle>
                    {set.topic && <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 opacity-50 mt-0.5" />}
                  </div>
                  <CardDescription className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary">
                      {SUBJECT_EMOJIS[set.subject] ?? "📚"} {set.subject}
                    </span>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-md">{set.level}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Layers className="w-4 h-4" />
                    <span className="text-sm font-medium">{set.cardCount} cards</span>
                  </div>
                </CardContent>
                <CardFooter className="pt-0 text-xs text-muted-foreground">
                  Created {format(new Date(set.createdAt), 'MMM d, yyyy')}
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
