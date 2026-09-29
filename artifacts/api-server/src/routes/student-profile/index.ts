import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, studentProfilesTable } from "@workspace/db";
import { UpdateStudentProfileBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/student/profile", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const [profile] = await db
    .select({ level: studentProfilesTable.level })
    .from(studentProfilesTable)
    .where(eq(studentProfilesTable.userId, req.user.id));

  res.json({ level: profile?.level ?? null });
});

router.put("/student/profile", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const parsed = UpdateStudentProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [profile] = await db
    .insert(studentProfilesTable)
    .values({
      userId: req.user.id,
      level: parsed.data.level,
    })
    .onConflictDoUpdate({
      target: studentProfilesTable.userId,
      set: {
        level: parsed.data.level,
        updatedAt: new Date(),
      },
    })
    .returning({ level: studentProfilesTable.level });

  res.json(profile);
});

export default router;