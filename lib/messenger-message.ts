import { SEND_MESSAGE_SETTING_KEYS, SEND_MESSAGE_SETTING_TYPE } from "@/lib/app-settings";
import { getPrisma } from "@/lib/prisma";

export type MessengerMessageResult =
  | { status: "sent" }
  | { status: "skipped"; reason: "disabled" | "incomplete" }
  | { status: "failed"; error: string };

export async function sendConfiguredMessengerMessage(message: string): Promise<MessengerMessageResult> {
  try {
    const settings = await getPrisma().setting.findMany({
      where: {
        type: SEND_MESSAGE_SETTING_TYPE,
        key: { in: Object.values(SEND_MESSAGE_SETTING_KEYS) },
      },
      select: { key: true, value: true, enabled: true },
    });
    const settingsByKey = new Map(settings.map((setting) => [setting.key, setting]));
    const apiUrl = settingsByKey.get(SEND_MESSAGE_SETTING_KEYS.apiUrl);
    const apiKey = settingsByKey.get(SEND_MESSAGE_SETTING_KEYS.apiKey);
    const chatUrl = settingsByKey.get(SEND_MESSAGE_SETTING_KEYS.chatUrl);

    if (!apiUrl?.value || !apiKey?.value || !chatUrl?.value) {
      return { status: "skipped", reason: "incomplete" };
    }
    if (![apiUrl, apiKey, chatUrl].every((setting) => setting.enabled)) {
      return { status: "skipped", reason: "disabled" };
    }

    const response = await fetch(apiUrl.value, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey.value,
      },
      body: JSON.stringify({ chatUrl: chatUrl.value, message }),
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
