"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { formatVnd } from "@/lib/money";
import type { SessionChartItem, TopMemberChartItem } from "@/lib/dashboard";

interface OverviewChartsProps {
  chartSessions: SessionChartItem[];
  chartTopMembers: TopMemberChartItem[];
}

function SessionCustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const data: SessionChartItem = payload[0].payload;
  return (
    <div className="custom-chart-tooltip">
      <div className="tooltip-header">
        <strong>{data.name}</strong>
        <span>Ngày {data.date}</span>
      </div>
      <div className="tooltip-body">
        <div className="tooltip-row">
          <span className="dot dot-due" />
          <span>Cần thu:</span>
          <strong>{formatVnd(data.amountDue)}</strong>
        </div>
        <div className="tooltip-row">
          <span className="dot dot-paid" />
          <span>Đã thu:</span>
          <strong>{formatVnd(data.amountPaid)}</strong>
        </div>
        <div className="tooltip-row">
          <span className="dot dot-debt" />
          <span>Còn thiếu:</span>
          <strong className={data.outstanding > 0 ? "text-error" : ""}>
            {formatVnd(data.outstanding)}
          </strong>
        </div>
        <div className="tooltip-divider" />
        <div className="tooltip-row">
          <span>Tiến độ thu:</span>
          <strong>{data.completionRate}%</strong>
        </div>
      </div>
    </div>
  );
}

function MemberCustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const data: TopMemberChartItem = payload[0].payload;
  return (
    <div className="custom-chart-tooltip">
      <div className="tooltip-header">
        <strong>{data.name}</strong>
      </div>
      <div className="tooltip-body">
        <div className="tooltip-row">
          <span className="dot dot-apps" />
          <span>Số trận ra sân:</span>
          <strong>{data.appearances} trận</strong>
        </div>
        <div className="tooltip-row">
          <span className="dot dot-goals" />
          <span>Bàn thắng:</span>
          <strong>{data.goals}</strong>
        </div>
        <div className="tooltip-row">
          <span className="dot dot-assists" />
          <span>Kiến tạo:</span>
          <strong>{data.assists}</strong>
        </div>
        <div className="tooltip-divider" />
        <div className="tooltip-row">
          <span>Tổng đóng góp (G+A):</span>
          <strong>{data.contributions}</strong>
        </div>
      </div>
    </div>
  );
}

export function OverviewCharts({ chartSessions, chartTopMembers }: OverviewChartsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="dashboard-charts-grid">
      {/* Biểu đồ 1: Tiến độ thu tiền từng khoản thu */}
      <section className="panel dashboard-chart-card">
        <div className="chart-card-head">
          <div>
            <h3>Tiến độ thu tiền theo đợt</h3>
            <p>So sánh số tiền cần thu và thực tế đã nộp của từng trận / khoản thu</p>
          </div>
        </div>

        <div className="chart-wrapper">
          {!mounted ? (
            <div className="chart-skeleton">Đang tải biểu đồ...</div>
          ) : chartSessions.length === 0 ? (
            <div className="chart-empty">
              <span>📊</span>
              <p>Chưa có khoản thu hoặc trận đấu nào trong thời gian này.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={chartSessions}
                margin={{ top: 20, right: 20, left: 10, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e9e7" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#5d6965" }}
                  interval={0}
                  tickFormatter={(val: string) =>
                    val.length > 12 ? `${val.slice(0, 10)}…` : val
                  }
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#5d6965" }}
                  tickFormatter={(value) =>
                    value >= 1_000_000
                      ? `${(value / 1_000_000).toFixed(1)}Tr`
                      : value >= 1_000
                      ? `${Math.round(value / 1_000)}k`
                      : String(value)
                  }
                />
                <Tooltip content={<SessionCustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: 12, fontSize: 12 }}
                />
                <Bar
                  dataKey="amountDue"
                  name="Cần thu"
                  fill="#94a3b8"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={45}
                />
                <Bar
                  dataKey="amountPaid"
                  name="Đã thu"
                  fill="#12624c"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={45}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Biểu đồ 2: Top thành viên ra sân & đóng góp */}
      <section className="panel dashboard-chart-card">
        <div className="chart-card-head">
          <div>
            <h3>Top thành viên tích cực</h3>
            <p>Xếp hạng thành viên tham gia nhiều trận và đóng góp bàn thắng / kiến tạo</p>
          </div>
        </div>

        <div className="chart-wrapper">
          {!mounted ? (
            <div className="chart-skeleton">Đang tải biểu đồ...</div>
          ) : chartTopMembers.length === 0 ? (
            <div className="chart-empty">
              <span>⚽</span>
              <p>Chưa có dữ liệu trận đấu và thành viên tham gia trong thời gian này.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart
                layout="vertical"
                data={chartTopMembers}
                margin={{ top: 20, right: 25, left: 15, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e9e7" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "#5d6965" }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#2d3733", fontWeight: 550 }}
                  width={90}
                />
                <Tooltip content={<MemberCustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: 12, fontSize: 12 }}
                />
                <Bar
                  dataKey="appearances"
                  name="Trận ra sân"
                  fill="#12624c"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={16}
                />
                <Bar
                  dataKey="goals"
                  name="Bàn thắng"
                  fill="#2563eb"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={16}
                />
                <Bar
                  dataKey="assists"
                  name="Kiến tạo"
                  fill="#10b981"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={16}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </div>
  );
}
