"use client";

import { useActionState, useState } from "react";
import {
  saveDebtReminderSchedule,
  type SaveDebtReminderScheduleResult,
} from "@/app/admin/settings/actions";

type ReminderRun = {
  id: string;
  scheduledFor: string;
  status: "RUNNING" | "SENT" | "SKIPPED" | "FAILED";
  debtorCount: number;
  error: string | null;
};

type Props = {
  configured: boolean;
  enabled: boolean;
  days: number[];
  times: string[];
  nextRunAt: string | null;
  recentRuns: ReminderRun[];
};

const dayOptions = [
  { value: 1, label: "T2" },
  { value: 2, label: "T3" },
  { value: 3, label: "T4" },
  { value: 4, label: "T5" },
  { value: 5, label: "T6" },
  { value: 6, label: "T7" },
  { value: 7, label: "CN" },
];

const initialState: SaveDebtReminderScheduleResult = { status: "idle", message: "" };

function formatRunTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function runStatusLabel(status: ReminderRun["status"]) {
  if (status === "SENT") return "Đã gửi";
  if (status === "SKIPPED") return "Đã bỏ qua";
  if (status === "FAILED") return "Thất bại";
  return "Đang chạy";
}

export function DebtReminderScheduleForm({ configured, enabled, days, times: initialTimes, nextRunAt, recentRuns }: Props) {
  const [state, formAction, pending] = useActionState(saveDebtReminderSchedule, initialState);
  const [times, setTimes] = useState(initialTimes);
  const [newTime, setNewTime] = useState("20:00");
  const [timeError, setTimeError] = useState("");

  function addTime() {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(newTime)) {
      setTimeError("Giờ gửi không hợp lệ.");
      return;
    }
    if (times.includes(newTime)) {
      setTimeError("Khung giờ này đã tồn tại.");
      return;
    }
    if (times.length >= 6) {
      setTimeError("Chỉ được cấu hình tối đa 6 khung giờ mỗi ngày.");
      return;
    }
    setTimes((current) => [...current, newTime].sort());
    setTimeError("");
  }

  return (
    <section className="panel settings-debt-reminder-panel">
      <form action={formAction}>
        <div className="settings-integration-head">
          <div>
            <span className="settings-section-label">Tự động hóa</span>
            <h2>Nhắc nợ tự động</h2>
            <p>Gửi danh sách công nợ theo nhiều ngày và nhiều khung giờ trong ngày.</p>
          </div>
          <label className="settings-toggle">
            <input name="enabled" type="checkbox" defaultChecked={enabled} disabled={pending} />
            <i aria-hidden="true" />
            <span>Bật tự động</span>
          </label>
        </div>

        {!configured ? <div className="reminder-config-warning">Cần bật và cấu hình đầy đủ Messenger trước khi bật lịch tự động.</div> : null}

        <div className="reminder-schedule-grid">
          <fieldset className="reminder-days" disabled={pending}>
            <legend>Ngày gửi</legend>
            <div>
              {dayOptions.map((day) => (
                <label key={day.value}>
                  <input name="days" type="checkbox" value={day.value} defaultChecked={days.includes(day.value)} />
                  <span>{day.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="reminder-timezone">
            <span>Múi giờ</span>
            <strong>GMT+7</strong>
            <small>Asia/Ho_Chi_Minh</small>
          </div>
        </div>

        <div className="reminder-times-section">
          <div className="reminder-times-heading">
            <div><strong>Các giờ gửi trong ngày</strong><small>Tối đa 6 khung giờ, áp dụng cho tất cả ngày đã chọn.</small></div>
            <div className="reminder-time-adder">
              <input type="time" value={newTime} onChange={(event) => setNewTime(event.target.value)} disabled={pending} aria-label="Giờ gửi mới" />
              <button className="secondary-button" type="button" onClick={addTime} disabled={pending}>+ Thêm giờ</button>
            </div>
          </div>
          <div className="reminder-time-list">
            {times.map((time) => (
              <span key={time}>{time}<button type="button" aria-label={`Xóa giờ ${time}`} disabled={pending} onClick={() => setTimes((current) => current.filter((item) => item !== time))}>×</button><input name="times" type="hidden" value={time} /></span>
            ))}
            {!times.length ? <em>Chưa có giờ gửi nào.</em> : null}
          </div>
          {timeError ? <p className="reminder-time-error" role="alert">{timeError}</p> : null}
        </div>

        <div className="reminder-schedule-summary">
          <div><span>Lần chạy tiếp theo</span><strong>{nextRunAt ? formatRunTime(nextRunAt) : enabled ? "Chưa xác định" : "Lịch đang tắt"}</strong></div>
          <div><span>Quy tắc gửi</span><strong>Chỉ gửi khi có người còn nợ</strong></div>
        </div>

        <div className="settings-form-footer reminder-save-footer">
          {state.message ? <div className={`settings-form-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</div> : <span />}
          <button className="primary-button settings-save-button" type="submit" disabled={pending}>
            {pending ? <span className="spinner" aria-hidden="true" /> : null}
            {pending ? "Đang lưu..." : "Lưu lịch"}
          </button>
        </div>
      </form>

      <div className="reminder-run-history">
        <div><h3>Lịch sử chạy gần nhất</h3><p>Mỗi mốc lịch chỉ được xử lý một lần, kể cả khi có nhiều tiến trình cùng kiểm tra.</p></div>
        <div className="reminder-run-list">
          {recentRuns.map((run) => (
            <div key={run.id}>
              <i className={run.status.toLowerCase()} />
              <span><strong>{formatRunTime(run.scheduledFor)}</strong><small>{run.error || (run.status === "SENT" ? `${run.debtorCount} người còn nợ` : run.status === "SKIPPED" ? "Không có công nợ" : "Đang xử lý")}</small></span>
              <b className={run.status.toLowerCase()}>{runStatusLabel(run.status)}</b>
            </div>
          ))}
          {!recentRuns.length ? <div className="reminder-run-empty">Chưa có lần chạy tự động nào.</div> : null}
        </div>
      </div>
    </section>
  );
}
