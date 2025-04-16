import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  decimal,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  productMainId: text("product_main_id").notNull(),
  productName: text("product_name").notNull(),
  productWebUrl: text("product_web_url"),
  questionId: text("question_id").notNull().unique(),
  questionText: text("question_text").notNull(),
  questionDate: timestamp("question_date").notNull(),
  chatbaseConversationId: text("chatbase_conversation_id"),
  isChatbaseUnknownAnswer: boolean("is_chatbase_unknown_answer"),
  answerId: text("answer_id"),
  answerText: text("answer_text"),
  answerTextEdited: text("answer_text_edited"),
  answerType: text("answer_type"),
  answerDate: timestamp("answer_date"),
  isPublic: boolean("is_public"),
  isFollowUp: boolean("is_follow_up"),
  status: text("status").notNull(),
  processedDate: timestamp("processed_date"),
  success: boolean("success").notNull().default(false),
  needsApproval: boolean("needs_approval").notNull().default(false),
  approved: boolean("approved").default(false),
});

export const processedQuestions = pgTable("processed_questions", {
  id: serial("id").primaryKey(),
  questionId: text("question_id").notNull().unique(),
  customerId: text("customer_id").notNull(),
  productMainId: text("product_main_id").notNull(),
  productWebUrl: text("web_url"),
  productName: text("product_name").notNull(),
  questionText: text("question_text").notNull(),
  answer: text("answer"),
  questionDate: timestamp("question_date"),
  processedAt: timestamp("processed_at").notNull().defaultNow(),
  success: boolean("success").notNull().default(false),
  followUp: boolean("is_follow_up").notNull().default(false),
  needsApproval: boolean("needs_approval").notNull().default(true),
  approved: boolean("approved").default(false),
  public: boolean("public").notNull().default(false),
  editedAnswer: text("edited_answer"),
});

export const settingsConfig = pgTable("settingsConfig", {
  id: serial("id").primaryKey(),
  automaticAnswer: boolean("automatic_answer").default(false),
  startTime: text("start_time"),
  endTime: text("end_time"),
  weekdays: text("weekdays"),
  timeZone: text("time_zone"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const jobLogs = pgTable("jobLogs", {
  id: serial("id").primaryKey(),
  state: text("state"),
  result: text("result"),
  runningAt: timestamp("running_at").notNull().defaultNow(),
});

export const apiStats = pgTable("api_stats", {
  id: serial("id").primaryKey(),
  endpoint: text("endpoint").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  responseTime: integer("response_time").notNull(), // in milliseconds
  success: boolean("success").notNull(),
  rateLimitRemaining: integer("rate_limit_remaining"),
  rateLimitReset: timestamp("rate_limit_reset"),
});

export const metrics = pgTable("metrics", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  responseTimeChatbase: decimal("response_time_chatbase").notNull(),
  responseTimeTrendyol: decimal("response_time_trendyol").notNull(),
  successRate: decimal("success_rate").notNull(),
  questionsPending: integer("questions_pending").notNull(),
  questionsProcessed: integer("questions_processed").notNull(),
  questionsApproved: integer("questions_approved").notNull(),
  questionsRejected: integer("questions_rejected").notNull(),
});

export const rateLimitConfig = pgTable("rate_limit_config", {
  id: serial("id").primaryKey(),
  endpoint: text("endpoint").notNull().unique(),
  requestsPerMinute: integer("requests_per_minute").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProcessedQuestionSchema = createInsertSchema(
  processedQuestions,
).omit({
  id: true,
  processedAt: true,
});

export const insertQuestionSchema = createInsertSchema(questions).omit({
  id: true,
  processedDate: true,
});

export const insertApiStatSchema = createInsertSchema(apiStats).omit({
  id: true,
  timestamp: true,
});

export const insertRateLimitConfigSchema = createInsertSchema(
  rateLimitConfig,
).omit({
  id: true,
  updatedAt: true,
});

export const insertMetricsSchema = createInsertSchema(metrics).omit({
  id: true,
  timestamp: true,
});

export type InsertProcessedQuestion = z.infer<
  typeof insertProcessedQuestionSchema
>;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;

export type Question = typeof questions.$inferSelect;
export type ProcessedQuestion = typeof processedQuestions.$inferSelect;
export type ApiStat = typeof apiStats.$inferSelect;
export type RateLimitConfig = typeof rateLimitConfig.$inferSelect;
export type SettingsConfig = typeof settingsConfig.$inferSelect;
export type JobLogs = typeof jobLogs.$inferSelect;
export type InsertMetrics = z.infer<typeof insertMetricsSchema>;
export type Metrics = typeof metrics.$inferSelect;
