import { Router, type IRouter } from "express";
import { db, quizSessions, studyStreaks } from "@workspace/db";
import { eq, desc, isNull } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();
router.post("/quiz/generate", async (req, res): Promise<void> => {
  const { subject, level, topic, difficulty } = req.body as {
    subject: string;
    level: string;
    topic: string;
    difficulty: "easy" | "medium" | "hard";
  };

  if (!subject || !level || !topic || !difficulty) {
    res.status(400).json({ error: "subject, level, topic, difficulty are required" });
    return;
  }

  const timeMap = { easy: 10, medium: 20, hard: 30 } as const;
  const timePerQuestion = timeMap[difficulty] ?? 20;

  const difficultyGuide =
    difficulty === "easy"
      ? "straightforward recall and basic knowledge — simple vocabulary, direct questions"
      : difficulty === "medium"
        ? "application and analysis — some reasoning required, multi-concept questions"
        : "evaluation and synthesis — challenging multi-step reasoning, precise command-word responses, subtle distractors";

  const prompt = `You are a Cambridge ${level} ${subject} examiner. Generate exactly 5 multiple-choice quiz questions on the topic "${topic}".

Difficulty: ${difficulty.toUpperCase()} — ${difficultyGuide}

Requirements:
- All questions must be Cambridge ${level} ${subject} standard
- Each question has exactly 4 options labelled A, B, C, D
- Exactly one option is correct
- Distractors (wrong options) must be plausible — not obviously wrong
- Questions must be directly relevant to "${topic}" in the ${level} ${subject} Cambridge syllabus
- Use Cambridge command words appropriately (State, Define, Explain, Calculate, etc.)

Respond ONLY with a JSON object — no markdown, no code fences, no extra text:
{
  "questions": [
    {
      "question": "full question text",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correctIndex": 0,
      "explanation": "concise explanation of why the correct answer is right"
    }
  ]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content ?? "{}";
    const parsed = JSON.parse(raw) as { questions?: unknown[] };

    res.json({
      subject,
      level,
      topic,
      difficulty,
      timePerQuestion,
      questions: parsed.questions ?? [],
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate quiz questions" });
  }
});

router.post("/quiz/complete", async (req, res): Promise<void> => {
  const { subject, level, topic, difficulty, score, totalQuestions, timePerQuestion } = req.body as {
    subject: string;
    level: string;
    topic: string;
    difficulty: string;
    score: number;
    totalQuestions: number;
    timePerQuestion: number;
  };

  const uid = req.isAuthenticated() ? req.user.id : null;

  const [session] = await db
    .insert(quizSessions)
    .values({ userId: uid, subject, level, topic, difficulty, score, totalQuestions, timePerQuestion })
    .returning();

  // Update streak for authenticated users
  if (uid) {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const [existing] = await db.select().from(studyStreaks).where(eq(studyStreaks.userId, uid));

    if (!existing) {
      await db
        .insert(studyStreaks)
        .values({ userId: uid, currentStreak: 1, longestStreak: 1, lastStudiedDate: today });
    } else if (existing.lastStudiedDate !== today) {
      const newStreak = existing.lastStudiedDate === yesterday ? existing.currentStreak + 1 : 1;
      const newLongest = Math.max(newStreak, existing.longestStreak);
      await db
        .update(studyStreaks)
        .set({ currentStreak: newStreak, longestStreak: newLongest, lastStudiedDate: today, updatedAt: new Date() })
        .where(eq(studyStreaks.userId, uid));
    }
  }

  res.json(session);
});

router.get("/quiz/history", async (req, res): Promise<void> => {
  const uid = req.isAuthenticated() ? req.user.id : null;
  const filter = uid ? eq(quizSessions.userId, uid) : isNull(quizSessions.userId);
  const sessions = await db
    .select()
    .from(quizSessions)
    .where(filter)
    .orderBy(desc(quizSessions.createdAt))
    .limit(20);
  res.json(sessions);
});

export default router;
