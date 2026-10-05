import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Admin-editable purchasable top-up packs (e.g. "+25 tutor messages for
// $2.99"). Only purchasable by students on a plan with allowsTopups=true
// (see plansTable / require-topup-eligible.ts).
export const creditPacksTable = pgTable("credit_packs", {
  id: serial("id").primaryKey(),
  feature: text("feature").notNull(), // tutorMessage | noteGeneration | quizGeneration | flashcardGeneration | oralPractice
  label: text("label").notNull(),
  amount: integer("amount").notNull(),
  priceCents: integer("price_cents").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type CreditPack = typeof creditPacksTable.$inferSelect;
export type InsertCreditPack = typeof creditPacksTable.$inferInsert;
