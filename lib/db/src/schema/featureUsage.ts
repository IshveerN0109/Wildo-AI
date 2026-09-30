import { integer, pgTable, serial, text, timestamp, unique, varchar } from "drizzle-orm/pg-core";

import { usersTable } from "./auth";

// Per-student, per-feature usage counter for the current subscription
// billing period (subscriptions.currentPeriodStart). Keying usage off the
// subscription's own period — rather than the calendar month — means this
// keeps working unchanged once a real payment provider with non-calendar
// billing periods (e.g. Stripe) is wired in.
export const featureUsageTable = pgTable(
  "feature_usage",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    feature: text("feature").notNull(), // tutorMessage | noteGeneration | quizGeneration | flashcardGeneration | oralPractice
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [unique("feature_usage_user_feature_period").on(table.userId, table.feature, table.periodStart)],
);

export type FeatureUsage = typeof featureUsageTable.$inferSelect;
