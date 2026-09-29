import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, notesTable } from "@workspace/db";
import { openai, CHAT_MODEL } from "@workspace/integrations-openai-ai-server";
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

function userFilter(req: Parameters<Parameters<typeof router.get>[1]>[0]) {
  return req.isAuthenticated()
    ? eq(notesTable.userId, req.user.id)
    : isNull(notesTable.userId);
}

router.get("/notes", async (req, res): Promise<void> => {
  const query = ListNotesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [userFilter(req)];
  if (query.data.subject) conditions.push(eq(notesTable.subject, query.data.subject));
  if (query.data.level) conditions.push(eq(notesTable.level, query.data.level));

  const notes = await db
    .select()
    .from(notesTable)
    .where(and(...conditions))
    .orderBy(notesTable.updatedAt);
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
      userId: req.isAuthenticated() ? req.user.id : null,
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
  const mode = parsed.data.mode ?? "detailedNotes";
  const isChapterSummary = mode === "chapterSummary";

  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    max_tokens: 8192,
    messages: [
      {
        role: "system",
        content: isChapterSummary
          ? `You are an expert Cambridge International Examinations (CAIE) study guide writer. Create a clear, high-value chapter summary for a student preparing for Cambridge ${level} ${subject}.

The student supplied a chapter title or syllabus topic. Cover the examinable knowledge normally needed for that chapter, but do not pretend that a generic chapter title is an official Cambridge syllabus quotation or exact chapter number. Do not invent a syllabus code, paper, mark allocation, or mark-scheme wording. Keep the summary accurate, age-appropriate, and useful for revision.

STRUCTURE THE SUMMARY EXACTLY LIKE THIS:

# [Chapter] — [Subject] (Cambridge ${level})

## Chapter at a glance
Write a concise overview of the chapter and how it connects to the subject.

## Essential knowledge
Summarize every major concept a student should understand for this chapter. Use concise subheadings and bullet points.

## Key terms, definitions, and formulae
List the important terms and formulae. Define terms precisely, show units where relevant, and state conditions or limitations.

## How to answer exam questions
Explain the common Cambridge command words and the response structure, method, or working that earns credit for this chapter. Do not claim an exact mark allocation unless it is provided in the prompt.

## Worked example or application
Give at least one short, clearly explained example or application. For mathematics and sciences, show the method and units; for humanities and languages, model the reasoning or response structure.

## Common misconceptions
List likely misunderstandings and how to correct them.

## Quick recall checklist
Give a compact checklist of the most important points to remember.

ACCURACY RULES:
- Stay within Cambridge ${level} level and the supplied subject/chapter.
- If the exact syllabus coverage could vary by Cambridge syllabus code or year, say so briefly rather than guessing.
- This is a formative study summary, not an official Cambridge document.`
          : `You are an expert Cambridge International Examinations (CAIE) study note writer. Your notes are used by students preparing for Cambridge ${level} exams and must be accurate to the official Cambridge syllabus.

STRUCTURE EVERY NOTE LIKE THIS:

# [Topic Name] — [Subject] (Cambridge ${level})

## Overview
One paragraph explaining what this topic is and why it matters in the syllabus context.

## Key Definitions
List every definition a student must know for this topic. Format: **Term** — definition. Use Cambridge mark-scheme language exactly.

## Core Concepts
Break down every examinable concept. Use subheadings, clear bullet points, numbered steps for processes. For sciences: include equations with units. For maths: include formulae and conditions. For humanities: include the analytical framework.

## Worked Examples / Diagrams
At least 2–3 fully worked examples showing how to approach exam questions on this topic. For maths/sciences: show every step. For humanities: model paragraph or essay structure. Label any diagrams clearly.

## Common Mistakes
List the most frequent errors students make in exams for this topic, and how to avoid them.

## Cambridge Exam Tips
- Which paper/component this typically appears in
- How many marks questions usually carry
- Which command words are used (define, explain, discuss, evaluate, calculate, sketch, suggest)
- How the mark scheme awards marks for this topic

## Quick Recall Summary
Key points in bullet form — the bare minimum a student must remember. Great for last-minute revision.

ACCURACY RULES:
- Only include content examinable in the Cambridge ${level} syllabus — not university-level material
- Use EXACTLY the same terminology as the Cambridge mark scheme (e.g. "activation energy", not "energy needed")
- For Cambridge sciences: reference the specific Cambridge ${level} syllabus learning outcomes
- Do not simplify to the point of inaccuracy — if something has a precise definition, give it precisely`,
      },
      {
        role: "user",
        content: isChapterSummary
          ? `Create a Cambridge ${level} chapter summary.\nSubject: ${subject}\nChapter or syllabus topic: ${topic}\n\nMake this a revision-friendly summary of the chapter, covering all major examinable ideas without claiming unsupported official syllabus details.`
          : `Generate comprehensive Cambridge ${level} study notes for:\nSubject: ${subject}\nTopic: ${topic}\n\nCover everything a student needs to know about this topic for their Cambridge ${level} ${subject} exam. Be thorough, accurate, and exam-focused.`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "";
  const title = isChapterSummary
    ? `${topic} — ${subject} Chapter Summary (${level})`
    : `${topic} — ${subject} (${level})`;

  const [note] = await db
    .insert(notesTable)
    .values({
      userId: req.isAuthenticated() ? req.user.id : null,
      title,
      content,
      subject,
      level,
      topic,
    })
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
    .where(and(eq(notesTable.id, params.data.id), userFilter(req)));
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
    .where(and(eq(notesTable.id, params.data.id), userFilter(req)))
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
    .where(and(eq(notesTable.id, params.data.id), userFilter(req)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
