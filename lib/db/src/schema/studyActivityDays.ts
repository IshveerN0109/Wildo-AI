import { date, integer, pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const studyActivityDays = pgTable(
  "study_activity_days",
  {
    userId: text("user_id").notNull(),
    activityDate: date("activity_date").notNull(),
    questionCount: integer("question_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.userId, table.activityDate] }),
  }),
);

export type StudyActivityDay = typeof studyActivityDays.$inferSelect;