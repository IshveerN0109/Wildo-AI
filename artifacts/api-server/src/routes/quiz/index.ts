import { Router, type IRouter } from "express";
import { db, quizSessions } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { openai, CHAT_MODEL, ACTIVE_PROVIDER } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../../lib/require-auth";
import { requireQuota } from "../../lib/require-quota";
import { recordAiUsage } from "../../lib/aiCost";

const router: IRouter = Router();
router.use(requireAuth);
router.post("/quiz/generate", requireQuota("quizGeneration"), async (req, res): Promise<void> => {
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
      model: CHAT_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content ?? "{}";
    await recordAiUsage({
      userId: req.user!.id,
      feature: "quizGeneration",
      provider: ACTIVE_PROVIDER,
      model: CHAT_MODEL,
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completionTokens: completion.usage?.completion_tokens ?? 0,
    });
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

  const uid = req.user!.id;

  const [session] = await db
    .insert(quizSessions)
    .values({ userId: uid, subject, level, topic, difficulty, score, totalQuestions, timePerQuestion })
    .returning();

  res.json(session);
});

router.get("/quiz/history", async (req, res): Promise<void> => {
  const uid = req.user!.id;
  const filter = eq(quizSessions.userId, uid);
  const sessions = await db
    .select()
    .from(quizSessions)
    .where(filter)
    .orderBy(desc(quizSessions.createdAt))
    .limit(20);
  res.json(sessions);
});

export default router;
