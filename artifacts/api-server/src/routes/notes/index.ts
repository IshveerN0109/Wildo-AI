import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, notesTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  ListNotesQueryParams,
  CreateNoteBody,
  GetNoteParams,
  UpdateNoteParams,
  UpdateNoteBody,
  DeleteNoteParams,
  GenerateNoteBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/notes", async (req, res): Promise<void> => {
  const query = ListNotesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let q = db.select().from(notesTable).$dynamic();
  if (query.data.subject) {
    q = q.where(eq(notesTable.subject, query.data.subject));
  }
  if (query.data.level) {
    q = q.where(eq(notesTable.level, query.data.level));
  }

  const notes = await q.orderBy(notesTable.updatedAt);
  res.json(notes);
});

router.post("/notes", async (req, res): Promise<void> => {
  const parsed = CreateNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [note] = await db
    .insert(notesTable)
    .values({
      title: parsed.data.title,
      content: parsed.data.content,
      subject: parsed.data.subject,
      level: parsed.data.level,
      topic: parsed.data.topic ?? null,
    })
    .returning();
  res.status(201).json(note);
});

router.post("/notes/generate", async (req, res): Promise<void> => {
  const parsed = GenerateNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { subject, level, topic } = parsed.data;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    max_completion_tokens: 8192,
    messages: [
      {
        role: "system",
        content: `You are an expert Cambridge exam tutor. Generate comprehensive, well-structured study notes for Cambridge ${level} students. Use the Cambridge syllabus as your guide. Format the notes in Markdown with clear headings, bullet points, and examples. Include key definitions, important concepts, worked examples where relevant, and exam tips.`,
      },
      {
        role: "user",
        content: `Generate detailed study notes for the following:\nSubject: ${subject}\nLevel: ${level}\nTopic: ${topic}\n\nMake the notes comprehensive enough for revision, covering all key points that could be examined.`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "";
  const title = `${topic} — ${subject} (${level})`;

  const [note] = await db
    .insert(notesTable)
    .values({ title, content, subject, level, topic })
    .returning();

  res.status(201).json(note);
});

router.get("/notes/:id", async (req, res): Promise<void> => {
  const params = GetNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [note] = await db
    .select()
    .from(notesTable)
    .where(eq(notesTable.id, params.data.id));
  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  res.json(note);
});

router.patch("/notes/:id", async (req, res): Promise<void> => {
  const params = UpdateNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const body = UpdateNoteBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [note] = await db
    .update(notesTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(eq(notesTable.id, params.data.id))
    .returning();
  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  res.json(note);
});

router.delete("/notes/:id", async (req, res): Promise<void> => {
  const params = DeleteNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [deleted] = await db
    .delete(notesTable)
    .where(eq(notesTable.id, params.data.id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
