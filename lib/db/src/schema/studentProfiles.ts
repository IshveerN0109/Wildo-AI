import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

import { usersTable } from "./auth";

export const studentProfilesTable = pgTable("student_profiles", {
  userId: varchar("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  level: text("level"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type StudentProfile = typeof studentProfilesTable.$inferSelect;