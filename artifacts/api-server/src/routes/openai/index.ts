import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, conversations, messages, studentAttachmentsTable } from "@workspace/db";
import { recordQuestionForUser } from "../streaks";
import {
  openai,
  openaiVision,
  CHAT_MODEL,
  VISION_CHAT_MODEL,
  type ChatCompletionMessageParam,
} from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../../lib/require-auth";
import { requireQuota } from "../../lib/require-quota";
import { ObjectStorageService } from "../../lib/objectStorage";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import {
  CreateOpenaiConversationBody,
  GetOpenaiConversationParams,
  DeleteOpenaiConversationParams,
  ListOpenaiMessagesParams,
  SendOpenaiMessageParams,
  SendOpenaiMessageBody,
} from "@workspace/api-zod";

const router: IRouter = Router();
router.use(requireAuth);
const objectStorageService = new ObjectStorageService();
const MAX_ATTACHMENT_BYTES = 20_000_000;
const MAX_TOTAL_ATTACHMENT_BYTES = 30_000_000;
const MAX_DOCUMENT_TEXT_CHARS = 40_000;
const MAX_TOTAL_DOCUMENT_TEXT_CHARS = 100_000;

interface PreparedAttachment {
  id: number;
  fileName: string;
  contentType: string;
  size: number;
  imageDataUrl?: string;
  extractedText?: string;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
}

async function prepareAttachment(
  attachment: typeof studentAttachmentsTable.$inferSelect,
): Promise<PreparedAttachment> {
  const file = await objectStorageService.getObjectEntityFile(attachment.objectPath);
  const [metadata] = await file.getMetadata();
  if (Number(metadata.size ?? attachment.size) > MAX_ATTACHMENT_BYTES) {
    throw new Error(`"${attachment.fileName}" exceeds the 20 MB attachment limit.`);
  }

  const [buffer] = await file.download();
  if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new Error(`"${attachment.fileName}" exceeds the 20 MB attachment limit.`);
  }

  const contentType = attachment.contentType.split(";")[0].trim().toLowerCase();
  const prepared: PreparedAttachment = {
    id: attachment.id,
    fileName: attachment.fileName,
    contentType,
    size: buffer.byteLength,
  };

  if (contentType.startsWith("image/")) {
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(contentType)) {
      throw new Error(`"${attachment.fileName}" uses an unsupported image format.`);
    }
    prepared.imageDataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
    return prepared;
  }

  if (contentType === "application/pdf") {
    prepared.extractedText = await extractPdfText(buffer);
    if (!prepared.extractedText.trim()) {
      throw new Error(`"${attachment.fileName}" has no selectable text. Upload a text-based PDF or page images.`);
    }
  } else if (contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    prepared.extractedText = (await mammoth.extractRawText({ buffer })).value;
  } else if (
    contentType === "text/plain" ||
    contentType === "text/markdown" ||
    contentType === "text/csv" ||
    contentType === "application/json"
  ) {
    prepared.extractedText = buffer.toString("utf8");
  } else {
    throw new Error(`"${attachment.fileName}" has an unsupported document format.`);
  }

  prepared.extractedText = prepared.extractedText.slice(0, MAX_DOCUMENT_TEXT_CHARS);
  return prepared;
}

// ─── Cambridge Verification Pipeline ────────────────────────────────────────

interface VerificationResult {
  syllabusRef: string | null;
  markSchemePoints: string[];
  confidence: "high" | "medium" | "low";
  examinerNote: string | null;
}

async function verifyQuestion(
  question: string,
  subject: string | null,
  level: string | null,
): Promise<VerificationResult> {
  const subjectCtx = [subject, level].filter(Boolean).join(" ") || "unknown subject";
  try {
    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      max_tokens: 220,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: `You are a Cambridge International Examinations expert. A student studying ${subjectCtx} has asked or is about to receive a response to:

"${question.slice(0, 400)}"

Respond with ONLY valid JSON — no markdown fences, no explanation:
{
  "syllabusRef": "exact syllabus code + learning objective (e.g. 'Physics 9702 LO 5.1.3') or null if you cannot confirm it precisely",
  "markSchemePoints": ["what examiners actually award marks for — max 4 bullet points — use Cambridge mark-scheme language"],
  "confidence": "high if you are certain of the exact mark scheme, medium if mostly certain, low if genuinely uncertain",
  "examinerNote": "relevant warning from Cambridge examiner reports (e.g. common errors, misconceptions examiners flag) or null"
}

CRITICAL: Do NOT invent syllabus references. If uncertain, set syllabusRef to null and confidence to low. Accuracy over confidence.`,
        },
      ],
    });
    const raw = (response.choices[0]?.message?.content ?? "{}").trim();
    const parsed = JSON.parse(raw.replace(/^```json\n?/, "").replace(/\n?```$/, ""));
    return {
      syllabusRef: typeof parsed.syllabusRef === "string" ? parsed.syllabusRef : null,
      markSchemePoints: Array.isArray(parsed.markSchemePoints) ? parsed.markSchemePoints.slice(0, 4) : [],
      confidence: (["high", "medium", "low"] as const).includes(parsed.confidence) ? parsed.confidence : "medium",
      examinerNote: typeof parsed.examinerNote === "string" ? parsed.examinerNote : null,
    };
  } catch {
    return { syllabusRef: null, markSchemePoints: [], confidence: "medium", examinerNote: null };
  }
}

function buildVerificationContext(v: VerificationResult): string {
  const parts: string[] = [
    "════════════════════════════════",
    "VERIFICATION CONTEXT (checked before answering)",
    "════════════════════════════════",
  ];
  if (v.syllabusRef) parts.push(`Syllabus reference: ${v.syllabusRef}`);
  if (v.markSchemePoints.length > 0) {
    parts.push("Mark scheme key points:");
    v.markSchemePoints.forEach((p) => parts.push(`  • ${p}`));
  }
  parts.push(`Confidence in mark scheme: ${v.confidence.toUpperCase()}`);
  if (v.examinerNote) parts.push(`Examiner report note: ${v.examinerNote}`);
  parts.push(
    v.confidence === "low"
      ? "INSTRUCTION: Explicitly tell the student you are not certain of the exact mark scheme for this. Advise them to verify with official Cambridge past paper mark schemes at cambridgeinternational.org. Still give your best answer but be transparent about uncertainty."
      : "INSTRUCTION: Use these mark scheme points to frame your answer. Align your response to what Cambridge examiners actually award marks for.",
  );
  return parts.join("\n");
}

// ────────────────────────────────────────────────────────────────────────────

function userFilter(req: Parameters<Parameters<typeof router.get>[1]>[0]) {
  return eq(conversations.userId, req.user!.id);
}

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
QUESTION GENERATION — CAMBRIDGE STYLE (MANDATORY)
════════════════════════════════
Whenever you give a student ANY practice question, exam question, or revision question — invented or from memory — follow ALL of these rules without exception:

1. ALWAYS show the mark allocation in square brackets immediately after the question:
   "State one function of the mitochondria. [1]"
   "Explain why increasing temperature increases the rate of a reaction. [3]"
   "Discuss the advantages and disadvantages of monopoly. [8]"
   The mark allocation tells the student exactly how much depth is expected. Never omit it.

2. MATCH the command word to the mark allocation every single time:
   • [1]     → State / Name / Identify / Give / Write down / Define
   • [2]     → State and explain / Give one reason with explanation / Describe briefly
   • [3–4]   → Explain / Describe in detail / Calculate (show full working) / Compare
   • [5–6]   → Discuss / Analyse / Examine / Assess
   • [7–10]  → Evaluate / To what extent / Essay-style (intro + developed body + conclusion)
   Using the wrong command word for the mark value is a mismatch — never do it.

3. FORMAT questions by paper type:
   • Structured papers (Paper 2, 4): use sub-parts (a)(i), (a)(ii), (b)(i) etc. with marks on each part
   • MCQ (Paper 1): four options A–D, exactly one correct, label the paper
   • Data response / case study (Economics, Business): 3–5 line scenario stem, then numbered questions
   • Sciences practical (Paper 3/5): present data/graph/table description, then question
   • Essay papers (History, Literature, GP): clear rubric and mark band guidance

4. INVENT with full Cambridge authenticity:
   • Use real-world contexts Cambridge favours (e.g. Physics: roller coasters, power stations; Chemistry: industrial Haber process; Economics: real countries and policies; History: real events and sources)
   • Match the difficulty band of the actual paper — not easier, not harder
   • Use precise subject vocabulary exactly as it appears in Cambridge mark schemes
   • Sciences: always include units, significant figures guidance, and state the formula required for calculation questions

5. AFTER a student answers, always mark it Cambridge-style:
   Show a mini mark scheme:
   ✓ [credited point] — mark awarded
   ✗ [missed point] — what was expected
   Total: X / Y marks
   Then explain what a full-mark answer would look like.

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


router.get("/openai/conversations", async (req, res): Promise<void> => {
  const convs = await db
    .select()
    .from(conversations)
    .where(userFilter(req))
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
       userId: req.user!.id,
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
    .where(and(eq(conversations.id, params.data.id), userFilter(req)));
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
    .where(and(eq(conversations.id, params.data.id), userFilter(req)))
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
  // verify ownership before returning messages
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, params.data.id), userFilter(req)));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, params.data.id))
    .orderBy(messages.createdAt);
  res.json(msgs);
});

router.post("/openai/conversations/:id/messages", requireQuota("tutorMessage"), async (req, res): Promise<void> => {
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
  const attachmentIds = [...new Set(body.data.attachmentIds ?? [])];
  if (!body.data.content.trim() && attachmentIds.length === 0) {
    res.status(400).json({ error: "Enter a message or attach a file." });
    return;
  }

  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, params.data.id), userFilter(req)));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const ownedAttachments = attachmentIds.length
    ? await db
        .select()
        .from(studentAttachmentsTable)
        .where(
          and(
            eq(studentAttachmentsTable.userId, req.user!.id),
            inArray(studentAttachmentsTable.id, attachmentIds),
          ),
        )
    : [];
  if (ownedAttachments.length !== attachmentIds.length) {
    res.status(404).json({ error: "One or more attachments were not found." });
    return;
  }
  if (ownedAttachments.reduce((total, attachment) => total + attachment.size, 0) > MAX_TOTAL_ATTACHMENT_BYTES) {
    res.status(413).json({ error: "Attachments must total 30 MB or less per message." });
    return;
  }

  let preparedAttachments: PreparedAttachment[] = [];
  try {
    const attachmentsById = new Map(ownedAttachments.map((attachment) => [attachment.id, attachment]));
    let totalBytes = 0;
    for (const id of attachmentIds) {
      const prepared = await prepareAttachment(attachmentsById.get(id)!);
      totalBytes += prepared.size;
      if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
        res.status(413).json({ error: "Attachments must total 30 MB or less per message." });
        return;
      }
      preparedAttachments.push(prepared);
    }
  } catch (error) {
    req.log.warn({ err: error }, "Failed to prepare student attachment");
    res.status(422).json({
      error: error instanceof Error ? error.message : "Could not read one of the attached files.",
    });
    return;
  }

  const attachmentNames = preparedAttachments.map((attachment) => attachment.fileName);
  const persistedUserContent = [
    body.data.content.trim(),
    attachmentNames.length ? `Attachments: ${attachmentNames.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  await db.insert(messages).values({
    conversationId: params.data.id,
    role: "user",
    content: persistedUserContent,
  });
  if (req.isAuthenticated()) {
    await recordQuestionForUser(req.user.id);
  }

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, params.data.id))
    .orderBy(messages.createdAt);

  // Phase 1: fast verification (runs before streaming starts)
  const verification = body.data.content.trim()
    ? await verifyQuestion(body.data.content, conv.subject, conv.level)
    : null;

  const subjectContext = conv.subject
    ? ` Focus on ${conv.subject} at ${conv.level ?? "Cambridge"} level.`
    : "";

  const verificationContext = verification
    ? buildVerificationContext(verification)
    : "No typed question was provided. Analyze the attached material directly and explain what is visible or readable.";

  const chatMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: CAMBRIDGE_SYSTEM_PROMPT + subjectContext + "\n\n" + verificationContext },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const latestUserMessage = chatMessages.length - 1;
  const latestUserText = history[history.length - 1]?.content ?? persistedUserContent;
  const documentText = preparedAttachments
    .filter((attachment) => attachment.extractedText)
    .map((attachment) => {
      const text = attachment.extractedText ?? "";
      const wasTruncated = text.length >= MAX_DOCUMENT_TEXT_CHARS;
      return [
        `\n\n--- Document: ${attachment.fileName} ---`,
        text,
        wasTruncated ? "\n[Document text truncated for length.]" : "",
      ].join("\n");
    })
    .join("\n")
    .slice(0, MAX_TOTAL_DOCUMENT_TEXT_CHARS);

  const imageAttachments = preparedAttachments.filter(
    (attachment): attachment is PreparedAttachment & { imageDataUrl: string } =>
      Boolean(attachment.imageDataUrl),
  );
  const currentUserText = [
    latestUserText || "Please help me understand the attached file(s).",
    documentText,
  ].join("\n");
  const hasImages = imageAttachments.length > 0;
  chatMessages[latestUserMessage] = hasImages
    ? {
        role: "user",
        content: [
          { type: "text", text: currentUserText },
          ...imageAttachments.map((attachment) => ({
            type: "image_url" as const,
            image_url: { url: attachment.imageDataUrl, detail: "auto" as const },
          })),
        ],
      }
    : { role: "user", content: currentUserText };

  let stream;
  try {
    stream = await (hasImages ? openaiVision : openai).chat.completions.create({
      model: hasImages ? VISION_CHAT_MODEL : CHAT_MODEL,
      max_tokens: 8192,
      messages: chatMessages,
      stream: true,
    });
  } catch (error) {
    req.log.error({ err: error }, "Tutor AI request failed");
    res.status(502).json({ error: "The AI could not process this message. Please try again." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Send verification metadata to frontend before content starts.
  res.write(`data: ${JSON.stringify({ type: "verification", skipped: !verification, ...(verification ?? {}) })}\n\n`);

  let fullResponse = "";

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

router.post("/openai/revision-stream", requireQuota("tutorMessage"), async (req, res): Promise<void> => {
  const { messages: msgs, system, subject, level } = req.body as {
    messages: { role: string; content: string }[];
    system?: string;
    subject?: string;
    level?: string;
  };

  if (!Array.isArray(msgs)) {
    res.status(400).json({ error: "messages must be an array" });
    return;
  }

  // Phase 1: verify the latest user message
  const lastUserMsg = [...msgs].reverse().find((m) => m.role === "user");
  const verification = lastUserMsg
    ? await verifyQuestion(lastUserMsg.content, subject ?? null, level ?? null)
    : { syllabusRef: null, markSchemePoints: [], confidence: "high" as const, examinerNote: null };

  const verificationContext = buildVerificationContext(verification);

  const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: (system ?? CAMBRIDGE_SYSTEM_PROMPT) + "\n\n" + verificationContext },
    ...msgs.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Send verification metadata before content stream
  res.write(`data: ${JSON.stringify({ type: "verification", ...verification })}\n\n`);

  const stream = await openai.chat.completions.create({
    model: CHAT_MODEL,
    max_tokens: 8192,
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
