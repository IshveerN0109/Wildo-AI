import { and, eq, inArray } from "drizzle-orm";
import { db, studentAttachmentsTable } from "@workspace/db";

import { ObjectStorageService } from "./objectStorage";

const objectStorageService = new ObjectStorageService();

// Keeps a single large attachment from blowing the model's context window.
const MAX_EXTRACTED_TEXT = 12_000;

export interface ResolvedAttachment {
  fileName: string;
  contentType: string;
  kind: "image" | "text";
  /** Set when kind === "image": a data: URL suitable for an image_url content part. */
  imageDataUrl?: string;
  /** Set when kind === "text": extracted/decoded text, truncated to MAX_EXTRACTED_TEXT. */
  extractedText?: string;
}

async function extractText(buffer: Buffer, contentType: string): Promise<string> {
  // Imported dynamically, not at module top level: pdf-parse pulls in pdf.js's
  // canvas/rendering path, which throws ("DOMMatrix is not defined") as soon
  // as it loads without the optional @napi-rs/canvas native package — and
  // since this module is reached from routes/index.ts at server startup, a
  // top-level import would crash the entire app on boot, not just PDF
  // attachments. Same reasoning as the lazy AI clients in client.ts.
  if (contentType === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // text/plain, text/markdown, text/csv, application/json
  return buffer.toString("utf-8");
}

/**
 * Fetches and reads the given attachments (scoped to `userId` — a student can
 * only ever read their own uploads), ready to drop into a chat prompt: images
 * become inline data: URLs for a vision-capable model, everything else is
 * decoded/extracted to plain text. Attachments that fail to read (corrupt
 * file, storage hiccup) are silently skipped rather than failing the whole
 * chat request.
 */
export async function resolveAttachments(
  userId: string,
  attachmentIds: number[],
): Promise<ResolvedAttachment[]> {
  if (attachmentIds.length === 0) return [];

  const rows = await db
    .select()
    .from(studentAttachmentsTable)
    .where(
      and(eq(studentAttachmentsTable.userId, userId), inArray(studentAttachmentsTable.id, attachmentIds)),
    );

  const results: ResolvedAttachment[] = [];

  for (const row of rows) {
    try {
      const file = await objectStorageService.getObjectEntityFile(row.objectPath);
      const [buffer] = await file.download();

      if (row.contentType.startsWith("image/")) {
        results.push({
          fileName: row.fileName,
          contentType: row.contentType,
          kind: "image",
          imageDataUrl: `data:${row.contentType};base64,${buffer.toString("base64")}`,
        });
        continue;
      }

      const text = await extractText(buffer, row.contentType);
      results.push({
        fileName: row.fileName,
        contentType: row.contentType,
        kind: "text",
        extractedText: text.slice(0, MAX_EXTRACTED_TEXT),
      });
    } catch {
      // Skip unreadable attachments; the rest of the message still goes through.
    }
  }

  return results;
}

export const hasImages = (attachments: ResolvedAttachment[]): boolean =>
  attachments.some((a) => a.kind === "image");

/**
 * Appends extracted text-attachment content (PDFs, DOCX, plain text) to the
 * student's message text, labeled by filename. Images are NOT included here
 * — they're attached as separate image_url content parts by the caller, this
 * only handles the text-extractable kinds.
 */
export function buildAttachmentPromptText(userText: string, attachments: ResolvedAttachment[]): string {
  const textAttachments = attachments.filter((a) => a.kind === "text");
  if (textAttachments.length === 0) return userText;

  const blocks = textAttachments.map(
    (a) => `── Attached file: ${a.fileName} ──\n${a.extractedText}`,
  );
  return `${userText}\n\n${blocks.join("\n\n")}`;
}
