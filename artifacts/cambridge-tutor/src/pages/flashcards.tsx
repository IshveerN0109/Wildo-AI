import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  useListFlashcardSets, 
  getListFlashcardSetsQueryKey, 
  useCreateFlashcardSet, 
  useGenerateFlashcardSet 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Library, Plus, Sparkles, Layers } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { O_LEVEL_SUBJECTS, A_LEVEL_SUBJECTS, LEVELS } from "@/lib/constants";
import { format } from "date-fns";

export default function Flashcards() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: sets, isLoading } = useListFlashcardSets();

  const createSet = useCreateFlashcardSet();
  const generateSet = useGenerateFlashcardSet();

  const [createOpen, setCreateOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newLevel, setNewLevel] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newTopic, setNewTopic] = useState("");

  const handleCreate = () => {
    if (!newTitle || !newSubject || !newLevel) return;
    createSet.mutate({
      data: {
        title: newTitle,
        subject: newSubject,
        level: newLevel,
      }
    }, {
      onSuccess: (set) => {
        setCreateOpen(false);
        queryClient.invalidateQueries({ queryKey: getListFlashcardSetsQueryKey() });
        setLocation(`/flashcards/${set.id}`);
      }
    });
  };

  const handleGenerate = () => {
    if (!newSubject || !newLevel || !newTopic) return;
    generateSet.mutate({
      data: {
        subject: newSubject,
        level: newLevel,
        topic: newTopic,
        count: 10
      }
    }, {
      onSuccess: (set) => {
        setGenerateOpen(false);
        queryClient.invalidateQueries({ queryKey: getListFlashcardSetsQueryKey() });
        setLocation(`/flashcards/${set.id}`);
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif text-foreground">Flashcards</h1>
          <p className="text-muted-foreground">Active recall decks for your subjects.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary">
                <Sparkles className="w-4 h-4 mr-2" /> Generate Deck
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Flashcards</DialogTitle>
                <DialogDescription>Let the AI tutor create a set of 10 flashcards for active recall on any topic.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Select value={newLevel} onValueChange={setNewLevel}>
                  <SelectTrigger><SelectValue placeholder="Select Level" /></SelectTrigger>
                  <SelectContent>
                    {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={newSubject} onValueChange={setNewSubject} disabled={!newLevel}>
                  <SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger>
                  <SelectContent>
                    {(newLevel === "O Level" ? O_LEVEL_SUBJECTS : A_LEVEL_SUBJECTS).map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input placeholder="Topic (e.g. Kinematics, Respiration)" value={newTopic} onChange={e => setNewTopic(e.target.value)} />
              </div>
              <DialogFooter>
                <Button onClick={handleGenerate} disabled={!newLevel || !newSubject || !newTopic || generateSet.isPending}>
                  {generateSet.isPending ? "Generating..." : "Generate"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" /> New Deck
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Empty Deck</DialogTitle>
                <DialogDescription>Create a blank flashcard set to add cards to later.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input placeholder="Deck Title" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                <Select value={newLevel} onValueChange={setNewLevel}>
                  <SelectTrigger><SelectValue placeholder="Select Level" /></SelectTrigger>
                  <SelectContent>
                    {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={newSubject} onValueChange={setNewSubject} disabled={!newLevel}>
                  <SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger>
                  <SelectContent>
                    {(newLevel === "O Level" ? O_LEVEL_SUBJECTS : A_LEVEL_SUBJECTS).map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={!newTitle || !newLevel || !newSubject || createSet.isPending}>
                  {createSet.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="h-40 bg-muted animate-pulse rounded-lg border"></div>
          ))}
        </div>
      ) : sets?.length === 0 ? (
        <div className="text-center py-24 border rounded-lg bg-card">
          <Library className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium">No flashcards found</h3>
          <p className="text-muted-foreground mt-1">Generate a deck to start testing your knowledge.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sets?.map(set => (
            <Link key={set.id} href={`/flashcards/${set.id}`}>
              <Card className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all h-full">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-lg line-clamp-1">{set.title}</CardTitle>
                    {set.topic && <Sparkles className="w-4 h-4 text-primary shrink-0 opacity-50" />}
                  </div>
                  <CardDescription className="flex items-center gap-2 mt-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                      {set.subject}
                    </span>
                    <span className="text-xs">{set.level}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Layers className="w-4 h-4" />
                    <span className="text-sm font-medium">{set.cardCount} cards</span>
                  </div>
                </CardContent>
                <CardFooter className="pt-0 text-xs text-muted-foreground">
                  Created {format(new Date(set.createdAt), 'MMM d')}
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
