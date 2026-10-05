import { integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

import { usersTable } from "./auth";

// A purchased credit top-up, scoped to one subscription billing period
// (same periodStart convention as featureUsageTable) — top-ups don't carry
// over once the period rolls, matching the plan's own monthly reset.
export const creditTopupsTable = pgTable("credit_topups", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  feature: text("feature").notNull(),
  amount: integer("amount").notNull(),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  purchasedAt: timestamp("purchased_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CreditTopup = typeof creditTopupsTable.$inferSelect;
export type InsertCreditTopup = typeof creditTopupsTable.$inferInsert;
