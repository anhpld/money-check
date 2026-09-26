"use client";

import { useState, type ReactNode } from "react";
import { AiPromptsEditor } from "@/app/admin/ai/ai-prompts-editor";
import { AiToolsViewer } from "@/app/admin/ai/ai-tools-viewer";

export function AiTabsContainer({
  llmConfigForm,
  subsystemPrompts,
}: {
  llmConfigForm: ReactNode;
  subsystemPrompts: Record<string, string>;
}) {
  const [activeTab, setActiveTab] = useState<"config" | "prompts" | "tools">("config");

  return (
    <div className="ai-tabs-container">
      {/* Top-level Segmented Tabs */}
      <nav className="ai-segmented-tabs" aria-label="Phân hệ Trợ lý AI">
        <button
          type="button"
          className={`ai-segment-btn ${activeTab === "config" ? "active" : ""}`}
          onClick={() => setActiveTab("config")}
        >
          <span className="ai-segment-icon">⚙️</span>
          <span className="ai-segment-text">Cấu hình & Prompt cốt lõi</span>
        </button>

        <button
          type="button"
          className={`ai-segment-btn ${activeTab === "prompts" ? "active" : ""}`}
          onClick={() => setActiveTab("prompts")}
        >
          <span className="ai-segment-icon">🧠</span>
          <span className="ai-segment-text">Kho Prompt Ký ức & Tự học</span>
          <span className="ai-segment-badge">4</span>
        </button>

        <button
          type="button"
          className={`ai-segment-btn ${activeTab === "tools" ? "active" : ""}`}
          onClick={() => setActiveTab("tools")}
        >
          <span className="ai-segment-icon">⚡</span>
          <span className="ai-segment-text">15 Kỹ năng AI (Tools)</span>
          <span className="ai-segment-badge">15</span>
        </button>
      </nav>

      {/* Tab Panels */}
      <div className="ai-tab-panel-body">
        {activeTab === "config" && (
          <div className="ai-tab-pane">
            <section className="panel settings-integration-panel ai-config-panel">
              {llmConfigForm}
            </section>
          </div>
        )}

        {activeTab === "prompts" && (
          <div className="ai-tab-pane">
            <AiPromptsEditor initialPrompts={subsystemPrompts} />
          </div>
        )}

        {activeTab === "tools" && (
          <div className="ai-tab-pane">
            <AiToolsViewer />
          </div>
        )}
      </div>
    </div>
  );
}
