import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { db, studentAttachmentsTable } from "@workspace/db";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const MAX_FILE_SIZE = 20_000_000;
const allowedContentTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);
const allowedExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".pdf",
  ".docx",
  ".txt",
  ".md",
  ".csv",
  ".json",
]);
const contentTypesByExtension: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
};

function authenticatedUserId(req: Request): string | null {
  return req.isAuthenticated() ? req.user!.id : null;
}

router.post("/storage/uploads/request-url", async (req: Request, res: Response): Promise<void> => {
  const userId = authenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid file metadata" });
    return;
  }

  const { name, size, contentType } = parsed.data;
  const extension = name.includes(".") ? `.${name.split(".").pop()!.toLowerCase()}` : "";
  const normalizedContentType = contentType.toLowerCase() === "application/octet-stream"
    ? contentTypesByExtension[extension] ?? contentType
    : contentType;
  if (size > MAX_FILE_SIZE) {
    res.status(413).json({ error: "Files must be 20 MB or smaller" });
    return;
  }
  if (!allowedContentTypes.has(contentType.toLowerCase()) && !allowedExtensions.has(extension)) {
    res.status(415).json({ error: "Supported files: images, PDF, DOCX, TXT, MD, CSV, and JSON" });
    return;
  }

  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    const [attachment] = await db
      .insert(studentAttachmentsTable)
      .values({
        userId,
        objectPath,
        fileName: name,
        contentType: normalizedContentType || "application/octet-stream",
        size,
      })
      .returning({ id: studentAttachmentsTable.id });

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        attachmentId: attachment.id,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to create private upload URL");
    res.status(500).json({ error: "Failed to create upload URL" });
  }
});

router.get("/storage/objects/*path", async (req: Request, res: Response): Promise<void> => {
  const userId = authenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const rawPath = req.params.path;
  const objectPath = `/objects/${Array.isArray(rawPath) ? rawPath.join("/") : rawPath}`;
  const [attachment] = await db
    .select()
    .from(studentAttachmentsTable)
    .where(and(eq(studentAttachmentsTable.userId, userId), eq(studentAttachmentsTable.objectPath, objectPath)));
  if (!attachment) {
    res.status(404).json({ error: "Attachment not found" });
    return;
  }

  try {
    const file = await objectStorageService.getObjectEntityFile(objectPath);
    const [metadata] = await file.getMetadata();
    res.setHeader("Content-Type", metadata.contentType || attachment.contentType);
    res.setHeader("Content-Length", String(metadata.size ?? attachment.size));
    res.setHeader("Cache-Control", "private, max-age=300");
    Readable.from(file.createReadStream()).pipe(res);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }
    req.log.error({ err: error }, "Failed to serve private attachment");
    res.status(500).json({ error: "Failed to serve attachment" });
  }
});

export default router;