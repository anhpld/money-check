"use client";

import { useState } from "react";

interface SubsystemPrompt {
  id: string;
  name: string;
  tag: string;
  description: string;
  trigger: string;
  outputFormat: string;
  prompt: string;
}

interface AiTool {
  name: string;
  category: "schedule" | "roster" | "finance" | "automation";
  permission: "duc_anh_only" | "all_members";
  summary: string;
  description: string;
  parameters: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
}

const SUBSYSTEM_PROMPTS: SubsystemPrompt[] = [
  {
    id: "direct_memory",
    name: "Trích xuất Ký ức & Cá tính Trực tiếp (Direct Turn Extraction)",
    tag: "Realtime",
    description:
      "Tự động kích hoạt ngay sau mỗi tin nhắn mà thành viên chat với bot. Trích xuất đồng thời 2 tầng: Nét tính cách dài hạn (Soul) và Sự việc / Lời hứa ngắn hạn (hạn 3 ngày).",
    trigger: "Người dùng gửi tin nhắn trò chuyện hoặc tương tác trong nhóm.",
    outputFormat: `JSON: { "personality": "string | null", "event": "string | null" }`,
    prompt: `LƯU Ý CỐT LÕI: "Vũ Quang Bình" là tên BOT trợ lý ảo, KHÔNG PHẢI người thật trong nhóm!
Người nói: {senderName}
Tin nhắn: "{messageText}"
Các sự việc 3 ngày qua ĐÃ LƯU của {senderName}: {existingFactsStr || 'Chưa có'}

Nhiệm vụ:
1. "personality": Nhận diện nét TÍNH CÁCH / PHONG CÁCH ĂN NÓI dài hạn của {senderName} nếu câu nói này thể hiện rõ cá tính (ví dụ: hay cà khịa, thích đùa cợt, ăn nói bỗ bã sân cỏ thân thiết, hòa nhã...). Lưu ý: Trêu bot hay chửi đùa bot là văn hóa trêu chọc sân cỏ, không coi là xúc phạm hay xấu tính. Nếu chỉ là câu chào hỏi hoặc không bộc lộ cá tính rõ rệt, trả về null.
2. "event": Trích xuất SỰ VIỆC TẠM THỜI / LỜI HỨA NGẮN HẠN (hạn 3 ngày) của {senderName}. LƯU Ý ĐẶC BIỆT:
   - Chủ thể của sự việc là CHÍNH NGƯỜI NÓI ({senderName}), ví dụ khi {senderName} dặn "nhắc uống thuốc" nghĩa là "{senderName} cần uống thuốc", tuyệt đối KHÔNG ghi Vũ Quang Bình cần uống thuốc!
   - NẾU SỰ VIỆC NÀY TRÙNG Ý HOẶC TƯƠNG ĐỒNG VỚI SỰ VIỆC ĐÃ LƯU Ở TRÊN, BẮT BUỘC TRẢ VỀ NULL (bỏ qua, không lưu lại).
   - Nếu không có sự việc gì đáng nhớ, trả về null.

Trả về JSON Object theo định dạng:
{"personality": "Nét tính cách dưới 15 từ hoặc null", "event": "Sự việc ngắn hạn dưới 15 từ hoặc null"}
Chỉ trả về JSON thuần túy, không markdown.`,
  },
  {
    id: "batch_memory",
    name: "Quét ngầm Hội thoại 20 Tin nhắn Nhóm (Batch Group Chat Extraction)",
    tag: "Batch 20 tin",
    description:
      "Tự động chạy ngầm mỗi khi nhóm trao đổi đủ 20 tin nhắn. Đọc hiểu toàn bộ ngữ cảnh đối thoại để phát hiện các sự việc, kèo bóng, lời hứa hẹn hoặc biến đổi tính cách mà không cần thành viên phải tag bot.",
    trigger: "Bộ đệm tin nhắn tích lũy đủ 20 tin nhắn mới nhất trong nhóm.",
    outputFormat: `JSON: { "souls": [{ name, personality }], "episodes": [{ name, fact }] }`,
    prompt: `LƯU Ý CỐT LÕI: "Vũ Quang Bình" là tên BOT trợ lý ảo, KHÔNG PHẢI thành viên người thật trong nhóm! Tuyệt đối không trích xuất tính cách hay sự việc về Vũ Quang Bình.
Dưới đây là các tin nhắn trao đổi trong nhóm bóng đá FC Đông Đô:
{transcript}

Các sự việc 3 ngày qua ĐÃ ĐƯỢC GHI NHẬN trước đó:
{knownFactsStr || 'Chưa có'}

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
  },
  {
    id: "soul_condensation",
    name: "Cô đọng & Tinh gọn Tính cách (Soul Condensation)",
    tag: "Tối ưu Soul",
    description:
      "Cơ chế tự động chống phình to dữ liệu (Context Bloat). Khi chuỗi tính cách tự học của một người vượt quá 100 ký tự, AI sẽ đúc kết lại thành DUY NHẤT 1 câu súc tích dưới 20 từ, giữ lại các phẩm chất nổi bật nhất.",
    trigger: "Chuỗi tính cách (currentSoul + newPersonality) vượt quá 100 ký tự.",
    outputFormat: `Chuỗi văn bản thuần túy (dưới 20 từ)`,
    prompt: `Hãy đúc kết nét tính cách và phong cách giao tiếp sau thành DUY NHẤT 1 câu súc tích dưới 20 từ, giữ đúng cá tính nổi bật nhất của anh em bóng đá sân cỏ, không lặp từ:
"{currentSoul}. {newPersonality}"
Chỉ trả về 1 câu thuần túy, không có ngoặc kép hay giải thích.`,
  },
];

const AI_TOOLS: AiTool[] = [
  // Nhóm Lịch thi đấu
  {
    name: "xem_lich_thi_dau",
    category: "schedule",
    permission: "all_members",
    summary: "Tra cứu lịch trận đấu sắp tới của đội",
    description:
      "Xem lịch thi đấu chính thức gần nhất của FC Đông Đô (thời gian, sân bóng, đối thủ, ghi chú). Tự động hết hạn và xóa sau 22h00 tối thứ 6.",
    parameters: [],
  },
  {
    name: "chot_lich_thi_dau",
    category: "schedule",
    permission: "duc_anh_only",
    summary: "Chốt lịch thi đấu tuần này (Chỉ Đức Anh)",
    description:
      "Chốt lịch thi đấu chính thức cho FC Đông Đô. Chỉ Đội trưởng Đức Anh (Facebook ID 100002974774231) mới có quyền thực thi.",
    parameters: [
      { name: "thoi_gian", type: "string", required: true, description: "Thời gian đá (ví dụ: '20h30 Thứ 6 ngày 02/10')" },
      { name: "san_bong", type: "string", required: true, description: "Địa điểm / Sân bóng (ví dụ: 'Sân Đoan Môn')" },
      { name: "doi_thu", type: "string", required: true, description: "Tên đội đối thủ (ví dụ: 'FC Viettel')" },
      { name: "ghi_chu", type: "string", required: false, description: "Ghi chú thêm (khởi động sớm, bọc ống đồng...)" },
    ],
  },
  {
    name: "huy_lich_thi_dau",
    category: "schedule",
    permission: "duc_anh_only",
    summary: "Hủy lịch thi đấu hiện tại (Chỉ Đức Anh)",
    description:
      "Hủy bỏ trận đấu tuần này khi có mưa gió, hoãn kèo hoặc hủy sân. Chỉ Đội trưởng Đức Anh có quyền thực thi.",
    parameters: [
      { name: "ly_do", type: "string", required: false, description: "Lý do hủy trận (mưa bão, đối hoãn...)" },
    ],
  },

  // Nhóm Nhân sự & Ký ức
  {
    name: "danh_sach_thanh_vien",
    category: "roster",
    permission: "all_members",
    summary: "Lấy danh sách 13 thành viên active kèm hồ sơ",
    description:
      "Lấy danh sách toàn bộ thành viên chính thức đang hoạt động kèm vị trí thi đấu, sở trường, số áo và vai trò.",
    parameters: [],
  },
  {
    name: "tra_cuu_thanh_vien",
    category: "roster",
    permission: "all_members",
    summary: "Tra cứu hồ sơ 3 tầng & phong độ của 1 người",
    description:
      "Tra cứu chi tiết: Hồ sơ chính thức (profile vị trí), Tính cách (Soul), Sự việc 3 ngày qua, số trận đã đá, số bàn thắng, kiến tạo, tiền đã nộp và tiền nợ.",
    parameters: [
      { name: "ten", type: "string", required: true, description: "Tên thành viên cần tra cứu (ví dụ: Đức Anh, Trường, Cường...)" },
    ],
  },
  {
    name: "cap_nhat_ho_so_thanh_vien",
    category: "roster",
    permission: "duc_anh_only",
    summary: "Cập nhật vị trí thi đấu & sở trường (Chỉ Đức Anh)",
    description:
      "Lưu vị trí thi đấu, sở trường, số áo hoặc vai trò của thành viên vào hồ sơ chính thức (User.profile). Chỉ Đức Anh có quyền thực thi.",
    parameters: [
      { name: "ten", type: "string", required: true, description: "Tên thành viên cần set hồ sơ" },
      { name: "ho_so", type: "string", required: true, description: "Nội dung hồ sơ (ví dụ: 'Vị trí: Tiền đạo cắm, sở trường sút xa')" },
    ],
  },
  {
    name: "ghi_nho_su_viec",
    category: "roster",
    permission: "all_members",
    summary: "Ghi nhớ sự việc / kèo / lời hứa (hạn 3 ngày)",
    description:
      "Lưu lại sự việc phát sinh (hứa thưởng tiền, đau chân, bận việc, bay về delay...). Tự động lọc trùng ý và tự hủy sau 3 ngày.",
    parameters: [
      { name: "ten", type: "string", required: true, description: "Tên thành viên liên quan" },
      { name: "su_viec", type: "string", required: true, description: "Sự việc ngắn gọn cần ghi nhớ" },
    ],
  },
  {
    name: "xem_ky_uc_thanh_vien",
    category: "roster",
    permission: "all_members",
    summary: "Xem toàn bộ sự việc 3 ngày qua của 1 người",
    description: "Liệt kê danh sách các sự việc ngắn hạn còn hiệu lực trong 3 ngày của thành viên.",
    parameters: [
      { name: "ten", type: "string", required: true, description: "Tên thành viên cần xem ký ức" },
    ],
  },
  {
    name: "xoa_ky_uc_thanh_vien",
    category: "roster",
    permission: "duc_anh_only",
    summary: "Xóa sự việc / hiểu lầm trong ký ức (Chỉ Đức Anh)",
    description: "Xóa một sự việc bị ghi nhận nhầm hoặc đã hoàn tất khỏi bộ nhớ 3 ngày của thành viên.",
    parameters: [
      { name: "ten", type: "string", required: true, description: "Tên thành viên" },
      { name: "tu_khoa", type: "string", required: true, description: "Từ khóa nhận diện sự việc cần xóa" },
    ],
  },
  {
    name: "cap_nhat_tinh_cach",
    category: "roster",
    permission: "duc_anh_only",
    summary: "Thiết lập Soul tính cách dài hạn (Chỉ Đức Anh)",
    description: "Gán hoặc điều chỉnh trực tiếp nét tính cách, phong cách giao tiếp lâu dài (User.personaPrompt).",
    parameters: [
      { name: "ten", type: "string", required: true, description: "Tên thành viên" },
      { name: "tinh_cach", type: "string", required: true, description: "Nét tính cách tóm tắt" },
    ],
  },

  // Nhóm Tài chính & Thống kê
  {
    name: "tra_cuu_cong_no",
    category: "finance",
    permission: "all_members",
    summary: "Tra cứu danh sách anh em nợ tiền quỹ",
    description:
      "Lấy danh sách các thành viên còn nợ tiền đóng quỹ / tiền sân (chưa bao gồm tiền nước), kèm số tiền và lý do nợ.",
    parameters: [],
  },
  {
    name: "tra_cuu_tien_quy",
    category: "finance",
    permission: "all_members",
    summary: "Báo cáo số dư quỹ & tổng thu nộp",
    description: "Tra cứu tổng số tiền đã thu vào quỹ đội, số tiền còn thiếu chưa thu xong và số lượng trận đấu.",
    parameters: [],
  },
  {
    name: "cap_nhat_ban_thang_kien_tao",
    category: "finance",
    permission: "duc_anh_only",
    summary: "Ghi nhận Bàn thắng / Kiến tạo (Chỉ Đức Anh)",
    description:
      "Cập nhật số bàn thắng (goals) hoặc kiến tạo (assists) của thành viên trong trận đấu gần nhất. Chỉ Đức Anh có quyền thực thi.",
    parameters: [
      { name: "ten", type: "string", required: true, description: "Tên thành viên ghi bàn / kiến tạo" },
      { name: "so_ban_thang", type: "number", required: false, description: "Số bàn thắng cộng thêm" },
      { name: "so_kien_tao", type: "number", required: false, description: "Số kiến tạo cộng thêm" },
      { name: "ghi_chu", type: "string", required: false, description: "Ghi chú thêm về pha bóng hoặc trận đấu" },
    ],
  },
  {
    name: "thong_tin_doi_bong",
    category: "finance",
    permission: "all_members",
    summary: "Tra cứu thông tin chung FC Đông Đô",
    description: "Lấy tổng quan tên đội bóng, số lượng thành viên chính thức và quy định hoạt động cơ bản.",
    parameters: [],
  },

  // Nhóm Tự động hóa & Lịch hẹn
  {
    name: "dat_lich_nhac_nho",
    category: "automation",
    permission: "duc_anh_only",
    summary: "Hẹn giờ gửi tin nhắn vào nhóm (Chỉ Đức Anh)",
    description:
      "Tạo lịch trình hẹn giờ tự động gửi tin nhắn nhắc nhở vào nhóm Messenger đúng thời điểm chỉ định (UTC+7).",
    parameters: [
      { name: "thoi_gian_iso", type: "string", required: true, description: "Thời điểm kích hoạt ISO-8601 (ví dụ: '2026-09-25T19:15:00+07:00')" },
      { name: "noi_dung", type: "string", required: true, description: "Nội dung tin nhắn cần gửi vào nhóm" },
      { name: "mo_ta", type: "string", required: false, description: "Ghi chú ngắn về mục đích nhắc nhở" },
    ],
  },
];

export function AiSkillsPromptViewer() {
  const [activeTab, setActiveTab] = useState<"prompts" | "tools">("prompts");
  const [toolCategory, setToolCategory] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (_) {}
  };

  const filteredTools =
    toolCategory === "all"
      ? AI_TOOLS
      : AI_TOOLS.filter((t) => t.category === toolCategory);

  return (
    <div className="ai-catalog-container">
      <div className="ai-catalog-header">
        <div className="ai-catalog-tabs">
          <button
            type="button"
            className={`ai-catalog-tab-btn ${activeTab === "prompts" ? "active" : ""}`}
            onClick={() => setActiveTab("prompts")}
          >
            Kho Prompt Ký ức & Tự học ({SUBSYSTEM_PROMPTS.length})
          </button>
          <button
            type="button"
            className={`ai-catalog-tab-btn ${activeTab === "tools" ? "active" : ""}`}
            onClick={() => setActiveTab("tools")}
          >
            15 Kỹ năng AI (Function Calling)
          </button>
        </div>
      </div>

      {activeTab === "prompts" && (
        <div className="ai-prompts-grid">
          {SUBSYSTEM_PROMPTS.map((sp) => (
            <div key={sp.id} className="panel ai-prompt-card">
              <div className="ai-prompt-card-head">
                <div>
                  <div className="ai-prompt-badge-row">
                    <span className="badge-tag">{sp.tag}</span>
                  </div>
                  <h3>{sp.name}</h3>
                  <p className="ai-prompt-desc">{sp.description}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm ai-copy-btn"
                  onClick={() => handleCopy(sp.id, sp.prompt)}
                >
                  {copiedId === sp.id ? "Đã chép ✓" : "Sao chép Prompt"}
                </button>
              </div>

              <div className="ai-prompt-meta-grid">
                <div>
                  <span className="meta-label">Điều kiện kích hoạt:</span>
                  <span className="meta-val">{sp.trigger}</span>
                </div>
                <div>
                  <span className="meta-label">Định dạng kết quả:</span>
                  <code className="meta-code">{sp.outputFormat}</code>
                </div>
              </div>

              <div className="ai-prompt-body">
                <span className="ai-prompt-body-label">NỘI DUNG PROMPT GỬI CHO LLM:</span>
                <pre className="ai-prompt-pre">
                  <code>{sp.prompt}</code>
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "tools" && (
        <div className="ai-tools-view">
          <div className="ai-tools-filter-bar">
            <span>Lọc theo nhóm:</span>
            <div className="filter-chips">
              <button
                type="button"
                className={`filter-chip ${toolCategory === "all" ? "active" : ""}`}
                onClick={() => setToolCategory("all")}
              >
                Tất cả (15)
              </button>
              <button
                type="button"
                className={`filter-chip ${toolCategory === "schedule" ? "active" : ""}`}
                onClick={() => setToolCategory("schedule")}
              >
                Lịch thi đấu (3)
              </button>
              <button
                type="button"
                className={`filter-chip ${toolCategory === "roster" ? "active" : ""}`}
                onClick={() => setToolCategory("roster")}
              >
                Nhân sự & Ký ức (7)
              </button>
              <button
                type="button"
                className={`filter-chip ${toolCategory === "finance" ? "active" : ""}`}
                onClick={() => setToolCategory("finance")}
              >
                Tài chính & Quỹ (4)
              </button>
              <button
                type="button"
                className={`filter-chip ${toolCategory === "automation" ? "active" : ""}`}
                onClick={() => setToolCategory("automation")}
              >
                Hẹn giờ & Nhắc nhở (1)
              </button>
            </div>
          </div>

          <div className="ai-tools-grid">
            {filteredTools.map((tool) => (
              <div key={tool.name} className="panel ai-tool-card">
                <div className="ai-tool-head">
                  <div className="ai-tool-title-row">
                    <code className="ai-tool-name">{tool.name}</code>
                    {tool.permission === "duc_anh_only" ? (
                      <span className="badge-permission badge-admin" title="Chỉ Facebook ID 100002974774231">
                        Chỉ Đội trưởng Đức Anh
                      </span>
                    ) : (
                      <span className="badge-permission badge-public">
                        Tất cả thành viên
                      </span>
                    )}
                  </div>
                  <strong className="ai-tool-summary">{tool.summary}</strong>
                  <p className="ai-tool-desc">{tool.description}</p>
                </div>

                <div className="ai-tool-params">
                  <span className="params-label">
                    Tham số đầu vào ({tool.parameters.length}):
                  </span>
                  {tool.parameters.length === 0 ? (
                    <p className="params-empty">Không có tham số (gọi trực tiếp).</p>
                  ) : (
                    <div className="params-list">
                      {tool.parameters.map((p) => (
                        <div key={p.name} className="param-item">
                          <div className="param-header">
                            <span className="param-name">{p.name}</span>
                            <span className="param-type">{p.type}</span>
                            {p.required ? (
                              <span className="param-required">Bắt buộc</span>
                            ) : (
                              <span className="param-optional">Tùy chọn</span>
                            )}
                          </div>
                          <span className="param-desc">{p.description}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
