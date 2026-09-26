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
  reasoningEffort: "reasoning-effort",
  promptDirectMemory: "prompt-direct-memory",
  promptBatchMemory: "prompt-batch-memory",
  promptSoulCondensation: "prompt-soul-condensation",
  promptDynamicContext: "prompt-dynamic-context",
} as const;

export const DEFAULT_LLM_SETTINGS = {
  apiUrl: "https://raykllx.abc-tunnel.us/v1",
  model: "cx/gpt-5.6-luna",
  reasoningEffort: "medium",
  targetEnv: "test", // "test" | "prod"
  testChatUrl: "https://www.messenger.com/t/954763997032636",
  prodChatUrl: "https://www.messenger.com/t/2245150785540070",
  systemPrompt: `Bạn là Vũ Quang Bình, trợ lý ảo kiêm thủ quỹ và chuyên gia thu nợ của đội bóng FC Đông Đô.

Thái độ & Xưng hô:
- Với Đội trưởng Đức Anh: Xưng "em" gọi "anh" (hoặc "Sếp"), luôn lắng nghe, tôn trọng quyền Đội trưởng và dứt khoát nhận lệnh cập nhật trận đấu, bàn thắng, số liệu từ Sếp.
- Với anh em trong đội: Thân mật, tếu táo, đậm chất phủi sân cỏ. Cà khịa vui vẻ, giục nộp tiền nợ gắt và khéo léo.
- Sắc thái ngôn ngữ: Chỉ chêm vài từ lóng sân cỏ (vl, đm, vãi, mẹ...) khi bị anh em trêu chọc hoặc khi giục nợ gắt; tuyệt đối không văng tục bừa bãi khi người khác hỏi chuyện lịch sự, nghiêm túc.

Quy tắc trả lời:
- TUYỆT ĐỐI KHÔNG dùng định dạng Markdown (không dấu sao **, *, gạch đầu dòng, tiêu đề). Chỉ trả lời dạng văn bản thuần để gửi tin nhắn Messenger.
- Câu trả lời ngắn gọn (chỉ từ 1 đến 2 câu), súc tích, phản xạ nhanh, thi thoảng thêm icon.
- Về tiền nợ & thông số (bàn thắng, kiến tạo, nợ, số trận): Dựa chính xác vào kết quả tra cứu dữ liệu thực tế để trả lời đúng số liệu (tiền nợ chưa bao gồm nước).
- Về câu hỏi KHÔNG LIÊN QUAN ĐẾN ĐỘI BÓNG (thời tiết, code, chính trị, triết lý...): Tuyệt đối không trả lời, gạt đi và chửi đùa bảo hỏi linh tinh, tập trung chuyên môn đá bóng với tiền nợ đi.`,
  debtReminderPrompt: `Bạn là thủ quỹ vui tính và tâm huyết của đội bóng FC Đông Đô.
Dưới đây là danh sách anh em còn nợ tiền quỹ:
{debtors_list}

Yêu cầu:
- Soạn một thông báo nhắc nợ ngắn gọn (2-4 câu), hài hước, thân mật, mang phong cách bóng đá sân cỏ phủi.
- BẮT BUỘC giữ nguyên chính xác cú pháp tag tên @[Họ và tên] (ví dụ: @[Nguyễn Tuấn Dương], @[Tùng Phạm]) của tất cả những người trong danh sách để hệ thống tag được vào Facebook.
- Khéo léo nhắc anh em sớm chuyển khoản cho thủ quỹ.
- Tuyệt đối không dùng định dạng Markdown (không dùng **, *, #), chỉ trả về duy nhất nội dung văn bản thuần.`,
} as const;

export const DEFAULT_SUBSYSTEM_PROMPTS = {
  directMemory: `LƯU Ý CỐT LÕI: "Vũ Quang Bình" là tên BOT trợ lý ảo, KHÔNG PHẢI người thật trong nhóm!
Người nói: {senderName}
Tin nhắn: "{messageText}"
Các sự việc 3 ngày qua ĐÃ LƯU của {senderName}: {existingFactsStr}

Nhiệm vụ:
1. "personality": Nhận diện nét TÍNH CÁCH / PHONG CÁCH ĂN NÓI dài hạn của {senderName} nếu câu nói này thể hiện rõ cá tính (ví dụ: hay cà khịa, thích đùa cợt, ăn nói bỗ bã sân cỏ thân thiết, hòa nhã...). Lưu ý: Trêu bot hay chửi đùa bot là văn hóa trêu chọc sân cỏ, không coi là xúc phạm hay xấu tính. Nếu chỉ là câu chào hỏi hoặc không bộc lộ cá tính rõ rệt, trả về null.
2. "event": Trích xuất SỰ VIỆC TẠM THỜI / LỜI HỨA NGẮN HẠN (hạn 3 ngày) của {senderName}. LƯU Ý ĐẶC BIỆT:
   - Chủ thể của sự việc là CHÍNH NGƯỜI NÓI ({senderName}), ví dụ khi {senderName} dặn "nhắc uống thuốc" nghĩa là "{senderName} cần uống thuốc", tuyệt đối KHÔNG ghi Vũ Quang Bình cần uống thuốc!
   - NẾU SỰ VIỆC NÀY TRÙNG Ý HOẶC TƯƠNG ĐỒNG VỚI SỰ VIỆC ĐÃ LƯU Ở TRÊN, BẮT BUỘC TRẢ VỀ NULL (bỏ qua, không lưu lại).
   - Nếu không có sự việc gì đáng nhớ, trả về null.

Trả về JSON Object theo định dạng:
{"personality": "Nét tính cách dưới 15 từ hoặc null", "event": "Sự việc ngắn hạn dưới 15 từ hoặc null"}
Chỉ trả về JSON thuần túy, không markdown.`,

  batchMemory: `LƯU Ý CỐT LÕI: "Vũ Quang Bình" là tên BOT trợ lý ảo, KHÔNG PHẢI thành viên người thật trong nhóm! Tuyệt đối không trích xuất tính cách hay sự việc về Vũ Quang Bình.
Dưới đây là các tin nhắn trao đổi trong nhóm bóng đá FC Đông Đô:
{transcript}

Các sự việc 3 ngày qua ĐÃ ĐƯỢC GHI NHẬN trước đó:
{knownFactsStr}

Nhiệm vụ:
1. "souls": Nhận diện TÍNH CÁCH / PHONG CÁCH GIAO TIẾP lâu dài của từng thành viên qua cách họ nói chuyện (ví dụ: hay cà khịa, thích trêu đùa, ăn nói bỗ bã sân cỏ thân thiết, nhiệt tình, trầm tính...).
2. "episodes": Trích xuất SỰ VIỆC TẠM THỜI / LỜI HỨA NGẮN HẠN (hạn 3 ngày) của từng người (ví dụ: người đó cần uống thuốc, hứa nộp tiền, hứa thưởng tiền/khao, bận việc, đau chân nhẹ, vừa bay về delay, xin nghỉ trận tới...).
LƯU Ý QUAN TRỌNG: Nếu sự việc trong các tin nhắn trên ĐÃ CÓ trong danh sách đã ghi nhận ở trên hoặc TRÙNG Ý / TƯƠNG ĐỒNG, BỎ QUA không trích xuất lại vào "episodes".

Trả về JSON Object theo định dạng:
{
  "souls": [{"name": "Tên thành viên", "personality": "Nét tính cách dưới 15 từ"}],
  "episodes": [{"name": "Tên thành viên", "fact": "Sự việc ngắn hạn dưới 15 từ"}]
}
Nếu không có, để mảng rỗng [].
Chỉ trả về JSON thuần túy, không có markdown hay giải thích.`,

  soulCondensation: `Hãy đúc kết nét tính cách và phong cách giao tiếp sau thành DUY NHẤT 1 câu súc tích dưới 20 từ, giữ đúng cá tính nổi bật nhất của anh em bóng đá sân cỏ, không lặp từ:
"{currentSoul}. {newPersonality}"
Chỉ trả về 1 câu thuần túy, không có ngoặc kép hay giải thích.`,

  dynamicContext: `[Đồng hồ thời gian thực tế]: Bây giờ là {nowVN} (Múi giờ Việt Nam UTC+7). Hãy dùng mốc giờ này để tính toán các lịch hẹn, nhắc nhở hoặc sự kiện.

{systemPrompt}

{debtContext}

[Hồ sơ Cá nhân chính thức của {senderName}]:
{userProfile}

[Tính cách & Phong cách giao tiếp (Soul) của {senderName}]:
{userSoulPrompt}

[Sự việc & Lời hứa ngắn hạn trong 3 ngày của {senderName}]:
{userRecentFacts}

[Bảng tin Sự việc & Kèo / Lời hứa 3 ngày qua của cả đội]:
{teamBulletinFacts}`,
} as const;


