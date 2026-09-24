import assert from "node:assert/strict";
import {
  getCurrentMonthVn,
  getMonthDateRange,
  calculateDashboardMetrics,
} from "../lib/dashboard.ts";

console.log("==> Test 1: getCurrentMonthVn returns YYYY-MM");
const currentMonth = getCurrentMonthVn();
assert.match(currentMonth, /^\d{4}-\d{2}$/, "currentMonth must be YYYY-MM");

console.log("==> Test 2: getMonthDateRange produces correct boundaries in VN timezone");
const range = getMonthDateRange("2026-09");
assert.ok(range, "range should not be null for 2026-09");
assert.equal(range.start.toISOString(), new Date("2026-09-01T00:00:00+07:00").toISOString());
assert.equal(range.end.toISOString(), new Date("2026-10-01T00:00:00+07:00").toISOString());

const allRange = getMonthDateRange("all");
assert.equal(allRange, null, "all range should be null");

console.log("==> Test 3: calculateDashboardMetrics with empty sessions");
const emptyResult = calculateDashboardMetrics([], []);
assert.equal(emptyResult.kpi.totalAmount, 0);
assert.equal(emptyResult.kpi.totalPaid, 0);
assert.equal(emptyResult.kpi.outstanding, 0);
assert.equal(emptyResult.kpi.completionRate, 0);
assert.equal(emptyResult.chartSessions.length, 0);
assert.equal(emptyResult.chartTopMembers.length, 0);

console.log("==> Test 4: calculateDashboardMetrics with mock sessions & users");
const mockSessions = [
  {
    id: "s1",
    kind: "MATCH",
    title: "Trận 1",
    playedAt: new Date("2026-09-10T17:00:00Z"),
    members: [
      { userId: "u1", amountDue: 100000, amountPaid: 100000, goals: 2, assists: 1 },
      { userId: "u2", amountDue: 100000, amountPaid: 50000, goals: 0, assists: 0 },
    ],
  },
  {
    id: "s2",
    kind: "GENERAL",
    title: "Tiền áo",
    playedAt: new Date("2026-09-15T17:00:00Z"),
    members: [
      { userId: "u1", amountDue: 200000, amountPaid: 200000, goals: 0, assists: 0 },
      { userId: "u2", amountDue: 200000, amountPaid: 0, goals: 0, assists: 0 },
    ],
  },
];
const mockUsers = [
  { id: "u1", name: "Nguyễn Văn A", avatarKey: null },
  { id: "u2", name: "Trần Văn B", avatarKey: "abc" },
  { id: "u3", name: "Lê Văn C", avatarKey: null },
];

const mockResult = calculateDashboardMetrics(mockSessions, mockUsers);

// KPI checks
assert.equal(mockResult.kpi.totalAmount, 600000); // (100+100) + (200+200)
assert.equal(mockResult.kpi.totalPaid, 350000);   // (100+50) + (200+0)
assert.equal(mockResult.kpi.outstanding, 250000); // 600k - 350k
assert.equal(mockResult.kpi.matchCount, 1);
assert.equal(mockResult.kpi.otherCount, 1);
assert.equal(mockResult.kpi.completionRate, 58.3); // (350000 / 600000) * 100 = 58.33% -> 58.3%

// Chart checks
assert.equal(mockResult.chartSessions.length, 2);
assert.equal(mockResult.chartSessions[0].name, "Trận 1");
assert.equal(mockResult.chartSessions[0].amountDue, 200000);
assert.equal(mockResult.chartSessions[0].amountPaid, 150000);

// Top member checks
assert.equal(mockResult.chartTopMembers.length, 2); // u1 and u2 (u3 has 0 appearances)
assert.equal(mockResult.chartTopMembers[0].name, "Nguyễn Văn A");
assert.equal(mockResult.chartTopMembers[0].appearances, 1);
assert.equal(mockResult.chartTopMembers[0].goals, 2);

// Member rows checks
assert.equal(mockResult.memberRows.length, 3);
// u2 has 250k debt, should be first
assert.equal(mockResult.memberRows[0].id, "u2");
assert.equal(mockResult.memberRows[0].outstanding, 250000);
assert.equal(mockResult.memberRows[0].status, "DEBT");
// u1 has 0 debt, should be second
assert.equal(mockResult.memberRows[1].id, "u1");
assert.equal(mockResult.memberRows[1].outstanding, 0);
assert.equal(mockResult.memberRows[1].status, "COMPLETED");

console.log("All dashboard metric tests PASSED!");
