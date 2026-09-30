import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListNotes, getListNotesQueryKey, useCreateNote, useGenerateNote } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Plus, Sparkles, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CHAPTER_SUGGESTIONS, SUBJECT_EMOJIS } from "@/lib/constants";
import { useStudent } from "@/contexts/StudentContext";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { getQuotaErrorMessage } from "@/lib/quota-error";

export default function Notes() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { level, subjects } = useStudent();
  const { toast } = useToast();

  const [subjectFilter, setSubjectFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  const { data: notes, isLoading } = useListNotes({
    level: level ?? undefined,
    subject: subjectFilter || undefined,
  });

  const createNote = useCreateNote();
  const generateNote = useGenerateNote();

  const [createOpen, setCreateOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [generationMode, setGenerationMode] = useState<"detailedNotes" | "chapterSummary">("detailedNotes");

  const handleCreate = () => {
    if (!newTitle || !newSubject || !level) return;
    createNote.mutate({
      data: { title: newTitle, subject: newSubject, level, content: "# " + newTitle + "\n\nStart writing here..." }
    }, {
      onSuccess: (note) => {
        setCreateOpen(false);
        setNewTitle(""); setNewSubject("");
        queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
        setLocation(`/notes/${note.id}`);
      }
    });
  };

  const handleGenerate = () => {
    if (!newSubject || !newTopic.trim() || !level) return;
    generateNote.mutate({
      data: { subject: newSubject, level, topic: newTopic.trim(), mode: generationMode }
    }, {
      onSuccess: (note) => {
        setGenerateOpen(false);
        setNewTopic(""); setNewSubject("");
        setGenerationMode("detailedNotes");
        queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
        setLocation(`/notes/${note.id}`);
      },
      onError: (err) => {
        const quotaMessage = getQuotaErrorMessage(err);
        toast({
          title: quotaMessage ? "Monthly limit reached" : "Couldn't generate notes",
          description: quotaMessage ?? "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  const filteredNotes = notes?.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.topic?.toLowerCase().includes(search.toLowerCase()) ||
    n.subject.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold font-serif text-foreground">Study Notes</h1>
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-primary/10 text-primary">{level}</span>
          </div>
          <p className="text-muted-foreground">Cambridge {level} notes — accurate to the syllabus.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary"><Sparkles className="w-4 h-4 mr-2" /> Generate with AI</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Cambridge Notes</DialogTitle>
                <DialogDescription>
                  {generationMode === "chapterSummary"
                    ? `AI will create a focused, exam-ready summary of your ${level} chapter, with the key knowledge and recall points you need for revision.`
                    : `AI will create detailed, syllabus-focused notes for your ${level} topic — including key definitions, worked examples, and exam tips.`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Select value={newSubject} onValueChange={setNewSubject}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map(s => (
                      <SelectItem key={s} value={s}>
                        {SUBJECT_EMOJIS[s] ?? "📚"} {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={generationMode} onValueChange={value => setGenerationMode(value as "detailedNotes" | "chapterSummary")}>
                  <SelectTrigger aria-label="Generation mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="detailedNotes">Detailed study notes</SelectItem>
                    <SelectItem value="chapterSummary">Chapter summary</SelectItem>
                  </SelectContent>
                </Select>
                <div className="space-y-2">
                  <label htmlFor="note-topic" className="text-sm font-medium">
                    {generationMode === "chapterSummary" ? "Chapter or syllabus topic" : "Topic"}
                  </label>
                  <Input
                    id="note-topic"
                    list="chapter-suggestions"
                    placeholder={generationMode === "chapterSummary"
                      ? "e.g. Cell Biology or 9700 Topic 2"
                      : "e.g. Photosynthesis or Quadratic Equations"}
                    value={newTopic}
                    onChange={e => setNewTopic(e.target.value)}
                  />
                  {newSubject && (CHAPTER_SUGGESTIONS[newSubject]?.length ?? 0) > 0 && (
                    <datalist id="chapter-suggestions">
                      {CHAPTER_SUGGESTIONS[newSubject].map(suggestion => (
                        <option key={suggestion} value={suggestion} />
                      ))}
                    </datalist>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Choose a suggestion as a starting point or enter any chapter/topic name.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                  ✦ {generationMode === "chapterSummary"
                    ? `Summaries are Cambridge ${level}-level and exam-focused. Exact coverage can vary by subject, syllabus code, and year.`
                    : `Notes are generated for the Cambridge ${level} ${newSubject || "syllabus"} with key definitions, examples, and exam guidance.`}
                </p>
              </div>
              <DialogFooter>
                <Button onClick={handleGenerate} disabled={!newSubject || !newTopic.trim() || generateNote.isPending}>
                  {generateNote.isPending ? "Generating..." : "Generate Notes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> New Note</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Blank Note</DialogTitle>
                <DialogDescription>Create a new {level} study note to write yourself.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input placeholder="Note Title" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                <Select value={newSubject} onValueChange={setNewSubject}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map(s => (
                      <SelectItem key={s} value={s}>
                        {SUBJECT_EMOJIS[s] ?? "📚"} {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={!newTitle || !newSubject || createNote.isPending}>
                  {createNote.isPending ? "Creating..." : "Create Note"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-center bg-card p-4 rounded-xl border">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search notes by title or topic..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="All Subjects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All {level} Subjects</SelectItem>
            {subjects.map(s => (
              <SelectItem key={s} value={s}>{SUBJECT_EMOJIS[s] ?? "📚"} {s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-48 bg-muted animate-pulse rounded-xl border" />)}
        </div>
      ) : filteredNotes?.length === 0 ? (
        <div className="text-center py-24 border rounded-xl bg-card">
          <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium">No notes yet</h3>
          <p className="text-muted-foreground mt-1 mb-6">Generate your first Cambridge {level} study note with AI.</p>
          <Button variant="secondary" onClick={() => setGenerateOpen(true)}>
            <Sparkles className="w-4 h-4 mr-2" /> Generate with AI
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {filteredNotes?.map(note => (
            <Link key={note.id} href={`/notes/${note.id}`}>
              <Card className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all h-full flex flex-col group">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-base line-clamp-2 leading-snug group-hover:text-primary transition-colors">{note.title}</CardTitle>
                    {note.topic && <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 opacity-50 mt-0.5" />}
                  </div>
                  <CardDescription className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary">
                      {SUBJECT_EMOJIS[note.subject] ?? "📚"} {note.subject}
                    </span>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-md">{note.level}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                    {note.content.replace(/[#*`_\[\]>]/g, '').trim().substring(0, 160)}...
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
