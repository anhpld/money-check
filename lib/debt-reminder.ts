import { getPrisma } from "@/lib/prisma";
import { sendConfiguredMessengerMessage } from "@/lib/messenger-message";

export const DEBT_REMINDER_SCHEDULE_ID = "default";
export const DEBT_REMINDER_TIMEZONE = "Asia/Ho_Chi_Minh";
export const DEFAULT_DEBT_REMINDER_DAYS = [1, 3, 5];
export const DEFAULT_DEBT_REMINDER_TIMES = ["20:00"];

const GMT7_OFFSET_MS = 7 * 60 * 60 * 1_000;
const DUE_LOOKBACK_MS = 5 * 60 * 1_000;

export type DebtReminderScheduleConfig = {
  enabled: boolean;
  days: number[];
  times: string[];
  timezone: string;
};

export type DebtReminderDeliveryResult =
  | { status: "sent"; debtorCount: number; message: string }
  | { status: "skipped"; debtorCount: 0; message: string }
  | { status: "failed"; debtorCount: number; message: string; error: string };

function debtDescription(matchCount: number, generalCount: number) {
  const parts: string[] = [];
  if (matchCount) parts.push(`${matchCount} trận`);
  if (generalCount) parts.push(`${generalCount} khoản`);
  return parts.join(" và ");
}

export async function sendDebtReminderMessage(): Promise<DebtReminderDeliveryResult> {
  try {
    const members = await getPrisma().sessionMember.findMany({
      where: { session: { status: "PUBLISHED", deletedAt: null } },
      select: {
        amountDue: true,
        amountPaid: true,
        session: { select: { kind: true } },
        user: { select: { id: true, name: true } },
      },
    });
    const debtByUser = new Map<string, { name: string; matchCount: number; generalCount: number }>();
    for (const member of members) {
      if (member.amountPaid >= member.amountDue) continue;
      const current = debtByUser.get(member.user.id) ?? { name: member.user.name, matchCount: 0, generalCount: 0 };
      if (member.session.kind === "MATCH") current.matchCount += 1;
      else current.generalCount += 1;
      debtByUser.set(member.user.id, current);
    }

    if (!debtByUser.size) {
      return { status: "skipped", debtorCount: 0, message: "Hiện không có ai còn nợ, chưa gửi tin nhắn." };
    }

    const groups = new Map<string, { matchCount: number; generalCount: number; names: string[] }>();
    for (const debt of debtByUser.values()) {
      const key = `${debt.matchCount}:${debt.generalCount}`;
      const group = groups.get(key) ?? { matchCount: debt.matchCount, generalCount: debt.generalCount, names: [] };
      group.names.push(debt.name);
      groups.set(key, group);
    }
    const message = [...groups.values()]
      .sort((left, right) => left.matchCount - right.matchCount || left.generalCount - right.generalCount)
      .map((group) => `${group.names.sort((left, right) => left.localeCompare(right, "vi")).join(", ")} còn nợ ${debtDescription(group.matchCount, group.generalCount)}.`)
      .join("\n");

    const result = await sendConfiguredMessengerMessage(message);
    if (result.status === "sent") return { status: "sent", debtorCount: debtByUser.size, message };
    const error = result.status === "failed"
      ? result.error
      : result.reason === "disabled"
        ? "Cấu hình Messenger đang tắt."
        : "Cấu hình Messenger chưa đầy đủ.";
    return { status: "failed", debtorCount: debtByUser.size, message, error };
  } catch (error) {
    return {
      status: "failed",
      debtorCount: 0,
      message: "",
      error: error instanceof Error ? error.message : "Không thể tạo danh sách nhắc nợ.",
    };
  }
}

function parseTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? { hour, minute } : null;
}

function localDateAtOffset(now: Date, dayOffset: number) {
  const localNow = new Date(now.getTime() + GMT7_OFFSET_MS);
  const shiftedDate = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate() + dayOffset));
  const dayOfWeek = shiftedDate.getUTCDay() || 7;
  return {
    year: shiftedDate.getUTCFullYear(),
    month: shiftedDate.getUTCMonth(),
    date: shiftedDate.getUTCDate(),
    dayOfWeek,
  };
}

function scheduledUtc(localDate: ReturnType<typeof localDateAtOffset>, time: string) {
  const parsed = parseTime(time);
  if (!parsed) return null;
  return new Date(Date.UTC(localDate.year, localDate.month, localDate.date, parsed.hour, parsed.minute) - GMT7_OFFSET_MS);
}

export function getNextDebtReminderAt(schedule: DebtReminderScheduleConfig, now = new Date()) {
  if (!schedule.enabled || schedule.timezone !== DEBT_REMINDER_TIMEZONE) return null;
  const candidates: Date[] = [];
  for (let dayOffset = 0; dayOffset <= 14; dayOffset += 1) {
    const localDate = localDateAtOffset(now, dayOffset);
    if (!schedule.days.includes(localDate.dayOfWeek)) continue;
    for (const time of schedule.times) {
      const candidate = scheduledUtc(localDate, time);
      if (candidate && candidate.getTime() > now.getTime()) candidates.push(candidate);
    }
    if (candidates.length) break;
  }
  return candidates.sort((left, right) => left.getTime() - right.getTime())[0] ?? null;
}

function getDueSlots(schedule: DebtReminderScheduleConfig, now: Date) {
  if (!schedule.enabled || schedule.timezone !== DEBT_REMINDER_TIMEZONE) return [];
  const due: Date[] = [];
  for (const dayOffset of [-1, 0]) {
    const localDate = localDateAtOffset(now, dayOffset);
    if (!schedule.days.includes(localDate.dayOfWeek)) continue;
    for (const time of schedule.times) {
      const candidate = scheduledUtc(localDate, time);
      if (!candidate) continue;
      const age = now.getTime() - candidate.getTime();
      if (age >= 0 && age <= DUE_LOOKBACK_MS) due.push(candidate);
    }
  }
  return due.sort((left, right) => left.getTime() - right.getTime());
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

export type DebtReminderJobSummary = {
  due: number;
  claimed: number;
  sent: number;
  skipped: number;
  failed: number;
};

export async function runDueDebtReminders(now = new Date()): Promise<DebtReminderJobSummary> {
  const summary: DebtReminderJobSummary = { due: 0, claimed: 0, sent: 0, skipped: 0, failed: 0 };
  const prisma = getPrisma();
  const schedule = await prisma.debtReminderSchedule.findUnique({ where: { id: DEBT_REMINDER_SCHEDULE_ID } });
  if (!schedule?.enabled) return summary;

  const dueSlots = getDueSlots(schedule, now);
  summary.due = dueSlots.length;
  for (const scheduledFor of dueSlots) {
    let run: { id: string };
    try {
      run = await prisma.debtReminderRun.create({
        data: { scheduleId: schedule.id, scheduledFor, status: "RUNNING" },
        select: { id: true },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) continue;
      throw error;
    }
    summary.claimed += 1;

    const result = await sendDebtReminderMessage();
    if (result.status === "sent") {
      summary.sent += 1;
      await prisma.debtReminderRun.update({
        where: { id: run.id },
        data: { status: "SENT", debtorCount: result.debtorCount, message: result.message, finishedAt: new Date() },
      });
    } else if (result.status === "skipped") {
      summary.skipped += 1;
      await prisma.debtReminderRun.update({
        where: { id: run.id },
        data: { status: "SKIPPED", debtorCount: 0, message: result.message, finishedAt: new Date() },
      });
    } else {
      summary.failed += 1;
      await prisma.debtReminderRun.update({
        where: { id: run.id },
        data: { status: "FAILED", debtorCount: result.debtorCount, message: result.message || null, error: result.error.slice(0, 5_000), finishedAt: new Date() },
      });
    }
  }
  return summary;
}
