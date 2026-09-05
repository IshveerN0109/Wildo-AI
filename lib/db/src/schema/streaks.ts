import { pgTable, text, integer, date, timestamp } from "drizzle-orm/pg-core";

export const studyStreaks = pgTable("study_streaks", {
  userId: text("user_id").primaryKey(),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastStudiedDate: date("last_studied_date"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type StudyStreak = typeof studyStreaks.$inferSelect;
