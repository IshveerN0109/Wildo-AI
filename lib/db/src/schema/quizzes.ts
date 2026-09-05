import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const quizSessions = pgTable("quiz_sessions", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  subject: text("subject").notNull(),
  level: text("level").notNull(),
  topic: text("topic").notNull(),
  difficulty: text("difficulty").notNull(),
  score: integer("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  timePerQuestion: integer("time_per_question").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type QuizSession = typeof quizSessions.$inferSelect;
