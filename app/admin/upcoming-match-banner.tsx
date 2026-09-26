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
        // Cập nhật lại UI tạm thời
        setSchedule({
          hasSchedule: true,
          data: {
            thoi_gian: (formData.get("thoi_gian") as string) || "",
            san_bong: (formData.get("san_bong") as string) || "",
            doi_thu: (formData.get("doi_thu") as string) || "Đang chờ chốt đối thủ",
            mau_ao: (formData.get("mau_ao") as string) || "Áo cam truyền thống",
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
    if (!window.confirm("Sếp có chắc chắn muốn hủy lịch thi đấu này không? Bot sẽ không báo lịch này nữa.")) {
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
          <div className="panel match-banner-active">
            <div className="match-banner-header">
              <div className="match-badge-group">
                <span className="match-tag-icon">⚽</span>
                <span className="match-tag-title">LỊCH THI ĐẤU CHÍNH THỨC</span>
                <span className="badge badge-success">Đang hiệu lực</span>
                <span className="badge badge-info">Bot Vũ Quang Bình quản lý</span>
              </div>
              <div className="match-banner-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleOpenModal}
                  disabled={isPending}
                >
                  ✏️ Chỉnh sửa
                </button>
                <button
                  type="button"
                  className="btn btn-ghost-danger btn-sm"
                  onClick={handleCancelMatch}
                  disabled={isPending}
                >
                  ❌ Hủy lịch
                </button>
              </div>
            </div>

            <div className="match-banner-body">
              <div className="match-key-detail">
                <div className="match-detail-item">
                  <span className="match-detail-icon">🕒</span>
                  <div>
                    <small>Thời gian</small>
                    <strong>{matchData.thoi_gian}</strong>
                  </div>
                </div>

                <div className="match-detail-item">
                  <span className="match-detail-icon">📍</span>
                  <div>
                    <small>Sân bóng</small>
                    <strong>{matchData.san_bong}</strong>
                  </div>
                </div>

                <div className="match-detail-item">
                  <span className="match-detail-icon">⚔️</span>
                  <div>
                    <small>Đối thủ</small>
                    <strong>{matchData.doi_thu || "Chưa có"}</strong>
                  </div>
                </div>

                <div className="match-detail-item">
                  <span className="match-detail-icon">👕</span>
                  <div>
                    <small>Trang phục</small>
                    <strong className="text-highlight">{matchData.mau_ao || "Áo cam"}</strong>
                  </div>
                </div>
              </div>

              {matchData.ghi_chu && (
                <div className="match-note-box">
                  <span className="match-note-icon">📝</span>
                  <span>{matchData.ghi_chu}</span>
                </div>
              )}
            </div>

            <div className="match-banner-footer">
              <span className="match-footer-tip">
                ⏳ Lịch này sẽ tự động xóa sau <strong>22:00 tối Thứ 6 ({formatExpiryTime(matchData.expiresAt)})</strong>.
              </span>
              <span className="match-footer-author">
                Cập nhật bởi: <strong>{matchData.updatedBy || "Đức Anh"}</strong>
              </span>
            </div>
          </div>
        ) : (
          <div className="panel match-banner-empty">
            <div className="match-empty-left">
              <span className="match-empty-icon">⚽</span>
              <div>
                <strong>Lịch thi đấu tuần này: Chưa có lịch mới</strong>
                <p>
                  Đội trưởng Đức Anh có thể tag <code>@Vũ Quang Bình</code> trong nhóm Messenger để chốt lịch nhanh, hoặc bấm nút bên cạnh để tạo trực tiếp.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleOpenModal}
              disabled={isPending}
            >
              + Chốt lịch thi đấu
            </button>
          </div>
        )}
      </section>

      {/* Modal Chốt / Sửa lịch thi đấu */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={handleCloseModal}>
          <div
            className="modal-box match-schedule-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <h3>{schedule.hasSchedule ? "✏️ Chỉnh sửa lịch thi đấu" : "⚽ Chốt lịch thi đấu mới"}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={handleCloseModal}
                aria-label="Đóng modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {errorMsg && <div className="notice-banner is-error">{errorMsg}</div>}

                <div className="form-group">
                  <label htmlFor="thoi_gian">
                    Thời gian thi đấu <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    id="thoi_gian"
                    name="thoi_gian"
                    required
                    defaultValue={matchData?.thoi_gian || "Thứ 6 tuần này lúc 20h30"}
                    placeholder="VD: Thứ 6 ngày 02/10 lúc 20h30"
                    className="input-text"
                  />
                  <small className="field-hint">Khung giờ đá bóng của đội (ví dụ: Thứ 6 20h30, 20h45...)</small>
                </div>

                <div className="form-group">
                  <label htmlFor="san_bong">
                    Sân bóng / Địa điểm <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    id="san_bong"
                    name="san_bong"
                    required
                    defaultValue={matchData?.san_bong || "Sân Đoan Môn"}
                    placeholder="VD: Sân Đoan Môn, Sân Đầm Hồng..."
                    className="input-text"
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="doi_thu">Đội đối thủ</label>
                    <input
                      type="text"
                      id="doi_thu"
                      name="doi_thu"
                      defaultValue={matchData?.doi_thu || "FC Viettel"}
                      placeholder="VD: FC Viettel, FC Lord..."
                      className="input-text"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="mau_ao">Màu áo trang phục</label>
                    <input
                      type="text"
                      id="mau_ao"
                      name="mau_ao"
                      defaultValue={matchData?.mau_ao || "Áo cam truyền thống"}
                      placeholder="VD: Áo cam, Áo trắng..."
                      className="input-text"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="ghi_chu">Ghi chú dặn dò anh em</label>
                  <input
                    type="text"
                    id="ghi_chu"
                    name="ghi_chu"
                    defaultValue={matchData?.ghi_chu || "Anh em có mặt trước 15 phút khởi động"}
                    placeholder="VD: Có mặt trước 15 phút, đá sân 7..."
                    className="input-text"
                  />
                </div>

                <div className="notice-info-box">
                  💡 <strong>Quy tắc tự động:</strong> Lịch này sẽ được bot Vũ Quang Bình dùng để trả lời khi bất kỳ ai trong đội hỏi và sẽ <strong>tự động xóa sau 22h00 tối Thứ 6</strong>.
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
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
          </div>
        </div>
      )}
    </>
  );
}
