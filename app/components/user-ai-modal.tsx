"use client";

import { useState, useTransition } from "react";
import { addUserMemory, deleteUserMemory, updateUserPersona, type UserActionResult } from "@/app/actions";
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
  const [persona, setPersona] = useState(user.personaPrompt || "");
  const [memories, setMemories] = useState(user.memories || []);
  const [newFact, setNewFact] = useState("");
  const [localFeedback, setLocalFeedback] = useState<{ status: string; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function showFeedback(status: string, message: string) {
    setLocalFeedback({ status, message });
    setTimeout(() => setLocalFeedback(null), 3500);
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
              <span className="user-ai-badge">🧠 HỒ SƠ AI & KÝ ỨC</span>
              <button type="button" className="modal-close-icon" onClick={onClose} aria-label="Đóng">✕</button>
            </div>
            <h2>{user.name}</h2>
            <p>
              Định hình thái độ của bot Vũ Quang Bình khi đối đáp với <strong>{user.name}</strong> và quản lý ký ức đã tự học.
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
          {/* Section 1: Persona */}
          <div className="ai-section">
            <div className="ai-section-title">
              <strong>Thái độ của Bot đối với {user.name}</strong>
              <small>Chỉ định cách bot xưng hô, giọng điệu và thái độ riêng.</small>
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
              className="plain-input persona-textarea"
              rows={3}
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              placeholder="Ví dụ: Gọi là Sếp, nịnh bợ, hay trêu đùa về kèo bia sau trận..."
              disabled={isPending}
            />

            <div className="ai-section-actions">
              <button
                type="button"
                className="primary-button btn-save-persona"
                onClick={handleSavePersona}
                disabled={isPending}
              >
                {isPending ? "Đang lưu..." : "Lưu thái độ"}
              </button>
            </div>
          </div>

          {/* Section 2: Memories */}
          <div className="ai-section">
            <div className="ai-section-title">
              <strong>Ký ức bot đã tự học ({memories.length})</strong>
              <small>
                Tự động ghi nhớ từ các tin nhắn chat trong nhóm (lời hứa, chấn thương, thói quen...).
              </small>
            </div>

            <div className="memory-add-row">
              <input
                type="text"
                className="plain-input memory-input"
                placeholder="Thêm ghi nhớ thủ công (ví dụ: Hay đau gối, sở trường tiền đạo...)"
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
                memories.map((m) => (
                  <div key={m.id} className="memory-item">
                    <div className="memory-content">
                      <span className="memory-bullet">•</span>
                      <p>{m.fact}</p>
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
                ))
              ) : (
                <div className="memory-empty">
                  <em>Chưa có ký ức nào được ghi nhận. Bot sẽ tự học khi thành viên này chat trong nhóm!</em>
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
