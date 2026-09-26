"use client";

import { useState } from "react";

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

export function AiToolsViewer() {
  const [toolCategory, setToolCategory] = useState<string>("all");
  const [toolSearch, setToolSearch] = useState<string>("");

  const filteredTools = AI_TOOLS.filter((t) => {
    const matchCat = toolCategory === "all" || t.category === toolCategory;
    const query = toolSearch.toLowerCase().trim();
    const matchQuery =
      !query ||
      t.name.toLowerCase().includes(query) ||
      t.summary.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query) ||
      t.parameters.some((p) => p.name.toLowerCase().includes(query));
    return matchCat && matchQuery;
  });

  return (
    <div className="ai-tools-view">
      <div className="ai-tools-header-bar">
        <div className="ai-tools-search-box">
          <svg className="ai-search-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Tìm nhanh kỹ năng theo tên (chot_lich...), từ khóa hoặc tham số..."
            value={toolSearch}
            onChange={(e) => setToolSearch(e.target.value)}
          />
          {toolSearch && (
            <button
              type="button"
              className="ai-search-clear"
              onClick={() => setToolSearch("")}
              aria-label="Xóa tìm kiếm"
            >
              ×
            </button>
          )}
        </div>

        <div className="ai-tools-filter-bar">
          <div className="filter-chips">
            <button
              type="button"
              className={`filter-chip ${toolCategory === "all" ? "active" : ""}`}
              onClick={() => setToolCategory("all")}
            >
              Tất cả ({AI_TOOLS.length})
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
              Hẹn giờ (1)
            </button>
          </div>
        </div>
      </div>

      <div className="ai-tools-count-info">
        Hiển thị <strong>{filteredTools.length}</strong> / {AI_TOOLS.length} kỹ năng
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
  );
}
