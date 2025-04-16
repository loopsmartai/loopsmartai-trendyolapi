import { v4 } from "uuid";
import { storage } from "../storage";
import { rateLimiter } from "../utils/rateLimiter";
import {
  formatLogDate,
  convertIstanbulTime,
  istanbulTime,
  istanbulStartTime,
  istanbulEndTime,
} from "../utils/timeUtils";
import Client from "@replit/database";
import { makeRequestWithRetry, logError } from "../utils/errorHandler";

import {
  TRENDYOL_CONFIG,
  CHATBASE_CONFIG,
  API_ENDPOINTS,
  POLL_INTERVAL,
} from "../config/constants";
import { Question } from "@shared/schema.ts";
import axios from "axios";

const TRENDYOL_AUTH_HEADERS = {
  Authorization: `Basic ${TRENDYOL_CONFIG.TOKEN}`,
  "Content-Type": "application/json",
  "User-Agent": "TrendyolMarketplaceBot/1.0",
};

const client = new Client();

export class QuestionService {
  private static instance: QuestionService;
  private pollInterval: NodeJS.Timeout | null;

  private constructor() {
    this.pollInterval = null;
  }

  static getInstance(): QuestionService {
    if (!this.instance) {
      this.instance = new QuestionService();
    }
    return this.instance;
  }

  private async getChatbaseAnswer(
    questionText: string,
  ): Promise<{ answerText: string; conversationId: string } | null> {
    try {
      console.log(`[Getting Chatbase answer for: ${questionText}`);

      const conversationId = v4();
      const payload = {
        conversationId: conversationId,
        messages: [
          {
            role: "user",
            content:
              "Please provide a direct and complete answer to this customer question without asking follow-up questions: " +
              questionText,
          },
        ],
        chatbotId: CHATBASE_CONFIG.AGENT_ID,
        stream: false,
      };

      const response = await rateLimiter.enqueue(() =>
        makeRequestWithRetry({
          method: "post",
          url: CHATBASE_CONFIG.URL,
          headers: {
            Authorization: `Bearer ${CHATBASE_CONFIG.API_KEY}`,
            "Content-Type": "application/json",
          },
          data: payload,
        }),
      );

      // Detailed response validation
      if (!response?.data) {
        console.log(`[${formatLogDate()}] Response data is null or undefined`);
        return Promise.resolve(null);
      }

      if (response.data.text === undefined || response.data.text === null) {
        console.log(`[${formatLogDate()}] Response text is null or undefined`);
        return Promise.resolve(null);
      }

      if (response.data.text === "") {
        console.log(`[${formatLogDate()}] Response text is empty string`);
        return Promise.resolve(null);
      }

      console.log(`[Generated answer from text:`, response.data.text);
      await Promise.resolve(response.data.text);
      return { conversationId: conversationId, answerText: response.data.text };
    } catch (error: any) {
      console.error(
        `[${formatLogDate()}] Chatbase API error:`,
        error.response?.data || error.message,
      );
      return Promise.resolve(null);
    }
  }
  async iterateSynchQuestionsWithTrendyol(): Promise<void> {
    try {
      for (let m = 1; m < 13; m++) {
        for (let p = 0; p < 7; p++) {
          console.log(`iterateSynchQuestionsWithTrendyol page: ${p}`);
          await this.synchQuestionsWithTrendyol(3, m, p);
        }
      }
    } catch (error) {
      console.error(
        `[${formatLogDate()}] Error iterateSynchQuestionsWithTrendyol:`,
        error,
      );
      logError(error as Error, "iterateSynchQuestionsWithTrendyol");
    }
  }

  async synchQuestionsWithTrendyol(
    month: number,
    day: number,
    page: number,
  ): Promise<void> {
    try {
      console.log(`Sync question and answer status with Trendyol.`);

      const startDate = istanbulStartTime(2025, month, day).getTime();
      const endDate = istanbulEndTime(2025, month, day).getTime();
      console.log(
        `Paged question start time: ${startDate} end time: ${endDate}`,
      );

      const response = await axios({
        method: "get",
        url: API_ENDPOINTS.GET_PAGED_QUESTIONS(
          TRENDYOL_CONFIG.SELLER_ID,
          page,
          startDate.toString(),
          endDate.toString(),
        ),
        headers: TRENDYOL_AUTH_HEADERS,
      });
      console.log(`[${formatLogDate()}] API Response:`, {
        status: response.status,
      });

      console.log(`Sync question response: ${response.status}`);

      // Check authentication
      if (response.status === 401 || response.status === 403) {
        console.error(
          `[${formatLogDate()}] Authentication error - token may be expired`,
        );
        throw new Error("Authentication error");
      }

      // Parse string response if needed
      let parsedData =
        typeof response.data === "string"
          ? JSON.parse(response.data)
          : response.data;

      // Process questions from the response
      const questions = parsedData?.content;
      if (questions && Array.isArray(questions)) {
        console.log(
          `[${formatLogDate()}] Found ${questions.length} questions to process`,
        );

        for (const question of questions) {
          const existingQuestion = await storage.getQuestion(question.id);
          if (existingQuestion && existingQuestion.questionId) {
            console.log(
              `[${formatLogDate()}] Migration question: ${existingQuestion.questionId} answer type: ${existingQuestion.answerType} creation date: ${convertIstanbulTime(question.answer.creationDate)}`,
            );

            const answerText =
              existingQuestion.answerType == "PROVIDER"
                ? question.answer.text
                : existingQuestion.answerText;
            await storage.updateAnswer(
              existingQuestion.questionId,
              convertIstanbulTime(question.creationDate),
              question.answer.id,
              answerText,
              convertIstanbulTime(question.answer.creationDate),
              existingQuestion.status,
              existingQuestion.answerType || "",
            );
          } else {
            console.log(
              `[${formatLogDate()}] New question will be created ${question.id}`,
            );

            const followupQuestions = await storage.getFollowUpQuestions(
              question.customerId,
              question.productMainId,
            );

            let newQuestion = {
              customerId: question.customerId,
              productMainId: question.productMainId,
              productWebUrl: question.webUrl,
              productName: question.productName || "Unknown Product",
              questionId: question.id,
              questionText: question.text,
              questionDate: convertIstanbulTime(question.creationDate),
              answerId: question.answer.id,
              answerType: "PROVIDER",
              answerText: question.answer.text,
              answerDate: convertIstanbulTime(question.answer.creationDate),
              success: false,
              needsApproval: false,
              isFollowUp: false,
              approved: false,
              status: question.status,
              isPublic: question.public,
            };

            if (followupQuestions && followupQuestions.length > 0) {
              newQuestion.needsApproval = true;
              newQuestion.isFollowUp = true;
            }

            await storage.createQuestion(newQuestion);
          }
        }
      }
    } catch (error) {
      console.error(`[${formatLogDate()}] Error fetching questions:`, error);
      logError(error as Error, "pollQuestions");
    }
  }

  async getPendingQuestions(): Promise<Question[]> {
    try {
      console.log(
        `[${formatLogDate()}] Fetching questions with WAITING_FOR_ANSWER status from database...`,
      );

      let notApprovedQuestions: Question[] = [];
      // First clear all questions
      const waitingQuestions = await storage.getPendingQuestions();
      console.log(
        `[${formatLogDate()}] Waiting questions count: ${waitingQuestions.length}`,
      );
      for (const question of waitingQuestions) {
        const response = await rateLimiter.enqueue(() =>
          makeRequestWithRetry({
            method: "get",
            url: API_ENDPOINTS.GET_QUESTION(
              TRENDYOL_CONFIG.SELLER_ID,
              question.questionId,
            ),
            headers: TRENDYOL_AUTH_HEADERS,
          }),
        );
        if (response.status === 401 || response.status === 403) {
          console.error(
            `[${formatLogDate()}] Authentication error - token may be expired`,
          );
          throw new Error("Authentication error");
        }

        let questionData =
          typeof response.data === "string"
            ? JSON.parse(response.data)
            : response.data;

        if (questionData.status != "WAITING_FOR_ANSWER") {
          console.log(
            `[${formatLogDate()}] Question ${question.questionId} already answered`,
          );
          await storage.updateAnswer(
            questionData.id,
            questionData.answer.id,
            questionData.answer.text,
            new Date(questionData.answer.creationDate),
            questionData.status,
            "PROVIDER",
          );
          continue;
        }
        notApprovedQuestions.push(question);
      }
      return notApprovedQuestions;
    } catch (error) {
      console.error(`[${formatLogDate()}] Error fetching questions:`, error);
      logError(error as Error, "pollQuestions");
      return [];
    }
  }

  async pollQuestions(): Promise<void> {
    try {
      console.log(
        `[${formatLogDate()}] Polling questions with WAITING_FOR_ANSWER status.`,
      );

      const response = await rateLimiter.enqueue(() =>
        makeRequestWithRetry({
          method: "get",
          url: API_ENDPOINTS.GET_QUESTIONS(TRENDYOL_CONFIG.SELLER_ID),
          headers: TRENDYOL_AUTH_HEADERS,
        }),
      );

      // Check authentication
      if (response.status === 401 || response.status === 403) {
        console.error(
          `[${formatLogDate()}] Authentication error - token may be expired`,
        );
        throw new Error("Authentication error");
      }

      // Parse string response if needed
      let parsedData =
        typeof response.data === "string"
          ? JSON.parse(response.data)
          : response.data;

      // Process questions from the response
      const questions = parsedData?.content;
      if (questions && Array.isArray(questions)) {
        console.log(
          `[${formatLogDate()}] Found ${questions.length} questions to process`,
        );

        for (const question of questions) {
          const followUpId = `followupid_${question.customerId}_${question.productMainId}`;
          const isFollowUp = await client.get(followUpId);
          if (isFollowUp.ok) {
            await client.set(followUpId, true);
            console.log(
              `[${formatLogDate()}] Follow up settings updating to cache: ${followUpId} and value: ${isFollowUp.value}`,
            );
          } else {
            await client.set(followUpId, false);
            console.log(
              `[${formatLogDate()}] Follow up settings inserting to cache: ${followUpId}`,
            );
          }
          const existingQuestion = await storage.getQuestion(question.id);
          if (!existingQuestion) {
            console.log(
              `[${formatLogDate()}] Existing question not found ${question.id}`,
            );

            const followupQuestions = await storage.getFollowUpQuestions(
              question.customerId,
              question.productMainId,
            );
            let newQuestion = {
              customerId: question.customerId,
              productMainId: question.productMainId,
              productWebUrl: question.webUrl,
              productName: question.productName || "Unknown Product",
              questionId: question.id,
              questionText: question.text,
              questionDate: new Date(question.creationDate),
              success: false,
              needsApproval: false,
              isFollowUp: false,
              approved: false,
              status: question.status,
              isPublic: question.public,
            };

            if (followupQuestions && followupQuestions.length > 0) {
              newQuestion.needsApproval = true;
              newQuestion.isFollowUp = true;
            }
            // Store or update the question
            await storage.createQuestion(newQuestion);
          }
        }
      } else {
        console.log(
          `[${formatLogDate()}] No questions in response. Content:`,
          parsedData?.content,
        );
      }
    } catch (error) {
      console.error(`[${formatLogDate()}] Error fetching questions:`, error);
      logError(error as Error, "pollQuestions");
    }
  }

  startPolling(interval: number = POLL_INTERVAL): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    console.log(
      `[${formatLogDate()}] Starting question polling service with ${interval}ms interval`,
    );

    // Initial poll
    this.pollQuestions().then(() => {});

    // Set up regular polling
    this.pollInterval = setInterval(() => this.pollQuestions(), interval);
  }

  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private async postAnswerToTrendyol(
    questionId: string,
    answer: string,
  ): Promise<boolean> {
    try {
      console.log(
        `[${formatLogDate()}] Posting answer to Trendyol for question ${questionId}`,
      );

      const response = await rateLimiter.enqueue(() =>
        makeRequestWithRetry({
          method: "post",
          url: API_ENDPOINTS.ANSWER_QUESTION(
            TRENDYOL_CONFIG.SELLER_ID,
            questionId,
          ),
          headers: TRENDYOL_AUTH_HEADERS,
          data: { text: answer },
        }),
      );

      console.log(`[${formatLogDate()}] Trendyol answer response:`, {
        status: response.status,
        data: response.data,
      });

      // Check if status is in the 2xx range
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      console.error(
        `[${formatLogDate()}] Error posting answer to Trendyol:`,
        error,
      );
      logError(error as Error, "postAnswerToTrendyol");
      return false;
    }
  }

  async handleAutoAnswer(): Promise<void> {
    console.log(`Automatic answer started.`);

    const questions = await storage.getPendingQuestions();
    console.log(`Automatic answer started with ${questions.length} questions`);

    for (const question of questions) {
      console.log(`Question answered started: ${question.questionId}`);

      if (question.isFollowUp) {
        console.log(`Question is follow-up question: ${question.questionId}`);
        continue;
      }

      if (!question.chatbaseConversationId || !question.answerText) {
        console.log(
          `Question does not has chatbase answer: ${question.questionId}`,
        );
        const questionAndProductName = `Product: ${question.productName} Question: ${question.questionText}`;
        // Get Chatbase answer if we haven't already
        const chatbaseAnswer = await this.getChatbaseAnswer(
          questionAndProductName,
        );

        if (chatbaseAnswer && chatbaseAnswer.answerText) {
          const isUnknownAnswer = chatbaseAnswer.answerText.includes("xyz");

          // set as if unknown answer
          await storage.updateChatbaseAnswer(
            question.questionId,
            chatbaseAnswer.conversationId,
            chatbaseAnswer.answerText,
            isUnknownAnswer,
          );

          if (!isUnknownAnswer) {
            const success = await this.postAnswerToTrendyol(
              question.questionId,
              chatbaseAnswer.answerText,
            );
            const answerType = success ? "AUTOMATIC" : "PROVIDER";
            await storage.updateAnswer(
              question.questionId,
              "",
              chatbaseAnswer.answerText || "",
              new Date(),
              "ANSWERED",
              answerType,
            );
          }
        }
      } else {
        console.log(`Question has chatbase answer: ${question.questionId}`);
        const success = await this.postAnswerToTrendyol(
          question.questionId,
          question.answerText || "",
        );
        const answerType = success ? "AUTOMATIC" : "PROVIDER";
        await storage.updateAnswerStatus(
          question.questionId,
          new Date(),
          "ANSWERED",
          answerType,
        );
      }
    }
  }
}
