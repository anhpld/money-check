"use client";

import { useState, useTransition } from "react";
import {
  addUserMemory,
  deleteUserMemory,
  updateUserPersona,
  updateUserProfile,
  type UserActionResult,
} from "@/app/actions";
import { type UserItem } from "@/app/components/users-manager";

const PERSONA_SUGGESTIONS = [
  {
    label: "Nịnh bợ / Chủ tịch",
    prompt:
      "Gọi là 'Sếp' hoặc 'Chủ tịch', thái độ cung kính, nịnh nọt nhưng thi thoảng vẫn lươn lẹo đá xoáy nhẹ.",
  },
  {
    label: "Cà khịa / Chúa nợ",
    prompt:
      "Thái độ cà khịa cực mạnh, hễ ngoi lên là dí đòi nợ tận mặt, chêm chửi tục thân mật (vcl, đm), không cho khất nợ.",
  },
  {
    label: "Chân sút vàng",
    prompt:
      "Khen ngợi chân sút vàng của đội, động viên ghi bàn nhưng tiền sân thì sòng phẳng dứt khoát không thiếu một hào.",
  },
  {
    label: "Anh em phủi bỗ bã",
    prompt:
      "Xưng hô anh em hoặc mày tao bỗ bã, ăn nói sỗ sàng tự nhiên chuẩn phong cách phủi sân cỏ.",
  },
  {
    label: "Người mới / Lịch sự",
    prompt:
      "Thái độ nhẹ nhàng, hướng dẫn nhiệt tình, lịch sự và giữ hình tượng trước khi quen thân.",
  },
];

export function UserAiModal({
  user,
  onClose,
}: {
  user: UserItem;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState(user.profile || "");
  const [persona, setPersona] = useState(user.personaPrompt || "");
  const [memories, setMemories] = useState(user.memories || []);
  const [newFact, setNewFact] = useState("");
  const [localFeedback, setLocalFeedback] = useState<{ status: string; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function showFeedback(status: string, message: string) {
    setLocalFeedback({ status, message });
    setTimeout(() => setLocalFeedback(null), 3500);
  }

  function handleSaveProfile() {
    startTransition(async () => {
      const res = await updateUserProfile(user.id, profile);
      showFeedback(res.status, res.message);
    });
  }

  function handleSavePersona() {
    startTransition(async () => {
      const res = await updateUserPersona(user.id, persona);
      showFeedback(res.status, res.message);
    });
  }

  function handleAddMemory() {
    if (!newFact.trim()) return;
    const factText = newFact.trim();
    startTransition(async () => {
      const res = await addUserMemory(user.id, factText);
      if (res.status === "success") {
        setMemories([
          { id: Date.now().toString(), fact: factText, createdAt: new Date() },
          ...memories,
        ]);
        setNewFact("");
      }
      showFeedback(res.status, res.message);
    });
  }

  function handleDeleteMemory(id: string) {
    startTransition(async () => {
      const res = await deleteUserMemory(id);
      if (res.status === "success") {
        setMemories(memories.filter((m) => m.id !== id));
      }
      showFeedback(res.status, res.message);
    });
  }

  function getMemoryStatus(createdAt: Date | string) {
    const diffHours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 3600);
    if (diffHours <= 72) {
      const remainHours = Math.max(1, Math.round(72 - diffHours));
      return { active: true, text: `Còn ${remainHours}h` };
    }
    return { active: false, text: "Đã hết hạn (>3 ngày)" };
  }

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
    >
      <section className="dialog-card user-ai-modal" role="dialog" aria-modal="true">
        <div className="dialog-heading">
          <div className="user-ai-modal-header">
            <div className="modal-header-top">
              <span className="user-ai-badge">🧠 HỒ SƠ AI & BỘ NHỚ 3 TẦNG</span>
              <button type="button" className="modal-close-icon" onClick={onClose} aria-label="Đóng">✕</button>
            </div>
            <h2>{user.name}</h2>
            <p>
              Hồ sơ cá nhân chính thống (user.md), tính cách giao tiếp (soul.md) và ký ức ngắn hạn 3 ngày.
            </p>
          </div>
          {localFeedback ? (
            <div className={`user-ai-toast ${localFeedback.status}`}>
              <span>{localFeedback.status === "success" ? "✓" : "!"}</span>
              {localFeedback.message}
            </div>
          ) : null}
        </div>

        <div className="user-ai-modal-body">
          {/* TẦNG 1: USER PROFILE (CHÍNH THỐNG - CHỈ ĐỨC ANH SỬA HOẶC ADMIN) */}
          <div className="ai-section">
            <div className="ai-section-title">
              <div className="ai-title-row">
                <strong>1. Hồ sơ Cá nhân (User Profile - Chính thức)</strong>
                <span className="ai-tag-badge official">👑 Do Đội trưởng Đức Anh set</span>
              </div>
              <small>
                Vị trí thi đấu, sở trường, số áo, vai trò trong đội... Chỉ Anh Đức Anh mới có quyền ra lệnh cho bot thay đổi (bắt buộc tag bot).
              </small>
            </div>

            <textarea
              className="plain-input persona-textarea"
              rows={2}
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              placeholder="Ví dụ: Vị trí: Tiền đạo cắm, sở trường sút xa, số áo 9, đội phó..."
              disabled={isPending}
            />

            <div className="ai-section-actions">
              <button
                type="button"
                className="primary-button btn-save-persona"
                onClick={handleSaveProfile}
                disabled={isPending}
              >
                {isPending ? "Đang lưu..." : "Lưu Hồ sơ"}
              </button>
            </div>
          </div>

          {/* TẦNG 2: SOUL (TÍNH CÁCH & PHONG CÁCH GIAO TIẾP - LÂU DÀI, TỰ TIẾN HÓA) */}
          <div className="ai-section">
            <div className="ai-section-title">
              <div className="ai-title-row">
                <strong>2. Tính cách & Phong cách giao tiếp (Soul - Lâu dài)</strong>
                <span className="ai-tag-badge soul">✨ Tự học ngầm + Tag</span>
              </div>
              <small>
                Định hình tính nết của {user.name} để bot đối đáp (học từ tag bot và 20 tin gần nhất, lưu lâu dài).
              </small>
            </div>

            <div className="persona-chips">
              {PERSONA_SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="persona-chip"
                  onClick={() => setPersona(s.prompt)}
                  disabled={isPending}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <textarea
              className="persona-textarea"
              rows={2}
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              placeholder="Ví dụ: Thích cà khịa, hay nói nhiều, hay chém gió về kèo bóng..."
              disabled={isPending}
            />

            <div className="ai-section-actions">
              <button
                type="button"
                className="primary-button btn-save-persona"
                onClick={handleSavePersona}
                disabled={isPending}
              >
                {isPending ? "Đang lưu..." : "Lưu Tính cách (Soul)"}
              </button>
            </div>
          </div>

          {/* TẦNG 3: KÝ ỨC SỰ VIỆC & LỜI HỨA (HẠN 3 NGÀY) */}
          <div className="ai-section">
            <div className="ai-section-title">
              <div className="ai-title-row">
                <strong>3. Ký ức Sự việc & Lời hứa ({memories.length})</strong>
                <span className="ai-tag-badge temp">⏳ Hạn 3 ngày</span>
              </div>
              <small>
                Trích xuất sự việc nhất thời, lời hứa suông (bận việc, đau chân, hẹn nộp tiền...). Tự động hết hạn sau 3 ngày.
              </small>
            </div>

            <div className="memory-add-row">
              <input
                type="text"
                className="plain-input memory-input"
                placeholder="Thêm sự việc thủ công (ví dụ: Vừa đi công tác về, hẹn thứ 6 bắn quỹ...)"
                value={newFact}
                onChange={(e) => setNewFact(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddMemory();
                  }
                }}
                disabled={isPending}
              />
              <button
                type="button"
                className="secondary-button btn-add-memory"
                onClick={handleAddMemory}
                disabled={isPending || !newFact.trim()}
              >
                + Thêm
              </button>
            </div>

            <div className="memory-list">
              {memories.length > 0 ? (
                memories.map((m) => {
                  const status = getMemoryStatus(m.createdAt);
                  return (
                    <div key={m.id} className={`memory-item ${!status.active ? "expired" : ""}`}>
                      <div className="memory-content">
                        <span className="memory-bullet">•</span>
                        <div className="memory-text-wrap">
                          <p>{m.fact}</p>
                          <span className={`memory-time-badge ${status.active ? "active" : "expired"}`}>
                            {status.text}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="memory-delete-btn"
                        title="Xóa ký ức này"
                        onClick={() => handleDeleteMemory(m.id)}
                        disabled={isPending}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="memory-empty">
                  <em>Chưa có sự việc nào trong 3 ngày qua. Bot sẽ tự ghi nhớ khi có trao đổi trong nhóm!</em>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="dialog-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={isPending}
          >
            Đóng
          </button>
        </div>
      </section>
    </div>
  );
}
