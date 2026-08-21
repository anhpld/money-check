export const paymentStatusOptions = [
  ["PENDING", "Chờ thanh toán"],
  ["PAID", "Đã khớp"],
  ["UNDERPAID", "Thiếu tiền"],
  ["OVERPAID", "Thừa tiền"],
  ["REVIEW_REQUIRED", "Cần kiểm tra"],
  ["CANCELLED", "Đã hủy"],
] as const;

export type PaymentStatus = typeof paymentStatusOptions[number][0];

export const paymentStatusLabels = Object.fromEntries(paymentStatusOptions) as Record<PaymentStatus, string>;

export function isPaymentStatus(value: string | undefined): value is PaymentStatus {
  return paymentStatusOptions.some(([status]) => status === value);
}

export const reviewablePaymentStatuses = ["REVIEW_REQUIRED"] as const;
