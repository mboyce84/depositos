
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const depositDefinitions = sqliteTable("deposit_definitions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  pillar: text("pillar").notNull(),
  measurementType: text("measurement_type").notNull().default("check"),
  unit: text("unit").notNull().default(""),
  target: real("target"),
  scheduleDays: text("schedule_days").notNull().default("[0,1,2,3,4,5,6]"),
  position: integer("position").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  activeFrom: text("active_from").notNull().default("2000-01-01"),
  archivedAt: text("archived_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const dailyEntries = sqliteTable("daily_entries", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  entryDate: text("entry_date").notNull(),
  depositId: text("deposit_id").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  value: real("value"),
  note: text("note").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
});

export const copeReflections = sqliteTable("cope_reflections", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  createdAt: text("created_at").notNull(),
  pressure: text("pressure").notNull(),
  oldLoop: text("old_loop").notNull(),
  reward: text("reward").notNull().default(""),
  cost: text("cost").notNull().default(""),
  replacement: text("replacement").notNull(),
  friction: text("friction").notNull().default(""),
  commitment: text("commitment").notNull(),
});

export const weeklyReviews = sqliteTable("weekly_reviews", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  weekStart: text("week_start").notNull(),
  win: text("win").notNull(),
  lesson: text("lesson").notNull().default(""),
  nextDeposit: text("next_deposit").notNull(),
  updatedAt: text("updated_at").notNull(),
});

