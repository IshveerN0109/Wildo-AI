import { Router, type IRouter } from "express";
import { db, notesTable, flashcardSetsTable, conversations } from "@workspace/db";
import { desc, sql, eq } from "drizzle-orm";
import { requireAuth } from "../../lib/require-auth";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/stats/summary", async (req, res): Promise<void> => {
  const uid = req.user!.id;
  const noteFilter = eq(notesTable.userId, uid);
  const setFilter = eq(flashcardSetsTable.userId, uid);
  const convFilter = eq(conversations.userId, uid);

  const [noteCount] = await db.select({ count: sql<number>`count(*)::int` }).from(notesTable).where(noteFilter);
  const [setCount] = await db.select({ count: sql<number>`count(*)::int` }).from(flashcardSetsTable).where(setFilter);
  const [convCount] = await db.select({ count: sql<number>`count(*)::int` }).from(conversations).where(convFilter);

  const subjectRows = await db
    .select({ subject: notesTable.subject, count: sql<number>`count(*)::int` })
    .from(notesTable)
    .where(noteFilter)
    .groupBy(notesTable.subject);

  res.json({
    totalNotes: noteCount?.count ?? 0,
    totalFlashcardSets: setCount?.count ?? 0,
    totalConversations: convCount?.count ?? 0,
    subjectBreakdown: subjectRows.map((r) => ({ subject: r.subject, count: r.count })),
  });
});

router.get("/stats/recent-activity", async (req, res): Promise<void> => {
  const uid = req.user!.id;
  const noteFilter = eq(notesTable.userId, uid);
  const setFilter = eq(flashcardSetsTable.userId, uid);
  const convFilter = eq(conversations.userId, uid);

  const recentNotes = await db
    .select()
    .from(notesTable)
    .where(noteFilter)
    .orderBy(desc(notesTable.createdAt))
    .limit(5);

  const recentSets = await db
    .select()
    .from(flashcardSetsTable)
    .where(setFilter)
    .orderBy(desc(flashcardSetsTable.createdAt))
    .limit(5);

  const recentConvs = await db
    .select()
    .from(conversations)
    .where(convFilter)
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
