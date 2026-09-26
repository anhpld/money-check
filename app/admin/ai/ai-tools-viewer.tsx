"use client";

import { useState } from "react";

export interface SampleResponse {
  scenario: string;
  status: "success" | "warning" | "error" | "info";
  data: Record<string, any>;
}

export interface AiTool {
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
  sampleResponses: SampleResponse[];
}

export const AI_TOOLS: AiTool[] = [
  // ==========================================
  // NHÓM 1: LỊCH THI ĐẤU (3 KỸ NĂNG)
  // ==========================================
  {
    name: "xem_lich_thi_dau",
    category: "schedule",
    permission: "all_members",
    summary: "Tra cứu lịch trận đấu sắp tới của đội",
    description:
      "Xem lịch thi đấu chính thức gần nhất của FC Đông Đô (thời gian, sân bóng, đối thủ, ghi chú). Tự động hết hạn và xóa sau 22h00 tối thứ 6.",
    parameters: [],
    sampleResponses: [
      {
        scenario: "Trường hợp 1: Đã có lịch thi đấu chính thức",
        status: "success",
        data: {
          co_lich: true,
          thoi_gian: "20h30 Thứ 6 ngày 02/10",
          san_bong: "Sân Đoan Môn",
          doi_thu: "FC Viettel",
          ghi_chu: "Anh em có mặt trước 15 phút khởi động",
          thong_bao:
            "Lịch thi đấu chính thức: 20h30 Thứ 6 ngày 02/10 tại Sân Đoan Môn. Đối thủ: FC Viettel. Ghi chú: Anh em có mặt trước 15 phút khởi động",
        },
      },
      {
        scenario: "Trường hợp 2: Chưa có lịch hoặc đã qua 22h tối thứ 6",
        status: "info",
        data: {
          co_lich: false,
          het_han: true,
          thong_bao:
            "Trận thi đấu thứ 6 vừa rồi đã kết thúc (sau 22h tối thứ 6). Hiện tại chưa có lịch thi đấu mới cho tuần tới, anh em chờ Sếp Đức Anh chốt lịch nhé!",
        },
      },
    ],
  },
  {
    name: "chot_lich_thi_dau",
    category: "schedule",
    permission: "duc_anh_only",
    summary: "Chốt lịch thi đấu tuần này (Chỉ Đức Anh)",
    description:
      "Chốt lịch thi đấu chính thức cho FC Đông Đô. Chỉ Đội trưởng Đức Anh (Facebook ID 100002974774231) mới có quyền thực thi. Lịch lưu vào DB và hiển thị trên Dashboard Tổng quan.",
    parameters: [
      { name: "thoi_gian", type: "string", required: true, description: "Thời gian đá (ví dụ: '20h30 Thứ 6 ngày 02/10')" },
      { name: "san_bong", type: "string", required: true, description: "Địa điểm / Sân bóng (ví dụ: 'Sân Đoan Môn')" },
      { name: "doi_thu", type: "string", required: false, description: "Tên đội đối thủ (ví dụ: 'FC Viettel')" },
      { name: "ghi_chu", type: "string", required: false, description: "Ghi chú thêm (khởi động sớm, bọc ống đồng...)" },
    ],
    sampleResponses: [
      {
        scenario: "Trường hợp 1: Đội trưởng Đức Anh chốt lịch",
        status: "success",
        data: {
          thanh_cong: true,
          thong_bao:
            "Đã chốt lịch thi đấu chính thức theo lệnh của Đội trưởng Đức Anh: 20h30 Thứ 6 ngày 02/10, tại Sân Đoan Môn. Đối thủ: FC Viettel. Ghi chú: Khởi động sớm. (Lịch sẽ tự động hết hạn sau 22h tối thứ 6).",
          lich_thi_dau: {
            thoi_gian: "20h30 Thứ 6 ngày 02/10",
            san_bong: "Sân Đoan Môn",
            doi_thu: "FC Viettel",
            ghi_chu: "Khởi động sớm",
            expiresAt: 1727449200000,
            updatedAt: "2026-09-26T17:00:00.000Z",
            updatedBy: "Đức Anh",
          },
        },
      },
      {
        scenario: "Trường hợp 2: Thành viên khác tự chốt (Bị từ chối)",
        status: "error",
        data: {
          status: "tu_choi",
          thong_bao:
            "Lệnh bị từ chối: Chỉ Đội trưởng Đức Anh mới có quyền chốt hoặc sửa lịch thi đấu cho đội! Để em báo cáo lại cho anh Đức Anh nhé.",
        },
      },
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
    sampleResponses: [
      {
        scenario: "Trường hợp 1: Đội trưởng Đức Anh hủy trận",
        status: "success",
        data: {
          thanh_cong: true,
          thong_bao: "Đã hủy lịch thi đấu hiện tại theo lệnh của Đội trưởng Đức Anh. Lý do: Mưa bão ngập sân.",
        },
      },
      {
        scenario: "Trường hợp 2: Người khác yêu cầu hủy (Bị từ chối)",
        status: "error",
        data: {
          status: "tu_choi",
          thong_bao:
            "Lệnh bị từ chối: Chỉ Đội trưởng Đức Anh mới có quyền hủy hoặc hoãn lịch thi đấu! Để em báo cáo lại cho anh Đức Anh nhé.",
        },
      },
    ],
  },

  // ==========================================
  // NHÓM 2: NHÂN SỰ & KÝ ỨC (7 KỸ NĂNG)
  // ==========================================
  {
    name: "danh_sach_thanh_vien",
    category: "roster",
    permission: "all_members",
    summary: "Lấy danh sách thành viên active kèm hồ sơ",
    description:
      "Lấy danh sách toàn bộ thành viên chính thức đang hoạt động kèm vị trí thi đấu, sở trường và vai trò.",
    parameters: [],
    sampleResponses: [
      {
        scenario: "Dữ liệu trả về cho AI",
        status: "success",
        data: {
          tong_so_thanh_vien_active: 14,
          danh_sach_thanh_vien: [
            "Andree Đinh (Hậu vệ cánh phải)",
            "Đặng Anh Minh (Tiền vệ trung tâm)",
            "Đức Anh (Đội trưởng - Tiền đạo cánh)",
            "Đức Thắng Nguyễn (Thủ môn)",
            "Hoa Xuân Trường (Tiền vệ tổ chức)",
            "Mạnh Cường (Hậu vệ thòng)",
            "Minh Đức Đào Công (Tiền đạo)",
            "Nam Nhật Vũ (Tiền vệ cánh)",
            "Nguyễn Tuấn Dương (Hậu vệ cánh trái)",
            "Nguyên Hùng (Hậu vệ)",
            "Nhan Doan (Tiền vệ)",
            "Tuan Minh (Tiền vệ phòng ngự)",
            "Tuấn Nam (Tiền đạo cắm)",
            "Tùng Phạm (Tiền đạo)",
          ],
        },
      },
    ],
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
    sampleResponses: [
      {
        scenario: "Dữ liệu trả về cho AI (Hồ sơ đầy đủ)",
        status: "success",
        data: {
          ten: "Tuấn Nam",
          ho_so_chinh_thuc: "Vị trí: Tiền đạo cắm, sở trường bứt tốc và sút xa",
          tinh_cach_soul: "Bỗ bã, thân mật, cà khịa duyên dáng, mê khoe sân cỏ, thích trêu bot",
          su_viec_3_ngay_qua: [
            "Tuấn Nam đính chính trận Test ghi 5 bàn",
            "Hứa khao bia nếu trận tới ghi hat-trick",
          ],
          so_tran_da: 12,
          so_tran_thang: 8,
          so_tran_hoa: 2,
          so_tran_thua: 2,
          tong_tien_da_dong: "1.200.000đ",
          tong_tien_con_no: "10.000đ (chưa bao gồm nước)",
          danh_sach_no: ["Trận Test (10.000đ)"],
          tong_ban_thang: 9,
          tong_kien_tao: 4,
        },
      },
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
      { name: "ho_so_moi", type: "string", required: true, description: "Thông tin hồ sơ chính thức cần lưu (ví dụ: 'Vị trí: Tiền đạo cắm, số áo 9')" },
    ],
    sampleResponses: [
      {
        scenario: "Trường hợp 1: Đội trưởng Đức Anh thiết lập",
        status: "success",
        data: {
          thanh_cong: true,
          thong_bao:
            'Đã cập nhật Hồ sơ Cá nhân cho Tuấn Nam: "Vị trí: Tiền đạo cắm, số áo 7, chuyên sút một chạm"',
        },
      },
      {
        scenario: "Trường hợp 2: Người khác yêu cầu (Bị từ chối)",
        status: "error",
        data: {
          status: "tu_choi",
          thong_bao:
            "Lệnh bị từ chối: Chỉ Đội trưởng Đức Anh mới có quyền thiết lập hoặc thay đổi Hồ sơ cá nhân (vị trí, vai trò, số áo...) của thành viên!",
        },
      },
    ],
  },
  {
    name: "ghi_nho_thong_tin",
    category: "roster",
    permission: "all_members",
    summary: "Ghi nhớ sự việc / kèo / lời hứa (hạn 3 ngày)",
    description:
      "Lưu lại sự việc phát sinh (hứa nộp tiền, đau chân, bận việc, khao nước...). Tự động lọc trùng ý và tự hủy sau 3 ngày.",
    parameters: [
      { name: "ten", type: "string", required: true, description: "Tên thành viên liên quan" },
      { name: "thong_tin", type: "string", required: true, description: "Nội dung ngắn gọn cần ghi nhớ (dưới 15 từ)" },
    ],
    sampleResponses: [
      {
        scenario: "Dữ liệu trả về cho AI",
        status: "success",
        data: {
          thanh_cong: true,
          thong_bao:
            'Đã ghi nhớ thành công sự việc cho Tuấn Nam: "Hứa thứ 6 chuyển 100k tiền quỹ" (hạn 3 ngày)',
        },
      },
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
    sampleResponses: [
      {
        scenario: "Dữ liệu trả về cho AI",
        status: "success",
        data: {
          thanh_vien: "Tuấn Nam",
          ho_so_chinh_thuc: "Vị trí: Tiền đạo cắm, sở trường bứt tốc",
          tinh_cach_soul: "Bỗ bã, thân mật, mê khoe sân cỏ, thích trêu bot",
          so_su_viec_3_ngay_qua: 2,
          danh_sach_su_viec_3_ngay: [
            "Tuấn Nam đính chính trận Test ghi 5 bàn",
            "Hứa thứ 6 tuần tới chuyển tiền quỹ",
          ],
        },
      },
    ],
  },
  {
    name: "cap_nhat_ky_uc",
    category: "roster",
    permission: "all_members",
    summary: "Đính chính / sửa ký ức sự việc cũ",
    description: "Cập nhật hoặc sửa lại một ký ức cũ của thành viên khi có thông tin mới đính chính hoặc thay đổi.",
    parameters: [
      { name: "ten", type: "string", required: true, description: "Tên thành viên" },
      { name: "tu_khoa_cu", type: "string", required: true, description: "Từ khóa hoặc nội dung ký ức cũ cần sửa" },
      { name: "thong_tin_moi", type: "string", required: true, description: "Nội dung mới chính xác cần cập nhật" },
    ],
    sampleResponses: [
      {
        scenario: "Dữ liệu trả về cho AI",
        status: "success",
        data: {
          thanh_cong: true,
          thong_bao:
            'Đã cập nhật ký ức của Tuấn Nam từ "đau gối nghỉ 1 tuần" thành "đã khỏi chân, sẵn sàng đá chính thứ 6 này"',
        },
      },
    ],
  },
  {
    name: "xoa_ky_uc",
    category: "roster",
    permission: "all_members",
    summary: "Xóa sự việc / hiểu lầm trong ký ức",
    description: "Xóa bỏ hoặc quên đi một ký ức khi không còn đúng (nhập 'tat_ca' để xóa toàn bộ).",
    parameters: [
      { name: "ten", type: "string", required: true, description: "Tên thành viên" },
      { name: "thong_tin_can_xoa", type: "string", required: true, description: "Từ khóa cần xóa hoặc 'tat_ca'" },
    ],
    sampleResponses: [
      {
        scenario: "Dữ liệu trả về cho AI",
        status: "success",
        data: {
          thanh_cong: true,
          thong_bao: 'Đã xóa 1 ký ức liên quan đến "đau gối" của Tuấn Nam',
        },
      },
    ],
  },

  // ==========================================
  // NHÓM 3: TÀI CHÍNH & THỐNG KÊ (4 KỸ NĂNG)
  // ==========================================
  {
    name: "cap_nhat_ban_thang_kien_tao",
    category: "finance",
    permission: "duc_anh_only",
    summary: "Ghi nhận Bàn thắng / Kiến tạo (Cần Đức Anh duyệt)",
    description:
      "Cập nhật số bàn thắng (goals) hoặc kiến tạo (assists) vào DB. Khi thành viên tự báo, tool chặn lại và yêu cầu bot hỏi anh @[Đức Anh] duyệt tự nhiên, tếu táo ngoài đời.",
    parameters: [
      { name: "ten_thanh_vien", type: "string", required: true, description: "Tên thành viên ghi bàn / kiến tạo" },
      { name: "so_ban_thang", type: "number", required: false, description: "Số bàn thắng ghi được" },
      { name: "so_kien_tao", type: "number", required: false, description: "Số kiến tạo ghi được" },
      { name: "ten_tran_dau", type: "string", required: false, description: "Tên trận đấu (mặc định lấy trận gần nhất)" },
    ],
    sampleResponses: [
      {
        scenario: "Trường hợp 1: Thành viên tự báo (Chặn DB & Mớm lời cho AI)",
        status: "warning",
        data: {
          status: "can_duc_anh_dong_y",
          thanh_vien: "Tuấn Nam",
          thanh_tich: "5 bàn",
          da_luu_db: false,
          huong_dan_cho_bot:
            "Thành viên Tuấn Nam tự báo ghi 5 bàn ở trận Test. CHƯA ĐƯỢC LƯU VÀO DB!\n" +
            "1. Trả lời cà khịa nhẹ nhàng với Tuấn Nam, sau đó quay sang hỏi anh @[Đức Anh] một cách TỰ NHIÊN, LINH HOẠT (TUYỆT ĐỐI KHÔNG lặp đi lặp lại cụm từ 'xác nhận').\n" +
            "Gợi ý các kiểu hỏi đời thường: có đúng không anh, check VAR, làm chứng, có uy tín không...\n" +
            "2. ĐẶC BIỆT (ĐÒI KÈO BẢNG TIN): Hãy đối chiếu ngay với [Bảng tin Sự việc & Kèo / Lời hứa 3 ngày qua của cả đội]. Nếu thành tích này (ví dụ ghi 3 bàn / hat-trick...) khớp với bất kỳ kèo treo thưởng hoặc lời hứa nào của ai đó (ví dụ ai hứa thưởng tiền khi ghi 3 bàn), hãy tiện mồm réo tên người đã hứa vào chuẩn bị ting ting / thực hiện kèo luôn cho xôm tụ!",
        },
      },
      {
        scenario: "Trường hợp 2: Đội trưởng Đức Anh xác nhận / duyệt",
        status: "success",
        data: {
          thanh_cong: true,
          thong_bao:
            'Đã cập nhật cho Tuấn Nam trong trận "Trận Test" (25/8/2026): 5 bàn thắng, 0 kiến tạo theo xác nhận của anh Đức Anh.',
        },
      },
    ],
  },
  {
    name: "bang_xep_hang",
    category: "finance",
    permission: "all_members",
    summary: "Bảng xếp hạng Top 5 (Bàn thắng, Kiến tạo, Ra sân, Đóng quỹ, Nợ)",
    description:
      "Xem bảng xếp hạng top 5 thành viên theo các tiêu chí: ghi bàn (ghi_ban), kiến tạo (kien_tao), ra sân nhiều nhất (ra_san), đóng tiền nhiều nhất (dong_tien), nợ tiền nhiều nhất (con_no).",
    parameters: [
      {
        name: "tieu_chi",
        type: "string",
        required: true,
        description: "Tiêu chí xếp hạng: 'ghi_ban' | 'kien_tao' | 'ra_san' | 'dong_tien' | 'con_no'",
      },
    ],
    sampleResponses: [
      {
        scenario: "Ví dụ: Top 5 Ghi bàn (ghi_ban)",
        status: "success",
        data: {
          tieu_chi: "ghi_ban",
          top_5: [
            { hang: 1, ten: "Tuấn Nam", gia_tri: "9 bàn" },
            { hang: 2, ten: "Đức Anh", gia_tri: "7 bàn" },
            { hang: 3, ten: "Tùng Phạm", gia_tri: "5 bàn" },
            { hang: 4, ten: "Minh Đức Đào Công", gia_tri: "4 bàn" },
            { hang: 5, ten: "Hoa Xuân Trường", gia_tri: "3 bàn" },
          ],
        },
      },
      {
        scenario: "Ví dụ: Top Nợ tiền quỹ (con_no)",
        status: "warning",
        data: {
          tieu_chi: "con_no",
          top_5: [
            { hang: 1, ten: "Tuấn Nam", gia_tri: "150.000đ" },
            { hang: 2, ten: "Mạnh Cường", gia_tri: "100.000đ" },
            { hang: 3, ten: "Nhan Doan", gia_tri: "50.000đ" },
          ],
        },
      },
    ],
  },
  {
    name: "tra_cuu_tran_dau",
    category: "finance",
    permission: "all_members",
    summary: "Tra cứu kết quả các trận đấu gần đây",
    description: "Tra cứu lịch sử các trận đấu bóng gần đây của đội (tỷ số, đối thủ, ngày đá, số người tham gia).",
    parameters: [
      { name: "tu_khoa", type: "string", required: false, description: "Tên đối thủ hoặc tên trận cần lọc" },
    ],
    sampleResponses: [
      {
        scenario: "Dữ liệu trả về cho AI",
        status: "success",
        data: {
          tong_so_tran: 2,
          danh_sach_tran: [
            {
              tieu_de: "FC Đông Đô vs FC Viettel",
              ngay_da: "18/09/2026",
              ty_so: "5 - 3",
              ket_qua: "Thắng",
              so_nguoi_di_da: 11,
            },
            {
              tieu_de: "Giao lưu Đoan Môn",
              ngay_da: "11/09/2026",
              ty_so: "4 - 4",
              ket_qua: "Hòa",
              so_nguoi_di_da: 10,
            },
          ],
        },
      },
    ],
  },
  {
    name: "thong_tin_quy",
    category: "finance",
    permission: "all_members",
    summary: "Xem tổng quan tài chính & ngân quỹ cả đội",
    description: "Xem tổng quan tài chính và hoạt động của cả đội FC Đông Đô (tổng thu, tổng nợ, tổng số kèo và số thành viên).",
    parameters: [],
    sampleResponses: [
      {
        scenario: "Dữ liệu trả về cho AI",
        status: "success",
        data: {
          tong_so_tran_va_keo: 14,
          tong_tien_quy_da_thu: "14.850.000đ",
          tong_tien_anh_em_con_no: "450.000đ",
          tong_so_thanh_vien: 14,
        },
      },
    ],
  },

  // ==========================================
  // NHÓM 4: TỰ ĐỘNG HÓA & LỊCH HẸN (2 KỸ NĂNG)
  // ==========================================
  {
    name: "dat_lich_nhac_nho",
    category: "automation",
    permission: "duc_anh_only",
    summary: "Hẹn giờ gửi tin nhắn vào nhóm qua Cron (Chỉ Đức Anh)",
    description:
      "Tạo lịch hẹn tự động trên hệ thống Hermes để gửi tin nhắn nhắc nhở vào nhóm Messenger đúng thời gian chỉ định (hỗ trợ tag @[Tên]).",
    parameters: [
      { name: "tieu_de", type: "string", required: true, description: "Tên ngắn gọn của lịch nhắc" },
      { name: "thoi_gian", type: "string", required: true, description: "Thời gian chạy ISO giờ VN hoặc tương đối (in 30m, in 1h)" },
      { name: "noi_dung_nhac_nho", type: "string", required: true, description: "Nội dung tin nhắn sẽ gửi vào nhóm khi đến giờ" },
    ],
    sampleResponses: [
      {
        scenario: "Trường hợp 1: Tạo lịch hẹn thành công",
        status: "success",
        data: {
          thanh_cong: true,
          job_id: "cron_1727438100",
          lich_chay: "2026-09-27T19:15:00+07:00",
          thong_bao:
            "Đã lên lịch thành công trên Hermes! Đến giờ (19:15 27/09/2026) bot sẽ tự động bắn tin nhắn vào nhóm.",
          noi_dung_se_gui: "Anh em tối nay mang áo xanh nhé @[Đức Anh]",
        },
      },
    ],
  },
  {
    name: "xem_lich_nhac_nho",
    category: "automation",
    permission: "all_members",
    summary: "Xem danh sách các lịch nhắc nhở đang chờ chạy",
    description: "Xem danh sách các lịch nhắc nhở / cron đang chờ kích hoạt trên hệ thống Hermes.",
    parameters: [],
    sampleResponses: [
      {
        scenario: "Dữ liệu trả về cho AI",
        status: "info",
        data: {
          danh_sach_cron: "1) cron_1727438100: [19:15 27/09] Nhắc áo xanh (Thread: Nhóm Test)",
        },
      },
    ],
  },
];

export function AiToolsViewer() {
  const [toolCategory, setToolCategory] = useState<string>("all");
  const [toolSearch, setToolSearch] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyJson = (data: any, key: string) => {
    const text = JSON.stringify(data, null, 2);
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
      });
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

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
              Tài chính & Thống kê (4)
            </button>
            <button
              type="button"
              className={`filter-chip ${toolCategory === "automation" ? "active" : ""}`}
              onClick={() => setToolCategory("automation")}
            >
              Hẹn giờ (2)
            </button>
          </div>
        </div>
      </div>

      <div className="ai-tools-count-info">
        Hiển thị <strong>{filteredTools.length}</strong> / {AI_TOOLS.length} kỹ năng (Kèm Response JSON đầy đủ cho Não AI)
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

            {/* Khối tham số đầu vào */}
            <div className="ai-tool-params">
              <span className="params-label">
                1. Tham số đầu vào ({tool.parameters.length}):
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

            {/* Khối Response Schema & Full JSON trả về cho LLM */}
            <div className="ai-tool-responses">
              <span className="params-label">
                2. Dữ liệu trả về mẫu cho AI (Response Payload):
              </span>
              <div className="responses-list">
                {tool.sampleResponses.map((sr, idx) => (
                  <div key={idx} className="sample-response-item">
                    <div className="sample-response-meta">
                      <span className={`sample-scenario-badge scenario-${sr.status}`}>
                        {sr.scenario}
                      </span>
                      <button
                        type="button"
                        className="btn-copy-json"
                        onClick={() => copyJson(sr.data, `${tool.name}-${idx}`)}
                        title="Sao chép JSON mẫu vào clipboard"
                      >
                        {copiedKey === `${tool.name}-${idx}` ? "✓ Đã chép" : "Sao chép JSON"}
                      </button>
                    </div>
                    <pre className="sample-json-code">
                      <code>{JSON.stringify(sr.data, null, 2)}</code>
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
