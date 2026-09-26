import { AdminShell } from "@/app/components/admin-shell";
import { UserAvatar } from "@/app/components/user-avatar";
import { MonthSelector } from "@/app/admin/month-selector";
import { OverviewCharts } from "@/app/admin/overview-charts";
import { getDashboardData } from "@/lib/dashboard";
import { formatVnd } from "@/lib/money";
import { getUpcomingMatchSchedule } from "./schedule-actions";
import { UpcomingMatchBanner } from "./upcoming-match-banner";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const [data, upcomingSchedule] = await Promise.all([
    getDashboardData(month),
    getUpcomingMatchSchedule(),
  ]);

  return (
    <AdminShell active="overview">
      <div className="page-content overview-page">
        {/* Header với bộ lọc tháng */}
        <header className="page-heading overview-heading">
          <div>
            <p className="eyebrow">BẢNG ĐIỀU KHIỂN</p>
            <h1>Tổng quan hoạt động & tài chính</h1>
            <p>Theo dõi dòng tiền thu nợ và phong độ thi đấu của các thành viên.</p>
          </div>
          <MonthSelector
            selectedMonth={data.selectedMonth}
            availableMonths={data.availableMonths}
          />
        </header>

        {/* Lịch thi đấu tuần này do Bot Vũ Quang Bình & Đội trưởng quản lý */}
        <UpcomingMatchBanner initialSchedule={upcomingSchedule} />

        {/* 4 Thẻ KPI chính */}
        <section className="dashboard-kpi-grid" aria-label="Chỉ số tổng quan">
          <div className="panel kpi-card">
            <div className="kpi-icon-wrap kpi-blue">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Tổng phát sinh</span>
              <strong className="kpi-value">{formatVnd(data.kpi.totalAmount)}</strong>
              <small className="kpi-sub">
                {data.kpi.matchCount} trận đấu · {data.kpi.otherCount} khoản khác
              </small>
            </div>
          </div>

          <div className="panel kpi-card">
            <div className="kpi-icon-wrap kpi-green">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m5 13 4 4L19 7" />
              </svg>
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Thực thu</span>
              <strong className="kpi-value text-success">{formatVnd(data.kpi.totalPaid)}</strong>
              <small className="kpi-sub">Đã nộp vào quỹ</small>
            </div>
          </div>

          <div className="panel kpi-card">
            <div className="kpi-icon-wrap kpi-amber">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Còn thiếu (Nợ đọng)</span>
              <strong className={`kpi-value ${data.kpi.outstanding > 0 ? "text-error" : ""}`}>
                {formatVnd(data.kpi.outstanding)}
              </strong>
              <small className="kpi-sub">
                {data.kpi.outstanding > 0 ? "Cần nhắc nhở thanh toán" : "Đã thu đủ 100%"}
              </small>
            </div>
          </div>

          <div className="panel kpi-card">
            <div className="kpi-icon-wrap kpi-purple">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Tỷ lệ thu tiền</span>
              <strong className="kpi-value">{data.kpi.completionRate}%</strong>
              <div className="kpi-progress-bar">
                <span
                  style={{ width: `${Math.min(data.kpi.completionRate, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Khối Biểu đồ Recharts */}
        <OverviewCharts
          chartSessions={data.chartSessions}
          chartTopMembers={data.chartTopMembers}
        />

        {/* Bảng Chi tiết từng thành viên */}
        <section className="panel overview-member-section">
          <div className="overview-member-head">
            <div>
              <h2>Chi tiết thành viên</h2>
              <p>Thống kê số trận ra sân, số tiền đã bỏ ra và số tiền còn nợ trong kỳ.</p>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th>Thành viên</th>
                  <th className="text-center">Ra sân</th>
                  <th className="text-right">Đã đóng</th>
                  <th className="text-right">Còn nợ</th>
                  <th className="text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {data.memberRows.map((member, index) => (
                  <tr key={member.id} className={member.outstanding > 0 ? "row-has-debt" : undefined}>
                    <td>{index + 1}</td>
                    <td>
                      <div className="table-user">
                        <UserAvatar
                          name={member.name}
                          avatarKey={member.avatarKey}
                          className="user-avatar"
                          toneIndex={index}
                        />
                        <strong>{member.name}</strong>
                      </div>
                    </td>
                    <td className="text-center">
                      <strong>{member.appearances}</strong> trận
                    </td>
                    <td className="text-right text-success font-semibold">
                      {formatVnd(member.amountPaid)}
                    </td>
                    <td className="text-right">
                      <strong className={member.outstanding > 0 ? "text-debt" : "text-muted"}>
                        {formatVnd(member.outstanding)}
                      </strong>
                    </td>
                    <td className="text-center">
                      {member.outstanding > 0 ? (
                        <span className="status-badge badge-debt">Còn nợ</span>
                      ) : member.amountPaid > 0 ? (
                        <span className="status-badge badge-paid">Đã thanh toán</span>
                      ) : (
                        <span className="status-badge badge-neutral">Không nợ</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!data.memberRows.length ? (
            <div className="transaction-empty">
              <h2>Chưa có dữ liệu thành viên</h2>
              <p>Dữ liệu sẽ xuất hiện khi có thành viên trong hệ thống.</p>
            </div>
          ) : null}
        </section>
      </div>
    </AdminShell>
  );
}
