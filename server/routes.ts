import type { Express } from "express";
import { createServer, type Server } from "http";
import { formatLogDate } from "./utils/timeUtils";
import { storage } from "./storage";
import { QuestionProcessor } from "./services/questionProcessor";
import { SettingsService } from "./services/settings";
import { QuestionService } from "./services/questions";
import { db } from "./db";
import { sql } from "drizzle-orm";

import { POLL_INTERVAL } from "./config/constants";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Start the question processor service
  const questionService = QuestionService.getInstance();
  questionService.startPolling(POLL_INTERVAL);
  //await questionService.iterateSynchQuestionsWithTrendyol();

  // Start the question processor service
  const processor = QuestionProcessor.getInstance();

  // Start settings service
  const settingsService = SettingsService.getInstance();
  settingsService.initialScheduleCronJob();

  // Get all pending questions
  app.get("/api/questions/pending", async (_req, res) => {
    try {
      const questions = await processor.pollQuestions();
      console.log(`[${formatLogDate()}] Pending Questions API Response:`, {
        length: questions.length,
      });
      res.json(questions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending questions" });
    }
  });

  // Get pending approval question - now properly handles specific question IDs
  app.get("/api/pending-approval/:questionId?", async (req, res) => {
    try {
      console.log(req.params);
      const questionId = req.params.questionId;

      let pendingQuestion;

      if (questionId) {
        console.log("Getting question by ID: " + questionId);
        // Get the specific question when ID is provided
        pendingQuestion = await processor.getQuestionById(questionId);
        console.log(
          `[${formatLogDate()}] Pending Question By Id API Response:`,
          {
            data: pendingQuestion?.questionId,
          },
        );
      }

      if (!pendingQuestion) {
        res.status(404).json({ error: "Question not found" });
        return;
      }

      res.json(pendingQuestion);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending question" });
    }
  });

  // Handle approval/rejection
  app.post("/api/approve", async (req, res) => {
    try {
      const { questionId, approved, answer } = req.body;
      if (!questionId) {
        return res.status(400).json({ error: "Question ID is required" });
      }

      const processor = QuestionProcessor.getInstance();
      await processor.handleApproval(questionId, approved, answer);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to process approval" });
    }
  });

  // Rate limiting endpoints
  app.get("/api/rate-limits/stats/:endpoint", async (req, res) => {
    try {
      const { endpoint } = req.params;
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours

      const stats = await storage.getApiStats(endpoint, {
        start: startTime,
        end: endTime,
      });
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch API stats" });
    }
  });

  app.get("/api/rate-limits/config/:endpoint", async (req, res) => {
    try {
      const { endpoint } = req.params;
      const config = await storage.getRateLimitConfig(endpoint);
      res.json(config || { enabled: true, requestsPerMinute: 60 });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rate limit config" });
    }
  });

  app.patch("/api/rate-limits/config/:endpoint", async (req, res) => {
    try {
      const { endpoint } = req.params;
      const { requestsPerMinute, enabled } = req.body;

      const config = await storage.updateRateLimitConfig(
        endpoint,
        requestsPerMinute,
        enabled,
      );

      res.json(config);
    } catch (error) {
      res.status(500).json({ error: "Failed to update rate limit config" });
    }
  });

  // Get settings
  app.get("/api/settings", async (_req, res) => {
    try {
      console.log(`Getting settings...`);

      const settings = await settingsService.getSettings();
      const weekdays = settings?.weekdays?.split(",");
      const settingsData = {
        id: settings?.id,
        automaticAnswer: settings?.automaticAnswer,
        startTime: settings?.startTime,
        endTime: settings?.endTime,
        weekdays: weekdays,
      };

      res.json(settingsData);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending questions" });
    }
  });

  // Handle approval/rejection
  app.post("/api/settings", async (req, res) => {
    try {
      console.log(`Saving settings:`, req.body);
      const { automaticAnswer, weekdays, startTime, endTime } = req.body;
      if (automaticAnswer) {
        // Validation
        if (!weekdays || !Array.isArray(weekdays) || weekdays.length === 0) {
          return res
            .status(400)
            .json({ message: "Please select at least one weekday." });
        }
        if (!startTime || !endTime) {
          return res
            .status(400)
            .json({ message: "Start time and end time are required." });
        }
      }

      //await questionService.synchQuestionsWithTrendyol();

      await settingsService.updateSettings(
        automaticAnswer,
        weekdays,
        startTime,
        endTime,
      );

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to process approval" });
    }
  });

  // Health check endpoint
  app.get("/api/health", async (_req, res) => {
    try {
      // Test database connectivity
      await db.execute(sql`SELECT 1`);
      res.json({
        status: "ok",
        database: "connected",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Health check failed:", error);
      res.status(500).json({
        status: "error",
        message: "Database connection failed",
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Get processed questions statistics
  app.get("/api/stats", async (_req, res) => {
    try {
      const stats = await storage.getProcessedQuestionStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  return httpServer;
}
