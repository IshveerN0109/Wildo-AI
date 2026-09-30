import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { 
  useGetNote, 
  useUpdateNote, 
  useDeleteNote,
  getGetNoteQueryKey,
  getListNotesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Trash2, Loader2, Eye, Pencil } from "lucide-react";
import { Link } from "wouter";
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
import { MarkdownContent } from "@/components/markdown-content";

export default function NoteDetail() {
  const { id } = useParams<{ id: string }>();
  const noteId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: note, isLoading } = useGetNote(noteId, {
    query: { enabled: !isNaN(noteId), queryKey: getGetNoteQueryKey(noteId) }
  });

  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const initializedForId = useRef<number | null>(null);

  useEffect(() => {
    if (note && initializedForId.current !== noteId) {
      initializedForId.current = noteId;
      setTitle(note.title);
      setContent(note.content);
    }
  }, [note, noteId]);

  const handleSave = () => {
    if (!title) return;
    updateNote.mutate({
      id: noteId,
      data: { title, content }
    }, {
      onSuccess: () => {
        toast({ title: "Note saved successfully" });
        queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(noteId) });
        queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
      }
    });
  };

  const handleDelete = () => {
    deleteNote.mutate({ id: noteId }, {
      onSuccess: () => {
        toast({ title: "Note deleted" });
        queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
        setLocation("/notes");
      }
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!note) {
    return <div>Note not found</div>;
  }

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/notes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
              {note.subject}
            </span>
            <span className="text-xs text-muted-foreground">{note.level}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your note.
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
          <Button onClick={handleSave} disabled={updateNote.isPending || !title}>
            {updateNote.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="text-2xl font-bold font-serif px-4 py-6 border-none focus-visible:ring-0 shadow-none bg-transparent"
          placeholder="Note Title"
        />
        <Tabs defaultValue="preview" className="w-full">
          <TabsList className="self-start">
            <TabsTrigger value="preview" className="gap-1.5">
              <Eye className="w-3.5 h-3.5" /> Preview
            </TabsTrigger>
            <TabsTrigger value="edit" className="gap-1.5">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </TabsTrigger>
          </TabsList>
          <TabsContent value="preview" className="min-h-[50dvh] rounded-lg border bg-card p-6">
            {content.trim() ? (
              <MarkdownContent content={content} />
            ) : (
              <p className="text-sm text-muted-foreground">Nothing to preview yet — switch to Edit to start writing.</p>
            )}
          </TabsContent>
          <TabsContent value="edit" className="min-h-[50dvh] rounded-lg border bg-card overflow-hidden">
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full min-h-[50dvh] p-6 border-none focus-visible:ring-0 resize-none font-mono text-sm leading-relaxed"
              placeholder="Start writing..."
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
