import { sendConfiguredMessengerMessage, type MessengerMessageResult } from "@/lib/messenger-message";

type PaymentNotificationItem = {
  title: string;
  playedAt: Date;
  footballAmount: number;
  options: Array<{ name: string; amount: number }>;
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
  return `${new Intl.NumberFormat("vi-VN").format(amount)}₫`;
}
function formatDayMonth(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

function buildMessage(notification: PaymentNotification) {
  const sessionDescriptions = notification.items.map((item) => {
    const details = [
      `${formatVnd(item.footballAmount)}`,
      ...item.options.map((option) => `${option.name} ${formatVnd(option.amount)}`),
    ];
    return `${item.title} ${formatDayMonth(item.playedAt)} - ${details.join(", ")}`;
  });
  const heading = `Đã nhận được ${formatVnd(notification.amount)} từ @[${notification.userName}]`;

  const mismatch = notification.status === "UNDERPAID" || notification.status === "OVERPAID"
    ? ` Chuyển sai số tiền: cần ${formatVnd(notification.expectedAmount)}, đã nhận ${formatVnd(notification.amount)}.`
    : "";

  if (sessionDescriptions.length === 1) return `${heading} cho ${sessionDescriptions[0]}.${mismatch}`;

  return `${heading}:\n${sessionDescriptions.map((description) => `- ${description}`).join("\n")}${mismatch ? `\n${mismatch.trim()}` : ""}`;
}

export async function sendPaymentReceivedNotification(
  notification: PaymentNotification,
): Promise<PaymentNotificationResult> {
  return sendConfiguredMessengerMessage(buildMessage(notification));
}
