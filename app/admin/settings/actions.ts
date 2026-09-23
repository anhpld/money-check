"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { isAdminAuthenticated } from "@/lib/admin-session";
import { SEND_MESSAGE_SETTING_KEYS, SEND_MESSAGE_SETTING_TYPE } from "@/lib/app-settings";
import {
  DEBT_REMINDER_SCHEDULE_ID,
  DEBT_REMINDER_TIMEZONE,
  sendDebtReminderMessage,
} from "@/lib/debt-reminder";
import { sendConfiguredMessengerMessage } from "@/lib/messenger-message";
import { getPrisma } from "@/lib/prisma";
import {
  clearStoredAvatars,
  deleteStoredAvatar,
  isAllowedRemoteAvatarUrl,
  saveRemoteAvatar,
} from "@/lib/avatar-storage";

export type ResetDataResult =
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export type SaveSendMessageSettingsResult = {
  status: "idle" | "success" | "error";
  message: string;
};

export type SendDebtReminderResult = {
  status: "idle" | "success" | "error";
  message: string;
};

export type SaveDebtReminderScheduleResult = {
  status: "idle" | "success" | "error";
  message: string;
};

export type SyncUsersResult = {
  status: "idle" | "success" | "error";
  message: string;
  details?: string[];
};

export type AndroidStatusResult = {
  status: "idle" | "online" | "offline" | "timeout" | "error";
  message: string;
  checkedAt?: string;
  lastSeenAt?: string | null;
  latencyMs?: number;
  appVersion?: string | null;
};

export async function checkAndroidAppStatus(
  _previousState: AndroidStatusResult,
): Promise<AndroidStatusResult> {
  void _previousState;
  if (!(await isAdminAuthenticated())) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const serviceUrl = process.env.STATUS_SERVICE_URL?.trim() ?? "";
  const adminToken = process.env.STATUS_ADMIN_TOKEN?.trim() ?? "";
  const deviceId = process.env.STATUS_DEVICE_ID?.trim() || "android-main";
  if (!serviceUrl || !adminToken) {
    return { status: "error", message: "Chưa cấu hình Socket Status Service." };
  }

  let endpoint;
  try {
    const url = new URL(serviceUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("INVALID_PROTOCOL");
    endpoint = new URL("/devices/check", url).toString();
  } catch {
    return { status: "error", message: "STATUS_SERVICE_URL không hợp lệ." };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ deviceId }),
      signal: AbortSignal.timeout(7_000),
    });
    const payload = await response.json() as Record<string, unknown>;
    if (!response.ok || payload.success !== true) {
      return { status: "error", message: "Socket Status Service từ chối yêu cầu kiểm tra." };
    }

    const checkedAt = new Date().toISOString();
    const lastSeenAt = typeof payload.lastSeenAt === "string" ? payload.lastSeenAt : null;
    if (payload.status === "online") {
      return {
        status: "online",
        message: "Ứng dụng Android đang hoạt động và phản hồi bình thường.",
        checkedAt,
        lastSeenAt,
        latencyMs: typeof payload.latencyMs === "number" ? payload.latencyMs : undefined,
        appVersion: typeof payload.appVersion === "string" ? payload.appVersion : null,
      };
    }
    if (payload.status === "offline") {
      return { status: "offline", message: "Ứng dụng Android không kết nối tới socket.", checkedAt, lastSeenAt };
    }
    if (payload.status === "timeout") {
      return { status: "timeout", message: "Socket còn kết nối nhưng ứng dụng Android không phản hồi trong 5 giây.", checkedAt, lastSeenAt };
    }
    return { status: "error", message: "Ứng dụng Android trả về phản hồi không hợp lệ.", checkedAt, lastSeenAt };
  } catch (error) {
    console.error("Không thể kiểm tra trạng thái Android:", error);
    return { status: "error", message: "Không thể kết nối tới Socket Status Service." };
  }
}

type ImportedUser = {
  name: string;
  imageUrl: string | null;
};

const MAX_SYNC_USERS = 100;
const MAX_SYNC_JSON_LENGTH = 200_000;

function normalizeUserName(value: string) {
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}

function userNameKey(value: string) {
  return normalizeUserName(value).toLocaleLowerCase("vi");
}

function parseImportedUsers(rawJson: string): { users: ImportedUser[]; duplicateCount: number } | { error: string } {
  if (!rawJson) return { error: "Vui lòng dán danh sách JSON cần đồng bộ." };
  if (rawJson.length > MAX_SYNC_JSON_LENGTH) return { error: "Dữ liệu JSON quá lớn." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { error: "JSON không hợp lệ. Vui lòng kiểm tra lại dấu ngoặc và dấu phẩy." };
  }
  if (!Array.isArray(parsed)) return { error: "Dữ liệu phải là một JSON array." };
  if (!parsed.length) return { error: "Danh sách JSON đang trống." };
  if (parsed.length > MAX_SYNC_USERS) return { error: `Chỉ được đồng bộ tối đa ${MAX_SYNC_USERS} người mỗi lần.` };

  const uniqueUsers = new Map<string, ImportedUser>();
  let duplicateCount = 0;
  for (const [index, item] of parsed.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { error: `Phần tử thứ ${index + 1} phải là một object.` };
    }
    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? normalizeUserName(record.name) : "";
    if (name.length < 2 || name.length > 80) {
      return { error: `Tên tại phần tử thứ ${index + 1} phải có từ 2 đến 80 ký tự.` };
    }

    const imageUrlValue = record.imageUrl;
    if (imageUrlValue !== undefined && imageUrlValue !== null && typeof imageUrlValue !== "string") {
      return { error: `imageUrl tại phần tử thứ ${index + 1} phải là chuỗi.` };
    }
    const imageUrl = typeof imageUrlValue === "string" ? imageUrlValue.trim() : "";
    if (imageUrl && (imageUrl.length > 5_000 || !isAllowedRemoteAvatarUrl(imageUrl))) {
      return { error: `imageUrl tại phần tử thứ ${index + 1} phải là URL HTTPS thuộc CDN Facebook.` };
    }

    const key = userNameKey(name);
    if (uniqueUsers.has(key)) duplicateCount += 1;
    uniqueUsers.set(key, { name, imageUrl: imageUrl || null });
  }

  return { users: [...uniqueUsers.values()], duplicateCount };
}

export async function syncUsersFromJson(
  _previousState: SyncUsersResult,
  formData: FormData,
): Promise<SyncUsersResult> {
  void _previousState;
  if (!(await isAdminAuthenticated())) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const rawJson = readText(formData, "usersJson");
  const parsed = parseImportedUsers(rawJson);
  if ("error" in parsed) return { status: "error", message: parsed.error };

  try {
    const prisma = getPrisma();
    const existingUsers = await prisma.user.findMany({
      select: { id: true, name: true, avatarKey: true },
      orderBy: { name: "asc" },
    });
    const usersByName = new Map(existingUsers.map((user) => [userNameKey(user.name), user]));
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    const imageErrors: string[] = [];

    for (const importedUser of parsed.users) {
      const key = userNameKey(importedUser.name);
      const existingUser = usersByName.get(key);
      const userId = existingUser?.id ?? randomUUID();
      let newAvatarKey: string | null = null;

      if (importedUser.imageUrl) {
        try {
          newAvatarKey = await saveRemoteAvatar(importedUser.imageUrl, userId);
        } catch (error) {
          imageErrors.push(importedUser.name);
          console.error(`Không thể tải avatar của ${importedUser.name}:`, error);
        }
      }

      if (!existingUser) {
        try {
          const user = await prisma.user.create({
            data: { id: userId, name: importedUser.name, avatarKey: newAvatarKey },
            select: { id: true, name: true, avatarKey: true },
          });
          usersByName.set(key, user);
          created += 1;
        } catch (error) {
          await deleteStoredAvatar(newAvatarKey).catch(() => {});
          throw error;
        }
        continue;
      }

      const nameChanged = existingUser.name !== importedUser.name;
      if (!nameChanged && !newAvatarKey) {
        unchanged += 1;
        continue;
      }

      try {
        const user = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            ...(nameChanged ? { name: importedUser.name } : {}),
            ...(newAvatarKey ? { avatarKey: newAvatarKey } : {}),
          },
          select: { id: true, name: true, avatarKey: true },
        });
        usersByName.set(key, user);
        if (newAvatarKey) {
          await deleteStoredAvatar(existingUser.avatarKey).catch((error) => {
            console.error(`Không thể xóa avatar cũ của ${existingUser.name}:`, error);
          });
        }
        updated += 1;
      } catch (error) {
        await deleteStoredAvatar(newAvatarKey).catch(() => {});
        throw error;
      }
    }

    revalidatePath("/admin");
    revalidatePath("/admin/settings");
    revalidatePath("/client");

    const summary = [`${created} tạo mới`, `${updated} cập nhật`, `${unchanged} không đổi`];
    if (parsed.duplicateCount) summary.push(`${parsed.duplicateCount} tên trùng trong JSON`);
    if (imageErrors.length) summary.push(`${imageErrors.length} ảnh tải lỗi`);
    return {
      status: "success",
      message: `Đã đồng bộ: ${summary.join(", ")}.`,
      details: imageErrors.length ? [`Không tải được ảnh: ${imageErrors.join(", ")}. User vẫn được đồng bộ.`] : undefined,
    };
  } catch (error) {
    console.error("Không thể đồng bộ người dùng:", error);
    return { status: "error", message: "Không thể đồng bộ người dùng. Vui lòng thử lại." };
  }
}

export async function sendTestMessengerMessage(
  _previousState: SendDebtReminderResult,
  formData?: FormData,
): Promise<SendDebtReminderResult> {
  void _previousState;
  if (!(await isAdminAuthenticated())) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const rawChatUrl = formData?.get("chatUrl");
  const testChatUrl = typeof rawChatUrl === "string" ? rawChatUrl.trim() : "";
  if (!testChatUrl) {
    return { status: "error", message: "Vui lòng nhập URL Messenger để gửi test." };
  }

  const rawMessage = formData?.get("message");
  const message = typeof rawMessage === "string" && rawMessage.trim() ? rawMessage.trim() : "test";

  const result = await sendConfiguredMessengerMessage(message, testChatUrl);
  if (result.status === "sent") {
    return { status: "success", message: `Đã gửi message test: “${message.slice(0, 40)}${message.length > 40 ? "..." : ""}”.` };
  }
  if (result.status === "skipped") {
    return {
      status: "error",
      message: result.reason === "disabled" ? "Cấu hình Messenger đang tắt." : "Cấu hình Messenger chưa đầy đủ.",
    };
  }
  console.error("Không thể gửi message test:", result.error);
  return { status: "error", message: `Không thể gửi message test: ${result.error || "Vui lòng kiểm tra Messenger API."}` };
}

export async function sendDebtReminder(
  _previousState: SendDebtReminderResult,
): Promise<SendDebtReminderResult> {
  void _previousState;
  if (!(await isAdminAuthenticated())) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const result = await sendDebtReminderMessage();
  if (result.status === "sent") return { status: "success", message: `Đã gửi nhắc nợ cho ${result.debtorCount} người.` };
  if (result.status === "skipped") return { status: "success", message: result.message };
  console.error("Không thể gửi nhắc nợ:", result.error);
  return { status: "error", message: "Không thể gửi nhắc nợ. Vui lòng kiểm tra Messenger API." };
}

export async function saveDebtReminderSchedule(
  _previousState: SaveDebtReminderScheduleResult,
  formData: FormData,
): Promise<SaveDebtReminderScheduleResult> {
  void _previousState;
  if (!(await isAdminAuthenticated())) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const enabled = formData.get("enabled") === "on";
  const days = [...new Set(formData.getAll("days").map(Number))].sort((left, right) => left - right);
  const times = [...new Set(formData.getAll("times").map((value) => String(value).trim()))].sort();
  if (days.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
    return { status: "error", message: "Danh sách ngày gửi không hợp lệ." };
  }
  if (times.length > 6 || times.some((time) => !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))) {
    return { status: "error", message: "Giờ gửi không hợp lệ hoặc vượt quá 6 khung giờ mỗi ngày." };
  }
  if (enabled && (!days.length || !times.length)) {
    return { status: "error", message: "Cần chọn ít nhất một ngày và một giờ trước khi bật lịch." };
  }

  try {
    const prisma = getPrisma();
    if (enabled) {
      const messengerSettings = await prisma.setting.findMany({
        where: { type: SEND_MESSAGE_SETTING_TYPE, key: { in: Object.values(SEND_MESSAGE_SETTING_KEYS) } },
        select: { value: true, enabled: true },
      });
      if (messengerSettings.length !== Object.keys(SEND_MESSAGE_SETTING_KEYS).length
        || messengerSettings.some((setting) => !setting.enabled || !setting.value.trim())) {
        return { status: "error", message: "Cần bật và cấu hình đầy đủ Messenger trước khi bật lịch tự động." };
      }
    }

    await prisma.debtReminderSchedule.upsert({
      where: { id: DEBT_REMINDER_SCHEDULE_ID },
      create: { id: DEBT_REMINDER_SCHEDULE_ID, enabled, days, times, timezone: DEBT_REMINDER_TIMEZONE },
      update: { enabled, days, times, timezone: DEBT_REMINDER_TIMEZONE },
    });
    revalidatePath("/admin/settings");
    return { status: "success", message: enabled ? "Đã lưu và bật lịch nhắc nợ tự động." : "Đã lưu lịch ở trạng thái tắt." };
  } catch (error) {
    console.error("Không thể lưu lịch nhắc nợ:", error);
    return { status: "error", message: "Không thể lưu lịch nhắc nợ. Vui lòng thử lại." };
  }
}

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function validHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validMessengerChatUrl(value: string) {
  try {
    const url = new URL(value);
    const allowedHosts = new Set(["messenger.com", "www.messenger.com", "facebook.com", "www.facebook.com"]);
    return url.protocol === "https:"
      && allowedHosts.has(url.hostname.toLowerCase())
      && (/^\/t\/[^/]+/.test(url.pathname) || /^\/messages\/t\/[^/]+/.test(url.pathname));
  } catch {
    return false;
  }
}

export async function saveSendMessageSettings(
  _previousState: SaveSendMessageSettingsResult,
  formData: FormData,
): Promise<SaveSendMessageSettingsResult> {
  if (!(await isAdminAuthenticated())) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const enabled = formData.get("enabled") === "on";
  const apiUrl = readText(formData, "apiUrl");
  const apiKey = readText(formData, "apiKey");
  const chatUrl = readText(formData, "chatUrl");

  if (apiUrl.length > 2_000 || chatUrl.length > 2_000 || apiKey.length > 1_000) {
    return { status: "error", message: "Thông tin cấu hình vượt quá độ dài cho phép." };
  }
  if (apiUrl && !validHttpUrl(apiUrl)) {
    return { status: "error", message: "API URL phải là địa chỉ HTTP hoặc HTTPS hợp lệ." };
  }
  if (chatUrl && !validMessengerChatUrl(chatUrl)) {
    return { status: "error", message: "URL group phải là link chat Messenger hoặc Facebook hợp lệ." };
  }

  try {
    const prisma = getPrisma();
    const existingApiKey = await prisma.setting.findUnique({
      where: {
        type_key: {
          type: SEND_MESSAGE_SETTING_TYPE,
          key: SEND_MESSAGE_SETTING_KEYS.apiKey,
        },
      },
      select: { value: true },
    });
    const savedApiKey = apiKey || existingApiKey?.value || "";

    if (enabled && (!apiUrl || !chatUrl || !savedApiKey)) {
      return { status: "error", message: "Cần nhập đủ API URL, API key và URL group trước khi bật gửi thông báo." };
    }

    const entries = [
      { key: SEND_MESSAGE_SETTING_KEYS.apiUrl, value: apiUrl },
      { key: SEND_MESSAGE_SETTING_KEYS.apiKey, value: savedApiKey },
      { key: SEND_MESSAGE_SETTING_KEYS.chatUrl, value: chatUrl },
    ];

    await prisma.$transaction(entries.map((entry) => prisma.setting.upsert({
      where: { type_key: { type: SEND_MESSAGE_SETTING_TYPE, key: entry.key } },
      create: { type: SEND_MESSAGE_SETTING_TYPE, key: entry.key, value: entry.value, enabled },
      update: { value: entry.value, enabled },
    })));
    if (!enabled) {
      await prisma.debtReminderSchedule.updateMany({
        where: { enabled: true },
        data: { enabled: false },
      });
    }

    revalidatePath("/admin/settings");
    return { status: "success", message: enabled ? "Đã lưu và bật cấu hình Messenger." : "Đã tắt Messenger và lịch nhắc nợ tự động." };
  } catch (error) {
    console.error("Không thể lưu cấu hình Messenger:", error);
    return { status: "error", message: "Không thể lưu cấu hình. Vui lòng thử lại." };
  }
}

export async function resetApplicationData(confirmation: string): Promise<ResetDataResult> {
  if (!(await isAdminAuthenticated())) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  if (confirmation !== "RESET") return { status: "error", message: "Vui lòng nhập đúng RESET để xác nhận." };

  try {
    const prisma = getPrisma();
    const [reminderRuns, webhookLogs, payments, sessions, opponents, users] = await prisma.$transaction([
      prisma.debtReminderRun.deleteMany(),
      prisma.webhookLog.deleteMany(),
      prisma.paymentRequest.deleteMany(),
      prisma.footballSession.deleteMany(),
      prisma.opponent.deleteMany(),
      prisma.user.deleteMany(),
    ]);
    await clearStoredAvatars().catch((error) => {
      console.error("Không thể xóa toàn bộ ảnh đại diện:", error);
    });

    revalidatePath("/admin");
    revalidatePath("/admin/collections");
    revalidatePath("/admin/statistics");
    revalidatePath("/admin/transactions");
    revalidatePath("/admin/settings");
    revalidatePath("/client");

    return {
      status: "success",
      message: `Đã xóa ${users.count} người dùng, ${opponents.count} đối thủ, ${sessions.count} khoản thu, ${payments.count} giao dịch, ${webhookLogs.count} webhook log và ${reminderRuns.count} lần chạy nhắc nợ.`,
    };
  } catch (error) {
    console.error("Không thể reset dữ liệu:", error);
    return { status: "error", message: "Không thể reset dữ liệu. Vui lòng thử lại." };
  }
}

export async function resetActivityData(confirmation: string): Promise<ResetDataResult> {
  if (!(await isAdminAuthenticated())) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  if (confirmation !== "RESET") return { status: "error", message: "Vui lòng nhập đúng RESET để xác nhận." };

  try {
    const prisma = getPrisma();
    const [reminderRuns, webhookLogs, payments, sessions] = await prisma.$transaction([
      prisma.debtReminderRun.deleteMany(),
      prisma.webhookLog.deleteMany(),
      prisma.paymentRequest.deleteMany(),
      prisma.footballSession.deleteMany(),
    ]);

    revalidatePath("/admin");
    revalidatePath("/admin/collections");
    revalidatePath("/admin/statistics");
    revalidatePath("/admin/transactions");
    revalidatePath("/admin/webhook-logs");
    revalidatePath("/admin/settings");
    revalidatePath("/client");

    return {
      status: "success",
      message: `Đã xóa ${sessions.count} khoản thu, ${payments.count} giao dịch, ${webhookLogs.count} webhook log và ${reminderRuns.count} lần chạy nhắc nợ. User, đối thủ và cấu hình lịch được giữ nguyên.`,
    };
  } catch (error) {
    console.error("Không thể reset dữ liệu thu chi:", error);
    return { status: "error", message: "Không thể reset dữ liệu thu chi. Vui lòng thử lại." };
  }
}
