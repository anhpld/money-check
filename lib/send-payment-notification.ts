import { sendConfiguredMessengerMessage, type MessengerMessageResult } from "@/lib/messenger-message";

type PaymentNotificationItem = {
  title: string;
  playedAt: Date;
  waterAmount: number;
};

type PaymentNotification = {
  amount: number;
  expectedAmount: number;
  status: "PENDING" | "CANCELLED" | "UNDERPAID" | "PAID" | "OVERPAID" | "REVIEW_REQUIRED";
  userName: string;
  items: PaymentNotificationItem[];
};

export type PaymentNotificationResult = MessengerMessageResult;

function formatVnd(amount: number) {
  return `${new Intl.NumberFormat("vi-VN").format(amount)} ₫`;
}

function formatDayMonth(date: Date) {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function buildMessage(notification: PaymentNotification) {
  const sessionDescriptions = notification.items.map((item) =>
    `${item.title} ${formatDayMonth(item.playedAt)} - ${item.waterAmount > 0 ? `có nước ${formatVnd(item.waterAmount)}` : "không nước"}`,
  );
  const heading = `Đã nhận được ${formatVnd(notification.amount)} từ ${notification.userName}`;

  const mismatch = notification.status === "UNDERPAID" || notification.status === "OVERPAID"
    ? ` Chuyển sai số tiền: cần ${formatVnd(notification.expectedAmount)}, đã nhận ${formatVnd(notification.amount)}.`
    : "";

  if (sessionDescriptions.length === 1) return `${heading} cho ${sessionDescriptions[0]}.${mismatch}`;

  return `${heading} cho:\n${sessionDescriptions.map((description) => `- ${description}`).join("\n")}${mismatch ? `\n${mismatch.trim()}` : ""}`;
}

export async function sendPaymentReceivedNotification(
  notification: PaymentNotification,
): Promise<PaymentNotificationResult> {
  return sendConfiguredMessengerMessage(buildMessage(notification));
}
