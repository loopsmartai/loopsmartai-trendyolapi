import { v4 } from "uuid";
import { storage } from "../storage";
import { rateLimiter } from "../utils/rateLimiter";
import { formatLogDate } from "../utils/timeUtils";
import { makeRequestWithRetry, logError } from "../utils/errorHandler";
import {
  TRENDYOL_CONFIG,
  CHATBASE_CONFIG,
  API_ENDPOINTS,
  POLL_INTERVAL,
} from "../config/constants";
import { ProcessedQuestion } from "@shared/schema.ts";

const TRENDYOL_AUTH_HEADERS = {
  Authorization: `Basic ${TRENDYOL_CONFIG.TOKEN}`,
  "Content-Type": "application/json",
  "User-Agent": "TrendyolMarketplaceBot/1.0",
};

export class QuestionProcessor {
  private static instance: QuestionProcessor;
  private pollInterval: NodeJS.Timeout | null;

  private constructor() {
    this.pollInterval = null;
  }

  static getInstance(): QuestionProcessor {
    if (!this.instance) {
      this.instance = new QuestionProcessor();
    }
    return this.instance;
  }

  private async getChatbaseAnswer(
    questionText: string,
  ): Promise<{ answerText: string; conversationId: string } | null> {
    try {
      console.log(
        `[${formatLogDate()}] Getting Chatbase answer for: ${questionText}`,
      );

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

      console.log(
        `[${formatLogDate()}] Sending request to Chatbase:`,
        JSON.stringify(payload, null, 2),
      );

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

      // Log full response for debugging
      console.log(`[${formatLogDate()}] Full Chatbase response:`, {
        status: response?.status,
        headers: response?.headers,
        data: JSON.stringify(response?.data, null, 2),
      });

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

      console.log(
        `[${formatLogDate()}] Generated answer from text:`,
        response.data.text,
      );
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

  async processQuestion(question: any): Promise<void> {
    try {
      console.log(
        `[${formatLogDate()}] Processing question ${question.questionId}: ${question.text}`,
      );
      var existingQuestion = await storage.getProcessedQuestion(question.id);

      // Only process if we haven't generated an answer yet
      if (!existingQuestion) {
        console.log(
          `[${formatLogDate()}] Existing question not found ${question.questionId}`,
        );
        // Store or update the question
        existingQuestion = await storage.createProcessedQuestion({
          questionId: question.id,
          customerId: question.customerId,
          productMainId: question.productMainId,
          productWebUrl: question.productWebUrl,
          productName: question.productName || "Unknown Product",
          questionText: question.text,
          answer: null,
          success: false,
          needsApproval: true,
          approved: false,
          public: question.public,
          editedAnswer: null,
        });
      }
      console.log(
        `[${formatLogDate()}] Existing question created or found ${existingQuestion.questionId}: ${existingQuestion.productName}`,
      );
    } catch (error) {
      console.error(`[${formatLogDate()}] Error processing question:`, error);
      logError(error as Error, "processQuestion");
    }
  }

  async pollQuestions(): Promise<ProcessedQuestion[]> {
    try {
      console.log(
        `[${formatLogDate()}] Fetching questions with WAITING_FOR_ANSWER status...`,
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
      let parsedData;
      try {
        parsedData =
          typeof response.data === "string"
            ? JSON.parse(response.data)
            : response.data;
      } catch (e) {
        console.error(`[${formatLogDate()}] Error parsing response:`, e);
        parsedData = response.data;
      }

      // First clear all questions
      await storage.removeAllQuestions();

      // Process questions from the response
      const questions = parsedData?.content;
      if (questions && Array.isArray(questions)) {
        console.log(
          `[${formatLogDate()}] Found ${questions.length} questions to process`,
        );
        for (const question of questions) {
          await this.processQuestion({
            id: question.id,
            text: question.text,
            productName: question.productName || "Unknown Product",
            status: question.status,
            public: question.public,
            customerId: question.customerId,
            productMainId: question.productMainId,
            productWebUrl: question.webUrl,
          });
        }
      } else {
        console.log(
          `[${formatLogDate()}] No questions in response. Content:`,
          parsedData?.content,
        );
      }
      return await storage.getAllPendingQuestions();
    } catch (error) {
      console.error(`[${formatLogDate()}] Error fetching questions:`, error);
      logError(error as Error, "pollQuestions");
      return [];
    }
  }

  async getQuestionById(questionId: string): Promise<ProcessedQuestion | null> {
    try {
      let question = await storage.getProcessedQuestion(questionId);
      console.log(
        `[${formatLogDate()}] Getting question for answer: ${questionId}`,
      );

      // Only process if we haven't generated an answer yet
      if (question) {
        console.log(
          `[${formatLogDate()}] Existing processed question found ${questionId}`,
        );
        let updatedQuestion = null;
        const existingQuestion = await storage.getQuestion(questionId);
        if (existingQuestion) {
          console.log(
            `[${formatLogDate()}] Existing question found ${questionId}`,
          );
          updatedQuestion = {
            id: existingQuestion.id,
            questionId: existingQuestion.questionId,
            customerId: existingQuestion.customerId,
            productMainId: existingQuestion.productMainId,
            productWebUrl: existingQuestion.productWebUrl,
            productName: existingQuestion.productName,
            questionText: existingQuestion.questionText,
            questionDate: existingQuestion.questionDate,
            answer: existingQuestion.answerText,
            processedAt: existingQuestion.processedDate || new Date(),
            public: existingQuestion.isPublic || false,
            followUp: existingQuestion.isFollowUp || false,
            editedAnswer: existingQuestion.answerText,
            success: false, // Assuming default value
            needsApproval: true, // Assuming default value
            approved: false,
          };
        } else {
          console.log(
            `[${formatLogDate()}] New question will be saved ${questionId}`,
          );
          const newQuestion = {
            questionId: question.questionId.toString(),
            customerId: question.customerId,
            productMainId: question.productMainId,
            productWebUrl: question.productWebUrl,
            productName: question.productName || "Unknown Product",
            questionText: question.questionText,
            questionDate: question.questionDate || new Date(),
            success: false,
            needsApproval: false,
            isFollowUp: false,
            approved: false,
            status: "WAITING_FOR_ANSWER",
            isPublic: question.public,
          };
          const followupQuestions = await storage.getFollowUpQuestions(
            question.customerId,
            question.productMainId,
          );
          if (followupQuestions && followupQuestions.length > 0) {
            newQuestion.needsApproval = true;
            newQuestion.isFollowUp = true;
          }
          updatedQuestion = await storage.createQuestion(newQuestion);
          console.log(
            `[${formatLogDate()}] New question  saved ${updatedQuestion.questionId}`,
          );
        }

        if (!updatedQuestion.answerText) {
          const questionAndProductName = `Product: ${question.productName} Question: ${question.questionText}`;
          // Get Chatbase answer if we haven't already
          const chatbaseAnswer = await this.getChatbaseAnswer(
            questionAndProductName,
          );
          if (chatbaseAnswer && chatbaseAnswer.answerText) {
            console.log(
              `[${formatLogDate()}] Automatic answer approved, question ${chatbaseAnswer.conversationId}`,
            );
            if (chatbaseAnswer.answerText.includes("xyz")) {
              console.log(
                `[${formatLogDate()}] Automatic answer blocked by xyz state answer, question ${chatbaseAnswer.conversationId}`,
              );
              updatedQuestion = await storage.updateChatbaseAnswer(
                updatedQuestion.questionId,
                chatbaseAnswer.conversationId,
                chatbaseAnswer.answerText,
                true,
              );
            } else {
              updatedQuestion = await storage.updateChatbaseAnswer(
                updatedQuestion.questionId,
                chatbaseAnswer.conversationId,
                chatbaseAnswer.answerText,
                false,
              );
            }
          }

          return {
            id: updatedQuestion.id,
            questionId: updatedQuestion.questionId,
            customerId: updatedQuestion.customerId,
            productMainId: updatedQuestion.productMainId,
            productWebUrl: updatedQuestion.productWebUrl,
            productName: updatedQuestion.productName,
            questionText: updatedQuestion.questionText,
            questionDate: updatedQuestion.questionDate,
            answer: updatedQuestion.answerText || null,
            processedAt: updatedQuestion.processedDate || new Date(),
            public: updatedQuestion.isPublic || false,
            followUp: updatedQuestion.isFollowUp || false,
            editedAnswer: updatedQuestion.answerText || null,
            success: false, // Assuming default value
            needsApproval: true, // Assuming default value
            approved: false,
          };
        }
      }
      return null;
    } catch (error) {
      console.error(`[${formatLogDate()}] Error processing question:`, error);
      logError(error as Error, "processQuestion");
      return null;
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

  async handleApproval(
    questionId: string,
    approved: boolean,
    editedAnswer?: string,
  ): Promise<void> {
    if (approved) {
      const question = await storage.getQuestion(questionId);
      if (!question) {
        throw new Error("Question not found");
      }
      console.log(
        `Handle approval for questionId ${questionId} and ${question.answerText}`,
      );
      const answerToPost = editedAnswer || question.answerText;
      if (!answerToPost) {
        throw new Error("No answer available to post");
      }

      const success = await this.postAnswerToTrendyol(questionId, answerToPost);
      if (!success) {
        throw new Error("Failed to post answer to Trendyol");
      }
    }

    await storage.updateApproval(questionId, approved, editedAnswer);
  }

  async handleAutoAnswer(): Promise<void> {
    console.log(`[${formatLogDate()}] Automatic answer started.`);
    const questions = await this.pollQuestions();
    console.log(
      `[${formatLogDate()}] Automatic answer started with ${questions.length} questions`,
    );
    for (const question of questions) {
      await this.processQuestion(question);
      console.log(
        `[${formatLogDate()}] Automatic answer for question ${question.questionId}`,
      );
      const questionWithAnswer = await this.getQuestionById(
        question.questionId.toString(),
      );
      console.log(
        `[${formatLogDate()}] Automatic answer for question ${questionWithAnswer?.questionId} 
          and answer ${questionWithAnswer?.answer}`,
      );
      if (questionWithAnswer && questionWithAnswer.answer) {
        if (questionWithAnswer.answer.includes("xyz")) {
          console.log(
            `[${formatLogDate()}] Automatic answer blocked by xyz state answer, question ${questionWithAnswer.questionId}`,
          );
          continue;
        }
        console.log(
          `[${formatLogDate()}] Automatic answer approved, question ${questionWithAnswer.questionId}`,
        );
        const success = await this.postAnswerToTrendyol(
          question.questionId,
          questionWithAnswer.answer,
        );
        if (!success) {
          throw new Error("Failed to post answer to Trendyol");
        }
        console.log(
          `[${formatLogDate()}] Automatic answer done, question ${questionWithAnswer.questionId}`,
        );
      }
    }
  }
}
