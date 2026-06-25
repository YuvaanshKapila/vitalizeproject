import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  date,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
    () => new Date(),
  ),
};

export const profile = pgTable("profile", {
  id: uuid().defaultRandom().primaryKey(),
  fullName: text().notNull(),
  ...timestamps,
});

export const shiftAssignment = pgTable(
  "shift_assignment",
  {
    id: uuid().defaultRandom().primaryKey(),
    profileId: uuid()
      .references(() => profile.id, { onDelete: "cascade" })
      .notNull(),
    date: date().notNull(),
    recurrenceId: uuid().references((): AnyPgColumn => shiftAssignment.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [unique().on(t.profileId, t.date)],
);
