"use client";

import { useState, useTransition } from "react";
import {
  UpcomingMatchState,
  updateUpcomingMatchSchedule,
  cancelUpcomingMatchSchedule,
} from "./schedule-actions";

type Props = {
  initialSchedule: UpcomingMatchState;
};

export function UpcomingMatchBanner({ initialSchedule }: Props) {
  const [schedule, setSchedule] = useState(initialSchedule);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState("");

  const matchData = schedule.data;

  const handleOpenModal = () => {
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setErrorMsg("");
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await updateUpcomingMatchSchedule(formData);
      if (res.success) {
        setIsModalOpen(false);
        setSchedule({
          hasSchedule: true,
          data: {
            thoi_gian: (formData.get("thoi_gian") as string) || "",
            san_bong: (formData.get("san_bong") as string) || "",
            doi_thu: (formData.get("doi_thu") as string) || "Đang chờ chốt đối thủ",
            ghi_chu: (formData.get("ghi_chu") as string) || "",
            expiresAt: Date.now() + 86400000,
            updatedAt: new Date().toISOString(),
            updatedBy: "Đức Anh (Admin Web)",
          },
        });
      } else {
        setErrorMsg(res.error || "Lỗi khi lưu lịch.");
      }
    });
  };

  const handleCancelMatch = () => {
    if (!window.confirm("Xác nhận hủy lịch thi đấu này? Bot sẽ không báo lịch này nữa.")) {
      return;
    }

    startTransition(async () => {
      const res = await cancelUpcomingMatchSchedule();
      if (res.success) {
        setSchedule({ hasSchedule: false, data: null });
      } else {
        alert(res.error || "Không thể hủy lịch.");
      }
    });
  };

  const formatExpiryTime = (ms?: number) => {
    if (!ms) return "";
    return new Date(ms).toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    });
  };

  return (
    <>
      <section className="upcoming-match-section" aria-label="Lịch thi đấu tuần này">
        {schedule.hasSchedule && matchData ? (
          <div className="panel match-clean-card">
            <div className="match-clean-header">
              <div className="match-clean-heading">
                <span className="match-clean-tag">LỊCH THI ĐẤU</span>
                <span className="status-badge badge-active">Chính thức</span>
                <span className="match-clean-expiry">
                  Tự động xóa sau 22:00 thứ 6 ({formatExpiryTime(matchData.expiresAt)})
                </span>
              </div>
              <div className="match-clean-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleOpenModal}
                  disabled={isPending}
                >
                  Chỉnh sửa
                </button>
                <button
                  type="button"
                  className="btn btn-danger-outline btn-sm"
                  onClick={handleCancelMatch}
                  disabled={isPending}
                >
                  Hủy lịch
                </button>
              </div>
            </div>

            <div className="match-clean-grid">
              <div className="match-clean-col">
                <span className="match-clean-label">Thời gian</span>
                <strong className="match-clean-val">{matchData.thoi_gian}</strong>
              </div>

              <div className="match-clean-col">
                <span className="match-clean-label">Sân thi đấu</span>
                <strong className="match-clean-val">{matchData.san_bong}</strong>
              </div>

              <div className="match-clean-col">
                <span className="match-clean-label">Đối thủ</span>
                <strong className="match-clean-val">{matchData.doi_thu || "Chưa có"}</strong>
              </div>
            </div>

            {matchData.ghi_chu && (
              <div className="match-clean-note">
                <span className="match-clean-note-label">Ghi chú:</span>
                <span>{matchData.ghi_chu}</span>
              </div>
            )}

            <div className="match-clean-footer">
              <span>Cập nhật bởi: {matchData.updatedBy || "Đức Anh"}</span>
            </div>
          </div>
        ) : (
          <div className="panel match-clean-empty">
            <div className="match-empty-text">
              <strong>Lịch thi đấu: Chưa có lịch mới</strong>
              <p>
                Tag bot Vũ Quang Bình trong nhóm Messenger để chốt lịch, hoặc bấm nút bên cạnh để tạo trực tiếp.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleOpenModal}
              disabled={isPending}
            >
              + Tạo lịch thi đấu
            </button>
          </div>
        )}
      </section>

      {/* Modal Chốt / Sửa lịch thi đấu - Sử dụng dialog-backdrop chuẩn của hệ thống */}
      {isModalOpen && (
        <div
          className="dialog-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isPending) handleCloseModal();
          }}
        >
          <section
            className="dialog-card match-schedule-dialog"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="dialog-heading without-icon">
              <div className="match-dialog-top">
                <h2>{schedule.hasSchedule ? "Chỉnh sửa lịch thi đấu" : "Tạo lịch thi đấu mới"}</h2>
                <button
                  type="button"
                  className="collection-kind-dialog-close"
                  onClick={handleCloseModal}
                  aria-label="Đóng"
                >
                  ✕
                </button>
              </div>
              <p>
                Lịch thi đấu sẽ được hiển thị trên web và bot Vũ Quang Bình sẽ dùng để trả lời anh em khi hỏi.
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="match-dialog-form">
                {errorMsg && <div className="notice-banner is-error">{errorMsg}</div>}

                <div className="field-block">
                  <label htmlFor="thoi_gian">
                    Thời gian thi đấu <span className="text-danger">*</span>
                  </label>
                  <input
                    id="thoi_gian"
                    name="thoi_gian"
                    type="text"
                    required
                    defaultValue={matchData?.thoi_gian || ""}
                    placeholder="VD: Thứ 6 ngày 02/10 lúc 20h30"
                    className="input-text"
                  />
                </div>

                <div className="field-block">
                  <label htmlFor="san_bong">
                    Sân bóng <span className="text-danger">*</span>
                  </label>
                  <input
                    id="san_bong"
                    name="san_bong"
                    type="text"
                    required
                    defaultValue={matchData?.san_bong || ""}
                    placeholder="VD: Sân Đoan Môn (Số 1 Phan Đình Phùng)"
                    className="input-text"
                  />
                </div>

                <div className="field-block">
                  <label htmlFor="doi_thu">Đội đối thủ</label>
                  <input
                    id="doi_thu"
                    name="doi_thu"
                    type="text"
                    defaultValue={matchData?.doi_thu || ""}
                    placeholder="VD: FC Viettel"
                    className="input-text"
                  />
                </div>

                <div className="field-block">
                  <label htmlFor="ghi_chu">Ghi chú thêm</label>
                  <textarea
                    id="ghi_chu"
                    name="ghi_chu"
                    rows={2}
                    defaultValue={matchData?.ghi_chu || ""}
                    placeholder="VD: Có mặt trước 15 phút khởi động, mang đủ bọc ống đồng"
                    className="input-text"
                    style={{ resize: "vertical" }}
                  />
                </div>

                <div className="match-dialog-notice">
                  Lịch này sẽ tự động xóa sau 22h00 tối thứ 6 hàng tuần theo quy định của đội.
                </div>
              </div>

              <div className="dialog-actions-right">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCloseModal}
                  disabled={isPending}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isPending}
                >
                  {isPending ? "Đang lưu..." : "Lưu lịch thi đấu"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
