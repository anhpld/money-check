"use client";

import { useState, useTransition } from "react";
import { saveSubsystemPrompt, resetSubsystemPrompt } from "@/app/admin/settings/actions";
import { LLM_SETTING_KEYS, DEFAULT_SUBSYSTEM_PROMPTS } from "@/lib/app-settings";

interface SubsystemPromptDef {
  id: string;
  settingKey: string;
  name: string;
  tag: string;
  description: string;
  trigger: string;
  outputFormat: string;
  defaultPrompt: string;
}

const PROMPT_DEFINITIONS: SubsystemPromptDef[] = [
  {
    id: "direct_memory",
    settingKey: LLM_SETTING_KEYS.promptDirectMemory,
    name: "Trích xuất Ký ức & Cá tính Trực tiếp (Direct Turn Extraction)",
    tag: "Realtime",
    description:
      "Tự động kích hoạt ngay sau mỗi tin nhắn mà thành viên chat với bot. Trích xuất đồng thời 2 tầng: Nét tính cách dài hạn (Soul) và Sự việc / Lời hứa ngắn hạn (hạn 3 ngày).",
    trigger: "Người dùng gửi tin nhắn trò chuyện hoặc tương tác trong nhóm.",
    outputFormat: `JSON: { "personality": "string | null", "event": "string | null" }`,
    defaultPrompt: DEFAULT_SUBSYSTEM_PROMPTS.directMemory,
  },
  {
    id: "batch_memory",
    settingKey: LLM_SETTING_KEYS.promptBatchMemory,
    name: "Quét ngầm Hội thoại 20 Tin nhắn Nhóm (Batch Group Chat Extraction)",
    tag: "Batch 20 tin",
    description:
      "Tự động chạy ngầm mỗi khi nhóm trao đổi đủ 20 tin nhắn. Đọc hiểu toàn bộ ngữ cảnh đối thoại để phát hiện các sự việc, kèo bóng, lời hứa hẹn hoặc biến đổi tính cách mà không cần thành viên phải tag bot.",
    trigger: "Bộ đệm tin nhắn tích lũy đủ 20 tin nhắn mới nhất trong nhóm.",
    outputFormat: `JSON: { "souls": [{ name, personality }], "episodes": [{ name, fact }] }`,
    defaultPrompt: DEFAULT_SUBSYSTEM_PROMPTS.batchMemory,
  },
  {
    id: "soul_condensation",
    settingKey: LLM_SETTING_KEYS.promptSoulCondensation,
    name: "Cô đọng & Tinh gọn Tính cách (Soul Condensation)",
    tag: "Tối ưu Soul",
    description:
      "Cơ chế tự động chống phình to dữ liệu (Context Bloat). Khi chuỗi tính cách tự học của một người vượt quá 100 ký tự, AI sẽ đúc kết lại thành DUY NHẤT 1 câu súc tích dưới 20 từ, giữ lại các phẩm chất nổi bật nhất.",
    trigger: "Chuỗi tính cách (currentSoul + newPersonality) vượt quá 100 ký tự.",
    outputFormat: `Chuỗi văn bản thuần túy (dưới 20 từ)`,
    defaultPrompt: DEFAULT_SUBSYSTEM_PROMPTS.soulCondensation,
  },
  {
    id: "relevant_events",
    settingKey: LLM_SETTING_KEYS.promptRelevantEvents,
    name: "Lọc Sự kiện Liên quan Realtime (Relevant Events Pre-filter)",
    tag: "Semantic Filter",
    description:
      "Tiền xử lý siêu nhanh trước khi gọi Não AI chính. Tự động đối chiếu câu chat với kho sự việc 3 ngày của cả đội bằng JSON Mode (response_format: json_object) để chọn ra tối đa 3 sự việc liên quan nhất.",
    trigger: "Mỗi khi thành viên nhắn tin và kho sự việc cả đội có từ 1 sự việc trở lên.",
    outputFormat: `JSON Mode: { "events": string[] } (response_format: json_object)`,
    defaultPrompt: DEFAULT_SUBSYSTEM_PROMPTS.relevantEvents,
  },
  {
    id: "dynamic_context",
    settingKey: LLM_SETTING_KEYS.promptDynamicContext,
    name: "Cấu trúc Ghép nối Ngữ cảnh Realtime (Dynamic Context Pipeline)",
    tag: "Realtime Context",
    description:
      "Khi bất kỳ thành viên nào nhắn tin, hệ thống tự động tổng hợp 4 tầng thông tin (Danh tính, Công nợ cá nhân, Hồ sơ & Soul người nói, Sự kiện liên quan) ghép vào thẻ 'system' trước khi gọi Luna 5.6.",
    trigger: "Mỗi lượt xử lý tin nhắn của bot Vũ Quang Bình.",
    outputFormat: `Hợp nhất vào role 'system' gửi đến AI`,
    defaultPrompt: DEFAULT_SUBSYSTEM_PROMPTS.dynamicContext,
  },
];

function HighlightedPrompt({ text }: { text: string }) {
  // Tách text theo cú pháp biến {variable}
  const parts = text.split(/(\{[a-zA-Z0-9_.]+\})/g);
  return (
    <>
      {parts.map((part, index) => {
        if (/^\{[a-zA-Z0-9_.]+\}$/.test(part)) {
          return (
            <span key={index} className="prompt-variable-token">
              {part}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

export function AiPromptsEditor({
  initialPrompts,
}: {
  initialPrompts: Record<string, string>;
}) {
  const [prompts, setPrompts] = useState<Record<string, string>>(initialPrompts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({
    direct_memory: true,
    batch_memory: false,
    soul_condensation: false,
    dynamic_context: false,
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string; isError?: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCopy = async (id: string, text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (_) {}
  };

  const startEdit = (def: SubsystemPromptDef) => {
    setEditingId(def.id);
    setEditText(prompts[def.settingKey] || def.defaultPrompt);
    setExpandedIds((prev) => ({ ...prev, [def.id]: true }));
    setMessage(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
    setMessage(null);
  };

  const handleSave = (def: SubsystemPromptDef) => {
    startTransition(async () => {
      const res = await saveSubsystemPrompt(def.settingKey, editText);
      if (res.status === "success") {
        setPrompts((prev) => ({ ...prev, [def.settingKey]: editText }));
        setEditingId(null);
        setMessage({ id: def.id, text: "Đã lưu prompt thành công ✓" });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ id: def.id, text: res.message, isError: true });
      }
    });
  };

  const handleReset = (def: SubsystemPromptDef) => {
    if (!confirm(`Bạn có chắc chắn muốn khôi phục prompt "${def.name}" về mẫu chuẩn mặc định?`)) {
      return;
    }
    startTransition(async () => {
      const res = await resetSubsystemPrompt(def.settingKey);
      if (res.status === "success") {
        setPrompts((prev) => ({ ...prev, [def.settingKey]: def.defaultPrompt }));
        if (editingId === def.id) {
          setEditText(def.defaultPrompt);
        }
        setMessage({ id: def.id, text: "Đã khôi phục về mẫu chuẩn ✓" });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ id: def.id, text: res.message, isError: true });
      }
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="ai-prompts-editor-container">
      <div className="ai-prompts-intro-bar">
        <div>
          <h3>Kho Prompt Tự học & Cơ chế Chạy ngầm</h3>
          <p>
            Bạn có thể <strong>xem, chỉnh sửa và khôi phục</strong> từng System Prompt mà bot Vũ Quang Bình sử dụng khi tự học tính cách (Soul) và sự việc 3 ngày qua.
          </p>
        </div>
      </div>

      <div className="ai-prompts-grid">
        {PROMPT_DEFINITIONS.map((def) => {
          const currentPrompt = prompts[def.settingKey] || def.defaultPrompt;
          const isEditing = editingId === def.id;
          const isExpanded = expandedIds[def.id] ?? false;
          const isCustomized = Boolean(prompts[def.settingKey] && prompts[def.settingKey] !== def.defaultPrompt);

          return (
            <div key={def.id} className={`panel ai-prompt-card ${isEditing ? "is-editing" : ""}`}>
              <div className="ai-prompt-card-head">
                <div>
                  <div className="ai-prompt-badge-row">
                    <span className="badge-tag">{def.tag}</span>
                    {isCustomized ? (
                      <span className="badge-customized" title="Prompt đã được chỉnh sửa theo nhu cầu riêng">
                        Đã tùy chỉnh
                      </span>
                    ) : (
                      <span className="badge-default-template" title="Đang dùng mẫu chuẩn gốc của hệ thống">
                        Mẫu chuẩn
                      </span>
                    )}
                  </div>
                  <h3>{def.name}</h3>
                  <p className="ai-prompt-desc">{def.description}</p>
                </div>

                <div className="ai-prompt-actions-row">
                  {!isEditing ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => startEdit(def)}
                      >
                        ✏️ Chỉnh sửa
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm ai-copy-btn"
                        onClick={() => handleCopy(def.id, currentPrompt)}
                      >
                        {copiedId === def.id ? "Đã chép ✓" : "Sao chép"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => toggleExpand(def.id)}
                      >
                        {isExpanded ? "Thu gọn ▲" : "Xem thêm ▼"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={cancelEdit}
                        disabled={isPending}
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        className="prompt-reset-link btn-sm"
                        onClick={() => handleReset(def)}
                        disabled={isPending}
                        title="Khôi phục lại nội dung prompt gốc"
                      >
                        Khôi phục mẫu chuẩn
                      </button>
                      <button
                        type="button"
                        className="primary-button btn-sm"
                        onClick={() => handleSave(def)}
                        disabled={isPending}
                      >
                        {isPending ? "Đang lưu..." : "Lưu thay đổi"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {message?.id === def.id && (
                <div className={`ai-prompt-feedback ${message.isError ? "error" : "success"}`}>
                  {message.text}
                </div>
              )}

              <div className="ai-prompt-meta-grid">
                <div>
                  <span className="meta-label">Điều kiện kích hoạt:</span>
                  <span className="meta-val">{def.trigger}</span>
                </div>
                <div>
                  <span className="meta-label">Định dạng kết quả:</span>
                  <code className="meta-code">{def.outputFormat}</code>
                </div>
              </div>

              <div className="ai-prompt-body">
                <div className="ai-prompt-body-header">
                  <span className="ai-prompt-body-label">
                    {isEditing ? "NỘI DUNG PROMPT ĐANG CHỈNH SỬA:" : "NỘI DUNG PROMPT GỬI CHO LLM:"}
                  </span>
                  {!isEditing && (
                    <small className="ai-prompt-token-hint">
                      Các biến <span className="prompt-variable-token">{"{biến}"}</span> được tô màu nổi bật
                    </small>
                  )}
                </div>

                {isEditing ? (
                  <div className="ai-prompt-editor-wrap">
                    <textarea
                      className="plain-input ai-prompt-textarea"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={14}
                      disabled={isPending}
                    />
                    <small className="editor-sub-note">
                      Lưu ý: Giữ đúng tên các biến động trong dấu ngoặc nhọn <code>{"{tên_biến}"}</code> để hệ thống tự động điền dữ liệu lúc thực thi.
                    </small>
                  </div>
                ) : (
                  <pre className={`ai-prompt-pre ${isExpanded ? "expanded" : "collapsed"}`}>
                    <code>
                      <HighlightedPrompt text={currentPrompt} />
                    </code>
                  </pre>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
