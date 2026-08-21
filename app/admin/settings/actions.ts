"use server";

import { revalidatePath } from "next/cache";
import { isAdminAuthenticated } from "@/lib/admin-session";
import { SEND_MESSAGE_SETTING_KEYS, SEND_MESSAGE_SETTING_TYPE } from "@/lib/app-settings";
import { sendConfiguredMessengerMessage } from "@/lib/messenger-message";
import { getPrisma } from "@/lib/prisma";

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
