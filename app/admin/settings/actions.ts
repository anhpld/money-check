"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { isAdminAuthenticated } from "@/lib/admin-session";
import { SEND_MESSAGE_SETTING_KEYS, SEND_MESSAGE_SETTING_TYPE } from "@/lib/app-settings";
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

export type SyncUsersResult = {
  status: "idle" | "success" | "error";
  message: string;
  details?: string[];
};

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

function buildDebtReminder(groups: Map<number, string[]>) {
  const lines = [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([sessionCount, names]) => `${names.sort((left, right) => left.localeCompare(right, "vi")).join(", ")} còn nợ ${sessionCount} buổi.`);
  return `${lines.join("\n")}`;
}

export async function sendDebtReminder(
  _previousState: SendDebtReminderResult,
): Promise<SendDebtReminderResult> {
  void _previousState;
  if (!(await isAdminAuthenticated())) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  try {
    const members = await getPrisma().sessionMember.findMany({
      where: { session: { status: "PUBLISHED" } },
      select: {
        amountDue: true,
        amountPaid: true,
        user: { select: { id: true, name: true } },
      },
    });
    const debtCountByUser = new Map<string, { name: string; count: number }>();
    for (const member of members) {
      if (member.amountPaid >= member.amountDue) continue;
      const current = debtCountByUser.get(member.user.id);
      debtCountByUser.set(member.user.id, {
        name: member.user.name,
        count: (current?.count ?? 0) + 1,
      });
    }
    if (!debtCountByUser.size) {
      return { status: "success", message: "Hiện không có ai còn nợ, chưa gửi tin nhắn." };
    }

    const groups = new Map<number, string[]>();
    for (const debt of debtCountByUser.values()) {
      groups.set(debt.count, [...(groups.get(debt.count) ?? []), debt.name]);
    }
    const result = await sendConfiguredMessengerMessage(buildDebtReminder(groups));
    if (result.status === "sent") {
      return { status: "success", message: `Đã gửi nhắc nợ cho ${debtCountByUser.size} người.` };
    }
    if (result.status === "skipped") {
      return {
        status: "error",
        message: result.reason === "disabled" ? "Cấu hình Messenger đang tắt." : "Cấu hình Messenger chưa đầy đủ.",
      };
    }
    console.error("Không thể gửi nhắc nợ:", result.error);
    return { status: "error", message: "Không thể gửi nhắc nợ. Vui lòng kiểm tra Messenger API." };
  } catch (error) {
    console.error("Không thể tạo danh sách nhắc nợ:", error);
    return { status: "error", message: "Không thể tạo danh sách nhắc nợ." };
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

    revalidatePath("/admin/settings");
    return { status: "success", message: enabled ? "Đã lưu và bật cấu hình Messenger." : "Đã lưu cấu hình Messenger ở trạng thái tắt." };
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
    const [webhookLogs, payments, sessions, users] = await prisma.$transaction([
      prisma.webhookLog.deleteMany(),
      prisma.paymentRequest.deleteMany(),
      prisma.footballSession.deleteMany(),
      prisma.user.deleteMany(),
    ]);
    await clearStoredAvatars().catch((error) => {
      console.error("Không thể xóa toàn bộ ảnh đại diện:", error);
    });

    revalidatePath("/admin");
    revalidatePath("/admin/collections");
    revalidatePath("/admin/transactions");
    revalidatePath("/admin/settings");
    revalidatePath("/client");

    return {
      status: "success",
      message: `Đã xóa ${users.count} người dùng, ${sessions.count} khoản thu, ${payments.count} giao dịch và ${webhookLogs.count} webhook log.`,
    };
  } catch (error) {
    console.error("Không thể reset dữ liệu:", error);
    return { status: "error", message: "Không thể reset dữ liệu. Vui lòng thử lại." };
  }
}
