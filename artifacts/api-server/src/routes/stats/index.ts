import { Router, type IRouter } from "express";
import { db, notesTable, flashcardSetsTable, conversations } from "@workspace/db";
import { desc, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/stats/summary", async (_req, res): Promise<void> => {
  const [noteCount] = await db.select({ count: sql<number>`count(*)::int` }).from(notesTable);
  const [setCount] = await db.select({ count: sql<number>`count(*)::int` }).from(flashcardSetsTable);
  const [convCount] = await db.select({ count: sql<number>`count(*)::int` }).from(conversations);

  const subjectRows = await db
    .select({ subject: notesTable.subject, count: sql<number>`count(*)::int` })
    .from(notesTable)
    .groupBy(notesTable.subject);

  res.json({
    totalNotes: noteCount?.count ?? 0,
    totalFlashcardSets: setCount?.count ?? 0,
    totalConversations: convCount?.count ?? 0,
    subjectBreakdown: subjectRows.map((r) => ({ subject: r.subject, count: r.count })),
  });
});

router.get("/stats/recent-activity", async (_req, res): Promise<void> => {
  const recentNotes = await db
    .select()
    .from(notesTable)
    .orderBy(desc(notesTable.createdAt))
    .limit(5);

  const recentSets = await db
    .select()
    .from(flashcardSetsTable)
    .orderBy(desc(flashcardSetsTable.createdAt))
    .limit(5);

  const recentConvs = await db
    .select()
    .from(conversations)
    .orderBy(desc(conversations.createdAt))
    .limit(5);

  const activity = [
    ...recentNotes.map((n) => ({
      id: n.id,
      type: "note",
      title: n.title,
      subject: n.subject,
      level: n.level,
      createdAt: n.createdAt,
    })),
    ...recentSets.map((s) => ({
      id: s.id,
      type: "flashcard",
      title: s.title,
      subject: s.subject,
      level: s.level,
      createdAt: s.createdAt,
    })),
    ...recentConvs.map((c) => ({
      id: c.id,
      type: "conversation",
      title: c.title,
      subject: c.subject ?? "General",
      level: c.level ?? "General",
      createdAt: c.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  res.json(activity);
});

export default router;
