import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { formatLogDate } from "./timeUtils";

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: any,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function makeRequestWithRetry(
  config: AxiosRequestConfig,
  retries = 1,
  delay = 5000,
): Promise<any> {
  try {
    const response = await axios(config);
    console.log(`[${formatLogDate()}] API Response:`, {
      status: response.status,
    });
    return response;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      console.error(`[${formatLogDate()}] API Error:`, {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
        message: axiosError.message,
      });

      if (retries > 0) {
        console.warn(
          `[${formatLogDate()}] Request failed, retrying in ${delay}ms... (${retries} retries left)`,
        );
        await new Promise((r) => setTimeout(r, delay));
        return makeRequestWithRetry(config, retries - 1, delay * 2);
      }

      throw new ApiError(
        axiosError.message,
        axiosError.response?.status || 500,
        axiosError.response?.data,
      );
    }
    throw error;
  }
}

export function logError(error: Error, context: string): void {
  console.error(`[${formatLogDate()}] Error in ${context}:`, {
    name: error.name,
    message: error.message,
    stack: error.stack,
  });
}
