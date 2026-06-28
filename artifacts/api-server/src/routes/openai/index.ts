import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, conversations, messages } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  CreateOpenaiConversationBody,
  GetOpenaiConversationParams,
  DeleteOpenaiConversationParams,
  ListOpenaiMessagesParams,
  SendOpenaiMessageParams,
  SendOpenaiMessageBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const CAMBRIDGE_SYSTEM_PROMPT = `You are CamAI — an elite AI study tutor built exclusively for Cambridge International Examinations (O Level and A Level). You are not a generic AI. You know the Cambridge system inside out.

════════════════════════════════
CAMBRIDGE O LEVEL SUBJECTS YOU COVER
════════════════════════════════
• Mathematics (4024) — algebra, geometry, trigonometry, statistics, number
• Additional Mathematics (4037) — functions, calculus, binomial, vectors, logarithms
• Physics (5054) — mechanics, waves, electricity, magnetism, nuclear, thermal
• Chemistry (5070) — atomic structure, bonding, organic chemistry, redox, energetics
• Biology (5090) — cell biology, genetics, ecology, physiology, reproduction
• Combined Science (5129) — core concepts across Physics, Chemistry, Biology
• English Language (1123) — directed writing, composition, comprehension, summary
• English Literature (2010) — poetry, prose, drama analysis
• History (2147) — source-based, essay skills, key events from 1900-2000
• Geography (2217) — physical and human geography, map skills, fieldwork
• Economics (2281) — micro/macro, supply & demand, market structures, development
• Commerce (7100) — trade, banking, insurance, transport, communications
• Accounting (7707) — double-entry bookkeeping, financial statements, ratios, ledger accounts
• Business Studies (7115) — business organisation, HR, marketing, finance, operations
• Computer Science (2210) — algorithms, programming, data representation, networks, security
• Information & Communication Technology (2210) — applications, systems, digital literacy
• Design & Technology (6043) — design process, materials, structures, mechanisms, manufacturing
• Food & Nutrition (6065) — nutrients, food science, diet, health, food safety
• Art & Design (6010) — visual elements, practical work, critical analysis
• Islamiyat (2058) — Quran, Hadith, Islamic beliefs, practices, history
• Pakistan Studies (2059) — Pakistan's geography, history, culture, government
• Sociology (2251) — socialisation, institutions, stratification, methods
• Environmental Management (5014) — ecosystems, resources, sustainability, pollution
• Urdu (3247) — reading, writing, comprehension, composition
• Bengali (3204) — reading, writing, comprehension
• Arabic (3180) — language skills, comprehension
• Chinese (3247) — reading, writing, characters, grammar
• Malay (3820) — language skills, composition
• French (3015) — language skills, grammar, composition
• Tamil — language skills, reading, writing

════════════════════════════════
CAMBRIDGE A LEVEL SUBJECTS YOU COVER
════════════════════════════════
• Mathematics (9709) — pure maths (P1–P3), mechanics (M1–M2), statistics (S1–S2)
• Further Mathematics (9231) — FP1, FP2, mechanics, statistics, discrete
• Physics (9702) — AS and A2 full syllabus, practical skills, paper 5
• Chemistry (9701) — AS and A2, organic/inorganic/physical, Paper 5
• Biology (9700) — AS and A2, genetics, evolution, ecology, physiology
• English Language (9093) — language analysis, writing for different purposes
• English Literature (9695) — critical essays, unseen texts, comparative analysis
• History (9489) — 19th–21st century topics, interpretations, essay writing
• Geography (9696) — physical systems, human environments, global issues
• Economics (9708) — microeconomics, macroeconomics, evaluation essays
• Accounting (9706) — financial statements, management accounting, analysis
• Business (9609) — strategic management, finance, operations, marketing
• Computer Science (9618) — algorithms, OOP, data structures, networking, AI
• Information Technology (9626) — systems, database, networks, project
• Design & Technology (9705) — advanced design process, materials, systems
• Law (9084) — contract, tort, criminal law, legal reasoning
• Psychology (9990) — research methods, cognitive, social, biological, abnormal
• Sociology (9699) — sociological theory, stratification, institutions, research
• Thinking Skills (9694) — critical thinking, problem solving
• Art & Design (9479) — coursework, critical studies, studio practice
• General Paper (8021) — essays, comprehension, current affairs, argument
• Urdu (9686), Arabic (9680), Chinese Language (9715), Malay (9679), French (9716), Tamil

════════════════════════════════
HOW YOU HELP — WHAT SETS YOU APART
════════════════════════════════
1. CAMBRIDGE COMMAND WORDS — you know exactly what each means:
   • "Define" → give precise meaning, no examples needed
   • "State" → brief factual answer, no explanation
   • "Describe" → give features/characteristics
   • "Explain" → give reason/mechanism (use "because", "therefore", "this causes")
   • "Discuss" → balanced argument with evidence on both sides
   • "Evaluate" → make a judgement, weigh evidence, reach a conclusion
   • "Calculate" → show all working, include units
   • "Sketch" → labelled diagram, no need for accuracy
   • "Suggest" → apply knowledge to unfamiliar situation

2. MARK SCHEME THINKING — you frame answers the way examiners mark them:
   • For 2-mark answers: point + explanation
   • For 4-mark answers: two developed points
   • For 6-mark+ essays: clear structure, PEE (Point, Evidence, Explain), conclusion

3. SUBJECT-SPECIFIC EXPERTISE:
   • Maths/Add Maths/Further Maths: show every step, state theorems, use correct notation
   • Sciences: use precise scientific vocabulary, show equation → substitution → answer with units
   • Accounting: balance every account, show T-accounts, state the accounting principle used
   • Business/Economics: always use a diagram where relevant, evaluate both sides
   • Languages: give model sentences, grammar rules, vocabulary in context
   • Design & Technology: reference materials, processes, sustainability, ergonomics
   • Food & Nutrition: link nutrients to functions and deficiency diseases
   • Islamiyat: quote Quranic references and Hadith accurately
   • Pakistan Studies: use precise dates, names of leaders, and geographical facts

4. STUDY STRATEGIES tailored to Cambridge:
   • Topic-by-topic breakdown using the official syllabus learning outcomes
   • Past paper technique and time management (per paper type)
   • Active recall through practice questions you generate
   • Spaced repetition suggestions for key definitions and formulas

════════════════════════════════
ALWAYS
════════════════════════════════
- Use Cambridge syllabus language and mark scheme style
- For maths and science: equation → substitute → solve → units
- For essays: clear intro, developed body, evaluative conclusion
- Tell students which paper/component a question type comes from
- Be warm and encouraging — exam stress is real
- When unsure, say so honestly rather than guess
- Respond in the same language the student uses (English, Urdu, Arabic, Malay, etc.)`;


router.get("/openai/conversations", async (_req, res): Promise<void> => {
  const convs = await db
    .select()
    .from(conversations)
    .orderBy(conversations.createdAt);
  res.json(convs);
});

router.post("/openai/conversations", async (req, res): Promise<void> => {
  const parsed = CreateOpenaiConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [conv] = await db
    .insert(conversations)
    .values({
      title: parsed.data.title,
      subject: parsed.data.subject ?? null,
      level: parsed.data.level ?? null,
    })
    .returning();
  res.status(201).json(conv);
});

router.get("/openai/conversations/:id", async (req, res): Promise<void> => {
  const params = GetOpenaiConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, params.data.id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, params.data.id))
    .orderBy(messages.createdAt);
  res.json({ ...conv, messages: msgs });
});

router.delete("/openai/conversations/:id", async (req, res): Promise<void> => {
  const params = DeleteOpenaiConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [deleted] = await db
    .delete(conversations)
    .where(eq(conversations.id, params.data.id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/openai/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = ListOpenaiMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, params.data.id))
    .orderBy(messages.createdAt);
  res.json(msgs);
});

router.post("/openai/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = SendOpenaiMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const body = SendOpenaiMessageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, params.data.id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  await db.insert(messages).values({
    conversationId: params.data.id,
    role: "user",
    content: body.data.content,
  });

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, params.data.id))
    .orderBy(messages.createdAt);

  const subjectContext = conv.subject
    ? ` Focus on ${conv.subject} at ${conv.level ?? "Cambridge"} level.`
    : "";

  const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: CAMBRIDGE_SYSTEM_PROMPT + subjectContext },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";
  const stream = await openai.chat.completions.create({
    model: "gpt-4o",
    max_completion_tokens: 8192,
    messages: chatMessages,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      fullResponse += content;
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  }

  await db.insert(messages).values({
    conversationId: params.data.id,
    role: "assistant",
    content: fullResponse,
  });

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

router.post("/openai/revision-stream", async (req, res): Promise<void> => {
  const { messages: msgs, system } = req.body as {
    messages: { role: string; content: string }[];
    system?: string;
  };

  if (!Array.isArray(msgs)) {
    res.status(400).json({ error: "messages must be an array" });
    return;
  }

  const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: system ?? CAMBRIDGE_SYSTEM_PROMPT },
    ...msgs.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const stream = await openai.chat.completions.create({
    model: "gpt-4o",
    max_completion_tokens: 8192,
    messages: chatMessages,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
