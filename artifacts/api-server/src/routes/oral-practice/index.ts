import { Router, type IRouter } from "express";
import {
  ensureCompatibleFormat,
  speechToText,
  textToSpeech,
} from "@workspace/integrations-openai-ai-server/audio";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const CAMBRIDGE_ORAL_SYSTEM_PROMPT = `You are Wildo, a careful Cambridge International English Language oral examiner for practice.

Your job is to evaluate one student's spoken response to a Cambridge-style oral English prompt.

Important accuracy rules:
- Use only Cambridge-style assessment principles: content and communication, vocabulary and grammar, pronunciation, and fluency/interaction.
- Do not invent an official syllabus code, paper number, mark allocation, grade boundary, or quotation from a mark scheme.
- If the exact Cambridge syllabus code is not supplied, say that the reference is a general Cambridge-style practice reference, not an official mark.
- This is formative practice feedback, not an official Cambridge result.
- Be fair to international learners. Do not penalise an accent by itself; assess intelligibility, pronunciation features, fluency, range, accuracy, and ability to communicate meaning.
- Do not reward memorised filler or penalise a natural pause.
- Base every comment on the transcript. If the transcript does not provide enough evidence for pronunciation, say so rather than guessing.
- Keep examiner language encouraging, precise, and suitable for a student.

Return ONLY valid JSON with this shape:
{
  "examinerReply": "A short spoken-style examiner response to the student, 2-4 sentences.",
  "nextQuestion": "One natural Cambridge-style follow-up question.",
  "score": {
    "overall": 0,
    "contentAndCommunication": 0,
    "vocabularyAndGrammar": 0,
    "fluencyAndInteraction": 0,
    "pronunciation": 0,
    "maxPerCriterion": 5,
    "examinerComment": "A concise overall comment.",
    "strengths": ["specific strength"],
    "improvements": ["specific improvement"]
  },
  "verification": {
    "confidence": "high|medium|low",
    "syllabusReference": "General Cambridge-style oral English practice",
    "markSchemeNote": "Explain briefly that this is formative practice and not an official mark."
  }
}

Scoring:
- Score each criterion from 0 to 5 using evidence in the response.
- overall is the sum of the four criterion scores, from 0 to 20.
- pronunciation must be conservative when only a transcript is available; do not pretend to hear sounds that are not represented.
- A short answer is not automatically a bad answer, but explain when it limits evidence.`;

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asVoice(value: unknown): "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" {
  const voices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;
  return voices.includes(value as (typeof voices)[number])
    ? (value as (typeof voices)[number])
    : "alloy";
}

router.post("/oral-practice/evaluate", async (req, res): Promise<void> => {
  const subject = asString(req.body?.subject);
  const level = asString(req.body?.level);
  const question = asString(req.body?.question);
  const audioBase64 = asString(req.body?.audioBase64);
  const requestedFormat = asString(req.body?.audioFormat) || "webm";
  const voice = asVoice(req.body?.voice);

  if (!subject || !level || !question || !audioBase64) {
    res.status(400).json({
      error: "subject, level, question, and audioBase64 are required",
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
      model: "gpt-4o",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CAMBRIDGE_ORAL_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Level: ${level}
Subject: ${subject}
Cambridge-style oral question: ${question}
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
      verification?: Record<string, unknown>;
    };

    const examinerReply = asString(evaluation.examinerReply) || "Thank you. Let us continue.";
    const nextQuestion = asString(evaluation.nextQuestion) || question;
    const audioResponse = await textToSpeech(examinerReply, voice, "mp3");

    res.json({
      transcript,
      examinerReply,
      nextQuestion,
      audioResponseBase64: audioResponse.toString("base64"),
      audioMimeType: "audio/mpeg",
      voice,
      inputFormat: requestedFormat,
      score: evaluation.score ?? {
        overall: 0,
        contentAndCommunication: 0,
        vocabularyAndGrammar: 0,
        fluencyAndInteraction: 0,
        pronunciation: 0,
        maxPerCriterion: 5,
        examinerComment: "The response could not be scored yet.",
        strengths: [],
        improvements: ["Please try another recording."],
      },
      verification: evaluation.verification ?? {
        confidence: "low",
        syllabusReference: "General Cambridge-style oral English practice",
        markSchemeNote: "Formative practice only; not an official Cambridge mark.",
      },
    });
  } catch (error) {
    req.log.error({ err: error }, "Oral English evaluation failed");
    res.status(500).json({
      error: "The examiner could not process that recording. Please try again.",
    });
  }
});

export default router;