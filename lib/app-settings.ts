export const SEND_MESSAGE_SETTING_TYPE = "send-message";

export const SEND_MESSAGE_SETTING_KEYS = {
  apiUrl: "api-url",
  apiKey: "api-key",
  chatUrl: "chat-url",
  prodChatUrl: "prod-chat-url",
  testChatUrl: "test-chat-url",
  targetEnv: "target-env",
} as const;

export const DEFAULT_SEND_MESSAGE_SETTINGS = {
  apiUrl: "http://34.21.166.188:3001/api/messages",
  prodChatUrl: "https://www.messenger.com/t/2245150785540070",
  testChatUrl: "https://www.messenger.com/t/954763997032636",
  targetEnv: "test" as "test" | "prod",
};

export const LLM_SETTING_TYPE = "llm-assistant";

export const LLM_SETTING_KEYS = {
  apiUrl: "api-url",
  apiKey: "api-key",
  model: "model",
  systemPrompt: "system-prompt",
  targetEnv: "target-env",
  testChatUrl: "test-chat-url",
  prodChatUrl: "prod-chat-url",
  aiDebtReminderEnabled: "ai-debt-reminder-enabled",
  debtReminderPrompt: "debt-reminder-prompt",
} as const;

export const DEFAULT_LLM_SETTINGS = {
  apiUrl: "https://raykllx.abc-tunnel.us/v1",
  model: "cx/gpt-5.6-luna",
  targetEnv: "test", // "test" | "prod"
  testChatUrl: "https://www.messenger.com/t/954763997032636",
  prodChatUrl: "https://www.messenger.com/t/2245150785540070",
  systemPrompt: `Bạn là Vũ Quang Bình, thủ quỹ vui tính và lém lỉnh kiêm trợ lý ảo của đội bóng FC Đông Đô.
Tính cách: Thân mật, hài hước, dí dỏm, đậm chất anh em bóng đá sân cỏ. Xưng "em" gọi "anh" (hoặc "bác/bạn" tùy ngữ cảnh).
Quy tắc trả lời:
- Luôn trả lời ngắn gọn (1 đến 2 câu), súc tích, không dài dòng.
- Nếu người nhắn hỏi về tiền quỹ, nợ nần: Dựa chính xác vào [Dữ liệu quỹ FC Đông Đô thực tế] được cung cấp để trả lời đúng số tiền và trận nợ. Nhắc nhở khéo léo, hài hước.
- Nếu người nhắn chỉ chào hỏi, trêu đùa: Đáp lại hài hước, tếu táo.`,
  debtReminderPrompt: `Bạn là thủ quỹ vui tính và tâm huyết của đội bóng FC Đông Đô.
Dưới đây là danh sách anh em còn nợ tiền quỹ:
{debtors_list}

Yêu cầu:
- Soạn một thông báo nhắc nợ ngắn gọn (2-4 câu), hài hước, thân mật, mang phong cách bóng đá sân cỏ phủi.
- BẮT BUỘC giữ nguyên chính xác cú pháp tag tên @[Họ và tên] (ví dụ: @[Nguyễn Tuấn Dương], @[Tùng Phạm]) của tất cả những người trong danh sách để hệ thống tag được vào Facebook.
- Khéo léo nhắc anh em sớm chuyển khoản cho thủ quỹ.
- Tuyệt đối không dùng định dạng Markdown (không dùng **, *, #), chỉ trả về duy nhất nội dung văn bản thuần.`,
} as const;


