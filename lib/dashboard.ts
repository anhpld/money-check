import { getPrisma } from "./prisma";

export interface DashboardKpi {
  totalAmount: number;
  totalPaid: number;
  outstanding: number;
  completionRate: number;
  matchCount: number;
  otherCount: number;
  totalMembersActive: number;
}

export interface SessionChartItem {
  id: string;
  name: string;
  date: string;
  amountDue: number;
  amountPaid: number;
  outstanding: number;
  completionRate: number;
}

export interface TopMemberChartItem {
  name: string;
  appearances: number;
  goals: number;
  assists: number;
  contributions: number;
}

export interface MemberSummaryRow {
  id: string;
  name: string;
  avatarKey: string | null;
  appearances: number;
  goals: number;
  assists: number;
  contributions: number;
  amountDue: number;
  amountPaid: number;
  outstanding: number;
  status: "COMPLETED" | "DEBT";
}

export interface MonthOption {
  key: string;
  label: string;
}

export interface DashboardData {
  selectedMonth: string;
  availableMonths: MonthOption[];
  kpi: DashboardKpi;
  chartSessions: SessionChartItem[];
  chartTopMembers: TopMemberChartItem[];
  memberRows: MemberSummaryRow[];
}

export function getCurrentMonthVn(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  }).format(new Date()); // Returns "YYYY-MM"
  return parts;
}

export function formatMonthLabel(monthKey: string): string {
  if (monthKey === "all") return "Tất cả thời gian";
  const [year, month] = monthKey.split("-");
  return `Tháng ${month}/${year}`;
}

export function getMonthDateRange(monthKey?: string | null): { start: Date; end: Date } | null {
  if (!monthKey || monthKey === "all" || !/^\d{4}-\d{2}$/.test(monthKey)) {
    return null;
  }

  const [yearStr, monthStr] = monthKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-based

  // Calculate start date: YYYY-MM-01 00:00:00 UTC+7
  const start = new Date(Date.UTC(year, month - 1, 1, -7, 0, 0, 0));

  // Calculate next month:
  const nextMonthYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = new Date(Date.UTC(nextMonthYear, nextMonth - 1, 1, -7, 0, 0, 0));

  return { start, end };
}

export function calculateDashboardMetrics(
  sessions: Array<{
    id: string;
    kind: string;
    title: string;
    playedAt: Date;
    opponent?: { name: string } | null;
    members: Array<{
      userId: string;
      amountDue: number;
      amountPaid: number;
      goals: number;
      assists: number;
    }>;
  }>,
  users: Array<{
    id: string;
    name: string;
    avatarKey: string | null;
  }>,
): {
  kpi: DashboardKpi;
  chartSessions: SessionChartItem[];
  chartTopMembers: TopMemberChartItem[];
  memberRows: MemberSummaryRow[];
} {
  let totalAmount = 0;
  let totalPaid = 0;
  let matchCount = 0;
  let otherCount = 0;

  // Map user stats
  const userStatsMap = new Map<
    string,
    {
      appearances: number;
      goals: number;
      assists: number;
      amountDue: number;
      amountPaid: number;
    }
  >();

  for (const user of users) {
    userStatsMap.set(user.id, {
      appearances: 0,
      goals: 0,
      assists: 0,
      amountDue: 0,
      amountPaid: 0,
    });
  }

  // Sort sessions chronologically for chart display
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime(),
  );

  const chartSessions: SessionChartItem[] = [];

  for (const session of sortedSessions) {
    if (session.kind === "MATCH") {
      matchCount++;
    } else {
      otherCount++;
    }

    const sessionDue = session.members.reduce((s, m) => s + m.amountDue, 0);
    const sessionPaid = session.members.reduce((s, m) => s + m.amountPaid, 0);
    const sessionOutstanding = Math.max(sessionDue - sessionPaid, 0);

    totalAmount += sessionDue;
    totalPaid += sessionPaid;

    const playedAtDate = new Date(session.playedAt);
    const dateFormatted = new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(playedAtDate);

    const sessionCompletion = sessionDue > 0 ? Math.round((sessionPaid / sessionDue) * 1000) / 10 : 100;

    chartSessions.push({
      id: session.id,
      name: session.title,
      date: dateFormatted,
      amountDue: sessionDue,
      amountPaid: sessionPaid,
      outstanding: sessionOutstanding,
      completionRate: sessionCompletion,
    });

    for (const member of session.members) {
      let stats = userStatsMap.get(member.userId);
      if (!stats) {
        stats = {
          appearances: 0,
          goals: 0,
          assists: 0,
          amountDue: 0,
          amountPaid: 0,
        };
        userStatsMap.set(member.userId, stats);
      }

      if (session.kind === "MATCH") {
        stats.appearances += 1;
        stats.goals += member.goals || 0;
        stats.assists += member.assists || 0;
      }
      stats.amountDue += member.amountDue || 0;
      stats.amountPaid += member.amountPaid || 0;
    }
  }

  const outstanding = Math.max(totalAmount - totalPaid, 0);
  const completionRate = totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 1000) / 10 : 0;

  // Build member rows
  const memberRows: MemberSummaryRow[] = [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  for (const [userId, stats] of userStatsMap.entries()) {
    const user = userMap.get(userId);
    const name = user?.name ?? "Thành viên";
    const avatarKey = user?.avatarKey ?? null;
    const memberOutstanding = Math.max(stats.amountDue - stats.amountPaid, 0);
    const contributions = stats.goals + stats.assists;

    memberRows.push({
      id: userId,
      name,
      avatarKey,
      appearances: stats.appearances,
      goals: stats.goals,
      assists: stats.assists,
      contributions,
      amountDue: stats.amountDue,
      amountPaid: stats.amountPaid,
      outstanding: memberOutstanding,
      status: memberOutstanding <= 0 ? "COMPLETED" : "DEBT",
    });
  }

  // Sort member rows:
  // 1. Outstanding debt descending (những người nợ nhiều nhất lên đầu)
  // 2. Appearances descending
  // 3. Contributions descending
  // 4. Name ascending
  memberRows.sort((a, b) => {
    if (b.outstanding !== a.outstanding) {
      return b.outstanding - a.outstanding;
    }
    if (b.appearances !== a.appearances) {
      return b.appearances - a.appearances;
    }
    if (b.contributions !== a.contributions) {
      return b.contributions - a.contributions;
    }
    return a.name.localeCompare(b.name, "vi");
  });

  // Top members for chart:
  // Filter members who have appearances > 0, sort by appearances & contributions, take top 8
  const chartTopMembers: TopMemberChartItem[] = [...memberRows]
    .filter((m) => m.appearances > 0)
    .sort((a, b) => {
      if (b.appearances !== a.appearances) return b.appearances - a.appearances;
      if (b.contributions !== a.contributions) return b.contributions - a.contributions;
      if (b.goals !== a.goals) return b.goals - a.goals;
      return a.name.localeCompare(b.name, "vi");
    })
    .slice(0, 8)
    .map((m) => ({
      name: m.name,
      appearances: m.appearances,
      goals: m.goals,
      assists: m.assists,
      contributions: m.contributions,
    }));

  const activeMembersCount = memberRows.filter(
    (m) => m.appearances > 0 || m.amountDue > 0,
  ).length;

  return {
    kpi: {
      totalAmount,
      totalPaid,
      outstanding,
      completionRate,
      matchCount,
      otherCount,
      totalMembersActive: activeMembersCount,
    },
    chartSessions,
    chartTopMembers,
    memberRows,
  };
}

export async function getDashboardData(selectedMonthParam?: string): Promise<DashboardData> {
  const prisma = getPrisma();
  const currentMonth = getCurrentMonthVn();
  const selectedMonth = selectedMonthParam?.trim() || currentMonth;

  // 1. Fetch all distinct session dates to build month options
  const allSessionsPlayedAt = await prisma.footballSession.findMany({
    where: { deletedAt: null },
    select: { playedAt: true },
    orderBy: { playedAt: "desc" },
  });

  const monthSet = new Set<string>();
  monthSet.add(currentMonth);

  for (const item of allSessionsPlayedAt) {
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
    }).format(new Date(item.playedAt));
    monthSet.add(key);
  }

  const sortedMonthKeys = Array.from(monthSet).sort((a, b) => b.localeCompare(a));
  const availableMonths: MonthOption[] = [
    ...sortedMonthKeys.map((key) => ({
      key,
      label: formatMonthLabel(key),
    })),
    { key: "all", label: "Tất cả thời gian" },
  ];

  // 2. Build where filter for selected month
  const range = getMonthDateRange(selectedMonth);
  const sessionWhere: {
    deletedAt: null;
    playedAt?: { gte: Date; lt: Date };
  } = {
    deletedAt: null,
  };

  if (range) {
    sessionWhere.playedAt = {
      gte: range.start,
      lt: range.end,
    };
  }

  // 3. Fetch sessions and users in parallel
  const [sessions, users] = await Promise.all([
    prisma.footballSession.findMany({
      where: sessionWhere,
      orderBy: { playedAt: "asc" },
      include: {
        opponent: { select: { name: true } },
        members: {
          select: {
            userId: true,
            amountDue: true,
            amountPaid: true,
            goals: true,
            assists: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        avatarKey: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const metrics = calculateDashboardMetrics(sessions, users);

  return {
    selectedMonth,
    availableMonths,
    kpi: metrics.kpi,
    chartSessions: metrics.chartSessions,
    chartTopMembers: metrics.chartTopMembers,
    memberRows: metrics.memberRows,
  };
}
