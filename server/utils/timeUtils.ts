export function isWithinOperatingHours(): boolean {
  const istanbulDate = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }),
  );
  const hour = istanbulDate.getHours();
  return hour >= 0 && hour < 8;
}

export function istanbulTime(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }),
  );
}

export function istanbulStartTime(
  year: number,
  month: number,
  day: number,
): Date {
  return new Date(
    new Date(year, month, day, 0, 0, 0, 0).toLocaleString("en-US", {
      timeZone: "Europe/Istanbul",
    }),
  );
}

export function istanbulEndTime(
  year: number,
  month: number,
  day: number,
): Date {
  return new Date(
    new Date(year, month, day, 23, 59, 59, 0).toLocaleString("en-US", {
      timeZone: "Europe/Istanbul",
    }),
  );
}

export function convertIstanbulTime(date: string): Date {
  return new Date(
    new Date(date).toLocaleString("en-US", { timeZone: "Europe/Istanbul" }),
  );
}

export function formatLogDate(): string {
  return new Date().toLocaleString("en-US", {
    timeZone: "Europe/Istanbul",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}
