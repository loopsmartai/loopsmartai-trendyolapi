export class RateLimiter {
  private queue: Array<{
    task: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }>;
  private interval: number;
  private isProcessing: boolean;

  constructor(interval: number) {
    this.queue = [];
    this.interval = interval;
    this.isProcessing = false;
  }

  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const { task, resolve, reject } = this.queue.shift()!;
      try {
        const result = await task();
        resolve(result);
      } catch (err) {
        reject(err);
      }
      await new Promise(r => setTimeout(r, this.interval));
    }

    this.isProcessing = false;
  }
}

export const rateLimiter = new RateLimiter(1000); // 1 second between requests
