export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DEBT_REMINDER_INTERNAL_SCHEDULER === "false") return;
  const { startDebtReminderScheduler } = await import("@/lib/debt-reminder-scheduler");
  startDebtReminderScheduler();
}
