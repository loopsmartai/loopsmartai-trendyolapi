import "dotenv/config";

// Create base64 encoded token from API key and secret
const createAuthToken = (apiKey: string, apiSecret: string) => {
  const tokenStr = `${apiKey}:${apiSecret}`;
  return Buffer.from(tokenStr).toString("base64");
};

export const TRENDYOL_CONFIG = {
  CLIENT_ID: process.env.TRENDYOL_CLIENT_ID || "139435",
  API_KEY: process.env.TRENDYOL_API_KEY || "Rf745LqtpbDuHG0yhQy2",
  API_SECRET: process.env.TRENDYOL_API_SECRET || "tnE2VFZYlN4soDrE1LeJ",
  get TOKEN() {
    return createAuthToken(this.API_KEY, this.API_SECRET);
  },
  SELLER_ID: process.env.TRENDYOL_SELLER_ID || "139435",
};

export const CHATBASE_CONFIG = {
  AGENT_ID: process.env.CHATBASE_AGENT_ID || "uH1DMfYSGraodngeAi0-T",
  API_KEY:
    process.env.CHATBASE_API_KEY || "ccbdd8b1-b4b8-4ef5-9932-202e726d644c",
  URL: "https://www.chatbase.co/api/v1/chat", // Ensure HTTPS
};

// Update API endpoints to use HTTPS
export const API_ENDPOINTS = {
  GET_QUESTIONS: (sellerId: string) =>
    `https://api.trendyol.com/sapigw/suppliers/${sellerId}/questions/filter?size=50&status=WAITING_FOR_ANSWER`,
  GET_PAGED_QUESTIONS: (
    sellerId: string,
    pageNumber: number,
    startDate: string,
    endDate: string,
  ) =>
    `https://api.trendyol.com/sapigw/suppliers/${sellerId}/questions/filter?size=100&page=${pageNumber}&startDate=${startDate}&endDate=${endDate}&orderByField=LastModifiedDate&orderByDirection=ASC`,
  GET_QUESTION: (sellerId: string, questionId: string) =>
    `https://api.trendyol.com/sapigw/suppliers/${sellerId}/questions/${questionId}`,
  ANSWER_QUESTION: (sellerId: string, questionId: string) =>
    `https://api.trendyol.com/sapigw/suppliers/${sellerId}/questions/${questionId}/answers`,
};

// Use HTTPS for default response URL if needed
export const DEFAULT_CHATBASE_RESPONSE =
  "Üzgünüm, bu konuda kesin bir bilgiye sahip değilim. Sorunuzu meslektaşıma ileteceğim, iş saatleri içinde size geri dönecekler. xyz";

export const POLL_INTERVAL = 60000; // 60 seconds - for debugging issues
export const MAX_RETRIES = 3;
export const RETRY_DELAY = 5000;
