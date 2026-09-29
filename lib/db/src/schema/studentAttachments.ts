import { integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

import { usersTable } from "./auth";

export const studentAttachmentsTable = pgTable("student_attachments", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  objectPath: text("object_path").notNull(),
  fileName: text("file_name").notNull(),
  contentType: varchar("content_type", { length: 255 }).notNull(),
  size: integer("size").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type StudentAttachment = typeof studentAttachmentsTable.$inferSelect;