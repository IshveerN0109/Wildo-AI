import { boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Admin-editable subscription plans. Replaces the formerly hard-coded
// FREE_PLAN/PRO_PLAN constants so prices and per-feature limits can be
// changed from the admin CRM without a deploy. `id` is the stable slug
// used everywhere else (subscriptions.planId, quota checks, etc).
export const plansTable = pgTable("plans", {
  id: text("id").primaryKey(), // e.g. "free" | "pro" | "premium"
  name: text("name").notNull(),
  priceCents: integer("price_cents").notNull().default(0),
  // { tutorMessage: 50, noteGeneration: 20, quizGeneration: 20, flashcardGeneration: 20, oralPractice: 15 }
  limits: jsonb("limits").$type<Record<string, number>>().notNull(),
  // Whether students on this plan may purchase extra credit packs on top
  // of their monthly limit (see creditPacksTable / creditTopupsTable).
  allowsTopups: boolean("allows_topups").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Plan = typeof plansTable.$inferSelect;
export type InsertPlan = typeof plansTable.$inferInsert;
