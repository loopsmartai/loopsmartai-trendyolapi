import {
  questions,
  processedQuestions,
  apiStats,
  rateLimitConfig,
  settingsConfig,
  jobLogs,
  metrics,
  type Question,
  type InsertQuestion,
  type ProcessedQuestion,
  type InsertProcessedQuestion,
  type ApiStat,
  type RateLimitConfig,
  type SettingsConfig,
  type JobLogs,
  type Metrics,
  type InsertMetrics,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, gte, lte } from "drizzle-orm";

export interface IStorage {
  getQuestion(questionId: string): Promise<Question | undefined>;
  getFollowUpQuestions(
    customerId: string,
    productMainId: string,
  ): Promise<Question[]>;
  getPendingQuestions(): Promise<Question[]>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  updateAnswer(
    questionId: string,
    answerId: string,
    answerText: string,
    answerDate: Date,
    status: string,
    answerType: string,
  ): Promise<Question>;
  updateAnswerStatus(
    questionId: string,
    answerDate: Date,
    status: string,
    answerType: string,
  ): Promise<Question>;
  updateApproval(
    questionId: string,
    approved: boolean,
    editedAnswer?: string,
  ): Promise<Question>;
  updateChatbaseAnswer(
    questionId: string,
    conversationId: string,
    answerText: string,
    isChatbaseUnknownAnswer: boolean,
  ): Promise<Question>;
  getProcessedQuestion(
    questionId: string,
  ): Promise<ProcessedQuestion | undefined>;
  createProcessedQuestion(
    question: InsertProcessedQuestion,
  ): Promise<ProcessedQuestion>;
  updateQuestionAnswer(
    questionId: string,
    answer: string,
  ): Promise<ProcessedQuestion>;
  removeAllQuestions(): Promise<void>;
  getProcessedQuestionStats(): Promise<{ total: number; successful: number }>;
  getPendingApprovalQuestion(): Promise<ProcessedQuestion | undefined>;
  getAllPendingQuestions(): Promise<ProcessedQuestion[]>;
  updateQuestionApproval(
    questionId: string,
    approved: boolean,
    editedAnswer?: string,
  ): Promise<ProcessedQuestion>;
  recordApiCall(
    endpoint: string,
    responseTime: number,
    success: boolean,
    rateLimitRemaining?: number,
    rateLimitReset?: Date,
  ): Promise<ApiStat>;
  getApiStats(
    endpoint: string,
    timeRange: { start: Date; end: Date },
  ): Promise<ApiStat[]>;
  getRateLimitConfig(endpoint: string): Promise<RateLimitConfig | undefined>;
  updateRateLimitConfig(
    endpoint: string,
    requestsPerMinute: number,
    enabled: boolean,
  ): Promise<RateLimitConfig>;
  getSettingsConfig(): Promise<SettingsConfig | undefined>;
  updateSettingsConfig(
    id: number,
    automaticAnswer: boolean,
    weekdays: string,
    startTime: string,
    endTime: string,
    timeZone?: string,
  ): Promise<SettingsConfig>;
  getJobLogs(): Promise<JobLogs[] | undefined>;
  recordJobLog(state: string, result: string): Promise<JobLogs>;
  updateJobLog(jobId: number, state: string, result: string): Promise<JobLogs>;
  // Metrics methods
  recordMetrics(metrics: InsertMetrics): Promise<Metrics>;
  getLatestMetrics(): Promise<Metrics | undefined>;
  getMetricsHistory(hours: number): Promise<Metrics[]>;
}

export class DatabaseStorage implements IStorage {
  async getQuestion(questionId: string): Promise<Question | undefined> {
    const [question] = await db
      .select()
      .from(questions)
      .where(eq(questions.questionId, questionId));
    return question;
  }

  async getFollowUpQuestions(
    customerId: string,
    productMainId: string,
  ): Promise<Question[]> {
    return db
      .select()
      .from(questions)
      .where(
        and(
          eq(questions.customerId, customerId),
          eq(questions.productMainId, productMainId),
        ),
      )
      .orderBy(desc(questions.questionDate));
  }

  async getPendingQuestions(): Promise<Question[]> {
    return db
      .select()
      .from(questions)
      .where(
        and(
          eq(questions.status, "WAITING_FOR_ANSWER"),
          eq(questions.isFollowUp, false),
        ),
      )
      .orderBy(desc(questions.processedDate));
  }

  async createQuestion(question: InsertQuestion): Promise<Question> {
    const [newQuestion] = await db
      .insert(questions)
      .values({
        ...question,
        processedDate: new Date(),
      })
      .returning();
    return newQuestion;
  }

  async updateAnswer(
    questionId: string,
    questionDate: Date,
    answerId: string,
    answerText: string,
    answerDate: Date,
    status: string,
    answerType: string,
  ): Promise<Question> {
    const [updated] = await db
      .update(questions)
      .set({
        questionDate: questionDate,
        answerId: answerId,
        answerText: answerText,
        answerDate: answerDate,
        status: status,
        answerType: answerType,
      })
      .where(eq(questions.questionId, questionId))
      .returning();
    return updated;
  }

  async updateAnswerStatus(
    questionId: string,
    answerDate: Date,
    status: string,
    answerType: string,
  ): Promise<Question> {
    const [updated] = await db
      .update(questions)
      .set({
        answerDate: answerDate,
        status: status,
        answerType: answerType,
      })
      .where(eq(questions.questionId, questionId))
      .returning();
    return updated;
  }

  async updateApproval(
    questionId: string,
    approved: boolean,
    editedAnswer?: string,
  ): Promise<Question> {
    const [updated] = await db
      .update(questions)
      .set({
        approved,
        needsApproval: false,
        answerTextEdited: editedAnswer || null,
        success: approved,
        status: "ANSWERED",
        answerType: "MANUAL",
      })
      .where(eq(questions.questionId, questionId))
      .returning();
    return updated;
  }

  async updateChatbaseAnswer(
    questionId: string,
    conversationId: string,
    answerText: string,
    isChatbaseUnknownAnswer: boolean,
  ): Promise<Question> {
    const [updated] = await db
      .update(questions)
      .set({
        chatbaseConversationId: conversationId,
        isChatbaseUnknownAnswer: isChatbaseUnknownAnswer,
        answerText: answerText,
      })
      .where(eq(questions.questionId, questionId))
      .returning();
    return updated;
  }

  async getProcessedQuestion(
    questionId: string,
  ): Promise<ProcessedQuestion | undefined> {
    const [question] = await db
      .select()
      .from(processedQuestions)
      .where(eq(processedQuestions.questionId, questionId));
    return question;
  }

  async createProcessedQuestion(
    question: InsertProcessedQuestion,
  ): Promise<ProcessedQuestion> {
    const [newQuestion] = await db
      .insert(processedQuestions)
      .values({
        ...question,
        processedAt: new Date(),
      })
      .returning();
    return newQuestion;
  }

  async updateQuestionAnswer(
    questionId: string,
    answer: string,
  ): Promise<ProcessedQuestion> {
    const [updated] = await db
      .update(processedQuestions)
      .set({ answer })
      .where(eq(processedQuestions.questionId, questionId))
      .returning();
    return updated;
  }

  async removeAllQuestions(): Promise<void> {
    await db.delete(processedQuestions);
  }

  async getProcessedQuestionStats(): Promise<{
    total: number;
    successful: number;
  }> {
    const questions = await db.select().from(processedQuestions);
    return {
      total: questions.length,
      successful: questions.filter((q) => q.approved && q.success).length,
    };
  }

  async getPendingApprovalQuestion(): Promise<ProcessedQuestion | undefined> {
    const [question] = await db
      .select()
      .from(processedQuestions)
      .where(
        and(
          eq(processedQuestions.needsApproval, true),
          eq(processedQuestions.approved, false),
        ),
      )
      .orderBy(desc(processedQuestions.processedAt))
      .limit(1);
    return question;
  }

  async getAllPendingQuestions(): Promise<ProcessedQuestion[]> {
    return db
      .select()
      .from(processedQuestions)
      .where(
        or(
          eq(processedQuestions.approved, false),
          eq(processedQuestions.success, false),
        ),
      )
      .orderBy(desc(processedQuestions.processedAt));
  }

  async updateQuestionApproval(
    questionId: string,
    approved: boolean,
    editedAnswer?: string,
  ): Promise<ProcessedQuestion> {
    const [updated] = await db
      .update(processedQuestions)
      .set({
        approved,
        needsApproval: false,
        editedAnswer: editedAnswer || null,
        success: approved,
      })
      .where(eq(processedQuestions.questionId, questionId))
      .returning();
    return updated;
  }

  async recordApiCall(
    endpoint: string,
    responseTime: number,
    success: boolean,
    rateLimitRemaining?: number,
    rateLimitReset?: Date,
  ): Promise<ApiStat> {
    const [stat] = await db
      .insert(apiStats)
      .values({
        endpoint,
        responseTime,
        success,
        rateLimitRemaining: rateLimitRemaining || null,
        rateLimitReset: rateLimitReset || null,
        timestamp: new Date(),
      })
      .returning();
    return stat;
  }

  async getApiStats(
    endpoint: string,
    timeRange: { start: Date; end: Date },
  ): Promise<ApiStat[]> {
    return db
      .select()
      .from(apiStats)
      .where(
        and(
          eq(apiStats.endpoint, endpoint),
          and(
            gte(apiStats.timestamp, timeRange.start),
            lte(apiStats.timestamp, timeRange.end),
          ),
        ),
      );
  }

  async getRateLimitConfig(
    endpoint: string,
  ): Promise<RateLimitConfig | undefined> {
    const [config] = await db
      .select()
      .from(rateLimitConfig)
      .where(eq(rateLimitConfig.endpoint, endpoint));
    return config;
  }

  async updateRateLimitConfig(
    endpoint: string,
    requestsPerMinute: number,
    enabled: boolean,
  ): Promise<RateLimitConfig> {
    const [config] = await db
      .insert(rateLimitConfig)
      .values({
        endpoint,
        requestsPerMinute,
        enabled,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: rateLimitConfig.endpoint,
        set: {
          requestsPerMinute,
          enabled,
          updatedAt: new Date(),
        },
      })
      .returning();
    return config;
  }

  async getSettingsConfig(): Promise<SettingsConfig | undefined> {
    const [config] = await db.select().from(settingsConfig);
    return config;
  }

  async updateSettingsConfig(
    id: number,
    automaticAnswer: boolean,
    weekdays: string,
    startTime: string,
    endTime: string,
    timeZone: string = "Europe/Istanbul",
  ): Promise<SettingsConfig> {
    const [config] = await db
      .insert(settingsConfig)
      .values({
        id,
        automaticAnswer,
        weekdays,
        startTime,
        endTime,
        timeZone,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: settingsConfig.id,
        set: {
          id,
          automaticAnswer,
          weekdays,
          startTime,
          endTime,
          timeZone,
          updatedAt: new Date(),
        },
      })
      .returning();
    return config;
  }

  async getJobLogs(): Promise<JobLogs[] | undefined> {
    return db.select().from(jobLogs);
  }

  async recordJobLog(state: string, result: string): Promise<JobLogs> {
    const [log] = await db
      .insert(jobLogs)
      .values({
        state,
        result,
        runningAt: new Date(),
      })
      .returning();
    return log;
  }

  async updateJobLog(
    jobId: number,
    state: string,
    result: string,
  ): Promise<JobLogs> {
    const [updated] = await db
      .update(jobLogs)
      .set({
        result: result,
        state: state,
      })
      .where(eq(jobLogs.id, jobId))
      .returning();
    return updated;
  }

  async recordMetrics(metricsData: InsertMetrics): Promise<Metrics> {
    const [recorded] = await db.insert(metrics).values(metricsData).returning();
    return recorded;
  }

  async getLatestMetrics(): Promise<Metrics | undefined> {
    const [latest] = await db
      .select()
      .from(metrics)
      .orderBy(desc(metrics.timestamp))
      .limit(1);
    return latest;
  }

  async getMetricsHistory(hours: number): Promise<Metrics[]> {
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);

    return db
      .select()
      .from(metrics)
      .where(gte(metrics.timestamp, startTime))
      .orderBy(desc(metrics.timestamp));
  }
}

export const storage = new DatabaseStorage();
