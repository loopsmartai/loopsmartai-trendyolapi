import { storage } from "../storage";
import { QuestionService } from "./questions.ts";
import { formatLogDate } from "../utils/timeUtils";
import { logError } from "../utils/errorHandler";
import { SettingsConfig } from "@shared/schema.ts";
import moment from "moment-timezone";
import cron from "node-cron";

// Start the question processor service
const questionService = QuestionService.getInstance();
let currentCronJob: any = null; // Holds reference to the active cron job

const weekdaysMap = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

// Function to stop the current cron job
const stopCronJob = () => {
  if (currentCronJob) {
    currentCronJob.stop(); // Stop the existing cron job
    console.log("Existing cron job stopped.");
    currentCronJob = null;
  }
};

const logJobStart = async () => {
  try {
    console.log(`Job started...`);
    return await storage.recordJobLog("running", "");
  } catch (error) {
    console.error("Error logging job start:", error);
    throw error;
  }
};

const logJobCompletion = async (
  jobId: number,
  state: string,
  result: string,
) => {
  try {
    console.log(`Job updated:`);
    await storage.updateJobLog(jobId, state, result);
  } catch (error) {
    console.error("Error updating job state:", error);
    throw error;
  }
};

// Function to schedule a new cron job based on settings
const scheduleCronJob = ({
  weekdays,
  startTime,
  endTime,
  timeZone,
}: {
  weekdays: string[];
  startTime: string;
  endTime: string;
  timeZone: string;
}) => {
  if (!weekdays || weekdays.length === 0) {
    console.error("No weekdays provided. Cron job was not scheduled.");
    return;
  }

  // Parse startTime and endTime into hours using the user's time zone
  const startTimeInZone = moment.tz(startTime, "HH:mm", timeZone);
  const endTimeInZone = moment.tz(endTime, "HH:mm", timeZone);

  const startMin = startTimeInZone.minutes();
  const startHour = startTimeInZone.hour();
  const endMin = endTimeInZone.minutes();
  const endHour = endTimeInZone.hour();

  const calculatedEndHour = endTimeInZone.subtract(1, "hour").hour();
  const cronExpression =
    startHour === endHour || startHour === calculatedEndHour
      ? `*/2 ${startHour} * * ${weekdays
          .map((day) => weekdaysMap[day as keyof typeof weekdaysMap])
          .join(",")}`
      : `*/2 ${startHour}-${calculatedEndHour} * * ${weekdays
          .map((day) => weekdaysMap[day as keyof typeof weekdaysMap])
          .join(",")}`;

  // Schedule the cron job
  currentCronJob = cron.schedule(
    cronExpression,
    async () => {
      let jobRecord;
      try {
        // Log job start
        jobRecord = await logJobStart();

        console.log(
          `Executing task for settings ID: ${jobRecord.id} in time zone: ${timeZone}`,
        );
        //await processor.handleAutoAnswer();
        await questionService.handleAutoAnswer();
        const taskResult = `Task completed successfully at ${moment.tz(timeZone).format()}`;
        console.log(taskResult);

        // Log success
        await logJobCompletion(jobRecord.id, "completed", taskResult);
      } catch (error) {
        console.error("Task failed:", error); // Log failure
        if (jobRecord) {
          await logJobCompletion(jobRecord.id, "failed", "error");
        }
      }
    },
    {
      scheduled: true,
      timezone: timeZone,
    },
  );

  console.log(
    `Cron job scheduled with expression: ${cronExpression} (time zone: ${timeZone})`,
  );
};

export class SettingsService {
  private static instance: SettingsService;

  static getInstance(): SettingsService {
    if (!this.instance) {
      this.instance = new SettingsService();
    }
    return this.instance;
  }

  async getSettings(): Promise<SettingsConfig | undefined> {
    try {
      console.log(`[${formatLogDate()}] Getting settings...`);

      return await storage.getSettingsConfig();
    } catch (error) {
      console.error(`[${formatLogDate()}] Error processing question:`, error);
      logError(error as Error, "processQuestion");
    }
  }

  async updateSettings(
    automaticAnswer: boolean,
    weekdays: Array<string>,
    startTime: string,
    endTime: string,
  ) {
    try {
      console.log(`[${formatLogDate()}] Updating settings...`);

      const weekdaysString = weekdays.join(",");

      const settingsConfigs = await storage.getSettingsConfig();
      console.log("Settings Config from DB: ", settingsConfigs);
      if (settingsConfigs) {
        const settingsConfig = await storage.updateSettingsConfig(
          settingsConfigs.id,
          automaticAnswer,
          weekdaysString,
          startTime,
          endTime,
        );
        console.log(`Updated settings: `, settingsConfig);

        stopCronJob(); // stopping current job

        if (settingsConfig.automaticAnswer === true) {
          scheduleCronJob({
            weekdays,
            startTime,
            endTime,
            timeZone: "Europe/Istanbul",
          });
        }
      }
    } catch (error) {
      console.error(`[${formatLogDate()}] Error updating settings:`, error);
      logError(error as Error, "settingsConfig");
    }
  }

  async initialScheduleCronJob() {
    try {
      console.log(
        `[${formatLogDate()}] Initial cron schedule starts when app starting...`,
      );

      const settingsConfig = await storage.getSettingsConfig();
      console.log("Settings Config from DB: ", settingsConfig);
      if (settingsConfig) {
        console.log(`Updated settings: `, settingsConfig);

        stopCronJob(); // stopping current job

        if (
          settingsConfig.automaticAnswer === true &&
          settingsConfig.weekdays &&
          settingsConfig.weekdays.length > 0
        ) {
          scheduleCronJob({
            weekdays: settingsConfig.weekdays?.split(","),
            startTime: settingsConfig.startTime ? settingsConfig.startTime : "",
            endTime: settingsConfig.endTime ? settingsConfig.endTime : "",
            timeZone: "Europe/Istanbul",
          });
        }
      }
    } catch (error) {
      console.error(`[${formatLogDate()}] Error updating settings:`, error);
      logError(error as Error, "settingsConfig");
    }
  }
}
