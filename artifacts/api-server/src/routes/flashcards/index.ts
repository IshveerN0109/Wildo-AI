import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, flashcardSetsTable, flashcardsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  CreateFlashcardSetBody,
  GetFlashcardSetParams,
  DeleteFlashcardSetParams,
  GenerateFlashcardSetBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/flashcard-sets", async (_req, res): Promise<void> => {
  const sets = await db.select().from(flashcardSetsTable).orderBy(flashcardSetsTable.createdAt);
  const cards = await db.select().from(flashcardsTable);

  const cardCounts: Record<number, number> = {};
  for (const card of cards) {
    cardCounts[card.setId] = (cardCounts[card.setId] ?? 0) + 1;
  }

  const result = sets.map((s) => ({ ...s, cardCount: cardCounts[s.id] ?? 0 }));
  res.json(result);
});

router.post("/flashcard-sets", async (req, res): Promise<void> => {
  const parsed = CreateFlashcardSetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [set] = await db
    .insert(flashcardSetsTable)
    .values({
      title: parsed.data.title,
      subject: parsed.data.subject,
      level: parsed.data.level,
      topic: parsed.data.topic ?? null,
    })
    .returning();
  res.status(201).json({ ...set, cardCount: 0 });
});

router.post("/flashcard-sets/generate", async (req, res): Promise<void> => {
  const parsed = GenerateFlashcardSetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { subject, level, topic, count } = parsed.data;
  const cardCount = count ?? 10;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    max_completion_tokens: 8192,
    messages: [
      {
        role: "system",
        content: `You are an expert Cambridge exam tutor. Generate flashcards for revision. Each flashcard must have a question and answer that test key concepts from the Cambridge ${level} ${subject} syllabus. Also include a short hint where helpful. Return a JSON array only, no other text.`,
      },
      {
        role: "user",
        content: `Generate exactly ${cardCount} flashcards for:\nSubject: ${subject}\nLevel: ${level}\nTopic: ${topic}\n\nReturn ONLY a JSON array in this format:\n[{"question": "...", "answer": "...", "hint": "..."}]\nThe hint field is optional. Make questions exam-style, testing understanding not just memorization.`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "[]";
  let cardData: { question: string; answer: string; hint?: string }[] = [];
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    cardData = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    cardData = [];
  }

  const title = `${topic} — ${subject} (${level})`;
  const [set] = await db
    .insert(flashcardSetsTable)
    .values({ title, subject, level, topic })
    .returning();

  const insertedCards =
    cardData.length > 0
      ? await db
          .insert(flashcardsTable)
          .values(
            cardData.map((c) => ({
              setId: set.id,
              question: c.question,
              answer: c.answer,
              hint: c.hint ?? null,
            }))
          )
          .returning()
      : [];

  res.status(201).json({ ...set, cardCount: insertedCards.length, cards: insertedCards });
});

router.get("/flashcard-sets/:id", async (req, res): Promise<void> => {
  const params = GetFlashcardSetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [set] = await db
    .select()
    .from(flashcardSetsTable)
    .where(eq(flashcardSetsTable.id, params.data.id));
  if (!set) {
    res.status(404).json({ error: "Flashcard set not found" });
    return;
  }
  const cards = await db
    .select()
    .from(flashcardsTable)
    .where(eq(flashcardsTable.setId, params.data.id));
  res.json({ ...set, cardCount: cards.length, cards });
});

router.delete("/flashcard-sets/:id", async (req, res): Promise<void> => {
  const params = DeleteFlashcardSetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [deleted] = await db
    .delete(flashcardSetsTable)
    .where(eq(flashcardSetsTable.id, params.data.id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Flashcard set not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
