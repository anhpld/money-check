"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { UserAvatar } from "@/app/components/user-avatar";
import { deleteCollection, markMemberPaidManually, saveCollection } from "@/app/collections/actions";
import type {
  CollectionChargeOption,
  CollectionEditorData,
  CollectionOpponent,
  CollectionUser,
  PaidBreakdown,
} from "@/app/collections/types";
import {
  allocateBySlots,
  formatMoneyInput,
  formatVnd,
  parseMoneyInput,
  roundUpToOneThousand,
} from "@/lib/money";
import { getPaidBreakdownTotal } from "@/lib/payment-totals";

function sanitizeStatInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 3).replace(/^0+(?=\d)/, "");
}

export function CollectionEditor({
  users,
  opponents,
  initial,
  initialKind = "MATCH",
}: {
  users: CollectionUser[];
  opponents: CollectionOpponent[];
  initial?: CollectionEditorData;
  initialKind?: "MATCH" | "GENERAL";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");

  const kind: "MATCH" | "GENERAL" = initial?.kind ?? initialKind;
  const isMatch = kind === "MATCH";

  // Tab: "members" (Thành viên & Thu tiền) or "settings" (Thông tin & Cài đặt)
  const [activeTab, setActiveTab] = useState<"members" | "settings">(
    initial?.status === "PUBLISHED" ? "members" : "settings",
  );

  // Search & Filter in Members tab
  const [memberSearch, setMemberSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState<"all" | "debt" | "paid">("all");
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [userPickerSearch, setUserPickerSearch] = useState("");

  // Expanded member details (goals, assists, fee exemption, notes)
  const [expandedMemberIds, setExpandedMemberIds] = useState<Record<string, boolean>>({});

  // Form state
  const [title, setTitle] = useState(initial?.title ?? "");
  const [playedAt, setPlayedAt] = useState(initial?.playedAt ?? "");
  const [opponentId, setOpponentId] = useState(initial?.opponentId ?? "");
  const [addingOpponent, setAddingOpponent] = useState(false);
  const [newOpponentName, setNewOpponentName] = useState("");
  const [ourScore, setOurScore] = useState(
    initial?.ourScore === null || initial?.ourScore === undefined ? "" : String(initial.ourScore),
  );
  const [opponentScore, setOpponentScore] = useState(
    initial?.opponentScore === null || initial?.opponentScore === undefined
      ? ""
      : String(initial.opponentScore),
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [totalAmount, setTotalAmount] = useState(initial?.totalAmount ?? 0);
  const [chargeOptions, setChargeOptions] = useState<CollectionChargeOption[]>(
    initial?.chargeOptions ?? [],
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initial?.members.map((member) => member.userId) ?? [],
  );
  const [slots, setSlots] = useState<Record<string, number>>(
    Object.fromEntries(initial?.members.map((member) => [member.userId, member.slots]) ?? []),
  );
  const [amounts, setAmounts] = useState<Record<string, number>>(
    Object.fromEntries(initial?.members.map((member) => [member.userId, member.amountDue]) ?? []),
  );
  const [memberNotes, setMemberNotes] = useState<Record<string, string>>(
    Object.fromEntries(initial?.members.map((member) => [member.userId, member.note]) ?? []),
  );
  const [feeExemptions, setFeeExemptions] = useState<Record<string, boolean>>(
    Object.fromEntries(
      initial?.members.map((member) => [member.userId, member.isFeeExempt]) ?? [],
    ),
  );
  const [exemptionReasons, setExemptionReasons] = useState<Record<string, string>>(
    Object.fromEntries(
      initial?.members.map((member) => [member.userId, member.exemptionReason]) ?? [],
    ),
  );
  const [goals, setGoals] = useState<Record<string, string>>(
    Object.fromEntries(initial?.members.map((member) => [member.userId, String(member.goals)]) ?? []),
  );
  const [assists, setAssists] = useState<Record<string, string>>(
    Object.fromEntries(
      initial?.members.map((member) => [member.userId, String(member.assists)]) ?? [],
    ),
  );
  const [paidAmounts, setPaidAmounts] = useState<Record<string, number>>(
    Object.fromEntries(initial?.members.map((member) => [member.userId, member.amountPaid]) ?? []),
  );
  const [manualPaidUsers, setManualPaidUsers] = useState<Record<string, boolean>>(
    Object.fromEntries(
      initial?.members.map((member) => [member.userId, Boolean(member.manualPaidAt)]) ?? [],
    ),
  );
  const [paidBreakdowns, setPaidBreakdowns] = useState<Record<string, PaidBreakdown>>(
    Object.fromEntries(initial?.members.map((member) => [member.userId, member.paidBreakdown]) ?? []),
  );
  const [paidOptionIds, setPaidOptionIds] = useState<Record<string, string[]>>(
    Object.fromEntries(initial?.members.map((member) => [member.userId, member.paidOptionIds]) ?? []),
  );

  // Manual payment modal state
  const [manualPaymentTarget, setManualPaymentTarget] = useState<{
    memberId: string;
    userId: string;
    name: string;
    footballAmount: number;
  } | null>(null);
  const [manualOptionSelections, setManualOptionSelections] = useState<
    Record<string, { included: boolean; amount: number }>
  >({});
  const [manualPaymentError, setManualPaymentError] = useState("");

  // Delete modal state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const membersByUser = useMemo(
    () => new Map(initial?.members.map((member) => [member.userId, member]) ?? []),
    [initial],
  );

  const selectedUsers = useMemo(() => {
    return users
      .filter((user) => selectedIds.includes(user.id))
      .sort((left, right) => {
        const rank = (userId: string) => {
          const paid = getPaidBreakdownTotal(
            paidBreakdowns[userId] ?? {
              footballAmount: paidAmounts[userId] ?? 0,
              options: [],
            },
          );
          const due = amounts[userId] ?? 0;
          return paid <= 0 ? 0 : paid < due ? 1 : 2;
        };
        return rank(left.id) - rank(right.id) || left.name.localeCompare(right.name, "vi");
      });
  }, [users, selectedIds, paidBreakdowns, paidAmounts, amounts]);

  const chargeableIds = selectedIds.filter((userId) => !isMatch || !feeExemptions[userId]);
  const totalSlots = chargeableIds.reduce(
    (sum, userId) => sum + (isMatch ? slots[userId] ?? 1 : 1),
    0,
  );
  const amountPerSlot = totalSlots ? roundUpToOneThousand(totalAmount / totalSlots) : 0;
  const allocatedAmount = selectedIds.reduce((sum, userId) => sum + (amounts[userId] ?? 0), 0);
  const difference = allocatedAmount - totalAmount;

  const totalPaidSum = selectedIds.reduce((sum, id) => sum + (paidAmounts[id] ?? 0), 0);
  const totalOutstanding = Math.max(allocatedAmount - totalPaidSum, 0);
  const paidMembersCount = selectedUsers.filter(
    (u) => (paidAmounts[u.id] ?? 0) >= (amounts[u.id] ?? 0) && (amounts[u.id] ?? 0) > 0,
  ).length;

  function distributeEvenly(ids: string[], total: number, slotValues = slots) {
    const splitIds = ids.filter((id) => !isMatch || !feeExemptions[id]);
    const distributed = allocateBySlots(
      total,
      splitIds.map((id) => ({ id, slots: isMatch ? slotValues[id] ?? 1 : 1 })),
    );
    setAmounts((current) =>
      Object.fromEntries(
        ids.map((id) => [
          id,
          isMatch && feeExemptions[id] ? 0 : distributed[id] ?? current[id] ?? 0,
        ]),
      ),
    );
  }

  function changeTotal(value: number) {
    const nextTotal = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
    setTotalAmount(nextTotal);
  }

  function toggleUser(userId: string) {
    const isSelected = selectedIds.includes(userId);
    const nextIds = isSelected ? selectedIds.filter((id) => id !== userId) : [...selectedIds, userId];
    const nextSlots = { ...slots };
    if (isSelected) delete nextSlots[userId];
    else nextSlots[userId] = 1;
    setMemberNotes((current) => {
      const next = { ...current };
      if (isSelected) delete next[userId];
      else next[userId] = "";
      return next;
    });
    setFeeExemptions((current) => {
      const next = { ...current };
      if (isSelected) delete next[userId];
      else next[userId] = false;
      return next;
    });
    setExemptionReasons((current) => {
      const next = { ...current };
      if (isSelected) delete next[userId];
      else next[userId] = "";
      return next;
    });
    setGoals((current) => {
      const next = { ...current };
      if (isSelected) delete next[userId];
      else next[userId] = "0";
      return next;
    });
    setAssists((current) => {
      const next = { ...current };
      if (isSelected) delete next[userId];
      else next[userId] = "0";
      return next;
    });
    setSelectedIds(nextIds);
    setSlots(nextSlots);
    distributeEvenly(nextIds, totalAmount, nextSlots);
  }

  function selectAll() {
    if (selectedIds.length === users.length && users.length) {
      setSelectedIds([]);
      setSlots({});
      setAmounts({});
      return;
    }
    const nextIds = users.map((user) => user.id);
    const nextSlots = Object.fromEntries(nextIds.map((id) => [id, slots[id] ?? 1]));
    setSelectedIds(nextIds);
    setSlots(nextSlots);
    distributeEvenly(nextIds, totalAmount, nextSlots);
  }

  function changeSlots(userId: string, delta: number) {
    const nextSlots = {
      ...slots,
      [userId]: Math.max(1, (slots[userId] ?? 1) + delta),
    };
    setSlots(nextSlots);
    distributeEvenly(selectedIds, totalAmount, nextSlots);
  }

  function toggleExpandMember(userId: string) {
    setExpandedMemberIds((curr) => ({ ...curr, [userId]: !curr[userId] }));
  }

  function addChargeOption() {
    const nextOption: CollectionChargeOption = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `opt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: "",
      defaultAmount: 0,
      autoSelected: false,
      allowCustomAmount: false,
    };
    setChargeOptions((current) => [...current, nextOption]);
  }

  function updateChargeOption(id: string, patch: Partial<CollectionChargeOption>) {
    setChargeOptions((current) =>
      current.map((option) => (option.id === id ? { ...option, ...patch } : option)),
    );
  }

  function validate() {
    if (title.trim().length < 3) return "Nhập tên khoản thu có ít nhất 3 ký tự.";
    if (!playedAt) return isMatch ? "Chọn ngày đá." : "Chọn ngày áp dụng.";
    if (totalAmount < 0 || (kind === "GENERAL" && totalAmount === 0)) return "Kiểm tra lại tổng tiền.";
    if (isMatch && (addingOpponent ? newOpponentName.trim().length < 2 : !opponentId)) return "Chọn hoặc nhập đối thủ.";
    if ((ourScore === "") !== (opponentScore === "")) return "Nhập đủ tỷ số của hai đội.";
    if (!selectedIds.length) return "Chọn ít nhất một người tham gia.";
    if (selectedIds.some((id) => !Number.isInteger(amounts[id]) || amounts[id] < 0)) return "Kiểm tra lại số tiền của người tham gia.";
    const optionNames = chargeOptions.map((option) => option.name.trim().toLocaleLowerCase("vi-VN"));
    if (chargeOptions.some((option) => !option.name.trim() || option.name.trim().length > 100 || option.defaultAmount < 0)) return "Kiểm tra lại các tùy chọn chi phí.";
    if (new Set(optionNames).size !== optionNames.length) return "Tên tùy chọn chi phí không được trùng nhau.";
    return "";
  }

  function openPreview() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setPreview(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function save(status: "DRAFT" | "PUBLISHED") {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setPreview(false);
      return;
    }

    setError("");
    startTransition(async () => {
      const result = await saveCollection({
        id: initial?.id,
        kind,
        title: title.trim(),
        playedAt,
        opponentId: isMatch && !addingOpponent ? opponentId : "",
        newOpponentName: isMatch && addingOpponent ? newOpponentName.trim() : "",
        ourScore: isMatch && ourScore !== "" ? Number(ourScore) : null,
        opponentScore: isMatch && opponentScore !== "" ? Number(opponentScore) : null,
        note: note.trim(),
        totalAmount,
        chargeOptions: chargeOptions
          .filter((option) => option.name.trim())
          .map((option) => ({
            ...option,
            name: option.name.trim(),
          })),
        status,
        members: selectedIds.map((userId) => ({
          userId,
          slots: isMatch ? slots[userId] ?? 1 : 1,
          amountDue: isMatch && feeExemptions[userId] ? 0 : amounts[userId] ?? 0,
          note: memberNotes[userId]?.trim() ?? "",
          isFeeExempt: isMatch ? Boolean(feeExemptions[userId]) : false,
          exemptionReason: isMatch ? exemptionReasons[userId]?.trim() ?? "" : "",
          goals: isMatch ? Number(goals[userId] || "0") : 0,
          assists: isMatch ? Number(assists[userId] || "0") : 0,
        })),
      });

      if (result.status === "error") {
        setError(result.message);
        return;
      }
      router.push(`/admin/collections/${result.id || initial?.id}`);
      router.refresh();
      setPreview(false);
    });
  }

  function openManualPayment(target: {
    memberId: string;
    userId: string;
    name: string;
    footballAmount: number;
  }) {
    const paidIds = new Set(paidOptionIds[target.userId] ?? []);
    const availableOptions = chargeOptions.filter((option) => !paidIds.has(option.id));
    setManualPaymentError("");
    setManualOptionSelections(
      Object.fromEntries(
        availableOptions.map((option) => [
          option.id,
          {
            included: option.autoSelected,
            amount: option.defaultAmount,
          },
        ]),
      ),
    );
    setManualPaymentTarget(target);
  }

  function confirmManualPayment() {
    if (!manualPaymentTarget) return;
    const target = manualPaymentTarget;
    const selectedOptions = manualChargeOptions
      .filter((option) => manualOptionSelections[option.id]?.included)
      .map((option) => ({
        optionId: option.id,
        amount: manualOptionSelections[option.id]?.amount ?? option.defaultAmount,
      }));

    setManualPaymentError("");
    startTransition(async () => {
      const result = await markMemberPaidManually(target.memberId, selectedOptions);
      if (result.status === "error") {
        setManualPaymentError(result.message);
        return;
      }
      setPaidAmounts((current) => ({ ...current, [target.userId]: result.amountPaid }));
      setManualPaidUsers((current) => ({ ...current, [target.userId]: Boolean(result.manualPaidAt) }));
      setPaidBreakdowns((current) => ({ ...current, [target.userId]: result.paidBreakdown }));
      setPaidOptionIds((current) => ({
        ...current,
        [target.userId]: [
          ...new Set([
            ...(current[target.userId] ?? []),
            ...selectedOptions.map((option) => option.optionId),
          ]),
        ],
      }));
      setManualPaymentTarget(null);
      router.refresh();
    });
  }

  function confirmDeleteCollection() {
    if (!initial) return;
    setDeleteError("");
    startTransition(async () => {
      const result = await deleteCollection(initial.id);
      if (result.status === "error") {
        setDeleteError(result.message);
        return;
      }
      router.push("/admin/collections");
      router.refresh();
    });
  }

  // Filtered members for display
  const filteredUsers = useMemo(() => {
    return selectedUsers.filter((user) => {
      if (memberSearch.trim()) {
        const query = memberSearch.toLowerCase();
        if (!user.name.toLowerCase().includes(query)) return false;
      }
      const paid = paidAmounts[user.id] ?? 0;
      const due = amounts[user.id] ?? 0;
      if (memberFilter === "debt") {
        return paid < due;
      }
      if (memberFilter === "paid") {
        return paid >= due && due > 0;
      }
      return true;
    });
  }, [selectedUsers, memberSearch, memberFilter, paidAmounts, amounts]);

  const manualChargeOptions = manualPaymentTarget
    ? chargeOptions.filter(
        (option) => !(paidOptionIds[manualPaymentTarget.userId] ?? []).includes(option.id),
      )
    : [];
  const manualOptionsTotal = manualChargeOptions.reduce((sum, option) => {
    const selection = manualOptionSelections[option.id];
    return sum + (selection?.included ? selection.amount : 0);
  }, 0);

  // PREVIEW MODE
  if (preview) {
    return (
      <div className="collection-preview">
        <div className="preview-banner">
          <div>
            <p className="eyebrow">KIỂM TRA LẦN CUỐI</p>
            <h2>Preview khoản thu</h2>
            <p>Đây là dữ liệu người dùng sẽ nhìn thấy sau khi public.</p>
          </div>
          <span className="draft-pill">
            {initial?.status === "PUBLISHED" ? "Đang public" : "Bản nháp"}
          </span>
        </div>

        <section className="preview-summary panel">
          <div><span>Loại</span><strong>{isMatch ? "Trận đấu" : "Khoản thu khác"}</strong></div>
          <div><span>Khoản thu</span><strong>{title}</strong></div>
          <div>
            <span>Ngày áp dụng</span>
            <strong>
              {playedAt ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(playedAt)) : "—"}
            </strong>
          </div>
          <div>
            <span>{isMatch ? "Người tham gia" : "Người cần đóng"}</span>
            <strong>
              {isMatch ? `${selectedIds.length} người · ${totalSlots} phần tính tiền` : `${selectedIds.length} người`}
            </strong>
          </div>
          <div><span>Tùy chọn chi phí</span><strong>{chargeOptions.length} tùy chọn</strong></div>
        </section>

        <section className="money-overview">
          <div className="money-card"><span>Tổng tiền nhập</span><strong>{formatVnd(totalAmount)}</strong></div>
          <div className="money-card"><span>Tổng đã phân bổ</span><strong>{formatVnd(allocatedAmount)}</strong></div>
          <div className={`money-card ${difference === 0 ? "balanced" : "different"}`}>
            <span>Chênh lệch</span><strong>{difference > 0 ? "+" : ""}{formatVnd(difference)}</strong>
          </div>
        </section>

        {difference !== 0 ? (
          <div className="preview-warning">
            <span>!</span>Tổng tiền phân bổ đang {difference > 0 ? "cao hơn" : "thấp hơn"} tổng khoản thu {formatVnd(Math.abs(difference))}. Bạn vẫn có thể public.
          </div>
        ) : null}

        <article className="panel preview-members">
          <div className="list-header">
            <div><h2>Chi tiết từng người</h2><p>Số tiền cuối cùng do admin xác nhận</p></div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{isMatch ? "Người tham gia" : "Người cần đóng"}</th>
                  {isMatch ? <th>Slot</th> : null}
                  <th>Đã thanh toán</th>
                  <th>Phải đóng</th>
                </tr>
              </thead>
              <tbody>
                {selectedUsers.map((user, index) => (
                  <tr key={user.id}>
                    <td>
                      <UserAvatar name={user.name} avatarKey={user.avatarKey} className="user-avatar" toneIndex={index} />
                      <div className="preview-member-identity">
                        <strong>{user.name}</strong>
                        {isMatch ? (
                          <small>
                            {feeExemptions[user.id]
                              ? "Miễn đóng"
                              : `${Number(goals[user.id] || "0")} bàn · ${Number(assists[user.id] || "0")} kiến tạo`}
                          </small>
                        ) : memberNotes[user.id] ? (
                          <small>Ghi chú: {memberNotes[user.id]}</small>
                        ) : null}
                      </div>
                    </td>
                    {isMatch ? <td><span className="slot-count-badge">{slots[user.id] ?? 1} slot</span></td> : null}
                    <td>
                      <div className="preview-paid-value">
                        <strong>
                          {formatVnd(getPaidBreakdownTotal(paidBreakdowns[user.id] ?? { footballAmount: paidAmounts[user.id] ?? 0, options: [] }))}
                        </strong>
                        {manualPaidUsers[user.id] ? <span className="manual-payment-badge">Thủ công</span> : null}
                      </div>
                    </td>
                    <td><strong className="amount-emphasis">{formatVnd(amounts[user.id] ?? 0)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        {error ? <div className="editor-error" role="alert">! {error}</div> : null}
        <div className="editor-footer preview-footer">
          <button className="secondary-button" type="button" disabled={isPending} onClick={() => setPreview(false)}>
            Quay lại chỉnh sửa
          </button>
          <div>
            {initial?.status !== "PUBLISHED" ? (
              <button className="secondary-button" type="button" disabled={isPending} onClick={() => save("DRAFT")}>
                Lưu bản nháp
              </button>
            ) : null}
            <button className="primary-button publish-button" type="button" disabled={isPending} onClick={() => save("PUBLISHED")}>
              {isPending ? <span className="spinner" /> : null}
              {isPending ? "Đang lưu..." : initial?.status === "PUBLISHED" ? "Lưu thay đổi" : "Public khoản thu"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MAIN MODERN EDITOR
  return (
    <div className="collection-editor-modern">
      {/* 1. FINANCIAL SUMMARY BAR (COMPACT & UNIFIED) */}
      <header className="panel collection-summary-bar">
        <div className="summary-bar-metrics">
          <div className="summary-metric">
            <span>Tổng tiền</span>
            <strong>{formatVnd(totalAmount)}</strong>
          </div>
          <div className="summary-metric">
            <span>Đã thu</span>
            <strong className="text-success">{formatVnd(totalPaidSum)}</strong>
            <small>({paidMembersCount}/{selectedIds.length} người)</small>
          </div>
          <div className="summary-metric">
            <span>Còn thiếu</span>
            <strong className={totalOutstanding > 0 ? "text-error" : ""}>
              {formatVnd(totalOutstanding)}
            </strong>
          </div>
          <div className={`summary-metric balance-box ${difference === 0 ? "balanced" : "warning"}`}>
            <span>Phân bổ</span>
            <strong>{difference === 0 ? "Khớp 100%" : `Chênh ${difference > 0 ? "+" : ""}${formatVnd(difference)}`}</strong>
          </div>
        </div>

        {/* Quick Top Bar Actions */}
        <div className="summary-bar-actions">
          <Link className="secondary-button compact-btn" href="/admin/collections">
            Thoát
          </Link>
          <button className="secondary-button compact-btn" type="button" onClick={openPreview}>
            Xem trước
          </button>
          {initial?.status !== "PUBLISHED" ? (
            <button
              className="secondary-button compact-btn"
              type="button"
              disabled={isPending}
              onClick={() => save("DRAFT")}
            >
              Lưu nháp
            </button>
          ) : null}
          <button
            className="primary-button compact-btn"
            type="button"
            disabled={isPending}
            onClick={() => save("PUBLISHED")}
          >
            {isPending ? <span className="spinner" /> : null}
            {isPending ? "Đang lưu..." : initial?.status === "PUBLISHED" ? "Lưu thay đổi" : "Public"}
          </button>
        </div>
      </header>

      {error ? <div className="editor-error" role="alert">! {error}</div> : null}

      {/* 2. TAB CONTROLS */}
      <nav className="collection-editor-tabs" aria-label="Điều hướng tab biên tập">
        <button
          type="button"
          className={`editor-tab-item ${activeTab === "members" ? "active" : ""}`}
          onClick={() => setActiveTab("members")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>Thu tiền & Danh sách thành viên</span>
          <span className="tab-counter">{selectedIds.length}</span>
        </button>

        <button
          type="button"
          className={`editor-tab-item ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63h.01A1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9v.01A1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" />
          </svg>
          <span>Thông tin & Cài đặt trận</span>
          {difference !== 0 ? <span className="tab-warning-dot" title="Phân bổ chưa khớp" /> : null}
        </button>
      </nav>

      {/* 3. TAB 1: MEMBERS & COLLECTION MANAGEMENT */}
      {activeTab === "members" && (
        <div className="tab-pane-members">
          {/* Member Toolbar */}
          <div className="member-toolbar panel">
            <div className="toolbar-search">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Tìm thành viên theo tên..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
              />
              {memberSearch && (
                <button type="button" className="clear-search" onClick={() => setMemberSearch("")}>
                  ×
                </button>
              )}
            </div>

            <div className="toolbar-filters">
              <button
                type="button"
                className={`filter-chip ${memberFilter === "all" ? "active" : ""}`}
                onClick={() => setMemberFilter("all")}
              >
                Tất cả ({selectedUsers.length})
              </button>
              <button
                type="button"
                className={`filter-chip chip-debt ${memberFilter === "debt" ? "active" : ""}`}
                onClick={() => setMemberFilter("debt")}
              >
                Chưa trả ({selectedUsers.filter((u) => (paidAmounts[u.id] ?? 0) < (amounts[u.id] ?? 0)).length})
              </button>
              <button
                type="button"
                className={`filter-chip chip-paid ${memberFilter === "paid" ? "active" : ""}`}
                onClick={() => setMemberFilter("paid")}
              >
                Đã trả ({paidMembersCount})
              </button>
            </div>

            <div className="toolbar-actions">
              <button
                type="button"
                className="secondary-button compact-btn select-members-btn"
                onClick={() => setUserPickerOpen(true)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Chọn / Bỏ người ({selectedIds.length})
              </button>
              <button
                type="button"
                className="secondary-button compact-btn"
                title="Chia đều tổng tiền theo slot hiện tại"
                onClick={() => distributeEvenly(selectedIds, totalAmount)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
                </svg>
                Chia đều lại
              </button>
            </div>
          </div>

          {/* Members Table */}
          <section className="panel members-clean-table-wrap">
            <div className="table-wrap">
              <table className="members-clean-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Thành viên</th>
                    {isMatch && <th className="text-center" style={{ width: 120 }}>Số slot</th>}
                    <th className="text-right" style={{ width: 150 }}>Phải đóng</th>
                    <th className="text-right" style={{ width: 140 }}>Đã trả</th>
                    <th className="text-center" style={{ width: 120 }}>Trạng thái</th>
                    <th className="text-right" style={{ width: 220 }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user, index) => {
                    const member = membersByUser.get(user.id);
                    const amountPaid = paidAmounts[user.id] ?? 0;
                    const amountDue = amounts[user.id] ?? 0;
                    const isPaid = amountPaid >= amountDue && amountDue > 0;
                    const isPartial = amountPaid > 0 && amountPaid < amountDue;
                    const isExempt = isMatch && Boolean(feeExemptions[user.id]);
                    const isExpanded = Boolean(expandedMemberIds[user.id]);

                    const paidBreakdown = paidBreakdowns[user.id] ?? {
                      footballAmount: amountPaid,
                      options: [],
                    };
                    const totalPaid = getPaidBreakdownTotal(paidBreakdown);

                    return (
                      <tr
                        key={user.id}
                        className={`member-row-clean ${!isPaid && !isExempt ? "has-debt" : ""} ${isExpanded ? "expanded" : ""}`}
                      >
                        <td className="text-muted">{index + 1}</td>
                        <td>
                          <div className="table-user-cell">
                            <UserAvatar
                              name={user.name}
                              avatarKey={user.avatarKey}
                              className="user-avatar"
                              toneIndex={index}
                            />
                            <div className="table-user-info">
                              <strong>{user.name}</strong>
                              <div className="user-sub-info">
                                {isExempt && (
                                  <span className="exempt-badge">Miễn đóng</span>
                                )}
                                {isMatch && !isExempt && (Number(goals[user.id] || 0) > 0 || Number(assists[user.id] || 0) > 0) && (
                                  <small className="stats-indicator">
                                    {Number(goals[user.id] || 0)} bàn · {Number(assists[user.id] || 0)} kiến tạo
                                  </small>
                                )}
                                {memberNotes[user.id] && (
                                  <small className="note-indicator">💬 {memberNotes[user.id]}</small>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Slot Stepper */}
                        {isMatch && (
                          <td className="text-center">
                            <div className="slot-stepper-compact">
                              <button
                                type="button"
                                disabled={(slots[user.id] ?? 1) <= 1}
                                onClick={() => changeSlots(user.id, -1)}
                              >
                                −
                              </button>
                              <span>{slots[user.id] ?? 1}</span>
                              <button type="button" onClick={() => changeSlots(user.id, 1)}>
                                +
                              </button>
                            </div>
                          </td>
                        )}

                        {/* Phải đóng Input */}
                        <td className="text-right">
                          <div className={`compact-money-cell ${isExempt ? "disabled" : ""}`}>
                            <input
                              type="text"
                              inputMode="numeric"
                              disabled={isExempt}
                              value={isExempt ? "0" : formatMoneyInput(amounts[user.id] ?? 0)}
                              onChange={(e) =>
                                setAmounts((curr) => ({
                                  ...curr,
                                  [user.id]: parseMoneyInput(e.target.value),
                                }))
                              }
                              placeholder="0"
                            />
                            <span>đ</span>
                          </div>
                        </td>

                        {/* Đã trả */}
                        <td className="text-right">
                          {totalPaid > 0 ? (
                            <div className="paid-amount-wrap">
                              <strong className="text-success font-mono">
                                {formatVnd(totalPaid)}
                              </strong>
                              {manualPaidUsers[user.id] && (
                                <span className="manual-chip">Thủ công</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted font-mono">—</span>
                          )}
                        </td>

                        {/* Trạng thái */}
                        <td className="text-center">
                          {isPaid ? (
                            <span className="status-badge badge-paid">Đã đủ</span>
                          ) : isPartial ? (
                            <span className="status-badge badge-amber">Một phần</span>
                          ) : isExempt ? (
                            <span className="status-badge badge-neutral">Miễn phí</span>
                          ) : (
                            <span className="status-badge badge-debt">Chưa trả</span>
                          )}
                        </td>

                        {/* Thao tác */}
                        <td className="text-right">
                          <div className="row-actions-group">
                            {!isPaid && member && initial?.status !== "DRAFT" ? (
                              <button
                                className="manual-pay-action-btn"
                                type="button"
                                disabled={isPending}
                                onClick={() =>
                                  openManualPayment({
                                    memberId: member.id,
                                    userId: user.id,
                                    name: user.name,
                                    footballAmount: Math.max(amountDue - amountPaid, 0),
                                  })
                                }
                              >
                                Xác nhận tiền mặt
                              </button>
                            ) : null}

                            <button
                              type="button"
                              className={`expand-toggle-btn ${isExpanded ? "active" : ""}`}
                              onClick={() => toggleExpandMember(user.id)}
                              title="Chi tiết bàn thắng, kiến tạo, ghi chú"
                            >
                              <span>{isExpanded ? "Thu gọn" : "Chi tiết"}</span>
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d={isExpanded ? "m18 15-6-6-6 6" : "m6 9 6 6 6-6"} />
                              </svg>
                            </button>
                          </div>

                          {/* Collapsible Details Panel */}
                          {isExpanded && (
                            <div className="member-expanded-box">
                              {isMatch && (
                                <div className="expanded-section">
                                  <label className="check-label">
                                    <input
                                      type="checkbox"
                                      checked={feeExemptions[user.id] ?? false}
                                      onChange={(e) => {
                                        setFeeExemptions((curr) => ({
                                          ...curr,
                                          [user.id]: e.target.checked,
                                        }));
                                        if (e.target.checked) {
                                          setAmounts((curr) => ({ ...curr, [user.id]: 0 }));
                                        }
                                      }}
                                    />
                                    <span>Miễn đóng trận này</span>
                                  </label>
                                  {feeExemptions[user.id] && (
                                    <input
                                      type="text"
                                      className="plain-input compact-input"
                                      placeholder="Lý do miễn đóng..."
                                      value={exemptionReasons[user.id] ?? ""}
                                      onChange={(e) =>
                                        setExemptionReasons((curr) => ({
                                          ...curr,
                                          [user.id]: e.target.value,
                                        }))
                                      }
                                    />
                                  )}
                                </div>
                              )}

                              {isMatch && (
                                <div className="expanded-stats-grid">
                                  <label>
                                    <span>Bàn thắng:</span>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={goals[user.id] ?? "0"}
                                      onFocus={(e) => e.currentTarget.select()}
                                      onChange={(e) =>
                                        setGoals((curr) => ({
                                          ...curr,
                                          [user.id]: sanitizeStatInput(e.target.value),
                                        }))
                                      }
                                    />
                                  </label>
                                  <label>
                                    <span>Kiến tạo:</span>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={assists[user.id] ?? "0"}
                                      onFocus={(e) => e.currentTarget.select()}
                                      onChange={(e) =>
                                        setAssists((curr) => ({
                                          ...curr,
                                          [user.id]: sanitizeStatInput(e.target.value),
                                        }))
                                      }
                                    />
                                  </label>
                                </div>
                              )}

                              <div className="expanded-note-field">
                                <span>Ghi chú riêng:</span>
                                <input
                                  type="text"
                                  placeholder={`Ghi chú cho ${user.name}...`}
                                  value={memberNotes[user.id] ?? ""}
                                  onChange={(e) =>
                                    setMemberNotes((curr) => ({
                                      ...curr,
                                      [user.id]: e.target.value,
                                    }))
                                  }
                                />
                              </div>

                              <button
                                type="button"
                                className="remove-member-link"
                                onClick={() => toggleUser(user.id)}
                              >
                                Xóa khỏi khoản thu này
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!filteredUsers.length && (
              <div className="table-empty-box">
                <p>Không tìm thấy thành viên phù hợp với bộ lọc.</p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* 4. TAB 2: SETTINGS & MATCH CONFIG */}
      {activeTab === "settings" && (
        <div className="tab-pane-settings">
          <section className="panel editor-panel">
            <div className="editor-section-heading">
              <div>
                <h2>Thông tin khoản thu</h2>
                <p>Cập nhật tên, thời gian, đối thủ và tỉ số trận đấu.</p>
              </div>
            </div>

            <div className="editor-fields">
              <div className="field-group full-field">
                <label>Loại khoản thu</label>
                <div className="collection-kind-readonly">
                  <strong>{isMatch ? "Trận đấu" : "Khoản thu khác"}</strong>
                  <small>Loại khoản thu không thể thay đổi sau khi tạo.</small>
                </div>
              </div>

              <div className="field-group full-field">
                <label htmlFor="collection-title">Tên khoản thu</label>
                <input
                  id="collection-title"
                  className="plain-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isMatch ? "Ví dụ: Sân Thủy Lợi tối thứ 5" : "Ví dụ: Tiền áo đấu 2026"}
                  maxLength={100}
                />
              </div>

              <div className="field-group full-field">
                <label htmlFor="played-at">{isMatch ? "Ngày đá" : "Ngày áp dụng"}</label>
                <input
                  id="played-at"
                  className="plain-input"
                  type="date"
                  value={playedAt}
                  onChange={(e) => setPlayedAt(e.target.value)}
                />
              </div>

              {isMatch && (
                <>
                  <div className="field-group full-field">
                    <label htmlFor="opponent">Đối thủ</label>
                    <select
                      id="opponent"
                      className="plain-input"
                      value={addingOpponent ? "__new" : opponentId}
                      onChange={(e) => {
                        const create = e.target.value === "__new";
                        setAddingOpponent(create);
                        if (!create) setOpponentId(e.target.value);
                      }}
                    >
                      <option value="">Chọn đối thủ</option>
                      {opponents.map((opp) => (
                        <option value={opp.id} key={opp.id}>
                          {opp.name}
                        </option>
                      ))}
                      <option value="__new">+ Thêm đối thủ mới</option>
                    </select>
                  </div>

                  {addingOpponent && (
                    <div className="field-group full-field">
                      <label htmlFor="new-opponent">Tên đối thủ mới</label>
                      <input
                        id="new-opponent"
                        className="plain-input"
                        value={newOpponentName}
                        maxLength={100}
                        placeholder="Nhập tên đội đối thủ..."
                        onChange={(e) => setNewOpponentName(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="field-group">
                    <label htmlFor="our-score">Bàn FC Đông Đô</label>
                    <input
                      id="our-score"
                      className="plain-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={3}
                      value={ourScore}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => setOurScore(sanitizeStatInput(e.target.value))}
                      placeholder="0"
                    />
                  </div>

                  <div className="field-group">
                    <label htmlFor="opponent-score">Bàn đối thủ</label>
                    <input
                      id="opponent-score"
                      className="plain-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={3}
                      value={opponentScore}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => setOpponentScore(sanitizeStatInput(e.target.value))}
                      placeholder="0"
                    />
                  </div>
                </>
              )}

              <div className="field-group full-field">
                <label htmlFor="total-amount">Tổng tiền cần thu</label>
                <div className="money-input">
                  <input
                    id="total-amount"
                    type="text"
                    inputMode="numeric"
                    value={formatMoneyInput(totalAmount)}
                    onChange={(e) => changeTotal(parseMoneyInput(e.target.value))}
                    placeholder="0"
                  />
                  <span>VNĐ</span>
                </div>
              </div>

              {/* Charge Options */}
              <div className="field-group full-field charge-options-field">
                <div className="charge-options-heading">
                  <div>
                    <label>Khoản bổ sung tùy chọn</label>
                    <small className="field-hint">
                      Ví dụ: tiền nước, phụ phí... Người dùng có thể tích chọn thêm khi quét QR.
                    </small>
                  </div>
                  <button type="button" className="add-option-btn" onClick={addChargeOption}>
                    + Thêm tùy chọn
                  </button>
                </div>

                <div className="charge-option-list">
                  {chargeOptions.map((opt, idx) => (
                    <div className="charge-option-row" key={opt.id}>
                      <span className="charge-option-order">{idx + 1}</span>
                      <input
                        className="plain-input"
                        value={opt.name}
                        onChange={(e) => updateChargeOption(opt.id, { name: e.target.value })}
                        placeholder="Ví dụ: Tiền nước"
                        maxLength={100}
                      />
                      <div className="money-input">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatMoneyInput(opt.defaultAmount)}
                          onChange={(e) =>
                            updateChargeOption(opt.id, {
                              defaultAmount: parseMoneyInput(e.target.value),
                            })
                          }
                          placeholder="0"
                        />
                        <span>VNĐ</span>
                      </div>
                      <label className="charge-option-check">
                        <input
                          type="checkbox"
                          checked={opt.autoSelected}
                          onChange={(e) =>
                            updateChargeOption(opt.id, { autoSelected: e.target.checked })
                          }
                        />
                        <span>Tự tích</span>
                      </label>
                      <label className="charge-option-check">
                        <input
                          type="checkbox"
                          checked={opt.allowCustomAmount}
                          onChange={(e) =>
                            updateChargeOption(opt.id, { allowCustomAmount: e.target.checked })
                          }
                        />
                        <span>Cho sửa</span>
                      </label>
                      <button
                        className="charge-option-remove"
                        type="button"
                        onClick={() =>
                          setChargeOptions((curr) => curr.filter((item) => item.id !== opt.id))
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {!chargeOptions.length && (
                    <div className="charge-option-empty">
                      Chưa có khoản bổ sung nào. Thành viên chỉ đóng số tiền chính.
                    </div>
                  )}
                </div>
              </div>

              <div className="field-group full-field">
                <label htmlFor="collection-note">Ghi chú chung</label>
                <textarea
                  id="collection-note"
                  className="plain-input"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú nội dung, thời hạn thanh toán..."
                  maxLength={500}
                />
              </div>
            </div>
          </section>

          {/* Delete Collection Section */}
          {initial && (
            <section className="collection-delete-zone panel">
              <div>
                <strong>Xóa khoản thu</strong>
                <p>Khoản thu sẽ bị xóa khỏi hệ thống. Các giao dịch cũ vẫn được lưu trong lịch sử.</p>
              </div>
              <button
                className="collection-delete-button"
                type="button"
                disabled={isPending}
                onClick={() => {
                  setDeleteError("");
                  setDeleteConfirmOpen(true);
                }}
              >
                Xóa khoản thu
              </button>
            </section>
          )}
        </div>
      )}

      {/* 5. MODAL: MEMBER PICKER (TINH GỌN, KHÔNG CHIẾM DIỆN TÍCH TRANG CHÍNH) */}
      {userPickerOpen && (
        <div
          className="dialog-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setUserPickerOpen(false);
          }}
        >
          <div className="dialog-card member-picker-modal">
            <div className="dialog-head">
              <div>
                <h2>Chọn người tham gia</h2>
                <p>Đã chọn {selectedIds.length} / {users.length} thành viên</p>
              </div>
              <button
                type="button"
                className="dialog-close"
                onClick={() => setUserPickerOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="picker-search-bar">
              <input
                type="text"
                placeholder="Tìm thành viên..."
                value={userPickerSearch}
                onChange={(e) => setUserPickerSearch(e.target.value)}
              />
              <button type="button" className="select-all-btn" onClick={selectAll}>
                {selectedIds.length === users.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
              </button>
            </div>

            <div className="picker-user-grid">
              {users
                .filter((u) => u.name.toLowerCase().includes(userPickerSearch.toLowerCase()))
                .map((u, i) => {
                  const isChecked = selectedIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className={`picker-user-card ${isChecked ? "selected" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleUser(u.id)}
                      />
                      <UserAvatar
                        name={u.name}
                        avatarKey={u.avatarKey}
                        className="user-avatar"
                        toneIndex={i}
                      />
                      <span>{u.name}</span>
                      <i>{isChecked ? "✓" : ""}</i>
                    </label>
                  );
                })}
            </div>

            <div className="dialog-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => setUserPickerOpen(false)}
              >
                Xong ({selectedIds.length} người)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: MANUAL PAYMENT RECORD */}
      {manualPaymentTarget && (
        <div
          className="dialog-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isPending) setManualPaymentTarget(null);
          }}
        >
          <section
            className="dialog-card manual-payment-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-payment-title"
          >
            <button
              className="dialog-close"
              type="button"
              aria-label="Đóng"
              disabled={isPending}
              onClick={() => setManualPaymentTarget(null)}
            >
              ×
            </button>
            <div className="manual-payment-heading">
              <span aria-hidden="true">✓</span>
              <div>
                <h2 id="manual-payment-title">Ghi nhận tiền mặt</h2>
                <p>{manualPaymentTarget.name}</p>
              </div>
            </div>
            <div className="manual-payment-breakdown">
              <div>
                <span>Khoản chính còn lại</span>
                <strong>{formatVnd(manualPaymentTarget.footballAmount)}</strong>
              </div>
              {manualChargeOptions.map((option) => {
                const selection = manualOptionSelections[option.id];
                return (
                  <div className="manual-option-row" key={option.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selection?.included ?? false}
                        onChange={(event) =>
                          setManualOptionSelections((current) => ({
                            ...current,
                            [option.id]: {
                              included: event.target.checked,
                              amount: current[option.id]?.amount ?? option.defaultAmount,
                            },
                          }))
                        }
                      />
                      <span>{option.name}</span>
                    </label>
                    {selection?.included && option.allowCustomAmount ? (
                      <div className="water-money-input">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatMoneyInput(selection.amount)}
                          onChange={(event) =>
                            setManualOptionSelections((current) => ({
                              ...current,
                              [option.id]: {
                                included: true,
                                amount: parseMoneyInput(event.target.value),
                              },
                            }))
                          }
                        />
                        <span>đ</span>
                      </div>
                    ) : (
                      <strong>
                        {formatVnd(selection?.included ? option.defaultAmount : 0)}
                      </strong>
                    )}
                  </div>
                );
              })}
              {!manualChargeOptions.length && (
                <div className="manual-option-row">
                  <span>Không còn tùy chọn chưa thanh toán</span>
                </div>
              )}
            </div>
            <div className="manual-payment-amount">
              <span>Tổng số tiền ghi nhận</span>
              <strong>
                {formatVnd(manualPaymentTarget.footballAmount + manualOptionsTotal)}
              </strong>
            </div>
            <p className="manual-payment-note">Mã QR đang chờ sẽ tự động được hủy.</p>
            {manualPaymentError && (
              <div className="editor-error manual-payment-error" role="alert">
                ! {manualPaymentError}
              </div>
            )}
            <div className="dialog-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={isPending}
                onClick={() => setManualPaymentTarget(null)}
              >
                Hủy
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={isPending}
                onClick={confirmManualPayment}
              >
                {isPending ? "Đang ghi nhận..." : "Xác nhận tiền mặt"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* 7. MODAL: DELETE COLLECTION CONFIRMATION */}
      {deleteConfirmOpen && initial && (
        <div
          className="dialog-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isPending) setDeleteConfirmOpen(false);
          }}
        >
          <section
            className="dialog-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-collection-title"
          >
            <div className="dialog-icon danger">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
              </svg>
            </div>
            <div className="dialog-heading">
              <h2 id="delete-collection-title">Xóa khoản thu?</h2>
              <p>
                Bạn có chắc muốn xóa <strong>{initial.title}</strong>? Các mã QR đang chờ liên quan
                sẽ bị hủy và thao tác này không thể hoàn tác.
              </p>
            </div>
            {deleteError && (
              <div className="editor-error delete-collection-error" role="alert">
                ! {deleteError}
              </div>
            )}
            <div className="dialog-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={isPending}
                onClick={() => setDeleteConfirmOpen(false)}
              >
                Hủy
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={isPending}
                onClick={confirmDeleteCollection}
              >
                {isPending ? <span className="spinner" aria-hidden="true" /> : null}
                {isPending ? "Đang xóa..." : "Xóa khoản thu"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
