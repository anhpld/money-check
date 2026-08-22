const webhookStatusLabels: Record<string, string> = {
  SUCCESS: "Thành công",
  PAID: "Đã khớp",
  UNDERPAID: "Thiếu tiền",
  OVERPAID: "Thừa tiền",
  REVIEW_REQUIRED: "Cần kiểm tra",
  IGNORED: "Đã bỏ qua",
  DUPLICATE: "Trùng lặp",
  NOT_FOUND: "Không tìm thấy",
  INVALID: "Không hợp lệ",
  FAILED: "Thất bại",
};

export function webhookStatusLabel(status: string) {
  return webhookStatusLabels[status] ?? status;
}
