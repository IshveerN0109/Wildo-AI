import { pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

import { usersTable } from "./auth";

// One row per student. `provider`/`providerCustomerId`/`providerSubscriptionId`
// are unused while `provider` is "test" — they exist so a real gateway (e.g.
// Stripe) can be plugged in later without a schema change. See
// artifacts/api-server/src/lib/paymentProvider.ts for the swap point.
export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  planId: text("plan_id").notNull(),
  status: text("status").notNull().default("active"), // active | canceled | past_due | expired
  provider: text("provider").notNull().default("test"), // test | stripe
  providerCustomerId: text("provider_customer_id"),
  providerSubscriptionId: text("provider_subscription_id"),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Subscription = typeof subscriptionsTable.$inferSelect;
export type InsertSubscription = typeof subscriptionsTable.$inferInsert;
