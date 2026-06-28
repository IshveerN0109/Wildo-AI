import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const flashcardSetsTable = pgTable("flashcard_sets", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  level: text("level").notNull(),
  topic: text("topic"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const flashcardsTable = pgTable("flashcards", {
  id: serial("id").primaryKey(),
  setId: integer("set_id").notNull().references(() => flashcardSetsTable.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  hint: text("hint"),
});

export const insertFlashcardSetSchema = createInsertSchema(flashcardSetsTable).omit({ id: true, createdAt: true });
export type InsertFlashcardSet = z.infer<typeof insertFlashcardSetSchema>;
export type FlashcardSet = typeof flashcardSetsTable.$inferSelect;

export const insertFlashcardSchema = createInsertSchema(flashcardsTable).omit({ id: true });
export type InsertFlashcard = z.infer<typeof insertFlashcardSchema>;
export type Flashcard = typeof flashcardsTable.$inferSelect;
