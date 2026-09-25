import { SEND_MESSAGE_SETTING_KEYS, SEND_MESSAGE_SETTING_TYPE } from "@/lib/app-settings";
import { getPrisma } from "@/lib/prisma";

export type MessengerMessageResult =
  | { status: "sent" }
  | { status: "skipped"; reason: "disabled" | "incomplete" }
  | { status: "failed"; error: string };

export async function sendConfiguredMessengerMessage(
  message: string,
  overrideChatUrl?: string,
): Promise<MessengerMessageResult> {
  try {
    const settings = await getPrisma().setting.findMany({
      where: {
        type: SEND_MESSAGE_SETTING_TYPE,
        key: { in: Object.values(SEND_MESSAGE_SETTING_KEYS) },
      },
      select: { key: true, value: true, enabled: true },
    });
    const settingsByKey = new Map<string, { key: string; value: string; enabled: boolean }>(
      settings.map((setting: { key: string; value: string; enabled: boolean }) => [setting.key, setting]),
    );
    const apiUrl = settingsByKey.get(SEND_MESSAGE_SETTING_KEYS.apiUrl);
    const apiKey = settingsByKey.get(SEND_MESSAGE_SETTING_KEYS.apiKey);
    const chatUrl = settingsByKey.get(SEND_MESSAGE_SETTING_KEYS.chatUrl);
    const prodChatUrl = settingsByKey.get(SEND_MESSAGE_SETTING_KEYS.prodChatUrl);
    const testChatUrl = settingsByKey.get(SEND_MESSAGE_SETTING_KEYS.testChatUrl);
    const targetEnv = settingsByKey.get(SEND_MESSAGE_SETTING_KEYS.targetEnv)?.value || "test";

    const defaultUrl = targetEnv === "prod"
      ? (prodChatUrl?.value || chatUrl?.value)
      : (testChatUrl?.value || "https://www.messenger.com/t/954763997032636");

    const targetChatUrl = overrideChatUrl?.trim() || defaultUrl;

    if (!apiUrl?.value || !apiKey?.value || !targetChatUrl) {
      return { status: "skipped", reason: "incomplete" };
    }
    if (!apiUrl.enabled || !apiKey.enabled || (!overrideChatUrl && chatUrl && !chatUrl.enabled)) {
      return { status: "skipped", reason: "disabled" };
    }

    const response = await fetch(apiUrl.value, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey.value,
      },
      body: JSON.stringify({ chatUrl: targetChatUrl, message }),
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      const responseBody = (await response.text()).slice(0, 1_000);
      return {
        status: "failed",
        error: `Messenger API trả về HTTP ${response.status}${responseBody ? `: ${responseBody}` : ""}`,
      };
    }

    return { status: "sent" };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Lỗi không xác định khi gửi Messenger.",
    };
  }
}
