import { Router, type IRouter } from "express";
import { db, studyStreaks } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/streak", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.json({ currentStreak: 0, longestStreak: 0, lastStudiedDate: null });
    return;
  }
  const uid = req.user.id;
  const [streak] = await db.select().from(studyStreaks).where(eq(studyStreaks.userId, uid));
  if (!streak) {
    res.json({ currentStreak: 0, longestStreak: 0, lastStudiedDate: null });
    return;
  }
  res.json({
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    lastStudiedDate: streak.lastStudiedDate,
  });
});

router.post("/streak/record", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.json({ currentStreak: 0, longestStreak: 0 });
    return;
  }
  const uid = req.user.id;
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  const [existing] = await db.select().from(studyStreaks).where(eq(studyStreaks.userId, uid));

  if (!existing) {
    const [created] = await db
      .insert(studyStreaks)
      .values({ userId: uid, currentStreak: 1, longestStreak: 1, lastStudiedDate: today })
      .returning();
    res.json({ currentStreak: created.currentStreak, longestStreak: created.longestStreak });
    return;
  }

  if (existing.lastStudiedDate === today) {
    res.json({ currentStreak: existing.currentStreak, longestStreak: existing.longestStreak });
    return;
  }

  const newStreak = existing.lastStudiedDate === yesterday ? existing.currentStreak + 1 : 1;
  const newLongest = Math.max(newStreak, existing.longestStreak);

  const [updated] = await db
    .update(studyStreaks)
    .set({ currentStreak: newStreak, longestStreak: newLongest, lastStudiedDate: today, updatedAt: new Date() })
    .where(eq(studyStreaks.userId, uid))
    .returning();

  res.json({ currentStreak: updated.currentStreak, longestStreak: updated.longestStreak });
});

export default router;
