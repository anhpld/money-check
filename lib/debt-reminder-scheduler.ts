import { runDueDebtReminders } from "@/lib/debt-reminder";

const globalForScheduler = globalThis as unknown as {
  debtReminderInterval?: ReturnType<typeof setInterval>;
  debtReminderInitialCheck?: ReturnType<typeof setTimeout>;
};

async function checkSchedule() {
  try {
    await runDueDebtReminders();
  } catch (error) {
    console.error("Không thể chạy job nhắc nợ:", error);
  }
}

export function startDebtReminderScheduler() {
  if (globalForScheduler.debtReminderInterval) return;

  const initialCheck = setTimeout(() => void checkSchedule(), 15_000);
  const interval = setInterval(() => void checkSchedule(), 30_000);
  initialCheck.unref();
  interval.unref();
  globalForScheduler.debtReminderInitialCheck = initialCheck;
  globalForScheduler.debtReminderInterval = interval;
}
