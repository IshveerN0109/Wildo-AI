import { Router, type IRouter } from "express";
import {
  ensureCompatibleFormat,
  speechToText,
  textToSpeech,
} from "@workspace/integrations-openai-ai-server/audio";
import { openai, CHAT_MODEL } from "@workspace/integrations-openai-ai-server";
import { EvaluateOralPracticeBody, EvaluateOralPracticeResponse } from "@workspace/api-zod";

const router: IRouter = Router();

type OralCriterionConfig = {
  id: string;
  label: string;
  assessmentObjective: string;
  maxMarks: number;
  guidance: string;
};

type SyllabusProfile = {
  code: string;
  title: string;
  component: string;
  syllabusReference: string;
  markSchemeReference: string;
  assessmentObjectives: string[];
  criteria: OralCriterionConfig[];
};

type TalkMode = "iceBreaker" | "individualTalk" | "conversation";

const SYLLABUS_PROFILES: Record<string, SyllabusProfile> = {
  "0500": {
    code: "0500",
    title: "Cambridge IGCSE First Language English",
    component: "Component 4 Speaking and Listening Test",
    syllabusReference:
      "Cambridge IGCSE First Language English 0500 syllabus for 2024–2026, Component 4",
    markSchemeReference:
      "Cambridge IGCSE First Language English 0500 syllabus for 2024–2026, Component 4 level descriptions",
    assessmentObjectives: [
      "SL1 articulate experience and express what is thought, felt and imagined",
      "SL2 present facts, ideas and opinions in a cohesive order which sustains the audience’s interest",
      "SL3 communicate clearly and purposefully using fluent language",
      "SL4 use register appropriate to context",
      "SL5 listen and respond appropriately in conversation",
    ],
    criteria: [
      {
        id: "individualTalkSpeaking",
        label: "Individual Talk — speaking",
        assessmentObjective: "SL1–SL4",
        maxMarks: 20,
        guidance: "Content, organisation, fluent delivery, language devices, and register in the individual talk.",
      },
      {
        id: "conversationSpeaking",
        label: "Conversation — speaking",
        assessmentObjective: "SL1–SL4",
        maxMarks: 10,
        guidance: "Relevant, clear, fluent contributions and appropriate register in conversation.",
      },
      {
        id: "conversationListening",
        label: "Conversation — listening",
        assessmentObjective: "SL5",
        maxMarks: 10,
        guidance: "Listening and responding appropriately to the examiner in conversation.",
      },
    ],
  },
  "0510": {
    code: "0510",
    title: "Cambridge IGCSE English as a Second Language",
    component: "Paper 3 Speaking Test",
    syllabusReference:
      "Cambridge IGCSE English as a Second Language 0510 syllabus for 2024–2026, Paper 3",
    markSchemeReference:
      "Cambridge IGCSE English as a Second Language 0510 syllabus for 2024–2026, Speaking assessment criteria",
    assessmentObjectives: [
      "AO4 Speaking / S1 communicate a range of ideas, facts and opinions",
      "AO4 Speaking / S2 demonstrate control of a range of vocabulary and grammatical structures",
      "AO4 Speaking / S3 develop responses and maintain communication",
      "AO4 Speaking / S4 demonstrate control of pronunciation and intonation",
    ],
    criteria: [
      {
        id: "grammar",
        label: "Grammar",
        assessmentObjective: "S2",
        maxMarks: 10,
        guidance: "Control and range of simple and complex grammatical structures.",
      },
      {
        id: "vocabulary",
        label: "Vocabulary",
        assessmentObjective: "S1–S2",
        maxMarks: 10,
        guidance: "Range and precision of vocabulary used to communicate ideas, facts and opinions.",
      },
      {
        id: "development",
        label: "Development",
        assessmentObjective: "S1–S3",
        maxMarks: 10,
        guidance: "Relevance, development of responses, and ability to maintain communication.",
      },
      {
        id: "pronunciation",
        label: "Pronunciation",
        assessmentObjective: "S4",
        maxMarks: 10,
        guidance: "Control and intelligibility of pronunciation and intonation; use transcript evidence conservatively.",
      },
    ],
  },
};

const BASE_ORAL_SYSTEM_PROMPT = `You are Wildo, a careful Cambridge International English Language oral examiner for practice.

Your job is to evaluate one student's spoken response to a Cambridge-style oral English prompt.

Important accuracy rules:
- Use only the configured syllabus profile supplied below. Do not substitute a generic Cambridge-style rubric.
- Do not invent an official syllabus code, paper number, mark allocation, grade boundary, assessment objective, or quotation from a mark scheme.
- This is formative practice feedback, not an official Cambridge result.
- The student may choose any topic. Treat the student's free-text topic as the subject of the speaking task, not as evidence that the topic is on an official topic list.
- Be fair to international learners. Do not penalise an accent by itself; assess intelligibility, pronunciation features, fluency, range, accuracy, and ability to communicate meaning.
- Do not reward memorised filler or penalise a natural pause.
- Base every comment on the transcript. If the transcript does not provide enough evidence for pronunciation, say so rather than guessing.
- Keep examiner language encouraging, precise, and suitable for a student.

Return ONLY valid JSON with this shape:
{
  "examinerReply": "A short spoken-style examiner response to the student, 2-4 sentences.",
  "nextQuestion": "One natural Cambridge-style follow-up question.",
  "score": {
    "criteria": [
      { "id": "configured criterion id", "marks": 0, "examinerComment": "Evidence-based comment." }
    ],
    "examinerComment": "A concise overall comment.",
    "strengths": ["specific strength"],
    "improvements": ["specific improvement"]
  }
}

The server owns the syllabus citation, criteria, mark allocations, and verification status. Never add a syllabus reference or mark-scheme claim to the JSON.`;

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asVoice(value: unknown): "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" {
  const voices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;
  return voices.includes(value as (typeof voices)[number])
    ? (value as (typeof voices)[number])
    : "alloy";
}

function asSyllabusCode(value: unknown): string {
  const code = asString(value);
  return /^\d{4}$/.test(code) ? code : "";
}

function asTalkMode(value: unknown): TalkMode {
  return value === "iceBreaker" || value === "conversation" ? value : "individualTalk";
}

function criteriaForMode(profile: SyllabusProfile, mode: TalkMode): OralCriterionConfig[] {
  if (mode === "iceBreaker") return [];
  if (profile.code === "0500") {
    return profile.criteria.filter((criterion) =>
      mode === "individualTalk"
        ? criterion.id === "individualTalkSpeaking"
        : criterion.id.startsWith("conversation"),
    );
  }
  return profile.criteria;
}

function buildSyllabusPrompt(profile: SyllabusProfile | undefined, mode: TalkMode): string {
  const modeGuidance =
    mode === "iceBreaker"
      ? `Speaking mode: Ice breaker.
- This is the unassessed opening of the speaking session.
- Do not score it, do not award marks, and do not present a performance judgment as an assessment.
- Respond naturally and invite the student into the session.`
      : mode === "individualTalk"
        ? `Speaking mode: Individual talk.
- The student speaks independently about their chosen topic.
- Assess only the individual-talk criteria configured for the syllabus profile.`
        : `Speaking mode: Conversation talk.
- The student is responding in an examiner conversation about their chosen topic.
- Assess only the conversation criteria configured for the syllabus profile.`;

  if (!profile) {
    return `${BASE_ORAL_SYSTEM_PROMPT}

${modeGuidance}

Syllabus profile:
- The student supplied a four-digit Cambridge syllabus code, but no approved oral assessment profile is configured for it.
- Do not score this response. Return an empty score.criteria array, set overall and maxTotalMarks to null, and explain in examinerComment that no mark scheme is available.
- Do not infer criteria, objectives, marks, or a source from the code.`;
  }

  const criteria = criteriaForMode(profile, mode)
    .map(
      (criterion) =>
        `- ${criterion.id}: ${criterion.label}; objective ${criterion.assessmentObjective}; maximum ${criterion.maxMarks} marks; ${criterion.guidance}`,
    )
    .join("\n");
  return `${BASE_ORAL_SYSTEM_PROMPT}

${modeGuidance}

Configured syllabus profile:
- Code: ${profile.code}
- Title: ${profile.title}
- Component: ${profile.component}
- Assessment objectives: ${profile.assessmentObjectives.join("; ")}
- Marked criteria:
${criteria}

Scoring:
- Return exactly one score.criteria entry for each configured criterion, using its exact id.
- Award an integer from 0 through that criterion's maximum marks, using only evidence in the transcript.
- overall is the sum of the returned criterion marks.
- pronunciation must be conservative when only a transcript is available; do not pretend to hear sounds that are not represented.
- A short answer is not automatically a bad answer, but explain when it limits evidence.`;
}

function unscoredResult(syllabusCode: string, mode: TalkMode) {
  return {
    overall: null,
    maxTotalMarks: null,
    criteria: [],
    examinerComment:
      mode === "iceBreaker"
        ? "Ice breaker practice is not assessed and no marks are awarded."
        : `No approved oral mark scheme is configured for syllabus ${syllabusCode}. This attempt is not scored.`,
    strengths: [],
    improvements:
      mode === "iceBreaker"
        ? []
        : ["Confirm the syllabus code and use an approved oral assessment profile before relying on marks."],
  };
}

function normalizeScore(
  value: unknown,
  profile: SyllabusProfile | undefined,
  syllabusCode: string,
  mode: TalkMode,
) {
  if (!profile || mode === "iceBreaker") return unscoredResult(syllabusCode, mode);
  const applicableCriteria = criteriaForMode(profile, mode);
  const rawScore = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawCriteria = Array.isArray(rawScore.criteria) ? rawScore.criteria : [];
  const criteria = applicableCriteria.map((criterion) => {
    const result = rawCriteria.find(
      (item) =>
        item &&
        typeof item === "object" &&
        (item as Record<string, unknown>).id === criterion.id,
    ) as Record<string, unknown> | undefined;
    const marks =
      typeof result?.marks === "number" && Number.isFinite(result.marks)
        ? Math.max(0, Math.min(criterion.maxMarks, Math.round(result.marks)))
        : 0;
    return {
      id: criterion.id,
      label: criterion.label,
      assessmentObjective: criterion.assessmentObjective,
      marks,
      maxMarks: criterion.maxMarks,
      examinerComment:
        asString(result?.examinerComment) || "No specific evidence-based comment was returned.",
    };
  });
  return {
    overall: criteria.reduce((total, criterion) => total + criterion.marks, 0),
    maxTotalMarks: applicableCriteria.reduce((total, criterion) => total + criterion.maxMarks, 0),
    criteria,
    examinerComment: asString(rawScore.examinerComment) || "Evidence-based formative feedback.",
    strengths: Array.isArray(rawScore.strengths)
      ? rawScore.strengths.filter((item): item is string => typeof item === "string").slice(0, 5)
      : [],
    improvements: Array.isArray(rawScore.improvements)
      ? rawScore.improvements.filter((item): item is string => typeof item === "string").slice(0, 5)
      : [],
  };
}

router.post("/oral-practice/evaluate", async (req, res): Promise<void> => {
  const parsedBody = EvaluateOralPracticeBody.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: parsedBody.error.message });
    return;
  }

  const subject = asString(parsedBody.data.subject);
  const level = asString(parsedBody.data.level);
  const question = asString(parsedBody.data.question);
  const syllabusCode = asSyllabusCode(parsedBody.data.syllabusCode);
  const mode = asTalkMode(parsedBody.data.mode);
  const audioBase64 = asString(parsedBody.data.audioBase64);
  const requestedFormat = parsedBody.data.audioFormat ?? "webm";
  const voice = asVoice(parsedBody.data.voice);
  const syllabusProfile = SYLLABUS_PROFILES[syllabusCode];

  if (!subject || !level || !question || !syllabusCode || !audioBase64) {
    res.status(400).json({
      error: "subject, level, syllabusCode, question, and audioBase64 are required; syllabusCode must be a four-digit code",
    });
    return;
  }

  if (audioBase64.length > 18_000_000) {
    res.status(413).json({ error: "The recording is too large. Please try a shorter answer." });
    return;
  }

  try {
    const inputBuffer = Buffer.from(audioBase64, "base64");
    const compatible = await ensureCompatibleFormat(inputBuffer);
    const transcript = await speechToText(compatible.buffer, compatible.format);

    if (!transcript.trim()) {
      res.status(422).json({ error: "No speech was detected. Please try recording again." });
      return;
    }

    const evaluationResponse = await openai.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSyllabusPrompt(syllabusProfile, mode) },
        {
          role: "user",
          content: `Level: ${level}
Subject: ${subject}
Confirmed Cambridge syllabus code: ${syllabusCode}
Speaking mode: ${mode}
Student's chosen topic or prompt: ${question}
Student transcript:
${transcript}`,
        },
      ],
    });

    const raw = evaluationResponse.choices[0]?.message?.content ?? "{}";
    const evaluation = JSON.parse(raw) as {
      examinerReply?: string;
      nextQuestion?: string;
      score?: Record<string, unknown>;
    };

    const examinerReply = asString(evaluation.examinerReply) || "Thank you. Let us continue.";
    const nextQuestion = asString(evaluation.nextQuestion) || question;
    const audioResponse = await textToSpeech(examinerReply, voice, "mp3");

    const responsePayload = {
      transcript,
      examinerReply,
      nextQuestion,
      audioResponseBase64: audioResponse.toString("base64"),
      audioMimeType: "audio/mpeg",
      voice,
      inputFormat: requestedFormat,
      score: normalizeScore(evaluation.score, syllabusProfile, syllabusCode, mode),
      verification: {
        confidence: syllabusProfile ? "medium" : "low",
        syllabusCode,
        syllabusReference: syllabusProfile?.syllabusReference ?? `Cambridge syllabus ${syllabusCode} (code confirmed; oral profile unavailable)`,
        component: syllabusProfile?.component ?? null,
        assessmentObjectives: syllabusProfile?.assessmentObjectives ?? [],
        markSchemeReference: syllabusProfile?.markSchemeReference ?? null,
        markSchemeStatus: syllabusProfile ? "configured" : "unavailable",
        markSchemeNote: mode === "iceBreaker"
          ? "Ice breaker practice is not assessed and no marks are awarded. The selected syllabus profile is used only to frame the speaking session."
          : syllabusProfile
            ? "Formative practice only; marks follow the configured syllabus profile and are not an official Cambridge result."
          : `No approved oral assessment profile is configured for syllabus ${syllabusCode}. Wildo has not invented a mark-scheme reference or score.`,
      },
    };
    res.json(EvaluateOralPracticeResponse.parse(responsePayload));
  } catch (error) {
    req.log.error({ err: error }, "Oral English evaluation failed");
    res.status(500).json({
      error: "The examiner could not process that recording. Please try again.",
    });
  }
});

export default router;