import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListNotes, getListNotesQueryKey, useCreateNote, useGenerateNote } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Plus, Sparkles, Search, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { O_LEVEL_SUBJECTS, A_LEVEL_SUBJECTS, LEVELS } from "@/lib/constants";
import { format } from "date-fns";

export default function Notes() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [subjectFilter, setSubjectFilter] = useState<string>("");
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  const { data: notes, isLoading } = useListNotes({ 
    subject: subjectFilter || undefined, 
    level: levelFilter || undefined 
  });

  const createNote = useCreateNote();
  const generateNote = useGenerateNote();

  const [createOpen, setCreateOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newLevel, setNewLevel] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newTopic, setNewTopic] = useState("");

  const handleCreate = () => {
    if (!newTitle || !newSubject || !newLevel) return;
    createNote.mutate({
      data: {
        title: newTitle,
        subject: newSubject,
        level: newLevel,
        content: "# " + newTitle + "\n\nStart writing here...",
      }
    }, {
      onSuccess: (note) => {
        setCreateOpen(false);
        queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
        setLocation(`/notes/${note.id}`);
      }
    });
  };

  const handleGenerate = () => {
    if (!newSubject || !newLevel || !newTopic) return;
    generateNote.mutate({
      data: {
        subject: newSubject,
        level: newLevel,
        topic: newTopic
      }
    }, {
      onSuccess: (note) => {
        setGenerateOpen(false);
        queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
        setLocation(`/notes/${note.id}`);
      }
    });
  };

  const filteredNotes = notes?.filter(n => 
    n.title.toLowerCase().includes(search.toLowerCase()) || 
    n.topic?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif text-foreground">Study Notes</h1>
          <p className="text-muted-foreground">Manage and revise your course material.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary">
                <Sparkles className="w-4 h-4 mr-2" /> Generate with AI
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Notes</DialogTitle>
                <DialogDescription>Let the AI tutor create a comprehensive study note for a specific topic.</DialogDescription>
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
                <Input placeholder="Topic (e.g. Circular Motion, Enzymes)" value={newTopic} onChange={e => setNewTopic(e.target.value)} />
              </div>
              <DialogFooter>
                <Button onClick={handleGenerate} disabled={!newLevel || !newSubject || !newTopic || generateNote.isPending}>
                  {generateNote.isPending ? "Generating..." : "Generate"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" /> New Note
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Blank Note</DialogTitle>
                <DialogDescription>Create a new study note to write yourself.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input placeholder="Note Title" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
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
                <Button onClick={handleCreate} disabled={!newTitle || !newLevel || !newSubject || createNote.isPending}>
                  {createNote.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center bg-card p-4 rounded-lg border">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search notes..." 
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="All Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Levels</SelectItem>
            {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Subjects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Subjects</SelectItem>
            {[...new Set([...O_LEVEL_SUBJECTS, ...A_LEVEL_SUBJECTS])].sort().map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-lg border"></div>
          ))}
        </div>
      ) : filteredNotes?.length === 0 ? (
        <div className="text-center py-24 border rounded-lg bg-card">
          <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium">No notes found</h3>
          <p className="text-muted-foreground mt-1">Try adjusting your filters or create a new note.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredNotes?.map(note => (
            <Link key={note.id} href={`/notes/${note.id}`}>
              <Card className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all h-full flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-lg line-clamp-2 leading-tight">{note.title}</CardTitle>
                    {note.topic && <Sparkles className="w-4 h-4 text-primary shrink-0 opacity-50" />}
                  </div>
                  <CardDescription className="flex items-center gap-2 mt-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                      {note.subject}
                    </span>
                    <span className="text-xs">{note.level}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {note.content.replace(/[#*`_\[\]]/g, '').substring(0, 150)}...
                  </p>
                </CardContent>
                <CardFooter className="pt-2 border-t text-xs text-muted-foreground">
                  Updated {format(new Date(note.updatedAt), 'MMM d, yyyy')}
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
